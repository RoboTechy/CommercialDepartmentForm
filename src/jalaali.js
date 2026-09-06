const jalaali = require('jalaali-js');

function pad2(n) {
  return String(n).padStart(2, '0');
}

// تاریخ امروز به شمسی، به‌صورت رشته‌ی یکنواخت YYYY/MM/DD (مناسب برای مقایسه‌ی رشته‌ای در جستجوی بازه‌ای)
function todayJalaliDate() {
  const j = jalaali.toJalaali(new Date());
  return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;
}

// تاریخ و ساعت الان به شمسی، برای ثبت در لاگ‌ها و زمان ایجاد ردیف‌ها
function nowJalaliDateTime() {
  const now = new Date();
  const j = jalaali.toJalaali(now);
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)} ${time}`;
}

const LOOSE_DATE_RE = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/;

// ورودی دستی کاربر را اعتبارسنجی و به فرمت یکنواخت YYYY/MM/DD تبدیل می‌کند
// خروجی null یعنی فرمت/مقدار نامعتبر است
function normalizeJalaliDate(input) {
  if (!input || !input.trim()) return '';
  const m = LOOSE_DATE_RE.exec(input.trim());
  if (!m) return null;
  const jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  const jd = parseInt(m[3], 10);
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

module.exports = { todayJalaliDate, nowJalaliDateTime, normalizeJalaliDate };
