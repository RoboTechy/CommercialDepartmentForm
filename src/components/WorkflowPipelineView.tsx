import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { 
  WORKFLOW_STAGES, 
  inferStageFromRow, 
  canAdvanceWorkflow, 
  formatToman 
} from '../utils/workflowEngine';
import { WorkflowStageId, DbRow } from '../types';
import { 
  Kanban, 
  ArrowLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Building2, 
  AlertTriangle, 
  Eye, 
  PenTool,
  ChevronLeft
} from 'lucide-react';

export const WorkflowPipelineView: React.FC = () => {
  const { 
    rows, 
    setSelectedRowId, 
    setActiveTab, 
    advanceWorkflow, 
    approvals, 
    currentUser, 
    isAdmin 
  } = useExactDb();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [advancingId, setAdvancingId] = useState<number | null>(null);

  const activeRows = rows.filter((r) => !r.deleted_at && r.published_at && !r.cancelled_at);

  const filteredRows = activeRows.filter((row) => {
    if (selectedDept !== 'all' && row.requester_dept !== selectedDept) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = row.request_no.toLowerCase().includes(q);
      const matchDesc = row.item_description.toLowerCase().includes(q);
      const matchVendor = (row.selected_vendor_name || '').toLowerCase().includes(q);
      if (!matchNo && !matchDesc && !matchVendor) return false;
    }
    return true;
  });

  const handleRowClick = (id: number) => {
    setSelectedRowId(id);
    setActiveTab('row_detail');
  };

  const handleQuickAdvance = (e: React.MouseEvent, row: DbRow) => {
    e.stopPropagation();
    if (!currentUser) return;
    setAdvancingId(row.id);
    advanceWorkflow(row.id);
    setTimeout(() => setAdvancingId(null), 400);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              گردش کار چند مرحله‌ای (Multi-Stage Workflow Pipeline)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-300 border border-blue-500/30">
              {filteredRows.length} پرونده فعال
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-blue-400" />
            <span>تابلوی خط لوله فرآیند درخواست‌های بازرگانی و تدارکات</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            پایش گام‌به‌گام موقعیت سفارشات از دفتر فنی تا استعلام قیمت، زنجیره تأیید و اعزام به سایت
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی شماره یا شرح کالا..."
              className="bg-slate-800 border border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 sm:w-56"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">همه دپارتمان‌ها</option>
            <option value="دفتر فنی">دفتر فنی</option>
            <option value="عمران">عمران</option>
            <option value="آی‌تی">آی‌تی</option>
          </select>
        </div>
      </div>

      {/* Horizontal Kanban Columns */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 min-w-[1280px] items-start">
          {WORKFLOW_STAGES.map((stage, colIdx) => {
            const stageRows = filteredRows.filter((r) => inferStageFromRow(r) === stage.id);

            return (
              <div
                key={stage.id}
                className="w-80 shrink-0 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col max-h-[calc(100vh-240px)] shadow-xs"
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-xs rounded-t-2xl z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[11px] font-mono border border-slate-700">
                      {colIdx + 1}
                    </span>
                    <h3 className="text-xs font-bold text-white truncate max-w-[170px]" title={stage.label}>
                      {stage.shortLabel}
                    </h3>
                  </div>

                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {stageRows.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-thin">
                  {stageRows.length === 0 ? (
                    <div className="py-8 text-center text-slate-600 text-xs border border-dashed border-slate-800/80 rounded-xl">
                      موردی در این مرحله نیست
                    </div>
                  ) : (
                    stageRows.map((row) => {
                      const rowApps = approvals.filter((a) => a.rowId === row.id);
                      const approvedCount = rowApps.filter((a) => a.status === 'approved').length;
                      const advanceCheck = currentUser ? canAdvanceWorkflow(row, currentUser, rowApps) : { allowed: false };

                      return (
                        <div
                          key={row.id}
                          onClick={() => handleRowClick(row.id)}
                          className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800/90 hover:border-slate-700 p-3.5 rounded-xl cursor-pointer transition-all shadow-xs group space-y-2.5 relative"
                        >
                          {/* Top Badges */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                              {row.request_no}
                            </span>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {row.priority}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                {row.requester_dept}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                            {row.item_description}
                          </p>

                          {/* Details & Amount */}
                          <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 font-mono">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-sans">تعداد:</span>
                              <span className="text-slate-200">{row.total_qty} {row.unit}</span>
                            </div>

                            {row.total_estimated_amount ? (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                                <span className="text-slate-400 font-sans">برآورد مالی:</span>
                                <span className="text-emerald-400 font-bold">{formatToman(row.total_estimated_amount)}</span>
                              </div>
                            ) : null}

                            {row.selected_vendor_name ? (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
                                <span className="text-slate-400 font-sans">تأمین‌کننده:</span>
                                <span className="text-slate-300 font-sans truncate max-w-[130px]">{row.selected_vendor_name}</span>
                              </div>
                            ) : null}
                          </div>

                          {/* Approvals Progress Badge */}
                          {rowApps.length > 0 && (
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                              <span className="flex items-center gap-1">
                                <PenTool className="w-3 h-3 text-purple-400" />
                                <span>تأییدات:</span>
                              </span>
                              <span className={`font-mono font-bold ${
                                approvedCount === rowApps.length ? 'text-emerald-400' : 'text-purple-300'
                              }`}>
                                {approvedCount} از {rowApps.length} مرحله
                              </span>
                            </div>
                          )}

                          {/* Card Action footer */}
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 group-hover:text-blue-400 flex items-center gap-1 transition-colors">
                              <Eye className="w-3 h-3" />
                              <span>جزئیات پرونده</span>
                            </span>

                            {colIdx < WORKFLOW_STAGES.length - 1 && (
                              <button
                                onClick={(e) => handleQuickAdvance(e, row)}
                                disabled={!advanceCheck.allowed || advancingId === row.id}
                                title={!advanceCheck.allowed ? advanceCheck.reason : 'انتقال سریع به مرحله بعد'}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                                  advanceCheck.allowed
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                                }`}
                              >
                                <span>ارتقا</span>
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
