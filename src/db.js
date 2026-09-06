const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('./config');
const { allFields } = require('./sections');

// از sql.js (پیاده‌سازی خالص WebAssembly) به‌جای ماژول‌های native دیتابیس استفاده می‌شود
// تا صرف‌نظر از معماری CPU یا حالت شبیه‌سازی داکر، همیشه یکسان اجرا شود.

let sqlDb = null;

function persist() {
  const data = sqlDb.export();
  fs.writeFileSync(config.dbFile, Buffer.from(data));
}

const ready = (async () => {
  const dir = path.dirname(config.dbFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(config.dbFile)) {
    sqlDb = new SQL.Database(fs.readFileSync(config.dbFile));
  } else {
    sqlDb = new SQL.Database();
  }

  const fieldColumns = allFields()
    .map((f) => `  ${f.name} TEXT NOT NULL DEFAULT ''`)
    .join(',\n');

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by_username TEXT NOT NULL,
      created_by_display TEXT NOT NULL,
      created_at TEXT NOT NULL,
${fieldColumns}
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      row_id INTEGER NOT NULL,
      section_key TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_label TEXT NOT NULL,
      old_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT '',
      changed_by_username TEXT NOT NULL,
      changed_by_display TEXT NOT NULL,
      changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_row_id ON audit_log(row_id);
    CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_log(changed_by_username);
    CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);
  `);

  persist();
})();

function all(sql, params = {}) {
  const stmt = sqlDb.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = {}) {
  return all(sql, params)[0];
}

// اجرای یک دستور نوشتن بدون ذخیره‌ی فوری - export() وسط یک تراکنش باز آن را
// به‌طور ناخواسته می‌بندد، پس این تابع فقط داخل transaction() یا قبل از
// persist دستی استفاده می‌شود
function runRaw(sql, params = {}) {
  sqlDb.run(sql, params);
  const lastInsertRowid = sqlDb.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  return { lastInsertRowid };
}

// اجرای یک دستور نوشتن مستقل (خارج از تراکنش) و ذخیره‌ی فوری دیتابیس روی دیسک
function run(sql, params = {}) {
  const result = runRaw(sql, params);
  persist();
  return result;
}

// چند دستور نوشتن را در یک تراکنش اجرا و فقط یک‌بار در پایان ذخیره می‌کند
function transaction(fn) {
  return (...args) => {
    sqlDb.run('BEGIN');
    try {
      const result = fn(...args);
      sqlDb.run('COMMIT');
      persist();
      return result;
    } catch (err) {
      sqlDb.run('ROLLBACK');
      throw err;
    }
  };
}

module.exports = { ready, all, get, run, runRaw, transaction };
