import { defineConfig } from 'tsup';

export default defineConfig({
  // Các lệnh quản trị cũng được đóng gói để chạy trên máy thật mà không cần công cụ phát triển (tsx):
  // đồng bộ vai trò, cấp/thu quyền quản trị nền tảng, tạo gói mẫu.
  entry: [
    'src/server.ts',
    'src/scripts/run-sync-system-roles.ts',
    'src/scripts/grant-platform-admin.ts',
    'src/scripts/seed-plans.ts',
  ],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // Gói thẳng mã dùng chung vào bản build; thư viện bên ngoài giữ nguyên trong node_modules.
  noExternal: ['@makeup/shared'],
  clean: true,
});
