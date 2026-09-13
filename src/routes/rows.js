const express = require('express');
const router = express.Router();
const store = require('../store');
const config = require('../config');
const { sections, findSection, allFields, requesterDepartments } = require('../sections');
const {
  requireLogin,
  canEditSection,
  canEditRequesterRow,
  canCreateRows,
  isAdmin,
  isLocalAdmin,
  canCancelRow,
  canReturnToTechOffice,
} = require('../middleware');
const { normalizeJalaliDate, todayJalaliDate, daysSinceJalali } = require('../jalaali');

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
  if (query.status) filters.status = query.status;
  if (query.incompleteDept) filters.incompleteDept = query.incompleteDept;
  return filters;
}

router.get('/', (req, res) => {
  const user = req.session.user;
  const filters = buildFiltersFromQuery(req.query);
  const rows = store.listRows(filters).map((row) => {
    const complete = store.isRowComplete(row);
    const age = daysSinceJalali(row.created_at);
    const overdue = !row.cancelled_at && !row.returned_at && !complete && age !== null && age > config.overdueDays;
    return { ...row, isComplete: complete, isOverdue: overdue };
  });

  const distinctValues = {};
  for (const field of allFields()) {
    if (field.type === 'text' || field.type === 'textarea') {
      distinctValues[field.name] = store.getDistinctValues(field.name);
    }
  }

  res.render('dashboard', {
    rows,
    sections,
    query: req.query,
    user,
    canCreateRows: canCreateRows(user),
    isLocalAdmin: isLocalAdmin(user),
    todayJalali: todayJalaliDate(),
    distinctValues,
    stats: store.getDashboardStats(),
    overdueDays: config.overdueDays,
  });
});

router.get('/export.csv', (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const rows = store.listRows(filters);
  const fields = allFields();

  const escapeCsv = (val) => {
    const str = (val ?? '').toString();
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const headerRow = ['ردیف', 'وضعیت', ...fields.map((f) => f.label)];
  const lines = [headerRow.map(escapeCsv).join(',')];
  for (const row of rows) {
    const status = row.cancelled_at ? 'لغو شده' : row.returned_at ? 'عودت به درخواست‌کننده' : 'جاری';
    lines.push([row.id, status, ...fields.map((f) => row[f.name] || '')].map(escapeCsv).join(','));
  }

  const filename = `prt-export-${todayJalaliDate().replace(/\//g, '-')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + lines.join('\r\n'));
});

router.get('/rows/new', (req, res) => {
  const user = req.session.user;
  if (!canCreateRows(user)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به ایجاد ردیف جدید نیستید (فقط درخواست‌کننده).' });
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
    return res.status(403).render('not-found', { message: 'شما مجاز به ایجاد ردیف جدید نیستید (فقط درخواست‌کننده).' });
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

  const missingLabels = section.fields.filter((f) => f.required && !values[f.name]).map((f) => f.label);
  if (missingLabels.length) {
    req.flash('error', `تکمیل این فیلدها الزامی است: ${missingLabels.join('، ')}`);
    return res.redirect('/rows/new');
  }

  // دیگر تکراری بودن شماره درخواست کالا مانع ثبت نمی‌شود - فقط پیش از ارسال
  // فرم، سمت کاربر (جاوااسکریپت، با /api/check-request-no) یک هشدار/تاییدیه
  // نمایش داده می‌شود؛ اگر کاربر با وجود هشدار باز هم ثبت را بزند، اینجا
  // بدون مانع پذیرفته می‌شود.
  const row = store.createRow(values, user);
  res.redirect(`/rows/${row.id}`);
});

router.get('/rows/deleted', (req, res) => {
  const user = req.session.user;
  if (!isLocalAdmin(user)) {
    return res.status(403).render('not-found', { message: 'فقط ادمین محلی به ردیف‌های حذف‌شده دسترسی دارد.' });
  }
  res.render('deleted-rows', {
    rows: store.listDeletedRows(),
    user,
    message: req.flash('message'),
  });
});

router.post('/rows/:id/restore', (req, res) => {
  const user = req.session.user;
  if (!isLocalAdmin(user)) {
    return res.status(403).render('not-found', { message: 'فقط ادمین محلی می‌تواند ردیف حذف‌شده را بازیابی کند.' });
  }
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  store.restoreRow(req.params.id);
  req.flash('message', `ردیف شماره ${row.id} بازیابی شد.`);
  res.redirect('/rows/deleted');
});

router.post('/rows/:id/delete', (req, res) => {
  const user = req.session.user;
  if (!isLocalAdmin(user)) {
    return res.status(403).render('not-found', { message: 'فقط ادمین محلی اجازه‌ی حذف ردیف را دارد.' });
  }
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  store.softDeleteRow(req.params.id, user);
  req.flash('message', `ردیف شماره ${row.id} حذف شد (قابل بازیابی از «ردیف‌های حذف‌شده»).`);
  res.redirect('/');
});

router.get('/rows/:id', (req, res) => {
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  const user = req.session.user;
  if (row.deleted_at && !isLocalAdmin(user)) {
    return res.status(404).render('not-found', { message: 'این ردیف حذف شده است.' });
  }
  const isOwner = row.created_by_username === user.username;
  if (!row.published_at && !isOwner && !isAdmin(user) && !isLocalAdmin(user)) {
    return res.status(404).render('not-found', { message: 'این ردیف هنوز ثبت نهایی نشده است.' });
  }
  const sectionsView = sections.map((section) => ({
    ...section,
    canEdit:
      !row.deleted_at &&
      !row.cancelled_at &&
      !(row.returned_at && section.key !== 'tech_operator') &&
      (section.key === 'tech_operator' ? canEditRequesterRow(user, row) : canEditSection(user, section.key)),
  }));
  res.render('row', {
    row,
    sectionsView,
    user,
    isAdmin: isAdmin(user),
    isLocalAdmin: isLocalAdmin(user),
    canCancelRow: canCancelRow(user, row),
    canReturnToTechOffice: canReturnToTechOffice(user),
    draftRows: row.published_at ? [] : store.listDraftRowsForUser(user.username),
    todayJalali: todayJalaliDate(),
    message: req.flash('message'),
    error: req.flash('error'),
  });
});

router.post('/rows/:id/finalize', (req, res) => {
  const user = req.session.user;
  if (!canCreateRows(user)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به ثبت نهایی ردیف نیستید (فقط درخواست‌کننده).' });
  }
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');

  const finalized = store.finalizeDraftRows(user);
  if (!finalized.length) {
    req.flash('message', 'هیچ ردیف پیش‌نویسی برای ثبت نهایی وجود نداشت.');
    return res.redirect('/');
  }
  req.flash('message', `${finalized.length} ردیف با موفقیت در فهرست اصلی ثبت شد.`);
  res.redirect('/');
});

router.post('/rows/:id/cancel', (req, res) => {
  const user = req.session.user;
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  if (!canCancelRow(user, row)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به لغو این درخواست نیستید (فقط درخواست‌کننده‌ی همان دپارتمان یا ادمین).' });
  }
  if (row.deleted_at) return res.status(404).render('not-found', { message: 'این ردیف حذف شده است.' });

  const reason = (req.body.reason || '').toString().trim();
  if (!reason) {
    req.flash('error', 'برای لغو درخواست، نوشتن دلیل الزامی است.');
    return res.redirect(`/rows/${row.id}`);
  }
  if (row.cancelled_at) {
    req.flash('error', 'این درخواست از قبل لغو شده است.');
    return res.redirect(`/rows/${row.id}`);
  }

  store.cancelRow(row.id, reason, user);
  req.flash('message', 'درخواست لغو شد.');
  res.redirect(`/rows/${row.id}`);
});

router.post('/rows/:id/uncancel', (req, res) => {
  const user = req.session.user;
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  if (!canCancelRow(user, row)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به بازگرداندن این درخواست نیستید (فقط درخواست‌کننده‌ی همان دپارتمان یا ادمین).' });
  }

  store.uncancelRow(row.id, user);
  req.flash('message', 'لغو درخواست برداشته شد؛ درخواست دوباره فعال است.');
  res.redirect(`/rows/${row.id}`);
});

router.post('/rows/:id/return', (req, res) => {
  const user = req.session.user;
  if (!canReturnToTechOffice(user)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به عودت این درخواست نیستید (فقط انبار کارفرما یا ادمین).' });
  }
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  if (row.deleted_at) return res.status(404).render('not-found', { message: 'این ردیف حذف شده است.' });
  if (row.cancelled_at) {
    req.flash('error', 'این درخواست لغو شده است؛ نمی‌توان آن را عودت داد.');
    return res.redirect(`/rows/${row.id}`);
  }
  if (row.returned_at) {
    req.flash('error', 'این درخواست از قبل به درخواست‌کننده عودت داده شده است.');
    return res.redirect(`/rows/${row.id}`);
  }

  const reason = (req.body.reason || '').toString().trim();
  store.returnToTechOffice(row.id, reason, user);
  req.flash('message', 'درخواست به درخواست‌کننده عودت داده شد.');
  res.redirect(`/rows/${row.id}`);
});

router.post('/rows/:id/unreturn', (req, res) => {
  const user = req.session.user;
  if (!canReturnToTechOffice(user)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به بازگرداندن این درخواست نیستید (فقط انبار کارفرما یا ادمین).' });
  }
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');

  store.unreturnFromTechOffice(row.id, user);
  req.flash('message', 'عودت درخواست برداشته شد؛ درخواست دوباره فعال است.');
  res.redirect(`/rows/${row.id}`);
});

router.post('/rows/:id/sections/:sectionKey', (req, res) => {
  const { id, sectionKey } = req.params;
  const user = req.session.user;
  const section = findSection(sectionKey);
  const row = store.getRow(id);

  if (!row) return res.status(404).render('not-found');
  if (!section) return res.status(404).render('not-found');
  if (row.deleted_at) {
    return res.status(404).render('not-found', { message: 'این ردیف حذف شده است؛ ابتدا آن را بازیابی کنید.' });
  }
  if (row.cancelled_at) {
    return res.status(404).render('not-found', { message: 'این درخواست لغو شده است؛ برای ویرایش ابتدا لغو را بردارید.' });
  }
  if (row.returned_at && sectionKey !== 'tech_operator') {
    return res.status(404).render('not-found', { message: 'این درخواست به درخواست‌کننده عودت داده شده است؛ فقط درخواست‌کننده می‌تواند ویرایش کند.' });
  }
  if (!row.published_at && row.created_by_username !== user.username && !isAdmin(user) && !isLocalAdmin(user)) {
    return res.status(404).render('not-found', { message: 'این ردیف هنوز ثبت نهایی نشده است.' });
  }

  const canEditThisSection = sectionKey === 'tech_operator' ? canEditRequesterRow(user, row) : canEditSection(user, sectionKey);
  if (!canEditThisSection) {
    const sectionsView = sections.map((s) => ({
      ...s,
      canEdit: s.key === 'tech_operator' ? canEditRequesterRow(user, row) : canEditSection(user, s.key),
    }));
    const deniedMessage =
      sectionKey === 'tech_operator'
        ? `شما مجاز به تکمیل «${section.title}» نیستید. این ردیف متعلق به دپارتمان «${row.requester_dept || '-'}» است و فقط پرسنل همان دپارتمان (یا ادمین) می‌توانند ویرایشش کنند.`
        : `شما مجاز به تکمیل «${section.title}» نیستید. این بخش فقط توسط پرسنل همان بخش قابل تکمیل است.`;
    return res.status(403).render('row', {
      row,
      sectionsView,
      user,
      isAdmin: isAdmin(user),
      isLocalAdmin: isLocalAdmin(user),
      canCancelRow: canCancelRow(user, row),
      canReturnToTechOffice: canReturnToTechOffice(user),
      draftRows: row.published_at ? [] : store.listDraftRowsForUser(user.username),
      todayJalali: todayJalaliDate(),
      message: [],
      error: [deniedMessage],
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

  const missingLabels = section.fields.filter((f) => f.required && !values[f.name]).map((f) => f.label);
  if (missingLabels.length) {
    req.flash('error', `تکمیل این فیلدها الزامی است: ${missingLabels.join('، ')}`);
    return res.redirect(`/rows/${id}`);
  }

  // دیگر تکراری بودن شماره درخواست خرید مانع ثبت نمی‌شود - همان الگوی بالا
  // (هشدار سمت کاربر پیش از ارسال، با /api/check-purchase-request-no).

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

router.get('/reports/duration', (req, res) => {
  const dateFields = allFields().filter((f) => f.type === 'jalali-date');
  const purchaseExecutorField = allFields().find((f) => f.name === 'purchase_executor');

  const params = {
    startField: req.query.startField || '',
    endField: req.query.endField || '',
    status: req.query.status || '',
    purchaseExecutor: req.query.purchaseExecutor || '',
    requesterDept: req.query.requesterDept || '',
    createdFrom: req.query.createdFrom || '',
    createdTo: req.query.createdTo || '',
  };

  let report = null;
  let error = null;
  if (params.startField && params.endField) {
    report = store.getDurationReport(params);
    if (!report) error = 'فیلدهای انتخاب‌شده معتبر نیستند.';
  }

  res.render('duration-report', {
    user: req.session.user,
    dateFields,
    purchaseExecutorOptions: purchaseExecutorField ? purchaseExecutorField.options : [],
    requesterDeptOptions: requesterDepartments.map((d) => d.label),
    params,
    report,
    error,
    todayJalali: todayJalaliDate(),
  });
});

module.exports = router;
