// CỬA GÁC: mọi đường API thuộc tổ chức phải cách ly tuyệt đối giữa các tổ chức.
// Danh sách đường lấy thẳng từ bảng route của app — thêm đường mới là tự vào diện kiểm tra.
// Bằng chứng cửa gác không mù: test/gate-mutants.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_ROUTES } from '../src/app';
import { isPortalPath } from '../src/http/route';
import { buildGateFixture, GATE_CHECKS, printReport, runIsolationGate, type GateReport } from './gate';
import { REF_SAMPLES, REF_VARIANTS, SAMPLES } from './gate-samples';
import { makeApp } from './helpers';
import { makePortalDeps } from './portal-helpers';

// Bộ đếm 'portal' nâng trần: cửa gác mở cổng / dò hàng chục lần trong một phút (mặc định 10/phút/IP).
const deps = makePortalDeps();

let report: GateReport;

beforeAll(async () => {
  const app = makeApp(deps);
  const fx = await buildGateFixture(app, deps.db);
  report = await runIsolationGate(app, ALL_ROUTES, fx, SAMPLES, REF_SAMPLES, REF_VARIANTS);
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
    expect(report.platform.total).toBeGreaterThan(0);
  });
  for (const name of GATE_CHECKS) {
    it(`${name}: không có vi phạm`, () => {
      expect(report[name].violations).toEqual([]);
    });
  }
});

// Bản vẽ E 2.8: ba lỗi của Studio Pro — mỗi lỗi có phép đo được (mẫu số khác 0) và đang xanh. Đột biến 18–22 trong
// gate-mutants.test.ts chứng minh các phép này chuyển đỏ khi tái phạm.
describe('cửa gác chống tái phạm lỗi Studio Pro (bản vẽ E 2.8)', () => {
  it('lỗi 1 — tra hợp đồng ở máy khách trên toàn bộ danh sách: portalScope + portalLeak (A1, A2 cùng lớp, T1 tổ chức khác)', () => {
    expect(report.portalScope.total).toBeGreaterThanOrEqual(5);
    expect(report.portalLeak.total).toBeGreaterThanOrEqual(3);
    expect([...report.portalScope.violations, ...report.portalLeak.violations]).toEqual([]);
  });
  it('lỗi 2 — hai lời báo khác nhau lộ đường dẫn / mã có thật: portalProbe (8 đầu vào hỏng mở bằng 4 số, 5 nhận bằng mã)', () => {
    expect(report.portalProbe.total).toBeGreaterThanOrEqual(15);
    expect(report.portalProbe.violations).toEqual([]);
  });
  it('lỗi 3 — thẻ vượt quyền qua query: portalScope (đường cổng không query) + portalWall cách cầm "thẻ qua query"', () => {
    // Mỗi đường nhân viên 3 cách cầm (cookie cổng, Bearer mpp_, thẻ qua query); mỗi đường cổng 5 cách (4 cách bản vẽ + query).
    const staff = ALL_ROUTES.filter((r) => !isPortalPath(r.path) && (r.scope !== 'public' || r.path.startsWith('/platform/'))).length;
    const portal = ALL_ROUTES.filter((r) => r.scope === 'portal').length;
    expect(portal).toBeGreaterThanOrEqual(3);
    expect(report.portalWall.total).toBe(staff * 3 + portal * 5);
    expect(report.portalWall.violations).toEqual([]);
  });
});
