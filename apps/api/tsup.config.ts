import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // Gói thẳng mã dùng chung vào bản build; thư viện bên ngoài giữ nguyên trong node_modules.
  noExternal: ['@makeup/shared'],
  clean: true,
});
