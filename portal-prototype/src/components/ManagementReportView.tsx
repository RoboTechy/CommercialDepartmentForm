import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { requesterDepartments } from '../data/exactSections';
import { computeDurationStats, isRowComplete } from '../store/exactStore';
import { 
  FileSpreadsheet, 
  Printer, 
  BarChart3, 
  Clock, 
  Briefcase, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const ManagementReportView: React.FC = () => {
  const { rows, auditLogs, setSelectedRowId, setActiveTab } = useExactDb();

  const publishedRows = rows.filter(r => !r.deleted_at && r.published_at);
  const notCancelledReturned = publishedRows.filter(r => !r.cancelled_at && !r.returned_at);

  // Compute last change per row from audit logs
  const lastChangeByRow = new Map<number, string>();
  auditLogs.forEach(a => {
    const cur = lastChangeByRow.get(a.row_id);
    if (!cur || a.changed_at > cur) {
      lastChangeByRow.set(a.row_id, a.changed_at);
    }
  });

  // Stage Stats
  const stageStats = {
    warehouse1: {
      label: 'انبار کارفرما (مرحله ۱) - از تحویل به انبار تا ارجاع به بازرگانی',
      ...computeDurationStats(
        publishedRows,
        (r) => r.delivery_to_warehouse_date,
        (r) => r.referred_to_commercial_date
      ),
    },
    commercial: {
      label: 'بازرگانی غدیر - از ارجاع تا صدور مجوز پرداخت (فقط مجری خرید «سایت»)',
      ...computeDurationStats(
        publishedRows.filter(r => r.purchase_executor === 'سایت'),
        (r) => r.referred_to_commercial_date,
        (r) => r.payment_auth_issued_date
      ),
    },
    warehouse2: {
      label: 'انبار کارفرما (مرحله ۲) - از ثبت درخواست تا ارسال نامه‌ی نهایی',
      ...computeDurationStats(
        publishedRows,
        (r) => r.created_at,
        (r) => r.dispatch_date
      ),
    },
    fullCycle: {
      label: 'کل چرخه فرایند - از ثبت درخواست تا تکمیل کامل (آخرین تغییر ردیف)',
      ...computeDurationStats(
        notCancelledReturned.filter(r => isRowComplete(r)),
        (r) => r.created_at,
        (r) => lastChangeByRow.get(r.id) || ''
      ),
    },
  };

  // Priority Stats
  const priorities = ['A++', 'A+', 'A', 'B', 'C', 'D'];
  const completedRows = notCancelledReturned.filter(r => isRowComplete(r));
  const priorityStats = priorities.map(p => {
    const pRows = completedRows.filter(r => r.priority === p);
    const stats = computeDurationStats(
      pRows,
      (r) => r.created_at,
      (r) => lastChangeByRow.get(r.id) || ''
    );
    return { priority: p, ...stats };
  });

  // Purchase Executor Split
  const executorCounts = { 'سایت': 0, 'تهران': 0, 'برنا': 0 };
  publishedRows.forEach(r => {
    if (r.purchase_executor && (executorCounts as any)[r.purchase_executor] !== undefined) {
      (executorCounts as any)[r.purchase_executor]++;
    }
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                گزارش‌های تحلیلی و زمان‌بندی مدیریتی (PRT)
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                آمار استراتژیک، سرعت عبور پرونده‌ها از مراحل سه‌گانه و بررسی کارآمدی سطوح اولویت
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-colors"
        >
          <Printer className="w-4 h-4 text-slate-400" />
          <span>چاپ گزارش مدیریتی</span>
        </button>
      </div>

      {/* 4 Process Stages Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(stageStats).map(([key, st]) => (
          <div key={key} className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm space-y-3">
            <div className="text-xs font-bold text-slate-200 leading-tight">
              {st.label}
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center">
              <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-500 block">تعداد نمونه</span>
                <span className="text-sm font-bold font-mono text-slate-200 tabular-nums">{st.count}</span>
              </div>
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <span className="text-[10px] text-blue-400 block">میانگین</span>
                <span className="text-sm font-bold font-mono text-blue-400 tabular-nums">
                  {st.avg !== null ? `${Math.round(st.avg * 10) / 10} روز` : '—'}
                </span>
              </div>
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <span className="text-[10px] text-indigo-400 block">میانه</span>
                <span className="text-sm font-bold font-mono text-indigo-400 tabular-nums">
                  {st.median !== null ? `${st.median} روز` : '—'}
                </span>
              </div>
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <span className="text-[10px] text-rose-400 block">کندترین</span>
                <span className="text-sm font-bold font-mono text-rose-400 tabular-nums">
                  {st.max !== null ? `${st.max} روز` : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Priority vs Duration Analysis */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm p-5 sm:p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          آیا درخواست‌های اولویت بالاتر واقعاً سریع‌تر تکمیل می‌شوند؟ (میانگین مدت کل چرخه بر اساس اولویت)
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {priorityStats.map(p => (
            <div key={p.priority} className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-center">
              <span className="font-mono font-bold text-sm block mb-1 text-blue-400">{p.priority}</span>
              <span className="text-[11px] text-slate-500 block">{p.count} ردیف تکمیل‌شده</span>
              <span className="text-base font-bold font-mono text-slate-200 mt-1 block tabular-nums">
                {p.avg !== null ? `${Math.round(p.avg * 10) / 10} روز` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase Executor Split */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm p-5 sm:p-6 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          سهم هر مجری خرید از کل درخواست‌های واردشده به مرحله بازرگانی
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
            <span className="text-xs text-slate-400 block mb-1">خرید سایت</span>
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{executorCounts['سایت']}</span>
          </div>
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
            <span className="text-xs text-slate-400 block mb-1">دفتر تهران</span>
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{executorCounts['تهران']}</span>
          </div>
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
            <span className="text-xs text-slate-400 block mb-1">بازرگانی برنا</span>
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{executorCounts['برنا']}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
