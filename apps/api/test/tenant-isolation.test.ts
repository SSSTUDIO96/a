// CỬA GÁC: mọi đường API thuộc tổ chức phải cách ly tuyệt đối giữa các tổ chức.
// Danh sách đường lấy thẳng từ bảng route của app — thêm đường mới là tự vào diện kiểm tra.
// Bằng chứng cửa gác không mù: test/gate-mutants.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_ROUTES } from '../src/app';
import { buildGateFixture, printReport, runIsolationGate, type GateReport } from './gate';
import { REF_SAMPLES, SAMPLES } from './gate-samples';
import { makeApp, makeDeps } from './helpers';

const deps = makeDeps();

let report: GateReport;

beforeAll(async () => {
  const app = makeApp(deps);
  const fx = await buildGateFixture(app);
  report = await runIsolationGate(app, ALL_ROUTES, fx, SAMPLES, REF_SAMPLES);
  printReport('', report);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('cửa gác cách ly tổ chức', () => {
  it('có đường thuộc tổ chức để kiểm (mẫu số khác 0)', () => {
    expect(report.outsider.total).toBeGreaterThan(0);
    expect(report.crossId.total).toBeGreaterThan(0);
    expect(report.crossRef.total).toBeGreaterThan(0);
  });
  for (const name of ['scope', 'outsider', 'noPerms', 'unauth', 'crossId', 'leak', 'refBase', 'crossRef', 'keep'] as const) {
    it(`${name}: không có vi phạm`, () => {
      expect(report[name].violations).toEqual([]);
    });
  }
});
