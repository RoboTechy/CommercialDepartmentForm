const crypto = require('crypto');
const config = require('./config');

// منطق «گردش‌کار گسترده» سمت سرور (مرجع نهایی؛ فرانت‌اند فقط نمایش می‌دهد).
// مراحل، گروه‌های مجاز و قواعد ارتقا دقیقاً معادل client/src/utils/workflowEngine.ts هستند.
const G = config.ldap.groups;

const STAGES = [
  { id: 'tech_request', allowedGroups: [G.techOperator, G.civil, G.it, G.techLead, G.admin] },
  { id: 'warehouse_review', allowedGroups: [G.warehouse, G.admin] },
  { id: 'commercial_rfq', allowedGroups: [G.commercial, G.admin] },
  { id: 'financial_approval', allowedGroups: [G.finance, G.executive, G.techLead, G.admin] },
  { id: 'final_dispatch', allowedGroups: [G.warehouse, G.admin] },
  { id: 'completed', allowedGroups: [G.admin] },
];

// مجری خرید «تهران/برنا»: خرید توسط بازرگانی سایت انجام نمی‌شود، پس کار بازرگانی همین‌جا تمام است
// (مجوز پرداخت لازم نیست) و درخواست مستقیم به انبار (بلوک ۲: ترخیص/ارسال) می‌رود. معادل
// isPaymentAuthWaived در sections.js.
const EXTERNAL_EXECUTORS = ['تهران', 'برنا'];
const STAGE_IDS = STAGES.map((s) => s.id);

// مرحله‌ای که خودِ اطلاعات ثبت‌شده ایجاب می‌کند (بدون نیاز به ارتقای دستی)
function autoStage(row) {
  if (row.letter_no && row.dispatch_date) return 'completed';
  const ex = row.purchase_executor;
  if (EXTERNAL_EXECUTORS.includes(ex)) return 'final_dispatch';
  if (ex === 'سایت') return row.payment_auth_issued_date ? 'final_dispatch' : 'financial_approval';
  if (row.referred_to_commercial_date) return 'commercial_rfq';
  // ثبت نهایی = ارسال به انبار کارفرما: ردیف ثبت‌شده همان لحظه در صف انبار است
  // (پیش‌نویس هنوز نزد درخواست‌کننده است)
  return row.published_at ? 'warehouse_review' : 'tech_request';
}

// مرحله‌ی واقعی = دیرتر از (مرحله‌ی ذخیره‌شده با ارتقای دستی/خودکار) و (مرحله‌ی ناشی از اطلاعات).
// یعنی اطلاعات ثبت‌شده هیچ‌وقت عقب‌تر از واقعیت نمی‌ماند؛ ارتقای دستی فقط برای «تحویل کار به
// بخش بعد» است وقتی اطلاعات هنوز آن را نشان نمی‌دهد.
function inferStage(row) {
  // عودت‌شده: برگشته نزد درخواست‌کننده تا نقص را برطرف کند
  if (row.returned_at) return 'tech_request';
  const stored = STAGE_IDS.includes(row.workflow_stage) ? row.workflow_stage : 'tech_request';
  const auto = autoStage(row);
  return STAGE_IDS.indexOf(stored) >= STAGE_IDS.indexOf(auto) ? stored : auto;
}

// فیلدهایی که برای تحویل کار به مرحله‌ی بعد باید پر باشند
const REQUIRED_TO_ADVANCE = {
  tech_request: ['request_no', 'item_description', 'priority', 'total_qty', 'unit', 'usage_location', 'delivery_to_warehouse_date', 'item_type'],
  warehouse_review: ['purchase_request_no', 'delivered_to_tech_expert_date', 'delivered_to_employer_date'],
  commercial_rfq: ['referred_to_commercial_date', 'purchase_executor'],
  financial_approval: ['payment_auth_issued_date'],
  final_dispatch: ['letter_no', 'dispatch_date'],
};

function labelOf(name) {
  const found = require('./sections').findField(name);
  return found ? found.field.label : name;
}

function createDefaultApprovals(rowId, priority, estimatedAmount = 0) {
  const list = [
    { roleKey: 'tech_lead', stepNumber: 1, title: 'تأیید سرپرست واحد متقاضی (دفتر فنی / عمران / آی‌تی)', requiredRoleName: 'سرپرست واحد متقاضی' },
    { roleKey: 'commercial_lead', stepNumber: 2, title: 'تأیید رئیس اداره تدارکات و بازرگانی', requiredRoleName: 'رئیس بازرگانی غدیر' },
    { roleKey: 'finance_lead', stepNumber: 3, title: 'تأیید مدیر مالی و کنترل بودجه', requiredRoleName: 'مدیر مالی و بودجه' },
  ];
  if (priority === 'A++' || priority === 'A+' || estimatedAmount > 100000000) {
    list.push({ roleKey: 'executive_ceo', stepNumber: 4, title: 'تأیید نهایی مدیرعامل و مجری طرح', requiredRoleName: 'مدیرعامل / معاون اجرایی' });
  }
  return list.map((a) => ({ id: `APP-${rowId}-${a.stepNumber}`, rowId, status: 'pending', ...a }));
}

function isAdminUser(user) {
  return Boolean(user.isLocalAdmin) || user.groups.includes(G.admin);
}

function canApproveStep(user, approval) {
  if (isAdminUser(user)) return true;
  switch (approval.roleKey) {
    case 'tech_lead': return user.groups.includes(G.techLead);
    case 'commercial_lead': return user.groups.includes(G.commercial);
    case 'finance_lead': return user.groups.includes(G.finance);
    case 'executive_ceo': return user.groups.includes(G.executive);
    default: return false;
  }
}

function canAdvance(row, user, approvals) {
  if (row.cancelled_at) return { allowed: false, reason: 'درخواست لغو شده است و گردش‌کار متوقف می‌باشد.' };
  if (row.returned_at) return { allowed: false, reason: 'درخواست به درخواست‌کننده عودت داده شده است. ابتدا باید نقص برطرف گردد.' };
  const current = inferStage(row);
  const idx = STAGE_IDS.indexOf(current);
  if (idx >= STAGES.length - 1) return { allowed: false, reason: 'فرآیند به مرحله نهایی (تکمیل‌شده) رسیده است.' };
  const stage = STAGES[idx];
  if (!isAdminUser(user) && !stage.allowedGroups.some((g) => user.groups.includes(g))) {
    return { allowed: false, reason: 'این درخواست اکنون در مرحله‌ی دیگری است و ارتقای آن با مسئول همان مرحله است.' };
  }
  const missing = (REQUIRED_TO_ADVANCE[current] || []).filter((f) => !(row[f] || '').toString().trim());
  if (missing.length) {
    const hint = current === 'commercial_rfq' ? ' (با انتخاب مجری خرید، درخواست خودکار جابه‌جا می‌شود)' : '';
    return { allowed: false, reason: `برای ارتقا این فیلدها باید پر شوند: ${missing.map(labelOf).join('، ')}${hint}` };
  }
  if (current === 'financial_approval') {
    if (approvals.some((a) => a.status === 'rejected')) {
      return { allowed: false, reason: 'یکی از مراحل تأیید رد شده است. امکان ارتقا وجود ندارد.' };
    }
    if (approvals.some((a) => a.status === 'pending')) {
      return { allowed: false, reason: 'تمامی مراحل تأیید چندمرحله‌ای هنوز تکمیل نشده است.' };
    }
  }
  return { allowed: true, nextStage: STAGES[idx + 1].id, currentStage: current };
}

// مهر تأیید: HMAC-SHA256 با کلید سرور روی (شناسه‌ی تأیید، ردیف، تأییدکننده، زمان، توضیح).
// نه جعل‌پذیر توسط کاربر است و نه بدون دسترسی به SESSION_SECRET قابل ساخت؛ هر زمان
// می‌توان با signatureOf دوباره حساب کرد و صحت را بررسی نمود.
function signatureOf(approval) {
  const payload = [approval.id, approval.rowId, approval.approvedByUsername || '', approval.approvedAt || '', approval.comment || ''].join('|');
  return crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('hex');
}

function shortSignature(hex) {
  return `DSIG-HMAC-${hex.slice(0, 16).toUpperCase()}`;
}

module.exports = { STAGES, autoStage, REQUIRED_TO_ADVANCE, EXTERNAL_EXECUTORS, inferStage, createDefaultApprovals, canApproveStep, canAdvance, signatureOf, shortSignature, isAdminUser };
