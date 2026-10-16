const express = require('express');
const multer = require('multer');
const router = express.Router();
const config = require('../config');
const db = require('../db');
const store = require('../store');
const ext = require('../extStore');
const wf = require('../workflow');
const ldap = require('../ldap');
const excelImport = require('../excelImport');
const { findSection, sections, isPaymentAuthWaived } = require('../sections');
const { normalizeJalaliDate, nowJalaliDateTime } = require('../jalaali');
const {
  isAdmin,
  isLocalAdmin,
  isManagement,
  canCreateRows,
  canEditSection,
  canEditSectionForRow,
  canCancelRow,
  canReturnToTechOffice,
} = require('../middleware');

// API JSON برای رابط کاربری جدید (React). تمام قواعد دسترسی/قفل همین‌جا (سمت سرور)
// و با همان توابع middleware.js و store.js سرویس قبلی اعمال می‌شود؛ فرانت‌اند فقط
// نمایش می‌دهد و هیچ‌چیز را به‌تنهایی مجاز نمی‌کند.

// فایل اکسل فقط در حافظه پردازش می‌شود و هیچ‌وقت روی دیسک ذخیره نمی‌شود
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const SESSION_MS = 2 * 60 * 60 * 1000;
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

function toLatin(value) {
  return String(value == null ? '' : value)
    .replace(/[۰-۹]/g, (d) => PERSIAN.indexOf(d))
    .replace(/[٠-٩]/g, (d) => ARABIC.indexOf(d));
}

function fail(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

function sessionUser(req) {
  return req.session && req.session.user;
}

function meOf(user) {
  return {
    user: {
      username: user.username,
      displayName: user.displayName,
      groups: user.groups,
      isLocalAdmin: Boolean(user.isLocalAdmin),
      authType: user.isLocalAdmin ? 'local' : 'ldap',
    },
    perms: {
      isAdmin: isAdmin(user),
      isLocalAdmin: isLocalAdmin(user),
      isManagement: isManagement(user),
      canCreateRows: canCreateRows(user),
      canReturnToTechOffice: canReturnToTechOffice(user),
    },
    overdueDays: config.overdueDays,
    sessionExpiresAt: user.loginAt ? user.loginAt + SESSION_MS : null,
  };
}

// ---------------- احراز هویت ----------------
router.post('/auth/login', async (req, res) => {
  const username = (req.body.username || '').toString();
  const password = (req.body.password || '').toString();
  if (!username || !password) return fail(res, 400, 'نام کاربری و رمز عبور را وارد کنید.');

  const finish = (user) => {
    req.session.regenerate((err) => {
      if (err) return fail(res, 500, 'ایجاد نشست ناموفق بود.');
      req.session.user = { ...user, loginAt: Date.now() };
      res.json({ ok: true, ...meOf(req.session.user) });
    });
  };

  if (config.localAdmin.username && username === config.localAdmin.username && password === config.localAdmin.password) {
    return finish({
      username: config.localAdmin.username,
      dn: null,
      displayName: `${config.localAdmin.username} (ادمین محلی)`,
      groups: [config.ldap.groups.admin],
      isLocalAdmin: true,
    });
  }

  try {
    const user = await ldap.authenticate(username, password);
    const allowed = Object.values(config.ldap.groups);
    if (!user.groups.some((g) => allowed.includes(g))) {
      return fail(res, 403, 'شما عضو هیچ‌کدام از گروه‌های مجاز این سرویس نیستید. با مدیر سیستم تماس بگیرید.');
    }
    return finish(user);
  } catch (err) {
    return fail(res, 401, err.message || 'ورود ناموفق بود');
  }
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth/me', (req, res) => {
  const user = sessionUser(req);
  if (!user) return fail(res, 401, 'وارد نشده‌اید.');
  res.json({ ok: true, ...meOf(user) });
});

// همه‌ی مسیرهای بعدی نیازمند ورود هستند
router.use((req, res, next) => {
  const user = sessionUser(req);
  if (!user) return fail(res, 401, 'نشست شما منقضی شده است؛ دوباره وارد شوید.');
  if (user.loginAt && Date.now() - user.loginAt >= SESSION_MS) {
    return req.session.destroy(() => fail(res, 401, 'نشست شما منقضی شده است؛ دوباره وارد شوید.'));
  }
  next();
});

// ---------------- خواندن داده ----------------
function canSeeRow(user, row) {
  if (row.deleted_at) return isLocalAdmin(user);
  if (row.published_at) return true;
  return row.created_by_username === user.username || isAdmin(user) || isLocalAdmin(user);
}

router.get('/data', (req, res) => {
  const user = sessionUser(req);
  const rows = db.all('SELECT * FROM rows ORDER BY id DESC').filter((r) => canSeeRow(user, r));
  const visibleIds = new Set(rows.map((r) => r.id));
  const auditLogs = db
    .all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 30000')
    .filter((l) => visibleIds.has(l.row_id));
  // جزئیات پیش‌فاکتورها (تأمین‌کننده، قیمت و...) فقط برای ادمین‌ها ارسال می‌شود؛
  // بقیه فقط تعداد پیش‌فاکتورهای هر درخواست را می‌بینند (گرفته شده یا نه)
  const allQuotes = ext.listQuotations().filter((q) => visibleIds.has(q.rowId));
  const quotationCounts = {};
  for (const q of allQuotes) quotationCounts[q.rowId] = (quotationCounts[q.rowId] || 0) + 1;
  const seeQuotes = isAdmin(user) || isLocalAdmin(user);
  res.json({
    ok: true,
    rows,
    auditLogs,
    vendors: ext.listVendors(),
    quotations: seeQuotes ? allQuotes : [],
    quotationCounts,
    approvals: ext.listApprovals().filter((a) => visibleIds.has(a.rowId)),
    serverTime: nowJalaliDateTime(),
  });
});

// ---------------- ردیف‌ها ----------------
function loadRow(req, res) {
  const row = store.getRow(req.params.id);
  if (!row) {
    fail(res, 404, 'ردیف یافت نشد.');
    return null;
  }
  const user = sessionUser(req);
  if (!canSeeRow(user, row)) {
    fail(res, 404, row.deleted_at ? 'این ردیف حذف شده است.' : 'این ردیف هنوز ثبت نهایی نشده است.');
    return null;
  }
  return row;
}

router.post('/rows', (req, res) => {
  const user = sessionUser(req);
  if (!canCreateRows(user)) return fail(res, 403, 'شما مجاز به ثبت درخواست جدید نیستید (فقط درخواست‌کننده).');
  const raw = {};
  for (const [k, v] of Object.entries(req.body.values || {})) raw[k] = toLatin(v);
  const { values, errors } = excelImport.validateRowValues(raw);
  if (errors.length) return fail(res, 400, errors.join(' — '));
  const row = store.createRow(values, user);
  res.json({ ok: true, row });
});

// ---- ایمپورت گروهی از اکسل (همان اعتبارسنجی فرم تک‌ردیفی) ----
router.get('/rows/import/template', async (req, res) => {
  const user = sessionUser(req);
  if (!canCreateRows(user)) return fail(res, 403, 'شما مجاز به ایجاد ردیف جدید نیستید (فقط درخواست‌کننده).');
  try {
    const workbook = await excelImport.buildTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="import-template.xlsx"; filename*=UTF-8''${encodeURIComponent('قالب-ایمپورت-درخواست-کالا.xlsx')}`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('ساخت قالب اکسل با خطا مواجه شد:', err);
    fail(res, 500, 'ساخت فایل قالب اکسل با خطا مواجه شد.');
  }
});

router.post('/rows/import', (req, res) => {
  importUpload.single('file')(req, res, async (uploadErr) => {
    const user = sessionUser(req);
    if (uploadErr) return fail(res, 400, 'آپلود فایل ناموفق بود (حداکثر ۵ مگابایت).');
    if (!canCreateRows(user)) return fail(res, 403, 'شما مجاز به ایجاد ردیف جدید نیستید (فقط درخواست‌کننده).');
    if (!req.file) return fail(res, 400, 'فایلی انتخاب نشده بود.');
    if (!/\.xlsx$/i.test(req.file.originalname || '')) return fail(res, 400, 'فقط فایل با پسوند xlsx پذیرفته می‌شود.');

    let result;
    try {
      result = await excelImport.parseImportFile(req.file.buffer);
    } catch (err) {
      console.error('خواندن فایل اکسل ایمپورت با خطا مواجه شد:', err);
      return fail(res, 400, 'خواندن این فایل ممکن نشد. مطمئن شوید فایل یک اکسل (xlsx) سالم و مطابق قالب است.');
    }
    if (result.headerError) return fail(res, 400, result.headerError);
    if (!result.validRows.length && !result.invalidRows.length) return fail(res, 400, 'هیچ ردیف داده‌ای در فایل پیدا نشد.');

    // فقط ردیف‌های سالم موقتاً روی سشن می‌مانند تا با «ثبت ردیف‌های سالم» دوباره آپلود لازم نباشد
    req.session.pendingImport = { createdByUsername: user.username, rows: result.validRows.map((r) => r.values) };
    res.json({ ok: true, validCount: result.validRows.length, invalidRows: result.invalidRows });
  });
});

router.post('/rows/import/confirm', (req, res) => {
  const user = sessionUser(req);
  if (!canCreateRows(user)) return fail(res, 403, 'شما مجاز به ایجاد ردیف جدید نیستید (فقط درخواست‌کننده).');
  const pending = req.session.pendingImport;
  if (!pending || pending.createdByUsername !== user.username || !pending.rows.length) {
    return fail(res, 400, 'داده‌ای برای ثبت پیدا نشد؛ لطفاً دوباره فایل اکسل را آپلود کنید.');
  }
  const created = pending.rows.map((values) => store.createRow(values, user));
  const finalized = store.finalizeDraftRows(user, created.map((r) => r.id));
  for (const r of finalized) {
    if (!ext.listRowApprovals(r.id).length) wf.createDefaultApprovals(r.id, r.priority, 0).forEach(ext.saveApproval);
  }
  delete req.session.pendingImport;
  res.json({ ok: true, count: finalized.length });
});

router.post('/rows/import/cancel', (req, res) => {
  delete req.session.pendingImport;
  res.json({ ok: true });
});

router.post('/rows/finalize', (req, res) => {
  const user = sessionUser(req);
  if (!canCreateRows(user)) return fail(res, 403, 'شما مجاز به ثبت نهایی ردیف نیستید.');
  const ids = Array.isArray(req.body.rowIds) ? req.body.rowIds : [];
  const finalized = store.finalizeDraftRows(user, ids);
  for (const r of finalized) {
    const existing = ext.listRowApprovals(r.id);
    if (!existing.length) wf.createDefaultApprovals(r.id, r.priority, 0).forEach(ext.saveApproval);
  }
  res.json({ ok: true, count: finalized.length });
});

router.post('/rows/:id/discard', (req, res) => {
  const user = sessionUser(req);
  const row = store.getRow(req.params.id);
  if (!row) return fail(res, 404, 'ردیف یافت نشد.');
  if (row.published_at) return fail(res, 400, 'این ردیف قبلاً ثبت نهایی شده؛ قابل حذف کامل نیست.');
  if (row.created_by_username !== user.username && !isAdmin(user)) {
    return fail(res, 403, 'فقط سازنده‌ی پیش‌نویس یا ادمین می‌تواند آن را حذف کند.');
  }
  store.discardDraftRow(row.id);
  ext.deleteRowExt(row.id);
  res.json({ ok: true });
});

router.post('/rows/:id/sections/:sectionKey', (req, res) => {
  const user = sessionUser(req);
  const section = findSection(req.params.sectionKey);
  const row = loadRow(req, res);
  if (!row) return;
  if (!section) return fail(res, 404, 'بخش نامعتبر است.');
  if (row.cancelled_at) return fail(res, 400, 'این درخواست لغو شده است؛ برای ویرایش ابتدا لغو را بردارید.');
  if (row.returned_at && section.key !== 'tech_operator') {
    return fail(res, 400, 'این درخواست به درخواست‌کننده عودت داده شده است؛ فقط درخواست‌کننده می‌تواند ویرایش کند.');
  }
  if (!canEditSectionForRow(user, row, section.key)) {
    return fail(res, 403, `شما مجاز به تکمیل «${section.title}» در این ردیف نیستید.`);
  }

  const input = req.body.values || {};
  const values = {};
  const errors = [];
  const executor = (input.purchase_executor ?? row.purchase_executor ?? '').toString();
  const waived = isPaymentAuthWaived({ purchase_executor: executor });
  for (const field of section.fields) {
    if (field.readOnly || (field.name === 'payment_auth_issued_date' && waived)) {
      values[field.name] = row[field.name] || '';
      continue;
    }
    let value = toLatin(input[field.name]).trim();
    if (field.type === 'jalali-date' && value) {
      const n = normalizeJalaliDate(value);
      if (n === null) {
        errors.push(`«${field.label}» یک تاریخ شمسی معتبر نیست (فرمت درست: 1403/05/12).`);
        continue;
      }
      value = n;
    }
    if (field.type === 'select' && value && !field.options.includes(value)) {
      errors.push(`«${field.label}» باید یکی از این مقادیر باشد: ${field.options.join('، ')}`);
      continue;
    }
    if (field.required && !value) {
      errors.push(`«${field.label}» الزامی است.`);
      continue;
    }
    values[field.name] = value;
  }
  if (errors.length) return fail(res, 400, errors.join(' — '));

  const updated = store.updateSection(row.id, section.key, values, user);
  const out = {};
  for (const f of section.fields) out[f.name] = updated[f.name] || '';
  res.json({ ok: true, values: out });
});

router.post('/rows/:id/cancel', (req, res) => {
  const user = sessionUser(req);
  const row = loadRow(req, res);
  if (!row) return;
  if (!canCancelRow(user, row)) return fail(res, 403, 'شما مجاز به لغو این درخواست نیستید.');
  const reason = (req.body.reason || '').toString().trim();
  if (!reason) return fail(res, 400, 'برای لغو درخواست، نوشتن دلیل الزامی است.');
  if (row.cancelled_at) return fail(res, 400, 'این درخواست از قبل لغو شده است.');
  if (row.returned_at) return fail(res, 400, 'این درخواست عودت داده شده است؛ ابتدا عودت را بردارید.');
  store.cancelRow(row.id, reason, user);
  res.json({ ok: true });
});

router.post('/rows/:id/uncancel', (req, res) => {
  const user = sessionUser(req);
  const row = loadRow(req, res);
  if (!row) return;
  if (!canCancelRow(user, row)) return fail(res, 403, 'شما مجاز به بازگرداندن این درخواست نیستید.');
  if (!row.cancelled_at) return fail(res, 400, 'این درخواست لغو نشده است.');
  store.uncancelRow(row.id, user);
  res.json({ ok: true });
});

router.post('/rows/:id/return', (req, res) => {
  const user = sessionUser(req);
  if (!canReturnToTechOffice(user)) return fail(res, 403, 'فقط انبار کارفرما یا ادمین می‌تواند عودت دهد.');
  const row = loadRow(req, res);
  if (!row) return;
  if (row.cancelled_at) return fail(res, 400, 'این درخواست لغو شده است؛ نمی‌توان آن را عودت داد.');
  if (row.returned_at) return fail(res, 400, 'این درخواست از قبل عودت داده شده است.');
  store.returnToTechOffice(row.id, (req.body.reason || '').toString().trim(), user);
  res.json({ ok: true });
});

router.post('/rows/:id/unreturn', (req, res) => {
  const user = sessionUser(req);
  if (!canReturnToTechOffice(user)) return fail(res, 403, 'فقط انبار کارفرما یا ادمین می‌تواند عودت را بردارد.');
  const row = loadRow(req, res);
  if (!row) return;
  if (!row.returned_at) return fail(res, 400, 'این درخواست عودت داده نشده است.');
  store.unreturnFromTechOffice(row.id, user);
  res.json({ ok: true });
});

router.post('/rows/:id/delete', (req, res) => {
  const user = sessionUser(req);
  if (!isLocalAdmin(user)) return fail(res, 403, 'فقط ادمین محلی اجازه‌ی حذف ردیف را دارد.');
  const row = store.getRow(req.params.id);
  if (!row) return fail(res, 404, 'ردیف یافت نشد.');
  store.softDeleteRow(row.id, user);
  res.json({ ok: true });
});

router.post('/rows/:id/restore', (req, res) => {
  const user = sessionUser(req);
  if (!isLocalAdmin(user)) return fail(res, 403, 'فقط ادمین محلی می‌تواند ردیف حذف‌شده را بازیابی کند.');
  const row = store.getRow(req.params.id);
  if (!row) return fail(res, 404, 'ردیف یافت نشد.');
  store.restoreRow(row.id);
  res.json({ ok: true });
});

// ---------------- ماژول گردش‌کار گسترده ----------------
function audit(row, sectionKey, fieldKey, label, oldValue, newValue, user) {
  store.insertAuditEntries(row.id, sectionKey, [{ fieldKey, fieldLabel: label, oldValue, newValue }], user);
}

function setRowCols(rowId, cols) {
  const keys = Object.keys(cols);
  const set = keys.map((k) => `${k} = @${k}`).join(', ');
  const params = { '@id': rowId };
  keys.forEach((k) => { params[`@${k}`] = cols[k]; });
  db.run(`UPDATE rows SET ${set} WHERE id = @id`, params);
}

function numberOf(v) {
  const n = Number(toLatin(v).replace(/[,٬\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function requireCommercial(req, res) {
  if (!canEditSection(sessionUser(req), 'commercial')) {
    fail(res, 403, 'فقط بازرگانی غدیر (یا ادمین) مجاز به این کار است.');
    return false;
  }
  return true;
}

router.post('/vendors', (req, res) => {
  if (!requireCommercial(req, res)) return;
  const b = req.body || {};
  const name = (b.name || '').toString().trim();
  if (!name) return fail(res, 400, 'نام تأمین‌کننده الزامی است.');
  const vendor = {
    id: ext.newVendorId(),
    name,
    category: (b.category || '').toString().trim(),
    contactPerson: (b.contactPerson || '').toString().trim(),
    phone: toLatin(b.phone).trim(),
    email: (b.email || '').toString().trim(),
    city: (b.city || '').toString().trim(),
    rating: Math.min(5, Math.max(1, parseInt(b.rating, 10) || 3)),
    grade: ['A', 'B', 'C'].includes(b.grade) ? b.grade : 'B',
    status: b.status === 'suspended' ? 'suspended' : 'active',
    address: (b.address || '').toString().trim(),
    economicCode: toLatin(b.economicCode).trim(),
    notes: (b.notes || '').toString().trim(),
  };
  ext.saveVendor(vendor);
  res.json({ ok: true, vendor });
});

router.put('/vendors/:id', (req, res) => {
  if (!requireCommercial(req, res)) return;
  const current = ext.getVendor(req.params.id);
  if (!current) return fail(res, 404, 'تأمین‌کننده یافت نشد.');
  const b = req.body || {};
  const next = { ...current };
  for (const k of ['name', 'category', 'contactPerson', 'email', 'city', 'address', 'notes']) {
    if (b[k] !== undefined) next[k] = (b[k] || '').toString().trim();
  }
  for (const k of ['phone', 'economicCode']) if (b[k] !== undefined) next[k] = toLatin(b[k]).trim();
  if (b.rating !== undefined) next.rating = Math.min(5, Math.max(1, parseInt(b.rating, 10) || current.rating));
  if (b.grade !== undefined && ['A', 'B', 'C'].includes(b.grade)) next.grade = b.grade;
  if (b.status !== undefined) next.status = b.status === 'suspended' ? 'suspended' : 'active';
  if (!next.name) return fail(res, 400, 'نام تأمین‌کننده الزامی است.');
  ext.saveVendor(next);
  res.json({ ok: true, vendor: next });
});

router.delete('/vendors/:id', (req, res) => {
  if (!requireCommercial(req, res)) return;
  if (!ext.getVendor(req.params.id)) return fail(res, 404, 'تأمین‌کننده یافت نشد.');
  ext.deleteVendor(req.params.id);
  res.json({ ok: true });
});

router.post('/quotations', (req, res) => {
  const user = sessionUser(req);
  const b = req.body || {};
  const row = store.getRow(b.rowId);
  if (!row || !canSeeRow(user, row)) return fail(res, 404, 'ردیف یافت نشد.');
  if (!canEditSectionForRow(user, row, 'commercial')) return fail(res, 403, 'امکان ثبت پیش‌فاکتور برای این درخواست وجود ندارد.');
  // تأمین‌کننده‌ی ثبت‌شده در بانک اطلاعات، یا (برای استعلام از بازار) فقط یک نام دستی
  let vendor = ext.getVendor(b.vendorId);
  if (!vendor) {
    const manualName = (b.vendorName || '').toString().trim();
    if (!manualName) return fail(res, 400, 'تأمین‌کننده نامعتبر است.');
    vendor = { id: 'VND-MANUAL', name: manualName };
  }
  const unitPrice = numberOf(b.unitPrice);
  const quantity = numberOf(b.quantity);
  const deliveryDays = Math.max(0, parseInt(toLatin(b.deliveryDays), 10) || 0);
  if (!(unitPrice > 0) || !(quantity > 0)) return fail(res, 400, 'قیمت واحد و تعداد باید عدد مثبت باشند.');
  const quote = {
    id: ext.newQuotationId(),
    rowId: row.id,
    vendorId: vendor.id,
    vendorName: vendor.name,
    quoteNumber: (b.quoteNumber || '').toString().trim(),
    quoteDate: (normalizeJalaliDate(toLatin(b.quoteDate)) || ''),
    validUntil: normalizeJalaliDate(toLatin(b.validUntil)) || (b.validUntil || '').toString().trim().slice(0, 60),
    unitPrice,
    quantity,
    totalPrice: unitPrice * quantity,
    deliveryDays,
    paymentTerms: (b.paymentTerms || '').toString().trim(),
    warranty: (b.warranty || '').toString().trim(),
    status: 'pending',
    notes: (b.notes || '').toString().trim(),
    createdAt: nowJalaliDateTime(),
    createdBy: user.displayName,
  };
  ext.saveQuotation(quote);
  if (!row.total_estimated_amount) setRowCols(row.id, { total_estimated_amount: quote.totalPrice });
  audit(row, 'commercial', 'quotation', 'پیش‌فاکتور', '', `${vendor.name} - ${quote.totalPrice}`, user);
  // کاربر غیرادمین فقط ثبت را تأیید می‌گیرد؛ جزئیات پیش‌فاکتور به او برنمی‌گردد
  res.json({ ok: true, quotation: isAdmin(user) || isLocalAdmin(user) ? quote : { id: quote.id, rowId: quote.rowId } });
});

router.post('/quotations/:id/select', (req, res) => {
  const user = sessionUser(req);
  if (!isAdmin(user) && !isLocalAdmin(user)) return fail(res, 403, 'فقط ادمین می‌تواند پیش‌فاکتورها را ببیند و برنده را انتخاب کند.');
  const quote = ext.getQuotation(req.params.id);
  if (!quote) return fail(res, 404, 'پیش‌فاکتور یافت نشد.');
  const row = store.getRow(quote.rowId);
  if (!row || !canEditSectionForRow(user, row, 'commercial')) return fail(res, 403, 'امکان انتخاب پیش‌فاکتور برای این درخواست وجود ندارد.');
  for (const q of ext.listQuotations().filter((x) => x.rowId === row.id)) {
    ext.saveQuotation({ ...q, status: q.id === quote.id ? 'selected' : 'rejected' });
  }
  const cols = {
    selected_quote_id: quote.id,
    selected_vendor_name: quote.vendorName,
    total_estimated_amount: quote.totalPrice,
  };
  if (wf.inferStage(row) === 'commercial_rfq') cols.workflow_stage = 'financial_approval';
  setRowCols(row.id, cols);
  audit(row, 'commercial', 'selected_vendor_name', 'تأمین‌کننده‌ی منتخب', row.selected_vendor_name || '', quote.vendorName, user);
  res.json({ ok: true });
});

router.delete('/quotations/:id', (req, res) => {
  const user = sessionUser(req);
  if (!isAdmin(user) && !isLocalAdmin(user)) return fail(res, 403, 'فقط ادمین می‌تواند پیش‌فاکتور را حذف کند.');
  const quote = ext.getQuotation(req.params.id);
  if (!quote) return fail(res, 404, 'پیش‌فاکتور یافت نشد.');
  const row = store.getRow(quote.rowId);
  if (!row || !canEditSectionForRow(user, row, 'commercial')) return fail(res, 403, 'امکان حذف پیش‌فاکتور وجود ندارد.');
  ext.deleteQuotation(quote.id);
  res.json({ ok: true });
});

// ساخت رکوردهای تأیید برای ردیف‌هایی که (به‌خاطر ثبت پیش از این ماژول) هنوز ندارند - idempotent
router.post('/rows/:id/approvals/init', (req, res) => {
  const row = loadRow(req, res);
  if (!row) return;
  if (!row.published_at) return fail(res, 400, 'ردیف هنوز ثبت نهایی نشده است.');
  if (!ext.listRowApprovals(row.id).length) {
    wf.createDefaultApprovals(row.id, row.priority, row.total_estimated_amount || 0).forEach(ext.saveApproval);
  }
  res.json({ ok: true });
});

function approvalRowGuard(row, res) {
  if (!row || row.deleted_at || !row.published_at) {
    fail(res, 404, 'این درخواست در دسترس نیست.');
    return false;
  }
  if (row.cancelled_at || row.returned_at) {
    fail(res, 400, 'درخواست لغو یا عودت داده شده است؛ امکان تأیید وجود ندارد.');
    return false;
  }
  return true;
}

router.post('/approvals/:id/approve', (req, res) => {
  const user = sessionUser(req);
  const approval = ext.getApproval(req.params.id);
  if (!approval) return fail(res, 404, 'مرحله‌ی تأیید یافت نشد.');
  if (!wf.canApproveStep(user, approval)) return fail(res, 403, 'شما دسترسی مجاز برای تأیید این مرحله را ندارید.');
  const row = store.getRow(approval.rowId);
  if (!approvalRowGuard(row, res)) return;
  if (approval.status !== 'pending') return fail(res, 400, 'این مرحله قبلاً بررسی شده است.');

  const next = {
    ...approval,
    status: 'approved',
    approvedByUsername: user.username,
    approvedByDisplay: user.displayName,
    approvedAt: nowJalaliDateTime(),
    comment: (req.body.comment || '').toString().trim() || undefined,
  };
  next.signatureHex = wf.signatureOf(next);
  ext.saveApproval(next);

  const all = ext.listRowApprovals(row.id);
  const allApproved = all.every((a) => a.status === 'approved');
  const cols = { approvals_status: allApproved ? 'approved' : 'partially_approved' };
  if (allApproved && wf.inferStage(row) === 'financial_approval') cols.workflow_stage = 'final_dispatch';
  setRowCols(row.id, cols);
  audit(row, 'approvals', `approval_${approval.roleKey}`, approval.title, 'در انتظار', `تأیید شد${next.comment ? ' - ' + next.comment : ''}`, user);
  res.json({ ok: true });
});

router.post('/approvals/:id/reject', (req, res) => {
  const user = sessionUser(req);
  const approval = ext.getApproval(req.params.id);
  if (!approval) return fail(res, 404, 'مرحله‌ی تأیید یافت نشد.');
  if (!wf.canApproveStep(user, approval)) return fail(res, 403, 'شما دسترسی مجاز برای رد این مرحله را ندارید.');
  const row = store.getRow(approval.rowId);
  if (!approvalRowGuard(row, res)) return;
  if (approval.status !== 'pending') return fail(res, 400, 'این مرحله قبلاً بررسی شده است.');
  const reason = (req.body.reason || '').toString().trim();
  if (!reason) return fail(res, 400, 'نوشتن دلیل رد الزامی است.');
  ext.saveApproval({
    ...approval,
    status: 'rejected',
    approvedByUsername: user.username,
    approvedByDisplay: user.displayName,
    approvedAt: nowJalaliDateTime(),
    rejectionReason: reason,
  });
  setRowCols(row.id, { approvals_status: 'rejected' });
  audit(row, 'approvals', `approval_${approval.roleKey}`, approval.title, 'در انتظار', `رد شد - دلیل: ${reason}`, user);
  res.json({ ok: true });
});

router.post('/rows/:id/advance', (req, res) => {
  const user = sessionUser(req);
  const row = loadRow(req, res);
  if (!row) return;
  const check = wf.canAdvance(row, user, ext.listRowApprovals(row.id));
  if (!check.allowed) return fail(res, 400, check.reason);
  setRowCols(row.id, { workflow_stage: check.nextStage });
  audit(row, 'workflow', 'workflow_stage', 'مرحله‌ی گردش‌کار', check.currentStage, check.nextStage, user);
  res.json({ ok: true });
});

router.post('/rows/:id/stage', (req, res) => {
  const user = sessionUser(req);
  if (!isAdmin(user)) return fail(res, 403, 'فقط ادمین می‌تواند مرحله را دستی تغییر دهد.');
  const row = loadRow(req, res);
  if (!row) return;
  const stage = (req.body.stage || '').toString();
  if (!wf.STAGES.some((s) => s.id === stage)) return fail(res, 400, 'مرحله‌ی نامعتبر است.');
  const before = wf.inferStage(row);
  setRowCols(row.id, { workflow_stage: stage });
  audit(row, 'workflow', 'workflow_stage', 'مرحله‌ی گردش‌کار', before, stage, user);
  res.json({ ok: true });
});

module.exports = router;
