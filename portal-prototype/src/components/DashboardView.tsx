import { ENABLE_EXTENDED_WORKFLOW } from '../config';
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
    getOverdueRows, 
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

  const filteredRows = getFilteredRows();
  const stats = getStats();
  const overdueRows = getOverdueRows();

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
    <div className="space-y-6 pb-12">
      
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

        {ENABLE_EXTENDED_WORKFLOW && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('workflow_pipeline')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Kanban className="w-4 h-4 text-blue-400" />
            <span>تابلوی خط لوله (Kanban)</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>وندور لیست و استعلام قیمت</span>
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

      {/* Overdue Items Alert Banner */}
      {overdueRows.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>ردیف‌های معطل‌مانده (بیش از ۳ روز از ایجاد گذشته و هنوز تکمیل نشده است):</span>
            </div>
            <span className="font-mono text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
              {overdueRows.length} ردیف
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {overdueRows.map(({ row, blockingSection, ageDays }) => (
              <button
                key={row.id}
                onClick={() => handleOpenRow(row.id)}
                className="px-2.5 py-1.5 bg-slate-900 border border-amber-500/40 hover:border-amber-400 rounded-lg text-[11px] text-slate-200 flex items-center gap-2 transition-colors shadow-xs"
              >
                <span className="font-mono font-bold text-blue-400">{row.request_no}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 truncate max-w-[120px]">{row.item_description}</span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                  منتظر: {blockingSection.title} ({ageDays} روز)
                </span>
              </button>
            ))}
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
          <span>نمایش <b className="text-white">{filteredRows.length}</b> ردیف</span>
          <span className="text-[11px] text-slate-500">جهت ویرایش یا مشاهده تاریخچه، روی هر ردیف کلیک کنید</span>
        </div>
      </div>

      {/* Desktop Data Table */}
      <div className="hidden lg:block bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            
            {/* Super Headers for 4 sections */}
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-bold text-slate-300">
                <th colSpan={3} className="py-2.5 px-3 border-l border-slate-800">مشخصات اولیه ردیف</th>
                <th colSpan={6} className="py-2.5 px-3 border-l border-slate-800 bg-blue-500/10 text-blue-300">
                  بخش ۱: درخواست‌کننده (دفتر فنی / عمران / آی‌تی)
                </th>
                <th colSpan={4} className="py-2.5 px-3 border-l border-slate-800 bg-amber-500/10 text-amber-300">
                  بخش ۲: انبار کارفرما (بلوک ۱)
                </th>
                <th colSpan={3} className="py-2.5 px-3 border-l border-slate-800 bg-emerald-500/10 text-emerald-300">
                  بخش ۳: بازرگانی غدیر
                </th>
                <th colSpan={2} className="py-2.5 px-3 border-l border-slate-800 bg-amber-500/10 text-amber-300">
                  بخش ۴: انبار کارفرما (بلوک ۲)
                </th>
                <th className="py-2.5 px-3 text-center">عملیات</th>
              </tr>

              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold text-[11px]">
                <th className="py-2 px-3">ردیف</th>
                <th className="py-2 px-3">وضعیت</th>
                <th className="py-2 px-3 border-l border-slate-800">ثبت‌کننده</th>
                
                {/* Tech Operator */}
                <th className="py-2 px-3">شماره درخواست</th>
                <th className="py-2 px-3">دپارتمان</th>
                <th className="py-2 px-3">شرح کالا</th>
                <th className="py-2 px-3 text-center">اولویت</th>
                <th className="py-2 px-3 text-center">تعداد / واحد</th>
                <th className="py-2 px-3 border-l border-slate-800">تحویل به انبار</th>

                {/* Warehouse 1 */}
                <th className="py-2 px-3">شماره خرید</th>
                <th className="py-2 px-3">تحویل به کارشناس</th>
                <th className="py-2 px-3">تحویل به کارفرما</th>
                <th className="py-2 px-3 border-l border-slate-800">ورود به کارخانه</th>

                {/* Commercial */}
                <th className="py-2 px-3">ارجاع بازرگانی</th>
                <th className="py-2 px-3">مجری خرید</th>
                <th className="py-2 px-3 border-l border-slate-800">مجوز پرداخت</th>

                {/* Warehouse 2 */}
                <th className="py-2 px-3">شماره نامه</th>
                <th className="py-2 px-3 border-l border-slate-800">ارسال</th>

                {/* Actions */}
                <th className="py-2 px-3 text-center">اقدامات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-medium">هیچ ردیفی با این فیلترها یافت نشد</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const isCancelled = Boolean(row.cancelled_at);
                  const isReturned = Boolean(row.returned_at);
                  const waived = isPaymentAuthWaived(row);

                  return (
                    <tr
                      key={row.id}
                      onClick={() => handleOpenRow(row.id)}
                      className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                        isCancelled ? 'bg-rose-950/20' : isReturned ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      {/* ID */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-400 tabular-nums">
                        {row.id}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30" title={row.cancel_reason}>
                            لغو شده
                          </span>
                        ) : isReturned ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30" title={row.return_reason}>
                            عودت داده شده
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            جاری
                          </span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="py-3 px-3 text-slate-300 border-l border-slate-800 whitespace-nowrap">
                        {row.created_by_display.split('(')[0]}
                      </td>

                      {/* Tech Operator Fields */}
                      <td className="py-3 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                        {row.request_no}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200 whitespace-nowrap">
                        {row.requester_dept}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-[200px] truncate" title={row.item_description}>
                        {row.item_description}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${getPriorityBadgeClass(row.priority)}`}>
                          {row.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {row.total_qty} {row.unit}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 border-l border-slate-800 tabular-nums whitespace-nowrap">
                        {row.delivery_to_warehouse_date}
                      </td>

                      {/* Warehouse 1 Fields */}
                      <td className="py-3 px-3 font-mono text-slate-200 whitespace-nowrap">
                        {row.purchase_request_no || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                        {row.delivered_to_tech_expert_date || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                        {row.delivered_to_employer_date || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 border-l border-slate-800 tabular-nums whitespace-nowrap">
                        {row.factory_arrival_date || '—'}
                      </td>

                      {/* Commercial Fields */}
                      <td className="py-3 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                        {row.referred_to_commercial_date || '—'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200 whitespace-nowrap">
                        {row.purchase_executor ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 border border-slate-700">
                            {row.purchase_executor}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 border-l border-slate-800 tabular-nums whitespace-nowrap">
                        {waived ? (
                          <span className="text-[10px] text-slate-500 font-sans" title="به دلیل مجری خرید تهران/برنا معاف از مجوز پرداخت سایت است">
                            (معاف - {row.purchase_executor})
                          </span>
                        ) : (
                          row.payment_auth_issued_date || '—'
                        )}
                      </td>

                      {/* Warehouse 2 Fields */}
                      <td className="py-3 px-3 font-mono text-slate-200 whitespace-nowrap">
                        {row.letter_no || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 border-l border-slate-800 tabular-nums whitespace-nowrap">
                        {row.dispatch_date || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenRow(row.id)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                            title="مشاهده و ویرایش بخش‌ها"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setHistoryDrawerRowId(row.id)}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                            title="تاریخچه تغییرات"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {canCancelRow(row) && !isReturned && (
                            isCancelled ? (
                              <button
                                onClick={() => uncancelRow(row.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="بازگردانی از لغو"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setCancelModalRowId(row.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="لغو درخواست"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}

                          {canReturnToTechOffice && !isCancelled && (
                            isReturned ? (
                              <button
                                onClick={() => unreturnFromTechOffice(row.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="لغو عودت"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setReturnModalRowId(row.id)}
                                className="p-1 text-amber-500 hover:bg-amber-50 rounded"
                                title="عودت به درخواست‌کننده"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}

                          {isLocalAdmin && (
                            <button
                              onClick={() => {
                                if (window.confirm(`انتقال ردیف ${row.request_no} به سطل زباله؟`)) {
                                  softDeleteRow(row.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="حذف نرم"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
