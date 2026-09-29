const ExcelJS = require('exceljs');
const { findSection, findField } = require('./sections');
const { normalizeJalaliDate } = require('./jalaali');

// حداکثر تعداد ردیف داده در هر فایل ایمپورت - جلوگیری از فایل‌های خیلی
// بزرگ که پردازش سرور تک‌نخی را برای مدت طولانی مشغول کنند
const MAX_IMPORT_ROWS = 500;

// فیلدهایی که با فایل اکسل پر می‌شوند - دقیقاً همان فیلدهای بخش
// «درخواست‌کننده»، به‌جز فیلدهای فقط‌خواندنی (دپارتمان درخواست‌کننده که
// همیشه خودکار از عضویت گروهی کاربر تعیین می‌شود، نه از فایل)
function importFields() {
  return findSection('tech_operator').fields.filter((f) => !f.readOnly);
}

// اعتبارسنجی مقادیر خام یک ردیف (چه از فرم تکی، چه از یک سطر اکسل) طبق
// همان قواعدی که فرم تک‌ردیفی همیشه اعمال می‌کرده (الزامی‌بودن، فرمت
// تاریخ شمسی) + یک قاعده‌ی جدید که فرم وب هیچ‌وقت لازم نداشت چون <select>
// خودش مقدار را محدود می‌کرد ولی فایل اکسل هر متنی می‌تواند داشته باشد:
// عضویت مقدار در گزینه‌های مجاز فیلدهای select
function validateRowValues(rawValues, alreadyFlaggedFields) {
  const fields = importFields();
  const values = {};
  const errors = [];
  // فیلدهایی که همین‌جا (یا پیش از فراخوانی، مثلاً خطای «تاریخ اکسل» در
  // parseImportFile) برایشان پیام اختصاصی داده شد - دیگر لازم نیست دوباره
  // در پیام «تکمیل این فیلدها الزامی است» هم به‌عنوان «خالی» تکرار شوند،
  // چون پیام اختصاصی خودش کافی و دقیق‌تر است
  const fieldsWithOwnError = new Set(alreadyFlaggedFields || []);
  for (const field of fields) {
    const raw = rawValues[field.name];
    let value = (raw === null || raw === undefined ? '' : raw).toString().trim();
    if (field.type === 'jalali-date' && value) {
      const normalized = normalizeJalaliDate(value);
      if (normalized === null) {
        errors.push(`«${field.label}» یک تاریخ شمسی معتبر نیست (فرمت درست: 1403/05/12)`);
        fieldsWithOwnError.add(field.name);
        value = '';
      } else {
        value = normalized;
      }
    }
    if (field.type === 'select' && value && !field.options.includes(value)) {
      errors.push(`«${field.label}» باید یکی از این مقادیر باشد: ${field.options.join('، ')}`);
      fieldsWithOwnError.add(field.name);
    }
    values[field.name] = value;
  }
  const missingLabels = fields
    .filter((f) => f.required && !values[f.name] && !fieldsWithOwnError.has(f.name))
    .map((f) => f.label);
  if (missingLabels.length) {
    errors.push(`تکمیل این فیلدها الزامی است: ${missingLabels.join('، ')}`);
  }
  return { values, errors };
}

// یک سلول اکسل می‌تواند رشته، عدد، تاریخ، متن غنی، هایپرلینک یا فرمول
// باشد؛ همه را به متن ساده تبدیل می‌کند. اگر مقدار واقعاً یک شیء Date
// اکسل باشد (یعنی کاربر به‌جای متن شمسی، تاریخ اکسل وارد کرده) به‌جای متن
// نشانه‌ی DATE_MISTAKE برمی‌گرداند تا پیام خطای مشخصی نشان داده شود
const DATE_MISTAKE = Symbol('date-mistake');
function extractCellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return DATE_MISTAKE;
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((p) => p.text).join('');
    if (typeof value.text === 'string') return value.text;
    if (value.result !== undefined) return extractCellText(value.result);
    return '';
  }
  return String(value);
}

// ساخت فایل قالب اکسل قابل‌دانلود - ستون‌ها دقیقاً با نام فیلدهای همین
// بخش، به‌همراه یک ردیف نمونه (برای نشان‌دادن فرمت) و یک برگه‌ی راهنما
async function buildTemplateWorkbook() {
  const fields = importFields();
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('درخواست کالا');
  sheet.columns = fields.map((f) => ({ header: f.label, key: f.name, width: Math.max(f.label.length + 6, 18) }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: 'center' };

  const sampleValues = {
    request_no: 'PR-1404-001',
    item_description: 'نمونه: پیچ و مهره M12 (این ردیف را حذف یا با اطلاعات واقعی جایگزین کنید)',
    priority: 'A',
    total_qty: '100',
    unit: 'عدد',
    usage_location: 'واحد نمونه',
    delivery_to_warehouse_date: '1404/07/01',
    item_type: 'استاندارد',
  };
  const sampleRow = sheet.addRow(sampleValues);
  sampleRow.font = { italic: true, color: { argb: 'FF9A9A9A' } };

  const helpSheet = workbook.addWorksheet('راهنما');
  helpSheet.columns = [{ width: 100 }];
  helpSheet.views = [{ rightToLeft: true }];
  const priorityField = findField('priority').field;
  const itemTypeField = findField('item_type').field;
  const lines = [
    'راهنمای تکمیل این فایل برای ثبت گروهی درخواست کالا:',
    '',
    '- ردیف نمونه (ردیف دوم برگه‌ی «درخواست کالا») را حذف کنید یا با اطلاعات واقعی جایگزین کنید.',
    '- برای هر ردیف، تمام ستون‌ها الزامی هستند.',
    '- ستون «' + findSection('tech_operator').fields.find((f) => f.name === 'delivery_to_warehouse_date').label +
      '» باید متن تاریخ شمسی به‌شکل 1403/05/12 باشد؛ اگر اکسل آن را به‌صورت تاریخ اکسل فرمت کند (میلادی) پذیرفته نمی‌شود - فرمت سلول را روی «متن/Text» بگذارید.',
    '- مقادیر مجاز ستون «' + priorityField.label + '»: ' + priorityField.options.join('، '),
    '- مقادیر مجاز ستون «' + itemTypeField.label + '»: ' + itemTypeField.options.join('، '),
    '- دپارتمان درخواست‌کننده در این فایل وجود ندارد؛ خودکار از عضویت گروهی کاربری که فایل را آپلود می‌کند تعیین می‌شود.',
    '- هر ردیف از این فایل، دقیقاً یک درخواست کالای جدید ایجاد می‌کند.',
    '- بعد از آپلود، ابتدا همه‌ی ردیف‌ها بررسی می‌شوند و اگر مشکلی باشد با ذکر شماره‌ی ردیف اکسل نشان داده می‌شود.',
  ];
  lines.forEach((line) => helpSheet.addRow([line]));

  return workbook;
}

// پارس و اعتبارسنجی یک فایل اکسل آپلودی. خروجی:
//   headerError: اگر مشکلی در سطح کل فایل باشد (ستون گمشده/فایل خیلی
//     بزرگ/بدون برگه) که ادامه‌ی پردازش را بی‌معنی می‌کند
//   validRows: [{ excelRow, values }] - ردیف‌های سالم، آماده برای ثبت
//   invalidRows: [{ excelRow, errors }] - ردیف‌های دارای مشکل
async function parseImportFile(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { headerError: 'فایل اکسل هیچ برگه‌ای ندارد.', validRows: [], invalidRows: [] };
  }

  const fields = importFields();
  const headerRow = sheet.getRow(1);
  const colByLabel = new Map();
  headerRow.eachCell((cell, colNumber) => {
    const label = extractCellText(cell.value);
    if (typeof label === 'string' && label.trim()) colByLabel.set(label.trim(), colNumber);
  });

  const missingColumns = fields.filter((f) => !colByLabel.has(f.label)).map((f) => f.label);
  if (missingColumns.length) {
    return {
      headerError: `این ستون‌ها در فایل پیدا نشدند: ${missingColumns.join('، ')}. لطفاً از «دانلود قالب اکسل» استفاده کنید و نام ستون‌ها را تغییر ندهید.`,
      validRows: [],
      invalidRows: [],
    };
  }

  const validRows = [];
  const invalidRows = [];
  let dataRowCount = 0;
  const lastRow = sheet.lastRow ? sheet.lastRow.number : 1;

  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const rawValues = {};
    const extraErrors = [];
    const dateMistakeFields = [];
    let hasAnyValue = false;

    for (const field of fields) {
      const col = colByLabel.get(field.label);
      const raw = extractCellText(row.getCell(col).value);
      if (raw === DATE_MISTAKE) {
        extraErrors.push(`«${field.label}» به‌صورت تاریخ اکسل وارد شده؛ فرمت سلول را به متن (Text) تغییر دهید و دقیقاً مثل 1403/05/12 بنویسید`);
        dateMistakeFields.push(field.name);
        rawValues[field.name] = '';
        hasAnyValue = true;
        continue;
      }
      const str = raw.trim();
      if (str) hasAnyValue = true;
      rawValues[field.name] = str;
    }

    if (!hasAnyValue) continue; // ردیف کاملاً خالی - نادیده گرفته می‌شود

    dataRowCount++;
    if (dataRowCount > MAX_IMPORT_ROWS) {
      return {
        headerError: `این فایل بیش از ${MAX_IMPORT_ROWS} ردیف داده دارد؛ لطفاً فایل را به چند بخش کوچک‌تر تقسیم کنید.`,
        validRows: [],
        invalidRows: [],
      };
    }

    const { values, errors } = validateRowValues(rawValues, dateMistakeFields);
    const allErrors = extraErrors.concat(errors);
    if (allErrors.length) {
      invalidRows.push({ excelRow: r, errors: allErrors });
    } else {
      validRows.push({ excelRow: r, values });
    }
  }

  return { headerError: null, validRows, invalidRows };
}

module.exports = {
  MAX_IMPORT_ROWS,
  importFields,
  validateRowValues,
  buildTemplateWorkbook,
  parseImportFile,
};
