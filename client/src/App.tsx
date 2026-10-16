import { ENABLE_EXTENDED_WORKFLOW } from './config';
import React, { useState } from 'react';
import { ExactDatabaseProvider, useExactDb } from './context/ExactDatabaseContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { RowDetailView } from './components/RowDetailView';
import { NewRequestView } from './components/NewRequestView';
import { DraftsView } from './components/DraftsView';
import { DurationReportView } from './components/DurationReportView';
import { ManagementReportView } from './components/ManagementReportView';
import { DeletedRowsView } from './components/DeletedRowsView';
import { AuditLogsView } from './components/AuditLogsView';
import { WorkflowPipelineView } from './components/WorkflowPipelineView';
import { VendorsDirectoryView } from './components/VendorsDirectoryView';
import { HistoryDrawer } from './components/HistoryDrawer';
import { CancelReasonModal } from './components/CancelReasonModal';
import { ReturnReasonModal } from './components/ReturnReasonModal';
import { LdapUserModal } from './components/LdapUserModal';
import { LoginPage } from './components/LoginPage';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileEdit, 
  Clock, 
  User 
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const { 
    currentUser,
    activeTab, 
    setActiveTab, 
    selectedRowId,
    setSelectedRowId, 
    setIsLdapModalOpen,
    canCreateRows,
    isLocalAdmin,
    isManagement,
    getDraftRows,
    booting,
    toast,
    dismissToast
  } = useExactDb();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm font-sans">
        در حال بارگذاری...
      </div>
    );
  }

  // If no user is logged in, show the login screen
  if (!currentUser) {
    return <LoginPage />;
  }

  const draftCount = getDraftRows().length;

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'workflow_pipeline':
        return ENABLE_EXTENDED_WORKFLOW ? <WorkflowPipelineView /> : <DashboardView />;
      case 'vendors':
        return ENABLE_EXTENDED_WORKFLOW ? <VendorsDirectoryView /> : <DashboardView />;
      case 'new_request':
        return <NewRequestView />;
      case 'drafts':
        return <DraftsView />;
      case 'row_detail':
        return <RowDetailView key={selectedRowId ?? 'none'} />;
      case 'duration_report':
        return <DurationReportView />;
      case 'management_report':
        return isManagement ? <ManagementReportView /> : <DashboardView />;
      case 'deleted_rows':
        return isLocalAdmin ? <DeletedRowsView /> : <DashboardView />;
      case 'audit_logs':
        return <AuditLogsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header 
        isMobileMenuOpen={isMobileMenuOpen} 
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />

        <main className="flex-1 transition-all duration-200 px-4 sm:px-6 lg:px-8 py-6 w-full max-w-full overflow-hidden lg:mr-72 pb-20 lg:pb-8">
          {renderActiveView()}
        </main>
      </div>

      {/* Mobile Bottom Thumb Navigation (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => {
            setSelectedRowId(null);
            setActiveTab('dashboard');
          }}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>درخواست‌ها</span>
        </button>

        {canCreateRows && (
          <button
            onClick={() => {
              setSelectedRowId(null);
              setActiveTab('new_request');
            }}
            className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
              activeTab === 'new_request' ? 'text-blue-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <PlusCircle className="w-5 h-5 text-blue-500" />
            <span className="text-blue-400 font-semibold">ثبت جدید</span>
          </button>
        )}

        <button
          onClick={() => {
            setSelectedRowId(null);
            setActiveTab('drafts');
          }}
          className={`relative flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
            activeTab === 'drafts' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <FileEdit className="w-5 h-5" />
          <span>پیش‌نویس</span>
          {draftCount > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          onClick={() => {
            setSelectedRowId(null);
            setActiveTab('duration_report');
          }}
          className={`flex flex-col items-center gap-1 p-1 text-[11px] font-medium transition-colors ${
            activeTab === 'duration_report' ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span>زمان‌بندی</span>
        </button>

        {true && (
        <button
          onClick={() => setIsLdapModalOpen(true)}
          className="flex flex-col items-center gap-1 p-1 text-[11px] font-medium text-slate-400"
        >
          <User className="w-5 h-5" />
          <span>کاربر</span>
        </button>
        )}
      </nav>

      {toast && (
        <div
          role="status"
          onClick={dismissToast}
          className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-md px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl cursor-pointer border ${
            toast.type === 'error'
              ? 'bg-rose-950/95 text-rose-200 border-rose-500/40'
              : 'bg-emerald-950/95 text-emerald-200 border-emerald-500/40'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Modals & Drawers */}
      <HistoryDrawer />
      <CancelReasonModal />
      <ReturnReasonModal />
      <LdapUserModal />
    </div>
  );
};

export default function App() {
  return (
    <ExactDatabaseProvider>
      <MainLayout />
    </ExactDatabaseProvider>
  );
}
