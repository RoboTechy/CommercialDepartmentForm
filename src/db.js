const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('./config');
const { allFields } = require('./sections');

// از sql.js (پیاده‌سازی خالص WebAssembly) به‌جای ماژول‌های native دیتابیس استفاده می‌شود
// تا صرف‌نظر از معماری CPU یا حالت شبیه‌سازی داکر، همیشه یکسان اجرا شود.

let sqlDb = null;

// نوشتن کامل فایل دیتابیس روی دیسک هزینه دارد (کل حافظه export و روی
// دیسک نوشته می‌شود، نه فقط تغییر) - با رشد تعداد ردیف‌ها، انجامش بعد از
// هر تک تغییر (حتی یک فیلد) می‌تواند هر بار سرور را برای لحظه‌ای برای
// همه کند کند. به‌جای آن، چند تغییری که نزدیک به هم اتفاق می‌افتند در یک
// پنجره‌ی کوتاه (PERSIST_DEBOUNCE_MS) جمع و یک‌جا نوشته می‌شوند.
//
// نکته‌ی مهم درباره‌ی ایمنی داده: این فقط زمان *نوشتن روی دیسک* را عقب
// می‌اندازد - تغییر همان لحظه در حافظه (sqlDb) اعمال می‌شود، پس همه‌ی
// خواندن‌های بعدی همان لحظه (حتی قبل از نوشتن روی دیسک) مقدار درست و
// به‌روز را می‌بینند؛ تنها ریسک این است که اگر سرور دقیقاً در همین کسری
// از ثانیه (کمتر از PERSIST_DEBOUNCE_MS) کرش کند یا برق قطع شود، آخرین
// تغییرات ثبت‌نشده روی دیسک از دست بروند. برای پوشش رایج‌ترین حالت (توقف
// عادی سرور هنگام deploy/ری‌استارت با docker) پایین همین فایل، پیش از
// خروج، هر نوشتن معلق فوراً و به‌طور کامل روی دیسک نوشته می‌شود.
const PERSIST_DEBOUNCE_MS = 300;
let persistTimer = null;
let dirty = false;

// نوشتن فوری و همزمان (synchronous) - برای مهاجرت اولیه‌ی راه‌اندازی و
// برای flush قبل از خروج سرور استفاده می‌شود، جایی که تاخیر قابل‌قبول نیست
function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const data = sqlDb.export();
  fs.writeFileSync(config.dbFile, Buffer.from(data));
  dirty = false;
}

// نوشتن دسته‌ای: تغییر را «کثیف» علامت می‌زند و اگر نوشتنی از قبل
// زمان‌بندی نشده، یکی برای PERSIST_DEBOUNCE_MS بعد زمان‌بندی می‌کند
function persist() {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
}

// قبل از خروج عادی سرور (مثلاً docker compose down/restart که SIGTERM
// می‌فرستد) هر نوشتن معلقی که هنوز روی دیسک نرفته را فوراً کامل می‌نویسد
// تا با ری‌استارت/دیپلوی هیچ تغییری گم نشود
function shutdown() {
  if (dirty && sqlDb) persistNow();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

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

  // مهاجرت خودکار: اگر در آینده فیلد جدیدی به sections.js اضافه شود، جدول
  // rows که از قبل با داده‌ی واقعی وجود دارد را نمی‌شکند - فقط ستون جدید را
  // با ALTER TABLE اضافه می‌کند (بدون لمس ردیف‌های موجود)
  const existingColumns = new Set(
    all('PRAGMA table_info(rows)').map((col) => col.name)
  );
  for (const field of allFields()) {
    if (!existingColumns.has(field.name)) {
      sqlDb.run(`ALTER TABLE rows ADD COLUMN ${field.name} TEXT NOT NULL DEFAULT ''`);
      // دپارتمان درخواست‌کننده: ردیف‌های از قبل موجود (قبل از این قابلیت) همه
      // متعلق به همان گروه قدیمی «دفتر فنی» بوده‌اند - اگر این یک‌بار پر نشود،
      // با فعال شدن محدودیت «فقط دپارتمان خودش قابل ویرایش است» قفل می‌مانند
      if (field.name === 'requester_dept') {
        sqlDb.run(`UPDATE rows SET requester_dept = 'دفتر فنی' WHERE requester_dept = ''`);
      }
    }
  }

  // برچسب اولیه‌ی این دپارتمان قبلاً «بهره‌بردار» بود و به «دفتر فنی» تغییر کرد؛
  // اگر نسخه‌ی قبلی قبلاً روی این دیتابیس اجرا و ردیف‌هایی با برچسب قدیمی
  // ساخته/مهاجرت شده باشند، اینجا (بی‌ضرر و در هر اجرا) به برچسب جدید اصلاح می‌شوند
  if (existingColumns.has('requester_dept')) {
    sqlDb.run(`UPDATE rows SET requester_dept = 'دفتر فنی' WHERE requester_dept = 'بهره‌بردار'`);
  }

  // ستون‌های حذف نرم (soft delete) - ردیف واقعاً از دیتابیس پاک نمی‌شود، فقط
  // پنهان و قابل بازیابی می‌شود
  for (const col of ['deleted_at', 'deleted_by_username', 'deleted_by_display']) {
    if (!existingColumns.has(col)) {
      sqlDb.run(`ALTER TABLE rows ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }

  // ستون‌های لغو درخواست - ردیف حذف نمی‌شود، در فهرست می‌ماند ولی رنگش تغییر
  // می‌کند و بخش‌ها دیگر قابل ویرایش نیستند
  for (const col of ['cancelled_at', 'cancelled_by_username', 'cancelled_by_display', 'cancel_reason']) {
    if (!existingColumns.has(col)) {
      sqlDb.run(`ALTER TABLE rows ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }

  // ستون‌های عودت به درخواست‌کننده - انبار می‌تواند یک درخواست را به این وضعیت
  // برگرداند؛ فقط بخش درخواست‌کننده قابل ویرایش می‌ماند
  for (const col of ['returned_at', 'returned_by_username', 'returned_by_display', 'return_reason']) {
    if (!existingColumns.has(col)) {
      sqlDb.run(`ALTER TABLE rows ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }

  // ستون ثبت نهایی (published_at) - درخواست‌کننده می‌تواند چند ردیف را پشت‌سرهم
  // به‌صورت پیش‌نویس بسازد (published_at خالی) و همه را با هم «ثبت نهایی»
  // کند تا وارد فهرست اصلی شوند. ردیف‌های از قبل موجود (قبل از این قابلیت)
  // همین یک‌بار با تاریخ ایجادشان پر می‌شوند تا هرگز از فهرست ناپدید نشوند.
  if (!existingColumns.has('published_at')) {
    sqlDb.run(`ALTER TABLE rows ADD COLUMN published_at TEXT NOT NULL DEFAULT ''`);
    sqlDb.run(`UPDATE rows SET published_at = created_at WHERE published_at = ''`);
  }

  // مهاجرت اولیه‌ی راه‌اندازی - برخلاف بقیه‌ی نوشتن‌ها، فوری و همزمان
  // ذخیره می‌شود (نه دسته‌ای) چون تاخیرش قابل‌قبول نیست
  persistNow();
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

// اجرای یک دستور نوشتن مستقل (خارج از تراکنش) و زمان‌بندی ذخیره‌ی دیتابیس
// روی دیسک (دسته‌ای - به توضیح بالای PERSIST_DEBOUNCE_MS مراجعه کنید)
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
