// apps/api/.env.example phải khai ĐỦ mọi biến env.ts đọc, và chép nguyên thành .env (điền khoá JWT) thì máy chủ khởi động
// được (thợ K6, phiếu vướng 3 của K1 — thiếu MAIL_*, WEB_APP_URL, PASSWORD_RESET_TTL_MINUTES).
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';

const EXAMPLE = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const ENV_TS = readFileSync(new URL('../src/env.ts', import.meta.url), 'utf8');
const parsed = parseEnv(EXAMPLE) as Record<string, string>;

describe('.env.example', () => {
  it('khai mọi biến của EnvSchema (env.ts)', () => {
    const block = ENV_TS.slice(ENV_TS.indexOf('const EnvSchema'), ENV_TS.indexOf('.superRefine'));
    const keys = [...block.matchAll(/^ {4}([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1] ?? '');
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((k) => !(k in parsed))).toEqual([]);
  });

  it('có đủ biến gửi thư / đặt lại mật khẩu', () => {
    for (const k of ['MAIL_DRIVER', 'MAIL_FROM', 'MAIL_HTTP_URL', 'MAIL_HTTP_API_KEY', 'WEB_APP_URL', 'PASSWORD_RESET_TTL_MINUTES']) {
      expect(parsed, k).toHaveProperty(k);
    }
  });

  it('không chứa khoá thật: mọi biến bí mật để trống', () => {
    for (const k of ['JWT_ACCESS_SECRET', 'MAIL_HTTP_API_KEY', 'STORAGE_SIGNING_SECRET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      expect(parsed[k], k).toBe('');
    }
  });

  it('chép nguyên (chỉ điền JWT_ACCESS_SECRET) → env hợp lệ ở development', () => {
    const env = loadEnv({ ...parsed, JWT_ACCESS_SECRET: 'x'.repeat(32) });
    expect(env.MAIL_DRIVER).toBe('console');
    expect(env.WEB_APP_URL).toBe('http://localhost:5173');
    expect(env.PASSWORD_RESET_TTL_MINUTES).toBe(30);
    expect(env.MAIL_HTTP_API_KEY).toBeUndefined();
  });
});
