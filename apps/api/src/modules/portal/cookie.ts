// Cookie phiên cổng học viên (bản vẽ E 4.1, 2.3). Path /api/v1/portal: trình duyệt KHÔNG gửi cookie này tới đường nhân viên.
// Cờ httpOnly + SameSite=Strict + Secure (production) do app.ts đặt chung cho mọi CookieInstruction.
import type { Request } from 'express';
import { PORTAL_SESSION_DAYS } from '@makeup/shared';
import type { CookieInstruction } from '../../http/route';

export const PORTAL_COOKIE = 'mp_portal';
export const PORTAL_COOKIE_PATH = '/api/v1/portal';
export const PORTAL_COOKIE_MAX_AGE_MS = PORTAL_SESSION_DAYS * 86_400_000;

export function portalCookie(token: string): CookieInstruction {
  return { name: PORTAL_COOKIE, value: token, path: PORTAL_COOKIE_PATH, maxAgeMs: PORTAL_COOKIE_MAX_AGE_MS };
}

export const CLEAR_PORTAL_COOKIE: CookieInstruction = { name: PORTAL_COOKIE, value: null, path: PORTAL_COOKIE_PATH };

// Giá trị cookie mp_portal (đã giải mã) hoặc null. Tự tách header cookie (giống auth/transport.ts). Hỏng dạng (mã hoá %
// dở dang…) → null, KHÔNG ném: authenticatePortal coi như không có phiên. Trình duyệt gửi cookie path dài trước, nên
// có hai cookie cùng tên thì lấy cái đầu.
export function readPortalCookie(req: Request): string | null {
  const header = req.header('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k !== PORTAL_COOKIE) continue;
    try {
      return decodeURIComponent(v.join('='));
    } catch {
      return null;
    }
  }
  return null;
}
