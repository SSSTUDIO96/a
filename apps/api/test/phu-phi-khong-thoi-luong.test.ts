// Phụ phí (SURCHARGE) được bỏ trống thời lượng (null = "không áp dụng"); dịch vụ chính/phụ (MAIN/ADDON) vẫn bắt buộc.
// Migration 20261018260000_phu_phi_khong_thoi_luong + catalog/services.ts.
// Vế BẮT: mọi đường làm MAIN/ADDON mất thời lượng bị chặn — máy chủ trả 400 chỉ đúng trường durationMinutes,
//         database chặn cả khi ghi thẳng (chốt services_duration_positive).
// Vế GIỮ: phụ phí tạo/sửa với thời lượng trống chạy được, đọc lại ra null (không thành 0), số phút cũ của phụ phí
//         vẫn nhận, hợp đồng có dòng phụ phí trống thời lượng vẫn lập được, trang công khai trả null.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { databaseError } from '../src/http/middleware';
import { DURATION_REQUIRED_MESSAGE } from '../src/modules/catalog/services';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let owner: TestUser;
let orgId: string;

type Body = Record<string, unknown>;
const url = (p: string) => `/api/v1/orgs/${orgId}${p}`;
const uniq = () => randomUUID().slice(0, 6).toUpperCase();
const idem = () => ({ 'idempotency-key': `k-${randomUUID()}` });

function postService(extra: Body) {
  return request(app)
    .post(url('/services'))
    .set(bearer(owner))
    .set(idem())
    .send({ code: `PP-${uniq()}`, name: `Dịch vụ ${uniq()}`, listPrice: 200_000, ...extra });
}

async function newService(extra: Body) {
  const r = await postService(extra);
  if (r.status !== 201) throw new Error(`Tạo dịch vụ thất bại ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body as { id: string; kind: string; durationMinutes: number | null };
}

function patchService(id: string, body: Body) {
  return request(app).patch(url(`/services/${id}`)).set(bearer(owner)).send(body);
}

async function stored(id: string) {
  return deps.db.service.findUniqueOrThrow({ where: { id }, select: { kind: true, durationMinutes: true, name: true } });
}

// 400 chỉ đúng trường durationMinutes: một lỗi duy nhất, đường dẫn đúng, lời nói rõ luật.
function expectDurationOnly(r: request.Response) {
  expect(r.status).toBe(400);
  expect(r.body.error.code).toBe('VALIDATION_FAILED');
  const issues = r.body.error.details?.issues as { path: string; message: string }[] | undefined;
  expect(issues?.map((i) => i.path)).toEqual(['durationMinutes']);
  expect(issues?.[0]?.message).toBe(DURATION_REQUIRED_MESSAGE);
  expect(Object.keys(r.body.error.details?.fieldErrors ?? {})).toEqual(['durationMinutes']);
}

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'phu-phi');
  orgId = await createOrg(app, owner, 'phu-phi');
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('vế BẮT — MAIN/ADDON không được mất thời lượng', () => {
  it('tạo MAIN (kind vắng mặt = MAIN) không gửi thời lượng → 400 chỉ đúng trường', async () => {
    expectDurationOnly(await postService({}));
  });

  it('tạo MAIN gửi thời lượng null → 400 chỉ đúng trường', async () => {
    expectDurationOnly(await postService({ kind: 'MAIN', durationMinutes: null }));
  });

  it('tạo ADDON không gửi thời lượng / gửi null → 400 chỉ đúng trường', async () => {
    expectDurationOnly(await postService({ kind: 'ADDON' }));
    expectDurationOnly(await postService({ kind: 'ADDON', durationMinutes: null }));
  });

  it('phụ phí gửi 0 hoặc 1441 phút → 400 (null là "không áp dụng", không phải 0)', async () => {
    for (const d of [0, 1441]) {
      const r = await postService({ kind: 'SURCHARGE', durationMinutes: d });
      expect(r.status).toBe(400);
      expect((r.body.error.details.issues as { path: string }[]).map((i) => i.path)).toEqual(['durationMinutes']);
    }
  });

  it('PATCH đổi phụ phí (thời lượng trống) sang MAIN/ADDON mà không gửi thời lượng → 400 chỉ đúng trường, không đổi gì', async () => {
    for (const kind of ['MAIN', 'ADDON']) {
      const s = await newService({ kind: 'SURCHARGE' });
      expectDurationOnly(await patchService(s.id, { kind }));
      expectDurationOnly(await patchService(s.id, { kind, name: 'Đổi tên kèm' }));
      expect(await stored(s.id)).toMatchObject({ kind: 'SURCHARGE', durationMinutes: null });
    }
  });

  it('PATCH đổi phụ phí sang MAIN kèm thời lượng null → 400 chỉ đúng trường', async () => {
    const s = await newService({ kind: 'SURCHARGE', durationMinutes: 30 });
    expectDurationOnly(await patchService(s.id, { kind: 'MAIN', durationMinutes: null }));
    expect(await stored(s.id)).toMatchObject({ kind: 'SURCHARGE', durationMinutes: 30 });
  });

  it('PATCH đặt thời lượng null cho MAIN/ADDON → 400 chỉ đúng trường, giữ số phút cũ', async () => {
    for (const kind of ['MAIN', 'ADDON']) {
      const s = await newService({ kind, durationMinutes: 60 });
      expectDurationOnly(await patchService(s.id, { durationMinutes: null }));
      expect(await stored(s.id)).toMatchObject({ kind, durationMinutes: 60 });
    }
  });

  it('database chặn MAIN/ADDON thời lượng NULL và số phút ngoài 1..1440 khi ghi thẳng (chốt services_duration_positive)', async () => {
    const tries: { kind: 'MAIN' | 'ADDON' | 'SURCHARGE'; durationMinutes: number | null }[] = [
      { kind: 'MAIN', durationMinutes: null },
      { kind: 'ADDON', durationMinutes: null },
      { kind: 'SURCHARGE', durationMinutes: 0 },
      { kind: 'SURCHARGE', durationMinutes: 1441 },
      { kind: 'MAIN', durationMinutes: 0 },
    ];
    let blocked = 0;
    for (const t of tries) {
      const err = await deps.db.service
        .create({ data: { organizationId: orgId, code: `DB-${uniq()}`, name: 'Ghi thẳng', ...t } })
        .then(() => null, (e: unknown) => e);
      if (err && databaseError(err)?.code === 'VALIDATION_FAILED') blocked++;
    }
    expect(blocked).toBe(tries.length);
    // Sửa thẳng một MAIN đang có số phút về NULL cũng bị chặn.
    const s = await newService({ kind: 'MAIN', durationMinutes: 45 });
    const err = await deps.db.service.update({ where: { id: s.id }, data: { durationMinutes: null } }).then(() => null, (e: unknown) => e);
    expect(err && databaseError(err)?.code).toBe('VALIDATION_FAILED');
    // Đổi thẳng loại phụ phí trống thời lượng sang MAIN cũng bị chặn.
    const sur = await newService({ kind: 'SURCHARGE' });
    const err2 = await deps.db.service.update({ where: { id: sur.id }, data: { kind: 'MAIN' } }).then(() => null, (e: unknown) => e);
    expect(err2 && databaseError(err2)?.code).toBe('VALIDATION_FAILED');
  });
});

describe('vế GIỮ — phụ phí bỏ trống thời lượng chạy được', () => {
  it('tạo phụ phí không gửi thời lượng → 201, null (không phải 0) ở phản hồi, khi xem, trong danh sách và trong database', async () => {
    const s = await newService({ kind: 'SURCHARGE', name: `Ngày lễ ${uniq()}` });
    expect(s.durationMinutes).toBeNull();
    const one = await request(app).get(url(`/services/${s.id}`)).set(bearer(owner)).expect(200);
    expect(one.body.durationMinutes).toBeNull();
    const list = await request(app).get(url('/services?kind=SURCHARGE&pageSize=100')).set(bearer(owner)).expect(200);
    const row = (list.body.items as { id: string; durationMinutes: number | null }[]).find((x) => x.id === s.id);
    expect(row).toBeDefined();
    expect(row?.durationMinutes).toBeNull();
    expect((await stored(s.id)).durationMinutes).toBeNull();
  });

  it('tạo phụ phí gửi null tường minh → 201 null; gửi số phút (kiểu phụ phí cũ) vẫn nhận', async () => {
    expect((await newService({ kind: 'SURCHARGE', durationMinutes: null })).durationMinutes).toBeNull();
    expect((await newService({ kind: 'SURCHARGE', durationMinutes: 1 })).durationMinutes).toBe(1);
  });

  it('tạo MAIN/ADDON có thời lượng vẫn như cũ', async () => {
    expect((await newService({ durationMinutes: 60 })).durationMinutes).toBe(60);
    expect((await newService({ kind: 'ADDON', durationMinutes: 30 })).durationMinutes).toBe(30);
  });

  it('PATCH phụ phí chỉ đổi tên → thời lượng trống giữ nguyên null', async () => {
    const s = await newService({ kind: 'SURCHARGE' });
    const r = await patchService(s.id, { name: 'Phụ phí đổi tên' }).expect(200);
    expect(r.body).toMatchObject({ kind: 'SURCHARGE', name: 'Phụ phí đổi tên', durationMinutes: null });
  });

  it('PATCH phụ phí cũ (mang số phút) đặt thời lượng null → 200 null', async () => {
    const s = await newService({ kind: 'SURCHARGE', durationMinutes: 1 });
    const r = await patchService(s.id, { durationMinutes: null }).expect(200);
    expect(r.body.durationMinutes).toBeNull();
    expect((await stored(s.id)).durationMinutes).toBeNull();
  });

  it('PATCH đổi phụ phí trống thời lượng sang MAIN kèm số phút → 200', async () => {
    const s = await newService({ kind: 'SURCHARGE' });
    const r = await patchService(s.id, { kind: 'MAIN', durationMinutes: 90 }).expect(200);
    expect(r.body).toMatchObject({ kind: 'MAIN', durationMinutes: 90 });
  });

  it('PATCH đổi phụ phí cũ (mang số phút) sang ADDON không gửi thời lượng → 200, giữ số phút đang lưu', async () => {
    const s = await newService({ kind: 'SURCHARGE', durationMinutes: 20 });
    const r = await patchService(s.id, { kind: 'ADDON' }).expect(200);
    expect(r.body).toMatchObject({ kind: 'ADDON', durationMinutes: 20 });
  });

  it('PATCH đổi MAIN sang phụ phí không gửi thời lượng → 200, máy chủ KHÔNG tự xoá số phút', async () => {
    const s = await newService({ durationMinutes: 60 });
    const r = await patchService(s.id, { kind: 'SURCHARGE' }).expect(200);
    expect(r.body).toMatchObject({ kind: 'SURCHARGE', durationMinutes: 60 });
  });

  it('đổi MAIN sang phụ phí và bỏ trống thời lượng cùng lúc → 200 null', async () => {
    const s = await newService({ durationMinutes: 60 });
    const r = await patchService(s.id, { kind: 'SURCHARGE', durationMinutes: null }).expect(200);
    expect(r.body).toMatchObject({ kind: 'SURCHARGE', durationMinutes: null });
  });

  it('hợp đồng có dòng phụ phí trống thời lượng vẫn lập được (hợp đồng không đọc thời lượng dịch vụ)', async () => {
    const s = await newService({ kind: 'SURCHARGE', name: 'Ca sớm trống thời lượng' });
    const c = await request(app).post(url('/customers')).set(bearer(owner)).set(idem()).send({ fullName: 'Khách phụ phí' }).expect(201);
    const r = await request(app)
      .post(url('/contracts'))
      .set(bearer(owner))
      .set(idem())
      .send({ customerId: c.body.id, lines: [{ kind: 'SURCHARGE', serviceId: s.id, quantity: 1 }] });
    expect(r.status).toBe(201);
    const line = (r.body.lines as { kind: string; serviceId: string; unitPrice: number }[]).find((l) => l.serviceId === s.id);
    expect(line).toMatchObject({ kind: 'SURCHARGE', unitPrice: 200_000 });
  });

  it('trang công khai: phụ phí trống thời lượng trả durationMinutes null (không thành 0)', async () => {
    const pub = await registerUser(app, 'phu-phi-cong-khai');
    const pubOrg = await createOrg(app, pub, 'phu-phi-cong-khai');
    const purl = (p: string) => `/api/v1/orgs/${pubOrg}${p}`;
    await request(app).put(purl('/profile')).set(bearer(pub)).send({ brandName: 'Phụ phí công khai' }).expect(200);
    await request(app).post(purl('/profile/publish')).set(bearer(pub)).set(idem()).expect(200);
    const sur = await request(app)
      .post(purl('/services'))
      .set(bearer(pub))
      .set(idem())
      .send({ code: `PP-${uniq()}`, name: 'Phụ phí ngày lễ', kind: 'SURCHARGE', isPublic: true, listPrice: 300_000 })
      .expect(201);
    const main = await request(app)
      .post(purl('/services'))
      .set(bearer(pub))
      .set(idem())
      .send({ code: `DV-${uniq()}`, name: 'Makeup tiệc', durationMinutes: 60, isPublic: true, listPrice: 500_000 })
      .expect(201);
    const slug = (await request(app).get(purl('')).set(bearer(pub)).expect(200)).body.slug as string;
    const site = await request(app).get(`/api/v1/public/sites/${slug}`).expect(200);
    const byId = new Map((site.body.services as { id: string; durationMinutes: number | null }[]).map((x) => [x.id, x]));
    expect(byId.get(sur.body.id)).toMatchObject({ durationMinutes: null });
    expect(byId.get(main.body.id)).toMatchObject({ durationMinutes: 60 });
  });

  it('migration không đổi dữ liệu cũ: không có UPDATE/DELETE/INSERT, chỉ nới NOT NULL và thay chốt', () => {
    const sql = readFileSync(new URL('../prisma/migrations/20261018260000_phu_phi_khong_thoi_luong/migration.sql', import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE)\b/i);
    expect(sql).toMatch(/ALTER COLUMN "duration_minutes" DROP NOT NULL/);
    expect(sql).toMatch(/"duration_minutes" IS NULL AND "kind" = 'SURCHARGE'/);
  });

  it('openapi: POST /services không bắt buộc durationMinutes và nhận null', async () => {
    const doc = await request(app).get('/api/v1/openapi.json');
    if (doc.status !== 200) throw new Error(`Không đọc được openapi: ${doc.status}`);
    const op = doc.body.paths?.['/api/v1/orgs/{orgId}/services']?.post ?? doc.body.paths?.['/orgs/{orgId}/services']?.post;
    const schema = op?.requestBody?.content?.['application/json']?.schema as { required?: string[]; properties?: Record<string, unknown> };
    expect(schema?.required ?? []).not.toContain('durationMinutes');
    expect(JSON.stringify(schema?.properties?.durationMinutes)).toMatch(/null/);
  });
});
