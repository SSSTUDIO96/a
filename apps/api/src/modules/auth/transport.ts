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

// Giá trị thô (chưa giải mã) của cookie refresh, nếu có.
function rawRefreshCookie(req: Request): string | undefined {
  const raw = req.header('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === REFRESH_COOKIE) return v.join('=');
  }
  return undefined;
}

// Cookie hỏng (vd "%E0%A4%A" — mã hoá % dở dang) trước đây làm decodeURIComponent ném URIError → 500
// (biên bản nghiệm thu web 1, N3). Giờ là lỗi đăng nhập có tên rõ, kèm lệnh xoá cookie.
export class MalformedRefreshCookieError extends AppError {
  constructor() {
    super('UNAUTHENTICATED', 'Cookie đăng nhập bị hỏng, vui lòng đăng nhập lại', { reason: 'REFRESH_COOKIE_MALFORMED' });
  }
}

export function readRefreshCookie(req: Request): string | undefined {
  const raw = rawRefreshCookie(req);
  if (raw === undefined) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new MalformedRefreshCookieError();
  }
}

// Yêu cầu đổi thẻ có KÈM thẻ không (trong thân, hoặc cookie từ web). Dùng cho bộ đếm chống dò của /auth/refresh:
// trang chưa đăng nhập gọi refresh không kèm thẻ không phải là dò, không bị đếm. Không giải mã, không ném lỗi.
export function hasPresentedRefreshToken(req: Request): boolean {
  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  if (typeof fromBody === 'string' && fromBody !== '') return true;
  return isWebClient(req) && Boolean(rawRefreshCookie(req));
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
// Cookie hỏng: trả 401 REFRESH_COOKIE_MALFORMED và xoá luôn cookie (giữ lại thì lần tải trang nào cũng hỏng như cũ).
export function presentedRefreshToken(req: Request, deps: Deps, fromBody: string | undefined): string {
  if (fromBody) return fromBody;
  if (isWebClient(req)) {
    let c: string | undefined;
    try {
      c = readRefreshCookie(req);
    } catch (err) {
      if (err instanceof MalformedRefreshCookieError) {
        // Cùng thuộc tính với cookie đã đặt (app.ts) — trình duyệt chỉ xoá khi khớp path.
        req.res?.clearCookie(REFRESH_COOKIE, {
          httpOnly: true,
          secure: deps.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: COOKIE_PATH,
        });
      }
      throw err;
    }
    if (c) return c;
  }
  throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
}
