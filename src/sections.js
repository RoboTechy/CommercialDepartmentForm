const config = require('./config');

// تعریف بخش‌ها (بلوک‌های نمایشی) و ستون‌های هر بخش روی ردیف مشترک.
// فقط درخواست‌کننده اجازه‌ی ایجاد ردیف جدید دارد (canCreateRows).
// هر بخش فقط می‌تواند فیلدهای خودش را روی یک ردیف (که قبلاً ایجاد شده) تکمیل/ویرایش کند.
//
// نکته: انبار کارفرما به‌عمد به دو بلوک نمایشی (warehouse_1 و warehouse_2)
// تقسیم شده که بلوک بازرگانی غدیر بینشان قرار می‌گیرد (مطابق ترتیب واقعی
// جریان کار). هر دو بلوک با گروه LDAP یکسان (warehouse) قابل ویرایش‌اند؛
// key فقط برای مسیر ثبت/آدرس‌دهی هر فرم استفاده می‌شود، color برای رنگ
// یکسان دو بلوک در جدول/کارت‌ها.
// دپارتمان‌های مجاز به ثبت درخواست («درخواست‌کننده»، به‌معنای گسترده): هر
// کاربری که عضو یکی از این گروه‌های LDAP باشد می‌تواند ردیف جدید بسازد، و
// دپارتمانش به‌صورت خودکار (بدون انتخاب دستی) روی فیلد requester_dept ثبت
// می‌شود - نه در فرم ایجاد قابل انتخاب است و نه بعداً قابل ویرایش. هر کاربر
// فقط می‌تواند ردیف‌های همین دپارتمان خودش را ویرایش/لغو کند (به
// middleware.js -> canEditRequesterRow/canCancelRow مراجعه کنید).
const requesterDepartments = [
  { label: 'دفتر فنی', group: config.ldap.groups.techOperator },
  { label: 'عمران', group: config.ldap.groups.civil },
  { label: 'آی‌تی', group: config.ldap.groups.it },
];

const sections = [
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

// اگر «مجری خرید» تهران یا برنا باشد، خرید دیگر توسط بازرگانی سایت انجام
// نمی‌شود، پس بازرگانی سایت اصلاً مجوز پرداخت صادر نمی‌کند: «تاریخ صدور
// مجوز پرداخت» در این حالت هم از حالت قابل‌ویرایش خارج می‌شود (سمت سرور و
// کلاینت) و هم برای «تکمیل‌شده» حساب‌شدن بخش بازرگانی/کل ردیف لازم نیست.
// توجه: این دو مقدار در public/app.js هم (برای غیرفعال‌کردن آنی فیلد بدون
// رفرش صفحه) تکرار شده‌اند - اگر این‌جا تغییر کرد، آن‌جا را هم به‌روز کنید.
const EXTERNAL_PURCHASE_EXECUTORS = ['تهران', 'برنا'];
function isPaymentAuthWaived(row) {
  return EXTERNAL_PURCHASE_EXECUTORS.includes(row.purchase_executor);
}

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

module.exports = { sections, findSection, findField, allFields, requesterDepartments, isPaymentAuthWaived };
