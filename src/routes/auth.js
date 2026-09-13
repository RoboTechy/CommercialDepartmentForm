const express = require('express');
const router = express.Router();
const ldap = require('../ldap');
const config = require('../config');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'ورود به PRT', error: req.flash('error') });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // حساب ادمین محلی (اگر تنظیم شده باشد): کاملاً مستقل از LDAP، برای وقتی
  // که ارتباط با Active Directory قطع است
  if (
    config.localAdmin.username &&
    username === config.localAdmin.username &&
    password === config.localAdmin.password
  ) {
    req.session.user = {
      username: config.localAdmin.username,
      dn: null,
      displayName: `${config.localAdmin.username} (ادمین محلی)`,
      groups: [config.ldap.groups.admin],
      isLocalAdmin: true,
    };
    return res.redirect('/');
  }

  try {
    const user = await ldap.authenticate(username, password);
    req.session.user = user;
    res.redirect('/');
  } catch (err) {
    req.flash('error', err.message || 'ورود ناموفق بود');
    res.redirect('/login');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
