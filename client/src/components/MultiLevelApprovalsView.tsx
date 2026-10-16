import React, { useState, useEffect } from 'react';
import { DbRow, ApprovalRecord } from '../types';
import { useExactDb } from '../context/ExactDatabaseContext';
import { formatToman } from '../utils/workflowEngine';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileKey, 
  UserCheck, 
  AlertTriangle, 
  MessageSquare, 
  KeyRound, 
  PenTool,
  Lock,
  ChevronDown,
  X
} from 'lucide-react';

interface MultiLevelApprovalsViewProps {
  row: DbRow;
}

export const MultiLevelApprovalsView: React.FC<MultiLevelApprovalsViewProps> = ({ row }) => {
  const { 
    getRowApprovals, 
    ensureApprovals,
    approveStep, 
    rejectStep, 
    canUserApprove, 
    currentUser,
    isAdmin 
  } = useExactDb();

  const [activeModalId, setActiveModalId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'approve' | 'reject'>('approve');
  const [modalComment, setModalComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const rowApprovals = getRowApprovals(row.id);

  // ردیف‌های ثبت‌شده پیش از این ماژول رکورد تأیید ندارند؛ یک‌بار از سرور ساخته می‌شود
  useEffect(() => {
    if (row.published_at && rowApprovals.length === 0) ensureApprovals(row.id);
  }, [row.id, row.published_at, rowApprovals.length]);
  const approvedCount = rowApprovals.filter((a) => a.status === 'approved').length;
  const hasRejected = rowApprovals.some((a) => a.status === 'rejected');

  const handleOpenAction = (approvalId: string, mode: 'approve' | 'reject') => {
    setActiveModalId(approvalId);
    setModalMode(mode);
    setModalComment('');
    setActionError(null);
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalId) return;

    if (modalMode === 'approve') {
      const res = await approveStep(activeModalId, modalComment);
      if (!res.success) {
        setActionError(res.message || 'خطا در ثبت تایید');
        return;
      }
    } else {
      if (!modalComment.trim()) {
        setActionError('لطفاً دلیل رد درخواست را وارد نمایید.');
        return;
      }
      if (!(await rejectStep(activeModalId, modalComment))) return;
    }

    setActiveModalId(null);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              ویژگی ۴: فرآیند تأییدات پویا و امضای دیجیتال (مهر HMAC سمت سرور)
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono border ${
              approvedCount === rowApprovals.length
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : hasRejected
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
            }`}>
              {approvedCount} از {rowApprovals.length} مرحله تأیید شده
            </span>
          </div>

          <h3 className="text-sm font-bold text-white mt-1">
            سلسله‌مراتب تأیید و مجوزهای پرداخت برای ردیف {row.request_no}
          </h3>

          <p className="text-xs text-slate-400 mt-0.5">
            اولویت: <strong className="text-blue-300">{row.priority}</strong>
            {row.total_estimated_amount ? (
              <> | برآورد مالی: <strong className="text-emerald-400 font-mono">{formatToman(row.total_estimated_amount)}</strong></>
            ) : null}
            {row.selected_vendor_name ? (
              <> | تأمین‌کننده: <strong className="text-slate-200">{row.selected_vendor_name}</strong></>
            ) : null}
          </p>
        </div>

        {/* Status Chip */}
        <div className="self-start sm:self-auto">
          {approvedCount === rowApprovals.length ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>کلیه تأییدات نهایی صادر شد</span>
            </span>
          ) : hasRejected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span>فرآیند تأیید رد گردید</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>در انتظار تکمیل زنجیره امضا</span>
            </span>
          )}
        </div>
      </div>

      {/* Approval Levels List */}
      <div className="space-y-3.5">
        {rowApprovals.map((approval, idx) => {
          const isApproved = approval.status === 'approved';
          const isRejected = approval.status === 'rejected';
          const isPending = approval.status === 'pending';
          const canSign = canUserApprove(approval) && isPending;

          return (
            <div
              key={approval.id}
              className={`rounded-xl border p-4 transition-all ${
                isApproved
                  ? 'bg-slate-950/60 border-emerald-500/30 ring-1 ring-emerald-500/10'
                  : isRejected
                  ? 'bg-rose-950/20 border-rose-500/30'
                  : 'bg-slate-950/40 border-slate-800'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                
                {/* Level Title & Step indicator */}
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border ${
                    isApproved
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : isRejected
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {isApproved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isRejected ? (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <span className="font-mono">{idx + 1}</span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-white">
                        {approval.title}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        مرجع تصویب: {approval.requiredRoleName}
                      </span>
                    </div>

                    {/* Signer Details or Status */}
                    {isApproved && (
                      <div className="mt-2 text-xs text-slate-300 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap text-emerald-300">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>امضاشده توسط: <strong>{approval.approvedByDisplay}</strong> ({approval.approvedByUsername})</span>
                          <span className="text-slate-400 font-mono text-[11px]">در تاریخ {approval.approvedAt}</span>
                        </div>

                        {approval.comment && (
                          <p className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                            پیام تایید: {approval.comment}
                          </p>
                        )}

                        {/* Digital Certificate Hash Stamp */}
                        {approval.digitalSignatureHash && (
                          <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400">
                            <KeyRound className="w-3 h-3 text-purple-400" />
                            <span>شناسه گواهی دیجیتال:</span>
                            <span className="text-purple-300 font-bold">{approval.digitalSignatureHash}</span>
                            {approval.signatureValid === false && <span className="text-rose-400 font-bold">(مهر با داده‌ی ثبت‌شده نمی‌خواند!)</span>}
                            {approval.signatureValid === true && <span className="text-emerald-400">(مهر سرور معتبر)</span>}
                          </div>
                        )}
                      </div>
                    )}

                    {isRejected && (
                      <div className="mt-2 text-xs text-rose-300 space-y-1">
                        <p className="font-semibold">رد شده توسط {approval.approvedByDisplay} در تاریخ {approval.approvedAt}</p>
                        <p className="text-[11px] bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 text-rose-200">
                          علت رد: {approval.rejectionReason}
                        </p>
                      </div>
                    )}

                    {isPending && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        در انتظار بررسی و امضا توسط کاربر با نقش <strong className="text-slate-300">{approval.requiredRoleName}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {isApproved && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>تأیید رسمی</span>
                    </span>
                  )}

                  {isRejected && (
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رد شده</span>
                    </span>
                  )}

                  {canSign && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenAction(approval.id, 'reject')}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>رد</span>
                      </button>

                      <button
                        onClick={() => handleOpenAction(approval.id, 'approve')}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-purple-500/20 transition-all cursor-pointer"
                      >
                        <PenTool className="w-3.5 h-3.5 text-purple-200" />
                        <span>امضا و تأیید دیجیتال</span>
                      </button>
                    </div>
                  )}

                  {!canSign && isPending && (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                      <Lock className="w-3 h-3 text-slate-600" />
                      <span>نیازمند دسترسی سازمانی</span>
                    </span>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Action Confirmation Modal */}
      {activeModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {modalMode === 'approve' ? (
                  <>
                    <PenTool className="w-4 h-4 text-purple-400" />
                    <span>صدور تأییدیه و ثبت امضای الکترونیکی</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>رد درخواست تأیید</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveModalId(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAction} className="p-5 space-y-4 text-xs">
              {actionError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div>
                <p className="text-slate-300 font-medium">
                  کاربر امضاکننده: <strong className="text-white">{currentUser?.displayName}</strong> ({currentUser?.username})
                </p>
                {modalMode === 'approve' && (
                  <p className="text-slate-400 text-[11px] mt-1">
                    با تأیید این مرحله، یک کلید هش رمزنگاری‌شده سازمانی به عنوان سند رسمی امضا ثبت خواهد شد.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {modalMode === 'approve' ? 'یادداشت یا دستور تکمیلی (اختیاری):' : 'علت رد درخواست (الزامی):'}
                </label>
                <textarea
                  required={modalMode === 'reject'}
                  rows={3}
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder={
                    modalMode === 'approve'
                      ? 'مثلاً: مشخصات فنی و استعلام‌های بازرگانی بررسی و تایید گردید.'
                      : 'دلایل فنی، بودجه‌ای یا عدم انطباق را شرح دهید...'
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalId(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all ${
                    modalMode === 'approve'
                      ? 'bg-purple-600 hover:bg-purple-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {modalMode === 'approve' ? 'تأیید و امضا' : 'ثبت رد درخواست'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
