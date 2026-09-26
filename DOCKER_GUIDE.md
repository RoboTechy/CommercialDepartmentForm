# راهنمای جامع داکر (Docker & Docker Compose)
## سامانه یکپارچه مدیریت بازرگانی و انبار (Commercial Department Portal)

این پروژه به طور کامل داکریزه (Dockerized) شده و با دو سناریوی **تولید (Production با Nginx سبک و ایمن)** و **توسعه (Development با قابلیت Live Reload)** آماده اجرا می‌باشد.

---

### پیش‌نیازها
* نصب بودن **Docker** (نسخه 20 به بالا)
* نصب بودن **Docker Compose** (معمولاً همراه Docker Desktop نصب است)

---

### ۱. اجرای سریع با Docker Compose (پیشنهادی برای پروداکشن)

برای ساخت ایمیج و اجرای کانتینر در پس‌زمینه کافیست دستور زیر را در پوشه پروژه اجرا کنید:

```bash
docker compose up -d --build
```

پس از چند ثانیه، برنامه آماده است و می‌توانید آن را در مرورگر مشاهده کنید:
👉 **http://localhost:8080**

برای توقف کانتینر:
```bash
docker compose down
```

---

### ۲. تغییر پورت پیش‌فرض
اگر مایلید برنامه روی پورت دیگری (مثلاً پورت 80 یا 3000) اجرا شود:

```bash
# اجرا روی پورت 80
PORT=80 docker compose up -d --build

# یا در ویندوز پاورشل:
$env:PORT="80"; docker compose up -d --build
```

---

### ۳. ساخت و اجرای دستی با Docker CLI (بدون Compose)

اگر نمی‌خواهید از compose استفاده کنید:

```bash
# ۱. ساخت ایمیج
docker build -t commercial-portal .

# ۲. اجرای کانتینر روی پورت 8080
docker run -d -p 8080:80 --name commercial_portal_app commercial-portal
```

بررسی وضعیت کانتینر:
```bash
docker ps
docker logs -f commercial_portal_app
```

---

### ۴. حالت توسعه زنده با داکر (Development with Hot-Reload)

اگر قصد دارید تغییرات در فایل‌های پروژه بلافاصله در مرورگر اعمال شوند بدون نیاز به نصب محلی Node.js:

```bash
docker compose -f docker-compose.dev.yml up --build
```

برنامه روی آدرس زیر در دسترس خواهد بود:
👉 **http://localhost:3000**

---

### ۵. ساختار معماری کانتینر (Multi-Stage Build)

1. **Stage 1 (Builder):**
   - بر پایه `node:20-alpine`
   - دریافت فایل‌ها، نصب پکیج‌ها و اجرای `npm run build`
   - تولید خروجی بهینه در پوشه `dist`
2. **Stage 2 (Runner):**
   - بر پایه وب‌سرور سبک و پایدار `nginx:1.27-alpine` (حجم نهایی زیر ۳۵ مگابایت!)
   - پیکربندی فشرده‌سازی Gzip برای لود سریع
   - تنظیم قوانین SPA Routing جهت پشتیبانی از صفحات و ری‌دایرکت‌ها
   - کش اختصاصی برای فایل‌های استاتیک و فونت‌ها
   - هدرهای امنیتی (X-Frame-Options, X-Content-Type-Options و ...)
   - بررسی سلامت کانتینر (Healthcheck)
