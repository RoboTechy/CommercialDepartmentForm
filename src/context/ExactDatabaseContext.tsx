import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DbRow, AuditLogEntry, UserSession, ActiveTab, RequesterDept } from '../types';
import { INITIAL_DB_ROWS, INITIAL_AUDIT_LOGS, SAMPLE_USERS } from '../data/mockDatabaseData';
import { sections, findSection, allFields, requesterDepartments, isPaymentAuthWaived, FieldDef } from '../data/exactSections';
import { nowJalaliDateTime, daysSinceJalali, daysBetweenJalali } from '../utils/exactJalaali';
import { 
  resolveRequesterDept, 
  isFieldSetComplete, 
  fieldsForCompletion, 
  isRowComplete, 
  currentBlockingSection,
  normalizeForDuplicateCheck,
  DEPARTMENTS,
  median,
  computeDurationStats
} from '../store/exactStore';

const STORAGE_KEYS = {
  DB_ROWS: 'commercial_exact_db_rows_v3',
  AUDIT_LOGS: 'commercial_exact_audit_logs_v3',
  USER: 'commercial_exact_user_v3',
};

const OVERDUE_DAYS = 3;

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
  isManagement: boolean;
  canCreateRows: boolean;
  canEditSectionForRow: (row: DbRow, sectionKey: string) => boolean;
  canCancelRow: (row: DbRow) => boolean;
  canReturnToTechOffice: boolean;

  // DB Actions (100% matching store.js)
  createRow: (values: Partial<DbRow>, asDraft?: boolean) => { row: DbRow; isDuplicate: boolean };
  updateSection: (rowId: number, sectionKey: string, values: Record<string, string>) => void;
  finalizeDrafts: (rowIds?: number[]) => void;
  discardDraft: (rowId: number) => void;
  softDeleteRow: (rowId: number) => void;
  restoreRow: (rowId: number) => void;
  cancelRow: (rowId: number, reason: string) => void;
  uncancelRow: (rowId: number) => void;
  returnToTechOffice: (rowId: number, reason: string) => void;
  unreturnFromTechOffice: (rowId: number) => void;

  // Queries & Analytics
  getRow: (id: number) => DbRow | undefined;
  getRowHistory: (rowId: number) => AuditLogEntry[];
  findDuplicateRequestNo: (requestNo: string) => DbRow[];
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

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed === null) return null;
        const match = SAMPLE_USERS.find(u => u.username === parsed.username);
        if (match) return match;
        if (parsed.username) return parsed;
      }
      // Default to logged-in admin
      return SAMPLE_USERS[0];
    } catch {
      return SAMPLE_USERS[0];
    }
  });

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
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
  }, [currentUser]);

  // Permission evaluations
  const isAdmin = Boolean(currentUser && (currentUser.groups.includes('formadmin') || currentUser.isLocalAdmin));
  const isManagement = Boolean(currentUser && (isAdmin || currentUser.groups.includes('PRT-Management')));
  const canReturnToTechOffice = Boolean(currentUser && (isAdmin || currentUser.groups.includes('warehouse')));

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
    return sectionKey === 'tech_operator' ? canEditRequesterRow(row) : canEditSection(sectionKey);
  };

  const canCancelRow = (row: DbRow): boolean => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    const isAnyReq = requesterDepartments.some(d => currentUser.groups.includes(d.group));
    if (!isAnyReq) return false;
    return canEditRequesterRow(row);
  };

  const login = (username: string, password = '', mode: 'ldap' | 'local' = 'local'): { success: boolean; error?: string } => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Local Administrator check (username: admin / password: admin)
    if (cleanUser === 'admin') {
      if (cleanPass === 'admin' || cleanPass === '') {
        const adminUser: UserSession = SAMPLE_USERS[0];
        setCurrentUser(adminUser);
        return { success: true };
      } else {
        return { success: false, error: 'رمز عبور حساب ادمین محلی اشتباه است (رمز پیش‌فرض: admin)' };
      }
    }

    // 2. Domain / LDAP user check
    const matchedUser = SAMPLE_USERS.find(u => u.username.toLowerCase() === cleanUser);
    if (matchedUser) {
      // In LDAP simulation, accept any password or exact password if provided
      if (cleanPass.length === 0) {
        return { success: false, error: 'لطفاً کلمه عبور دامین/اکتیو دایرکتوری را وارد نمایید.' };
      }
      setCurrentUser(matchedUser);
      return { success: true };
    }

    // Dynamic LDAP simulated user if valid domain username provided
    if (cleanUser.length >= 3 && cleanPass.length >= 3) {
      const simulatedLdapUser: UserSession = {
        username: cleanUser,
        displayName: `${cleanUser} (دامین سازمانی)`,
        groups: ['tech_operator'],
        authType: 'ldap'
      };
      setCurrentUser(simulatedLdapUser);
      return { success: true };
    }

    return { 
      success: false, 
      error: 'نام کاربری یا کلمه عبور معتبر نمی‌باشد. برای ورود مدیر از admin/admin استفاده کنید.' 
    };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
    setActiveTab('dashboard');
  };

  const switchUser = (username: string) => {
    const target = SAMPLE_USERS.find(u => u.username === username);
    if (target) {
      setCurrentUser(target);
    }
  };

  const resetToPrinstineData = () => {
    setRows(INITIAL_DB_ROWS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.DB_ROWS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
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

  const getDraftRows = (): DbRow[] => {
    if (!currentUser) return [];
    return rows.filter(r => r.created_by_username === currentUser.username && !r.published_at && !r.deleted_at);
  };

  // DB Operations
  const createRow = (values: Partial<DbRow>, asDraft = false): { row: DbRow; isDuplicate: boolean } => {
    const sec = findSection('tech_operator')!;
    const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    const createdAt = nowJalaliDateTime();
    const publishedAt = asDraft ? '' : createdAt;

    const duplicates = values.request_no ? findDuplicateRequestNo(values.request_no) : [];

    const newRow: DbRow = {
      id: nextId,
      created_by_username: currentUser ? currentUser.username : 'admin',
      created_by_display: currentUser ? currentUser.displayName : 'کاربر سیستم',
      created_at: createdAt,
      request_no: values.request_no || '',
      item_description: values.item_description || '',
      priority: values.priority || 'A',
      total_qty: values.total_qty || '',
      unit: values.unit || '',
      usage_location: values.usage_location || '',
      delivery_to_warehouse_date: values.delivery_to_warehouse_date || '',
      item_type: values.item_type || 'استاندارد',
      requester_dept: resolveRequesterDept(currentUser) || 'دفتر فنی',
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
      published_at: publishedAt,
    };

    setRows(prev => [newRow, ...prev]);

    // Insert audit entries
    const auditEntries: AuditLogEntry[] = [];
    let logIdCounter = auditLogs.length > 0 ? Math.max(...auditLogs.map(a => a.id)) + 1 : 1;

    for (const field of sec.fields) {
      const val = newRow[field.name];
      if (val) {
        auditEntries.push({
          id: logIdCounter++,
          row_id: nextId,
          section_key: 'tech_operator',
          field_key: field.name,
          field_label: field.label,
          old_value: '',
          new_value: String(val),
          changed_by_username: currentUser.username,
          changed_by_display: currentUser.displayName,
          changed_at: createdAt,
        });
      }
    }

    if (auditEntries.length > 0) {
      setAuditLogs(prev => [...auditEntries, ...prev]);
    }

    return { row: newRow, isDuplicate: duplicates.length > 0 };
  };

  const updateSection = (rowId: number, sectionKey: string, values: Record<string, string>) => {
    const sec = findSection(sectionKey);
    if (!sec) return;
    const target = rows.find(r => r.id === rowId);
    if (!target) return;

    const changedAt = nowJalaliDateTime();
    const auditEntries: AuditLogEntry[] = [];
    let logIdCounter = auditLogs.length > 0 ? Math.max(...auditLogs.map(a => a.id)) + 1 : 1;

    const updatedRow = { ...target };

    for (const field of sec.fields) {
      const oldVal = (target[field.name] || '').toString();
      const newVal = field.readOnly ? oldVal : (values[field.name] || '').trim();
      
      if (newVal !== oldVal) {
        (updatedRow as any)[field.name] = newVal;
        auditEntries.push({
          id: logIdCounter++,
          row_id: rowId,
          section_key: sectionKey,
          field_key: field.name,
          field_label: field.label,
          old_value: oldVal,
          new_value: newVal,
          changed_by_username: currentUser ? currentUser.username : 'admin',
          changed_by_display: currentUser ? currentUser.displayName : 'مدیر سیستم',
          changed_at: changedAt,
        });
      }
    }

    setRows(prev => prev.map(r => r.id === rowId ? updatedRow : r));
    if (auditEntries.length > 0) {
      setAuditLogs(prev => [...auditEntries, ...prev]);
    }
  };

  const finalizeDrafts = (rowIds?: number[]) => {
    const publishedAt = nowJalaliDateTime();
    let logIdCounter = auditLogs.length > 0 ? Math.max(...auditLogs.map(a => a.id)) + 1 : 1;
    const newLogs: AuditLogEntry[] = [];

    setRows(prev => prev.map(r => {
      const match = currentUser && r.created_by_username === currentUser.username && !r.published_at && (!rowIds || rowIds.includes(r.id));
      if (match) {
        newLogs.push({
          id: logIdCounter++,
          row_id: r.id,
          section_key: 'tech_operator',
          field_key: 'published_at',
          field_label: 'وضعیت ثبت',
          old_value: 'پیش‌نویس',
          new_value: 'ثبت نهایی شد',
          changed_by_username: currentUser ? currentUser.username : 'admin',
          changed_by_display: currentUser ? currentUser.displayName : 'کاربر سیستم',
          changed_at: publishedAt,
        });
        return { ...r, published_at: publishedAt };
      }
      return r;
    }));

    if (newLogs.length > 0) {
      setAuditLogs(prev => [...newLogs, ...prev]);
    }
  };

  const discardDraft = (rowId: number) => {
    setRows(prev => prev.filter(r => !(r.id === rowId && !r.published_at)));
    setAuditLogs(prev => prev.filter(a => a.row_id !== rowId));
  };

  const softDeleteRow = (rowId: number) => {
    const deletedAt = nowJalaliDateTime();
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          deleted_at: deletedAt,
          deleted_by_username: currentUser ? currentUser.username : 'admin',
          deleted_by_display: currentUser ? currentUser.displayName : 'مدیر سیستم',
        };
      }
      return r;
    }));
  };

  const restoreRow = (rowId: number) => {
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          deleted_at: '',
          deleted_by_username: '',
          deleted_by_display: '',
        };
      }
      return r;
    }));
  };

  const cancelRow = (rowId: number, reason: string) => {
    const cancelledAt = nowJalaliDateTime();
    const logId = auditLogs.length > 0 ? Math.max(...auditLogs.map(a => a.id)) + 1 : 1;

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          cancelled_at: cancelledAt,
          cancelled_by_username: currentUser ? currentUser.username : 'admin',
          cancelled_by_display: currentUser ? currentUser.displayName : 'مدیر سیستم',
          cancel_reason: reason,
        };
      }
      return r;
    }));

    setAuditLogs(prev => [
      {
        id: logId,
        row_id: rowId,
        section_key: 'tech_operator',
        field_key: 'cancel_reason',
        field_label: 'وضعیت درخواست',
        old_value: 'فعال',
        new_value: `لغو شد - دلیل: ${reason}`,
        changed_by_username: currentUser ? currentUser.username : 'admin',
        changed_by_display: currentUser ? currentUser.displayName : 'مدیر سیستم',
        changed_at: cancelledAt,
      },
      ...prev,
    ]);
  };

  const uncancelRow = (rowId: number) => {
    const changedAt = nowJalaliDateTime();
    const logId = auditLogs.length > 0 ? Math.max(...auditLogs.map(a => a.id)) + 1 : 1;

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          cancelled_at: '',
          cancelled_by_username: '',
          cancelled_by_display: '',
          cancel_reason: '',
        };
      }
      return r;
    }));

    setAuditLogs(prev => [
      {
        id: logId,
        row_id: rowId,
        section_key: 'tech_operator',
        field_key: 'cancel_reason',
        field_label: 'وضعیت درخواست',
        old_value: 'لغو شد',
        new_value: 'بازگردانده شد (فعال)',
        changed_by_username: currentUser ? currentUser.username : 'admin',
        changed_by_display: currentUser ? currentUser.displayName : 'مدیر سیستم',
        changed_at: changedAt,
      },
      ...prev,
    ]);
  };

  const returnToTechOffice = (rowId: number, reason: string) => {
    const returnedAt = nowJalaliDateTime();
    const logId = auditLogs.length > 0 ? Math.max(...auditLogs.map(a => a.id)) + 1 : 1;

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          returned_at: returnedAt,
          returned_by_username: currentUser ? currentUser.username : 'warehouse',
          returned_by_display: currentUser ? currentUser.displayName : 'انبار کارفرما',
          return_reason: reason,
        };
      }
      return r;
    }));

    setAuditLogs(prev => [
      {
        id: logId,
        row_id: rowId,
        section_key: 'warehouse_1',
        field_key: 'return_reason',
        field_label: 'وضعیت درخواست',
        old_value: 'فعال',
        new_value: reason ? `عودت به درخواست‌کننده - دلیل: ${reason}` : 'عودت به درخواست‌کننده',
        changed_by_username: currentUser ? currentUser.username : 'warehouse',
        changed_by_display: currentUser ? currentUser.displayName : 'انبار کارفرما',
        changed_at: returnedAt,
      },
      ...prev,
    ]);
  };

  const unreturnFromTechOffice = (rowId: number) => {
    const changedAt = nowJalaliDateTime();
    const logId = auditLogs.length > 0 ? Math.max(...auditLogs.map(a => a.id)) + 1 : 1;

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          returned_at: '',
          returned_by_username: '',
          returned_by_display: '',
          return_reason: '',
        };
      }
      return r;
    }));

    setAuditLogs(prev => [
      {
        id: logId,
        row_id: rowId,
        section_key: 'warehouse_1',
        field_key: 'return_reason',
        field_label: 'وضعیت درخواست',
        old_value: 'عودت به درخواست‌کننده',
        new_value: 'بازگردانده شد (فعال)',
        changed_by_username: currentUser ? currentUser.username : 'warehouse',
        changed_by_display: currentUser ? currentUser.displayName : 'انبار کارفرما',
        changed_at: changedAt,
      },
      ...prev,
    ]);
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
        resetToPrinstineData,
        isAdmin,
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
        getRow,
        getRowHistory,
        findDuplicateRequestNo,
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
