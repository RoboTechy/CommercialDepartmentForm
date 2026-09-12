FROM node:20-slim

# tzdata لازم است تا ساعت داخل کانتینر با منطقه‌ی زمانی ایران (برای زمان‌بندی
# بکاپ خودکار نیمه‌شب) درست تنظیم شود
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
