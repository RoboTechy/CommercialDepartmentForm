import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { X, History } from 'lucide-react';

export const HistoryDrawer: React.FC = () => {
  const { historyDrawerRowId, setHistoryDrawerRowId, getRowHistory, getRow } = useExactDb();

  if (historyDrawerRowId === null) return null;

  const targetRow = getRow(historyDrawerRowId);
  const rowHistory = getRowHistory(historyDrawerRowId);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      <div 
        onClick={() => setHistoryDrawerRowId(null)}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex">
        <div className="w-screen max-w-md bg-slate-900 shadow-2xl border-r border-slate-800 flex flex-col">
          
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-sm font-bold text-white">
                  تاریخچه تغییرات ردیف #{historyDrawerRowId}
                </h2>
                <span className="text-xs font-mono font-bold text-blue-400">
                  {targetRow?.request_no}
                </span>
              </div>
            </div>

            <button
              onClick={() => setHistoryDrawerRowId(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {rowHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                هیچ تغییری برای این ردیف در audit_log ثبت نشده است.
              </div>
            ) : (
              <div className="relative border-r-2 border-slate-800 mr-2 pr-4 space-y-4">
                {rowHistory.map((item) => (
                  <div key={item.id} className="relative">
                    <div className="absolute -right-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-900" />

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span className="font-semibold text-slate-200">{item.changed_by_display}</span>
                        <span className="font-mono tabular-nums text-slate-500">{item.changed_at}</span>
                      </div>

                      <div className="text-slate-300 font-semibold">
                        فیلد: <span className="text-blue-400">{item.field_label}</span>
                      </div>

                      <div className="text-[11px] grid grid-cols-2 gap-2 pt-1 font-mono">
                        <div className="bg-rose-500/10 text-rose-300 p-1.5 rounded-lg border border-rose-500/20 truncate" title={item.old_value}>
                          <span className="text-[10px] text-rose-400 block font-sans">مقدار قبلی:</span>
                          {item.old_value || '— (خالی)'}
                        </div>
                        <div className="bg-emerald-500/10 text-emerald-300 p-1.5 rounded-lg border border-emerald-500/20 truncate" title={item.new_value}>
                          <span className="text-[10px] text-emerald-400 block font-sans">مقدار جدید:</span>
                          {item.new_value || '— (خالی)'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
            <button
              onClick={() => setHistoryDrawerRowId(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
            >
              بستن
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
