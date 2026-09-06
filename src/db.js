const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');
const { allFields } = require('./sections');

const dir = path.dirname(config.dbFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');

const fieldColumns = allFields()
  .map((f) => `  ${f.name} TEXT NOT NULL DEFAULT ''`)
  .join(',\n');

db.exec(`
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

module.exports = db;
