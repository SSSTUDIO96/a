// Bản vẽ G mục 3.3 (đường 8), 3.4 "Thông tin trên hợp đồng", 5.1 (gói G-M3) — PUT /orgs/:orgId/profile/contract-info.
// - 409 PROFILE_REQUIRED khi chưa có hồ sơ (không tự tạo hồ sơ).
// - Ba trường ngân hàng đủ cả ba hoặc trống cả ba; có chức vụ thì phải có tên; chuẩn hoá số tài khoản.
// - PUT /profile sau đó GIỮ NGUYÊN 5 trường. Trang công khai KHÔNG có 5 trường này. Có ghi nhật ký.
// - Vai trò mẫu: chỉ vai trò có org.update (chủ, quản trị) ghi được; đọc đi theo GET /profile (org.read) như bản vẽ ghi.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from '@makeup/shared';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

type Body = Record<string, unknown>;
const url = (org: string, p: string) => `/api/v1/orgs/${org}${p}`;
const putInfo = (u: TestUser, org: string, body: Body) => request(app).put(url(org, '/profile/contract-info')).set(bearer(u)).send(body);
const putProfile = (u: TestUser, org: string, body: Body) => request(app).put(url(org, '/profile')).set(bearer(u)).send(body);
const errOf = (body: unknown) => (body as { error: { code: string; message: string; details?: Record<string, unknown> } }).error;
const issues = (body: unknown) =>
  ((errOf(body).details?.issues ?? []) as { path: string; message: string }[]).map((i) => `${i.path}: ${i.message}`);

const FIELDS = ['representativeName', 'representativeTitle', 'bankName', 'bankAccountNumber', 'bankAccountName'] as const;
const FULL = {
  representativeName: '  Nguyễn Thị Hoa  ',
  representativeTitle: 'Giám đốc',
  bankName: 'Vietcombank — CN Hà Nội',
  bankAccountNumber: ' 0123 4567 89 ab ',
  bankAccountName: 'NGUYEN THI HOA',
};
const SAVED = {
  representativeName: 'Nguyễn Thị Hoa',
  representativeTitle: 'Giám đốc',
  bankName: 'Vietcombank — CN Hà Nội',
  bankAccountNumber: '0123456789AB',
  bankAccountName: 'NGUYEN THI HOA',
};
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f, null]));

async function dbInfo(org: string) {
  return db.organizationProfile.findUnique({
    where: { organizationId: org },
    select: { representativeName: true, representativeTitle: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
  });
}

let owner: TestUser;
let org: string;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'tthd-chu');
  org = await createOrg(app, owner, 'tthd');
});

afterAll(async () => {
  await db.$disconnect();
});

describe('thông tin trên hợp đồng', () => {
  it('chưa có hồ sơ thương hiệu → 409 PROFILE_REQUIRED, không tự tạo hồ sơ', async () => {
    const r = await putInfo(owner, org, FULL);
    expect([r.status, errOf(r.body).details?.reason, errOf(r.body).message]).toEqual([
      409,
      'PROFILE_REQUIRED',
      'Chưa có hồ sơ thương hiệu — lưu hồ sơ ở Cài đặt › Hồ sơ thương hiệu trước',
    ]);
    expect(await db.organizationProfile.findUnique({ where: { organizationId: org } })).toBeNull();
  });

  it('có hồ sơ: ghi đủ 5 trường (chữ đã trim, số tài khoản bỏ khoảng trắng + viết hoa); trả giống GET /profile; ghi nhật ký before/after', async () => {
    await putProfile(owner, org, { brandName: 'Studio Hoa', address: 'Hà Nội' }).expect(200);
    const r = await putInfo(owner, org, FULL);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.hasProfile).toBe(true);
    for (const f of FIELDS) expect(r.body.profile[f], f).toBe(SAVED[f]);
    expect(await dbInfo(org)).toEqual(SAVED);
    const get = await request(app).get(url(org, '/profile')).set(bearer(owner)).expect(200);
    expect(get.body).toEqual(r.body);
    const log = await db.auditLog.findFirstOrThrow({
      where: { organizationId: org, action: 'profile.contract_info_updated' },
      orderBy: { createdAt: 'desc' },
    });
    expect([log.actorUserId, log.entityType, log.entityId]).toEqual([owner.id, 'organization_profile', org]);
    expect(log.data).toEqual({ before: EMPTY, after: SAVED });
  });

  it('PUT /profile sau đó GIỮ NGUYÊN 5 trường; PUT /profile gửi kèm 5 trường → 400 không nhận trường', async () => {
    await putProfile(owner, org, { brandName: 'Studio Hoa đổi tên', phone: '0912345678' }).expect(200);
    expect(await dbInfo(org)).toEqual(SAVED);
    const r = await putProfile(owner, org, { brandName: 'Studio Hoa', bankName: 'Chiếm' });
    expect(r.status).toBe(400);
    expect(await dbInfo(org)).toEqual(SAVED);
  });

  it('trang công khai KHÔNG có 5 trường (không khoá, không giá trị)', async () => {
    await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).expect(200);
    const slug = (await request(app).get(url(org, '')).set(bearer(owner)).expect(200)).body.slug as string;
    const site = await request(app).get(`/api/v1/public/sites/${slug}`).expect(200);
    const text = JSON.stringify(site.body);
    expect(site.body.profile.brandName).toBe('Studio Hoa đổi tên');
    for (const f of FIELDS) expect(text.includes(`"${f}"`), f).toBe(false);
    for (const v of Object.values(SAVED)) expect(text.includes(v), v).toBe(false);
  });

  it('ngân hàng thiếu một/hai trong ba → 400 đúng ô thiếu; có chức vụ thiếu tên → 400; database không đổi', async () => {
    const cases: [Body, string[]][] = [
      [{ ...SAVED, bankAccountNumber: null }, ['bankAccountNumber: Nhập đủ ngân hàng, số tài khoản, chủ tài khoản (hoặc để trống cả ba)']],
      [
        { ...SAVED, bankName: null, bankAccountName: null },
        [
          'bankName: Nhập đủ ngân hàng, số tài khoản, chủ tài khoản (hoặc để trống cả ba)',
          'bankAccountName: Nhập đủ ngân hàng, số tài khoản, chủ tài khoản (hoặc để trống cả ba)',
        ],
      ],
      [{ ...SAVED, representativeName: null }, ['representativeName: Có chức vụ thì phải có tên người đại diện']],
    ];
    for (const [body, want] of cases) {
      const r = await putInfo(owner, org, body);
      expect([r.status, issues(r.body)], JSON.stringify(body)).toEqual([400, want]);
    }
    expect(await dbInfo(org)).toEqual(SAVED);
  });

  it('số tài khoản sai dạng, thiếu khoá (PUT ghi toàn bộ), trường lạ, chuỗi trống → 400', async () => {
    for (const body of [
      { ...SAVED, bankAccountNumber: '0123-4567' },
      { ...SAVED, bankAccountNumber: '12 3' },
      { ...SAVED, bankAccountNumber: 'số tài khoản' },
      { representativeName: 'Chỉ tên' },
      { ...SAVED, taxCode: '0101' },
      { ...SAVED, representativeName: '   ' },
      { ...SAVED, bankName: 'A' },
    ]) {
      expect((await putInfo(owner, org, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(await dbInfo(org)).toEqual(SAVED);
  });

  it('để trống: chỉ người đại diện không chức vụ; tất cả null xoá hết', async () => {
    let r = await putInfo(owner, org, { ...EMPTY, representativeName: 'Lê Văn A' });
    expect(r.status).toBe(200);
    expect(await dbInfo(org)).toEqual({ ...EMPTY, representativeName: 'Lê Văn A' });
    r = await putInfo(owner, org, EMPTY);
    expect(r.status).toBe(200);
    expect(await dbInfo(org)).toEqual(EMPTY);
    await putInfo(owner, org, FULL).expect(200);
  });
});

describe('vai trò mẫu', () => {
  it('ghi: chỉ vai trò có org.update (chủ, quản trị); đọc qua GET /profile: mọi vai trò có org.read (bản vẽ 3.4 — trường đi theo hồ sơ)', async () => {
    const got: Record<string, { write: number; read: number; sees: boolean }> = {};
    const want: Record<string, { write: number; read: number; sees: boolean }> = {};
    for (const role of SYSTEM_ROLE_KEYS.filter((k) => k !== 'owner')) {
      const u = await registerUser(app, `tthd-${role}`);
      await addMember(app, owner, org, u, [role]);
      const perms = SYSTEM_ROLES[role].permissions as string[];
      want[role] = { write: perms.includes('org.update') ? 200 : 403, read: perms.includes('org.read') ? 200 : 403, sees: perms.includes('org.read') };
      const w = await putInfo(u, org, { ...SAVED, representativeTitle: `Chức vụ ${role}` });
      const g = await request(app).get(url(org, '/profile')).set(bearer(u));
      got[role] = { write: w.status, read: g.status, sees: g.status === 200 && g.body.profile?.bankAccountNumber === SAVED.bankAccountNumber };
    }
    expect(got).toEqual(want);
    // Đúng hai vai trò ghi được (bản vẽ: org.update) — đối chiếu với danh sách tay để quyền đổi ngầm thì đỏ.
    expect(Object.entries(got).filter(([, v]) => v.write === 200).map(([k]) => k)).toEqual(['admin']);
    expect((await dbInfo(org))?.representativeTitle).toBe('Chức vụ admin');
  });

  it('chủ tổ chức khác gọi vào tổ chức này → 404, không đổi gì', async () => {
    const other = await registerUser(app, 'tthd-khac');
    await createOrg(app, other, `tthd-khac-${randomUUID().slice(0, 4)}`);
    const before = await dbInfo(org);
    const r = await putInfo(other, org, EMPTY);
    expect(r.status).toBe(404);
    expect(await dbInfo(org)).toEqual(before);
  });
});
