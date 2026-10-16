import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// در حالت توسعه، درخواست‌های /api به بک‌اند PRT (پیش‌فرض localhost:3000) هدایت می‌شوند
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {'/api': process.env.PRT_BACKEND || 'http://localhost:3000'},
  },
});
