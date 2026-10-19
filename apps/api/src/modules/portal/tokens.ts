// Chìa đường dẫn, thẻ phiên, mã chuyển máy của cổng học viên (bản vẽ E 4.1, 2.2 luật 5).
// Cả ba là chuỗi NGẪU NHIÊN (không phải JWT); database CHỈ giữ sha256 dạng hex 64 ký tự (CHECK ở migration
// 20261019200000_cong_hoc_vien chặn ghi nhầm bản rõ). Lộ database không lộ chìa/thẻ/mã.
import { createHash, randomBytes, randomInt } from 'node:crypto';

// Tiền tố thẻ phiên cổng: authenticate (http/middleware.ts) từ chối mọi Bearer bắt đầu bằng chuỗi này.
export const PORTAL_TOKEN_PREFIX = 'mpp_';
// Dạng thẻ phiên hợp lệ: "mpp_" + 32 byte base64url (43 ký tự).
export const PORTAL_TOKEN_PATTERN = /^mpp_[A-Za-z0-9_-]{43}$/;
// Bảng 31 chữ/số dễ đọc (bỏ I, L, O, 0, 1) — bản vẽ E 2.6.
export const HANDOFF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const HANDOFF_LENGTH = 8;

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// Chìa trong đường dẫn <web>/hv#k=<chìa>: 32 byte → 43 ký tự base64url.
export function newLinkKey(): { key: string; hash: string } {
  const key = randomBytes(32).toString('base64url');
  return { key, hash: sha256Hex(key) };
}

// Thẻ phiên (cookie mp_portal).
export function newSessionToken(): { token: string; hash: string } {
  const token = `${PORTAL_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { token, hash: sha256Hex(token) };
}

// Dạng chuẩn của mã chuyển máy để băm: bỏ gạch/khoảng trắng, chữ hoa. Người dùng gõ "abcd-efgh" vẫn khớp.
export function normalizeHandoffCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function hashHandoffCode(input: string): string {
  return sha256Hex(normalizeHandoffCode(input));
}

// Mã chuyển máy: 8 ký tự từ bảng 31 (randomInt không lệch phân phối), hiện "ABCD-EFGH"; băm dạng đã bỏ gạch.
export function newHandoffCode(): { code: string; hash: string } {
  let raw = '';
  for (let i = 0; i < HANDOFF_LENGTH; i++) raw += HANDOFF_ALPHABET[randomInt(HANDOFF_ALPHABET.length)];
  return { code: `${raw.slice(0, 4)}-${raw.slice(4)}`, hash: hashHandoffCode(raw) };
}
