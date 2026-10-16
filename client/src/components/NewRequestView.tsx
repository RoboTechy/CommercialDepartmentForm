import React, { useState } from 'react';
import { useExactDb } from '../context/ExactDatabaseContext';
import { PriorityLevel, ItemType, DbRow } from '../types';
import { JalaliDateInput } from './JalaliDateInput';
import { todayJalaliDate } from '../utils/exactJalaali';
import { resolveRequesterDept } from '../store/exactStore';
import { 
  FilePlus2, 
  ArrowRight, 
  AlertTriangle, 
  Save, 
  AlertCircle 
} from 'lucide-react';

export const NewRequestView: React.FC = () => {
  const { 
    createRow, 
    currentUser, 
    setSelectedRowId, 
    setActiveTab, 
    findDuplicateRequestNo 
  } = useExactDb();

  const userDept = resolveRequesterDept(currentUser) || '—';

  const [requestNo, setRequestNo] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('A');
  const [totalQty, setTotalQty] = useState('');
  const [unit, setUnit] = useState('');
  const [usageLocation, setUsageLocation] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(todayJalaliDate());
  const [itemType, setItemType] = useState<ItemType>('استاندارد');
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DbRow[]>([]);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  const handleCheckDuplicate = (no: string) => {
    setRequestNo(no);
    setConfirmedDuplicate(false);
    if (no.trim()) {
      const dupes = findDuplicateRequestNo(no);
      setDuplicateWarning(dupes);
    } else {
      setDuplicateWarning([]);
    }
  };

  // هر ردیف جدید ابتدا «پیش‌نویس» است؛ در صفحه‌ی جزئیات همان ردیف می‌توان ردیف بعدی را
  // اضافه کرد و همه‌ی (یا بعضی از) پیش‌نویس‌ها را با هم «ثبت نهایی» کرد.
  const handleSubmit = async () => {
    setErrorMessage(null);

    if (duplicateWarning.length > 0 && !confirmedDuplicate) {
      setErrorMessage('این شماره درخواست قبلاً ثبت شده است. اگر مطمئن هستید، گزینه تایید ردیف تکراری را بزنید.');
      return;
    }

    const { row, errors } = await createRow({
      request_no: requestNo,
      item_description: itemDescription,
      priority,
      total_qty: totalQty,
      unit,
      usage_location: usageLocation,
      delivery_to_warehouse_date: deliveryDate,
      item_type: itemType,
    });

    if (!row) {
      setErrorMessage(errors.join(' — '));
      return;
    }
    setSelectedRowId(row.id);
    setActiveTab('row_detail');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
            <FilePlus2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">
              ثبت درخواست کالای جدید (بخش درخواست‌کننده)
            </h1>
            <p className="text-xs text-slate-400">
              دپارتمان ثبت‌کننده خودکار: <b className="text-blue-400">{userDept}</b>
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('dashboard')}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Duplicate Alert */}
      {duplicateWarning.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>هشدار تکراری: {duplicateWarning.length} درخواست دیگر با همین شماره درخواست کالا در دیتابیس وجود دارد:</span>
          </div>
          <div className="text-xs space-y-1 pr-6 text-amber-300/80">
            {duplicateWarning.map(d => (
              <div key={d.id}>
                ردیف #{d.id} - {d.request_no} ({d.item_description.slice(0, 40)}...) - دپارتمان {d.requester_dept}
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 pt-2 text-xs font-semibold cursor-pointer text-amber-200">
            <input
              type="checkbox"
              checked={confirmedDuplicate}
              onChange={(e) => setConfirmedDuplicate(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
            />
            <span>آگاهی دارم و تایید می‌کنم که این یک ردیف جداگانه از همان شماره درخواست است</span>
          </label>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Request No */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              شماره درخواست کالا <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={requestNo}
              onChange={(e) => handleCheckDuplicate(e.target.value)}
              placeholder="مثال: REQ-1403-5120"
              className="w-full p-2.5 text-xs font-mono bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">شماره ارجاع رسمی اداری</span>
          </div>

          {/* Requester Department (Locked) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              دپارتمان درخواست‌کننده
            </label>
            <input
              type="text"
              disabled
              value={userDept}
              className="w-full p-2.5 text-xs bg-slate-950/40 text-slate-400 border border-slate-800 rounded-xl cursor-not-allowed"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">طبق نشست کاربر جاری تعیین می‌شود</span>
          </div>

        </div>

        {/* Item Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            شرح مشخصات کالا <span className="text-rose-400">*</span>
          </label>
          <textarea
            rows={3}
            required
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="مشخصات کامل فنی کالا، سایز، استاندارد و برند مورد نیاز..."
            className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Priority, Item Type, Delivery Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              اولویت تامین
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full p-2.5 text-xs font-mono bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
            >
              <option value="A++">A++ (بسیار فوری و اضطراری)</option>
              <option value="A+">A+ (فوری)</option>
              <option value="A">A (اولویت بالا)</option>
              <option value="B">B (متوسط)</option>
              <option value="C">C (عادی)</option>
              <option value="D">D (پروژه‌ای بلندمدت)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              نوع کالا
            </label>
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as ItemType)}
              className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
            >
              <option value="استاندارد">استاندارد (خرید آماده)</option>
              <option value="ساخت">ساخت (سفارشی / تولیدی)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              تاریخ تحویل درخواست به انبار <span className="text-rose-400">*</span>
            </label>
            <JalaliDateInput
              value={deliveryDate}
              onChange={setDeliveryDate}
              className="w-full p-2.5 text-xs font-mono bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        {/* Qty, Unit, Usage Location */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              تعداد کل <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={totalQty}
              onChange={(e) => setTotalQty(e.target.value)}
              placeholder="مثال: ۱۰"
              className="w-full p-2.5 text-xs font-mono bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              واحد <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              list="unit-suggestions"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="عدد، کیلوگرم، لیتر، متر، بسته"
              className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
            />
            <datalist id="unit-suggestions">
              {['عدد', 'دستگاه', 'متر', 'شاخه', 'کیلوگرم', 'تن', 'بسته', 'ست', 'لیتر'].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              محل مصرف <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={usageLocation}
              onChange={(e) => setUsageLocation(e.target.value)}
              placeholder="مثال: کارگاه مرکزی فاز ۲"
              className="w-full p-2.5 text-xs bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px] text-slate-500 max-w-md leading-relaxed">
            درخواست ابتدا به‌صورت پیش‌نویس ذخیره می‌شود و تا «ثبت نهایی» در فهرست مشترک (انبار و بازرگانی) دیده نمی‌شود.
            می‌توانید چند درخواست پشت‌سرهم بسازید و همه را با هم ثبت نهایی کنید.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-2 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره به‌عنوان پیش‌نویس</span>
          </button>
        </div>

      </div>
    </div>
  );
};
