import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { X, ShieldCheck, LogOut } from 'lucide-react';

// اطلاعات نشست کاربر جاری (نام، گروه‌های LDAP، زمان پایان نشست) و خروج
export const LdapUserModal: React.FC = () => {
  const { isLdapModalOpen, setIsLdapModalOpen, currentUser, sessionExpiresAt, logout } = useExactDb();

  if (!isLdapModalOpen || !currentUser) return null;

  const expires = sessionExpiresAt ? new Date(sessionExpiresAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      <div onClick={() => setIsLdapModalOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden text-right">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">مشخصات نشست</h3>
            </div>
            <button onClick={() => setIsLdapModalOpen(false)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-3 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">نام</span><span className="text-slate-100 font-semibold">{currentUser.displayName}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">نام کاربری</span><span className="font-mono text-slate-200">{currentUser.username}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">نوع ورود</span><span className="text-slate-200">{currentUser.isLocalAdmin ? 'ادمین محلی' : 'Active Directory (LDAP)'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">پایان نشست</span><span className="text-slate-200">{expires}</span></div>
          </div>

          <div className="p-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => { setIsLdapModalOpen(false); logout(); }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج از حساب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
