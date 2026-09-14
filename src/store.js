const db = require('./db');
const { sections, findSection, allFields, requesterDepartments } = require('./sections');
const { nowJalaliDateTime, daysBetweenJalali } = require('./jalaali');

// دپارتمان درخواست‌کننده (دفتر فنی/عمران/آی‌تی) را از عضویت گروهی کاربر
// تشخیص می‌دهد - خود کاربر این را انتخاب نمی‌کند، کاملاً خودکار است. اگر
// کاربر (مثلاً ادمین) عضو هیچ‌کدام از این گروه‌ها نباشد، خالی می‌ماند.
function resolveRequesterDept(user) {
  const match = requesterDepartments.find((d) => user.groups.includes(d.group));
  return match ? match.label : '';
}

const ALL_FIELDS = allFields();
const FIELD_BY_NAME = new Map(ALL_FIELDS.map((f) => [f.name, f]));

// بخش‌هایی که رنگ یکسان دارند (مثل دو بلوک انبار کارفرما) برای آمار یک
// «دپارتمان» واحد به‌حساب می‌آیند
const DEPARTMENTS = (() => {
  const byColor = new Map();
  for (const section of sections) {
    if (!byColor.has(section.color)) {
      byColor.set(section.color, { color: section.color, title: section.title, fields: [] });
    }
    byColor.get(section.color).fields.push(...section.fields);
  }
  return [...byColor.values()];
})();

function isFieldSetComplete(row, fields) {
  return fields.every((f) => (row[f.name] || '').toString().trim() !== '');
}

function isRowComplete(row) {
  return isFieldSetComplete(row, ALL_FIELDS);
}

function listRows(filters = {}) {
  const clauses = [];
  const params = {};

  for (const field of ALL_FIELDS) {
    const value = filters[field.name];
    if (field.type === 'jalali-date') {
      const from = filters[`${field.name}_from`];
      const to = filters[`${field.name}_to`];
      if (from) {
        clauses.push(`${field.name} >= @${field.name}_from`);
        params[`@${field.name}_from`] = from;
      }
      if (to) {
        clauses.push(`${field.name} <= @${field.name}_to`);
        params[`@${field.name}_to`] = to;
      }
    } else if (value) {
      if (field.type === 'select') {
        clauses.push(`${field.name} = @${field.name}`);
        params[`@${field.name}`] = value;
      } else {
        clauses.push(`${field.name} LIKE @${field.name}`);
        params[`@${field.name}`] = `%${value}%`;
      }
    }
  }

  // فیلتر ستون «وضعیت» (جاری/لغو شده/عودت به درخواست‌کننده) - همان منطق سه‌حالته‌ای
  // که در گزارش‌ساز هم استفاده می‌شود
  if (filters.status === 'active') {
    clauses.push(`cancelled_at = ''`, `returned_at = ''`);
  } else if (filters.status === 'cancelled') {
    clauses.push(`cancelled_at != ''`);
  } else if (filters.status === 'returned') {
    clauses.push(`cancelled_at = ''`, `returned_at != ''`);
  }

  // فیلتر «کلیک روی کارت آماری یک دپارتمان»: فقط ردیف‌های جاری (نه لغو/عودت)
  // که حداقل یکی از فیلدهای آن دپارتمان هنوز خالی است - دقیقاً همان ردیف‌هایی
  // که در شمارشِ «در انتظار» روی همان کارت لحاظ شده‌اند
  if (filters.incompleteDept) {
    const dept = DEPARTMENTS.find((d) => d.color === filters.incompleteDept);
    if (dept) {
      clauses.push(`(${dept.fields.map((f) => `${f.name} = ''`).join(' OR ')})`);
      clauses.push(`cancelled_at = ''`, `returned_at = ''`);
    }
  }

  // همان‌طور بالا، ولی برای کارت‌های آماری سه‌گانه‌ی «درخواست‌کننده» (دفتر
  // فنی/عمران/آی‌تی) که هرکدام فقط ردیف‌های دپارتمان خودشان را می‌شمارند
  if (filters.incompleteRequesterDept) {
    const dept = requesterDepartments.find((d) => d.label === filters.incompleteRequesterDept);
    if (dept) {
      const techFields = findSection('tech_operator').fields.filter((f) => !f.readOnly);
      clauses.push(`requester_dept = @incompleteRequesterDept`);
      params['@incompleteRequesterDept'] = filters.incompleteRequesterDept;
      clauses.push(`(${techFields.map((f) => `${f.name} = ''`).join(' OR ')})`);
      clauses.push(`cancelled_at = ''`, `returned_at = ''`);
    }
  }

  clauses.push(`deleted_at = ''`);
  clauses.push(`published_at != ''`);
  const where = `WHERE ${clauses.join(' AND ')}`;
  return db.all(`SELECT * FROM rows ${where} ORDER BY id DESC`, params);
}

function getRow(id) {
  return db.get('SELECT * FROM rows WHERE id = @id', { '@id': id });
}

// برای تشخیص شماره‌های «تکراری» (شماره درخواست کالا / شماره درخواست خرید)
// بدون حساسیت به حروف بزرگ/کوچک، بدون حساسیت به رقم فارسی/عربی در برابر
// انگلیسی، بدون حساسیت به نوع خط تیره (-/–/—/...)، و بدون تأثیرپذیری از
// کاراکترهای نامرئی که هنگام کپی/پیست معمولاً وارد متن می‌شوند (نیم‌فاصله،
// علامت‌های جهت راست‌به‌چپ/چپ‌به‌راست و مانند آن) - چون این‌ها می‌توانند دو
// مقدار را «از نظر چشمی یکسان» ولی از نظر رشته‌ای متفاوت کنند.
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeForDuplicateCheck(value) {
  let s = (value || '').toString();
  s = s.replace(/[​‌‍‎‏﻿]/g, ''); // نیم‌فاصله و کاراکترهای نامرئی جهت‌دهی
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
  s = s.replace(/[‐‑‒–—−ـ]/g, '-'); // انواع خط تیره + کشیده‌ی عربی
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}

// همه‌ی ردیف‌هایی که شماره درخواست کالایشان با مقدار داده‌شده «یکی» است (طبق
// نرمال‌سازی بالا). ثبت دیگر به‌خاطر این مورد رد نمی‌شود؛ فقط برای نمایش یک
// هشدار/تاییدیه به کاربر پیش از ثبت نهایی استفاده می‌شود (رابط کاربری خودش
// تصمیم می‌گیرد که آیا اجازه‌ی ادامه بدهد یا نه).
function findRowsByRequestNo(requestNo) {
  const normalized = normalizeForDuplicateCheck(requestNo);
  if (!normalized) return [];
  const rows = db.all(`SELECT * FROM rows WHERE deleted_at = ''`);
  return rows.filter((row) => normalizeForDuplicateCheck(row.request_no) === normalized);
}

// همه‌ی ردیف‌هایی که شماره درخواست خریدشان با مقدار داده‌شده «یکی» است -
// برای هشدار مشابه هنگام تکمیل بخش انبار کارفرما.
function findRowsByPurchaseRequestNo(purchaseRequestNo, excludeRowId) {
  const normalized = normalizeForDuplicateCheck(purchaseRequestNo);
  if (!normalized) return [];
  const rows = db.all(`SELECT * FROM rows WHERE deleted_at = ''`);
  return rows.filter(
    (row) => String(row.id) !== String(excludeRowId) && normalizeForDuplicateCheck(row.purchase_request_no) === normalized
  );
}

// مقادیر یکتا و غیرخالی یک ستون، برای پیشنهاد خودکار (autocomplete) در فیلتر جستجو
function getDistinctValues(fieldName) {
  if (!FIELD_BY_NAME.has(fieldName)) return [];
  return db
    .all(`SELECT DISTINCT ${fieldName} AS value FROM rows WHERE ${fieldName} IS NOT NULL AND ${fieldName} != '' AND deleted_at = '' AND published_at != '' ORDER BY ${fieldName}`)
    .map((row) => row.value);
}

// ردیف‌های پیش‌نویس یک کاربر خاص - ساخته شده ولی هنوز «ثبت نهایی» نشده‌اند،
// پس در فهرست اصلی/آمار/جستجو ظاهر نمی‌شوند تا وقتی کاربر با هم ثبت نهاییشان کند
function listDraftRowsForUser(username) {
  return db.all(
    `SELECT * FROM rows WHERE created_by_username = @username AND published_at = '' AND deleted_at = '' ORDER BY id ASC`,
    { '@username': username }
  );
}

// ثبت نهایی: همه‌ی ردیف‌های پیش‌نویس یک کاربر را یکجا وارد فهرست اصلی می‌کند
// (این‌طوری کاربر می‌تواند چند درخواست را پشت‌سرهم بسازد و با هم ثبت کند)
// rowIds اختیاری است: اگر داده شود، فقط همان پیش‌نویس‌ها (که واقعاً هم مال
// همین کاربرند) ثبت نهایی می‌شوند - نه همه‌ی پیش‌نویس‌های کاربر. این‌طوری
// کاربر می‌تواند از بین چند پیش‌نویس، فقط بعضی‌ها را ثبت نهایی کند و بقیه را
// برای بعد نگه دارد (یا حذفشان کند - به discardDraftRow مراجعه کنید).
function finalizeDraftRows(user, rowIds) {
  const drafts = listDraftRowsForUser(user.username);
  const toFinalize = rowIds ? drafts.filter((d) => rowIds.map(String).includes(String(d.id))) : drafts;
  if (!toFinalize.length) return [];
  const publishedAt = nowJalaliDateTime();
  const finalize = db.transaction((rowsToPublish) => {
    for (const draft of rowsToPublish) {
      db.runRaw(`UPDATE rows SET published_at = @publishedAt WHERE id = @id`, {
        '@id': draft.id,
        '@publishedAt': publishedAt,
      });
    }
  });
  finalize(toFinalize);
  for (const draft of toFinalize) {
    insertAuditEntries(
      draft.id,
      'tech_operator',
      [{ fieldKey: 'published_at', fieldLabel: 'وضعیت ثبت', oldValue: 'پیش‌نویس', newValue: 'ثبت نهایی شد' }],
      user
    );
  }
  return toFinalize;
}

// حذف کامل (نه نرم) یک ردیف پیش‌نویس - فقط زمانی مجاز است که ردیف هنوز
// هیچ‌جای مشترکی دیده نشده باشد (published_at خالی)؛ چون هیچ بخش دیگری
// (انبار/بازرگانی) از وجودش خبردار نشده، حذف کامل بی‌خطر است و برخلاف حذف
// ردیف‌های ثبت‌نهایی‌شده، نیازی به بازیابی/تاریخچه ندارد. برای جلوگیری از
// شلوغی audit_log با رکوردهای بی‌معنیِ یک پیش‌نویس منصرف‌شده، لاگ همان ردیف
// هم با خودش حذف می‌شود.
function discardDraftRow(rowId) {
  const row = getRow(rowId);
  if (!row || row.published_at) return false;
  const doDelete = db.transaction(() => {
    db.runRaw(`DELETE FROM audit_log WHERE row_id = @id`, { '@id': rowId });
    db.runRaw(`DELETE FROM rows WHERE id = @id`, { '@id': rowId });
  });
  doDelete();
  return true;
}

// آمار کلی برای نمای بالای صفحه‌ی اصلی: تعداد کل، تکمیل/در انتظار به تفکیک
// دپارتمان، و میانگین مدت‌زمان تکمیل کامل یک ردیف (از ایجاد تا آخرین تغییر)
function getDashboardStats() {
  const allRows = db.all(`SELECT * FROM rows WHERE deleted_at = '' AND published_at != ''`);
  // ردیف‌های لغوشده یا عودت‌داده‌شده دیگر در روند عادی پیش نمی‌روند، پس از
  // آمار «تکمیل/در انتظار» و میانگین زمان تکمیل کنار گذاشته می‌شوند تا آمار
  // واقعی را خراب نکنند
  const activeRows = allRows.filter((row) => !row.cancelled_at && !row.returned_at);
  const lastChangeRows = db.all('SELECT row_id, MAX(changed_at) AS last_changed FROM audit_log GROUP BY row_id');
  const lastChangeByRow = new Map(lastChangeRows.map((r) => [r.row_id, r.last_changed]));

  // بخش «درخواست‌کننده» به‌جای یک کارت آماری واحد، به تفکیک هر دپارتمان
  // (دفتر فنی/عمران/آی‌تی) جدا حساب می‌شود؛ بقیه‌ی دپارتمان‌ها (انبار/بازرگانی)
  // مثل قبل یک کارت واحد دارند
  const departments = DEPARTMENTS.filter((dept) => dept.color !== 'tech_operator').map((dept) => {
    const completed = activeRows.filter((row) => isFieldSetComplete(row, dept.fields)).length;
    return { color: dept.color, title: dept.title, completed, pending: activeRows.length - completed };
  });

  const techOperatorFields = findSection('tech_operator').fields.filter((f) => !f.readOnly);
  const requesterDeptStats = requesterDepartments.map((dept) => {
    const deptRows = activeRows.filter((row) => row.requester_dept === dept.label);
    const completed = deptRows.filter((row) => isFieldSetComplete(row, techOperatorFields)).length;
    return { label: dept.label, completed, pending: deptRows.length - completed };
  });

  let fullyCompleted = 0;
  let totalDays = 0;
  let daysSampleCount = 0;
  for (const row of activeRows) {
    if (!isRowComplete(row)) continue;
    fullyCompleted++;
    const lastChanged = lastChangeByRow.get(row.id);
    const days = lastChanged ? daysBetweenJalali(row.created_at, lastChanged) : null;
    if (days !== null && days >= 0) {
      totalDays += days;
      daysSampleCount++;
    }
  }

  return {
    totalRows: allRows.length,
    cancelledCount: allRows.filter((row) => row.cancelled_at).length,
    returnedCount: allRows.filter((row) => !row.cancelled_at && row.returned_at).length,
    fullyCompleted,
    departments,
    requesterDeptStats,
    avgCompletionDays: daysSampleCount ? totalDays / daysSampleCount : null,
  };
}

function insertAuditEntries(rowId, sectionKey, entries, user) {
  // تغییرات ادمین محلی (break-glass) عمداً لاگ نمی‌شود
  if (user.isLocalAdmin) return;
  if (!entries.length) return;
  const changedAt = nowJalaliDateTime();
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      db.runRaw(
        `INSERT INTO audit_log (row_id, section_key, field_key, field_label, old_value, new_value, changed_by_username, changed_by_display, changed_at)
         VALUES (@rowId, @sectionKey, @fieldKey, @fieldLabel, @oldValue, @newValue, @username, @display, @changedAt)`,
        row
      );
    }
  });
  insertMany(
    entries.map((e) => ({
      '@rowId': rowId,
      '@sectionKey': sectionKey,
      '@fieldKey': e.fieldKey,
      '@fieldLabel': e.fieldLabel,
      '@oldValue': e.oldValue,
      '@newValue': e.newValue,
      '@username': user.username,
      '@display': user.displayName || user.username,
      '@changedAt': changedAt,
    }))
  );
}

function createRow(values, user) {
  const section = findSection('tech_operator');
  const columns = ['created_by_username', 'created_by_display', 'created_at'];
  const params = {
    '@created_by_username': user.username,
    '@created_by_display': user.displayName || user.username,
    '@created_at': nowJalaliDateTime(),
  };

  const auditEntries = [];
  for (const field of section.fields) {
    // فیلدهای فقط‌خواندنی (مثل دپارتمان درخواست‌کننده) هرگز از ورودی کاربر
    // گرفته نمی‌شوند - همیشه سمت سرور محاسبه می‌شوند
    const value =
      field.name === 'requester_dept' ? resolveRequesterDept(user) : (values[field.name] || '').toString().trim();
    columns.push(field.name);
    params[`@${field.name}`] = value;
    if (value) {
      auditEntries.push({ fieldKey: field.name, fieldLabel: field.label, oldValue: '', newValue: value });
    }
  }

  const placeholders = columns.map((c) => `@${c}`).join(', ');
  const result = db.run(`INSERT INTO rows (${columns.join(', ')}) VALUES (${placeholders})`, params);

  insertAuditEntries(result.lastInsertRowid, 'tech_operator', auditEntries, user);
  return getRow(result.lastInsertRowid);
}

function updateSection(rowId, sectionKey, values, user) {
  const section = findSection(sectionKey);
  if (!section) throw new Error('بخش نامعتبر است');
  const current = getRow(rowId);
  if (!current) throw new Error('ردیف یافت نشد');

  const auditEntries = [];
  const setClauses = [];
  const params = { '@id': rowId };

  for (const field of section.fields) {
    const oldValue = current[field.name] || '';
    // فیلدهای فقط‌خواندنی (مثل دپارتمان درخواست‌کننده) بعد از ایجاد ردیف هرگز
    // تغییر نمی‌کنند، حتی اگر مقدار دیگری در فرم ارسال شده باشد
    const newValue = field.readOnly ? oldValue : (values[field.name] || '').toString().trim();
    setClauses.push(`${field.name} = @${field.name}`);
    params[`@${field.name}`] = newValue;
    if (newValue !== oldValue) {
      auditEntries.push({ fieldKey: field.name, fieldLabel: field.label, oldValue, newValue });
    }
  }

  db.run(`UPDATE rows SET ${setClauses.join(', ')} WHERE id = @id`, params);
  insertAuditEntries(rowId, sectionKey, auditEntries, user);
  return getRow(rowId);
}

function getRowHistory(rowId) {
  return db.all('SELECT * FROM audit_log WHERE row_id = @rowId ORDER BY id DESC', { '@rowId': rowId });
}

// تاریخچه‌ی فقط یک فیلد خاص از یک ردیف - برای نمایش سریع (مثلاً در یک
// باکس کوچک هنگام هاور روی همان سلول در فهرست اصلی) بدون بار زدن کل
// تاریخچه‌ی ردیف
function getFieldHistory(rowId, fieldKey) {
  return db.all(
    'SELECT * FROM audit_log WHERE row_id = @rowId AND field_key = @fieldKey ORDER BY id DESC',
    { '@rowId': rowId, '@fieldKey': fieldKey }
  );
}

// حذف نرم: ردیف واقعاً از دیتابیس پاک نمی‌شود، فقط از فهرست اصلی/آمار/جستجو
// پنهان می‌شود و قابل بازیابی می‌ماند. این اکشن خودش در audit_log ثبت نمی‌شود
// (فقط روی خود ردیف مشخص می‌شود چه کسی و چه زمانی حذفش کرده).
function softDeleteRow(rowId, user) {
  db.run(
    `UPDATE rows SET deleted_at = @deletedAt, deleted_by_username = @username, deleted_by_display = @display WHERE id = @id`,
    {
      '@id': rowId,
      '@deletedAt': nowJalaliDateTime(),
      '@username': user.username,
      '@display': user.displayName || user.username,
    }
  );
}

function restoreRow(rowId) {
  db.run(
    `UPDATE rows SET deleted_at = '', deleted_by_username = '', deleted_by_display = '' WHERE id = @id`,
    { '@id': rowId }
  );
}

function listDeletedRows() {
  return db.all(`SELECT * FROM rows WHERE deleted_at != '' ORDER BY id DESC`);
}

// لغو درخواست: ردیف حذف نمی‌شود و در فهرست می‌ماند، فقط رنگش تغییر می‌کند و
// دیگر هیچ بخشی قابل ویرایش نیست. حتماً با یک دلیل همراه است و مثل بقیه‌ی
// تغییرات در تاریخچه ثبت می‌شود (مگر توسط ادمین محلی - طبق قاعده‌ی کلی
// insertAuditEntries).
function cancelRow(rowId, reason, user) {
  db.run(
    `UPDATE rows SET cancelled_at = @cancelledAt, cancelled_by_username = @username, cancelled_by_display = @display, cancel_reason = @reason WHERE id = @id`,
    {
      '@id': rowId,
      '@cancelledAt': nowJalaliDateTime(),
      '@username': user.username,
      '@display': user.displayName || user.username,
      '@reason': reason,
    }
  );
  insertAuditEntries(
    rowId,
    'tech_operator',
    [{ fieldKey: 'cancel_reason', fieldLabel: 'وضعیت درخواست', oldValue: 'فعال', newValue: `لغو شد - دلیل: ${reason}` }],
    user
  );
}

function uncancelRow(rowId, user) {
  db.run(
    `UPDATE rows SET cancelled_at = '', cancelled_by_username = '', cancelled_by_display = '', cancel_reason = '' WHERE id = @id`,
    { '@id': rowId }
  );
  insertAuditEntries(
    rowId,
    'tech_operator',
    [{ fieldKey: 'cancel_reason', fieldLabel: 'وضعیت درخواست', oldValue: 'لغو شد', newValue: 'بازگردانده شد (فعال)' }],
    user
  );
}

// عودت به درخواست‌کننده: انبار کارفرما یک درخواست را برمی‌گرداند (مثلاً به‌خاطر
// نقص در اطلاعات). ردیف حذف نمی‌شود، در فهرست می‌ماند، رنگش تغییر می‌کند و
// فقط بخش درخواست‌کننده قابل ویرایش می‌ماند تا مشکل را برطرف کنند. دلیل اختیاری
// است.
function returnToTechOffice(rowId, reason, user) {
  db.run(
    `UPDATE rows SET returned_at = @returnedAt, returned_by_username = @username, returned_by_display = @display, return_reason = @reason WHERE id = @id`,
    {
      '@id': rowId,
      '@returnedAt': nowJalaliDateTime(),
      '@username': user.username,
      '@display': user.displayName || user.username,
      '@reason': reason,
    }
  );
  insertAuditEntries(
    rowId,
    'warehouse_1',
    [{
      fieldKey: 'return_reason',
      fieldLabel: 'وضعیت درخواست',
      oldValue: 'فعال',
      newValue: reason ? `عودت به درخواست‌کننده - دلیل: ${reason}` : 'عودت به درخواست‌کننده',
    }],
    user
  );
}

function unreturnFromTechOffice(rowId, user) {
  db.run(
    `UPDATE rows SET returned_at = '', returned_by_username = '', returned_by_display = '', return_reason = '' WHERE id = @id`,
    { '@id': rowId }
  );
  insertAuditEntries(
    rowId,
    'warehouse_1',
    [{ fieldKey: 'return_reason', fieldLabel: 'وضعیت درخواست', oldValue: 'عودت به درخواست‌کننده', newValue: 'بازگردانده شد (فعال)' }],
    user
  );
}

function searchLogs(filters = {}) {
  const clauses = [];
  const params = {};

  if (filters.user) {
    clauses.push('(changed_by_display LIKE @user OR changed_by_username LIKE @user)');
    params['@user'] = `%${filters.user}%`;
  }
  if (filters.fieldKey) {
    clauses.push('field_key = @fieldKey');
    params['@fieldKey'] = filters.fieldKey;
  }
  if (filters.rowId) {
    clauses.push('row_id = @rowId');
    params['@rowId'] = filters.rowId;
  }
  if (filters.from) {
    clauses.push('changed_at >= @from');
    params['@from'] = filters.from;
  }
  if (filters.to) {
    // یک روز کامل تا انتهای تاریخ «تا» را نیز شامل شود
    clauses.push('changed_at <= @to');
    params['@to'] = `${filters.to} 99:99:99`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.all(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT 1000`, params);
}

function median(sortedNumbers) {
  const n = sortedNumbers.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedNumbers[mid] : (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2;
}

// گزارش‌ساز عمومی مدت‌زمان: میانگین/میانه/حداقل/حداکثر تعداد روز بین دو فیلد
// تاریخ شمسی دلخواه (مثلاً «تاریخ ارجاع به بازرگانی» تا «تاریخ صدور مجوز
// پرداخت»)، با چند فیلتر اختیاری - از جمله وضعیت (جاری/لغو شده/عودت به دفتر
// فنی/همه) تا بشود این دسته‌ها را از هم جدا یا با هم دید. ردیف‌های حذف‌شده
// همیشه کنار گذاشته می‌شوند.
function getDurationReport({ startField, endField, purchaseExecutor, requesterDept, createdFrom, createdTo, status }) {
  const startDef = FIELD_BY_NAME.get(startField);
  const endDef = FIELD_BY_NAME.get(endField);
  if (!startDef || !endDef || startDef.type !== 'jalali-date' || endDef.type !== 'jalali-date') {
    return null;
  }

  const clauses = [`deleted_at = ''`, `published_at != ''`, `${startField} != ''`, `${endField} != ''`];
  const params = {};
  if (status === 'active') {
    clauses.push(`cancelled_at = ''`, `returned_at = ''`);
  } else if (status === 'cancelled') {
    clauses.push(`cancelled_at != ''`);
  } else if (status === 'returned') {
    clauses.push(`cancelled_at = ''`, `returned_at != ''`);
  }
  if (purchaseExecutor) {
    clauses.push('purchase_executor = @purchaseExecutor');
    params['@purchaseExecutor'] = purchaseExecutor;
  }
  if (requesterDept) {
    clauses.push('requester_dept = @requesterDept');
    params['@requesterDept'] = requesterDept;
  }
  if (createdFrom) {
    clauses.push('created_at >= @createdFrom');
    params['@createdFrom'] = createdFrom;
  }
  if (createdTo) {
    clauses.push('created_at <= @createdTo');
    params['@createdTo'] = `${createdTo} 99:99:99`;
  }

  const rows = db.all(`SELECT * FROM rows WHERE ${clauses.join(' AND ')}`, params);

  const items = [];
  let negativeCount = 0;
  for (const row of rows) {
    const days = daysBetweenJalali(row[startField], row[endField]);
    if (days === null) continue;
    if (days < 0) {
      negativeCount++;
      continue;
    }
    items.push({ row, days });
  }

  items.sort((a, b) => b.days - a.days);
  const daysSorted = items.map((i) => i.days).sort((a, b) => a - b);
  const count = daysSorted.length;

  return {
    count,
    negativeCount,
    avg: count ? daysSorted.reduce((sum, d) => sum + d, 0) / count : null,
    min: count ? daysSorted[0] : null,
    max: count ? daysSorted[count - 1] : null,
    median: median(daysSorted),
    items,
  };
}

module.exports = {
  listRows,
  getRow,
  findRowsByRequestNo,
  findRowsByPurchaseRequestNo,
  getDistinctValues,
  getDashboardStats,
  isRowComplete,
  createRow,
  listDraftRowsForUser,
  finalizeDraftRows,
  discardDraftRow,
  updateSection,
  getRowHistory,
  getFieldHistory,
  searchLogs,
  softDeleteRow,
  restoreRow,
  listDeletedRows,
  cancelRow,
  uncancelRow,
  returnToTechOffice,
  unreturnFromTechOffice,
  getDurationReport,
  ALL_FIELDS,
  FIELD_BY_NAME,
};
