import { 
  DbRow, 
  WorkflowStageId, 
  UserSession, 
  PriorityLevel, 
  ApprovalRecord, 
  ApprovalRoleKey 
} from '../types';
import { sections, findField } from '../data/exactSections';
import { GROUPS } from '../config';

export interface StageDefinition {
  id: WorkflowStageId;
  order: number;
  label: string;
  shortLabel: string;
  badgeColor: string;
  bgColor: string;
  borderColor: string;
  description: string;
  ownerDepartment: string;
  allowedGroups: string[];
}

export const WORKFLOW_STAGES: StageDefinition[] = [
  {
    id: 'tech_request',
    order: 1,
    label: '۱. ثبت درخواست (دپارتمان درخواست‌کننده)',
    shortLabel: 'درخواست‌کننده',
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    bgColor: 'bg-blue-600',
    borderColor: 'border-blue-500',
    description: 'مشخصات اولیه کالا، تعداد، محل مصرف و زمان تحویل به انبار کارفرما',
    ownerDepartment: 'دفتر فنی / عمران / آی‌تی',
    allowedGroups: [GROUPS.techOperator, GROUPS.civil, GROUPS.it, GROUPS.techLead, GROUPS.admin],
  },
  {
    id: 'warehouse_review',
    order: 2,
    label: '۲. انبار کارفرما (بررسی و ثبت شماره خرید)',
    shortLabel: 'انبار کارفرما (۱)',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    bgColor: 'bg-amber-600',
    borderColor: 'border-amber-500',
    description: 'بررسی موجودی انبار، تخصیص شماره درخواست خرید و تحویل به کارشناس',
    ownerDepartment: 'انبار کارفرما (بلوک ۱)',
    allowedGroups: [GROUPS.warehouse, GROUPS.admin],
  },
  {
    id: 'commercial_rfq',
    order: 3,
    label: '۳. بازرگانی، استعلام قیمت و انتخاب تأمین‌کننده',
    shortLabel: 'استعلام بازرگانی',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    bgColor: 'bg-emerald-600',
    borderColor: 'border-emerald-500',
    description: 'دریافت پیش‌فاکتورها، مقایسه قیمت و شرایط تحویل و تعیین مجری خرید',
    ownerDepartment: 'بازرگانی غدیر',
    allowedGroups: [GROUPS.commercial, GROUPS.admin],
  },
  {
    id: 'financial_approval',
    order: 4,
    label: '۴. تأییدات مالی و مدیریتی چندمرحله‌ای',
    shortLabel: 'تأییدات چندمرحله‌ای',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    bgColor: 'bg-purple-600',
    borderColor: 'border-purple-500',
    description: 'امضای دیجیتال سرپرست فنی، رئیس بازرگانی، مدیر مالی و مدیرعامل',
    ownerDepartment: 'مدیریت و مالی',
    allowedGroups: [GROUPS.finance, GROUPS.executive, GROUPS.techLead, GROUPS.admin],
  },
  {
    id: 'final_dispatch',
    order: 5,
    label: '۵. ترخیص و اعزام انبار کارفرما (بلوک ۲)',
    shortLabel: 'ترخیص و اعزام',
    badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    bgColor: 'bg-cyan-600',
    borderColor: 'border-cyan-500',
    description: 'ثبت شماره نامه رسمی، تاریخ ارسال و در پایان تاریخ ورود به کارخانه',
    ownerDepartment: 'انبار کارفرما (بلوک ۲)',
    allowedGroups: [GROUPS.warehouse, GROUPS.admin],
  },
  {
    id: 'completed',
    order: 6,
    label: '۶. تحویل قطعی و خاتمه فرآیند',
    shortLabel: 'تکمیل‌شده',
    badgeColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    bgColor: 'bg-teal-600',
    borderColor: 'border-teal-500',
    description: 'کالا تحویل واحد متقاضی گردیده و پرونده مختومه شد',
    ownerDepartment: 'اتمام چرخه',
    allowedGroups: [GROUPS.admin],
  },
];

export function getStageInfo(stageId?: WorkflowStageId): StageDefinition {
  const found = WORKFLOW_STAGES.find((s) => s.id === stageId);
  return found || WORKFLOW_STAGES[0];
}

// معادل src/workflow.js سمت سرور (مرجع نهایی سرور است؛ این‌جا فقط برای نمایش)
const EXTERNAL_EXECUTORS = ['تهران', 'برنا'];
const STAGE_ORDER: WorkflowStageId[] = ['tech_request', 'warehouse_review', 'commercial_rfq', 'financial_approval', 'final_dispatch', 'completed'];

// مرحله‌ای که خودِ اطلاعات ثبت‌شده ایجاب می‌کند (بدون ارتقای دستی). مجری خرید «تهران/برنا» یعنی
// کار بازرگانی تمام است و درخواست مستقیم به انبار (ترخیص/ارسال) می‌رود.
export function autoStageFromRow(row: DbRow): WorkflowStageId {
  if (row.letter_no && row.dispatch_date && row.factory_arrival_date) return 'completed';
  const ex = row.purchase_executor;
  if (ex && EXTERNAL_EXECUTORS.includes(ex)) return 'final_dispatch';
  if (ex === 'سایت') return row.payment_auth_issued_date ? 'final_dispatch' : 'financial_approval';
  if (row.referred_to_commercial_date) return 'commercial_rfq';
  // ثبت نهایی = ارسال به انبار؛ پیش‌نویس هنوز نزد درخواست‌کننده است
  return row.published_at ? 'warehouse_review' : 'tech_request';
}

// مرحله‌ی واقعی = دیرتر از (ذخیره‌شده) و (ناشی از اطلاعات)
export function inferStageFromRow(row: DbRow): WorkflowStageId {
  // عودت‌شده: برگشته نزد درخواست‌کننده تا نقص را برطرف کند
  if (row.returned_at) return 'tech_request';
  const stored: WorkflowStageId = row.workflow_stage && STAGE_ORDER.includes(row.workflow_stage as WorkflowStageId) ? (row.workflow_stage as WorkflowStageId) : 'tech_request';
  const auto = autoStageFromRow(row);
  return STAGE_ORDER.indexOf(stored) >= STAGE_ORDER.indexOf(auto) ? stored : auto;
}

const REQUIRED_TO_ADVANCE: Partial<Record<WorkflowStageId, (keyof DbRow)[]>> = {
  tech_request: ['request_no', 'item_description', 'priority', 'total_qty', 'unit', 'usage_location', 'delivery_to_warehouse_date', 'item_type'],
  warehouse_review: ['purchase_request_no', 'delivered_to_tech_expert_date', 'delivered_to_employer_date'],
  commercial_rfq: ['referred_to_commercial_date', 'purchase_executor'],
  financial_approval: ['payment_auth_issued_date'],
  final_dispatch: ['letter_no', 'dispatch_date', 'factory_arrival_date'],
};

export function createDefaultApprovals(rowId: number, priority: PriorityLevel, estimatedAmount: number = 0): ApprovalRecord[] {
  const list: ApprovalRecord[] = [
    {
      id: `APP-${rowId}-1`,
      rowId,
      roleKey: 'tech_lead',
      stepNumber: 1,
      title: 'تأیید سرپرست واحد متقاضی (دفتر فنی / عمران / آی‌تی)',
      requiredRoleName: 'سرپرست واحد متقاضی',
      status: 'pending',
    },
    {
      id: `APP-${rowId}-2`,
      rowId,
      roleKey: 'commercial_lead',
      stepNumber: 2,
      title: 'تأیید رئیس اداره تدارکات و بازرگانی',
      requiredRoleName: 'رئیس بازرگانی غدیر',
      status: 'pending',
    },
    {
      id: `APP-${rowId}-3`,
      rowId,
      roleKey: 'finance_lead',
      stepNumber: 3,
      title: 'تأیید مدیر مالی و کنترل بودجه',
      requiredRoleName: 'مدیر مالی و بودجه',
      status: 'pending',
    },
  ];

  // If priority is high (A++, A+) or estimated amount > 100 Million Tomans, add CEO approval
  if (priority === 'A++' || priority === 'A+' || estimatedAmount > 100_000_000) {
    list.push({
      id: `APP-${rowId}-4`,
      rowId,
      roleKey: 'executive_ceo',
      stepNumber: 4,
      title: 'تأیید نهایی مدیرعامل و مجری طرح',
      requiredRoleName: 'مدیرعامل / معاون اجرایی',
      status: 'pending',
    });
  }

  return list;
}

// گروه PRT-Management در طراحی اصلی فقط به گزارش‌ها دسترسی دارد و حق تأیید/تغییر ندارد.
export function canUserApproveStep(user: UserSession, approval: ApprovalRecord): boolean {
  if (user.isLocalAdmin || user.groups.includes(GROUPS.admin)) {
    return true;
  }
  switch (approval.roleKey) {
    case 'tech_lead':
      return user.groups.includes(GROUPS.techLead);
    case 'commercial_lead':
      return user.groups.includes(GROUPS.commercial);
    case 'finance_lead':
      return user.groups.includes(GROUPS.finance);
    case 'executive_ceo':
      return user.groups.includes(GROUPS.executive);
    default:
      return false;
  }
}

export function canAdvanceWorkflow(
  row: DbRow,
  user: UserSession,
  approvals: ApprovalRecord[]
): { allowed: boolean; reason?: string; nextStage?: WorkflowStageId } {
  if (row.cancelled_at) return { allowed: false, reason: 'درخواست لغو شده است و گردش‌کار متوقف می‌باشد.' };
  if (row.returned_at) return { allowed: false, reason: 'درخواست به درخواست‌کننده عودت داده شده است. ابتدا باید نقص برطرف گردد.' };

  const current = inferStageFromRow(row);
  const idx = STAGE_ORDER.indexOf(current);
  if (idx >= STAGE_ORDER.length - 1) return { allowed: false, reason: 'فرآیند به مرحله نهایی (تکمیل‌شده) رسیده است.' };

  const stageDef = WORKFLOW_STAGES[idx];
  if (!user.isLocalAdmin && !user.groups.includes(GROUPS.admin) && !stageDef.allowedGroups.some((g) => user.groups.includes(g))) {
    return { allowed: false, reason: 'این درخواست اکنون در مرحله‌ی دیگری است و ارتقای آن با مسئول همان مرحله است.' };
  }

  const missing = (REQUIRED_TO_ADVANCE[current] || []).filter((f) => !((row[f] ?? '') as string).toString().trim());
  if (missing.length) {
    const labels = missing.map((f) => findField(f as string)?.field.label ?? String(f));
    const hint = current === 'commercial_rfq' ? ' (با انتخاب مجری خرید، درخواست خودکار جابه‌جا می‌شود)' : '';
    return { allowed: false, reason: `برای ارتقا این فیلدها باید پر شوند: ${labels.join('، ')}${hint}` };
  }

  if (current === 'financial_approval') {
    const own = approvals.filter((a) => a.rowId === row.id);
    if (own.some((a) => a.status === 'rejected')) return { allowed: false, reason: 'یکی از مراحل تأیید رد شده است. امکان ارتقا وجود ندارد.' };
    if (own.some((a) => a.status === 'pending')) return { allowed: false, reason: 'تمامی مراحل تأیید چندمرحله‌ای هنوز تکمیل نشده است.' };
  }

  return { allowed: true, nextStage: STAGE_ORDER[idx + 1] };
}

export function formatToman(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '۰ تومان';
  return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان';
}

// عنوان گام اول به دپارتمان واقعی درخواست‌کننده بستگی دارد (دفتر فنی / عمران / آی‌تی)؛ سایر گام‌ها ثابت‌اند
export function stageDisplayLabel(stage: StageDefinition, dept?: string): string {
  if (stage.id === 'tech_request' && dept) return dept;
  return stage.shortLabel;
}
