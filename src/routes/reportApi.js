const express = require('express');
const router = express.Router();
const ldap = require('../ldap');
const config = require('../config');
const store = require('../store');
const { allFields } = require('../sections');
const { todayJalaliDate } = require('../jalaali');
const { buildFiltersFromQuery, escapeCsv, rowStatusLabel } = require('../reportFilters');

// API گزارش‌گیری برای برنامه‌های دیگر (روی سرورهای دیگر) - نه برای مرورگر.
// چون سمت دیگر یک برنامه است نه کاربری با نشست/کوکی باز، احراز هویت هر
// درخواست با HTTP Basic (یوزرنیم/رمز همان حساب Active Directory، یا حساب
// ادمین محلی) انجام می‌شود - دقیقاً همان اعتبارسنجی که فرم ورود سایت هم
// استفاده می‌کند (src/routes/auth.js)، فقط بدون سشن. فقط اعضای گروه ادمین
// یا آی‌تی اجازه‌ی دسترسی دارند.
async function requireReportAccess(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) {
    res.setHeader('WWW-Authenticate', 'Basic realm="PRT Reports API"');
    return res.status(401).json({ error: 'نیاز به احراز هویت HTTP Basic با یوزرنیم/رمز دامنه' });
  }

  let decoded;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch (e) {
    res.setHeader('WWW-Authenticate', 'Basic realm="PRT Reports API"');
    return res.status(401).json({ error: 'هدر Authorization نامعتبر است' });
  }
  const sep = decoded.indexOf(':');
  const username = sep === -1 ? decoded : decoded.slice(0, sep);
  const password = sep === -1 ? '' : decoded.slice(sep + 1);

  try {
    let user;
    if (config.localAdmin.username && username === config.localAdmin.username && password === config.localAdmin.password) {
      user = { username, groups: [config.ldap.groups.admin], isLocalAdmin: true };
    } else {
      user = await ldap.authenticate(username, password);
    }
    const allowed = user.groups.includes(config.ldap.groups.admin) || user.groups.includes(config.ldap.groups.it);
    if (!allowed) {
      return res.status(403).json({ error: 'این حساب عضو گروه ادمین یا آی‌تی نیست - دسترسی به این API ندارد' });
    }
    req.reportUser = user;
    next();
  } catch (err) {
    res.setHeader('WWW-Authenticate', 'Basic realm="PRT Reports API"');
    res.status(401).json({ error: err.message || 'یوزرنیم یا رمز عبور نادرست است' });
  }
}

// توجه مهم: این middleware باید فقط روی مسیر /api/reports مانت شود، نه
// بدون مسیر (router.use(fn) بدون آدرس یعنی روی *همه‌ی* درخواست‌هایی که
// از این روتر عبور می‌کنند اجرا می‌شود - و چون این روتر با app.use('/', ...)
// در server.js روی ریشه مانت شده، بدون این محدودسازی همه‌ی مسیرهای سایت
// (حتی صفحات معمولی با نشست/کوکی) هم مجبور به HTTP Basic Auth می‌شدند)
router.use('/api/reports', requireReportAccess);

// همان فیلترهای فهرست اصلی سایت (status/بازه‌ی تاریخ/جست‌وجوی هر فیلد از
// querystring) - رجوع کنید به src/reportFilters.js
router.get('/api/reports/rows.json', (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const rows = store.listRows(filters);
  const fields = allFields();
  const data = rows.map((row) => {
    const obj = { id: row.id, status: rowStatusLabel(row) };
    fields.forEach((f) => {
      obj[f.name] = row[f.name] || '';
    });
    return obj;
  });
  res.json({ count: data.length, rows: data });
});

router.get('/api/reports/rows.csv', (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const rows = store.listRows(filters);
  const fields = allFields();

  const headerRow = ['ردیف', 'وضعیت', ...fields.map((f) => f.label)];
  const lines = [headerRow.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push([row.id, rowStatusLabel(row), ...fields.map((f) => row[f.name] || '')].map(escapeCsv).join(','));
  }

  const filename = `prt-report-${todayJalaliDate().replace(/\//g, '-')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + lines.join('\r\n'));
});

module.exports = router;
