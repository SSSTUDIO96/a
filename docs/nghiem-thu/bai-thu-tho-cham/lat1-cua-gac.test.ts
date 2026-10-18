// THỢ CHẤM — cài kiểu lỗi MỚI vào bảng route rồi chạy ĐÚNG cửa gác của dự án (test/gate.ts + SAMPLES).
// Nếu cửa gác vẫn xanh hết trong khi lỗi khai thác được → cửa gác mù với kiểu lỗi đó.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { ALL_ROUTES, createApp } from '../src/app';
import { defineRoute, mustOrg, type AnyRoute } from '../src/http/route';
import { AppError } from '../src/lib/errors';
import { buildGateFixture, runIsolationGate, type GateFixture, type GateReport } from '../test/gate';
import { bearer, makeApp, makeDeps } from '../test/helpers';
import { SAMPLES } from '../test/tenant-isolation.test';

const deps = makeDeps();

// Đột biến A — "xem trước hợp đồng" tra khách CHỈ theo id lấy từ THÂN yêu cầu (quên lọc tổ chức).
const mutantQuote = defineRoute({
  method: 'post',
  path: '/orgs/:orgId/contracts/quote',
  scope: 'org',
  permission: 'contracts.read',
  tag: 't',
  summary: 'ĐỘT BIẾN',
  body: z.object({ customerId: z.uuid(), lines: z.array(z.unknown()).min(1) }),
  handler: async ({ deps: d, body, org }) => {
    mustOrg(org);
    const c = await d.db.customer.findFirst({ where: { id: body.customerId } }); // ← thiếu organizationId
    if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy khách hàng');
    return { body: { customer: { fullName: c.fullName, phone: c.phone }, total: 0 } };
  },
});

// Đột biến B — danh sách hợp đồng: khi có tham số lọc customerId thì quên điều kiện tổ chức.
const mutantList = defineRoute({
  method: 'get',
  path: '/orgs/:orgId/contracts',
  scope: 'org',
  permission: 'contracts.read',
  tag: 't',
  summary: 'ĐỘT BIẾN',
  query: z.object({ customerId: z.uuid().optional() }),
  handler: async ({ deps: d, query, org }) => {
    const o = mustOrg(org);
    const where = query.customerId ? { customerId: query.customerId } : { organizationId: o.id }; // ← lọc thì mất tổ chức
    const items = await d.db.contract.findMany({ where, select: { id: true, code: true, customer: { select: { fullName: true } } } });
    return { body: { items, page: 1, pageSize: 20, total: items.length } };
  },
});

function replace(routes: AnyRoute[], m: AnyRoute): AnyRoute[] {
  if (!routes.some((r) => r.method === m.method && r.path === m.path)) throw new Error(`Không có ${m.method} ${m.path}`);
  return routes.map((r) => (r.method === m.method && r.path === m.path ? m : r));
}
const MUTANT = replace(replace(ALL_ROUTES, mutantQuote), mutantList);

let app: ReturnType<typeof createApp>;
let fx: GateFixture;
let report: GateReport;

beforeAll(async () => {
  app = createApp(deps, MUTANT);
  fx = await buildGateFixture(makeApp(deps));
  report = await runIsolationGate(app, MUTANT, fx, SAMPLES);
  const total = Object.values(report).reduce((s, c) => s + c.violations.length, 0);
  console.log(`[thợ chấm] cửa gác trên bảng route có 2 đột biến mới: tổng vi phạm phát hiện = ${total}`);
}, 300_000);
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('cửa gác của dự án trên bảng route có lỗi ở THÂN yêu cầu / tham số lọc', () => {
  it('cửa gác vẫn XANH ở cả 7 phép kiểm', () => {
    for (const [name, c] of Object.entries(report)) expect(c.violations, name).toEqual([]);
  });

  it('…trong khi Đột biến A cho chủ B đọc tên + số điện thoại khách của A qua "xem trước hợp đồng"', async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${fx.b.orgId}/contracts/quote`)
      .set(bearer(fx.b.owner))
      .set('idempotency-key', randomUUID())
      .send({ customerId: fx.a.ids.customerId, lines: [{}] });
    expect(res.status).toBe(200);
    expect(res.body.customer.fullName).toBe('Khách a');
  });

  it('…và Đột biến B cho chủ B liệt kê hợp đồng của A bằng ?customerId=', async () => {
    const res = await request(app)
      .get(`/api/v1/orgs/${fx.b.orgId}/contracts`)
      .query({ customerId: fx.a.ids.customerId })
      .set(bearer(fx.b.owner));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: string }) => i.id)).toContain(fx.a.ids.contractId);
  });
});
