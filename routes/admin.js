const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// Protect all admin routes
router.use(authMiddleware.isLoggedIn);

// Routes
router.get('/', (req, res) => res.redirect('/admin/dashboard'));
router.get('/dashboard', adminController.getDashboard);

// URL Actions
router.post('/urls/add', adminController.addUrl);
router.post('/urls/edit', adminController.editUrl);
router.post('/urls/delete', adminController.deleteUrl);

// User Management (SuperAdmin only)
router.get('/users', authMiddleware.isSuperAdmin, adminController.getUserManagement);
router.post('/users/add', authMiddleware.isSuperAdmin, adminController.addUser);
router.post('/users/delete', authMiddleware.isSuperAdmin, adminController.deleteUser);
router.post('/users/edit', authMiddleware.isSuperAdmin, adminController.editUser);
router.post('/users/toggle-status', authMiddleware.isSuperAdmin, adminController.toggleUserStatus);

// Domain Management (SuperAdmin only)
router.get('/domains', authMiddleware.isSuperAdmin, adminController.getDomainManagement);
router.post('/domains/add', authMiddleware.isSuperAdmin, adminController.addDomain);
router.post('/domains/delete', authMiddleware.isSuperAdmin, adminController.deleteDomain);

// Settings Management (SuperAdmin only)
router.get('/settings', authMiddleware.isSuperAdmin, adminController.getSettings);
router.post('/settings/update', authMiddleware.isSuperAdmin, adminController.updateSettings);

// Profile Management (any logged in user)
router.post('/profile/update', adminController.updateProfile);

module.exports = router;
