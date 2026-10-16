import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { ActiveTab } from '../types';
import { 
  AlertTriangle,
  LayoutDashboard, 
  FilePlus2, 
  Clock, 
  FileSpreadsheet, 
  Trash2, 
  ScrollText, 
  RotateCcw,
  KeyRound,
  FileEdit,
  LogOut,
  ShieldCheck,
  Kanban,
  Building2
} from 'lucide-react';
import { requesterDepartments } from '../data/exactSections';
import { GROUPS, ENABLE_EXTENDED_WORKFLOW } from '../config';

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { 
    activeTab, 
    setActiveTab, 
    setSelectedRowId, 
    rows, 
    getDraftRows,
    getOverdueRows, 
    vendors,
    currentUser, 
    canCreateRows, 
    isAdmin,
    isManagement,
    isLocalAdmin,
    canViewAuditLogs,
    setIsLdapModalOpen,
    logout
  } = useExactDb();

  const publishedCount = rows.filter(r => !r.deleted_at && r.published_at).length;
  const deletedCount = rows.filter(r => r.deleted_at).length;
  const draftCount = getDraftRows().length;
  const overdueCount = getOverdueRows().length;

  const handleNav = (tab: ActiveTab) => {
    setSelectedRowId(null);
    setActiveTab(tab);
    onClose();
  };

  // User's department label
  const userDept = currentUser ? requesterDepartments.find(d => currentUser.groups.includes(d.group)) : null;

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside className={`
        fixed top-16 bottom-0 z-40 w-72 bg-slate-900 border-l border-slate-800 flex flex-col transition-transform duration-200 ease-out right-0
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex-1 overflow-y-auto p-3.5 space-y-1">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            بخش‌های سامانه
          </div>

          <button
            onClick={() => handleNav('dashboard')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>فهرست درخواست‌های جاری</span>
            </div>
            <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 tabular-nums border border-slate-700">
              {publishedCount}
            </span>
          </button>

          <button
            onClick={() => handleNav('overdue')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'overdue'
                ? 'bg-amber-600/20 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>ردیف‌های معطل‌مانده</span>
            </div>
            {overdueCount > 0 && (
              <span className="font-mono text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold tabular-nums">
                {overdueCount}
              </span>
            )}
          </button>

          {ENABLE_EXTENDED_WORKFLOW && (
            <>
          {/* Workflow Pipeline (گردش کار چند مرحله‌ای) */}
          <button
            onClick={() => handleNav('workflow_pipeline')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'workflow_pipeline'
                ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Kanban className="w-4 h-4 text-cyan-400" />
              <span>تابلوی خط لوله گردش‌کار</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
              پایپ‌لاین
            </span>
          </button>

          {/* Vendors & RFQ Directory (ویژگی ۱) */}
          <button
            onClick={() => handleNav('vendors')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'vendors'
                ? 'bg-emerald-600/20 text-emerald-400 font-semibold border border-emerald-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>وندور لیست و استعلام قیمت</span>
            </div>
            <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 tabular-nums border border-slate-700">
              {vendors.length}
            </span>
          </button>

            </>
          )}

          {canCreateRows && (
            <button
              onClick={() => handleNav('new_request')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'new_request'
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FilePlus2 className="w-4 h-4 text-emerald-400" />
                <span>ثبت درخواست کالای جدید</span>
              </div>
            </button>
          )}
          {canCreateRows && (
            <button
              onClick={() => handleNav('import_rows')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'import_rows'
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>ثبت گروهی از اکسل</span>
              </div>
            </button>
          )}

          <button
            onClick={() => handleNav('drafts')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'drafts'
                ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileEdit className="w-4 h-4 text-amber-400" />
              <span>پیش‌نویس‌های من</span>
            </div>
            {draftCount > 0 && (
              <span className="font-mono text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold tabular-nums">
                {draftCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNav('duration_report')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'duration_report'
                ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>ابزار گزارش‌ساز زمان‌بندی</span>
            </div>
          </button>

          {isManagement && (
            <button
              onClick={() => handleNav('management_report')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'management_report'
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>گزارش‌های مدیریتی (PRT)</span>
              </div>
            </button>
          )}

          {canViewAuditLogs && (
          <button
            onClick={() => handleNav('audit_logs')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'audit_logs'
                ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ScrollText className="w-4 h-4 text-cyan-400" />
              <span>ردیابی رویدادها (Audit Logs)</span>
            </div>
          </button>
          )}

          {isLocalAdmin && (
          <button
            onClick={() => handleNav('deleted_rows')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'deleted_rows'
                ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-slate-500" />
              <span>سطل زباله</span>
            </div>
            {deletedCount > 0 && (
              <span className="font-mono text-[11px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded tabular-nums border border-slate-700">
                {deletedCount}
              </span>
            )}
          </button>
          )}

          {/* Section Access Card */}
          {currentUser && (
            <div className="pt-4">
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                سطح دسترسی کاربر جاری
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-right space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>{currentUser.displayName.split('(')[0]}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    currentUser.isLocalAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {currentUser.isLocalAdmin ? 'LOCAL' : 'LDAP'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  {isAdmin ? (
                    <span className="text-blue-400 font-semibold">مدیر ارشد: ویرایش تمامی بخش‌ها مجاز است.</span>
                  ) : userDept ? (
                    <span>دپارتمان درخواست‌کننده: <b>{userDept.label}</b> (ثبت و ویرایش درخواست‌های خود)</span>
                  ) : currentUser.groups.includes(GROUPS.warehouse) ? (
                    <span>انبار کارفرما: تکمیل فیلدهای بلوک ۱ و ۲ + عودت درخواست</span>
                  ) : currentUser.groups.includes(GROUPS.commercial) ? (
                    <span>بازرگانی غدیر: ثبت ارجاع، مجری خرید و مجوز پرداخت</span>
                  ) : (
                    <span>فقط مشاهده اطلاعات</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  {true && (
                  <button
                    onClick={() => setIsLdapModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
                  >
                    <KeyRound className="w-3 h-3 text-slate-400" />
                    <span>مشخصات نشست</span>
                  </button>
                  )}

                  <button
                    onClick={() => {
                      if (window.confirm('آیا قصد خروج از حساب کاربری را دارید؟')) {
                        logout();
                      }
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    title="خروج"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </aside>
    </>
  );
};
