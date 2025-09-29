const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config');

// Ensure the database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize the database
const db = new Database(config.dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Enable foreign key support
db.exec("PRAGMA foreign_keys = ON;");

/**
 * Initializes or migrates database tables.
 * This is a simple migration script that mimics the original PHP logic.
 */
function initTables() {
    // short_urls table
    const shortUrlsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='short_urls'").get();
    if (!shortUrlsTable) {
        db.exec(`
            CREATE TABLE short_urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_url TEXT NOT NULL,
                short_code TEXT NOT NULL,
                passcode TEXT DEFAULT NULL,
                clicks INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expiry_date TEXT DEFAULT NULL,
                user_id INTEGER,
                domain_id INTEGER DEFAULT 0,
                auto_delete INTEGER DEFAULT 0,
                UNIQUE(short_code, domain_id)
            )
        `);
    } else {
        const columns = db.prepare("PRAGMA table_info(short_urls)").all().map(c => c.name);
        if (!columns.includes('expiry_date')) db.exec('ALTER TABLE short_urls ADD COLUMN expiry_date TEXT DEFAULT NULL');
        if (!columns.includes('user_id')) db.exec('ALTER TABLE short_urls ADD COLUMN user_id INTEGER');
        if (!columns.includes('domain_id')) db.exec('ALTER TABLE short_urls ADD COLUMN domain_id INTEGER DEFAULT 0');
        if (!columns.includes('auto_delete')) db.exec('ALTER TABLE short_urls ADD COLUMN auto_delete INTEGER DEFAULT 0');
    }

    // admins table
    const adminsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admins'").get();
    if (!adminsTable) {
        db.exec(`
            CREATE TABLE admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                quota INTEGER DEFAULT 0,
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active'
            )
        `);
    } else {
        const columns = db.prepare("PRAGMA table_info(admins)").all().map(c => c.name);
        if (!columns.includes('quota')) db.exec("ALTER TABLE admins ADD COLUMN quota INTEGER DEFAULT 0");
        if (!columns.includes('role')) {
            db.exec("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'user'");
        }
        // Migration: Update existing 'admin' roles to 'user'
        try {
            db.exec("UPDATE admins SET role = 'user' WHERE role = 'admin'");
        } catch(e) { /* ignore if column doesn't exist yet on old schemas */ }

        if (!columns.includes('status')) {
            db.exec("ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active'");
        }
    }

    // domains table
    db.exec(`
        CREATE TABLE IF NOT EXISTS domains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain_name TEXT NOT NULL UNIQUE,
            added_by_user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // user_domains table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_domains (
            user_id INTEGER NOT NULL,
            domain_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, domain_id),
            FOREIGN KEY (user_id) REFERENCES admins(id) ON DELETE CASCADE,
            FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
        )
    `);
}

// Run initialization
initTables();

// --- Query Functions ---

const findUrlByShortCode = (short_code, domain_id) => {
    const sql = "SELECT * FROM short_urls WHERE short_code = ? AND domain_id = ?";
    return db.prepare(sql).get(short_code, domain_id);
};

const getDomainByName = (domain_name) => {
    const sql = "SELECT * FROM domains WHERE domain_name = ?";
    return db.prepare(sql).get(domain_name);
};

const addUrl = (original_url, short_code, passcode, expiry_date, user_id, domain_id, auto_delete) => {
    const sql = "INSERT INTO short_urls (original_url, short_code, passcode, expiry_date, user_id, domain_id, auto_delete) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const result = db.prepare(sql).run(original_url, short_code, passcode, expiry_date, user_id, domain_id, auto_delete);
    return result.changes > 0;
};

const updateUrl = (id, original_url, short_code, passcode, expiry_date, domain_id, auto_delete) => {
    const sql = "UPDATE short_urls SET original_url = ?, short_code = ?, passcode = ?, expiry_date = ?, domain_id = ?, auto_delete = ? WHERE id = ?";
    const result = db.prepare(sql).run(original_url, short_code, passcode, expiry_date, domain_id, auto_delete, id);
    return result.changes > 0;
};

const deleteUrl = (id) => {
    const sql = "DELETE FROM short_urls WHERE id = ?";
    const result = db.prepare(sql).run(id);
    return result.changes > 0;
};

const incrementClicks = (id) => {
    const sql = "UPDATE short_urls SET clicks = clicks + 1 WHERE id = ?";
    const result = db.prepare(sql).run(id);
    return result.changes > 0;
};

const getAllUrls = (user = null) => {
    if (!user) return [];
    const sql = `SELECT u.*, a.username, d.domain_name FROM short_urls u 
               LEFT JOIN admins a ON u.user_id = a.id
               LEFT JOIN domains d ON u.domain_id = d.id
               WHERE u.user_id = ? ORDER BY u.created_at DESC`;
    return db.prepare(sql).all(user.id);
};

const hasAdmin = () => {
    const sql = "SELECT COUNT(*) as count FROM admins";
    const result = db.prepare(sql).get();
    return result.count > 0;
};

const verifyAdmin = (username) => {
    const sql = "SELECT * FROM admins WHERE username = ?";
    return db.prepare(sql).get(username);
};

const createAdmin = (username, password, role = 'user', quota = 0) => {
    const sql = "INSERT INTO admins (username, password, role, quota) VALUES (?, ?, ?, ?)";
    const result = db.prepare(sql).run(username, password, role, quota);
    return db.prepare("SELECT * FROM admins WHERE id = ?").get(result.lastInsertRowid);
};

const getAllAdmins = () => {
    const sql = "SELECT id, username, created_at, quota, role, status FROM admins ORDER BY created_at DESC";
    return db.prepare(sql).all();
};

const deleteAdmin = (id) => {
    const sql = "DELETE FROM admins WHERE id = ?";
    const result = db.prepare(sql).run(id);
    return result.changes > 0;
};

const getAllDomains = () => {
    const sql = "SELECT * FROM domains ORDER BY created_at DESC";
    return db.prepare(sql).all();
};

const addDomain = (domain_name, user_id) => {
    const sql = "INSERT INTO domains (domain_name, added_by_user_id) VALUES (?, ?)";
    const result = db.prepare(sql).run(domain_name, user_id);
    return result.changes > 0;
};

const deleteDomain = (id) => {
    const sql = "DELETE FROM domains WHERE id = ?";
    const result = db.prepare(sql).run(id);
    return result.changes > 0;
};

const getDomainById = (id) => {
    const sql = "SELECT * FROM domains WHERE id = ?";
    return db.prepare(sql).get(id);
};

const getUserUrlCount = (user_id) => {
    const sql = "SELECT COUNT(*) as count FROM short_urls WHERE user_id = ?";
    const result = db.prepare(sql).get(user_id);
    return result ? result.count : 0;
};

const getAdminById = (id) => {
    const sql = "SELECT * FROM admins WHERE id = ?";
    return db.prepare(sql).get(id);
};

const assignDomainsToUser = (user_id, domain_ids) => {
    db.transaction(() => {
        db.prepare("DELETE FROM user_domains WHERE user_id = ?").run(user_id);
        const stmt = db.prepare("INSERT INTO user_domains (user_id, domain_id) VALUES (?, ?)");
        for (const domain_id of domain_ids) {
            stmt.run(user_id, domain_id);
        }
    })();
};

const getDomainsForUser = (user_id) => {
    const sql = "SELECT d.* FROM domains d JOIN user_domains ud ON d.id = ud.domain_id WHERE ud.user_id = ?";
    return db.prepare(sql).all(user_id);
};

const updateUser = (id, { username, password, quota, role }) => {
    let sql = "UPDATE admins SET username = ?, quota = ?, role = ?";
    const params = [username, quota, role];

    if (password) {
        sql += ", password = ?";
        params.push(password);
    }

    sql += " WHERE id = ?";
    params.push(id);

    const result = db.prepare(sql).run(...params);
    return result.changes > 0;
};

const setUserStatus = (id, status) => {
    const sql = "UPDATE admins SET status = ? WHERE id = ?";
    const result = db.prepare(sql).run(status, id);
    return result.changes > 0;
};

module.exports = {
    db,
    findUrlByShortCode,
    getDomainByName,
    addUrl,
    updateUrl,
    deleteUrl,
    incrementClicks,
    getAllUrls,
    hasAdmin,
    verifyAdmin,
    createAdmin,
    getAllAdmins,
    deleteAdmin,
    getAllDomains,
    addDomain,
    deleteDomain,
    getDomainById,
    getUserUrlCount,
    getAdminById,
    assignDomainsToUser,
    getDomainsForUser,
    updateUser,
    setUserStatus,
};
