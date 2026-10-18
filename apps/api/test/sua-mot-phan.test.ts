// CỬA GÁC SỬA MỘT PHẦN: mọi đường PATCH trong bảng route — gửi một trường thì mọi trường khác giữ nguyên.
// Bằng chứng cửa gác không mù: đột biến 11, 12 trong test/gate-mutants.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_ROUTES } from '../src/app';
import { defineRoute } from '../src/http/route';
import { z } from 'zod';
import { buildGateFixture } from './gate';
import { printPartialReport, runPartialPatchGate, type PartialReport } from './gate-partial';
import { PARTIAL_SAMPLES } from './gate-samples';
import { makeApp, makeDeps } from './helpers';

const deps = makeDeps();
let report: PartialReport;

beforeAll(async () => {
  const app = makeApp(deps);
  const fx = await buildGateFixture(app);
  report = await runPartialPatchGate(app, deps.db, ALL_ROUTES, fx, PARTIAL_SAMPLES);
  printPartialReport('', report);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('cửa gác sửa một phần (PATCH)', () => {
  it('có đường PATCH để kiểm và MỌI đường PATCH đều chạy đủ hai bước (mẫu số = số đường PATCH trong bảng route)', () => {
    const patchCount = ALL_ROUTES.filter((r) => r.method === 'patch').length;
    expect(patchCount).toBeGreaterThan(0);
    expect(report.totalPatch).toBe(patchCount);
    expect(report.covered).toBe(patchCount);
  });
  it('partialStatic: không thân PATCH nào có trường bị điền mặc định khi vắng mặt', () => {
    expect(report.partialStatic.violations).toEqual([]);
  });
  it('partialKeep: gửi một trường → mọi trường không gửi giữ nguyên', () => {
    expect(report.partialKeep.violations).toEqual([]);
  });
  it('chốt khởi động: defineRoute từ chối đường PATCH có .default() (kể cả trong .partial() / object lồng)', () => {
    const make = (body: z.ZodType) => () =>
      defineRoute({ method: 'patch', path: '/thu-mot-phan', scope: 'auth', tag: 't', summary: 's', body, handler: async () => ({}) });
    expect(make(z.object({ a: z.number().default(1) }).partial())).toThrow(/giá trị mặc định ở a/);
    expect(make(z.object({ a: z.boolean().optional(), b: z.object({ c: z.number().catch(0) }).optional() }))).toThrow(/b\.c/);
    expect(make(z.object({ a: z.number().prefault(1) }).refine(() => true))).toThrow(/ở a/);
    // GIỮ: mảng là thay toàn bộ — phần tử được có mặc định; POST được có mặc định.
    expect(make(z.object({ items: z.array(z.object({ q: z.number().default(1) })).optional() }))).not.toThrow();
    expect(() =>
      defineRoute({ method: 'post', path: '/thu-tao', scope: 'auth', tag: 't', summary: 's', body: z.object({ a: z.number().default(1) }), handler: async () => ({}) }),
    ).not.toThrow();
  });
});
