import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  DbRow, 
  AuditLogEntry, 
  UserSession, 
  ActiveTab, 
  RequesterDept, 
  Vendor, 
  Quotation, 
  ApprovalRecord, 
  WorkflowStageId 
} from '../types';
import { 
  INITIAL_DB_ROWS, 
  INITIAL_AUDIT_LOGS, 
  SAMPLE_USERS, 
  INITIAL_VENDORS, 
  INITIAL_QUOTATIONS, 
  INITIAL_APPROVALS 
} from '../data/mockDatabaseData';
import { sections, findSection, allFields, requesterDepartments, isPaymentAuthWaived, FieldDef } from '../data/exactSections';
import { nowJalaliDateTime, daysSinceJalali, daysBetweenJalali } from '../utils/exactJalaali';
import { 
  canAdvanceWorkflow, 
  generateDigitalSignature, 
  createDefaultApprovals, 
  canUserApproveStep, 
  inferStageFromRow 
} from '../utils/workflowEngine';
import { 
  resolveRequesterDept, 
  isFieldSetComplete, 
  fieldsForCompletion, 
  isRowComplete, 
  currentBlockingSection,
  normalizeForDuplicateCheck,
  validateFieldValues,
  DEPARTMENTS,
  median,
  computeDurationStats
} from '../store/exactStore';

import {
  GROUPS,
  ALLOWED_LOGIN_GROUPS,
  SESSION_HOURS,
  OVERDUE_DAYS,
  DEMO_MODE,
  ENABLE_EXTENDED_WORKFLOW,
} from '../config';

const STORAGE_KEYS = {
  DB_ROWS: 'commercial_exact_db_rows_v3',
  AUDIT_LOGS: 'commercial_exact_audit_logs_v3',
  USER: 'commercial_exact_session_v4',
  VENDORS: 'commercial_exact_vendors_v3',
  QUOTATIONS: 'commercial_exact_quotations_v3',
  APPROVALS: 'commercial_exact_approvals_v3',
};

interface FilterState {
  searchQuery: string;
  requesterDept: string;
  priority: string;
  purchaseExecutor: string;
  itemType: string;
  status: 'all' | 'active' | 'cancelled' | 'returned';
  incompleteDept: string;
  incompleteRequesterDept: string;
}

interface ExactDatabaseContextType {
  rows: DbRow[];
  auditLogs: AuditLogEntry[];
  vendors: Vendor[];
  quotations: Quotation[];
  approvals: ApprovalRecord[];
  currentUser: UserSession | null;
  allUsers: UserSession[];
  activeTab: ActiveTab;
  selectedRowId: number | null;
  filters: FilterState;
  isLdapModalOpen: boolean;
  cancelModalRowId: number | null;
  returnModalRowId: number | null;
  historyDrawerRowId: number | null;

  // Auth & Session
  login: (username: string, password?: string, mode?: 'ldap' | 'local') => { success: boolean; error?: string };
  logout: () => void;
  switchUser: (username: string) => void;
  sessionExpiresAt: number | null;

  // Setters
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedRowId: (id: number | null) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  setIsLdapModalOpen: (open: boolean) => void;
  setCancelModalRowId: (id: number | null) => void;
  setReturnModalRowId: (id: number | null) => void;
  setHistoryDrawerRowId: (id: number | null) => void;
  resetToPrinstineData: () => void;

  // Permission Checks (100% matching middleware.js)
  isAdmin: boolean;
  isLocalAdmin: boolean;
  isManagement: boolean;
  canCreateRows: boolean;
  canEditSectionForRow: (row: DbRow, sectionKey: string) => boolean;
  canCancelRow: (row: DbRow) => boolean;
  canReturnToTechOffice: boolean;

  // DB Actions (100% matching store.js)
  createRow: (values: Partial<DbRow>) => { row: DbRow | null; errors: string[]; isDuplicate: boolean };
  updateSection: (rowId: number, sectionKey: string, values: Record<string, string>) => { ok: boolean; errors: string[]; values?: Record<string, string> };
  finalizeDrafts: (rowIds?: number[]) => void;
  discardDraft: (rowId: number) => boolean;
  softDeleteRow: (rowId: number) => void;
  restoreRow: (rowId: number) => void;
  cancelRow: (rowId: number, reason: string) => boolean;
  uncancelRow: (rowId: number) => boolean;
  returnToTechOffice: (rowId: number, reason: string) => boolean;
  unreturnFromTechOffice: (rowId: number) => boolean;

  // RFQ & Vendor Management (ویژگی ۱)
  addVendor: (vendor: Omit<Vendor, 'id'>) => Vendor;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
  addQuotation: (quote: Omit<Quotation, 'id' | 'createdAt' | 'createdBy'>) => Quotation;
  selectWinningQuotation: (quoteId: string) => void;
  deleteQuotation: (quoteId: string) => void;
  getRowQuotations: (rowId: number) => Quotation[];

  // Multi-level Approvals & Digital Signature (ویژگی ۴)
  approveStep: (approvalId: string, comment?: string) => { success: boolean; message?: string };
  rejectStep: (approvalId: string, reason: string) => void;
  getRowApprovals: (rowId: number) => ApprovalRecord[];
  canUserApprove: (approval: ApprovalRecord) => boolean;

  // Multi-Stage Workflow Pipeline (گردش کار چند مرحله‌ای)
  advanceWorkflow: (rowId: number) => { success: boolean; message?: string };
  setWorkflowStage: (rowId: number, stage: WorkflowStageId) => void;

  // Queries & Analytics
  getRow: (id: number) => DbRow | undefined;
  getRowHistory: (rowId: number) => AuditLogEntry[];
  findDuplicateRequestNo: (requestNo: string) => DbRow[];
  findDuplicatePurchaseRequestNo: (purchaseRequestNo: string, excludeRowId?: number) => DbRow[];
  getDraftRows: () => DbRow[];
  getFilteredRows: () => DbRow[];
  getOverdueRows: () => { row: DbRow; blockingSection: any; ageDays: number }[];
  getStats: () => {
    totalRows: number;
    cancelledCount: number;
    returnedCount: number;
    fullyCompleted: number;
    departments: { color: string; title: string; completed: number; pending: number }[];
    requesterDeptStats: { label: string; completed: number; pending: number }[];
    avgCompletionDays: number | null;
  };
}

const ExactDatabaseContext = createContext<ExactDatabaseContextType | undefined>(undefined);

export const ExactDatabaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rows, setRows] = useState<DbRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DB_ROWS);
      return saved ? JSON.parse(saved) : INITIAL_DB_ROWS;
    } catch {
      return INITIAL_DB_ROWS;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VENDORS);
      return saved ? JSON.parse(saved) : INITIAL_VENDORS;
    } catch {
      return INITIAL_VENDORS;
    }
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUOTATIONS);
      return saved ? JSON.parse(saved) : INITIAL_QUOTATIONS;
    } catch {
      return INITIAL_QUOTATIONS;
    }
  });

  const [approvals, setApprovals] = useState<ApprovalRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPROVALS);
      return saved ? JSON.parse(saved) : INITIAL_APPROVALS;
    } catch {
      return INITIAL_APPROVALS;
    }
  });

  // نشست ورود از لحظه‌ی لاگین ۲ ساعت معتبر است (نه از آخرین فعالیت) - مثل سرویس اصلی.
  // قبلاً در نبود نشست، کاربر به‌صورت خودکار به‌عنوان ادمین وارد می‌شد؛ حالا بدون
  // نشست معتبر همیشه صفحه‌ی ورود نمایش داده می‌شود.
  const [session, setSession] = useState<{ user: UserSession; loginAt: number } | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as { username?: string; loginAt?: number } | null;
      if (!parsed || !parsed.username || !parsed.loginAt) return null;
      if (Date.now() - parsed.loginAt >= SESSION_HOURS * 3600 * 1000) return null;
      const match = SAMPLE_USERS.find((u) => u.username === parsed.username);
      return match ? { user: match, loginAt: parsed.loginAt } : null;
    } catch {
      return null;
    }
  });
  const currentUser: UserSession | null = session ? session.user : null;
  const sessionExpiresAt = session ? session.loginAt + SESSION_HOURS * 3600 * 1000 : null;

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [isLdapModalOpen, setIsLdapModalOpen] = useState(false);
  const [cancelModalRowId, setCancelModalRowId] = useState<number | null>(null);
  const [returnModalRowId, setReturnModalRowId] = useState<number | null>(null);
  const [historyDrawerRowId, setHistoryDrawerRowId] = useState<number | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    requesterDept: '',
    priority: '',
    purchaseExecutor: '',
    itemType: '',
    status: 'all',
    incompleteDept: '',
    incompleteRequesterDept: '',
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DB_ROWS, JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotations));
  }, [quotations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
  }, [approvals]);

  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem(
          STORAGE_KEYS.USER,
          JSON.stringify({ username: session.user.username, loginAt: session.loginAt })
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [session]);

  // پایان خودکار نشست بعد از SESSION_HOURS ساعت از لحظه‌ی ورود
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      if (Date.now() - session.loginAt >= SESSION_HOURS * 3600 * 1000) {
        setSession(null);
        setActiveTab('dashboard');
        setSelectedRowId(null);
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, [session]);

  // تأییدات چندمرحله‌ای فقط در ماژول آزمایشی: برای ردیف‌های بدون رکورد تأیید، پس از رندر
  // (نه در حین رندر) ساخته می‌شوند.
  useEffect(() => {
    if (!ENABLE_EXTENDED_WORKFLOW) return;
    const missing = rows.filter((r) => r.published_at && !approvals.some((a) => a.rowId === r.id));
    if (missing.length === 0) return;
    setApprovals((prev) => [
      ...prev,
      ...missing.flatMap((r) => createDefaultApprovals(r.id, r.priority, r.total_estimated_amount || 0)),
    ]);
  }, [rows, approvals]);

  // Permission evaluations (معادل middleware.js سرویس اصلی)
  const isLocalAdmin = Boolean(currentUser && currentUser.isLocalAdmin);
  const isAdmin = Boolean(currentUser && (currentUser.groups.includes(GROUPS.admin) || isLocalAdmin));
  const isManagement = Boolean(currentUser && (isAdmin || currentUser.groups.includes(GROUPS.management)));
  const canReturnToTechOffice = Boolean(currentUser && (isAdmin || currentUser.groups.includes(GROUPS.warehouse)));

  const canCreateRows = Boolean(currentUser && (isAdmin || sections.some(s => s.canCreateRows && (
    Array.isArray(s.group) ? s.group.some(g => currentUser.groups.includes(g)) : currentUser.groups.includes(s.group)
  ))));

  const canEditRequesterRow = (row: DbRow): boolean => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    const dept = requesterDepartments.find((d) => d.label === row.requester_dept);
    if (!dept) return false;
    return currentUser.groups.includes(dept.group);
  };

  const canEditSection = (sectionKey: string): boolean => {
    if (!currentUser) return false;
    const sec = findSection(sectionKey);
    if (!sec) return false;
    if (isAdmin) return true;
    const groups = Array.isArray(sec.group) ? sec.group : [sec.group];
    return groups.some((g) => currentUser.groups.includes(g));
  };

  const canEditSectionForRow = (row: DbRow, sectionKey: string): boolean => {
    if (!currentUser) return false;
    if (row.deleted_at || row.cancelled_at) return false;
    if (row.returned_at && sectionKey !== 'tech_operator') return false;
    // پیش‌نویس هنوز در فهرست مشترک نیست: فقط سازنده‌اش (یا ادمین) می‌تواند ویرایشش کند
    if (!row.published_at && row.created_by_username !== currentUser.username && !isAdmin) return false;
    return sectionKey === 'tech_operator' ? canEditRequesterRow(row) : canEditSection(sectionKey);
  };

  const canCancelRow = (row: DbRow): boolean => {
    if (!currentUser) return false;
    if (row.deleted_at) return false;
    if (isAdmin) return true;
    const isAnyReq = requesterDepartments.some(d => currentUser.groups.includes(d.group));
    if (!isAnyReq) return false;
    return canEditRequesterRow(row);
  };

  const startSession = (user: UserSession) => {
    setSession({ user, loginAt: Date.now() });
    setActiveTab('dashboard');
    setSelectedRowId(null);
  };

  const login = (username: string, password = '', mode: 'ldap' | 'local' = 'local'): { success: boolean; error?: string } => {
    const cleanUser = username.trim().toLowerCase();

    // احراز هویت واقعی (LDAP / ادمین محلی) فقط با یک سرویس بک‌اند ممکن است؛ این
    // پروژه‌ی فرانت‌اند فقط در حالت دمو ورود شبیه‌سازی‌شده دارد.
    if (!DEMO_MODE) {
      return { success: false, error: 'ورود واقعی نیازمند اتصال به سرویس بک‌اند (LDAP) است و در این نسخه فعال نشده است.' };
    }
    if (!cleanUser || !password) {
      return { success: false, error: 'نام کاربری و کلمه عبور را وارد کنید.' };
    }

    const matched = SAMPLE_USERS.find((u) => u.username.toLowerCase() === cleanUser);
    if (!matched) {
      return { success: false, error: 'نام کاربری یا کلمه عبور اشتباه است.' };
    }

    if (mode === 'local') {
      // ادمین محلی: مستقل از LDAP؛ رمز (دمو) admin
      if (!matched.isLocalAdmin || password !== 'admin') {
        return { success: false, error: 'نام کاربری یا رمز ادمین محلی اشتباه است.' };
      }
      startSession(matched);
      return { success: true };
    }

    if (matched.isLocalAdmin) {
      return { success: false, error: 'این حساب محلی است؛ از تب «ورود ادمین محلی» وارد شوید.' };
    }
    // مثل سرویس اصلی: حتی با رمز درست، فقط عضو حداقل یکی از گروه‌های مجاز اجازه‌ی ورود دارد
    if (!matched.groups.some((g) => ALLOWED_LOGIN_GROUPS.includes(g))) {
      return { success: false, error: 'شما عضو هیچ‌کدام از گروه‌های مجاز این سرویس نیستید. با مدیر سیستم تماس بگیرید.' };
    }
    startSession(matched);
    return { success: true };
  };

  const logout = () => {
    setSession(null);
    setActiveTab('dashboard');
    setSelectedRowId(null);
  };

  const switchUser = (username: string) => {
    if (!DEMO_MODE) return;
    const target = SAMPLE_USERS.find(u => u.username === username);
    if (target) {
      startSession(target);
    }
  };

  const resetToPrinstineData = () => {
    if (!DEMO_MODE) return;
    setRows(INITIAL_DB_ROWS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setVendors(INITIAL_VENDORS);
    setQuotations(INITIAL_QUOTATIONS);
    setApprovals(INITIAL_APPROVALS);
    localStorage.removeItem(STORAGE_KEYS.DB_ROWS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.VENDORS);
    localStorage.removeItem(STORAGE_KEYS.QUOTATIONS);
    localStorage.removeItem(STORAGE_KEYS.APPROVALS);
  };

  // RFQ & Vendor Operations (ویژگی ۱)
  const canManageCommercial = canEditSection('commercial');

  const addVendor = (vendorData: Omit<Vendor, 'id'>): Vendor => {
    if (!canManageCommercial) throw new Error('فقط بازرگانی غدیر مجاز به مدیریت تأمین‌کنندگان است.');
    const id = `VND-${String(Math.max(0, ...vendors.map(v => parseInt(v.id.replace(/\D/g, ''), 10) || 0)) + 1).padStart(3, '0')}`;
    const newVendor: Vendor = { ...vendorData, id };
    setVendors(prev => [newVendor, ...prev]);
    return newVendor;
  };

  const updateVendor = (id: string, updates: Partial<Vendor>) => {
    if (!canManageCommercial) return;
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVendor = (id: string) => {
    if (!canManageCommercial) return;
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  const rowAcceptsEdits = (rowId: number, sectionKey: string): boolean => {
    const r = rows.find((x) => x.id === rowId);
    return Boolean(r && canEditSectionForRow(r, sectionKey));
  };

  const addQuotation = (quoteData: Omit<Quotation, 'id' | 'createdAt' | 'createdBy'>): Quotation => {
    if (!rowAcceptsEdits(quoteData.rowId, 'commercial')) throw new Error('امکان ثبت پیش‌فاکتور برای این درخواست وجود ندارد.');
    const id = `QT-${Date.now().toString().slice(-6)}`;
    const newQuote: Quotation = {
      ...quoteData,
      id,
      createdAt: nowJalaliDateTime(),
      createdBy: currentUser ? currentUser.displayName : 'کاربر بازرگانی',
      status: 'pending',
    };
    setQuotations(prev => [newQuote, ...prev]);

    // Update row estimated cost if it's the first quote
    setRows(prev => prev.map(r => {
      if (r.id === quoteData.rowId && !r.total_estimated_amount) {
        return {
          ...r,
          total_estimated_amount: newQuote.totalPrice,
        };
      }
      return r;
    }));

    return newQuote;
  };

  const selectWinningQuotation = (quoteId: string) => {
    const quote = quotations.find(q => q.id === quoteId);
    if (!quote || !rowAcceptsEdits(quote.rowId, 'commercial')) return;

    setQuotations(prev => prev.map(q => {
      if (q.rowId === quote.rowId) {
        return { ...q, status: q.id === quoteId ? 'selected' : 'rejected' };
      }
      return q;
    }));

    // Update target row with winning vendor and total estimated amount
    setRows(prev => prev.map(r => {
      if (r.id === quote.rowId) {
        return {
          ...r,
          selected_quote_id: quote.id,
          selected_vendor_name: quote.vendorName,
          total_estimated_amount: quote.totalPrice,
          workflow_stage: r.workflow_stage === 'commercial_rfq' ? 'financial_approval' : r.workflow_stage,
        };
      }
      return r;
    }));
  };

  const deleteQuotation = (quoteId: string) => {
    const quote = quotations.find(q => q.id === quoteId);
    if (!quote || !rowAcceptsEdits(quote.rowId, 'commercial')) return;
    setQuotations(prev => prev.filter(q => q.id !== quoteId));
  };

  const getRowQuotations = (rowId: number): Quotation[] => {
    return quotations.filter(q => q.rowId === rowId);
  };

  // Multi-level Approvals & Digital Signature (ویژگی ۴)
  const getRowApprovals = (rowId: number): ApprovalRecord[] => approvals.filter(a => a.rowId === rowId);

  const canUserApprove = (approval: ApprovalRecord): boolean => {
    if (!currentUser) return false;
    return canUserApproveStep(currentUser, approval);
  };

  const approveStep = (approvalId: string, comment?: string): { success: boolean; message?: string } => {
    if (!currentUser) return { success: false, message: 'کاربر وارد سیستم نشده است.' };
    const approval = approvals.find(a => a.id === approvalId);
    if (!approval) return { success: false, message: 'مرحله تایید یافت نشد.' };

    if (!canUserApproveStep(currentUser, approval)) {
      return { success: false, message: 'شما دسترسی مجاز برای امضا و تایید این مرحله را ندارید.' };
    }
    const targetRow = rows.find(r => r.id === approval.rowId);
    if (!targetRow || targetRow.deleted_at || !targetRow.published_at) {
      return { success: false, message: 'این درخواست در دسترس نیست.' };
    }
    if (targetRow.cancelled_at || targetRow.returned_at) {
      return { success: false, message: 'درخواست لغو یا عودت داده شده است؛ امکان تأیید وجود ندارد.' };
    }
    if (approval.status !== 'pending') {
      return { success: false, message: 'این مرحله قبلاً بررسی شده است.' };
    }

    const signature = generateDigitalSignature(approval.rowId, currentUser.username, approval.roleKey);
    const now = nowJalaliDateTime();

    setApprovals(prev => prev.map(a => {
      if (a.id === approvalId) {
        return {
          ...a,
          status: 'approved',
          approvedByUsername: currentUser.username,
          approvedByDisplay: currentUser.displayName,
          approvedAt: now,
          digitalSignatureHash: signature,
          comment: comment || a.comment,
        };
      }
      return a;
    }));

    // Update row status
    const rowApprovals = approvals.map(a => a.id === approvalId ? { ...a, status: 'approved' as const } : a).filter(a => a.rowId === approval.rowId);
    const allApproved = rowApprovals.every(a => a.status === 'approved');
    appendAudit([{ row_id: approval.rowId, section_key: 'approvals', field_key: `approval_${approval.roleKey}`, field_label: approval.title, old_value: 'در انتظار', new_value: `تأیید شد${comment ? ' - ' + comment : ''}` }], now);
    setRows(prev => prev.map(r => {
      if (r.id === approval.rowId) {
        return {
          ...r,
          approvals_status: allApproved ? 'approved' : 'partially_approved',
          workflow_stage: allApproved && r.workflow_stage === 'financial_approval' ? 'final_dispatch' : r.workflow_stage,
        };
      }
      return r;
    }));

    return { success: true };
  };

  const rejectStep = (approvalId: string, reason: string) => {
    if (!currentUser) return;
    const approval = approvals.find(a => a.id === approvalId);
    if (!approval || approval.status !== 'pending' || !canUserApproveStep(currentUser, approval)) return;
    const targetRow = rows.find(r => r.id === approval.rowId);
    if (!targetRow || targetRow.deleted_at || targetRow.cancelled_at || targetRow.returned_at) return;
    const now = nowJalaliDateTime();

    setApprovals(prev => prev.map(a => {
      if (a.id === approvalId) {
        return {
          ...a,
          status: 'rejected',
          approvedByUsername: currentUser.username,
          approvedByDisplay: currentUser.displayName,
          approvedAt: now,
          rejectionReason: reason,
        };
      }
      return a;
    }));

    appendAudit([{ row_id: approval.rowId, section_key: 'approvals', field_key: `approval_${approval.roleKey}`, field_label: approval.title, old_value: 'در انتظار', new_value: `رد شد - دلیل: ${reason}` }], now);
    setRows(prev => prev.map(r => r.id === approval.rowId ? { ...r, approvals_status: 'rejected' } : r));
  };

  // Multi-Stage Workflow Pipeline (گردش کار چند مرحله‌ای)
  const advanceWorkflow = (rowId: number): { success: boolean; message?: string } => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return { success: false, message: 'ردیف یافت نشد.' };
    if (!currentUser) return { success: false, message: 'ابتدا وارد سامانه شوید.' };

    const rowApprovals = approvals.filter(a => a.rowId === rowId);
    const check = canAdvanceWorkflow(row, currentUser, rowApprovals);
    if (!check.allowed) {
      return { success: false, message: check.reason };
    }

    if (check.nextStage) {
      appendAudit([{ row_id: rowId, section_key: 'workflow', field_key: 'workflow_stage', field_label: 'مرحله‌ی گردش‌کار', old_value: inferStageFromRow(row), new_value: check.nextStage }], nowJalaliDateTime());
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, workflow_stage: check.nextStage } : r));
      return { success: true };
    }
    return { success: false, message: 'مرحله بعدی تعیین نشده است.' };
  };

  const setWorkflowStage = (rowId: number, stage: WorkflowStageId) => {
    if (!isAdmin) return;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, workflow_stage: stage } : r));
  };

  const getRow = (id: number): DbRow | undefined => {
    return rows.find(r => r.id === id);
  };

  const getRowHistory = (rowId: number): AuditLogEntry[] => {
    return auditLogs.filter(a => a.row_id === rowId).sort((a, b) => b.id - a.id);
  };

  const findDuplicateRequestNo = (requestNo: string): DbRow[] => {
    const normalized = normalizeForDuplicateCheck(requestNo);
    if (!normalized) return [];
    return rows.filter(r => !r.deleted_at && normalizeForDuplicateCheck(r.request_no) === normalized);
  };

  const findDuplicatePurchaseRequestNo = (purchaseRequestNo: string, excludeRowId?: number): DbRow[] => {
    const normalized = normalizeForDuplicateCheck(purchaseRequestNo);
    if (!normalized) return [];
    return rows.filter(
      r => !r.deleted_at && r.id !== excludeRowId && normalizeForDuplicateCheck(r.purchase_request_no) === normalized
    );
  };

  const getDraftRows = (): DbRow[] => {
    if (!currentUser) return [];
    return rows.filter(r => r.created_by_username === currentUser.username && !r.published_at && !r.deleted_at);
  };

  // ---------- Audit ----------
  // تغییرات ادمین محلی (break-glass) عمداً هیچ‌وقت در تاریخچه ثبت نمی‌شود (مثل سرویس اصلی)
  type AuditDraft = Omit<AuditLogEntry, 'id' | 'changed_by_username' | 'changed_by_display' | 'changed_at'>;
  const appendAudit = (drafts: AuditDraft[], changedAt: string) => {
    if (!currentUser || currentUser.isLocalAdmin || drafts.length === 0) return;
    const who = currentUser;
    setAuditLogs(prev => {
      let id = prev.length > 0 ? Math.max(...prev.map(a => a.id)) + 1 : 1;
      const entries: AuditLogEntry[] = drafts.map(d => ({
        ...d,
        id: id++,
        changed_by_username: who.username,
        changed_by_display: who.displayName,
        changed_at: changedAt,
      }));
      return [...entries, ...prev];
    });
  };

  const actorFields = () => ({
    username: currentUser ? currentUser.username : '',
    display: currentUser ? currentUser.displayName : '',
  });

  // DB Operations
  // هر ردیفی که ساخته می‌شود ابتدا «پیش‌نویس» است (published_at خالی) و فقط با «ثبت نهایی»
  // وارد فهرست مشترک می‌شود - مثل سرویس اصلی.
  const createRow = (values: Partial<DbRow>): { row: DbRow | null; errors: string[]; isDuplicate: boolean } => {
    if (!currentUser || !canCreateRows) {
      return { row: null, errors: ['شما مجاز به ثبت درخواست جدید نیستید (فقط درخواست‌کننده).'], isDuplicate: false };
    }
    const sec = findSection('tech_operator')!;
    const { values: clean, errors } = validateFieldValues(sec.fields, values as Record<string, unknown>);
    if (errors.length) return { row: null, errors, isDuplicate: false };

    const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    const createdAt = nowJalaliDateTime();
    const duplicates = findDuplicateRequestNo(clean.request_no);
    const { username, display } = actorFields();

    const newRow: DbRow = {
      id: nextId,
      created_by_username: username,
      created_by_display: display,
      created_at: createdAt,
      request_no: clean.request_no,
      item_description: clean.item_description,
      priority: clean.priority as DbRow['priority'],
      total_qty: clean.total_qty,
      unit: clean.unit,
      usage_location: clean.usage_location,
      delivery_to_warehouse_date: clean.delivery_to_warehouse_date,
      item_type: clean.item_type as DbRow['item_type'],
      // دپارتمان همیشه از عضویت گروهی کاربر تشخیص داده می‌شود؛ هرگز از ورودی فرم
      requester_dept: resolveRequesterDept(currentUser) as DbRow['requester_dept'],
      purchase_request_no: '',
      delivered_to_tech_expert_date: '',
      delivered_to_employer_date: '',
      factory_arrival_date: '',
      referred_to_commercial_date: '',
      purchase_executor: '',
      payment_auth_issued_date: '',
      letter_no: '',
      dispatch_date: '',
      deleted_at: '',
      deleted_by_username: '',
      deleted_by_display: '',
      cancelled_at: '',
      cancelled_by_username: '',
      cancelled_by_display: '',
      cancel_reason: '',
      returned_at: '',
      returned_by_username: '',
      returned_by_display: '',
      return_reason: '',
      published_at: '',
      workflow_stage: 'tech_request',
    };

    setRows(prev => [newRow, ...prev]);

    appendAudit(
      sec.fields
        .filter(f => newRow[f.name])
        .map(f => ({
          row_id: nextId,
          section_key: 'tech_operator',
          field_key: f.name,
          field_label: f.label,
          old_value: '',
          new_value: String(newRow[f.name]),
        })),
      createdAt
    );

    return { row: newRow, errors: [], isDuplicate: duplicates.length > 0 };
  };

  const updateSection = (rowId: number, sectionKey: string, values: Record<string, string>): { ok: boolean; errors: string[]; values?: Record<string, string> } => {
    const sec = findSection(sectionKey);
    const target = rows.find(r => r.id === rowId);
    if (!sec || !target) return { ok: false, errors: ['ردیف یا بخش نامعتبر است.'] };
    if (!canEditSectionForRow(target, sectionKey)) {
      return { ok: false, errors: [`شما مجاز به ویرایش «${sec.title}» در این ردیف نیستید (یا ردیف قفل است).`] };
    }

    // اگر مجری خرید تهران/برنا باشد، تاریخ مجوز پرداخت اصلاً قابل ویرایش نیست
    const waived = isPaymentAuthWaived({ ...target, purchase_executor: (values.purchase_executor ?? target.purchase_executor) as DbRow['purchase_executor'] });
    const editable = sec.fields.filter(f => !f.readOnly && !(f.name === 'payment_auth_issued_date' && waived));
    const { values: clean, errors } = validateFieldValues(editable, values);
    if (errors.length) return { ok: false, errors };

    const changedAt = nowJalaliDateTime();
    const drafts: AuditDraft[] = [];
    const updatedRow = { ...target } as DbRow;

    for (const field of editable) {
      const oldVal = (target[field.name] || '').toString();
      const newVal = clean[field.name];
      if (newVal !== oldVal) {
        (updatedRow as any)[field.name] = newVal;
        drafts.push({
          row_id: rowId,
          section_key: sectionKey,
          field_key: field.name,
          field_label: field.label,
          old_value: oldVal,
          new_value: newVal,
        });
      }
    }

    if (drafts.length > 0) {
      setRows(prev => prev.map(r => r.id === rowId ? updatedRow : r));
      appendAudit(drafts, changedAt);
    }
    return { ok: true, errors: [], values: clean };
  };

  const finalizeDrafts = (rowIds?: number[]) => {
    if (!currentUser) return;
    const targets = rows.filter(
      r => r.created_by_username === currentUser.username && !r.published_at && !r.deleted_at && (!rowIds || rowIds.includes(r.id))
    );
    if (targets.length === 0) return;
    const publishedAt = nowJalaliDateTime();
    const ids = new Set(targets.map(r => r.id));
    setRows(prev => prev.map(r => (ids.has(r.id) ? { ...r, published_at: publishedAt } : r)));
    appendAudit(
      targets.map(r => ({
        row_id: r.id,
        section_key: 'tech_operator',
        field_key: 'published_at',
        field_label: 'وضعیت ثبت',
        old_value: 'پیش‌نویس',
        new_value: 'ثبت نهایی شد',
      })),
      publishedAt
    );
  };

  // حذف کامل (نه نرم) یک پیش‌نویس - فقط سازنده یا ادمین، و فقط تا وقتی ثبت نهایی نشده
  const discardDraft = (rowId: number): boolean => {
    if (!currentUser) return false;
    const target = rows.find(r => r.id === rowId);
    if (!target || target.published_at) return false;
    if (target.created_by_username !== currentUser.username && !isAdmin) return false;
    setRows(prev => prev.filter(r => r.id !== rowId));
    setAuditLogs(prev => prev.filter(a => a.row_id !== rowId));
    setApprovals(prev => prev.filter(a => a.rowId !== rowId));
    setQuotations(prev => prev.filter(q => q.rowId !== rowId));
    return true;
  };

  // حذف نرم فقط برای ادمین محلی (و بدون ثبت در تاریخچه)
  const softDeleteRow = (rowId: number) => {
    if (!currentUser || !currentUser.isLocalAdmin) return;
    const deletedAt = nowJalaliDateTime();
    const { username, display } = actorFields();
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, deleted_at: deletedAt, deleted_by_username: username, deleted_by_display: display } : r
    ));
  };

  const restoreRow = (rowId: number) => {
    if (!currentUser || !currentUser.isLocalAdmin) return;
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, deleted_at: '', deleted_by_username: '', deleted_by_display: '' } : r
    ));
  };

  const statusLog = (rowId: number, sectionKey: string, fieldKey: string, oldValue: string, newValue: string): AuditDraft => ({
    row_id: rowId,
    section_key: sectionKey,
    field_key: fieldKey,
    field_label: 'وضعیت درخواست',
    old_value: oldValue,
    new_value: newValue,
  });

  // لغو: دلیل الزامی؛ با «عودت» ناسازگار است (تا وقتی یکی فعال است دیگری ممکن نیست)
  const cancelRow = (rowId: number, reason: string): boolean => {
    const target = rows.find(r => r.id === rowId);
    const cleanReason = reason.trim();
    if (!target || !currentUser || !cleanReason) return false;
    if (!canCancelRow(target) || target.cancelled_at || target.returned_at) return false;
    const cancelledAt = nowJalaliDateTime();
    const { username, display } = actorFields();
    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r, cancelled_at: cancelledAt, cancelled_by_username: username, cancelled_by_display: display, cancel_reason: cleanReason,
    } : r));
    appendAudit([statusLog(rowId, 'tech_operator', 'cancel_reason', 'فعال', `لغو شد - دلیل: ${cleanReason}`)], cancelledAt);
    return true;
  };

  const uncancelRow = (rowId: number): boolean => {
    const target = rows.find(r => r.id === rowId);
    if (!target || !currentUser || !canCancelRow(target) || !target.cancelled_at) return false;
    const changedAt = nowJalaliDateTime();
    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r, cancelled_at: '', cancelled_by_username: '', cancelled_by_display: '', cancel_reason: '',
    } : r));
    appendAudit([statusLog(rowId, 'tech_operator', 'cancel_reason', 'لغو شد', 'بازگردانده شد (فعال)')], changedAt);
    return true;
  };

  // عودت: فقط انبار کارفرما/ادمین؛ دلیل اختیاری
  const returnToTechOffice = (rowId: number, reason: string): boolean => {
    const target = rows.find(r => r.id === rowId);
    if (!target || !currentUser || !canReturnToTechOffice || target.deleted_at) return false;
    if (target.cancelled_at || target.returned_at) return false;
    const cleanReason = reason.trim();
    const returnedAt = nowJalaliDateTime();
    const { username, display } = actorFields();
    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r, returned_at: returnedAt, returned_by_username: username, returned_by_display: display, return_reason: cleanReason,
    } : r));
    appendAudit([statusLog(rowId, 'warehouse_1', 'return_reason', 'فعال',
      cleanReason ? `عودت به درخواست‌کننده - دلیل: ${cleanReason}` : 'عودت به درخواست‌کننده')], returnedAt);
    return true;
  };

  const unreturnFromTechOffice = (rowId: number): boolean => {
    const target = rows.find(r => r.id === rowId);
    if (!target || !currentUser || !canReturnToTechOffice || !target.returned_at) return false;
    const changedAt = nowJalaliDateTime();
    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r, returned_at: '', returned_by_username: '', returned_by_display: '', return_reason: '',
    } : r));
    appendAudit([statusLog(rowId, 'warehouse_1', 'return_reason', 'عودت به درخواست‌کننده', 'بازگردانده شد (فعال)')], changedAt);
    return true;
  };

  const getFilteredRows = (): DbRow[] => {
    return rows.filter(row => {
      // Must not be deleted and must be published
      if (row.deleted_at || !row.published_at) return false;

      // Status filter
      if (filters.status === 'active' && (row.cancelled_at || row.returned_at)) return false;
      if (filters.status === 'cancelled' && !row.cancelled_at) return false;
      if (filters.status === 'returned' && (row.cancelled_at || !row.returned_at)) return false;

      if (filters.requesterDept && row.requester_dept !== filters.requesterDept) return false;
      if (filters.priority && row.priority !== filters.priority) return false;
      if (filters.purchaseExecutor && row.purchase_executor !== filters.purchaseExecutor) return false;
      if (filters.itemType && row.item_type !== filters.itemType) return false;

      if (filters.incompleteDept) {
        const dept = DEPARTMENTS.find(d => d.color === filters.incompleteDept);
        if (dept) {
          const hasEmpty = dept.fields.some(f => !row[f.name]);
          if (!hasEmpty || row.cancelled_at || row.returned_at) return false;
        }
      }

      if (filters.incompleteRequesterDept) {
        if (row.requester_dept !== filters.incompleteRequesterDept) return false;
        const techFields = findSection('tech_operator')!.fields.filter(f => !f.readOnly);
        const hasEmpty = techFields.some(f => !row[f.name]);
        if (!hasEmpty || row.cancelled_at || row.returned_at) return false;
      }

      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const match = 
          row.request_no.toLowerCase().includes(q) ||
          row.item_description.toLowerCase().includes(q) ||
          row.purchase_request_no.toLowerCase().includes(q) ||
          row.usage_location.toLowerCase().includes(q) ||
          row.letter_no.toLowerCase().includes(q) ||
          row.created_by_display.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  };

  const getOverdueRows = () => {
    const activeRows = rows.filter(r => !r.deleted_at && r.published_at && !r.cancelled_at && !r.returned_at);
    const items: { row: DbRow; blockingSection: any; ageDays: number }[] = [];

    for (const row of activeRows) {
      const blocking = currentBlockingSection(row);
      if (!blocking) continue;
      const age = daysSinceJalali(row.created_at);
      if (age === null || age <= OVERDUE_DAYS) continue;
      items.push({ row, blockingSection: blocking, ageDays: Math.round(age * 10) / 10 });
    }

    items.sort((a, b) => b.ageDays - a.ageDays);
    return items;
  };

  const getStats = () => {
    const allPublished = rows.filter(r => !r.deleted_at && r.published_at);
    const activeRows = allPublished.filter(r => !r.cancelled_at && !r.returned_at);

    // Compute last change per row
    const lastChangeByRow = new Map<number, string>();
    auditLogs.forEach(a => {
      const current = lastChangeByRow.get(a.row_id);
      if (!current || a.changed_at > current) {
        lastChangeByRow.set(a.row_id, a.changed_at);
      }
    });

    const departments = DEPARTMENTS.filter(d => d.color !== 'tech_operator').map(dept => {
      const completed = activeRows.filter(r => isFieldSetComplete(r, fieldsForCompletion(r, dept.fields))).length;
      return { color: dept.color, title: dept.title, completed, pending: activeRows.length - completed };
    });

    const techFields = findSection('tech_operator')!.fields.filter(f => !f.readOnly);
    const requesterDeptStats = requesterDepartments.map(dept => {
      const deptRows = activeRows.filter(r => r.requester_dept === dept.label);
      const completed = deptRows.filter(r => isFieldSetComplete(r, techFields)).length;
      return { label: dept.label, completed, pending: deptRows.length - completed };
    });

    let fullyCompleted = 0;
    let totalDays = 0;
    let daysSampleCount = 0;

    for (const row of activeRows) {
      if (!isRowComplete(row)) continue;
      fullyCompleted++;
      const lastChanged = lastChangeByRow.get(row.id);
      const days = lastChanged ? daysBetweenJalali(row.created_at, lastChanged) : null;
      if (days !== null && days >= 0) {
        totalDays += days;
        daysSampleCount++;
      }
    }

    return {
      totalRows: allPublished.length,
      cancelledCount: allPublished.filter(r => r.cancelled_at).length,
      returnedCount: allPublished.filter(r => !r.cancelled_at && r.returned_at).length,
      fullyCompleted,
      departments,
      requesterDeptStats,
      avgCompletionDays: daysSampleCount ? Math.round((totalDays / daysSampleCount) * 10) / 10 : null,
    };
  };

  return (
    <ExactDatabaseContext.Provider
      value={{
        rows,
        auditLogs,
        vendors,
        quotations,
        approvals,
        currentUser,
        allUsers: SAMPLE_USERS,
        activeTab,
        selectedRowId,
        filters,
        isLdapModalOpen,
        cancelModalRowId,
        returnModalRowId,
        historyDrawerRowId,
        login,
        logout,
        setActiveTab,
        setSelectedRowId,
        setFilters,
        setIsLdapModalOpen,
        setCancelModalRowId,
        setReturnModalRowId,
        setHistoryDrawerRowId,
        switchUser,
        sessionExpiresAt,
        resetToPrinstineData,
        isAdmin,
        isLocalAdmin,
        isManagement,
        canCreateRows,
        canEditSectionForRow,
        canCancelRow,
        canReturnToTechOffice,
        createRow,
        updateSection,
        finalizeDrafts,
        discardDraft,
        softDeleteRow,
        restoreRow,
        cancelRow,
        uncancelRow,
        returnToTechOffice,
        unreturnFromTechOffice,
        addVendor,
        updateVendor,
        deleteVendor,
        addQuotation,
        selectWinningQuotation,
        deleteQuotation,
        getRowQuotations,
        approveStep,
        rejectStep,
        getRowApprovals,
        canUserApprove,
        advanceWorkflow,
        setWorkflowStage,
        getRow,
        getRowHistory,
        findDuplicateRequestNo,
        findDuplicatePurchaseRequestNo,
        getDraftRows,
        getFilteredRows,
        getOverdueRows,
        getStats,
      }}
    >
      {children}
    </ExactDatabaseContext.Provider>
  );
};

export const useExactDb = () => {
  const ctx = useContext(ExactDatabaseContext);
  if (!ctx) throw new Error('useExactDb must be used within ExactDatabaseProvider');
  return ctx;
};
