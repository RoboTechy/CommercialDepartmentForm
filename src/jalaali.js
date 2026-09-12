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

const DATETIME_RE = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?$/;

// رشته‌ی تاریخ (یا تاریخ‌وساعت) شمسی را به شیء Date میلادی واقعی تبدیل می‌کند
// (برای محاسبات مدت‌زمان). ورودی نامعتبر → null
function parseJalaliDateTime(input) {
  if (!input) return null;
  const m = DATETIME_RE.exec(input.trim());
  if (!m) return null;
  const jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  const jd = parseInt(m[3], 10);
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  const hh = m[4] ? parseInt(m[4], 10) : 0;
  const mi = m[5] ? parseInt(m[5], 10) : 0;
  const ss = m[6] ? parseInt(m[6], 10) : 0;
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd, hh, mi, ss);
}

// فاصله‌ی زمانی بین دو تاریخ/تاریخ‌وساعت شمسی، به روز (اعشاری). نامعتبر → null
function daysBetweenJalali(fromStr, toStr) {
  const from = parseJalaliDateTime(fromStr);
  const to = parseJalaliDateTime(toStr);
  if (!from || !to) return null;
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

// چند روز از یک تاریخ/تاریخ‌وساعت شمسی تا همین الان گذشته. نامعتبر → null
function daysSinceJalali(fromStr) {
  const from = parseJalaliDateTime(fromStr);
  if (!from) return null;
  return (Date.now() - from.getTime()) / (1000 * 60 * 60 * 24);
}

module.exports = {
  todayJalaliDate,
  nowJalaliDateTime,
  normalizeJalaliDate,
  daysBetweenJalali,
  daysSinceJalali,
};
