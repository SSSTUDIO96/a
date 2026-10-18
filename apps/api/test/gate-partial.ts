// CỬA GÁC "SỬA MỘT PHẦN GIỮ NGUYÊN PHẦN CÒN LẠI" — mọi đường PATCH trong bảng route.
// Biên bản nghiệm thu máy chủ lát 2, lỗi S1: zod 4 ĐIỀN .default() cho trường vắng mặt kể cả trong .partial(),
// nên PATCH chỉ gửi giá gói đã đặt 9 thông số khác về mặc định. Bệnh này không thấy được nếu bài thử chỉ kiểm trường
// vừa gửi — phải kiểm MỌI trường KHÔNG gửi.
//
// Cách đo, với từng đường PATCH:
//   1. Gửi thân ĐẦY ĐỦ (mọi trường đặt giá trị KHÁC mặc định) → phản hồi R1.
//   2. Gửi thân CHỈ MỘT trường (giá trị khác R1) → phản hồi R2.
//   3. Mọi giá trị lá trong R1 (trừ trường vừa gửi và dấu thời gian sửa) phải y nguyên trong R2.
// Vế tĩnh: thân yêu cầu không được có trường nào bị zod điền khi vắng mặt (http/partial.ts) — vế này cũng chạy với
// route dựng thẳng không qua defineRoute (như các đột biến).
// Đường PATCH mới mà chưa có mẫu ở PARTIAL_SAMPLES → vi phạm "chưa có mẫu"; mẫu đầy đủ thiếu trường nào của thân
// (trừ trường khai rõ trong `skip` kèm lý do) → vi phạm "mẫu thiếu trường" — thêm trường mới là tự vào diện kiểm.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { z } from 'zod';
import type { AnyRoute } from '../src/http/route';
import { fieldsFilledWhenMissing } from '../src/http/partial';
import type { Db } from '../src/lib/prisma';
import { grantPlatformAdmin } from '../src/scripts/grant-platform-admin';
import { resolveBody, type GateCheck, type GateFixture, type GateOrg } from './gate';
import { bearer, registerUser, type App, type TestUser } from './helpers';

export interface PartialCtx {
  o: GateOrg;
  admin: TestUser;
  // Mã do cửa gác tự tạo thêm cho đường quản trị nền tảng.
  planId: string;
  platformOrgId: string;
}

export interface PartialSample {
  // Thân đầy đủ: mọi trường của thân yêu cầu, giá trị KHÁC mặc định khi tạo.
  full: (c: PartialCtx) => Record<string, unknown>;
  // Thân chỉ một trường (giá trị khác thân đầy đủ). Trường này (và chỉ nó) được phép đổi trong phản hồi.
  one: (c: PartialCtx) => Record<string, unknown>;
  // Trường của thân CỐ Ý không có trong mẫu đầy đủ, kèm lý do (vd. trường chỉ để báo lỗi).
  skip?: Record<string, string>;
  // Trường trong phản hồi được phép đổi theo trường vừa gửi (giá trị suy ra), kèm lý do.
  derived?: Record<string, string>;
  // Ai gọi: mặc định chủ tổ chức; 'admin' cho đường quản trị nền tảng.
  as?: 'owner' | 'admin';
  // Mã cho tham số đường dẫn mà fixture chưa có (module mới tự tạo bản ghi trong mẫu thì trả mã ở đây).
  ids?: (c: PartialCtx) => Record<string, string>;
  // Phản hồi bọc bản ghi (vd. PATCH khoá trả {course, classes}): chọn phần là bản ghi vừa sửa để so lá
  // (không chọn thì mọi lá nằm dưới khoá "course" và trường vừa gửi bị tính là "trường không gửi bị đổi").
  pick?: (body: unknown) => unknown;
}

export type PartialSamples = Record<string, PartialSample>;

export interface PartialReport {
  // Vế tĩnh: thân PATCH không có trường bị điền mặc định.
  partialStatic: GateCheck;
  // Vế chạy thật: sửa một trường, mọi trường khác giữ nguyên.
  partialKeep: GateCheck;
  covered: number;
  totalPatch: number;
}

const key = (r: AnyRoute) => `${r.method.toUpperCase()} ${r.path}`;

// Trường trong phản hồi không so: dấu thời gian sửa (đổi mỗi lần ghi) và nhật ký/lịch sử (dài thêm mỗi lần ghi).
const VOLATILE = new Set(['updatedAt', 'history', 'requestId', 'signedUrl', 'signedUrlExpiresAt', 'avatarUrl', 'url']);

function leaves(v: unknown, prefix: string, out: Map<string, string>) {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (VOLATILE.has(k)) continue;
      leaves(x, prefix ? `${prefix}.${k}` : k, out);
    }
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => leaves(x, `${prefix}[${i}]`, out));
    out.set(`${prefix}.length`, String(v.length));
    return;
  }
  out.set(prefix, JSON.stringify(v));
}

function topFields(route: AnyRoute): string[] {
  if (!route.body) return [];
  const js = z.toJSONSchema(route.body, { io: 'input', unrepresentable: 'any' }) as { properties?: Record<string, unknown> };
  return Object.keys(js.properties ?? {});
}

function fillPath(route: AnyRoute, ids: Record<string, string>): string {
  return `/api/v1${route.path.replace(/:([A-Za-z]+)/g, (_m, name: string) => {
    const v = ids[name];
    if (!v) throw new Error(`Cửa gác sửa một phần: chưa có giá trị cho :${name} của ${key(route)}`);
    return v;
  })}`;
}

function check(): GateCheck {
  return { passed: 0, total: 0, violations: [] };
}

function record(c: GateCheck, ok: boolean, what: string) {
  c.total++;
  if (ok) c.passed++;
  else c.violations.push(what);
}

// Thứ tự chạy: đường làm đổi trạng thái dùng chung (tạm khoá nhân sự, ẩn bậc, khoá tổ chức) chạy sau cùng.
// Danh mục và nhân vật ẩn đi (isActive=false) sau khi dịch vụ/gói đã dùng chúng.
// Lớp đóng (status CLOSED) và nhóm khoá ẩn chạy sau thẻ thiết kế / khoá học đang dùng chúng.
const LAST = [
  'PATCH /orgs/:orgId/course-groups/:groupId',
  'PATCH /orgs/:orgId/classes/:classId',
  'PATCH /orgs/:orgId/service-categories/:categoryId',
  'PATCH /orgs/:orgId/makeup-subjects/:subjectId',
  'PATCH /orgs/:orgId/staff-tiers/:tierId',
  'PATCH /orgs/:orgId/members/:membershipId',
  'PATCH /orgs/:orgId',
  'PATCH /platform/plans/:planId',
  'PATCH /platform/organizations/:organizationId',
];

export async function runPartialPatchGate(
  app: App,
  db: Db,
  routes: AnyRoute[],
  fx: GateFixture,
  samples: PartialSamples,
): Promise<PartialReport> {
  const report: PartialReport = { partialStatic: check(), partialKeep: check(), covered: 0, totalPatch: 0 };
  const patches = routes
    .filter((r) => r.method === 'patch')
    .sort((x, y) => LAST.indexOf(key(x)) - LAST.indexOf(key(y)));
  report.totalPatch = patches.length;

  // Quản trị nền tảng + một gói có MỌI thông số khác mặc định + một tổ chức riêng (khoá tổ chức không vạ lây A/B).
  const admin = await registerUser(app, 'gac-mot-phan-admin');
  await grantPlatformAdmin(db, admin.email);
  const plan = await request(app)
    .post('/api/v1/platform/plans')
    .set(bearer(admin))
    .send({ code: `mp_${randomUUID().slice(0, 8)}`, name: 'Gói cửa gác', priceMonthly: 99_000 });
  if (plan.status !== 201) throw new Error(`Cửa gác sửa một phần: tạo gói thất bại ${plan.status}: ${JSON.stringify(plan.body)}`);
  // Bậc riêng cho đường sửa bậc: bậc của fixture được gán cho thợ (mẫu sửa hồ sơ thợ) nên không ẩn được.
  const tier = await request(app)
    .post(`/api/v1/orgs/${fx.b.orgId}/staff-tiers`)
    .set(bearer(fx.b.owner))
    .set('idempotency-key', randomUUID())
    .send({ name: `Bậc một phần ${randomUUID().slice(0, 4)}` });
  if (tier.status !== 201) throw new Error(`Cửa gác sửa một phần: tạo bậc thất bại ${tier.status}: ${JSON.stringify(tier.body)}`);
  const ctx: PartialCtx = { o: fx.b, admin, planId: plan.body.id as string, platformOrgId: fx.b.orgId };
  const ids = { ...fx.b.ids, tierId: tier.body.id as string, planId: ctx.planId, organizationId: ctx.platformOrgId };

  for (const r of patches) {
    const k = key(r);
    const filled = fieldsFilledWhenMissing(r.body);
    record(report.partialStatic, filled.length === 0, `${k}: thân có trường bị điền mặc định khi vắng mặt: ${filled.join(', ')}`);

    const s = samples[k];
    if (!s) {
      record(report.partialKeep, false, `${k}: chưa có mẫu sửa một phần (PARTIAL_SAMPLES)`);
      continue;
    }
    const full = s.full(ctx);
    const one = s.one(ctx);
    const missing = topFields(r).filter((f) => !(f in full) && !(s.skip && f in s.skip));
    if (missing.length > 0) {
      record(report.partialKeep, false, `${k}: mẫu đầy đủ thiếu trường ${missing.join(', ')} (thêm vào mẫu hoặc khai skip kèm lý do)`);
      continue;
    }
    const who = s.as === 'admin' ? admin : fx.b.owner;
    const missingParam = [...r.path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1] ?? '').find((n) => !ids[n as keyof typeof ids] && !s.ids?.(ctx)[n]);
    if (missingParam) {
      record(report.partialKeep, false, `${k}: chưa có giá trị cho :${missingParam} (thêm vào buildGateFixture hoặc mẫu ids)`);
      continue;
    }
    const path = fillPath(r, { ...ids, ...(s.ids?.(ctx) ?? {}) });
    const r1 = await request(app).patch(path).set(bearer(who)).send((await resolveBody(app, fx, path, full)) as object);
    if (r1.status !== 200) {
      record(report.partialKeep, false, `${k}: thân đầy đủ → ${r1.status} ${JSON.stringify(r1.body).slice(0, 200)}`);
      continue;
    }
    const r2 = await request(app).patch(path).set(bearer(who)).send((await resolveBody(app, fx, path, one)) as object);
    if (r2.status !== 200) {
      record(report.partialKeep, false, `${k}: thân một trường → ${r2.status} ${JSON.stringify(r2.body).slice(0, 200)}`);
      continue;
    }
    report.covered++;
    const before = new Map<string, string>();
    const after = new Map<string, string>();
    leaves(s.pick ? s.pick(r1.body) : r1.body, '', before);
    leaves(s.pick ? s.pick(r2.body) : r2.body, '', after);
    const allowed = new Set([...Object.keys(one), ...Object.keys(s.derived ?? {})]);
    const changed: string[] = [];
    for (const [p, v] of before) {
      const top = p.split(/[.[]/)[0] ?? p;
      if (allowed.has(top)) continue;
      if (after.get(p) !== v) changed.push(`${p} ${v}→${after.get(p) ?? '(mất)'}`);
    }
    // Trường đã gửi phải thật sự đổi — mẫu "một trường" trùng giá trị đầy đủ thì phép này không đo được gì.
    const sentChanged = Object.keys(one).some((f) => [...before].some(([p, v]) => (p === f || p.startsWith(`${f}.`)) && after.get(p) !== v));
    record(
      report.partialKeep,
      changed.length === 0 && sentChanged,
      `${k}: gửi {${Object.keys(one).join(', ')}} → ${changed.length} trường KHÔNG gửi bị đổi${changed.length ? `: ${changed.slice(0, 8).join('; ')}` : ''}${sentChanged ? '' : '; trường đã gửi không đổi (mẫu không đo được)'}`,
    );
  }
  return report;
}

export function printPartialReport(label: string, r: PartialReport) {
  console.log(`[cửa gác sửa một phần${label}] partialStatic: ${r.partialStatic.passed}/${r.partialStatic.total}`);
  console.log(`[cửa gác sửa một phần${label}] partialKeep: ${r.partialKeep.passed}/${r.partialKeep.total}`);
  console.log(`[cửa gác sửa một phần${label}] đã phủ (chạy thật đủ hai bước): ${r.covered}/${r.totalPatch} đường PATCH`);
}
