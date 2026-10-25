// Bản vẽ G mục 3.3 (đường 1–4), 3.4 "Mẫu in", 5.1 (gói G-M3) — máy chủ mẫu in của studio.
// - Tạo tổ chức thì có mẫu mặc định (INDIVIDUAL/TEAM: 1 dịch vụ bố cục 2; ACADEMY: thêm khoá học bố cục 1), cùng logic với
//   đoạn SEED của migration 20261019220000 (so từng cột trên hai tổ chức cùng loại).
// - Tạo, sửa, danh sách. version chỉ tăng khi đổi nội dung in; PATCH lặp lại không tăng.
// - Chuyển mặc định: mẫu cũ mất cờ trong cùng transaction. Ba ca 409 DEFAULT_REQUIRED. Lưới 23505 → 409 nói đúng loại.
// - Khoá học ở tổ chức không đào tạo → 400. Khối lạ / khối luôn có → 400. Biến lạ / sai loại → 400 đúng ô.
// - Quyền theo vai trò mẫu; mã của tổ chức khác → 404 giống mã bịa; nhật ký.
// - Đua: 10 lượt, hai PATCH cùng đặt mặc định dịch vụ cho hai mẫu — đếm riêng từng kết cục (sổ lỗi 18).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDefaultPrintTemplates } from '../src/modules/print/seed';
import { setDefaultFlags } from '../src/modules/print/templates';
import { AppError } from '../src/lib/errors';
import { addMember, bearer, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;
const MIGRATION = new URL('../prisma/migrations/20261019220000_mau_in_hop_dong/migration.sql', import.meta.url);

type Body = Record<string, unknown>;
type View = {
  id: string;
  name: string;
  layout: number;
  appliesTo: string[];
  defaultFor: string[];
  blocks: Record<string, boolean>;
  title: string | null;
  openingText: string | null;
  closingText: string | null;
  version: number;
  isActive: boolean;
  updatedBy: { id: string; fullName: string } | null;
  usage: { printedContracts: number; lastPrintedAt: string | null };
};

const base = (org: string) => `/api/v1/orgs/${org}/print-templates`;

async function newOrg(owner: TestUser, kind: 'INDIVIDUAL' | 'TEAM' | 'ACADEMY', label: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/orgs')
    .set(bearer(owner))
    .send({ name: `Tổ chức ${label}`, slug: `mi-${label}-${randomUUID().slice(0, 8)}`, kind });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
}

const list = (u: TestUser, org: string, q = '') => request(app).get(`${base(org)}${q}`).set(bearer(u));
const create = (u: TestUser, org: string, body: Body) =>
  request(app).post(base(org)).set(bearer(u)).set('idempotency-key', randomUUID()).send(body);
const patch = (u: TestUser, org: string, id: string, body: Body) => request(app).patch(`${base(org)}/${id}`).set(bearer(u)).send(body);

async function created(u: TestUser, org: string, body: Body): Promise<View> {
  const r = await create(u, org, body);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as View;
}

async function patched(u: TestUser, org: string, id: string, body: Body): Promise<View> {
  const r = await patch(u, org, id, body);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as View;
}

async function defaultsIn(org: string) {
  const [service, course] = await Promise.all([
    db.printTemplate.findMany({ where: { organizationId: org, defaultService: true }, select: { id: true } }),
    db.printTemplate.findMany({ where: { organizationId: org, defaultCourse: true }, select: { id: true } }),
  ]);
  return { service: service.map((x) => x.id), course: course.map((x) => x.id) };
}

const issueMessages = (body: unknown) => ((body as { error?: { details?: { issues?: { message: string }[] } } }).error?.details?.issues ?? []).map((i) => i.message);
const errOf = (body: unknown) => (body as { error: { code: string; message: string; details?: Record<string, unknown> } }).error;

let owner: TestUser;
let academy: string;
let team: string;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'mi-chu');
  academy = await newOrg(owner, 'ACADEMY', 'ac');
  team = await newOrg(owner, 'TEAM', 'te');
});

afterAll(async () => {
  await db.$disconnect();
});

// ======================================================================================================
describe('tạo tổ chức thì có mẫu in mặc định', () => {
  it('INDIVIDUAL và TEAM: đúng 1 mẫu (dịch vụ, bố cục 2, mặc định dịch vụ); ACADEMY: 2 mẫu (thêm khoá học bố cục 1)', async () => {
    const individual = await newOrg(owner, 'INDIVIDUAL', 'in');
    for (const org of [individual, team]) {
      const r = await list(owner, org, '?includeInactive=true');
      expect(r.status).toBe(200);
      const items = r.body.items as View[];
      expect(items.map((t) => [t.name, t.layout, t.appliesTo, t.defaultFor, t.version, t.blocks, t.title, t.updatedBy])).toEqual([
        ['Hiện đại', 2, ['SERVICE'], ['SERVICE'], 1, {}, null, null],
      ]);
      expect(await db.printTemplate.count({ where: { organizationId: org } })).toBe(1);
      // Không có mẫu khoá học ở tổ chức không đào tạo.
      expect((await list(owner, org, '?appliesTo=COURSE&includeInactive=true').expect(200)).body.items).toEqual([]);
    }
    const items = (await list(owner, academy).expect(200)).body.items as View[];
    expect(items.map((t) => [t.name, t.layout, t.appliesTo, t.defaultFor, t.version])).toEqual([
      ['Hiện đại', 2, ['SERVICE'], ['SERVICE'], 1],
      ['Cổ điển có quốc hiệu', 1, ['COURSE'], ['COURSE'], 1],
    ]);
    expect(await db.printTemplate.count({ where: { organizationId: academy } })).toBe(2);
  });

  it('seed.ts CÙNG logic đoạn SEED của migration: so từng cột trên hai tổ chức cùng loại (ACADEMY, INDIVIDUAL); chạy lại không nhân đôi', async () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const seed = sql.slice(sql.indexOf('-- SEED BEGIN') + '-- SEED BEGIN'.length, sql.indexOf('-- SEED END'));
    const statements = seed
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.replace(/--[^\n]*/g, '').trim() !== '');
    expect(statements.length).toBe(2);
    const cols = `name, layout, for_service, for_course, default_service, default_course, blocks::text AS blocks, title, opening_text,
                  closing_text, version, is_active, updated_by_id`;
    class Rollback extends Error {}
    const out: { kind: string; viaSeedTs: unknown[]; viaMigration: unknown[]; counts: number[] }[] = [];
    await db
      .$transaction(
        async (tx) => {
          for (const kind of ['ACADEMY', 'INDIVIDUAL'] as const) {
            // Tổ chức dựng thẳng (không qua POST /orgs) nên chưa có mẫu nào.
            const [a, b] = [randomUUID(), randomUUID()];
            for (const id of [a, b]) {
              await tx.organization.create({ data: { id, slug: `mi-seed-${randomUUID().slice(0, 8)}`, name: 'Tổ chức seed', kind } });
            }
            const counts = [await seedDefaultPrintTemplates(tx, a)];
            for (const s of statements) await tx.$executeRawUnsafe(s); // b (và mọi tổ chức chưa có mặc định) — trong transaction bỏ
            counts.push(await seedDefaultPrintTemplates(tx, a), await seedDefaultPrintTemplates(tx, b));
            const rows = (org: string) =>
              tx.$queryRawUnsafe<unknown[]>(`SELECT ${cols} FROM print_templates WHERE organization_id = '${org}'::uuid ORDER BY layout DESC`);
            out.push({ kind, viaSeedTs: await rows(a), viaMigration: await rows(b), counts });
          }
          throw new Rollback();
        },
        { timeout: 30_000 },
      )
      .catch((err) => {
        if (!(err instanceof Rollback)) throw err;
      });
    expect(out.map((o) => [o.kind, o.counts])).toEqual([
      ['ACADEMY', [2, 0, 0]],
      ['INDIVIDUAL', [1, 0, 0]],
    ]);
    for (const o of out) {
      expect(o.viaSeedTs.length).toBe(o.kind === 'ACADEMY' ? 2 : 1);
      expect(o.viaSeedTs, `${o.kind}: seed.ts khác đoạn SEED của migration`).toEqual(o.viaMigration);
    }
  });
});

// ======================================================================================================
describe('tạo, đọc, danh sách', () => {
  it('tạo mẫu: 201, version 1, blocks đúng như đã lưu (sắp khoá), chữ đã trim, người sửa; đọc một mẫu; danh sách mặc định đứng đầu rồi theo tên', async () => {
    const t = await created(owner, academy, {
      name: '  A — Mẫu gọn  ',
      layout: 4,
      appliesTo: ['SERVICE'],
      blocks: { tho: false, 'quoc-hieu': true },
      title: '  HỢP ĐỒNG GỌN  ',
      openingText: 'Kính gửi {Tên khách}',
    });
    expect([t.name, t.layout, t.appliesTo, t.defaultFor, t.version, t.isActive, t.title, t.closingText]).toEqual([
      'A — Mẫu gọn',
      4,
      ['SERVICE'],
      [],
      1,
      true,
      'HỢP ĐỒNG GỌN',
      null,
    ]);
    expect(Object.keys(t.blocks)).toEqual(['quoc-hieu', 'tho']);
    expect(t.updatedBy?.id).toBe(owner.id);
    expect(t.usage).toEqual({ printedContracts: 0, lastPrintedAt: null });
    const one = await request(app).get(`${base(academy)}/${t.id}`).set(bearer(owner)).expect(200);
    expect(one.body).toMatchObject({ id: t.id, name: 'A — Mẫu gọn', version: 1 });
    const svc = (await list(owner, academy, '?appliesTo=SERVICE').expect(200)).body.items as View[];
    expect(svc[0]!.defaultFor).toEqual(['SERVICE']);
    expect(svc.map((x) => x.name).slice(1)).toEqual([...svc.map((x) => x.name).slice(1)].sort());
    expect(svc.some((x) => x.id === t.id)).toBe(true);
    // Lọc khoá học: không có mẫu chỉ-dịch-vụ.
    const crs = (await list(owner, academy, '?appliesTo=COURSE').expect(200)).body.items as View[];
    expect(crs.some((x) => x.id === t.id)).toBe(false);
    expect(crs[0]!.defaultFor).toEqual(['COURSE']);
  });

  it('mẫu ngừng dùng: ẩn khỏi danh sách mặc định, hiện khi includeInactive=true', async () => {
    const t = await created(owner, academy, { name: 'Mẫu sẽ ngừng', layout: 3, appliesTo: ['SERVICE'] });
    await patched(owner, academy, t.id, { isActive: false });
    expect(((await list(owner, academy).expect(200)).body.items as View[]).some((x) => x.id === t.id)).toBe(false);
    expect(((await list(owner, academy, '?includeInactive=true').expect(200)).body.items as View[]).some((x) => x.id === t.id)).toBe(true);
  });
});

// ======================================================================================================
describe('phiên bản chỉ tăng khi đổi nội dung in', () => {
  it('đổi tên / appliesTo / isActive không tăng; đổi layout, blocks, title, openingText, closingText tăng đúng 1; gửi lại đúng giá trị cũ không tăng', async () => {
    const t = await created(owner, academy, { name: 'Mẫu bản', layout: 2, appliesTo: ['SERVICE'] });
    const steps: [Body, number][] = [
      [{ name: 'Mẫu bản đổi tên' }, 1],
      [{ appliesTo: ['SERVICE', 'COURSE'] }, 1],
      [{ isActive: false }, 1],
      [{ isActive: true }, 1],
      [{ layout: 3 }, 2],
      [{ layout: 3 }, 2], // lặp lại
      [{ blocks: { tho: false, 'ky-nhay': true } }, 3],
      [{ blocks: { 'ky-nhay': true, tho: false } }, 3], // cùng bảng, khác thứ tự khoá
      [{ title: 'TIÊU ĐỀ MỚI' }, 4],
      [{ title: '  TIÊU ĐỀ MỚI ' }, 4], // khác dấu cách hai đầu — đã trim
      [{ openingText: 'Mở {Tên khách}' }, 5],
      [{ closingText: 'Kết {Mã hợp đồng}' }, 6],
      [{ closingText: null }, 7],
      [{ closingText: null }, 7],
      [{ blocks: {} }, 8],
      [{ name: 'Mẫu bản', layout: 3, title: 'TIÊU ĐỀ MỚI' }, 8], // tên đổi, nội dung in giữ nguyên
    ];
    const seen: number[] = [];
    for (const [body] of steps) seen.push((await patched(owner, academy, t.id, body)).version);
    expect(seen).toEqual(steps.map(([, v]) => v));
    const row = await db.printTemplate.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.version).toBe(8);
  });

  it('nhật ký: print_template.created / .updated có before, after, versionBumped', async () => {
    const t = await created(owner, academy, { name: 'Mẫu nhật ký', layout: 2, appliesTo: ['SERVICE'] });
    await patched(owner, academy, t.id, { layout: 5 });
    await patched(owner, academy, t.id, { name: 'Mẫu nhật ký 2' });
    const logs = await db.auditLog.findMany({ where: { organizationId: academy, entityId: t.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => [l.action, (l.data as { versionBumped: boolean }).versionBumped, l.actorUserId])).toEqual([
      ['print_template.created', false, owner.id],
      ['print_template.updated', true, owner.id],
      ['print_template.updated', false, owner.id],
    ]);
    const d = logs[1]!.data as { before: { layout: number; version: number }; after: { layout: number; version: number } };
    expect([d.before.layout, d.before.version, d.after.layout, d.after.version]).toEqual([2, 1, 5, 2]);
  });
});

// ======================================================================================================
describe('mẫu mặc định', () => {
  it('chuyển mặc định: mẫu mới nhận cờ, mẫu cũ mất cờ, ghi id mẫu bị bỏ vào nhật ký; mỗi loại đúng 1 mặc định', async () => {
    const org = await newOrg(owner, 'ACADEMY', 'md');
    const before = await defaultsIn(org);
    expect([before.service.length, before.course.length]).toEqual([1, 1]);
    const t = await created(owner, org, { name: 'Mẫu cả hai', layout: 5, appliesTo: ['SERVICE', 'COURSE'], defaultFor: ['SERVICE'] });
    expect(t.defaultFor).toEqual(['SERVICE']);
    let now = await defaultsIn(org);
    expect(now).toEqual({ service: [t.id], course: before.course });
    const createdLog = await db.auditLog.findFirstOrThrow({ where: { organizationId: org, entityId: t.id, action: 'print_template.created' } });
    expect((createdLog.data as { unsetDefaultIds: string[] }).unsetDefaultIds).toEqual(before.service);

    const t2 = await patched(owner, org, t.id, { defaultFor: ['SERVICE', 'COURSE'] });
    expect(t2.defaultFor).toEqual(['SERVICE', 'COURSE']);
    expect(t2.version).toBe(1); // cờ mặc định không phải nội dung in
    now = await defaultsIn(org);
    expect(now).toEqual({ service: [t.id], course: [t.id] });
    const log = await db.auditLog.findFirstOrThrow({ where: { organizationId: org, entityId: t.id, action: 'print_template.updated' } });
    expect((log.data as { unsetDefaultIds: string[] }).unsetDefaultIds).toEqual(before.course);
    // Mẫu cũ thật sự mất cờ (đọc qua API).
    const old = await request(app).get(`${base(org)}/${before.service[0]}`).set(bearer(owner)).expect(200);
    expect(old.body.defaultFor).toEqual([]);
  });

  it('ba ca 409 DEFAULT_REQUIRED (bỏ defaultFor, ngừng dùng, bỏ loại khỏi appliesTo) — không đổi gì', async () => {
    const org = await newOrg(owner, 'ACADEMY', 'dr');
    const svc = (await defaultsIn(org)).service[0]!;
    await patched(owner, org, svc, { appliesTo: ['SERVICE', 'COURSE'] });
    const snapshot = await db.printTemplate.findUniqueOrThrow({ where: { id: svc } });
    for (const body of [{ defaultFor: [] }, { isActive: false }, { appliesTo: ['COURSE'] }, { defaultFor: ['COURSE'] }]) {
      const r = await patch(owner, org, svc, body);
      expect([r.status, errOf(r.body).details?.reason, errOf(r.body).message], JSON.stringify(body)).toEqual([
        409,
        'DEFAULT_REQUIRED',
        'Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác',
      ]);
    }
    expect(await db.printTemplate.findUniqueOrThrow({ where: { id: svc } })).toEqual(snapshot);
  });

  it('defaultFor ngoài appliesTo → 400; đặt mặc định cho mẫu ngừng dùng → 400; đặt mặc định + ngừng dùng cùng lúc → 400', async () => {
    const r1 = await create(owner, academy, { name: 'Sai mặc định', layout: 2, appliesTo: ['SERVICE'], defaultFor: ['COURSE'] });
    expect([r1.status, errOf(r1.body).details?.fields]).toEqual([400, ['defaultFor']]);
    const t = await created(owner, academy, { name: 'Ngừng rồi đặt', layout: 2, appliesTo: ['SERVICE'] });
    await patched(owner, academy, t.id, { isActive: false });
    const r2 = await patch(owner, academy, t.id, { defaultFor: ['SERVICE'] });
    expect([r2.status, errOf(r2.body).message]).toEqual([400, 'Mẫu đang ngừng dùng không đặt làm mặc định được — bật lại mẫu trước']);
    const r3 = await patch(owner, academy, t.id, { defaultFor: ['SERVICE'], isActive: false });
    expect([r3.status, errOf(r3.body).message]).toEqual([400, 'Mẫu mặc định phải đang dùng — không đặt mặc định và ngừng dùng cùng lúc']);
  });

  it('lưới cuối 23505: hai chỉ mục mặc định cùng khoá organization_id — đọc CONSTRAINT_NAME, ra 409 nói đúng "dịch vụ" / "khoá học"', async () => {
    const org = await newOrg(owner, 'ACADEMY', 'tr');
    const extra = await created(owner, org, { name: 'Mẫu thứ hai', layout: 3, appliesTo: ['SERVICE', 'COURSE'] });
    const outcome = async (kind: 'SERVICE' | 'COURSE') => {
      try {
        // Bỏ qua bước bỏ cờ cũ (giả một đường ghi quên khoá) → chỉ mục một phần chặn.
        await db.$transaction((tx) => setDefaultFlags(tx, org, extra.id, [kind]));
        return 'GHI ĐƯỢC';
      } catch (err) {
        return err instanceof AppError ? [err.status, err.message, err.details] : `lỗi khác: ${String(err)}`;
      }
    };
    expect(await outcome('SERVICE')).toEqual([
      409,
      'Hợp đồng dịch vụ vừa có mẫu in mặc định khác — tải lại danh sách mẫu rồi thử lại',
      { reason: 'DEFAULT_TAKEN', kind: 'SERVICE' },
    ]);
    expect(await outcome('COURSE')).toEqual([
      409,
      'Hợp đồng khoá học vừa có mẫu in mặc định khác — tải lại danh sách mẫu rồi thử lại',
      { reason: 'DEFAULT_TAKEN', kind: 'COURSE' },
    ]);
    expect((await defaultsIn(org)).service).not.toContain(extra.id);
  });
});

// ======================================================================================================
describe('kiểm dữ liệu gửi lên', () => {
  it('khoá học ở tổ chức không đào tạo → 400 (tạo và sửa)', async () => {
    const r1 = await create(owner, team, { name: 'Khoá học', layout: 1, appliesTo: ['COURSE'] });
    expect([r1.status, errOf(r1.body).message, errOf(r1.body).details?.fields]).toEqual([
      400,
      'Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ',
      ['appliesTo'],
    ]);
    const svc = (await defaultsIn(team)).service[0]!;
    const r2 = await patch(owner, team, svc, { appliesTo: ['SERVICE', 'COURSE'] });
    expect([r2.status, errOf(r2.body).message]).toEqual([400, 'Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ']);
    expect(await db.printTemplate.count({ where: { organizationId: team, forCourse: true } })).toBe(0);
  });

  it('khối lạ, khối luôn có, giá trị không phải true/false → 400', async () => {
    for (const blocks of [{ 'khoi-bia': true }, { 'tieu-de': false }, { 'chu-ky': true }, { tho: 'co' }, []]) {
      const r = await create(owner, academy, { name: 'Khối sai', layout: 2, appliesTo: ['SERVICE'], blocks });
      expect(r.status, JSON.stringify(blocks)).toBe(400);
      if (!Array.isArray(blocks) && typeof Object.values(blocks)[0] === 'boolean') {
        expect(issueMessages(r.body)).toContain('Không có khối này (hoặc khối luôn có, không tắt được)');
      }
    }
    const svc = (await defaultsIn(academy)).service[0]!;
    const r = await patch(owner, academy, svc, { blocks: { 'dich-vu': false } });
    expect([r.status, issueMessages(r.body)]).toEqual([400, ['Không có khối này (hoặc khối luôn có, không tắt được)']]);
  });

  it('biến lạ → 400 chỉ đúng ô, lời nói đúng biến; biến sai loại → 400 chỉ đúng ô', async () => {
    const r1 = await create(owner, academy, {
      name: 'Biến lạ',
      layout: 2,
      appliesTo: ['SERVICE'],
      title: 'HỢP ĐỒNG {Mã hợp đồng}',
      openingText: 'Kính gửi {Tên bịa} và {Tên khách}',
      closingText: 'Hết.',
    });
    expect([r1.status, errOf(r1.body).details?.fields]).toEqual([400, ['openingText']]);
    expect(errOf(r1.body).message).toMatch(/^Không có biến \{Tên bịa\}\. Biến dùng được: /);
    expect(errOf(r1.body).message).toContain('{Ngày sự kiện}'); // dịch vụ dùng được
    expect(errOf(r1.body).message).not.toContain('{Tên lớp}');
    const r2 = await create(owner, academy, { name: 'Biến sai loại', layout: 2, appliesTo: ['SERVICE', 'COURSE'], closingText: 'Lớp {Tên lớp}' });
    expect([r2.status, errOf(r2.body).details?.fields, errOf(r2.body).message]).toEqual([
      400,
      ['closingText'],
      'Biến {Tên lớp} chỉ dùng cho hợp đồng khoá học — mẫu này dùng cho cả hợp đồng dịch vụ',
    ]);
    // Đổi appliesTo làm chữ ĐANG LƯU thành sai loại → 400 đúng ô đó.
    const t = await created(owner, academy, { name: 'Chữ dịch vụ', layout: 2, appliesTo: ['SERVICE'], openingText: 'Ngày {Ngày sự kiện}' });
    const r3 = await patch(owner, academy, t.id, { appliesTo: ['SERVICE', 'COURSE'] });
    expect([r3.status, errOf(r3.body).details?.fields]).toEqual([400, ['openingText']]);
    expect(errOf(r3.body).message).toBe('Biến {Ngày sự kiện} chỉ dùng cho hợp đồng dịch vụ — mẫu này dùng cho cả hợp đồng khoá học');
    const r4 = await patch(owner, academy, t.id, { title: '{Lạ}' });
    expect([r4.status, errOf(r4.body).details?.fields]).toEqual([400, ['title']]);
    expect((await db.printTemplate.findUniqueOrThrow({ where: { id: t.id } })).version).toBe(1);
  });

  it('thân sai: tên trống, layout 0 / 6, appliesTo rỗng / trùng, PATCH rỗng, trường lạ → 400', async () => {
    for (const body of [
      { name: '   ', layout: 2, appliesTo: ['SERVICE'] },
      { name: 'X', layout: 0, appliesTo: ['SERVICE'] },
      { name: 'X', layout: 6, appliesTo: ['SERVICE'] },
      { name: 'X', layout: 2, appliesTo: [] },
      { name: 'X', layout: 2, appliesTo: ['SERVICE', 'SERVICE'] },
      { name: 'X', layout: 2, appliesTo: ['SERVICE'], version: 9 },
    ]) {
      expect((await create(owner, academy, body)).status, JSON.stringify(body)).toBe(400);
    }
    const svc = (await defaultsIn(academy)).service[0]!;
    expect((await patch(owner, academy, svc, {})).status).toBe(400);
    expect((await patch(owner, academy, svc, { version: 3 })).status).toBe(400);
  });
});

// ======================================================================================================
describe('quyền theo vai trò mẫu, cách ly tổ chức', () => {
  it('xem: vai trò có contracts.read; tạo/sửa: chỉ vai trò có contracts.texts (chủ, quản trị, quản lý)', async () => {
    const org = await newOrg(owner, 'ACADEMY', 'vt');
    const svc = (await defaultsIn(org)).service[0]!;
    const want: Record<string, { read: number; write: number }> = {
      admin: { read: 200, write: 201 },
      manager: { read: 200, write: 201 },
      receptionist: { read: 200, write: 403 },
      accountant: { read: 200, write: 403 },
      artist: { read: 403, write: 403 },
      assistant: { read: 403, write: 403 },
      instructor: { read: 403, write: 403 },
      teaching_assistant: { read: 403, write: 403 },
    };
    const got: Record<string, { read: number; write: number }> = {};
    for (const role of Object.keys(want)) {
      const u = await registerUser(app, `mi-${role}`);
      await addMember(app, owner, org, u, [role]);
      const read = (await list(u, org)).status;
      const write = (await create(u, org, { name: `Mẫu của ${role}`, layout: 2, appliesTo: ['SERVICE'] })).status;
      const p = (await patch(u, org, svc, { name: `Đổi bởi ${role}` })).status;
      got[role] = { read, write };
      expect(p, role).toBe(write === 201 ? 200 : 403);
    }
    expect(got).toEqual(want);
  });

  it('mã mẫu của tổ chức khác → 404 GIỐNG HỆT mã bịa (đọc và sửa), mẫu của tổ chức kia không đổi', async () => {
    const other = await registerUser(app, 'mi-khac');
    const otherOrg = await newOrg(other, 'ACADEMY', 'kh');
    const foreign = (await defaultsIn(otherOrg)).service[0]!;
    const before = await db.printTemplate.findUniqueOrThrow({ where: { id: foreign } });
    const norm = (b: unknown) => JSON.stringify(b).replace(/"requestId":"[^"]+"/, '');
    for (const send of [
      (id: string) => request(app).get(`${base(academy)}/${id}`).set(bearer(owner)),
      (id: string) => patch(owner, academy, id, { name: 'Chiếm' }),
      (id: string) => patch(owner, academy, id, { defaultFor: ['SERVICE'] }),
    ]) {
      const real = await send(foreign);
      const fake = await send(randomUUID());
      expect([real.status, errOf(real.body).message]).toEqual([404, 'Không tìm thấy mẫu in']);
      expect(norm(real.body)).toBe(norm(fake.body));
    }
    expect(await db.printTemplate.findUniqueOrThrow({ where: { id: foreign } })).toEqual(before);
    // Danh sách của tổ chức này không có mẫu nào của tổ chức kia.
    const items = (await list(owner, academy, '?includeInactive=true').expect(200)).body.items as View[];
    expect(items.some((t) => t.id === foreign)).toBe(false);
  });
});

// ======================================================================================================
describe('đua đặt mặc định (sổ lỗi 18)', () => {
  it('10 lượt: hai PATCH cùng lúc đặt mặc định dịch vụ cho hai mẫu — mỗi kết cục đếm riêng, lỗi khác = 0, sau mỗi lượt đúng 1 mặc định', async () => {
    const org = await newOrg(owner, 'ACADEMY', 'dua');
    const keeper = (await defaultsIn(org)).service[0]!;
    const a = await created(owner, org, { name: 'Đua A', layout: 3, appliesTo: ['SERVICE'] });
    const b = await created(owner, org, { name: 'Đua B', layout: 4, appliesTo: ['SERVICE', 'COURSE'] });
    const tally = { ok: 0, conflict409: 0, other: 0 };
    const others: string[] = [];
    const defaultsAfter: number[] = [];
    const winners = new Set<string>();
    for (let round = 0; round < 10; round++) {
      // Trả mặc định về mẫu thứ ba trước mỗi lượt — để CẢ HAI lệnh đều phải bỏ cờ của mẫu khác.
      await patched(owner, org, keeper, { defaultFor: ['SERVICE'] });
      const results = await Promise.all([a, b].map((t) => patch(owner, org, t.id, { defaultFor: ['SERVICE'] })));
      for (const r of results) {
        if (r.status === 200) tally.ok++;
        else if (r.status === 409) tally.conflict409++;
        else {
          tally.other++;
          others.push(`${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
        }
      }
      const d = await defaultsIn(org);
      defaultsAfter.push(d.service.length);
      if (d.service[0]) winners.add(d.service[0] === a.id ? 'A' : d.service[0] === b.id ? 'B' : 'khác');
    }
    console.log(`[đua mặc định mẫu in] ok=${tally.ok} 409=${tally.conflict409} khác=${tally.other} thắng=${[...winners].join(',')}`);
    expect(others).toEqual([]);
    expect(tally).toEqual({ ok: 20, conflict409: 0, other: 0 });
    expect(defaultsAfter).toEqual(Array(10).fill(1));
    expect(winners.has('khác')).toBe(false);
  });
});
