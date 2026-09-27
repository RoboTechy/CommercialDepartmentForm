import { DbRow, AuditLogEntry, UserSession, RequesterDept } from '../types';
import { sections, findSection, allFields, requesterDepartments, isPaymentAuthWaived, FieldDef } from '../data/exactSections';
import { nowJalaliDateTime, daysBetweenJalali, daysSinceJalali } from '../utils/exactJalaali';

const OVERDUE_DAYS = 3;

export function resolveRequesterDept(user: UserSession | null | undefined): RequesterDept | '' {
  if (!user) return '';
  const match = requesterDepartments.find((d) => user.groups.includes(d.group));
  return match ? match.label : '';
}

const ALL_FIELDS = allFields();
const FIELD_BY_NAME = new Map(ALL_FIELDS.map((f) => [f.name, f]));

export const DEPARTMENTS = (() => {
  const byColor = new Map<string, { color: string; title: string; fields: FieldDef[] }>();
  for (const section of sections) {
    if (!byColor.has(section.color)) {
      byColor.set(section.color, { color: section.color, title: section.title, fields: [] });
    }
    byColor.get(section.color)!.fields.push(...section.fields);
  }
  return [...byColor.values()];
})();

export function isFieldSetComplete(row: DbRow, fields: FieldDef[]): boolean {
  return fields.every((f) => (row[f.name] || '').toString().trim() !== '');
}

export function fieldsForCompletion(row: DbRow, fields: FieldDef[]): FieldDef[] {
  if (!isPaymentAuthWaived(row)) return fields;
  return fields.filter((f) => f.name !== 'payment_auth_issued_date');
}

const NON_READONLY_FIELDS = ALL_FIELDS.filter((f) => !f.readOnly);

export function isRowComplete(row: DbRow): boolean {
  return isFieldSetComplete(row, fieldsForCompletion(row, NON_READONLY_FIELDS));
}

export function currentBlockingSection(row: DbRow) {
  for (const section of sections) {
    const fields = fieldsForCompletion(row, section.fields.filter((f) => !f.readOnly));
    if (!fields.every((f) => (row[f.name] || '').toString().trim() !== '')) {
      return section;
    }
  }
  return null;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeForDuplicateCheck(value: string | undefined | null): string {
  let s = (value || '').toString();
  s = s.replace(/[​‌‍‎‏﻿]/g, '');
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
  s = s.replace(/[‐‑‒–—−ـ]/g, '-');
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}

export function median(sortedNumbers: number[]): number | null {
  const n = sortedNumbers.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedNumbers[mid] : (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2;
}

export function computeDurationStats(rows: DbRow[], getStart: (r: DbRow) => string, getEnd: (r: DbRow) => string) {
  const items: { row: DbRow; days: number }[] = [];
  for (const row of rows) {
    const startVal = getStart(row);
    const endVal = getEnd(row);
    if (!startVal || !endVal) continue;
    const days = daysBetweenJalali(startVal, endVal);
    if (days === null || days < 0) continue;
    items.push({ row, days });
  }
  items.sort((a, b) => b.days - a.days);
  const sortedDays = items.map((i) => i.days).sort((a, b) => a - b);
  const count = sortedDays.length;
  return {
    count,
    avg: count ? sortedDays.reduce((sum, d) => sum + d, 0) / count : null,
    median: median(sortedDays),
    min: count ? sortedDays[0] : null,
    max: count ? sortedDays[count - 1] : null,
    slowest: items.slice(0, 10),
  };
}
