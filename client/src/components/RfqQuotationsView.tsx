import React, { useState } from 'react';
import { DbRow, Quotation } from '../types';
import { useExactDb } from '../context/ExactDatabaseContext';
import { formatToman } from '../utils/workflowEngine';
import { todayJalaliDate } from '../utils/exactJalaali';
import { 
  PlusCircle, 
  CheckCircle2, 
  Trash2, 
  Building2, 
  Calendar, 
  Clock, 
  CreditCard, 
  ShieldCheck, 
  Sparkles, 
  FileText, 
  TrendingDown,
  X,
  Award
} from 'lucide-react';

interface RfqQuotationsViewProps {
  row: DbRow;
}

export const RfqQuotationsView: React.FC<RfqQuotationsViewProps> = ({ row }) => {
  const { 
    vendors, 
    quotations, 
    addQuotation, 
    selectWinningQuotation, 
    deleteQuotation, 
    currentUser,
    isAdmin,
    canEditSectionForRow,
    quotationCount
  } = useExactDb();

  // ثبت پیش‌فاکتور: فقط بازرگانی و ادمین؛ دیدن جزئیات پیش‌فاکتورها: فقط ادمین
  const canAddQuote = canEditSectionForRow(row, 'commercial');
  const quoteCount = quotationCount(row.id);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');
  const [customVendorName, setCustomVendorName] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState(todayJalaliDate());
  const [validUntil, setValidUntil] = useState('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [deliveryDays, setDeliveryDays] = useState<number>(7);
  const [paymentTerms, setPaymentTerms] = useState<string>('چک ۳۰ روزه صیادی');
  const [warranty, setWarranty] = useState<string>('۱۲ ماه گارانتی معتبر شرکتی');
  const [notes, setNotes] = useState('');

  const rowQuotes = quotations.filter((q) => q.rowId === row.id);
  const qtyNumber = parseInt(row.total_qty.replace(/[^\d]/g, ''), 10) || 1;

  // Analysis of quotes
  const lowestPriceQuote = rowQuotes.length > 0 
    ? [...rowQuotes].sort((a, b) => a.totalPrice - b.totalPrice)[0] 
    : null;

  const fastestDeliveryQuote = rowQuotes.length > 0 
    ? [...rowQuotes].sort((a, b) => a.deliveryDays - b.deliveryDays)[0] 
    : null;

  const winningQuote = rowQuotes.find((q) => q.status === 'selected');

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(unitPrice.replace(/[^\d]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) return;

    let vName = customVendorName.trim();
    if (!vName) {
      const foundV = vendors.find((v) => v.id === selectedVendorId);
      vName = foundV ? foundV.name : 'تأمین‌کننده بازار';
    }

    const created = await addQuotation({
      rowId: row.id,
      vendorId: selectedVendorId || 'VND-MANUAL',
      vendorName: vName,
      quoteNumber: quoteNumber || `QU-${Date.now().toString().slice(-4)}`,
      quoteDate: quoteDate || todayJalaliDate(),
      validUntil: validUntil || '۱ ماه پس از صدور',
      unitPrice: priceNum,
      quantity: qtyNumber,
      totalPrice: priceNum * qtyNumber,
      deliveryDays: Number(deliveryDays) || 7,
      paymentTerms,
      warranty,
      notes,
    });
    if (!created) return;

    setIsAddModalOpen(false);
    setUnitPrice('');
    setQuoteNumber('');
    setNotes('');
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-5">
      
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              ویژگی ۱: استعلام قیمت و مقایسه پیش‌فاکتورها (RFQ & Quotes)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              {isAdmin ? rowQuotes.length : quoteCount} استعلام ثبت‌شده
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mt-1">
            مقایسه و انتخاب تأمین‌کنندگان جهت خرید اقلام ردیف {row.request_no}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            تعداد مورد نیاز: <strong className="text-slate-200">{row.total_qty} {row.unit}</strong> | کالای {row.item_type}
          </p>
        </div>

        {canAddQuote && (
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>ثبت پیش‌فاکتور جدید</span>
        </button>
        )}
      </div>

      {!isAdmin && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${quoteCount > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-300'}`}>
          <Award className="w-5 h-5 shrink-0" />
          <div>
            {quoteCount > 0
              ? <>برای این درخواست <b>{quoteCount}</b> پیش‌فاکتور دریافت شده است.</>
              : <>هنوز پیش‌فاکتوری برای این درخواست ثبت نشده است.</>}
            <div className="text-[11px] text-slate-400 mt-0.5">جزئیات پیش‌فاکتورها (تأمین‌کننده و قیمت) فقط برای ادمین‌ها قابل مشاهده است.</div>
          </div>
        </div>
      )}

      {isAdmin && (
      <>
      {/* Selected Winner Banner */}
      {winningQuote && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  پیشنهاد منتخب و تأییدشده نهایی
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  برنده استعلام
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mt-0.5">
                {winningQuote.vendorName}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 font-mono">
                مبلغ کل: <strong className="text-emerald-400 text-sm">{formatToman(winningQuote.totalPrice)}</strong> (واحد: {formatToman(winningQuote.unitPrice)}) | تحویل: {winningQuote.deliveryDays} روز کاری
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 self-end sm:self-center text-left">
            <span>شماره پیش‌فاکتور: </span>
            <span className="font-mono text-slate-200">{winningQuote.quoteNumber}</span>
          </div>
        </div>
      )}

      {/* Quotation Comparison Cards */}
      {rowQuotes.length === 0 ? (
        <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 p-6">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400">هنوز هیچ استعلام قیمتی برای این کالا ثبت نشده است.</p>
          <p className="text-[11px] text-slate-400 mt-1">با کلیک بر روی دکمه «ثبت پیش‌فاکتور جدید»، مشخصات قیمت و شرایط تحویل تأمین‌کنندگان را وارد کنید.</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>افزودن اولین استعلام</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rowQuotes.map((quote) => {
            const isWinner = quote.status === 'selected';
            const isLowestPrice = lowestPriceQuote?.id === quote.id;
            const isFastest = fastestDeliveryQuote?.id === quote.id;

            return (
              <div
                key={quote.id}
                className={`relative rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
                  isWinner
                    ? 'bg-emerald-950/30 border-emerald-500/50 ring-2 ring-emerald-500/20'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                    {isWinner && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        برگزیده نهایی
                      </span>
                    )}
                    {isLowestPrice && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        کمترین قیمت
                      </span>
                    )}
                    {isFastest && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        سریع‌ترین تحویل
                      </span>
                    )}
                  </div>

                  {/* Vendor Name & Number */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span>{quote.vendorName}</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        پیش‌فاکتور: {quote.quoteNumber} | تاریخ: {quote.quoteDate}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteQuotation(quote.id)}
                      title="حذف پیش‌فاکتور"
                      className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Financial & Terms Summary */}
                  <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">قیمت واحد:</span>
                      <span className="font-mono text-slate-200">{formatToman(quote.unitPrice)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-300 font-semibold">مبلغ کل ({row.total_qty} {row.unit}):</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {formatToman(quote.totalPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        زمان تحویل:
                      </span>
                      <span className="text-slate-300 font-mono">{quote.deliveryDays} روز کاری</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        نحوه پرداخت:
                      </span>
                      <span className="text-slate-300 truncate max-w-[140px]">{quote.paymentTerms}</span>
                    </div>

                    {quote.warranty && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          گارانتی:
                        </span>
                        <span className="text-slate-300 truncate max-w-[140px]">{quote.warranty}</span>
                      </div>
                    )}
                  </div>

                  {quote.notes && (
                    <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                      یادداشت: {quote.notes}
                    </p>
                  )}
                </div>

                {/* Winner selection button */}
                <div className="mt-4 pt-3 border-t border-slate-800">
                  {isWinner ? (
                    <div className="w-full py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>تأمین‌کننده منتخب</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => selectWinningQuotation(quote.id)}
                      className="w-full py-2 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 hover:border-emerald-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>انتخاب این پیشنهاد</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Modal: Add New Quotation */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>ثبت استعلام قیمت و پیش‌فاکتور جدید</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-5 space-y-4 text-xs">
              
              {/* Vendor Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  انتخاب تأمین‌کننده از وندور لیست:
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- تأمین‌کننده جدید یا آزاد --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city} - رتبه {v.grade})
                    </option>
                  ))}
                </select>
              </div>

              {!selectedVendorId && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    نام تأمین‌کننده / فروشگاه:
                  </label>
                  <input
                    type="text"
                    required
                    value={customVendorName}
                    onChange={(e) => setCustomVendorName(e.target.value)}
                    placeholder="مثلاً: بازرگانی ابزار صنعت نوین"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Quote number & date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    شماره پیش‌فاکتور:
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    placeholder="مثلاً: QU-403-102"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    تاریخ پیش‌فاکتور:
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                    placeholder="1403/08/20"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    قیمت واحد (تومان):
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="مثلاً: 25000000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    تعداد مورد نیاز:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${row.total_qty} ${row.unit}`}
                    className="w-full bg-slate-800/50 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Total Calculation Preview */}
              {unitPrice && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs flex items-center justify-between">
                  <span className="text-emerald-300">مجموع برآورد پیش‌فاکتور:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatToman(parseFloat(unitPrice) * qtyNumber)}
                  </span>
                </div>
              )}

              {/* Delivery and payment terms */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    زمان تحویل (روز کاری):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    شرایط پرداخت:
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="نقدی پیش از تحویل">نقدی پیش از تحویل</option>
                    <option value="چک ۳۰ روزه صیادی">چک ۳۰ روزه صیادی</option>
                    <option value="چک ۶۰ روزه صیادی">چک ۶۰ روزه صیادی</option>
                    <option value="۵۰٪ پیش‌پرداخت، مابقی پس از تحویل">۵۰٪ پیش‌پرداخت، مابقی تحویل</option>
                    <option value="اعتبار اسنادی داخلی LC">اعتبار اسنادی داخلی LC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  مدت و شرایط گارانتی:
                </label>
                <input
                  type="text"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  placeholder="مثلاً: ۱۲ ماه گارانتی تعویض قطعه"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  توضیحات و مشخصات فنی پیشنهادی:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="نکات بازرگانی، هزینه حمل، برند قطعات و..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  ثبت استعلام
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
