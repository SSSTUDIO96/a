import { createHmac, timingSafeEqual } from 'node:crypto';

// Vé đọc tệp cho driver đĩa cục bộ: base64url(khoá|hạn) + "." + HMAC-SHA256. Không chứa đường dẫn đĩa.
export type TokenCheck =
  | { ok: true; key: string; expiresAt: Date }
  | { ok: false; reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' };

function mac(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function signToken(secret: string, key: string, expiresAt: Date): string {
  const payload = Buffer.from(`${key}|${Math.floor(expiresAt.getTime() / 1000)}`).toString('base64url');
  return `${payload}.${mac(secret, payload).toString('base64url')}`;
}

export function verifyToken(secret: string, token: string, now: Date = new Date()): TokenCheck {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'MALFORMED' };
  const [payload, sig] = parts as [string, string];
  // So chuỗi chữ ký ở dạng mã hoá chuẩn: base64url có bit thừa ở ký tự cuối, giải mã rồi so sẽ nhận cả bản bị sửa bit thừa.
  const given = Buffer.from(sig, 'utf8');
  const expected = Buffer.from(mac(secret, payload).toString('base64url'), 'utf8');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'BAD_SIGNATURE' };
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const sep = decoded.lastIndexOf('|');
  const exp = Number(decoded.slice(sep + 1));
  if (sep <= 0 || !Number.isSafeInteger(exp)) return { ok: false, reason: 'MALFORMED' };
  if (exp * 1000 <= now.getTime()) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, key: decoded.slice(0, sep), expiresAt: new Date(exp * 1000) };
}
