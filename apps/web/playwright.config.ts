import { defineConfig, devices } from '@playwright/test';

// E2E thật: máy chủ API thật (database thử riêng makeup_test_web) + Vite dev (proxy /api → cổng 4000).
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://makeup:makeup_local@localhost:5432/makeup_test_web';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'pnpm exec tsx src/server.ts',
      cwd: '../api',
      url: 'http://localhost:4000/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: '4000',
        DATABASE_URL: DB,
        DIRECT_URL: DB,
        JWT_ACCESS_SECRET: 'e2e-web-chi-dung-cho-bai-thu-0123456789abcdef',
        AUTH_RATE_LIMIT_PER_MINUTE: '1000',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'pnpm exec vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
