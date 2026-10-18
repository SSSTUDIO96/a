// CỬA GÁC CÁCH LY TỔ CHỨC — hàm dùng chung cho bài thử thật và bài thử "cài lỗi" (gate-mutants.test.ts).
// Một cửa gác chưa từng chuyển đỏ trước lỗi thật thì chưa được tin.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { z } from 'zod';
import type { AnyRoute } from '../src/http/route';
import type { Db } from '../src/lib/prisma';
import { addMember, bearer, createAcademyOrg, grantUnlimitedPlan, makeDeps, registerUser, type App, type TestUser } from './helpers';
import { makePng } from './png';

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
  'scope' | 'outsider' | 'noPerms' | 'unauth' | 'crossId' | 'leak' | 'refBase' | 'crossRef' | 'keep' | 'platform',
  GateCheck
>;

// Thân/tham số HỢP LỆ dùng toàn mã của CHÍNH tổ chức `self` — mỗi đường có thể có nhiều mẫu (thân dạng hợp).
// Cửa gác thay lần lượt TỪNG trường mã bằng mã của tổ chức khác. (Biên bản nghiệm thu lát 1, lỗi T3.)
export type RefSamples = Record<string, ((self: GateOrg) => Record<string, unknown>)[]>;

// Mẫu tham chiếu chéo chạy trên MỘT BẢN GHI KHÁC trong đường dẫn (vd. :contractId trỏ hợp đồng KHOÁ HỌC thay vì hợp đồng
// dịch vụ mặc định của fixture) — cho trường chỉ hợp lệ với loại bản ghi đó (lines[].courseClassId, rulesTemplateId…).
// pathIds: tham số đường dẫn → mã trong CHÍNH tổ chức `self`. Trường đo ở biến thể được tính là đã có mẫu.
export type RefVariants = Record<
  string,
  { pathIds: (self: GateOrg) => Record<string, string>; samples: ((self: GateOrg) => Record<string, unknown>)[] }[]
>;

// Dấu "phiên bản hiện hành" trong thân mẫu: đường bắt buộc expectedUpdatedAt (PATCH hợp đồng — biên bản web 2, T2) nhận
// dấu này, cửa gác thay bằng updatedAt THẬT của bản ghi trong đường dẫn ngay trước khi gửi (đọc bằng chủ của tổ chức sở
// hữu bản ghi) — để phép "id chéo" chỉ còn bị chặn bởi điều kiện tổ chức, không phải bởi lệch phiên bản.
export const CURRENT_VERSION = '__PHIEN_BAN_HIEN_TAI__';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

export async function resolveBody(app: App, fx: GateFixture, url: string, body: unknown): Promise<unknown> {
  if (!body || typeof body !== 'object' || (body as { expectedUpdatedAt?: unknown }).expectedUpdatedAt !== CURRENT_VERSION) return body;
  const id = [...url.split('?')[0]!.matchAll(UUID_RE)].pop()?.[0];
  const owner = [fx.a, fx.b].find((o) => id && Object.values(o.ids).includes(id));
  let version = new Date(0).toISOString();
  if (owner) {
    const own = url.split('?')[0]!.replace(/\/orgs\/[^/]+\//, `/orgs/${owner.orgId}/`);
    const res = await request(app).get(own).set(bearer(owner.owner));
    const v = (res.body as { updatedAt?: string }).updatedAt;
    if (res.status !== 200 || !v) throw new Error(`Cửa gác: không đọc được phiên bản hiện hành ${own} → ${res.status}`);
    version = v;
  }
  return { ...(body as Record<string, unknown>), expectedUpdatedAt: version };
}

// Các đường dẫn trường "…Id"/"…Ids" trong thân và tham số truy vấn của một route (vd "lines[].addons[].serviceId").
export function refFieldPaths(route: AnyRoute): string[] {
  const out = new Set<string>();
  const walk = (node: unknown, prefix: string) => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.properties && typeof n.properties === 'object') {
      for (const [k, v] of Object.entries(n.properties as Record<string, unknown>)) {
        // Trường MẢNG mã (photoFileIds…) → đường "k[]": cửa gác thay từng phần tử bằng mã của tổ chức khác.
        const isArr = !!v && typeof v === 'object' && ((v as { type?: unknown }).type === 'array' || 'items' in (v as object));
        if (/Ids?$/.test(k)) out.add(isArr ? `${prefix}${k}[]` : `${prefix}${k}`);
        walk(v, `${prefix}${k}.`);
      }
    }
    if (n.items) walk(n.items, `${prefix.replace(/\.$/, '')}[].`);
    for (const k of ['anyOf', 'oneOf', 'allOf'] as const) {
      const arr = n[k];
      if (Array.isArray(arr)) for (const x of arr) walk(x, prefix);
    }
  };
  for (const schema of [route.body, route.query]) {
    if (schema) walk(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), '');
  }
  return [...out].sort();
}

// Đọc/ghi giá trị theo đường dẫn có "[]" (áp cho mọi phần tử mảng).
function pathValues(obj: unknown, segs: string[]): unknown[] {
  if (segs.length === 0) return [obj];
  if (!obj || typeof obj !== 'object') return [];
  const [head, ...rest] = segs as [string, ...string[]];
  const isArr = head.endsWith('[]');
  const v = (obj as Record<string, unknown>)[isArr ? head.slice(0, -2) : head];
  if (isArr) return Array.isArray(v) ? v.flatMap((x) => pathValues(x, rest)) : [];
  return pathValues(v, rest);
}

function setPath(obj: unknown, segs: string[], value: (old: unknown) => unknown): void {
  if (!obj || typeof obj !== 'object' || segs.length === 0) return;
  const [head, ...rest] = segs as [string, ...string[]];
  const isArr = head.endsWith('[]');
  const name = isArr ? head.slice(0, -2) : head;
  const rec = obj as Record<string, unknown>;
  if (rest.length === 0) {
    const cur = rec[name];
    rec[name] = isArr && Array.isArray(cur) ? cur.map((x) => value(x)) : value(cur);
    return;
  }
  const v = rec[name];
  if (isArr && Array.isArray(v)) v.forEach((x) => setPath(x, rest, value));
  else setPath(v, rest, value);
}

const splitPath = (p: string) => p.split('.').map((x) => x);

const key = (r: AnyRoute) => `${r.method.toUpperCase()} ${r.path}`;

async function postBody(app: App, owner: TestUser, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await request(app)
    .post(`/api/v1${path}`)
    .set(bearer(owner))
    .set('idempotency-key', randomUUID())
    .send(body as object);
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Cửa gác: tạo dữ liệu mẫu ${path} thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body as Record<string, unknown>;
}

async function post(app: App, owner: TestUser, path: string, body: unknown): Promise<string> {
  const res = { body: await postBody(app, owner, path, body) };
  const id = (res.body as { id?: string }).id;
  if (!id) throw new Error(`Cửa gác: ${path} không trả id`);
  return id;
}

// Tải một ảnh PNG thật (thân nhị phân, không phải JSON) — trả id tệp.
async function upload(app: App, owner: TestUser, orgId: string, purpose: string): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/files?purpose=${purpose}&name=mau.png`)
    .set(bearer(owner))
    .set('idempotency-key', randomUUID())
    .set('content-type', 'application/octet-stream')
    .send(makePng());
  const id = (res.body as { id?: string }).id;
  if (res.status !== 201 || !id) throw new Error(`Cửa gác: tải tệp ${purpose} thất bại ${res.status}: ${JSON.stringify(res.body)}`);
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
  const addonId = await post(app, owner, `${o}/services`, {
    code: `PH${label}`,
    name: `Dịch vụ phụ ${label}`,
    kind: 'ADDON',
    durationMinutes: 30,
    listPrice: 100000,
  });
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
  const firstLine = async (cid: string) => {
    const c = await request(app).get(`/api/v1${o}/contracts/${cid}`).set(bearer(owner)).expect(200);
    const id = (c.body as { lines: { id: string }[] }).lines[0]?.id;
    if (!id) throw new Error('Cửa gác: hợp đồng mẫu không có dòng');
    return id;
  };
  const lineId = await firstLine(contractId);
  // Hợp đồng nháp được thu tiền (quyết định của thợ G) — phiếu thu mẫu cho đường huỷ phiếu.
  const paymentId = await post(app, owner, `${o}/contracts/${contractId}/payments`, { method: 'CASH', amount: 10000 });
  const fileId = await upload(app, owner, orgId, 'ALBUM_IMAGE');
  const avatarFileId = await upload(app, owner, orgId, 'STAFF_AVATAR');
  const logoFileId = await upload(app, owner, orgId, 'ORG_LOGO');
  // KHÔNG tạo sẵn hồ sơ thương hiệu: phép "giữ" cần POST /profile/publish thân rỗng → 400 (chưa có hồ sơ).
  // Hợp đồng thứ hai dành riêng cho việc gắn lịch — hợp đồng có lịch gắn thì không thay được toàn bộ dòng.
  const contract2Id = await post(app, owner, `${o}/contracts`, {
    customerId,
    lines: [{ kind: 'CUSTOM', name: `Phụ phí 2 ${label}`, unitPrice: 100000, quantity: 1 }],
  });
  const line2Id = await firstLine(contract2Id);
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
      addonId,
      contract2Id,
      line2Id,
      paymentId,
      fileId,
      avatarFileId,
      logoFileId,
      // Ảnh bìa nhận ALBUM_IMAGE: dùng chung tệp album.
      coverFileId: fileId,
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
  refSamples: RefSamples = {},
): Promise<GateReport> {
  const report: GateReport = {
    scope: check(),
    outsider: check(),
    noPerms: check(),
    unauth: check(),
    crossId: check(),
    leak: check(),
    refBase: check(),
    crossRef: check(),
    keep: check(),
    platform: check(),
  };
  const orgRoutes = routes.filter((r) => r.scope === 'org');
  // Lọc theo ĐỊA CHỈ, không theo scope khai báo: đường /platform/ bị khai nhầm scope vẫn phải vào diện kiểm
  // (lọc theo scope thì chính đường khai nhầm tự rơi khỏi phép — đột biến 9 đã bắt được điểm mù này).
  const platformRoutes = routes.filter((r) => r.path.startsWith('/platform/'));
  // Đường quản trị nền tảng: mã tổ chức là của A, mã gói là mã bịa (fixture không tạo gói).
  const platformIds = { organizationId: fx.a.orgId, planId: randomUUID() };
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
  // So phản hồi của một đường thật với một đường bịa cùng phương thức dưới /platform/: phải GIỐNG HỆT (mã + thân trừ requestId).
  const sameAsFakePlatform = async (r: AnyRoute, headers: Record<string, string>) => {
    const fakeRoute = { ...r, path: `/platform/duong-bia-${randomUUID()}` } as AnyRoute;
    const res = await send(app, r, fill(r, platformIds), headers, {});
    const bia = await send(app, fakeRoute, `/api/v1${fakeRoute.path}`, headers, {});
    const norm = (x: request.Response) => JSON.stringify(x.body ?? '').replace(/"requestId":"[^"]+"/g, '');
    const same = res.status === bia.status && norm(res) === norm(bia);
    return { ok: res.status === 404 && same, status: res.status, same, biaStatus: bia.status };
  };
  // 4. Không đăng nhập → 401. RIÊNG đường /platform/ (chọn theo địa chỉ): 404 GIỐNG HỆT đường bịa — 401 ở đường thật
  //    mà 404 ở đường bịa là để người chưa đăng nhập dò ra đủ đường quản trị (biên bản máy chủ lát 2, lỗi M2).
  for (const r of routes.filter((x) => x.scope !== 'public' || x.path.startsWith('/platform/'))) {
    if (r.path.startsWith('/platform/')) {
      const c = await sameAsFakePlatform(r, {});
      record(report.unauth, c.ok, `${key(r)} (chưa đăng nhập) → ${c.status}${c.same ? '' : `, KHÁC đường bịa (${c.biaStatus})`}`);
      continue;
    }
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
  // 7. THAM CHIẾU CHÉO: mã của A nằm trong THÂN hoặc THAM SỐ LỌC của yêu cầu chủ B gửi vào B.
  //    Mẫu gốc (toàn mã của B) phải chạy được; thay TỪNG trường mã bằng mã của A → phải bị từ chối (4xx)
  //    với đường ghi, và KHÔNG lộ dữ liệu của A với mọi đường. Trường mã nào chưa có mẫu → vi phạm.
  //    Đường sửa hợp đồng chạy sau cùng vì nó thay toàn bộ dòng (đổi mã dòng mẫu).
  const refRoutes = orgRoutes
    .filter((r) => refFieldPaths(r).length > 0)
    .sort((x, y) => Number(key(x) === 'PATCH /orgs/:orgId/contracts/:contractId') - Number(key(y) === 'PATCH /orgs/:orgId/contracts/:contractId'));
  for (const r of refRoutes) {
    const bases = refSamples[key(r)] ?? [];
    const covered = new Set<string>();
    for (const make of bases) {
      const base = make(fx.b);
      const baseRes = await send(app, r, fill(r, fx.b.ids), bearer(fx.b.owner), base);
      record(report.refBase, baseRes.status >= 200 && baseRes.status < 300, `${key(r)} mẫu gốc → ${baseRes.status} ${JSON.stringify(baseRes.body).slice(0, 160)}`);
      for (const path of refFieldPaths(r)) {
        const segs = splitPath(path);
        const current = pathValues(base, segs).filter((v) => v !== undefined);
        if (current.length === 0 || current.some((v) => typeof v !== 'string')) continue;
        covered.add(path);
        // Thay mã của B ở trường này bằng (a) mã thật của A, (b) một mã bịa không tồn tại.
        // Đúng = hai phản hồi GIỐNG HỆT nhau (cùng mã trạng thái, cùng nội dung sau khi che mã vừa gửi):
        // khác nhau nghĩa là máy chủ để lộ "A có bản ghi này" hoặc trả dữ liệu của A.
        const swapTo = (pick: (k: string) => string) => {
          const body = structuredClone(base);
          setPath(body, segs, (old) => {
            if (old === undefined) return undefined;
            const k = Object.keys(fx.b.ids).find((x) => fx.b.ids[x] === old);
            if (!k) throw new Error(`Cửa gác: ${key(r)} trường ${path} dùng giá trị không phải mã mẫu của tổ chức`);
            return pick(k);
          });
          return body;
        };
        const fake = randomUUID();
        const real = await send(app, r, fill(r, fx.b.ids), bearer(fx.b.owner), swapTo((k) => fx.a.ids[k] ?? ''));
        const probe = await send(app, r, fill(r, fx.b.ids), bearer(fx.b.owner), swapTo(() => fake));
        const norm = (res: request.Response, sent: string[]) => {
          let t = JSON.stringify(res.body ?? '');
          for (const x of sent) t = t.split(x).join('<MÃ>');
          return t.replace(/"requestId":"[^"]+"/g, '');
        };
        const sentA = Object.values(fx.a.ids).filter((x) => JSON.stringify(swapTo((k) => fx.a.ids[k] ?? '')).includes(x));
        const same = real.status === probe.status && norm(real, sentA) === norm(probe, [fake]);
        const leaked = secretsOfA.filter((x) => !sentA.includes(x) && JSON.stringify(real.body ?? '').includes(x)).length;
        const statusOk = r.method === 'get' ? real.status === 200 || (real.status >= 400 && real.status < 500) : real.status >= 400 && real.status < 500;
        record(
          report.crossRef,
          statusOk && same && leaked === 0,
          `${key(r)} [${path}=mã của A] → ${real.status} (mã bịa → ${probe.status})${same ? '' : ', KHÁC phản hồi mã bịa'}, lộ ${leaked} giá trị khác của A`,
        );
      }
    }
    for (const path of refFieldPaths(r)) {
      if (!covered.has(path)) record(report.crossRef, false, `${key(r)}: trường ${path} chưa có mẫu tham chiếu chéo`);
    }
  }
  // 9. QUẢN TRỊ NỀN TẢNG: người không có tên trong platform_admins (chủ A, chủ B, thành viên A không quyền) — và cả
  //    người CHƯA đăng nhập, người cầm thẻ rác — gọi mọi đường /platform/ → 404 GIỐNG HỆT một đường bịa cùng phương thức
  //    (không lộ "đường này có thật").
  const callers: [string, Record<string, string>][] = [
    ['chủ A', bearer(fx.a.owner)],
    ['chủ B', bearer(fx.b.owner)],
    ['thành viên A không quyền', bearer(fx.a.noPerms)],
    ['chưa đăng nhập', {}],
    ['thẻ rác', { authorization: 'Bearer the-rac.khong.hop-le' }],
  ];
  for (const r of platformRoutes) {
    for (const [who, headers] of callers) {
      const c = await sameAsFakePlatform(r, headers);
      record(report.platform, c.ok, `${key(r)} (${who}) → ${c.status}${c.same ? '' : `, KHÁC đường bịa (${c.biaStatus})`}`);
    }
  }
  // 8. GIỮ: chủ A dùng thật phải được trả lời đúng nghĩa — xem: 200; gửi thân rỗng: 400 (lỗi dữ liệu,
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
