export type ThemeMode = 'dark' | 'light';
export type ThemeAccent = 'blue' | 'emerald' | 'violet' | 'amber';
export interface ThemePrefs { mode: ThemeMode; accent: ThemeAccent }

const DEFAULT: ThemePrefs = { mode: 'dark', accent: 'blue' };
const key = (user?: string | null) => `prt-theme:${user || '_'}`;

export function loadTheme(user?: string | null): ThemePrefs {
  try {
    const raw = localStorage.getItem(key(user)) ?? localStorage.getItem(key(null));
    if (raw) {
      const p = JSON.parse(raw);
      return {
        mode: p.mode === 'light' ? 'light' : 'dark',
        accent: ['emerald', 'violet', 'amber'].includes(p.accent) ? p.accent : 'blue',
      };
    }
  } catch { /* ignore */ }
  return DEFAULT;
}

export function applyTheme(p: ThemePrefs) {
  const el = document.documentElement;
  el.setAttribute('data-mode', p.mode);
  el.setAttribute('data-accent', p.accent);
}

export function saveTheme(user: string | null | undefined, p: ThemePrefs) {
  try {
    localStorage.setItem(key(user), JSON.stringify(p));
    localStorage.setItem(key(null), JSON.stringify(p)); // برای صفحه‌ی ورود و ورود بعدی
  } catch { /* ignore */ }
}
