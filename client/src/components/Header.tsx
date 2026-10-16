import React from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { 
  Building2, 
  Plus, 
  Menu, 
  X, 
  ShieldCheck, 
  UserCheck, 
  ChevronDown,
  Layers,
  FileSpreadsheet,
  Clock,
  FileText,
  LogOut
} from 'lucide-react';

export const Header: React.FC<{ onToggleMobileMenu: () => void; isMobileMenuOpen: boolean }> = ({
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const { 
    currentUser, 
    activeTab, 
    setActiveTab, 
    setSelectedRowId, 
    setIsLdapModalOpen,
    canCreateRows,
    canViewAuditLogs,
    isAdmin,
    logout
  } = useExactDb();

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition-colors"
              aria-label="Toggle Navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault();
                setSelectedRowId(null);
                setActiveTab('dashboard');
              }}
              className="flex items-center gap-2.5 text-slate-100 group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                  <span>سامانه مدیریت بازرگانی و انبار</span>
                  
                </span>
                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                  گردش کار و پایش آنلاین درخواست‌های کالا
                </span>
              </div>
            </a>
          </div>

          {/* Zone 2: Navigation Links (Single-Line, Hover Underline) */}
          <nav className="hidden lg:flex items-center gap-6 text-xs sm:text-sm font-medium text-slate-400">
            <button
              onClick={() => {
                setSelectedRowId(null);
                setActiveTab('dashboard');
              }}
              className={`transition-colors py-1 relative ${
                activeTab === 'dashboard'
                  ? 'text-blue-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                  : 'hover:text-slate-200'
              }`}
            >
              فهرست درخواست‌ها
            </button>

            <button
              onClick={() => {
                setSelectedRowId(null);
                setActiveTab('drafts');
              }}
              className={`transition-colors py-1 relative ${
                activeTab === 'drafts'
                  ? 'text-blue-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                  : 'hover:text-slate-200'
              }`}
            >
              پیش‌نویس‌ها
            </button>

            <button
              onClick={() => {
                setSelectedRowId(null);
                setActiveTab('duration_report');
              }}
              className={`transition-colors py-1 relative ${
                activeTab === 'duration_report'
                  ? 'text-blue-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                  : 'hover:text-slate-200'
              }`}
            >
              گزارش زمان‌بندی
            </button>

            <button
              onClick={() => {
                setSelectedRowId(null);
                setActiveTab('management_report');
              }}
              className={`transition-colors py-1 relative ${
                activeTab === 'management_report'
                  ? 'text-blue-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                  : 'hover:text-slate-200'
              }`}
            >
              گزارش مدیریتی
            </button>

            {canViewAuditLogs && (
            <button
              onClick={() => {
                setSelectedRowId(null);
                setActiveTab('audit_logs');
              }}
              className={`transition-colors py-1 relative ${
                activeTab === 'audit_logs'
                  ? 'text-blue-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                  : 'hover:text-slate-200'
              }`}
            >
              تاریخچه سیستم
            </button>
            )}
          </nav>

          {/* Zone 3: User Switcher, Logout & Create CTA */}
          <div className="flex items-center gap-2">
            {/* LDAP / Local User Badge */}
            {currentUser && (
              <button
                onClick={() => setIsLdapModalOpen(true)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/90 hover:bg-slate-800 transition-colors text-right"
                title="مشخصات نشست"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  currentUser.isLocalAdmin 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {currentUser.displayName.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                    {currentUser.displayName.split('(')[0]}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={() => {
                if (window.confirm('آیا قصد خروج از حساب کاربری را دارید؟')) {
                  logout();
                }
              }}
              className="p-2 sm:px-2.5 sm:py-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 text-xs"
              title="خروج از حساب کاربری (Log Out)"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">خروج</span>
            </button>

            {/* New Request Button */}
            {canCreateRows && (
              <button
                onClick={() => {
                  setSelectedRowId(null);
                  setActiveTab('new_request');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-600/20 transition-all whitespace-nowrap active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت درخواست کالا</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
