import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { apiUpload, api, ApiError } from '../api/client';
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface PreviewResult {
  validCount: number;
  invalidRows: { excelRow: number; errors: string[] }[];
}

// ثبت گروهی درخواست کالا از فایل اکسل: هر ردیف اکسل = یک درخواست (دقیقاً با همان اعتبارسنجی فرم تک‌ردیفی)
export const ImportRowsView: React.FC = () => {
  const { setActiveTab, refresh, currentUser, canCreateRows } = useExactDb();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  if (!canCreateRows) {
    return <div className="p-10 text-center text-sm text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">فقط درخواست‌کننده‌ها می‌توانند از اکسل ثبت گروهی انجام دهند.</div>;
  }

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await apiUpload<PreviewResult>('/rows/import', file));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'آپلود ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/rows/import/confirm');
      await refresh();
      setActiveTab('dashboard');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">ثبت گروهی درخواست کالا از اکسل</h1>
            <p className="text-xs text-slate-400">دپارتمان ثبت‌کننده: خودکار از عضویت گروهی {currentUser?.displayName} تعیین می‌شود</p>
          </div>
        </div>
        <button onClick={() => setActiveTab('new_request')} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800" title="فرم تک‌ردیفی">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-3 text-xs text-slate-300">
        <a
          href="/api/v1/rows/import/template"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold no-underline"
        >
          <Download className="w-4 h-4" />
          <span>دانلود قالب اکسل</span>
        </a>
        <ul className="list-disc pr-5 space-y-1.5 text-slate-400 leading-relaxed">
          <li>ابتدا قالب را دانلود کنید، ردیف نمونه را جایگزین کنید و اطلاعات واقعی را وارد کنید. نام ستون‌ها را تغییر ندهید.</li>
          <li>همه‌ی ستون‌ها برای هر ردیف الزامی هستند و تاریخ‌ها باید متن شمسی باشند (مثلاً 1403/05/12)، نه تاریخ اکسل.</li>
          <li>حداکثر ۵۰۰ ردیف و ۵ مگابایت در هر فایل. ابتدا همه‌ی ردیف‌ها بررسی می‌شوند و ردیف‌های مشکل‌دار با شماره‌ی سطر اکسل نشان داده می‌شوند.</li>
          <li>ردیف‌های سالم بلافاصله «ثبت نهایی» می‌شوند و در فهرست مشترک دیده می‌شوند.</li>
        </ul>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setError(null); }}
          className="block w-full text-xs text-slate-300 file:ml-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
        />
        <button
          onClick={upload}
          disabled={!file || busy}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-40"
        >
          <Upload className="w-4 h-4" />
          <span>{busy ? 'در حال بررسی...' : 'آپلود و بررسی فایل'}</span>
        </button>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {preview && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
            <CheckCircle2 className="w-5 h-5" />
            <span>{preview.validCount} ردیف سالم آماده‌ی ثبت است</span>
          </div>

          {preview.invalidRows.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-amber-300">{preview.invalidRows.length} ردیف مشکل دارد و ثبت نمی‌شود:</div>
              <ul className="space-y-1.5 text-xs">
                {preview.invalidRows.map((r) => (
                  <li key={r.excelRow} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <b>سطر {r.excelRow} اکسل:</b> {r.errors.join(' — ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {preview.validCount > 0 && (
              <button
                onClick={confirm}
                disabled={busy}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40"
              >
                ثبت {preview.validCount} ردیف سالم
                {preview.invalidRows.length > 0 ? ' (بدون ردیف‌های مشکل‌دار)' : ''}
              </button>
            )}
            <button
              onClick={() => { setPreview(null); setFile(null); api('POST', '/rows/import/cancel').catch(() => {}); }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
            >
              اصلاح فایل و آپلود دوباره
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
