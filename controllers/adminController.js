const db = require('../models/db');
const config = require('../config');
const { generateShortCode } = require('../utils/functions');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Display the admin dashboard
exports.getDashboard = (req, res) => {
    const user = db.getAdminById(req.session.user.id);
    const urls = db.getAllUrls(req.session.user);
    const urlCount = urls.length;

    let domains = [];
    if (req.session.user.role === 'superadmin') {
        domains = db.getAllDomains();
    } else {
        domains = db.getDomainsForUser(req.session.user.id);
    }

    const defaultDomain = new URL(config.baseUrl).hostname;
    // Add default domain if user has no domains assigned
    if (domains.length === 0) {
        domains.push({ id: 0, domain_name: defaultDomain });
    }

    res.render('admin/dashboard', {
        title: '主控台',
        urls,
        domains,
        defaultDomain,
        quota: user.quota,
        urlCount
    });
};

// Handle adding a new URL
exports.addUrl = (req, res) => {
    const { original_url, short_code, passcode, expiry_date, domain_id, auto_delete } = req.body;
    const user = db.getAdminById(req.session.user.id);

    // Check quota
    if (user.role !== 'superadmin' && user.quota > 0) {
        const current_count = db.getUserUrlCount(user.id);
        if (current_count >= user.quota) {
            req.flash('error', '您的短網址配額已滿。');
            return res.redirect('/admin/dashboard');
        }
    }

    if (!original_url) {
        req.flash('error', '請輸入原始連結');
        return res.redirect('/admin/dashboard');
    }

    const final_short_code = short_code || generateShortCode(6, domain_id);

    if (db.findUrlByShortCode(final_short_code, domain_id)) {
        req.flash('error', '此短網址已在該網域下存在，請使用其他代碼');
        return res.redirect('/admin/dashboard');
    }

    let final_expiry = expiry_date ? new Date(expiry_date).toISOString() : null;

    if (db.addUrl(original_url, final_short_code, passcode, final_expiry, user.id, domain_id, auto_delete ? 1 : 0)) {
        req.flash('success', '短網址新增成功');
    } else {
        req.flash('error', '短網址新增失敗');
    }
    res.redirect('/admin/dashboard');
};

// Handle editing a URL
exports.editUrl = (req, res) => {
    const { id, original_url, short_code, passcode, expiry_date, domain_id, auto_delete } = req.body;
    
    const url = db.db.prepare("SELECT * FROM short_urls WHERE id = ?").get(id);
    if (!url || (req.session.user.role !== 'superadmin' && url.user_id !== req.session.user.id)) {
        req.flash('error', '您沒有權限編輯此網址。');
        return res.redirect('/admin/dashboard');
    }

    const existing = db.db.prepare("SELECT * FROM short_urls WHERE short_code = ? AND domain_id = ? AND id != ?").get(short_code, domain_id, id);
    if (existing) {
        req.flash('error', '此短網址已在該網域下存在，請使用其他代碼');
        return res.redirect('/admin/dashboard');
    }

    let final_expiry = expiry_date ? new Date(expiry_date).toISOString() : null;

    if (db.updateUrl(id, original_url, short_code, passcode, final_expiry, domain_id, auto_delete ? 1 : 0)) {
        req.flash('success', '短網址更新成功');
    } else {
        req.flash('error', '短網址更新失敗');
    }
    res.redirect('/admin/dashboard');
};

// Handle deleting a URL
exports.deleteUrl = (req, res) => {
    const { id } = req.body;
    const url = db.db.prepare("SELECT * FROM short_urls WHERE id = ?").get(id);

    if (!url || (req.session.user.role !== 'superadmin' && url.user_id !== req.session.user.id)) {
        req.flash('error', '您沒有權限刪除此網址。');
        return res.redirect('/admin/dashboard');
    }

    if (db.deleteUrl(id)) {
        req.flash('success', '短網址刪除成功');
    }
    else {
        req.flash('error', '短網址刪除失敗');
    }
    res.redirect('/admin/dashboard');
};

// --- User Management ---

exports.getUserManagement = (req, res) => {
    const users = db.getAllAdmins();
    const domains = db.getAllDomains();
    res.render('admin/user_management', {
        title: '使用者管理',
        users,
        domains
    });
};

exports.addUser = async (req, res) => {
    let { username, password, quota, role, domains } = req.body;
    role = role || 'user';

    if (!username || !password) {
        req.flash('error', '請填寫所有必填欄位。');
        return res.redirect('/admin/users');
    }

    // Ensure domains is an array
    if (!Array.isArray(domains)) {
        domains = domains ? [domains] : [];
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = db.createAdmin(username, hashedPassword, role, parseInt(quota, 10) || 0);

    if (newUser) {
        db.assignDomainsToUser(newUser.id, domains);
        req.flash('success', '使用者新增成功。');
    } else {
        req.flash('error', '使用者新增失敗，可能使用者名稱已存在。');
    }
    res.redirect('/admin/users');
};

exports.deleteUser = (req, res) => {
    const { id } = req.body;
    if (parseInt(id, 10) === req.session.user.id) {
        req.flash('error', '無法刪除自己。');
        return res.redirect('/admin/users');
    }

    res.redirect('/admin/users');
};

// --- Domain Management ---

exports.getDomainManagement = (req, res) => {
    const domains = db.getAllDomains();
    res.render('admin/domain_management', {
        title: '網域管理',
        domains
    });
};

exports.addDomain = (req, res) => {
    const { domain_name } = req.body;
    if (!domain_name) {
        req.flash('error', '網域名稱不能為空。');
        return res.redirect('/admin/domains');
    }

    if (db.addDomain(domain_name, req.session.user.id)) {
        req.flash('success', '網域新增成功。');
    } else {
        req.flash('error', '網域新增失敗，可能網域已存在。');
    }
    res.redirect('/admin/domains');
};

exports.deleteDomain = (req, res) => {
    const { id } = req.body;
    if (db.deleteDomain(id)) {
        req.flash('success', '網域刪除成功。');
    } else {
        req.flash('error', '網域刪除失敗。');
    }
    res.redirect('/admin/domains');
};

// --- Settings Management ---

const fs = require('fs');
const configPath = require('path').join(__dirname, '../config.json');

exports.getSettings = (req, res) => {
    res.render('admin/settings', {
        title: '系統設定',
        settings: config
    });
};

exports.updateSettings = (req, res) => {
    const { siteName, baseUrl, captcha_type, captcha_length } = req.body;
    const captcha_enabled = req.body.captcha_enabled === 'on';

    let currentSettings = {};
    try {
        if (fs.existsSync(configPath)) {
            currentSettings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (error) {
        req.flash('error', '讀取設定檔失敗。');
        return res.redirect('/admin/settings');
    }

    const newSettings = {
        ...currentSettings,
        siteName: siteName || config.siteName,
        baseUrl: baseUrl || config.baseUrl,
        captcha: {
            ...config.captcha,
            ...currentSettings.captcha,
            enabled: captcha_enabled,
            type: captcha_type || config.captcha.type,
            length: parseInt(captcha_length, 10) || config.captcha.length,
        }
    };

    try {
        fs.writeFileSync(configPath, JSON.stringify(newSettings, null, 4));
        
        // Hot-reload the config
        Object.assign(config, newSettings);

        req.flash('success', '設定已更新並重新載入。');
    } catch (error) {
        req.flash('error', '寫入設定檔失敗。');
    }

    res.redirect('/admin/settings');
};

exports.editUser = async (req, res) => {
    const { id, username, password, quota, role } = req.body;

    // Prevent user from editing themselves in a way that locks them out
    if (parseInt(id, 10) === req.session.user.id && role !== req.session.user.role) {
        req.flash('error', '無法變更自己的角色。');
        return res.redirect('/admin/users');
    }

    let hashedPassword = null;
    if (password) {
        hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const updateData = {
        username,
        password: hashedPassword,
        quota: parseInt(quota, 10) || 0,
        role
    };

    if (db.updateUser(id, updateData)) {
        req.flash('success', '使用者更新成功。');
    } else {
        req.flash('error', '使用者更新失敗。');
    }
    res.redirect('/admin/users');
};

exports.toggleUserStatus = (req, res) => {
    const { id } = req.body;

    if (parseInt(id, 10) === req.session.user.id) {
        req.flash('error', '無法停用自己的帳號。');
        return res.redirect('/admin/users');
    }

    const user = db.getAdminById(id);
    if (user) {
        const newStatus = user.status === 'active' ? 'disabled' : 'active';
        if (db.setUserStatus(id, newStatus)) {
            req.flash('success', `使用者狀態已更新為 ${newStatus === 'active' ? '啟用' : '停用'}。`);
        } else {
            req.flash('error', '更新使用者狀態失敗。');
        }
    } else {
        req.flash('error', '找不到該使用者。');
    }
    res.redirect('/admin/users');
};

// --- Profile Management ---

exports.updateProfile = async (req, res) => {
    const { username, newPassword, confirmPassword, currentPassword } = req.body;
    const userId = req.session.user.id;

    // 1. Get current user data
    const user = db.getAdminById(userId);
    if (!user) {
        req.flash('error', '找不到您的使用者帳號。');
        return res.redirect('/admin/dashboard');
    }

    // 2. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        req.flash('error', '目前密碼不正確。');
        return res.redirect('/admin/dashboard');
    }

    // 3. Validate new password
    if (newPassword && newPassword !== confirmPassword) {
        req.flash('error', '新密碼與確認密碼不符。');
        return res.redirect('/admin/dashboard');
    }

    // 4. Prepare update data
    let hashedPassword = null;
    if (newPassword) {
        hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    }

    const updateData = {
        username: username || user.username,
        password: hashedPassword, // Pass null if not changing
        quota: user.quota, // Profile edit does not change quota
        role: user.role,   // Profile edit does not change role
    };

    // 5. Update user
    if (db.updateUser(userId, updateData)) {
        // 6. Log out
        req.session.destroy((err) => {
            if (err) {
                return res.redirect('/');
            }
            res.clearCookie(config.session.name);
            // Redirect to login with a success message
            // Can't use flash as session is destroyed, so use query param
            res.redirect('/login?message=ProfileUpdated');
        });
    } else {
        req.flash('error', '更新個人資料失敗。');
        res.redirect('/admin/dashboard');
    }
};
