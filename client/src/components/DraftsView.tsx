import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { 
  FileEdit, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  ArrowRight,
  AlertCircle 
} from 'lucide-react';

export const DraftsView: React.FC = () => {
  const { 
    getDraftRows, 
    finalizeDrafts, 
    discardDraft, 
    setSelectedRowId, 
    setActiveTab, 
    currentUser 
  } = useExactDb();

  const drafts = getDraftRows();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleFinalizeAll = () => {
    if (window.confirm(`ثبت نهایی ${drafts.length} مورد پیش‌نویس و ورود به فهرست اصلی؟`)) {
      finalizeDrafts();
      setActiveTab('dashboard');
    }
  };

  const handleFinalizeSelected = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`ثبت نهایی ${selectedIds.length} مورد پیش‌نویس انتخابی؟`)) {
      finalizeDrafts(selectedIds);
      setActiveTab('dashboard');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                پیش‌نویس‌های من
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                درخواست‌هایی که ساخته‌اید ولی هنوز ثبت نهایی نشده‌اند. پس از بررسی، می‌توانید همه را یکجا ثبت نهایی کنید.
              </p>
            </div>
          </div>
        </div>

        {drafts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.length > 0 && (
              <button
                onClick={handleFinalizeSelected}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all"
              >
                <CheckCheck className="w-4 h-4" />
                <span>ثبت نهایی موارد انتخابی ({selectedIds.length})</span>
              </button>
            )}

            <button
              onClick={handleFinalizeAll}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all active:scale-95"
            >
              <CheckCheck className="w-4 h-4" />
              <span>ثبت نهایی همه ({drafts.length})</span>
            </button>
          </div>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/90 rounded-2xl border border-slate-800">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-slate-300">در حال حاضر پیش‌نویسی ندارید</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            در صفحه ثبت درخواست کالای جدید، می‌توانید درخواست‌ها را ابتدا به عنوان پیش‌نویس ذخیره کرده و سپس بررسی نمایید.
          </p>
          <button
            onClick={() => setActiveTab('new_request')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
          >
            ثبت درخواست جدید
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === drafts.length && drafts.length > 0}
                      onChange={(e) => setSelectedIds(e.target.checked ? drafts.map(d => d.id) : [])}
                      className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-2.5 px-4">شماره درخواست</th>
                  <th className="py-2.5 px-4">شرح کالا</th>
                  <th className="py-2.5 px-4">تعداد / واحد</th>
                  <th className="py-2.5 px-4">اولویت</th>
                  <th className="py-2.5 px-4">محل مصرف</th>
                  <th className="py-2.5 px-4">تاریخ تحویل</th>
                  <th className="py-2.5 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {drafts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(d.id)}
                        onChange={() => toggleSelect(d.id)}
                        className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      {d.request_no}
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-[220px] truncate">
                      {d.item_description}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-300">
                      {d.total_qty} {d.unit}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {d.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {d.usage_location}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                      {d.delivery_to_warehouse_date}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedRowId(d.id);
                            setActiveTab('row_detail');
                          }}
                          className="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>ویرایش</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(`حذف پیش‌نویس ${d.request_no}؟`)) {
                              discardDraft(d.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="دور انداختن پیش‌نویس"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
