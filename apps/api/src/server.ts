import { loadEnv } from './env';
import { createApp } from './app';
import { createLogger } from './lib/logger';
import { createPrisma } from './lib/prisma';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const db = createPrisma(env.DATABASE_URL);
const app = createApp({ db, env, logger });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Makeup Pro API đã chạy');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Đang tắt máy chủ');
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
