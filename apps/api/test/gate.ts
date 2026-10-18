// CỬA GÁC CÁCH LY TỔ CHỨC — hàm dùng chung cho bài thử thật và bài thử "cài lỗi" (gate-mutants.test.ts).
// Một cửa gác chưa từng chuyển đỏ trước lỗi thật thì chưa được tin.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { AnyRoute } from '../src/http/route';
import { addMember, bearer, createOrg, registerUser, type App, type TestUser } from './helpers';

export interface GateOrg {
  orgId: string;
  owner: TestUser;
  noPerms: TestUser;
  // Giá trị cho mọi tham số đường dẫn (:orgId, :membershipId, :roleId…) thuộc CHÍNH tổ chức này.
  ids: Record<string, string>;
}

export interface GateFixture {
  a: GateOrg;
  b: GateOrg;
}

// Thân yêu cầu HỢP LỆ cho các đường sửa/tạo có tham số id — để phép thử "dùng id của tổ chức khác"
// không bị chặn sớm vì dữ liệu sai (400) mà phải đi tới đúng câu tra cứu.
// Với đường GET: giá trị là tham số truy vấn bắt buộc (ví dụ khoảng ngày from/to của lịch).
export type Samples = Record<string, (o: GateOrg) => unknown>;

export interface GateCheck {
  passed: number;
  total: number;
  violations: string[];
}

export type GateReport = Record<
  'scope' | 'outsider' | 'noPerms' | 'unauth' | 'crossId' | 'leak' | 'keep',
  GateCheck
>;

const key = (r: AnyRoute) => `${r.method.toUpperCase()} ${r.path}`;

async function post(app: App, owner: TestUser, path: string, body: unknown): Promise<string> {
  const res = await request(app)
    .post(`/api/v1${path}`)
    .set(bearer(owner))
    .set('idempotency-key', randomUUID())
    .send(body as object);
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Cửa gác: tạo dữ liệu mẫu ${path} thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  }
  const id = (res.body as { id?: string }).id;
  if (!id) throw new Error(`Cửa gác: ${path} không trả id`);
  return id;
}

// Mỗi tổ chức thử có đủ MỌI loại tài nguyên mà đường API nhận làm tham số — thêm module mới thì thêm ở đây.
async function setupOrg(app: App, label: string): Promise<GateOrg> {
  const owner = await registerUser(app, `gac-chu-${label}`);
  const noPerms = await registerUser(app, `gac-rong-${label}`);
  const orgId = await createOrg(app, owner, `gac-${label}`);
  const o = `/orgs/${orgId}`;
  const roleId = await post(app, owner, `${o}/roles`, { key: 'rong', name: 'Rỗng', permissions: [] });
  const membershipId = await addMember(app, owner, orgId, noPerms, ['rong']);
  const categoryId = await post(app, owner, `${o}/service-categories`, { name: `Nhóm ${label}` });
  const subjectId = await post(app, owner, `${o}/makeup-subjects`, { name: `Nhân vật ${label}` });
  const locationId = await post(app, owner, `${o}/studio-locations`, { name: `Studio ${label}`, address: 'Hà Nội' });
  const serviceId = await post(app, owner, `${o}/services`, {
    code: `DV${label}`,
    name: `Dịch vụ ${label}`,
    durationMinutes: 60,
    listPrice: 500000,
  });
  const packageId = await post(app, owner, `${o}/packages`, {
    code: `GOI${label}`,
    name: `Gói ${label}`,
    durationMinutes: 120,
    listPrice: 1500000,
  });
  const tierId = await post(app, owner, `${o}/staff-tiers`, { name: `Bậc ${label}` });
  const customerId = await post(app, owner, `${o}/customers`, { fullName: `Khách ${label}` });
  const appointmentId = await post(app, owner, `${o}/appointments`, {
    customerId,
    startsAt: '2026-12-01T01:00:00.000Z',
    endsAt: '2026-12-01T02:00:00.000Z',
    status: 'DRAFT',
    staff: [],
  });
  const contractId = await post(app, owner, `${o}/contracts`, {
    customerId,
    lines: [{ kind: 'CUSTOM', name: `Phụ phí ${label}`, unitPrice: 100000, quantity: 1 }],
  });
  const contract = await request(app).get(`/api/v1${o}/contracts/${contractId}`).set(bearer(owner)).expect(200);
  const lineId = (contract.body as { lines: { id: string }[] }).lines[0]?.id;
  if (!lineId) throw new Error('Cửa gác: hợp đồng mẫu không có dòng');
  return {
    orgId,
    owner,
    noPerms,
    ids: {
      orgId,
      membershipId,
      roleId,
      categoryId,
      subjectId,
      locationId,
      serviceId,
      packageId,
      customerId,
      appointmentId,
      contractId,
      lineId,
      tierId,
    },
  };
}

export async function buildGateFixture(app: App): Promise<GateFixture> {
  return { a: await setupOrg(app, 'a'), b: await setupOrg(app, 'b') };
}

function fill(route: AnyRoute, ids: Record<string, string>): string {
  return `/api/v1${route.path.replace(/:([A-Za-z]+)/g, (_m, name: string) => {
    const v = ids[name];
    if (!v) throw new Error(`Cửa gác chưa có giá trị cho :${name} của ${key(route)} — bổ sung vào buildGateFixture`);
    return v;
  })}`;
}

function send(app: App, route: AnyRoute, path: string, headers: Record<string, string>, body: unknown) {
  const req = request(app)[route.method](path);
  for (const [k, v] of Object.entries(headers)) req.set(k, v);
  // Luôn kèm khoá chống gửi trùng mới: đường bắt buộc khoá không bị chặn sớm ở 400 thay vì tới câu tra cứu.
  if (route.method !== 'get') req.set('idempotency-key', randomUUID());
  if (route.method === 'get') return body ? req.query(body as Record<string, string>) : req;
  return route.method === 'delete' ? req : req.send(body as object);
}

function check(): GateCheck {
  return { passed: 0, total: 0, violations: [] };
}

function record(c: GateCheck, ok: boolean, what: string) {
  c.total++;
  if (ok) c.passed++;
  else c.violations.push(what);
}

export async function runIsolationGate(
  app: App,
  routes: AnyRoute[],
  fx: GateFixture,
  samples: Samples,
): Promise<GateReport> {
  const report: GateReport = {
    scope: check(),
    outsider: check(),
    noPerms: check(),
    unauth: check(),
    crossId: check(),
    leak: check(),
    keep: check(),
  };
  const orgRoutes = routes.filter((r) => r.scope === 'org');
  const authed = routes.filter((r) => r.scope !== 'public');
  const idRoutes = orgRoutes.filter((r) => /:(?!orgId\b)[A-Za-z]+/.test(r.path));
  const secretsOfA = [fx.a.orgId, ...Object.values(fx.a.ids), fx.a.owner.email, fx.a.noPerms.email];

  // 1. Mọi đường có :orgId phải khai scope "org".
  for (const r of routes) {
    if (r.path.includes(':orgId')) record(report.scope, r.scope === 'org', `${key(r)} có :orgId nhưng scope=${r.scope}`);
  }
  // 2. Người của B gọi vào đường dẫn của A → 404 (không lộ A có tồn tại).
  for (const r of orgRoutes) {
    const res = await send(app, r, fill(r, fx.a.ids), bearer(fx.b.owner), {});
    record(report.outsider, res.status === 404, `${key(r)} → ${res.status}`);
  }
  // 3. Thành viên A không có quyền → 403.
  for (const r of orgRoutes) {
    const res = await send(app, r, fill(r, fx.a.ids), bearer(fx.a.noPerms), {});
    record(report.noPerms, res.status === 403, `${key(r)} → ${res.status}`);
  }
  // 4. Không đăng nhập → 401.
  for (const r of authed) {
    const ids = r.scope === 'org' ? fx.a.ids : {};
    const res = await send(app, r, fill(r, ids), {}, {});
    record(report.unauth, res.status === 401, `${key(r)} → ${res.status}`);
  }
  // 5. Chủ B, trên đường dẫn của CHÍNH B, nhưng nhét id tài nguyên của A → 404, dữ liệu A không đổi.
  for (const r of idRoutes) {
    const sample = samples[key(r)];
    if (r.method !== 'get' && r.method !== 'delete' && !sample) {
      record(report.crossId, false, `${key(r)}: thiếu thân yêu cầu mẫu trong Samples`);
      continue;
    }
    const ids = { ...fx.a.ids, orgId: fx.b.orgId };
    const res = await send(app, r, fill(r, ids), bearer(fx.b.owner), sample ? sample(fx.b) : {});
    record(report.crossId, res.status === 404, `${key(r)} với id của A → ${res.status}`);
  }
  // 6. Mọi đường xem của B (đúng id của B) không được chứa dữ liệu nào của A.
  for (const r of orgRoutes.filter((x) => x.method === 'get')) {
    const res = await send(app, r, fill(r, fx.b.ids), bearer(fx.b.owner), samples[key(r)]?.(fx.b));
    const text = JSON.stringify(res.body ?? '');
    const leaked = secretsOfA.filter((s) => text.includes(s));
    record(report.leak, leaked.length === 0, `${key(r)} lộ ${leaked.length} giá trị của A`);
  }
  // 7. GIỮ: chủ A dùng thật phải được trả lời đúng nghĩa — xem: 200; gửi thân rỗng: 400 (lỗi dữ liệu,
  //    không phải 404/409/500); xoá: 2xx. Phép này chạy cuối vì có thể xoá thật.
  for (const r of orgRoutes) {
    const body = r.method === 'get' ? samples[key(r)]?.(fx.a) : {};
    const res = await send(app, r, fill(r, fx.a.ids), bearer(fx.a.owner), body);
    const want = r.method === 'get' ? [200] : r.method === 'delete' ? [200, 204] : [400];
    record(report.keep, want.includes(res.status), `${key(r)} → ${res.status} (cần ${want.join('/')})`);
  }
  return report;
}

export function printReport(label: string, report: GateReport) {
  for (const [name, c] of Object.entries(report)) {
    console.log(`[cửa gác${label}] ${name}: ${c.passed}/${c.total}`);
  }
}
