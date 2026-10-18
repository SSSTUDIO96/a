import { defineConfig } from 'tsup';

export default defineConfig({
  // Lệnh đồng bộ vai trò cũng được đóng gói để chạy trên máy thật mà không cần công cụ phát triển (tsx).
  entry: ['src/server.ts', 'src/scripts/run-sync-system-roles.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // Gói thẳng mã dùng chung vào bản build; thư viện bên ngoài giữ nguyên trong node_modules.
  noExternal: ['@makeup/shared'],
  clean: true,
});
