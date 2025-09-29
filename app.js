const express = require('express');
const path = require('path');

const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const flash = require('connect-flash');

const config = require('./config');
const db = require('./models/db'); // Ensures DB is initialized

const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
    store: new SQLiteStore({
        db: path.basename(config.dbPath),
        dir: path.dirname(config.dbPath),
        table: 'sessions'
    }),
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
}));

app.use(flash());

// Middleware to pass global variables to all templates
app.use((req, res, next) => {
    res.locals.siteName = config.siteName;
    res.locals.baseUrl = config.baseUrl;
    res.locals.session = req.session;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.h = (str) => {
        // Basic HTML escaping, EJS does this by default with <%= %>
        // This is here for compatibility if we use <%- %> and need to escape manually
        return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };
    next();
});

// Route setup
app.use('/', indexRouter);
app.use('/admin', adminRouter);

// Basic 404 handler
app.use((req, res, next) => {
    res.status(404).render('error', { 
        message: '找不到頁面', 
        error: { status: 404, stack: 'The page you are looking for does not exist.' }
    });
});

// Basic error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message || '伺服器發生錯誤',
        error: req.app.get('env') === 'development' ? err : {}
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
