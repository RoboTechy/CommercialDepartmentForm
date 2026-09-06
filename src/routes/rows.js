const express = require('express');
const router = express.Router();
const store = require('../store');
const { sections, findSection, allFields } = require('../sections');
const { requireLogin, canEditSection, canCreateRows, isAdmin } = require('../middleware');
const { normalizeJalaliDate, todayJalaliDate } = require('../jalaali');

router.use(requireLogin);

function buildFiltersFromQuery(query) {
  const filters = {};
  for (const field of allFields()) {
    if (field.type === 'jalali-date') {
      if (query[`${field.name}_from`]) filters[`${field.name}_from`] = query[`${field.name}_from`];
      if (query[`${field.name}_to`]) filters[`${field.name}_to`] = query[`${field.name}_to`];
    } else if (query[field.name]) {
      filters[field.name] = query[field.name];
    }
  }
  return filters;
}

router.get('/', (req, res) => {
  const user = req.session.user;
  const filters = buildFiltersFromQuery(req.query);
  const rows = store.listRows(filters);
  res.render('dashboard', {
    rows,
    sections,
    query: req.query,
    user,
    canCreateRows: canCreateRows(user),
    todayJalali: todayJalaliDate(),
  });
});

router.get('/rows/new', (req, res) => {
  const user = req.session.user;
  if (!canCreateRows(user)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به ایجاد ردیف جدید نیستید (فقط دفتر فنی بهره‌بردار).' });
  }
  res.render('new-row', {
    section: findSection('tech_operator'),
    user,
    todayJalali: todayJalaliDate(),
    error: req.flash('error'),
  });
});

router.post('/rows', (req, res) => {
  const user = req.session.user;
  if (!canCreateRows(user)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به ایجاد ردیف جدید نیستید (فقط دفتر فنی بهره‌بردار).' });
  }

  const section = findSection('tech_operator');
  const values = {};
  for (const field of section.fields) {
    let value = (req.body[field.name] || '').toString().trim();
    if (field.type === 'jalali-date' && value) {
      const normalized = normalizeJalaliDate(value);
      if (normalized === null) {
        req.flash('error', `مقدار «${field.label}» یک تاریخ شمسی معتبر نیست (فرمت درست: 1403/05/12).`);
        return res.redirect('/rows/new');
      }
      value = normalized;
    }
    values[field.name] = value;
  }

  if (!values.request_no || !values.item_description) {
    req.flash('error', 'شماره درخواست کالا و شرح کالا الزامی است.');
    return res.redirect('/rows/new');
  }

  const row = store.createRow(values, user);
  res.redirect(`/rows/${row.id}`);
});

router.get('/rows/:id', (req, res) => {
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  const user = req.session.user;
  const sectionsView = sections.map((section) => ({
    ...section,
    canEdit: canEditSection(user, section.key),
  }));
  res.render('row', {
    row,
    sectionsView,
    user,
    isAdmin: isAdmin(user),
    todayJalali: todayJalaliDate(),
    message: req.flash('message'),
    error: req.flash('error'),
  });
});

router.post('/rows/:id/sections/:sectionKey', (req, res) => {
  const { id, sectionKey } = req.params;
  const user = req.session.user;
  const section = findSection(sectionKey);
  const row = store.getRow(id);

  if (!row) return res.status(404).render('not-found');
  if (!section) return res.status(404).render('not-found');

  if (!canEditSection(user, sectionKey)) {
    const sectionsView = sections.map((s) => ({ ...s, canEdit: canEditSection(user, s.key) }));
    return res.status(403).render('row', {
      row,
      sectionsView,
      user,
      isAdmin: isAdmin(user),
      todayJalali: todayJalaliDate(),
      message: [],
      error: [`شما مجاز به تکمیل «${section.title}» نیستید. این بخش فقط توسط پرسنل همان بخش قابل تکمیل است.`],
    });
  }

  const values = {};
  for (const field of section.fields) {
    let value = (req.body[field.name] || '').toString().trim();
    if (field.type === 'jalali-date' && value) {
      const normalized = normalizeJalaliDate(value);
      if (normalized === null) {
        req.flash('error', `مقدار «${field.label}» یک تاریخ شمسی معتبر نیست (فرمت درست: 1403/05/12).`);
        return res.redirect(`/rows/${id}`);
      }
      value = normalized;
    }
    values[field.name] = value;
  }

  store.updateSection(id, sectionKey, values, user);
  req.flash('message', `«${section.title}» با موفقیت به‌روزرسانی شد.`);
  res.redirect(`/rows/${id}`);
});

router.get('/rows/:id/history', (req, res) => {
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  const history = store.getRowHistory(req.params.id);
  res.render('history', { row, history, sections, user: req.session.user });
});

router.get('/logs', (req, res) => {
  const filters = {
    user: req.query.user || '',
    fieldKey: req.query.fieldKey || '',
    rowId: req.query.rowId || '',
    from: req.query.from || '',
    to: req.query.to || '',
  };
  const logs = store.searchLogs(filters);
  res.render('logs', { logs, filters, fields: allFields(), sections, user: req.session.user });
});

module.exports = router;
