# فونت IRANSansWeb

این پوشه محل قرارگیری فایل‌های فونت **IRANSansWeb** است. چون این فونت دارای مجوز
تجاری/اختصاصی است، در این ریپازیتوری قرار داده نشده — لازم است نسخه‌ای که خودتان
مجاز به استفاده از آن هستید را اینجا کپی کنید.

فایل‌های مورد نیاز (حداقل این دو وزن؛ در صورت داشتن وزن‌های بیشتر مثل Medium یا
Light می‌توانید در `public/style.css` بخش `@font-face` را برای آن‌ها هم اضافه کنید):

```
public/fonts/iransansweb/IRANSansWeb.woff2
public/fonts/iransansweb/IRANSansWeb.woff
public/fonts/iransansweb/IRANSansWeb_Bold.woff2
public/fonts/iransansweb/IRANSansWeb_Bold.woff
```

اگر فایل‌های شما نام دیگری دارند (مثلاً `IRANSansWeb(FaNum)_Bold.woff2`)، کافی است
یا فایل‌ها را با همین نام‌ها Rename کنید، یا مسیرها را در `@font-face` داخل
`public/style.css` با نام واقعی فایل‌هایتان هماهنگ کنید.

بدون این فایل‌ها، سایت به‌صورت خودکار روی فونت‌های جایگزین (Tahoma / Vazirmatn /
Segoe UI) نمایش داده می‌شود و از کار نمی‌افتد؛ فقط فونت اصلی اعمال نمی‌شود.
