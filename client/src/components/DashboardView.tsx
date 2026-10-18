import { ENABLE_EXTENDED_WORKFLOW } from '../config';
import { exportRowsCsv } from '../utils/exportCsv';
import { RowsTable, applyColumnFilters } from './RowsTable';
import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { DbRow, PriorityLevel } from '../types';
import { sections, isPaymentAuthWaived } from '../data/exactSections';
import { currentBlockingSection } from '../store/exactStore';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  FileEdit,
  History,
  Building2,
  ArrowRight,
  AlertCircle,
  Kanban
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { 
    getFilteredRows, 
    getStats, 
    filters, 
    setFilters, 
    setSelectedRowId, 
    setActiveTab,
    setHistoryDrawerRowId,
    setCancelModalRowId,
    setReturnModalRowId,
    uncancelRow,
    unreturnFromTechOffice,
    softDeleteRow,
    canCancelRow,
    canReturnToTechOffice,
    isAdmin,
    isLocalAdmin,
    getDraftRows
  } = useExactDb();

  const myDrafts = getDraftRows();

  // کارت‌های آماری فضای زیادی می‌گیرند؛ برای دیدن ردیف‌های بیشتر قابل جمع‌شدن‌اند (انتخاب هر مرورگر ذخیره می‌شود)
  const [showStats, setShowStats] = React.useState<boolean>(() => {
    try {
      const v = localStorage.getItem('prt_show_stats');
      if (v !== null) return v === '1';
    } catch { /* ignore */ }
    return window.innerHeight >= 1000;
  });
  const toggleStats = () => {
    setShowStats((v) => {
      try { localStorage.setItem('prt_show_stats', v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  };

  // جستجوی هر ستون (علاوه بر کادر جستجوی کلی و فیلترهای بالای صفحه)
  const [colFilters, setColFilters] = React.useState<Record<string, string>>({});
  const setColFilter = (key: string, value: string) => setColFilters((f) => ({ ...f, [key]: value }));
  const filteredRows = applyColumnFilters(getFilteredRows(), colFilters);
  const stats = getStats();

  const handleOpenRow = (id: number) => {
    setSelectedRowId(id);
    setActiveTab('row_detail');
  };

  const getPriorityBadgeClass = (p: PriorityLevel) => {
    switch (p) {
      case 'A++':
      case 'A+':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'A':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'B':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-7.5rem)] lg:overflow-hidden pb-12 lg:pb-0">
      <div className="shrink-0 space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            فهرست درخواست‌های کالا و گردش کار بازرگانی
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            پیگیری مراحل بین دفتر فنی/عمران/آی‌تی، انبار کارفرما و بازرگانی غدیر
          </p>
        </div>

        <button
          type="button"
          onClick={toggleStats}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
        >
          {showStats ? 'مخفی کردن آمار' : 'نمایش آمار'}
        </button>
        {ENABLE_EXTENDED_WORKFLOW && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('workflow_pipeline')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Kanban className="w-4 h-4 text-blue-400" />
            <span>تابلوی خط لوله (Kanban)</span>
          </button>
        </div>
        )}
      </div>

      {/* یادآوری پیش‌نویس‌های ثبت‌نشده */}
      {myDrafts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            شما {myDrafts.length} پیش‌نویس ثبت‌نشده دارید؛ تا «ثبت نهایی» در این فهرست و برای انبار/بازرگانی دیده نمی‌شوند.
          </span>
          <button
            onClick={() => setActiveTab('drafts')}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 font-semibold"
          >
            مشاهده پیش‌نویس‌ها
          </button>
        </div>
      )}

      {showStats && (
      <div className="space-y-4">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">کل درخواست‌ها</span>
          <span className="text-2xl font-bold font-mono text-white tabular-nums">
            {stats.totalRows}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-medium">تکمیل‌شده نهایی</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {stats.fullyCompleted}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-medium">عودت به درخواست‌کننده</span>
          <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {stats.returnedCount}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-rose-400 font-medium">لغو شده</span>
          <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            {stats.cancelledCount}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-xs text-blue-400 font-medium">میانگین زمان تکمیل</span>
          <span className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
            {stats.avgCompletionDays !== null ? `${stats.avgCompletionDays} روز` : '—'}
          </span>
        </div>
      </div>

      {/* Department Status Clickable Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Requester Department Cards */}
        {stats.requesterDeptStats.map(dept => {
          const isActive = filters.incompleteRequesterDept === dept.label;
          return (
            <button
              key={dept.label}
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  incompleteRequesterDept: isActive ? '' : dept.label,
                  incompleteDept: '',
                }));
              }}
              className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                isActive 
                  ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50' 
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="text-xs font-bold text-slate-200 mb-1">
                درخواست‌کننده: {dept.label}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">
                  {dept.completed} تکمیل
                </span>
                <span className="text-amber-400 font-semibold font-mono">
                  {dept.pending} در انتظار
                </span>
              </div>
            </button>
          );
        })}

        {/* Warehouse & Commercial Cards */}
        {stats.departments.map(dept => {
          const isActive = filters.incompleteDept === dept.color;
          return (
            <button
              key={dept.color}
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  incompleteDept: isActive ? '' : dept.color,
                  incompleteRequesterDept: '',
                }));
              }}
              className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                isActive 
                  ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50' 
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="text-xs font-bold text-slate-200 mb-1">
                {dept.title}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">
                  {dept.completed} تکمیل
                </span>
                <span className="text-amber-400 font-semibold font-mono">
                  {dept.pending} در انتظار
                </span>
              </div>
            </button>
          );
        })}
      </div>
      </div>
      )}

      {/* Search and Filters Bar */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-500" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              placeholder="جستجو در شماره درخواست، شرح کالا، شماره خرید، محل مصرف..."
              className="w-full pr-9 pl-4 py-2 text-xs bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              className="px-3 py-2 text-xs bg-slate-950/70 border border-slate-700/80 text-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">جاری (عادی)</option>
              <option value="cancelled">لغو شده</option>
              <option value="returned">عودت به درخواست‌کننده</option>
            </select>

            {/* Requester Dept */}
            <select
              value={filters.requesterDept}
              onChange={(e) => setFilters(prev => ({ ...prev, requesterDept: e.target.value }))}
              className="px-3 py-2 text-xs bg-slate-950/70 border border-slate-700/80 text-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="">همه دپارتمان‌ها</option>
              <option value="دفتر فنی">دفتر فنی</option>
              <option value="عمران">عمران</option>
              <option value="آی‌تی">آی‌تی</option>
            </select>

            {/* Priority */}
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="px-3 py-2 text-xs bg-slate-950/70 border border-slate-700/80 text-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 cursor-pointer font-mono"
            >
              <option value="">همه اولویت‌ها</option>
              <option value="A++">A++</option>
              <option value="A+">A+</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>

            {/* Purchase Executor */}
            <select
              value={filters.purchaseExecutor}
              onChange={(e) => setFilters(prev => ({ ...prev, purchaseExecutor: e.target.value }))}
              className="px-3 py-2 text-xs bg-slate-950/70 border border-slate-700/80 text-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="">همه مجریان خرید</option>
              <option value="سایت">سایت</option>
              <option value="تهران">تهران</option>
              <option value="برنا">برنا</option>
            </select>

            {(filters.searchQuery || filters.status !== 'all' || filters.requesterDept || filters.priority || filters.purchaseExecutor || filters.incompleteDept || filters.incompleteRequesterDept) && (
              <button
                onClick={() => setFilters({
                  searchQuery: '',
                  requesterDept: '',
                  priority: '',
                  purchaseExecutor: '',
                  itemType: '',
                  status: 'all',
                  incompleteDept: '',
                  incompleteRequesterDept: '',
                })}
                className="px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors font-medium border border-rose-500/20"
              >
                حذف فیلترها
              </button>
            )}

          </div>

        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => exportRowsCsv(filteredRows)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold"
            >
              خروجی CSV
            </button>
            <span>نمایش <b className="text-white">{filteredRows.length}</b> ردیف</span>
          </span>
          <span className="text-[11px] text-slate-500">روی شماره درخواست کلیک کنید تا به صفحه‌ی ویرایش همان درخواست بروید</span>
        </div>
      </div>

      </div>

      {/* Desktop Data Table: ستون‌های بخش کاربر باز، بقیه کشویی؛ ویرایش درجا؛ تاریخچه با هاور */}
      <RowsTable rows={filteredRows} colFilters={colFilters} setColFilter={setColFilter} clearColFilters={() => setColFilters({})} />

      {/* Mobile Responsive Cards View */}
      <div className="lg:hidden space-y-3">
        {filteredRows.map(row => {
          const isCancelled = Boolean(row.cancelled_at);
          const isReturned = Boolean(row.returned_at);

          return (
            <div
              key={row.id}
              onClick={() => handleOpenRow(row.id)}
              className={`p-4 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm transition-colors ${
                isCancelled ? 'bg-rose-950/20 border-rose-500/30' : isReturned ? 'bg-amber-950/20 border-amber-500/30' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-sm text-blue-400">
                  {row.request_no}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getPriorityBadgeClass(row.priority)}`}>
                    {row.priority}
                  </span>
                  {isCancelled && <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-1.5 py-0.5 rounded">لغو شده</span>}
                  {isReturned && <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded">عودت</span>}
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-200 mb-1">
                دپارتمان: {row.requester_dept}
              </div>
              <div className="text-xs text-slate-400 line-clamp-2 mb-3">
                {row.item_description}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-500 block">تعداد:</span>
                  <span className="font-mono font-bold text-slate-200">{row.total_qty} {row.unit}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">مجری خرید:</span>
                  <span className="font-semibold text-slate-200">{row.purchase_executor || '—'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 text-xs border-t border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                <span className="text-[11px] text-slate-500">{row.created_by_display.split('(')[0]}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryDrawerRowId(row.id)}
                    className="p-1 text-slate-400 hover:text-amber-400"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenRow(row.id)}
                    className="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <span>مشاهده فرم</span>
                    <ArrowRight className="w-3 h-3 rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
