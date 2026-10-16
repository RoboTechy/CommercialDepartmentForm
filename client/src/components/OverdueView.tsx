import React, { useMemo, useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { AlertTriangle, Search, ArrowDown, ArrowUp } from 'lucide-react';
import { OVERDUE_DAYS } from '../config';

type SortKey = 'days' | 'request_no' | 'dept' | 'section';

// ردیف‌های معطل‌مانده: جاری (نه لغو/عودت)، ثبت‌نهایی‌شده، تکمیل‌نشده، و قدیمی‌تر از OVERDUE_DAYS روز.
// «تعداد روز» = سن ردیف از لحظه‌ی ایجاد (همان قاعده‌ی سرویس قبلی).
export const OverdueView: React.FC = () => {
  const { getOverdueRows, setSelectedRowId, setActiveTab } = useExactDb();
  const all = getOverdueRows();

  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [minDays, setMinDays] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sectionTitles = useMemo(() => Array.from(new Set(all.map((o) => o.blockingSection.title))), [all]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = parseFloat(minDays.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    const filtered = all.filter(({ row, blockingSection, ageDays }) => {
      if (sectionFilter && blockingSection.title !== sectionFilter) return false;
      if (!isNaN(min) && ageDays < min) return false;
      if (!q) return true;
      return (
        row.request_no.toLowerCase().includes(q) ||
        row.item_description.toLowerCase().includes(q) ||
        (row.requester_dept || '').toLowerCase().includes(q) ||
        blockingSection.title.toLowerCase().includes(q) ||
        row.usage_location.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'request_no': return a.row.request_no.localeCompare(b.row.request_no, 'fa', { numeric: true }) * dir;
        case 'dept': return (a.row.requester_dept || '').localeCompare(b.row.requester_dept || '', 'fa') * dir;
        case 'section': return a.blockingSection.title.localeCompare(b.blockingSection.title, 'fa') * dir;
        default: return (a.ageDays - b.ageDays) * dir;
      }
    });
  }, [all, query, sectionFilter, minDays, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'days' ? 'desc' : 'asc');
    }
  };

  const Th: React.FC<{ k: SortKey; children: React.ReactNode }> = ({ k, children }) => (
    <th className="py-2.5 px-3 font-semibold">
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-white">
        <span>{children}</span>
        {sortKey === k && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />)}
      </button>
    </th>
  );

  const open = (id: number) => {
    setSelectedRowId(id);
    setActiveTab('row_detail');
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">ردیف‌های معطل‌مانده</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            درخواست‌های جاری که بیش از {OVERDUE_DAYS} روز از ایجادشان گذشته و هنوز کامل نشده‌اند. روی عنوان ستون‌ها کلیک کنید تا مرتب شوند.
          </p>
        </div>
        <span className="mr-auto font-mono text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded">
          {items.length} از {all.length} ردیف
        </span>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در شماره درخواست، شرح کالا، دپارتمان، محل مصرف..."
            className="w-full pr-9 pl-3 py-2 text-xs bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
          />
        </div>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
        >
          <option value="">منتظر همه‌ی بخش‌ها</option>
          {sectionTitles.map((t) => (
            <option key={t} value={t}>منتظر: {t}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-400 m-0">
          حداقل روز معطلی
          <input
            type="text"
            inputMode="numeric"
            value={minDays}
            onChange={(e) => setMinDays(e.target.value)}
            placeholder="مثلاً ۳۰"
            className="w-20 px-2 py-2 text-xs font-mono bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
          />
        </label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => { setSortKey('days'); setSortDir('desc'); }}
            className={`px-3 py-2 text-[11px] rounded-xl border font-semibold ${sortKey === 'days' && sortDir === 'desc' ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
          >
            بیشترین معطلی
          </button>
          <button
            type="button"
            onClick={() => { setSortKey('days'); setSortDir('asc'); }}
            className={`px-3 py-2 text-[11px] rounded-xl border font-semibold ${sortKey === 'days' && sortDir === 'asc' ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
          >
            کمترین معطلی
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/90 rounded-2xl border border-slate-800 text-sm text-slate-400">
          {all.length === 0 ? 'هیچ ردیف معطل‌مانده‌ای وجود ندارد.' : 'موردی با این جستجو/فیلتر پیدا نشد.'}
        </div>
      ) : (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-300 border-b border-slate-800">
                <tr>
                  <Th k="request_no">شماره درخواست</Th>
                  <th className="py-2.5 px-3 font-semibold">شرح کالا</th>
                  <Th k="dept">دپارتمان</Th>
                  <Th k="section">منتظر</Th>
                  <Th k="days">روز معطلی</Th>
                  <th className="py-2.5 px-3 font-semibold">تاریخ ایجاد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {items.map(({ row, blockingSection, ageDays }) => (
                  <tr key={row.id} onClick={() => open(row.id)} className="hover:bg-slate-800/40 cursor-pointer transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">{row.request_no}</td>
                    <td className="py-2.5 px-3 text-slate-200 max-w-[320px] truncate">{row.item_description}</td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{row.requester_dept || '—'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-semibold text-[11px]">
                        {blockingSection.title}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-300 tabular-nums">{ageDays}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">{row.created_at.split(' ')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
