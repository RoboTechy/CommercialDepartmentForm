import { GROUPS } from '../config';
import React, { useState } from 'react';
import { Vendor } from '../types';
import { useExactDb } from '../context/ExactDatabaseContext';
import { 
  Building2, 
  PlusCircle, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  ShieldCheck, 
  FileText, 
  Edit3, 
  Trash2, 
  X,
  ExternalLink,
  Award
} from 'lucide-react';

export const VendorsDirectoryView: React.FC = () => {
  const { vendors, addVendor, updateVendor, deleteVendor, quotations, isAdmin, currentUser } = useExactDb();
  // فقط بازرگانی غدیر و ادمین می‌توانند اطلاعات بانک تأمین‌کنندگان را ثبت/ویرایش/حذف کنند (سرور هم همین را اعمال می‌کند)
  const canManageVendors = Boolean(isAdmin || (currentUser && currentUser.groups.includes(GROUPS.commercial)));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // New Vendor Form
  const [name, setName] = useState('');
  const [category, setCategory] = useState('تجهیزات دوار و مکانیکی');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('تهران');
  const [grade, setGrade] = useState<'A' | 'B' | 'C'>('A');
  const [rating, setRating] = useState<number>(5);
  const [address, setAddress] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [notes, setNotes] = useState('');

  const categories = Array.from(new Set(vendors.map((v) => v.category)));

  const filteredVendors = vendors.filter((v) => {
    if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;
    if (selectedGrade !== 'all' && v.grade !== selectedGrade) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = v.name.toLowerCase().includes(q);
      const matchCity = v.city.toLowerCase().includes(q);
      const matchContact = v.contactPerson.toLowerCase().includes(q);
      if (!matchName && !matchCity && !matchContact) return false;
    }
    return true;
  });

  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingVendor) {
      updateVendor(editingVendor.id, {
        name,
        category,
        contactPerson,
        phone,
        email,
        city,
        grade,
        rating,
        address,
        economicCode,
        notes,
      });
      setEditingVendor(null);
    } else {
      addVendor({
        name,
        category,
        contactPerson,
        phone,
        email,
        city,
        grade,
        rating,
        status: 'active',
        address,
        economicCode,
        notes,
      });
    }

    setIsAddModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setCategory('تجهیزات دوار و مکانیکی');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setCity('تهران');
    setGrade('A');
    setRating(5);
    setAddress('');
    setEconomicCode('');
    setNotes('');
  };

  const openEdit = (v: Vendor) => {
    setEditingVendor(v);
    setName(v.name);
    setCategory(v.category);
    setContactPerson(v.contactPerson);
    setPhone(v.phone);
    setEmail(v.email);
    setCity(v.city);
    setGrade(v.grade);
    setRating(v.rating);
    setAddress(v.address || '');
    setEconomicCode(v.economicCode || '');
    setNotes(v.notes || '');
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              مدیریت زنجیره تأمین و بازرگانی
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              {vendors.length} شرکت معتبر
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <span>بانک اطلاعات تأمین‌کنندگان و وندور لیست (Vendor List)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ثبت اطلاعات، امتیاز کیفی، استعلام‌های صادره و ارزیابی عملکرد تأمین‌کنندگان طرف قرارداد
          </p>
        </div>

        {canManageVendors ? (
        <button
          onClick={() => {
            setEditingVendor(null);
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>افزودن تأمین‌کننده جدید</span>
        </button>
        ) : (
          <span className="text-[11px] px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 self-start sm:self-auto">
            فقط مشاهده — ثبت و ویرایش با بازرگانی غدیر
          </span>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس نام شرکت، شخص رابط یا شهر..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">همه حوزه‌های فعالیت</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">همه رتبه‌ها</option>
            <option value="A">رتبه A (ممتاز)</option>
            <option value="B">رتبه B (استاندارد)</option>
            <option value="C">رتبه C (مشروط)</option>
          </select>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.map((vendor) => {
          const quotesCount = quotations.filter((q) => q.vendorId === vendor.id).length;
          const winsCount = quotations.filter((q) => q.vendorId === vendor.id && q.status === 'selected').length;

          return (
            <div
              key={vendor.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
            >
              <div>
                {/* Header & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {vendor.id}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{vendor.name}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">
                      {vendor.category}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      vendor.grade === 'A'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : vendor.grade === 'B'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      گرید {vendor.grade}
                    </span>

                    <div className="flex items-center gap-1 text-amber-400 text-xs font-mono">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{vendor.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      تماس:
                    </span>
                    <span className="font-mono">{vendor.phone}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      شهر:
                    </span>
                    <span>{vendor.city}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">رابط بازرگانی:</span>
                    <span>{vendor.contactPerson}</span>
                  </div>

                  {vendor.economicCode && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>کد اقتصادی:</span>
                      <span className="font-mono">{vendor.economicCode}</span>
                    </div>
                  )}
                </div>

                {vendor.notes && (
                  <p className="text-[11px] text-slate-400 mt-3 p-2 bg-slate-800/40 rounded-lg">
                    {vendor.notes}
                  </p>
                )}
              </div>

              {/* Footer Stats & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  {isAdmin ? (
                    <>
                      <span>{quotesCount} استعلام</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">{winsCount} خرید موفق</span>
                    </>
                  ) : (
                    <span>{vendor.city}</span>
                  )}
                </div>

                {canManageVendors && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(vendor)}
                    title="ویرایش مشخصات"
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => deleteVendor(vendor.id)}
                    title="حذف"
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>{editingVendor ? 'ویرایش مشخصات تأمین‌کننده' : 'افزودن تأمین‌کننده به وندور لیست'}</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام شرکت یا بازرگانی:
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلاً: صنایع فولاد خوزستان"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    زمینه فعالیت:
                  </label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="مثلاً: شیرآلات و پایپینگ"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    رتبه کیفی (Grade):
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="A">گرید A (تأمین‌کننده اصلی و معتبر)</option>
                    <option value="B">گرید B (استاندارد)</option>
                    <option value="C">گرید C (مشروط / نیاز به تایید)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    شخص رابط / مدیر فروش:
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="نام مسئول فروش"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    شماره تماس ثابت/همراه:
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="021-..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    شهر:
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="تهران، اصفهان..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    کد اقتصادی:
                  </label>
                  <input
                    type="text"
                    value={economicCode}
                    onChange={(e) => setEconomicCode(e.target.value)}
                    placeholder="شناسه ۱۲ رقمی اقتصادی"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  آدرس دفتر / انبار مرکزی:
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="آدرس دقیق کارخانه یا دفتر مرکزی"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  یادداشت و شرایط خاص همکاری:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="نکات اعتباری، تخفیفات و شرایط حمل..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
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
                  ذخیره تأمین‌کننده
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
