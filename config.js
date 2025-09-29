const path = require('path');
const fs = require('fs');

// Default settings
const defaultSettings = {
    dbPath: path.join(__dirname, 'database', 'url_shortener.db'),
    siteName: '短網址管理系統',
    baseUrl: 'http://localhost:3000',
    session: {
        name: 'url_shortener_session',
        secret: 'your_random_secret_here_change_me', 
    },
    captcha: {
        enabled: true,
        type: 'alphanumeric', 
        length: 4,
    },
};

// Path for the configurable settings
const configPath = path.join(__dirname, 'config.json');

let finalSettings = defaultSettings;

// Try to load and merge settings from config.json
try {
    if (fs.existsSync(configPath)) {
        const customSettings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Deep merge custom settings over defaults
        finalSettings = {
            ...defaultSettings,
            ...customSettings,
            session: { ...defaultSettings.session, ...customSettings.session },
            captcha: { ...defaultSettings.captcha, ...customSettings.captcha },
        };
    }
} catch (error) {
    console.error('Error loading config.json, using default settings:', error);
}

module.exports = finalSettings;
