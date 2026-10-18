// CỬA GÁC: mọi đường API thuộc tổ chức phải cách ly tuyệt đối giữa các tổ chức.
// Danh sách đường lấy thẳng từ bảng route của app — thêm đường mới là tự vào diện kiểm tra.
// Bằng chứng cửa gác không mù: test/gate-mutants.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_ROUTES } from '../src/app';
import { buildGateFixture, printReport, runIsolationGate, type GateReport, type Samples } from './gate';
import { makeApp, makeDeps } from './helpers';

const deps = makeDeps();

// Thân yêu cầu hợp lệ cho các đường POST/PATCH có tham số id (khoá: "METHOD /đường").
export const SAMPLES: Samples = {
  'PATCH /orgs/:orgId/members/:membershipId': () => ({ status: 'SUSPENDED' }),
  'PATCH /orgs/:orgId/roles/:roleId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/service-categories/:categoryId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/makeup-subjects/:subjectId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/studio-locations/:locationId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/services/:serviceId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/packages/:packageId': () => ({ name: 'Đổi tên thử' }),
  'POST /orgs/:orgId/services/:serviceId/prices': () => ({ listPrice: 1000 }),
  'POST /orgs/:orgId/packages/:packageId/prices': () => ({ listPrice: 1000 }),
  'PATCH /orgs/:orgId/customers/:customerId': () => ({ fullName: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/appointments/:appointmentId': () => ({ notes: 'Sửa thử' }),
  'POST /orgs/:orgId/appointments/:appointmentId/status': () => ({ to: 'CANCELLED', reason: 'Thử cửa gác' }),
  'PATCH /orgs/:orgId/contracts/:contractId': () => ({ notes: 'Sửa thử' }),
  'POST /orgs/:orgId/contracts/:contractId/lines': () => ({
    kind: 'CUSTOM',
    name: 'Phát sinh thử',
    unitPrice: 1000,
    quantity: 1,
  }),
  'POST /orgs/:orgId/contracts/:contractId/lines/:lineId/void': () => ({ reason: 'Thử cửa gác' }),
  'POST /orgs/:orgId/contracts/:contractId/status': () => ({ to: 'CANCELLED', reason: 'Thử cửa gác' }),
};

let report: GateReport;

beforeAll(async () => {
  const app = makeApp(deps);
  const fx = await buildGateFixture(app);
  report = await runIsolationGate(app, ALL_ROUTES, fx, SAMPLES);
  printReport('', report);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('cửa gác cách ly tổ chức', () => {
  it('có đường thuộc tổ chức để kiểm (mẫu số khác 0)', () => {
    expect(report.outsider.total).toBeGreaterThan(0);
    expect(report.crossId.total).toBeGreaterThan(0);
  });
  for (const name of ['scope', 'outsider', 'noPerms', 'unauth', 'crossId', 'leak', 'keep'] as const) {
    it(`${name}: không có vi phạm`, () => {
      expect(report[name].violations).toEqual([]);
    });
  }
});
