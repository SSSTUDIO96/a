import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Gọi API cùng tên miền: lúc dev, Vite chuyển /api sang máy chủ API chạy ở cổng 4000.
// Lên Vercel thì vercel.json làm việc này (xem README.md).
const API_DEV_TARGET = process.env.API_DEV_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_DEV_TARGET, changeOrigin: false },
    },
  },
  build: {
    sourcemap: false,
  },
});
