const svgCaptcha = require('svg-captcha');
const db = require('../models/db');
const config = require('../config');

// Render homepage
exports.getHomepage = (req, res) => {
    res.render('index', { title: '首頁' });
};

// Generate and send a new captcha
exports.getCaptcha = (req, res) => {
    const captcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
    req.session.captcha = captcha.text;
    res.type('svg');
    res.status(200).send(captcha.data);
};

// Handle the short URL redirection
exports.handleRedirect = (req, res, next) => {
    const short_code = req.params.short_code;

    // Exclude reserved routes
    if (['admin', 'login', 'logout', 'captcha'].includes(short_code)) {
        return next();
    }

    // Determine domain_id
    const host = req.hostname;
    const baseHost = new URL(config.baseUrl).hostname;
    let domain_id = 0; // Default domain
    if (host !== baseHost) {
        const domain = db.getDomainByName(host);
        if (!domain) {
            return res.status(404).render('error', { message: '網域不存在', error: { status: 404 } });
        }
        domain_id = domain.id;
    }

    const url = db.findUrlByShortCode(short_code, domain_id);

    if (!url) {
        return res.status(404).render('error', { message: '找不到短網址', error: { status: 404 } });
    }

    // Check for expiration
    const isExpired = url.expiry_date && new Date(url.expiry_date) < new Date();
    if (isExpired) {
        if (url.auto_delete) {
            db.deleteUrl(url.id);
        }
        return res.status(410).render('error', { message: '短網址已過期', error: { status: 410 } });
    }

    // Check for passcode
    if (url.passcode) {
        const captcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
        req.session.verify_captcha = captcha.text; // Use a different session key
        return res.render('verify', {
            url,
            captchaEnabled: config.captcha.enabled,
            captchaImage: captcha.data,
            error: null
        });
    }

    // If no passcode, increment clicks and redirect
    db.incrementClicks(url.id);
    res.redirect(301, url.original_url);
};

// Handle submission of passcode for a protected URL
exports.verifyPasscode = (req, res) => {
    const short_code = req.params.short_code;
    const { passcode, captcha } = req.body;

    const host = req.hostname;
    const baseHost = new URL(config.baseUrl).hostname;
    let domain_id = 0;
    if (host !== baseHost) {
        const domain = db.getDomainByName(host);
        if (!domain) return res.status(404).render('error', { message: '網域不存在', error: { status: 404 } });
        domain_id = domain.id;
    }

    const url = db.findUrlByShortCode(short_code, domain_id);

    if (!url || !url.passcode) {
        return res.status(404).render('error', { message: '找不到短網址', error: { status: 404 } });
    }

    // Validate captcha
    if (config.captcha.enabled && (!captcha || captcha.toLowerCase() !== req.session.verify_captcha.toLowerCase())) {
        const newCaptcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
        req.session.verify_captcha = newCaptcha.text;
        return res.render('verify', {
            url,
            captchaEnabled: config.captcha.enabled,
            captchaImage: newCaptcha.data,
            error: '驗證碼錯誤'
        });
    }

    // Validate passcode
    if (passcode === url.passcode) {
        db.incrementClicks(url.id);
        // Clear the captcha session after successful verification
        delete req.session.verify_captcha;
        res.redirect(301, url.original_url);
    } else {
        const newCaptcha = svgCaptcha.create({ size: config.captcha.length, noise: 2, color: true });
        req.session.verify_captcha = newCaptcha.text;
        res.render('verify', {
            url,
            captchaEnabled: config.captcha.enabled,
            captchaImage: newCaptcha.data,
            error: '密碼錯誤'
        });
    }
};