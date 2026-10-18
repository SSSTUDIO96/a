import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Vé đọc tệp cho driver đĩa cục bộ: base64url(iv | mã hoá(khoá|hạn) | thẻ GCM) + "." + HMAC-SHA256(phần trước).
// Nội dung vé được MÃ HOÁ (AES-256-GCM): cầm vé không đọc ra được khoá lưu trữ — trước đây vé chỉ là base64 của
// "org/<mã tổ chức>/<mục đích>/<uuid>.png|hạn" nên trang công khai có ảnh là lộ mã tổ chức (biên bản máy chủ lát 2, N3).
// Vé dạng cũ (đang nằm trong bộ đệm trình duyệt) thôi dùng được — tối đa 10 phút, tải lại trang là có vé mới.
export type TokenCheck =
  | { ok: true; key: string; expiresAt: Date }
  | { ok: false; reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' };

const IV_BYTES = 12;
const TAG_BYTES = 16;

function mac(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

// Khoá mã hoá tách riêng khỏi khoá ký (dẫn xuất từ cùng bí mật, khác mục đích).
function encKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('makeup:file-token:enc:v1').digest();
}

export function signToken(secret: string, key: string, expiresAt: Date): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', encKey(secret), iv);
  const body = Buffer.concat([cipher.update(`${key}|${Math.floor(expiresAt.getTime() / 1000)}`, 'utf8'), cipher.final()]);
  const payload = Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url');
  return `${payload}.${mac(secret, payload).toString('base64url')}`;
}

function decrypt(secret: string, payload: string): string | null {
  const raw = Buffer.from(payload, 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encKey(secret), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function verifyToken(secret: string, token: string, now: Date = new Date()): TokenCheck {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'MALFORMED' };
  const [payload, sig] = parts as [string, string];
  // So chuỗi chữ ký ở dạng mã hoá chuẩn: base64url có bit thừa ở ký tự cuối, giải mã rồi so sẽ nhận cả bản bị sửa bit thừa.
  const given = Buffer.from(sig, 'utf8');
  const expected = Buffer.from(mac(secret, payload).toString('base64url'), 'utf8');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'BAD_SIGNATURE' };
  const decoded = decrypt(secret, payload);
  if (decoded === null) return { ok: false, reason: 'MALFORMED' };
  const sep = decoded.lastIndexOf('|');
  const exp = Number(decoded.slice(sep + 1));
  if (sep <= 0 || !Number.isSafeInteger(exp)) return { ok: false, reason: 'MALFORMED' };
  if (exp * 1000 <= now.getTime()) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, key: decoded.slice(0, sep), expiresAt: new Date(exp * 1000) };
}
