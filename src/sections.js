const config = require('./config');

// تعریف بخش‌ها و ستون‌های هر بخش روی ردیف مشترک.
// فقط دفتر فنی بهره‌بردار اجازه‌ی ایجاد ردیف جدید دارد (canCreateRows).
// هر بخش فقط می‌تواند فیلدهای خودش را روی یک ردیف (که قبلاً ایجاد شده) تکمیل/ویرایش کند.
const sections = [
  {
    key: 'tech_operator',
    title: 'دفتر فنی بهره‌بردار',
    group: config.ldap.groups.techOperator,
    canCreateRows: true,
    fields: [
      { name: 'request_no', label: 'شماره درخواست کالا', type: 'text', required: true },
      { name: 'item_description', label: 'شرح کالا', type: 'textarea', required: true },
      { name: 'priority', label: 'اولویت', type: 'select', options: ['A++', 'A+', 'A', 'B', 'C', 'D'] },
      { name: 'total_qty', label: 'تعداد کل', type: 'text' },
      { name: 'unit', label: 'واحد', type: 'text' },
      { name: 'usage_location', label: 'محل مصرف', type: 'text' },
      { name: 'delivery_to_warehouse_date', label: 'تاریخ تحویل درخواست به انبار', type: 'jalali-date' },
      { name: 'item_type', label: 'نوع کالا', type: 'select', options: ['استاندارد', 'ساخت'] },
    ],
  },
  {
    key: 'warehouse',
    title: 'انبار کارفرما',
    group: config.ldap.groups.warehouse,
    canCreateRows: false,
    fields: [
      { name: 'purchase_request_no', label: 'شماره درخواست خرید', type: 'text' },
      {
        name: 'purchase_executor',
        label: 'مجری خرید',
        type: 'select',
        options: ['بازرگانی غدیر بهاباد', 'بازرگانی غدیر تهران', 'بازرگانی غدیر برنا'],
      },
      { name: 'letter_no', label: 'شماره نامه ارسالی به تهران', type: 'text' },
      { name: 'letter_date', label: 'تاریخ ارسال نامه', type: 'jalali-date' },
      { name: 'status', label: 'وضعیت', type: 'select', options: ['تامین شده', 'تامین نشده', 'باطل شده'] },
      { name: 'site_arrival_date', label: 'تاریخ ورود به سایت', type: 'jalali-date' },
    ],
  },
  {
    key: 'commercial',
    title: 'بازرگانی غدیر',
    group: config.ldap.groups.commercial,
    canCreateRows: false,
    fields: [
      { name: 'referred_to_expert_date', label: 'تاریخ ارجاع به کارشناس خرید', type: 'jalali-date' },
      { name: 'payment_auth_date', label: 'تاریخ مجوز پرداخت', type: 'jalali-date' },
      { name: 'description', label: 'توضیحات', type: 'textarea' },
    ],
  },
];

function findSection(key) {
  return sections.find((s) => s.key === key);
}

function findField(fieldKey) {
  for (const section of sections) {
    const field = section.fields.find((f) => f.name === fieldKey);
    if (field) return { section, field };
  }
  return null;
}

function allFields() {
  return sections.flatMap((s) => s.fields.map((f) => ({ ...f, sectionKey: s.key })));
}

module.exports = { sections, findSection, findField, allFields };
