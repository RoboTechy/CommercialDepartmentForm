import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { allFields, requesterDepartments } from '../data/exactSections';
import { daysBetweenJalali } from '../utils/exactJalaali';
import { median } from '../store/exactStore';
import { 
  Clock, 
  Filter, 
  BarChart2, 
  ArrowRight, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';

export const DurationReportView: React.FC = () => {
  const { rows, setSelectedRowId, setActiveTab } = useExactDb();

  // Find all date fields
  const dateFields = allFields().filter(f => f.type === 'jalali-date');

  const [startField, setStartField] = useState('delivery_to_warehouse_date');
  const [endField, setEndField] = useState('referred_to_commercial_date');
  const [purchaseExecutor, setPurchaseExecutor] = useState('');
  const [requesterDept, setRequesterDept] = useState('');
  const [status, setStatus] = useState('active');

  // Filter rows
  const filteredPublished = rows.filter(r => {
    if (r.deleted_at || !r.published_at) return false;
    if (status === 'active' && (r.cancelled_at || r.returned_at)) return false;
    if (status === 'cancelled' && !r.cancelled_at) return false;
    if (status === 'returned' && (r.cancelled_at || !r.returned_at)) return false;
    if (purchaseExecutor && r.purchase_executor !== purchaseExecutor) return false;
    if (requesterDept && r.requester_dept !== requesterDept) return false;

    // Both fields must be filled
    if (!(r as any)[startField] || !(r as any)[endField]) return false;
    return true;
  });

  const reportItems: { row: any; days: number }[] = [];
  let negativeCount = 0;

  for (const r of filteredPublished) {
    const d = daysBetweenJalali((r as any)[startField], (r as any)[endField]);
    if (d === null) continue;
    if (d < 0) {
      negativeCount++;
      continue;
    }
    reportItems.push({ row: r, days: Math.round(d * 10) / 10 });
  }

  reportItems.sort((a, b) => b.days - a.days);
  const daysSorted = reportItems.map(i => i.days).sort((a, b) => a - b);
  const count = daysSorted.length;
  const avg = count ? Math.round((daysSorted.reduce((s, x) => s + x, 0) / count) * 10) / 10 : null;
  const med = median(daysSorted);
  const min = count ? daysSorted[0] : null;
  const max = count ? daysSorted[count - 1] : null;

  const startDef = dateFields.find(f => f.name === startField);
  const endDef = dateFields.find(f => f.name === endField);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              ابزار گزارش‌ساز عمومی مدت‌زمان مراحل
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              محاسبه دقیق فاصله زمانی (به روز)، میانگین، میانه، حداقل و حداکثر بین هر دو فیلد تاریخ دلخواه در فرایند
            </p>
          </div>
        </div>
      </div>

      {/* Selector and Filter Controls */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              مبدا محاسبه (فیلد تاریخ شروع):
            </label>
            <select
              value={startField}
              onChange={(e) => setStartField(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              {dateFields.map(f => (
                <option key={f.name} value={f.name}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              مقصد محاسبه (فیلد تاریخ پایان):
            </label>
            <select
              value={endField}
              onChange={(e) => setEndField(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              {dateFields.map(f => (
                <option key={f.name} value={f.name}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              مجری خرید:
            </label>
            <select
              value={purchaseExecutor}
              onChange={(e) => setPurchaseExecutor(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="">همه مجریان</option>
              <option value="سایت">سایت</option>
              <option value="تهران">تهران</option>
              <option value="برنا">برنا</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              دپارتمان درخواست‌کننده:
            </label>
            <select
              value={requesterDept}
              onChange={(e) => setRequesterDept(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="">همه دپارتمان‌ها</option>
              <option value="دفتر فنی">دفتر فنی</option>
              <option value="عمران">عمران</option>
              <option value="آی‌تی">آی‌تی</option>
            </select>
          </div>

        </div>
      </div>

      {/* Metrics Result Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm text-center">
          <span className="text-xs text-slate-400 block mb-1">تعداد نمونه محاسبه‌شده</span>
          <span className="text-2xl font-bold font-mono text-white tabular-nums">
            {count} ردیف
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm text-center">
          <span className="text-xs text-blue-400 block mb-1">میانگین زمان (روز)</span>
          <span className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
            {avg !== null ? avg : '—'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm text-center">
          <span className="text-xs text-indigo-400 block mb-1">میانه زمان (Median)</span>
          <span className="text-2xl font-bold font-mono text-indigo-400 tabular-nums">
            {med !== null ? med : '—'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm text-center">
          <span className="text-xs text-emerald-400 block mb-1">حداقل مدت (سریع‌ترین)</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {min !== null ? `${min} روز` : '—'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm text-center col-span-2 lg:col-span-1">
          <span className="text-xs text-rose-400 block mb-1">حداکثر مدت (کندترین)</span>
          <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            {max !== null ? `${max} روز` : '—'}
          </span>
        </div>
      </div>

      {negativeCount > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
          توجه: تعداد {negativeCount} ردیف به دلیل تاریخ ثبت اشتباه (تاریخ پایان قبل از تاریخ شروع) از آمار کنار گذاشته شدند.
        </div>
      )}

      {/* Slowest / Ranked Items List */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            فهرست ردیف‌ها به ترتیب مدت زمان طی‌شده (از طولانی‌ترین به کوتاه‌ترین)
          </h2>
          <span className="text-xs text-slate-400">
            فاصله از «{startDef?.label}» تا «{endDef?.label}»
          </span>
        </div>

        {reportItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            هیچ ردیفی که هر دو تاریخ برای آن پر شده باشد با این فیلترها یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">رتبه</th>
                  <th className="py-2.5 px-4">شماره درخواست</th>
                  <th className="py-2.5 px-4">دپارتمان</th>
                  <th className="py-2.5 px-4">شرح کالا</th>
                  <th className="py-2.5 px-4">{startDef?.label}</th>
                  <th className="py-2.5 px-4">{endDef?.label}</th>
                  <th className="py-2.5 px-4 text-center font-bold text-white">مدت زمان طی‌شده</th>
                  <th className="py-2.5 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {reportItems.map((item, idx) => (
                  <tr key={item.row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      {item.row.request_no}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {item.row.requester_dept}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-[220px] truncate">
                      {item.row.item_description}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                      {item.row[startField]}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                      {item.row[endField]}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-blue-400 tabular-nums">
                      {item.days} روز
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedRowId(item.row.id);
                          setActiveTab('row_detail');
                        }}
                        className="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold hover:bg-blue-600/30 transition-colors"
                      >
                        مشاهده فرم
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
