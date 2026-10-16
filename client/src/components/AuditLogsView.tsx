import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { ScrollText, Search } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { auditLogs } = useExactDb();
  const [search, setSearch] = useState('');

  const filteredLogs = auditLogs.filter(log => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.field_label.toLowerCase().includes(q) ||
      log.changed_by_display.toLowerCase().includes(q) ||
      log.old_value.toLowerCase().includes(q) ||
      log.new_value.toLowerCase().includes(q) ||
      String(log.row_id).includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                تاریخچه تغییرات فیلدها و ممیزی سیستم (audit_log)
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                ثبت تفصیلی کلیه تغییرات فیلدهای فرم، همراه با مقدار قبلی، مقدار جدید، نام کاربر و زمان دقیق
              </p>
            </div>
          </div>
        </div>

        <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full self-start sm:self-auto">
          {filteredLogs.length} رکورد
        </span>
      </div>

      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در فیلد، نام کاربر، شماره ردیف یا مقادیر ثبت‌شده..."
            className="w-full pr-9 pl-4 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/60 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">زمان تغییر</th>
                <th className="py-3 px-4">ردیف</th>
                <th className="py-3 px-4">بخش</th>
                <th className="py-3 px-4">فیلد تغییر یافته</th>
                <th className="py-3 px-4">مقدار قبلی</th>
                <th className="py-3 px-4">مقدار جدید</th>
                <th className="py-3 px-4">کاربر تغییردهنده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    هیچ رکوردی یافت نشد
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                      {log.changed_at}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      #{log.row_id}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {log.section_key}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {log.field_label}
                    </td>
                    <td className="py-3 px-4 text-rose-300 font-mono max-w-[160px] truncate bg-rose-500/10 px-2 py-0.5 rounded">
                      {log.old_value || '— (خالی)'}
                    </td>
                    <td className="py-3 px-4 text-emerald-300 font-mono max-w-[160px] truncate bg-emerald-500/10 px-2 py-0.5 rounded">
                      {log.new_value || '— (خالی)'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.changed_by_display}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
