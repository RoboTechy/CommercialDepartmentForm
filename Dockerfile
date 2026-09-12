FROM node:20-slim

# tzdata لازم است تا ساعت داخل کانتینر با منطقه‌ی زمانی ایران (برای زمان‌بندی
# بکاپ خودکار نیمه‌شب) درست تنظیم شود. DEBIAN_FRONTEND=noninteractive و TZ از
# قبل تنظیم می‌شوند تا نصب tzdata هرگز منتظر پاسخ تعاملی (که در بیلد داکر
# هیچ‌وقت نمی‌رسد و بیلد را برای مدت طولانی معطل نگه می‌دارد) نماند.
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Tehran
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
