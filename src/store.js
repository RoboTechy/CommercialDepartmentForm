const db = require('./db');
const { sections, findSection, allFields } = require('./sections');
const { nowJalaliDateTime, daysBetweenJalali } = require('./jalaali');

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

  clauses.push(`deleted_at = ''`);
  const where = `WHERE ${clauses.join(' AND ')}`;
  return db.all(`SELECT * FROM rows ${where} ORDER BY id DESC`, params);
}

function getRow(id) {
  return db.get('SELECT * FROM rows WHERE id = @id', { '@id': id });
}

// مقادیر یکتا و غیرخالی یک ستون، برای پیشنهاد خودکار (autocomplete) در فیلتر جستجو
function getDistinctValues(fieldName) {
  if (!FIELD_BY_NAME.has(fieldName)) return [];
  return db
    .all(`SELECT DISTINCT ${fieldName} AS value FROM rows WHERE ${fieldName} IS NOT NULL AND ${fieldName} != '' AND deleted_at = '' ORDER BY ${fieldName}`)
    .map((row) => row.value);
}

// آمار کلی برای نمای بالای صفحه‌ی اصلی: تعداد کل، تکمیل/در انتظار به تفکیک
// دپارتمان، و میانگین مدت‌زمان تکمیل کامل یک ردیف (از ایجاد تا آخرین تغییر)
function getDashboardStats() {
  const allRows = db.all(`SELECT * FROM rows WHERE deleted_at = ''`);
  // ردیف‌های لغوشده دیگر قرار نیست تکمیل شوند، پس از آمار «تکمیل/در انتظار» و
  // میانگین زمان تکمیل کنار گذاشته می‌شوند تا آمار واقعی را خراب نکنند
  const activeRows = allRows.filter((row) => !row.cancelled_at);
  const lastChangeRows = db.all('SELECT row_id, MAX(changed_at) AS last_changed FROM audit_log GROUP BY row_id');
  const lastChangeByRow = new Map(lastChangeRows.map((r) => [r.row_id, r.last_changed]));

  const departments = DEPARTMENTS.map((dept) => {
    const completed = activeRows.filter((row) => isFieldSetComplete(row, dept.fields)).length;
    return { color: dept.color, title: dept.title, completed, pending: activeRows.length - completed };
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
    cancelledCount: allRows.length - activeRows.length,
    fullyCompleted,
    departments,
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
    const value = (values[field.name] || '').toString().trim();
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
    const newValue = (values[field.name] || '').toString().trim();
    const oldValue = current[field.name] || '';
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
// پرداخت»)، با چند فیلتر اختیاری. ردیف‌های حذف‌شده یا لغوشده حساب نمی‌شوند
// چون هیچ‌وقت این فرایند رویشان کامل نمی‌شود.
function getDurationReport({ startField, endField, purchaseExecutor, createdFrom, createdTo }) {
  const startDef = FIELD_BY_NAME.get(startField);
  const endDef = FIELD_BY_NAME.get(endField);
  if (!startDef || !endDef || startDef.type !== 'jalali-date' || endDef.type !== 'jalali-date') {
    return null;
  }

  const clauses = [`deleted_at = ''`, `cancelled_at = ''`, `${startField} != ''`, `${endField} != ''`];
  const params = {};
  if (purchaseExecutor) {
    clauses.push('purchase_executor = @purchaseExecutor');
    params['@purchaseExecutor'] = purchaseExecutor;
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
  getDistinctValues,
  getDashboardStats,
  isRowComplete,
  createRow,
  updateSection,
  getRowHistory,
  searchLogs,
  softDeleteRow,
  restoreRow,
  listDeletedRows,
  cancelRow,
  uncancelRow,
  getDurationReport,
  ALL_FIELDS,
  FIELD_BY_NAME,
};
