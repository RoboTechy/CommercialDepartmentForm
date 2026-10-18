import { DbRow, RequesterDept } from '../types';
import { GROUPS } from '../config';

export interface FieldDef {
  name: keyof DbRow;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'jalali-date';
  required?: boolean;
  hint?: string;
  options?: string[];
  readOnly?: boolean;
  sectionKey?: string;
}

export interface SectionDef {
  key: string;
  title: string;
  color: 'tech_operator' | 'warehouse' | 'commercial';
  group: string | string[];
  canCreateRows: boolean;
  fields: FieldDef[];
}

export const requesterDepartments: { label: RequesterDept; group: string }[] = [
  { label: 'دفتر فنی', group: GROUPS.techOperator },
  { label: 'عمران', group: GROUPS.civil },
  { label: 'آی‌تی', group: GROUPS.it },
];

export const sections: SectionDef[] = [
  {
    key: 'tech_operator',
    title: 'درخواست‌کننده',
    color: 'tech_operator',
    group: requesterDepartments.map((d) => d.group),
    canCreateRows: true,
    fields: [
      { name: 'request_no', label: 'شماره درخواست کالا', type: 'text', required: true },
      { name: 'item_description', label: 'شرح کالا', type: 'textarea', required: true },
      { name: 'priority', label: 'اولویت', type: 'select', options: ['A++', 'A+', 'A', 'B', 'C', 'D'], required: true },
      { name: 'total_qty', label: 'تعداد کل', type: 'text', required: true },
      { name: 'unit', label: 'واحد', type: 'text', hint: 'مثلاً: عدد، کیلوگرم، لیتر، متر، بسته', required: true },
      { name: 'usage_location', label: 'محل مصرف', type: 'text', required: true },
      { name: 'delivery_to_warehouse_date', label: 'تاریخ تحویل درخواست به انبار', type: 'jalali-date', required: true },
      { name: 'item_type', label: 'نوع کالا', type: 'select', options: ['استاندارد', 'ساخت'], required: true },
      {
        name: 'requester_dept',
        label: 'دپارتمان درخواست‌کننده',
        type: 'select',
        options: requesterDepartments.map((d) => d.label),
        readOnly: true,
      },
    ],
  },
  {
    key: 'warehouse_1',
    title: 'انبار کارفرما',
    color: 'warehouse',
    group: GROUPS.warehouse,
    canCreateRows: false,
    fields: [
      { name: 'purchase_request_no', label: 'شماره درخواست خرید', type: 'text' },
      { name: 'delivered_to_tech_expert_date', label: 'تاریخ تحویل به کارشناس فنی', type: 'jalali-date' },
      { name: 'delivered_to_employer_date', label: 'تاریخ تحویل به کارفرما', type: 'jalali-date' },
    ],
  },
  {
    key: 'commercial',
    title: 'بازرگانی غدیر',
    color: 'commercial',
    group: GROUPS.commercial,
    canCreateRows: false,
    fields: [
      { name: 'referred_to_commercial_date', label: 'تاریخ ارجاع به بازرگانی', type: 'jalali-date' },
      { name: 'purchase_executor', label: 'مجری خرید', type: 'select', options: ['سایت', 'تهران', 'برنا'] },
      { name: 'payment_auth_issued_date', label: 'تاریخ صدور مجوز پرداخت', type: 'jalali-date' },
    ],
  },
  {
    key: 'warehouse_2',
    title: 'انبار کارفرما',
    color: 'warehouse',
    group: GROUPS.warehouse,
    canCreateRows: false,
    fields: [
      { name: 'letter_no', label: 'شماره نامه', type: 'text' },
      { name: 'dispatch_date', label: 'تاریخ ارسال', type: 'jalali-date' },
      { name: 'factory_arrival_date', label: 'تاریخ ورود به کارخانه', type: 'jalali-date' },
    ],
  },
];

export const EXTERNAL_PURCHASE_EXECUTORS = ['تهران', 'برنا'];

export function isPaymentAuthWaived(row: DbRow): boolean {
  return EXTERNAL_PURCHASE_EXECUTORS.includes(row.purchase_executor);
}

export function findSection(key: string): SectionDef | undefined {
  return sections.find((s) => s.key === key);
}

export function findField(fieldKey: string): { section: SectionDef; field: FieldDef } | null {
  for (const section of sections) {
    const field = section.fields.find((f) => f.name === fieldKey);
    if (field) return { section, field };
  }
  return null;
}

export function allFields(): FieldDef[] {
  return sections.flatMap((s) => s.fields.map((f) => ({ ...f, sectionKey: s.key })));
}
