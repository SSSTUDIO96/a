// Cấu hình vitest cho bài thử component giao diện (.test.tsx, môi trường jsdom).
// Tách khỏi vitest.config.ts gốc (môi trường node, chỉ *.test.ts) vì gói W2 không sở hữu tệp đó.
// Chạy: vitest run --config src/ui/vitest.dom.config.ts (đã gộp vào "pnpm test").
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/ui/**/*.test.tsx'],
    globals: true, // để @testing-library/react tự dọn DOM sau mỗi bài
    testTimeout: 60_000,
  },
});
