import type { Request } from 'express';
import type { CookieInstruction, Deps } from '../../http/route';
import { AppError } from '../../lib/errors';
import type { TokenPair } from './service';

// Hai cách giao refresh token:
// - App điện thoại (mặc định): trong thân trả về, app cất vào kho bảo mật của máy.
// - Trang web (header X-Client: web): CHỈ trong cookie httpOnly — mã JavaScript trên trang không đọc được,
//   nên mã độc chèn vào trang không lấy trộm được. Web gọi API cùng tên miền (Vercel chuyển /api sang máy chủ),
//   nên cookie SameSite=Strict vẫn đi kèm; header X-Client bắt buộc chặn việc trang lạ giả yêu cầu.
export const REFRESH_COOKIE = 'mp_refresh';
const COOKIE_PATH = '/api/v1/auth';

export function isWebClient(req: Request): boolean {
  return req.header('x-client') === 'web';
}

export function readRefreshCookie(req: Request): string | undefined {
  const raw = req.header('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === REFRESH_COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function deliverTokens(req: Request, deps: Deps, pair: TokenPair, extra: Record<string, unknown> = {}) {
  if (!isWebClient(req)) return { body: { ...extra, ...pair }, cookies: [] as CookieInstruction[] };
  const { refreshToken, ...rest } = pair;
  return {
    body: { ...extra, ...rest },
    cookies: [
      { name: REFRESH_COOKIE, value: refreshToken, path: COOKIE_PATH, maxAgeMs: deps.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 },
    ],
  };
}

export const CLEAR_REFRESH_COOKIE: CookieInstruction = { name: REFRESH_COOKIE, value: null, path: COOKIE_PATH };

// Thẻ gửi trong thân (app) hoặc trong cookie (web). Web phải gửi header X-Client: web mới được dùng cookie.
export function presentedRefreshToken(req: Request, fromBody: string | undefined): string {
  if (fromBody) return fromBody;
  if (isWebClient(req)) {
    const c = readRefreshCookie(req);
    if (c) return c;
  }
  throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
}
