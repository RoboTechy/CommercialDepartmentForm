import { 
  DbRow, 
  WorkflowStageId, 
  UserSession, 
  PriorityLevel, 
  ApprovalRecord, 
  ApprovalRoleKey 
} from '../types';
import { sections } from '../data/exactSections';
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
    label: '۱. ثبت درخواست و دفتر فنی',
    shortLabel: 'دفتر فنی',
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    bgColor: 'bg-blue-600',
    borderColor: 'border-blue-500',
    description: 'مشخصات اولیه کالا، تعداد، محل مصرف و زمان تحویل به انبار کارفرما',
    ownerDepartment: 'دفتر فنی / دپارتمان متقاضی',
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
    description: 'ثبت شماره نامه رسمی، مجوز خروج و ارسال قطعی به سایت پروژه',
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

export function inferStageFromRow(row: DbRow): WorkflowStageId {
  if (row.workflow_stage) {
    return row.workflow_stage;
  }
  if (row.letter_no && row.dispatch_date) {
    return 'completed';
  }
  if (row.payment_auth_issued_date || row.purchase_executor) {
    return 'financial_approval';
  }
  if (row.referred_to_commercial_date) {
    return 'commercial_rfq';
  }
  if (row.purchase_request_no || row.delivered_to_tech_expert_date) {
    return 'warehouse_review';
  }
  return 'tech_request';
}

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
  const currentStage = inferStageFromRow(row);
  const currentIndex = WORKFLOW_STAGES.findIndex((s) => s.id === currentStage);

  if (row.cancelled_at) {
    return { allowed: false, reason: 'درخواست لغو شده است و گردش‌کار متوقف می‌باشد.' };
  }
  if (row.returned_at) {
    return { allowed: false, reason: 'درخواست به دفتر فنی عودت داده شده است. ابتدا باید نقص برطرف گردد.' };
  }
  if (currentIndex >= WORKFLOW_STAGES.length - 1) {
    return { allowed: false, reason: 'فرآیند به مرحله نهایی (تکمیل‌شده) رسیده است.' };
  }

  const nextStage = WORKFLOW_STAGES[currentIndex + 1].id;

  const stageDef = WORKFLOW_STAGES[currentIndex];
  if (!user.isLocalAdmin && !stageDef.allowedGroups.some((g) => user.groups.includes(g))) {
    return { allowed: false, reason: 'شما مجاز به ارتقای این مرحله از گردش‌کار نیستید.' };
  }

  // Validation rules per transition
  if (currentStage === 'tech_request') {
    if (!row.request_no || !row.item_description || !row.total_qty) {
      return { allowed: false, reason: 'فیلدهای الزامی درخواست‌کننده تکمیل نشده‌اند.' };
    }
  }

  if (currentStage === 'warehouse_review') {
    if (!row.purchase_request_no && !row.delivered_to_tech_expert_date) {
      return { allowed: false, reason: 'ثبت حداقل یکی از فیلدهای شماره درخواست خرید یا تاریخ تحویل الزامی است.' };
    }
  }

  if (currentStage === 'commercial_rfq') {
    if (!row.referred_to_commercial_date) {
      return { allowed: false, reason: 'تاریخ ارجاع به بازرگانی هنوز ثبت نشده است.' };
    }
  }

  if (currentStage === 'financial_approval') {
    const rowApprovals = approvals.filter((a) => a.rowId === row.id);
    const hasPending = rowApprovals.some((a) => a.status === 'pending');
    const hasRejected = rowApprovals.some((a) => a.status === 'rejected');
    if (hasRejected) {
      return { allowed: false, reason: 'یکی از مراحل تأیید رد شده است. امکان ارتقا وجود ندارد.' };
    }
    if (hasPending && rowApprovals.length > 0) {
      return { allowed: false, reason: 'تمامی مراحل تأیید چندمرحله‌ای هنوز تکمیل نشده است.' };
    }
  }

  return { allowed: true, nextStage };
}

export function formatToman(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '۰ تومان';
  return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان';
}
