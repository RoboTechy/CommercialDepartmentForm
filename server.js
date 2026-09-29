const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const path = require('path');
const config = require('./src/config');
const db = require('./src/db');
const { scheduleDailyBackup } = require('./src/backup');
const authRoutes = require('./src/routes/auth');
const rowRoutes = require('./src/routes/rows');
const apiRoutes = require('./src/routes/api');
const reportApiRoutes = require('./src/routes/reportApi');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 },
  })
);
app.use(flash());

app.use('/', authRoutes);
// API گزارش‌گیری برای برنامه‌های دیگر (HTTP Basic Auth مخصوص به خودش،
// بدون کوکی/سشن) - باید قبل از apiRoutes و rowRoutes مانت شود، چون هر دوی
// آن‌ها router.use(requireLogin) دارند که (چون هر دو هم روی مسیر / مانت
// شده‌اند) مسیرهای /api/reports/* را زودتر با ریدایرکت به /login می‌گرفت
app.use('/', reportApiRoutes);
app.use('/', apiRoutes);
app.use('/', rowRoutes);

app.use((req, res) => {
  res.status(404).render('not-found');
});

db.ready
  .then(() => {
    scheduleDailyBackup();
    app.listen(config.port, () => {
      console.log(`سرویس فرم بازرگانی روی پورت ${config.port} در حال اجراست`);
    });
  })
  .catch((err) => {
    console.error('راه‌اندازی دیتابیس با خطا مواجه شد:', err);
    process.exit(1);
  });
