// Hai núm riêng cho bộ đếm đổi thẻ (/auth/refresh): REFRESH_PROBE_LIMIT_PER_MINUTE (lần đổi thẻ SAI) và
// REFRESH_RATE_LIMIT_PER_MINUTE (trần tổng). Bỏ trống → giữ đúng công thức cũ 3× / 30× AUTH_RATE_LIMIT_PER_MINUTE.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadEnv } from '../src/env';
import type { Deps } from '../src/http/route';
import { makeApp, makeDeps, type App } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

function appWith(env: Record<string, string>): App {
  const d: Deps = { ...deps, env: loadEnv({ ...process.env, ...env }) };
  return makeApp(d);
}

describe('giới hạn đổi thẻ đọc từ env, bị chặn có Retry-After', () => {
  it('bỏ trống (kể cả dòng rỗng) → mặc định 3× và 30× AUTH_RATE_LIMIT_PER_MINUTE như trước', () => {
    const e = loadEnv({ ...process.env, AUTH_RATE_LIMIT_PER_MINUTE: '7', REFRESH_PROBE_LIMIT_PER_MINUTE: '', REFRESH_RATE_LIMIT_PER_MINUTE: undefined });
    expect([e.REFRESH_PROBE_LIMIT_PER_MINUTE, e.REFRESH_RATE_LIMIT_PER_MINUTE]).toEqual([21, 210]);
    expect(() => loadEnv({ ...process.env, REFRESH_PROBE_LIMIT_PER_MINUTE: '0' })).toThrow(/REFRESH_PROBE_LIMIT_PER_MINUTE/);
    expect(() => loadEnv({ ...process.env, REFRESH_RATE_LIMIT_PER_MINUTE: 'nhieu' })).toThrow(/REFRESH_RATE_LIMIT_PER_MINUTE/);
  });

  it('REFRESH_PROBE_LIMIT_PER_MINUTE=2 → lần đổi thẻ sai thứ 3 bị 429 sớm (AUTH vẫn 1000)', async () => {
    const app = appWith({ AUTH_RATE_LIMIT_PER_MINUTE: '1000', REFRESH_PROBE_LIMIT_PER_MINUTE: '2' });
    const res: request.Response[] = [];
    for (let i = 0; i < 4; i++) res.push(await request(app).post('/api/v1/auth/refresh').send({ refreshToken: `the-gia-${i}-${randomUUID()}` }));
    expect(res.map((r) => r.status)).toEqual([401, 401, 429, 429]);
    // Bị chặn → có Retry-After (giây, 1..60) để web báo "thử lại sau N giây".
    for (const r of res.slice(2)) expect(Number(r.headers['retry-after'])).toSatisfy((n: number) => Number.isInteger(n) && n >= 1 && n <= 60);
  });

  it('REFRESH_RATE_LIMIT_PER_MINUTE=3 → lần đổi thẻ thứ 4 (không kèm thẻ) bị 429 sớm', async () => {
    const app = appWith({ AUTH_RATE_LIMIT_PER_MINUTE: '1000', REFRESH_RATE_LIMIT_PER_MINUTE: '3' });
    const res: request.Response[] = [];
    for (let i = 0; i < 5; i++) res.push(await request(app).post('/api/v1/auth/refresh').set('X-Client', 'web').send({}));
    expect(res.map((r) => r.status)).toEqual([401, 401, 401, 429, 429]);
    for (const r of res.slice(3)) expect(Number(r.headers['retry-after'])).toSatisfy((n: number) => Number.isInteger(n) && n >= 1 && n <= 60);
  });
});
