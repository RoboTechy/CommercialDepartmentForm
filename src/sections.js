const config = require('./config');

// تعریف بخش‌های فرم. هر بخش به یک گروه LDAP نگاشت می‌شود؛
// فقط اعضای همان گروه (یا گروه مدیر) اجازه‌ی تکمیل آن بخش را دارند.
const sections = [
  {
    key: 'technical',
    title: 'بخش فنی',
    group: config.ldap.groups.technical,
    fields: [
      { name: 'item_name', label: 'نام کالا / تجهیز', type: 'text', required: true },
      { name: 'technical_specs', label: 'مشخصات فنی', type: 'textarea' },
      { name: 'required_standard', label: 'استاندارد مورد نیاز', type: 'text' },
      { name: 'expert_opinion', label: 'نظر کارشناس فنی', type: 'textarea' },
      { name: 'expert_name', label: 'نام کارشناس فنی', type: 'text' },
      { name: 'expert_date', label: 'تاریخ بررسی', type: 'date' },
    ],
  },
  {
    key: 'operator',
    title: 'بخش بهره‌بردار',
    group: config.ldap.groups.operator,
    fields: [
      { name: 'request_reason', label: 'علت درخواست', type: 'textarea', required: true },
      { name: 'consumption_rate', label: 'میزان مصرف / نیاز', type: 'text' },
      { name: 'priority', label: 'اولویت', type: 'select', options: ['عادی', 'فوری', 'بحرانی'] },
      { name: 'needed_by_date', label: 'تاریخ نیاز', type: 'date' },
      { name: 'operator_name', label: 'نام بهره‌بردار', type: 'text' },
      { name: 'operator_date', label: 'تاریخ ثبت', type: 'date' },
    ],
  },
  {
    key: 'warehouse',
    title: 'بخش انبار کارفرما',
    group: config.ldap.groups.warehouse,
    fields: [
      { name: 'current_stock', label: 'موجودی فعلی در انبار', type: 'text', required: true },
      { name: 'storage_location', label: 'محل نگهداری', type: 'text' },
      { name: 'last_movement_date', label: 'تاریخ آخرین ورود/خروج', type: 'date' },
      { name: 'stock_confirmation', label: 'وضعیت موجودی', type: 'select', options: ['موجود است', 'موجود نیست', 'ناقص است'] },
      { name: 'warehouse_keeper_name', label: 'نام انباردار', type: 'text' },
      { name: 'warehouse_date', label: 'تاریخ ثبت', type: 'date' },
    ],
  },
  {
    key: 'commercial',
    title: 'بخش بازرگانی غدیر',
    group: config.ldap.groups.commercial,
    fields: [
      { name: 'suggested_supplier', label: 'تامین‌کننده پیشنهادی', type: 'text', required: true },
      { name: 'estimated_price', label: 'قیمت برآوردی (ریال)', type: 'text' },
      { name: 'delivery_time', label: 'زمان تحویل برآوردی', type: 'text' },
      { name: 'purchase_request_no', label: 'شماره درخواست خرید', type: 'text' },
      { name: 'commercial_expert_name', label: 'نام کارشناس بازرگانی', type: 'text' },
      { name: 'commercial_date', label: 'تاریخ ثبت', type: 'date' },
    ],
  },
];

function findSection(key) {
  return sections.find((s) => s.key === key);
}

module.exports = { sections, findSection };
