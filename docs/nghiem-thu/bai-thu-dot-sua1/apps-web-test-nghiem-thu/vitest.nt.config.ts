// Cấu hình riêng của thợ chấm (không thuộc sản phẩm).
import { defineConfig } from 'vitest/config';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test-nghiem-thu/**/*.test.{ts,tsx}'],
    globals: true,
    testTimeout: 60_000,
  },
});
