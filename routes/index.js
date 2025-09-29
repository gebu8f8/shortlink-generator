const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const mainController = require('../controllers/mainController');

// Main Routes
router.get('/', mainController.getHomepage);
router.get('/captcha', mainController.getCaptcha);

// Auth Routes
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.getLogout);

// Short URL Redirect and Verification
router.get('/:short_code', mainController.handleRedirect);
router.post('/:short_code', mainController.verifyPasscode);

module.exports = router;
