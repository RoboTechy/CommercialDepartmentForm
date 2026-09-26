# سامانه یکپارچه مدیریت فرم واحد بازرگانی و انبار
# Commercial Department Form & Inventory Management Portal (Dockerized)

این پروژه شامل سورس‌کد کامل سامانه مدیریت درخواست‌های بازرگانی و انبار، به همراه ساختار کامل دیتابیس، سیستم دسترسی نقش‌های LDAP، گزارشات زمان‌بندی و داشبورد مدیریتی است که به صورت کاملاً **داکریزه شده (Dockerized)** با **Nginx سبک و بهینه** و همچنین قابلیت اجرای محلی با Node.js آماده شده است.

---

## 🐳 نحوه اجرای سریع با داکر (Docker & Docker Compose)

سریع‌ترین و بی‌دردسرترین راه برای بالا آوردن سامانه، استفاده از Docker است (بدون نیاز به نصب Node.js یا پکیج‌های اضافی):

### اجرای نسخه پروداکشن (توصیه شده):
```bash
docker compose up -d --build
```
سامانه بلافاصله روی آدرس زیر در دسترس خواهد بود:
👉 **http://localhost:8080**

### اجرای نسخه توسعه (با قابلیت Live Reload):
```bash
docker compose -f docker-compose.dev.yml up --build
```
آدرس: **http://localhost:3000**

برای توقف کانتینرها:
```bash
docker compose down
```

برای جزئیات بیشتر به فایل [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) مراجعه فرمایید.

---

## 📁 ساختار فایل‌های پروژه (محتویات این بسته)

- `Dockerfile` : ساخت کانتینر دو مرحله‌ای (Multi-stage) فوق‌العاده سبک با Nginx
- `Dockerfile.dev` : ساخت کانتینر ویژه محیط توسعه با پشتیبانی از Hot Reload
- `docker-compose.yml` : ارکستراسیون و اجرای کانتینر پروداکشن با تنظیمات سلامت و کش
- `docker-compose.dev.yml` : اجرای محیط توسعه با Docker Compose
- `nginx.conf` : پیکربندی وب‌سرور Nginx همراه با Gzip، کش دارایی‌ها و SPA Routing
- `.dockerignore` : جلوگیری از ورود فایل‌های غیرضروری به ایمیج داکر
- `DOCKER_GUIDE.md` : راهنمای کامل فارسی و خط‌به‌خط داکر
- `src/` : تمامی کدهای اصلی برنامه
  - `src/data/exactSections.ts` : تعریف دقیق ساختار تمام بخش‌ها، فیلدها و ماتریس دسترسی دیتابیس
  - `src/store/exactStore.ts` : استور مرکزی و توابع ذخیره‌سازی، ویرایش، حذف و تاریخچه سیستم
  - `src/context/ExactDatabaseContext.tsx` : کانتکست React برای مدیریت داده‌ها و اعتبارسنجی نقش‌ها
  - `src/components/` : کامپوننت‌های رابط کاربری
    - `Header.tsx` : نوار بالای صفحه
    - `Sidebar.tsx` : منوی ناوبری و دسترسی‌ها
    - `DashboardView.tsx` : فهرست درخواست‌ها و فیلترهای پیشرفته
    - `RowDetailView.tsx` : فرم جامع مشاهده و ویرایش بخش‌های ۱ تا ۸ بر اساس مجوز کاربر
    - `NewRequestView.tsx` : فرم ثبت درخواست کالای جدید
    - `DraftsView.tsx` : کارتابل پیش‌نویس‌ها
    - `DurationReportView.tsx` : گزارش تحلیلی زمان‌بندی و گلوگاه‌ها
    - `ManagementReportView.tsx` : گزارش مدیریتی و تراز مالی
    - `DeletedRowsView.tsx` : سطل زباله و بازیابی رکوردها
    - `AuditLogsView.tsx` : لاگ‌ها و ردپای تغییرات سیستم
    - `HistoryDrawer.tsx` : کشوی نمایش تاریخچه تغییرات هر درخواست
    - `LdapUserModal.tsx` : انتخاب و تست انواع نقش‌های LDAP
    - `SourceCodeModal.tsx` : مرورگر آنلاین فایل‌های پروژه، داکر و دیتابیس
  - `src/types/index.ts` : تعاریف تایپ‌های TypeScript داده‌ها و فیلدها
  - `src/utils/exactJalaali.ts` : توابع تبدیل و کار با تاریخ شمسی/جلالی
  - `src/utils/downloadZip.ts` : ابزار تولید و دانلود فایل کامل پروژه
  - `src/App.tsx` : کامپوننت اصلی چیدمان
  - `src/main.tsx` : نقطه ورود برنامه
  - `src/index.css` : استایل‌های مدرن با Tailwind CSS v4 و فونت وزیرمتن
- `package.json` : فهرست وابستگی‌ها و اسکریپت‌های اجرایی
- `vite.config.ts` : پیکربندی بیلد Vite
- `tsconfig.json` : تنظیمات TypeScript
- `index.html` : قالب HTML اصلی برنامه

---

## 💻 اجرای سنتی با Node.js (بدون داکر)

برای اجرای پروژه به صورت محلی:

۱. نرم‌افزار [Node.js](https://nodejs.org/) (نسخه ۱۸ یا بالاتر) را نصب داشته باشید.
۲. ترمینال یا Command Prompt را در این پوشه باز کنید.
۳. دستور زیر را برای نصب پکیج‌ها اجرا نمایید:
```bash
npm install
```
۴. برای اجرای برنامه در محیط لوکال:
```bash
npm run dev
```
۵. آدرس نمایش داده شده (`http://localhost:3000`) را در مرورگر باز کنید.

