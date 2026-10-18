import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as catalog from './catalog';
import { setAccessToken } from './client';
import * as contracts from './contracts';
import * as schedule from './schedule';
import * as staff from './staff';
import type { ContractBody } from './types';

// Kiểm từng hàm gọi đúng đường, phương thức, thân, query và header (Idempotency-Key chỉ ở POST tạo dữ liệu).

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let seen: Seen[] = [];

beforeEach(() => {
  seen = [];
  setAccessToken('tok');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: { ...(init?.headers as Record<string, string>) },
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

const ORG = 'org-1';
const P = '/api/v1/orgs/org-1';
const KEY = 'khoa-bam-nut-0001';

interface Case {
  name: string;
  call: () => Promise<unknown>;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT';
  url: string;
  body?: unknown;
  idem?: boolean;
}

const contractBody: ContractBody = {
  newCustomer: { fullName: 'Lan', phone: '0912345678' },
  lines: [{ kind: 'CUSTOM', name: 'Phụ phí', unitPrice: 100_000, quantity: 1 }],
};

const cases: Case[] = [
  // ---- catalog ----
  { name: 'listServiceCategories', call: () => catalog.listServiceCategories(ORG, { isActive: true }), method: 'GET', url: `${P}/service-categories?isActive=true` },
  { name: 'createServiceCategory', call: () => catalog.createServiceCategory(ORG, { name: 'Cô dâu' }, KEY), method: 'POST', url: `${P}/service-categories`, body: { name: 'Cô dâu' }, idem: true },
  { name: 'updateServiceCategory', call: () => catalog.updateServiceCategory(ORG, 'c1', { isActive: false }), method: 'PATCH', url: `${P}/service-categories/c1`, body: { isActive: false } },
  { name: 'listMakeupSubjects', call: () => catalog.listMakeupSubjects(ORG), method: 'GET', url: `${P}/makeup-subjects` },
  { name: 'createMakeupSubject', call: () => catalog.createMakeupSubject(ORG, { name: 'Mẹ cô dâu', sortOrder: 2 }, KEY), method: 'POST', url: `${P}/makeup-subjects`, body: { name: 'Mẹ cô dâu', sortOrder: 2 }, idem: true },
  { name: 'updateMakeupSubject', call: () => catalog.updateMakeupSubject(ORG, 's1', { name: 'Phù dâu' }), method: 'PATCH', url: `${P}/makeup-subjects/s1`, body: { name: 'Phù dâu' } },
  { name: 'listStudioLocations', call: () => catalog.listStudioLocations(ORG, { isActive: false }), method: 'GET', url: `${P}/studio-locations?isActive=false` },
  { name: 'createStudioLocation', call: () => catalog.createStudioLocation(ORG, { name: 'Q1', address: '1 Lê Lợi', isDefault: true }, KEY), method: 'POST', url: `${P}/studio-locations`, body: { name: 'Q1', address: '1 Lê Lợi', isDefault: true }, idem: true },
  { name: 'updateStudioLocation', call: () => catalog.updateStudioLocation(ORG, 'l1', { latitude: null, longitude: null }), method: 'PATCH', url: `${P}/studio-locations/l1`, body: { latitude: null, longitude: null } },
  { name: 'getTravelFeePolicy', call: () => catalog.getTravelFeePolicy(ORG), method: 'GET', url: `${P}/travel-fee-policy` },
  {
    name: 'putTravelFeePolicy',
    call: () =>
      catalog.putTravelFeePolicy(ORG, {
        defaultMode: 'TIERED',
        fixedAmount: 0,
        perKmAmount: 10_000,
        freeKm: 3,
        minimumAmount: 50_000,
        roundTrip: true,
        tiers: [{ fromKm: 10, toKm: 20, amount: 200_000 }, { fromKm: 20, toKm: null, amount: 400_000 }],
      }),
    method: 'PUT',
    url: `${P}/travel-fee-policy`,
    body: {
      defaultMode: 'TIERED',
      fixedAmount: 0,
      perKmAmount: 10_000,
      freeKm: 3,
      minimumAmount: 50_000,
      roundTrip: true,
      tiers: [{ fromKm: 10, toKm: 20, amount: 200_000 }, { fromKm: 20, toKm: null, amount: 400_000 }],
    },
  },
  { name: 'listServices', call: () => catalog.listServices(ORG, { kind: 'ADDON', page: 2, q: 'tóc' }), method: 'GET', url: `${P}/services?kind=ADDON&page=2&q=t%C3%B3c` },
  { name: 'getService', call: () => catalog.getService(ORG, 'sv1'), method: 'GET', url: `${P}/services/sv1` },
  { name: 'createService', call: () => catalog.createService(ORG, { code: 'TOC', name: 'Làm tóc', durationMinutes: 30, kind: 'ADDON', listPrice: 300_000 }, KEY), method: 'POST', url: `${P}/services`, body: { code: 'TOC', name: 'Làm tóc', durationMinutes: 30, kind: 'ADDON', listPrice: 300_000 }, idem: true },
  { name: 'updateService', call: () => catalog.updateService(ORG, 'sv1', { name: 'Tóc' }), method: 'PATCH', url: `${P}/services/sv1`, body: { name: 'Tóc' } },
  { name: 'listServicePrices', call: () => catalog.listServicePrices(ORG, 'sv1', { pageSize: 5 }), method: 'GET', url: `${P}/services/sv1/prices?pageSize=5` },
  { name: 'addServicePrice', call: () => catalog.addServicePrice(ORG, 'sv1', { listPrice: 350_000, salePrice: null }, KEY), method: 'POST', url: `${P}/services/sv1/prices`, body: { listPrice: 350_000, salePrice: null }, idem: true },
  { name: 'listPackages', call: () => catalog.listPackages(ORG, { isActive: true, locationType: 'STUDIO' }), method: 'GET', url: `${P}/packages?isActive=true&locationType=STUDIO` },
  { name: 'getPackage', call: () => catalog.getPackage(ORG, 'p1'), method: 'GET', url: `${P}/packages/p1` },
  { name: 'createPackage', call: () => catalog.createPackage(ORG, { code: 'CD1', name: 'Cô dâu 1', durationMinutes: 120, listPrice: 2_700_000, items: [{ serviceId: 'sv1', isOptional: true }] }, KEY), method: 'POST', url: `${P}/packages`, body: { code: 'CD1', name: 'Cô dâu 1', durationMinutes: 120, listPrice: 2_700_000, items: [{ serviceId: 'sv1', isOptional: true }] }, idem: true },
  { name: 'updatePackage', call: () => catalog.updatePackage(ORG, 'p1', { items: [], includedKm: 5 }), method: 'PATCH', url: `${P}/packages/p1`, body: { items: [], includedKm: 5 } },
  { name: 'listPackagePrices', call: () => catalog.listPackagePrices(ORG, 'p1'), method: 'GET', url: `${P}/packages/p1/prices` },
  { name: 'addPackagePrice', call: () => catalog.addPackagePrice(ORG, 'p1', { listPrice: 3_000_000, effectiveFrom: '2026-12-01T00:00:00+07:00' }, KEY), method: 'POST', url: `${P}/packages/p1/prices`, body: { listPrice: 3_000_000, effectiveFrom: '2026-12-01T00:00:00+07:00' }, idem: true },
  // ---- schedule ----
  { name: 'listCustomers', call: () => schedule.listCustomers(ORG, { q: '0912' }), method: 'GET', url: `${P}/customers?q=0912` },
  { name: 'getCustomer', call: () => schedule.getCustomer(ORG, 'k1'), method: 'GET', url: `${P}/customers/k1` },
  { name: 'createCustomer', call: () => schedule.createCustomer(ORG, { fullName: 'Lan', phone: '0912345678' }, KEY), method: 'POST', url: `${P}/customers`, body: { fullName: 'Lan', phone: '0912345678' }, idem: true },
  { name: 'updateCustomer', call: () => schedule.updateCustomer(ORG, 'k1', { note: null }), method: 'PATCH', url: `${P}/customers/k1`, body: { note: null } },
  {
    name: 'listAppointments',
    call: () => schedule.listAppointments(ORG, { from: '2026-11-01T00:00:00+07:00', to: '2026-11-08T00:00:00+07:00', status: 'CONFIRMED' }),
    method: 'GET',
    url: `${P}/appointments?from=2026-11-01T00%3A00%3A00%2B07%3A00&to=2026-11-08T00%3A00%3A00%2B07%3A00&status=CONFIRMED`,
  },
  { name: 'getAppointment', call: () => schedule.getAppointment(ORG, 'a1'), method: 'GET', url: `${P}/appointments/a1` },
  {
    name: 'createAppointment',
    call: () => schedule.createAppointment(ORG, { startsAt: '2026-11-01T08:00:00+07:00', endsAt: '2026-11-01T10:00:00+07:00', staff: [{ membershipId: 'm1' }] }, KEY),
    method: 'POST',
    url: `${P}/appointments`,
    body: { startsAt: '2026-11-01T08:00:00+07:00', endsAt: '2026-11-01T10:00:00+07:00', staff: [{ membershipId: 'm1' }] },
    idem: true,
  },
  { name: 'updateAppointment', call: () => schedule.updateAppointment(ORG, 'a1', { travelBeforeMin: 30 }), method: 'PATCH', url: `${P}/appointments/a1`, body: { travelBeforeMin: 30 } },
  { name: 'changeAppointmentStatus', call: () => schedule.changeAppointmentStatus(ORG, 'a1', { to: 'CANCELLED', reason: 'Khách huỷ' }), method: 'POST', url: `${P}/appointments/a1/status`, body: { to: 'CANCELLED', reason: 'Khách huỷ' } },
  // ---- contracts ----
  { name: 'quoteContract', call: () => contracts.quoteContract(ORG, contractBody), method: 'POST', url: `${P}/contracts/quote`, body: contractBody },
  { name: 'createContract', call: () => contracts.createContract(ORG, contractBody, KEY), method: 'POST', url: `${P}/contracts`, body: contractBody, idem: true },
  { name: 'listContracts', call: () => contracts.listContracts(ORG, { status: 'DRAFT', q: 'HD-0001' }), method: 'GET', url: `${P}/contracts?status=DRAFT&q=HD-0001` },
  { name: 'getContract', call: () => contracts.getContract(ORG, 'h1'), method: 'GET', url: `${P}/contracts/h1` },
  { name: 'updateContract', call: () => contracts.updateContract(ORG, 'h1', { notes: 'Ghi chú', eventDate: null }), method: 'PATCH', url: `${P}/contracts/h1`, body: { notes: 'Ghi chú', eventDate: null } },
  {
    name: 'addContractLine',
    call: () => contracts.addContractLine(ORG, 'h1', { kind: 'SURCHARGE', serviceId: 'sv9', quantity: 1 }, KEY),
    method: 'POST',
    url: `${P}/contracts/h1/lines`,
    body: { kind: 'SURCHARGE', serviceId: 'sv9', quantity: 1 },
    idem: true,
  },
  { name: 'voidContractLine', call: () => contracts.voidContractLine(ORG, 'h1', 'ln1', { reason: 'Khách bỏ' }), method: 'POST', url: `${P}/contracts/h1/lines/ln1/void`, body: { reason: 'Khách bỏ' } },
  { name: 'changeContractStatus', call: () => contracts.changeContractStatus(ORG, 'h1', { to: 'CONFIRMED' }), method: 'POST', url: `${P}/contracts/h1/status`, body: { to: 'CONFIRMED' } },
  // ---- staff ----
  { name: 'listStaffTiers', call: () => staff.listStaffTiers(ORG), method: 'GET', url: `${P}/staff-tiers` },
  { name: 'createStaffTier', call: () => staff.createStaffTier(ORG, { name: 'Bậc 1' }, KEY), method: 'POST', url: `${P}/staff-tiers`, body: { name: 'Bậc 1' }, idem: true },
  { name: 'updateStaffTier', call: () => staff.updateStaffTier(ORG, 't1', { sortOrder: 3 }), method: 'PATCH', url: `${P}/staff-tiers/t1`, body: { sortOrder: 3 } },
  {
    name: 'getStaffAvailability',
    call: () =>
      staff.getStaffAvailability(ORG, { startsAt: '2026-11-01T08:00:00+07:00', endsAt: '2026-11-01T10:00:00+07:00', membershipIds: ['m1', 'm2'], excludeContractId: 'h1' }),
    method: 'GET',
    url: `${P}/staff/availability?startsAt=2026-11-01T08%3A00%3A00%2B07%3A00&endsAt=2026-11-01T10%3A00%3A00%2B07%3A00&excludeContractId=h1&membershipIds=m1%2Cm2`,
  },
  { name: 'listStaff', call: () => staff.listStaff(ORG, { tierId: 't1' }), method: 'GET', url: `${P}/staff?tierId=t1` },
  { name: 'updateStaff', call: () => staff.updateStaff(ORG, 'm1', { tierId: null, isBookable: false }), method: 'PATCH', url: `${P}/staff/m1`, body: { tierId: null, isBookable: false } },
  { name: 'getPackagePayRates', call: () => staff.getPackagePayRates(ORG, 'p1'), method: 'GET', url: `${P}/packages/p1/pay-rates` },
  { name: 'putPackagePayRates', call: () => staff.putPackagePayRates(ORG, 'p1', { rates: [{ tierId: 't1', amount: 500_000 }] }), method: 'PUT', url: `${P}/packages/p1/pay-rates`, body: { rates: [{ tierId: 't1', amount: 500_000 }] } },
  { name: 'getServicePayRates', call: () => staff.getServicePayRates(ORG, 'sv1'), method: 'GET', url: `${P}/services/sv1/pay-rates` },
  { name: 'putServicePayRates', call: () => staff.putServicePayRates(ORG, 'sv1', { rates: [{ tierId: 't1', amount: null }] }), method: 'PUT', url: `${P}/services/sv1/pay-rates`, body: { rates: [{ tierId: 't1', amount: null }] } },
];

describe('mỗi hàm gọi đúng đường API', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    await c.call();
    expect(seen).toHaveLength(1);
    const s = seen[0];
    expect(s?.method).toBe(c.method);
    expect(s?.url).toBe(c.url);
    expect(s?.body).toEqual(c.body);
    expect(s?.headers.Authorization).toBe('Bearer tok');
    expect(s?.headers['X-Client']).toBe('web');
    if (c.idem) expect(s?.headers['Idempotency-Key']).toBe(KEY);
    else expect(s?.headers['Idempotency-Key']).toBeUndefined();
  });

  it('đủ mọi hàm xuất ra của catalog/contracts/schedule/staff đều có bài thử', () => {
    const exported = [catalog, contracts, schedule, staff].flatMap((m) => Object.keys(m)).sort();
    expect(cases.map((c) => c.name).sort()).toEqual(exported);
  });

  it('id có ký tự lạ được mã hoá trong đường dẫn', async () => {
    await catalog.getService('org/x', 'a b');
    expect(seen[0]?.url).toBe('/api/v1/orgs/org%2Fx/services/a%20b');
  });

  it('thiếu orgId thì báo lỗi ngay, không gọi máy chủ', () => {
    expect(() => catalog.listPackages('')).toThrow('Thiếu orgId');
    expect(seen).toHaveLength(0);
  });
});
