const fs = require('fs');
const path = require('path');
const config = require('./config');
const { todayJalaliDate } = require('./jalaali');

// بکاپ خودکار روزانه: هر شب ساعت ۱۲ (۰۰:۰۰) یک کپی کامل از فایل دیتابیس در
// پوشه‌ی backup/ ساخته می‌شود، با نامی که تاریخ شمسی همان روز را دارد
// (مثلاً app-1403-06-23.db). بکاپ‌های قدیمی‌تر از ۳۰ روز خودکار پاک می‌شوند.
const BACKUP_DIR = path.join(__dirname, '..', 'backup');
const KEEP_DAYS = 30;

function performBackup() {
  if (!fs.existsSync(config.dbFile)) {
    console.error(`بکاپ خودکار انجام نشد: فایل دیتابیس یافت نشد (${config.dbFile})`);
    return;
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const dateStr = todayJalaliDate().replace(/\//g, '-');
  const dest = path.join(BACKUP_DIR, `app-${dateStr}.db`);
  fs.copyFileSync(config.dbFile, dest);
  console.log(`بکاپ خودکار ساخته شد: ${dest}`);
  cleanupOldBackups();
}

function cleanupOldBackups() {
  let files;
  try {
    files = fs.readdirSync(BACKUP_DIR);
  } catch {
    return;
  }
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  for (const file of files) {
    if (!/^app-.*\.db$/.test(file)) continue;
    const filePath = path.join(BACKUP_DIR, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      console.log(`بکاپ قدیمی پاک شد: ${filePath}`);
    }
  }
}

function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0);
  return next.getTime() - now.getTime();
}

// اولین اجرا دقیقاً روی نیمه‌شب بعدی تنظیم می‌شود، سپس هر ۲۴ ساعت یک‌بار تکرار می‌شود
function scheduleDailyBackup() {
  const delay = msUntilNextMidnight();
  setTimeout(function runAndReschedule() {
    performBackup();
    setInterval(performBackup, 24 * 60 * 60 * 1000);
  }, delay);
  console.log(`بکاپ خودکار روزانه فعال شد (اولین اجرا حدود ${Math.round(delay / 60000)} دقیقه‌ی دیگر، ساعت ۰۰:۰۰).`);
}

module.exports = { scheduleDailyBackup, performBackup };
