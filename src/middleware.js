const config = require('./config');
const { sections, findSection, requesterDepartments } = require('./sections');

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function isAdmin(user) {
  return user.groups.includes(config.ldap.groups.admin);
}

// ادمین محلی (break-glass): مستقل از LDAP، فقط برای مواقع قطعی ارتباط با
// Active Directory. تغییراتش لاگ نمی‌شود و اجازه‌ی حذف (نرم) ردیف را دارد.
function isLocalAdmin(user) {
  return Boolean(user.isLocalAdmin);
}

// section.group می‌تواند یک گروه LDAP باشد (اکثر بخش‌ها) یا آرایه‌ای از چند
// گروه (بخش «درخواست‌کننده» که چند دپارتمان با هم آن را تشکیل می‌دهند)
function sectionGroups(section) {
  return Array.isArray(section.group) ? section.group : [section.group];
}

function canEditSection(user, sectionKey) {
  const section = findSection(sectionKey);
  if (!section) return false;
  if (isAdmin(user)) return true;
  return sectionGroups(section).some((g) => user.groups.includes(g));
}

function canCreateRows(user) {
  if (isAdmin(user)) return true;
  return sections.some((s) => s.canCreateRows && sectionGroups(s).some((g) => user.groups.includes(g)));
}

function isAnyRequesterDeptMember(user) {
  return requesterDepartments.some((d) => user.groups.includes(d.group));
}

// هر عضو یکی از دپارتمان‌های «درخواست‌کننده» (دفتر فنی/عمران/آی‌تی) فقط
// می‌تواند ردیف‌هایی را ویرایش کند که فیلد requester_dept‌شان با دپارتمان
// خودش یکی باشد - نه ردیف‌های دپارتمان‌های دیگر، حتی اگر هر دو در همان بخش
// «درخواست‌کننده» باشند. ردیف‌های قدیمی (قبل از این قابلیت) هنگام مهاجرت
// دیتابیس به دپارتمان «دفتر فنی» نسبت داده شده‌اند (db.js) تا قفل نشوند.
function canEditRequesterRow(user, row) {
  if (isAdmin(user)) return true;
  const dept = requesterDepartments.find((d) => d.label === row.requester_dept);
  if (!dept) return false;
  return user.groups.includes(dept.group);
}

// آیا کاربر می‌تواند یک بخش خاص را روی یک ردیف مشخص ویرایش کند - هم مجوز
// گروهی/دپارتمانی را چک می‌کند و هم قفل‌های وضعیتی ردیف (حذف‌شده/لغوشده/
// عودت‌داده‌شده) را؛ محل واحد این منطق تا در همه‌جا (نمای جزئیات ردیف، ثبت
// تغییرات هر بخش، ویرایش درجا از فهرست اصلی) یکسان اعمال شود.
function canEditSectionForRow(user, row, sectionKey) {
  if (row.deleted_at || row.cancelled_at) return false;
  if (row.returned_at && sectionKey !== 'tech_operator') return false;
  return sectionKey === 'tech_operator' ? canEditRequesterRow(user, row) : canEditSection(user, sectionKey);
}

// لغو درخواست: هم درخواست‌کننده‌ی همان دپارتمان (سازنده‌ی درخواست) و هم ادمین -
// طبق همان محدودیت بالا (فقط دپارتمان خودش)
function canCancelRow(user, row) {
  if (isAdmin(user)) return true;
  if (!isAnyRequesterDeptMember(user)) return false;
  return canEditRequesterRow(user, row);
}

// عودت به درخواست‌کننده: فقط انبار کارفرما (و ادمین) می‌تواند این وضعیت را ثبت/بردارد
function canReturnToTechOffice(user) {
  if (isAdmin(user)) return true;
  return user.groups.includes(config.ldap.groups.warehouse);
}

module.exports = {
  requireLogin,
  isAdmin,
  isLocalAdmin,
  canEditSection,
  canEditRequesterRow,
  canEditSectionForRow,
  canCreateRows,
  canCancelRow,
  canReturnToTechOffice,
};
