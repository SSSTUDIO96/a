import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_ROUTES } from '../src/app';
import { makeApp, makeDeps } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('tài liệu OpenAPI', () => {
  // Đường quản trị nền tảng chọn theo ĐỊA CHỈ (sổ lỗi mục 15), không theo nhãn scope.
  const platformRoutes = ALL_ROUTES.filter((r) => r.path.startsWith('/platform/'));
  const publicDocRoutes = ALL_ROUTES.filter((r) => !r.path.startsWith('/platform/'));

  it('mọi đường API (trừ quản trị nền tảng) đều có trong tài liệu, kèm quyền yêu cầu', async () => {
    const res = await request(makeApp(deps)).get('/api/v1/openapi.json').expect(200);
    let found = 0;
    for (const r of publicDocRoutes) {
      const op = res.body.paths[`/api/v1${r.path.replace(/:([A-Za-z]+)/g, '{$1}')}`]?.[r.method];
      if (op && op['x-permission'] === (r.permission ?? null)) found++;
    }
    console.log(`[openapi] có trong tài liệu: ${found}/${publicDocRoutes.length} đường (không tính ${platformRoutes.length} đường quản trị nền tảng)`);
    expect(found).toBe(publicDocRoutes.length);
  });

  it('M2 — tài liệu công khai KHÔNG liệt kê đường quản trị nền tảng (không chuỗi "/platform" nào, không tóm tắt nào của chúng)', async () => {
    const res = await request(makeApp(deps)).get('/api/v1/openapi.json').expect(200);
    const text = JSON.stringify(res.body);
    const listed = Object.keys(res.body.paths).filter((p) => p.includes('/platform'));
    const summaries = platformRoutes.filter((r) => text.includes(JSON.stringify(r.summary)));
    console.log(`[openapi] đường quản trị trong tài liệu công khai: ${listed.length}/${platformRoutes.length}; tóm tắt lộ: ${summaries.length}`);
    expect(platformRoutes.length).toBeGreaterThan(0);
    expect(listed).toEqual([]);
    expect(summaries).toEqual([]);
    expect(text.includes('/platform')).toBe(false);
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
