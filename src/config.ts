// نام گروه‌های LDAP/Active Directory - دقیقاً همان مقادیر پیش‌فرض .env.example
// سرویس اصلی (PRT). در نسخه‌ی واقعی این‌ها از متغیرهای LDAP_GROUP_* خوانده می‌شوند.
export const GROUPS = {
  techOperator: 'PRT-Technical',
  civil: 'PRT-Civil',
  it: 'PRT-IT',
  warehouse: 'PRT-Warehouse',
  commercial: 'PRT-Commercial',
  admin: 'PRT-Admins',
  viewer: 'PRT-Viewer',
  management: 'PRT-Management',
  // فقط برای ماژول آزمایشی «گردش‌کار گسترده» (پایین) - در طراحی اصلی وجود ندارند
  techLead: 'PRT-TechLead',
  finance: 'PRT-Finance',
  executive: 'PRT-Executive',
} as const;

// کاربر برای ورود باید عضو حداقل یکی از این گروه‌ها باشد (مثل سرویس اصلی)
export const ALLOWED_LOGIN_GROUPS: string[] = [
  GROUPS.techOperator,
  GROUPS.civil,
  GROUPS.it,
  GROUPS.warehouse,
  GROUPS.commercial,
  GROUPS.admin,
  GROUPS.viewer,
  GROUPS.management,
];

// نشست ورود از لحظه‌ی لاگین (نه آخرین فعالیت) ۲ ساعت معتبر است
export const SESSION_HOURS = 2;

// بعد از چند روز از ایجاد یک ردیف، اگر هنوز تکمیل نشده باشد «معطل‌مانده» حساب می‌شود
export const OVERDUE_DAYS = 3;

// این پروژه فعلاً یک پروتوتایپ فرانت‌اند است (داده در localStorage مرورگر). ابزارهای
// دمو (تعویض کاربر، ریست داده‌ها، ورود شبیه‌سازی‌شده) فقط وقتی فعال‌اند که
// VITE_DEMO_MODE=false ست نشده باشد. در استقرار واقعی حتماً false کنید.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

// RFQ/تأمین‌کنندگان، تأییدات چندمرحله‌ای و خط‌لوله‌ی مرحله‌ای در طراحی اصلی PRT نبودند
// (جدول مشترک سه‌بخشی + «در انتظار کدام بخش» که از روی فیلدهای پر/خالی محاسبه می‌شود).
// به‌صورت پیش‌فرض خاموش‌اند؛ برای روشن کردن: VITE_ENABLE_EXTENDED_WORKFLOW=true
export const ENABLE_EXTENDED_WORKFLOW = import.meta.env.VITE_ENABLE_EXTENDED_WORKFLOW === 'true';
