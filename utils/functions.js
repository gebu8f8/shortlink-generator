const db = require('../models/db');

function generateShortCode(length = 6, domain_id = 0) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if it already exists for the given domain
    const existing = db.findUrlByShortCode(code, domain_id);
    if (existing) {
        return generateShortCode(length, domain_id); // Recurse if exists
    }
    return code;
}

module.exports = { generateShortCode };
