const express = require('express');
const router = express.Router();
const jalaali = require('jalaali-js');
const { requireLogin } = require('../middleware');
const store = require('../store');

const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

router.use(requireLogin);

// داده‌ی یک ماه شمسی برای رسم تقویم تعاملی در فرانت‌اند (تعداد روزها، روز
// هفته‌ی اول ماه و نام ماه) - محاسبات واقعی همیشه سمت سرور با jalaali-js انجام می‌شود.
router.get('/api/jalali-calendar', (req, res) => {
  let jy = parseInt(req.query.y, 10);
  let jm = parseInt(req.query.m, 10);
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || jm < 1 || jm > 12) {
    const today = jalaali.toJalaali(new Date());
    jy = today.jy;
    jm = today.jm;
  }

  const daysInMonth = jalaali.jalaaliMonthLength(jy, jm);
  const firstDayGregorian = jalaali.toGregorian(jy, jm, 1);
  const firstJsDate = new Date(firstDayGregorian.gy, firstDayGregorian.gm - 1, firstDayGregorian.gd);
  // getDay(): 0=یکشنبه..6=شنبه (میلادی) - هفته‌ی شمسی از شنبه شروع می‌شود
  const startWeekday = (firstJsDate.getDay() + 1) % 7;
  const todayJ = jalaali.toJalaali(new Date());

  res.json({
    year: jy,
    month: jm,
    monthName: MONTH_NAMES[jm - 1],
    daysInMonth,
    startWeekday,
    today: { y: todayJ.jy, m: todayJ.jm, d: todayJ.jd },
  });
});

function serializeMatches(rows) {
  return rows.map((row) => ({
    id: row.id,
    requestNo: row.request_no,
    purchaseRequestNo: row.purchase_request_no,
  }));
}

// چک سمت کاربر (پیش از ارسال فرم ایجاد ردیف): آیا این شماره درخواست کالا
// قبلاً هم ثبت شده؟ دیگر چیزی را رد نمی‌کند، فقط برای نمایش هشدار/تاییدیه
// به کاربر قبل از ثبت نهایی استفاده می‌شود.
router.get('/api/check-request-no', (req, res) => {
  const rows = store.findRowsByRequestNo(req.query.value || '');
  res.json({ rows: serializeMatches(rows) });
});

// همان، برای شماره درخواست خرید (بخش انبار کارفرما) - excludeId یعنی خود
// همین ردیف را که در حال ویرایشش هستیم نادیده بگیر.
router.get('/api/check-purchase-request-no', (req, res) => {
  const rows = store.findRowsByPurchaseRequestNo(req.query.value || '', req.query.excludeId || '');
  res.json({ rows: serializeMatches(rows) });
});

module.exports = router;
