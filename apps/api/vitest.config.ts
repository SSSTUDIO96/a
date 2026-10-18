import { defineConfig } from 'vitest/config';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://makeup:makeup_local@localhost:5432/makeup_test';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DB,
      DIRECT_URL: TEST_DB,
      JWT_ACCESS_SECRET: 'test-secret-chi-dung-cho-bai-thu-0123456789',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      LOG_LEVEL: 'silent',
    },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
