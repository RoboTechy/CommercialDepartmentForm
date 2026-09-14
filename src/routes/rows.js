const express = require('express');
const router = express.Router();
const store = require('../store');
const config = require('../config');
const { sections, findSection, findField, allFields, requesterDepartments, isPaymentAuthWaived } = require('../sections');
const {
  requireLogin,
  canEditSectionForRow,
  canCreateRows,
  isAdmin,
  isLocalAdmin,
  isManagement,
  canCancelRow,
  canReturnToTechOffice,
} = require('../middleware');
const { normalizeJalaliDate, todayJalaliDate, daysSinceJalali } = require('../jalaali');

router.use(requireLogin);

// آیا این بخش (فقط برای نمایش - تعیین می‌کند آکاردئون پیش‌فرض باز/بسته باشد
// و نشان تیک بخورد یا نه) پر شده؟ همان قاعده‌ای که برای آمار داشبورد استفاده
// می‌شود (همه‌ی فیلدهای غیر-فقط‌خواندنی پر باشند)؛ هیچ مجوز/قفلی از این
// محاسبه نتیجه نمی‌شود - فقط یک نشانه‌ی بصری است.
// عنوان نمایشی متمایز برای دو بخشی که هر دو «انبار کارفرما» نام دارند
// (warehouse_1 و warehouse_2 - طبق sections.js عمداً به دو بلوک تقسیم
// شده‌اند تا بازرگانی غدیر بینشان بیاید)؛ همان قاعده‌ای که در row.ejs هم
// برای نوار مراحل/آکاردئون استفاده می‌شود، اینجا هم برای نشان «در انتظار»
// در فهرست اصلی لازم است تا با هم اشتباه گرفته نشوند
function sectionDisplayTitle(section) {
  if (section.key === 'warehouse_2') return section.title + ' — ارسال نامه';
  return section.title;
}

// دپارتمانی که این کاربر عملاً به آن تعلق دارد - برای پیش‌فرض هوشمند دکمه‌ی
// «فقط ستون‌های خودم» در فهرست اصلی. برخلاف canEditSection که ادمین را در
// همه‌جا مجاز می‌داند، اینجا فقط عضویت گروهی واقعی مهم است؛ ادمین/ادمین
// محلی/کاربری که عضو هیچ گروهی نیست، پیش‌فرضش «نمایش همه» (رشته‌ی خالی) است
function userHomeSectionColor(user) {
  if (isAdmin(user) || isLocalAdmin(user)) return '';
  for (const section of sections) {
    const groups = Array.isArray(section.group) ? section.group : [section.group];
    if (groups.some((g) => user.groups.includes(g))) return section.color;
  }
  return '';
}

function isSectionComplete(row, section) {
  const fields = store.fieldsForCompletion(row, section.fields.filter((f) => !f.readOnly));
  return fields.every((f) => (row[f.name] || '').toString().trim() !== '');
}

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
  if (query.incompleteRequesterDept) filters.incompleteRequesterDept = query.incompleteRequesterDept;
  return filters;
}

router.get('/', (req, res) => {
  const user = req.session.user;
  const filters = buildFiltersFromQuery(req.query);
  const rows = store.listRows(filters).map((row) => {
    const complete = store.isRowComplete(row);
    const age = daysSinceJalali(row.created_at);
    const overdue = !row.cancelled_at && !row.returned_at && !complete && age !== null && age > config.overdueDays;
    // فقط برای ردیف‌های جاری (نه لغو/عودت‌شده) معنا دارد - نشان می‌دهد
    // همین الان عملاً منتظر کدام واحد است، برای نمایش در ستون «وضعیت»
    const blockingSectionRaw =
      !row.cancelled_at && !row.returned_at && !complete ? store.currentBlockingSection(row) : null;
    const blockingSection = blockingSectionRaw
      ? { ...blockingSectionRaw, displayTitle: sectionDisplayTitle(blockingSectionRaw) }
      : null;

    // فیلدهایی که همین کاربر می‌تواند مستقیم از همین فهرست (بدون رفتن به صفحه‌ی
    // جزئیات) ویرایش کند - شماره درخواست کالا و فیلدهای فقط‌خواندنی هیچ‌وقت
    // اینجا نیستند (اولی لینک مستقیم به صفحه‌ی جزئیات دارد، دومی اصلاً قابل
    // ویرایش نیست)
    const editableFieldNames = [];
    for (const section of sections) {
      if (!canEditSectionForRow(user, row, section.key)) continue;
      for (const field of section.fields) {
        if (field.name === 'request_no' || field.readOnly) continue;
        // مجری خرید تهران/برنا: بازرگانی سایت مجوز پرداخت صادر نمی‌کند،
        // پس این فیلد از همین فهرست هم قابل ویرایش درجا نیست (به توضیح
        // isPaymentAuthWaived در sections.js مراجعه کنید)
        if (field.name === 'payment_auth_issued_date' && isPaymentAuthWaived(row)) continue;
        editableFieldNames.push(field.name);
      }
    }

    return { ...row, isComplete: complete, isOverdue: overdue, blockingSection, editableFieldNames };
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
    isManagement: isManagement(user),
    todayJalali: todayJalaliDate(),
    distinctValues,
    overdueDays: config.overdueDays,
    myDraftRows: store.listDraftRowsForUser(user.username),
    defaultColumnGroup: userHomeSectionColor(user),
  });
});

// صفحه‌ی جدا برای کارت‌های آماری - قبلاً بالای فهرست اصلی بودند؛ جدا شدند
// تا هم فهرست عملیاتی سبک‌تر/سریع‌تر بارگذاری شود (دیگر نیازی به محاسبه‌ی
// آمار روی هر بار باز شدن فهرست نیست) و هم دید کلی از دید کار روزمره جدا باشد
router.get('/stats', (req, res) => {
  const user = req.session.user;
  const overdueRows = store.getOverdueRows().map((item) => ({
    ...item,
    blockingSection: { ...item.blockingSection, displayTitle: sectionDisplayTitle(item.blockingSection) },
  }));
  res.render('stats', {
    user,
    stats: store.getDashboardStats(),
    overdueRows,
    cancelledReturnedList: store.getCancelledReturnedList(),
    volumeByMonth: store.getVolumeByMonth(),
    executorSplit: store.getPurchaseExecutorSplit(),
    overdueDays: config.overdueDays,
  });
});

function escapeCsv(val) {
  const str = (val ?? '').toString();
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function rowStatusLabel(row) {
  return row.cancelled_at ? 'لغو شده' : row.returned_at ? 'عودت به درخواست‌کننده' : 'جاری';
}

router.get('/export.csv', (req, res) => {
  const filters = buildFiltersFromQuery(req.query);
  const rows = store.listRows(filters);
  const fields = allFields();

  const headerRow = ['ردیف', 'وضعیت', ...fields.map((f) => f.label)];
  const lines = [headerRow.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push([row.id, rowStatusLabel(row), ...fields.map((f) => row[f.name] || '')].map(escapeCsv).join(','));
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
    canEdit: canEditSectionForRow(user, row, section.key),
    isComplete: isSectionComplete(row, section),
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
    paymentAuthWaived: isPaymentAuthWaived(row),
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

  // فهرست چک‌باکس‌های تیک‌خورده روی صفحه‌ی جزئیات - کاربر می‌تواند از بین چند
  // پیش‌نویس فقط بعضی‌ها را ثبت نهایی کند (نه لزوماً همه را با هم)
  const rawIds = req.body.rowIds;
  const rowIds = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];

  const finalized = store.finalizeDraftRows(user, rowIds);
  if (!finalized.length) {
    req.flash('error', 'هیچ ردیفی برای ثبت نهایی انتخاب نشده بود.');
    return res.redirect(`/rows/${row.id}`);
  }
  req.flash('message', `${finalized.length} ردیف با موفقیت در فهرست اصلی ثبت شد.`);
  res.redirect('/');
});

router.post('/rows/:id/discard', (req, res) => {
  const user = req.session.user;
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  if (row.published_at) {
    return res.status(404).render('not-found', { message: 'این ردیف قبلاً ثبت نهایی شده؛ دیگر پیش‌نویس نیست و قابل حذف کامل نیست.' });
  }
  if (row.created_by_username !== user.username && !isAdmin(user)) {
    return res.status(403).render('not-found', { message: 'شما مجاز به حذف این پیش‌نویس نیستید (فقط سازنده‌ی آن یا ادمین).' });
  }

  store.discardDraftRow(row.id);
  const remaining = store.listDraftRowsForUser(user.username);
  req.flash('message', `ردیف پیش‌نویس شماره ${row.id} برای همیشه حذف شد.`);
  res.redirect(remaining.length ? `/rows/${remaining[0].id}` : '/');
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

  if (!canEditSectionForRow(user, row, sectionKey)) {
    const sectionsView = sections.map((s) => ({
      ...s,
      canEdit: canEditSectionForRow(user, row, s.key),
      isComplete: isSectionComplete(row, s),
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
      paymentAuthWaived: isPaymentAuthWaived(row),
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

// ویرایش درجا (inline) یک فیلد تکی مستقیم از روی فهرست اصلی - بدون نیاز به
// رفتن به فرم کامل بخش. همان قوانین قفل‌شدگی/مجوز و همان تابع store.updateSection
// (پس همان لاگ تاریخچه) با فرم معمولی استفاده می‌شود؛ فقط مقدار همان یک فیلد
// عوض می‌شود و بقیه‌ی فیلدهای آن بخش دست‌نخورده می‌مانند. پاسخ JSON است چون
// این مسیر با fetch از جاوااسکریپت صدا زده می‌شود، نه با ارسال فرم معمولی.
router.post('/rows/:id/fields/:fieldName', (req, res) => {
  const user = req.session.user;
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'ردیف یافت نشد.' });

  const found = findField(req.params.fieldName);
  if (!found) return res.status(404).json({ ok: false, error: 'فیلد نامعتبر است.' });
  const { section, field } = found;

  if (field.name === 'request_no') {
    return res.status(400).json({ ok: false, error: 'شماره درخواست کالا از همین‌جا قابل ویرایش نیست؛ روی خودش کلیک کنید.' });
  }
  if (field.readOnly) {
    return res.status(400).json({ ok: false, error: 'این فیلد فقط‌خواندنی است و خودکار محاسبه می‌شود.' });
  }
  if (field.name === 'payment_auth_issued_date' && isPaymentAuthWaived(row)) {
    return res.status(400).json({ ok: false, error: 'چون مجری خرید «' + row.purchase_executor + '» است، بازرگانی سایت برای این خرید مجوز پرداخت صادر نمی‌کند و این فیلد قابل ویرایش نیست.' });
  }
  if (!row.published_at) {
    return res.status(404).json({ ok: false, error: 'این ردیف هنوز ثبت نهایی نشده است.' });
  }
  if (row.deleted_at) {
    return res.status(404).json({ ok: false, error: 'این ردیف حذف شده است.' });
  }
  if (row.cancelled_at) {
    return res.status(400).json({ ok: false, error: 'این درخواست لغو شده است؛ برای ویرایش ابتدا لغو را بردارید.' });
  }
  if (!canEditSectionForRow(user, row, section.key)) {
    return res.status(403).json({ ok: false, error: `شما مجاز به ویرایش «${field.label}» نیستید.` });
  }

  let value = (req.body.value || '').toString().trim();
  if (field.type === 'jalali-date' && value) {
    const normalized = normalizeJalaliDate(value);
    if (normalized === null) {
      return res.status(400).json({ ok: false, error: 'تاریخ شمسی معتبر نیست (فرمت درست: 1403/05/12).' });
    }
    value = normalized;
  }
  if (field.type === 'select' && value && !field.options.includes(value)) {
    return res.status(400).json({ ok: false, error: 'مقدار انتخاب‌شده معتبر نیست.' });
  }
  if (field.required && !value) {
    return res.status(400).json({ ok: false, error: `«${field.label}» نمی‌تواند خالی باشد.` });
  }

  // بقیه‌ی فیلدهای همان بخش دست‌نخورده می‌مانند - فقط همین یکی عوض می‌شود
  const values = {};
  for (const f of section.fields) {
    values[f.name] = f.name === field.name ? value : row[f.name] || '';
  }
  const updated = store.updateSection(row.id, section.key, values, user);

  res.json({ ok: true, value: updated[field.name] || '-' });
});

router.get('/rows/:id/history', (req, res) => {
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).render('not-found');
  const history = store.getRowHistory(req.params.id);
  res.render('history', { row, history, sections, user: req.session.user });
});

// تاریخچه‌ی یک فیلد تکی به‌صورت JSON - برای باکس کوچک هاور روی سلول در
// فهرست اصلی (بدون رفتن به صفحه‌ی جزئیات/تاریخچه‌ی کامل)
router.get('/rows/:id/fields/:fieldName/history', (req, res) => {
  const row = store.getRow(req.params.id);
  if (!row) return res.status(404).json({ entries: [] });
  if (!findField(req.params.fieldName)) return res.status(404).json({ entries: [] });

  const history = store.getFieldHistory(row.id, req.params.fieldName);
  res.json({
    entries: history.map((h) => ({
      changedAt: h.changed_at,
      changedByDisplay: h.changed_by_display,
      oldValue: h.old_value,
      newValue: h.new_value,
    })),
  });
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

function buildDurationReportParams(query) {
  return {
    startField: query.startField || '',
    endField: query.endField || '',
    status: query.status || '',
    purchaseExecutor: query.purchaseExecutor || '',
    requesterDept: query.requesterDept || '',
    createdFrom: query.createdFrom || '',
    createdTo: query.createdTo || '',
  };
}

router.get('/reports/duration', (req, res) => {
  const dateFields = allFields().filter((f) => f.type === 'jalali-date');
  const purchaseExecutorField = allFields().find((f) => f.name === 'purchase_executor');

  const params = buildDurationReportParams(req.query);

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

router.get('/reports/duration/export.csv', (req, res) => {
  const params = buildDurationReportParams(req.query);
  const report = params.startField && params.endField ? store.getDurationReport(params) : null;
  if (!report) {
    req.flash('error', 'برای خروجی گرفتن، ابتدا فیلدهای «از» و «تا» را انتخاب و گزارش را بسازید.');
    return res.redirect('/reports/duration');
  }

  const startLabel = (allFields().find((f) => f.name === params.startField) || {}).label || 'تاریخ شروع';
  const endLabel = (allFields().find((f) => f.name === params.endField) || {}).label || 'تاریخ پایان';

  const headerRow = ['ردیف', 'وضعیت', 'شماره درخواست کالا', 'شرح کالا', startLabel, endLabel, 'مدت (روز)'];
  const lines = [headerRow.map(escapeCsv).join(',')];
  for (const item of report.items) {
    const row = item.row;
    lines.push(
      [row.id, rowStatusLabel(row), row.request_no, row.item_description, row[params.startField], row[params.endField], item.days]
        .map(escapeCsv)
        .join(',')
    );
  }

  const filename = `prt-duration-report-${todayJalaliDate().replace(/\//g, '-')}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + lines.join('\r\n'));
});

// گزارش‌های مدیریتی (زمان‌بندی/تحلیلی) - فقط برای اعضای گروه
// PRT-Management (و ادمین)؛ بقیه‌ی کاربران حتی لینکش را هم در ناوبری
// نمی‌بینند (partials/nav.ejs) و مستقیم هم که بیایند 403 می‌گیرند
router.get('/reports/management', (req, res) => {
  const user = req.session.user;
  if (!isManagement(user)) {
    return res.status(403).render('not-found', { message: 'این گزارش فقط برای اعضای مدیریت در دسترس است.' });
  }
  res.render('management-report', {
    user,
    stageStats: store.getManagementStageStats(),
    priorityStats: store.getManagementPriorityStats(),
  });
});

module.exports = router;
