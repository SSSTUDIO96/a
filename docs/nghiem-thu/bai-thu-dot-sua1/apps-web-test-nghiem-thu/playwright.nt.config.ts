// Cấu hình Playwright riêng của thợ chấm: API thật (database makeup_test_cham_sua1, cổng 4052, thẻ ngắn hạn 4 giây) + Vite dev (cổng 5192).
import { defineConfig, devices } from '@playwright/test';
const DB = 'postgresql://makeup:makeup_local@localhost:5432/makeup_test_cham_sua1';
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.pw\.ts/,
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  outputDir: '/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-sua1-bien-ban/pw-out',
  use: { baseURL: 'http://localhost:5192', ...devices['Desktop Chrome'] },
  webServer: [
    {
      command: 'pnpm exec tsx src/server.ts',
      cwd: '../../api',
      url: 'http://localhost:4052/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development', PORT: '4052', DATABASE_URL: DB, DIRECT_URL: DB,
        JWT_ACCESS_SECRET: 'tho-cham-web-chi-dung-cho-bai-thu-0123456789', AUTH_RATE_LIMIT_PER_MINUTE: '1000',
        ACCESS_TOKEN_TTL_SECONDS: '4', LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'pnpm exec vite --port 5192 --strictPort',
      cwd: '..',
      url: 'http://localhost:5192',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_DEV_TARGET: 'http://localhost:4052' },
    },
  ],
});
