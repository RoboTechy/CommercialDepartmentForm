import React, { useEffect, useRef, useState } from 'react';
import { Palette, Moon, Sun, Check } from 'lucide-react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { ThemeAccent, ThemePrefs, applyTheme, loadTheme, saveTheme } from '../utils/theme';

const ACCENTS: { id: ThemeAccent; label: string; swatch: string }[] = [
  { id: 'blue', label: 'آبی', swatch: '#3b82f6' },
  { id: 'emerald', label: 'سبز', swatch: '#10b981' },
  { id: 'violet', label: 'بنفش', swatch: '#8b5cf6' },
  { id: 'amber', label: 'کهربایی', swatch: '#f59e0b' },
];

export const ThemeMenu: React.FC = () => {
  const { currentUser } = useExactDb();
  const username = currentUser?.username;
  const [prefs, setPrefs] = useState<ThemePrefs>(() => loadTheme(username));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = loadTheme(username);
    setPrefs(p);
    applyTheme(p);
  }, [username]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const update = (patch: Partial<ThemePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyTheme(next);
    saveTheme(username, next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent rounded-xl transition-colors"
        title="تم رنگی"
        aria-label="تم رنگی"
      >
        <Palette className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 z-[70] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-3">
          <div>
            <div className="text-[11px] text-slate-400 mb-1.5">حالت نمایش</div>
            <div className="grid grid-cols-2 gap-1.5">
              {([['dark', 'تیره', Moon], ['light', 'روشن', Sun]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => update({ mode: id })}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border transition-colors ${
                    prefs.mode === id
                      ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 mb-1.5">رنگ اصلی</div>
            <div className="grid grid-cols-4 gap-1.5">
              {ACCENTS.map(a => (
                <button
                  key={a.id}
                  onClick={() => update({ accent: a.id })}
                  title={a.label}
                  className={`h-8 rounded-lg border flex items-center justify-center transition-all ${
                    prefs.accent === a.id ? 'border-slate-200 scale-105' : 'border-slate-700 hover:border-slate-500'
                  }`}
                  style={{ backgroundColor: a.swatch }}
                >
                  {prefs.accent === a.id && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
