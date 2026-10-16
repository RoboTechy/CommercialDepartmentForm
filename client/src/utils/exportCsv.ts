import { DbRow } from '../types';
import { allFields } from '../data/exactSections';

function cell(v: unknown): string {
  const s = (v ?? '').toString();
  // جلوگیری از اجرای فرمول در اکسل (CSV injection)
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function statusLabel(r: DbRow): string {
  if (r.cancelled_at) return 'لغو شده';
  if (r.returned_at) return 'عودت به درخواست‌کننده';
  return 'جاری';
}

// خروجی CSV همان ردیف‌های فیلترشده (با BOM تا اکسل فارسی را درست باز کند)
export function exportRowsCsv(rows: DbRow[], filename = 'prt-rows.csv') {
  const fields = allFields();
  const header = ['ردیف', 'وضعیت', 'ثبت‌کننده', 'تاریخ ایجاد', ...fields.map((f) => f.label)];
  const lines = [header.map(cell).join(',')];
  for (const r of rows) {
    lines.push([r.id, statusLabel(r), r.created_by_display, r.created_at, ...fields.map((f) => r[f.name])].map(cell).join(','));
  }
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
