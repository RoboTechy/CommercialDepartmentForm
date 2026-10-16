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

function inferStage(row) {
  if (row.workflow_stage) return row.workflow_stage;
  if (row.letter_no && row.dispatch_date) return 'completed';
  if (row.payment_auth_issued_date || row.purchase_executor) return 'financial_approval';
  if (row.referred_to_commercial_date) return 'commercial_rfq';
  if (row.purchase_request_no || row.delivered_to_tech_expert_date) return 'warehouse_review';
  return 'tech_request';
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
  const idx = STAGES.findIndex((s) => s.id === current);
  if (idx >= STAGES.length - 1) return { allowed: false, reason: 'فرآیند به مرحله نهایی (تکمیل‌شده) رسیده است.' };
  const stage = STAGES[idx];
  if (!isAdminUser(user) && !stage.allowedGroups.some((g) => user.groups.includes(g))) {
    return { allowed: false, reason: 'شما مجاز به ارتقای این مرحله از گردش‌کار نیستید.' };
  }
  if (current === 'tech_request' && (!row.request_no || !row.item_description || !row.total_qty)) {
    return { allowed: false, reason: 'فیلدهای الزامی درخواست‌کننده تکمیل نشده‌اند.' };
  }
  if (current === 'warehouse_review' && !row.purchase_request_no && !row.delivered_to_tech_expert_date) {
    return { allowed: false, reason: 'ثبت حداقل یکی از فیلدهای شماره درخواست خرید یا تاریخ تحویل الزامی است.' };
  }
  if (current === 'commercial_rfq' && !row.referred_to_commercial_date) {
    return { allowed: false, reason: 'تاریخ ارجاع به بازرگانی هنوز ثبت نشده است.' };
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

module.exports = { STAGES, inferStage, createDefaultApprovals, canApproveStep, canAdvance, signatureOf, shortSignature, isAdminUser };
