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
  | 'new_request'
  | 'drafts'
  | 'row_detail'
  | 'duration_report'
  | 'management_report'
  | 'deleted_rows'
  | 'audit_logs';
