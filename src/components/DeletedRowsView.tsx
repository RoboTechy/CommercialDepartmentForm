import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { Trash2, RotateCcw, AlertCircle } from 'lucide-react';

export const DeletedRowsView: React.FC = () => {
  const { rows, restoreRow } = useExactDb();
  const deletedRows = rows.filter(r => Boolean(r.deleted_at));

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center font-bold">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                سطل زباله (ردیف‌های حذف نرم شده)
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                ردیف‌های حذف‌شده از دید عموم پنهان هستند ولی اطلاعات آن‌ها در دیتابیس محفوظ مانده و قابل بازیابی است.
              </p>
            </div>
          </div>
        </div>
        <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full">
          {deletedRows.length} مورد
        </span>
      </div>

      {deletedRows.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/90 rounded-2xl border border-slate-800 text-slate-500">
          <Trash2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h2 className="text-sm font-semibold text-slate-300">سطل زباله خالی است</h2>
        </div>
      ) : (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ردیف</th>
                  <th className="py-3 px-4">شماره درخواست</th>
                  <th className="py-3 px-4">دپارتمان</th>
                  <th className="py-3 px-4">شرح کالا</th>
                  <th className="py-3 px-4">حذف شده توسط</th>
                  <th className="py-3 px-4">زمان حذف</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {deletedRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">
                      #{row.id}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {row.request_no}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-300">
                      {row.requester_dept}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-[200px] truncate">
                      {row.item_description}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {row.deleted_by_display}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                      {row.deleted_at}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => restoreRow(row.id)}
                        className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-xl text-xs font-semibold flex items-center gap-1 mx-auto transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>بازیابی</span>
                      </button>
                    </td>
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
