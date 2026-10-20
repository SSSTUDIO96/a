// Dựng dữ liệu cho bài thử cổng học viên (gói E3): trung tâm ACADEMY, học viên có SĐT, lớp + hợp đồng khoá học đã xác
// nhận, đường dẫn tạo qua ĐƯỜNG THẬT của E4, mở bằng ĐƯỜNG THẬT của E3. Không phải bài thử (không có it/describe).
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Response } from 'supertest';
import { addMember, bearer, createAcademyOrg, grantUnlimitedPlan, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';
import type { Deps } from '../src/http/route';

export const PORTAL_HDR = { 'x-client': 'portal' } as const;

// Bộ đếm 'portal' mặc định 10/phút/IP — bài thử mở cổng hàng chục lần nên nâng trần (bài 429 riêng ở cong-hoc-vien-khung).
export function makePortalDeps(overrides: Record<string, string> = {}): Deps {
  return makeDeps({ PORTAL_RATE_LIMIT_PER_MINUTE: '100000', ...overrides });
}

export { makeApp };

export interface Academy {
  label: string;
  orgId: string;
  owner: TestUser;
  instructor: TestUser;
  instructorMembershipId: string;
  locationId: string;
  courseId: string;
  secret: string; // chuỗi bí mật riêng của tổ chức (đặt vào ghi chú nội bộ, lý do huỷ…) để quét rò rỉ
  instructorPhone: string; // StaffProfile.phone — học viên KHÔNG được thấy (bản vẽ E 1.3)
}

export const idem = () => randomUUID();
export const api = (a: { orgId: string }) => `/api/v1/orgs/${a.orgId}`;

export async function post(app: App, u: TestUser, url: string, body: unknown): Promise<Response> {
  return request(app).post(url).set(bearer(u)).set('idempotency-key', idem()).send(body as object);
}

function expectStatus(res: Response, status: number, what: string): void {
  if (res.status !== status) throw new Error(`${what}: mong ${status}, nhận ${res.status} ${JSON.stringify(res.body)}`);
}

export async function setupAcademy(app: App, deps: Deps, label: string): Promise<Academy> {
  const secret = `BI-MAT-${randomUUID()}`;
  const owner = await registerUser(app, `cong-chu-${label}`);
  const instructor = await registerUser(app, `cong-gv-${label}`);
  const orgId = await createAcademyOrg(app, owner, `cong-${label}`);
  await grantUnlimitedPlan(deps.db, orgId);
  const instructorMembershipId = await addMember(app, owner, orgId, instructor, ['instructor']);
  // SĐT giảng viên là thông tin nhân viên học viên KHÔNG được thấy (bản vẽ E 1.3).
  const instructorPhone = uniquePhone();
  await deps.db.staffProfile.upsert({
    where: { membershipId: instructorMembershipId },
    create: { membershipId: instructorMembershipId, organizationId: orgId, displayName: `Cô ${label.toUpperCase()}`, phone: instructorPhone },
    update: { displayName: `Cô ${label.toUpperCase()}`, phone: instructorPhone },
  });
  const a = { orgId };
  const loc = await post(app, owner, `${api(a)}/studio-locations`, { name: `Studio ${label}`, address: '12 Hàng Bài, Hà Nội' });
  expectStatus(loc, 201, 'tạo địa điểm');
  const course = await post(app, owner, `${api(a)}/courses`, {
    name: `Khoá ${label} ${randomUUID().slice(0, 4)}`,
    mode: 'MULTI_CLASS',
    tuitionFee: 5_000_000,
    depositAmount: 1_000_000,
    defaultCapacity: 20,
    sessionCount: 8,
  });
  expectStatus(course, 201, 'tạo khoá');
  return {
    label,
    orgId,
    owner,
    instructor,
    instructorMembershipId,
    locationId: loc.body.id,
    courseId: course.body.course.id,
    secret,
    instructorPhone,
  };
}

// Lớp: Thứ Hai + Thứ Tư 18:00–20:00, tháng 3/2027 (8 buổi khi đưa lên Lịch).
export async function makeClass(app: App, a: Academy, name = `Lớp ${a.label} ${randomUUID().slice(0, 6)}`) {
  const res = await post(app, a.owner, `${api(a)}/courses/${a.courseId}/classes`, {
    name,
    startDate: '2027-03-01',
    endDate: '2027-03-28',
    weekdays: [1, 3],
    startTime: '18:00',
    endTime: '20:00',
    instructorMembershipId: a.instructorMembershipId,
    studioLocationId: a.locationId,
  });
  expectStatus(res, 201, 'tạo lớp');
  return res.body as { id: string; name: string };
}

export interface Student {
  id: string;
  fullName: string;
  phone: string;
  last4: string;
}

let phoneSeq = 0;
// SĐT duy nhất trong lần chạy (4 số cuối khác nhau giữa các học viên).
export function uniquePhone(): string {
  phoneSeq += 1;
  const tail = String((Date.now() + phoneSeq * 7919) % 100_000_000).padStart(8, '0');
  return `09${tail}`;
}

export async function makeStudent(deps: Deps, a: Academy, fullName: string, extra: { note?: string; email?: string } = {}): Promise<Student> {
  const phone = uniquePhone();
  const c = await deps.db.customer.create({
    data: { organizationId: a.orgId, fullName, phone, note: extra.note ?? `${a.secret}-ghi-chu-khach`, email: extra.email ?? null },
  });
  return { id: c.id, fullName, phone, last4: phone.slice(-4) };
}

// Hợp đồng khoá học (1 dòng COURSE vào lớp) đã XÁC NHẬN → ghi danh ACTIVE.
export async function enroll(app: App, a: Academy, studentId: string, classId: string, extra: Record<string, unknown> = {}) {
  const created = await post(app, a.owner, `${api(a)}/contracts`, {
    kind: 'COURSE',
    customerId: studentId,
    lines: [{ kind: 'COURSE', courseClassId: classId }],
    notes: `${a.secret}-ghi-chu-hop-dong`,
    ...extra,
  });
  expectStatus(created, 201, 'tạo hợp đồng khoá học');
  const confirmed = await request(app).post(`${api(a)}/contracts/${created.body.id}/status`).set(bearer(a.owner)).send({ to: 'CONFIRMED' });
  expectStatus(confirmed, 200, 'xác nhận hợp đồng');
  return confirmed.body as { id: string; code: string; total: number; lines: { id: string; courseClassId: string | null }[] };
}

export async function receipt(app: App, a: Academy, contractId: string, amount: number, note = `${a.secret}-ghi-chu-phieu`) {
  const res = await post(app, a.owner, `${api(a)}/contracts/${contractId}/payments`, { method: 'BANK_TRANSFER', amount, note });
  expectStatus(res, 201, 'ghi phiếu thu');
  return res.body as { id: string; code: string };
}

// Ảnh thẻ đã xuất (tệp DESIGN_CARD READY) + thẻ. Ghi thẳng database: dựng dữ liệu, không phải đường đang thử.
export async function seedCard(
  deps: Deps,
  a: Academy,
  s: { customerId: string; contractId: string; courseClassId: string | null },
  kind: 'WELCOME' | 'FEEDBACK' | 'GREETING',
  opts: { fileStatus?: 'READY' | 'DELETED'; deleted?: boolean; portalVisible?: boolean } = {},
) {
  const file = await deps.db.storedFile.create({
    data: {
      organizationId: a.orgId,
      purpose: 'DESIGN_CARD',
      storageKey: `org/${a.orgId}/design-card/${randomUUID()}.png`,
      originalName: `${a.secret}-ten-tep.png`,
      mimeType: 'image/png',
      sizeBytes: 1000n,
      width: 1080,
      height: 1350,
      status: opts.fileStatus ?? 'READY',
      createdById: a.owner.id,
      ...(opts.fileStatus === 'DELETED' ? { deletedAt: new Date() } : {}),
    },
  });
  const card = await deps.db.designCard.create({
    data: {
      organizationId: a.orgId,
      kind,
      templateCode: 'shd-01',
      templateVersion: 1,
      contractId: s.contractId,
      customerId: s.customerId,
      courseClassId: s.courseClassId,
      title: `${a.secret}-tieu-de-the`,
      body: kind === 'WELCOME' ? null : `${a.secret}-noi-dung-the`,
      size: '1080x1350',
      snapshot: { secret: `${a.secret}-snapshot` },
      outputFileId: file.id,
      createdById: a.owner.id,
      ...(opts.deleted ? { deletedAt: new Date() } : {}),
      ...(opts.portalVisible === undefined ? {} : { portalVisible: opts.portalVisible }),
    },
  });
  return { cardId: card.id, fileId: file.id, storageKey: file.storageKey };
}

// ---------- Cổng ----------

// Tạo đường dẫn qua ĐƯỜNG THẬT của E4 (chủ trung tâm). Trả chìa bản rõ (chỉ có trong phản hồi này).
export async function createLink(app: App, a: Academy, customerId: string): Promise<string> {
  const res = await request(app)
    .post(`${api(a)}/customers/${customerId}/portal/links`)
    .set(bearer(a.owner))
    .send({ phoneConfirmed: true });
  expectStatus(res, 201, 'tạo đường dẫn cổng');
  return res.body.key as string;
}

export const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export function openPortal(app: App, key: string, last4: string, opts: { ua?: string; token?: string; headers?: Record<string, string> } = {}) {
  let r = request(app)
    .post('/api/v1/portal/session')
    .set(opts.headers ?? PORTAL_HDR)
    .set('user-agent', opts.ua ?? IPHONE_SAFARI);
  if (opts.token) r = r.set('cookie', `mp_portal=${opts.token}`);
  return r.send({ key, last4 });
}

export function claimPortal(app: App, code: string, opts: { token?: string; headers?: Record<string, string> } = {}) {
  let r = request(app).post('/api/v1/portal/session/claim').set(opts.headers ?? PORTAL_HDR);
  if (opts.token) r = r.set('cookie', `mp_portal=${opts.token}`);
  return r.send({ code });
}

// Thẻ phiên trong Set-Cookie mp_portal (null nếu không đặt).
export function portalTokenOf(res: Response): string | null {
  const raw = res.headers['set-cookie'] as unknown;
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  for (const c of list) {
    const m = /^mp_portal=([^;]*)/.exec(c);
    if (m && m[1]) return decodeURIComponent(m[1]);
  }
  return null;
}

export async function openOk(app: App, key: string, last4: string, opts: { ua?: string; token?: string } = {}): Promise<string> {
  const res = await openPortal(app, key, last4, opts);
  expectStatus(res, 201, 'mở cổng');
  const token = portalTokenOf(res);
  if (!token) throw new Error('mở cổng 201 mà không có cookie mp_portal');
  return token;
}

export function portalCall(app: App, method: 'get' | 'post' | 'delete', path: string, token: string) {
  return request(app)[method](`/api/v1/portal${path}`).set(PORTAL_HDR).set('cookie', `mp_portal=${token}`);
}

export const me = (app: App, token: string) => portalCall(app, 'get', '/me', token);

// Mọi chuỗi dạng UUID trong một giá trị JSON, BỎ QUA giá trị của trường tên kết thúc bằng Url/url (URL ký có thể chứa mã
// ngẫu nhiên của driver) — bản vẽ E 2.2 luật 2.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const UUID_ONE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export function uuidsIn(value: unknown, key = ''): string[] {
  if (/url$/i.test(key)) return [];
  if (typeof value === 'string') return value.match(UUID_RE) ?? [];
  if (Array.isArray(value)) return value.flatMap((v) => uuidsIn(v));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [...(UUID_ONE.test(k) ? [k] : []), ...uuidsIn(v, k)]);
  }
  return [];
}
