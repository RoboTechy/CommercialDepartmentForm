import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { X, XCircle } from 'lucide-react';

export const CancelReasonModal: React.FC = () => {
  const { cancelModalRowId, setCancelModalRowId, cancelRow, getRow } = useExactDb();
  const [reason, setReason] = useState('');

  if (cancelModalRowId === null) return null;
  const row = getRow(cancelModalRowId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('لطفاً دلیل لغو درخواست را وارد فرمایید.');
      return;
    }
    cancelRow(cancelModalRowId, reason.trim());
    setReason('');
    setCancelModalRowId(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      <div 
        onClick={() => setCancelModalRowId(null)}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden text-right">
          
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-rose-500/10">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-white">
                لغو درخواست {row?.request_no}
              </h3>
            </div>
            <button
              onClick={() => setCancelModalRowId(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              با لغو درخواست، ردیف از جریان عادی خارج می‌شود و فیلدهای آن قفل خواهد شد. این اقدام در تاریخچه ثبت می‌شود.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                دلیل لغو درخواست: <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="توضیح دهید چرا این درخواست لغو می‌شود..."
                className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalRowId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                انصراف
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-rose-600/30 transition-all active:scale-95"
              >
                تایید لغو درخواست
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
