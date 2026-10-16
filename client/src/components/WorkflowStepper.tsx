import React, { useState } from 'react';
import { DbRow, WorkflowStageId } from '../types';
import { useExactDb } from '../context/ExactDatabaseContext';
import { 
  WORKFLOW_STAGES, 
  getStageInfo, 
  inferStageFromRow, 
  canAdvanceWorkflow,
  stageDisplayLabel,
} from '../utils/workflowEngine';
import { 
  CheckCircle2, 
  Clock, 
  ArrowLeft, 
  ChevronRight, 
  AlertTriangle, 
  ShieldAlert, 
  Sparkles,
  Info
} from 'lucide-react';

interface WorkflowStepperProps {
  row: DbRow;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ row }) => {
  const { 
    currentUser, 
    advanceWorkflow, 
    setWorkflowStage, 
    approvals, 
    isAdmin 
  } = useExactDb();

  const [advancing, setAdvancing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentStageId = inferStageFromRow(row);
  const currentStageDef = getStageInfo(currentStageId);
  const currentStageIndex = WORKFLOW_STAGES.findIndex((s) => s.id === currentStageId);

  const rowApprovals = approvals.filter((a) => a.rowId === row.id);
  const advanceCheck = currentUser ? canAdvanceWorkflow(row, currentUser, rowApprovals) : { allowed: false };

  const handleAdvance = async () => {
    if (!currentUser) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setAdvancing(true);

    const res = await advanceWorkflow(row.id);
    if (!res.success) {
      setErrorMsg(res.message || 'خطا در ارتقای مرحله گردش‌کار');
    } else {
      setSuccessMsg('گردش‌کار با موفقیت به مرحله بعد ارتقا یافت.');
      setTimeout(() => setSuccessMsg(null), 3500);
    }
    setAdvancing(false);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              خط لوله گردش کار (Multi-Stage Workflow)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-300 border border-blue-500/30">
              گام {currentStageIndex + 1} از {WORKFLOW_STAGES.length}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mt-1 flex items-center gap-2">
            <span>مرحله جاری:</span>
            <span className="text-blue-400">{currentStageDef.label}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {currentStageDef.description} (مسئول: {currentStageDef.ownerDepartment})
          </p>
        </div>

        {/* Advance Action Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {currentStageIndex < WORKFLOW_STAGES.length - 1 && (
            <button
              onClick={handleAdvance}
              disabled={!advanceCheck.allowed || advancing}
              title={!advanceCheck.allowed ? advanceCheck.reason : 'ارتقا به گام بعدی'}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
                advanceCheck.allowed
                  ? 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20 active:scale-95 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span>ارتقا به مرحله بعد</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}

          {/* Admin Override Stage Selector */}
          {isAdmin && (
            <select
              value={currentStageId}
              onChange={(e) => setWorkflowStage(row.id, e.target.value as WorkflowStageId)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              title="تغییر مستقیم گام توسط مدیر سیستم"
            >
              {WORKFLOW_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  انتقال به: {stageDisplayLabel(s, row.requester_dept)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Validation Message or Error Banner */}
      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {!advanceCheck.allowed && advanceCheck.reason && currentStageIndex < WORKFLOW_STAGES.length - 1 && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>پیش‌نیاز گام بعدی: {advanceCheck.reason}</span>
        </div>
      )}

      {/* Stepper Pipeline Visual */}
      <div className="relative pt-2 pb-1 overflow-x-auto">
        <div className="flex items-center min-w-[650px] justify-between relative">
          
          {/* Connector Line */}
          <div className="absolute top-1/2 -translate-y-1/2 left-8 right-8 h-1 bg-slate-800 -z-0">
            <div 
              className="h-full bg-gradient-to-l from-blue-500 to-emerald-500 transition-all duration-300"
              style={{
                width: `${(currentStageIndex / (WORKFLOW_STAGES.length - 1)) * 100}%`
              }}
            />
          </div>

          {WORKFLOW_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const isPending = idx > currentStageIndex;

            return (
              <div 
                key={stage.id} 
                className="flex flex-col items-center text-center relative z-10 group cursor-default"
                style={{ width: `${100 / WORKFLOW_STAGES.length}%` }}
              >
                {/* Node Circle */}
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-md ${
                    isCompleted 
                      ? 'bg-emerald-500 text-white shadow-emerald-500/20 ring-4 ring-emerald-500/20'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/30 scale-110 shadow-blue-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : isCurrent ? (
                    <span className="font-mono">{idx + 1}</span>
                  ) : (
                    <span className="font-mono">{idx + 1}</span>
                  )}
                </div>

                {/* Stage Titles */}
                <div className="mt-2.5">
                  <span className={`text-xs block font-bold transition-colors ${
                    isCurrent ? 'text-blue-400' : isCompleted ? 'text-emerald-300' : 'text-slate-500'
                  }`}>
                    {stageDisplayLabel(stage, row.requester_dept)}
                  </span>
                  <span className="text-[10px] text-slate-400 block max-w-[110px] truncate mx-auto">
                    {stage.id === 'tech_request' && row.requester_dept ? 'دپارتمان درخواست‌کننده' : stage.ownerDepartment}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
