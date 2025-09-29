const bcrypt = require('bcrypt');
const svgCaptcha = require('svg-captcha');
const db = require('../models/db');
const config = require('../config');

const SALT_ROUNDS = 10;

// Display login page
exports.getLogin = (req, res) => {
    if (req.session.user) {
        return res.redirect('/admin/dashboard');
    }
    const hasAdmin = db.hasAdmin();
    let captcha = null;

    if (config.captcha.enabled) {
        captcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
        req.session.captcha = captcha.text;
    }

    let error = null;
    if (req.query.message === 'ProfileUpdated') {
        error = '個人資料已更新，請重新登入。'; // Using 'error' to display in a visible box, can be styled differently
    }

    res.render('login', {
        hasAdmin,
        captchaEnabled: config.captcha.enabled,
        captchaImage: captcha ? captcha.data : '',
        error
    });
};

// Handle login form submission
exports.postLogin = async (req, res) => {
    const { username, password, captcha: formCaptcha } = req.body;

    if (config.captcha.enabled && (!formCaptcha || formCaptcha.toLowerCase() !== req.session.captcha.toLowerCase())) {
        const hasAdminCheck = db.hasAdmin();
        const newCaptcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
        req.session.captcha = newCaptcha.text;
        return res.render('login', { 
            hasAdmin: hasAdminCheck,
            captchaEnabled: config.captcha.enabled,
            captchaImage: newCaptcha.data,
            error: '驗證碼錯誤' 
        });
    }

    const hasAdmin = db.hasAdmin();

    if (!hasAdmin) {
        // First time setup: create superadmin
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = db.createAdmin(username, hashedPassword, 'superadmin', 0);
        req.session.user = { id: user.id, username: user.username, role: user.role };
        req.flash('success', '超級管理員帳號創建成功！');
        return res.redirect('/admin/dashboard');
    } else {
        // Regular login
        const user = db.verifyAdmin(username);
        if (user && await bcrypt.compare(password, user.password)) {
            if (user.status !== 'active') {
                const newCaptcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
                req.session.captcha = newCaptcha.text;
                return res.render('login', {
                    hasAdmin: true,
                    captchaEnabled: config.captcha.enabled,
                    captchaImage: newCaptcha.data,
                    error: '您的帳號已被停用。'
                });
            }
            req.session.user = { id: user.id, username: user.username, role: user.role };
            return res.redirect('/admin/dashboard');
        } else {
            const newCaptcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
            req.session.captcha = newCaptcha.text;
            return res.render('login', {
                hasAdmin: true,
                captchaEnabled: config.captcha.enabled,
                captchaImage: newCaptcha.data,
                error: '帳號或密碼錯誤'
            });
        }
    }
};

// Handle logout
exports.getLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie(config.session.name);
        res.redirect('/login');
    });
};