exports.isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

exports.isSuperAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'superadmin') {
        return next();
    }
    req.flash('error', '您沒有權限訪問此頁面。');
    res.redirect('/admin/dashboard'); // Redirect to a safe page
};
