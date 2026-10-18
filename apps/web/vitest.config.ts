import { defineConfig } from 'vitest/config';

// Hai nhóm bài thử trong một lệnh `vitest run`:
// - node: *.test.ts (máy khách API, cửa gác bí mật, kiểm dữ liệu...).
// - dom: *.test.tsx (component, khung điều hướng) chạy trong jsdom; globals để @testing-library/react tự dọn DOM sau mỗi bài.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          testTimeout: 60_000,
        },
      },
      {
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          globals: true,
          testTimeout: 60_000,
        },
      },
    ],
  },
});
