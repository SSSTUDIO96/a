import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Gọi API cùng tên miền: lúc dev, Vite chuyển /api sang máy chủ API chạy ở cổng 4000.
// Lên Vercel thì vercel.json làm việc này (xem README.md).
const API_DEV_TARGET = process.env.API_DEV_TARGET ?? 'http://localhost:4000';

// Cổng học viên là một trang vào riêng (hv.html, bản vẽ E mục 5.3). Trên Vercel, rewrite trong vercel.json lo việc này;
// lúc dev và preview thì đổi /hv và /hv/... (không có đuôi tệp) sang /hv.html để chạy thử được. /hv/manifest.webmanifest là tệp thật, để nguyên.
export function hvRewrite(url: string | undefined): string | undefined {
  if (!url) return url;
  const q = url.indexOf('?');
  const path = q === -1 ? url : url.slice(0, q);
  const rest = q === -1 ? '' : url.slice(q);
  const isHv = path === '/hv' || (path.startsWith('/hv/') && !/\.[A-Za-z0-9]+$/.test(path));
  return isHv ? `/hv.html${rest}` : url;
}

function hvEntry(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    req.url = hvRewrite(req.url);
    next();
  };
  return {
    name: 'makeup-hv-entry',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [react(), hvEntry()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_DEV_TARGET, changeOrigin: false },
    },
  },
  build: {
    sourcemap: false,
    // dist/.vite/manifest.json: scripts/check-portal-bundle.mjs đọc để tính JS mà trang vào hv.html kéo theo.
    manifest: true,
    rollupOptions: {
      input: { main: 'index.html', hv: 'hv.html' },
      output: {
        // Tệp của từng màn (React.lazy ở src/app/routes.tsx) mang tên gói thay vì "index-…", đọc kích thước biết ngay là màn nào.
        chunkFileNames: (chunk) => {
          const m = /[\\/]features[\\/]([^\\/]+)[\\/]index\.tsx?$/.exec(chunk.facadeModuleId ?? '');
          return m ? `assets/man-${m[1]}-[hash].js` : 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
