const config = require('./config');

// تعریف بخش‌ها (بلوک‌های نمایشی) و ستون‌های هر بخش روی ردیف مشترک.
// فقط دفتر فنی بهره‌بردار اجازه‌ی ایجاد ردیف جدید دارد (canCreateRows).
// هر بخش فقط می‌تواند فیلدهای خودش را روی یک ردیف (که قبلاً ایجاد شده) تکمیل/ویرایش کند.
//
// نکته: انبار کارفرما به‌عمد به دو بلوک نمایشی (warehouse_1 و warehouse_2)
// تقسیم شده که بلوک بازرگانی غدیر بینشان قرار می‌گیرد (مطابق ترتیب واقعی
// جریان کار). هر دو بلوک با گروه LDAP یکسان (warehouse) قابل ویرایش‌اند؛
// key فقط برای مسیر ثبت/آدرس‌دهی هر فرم استفاده می‌شود، color برای رنگ
// یکسان دو بلوک در جدول/کارت‌ها.
const sections = [
  {
    key: 'tech_operator',
    title: 'دفتر فنی بهره‌بردار',
    color: 'tech_operator',
    group: config.ldap.groups.techOperator,
    canCreateRows: true,
    fields: [
      { name: 'request_no', label: 'شماره درخواست کالا', type: 'text', required: true },
      { name: 'item_description', label: 'شرح کالا', type: 'textarea', required: true },
      { name: 'priority', label: 'اولویت', type: 'select', options: ['A++', 'A+', 'A', 'B', 'C', 'D'] },
      { name: 'total_qty', label: 'تعداد کل', type: 'text' },
      { name: 'unit', label: 'واحد', type: 'text', hint: 'مثلاً: عدد، کیلوگرم، لیتر، متر، بسته' },
      { name: 'usage_location', label: 'محل مصرف', type: 'text' },
      { name: 'delivery_to_warehouse_date', label: 'تاریخ تحویل درخواست به انبار', type: 'jalali-date' },
      { name: 'item_type', label: 'نوع کالا', type: 'select', options: ['استاندارد', 'ساخت'] },
    ],
  },
  {
    key: 'warehouse_1',
    title: 'انبار کارفرما',
    color: 'warehouse',
    group: config.ldap.groups.warehouse,
    canCreateRows: false,
    fields: [
      { name: 'purchase_request_no', label: 'شماره درخواست خرید', type: 'text' },
      { name: 'delivered_to_tech_expert_date', label: 'تاریخ تحویل به کارشناس فنی', type: 'jalali-date' },
      { name: 'delivered_to_employer_date', label: 'تاریخ تحویل به کارفرما', type: 'jalali-date' },
      { name: 'factory_arrival_date', label: 'تاریخ ورود به کارخانه', type: 'jalali-date' },
    ],
  },
  {
    key: 'commercial',
    title: 'بازرگانی غدیر',
    color: 'commercial',
    group: config.ldap.groups.commercial,
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
    group: config.ldap.groups.warehouse,
    canCreateRows: false,
    fields: [
      { name: 'letter_no', label: 'شماره نامه', type: 'text' },
      { name: 'dispatch_date', label: 'تاریخ ارسال', type: 'jalali-date' },
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
