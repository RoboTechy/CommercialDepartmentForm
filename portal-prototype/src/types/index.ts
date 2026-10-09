// EXACT DATA MODEL MATCHING SQLite database (table `rows` and `audit_log`)

export type PriorityLevel = 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D';
export type ItemType = 'استاندارد' | 'ساخت';
export type RequesterDept = 'دفتر فنی' | 'عمران' | 'آی‌تی';
export type PurchaseExecutor = 'سایت' | 'تهران' | 'برنا';

// Exact column structure of table `rows`
export interface DbRow {
  id: number;
  created_by_username: string;
  created_by_display: string;
  created_at: string; // YYYY/MM/DD HH:MM:SS
  
  // Section 1: tech_operator (درخواست‌کننده)
  request_no: string;
  item_description: string;
  priority: PriorityLevel;
  total_qty: string;
  unit: string;
  usage_location: string;
  delivery_to_warehouse_date: string;
  item_type: ItemType;
  requester_dept: RequesterDept;

  // Section 2: warehouse_1 (انبار کارفرما - بلوک ۱)
  purchase_request_no: string;
  delivered_to_tech_expert_date: string;
  delivered_to_employer_date: string;
  factory_arrival_date: string;

  // Section 3: commercial (بازرگانی غدیر)
  referred_to_commercial_date: string;
  purchase_executor: PurchaseExecutor | '';
  payment_auth_issued_date: string;

  // Section 4: warehouse_2 (انبار کارفرما - بلوک ۲)
  letter_no: string;
  dispatch_date: string;

  // System migration columns
  deleted_at: string;
  deleted_by_username: string;
  deleted_by_display: string;

  cancelled_at: string;
  cancelled_by_username: string;
  cancelled_by_display: string;
  cancel_reason: string;

  returned_at: string;
  returned_by_username: string;
  returned_by_display: string;
  return_reason: string;

  published_at: string; // Empty string if draft

  // Workflow, RFQ & Approvals extensions
  workflow_stage?: WorkflowStageId;
  total_estimated_amount?: number;
  selected_vendor_name?: string;
  selected_quote_id?: string;
  approvals_status?: 'none' | 'pending' | 'partially_approved' | 'approved' | 'rejected';
}

export type WorkflowStageId = 
  | 'tech_request'       // ۱. ثبت و ارسال درخواست اولیه دفتر فنی
  | 'warehouse_review'   // ۲. بررسی و ثبت در انبار کارفرما (بلوک ۱)
  | 'commercial_rfq'     // ۳. استعلام قیمت و مقایسه تأمین‌کنندگان (بازرگانی)
  | 'financial_approval' // ۴. تأییدات مالی و مدیریتی چندمرحله‌ای
  | 'final_dispatch'     // ۵. اعزام، ترخیص و تحویل نهایی انبار کارفرما (بلوک ۲)
  | 'completed';         // ۶. تحویل قطعی و مختومه

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  rating: number; // 1-5
  grade: 'A' | 'B' | 'C';
  status: 'active' | 'suspended';
  address?: string;
  economicCode?: string;
  notes?: string;
}

export interface Quotation {
  id: string;
  rowId: number;
  vendorId: string;
  vendorName: string;
  quoteNumber: string;
  quoteDate: string; // YYYY/MM/DD
  validUntil: string;
  unitPrice: number; // Toman
  quantity: number;
  totalPrice: number;
  deliveryDays: number;
  paymentTerms: string;
  warranty: string;
  status: 'pending' | 'selected' | 'rejected';
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export type ApprovalRoleKey = 'tech_lead' | 'commercial_lead' | 'finance_lead' | 'executive_ceo';

export interface ApprovalRecord {
  id: string;
  rowId: number;
  roleKey: ApprovalRoleKey;
  stepNumber: number;
  title: string;
  requiredRoleName: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approvedByUsername?: string;
  approvedByDisplay?: string;
  approvedAt?: string;
  digitalSignatureHash?: string;
  rejectionReason?: string;
  comment?: string;
}

// Exact column structure of table `audit_log`
export interface AuditLogEntry {
  id: number;
  row_id: number;
  section_key: string;
  field_key: string;
  field_label: string;
  old_value: string;
  new_value: string;
  changed_by_username: string;
  changed_by_display: string;
  changed_at: string;
}

export interface UserSession {
  username: string;
  displayName: string;
  groups: string[];
  isLocalAdmin?: boolean;
  authType?: 'ldap' | 'local';
}

export type ActiveTab = 
  | 'dashboard'
  | 'workflow_pipeline'
  | 'vendors'
  | 'new_request'
  | 'drafts'
  | 'row_detail'
  | 'duration_report'
  | 'management_report'
  | 'deleted_rows'
  | 'audit_logs';
