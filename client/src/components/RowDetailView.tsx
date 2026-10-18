import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { sections, isPaymentAuthWaived, FieldDef } from '../data/exactSections';
import { WorkflowStepper } from './WorkflowStepper';
import { RfqQuotationsView } from './RfqQuotationsView';
import { MultiLevelApprovalsView } from './MultiLevelApprovalsView';
import { 
  ArrowRight, 
  Save, 
  History, 
  Printer, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  RotateCcw, 
  AlertCircle, 
  Clock, 
  Check, 
  Building2, 
  PenTool, 
  FileSpreadsheet, 
  Layers 
} from 'lucide-react';
import { todayJalaliDate } from '../utils/exactJalaali';
import { ENABLE_EXTENDED_WORKFLOW } from '../config';
import { JalaliDateInput } from './JalaliDateInput';

export const RowDetailView: React.FC = () => {
  const { 
    getRow, 
    selectedRowId, 
    setSelectedRowId, 
    setActiveTab, 
    canEditSectionForRow, 
    sectionLockReason,
    updateSection,
    setHistoryDrawerRowId,
    setCancelModalRowId,
    setReturnModalRowId,
    uncancelRow,
    unreturnFromTechOffice,
    canCancelRow,
    canReturnToTechOffice,
    quotationCount,
    approvals,
    findDuplicatePurchaseRequestNo,
    getDraftRows,
    finalizeDrafts,
    discardDraft
  } = useExactDb();

  const row = selectedRowId ? getRow(selectedRowId) : undefined;
  const [activeSubTab, setActiveSubTab] = useState<'sections' | 'rfq' | 'approvals'>('sections');

  // Local state for field values to allow smooth typing and save per section
  const [formState, setFormState] = useState<Record<string, string>>(() => {
    if (!row) return {};
    const initial: Record<string, string> = {};
    for (const sec of sections) {
      for (const f of sec.fields) {
        initial[f.name] = (row[f.name] || '').toString();
      }
    }
    return initial;
  });

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [draftSelection, setDraftSelection] = useState<number[] | null>(null);

  if (!row) {
    return (
      <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800">
        <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-2" />
        <h2 className="text-sm font-bold text-slate-300">ردیف مورد نظر یافت نشد</h2>
        <button
          onClick={() => {
            setSelectedRowId(null);
            setActiveTab('dashboard');
          }}
          className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
        >
          بازگشت به فهرست
        </button>
      </div>
    );
  }

  const isCancelled = Boolean(row.cancelled_at);
  const isReturned = Boolean(row.returned_at);
  // با عوض شدن «مجری خرید» در همین فرم، بلافاصله (بدون ذخیره) فیلد مجوز پرداخت معاف می‌شود
  const waived = isPaymentAuthWaived({ ...row, purchase_executor: (formState.purchase_executor ?? row.purchase_executor) as typeof row.purchase_executor });
  const isDraft = !row.published_at;
  const myDrafts = isDraft ? getDraftRows() : [];
  const checkedDrafts = draftSelection ?? myDrafts.map((d) => d.id);

  const handleFieldChange = (fieldName: string, val: string) => {
    setFormState(prev => ({ ...prev, [fieldName]: val }));
  };

  const handleSaveSection = async (sectionKey: string) => {
    const sec = sections.find(s => s.key === sectionKey);
    if (!sec) return;
    setSaveErrors([]);
    const sectionValues: Record<string, string> = {};
    for (const f of sec.fields) {
      sectionValues[f.name] = formState[f.name] ?? '';
    }

    // هشدار (نه جلوگیری) برای شماره درخواست خرید تکراری
    const newPurchaseNo = (sectionValues.purchase_request_no ?? '').trim();
    if (sec.fields.some(f => f.name === 'purchase_request_no') && newPurchaseNo && newPurchaseNo !== (row.purchase_request_no || '')) {
      const dupes = findDuplicatePurchaseRequestNo(newPurchaseNo, row.id);
      if (dupes.length > 0) {
        const list = dupes.map(d => `ردیف #${d.id} (درخواست کالا ${d.request_no})`).join('\n');
        if (!window.confirm(`شماره درخواست خرید «${newPurchaseNo}» قبلاً در این ردیف‌ها ثبت شده است:\n${list}\n\nبا وجود تکرار، ثبت ادامه پیدا کند؟`)) {
          return;
        }
      }
    }

    const result = await updateSection(row.id, sectionKey, sectionValues);
    if (!result.ok) {
      setSaveErrors(result.errors);
      return;
    }
    // مقدارهای یکنواخت‌شده (مثلاً تاریخ با ارقام فارسی) را در فرم نشان بده
    if (result.values) {
      setFormState(prev => ({ ...prev, ...result.values }));
    }
    setSavingSection(sectionKey);
    setTimeout(() => {
      setSavingSection(null);
    }, 600);
  };

  const handleFinalizeChecked = async () => {
    if (checkedDrafts.length === 0) return;
    if (!(await finalizeDrafts(checkedDrafts))) return;
    setSelectedRowId(null);
    setActiveTab('dashboard');
  };

  const handleDiscard = async (draftId: number, requestNo: string) => {
    if (!window.confirm(`پیش‌نویس «${requestNo}» برای همیشه حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    if (!(await discardDraft(draftId))) return;
    const remaining = myDrafts.filter(d => d.id !== draftId);
    if (draftId === row.id) {
      if (remaining.length > 0) {
        setSelectedRowId(remaining[0].id);
      } else {
        setSelectedRowId(null);
        setActiveTab('dashboard');
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Breadcrumb & Status Header */}
      <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedRowId(null);
              setActiveTab('dashboard');
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 flex items-center gap-1 text-xs transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold font-mono text-blue-400">
                {row.request_no}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {row.requester_dept}
              </span>
              {isCancelled && (
                <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  لغو شده
                </span>
              )}
              {isReturned && (
                <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  عودت به درخواست‌کننده
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ثبت‌شده توسط {row.created_by_display} در تاریخ {row.created_at}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={() => setHistoryDrawerRowId(row.id)}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>تاریخچه تغییرات</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>چاپ</span>
          </button>

          {canCancelRow(row) && !isReturned && !isDraft && (
            isCancelled ? (
              <button
                onClick={() => uncancelRow(row.id)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازگردانی از لغو</span>
              </button>
            ) : (
              <button
                onClick={() => setCancelModalRowId(row.id)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl flex items-center gap-1 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>لغو درخواست</span>
              </button>
            )
          )}

          {canReturnToTechOffice && !isCancelled && !isDraft && (
            isReturned ? (
              <button
                onClick={() => unreturnFromTechOffice(row.id)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl flex items-center gap-1 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>لغو عودت (فعال‌سازی)</span>
              </button>
            ) : (
              <button
                onClick={() => setReturnModalRowId(row.id)}
                className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl flex items-center gap-1 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>عودت به درخواست‌کننده</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* پیش‌نویس: ثبت نهایی گروهی */}
      {isDraft && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-100 space-y-3">
          <div className="text-xs leading-relaxed">
            <b className="text-amber-300">این ردیف پیش‌نویس است</b> و فقط شما (و ادمین) آن را می‌بینید؛ تا «ثبت نهایی» در فهرست
            مشترک، آمار و گزارش‌ها دیده نمی‌شود. می‌توانید ردیف دیگری هم اضافه کنید و بعد موارد دلخواه را با هم ثبت نهایی کنید.
          </div>

          <ul className="divide-y divide-amber-500/10 text-xs">
            {myDrafts.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={checkedDrafts.includes(d.id)}
                    onChange={(e) =>
                      setDraftSelection(
                        e.target.checked ? [...checkedDrafts, d.id] : checkedDrafts.filter((x) => x !== d.id)
                      )
                    }
                    className="rounded border-slate-700 bg-slate-900 text-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedRowId(d.id)}
                    className={`font-mono truncate hover:underline ${d.id === row.id ? 'text-white font-bold' : 'text-amber-200'}`}
                  >
                    {d.request_no}
                  </button>
                  <span className="text-amber-300/70 truncate">— {d.item_description}</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleDiscard(d.id, d.request_no)}
                  className="shrink-0 text-rose-300 hover:text-rose-200 text-[11px] font-semibold"
                >
                  حذف این پیش‌نویس
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('new_request')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100"
            >
              افزودن ردیف جدید
            </button>
            <button
              type="button"
              disabled={checkedDrafts.length === 0}
              onClick={handleFinalizeChecked}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
            >
              ثبت نهایی موارد تیک‌خورده ({checkedDrafts.length})
            </button>
          </div>
        </div>
      )}

      {/* Multi-Stage Workflow Stepper (ماژول آزمایشی) */}
      {ENABLE_EXTENDED_WORKFLOW && <WorkflowStepper row={row} />}

      {/* Sub-Navigation Tabs (RFQ و تأییدات: ماژول آزمایشی) */}
      {ENABLE_EXTENDED_WORKFLOW && (
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('sections')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'sections'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>فرم‌ها و بخش‌ها</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rfq')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all relative cursor-pointer ${
            activeSubTab === 'rfq'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span>استعلام قیمت و پیش‌فاکتورها (RFQ)</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {quotationCount(row.id)}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('approvals')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all relative cursor-pointer ${
            activeSubTab === 'approvals'
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <PenTool className="w-4 h-4 text-purple-400" />
          <span>تأییدات مالی و مدیریتی (امضای دیجیتال)</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {approvals.filter((a) => a.rowId === row.id && a.status === 'approved').length} از {approvals.filter((a) => a.rowId === row.id).length || 3}
          </span>
        </button>
      </div>
      )}

      {/* Tab: RFQ Quotations */}
      {ENABLE_EXTENDED_WORKFLOW && activeSubTab === 'rfq' && (
        <RfqQuotationsView row={row} />
      )}

      {/* Tab: Multi-level Approvals */}
      {ENABLE_EXTENDED_WORKFLOW && activeSubTab === 'approvals' && (
        <MultiLevelApprovalsView row={row} />
      )}

      {/* Tab: 4 Commercial Sections */}
      {activeSubTab === 'sections' && (
        <>
          {saveErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1" role="alert">
              {saveErrors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}

          {/* Cancellation / Return Banner */}
          {isCancelled && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>این درخواست لغو شده است و فیلدهای آن قفل هستند:</span>
              </div>
              <p className="pr-5 text-rose-300">دلیل لغو: {row.cancel_reason}</p>
              <p className="pr-5 text-[11px] text-rose-400/80">توسط {row.cancelled_by_display} در {row.cancelled_at}</p>
            </div>
          )}

          {isReturned && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>این درخواست توسط انبار کارفرما عودت داده شده است:</span>
              </div>
              <p className="pr-5 text-amber-300">دلیل عودت: {row.return_reason || 'نقص در اطلاعات'}</p>
              <p className="pr-5 text-[11px] text-amber-400/80">
                فقط بخش درخواست‌کننده ({row.requester_dept}) جهت رفع نقص قابل ویرایش است. سایر بخش‌ها قفل هستند.
              </p>
            </div>
          )}

          {/* 4 Commercial Sections */}
          <div className="space-y-5">
            {sections.map((section, sIdx) => {
              const canEdit = canEditSectionForRow(row, section.key);
              const lockReason = sectionLockReason(row, section.key);
              const isSaving = savingSection === section.key;

              const getSectionHeaderColor = () => {
                if (section.key === 'tech_operator') return 'bg-blue-500/10 border-blue-500/20 text-blue-300';
                if (section.key === 'commercial') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
                return 'bg-amber-500/10 border-amber-500/20 text-amber-300';
              };

              return (
                <div key={section.key} className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
                  
                  {/* Section Header */}
                  <div className={`p-4 border-b flex items-center justify-between ${getSectionHeaderColor()}`}>
                    <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-xs shadow-xs font-mono border border-slate-700">
                    {sIdx + 1}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-white">{section.title}</h2>
                    <span className="text-[11px] opacity-75 text-slate-300">
                      {section.key === 'tech_operator' && 'مشخصات اولیه کالا، تعداد، محل مصرف و تاریخ تحویل'}
                      {section.key === 'warehouse_1' && 'شماره خرید و تاریخ‌های تحویل به کارشناس، کارفرما و کارخانه'}
                      {section.key === 'commercial' && 'ارجاع، انتخاب مجری خرید (سایت/تهران/برنا) و مجوز پرداخت'}
                      {section.key === 'warehouse_2' && 'شماره نامه رسمی و تاریخ ارسال نهایی'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px]">
                    {canEdit ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <Unlock className="w-3.5 h-3.5" />
                        <span>مجاز به ویرایش</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400 font-medium">
                        <Lock className="w-3.5 h-3.5" />
                        <span>فقط خواندنی</span>
                      </span>
                    )}
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => handleSaveSection(section.key)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>ذخیره شد</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>ذخیره این بخش</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {lockReason && (
                <div className="mx-4 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                  {lockReason}
                </div>
              )}

              {/* Fields Grid */}
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.fields.map(field => {
                  const val = formState[field.name] ?? '';
                  const isPaymentWaived = field.name === 'payment_auth_issued_date' && waived;

                  return (
                    <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2 lg:col-span-3' : ''}>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        {field.label}
                        {field.required && <span className="text-rose-400 mr-1">*</span>}
                        {isPaymentWaived && (
                          <span className="text-[10px] text-amber-400 font-normal mr-2">
                            (معاف از مجوز پرداخت - مجری {row.purchase_executor})
                          </span>
                        )}
                      </label>

                      {field.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          disabled={!canEdit || field.readOnly}
                          value={val}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          className={`w-full p-2.5 text-xs rounded-xl border transition-all ${
                            !canEdit || field.readOnly
                              ? 'bg-slate-950/40 text-slate-500 cursor-not-allowed border-slate-800'
                              : 'bg-slate-950/80 text-slate-200 border-slate-700 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          disabled={!canEdit || field.readOnly}
                          value={val}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          className={`w-full p-2.5 text-xs rounded-xl border transition-all ${
                            !canEdit || field.readOnly
                              ? 'bg-slate-950/40 text-slate-500 cursor-not-allowed border-slate-800'
                              : 'bg-slate-950/80 text-slate-200 border-slate-700 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        >
                          <option value="">--- انتخاب کنید ---</option>
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'jalali-date' ? (
                        <JalaliDateInput
                          disabled={!canEdit || field.readOnly || isPaymentWaived}
                          value={isPaymentWaived ? '' : val}
                          onChange={(v) => handleFieldChange(field.name, v)}
                          placeholder={isPaymentWaived ? 'معاف از صدور مجوز' : '1403/00/00'}
                          className={`w-full p-2.5 text-xs font-mono rounded-xl border transition-all ${
                            !canEdit || field.readOnly || isPaymentWaived
                              ? 'bg-slate-950/40 text-slate-500 cursor-not-allowed border-slate-800'
                              : 'bg-slate-950/80 text-slate-200 border-slate-700 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          disabled={!canEdit || field.readOnly}
                          value={val}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          className={`w-full p-2.5 text-xs rounded-xl border transition-all ${
                            !canEdit || field.readOnly
                              ? 'bg-slate-950/40 text-slate-500 cursor-not-allowed border-slate-800'
                              : 'bg-slate-950/80 text-slate-200 border-slate-700 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        />
                      )}
                      
                      {field.hint && (
                        <span className="text-[10px] text-slate-500 mt-1 block">{field.hint}</span>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>
      </>
      )}

    </div>
  );
};
