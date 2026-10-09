import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { X, ShieldCheck, Check, KeyRound, Server, User, LogOut } from 'lucide-react';

export const LdapUserModal: React.FC = () => {
  const { isLdapModalOpen, setIsLdapModalOpen, allUsers, currentUser, switchUser, logout } = useExactDb();

  if (!isLdapModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      <div 
        onClick={() => setIsLdapModalOpen(false)}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden text-right">
          
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  مدیریت نشست کاربری و سوییچ نقش‌ها
                </h3>
                <p className="text-xs text-slate-400">
                  شبیه‌ساز احراز هویت دامین LDAP / Active Directory و ادمین محلی
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsLdapModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
              <span>انتخاب حساب کاربری سازمانی جهت تست رفتار دسترسی:</span>
              <span className="text-[10px] text-blue-400 font-mono">Real-Time Permission Switch</span>
            </div>

            {allUsers.map((user) => {
              const isSelected = currentUser?.username === user.username;

              return (
                <div
                  key={user.username}
                  onClick={() => {
                    switchUser(user.username);
                    setIsLdapModalOpen(false);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      user.isLocalAdmin
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : isSelected 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {user.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {user.displayName}
                        </span>
                        {user.isLocalAdmin ? (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-semibold font-mono">
                            Local Admin
                          </span>
                        ) : (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 font-semibold font-mono">
                            LDAP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Username: <span className="text-slate-300 font-semibold">{user.username}</span> | Group: {user.groups.join(', ')}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <button
              onClick={() => {
                logout();
                setIsLdapModalOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج کامل از حساب و بازگشت به لاگین</span>
            </button>

            <button
              onClick={() => setIsLdapModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
            >
              بستن پنجره
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
