import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { DEMO_MODE } from '../config';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  User, 
  Server, 
  ArrowLeft, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, allUsers } = useExactDb();

  const [authMode, setAuthMode] = useState<'ldap' | 'local'>('local');
  const [username, setUsername] = useState(DEMO_MODE ? 'admin' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'admin' : '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const res = login(username, password, authMode);
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'ورود ناموفق بود.');
      }
    }, 250);
  };

  const handleSelectQuickUser = (user: typeof allUsers[0]) => {
    setUsername(user.username);
    setPassword(user.username === 'admin' ? 'admin' : 'ldap1234');
    setAuthMode(user.authType === 'local' ? 'local' : 'ldap');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background glowing effects for rich dark theme */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 mb-3 border border-blue-400/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            سامانه جامع مدیریت بازرگانی و انبار
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            پورتال سازمانی مدیریت تدارکات، کنترل گردش کار و انبار کارفرما
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/60">
          
          {/* Auth Mode Tabs (Local Admin vs LDAP Domain) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('local');
                setUsername(DEMO_MODE ? 'admin' : '');
                setPassword(DEMO_MODE ? 'admin' : '');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'local'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>ورود ادمین محلی</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('ldap');
                setUsername(DEMO_MODE ? 'soleimani' : '');
                setPassword(DEMO_MODE ? 'ldap1234' : '');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'ldap'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>دامین سازمانی (LDAP)</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 text-right">
                {authMode === 'local' ? 'نام کاربری ادمین' : 'نام کاربری دامین (LDAP Username)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={authMode === 'local' ? 'admin' : 'username'}
                  dir="ltr"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono"
                />
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 text-right">
                کلمه عبور (Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Quick credentials hint (فقط دمو) */}
            {DEMO_MODE && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] space-y-1 text-slate-400">
              {authMode === 'local' ? (
                <div className="flex items-center gap-1.5 text-blue-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>یوزر و پسورد ادمین محلی: <b>admin</b> / <b>admin</b></span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <Server className="w-3.5 h-3.5 shrink-0" />
                  <span>احراز هویت از طریق سرور Active Directory / LDAP</span>
                </div>
              )}
            </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <span>در حال تایید اعتبار...</span>
              ) : (
                <>
                  <span>ورود به سامانه</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Select Domain User for Demo */}
          {DEMO_MODE && (
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
              <span>تست سریع کاربران سازمانی:</span>
              <span className="text-[10px] text-slate-500 font-mono">یک کلیک برای انتخاب</span>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {allUsers.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => handleSelectQuickUser(u)}
                  className={`text-right p-1.5 rounded-lg border text-[11px] transition-colors truncate ${
                    username === u.username
                      ? 'border-blue-500/60 bg-blue-500/10 text-blue-300 font-medium'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                  }`}
                  title={`${u.displayName} (${u.username})`}
                >
                  <div className="truncate font-semibold text-slate-200">{u.displayName.split('(')[0]}</div>
                  <div className="text-[10px] font-mono text-slate-500">{u.username}</div>
                </button>
              ))}
            </div>
          </div>
          )}

        </div>

        {DEMO_MODE && (
          <div className="text-center mt-6 text-xs text-amber-400/80">
            نسخه‌ی نمایشی (دمو): احراز هویت شبیه‌سازی‌شده است و داده‌ها فقط در همین مرورگر ذخیره می‌شوند.
          </div>
        )}
      </div>
    </div>
  );
};
