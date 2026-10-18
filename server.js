const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const config = require('./src/config');
const db = require('./src/db');
const { scheduleDailyBackup } = require('./src/backup');
const apiV1Routes = require('./src/routes/apiV1');
const reportApiRoutes = require('./src/routes/reportApi');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
// فشرده‌سازی gzip: پاسخ JSON فهرست (چند مگابایت) و فایل‌های js/css را حدود ۳۰ برابر کوچک‌تر می‌کند
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// رابط کاربری React (خروجی build پوشه‌ی client). اگر build نشده باشد، سرور همچنان
// بالا می‌آید ولی فقط API در دسترس است.
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist, { index: false }));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 },
  })
);

// API گزارش‌گیری برای برنامه‌های دیگر (HTTP Basic Auth مخصوص به خودش،
// بدون کوکی/سشن)
app.use('/', reportApiRoutes);
// API رابط کاربری جدید
app.use('/api/v1', apiV1Routes);
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'مسیر API یافت نشد.' }));

// هر مسیر GET دیگر → برنامه‌ی تک‌صفحه‌ای (React)
app.get('*', (req, res) => {
  const indexFile = path.join(clientDist, 'index.html');
  if (!require('fs').existsSync(indexFile)) {
    return res.status(503).send('رابط کاربری build نشده است (cd client && npm run build).');
  }
  res.sendFile(indexFile);
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'یافت نشد.' });
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
