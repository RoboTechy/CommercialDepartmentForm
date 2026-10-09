import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { X, AlertTriangle } from 'lucide-react';

export const ReturnReasonModal: React.FC = () => {
  const { returnModalRowId, setReturnModalRowId, returnToTechOffice, getRow } = useExactDb();
  const [reason, setReason] = useState('');

  if (returnModalRowId === null) return null;
  const row = getRow(returnModalRowId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    returnToTechOffice(returnModalRowId, reason.trim());
    setReason('');
    setReturnModalRowId(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      <div 
        onClick={() => setReturnModalRowId(null)}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden text-right">
          
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-amber-500/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">
                عودت درخواست {row?.request_no} به {row?.requester_dept}
              </h3>
            </div>
            <button
              onClick={() => setReturnModalRowId(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              انبار کارفرما می‌تواند در صورت نقص اطلاعات یا مدارک، درخواست را به واحد درخواست‌کننده ({row?.requester_dept}) عودت دهد تا اصلاح شود.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                دلیل عودت به درخواست‌کننده (اختیاری):
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: نقشه فنی پیوست نشده است، شرح کالا مبهم است..."
                className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReturnModalRowId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                انصراف
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/30 transition-all active:scale-95"
              >
                تایید و عودت به درخواست‌کننده
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
