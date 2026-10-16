import React, { useEffect, useRef, useState } from 'react';
import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js';
import { ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { todayJalaliDate } from '../utils/exactJalaali';
import { toLatinDigits } from '../store/exactStore';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
// هفته از شنبه شروع می‌شود
const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const pad = (n: number) => String(n).padStart(2, '0');

function parse(value: string): { jy: number; jm: number; jd: number } | null {
  const m = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/.exec(toLatinDigits(value.trim()));
  if (!m) return null;
  const jy = +m[1], jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  // برای استفاده داخل کانتینرهای دارای اسکرول (مثل جدول): پاپ‌آپ با position: fixed رسم می‌شود تا بریده نشود
  fixedPopup?: boolean;
  autoOpen?: boolean;
  onBlurCommit?: () => void;
}

// فیلد تاریخ شمسی (خورشیدی) با تقویم بازشونده؛ مقدار همیشه به‌صورت YYYY/MM/DD
export const JalaliDateInput: React.FC<Props> = ({ value, onChange, disabled, placeholder = '1403/00/00', className = '', fixedPopup = false, autoOpen = false }) => {
  const [open, setOpen] = useState(autoOpen);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const base = parse(value) ?? parse(todayJalaliDate())!;
  const [view, setView] = useState({ jy: base.jy, jm: base.jm });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // موقعیت پاپ‌آپ ثابت نسبت به پنجره (با محدود شدن به لبه‌های صفحه)
  useEffect(() => {
    if (!open || !fixedPopup || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = 256;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    const top = r.bottom + 4 + 300 > window.innerHeight ? Math.max(8, r.top - 304) : r.bottom + 4;
    setPos({ top, left });
  }, [open, fixedPopup]);

  const toggle = () => {
    if (disabled) return;
    const b = parse(value) ?? parse(todayJalaliDate())!;
    setView({ jy: b.jy, jm: b.jm });
    setOpen((o) => !o);
  };

  const shift = (delta: number) =>
    setView((v) => {
      let m = v.jm + delta, y = v.jy;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { jy: y, jm: m };
    });

  // روز هفته‌ی اول ماه (۰ = شنبه)
  const g = toGregorian(view.jy, view.jm, 1);
  const offset = (new Date(g.gy, g.gm - 1, g.gd).getDay() + 1) % 7;
  const length = jalaaliMonthLength(view.jy, view.jm);
  const selected = parse(value);
  const today = toJalaali(new Date());

  const pick = (jd: number) => {
    onChange(`${view.jy}/${pad(view.jm)}/${pad(jd)}`);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex gap-1.5">
        <input
          type="text"
          dir="ltr"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder={placeholder}
          className={className}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={toggle}
          title="تقویم شمسی"
          className="px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 shrink-0 disabled:opacity-40"
        >
          <CalendarDays className="w-4 h-4" />
        </button>
      </div>

      {open && !disabled && (
        <div
          dir="rtl"
          style={fixedPopup && pos ? { position: 'fixed', top: pos.top, left: pos.left } : undefined}
          className={`${fixedPopup ? 'z-[70]' : 'absolute z-40 mt-1 right-0'} w-64 p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl`}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="ماه قبل">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-100">{MONTHS[view.jm - 1]} {fa(view.jy)}</span>
            <button type="button" onClick={() => shift(1)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="ماه بعد">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-slate-500 mb-1">
            {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: length }, (_, i) => i + 1).map((d) => {
              const isSel = selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === d;
              const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  className={`py-1 rounded-md ${
                    isSel ? 'bg-blue-600 text-white font-bold' : isToday ? 'border border-blue-500/60 text-blue-300' : 'text-slate-200 hover:bg-slate-800'
                  } ${(offset + d - 1) % 7 === 6 ? 'text-rose-300' : ''}`}
                >
                  {fa(d)}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 pt-2 border-t border-slate-800 text-[11px]">
            <button type="button" onClick={() => { onChange(todayJalaliDate()); setOpen(false); }} className="text-blue-400 hover:underline">امروز</button>
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-slate-400 hover:underline">پاک کردن</button>
          </div>
        </div>
      )}
    </div>
  );
};
