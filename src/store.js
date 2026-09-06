const db = require('./db');
const { sections, findSection, allFields } = require('./sections');
const { nowJalaliDateTime } = require('./jalaali');

const ALL_FIELDS = allFields();
const FIELD_BY_NAME = new Map(ALL_FIELDS.map((f) => [f.name, f]));

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
        params[`${field.name}_from`] = from;
      }
      if (to) {
        clauses.push(`${field.name} <= @${field.name}_to`);
        params[`${field.name}_to`] = to;
      }
    } else if (value) {
      if (field.type === 'select') {
        clauses.push(`${field.name} = @${field.name}`);
        params[field.name] = value;
      } else {
        clauses.push(`${field.name} LIKE @${field.name}`);
        params[field.name] = `%${value}%`;
      }
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM rows ${where} ORDER BY id DESC`).all(params);
}

function getRow(id) {
  return db.prepare('SELECT * FROM rows WHERE id = ?').get(id);
}

function insertAuditEntries(rowId, sectionKey, entries, user) {
  if (!entries.length) return;
  const changedAt = nowJalaliDateTime();
  const insert = db.prepare(`
    INSERT INTO audit_log (row_id, section_key, field_key, field_label, old_value, new_value, changed_by_username, changed_by_display, changed_at)
    VALUES (@rowId, @sectionKey, @fieldKey, @fieldLabel, @oldValue, @newValue, @username, @display, @changedAt)
  `);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(
    entries.map((e) => ({
      rowId,
      sectionKey,
      fieldKey: e.fieldKey,
      fieldLabel: e.fieldLabel,
      oldValue: e.oldValue,
      newValue: e.newValue,
      username: user.username,
      display: user.displayName || user.username,
      changedAt,
    }))
  );
}

function createRow(values, user) {
  const section = findSection('tech_operator');
  const columns = ['created_by_username', 'created_by_display', 'created_at'];
  const params = {
    created_by_username: user.username,
    created_by_display: user.displayName || user.username,
    created_at: nowJalaliDateTime(),
  };

  const auditEntries = [];
  for (const field of section.fields) {
    const value = (values[field.name] || '').toString().trim();
    columns.push(field.name);
    params[field.name] = value;
    if (value) {
      auditEntries.push({ fieldKey: field.name, fieldLabel: field.label, oldValue: '', newValue: value });
    }
  }

  const placeholders = columns.map((c) => `@${c}`).join(', ');
  const result = db
    .prepare(`INSERT INTO rows (${columns.join(', ')}) VALUES (${placeholders})`)
    .run(params);

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
  const params = { id: rowId };

  for (const field of section.fields) {
    const newValue = (values[field.name] || '').toString().trim();
    const oldValue = current[field.name] || '';
    setClauses.push(`${field.name} = @${field.name}`);
    params[field.name] = newValue;
    if (newValue !== oldValue) {
      auditEntries.push({ fieldKey: field.name, fieldLabel: field.label, oldValue, newValue });
    }
  }

  db.prepare(`UPDATE rows SET ${setClauses.join(', ')} WHERE id = @id`).run(params);
  insertAuditEntries(rowId, sectionKey, auditEntries, user);
  return getRow(rowId);
}

function getRowHistory(rowId) {
  return db.prepare('SELECT * FROM audit_log WHERE row_id = ? ORDER BY id DESC').all(rowId);
}

function searchLogs(filters = {}) {
  const clauses = [];
  const params = {};

  if (filters.user) {
    clauses.push('(changed_by_display LIKE @user OR changed_by_username LIKE @user)');
    params.user = `%${filters.user}%`;
  }
  if (filters.fieldKey) {
    clauses.push('field_key = @fieldKey');
    params.fieldKey = filters.fieldKey;
  }
  if (filters.rowId) {
    clauses.push('row_id = @rowId');
    params.rowId = filters.rowId;
  }
  if (filters.from) {
    clauses.push('changed_at >= @from');
    params.from = filters.from;
  }
  if (filters.to) {
    // یک روز کامل تا انتهای تاریخ «تا» را نیز شامل شود
    clauses.push('changed_at <= @to');
    params.to = `${filters.to} 99:99:99`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT 1000`).all(params);
}

module.exports = {
  listRows,
  getRow,
  createRow,
  updateSection,
  getRowHistory,
  searchLogs,
  ALL_FIELDS,
  FIELD_BY_NAME,
};
