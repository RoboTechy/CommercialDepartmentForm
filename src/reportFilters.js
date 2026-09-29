const { allFields } = require('./sections');

// فیلترهای فهرست اصلی (وضعیت/بازه‌ی تاریخ/جست‌وجوی متنی هر فیلد) از روی
// query string - هم فهرست اصلی (src/routes/rows.js)، هم API گزارش‌گیری
// (src/routes/reportApi.js) از همین یک تابع استفاده می‌کنند تا فیلترها
// همیشه دقیقاً یکسان رفتار کنند
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

function escapeCsv(val) {
  const str = (val ?? '').toString();
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function rowStatusLabel(row) {
  return row.cancelled_at ? 'لغو شده' : row.returned_at ? 'عودت به درخواست‌کننده' : 'جاری';
}

module.exports = { buildFiltersFromQuery, escapeCsv, rowStatusLabel };
