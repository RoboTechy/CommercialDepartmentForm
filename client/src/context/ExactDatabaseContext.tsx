import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  DbRow,
  AuditLogEntry,
  UserSession,
  ActiveTab,
  RequesterDept,
  Vendor,
  Quotation,
  ApprovalRecord,
  WorkflowStageId,
} from '../types';
import { sections, findSection, requesterDepartments, isPaymentAuthWaived } from '../data/exactSections';
import { daysSinceJalali, daysBetweenJalali } from '../utils/exactJalaali';
import { canUserApproveStep } from '../utils/workflowEngine';
import {
  isFieldSetComplete,
  fieldsForCompletion,
  isRowComplete,
  currentBlockingSection,
  normalizeForDuplicateCheck,
  incompleteSectionBefore,
  DEPARTMENTS,
} from '../store/exactStore';
import { GROUPS, OVERDUE_DAYS } from '../config';
import { api, ApiError } from '../api/client';

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

interface Toast {
  type: 'error' | 'success' | 'info';
  message: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface ExactDatabaseContextType {
  rows: DbRow[];
  auditLogs: AuditLogEntry[];
  vendors: Vendor[];
  quotations: Quotation[];
  quotationCount: (rowId: number) => number;
  notify: (type: 'error' | 'success' | 'info', message: string) => void;
  approvals: ApprovalRecord[];
  currentUser: UserSession | null;
  booting: boolean;
  loading: boolean;
  // true بعد از اولین دریافت فهرست از سرور (تا آن موقع «خالی» نشان داده نمی‌شود)
  dataLoaded: boolean;
  toast: Toast | null;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  activeTab: ActiveTab;
  selectedRowId: number | null;
  filters: FilterState;
  isLdapModalOpen: boolean;
  cancelModalRowId: number | null;
  returnModalRowId: number | null;
  historyDrawerRowId: number | null;

  // Auth & Session
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  sessionExpiresAt: number | null;

  // Setters
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedRowId: (id: number | null) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  setIsLdapModalOpen: (open: boolean) => void;
  setCancelModalRowId: (id: number | null) => void;
  setReturnModalRowId: (id: number | null) => void;
  setHistoryDrawerRowId: (id: number | null) => void;

  // Permission checks (فقط برای نمایش؛ سرور هر درخواست را دوباره بررسی می‌کند)
  isAdmin: boolean;
  isLocalAdmin: boolean;
  isManagement: boolean;
  canViewAuditLogs: boolean;
  canCreateRows: boolean;
  canEditSectionForRow: (row: DbRow, sectionKey: string) => boolean;
  // اگر بخشی به‌خاطر ناقص‌بودن بخش قبلی قفل است، دلیلش (وگرنه null)
  sectionLockReason: (row: DbRow, sectionKey: string) => string | null;
  canCancelRow: (row: DbRow) => boolean;
  canReturnToTechOffice: boolean;

  // DB actions (همه با بک‌اند)
  createRow: (values: Partial<DbRow>) => Promise<{ row: DbRow | null; errors: string[]; isDuplicate: boolean }>;
  updateSection: (rowId: number, sectionKey: string, values: Record<string, string>) => Promise<{ ok: boolean; errors: string[]; values?: Record<string, string> }>;
  finalizeDrafts: (rowIds?: number[]) => Promise<boolean>;
  discardDraft: (rowId: number) => Promise<boolean>;
  softDeleteRow: (rowId: number) => Promise<boolean>;
  restoreRow: (rowId: number) => Promise<boolean>;
  cancelRow: (rowId: number, reason: string) => Promise<boolean>;
  uncancelRow: (rowId: number) => Promise<boolean>;
  returnToTechOffice: (rowId: number, reason: string) => Promise<boolean>;
  unreturnFromTechOffice: (rowId: number) => Promise<boolean>;

  // RFQ & Vendor Management
  addVendor: (vendor: Omit<Vendor, 'id'>) => Promise<Vendor | null>;
  updateVendor: (id: string, updates: Partial<Vendor>) => Promise<boolean>;
  deleteVendor: (id: string) => Promise<boolean>;
  addQuotation: (quote: Omit<Quotation, 'id' | 'createdAt' | 'createdBy' | 'status' | 'totalPrice' | 'vendorName'> & { vendorName?: string; totalPrice?: number }) => Promise<Quotation | null>;
  selectWinningQuotation: (quoteId: string) => Promise<boolean>;
  deleteQuotation: (quoteId: string) => Promise<boolean>;
  getRowQuotations: (rowId: number) => Quotation[];

  // Multi-level approvals (مهر تأیید HMAC سمت سرور)
  approveStep: (approvalId: string, comment?: string) => Promise<{ success: boolean; message?: string }>;
  rejectStep: (approvalId: string, reason: string) => Promise<boolean>;
  getRowApprovals: (rowId: number) => ApprovalRecord[];
  ensureApprovals: (rowId: number) => Promise<void>;
  canUserApprove: (approval: ApprovalRecord) => boolean;

  // Workflow pipeline
  advanceWorkflow: (rowId: number) => Promise<{ success: boolean; message?: string }>;
  setWorkflowStage: (rowId: number, stage: WorkflowStageId) => Promise<boolean>;

  // Queries & Analytics (روی داده‌ی بارگذاری‌شده از سرور)
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

interface MeResponse {
  user: UserSession;
  sessionExpiresAt: number | null;
  enforceSectionOrder?: boolean;
}

interface DataResponse {
  rows: DbRow[];
  vendors: Vendor[];
  quotations: Quotation[];
  quotationCounts?: Record<string, number>;
  approvals: ApprovalRecord[];
}

const POLL_MS = 30_000;

const ExactDatabaseContext = createContext<ExactDatabaseContextType | undefined>(undefined);

export const ExactDatabaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rows, setRows] = useState<DbRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  // جزئیات پیش‌فاکتورها فقط برای ادمین می‌آید؛ همه تعداد پیش‌فاکتور هر درخواست را می‌بینند
  const [quotationCounts, setQuotationCounts] = useState<Record<string, number>>({});
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const currentUser: UserSession | null = me ? me.user : null;
  const sessionExpiresAt = me ? me.sessionExpiresAt : null;

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

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);
  const dismissToast = () => setToast(null);
  const notify = (type: 'error' | 'success' | 'info', message: string) => showToast({ type, message });
  const quotationCount = (rowId: number): number => quotationCounts[String(rowId)] || 0;

  const clearSession = useCallback(() => {
    setMe(null);
    setRows([]);
    setAuditLogs([]);
    setVendors([]);
    setQuotations([]);
    setQuotationCounts({});
    setApprovals([]);
    setDataLoaded(false);
    setActiveTab('dashboard');
    setSelectedRowId(null);
  }, []);

  // خطای 401 (نشست منقضی/نامعتبر) → برگشت به صفحه‌ی ورود
  const handleError = useCallback(
    (e: unknown, silent = false): string => {
      const err = e instanceof ApiError ? e : new ApiError('خطای ناشناخته', 0);
      if (err.status === 401) {
        clearSession();
        showToast({ type: 'error', message: 'نشست شما به پایان رسید؛ دوباره وارد شوید.' });
      } else if (!silent) {
        showToast({ type: 'error', message: err.message });
      }
      return err.message;
    },
    [clearSession, showToast]
  );

  // فهرست (ردیف‌ها، تأمین‌کنندگان، پیش‌فاکتور، تأییدات) - سبک و فشرده
  const refreshData = useCallback(async () => {
    const d = await api<DataResponse>('GET', '/data');
    setRows(d.rows);
    setVendors(d.vendors);
    setQuotations(d.quotations);
    setQuotationCounts(d.quotationCounts || {});
    setApprovals(d.approvals);
    setDataLoaded(true);
  }, []);

  // لاگ تغییرات حجیم است و برای نمایش فهرست لازم نیست؛ جدا و در پس‌زمینه گرفته می‌شود
  const refreshLogs = useCallback(async () => {
    const d = await api<{ auditLogs: AuditLogEntry[] }>('GET', '/audit-logs');
    setAuditLogs(d.auditLogs);
  }, []);

  const refresh = useCallback(async () => {
    await refreshData();
    refreshLogs().catch(() => { /* پس‌زمینه؛ با تلاش بعدی دوباره */ });
  }, [refreshData, refreshLogs]);

  // بارگذاری اولیه: آیا نشست معتبر داریم؟
  useEffect(() => {
    (async () => {
      try {
        const m = await api<MeResponse>('GET', '/auth/me');
        setMe(m);
        await refresh();
      } catch {
        /* وارد نشده → صفحه‌ی ورود */
      } finally {
        setBooting(false);
      }
    })();
  }, [refresh]);

  // به‌روزرسانی دوره‌ای (چند کاربر هم‌زمان روی یک دیتابیس کار می‌کنند) و هنگام بازگشت به تب
  useEffect(() => {
    if (!me) return;
    let n = 0;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      n++;
      // فهرست هر ۳۰ ثانیه؛ لاگ‌ها (سنگین‌تر) هر ۲ دقیقه
      (n % 4 === 0 ? refresh() : refreshData()).catch((e) => handleError(e, true));
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [me, refresh, refreshData, handleError]);

  // پایان خودکار نشست (۲ ساعت از لحظه‌ی ورود - همان مدت سرور)
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const ms = sessionExpiresAt - Date.now();
    const t = window.setTimeout(() => {
      clearSession();
      showToast({ type: 'error', message: 'نشست شما به پایان رسید؛ دوباره وارد شوید.' });
    }, Math.max(0, Math.min(ms, 2_000_000_000)));
    return () => window.clearTimeout(t);
  }, [sessionExpiresAt, clearSession, showToast]);

  // اجرای یک عملیات نوشتن روی سرور و سپس بارگذاری دوباره‌ی داده
  async function act<T = any>(fn: () => Promise<T>, opts: { silent?: boolean } = {}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    setLoading(true);
    try {
      const data = await fn();
      await refresh();
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: handleError(e, opts.silent) };
    } finally {
      setLoading(false);
    }
  }

  // Permission evaluations (معادل middleware.js سرویس اصلی)
  const isLocalAdmin = Boolean(currentUser && currentUser.isLocalAdmin);
  const isAdmin = Boolean(currentUser && (currentUser.groups.includes(GROUPS.admin) || isLocalAdmin));
  const isManagement = Boolean(currentUser && (isAdmin || currentUser.groups.includes(GROUPS.management)));
  // صفحه‌ی «ردیابی رویدادها»: فقط ادمین‌ها و گروه آی‌تی (تاریخچه‌ی هر ردیف برای همه در دسترس است)
  const canViewAuditLogs = Boolean(currentUser && (isAdmin || currentUser.groups.includes(GROUPS.it)));
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

  // ترتیب بخش‌ها: تا بخش قبلی تکمیل نشده، بخش بعدی (جز ادمین) چیزی ثبت نمی‌کند (سرور هم همین را اعمال می‌کند)
  const sectionLockReason = (row: DbRow, sectionKey: string): string | null => {
    if (!currentUser || isAdmin || me?.enforceSectionOrder === false) return null;
    const blocker = incompleteSectionBefore(row, sectionKey);
    if (!blocker) return null;
    return `ابتدا بخش «${blocker.label}» باید تکمیل شود (فیلدهای خالی: ${blocker.missing.join('، ')}).`;
  };

  const canEditSectionForRow = (row: DbRow, sectionKey: string): boolean => {
    if (!currentUser) return false;
    if (sectionLockReason(row, sectionKey)) return false;
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

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const m = await api<MeResponse>('POST', '/auth/login', { username: username.trim(), password });
      // اول فهرست را بگیر و بعد داشبورد را نشان بده؛ وگرنه چند ثانیه «ردیفی وجود ندارد» دیده می‌شود
      await refreshData();
      setMe(m);
      setActiveTab('dashboard');
      setSelectedRowId(null);
      refreshLogs().catch(() => { /* پس‌زمینه */ });
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.message : 'ورود ناموفق بود.' };
    }
  };

  const logout = async () => {
    try {
      await api('POST', '/auth/logout');
    } catch {
      /* حتی اگر شبکه قطع بود، نشست محلی پاک شود */
    }
    clearSession();
  };

  // ---------- تأمین‌کنندگان و پیش‌فاکتورها ----------
  const addVendor = async (v: Omit<Vendor, 'id'>): Promise<Vendor | null> => {
    const r = await act(() => api<{ vendor: Vendor }>('POST', '/vendors', v));
    return r.ok ? r.data.vendor : null;
  };
  const updateVendor = async (id: string, updates: Partial<Vendor>): Promise<boolean> =>
    (await act(() => api('PUT', `/vendors/${id}`, updates))).ok;
  const deleteVendor = async (id: string): Promise<boolean> =>
    (await act(() => api('DELETE', `/vendors/${id}`))).ok;

  const addQuotation: ExactDatabaseContextType['addQuotation'] = async (q) => {
    const r = await act(() => api<{ quotation: Quotation }>('POST', '/quotations', q));
    return r.ok ? r.data.quotation : null;
  };
  const selectWinningQuotation = async (quoteId: string): Promise<boolean> =>
    (await act(() => api('POST', `/quotations/${quoteId}/select`))).ok;
  const deleteQuotation = async (quoteId: string): Promise<boolean> =>
    (await act(() => api('DELETE', `/quotations/${quoteId}`))).ok;

  const getRowQuotations = (rowId: number): Quotation[] => {
    return quotations.filter(q => q.rowId === rowId);
  };


  // ---------- تأییدات چندمرحله‌ای ----------
  const getRowApprovals = (rowId: number): ApprovalRecord[] => approvals.filter(a => a.rowId === rowId);

  const canUserApprove = (approval: ApprovalRecord): boolean => {
    if (!currentUser) return false;
    return canUserApproveStep(currentUser, approval);
  };

  const ensureApprovals = async (rowId: number): Promise<void> => {
    try {
      await api('POST', `/rows/${rowId}/approvals/init`);
      await refresh();
    } catch (e) {
      handleError(e, true);
    }
  };

  const approveStep = async (approvalId: string, comment?: string): Promise<{ success: boolean; message?: string }> => {
    const r = await act(() => api('POST', `/approvals/${approvalId}/approve`, { comment }), { silent: true });
    return r.ok ? { success: true } : { success: false, message: r.error };
  };
  const rejectStep = async (approvalId: string, reason: string): Promise<boolean> =>
    (await act(() => api('POST', `/approvals/${approvalId}/reject`, { reason }))).ok;

  // ---------- گردش‌کار مرحله‌ای ----------
  const advanceWorkflow = async (rowId: number): Promise<{ success: boolean; message?: string }> => {
    const r = await act(() => api('POST', `/rows/${rowId}/advance`), { silent: true });
    return r.ok ? { success: true } : { success: false, message: r.error };
  };
  const setWorkflowStage = async (rowId: number, stage: WorkflowStageId): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/stage`, { stage }))).ok;

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

  // ---------- ردیف‌ها ----------
  const createRow = async (values: Partial<DbRow>): Promise<{ row: DbRow | null; errors: string[]; isDuplicate: boolean }> => {
    const duplicates = values.request_no ? findDuplicateRequestNo(values.request_no) : [];
    const r = await act(() => api<{ row: DbRow }>('POST', '/rows', { values }), { silent: true });
    if (!r.ok) return { row: null, errors: [r.error], isDuplicate: false };
    return { row: r.data.row, errors: [], isDuplicate: duplicates.length > 0 };
  };

  const updateSection = async (rowId: number, sectionKey: string, values: Record<string, string>) => {
    const r = await act(() => api<{ values: Record<string, string> }>('POST', `/rows/${rowId}/sections/${sectionKey}`, { values }), { silent: true });
    return r.ok ? { ok: true, errors: [] as string[], values: r.data.values } : { ok: false, errors: [r.error] };
  };

  const finalizeDrafts = async (rowIds?: number[]): Promise<boolean> => {
    const ids = rowIds ?? getDraftRows().map((d) => d.id);
    if (ids.length === 0) return false;
    return (await act(() => api('POST', '/rows/finalize', { rowIds: ids }))).ok;
  };
  const discardDraft = async (rowId: number): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/discard`))).ok;
  const softDeleteRow = async (rowId: number): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/delete`))).ok;
  const restoreRow = async (rowId: number): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/restore`))).ok;
  const cancelRow = async (rowId: number, reason: string): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/cancel`, { reason }))).ok;
  const uncancelRow = async (rowId: number): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/uncancel`))).ok;
  const returnToTechOffice = async (rowId: number, reason: string): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/return`, { reason }))).ok;
  const unreturnFromTechOffice = async (rowId: number): Promise<boolean> =>
    (await act(() => api('POST', `/rows/${rowId}/unreturn`))).ok;

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
        rows, auditLogs, vendors, quotations, quotationCount, notify, approvals, currentUser, booting, loading, dataLoaded, toast, dismissToast, refresh,
        activeTab, selectedRowId, filters, isLdapModalOpen, cancelModalRowId, returnModalRowId, historyDrawerRowId,
        login, logout, sessionExpiresAt,
        setActiveTab, setSelectedRowId, setFilters, setIsLdapModalOpen, setCancelModalRowId, setReturnModalRowId, setHistoryDrawerRowId,
        isAdmin, isLocalAdmin, isManagement, canViewAuditLogs, canCreateRows, canEditSectionForRow, sectionLockReason, canCancelRow, canReturnToTechOffice,
        createRow, updateSection, finalizeDrafts, discardDraft, softDeleteRow, restoreRow,
        cancelRow, uncancelRow, returnToTechOffice, unreturnFromTechOffice,
        addVendor, updateVendor, deleteVendor, addQuotation, selectWinningQuotation, deleteQuotation, getRowQuotations,
        approveStep, rejectStep, getRowApprovals, ensureApprovals, canUserApprove,
        advanceWorkflow, setWorkflowStage,
        getRow, getRowHistory, findDuplicateRequestNo, findDuplicatePurchaseRequestNo, getDraftRows,
        getFilteredRows, getOverdueRows, getStats,
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
