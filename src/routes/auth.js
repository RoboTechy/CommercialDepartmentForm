const express = require('express');
const router = express.Router();
const ldap = require('../ldap');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'ورود به PRT', error: req.flash('error') });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
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
