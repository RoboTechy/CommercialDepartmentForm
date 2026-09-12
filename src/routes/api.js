const express = require('express');
const router = express.Router();
const jalaali = require('jalaali-js');
const { requireLogin } = require('../middleware');

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

module.exports = router;
