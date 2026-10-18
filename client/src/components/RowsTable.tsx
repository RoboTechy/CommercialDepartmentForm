import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { sections, isPaymentAuthWaived, FieldDef, SectionDef } from '../data/exactSections';
import { DbRow, PriorityLevel } from '../types';
import { JalaliDateInput } from './JalaliDateInput';
import { GROUPS } from '../config';
import { toLatinDigits } from '../store/exactStore';
import {
  ExternalLink, History, XCircle, RotateCcw, CheckCircle2, AlertTriangle, Trash2, AlertCircle, ChevronLeft, ChevronDown, Pencil,
} from 'lucide-react';

// پس‌زمینه‌ی سرستون‌ها باید مات باشد (چون هنگام اسکرول روی ردیف‌ها می‌چسبند)
const SECTION_STYLE: Record<string, { head: string; bg: string }> = {
  tech_operator: { head: 'text-blue-300', bg: '#0c1a3a' },
  warehouse: { head: 'text-amber-300', bg: '#241a09' },
  commercial: { head: 'text-emerald-300', bg: '#08251d' },
};

const SECTION_TITLE: Record<string, string> = {
  tech_operator: 'بخش ۱: درخواست‌کننده',
  warehouse_1: 'بخش ۲: انبار کارفرما (بلوک ۱)',
  commercial: 'بخش ۳: بازرگانی غدیر',
  warehouse_2: 'بخش ۴: انبار کارفرما (بلوک ۲)',
};

function priorityClass(p: PriorityLevel) {
  switch (p) {
    case 'A++':
    case 'A+': return 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
    case 'A': return 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold';
    case 'B': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// ---------- فیلتر هر ستون ----------
// کلیدها: 'id'، 'status' (active/cancelled/returned) یا نام فیلد. متن: شامل‌بودن (بی‌توجه به حروف و نوع رقم)؛ انتخابی: برابری.
const norm = (v: unknown) => toLatinDigits((v ?? '').toString()).toLowerCase().trim();

export function applyColumnFilters(rows: DbRow[], filters: Record<string, string>): DbRow[] {
  const active = Object.entries(filters).filter(([, v]) => v && v.trim() !== '');
  if (active.length === 0) return rows;
  const selectFields = new Set<string>();
  for (const s of sections) for (const f of s.fields) if (f.type === 'select') selectFields.add(f.name as string);
  return rows.filter((row) =>
    active.every(([key, val]) => {
      if (key === 'status') {
        if (val === 'active') return !row.cancelled_at && !row.returned_at;
        if (val === 'cancelled') return Boolean(row.cancelled_at);
        if (val === 'returned') return !row.cancelled_at && Boolean(row.returned_at);
        return true;
      }
      if (key === 'id') return norm(row.id).includes(norm(val));
      const cell = (row as any)[key];
      if (selectFields.has(key)) return (cell ?? '').toString() === val;
      return norm(cell).includes(norm(val));
    })
  );
}

interface HoverState { rowId: number; fieldKey: string; label: string; x: number; y: number }
interface EditState { rowId: number; fieldKey: string }

interface RowsTableProps {
  rows: DbRow[];
  colFilters: Record<string, string>;
  setColFilter: (key: string, value: string) => void;
  clearColFilters: () => void;
}

export const RowsTable: React.FC<RowsTableProps> = ({ rows, colFilters, setColFilter, clearColFilters }) => {
  const {
    currentUser, isAdmin, isLocalAdmin, canEditSectionForRow, canCancelRow, canReturnToTechOffice,
    updateSection, getRowHistory, quotationCount, notify, sectionLockReason, setSelectedRowId, setActiveTab, setHistoryDrawerRowId, setCancelModalRowId,
    setReturnModalRowId, uncancelRow, unreturnFromTechOffice, softDeleteRow,
  } = useExactDb();

  // ---------- ستون‌های باز/بسته: پیش‌فرض فقط بخش(های) خود کاربر باز است ----------
  const storageKey = currentUser ? `prt_open_sections_${currentUser.username}` : '';
  const defaultOpen = useMemo<string[]>(() => {
    if (!currentUser) return sections.map((s) => s.key);
    const mine = sections
      .filter((s) => (Array.isArray(s.group) ? s.group : [s.group]).some((g) => currentUser.groups.includes(g)))
      .map((s) => s.key);
    if (mine.length) return mine;
    // مدیریت (فقط گزارش): بخش درخواست‌کننده؛ ادمین/ناظر/بدون بخش: همه
    if (currentUser.groups.includes(GROUPS.management) && !isAdmin) return ['tech_operator'];
    return sections.map((s) => s.key);
  }, [currentUser, isAdmin]);

  const [open, setOpen] = useState<string[]>(() => {
    try {
      const saved = storageKey ? localStorage.getItem(storageKey) : null;
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return defaultOpen;
  });
  useEffect(() => {
    try { if (storageKey) localStorage.setItem(storageKey, JSON.stringify(open)); } catch { /* ignore */ }
  }, [open, storageKey]);

  const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));

  // ---------- ردیف‌های علامت‌گذاری‌شده (چک‌باکس ابتدای ردیف) ----------
  const markKey = currentUser ? `prt_marked_rows_${currentUser.username}` : '';
  const [marked, setMarked] = useState<number[]>(() => {
    try {
      const saved = markKey ? localStorage.getItem(markKey) : null;
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  });
  useEffect(() => {
    try { if (markKey) localStorage.setItem(markKey, JSON.stringify(marked)); } catch { /* ignore */ }
  }, [marked, markKey]);
  const toggleMark = (id: number) => setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const allMarked = rows.length > 0 && rows.every((r) => marked.includes(r.id));
  const toggleAllMarks = () =>
    setMarked((m) => (allMarked ? m.filter((id) => !rows.some((r) => r.id === id)) : Array.from(new Set([...m, ...rows.map((r) => r.id)]))));
  const markedCount = rows.filter((r) => marked.includes(r.id)).length;
  const activeFilterCount = Object.values(colFilters).filter((v) => v && v.trim()).length;

  // ---------- هاور: تاریخچه‌ی همان فیلد ----------
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const clearHover = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHover(null);
  };
  const onEnter = (e: React.MouseEvent<HTMLElement>, row: DbRow, field: FieldDef) => {
    if (edit) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setHover({ rowId: row.id, fieldKey: field.name as string, label: field.label, x: rect.left + rect.width / 2, y: rect.bottom });
    }, 250);
  };

  const hoverEntries = useMemo(
    () => (hover ? getRowHistory(hover.rowId).filter((h) => h.field_key === hover.fieldKey).slice(0, 5) : []),
    [hover, getRowHistory]
  );

  // ---------- ویرایش درجا ----------
  const [edit, setEdit] = useState<EditState | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEditField = (row: DbRow, section: SectionDef, field: FieldDef): boolean => {
    if (field.readOnly || field.name === 'request_no') return false;
    if (field.name === 'payment_auth_issued_date' && isPaymentAuthWaived(row)) return false;
    if (!row.published_at) return false;
    return canEditSectionForRow(row, section.key);
  };

  const startEdit = (row: DbRow, field: FieldDef) => {
    clearHover();
    setEdit({ rowId: row.id, fieldKey: field.name as string });
    setDraftValue((row[field.name] ?? '').toString());
    setEditError(null);
  };
  const cancelEdit = () => { setEdit(null); setEditError(null); };

  const commitEdit = async (row: DbRow, section: SectionDef, field: FieldDef, value: string) => {
    if (saving) return;
    const old = (row[field.name] ?? '').toString();
    if (value.trim() === old) { cancelEdit(); return; }
    // بقیه‌ی فیلدهای همان بخش دست‌نخورده می‌مانند
    const values: Record<string, string> = {};
    for (const f of section.fields) values[f.name as string] = (row[f.name] ?? '').toString();
    values[field.name as string] = value;
    setSaving(true);
    const res = await updateSection(row.id, section.key, values);
    setSaving(false);
    if (res.ok) cancelEdit();
    else setEditError(res.errors.join(' — '));
  };

  const openRow = (id: number) => { setSelectedRowId(id); setActiveTab('row_detail'); };

  // ---------- رندر یک سلول ----------
  const renderValue = (row: DbRow, field: FieldDef) => {
    const raw = (row[field.name] ?? '').toString();
    if (field.name === 'payment_auth_issued_date' && isPaymentAuthWaived(row)) {
      return <span className="text-[10px] text-slate-500 font-sans" title="به دلیل مجری خرید تهران/برنا معاف از مجوز پرداخت سایت است">(معاف - {row.purchase_executor})</span>;
    }
    if (!raw) return <span className="text-slate-600">—</span>;
    if (field.name === 'priority') {
      return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${priorityClass(raw as PriorityLevel)}`}>{raw}</span>;
    }
    if (field.name === 'purchase_executor') {
      return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 border border-slate-700">{raw}</span>;
    }
    return <span>{raw}</span>;
  };

  const renderEditor = (row: DbRow, section: SectionDef, field: FieldDef) => {
    const common = 'w-full min-w-[110px] px-2 py-1.5 text-xs bg-slate-950 border border-blue-500 rounded-lg text-slate-100 focus:outline-hidden';
    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(row, section, field, draftValue); }
    };
    return (
      <div onClick={(e) => e.stopPropagation()} className="space-y-1">
        {field.type === 'select' ? (
          <select
            autoFocus
            value={draftValue}
            onChange={(e) => { setDraftValue(e.target.value); commitEdit(row, section, field, e.target.value); }}
            onBlur={cancelEdit}
            onKeyDown={onKey}
            className={common}
          >
            <option value="">— انتخاب —</option>
            {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : field.type === 'jalali-date' ? (
          <div>
            <JalaliDateInput
              value={draftValue}
              onChange={(v) => {
                setDraftValue(v);
                // انتخاب روز از تقویم (مقدار کامل YYYY/MM/DD) = ذخیره‌ی فوری؛ تایپ دستی با Enter ذخیره می‌شود
                if (/^\d{4}\/\d{2}\/\d{2}$/.test(v) || v === '') commitEdit(row, section, field, v);
              }}
              fixedPopup
              autoOpen
              className={`${common} font-mono`}
            />
            <div className="mt-1 flex gap-2 text-[10px]">
              <button type="button" className="text-emerald-400 hover:underline" onClick={() => commitEdit(row, section, field, draftValue)}>ذخیره</button>
              <button type="button" className="text-slate-400 hover:underline" onClick={cancelEdit}>انصراف</button>
            </div>
          </div>
        ) : (
          <input
            autoFocus
            type="text"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={() => commitEdit(row, section, field, draftValue)}
            onKeyDown={onKey}
            className={common}
          />
        )}
        {editError && <div className="text-[10px] text-rose-400 max-w-[220px] leading-snug whitespace-normal">{editError}</div>}
      </div>
    );
  };

  const headRow1 = useRef<HTMLTableRowElement>(null);
  const headRow2 = useRef<HTMLTableRowElement>(null);
  const [h1, setH1] = useState(40);
  const [h2, setH2] = useState(34);
  useLayoutEffect(() => {
    if (headRow1.current) setH1(headRow1.current.offsetHeight);
    if (headRow2.current) setH2(headRow2.current.offsetHeight);
  });

  // دلیل غیرقابل‌ویرایش بودن یک فیلد (برای پیام وقتی روی آن کلیک می‌شود)
  const whyNotEditable = (row: DbRow, section: SectionDef, field: FieldDef): string => {
    if (field.readOnly) return `«${field.label}» خودکار تعیین می‌شود و قابل تغییر نیست.`;
    if (field.name === 'payment_auth_issued_date' && isPaymentAuthWaived(row)) return `مجری خرید «${row.purchase_executor}» است؛ مجوز پرداخت سایت لازم نیست.`;
    if (row.cancelled_at) return 'این درخواست لغو شده است؛ برای ویرایش ابتدا لغو را بردارید.';
    if (row.returned_at && section.key !== 'tech_operator') return 'این درخواست به درخواست‌کننده عودت داده شده؛ فقط درخواست‌کننده می‌تواند ویرایش کند.';
    const lock = sectionLockReason(row, section.key);
    if (lock) return lock;
    if (section.key === 'tech_operator') return `این درخواست متعلق به دپارتمان «${row.requester_dept || '—'}» است و فقط همان دپارتمان (یا ادمین) می‌تواند آن را ویرایش کند.`;
    return `ویرایش «${SECTION_TITLE[section.key] || section.title}» فقط برای پرسنل همان بخش (یا ادمین) مجاز است.`;
  };

  const openSections = sections.filter((s) => open.includes(s.key));
  const baseCols = 3; // چک‌باکس، ردیف، وضعیت
  const totalCols = baseCols + sections.reduce((n, s) => n + (open.includes(s.key) ? s.fields.length : 1), 0) + 1;

  return (
    <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-800 text-[11px] text-slate-400 flex-wrap">
        <span>
          بخش شما باز است؛ بقیه با کلیک روی عنوانشان باز می‌شوند · مقدارهای دارای آیکن <Pencil className="w-2.5 h-2.5 inline text-blue-400" /> با یک کلیک همان‌جا ویرایش می‌شوند · هاور = تاریخچه‌ی فیلد
        </span>
        <span className="flex gap-2 flex-wrap items-center">
          {markedCount > 0 && (
            <button type="button" onClick={() => setMarked((m) => m.filter((id) => !rows.some((r) => r.id === id)))} className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200">
              {markedCount} ردیف علامت‌دار — برداشتن علامت‌ها
            </button>
          )}
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearColFilters} className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300">
              پاک کردن جستجوی ستون‌ها ({activeFilterCount})
            </button>
          )}
          <button type="button" onClick={() => setOpen(sections.map((s) => s.key))} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200">باز کردن همه</button>
          <button type="button" onClick={() => setOpen(defaultOpen)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200">فقط بخش من</button>
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr ref={headRow1} className="border-b border-slate-800 text-[11px] font-bold text-slate-300">
              <th colSpan={baseCols} style={{ backgroundColor: '#020617' }} className="sticky top-0 z-20 py-2.5 px-3 border-l border-slate-800">مشخصات اولیه ردیف</th>
              {sections.map((s) => {
                const isOpen = open.includes(s.key);
                const st = SECTION_STYLE[s.color];
                return (
                  <th
                    key={s.key}
                    colSpan={isOpen ? s.fields.length : 1}
                    rowSpan={isOpen ? 1 : 2}
                    style={{ backgroundColor: st.bg }}
                    className={`sticky top-0 z-20 py-2.5 px-3 border-l border-slate-800 ${st.head} ${isOpen ? '' : 'align-middle'}`}
                  >
                    <button type="button" onClick={() => toggle(s.key)} className="inline-flex items-center gap-1.5 font-bold hover:underline" title={isOpen ? 'بستن این بخش' : 'باز کردن این بخش'}>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                      <span>{SECTION_TITLE[s.key]}</span>
                      {!isOpen && <span className="text-[10px] font-normal opacity-70">({s.fields.filter((f) => !f.readOnly).length} فیلد)</span>}
                    </button>
                  </th>
                );
              })}
              <th rowSpan={2} style={{ backgroundColor: '#020617' }} className="sticky top-0 z-20 py-2.5 px-3 text-center align-middle">اقدامات</th>
            </tr>
            <tr ref={headRow2} className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
              <th style={{ top: h1, backgroundColor: '#0b1224' }} className="sticky z-10 py-1.5 px-2 w-8">
                <input type="checkbox" checked={allMarked} onChange={toggleAllMarks} title="علامت‌گذاری/برداشتن همه‌ی ردیف‌های نمایش‌داده‌شده" className="rounded border-slate-600 bg-slate-900 text-indigo-500 cursor-pointer" />
              </th>
              <th style={{ top: h1, backgroundColor: '#0b1224' }} className="sticky z-10 py-1.5 px-2">ردیف</th>
              <th style={{ top: h1, backgroundColor: '#0b1224' }} className="sticky z-10 py-1.5 px-2 border-l border-slate-800">وضعیت</th>
              {openSections.map((s) =>
                s.fields.map((f, i) => (
                  <th key={`${s.key}-${f.name as string}`} style={{ top: h1, backgroundColor: '#0b1224' }} className={`sticky z-10 py-1.5 px-2 whitespace-nowrap ${i === s.fields.length - 1 ? 'border-l border-slate-800' : ''}`}>
                    {f.label}
                  </th>
                ))
              )}
            </tr>
            {/* ردیف جستجوی هر ستون */}
            <tr className="border-b border-slate-700">
              <th style={{ top: h1 + h2, backgroundColor: '#070d1c' }} className="sticky z-10 p-1" />
              <th style={{ top: h1 + h2, backgroundColor: '#070d1c' }} className="sticky z-10 p-1">
                <input
                  type="text"
                  value={colFilters.id || ''}
                  onChange={(e) => setColFilter('id', e.target.value)}
                  placeholder="جستجو"
                  className="w-12 px-1.5 py-1 text-[10px] font-normal bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </th>
              <th style={{ top: h1 + h2, backgroundColor: '#070d1c' }} className="sticky z-10 p-1 border-l border-slate-800">
                <select
                  value={colFilters.status || ''}
                  onChange={(e) => setColFilter('status', e.target.value)}
                  className="px-1 py-1 text-[10px] font-normal bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">همه</option>
                  <option value="active">جاری</option>
                  <option value="cancelled">لغو شده</option>
                  <option value="returned">عودت</option>
                </select>
              </th>
              {sections.map((s) => {
                if (!open.includes(s.key)) {
                  return <th key={s.key} style={{ top: h1 + h2, backgroundColor: '#070d1c' }} className="sticky z-10 p-1 border-l border-slate-800" />;
                }
                return s.fields.map((f, i) => {
                  const key = f.name as string;
                  const cls = 'w-full min-w-[70px] px-1.5 py-1 text-[10px] font-normal bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-hidden focus:border-blue-500';
                  return (
                    <th
                      key={`f-${s.key}-${key}`}
                      style={{ top: h1 + h2, backgroundColor: '#070d1c' }}
                      className={`sticky z-10 p-1 ${i === s.fields.length - 1 ? 'border-l border-slate-800' : ''}`}
                    >
                      {f.type === 'select' ? (
                        <select value={colFilters[key] || ''} onChange={(e) => setColFilter(key, e.target.value)} className={cls}>
                          <option value="">همه</option>
                          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={colFilters[key] || ''}
                          onChange={(e) => setColFilter(key, e.target.value)}
                          placeholder="جستجو"
                          className={cls}
                        />
                      )}
                    </th>
                  );
                });
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="py-12 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-medium">هیچ ردیفی با این فیلترها یافت نشد</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isCancelled = Boolean(row.cancelled_at);
                const isReturned = Boolean(row.returned_at);
                const isMarked = marked.includes(row.id);
                return (
                  <tr key={row.id} className={`transition-colors ${isMarked ? 'bg-indigo-500/20 hover:bg-indigo-500/25' : `hover:bg-slate-800/40 ${isCancelled ? 'bg-rose-950/20' : isReturned ? 'bg-amber-950/20' : ''}`}`}>
                    <td className={`py-2 px-2 w-8 ${isMarked ? 'border-r-4 border-indigo-400' : ''}`}>
                      <input type="checkbox" checked={isMarked} onChange={() => toggleMark(row.id)} title="علامت‌گذاری این ردیف" className="rounded border-slate-600 bg-slate-900 text-indigo-500 cursor-pointer" />
                    </td>
                    <td className="py-2 px-2 font-mono font-bold text-slate-400 tabular-nums">{row.id}</td>
                    <td className="py-2 px-2 whitespace-nowrap border-l border-slate-800">
                      {isCancelled ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30" title={row.cancel_reason}>لغو شده</span>
                      ) : isReturned ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30" title={row.return_reason}>عودت داده شده</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">جاری</span>
                      )}
                    </td>

                    {sections.map((s) => {
                      if (!open.includes(s.key)) {
                        const need = s.fields.filter((f) => !f.readOnly && !(f.name === 'payment_auth_issued_date' && isPaymentAuthWaived(row)));
                        const filled = need.filter((f) => (row[f.name] ?? '').toString().trim() !== '').length;
                        const done = filled === need.length;
                        return (
                          <td key={s.key} className="py-2.5 px-3 border-l border-slate-800 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggle(s.key)}
                              className={`px-2 py-0.5 rounded-full text-[10px] border font-mono ${done ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-slate-700 text-slate-400 bg-slate-800/60'}`}
                              title="باز کردن این بخش"
                            >
                              {filled}/{need.length}
                            </button>
                          </td>
                        );
                      }

                      return s.fields.map((f, i) => {
                        const key = f.name as string;
                        const editing = edit && edit.rowId === row.id && edit.fieldKey === key;
                        const editable = canEditField(row, s, f);
                        const last = i === s.fields.length - 1;
                        const base = `py-2 px-2 ${last ? 'border-l border-slate-800' : ''}`;

                        if (key === 'request_no') {
                          return (
                            <td key={key} className={`${base} whitespace-nowrap`}>
                              <span className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openRow(row.id)}
                                  className="font-mono font-bold text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                                  title="رفتن به صفحه‌ی مشاهده و ویرایش این درخواست"
                                >
                                  {row.request_no}
                                  <ExternalLink className="w-3 h-3 opacity-60" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setHistoryDrawerRowId(row.id)}
                                  className="p-0.5 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-800"
                                  title="تاریخچه‌ی تمام تغییرات روی تمام فیلدهای این درخواست"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                                {quotationCount(row.id) > 0 && (
                                  <span
                                    className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                    title="برای این درخواست پیش‌فاکتور گرفته شده است"
                                  >
                                    {quotationCount(row.id)} پیش‌فاکتور
                                  </span>
                                )}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={key}
                            className={`${base} ${f.type === 'jalali-date' || key.includes('no') ? 'font-mono' : ''} ${f.type === 'jalali-date' ? 'tabular-nums text-slate-300' : 'text-slate-200'} ${key === 'item_description' ? 'max-w-[220px]' : 'whitespace-nowrap'} ${editable && !editing ? 'cursor-text hover:bg-blue-500/10 group' : ''}`}
                            onMouseEnter={(e) => onEnter(e, row, f)}
                            onMouseLeave={clearHover}
                            onClick={() => {
                              if (editing) return;
                              if (editable) startEdit(row, f);
                              else notify('info', whyNotEditable(row, s, f));
                            }}
                            title={editable ? 'کلیک برای ویرایش' : undefined}
                          >
                            {editing ? (
                              renderEditor(row, s, f)
                            ) : (
                              <span className={key === 'item_description' ? 'block truncate' : 'inline-flex items-center gap-1'}>
                                {renderValue(row, f)}
                                {editable && <Pencil className="w-2.5 h-2.5 text-blue-400/45 group-hover:text-blue-400" />}
                              </span>
                            )}
                          </td>
                        );
                      });
                    })}

                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openRow(row.id)} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors" title="مشاهده و ویرایش بخش‌ها"><ExternalLink className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setHistoryDrawerRowId(row.id)} className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors" title="تاریخچه‌ی کامل این ردیف"><History className="w-3.5 h-3.5" /></button>
                        {canCancelRow(row) && !isReturned && (
                          isCancelled ? (
                            <button onClick={() => uncancelRow(row.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded" title="بازگردانی از لغو"><RotateCcw className="w-3.5 h-3.5" /></button>
                          ) : (
                            <button onClick={() => setCancelModalRowId(row.id)} className="p-1 text-rose-400 hover:bg-rose-500/10 rounded" title="لغو درخواست"><XCircle className="w-3.5 h-3.5" /></button>
                          )
                        )}
                        {canReturnToTechOffice && !isCancelled && (
                          isReturned ? (
                            <button onClick={() => unreturnFromTechOffice(row.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded" title="لغو عودت"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                          ) : (
                            <button onClick={() => setReturnModalRowId(row.id)} className="p-1 text-amber-400 hover:bg-amber-500/10 rounded" title="عودت به درخواست‌کننده"><AlertTriangle className="w-3.5 h-3.5" /></button>
                          )
                        )}
                        {isLocalAdmin && (
                          <button
                            onClick={() => { if (window.confirm(`انتقال ردیف ${row.request_no} به سطل زباله؟`)) softDeleteRow(row.id); }}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                            title="حذف نرم"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* پاپ‌آپ تاریخچه‌ی فیلد (هاور) */}
      {hover && (
        <div
          style={{ position: 'fixed', top: Math.min(hover.y + 6, window.innerHeight - 180), left: Math.max(8, Math.min(hover.x - 150, window.innerWidth - 316)) }}
          className="z-[65] w-[300px] p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-[11px] pointer-events-none"
          dir="rtl"
        >
          <div className="font-bold text-slate-200 mb-1.5">تاریخچه‌ی «{hover.label}»</div>
          {hoverEntries.length === 0 ? (
            <div className="text-slate-500">تغییری برای این فیلد ثبت نشده است.</div>
          ) : (
            <ul className="space-y-1.5">
              {hoverEntries.map((h) => (
                <li key={h.id} className="leading-relaxed text-slate-300">
                  <span className="text-slate-400">{h.changed_by_display.split('(')[0]}</span>
                  <span className="text-slate-500 mx-1">·</span>
                  <span className="font-mono text-slate-400">{h.changed_at}</span>
                  <div>
                    از <span className="font-mono text-rose-300/90">«{h.old_value || 'خالی'}»</span>
                    {' '}به <span className="font-mono text-emerald-300">«{h.new_value || 'خالی'}»</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
