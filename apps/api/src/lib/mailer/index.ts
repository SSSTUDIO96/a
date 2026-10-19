import type { Env } from '../../env';
import type { Logger } from '../logger';
import { ConsoleMailer } from './console';
import { HttpApiMailer } from './http';
import type { Mailer, MailerUnavailable } from './types';

export { CONSOLE_MAIL_MARK, ConsoleMailer } from './console';
export { HttpApiMailer, type HttpMailerConfig } from './http';
export type { Mailer, MailerUnavailable, MailMessage } from './types';

type MailEnv = Pick<Env, 'NODE_ENV' | 'MAIL_DRIVER' | 'MAIL_FROM' | 'MAIL_HTTP_URL' | 'MAIL_HTTP_API_KEY' | 'WEB_APP_URL'>;

export type MailSetup = { ok: true; mailer: Mailer; webAppUrl: string } | ({ ok: false } & MailerUnavailable);

const DEV_WEB_APP_URL = 'http://localhost:5173';

// Chọn người gửi thư theo env. Production KHÔNG có đường lui im lặng: thiếu cấu hình → { ok: false, reason }
// và đường quên mật khẩu trả 503 NOT_CONFIGURED có tên (không giả vờ "đã gửi").
export function createMailerFromEnv(env: MailEnv, logger: Logger): MailSetup {
  const prod = env.NODE_ENV === 'production';
  const webAppUrl = env.WEB_APP_URL ?? (prod ? undefined : DEV_WEB_APP_URL);
  if (!webAppUrl) {
    return {
      ok: false,
      reason: 'WEB_APP_URL_NOT_CONFIGURED',
      hint: 'Khai WEB_APP_URL (địa chỉ trang web, vd https://app.makeup.vn) để dựng đường dẫn trong thư — docs/DEPLOYMENT.md.',
    };
  }
  const base = webAppUrl.replace(/\/+$/, '');
  if (env.MAIL_DRIVER === 'http') {
    // env.ts đã bắt buộc đủ 3 biến khi MAIL_DRIVER=http; kiểm lại để không có giá trị rỗng ngầm.
    if (!env.MAIL_HTTP_URL || !env.MAIL_HTTP_API_KEY || !env.MAIL_FROM) {
      return { ok: false, reason: 'MAIL_NOT_CONFIGURED', hint: 'MAIL_DRIVER=http cần MAIL_HTTP_URL, MAIL_HTTP_API_KEY, MAIL_FROM.' };
    }
    return { ok: true, webAppUrl: base, mailer: new HttpApiMailer({ url: env.MAIL_HTTP_URL, apiKey: env.MAIL_HTTP_API_KEY, from: env.MAIL_FROM }) };
  }
  if (prod) {
    return env.MAIL_DRIVER === 'console'
      ? {
          ok: false,
          reason: 'MAIL_CONSOLE_IN_PRODUCTION',
          hint: 'MAIL_DRIVER=console chỉ dùng chạy thử (in đường dẫn bí mật ra log) — production phải dùng MAIL_DRIVER=http.',
        }
      : {
          ok: false,
          reason: 'MAIL_NOT_CONFIGURED',
          hint: 'Chưa cấu hình gửi thư: khai MAIL_DRIVER=http, MAIL_HTTP_URL, MAIL_HTTP_API_KEY, MAIL_FROM — docs/DEPLOYMENT.md.',
        };
  }
  return { ok: true, webAppUrl: base, mailer: new ConsoleMailer(logger) };
}

const cache = new WeakMap<object, MailSetup>();

// Một người gửi thư cho mỗi bộ env (máy chủ chỉ có một; bài thử dựng nhiều app với env khác nhau).
export function mailSetupFor(env: MailEnv, logger: Logger): MailSetup {
  let setup = cache.get(env);
  if (!setup) {
    setup = createMailerFromEnv(env, logger);
    cache.set(env, setup);
  }
  return setup;
}
