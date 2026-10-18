import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_ROUTES } from '../src/app';
import { makeApp, makeDeps } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('tài liệu OpenAPI', () => {
  it('mọi đường API đều có trong tài liệu, kèm quyền yêu cầu', async () => {
    const res = await request(makeApp(deps)).get('/api/v1/openapi.json').expect(200);
    let found = 0;
    for (const r of ALL_ROUTES) {
      const op = res.body.paths[`/api/v1${r.path.replace(/:([A-Za-z]+)/g, '{$1}')}`]?.[r.method];
      if (op && op['x-permission'] === (r.permission ?? null)) found++;
    }
    console.log(`[openapi] có trong tài liệu: ${found}/${ALL_ROUTES.length} đường`);
    expect(found).toBe(ALL_ROUTES.length);
  });

  it('khoá chống gửi trùng: bắt buộc ở đường idempotent thường, tuỳ chọn ở tạo tổ chức', async () => {
    const res = await request(makeApp(deps)).get('/api/v1/openapi.json').expect(200);
    const header = (path: string, method: string) =>
      (res.body.paths[path]?.[method]?.parameters as { name: string; required: boolean }[] | undefined)?.find((p) => p.name === 'Idempotency-Key');
    const idem = ALL_ROUTES.filter((r) => r.idempotent);
    let ok = 0;
    for (const r of idem) {
      const h = header(`/api/v1${r.path.replace(/:([A-Za-z]+)/g, '{$1}')}`, r.method);
      if (h && h.required === (r.idempotent === true)) ok++;
    }
    console.log(`[openapi] khoá chống gửi trùng khai đúng: ${ok}/${idem.length} đường`);
    expect(idem.length).toBeGreaterThan(0);
    expect(ok).toBe(idem.length);
    expect(header('/api/v1/orgs', 'post')?.required).toBe(false);
  });
});
