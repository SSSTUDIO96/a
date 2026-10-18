import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createOrganization, getMe, register } from './auth';
import * as catalog from './catalog';
import { setAccessToken } from './client';
import * as contracts from './contracts';
import { newIdempotencyKey } from './idempotency';
import * as schedule from './schedule';
import * as staff from './staff';
import type {
  Appointment,
  AppointmentDetail,
  AppointmentList,
  AppointmentStaff,
  AppointmentStatusChange,
  ContractAdjustment,
  ContractBody,
  ContractDetail,
  ContractLineView,
  ContractQuote,
  ContractStatusResult,
  ContractSummary,
  ContractVoidResult,
  CurrentPrice,
  Customer,
  GroupedContractLine,
  Items,
  MakeupSubject,
  Page,
  PackageItem,
  PayRateRow,
  PayRateSheet,
  PayRateStaff,
  PriceVersion,
  Service,
  ServiceCategory,
  ServiceCategoryListItem,
  ServicePackage,
  StaffMember,
  StaffTier,
  StudioLocation,
  TravelFeePolicy,
} from './types';

// "Khớp hợp đồng": chạy máy chủ API THẬT (database thử makeup_test_web), gọi mỗi hàm của catalog/contracts/schedule/staff
// một lần với dữ liệu thật, rồi so ĐỦ tên trường trả về với kiểu trong types.ts (thiếu hay thừa một trường đều đỏ).
// Cần: PostgreSQL chạy, database makeup_test_web đã migrate deploy, cổng 4123 trống.

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'api');
const PORT = Number(process.env.KHOP_PORT ?? 4123);
const BASE = `http://localhost:${PORT}`;
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://makeup:makeup_local@localhost:5432/makeup_test_web';

// Danh sách khoá của một kiểu: thiếu khoá hoặc thừa khoá so với kiểu T là lỗi biên dịch.
function keysOf<T>() {
  return <K extends Record<keyof T, true>>(k: K & Record<Exclude<keyof K, keyof T>, never>): string[] => Object.keys(k).sort();
}

function expectKeys(obj: unknown, keys: string[], label: string): void {
  expect(typeof obj, label).toBe('object');
  expect(obj, label).not.toBeNull();
  expect(Object.keys(obj as object).sort(), label).toEqual(keys);
}

function expectIso(v: unknown, label: string): void {
  expect(typeof v, label).toBe('string');
  expect(Number.isNaN(Date.parse(v as string)), label).toBe(false);
}

function expectVnd(v: unknown, label: string): void {
  expect(Number.isInteger(v), `${label} phải là số nguyên đồng`).toBe(true);
}

function first<T>(arr: T[], label: string): T {
  const v = arr[0];
  if (v === undefined) throw new Error(`${label}: danh sách rỗng`);
  return v;
}

const K = {
  page: keysOf<Page<unknown>>()({ items: true, page: true, pageSize: true, total: true }),
  items: keysOf<Items<unknown>>()({ items: true }),
  subject: keysOf<MakeupSubject>()({ id: true, organizationId: true, name: true, sortOrder: true, isActive: true, createdAt: true, updatedAt: true }),
  category: keysOf<ServiceCategory>()({ id: true, organizationId: true, name: true, sortOrder: true, isActive: true, createdAt: true, updatedAt: true }),
  categoryItem: keysOf<ServiceCategoryListItem>()({
    id: true, organizationId: true, name: true, sortOrder: true, isActive: true, createdAt: true, updatedAt: true, serviceCount: true,
  }),
  location: keysOf<StudioLocation>()({
    id: true, name: true, address: true, latitude: true, longitude: true, isDefault: true, isActive: true, createdAt: true, updatedAt: true,
  }),
  policy: keysOf<TravelFeePolicy>()({
    defaultMode: true, fixedAmount: true, perKmAmount: true, freeKm: true, minimumAmount: true, roundTrip: true, updatedAt: true,
  }),
  price: keysOf<CurrentPrice>()({ priceVersionId: true, listPrice: true, salePrice: true, unitPrice: true, effectiveFrom: true }),
  version: keysOf<PriceVersion>()({
    id: true, listPrice: true, salePrice: true, unitPrice: true, effectiveFrom: true, note: true, status: true, createdBy: true, createdAt: true,
  }),
  service: keysOf<Service>()({
    id: true, kind: true, code: true, name: true, description: true, durationMinutes: true, categoryId: true, isActive: true,
    isPublic: true, sortOrder: true, createdAt: true, updatedAt: true, category: true, currentPrice: true,
  }),
  pkg: keysOf<ServicePackage>()({
    id: true, code: true, name: true, description: true, durationMinutes: true, staffCount: true, depositAmount: true, subjectId: true,
    locationTypes: true, terms: true, isActive: true, isPublic: true, sortOrder: true, createdAt: true, updatedAt: true, subject: true,
    items: true, currentPrice: true,
  }),
  pkgItem: keysOf<PackageItem>()({ serviceId: true, quantity: true, isOptional: true, service: true, currentPrice: true }),
  pkgItemService: keysOf<PackageItem['service']>()({ id: true, code: true, name: true, kind: true, isActive: true }),
  pkgSubject: keysOf<NonNullable<ServicePackage['subject']>>()({ id: true, name: true, isActive: true }),
  tier: keysOf<StaffTier>()({ id: true, name: true, sortOrder: true, isActive: true, createdAt: true, updatedAt: true, staffCount: true }),
  member: keysOf<StaffMember>()({
    membershipId: true, userId: true, fullName: true, displayName: true, initials: true, avatarUrl: true, phone: true, tier: true,
    isBookable: true, hasProfile: true, status: true, roleKeys: true,
  }),
  memberTier: keysOf<NonNullable<StaffMember['tier']>>()({ id: true, name: true, isActive: true }),
  paySheet: keysOf<PayRateSheet>()({ owner: true, items: true }),
  payOwner: keysOf<PayRateSheet['owner']>()({ kind: true, id: true, name: true }),
  payRow: keysOf<PayRateRow>()({ tier: true, amount: true, updatedAt: true, staff: true }),
  payTier: keysOf<PayRateRow['tier']>()({ id: true, name: true, sortOrder: true }),
  payStaff: keysOf<PayRateStaff>()({ membershipId: true, displayName: true, avatarUrl: true, initials: true }),
  customer: keysOf<Customer>()({ id: true, fullName: true, phone: true, email: true, note: true, createdAt: true, updatedAt: true }),
  quote: keysOf<ContractQuote>()({
    lines: true, travelTotal: true, subtotal: true, discount: true, total: true, depositRequired: true, suggestedDeposit: true,
  }),
  line: keysOf<ContractLineView>()({
    id: true, kind: true, name: true, serviceId: true, packageId: true, priceVersionId: true, subjectId: true, subjectName: true,
    locationType: true, studioLocationId: true, address: true, latitude: true, longitude: true, scheduledStart: true, scheduledEnd: true,
    quantity: true, unitPrice: true, lineDiscount: true, lineTotal: true, travelMode: true, distanceKm: true, perKmAmount: true, note: true,
    addedAfterConfirm: true, voidedAt: true, voidReason: true,
  }),
  groupedLine: keysOf<GroupedContractLine>()({
    id: true, kind: true, name: true, serviceId: true, packageId: true, priceVersionId: true, subjectId: true, subjectName: true,
    locationType: true, studioLocationId: true, address: true, latitude: true, longitude: true, scheduledStart: true, scheduledEnd: true,
    quantity: true, unitPrice: true, lineDiscount: true, lineTotal: true, travelMode: true, distanceKm: true, perKmAmount: true, note: true,
    addedAfterConfirm: true, voidedAt: true, voidReason: true, addons: true, travel: true,
  }),
  summary: keysOf<ContractSummary>()({
    id: true, code: true, status: true, eventDate: true, subtotal: true, discount: true, total: true, depositRequired: true,
    confirmedAt: true, createdAt: true, customer: true,
  }),
  summaryCustomer: keysOf<ContractSummary['customer']>()({ id: true, fullName: true, phone: true }),
  detail: keysOf<ContractDetail>()({
    id: true, code: true, status: true, eventDate: true, subtotal: true, discount: true, total: true, depositRequired: true,
    travelTotal: true, notes: true, terms: true, cancelReason: true, confirmedAt: true, createdById: true, createdAt: true, updatedAt: true,
    customer: true, lines: true, appointments: true,
  }),
  detailCustomer: keysOf<ContractDetail['customer']>()({ id: true, fullName: true, phone: true, email: true }),
  detailAppointment: keysOf<ContractDetail['appointments'][number]>()({ id: true, code: true, startsAt: true, status: true, contractLineId: true }),
  voidResult: keysOf<ContractVoidResult>()({
    id: true, code: true, status: true, eventDate: true, subtotal: true, discount: true, total: true, depositRequired: true,
    travelTotal: true, notes: true, terms: true, cancelReason: true, confirmedAt: true, createdById: true, createdAt: true, updatedAt: true,
    customer: true, lines: true, appointments: true, adjustments: true,
  }),
  statusResult: keysOf<ContractStatusResult>()({
    id: true, code: true, status: true, eventDate: true, subtotal: true, discount: true, total: true, depositRequired: true,
    travelTotal: true, notes: true, terms: true, cancelReason: true, confirmedAt: true, createdById: true, createdAt: true, updatedAt: true,
    customer: true, lines: true, appointments: true, cancelledAppointments: true,
  }),
  adjustment: keysOf<ContractAdjustment>()({ field: true, from: true, to: true }),
  appointment: keysOf<Appointment>()({
    id: true, code: true, kind: true, title: true, status: true, customer: true, contract: true, contractLineId: true, startsAt: true,
    endsAt: true, travelBeforeMin: true, travelAfterMin: true, locationType: true, address: true, latitude: true, longitude: true,
    notes: true, cancelReason: true, staff: true, createdAt: true, updatedAt: true,
  }),
  appointmentDetail: keysOf<AppointmentDetail>()({
    id: true, code: true, kind: true, title: true, status: true, customer: true, contract: true, contractLineId: true, startsAt: true,
    endsAt: true, travelBeforeMin: true, travelAfterMin: true, locationType: true, address: true, latitude: true, longitude: true,
    notes: true, cancelReason: true, staff: true, createdAt: true, updatedAt: true, statusHistory: true,
  }),
  appointmentList: keysOf<AppointmentList>()({ items: true, from: true, to: true }),
  appointmentStaff: keysOf<AppointmentStaff>()({ membershipId: true, fullName: true, role: true, blockStart: true, blockEnd: true, isBlocking: true }),
  appointmentCustomer: keysOf<NonNullable<Appointment['customer']>>()({ id: true, fullName: true, phone: true }),
  appointmentContract: keysOf<NonNullable<Appointment['contract']>>()({ id: true, code: true, status: true }),
  statusChange: keysOf<AppointmentStatusChange>()({ fromStatus: true, toStatus: true, reason: true, changedById: true, changedAt: true }),
};

let server: ChildProcess | null = null;
let serverLog = '';
const realFetch = globalThis.fetch;

async function waitHealthy(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`Máy chủ API dừng sớm:\n${serverLog}`);
    try {
      const r = await realFetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      // Máy chủ chưa mở cổng — đợi tiếp.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Máy chủ API không lên sau 60 giây:\n${serverLog}`);
}

beforeAll(async () => {
  server = spawn(join(API_DIR, 'node_modules', '.bin', 'tsx'), ['src/server.ts'], {
    cwd: API_DIR,
    detached: true,
    env: {
      PATH: process.env.PATH ?? '',
      NODE_ENV: 'development',
      PORT: String(PORT),
      DATABASE_URL: DB,
      DIRECT_URL: DB,
      JWT_ACCESS_SECRET: 'khop-hop-dong-chi-dung-cho-bai-thu-0123456789',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      LOG_LEVEL: 'warn',
    },
  });
  server.stdout?.on('data', (d: Buffer) => (serverLog += d.toString()));
  server.stderr?.on('data', (d: Buffer) => (serverLog += d.toString()));
  await waitHealthy();
  // Hàm của web gọi đường tương đối /api/v1/... như trên trình duyệt; ở đây ghép thêm địa chỉ máy chủ thử.
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => realFetch(new URL(String(input), BASE), init));
}, 90_000);

afterAll(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
  if (server?.pid) process.kill(-server.pid, 'SIGTERM');
});

describe('types.ts khớp đúng dữ liệu máy chủ thật trả về', () => {
  const stamp = Date.now();
  let orgId = '';
  let membershipId = '';
  let subject: MakeupSubject;
  let category: ServiceCategory;
  let main: Service;
  let addon: Service;
  let surcharge: Service;
  let pkg: ServicePackage;
  let tier: StaffTier;
  let customer: Customer;
  let contract: ContractDetail;
  let appointment: AppointmentDetail;

  it('đăng ký, tạo tổ chức', async () => {
    await register({ fullName: 'Thợ Khớp Hợp Đồng', email: `khop-${stamp}@makeup.test`, password: 'mat-khau-khop-du-dai' }, newIdempotencyKey());
    const org = await createOrganization({ name: `Khớp ${stamp}`, slug: `khop-${stamp}`, kind: 'TEAM' }, newIdempotencyKey());
    orgId = org.id;
    const me = await getMe();
    membershipId = first(
      me.organizations.filter((o) => o.id === orgId),
      'tổ chức của tôi',
    ).membershipId;
  });

  it('nhân vật makeup, danh mục, studio, phí di chuyển', async () => {
    const subjects = await catalog.listMakeupSubjects(orgId);
    expectKeys(subjects, K.items, 'listMakeupSubjects');
    subject = first(subjects.items, 'nhân vật mặc định');
    expectKeys(subject, K.subject, 'MakeupSubject');
    expectIso(subject.createdAt, 'MakeupSubject.createdAt');
    expectKeys(await catalog.createMakeupSubject(orgId, { name: `Nhân vật thử ${stamp}` }, newIdempotencyKey()), K.subject, 'createMakeupSubject');
    expectKeys(await catalog.updateMakeupSubject(orgId, subject.id, { sortOrder: 0 }), K.subject, 'updateMakeupSubject');

    category = await catalog.createServiceCategory(orgId, { name: 'Trang điểm' }, newIdempotencyKey());
    expectKeys(category, K.category, 'createServiceCategory');
    expectKeys(await catalog.updateServiceCategory(orgId, category.id, { sortOrder: 1 }), K.category, 'updateServiceCategory');
    const cats = await catalog.listServiceCategories(orgId, { isActive: true });
    expectKeys(first(cats.items, 'danh mục'), K.categoryItem, 'listServiceCategories');

    const loc = await catalog.createStudioLocation(
      orgId,
      { name: 'Studio Quận 1', address: '1 Lê Lợi, Quận 1', latitude: 10.776, longitude: 106.701, isDefault: true },
      newIdempotencyKey(),
    );
    expectKeys(loc, K.location, 'createStudioLocation');
    expect(typeof loc.latitude).toBe('number');
    expectKeys(await catalog.updateStudioLocation(orgId, loc.id, { name: 'Studio Q1' }), K.location, 'updateStudioLocation');
    expectKeys(first((await catalog.listStudioLocations(orgId)).items, 'studio'), K.location, 'listStudioLocations');

    expectKeys(await catalog.getTravelFeePolicy(orgId), K.policy, 'getTravelFeePolicy');
    const policy = await catalog.putTravelFeePolicy(orgId, {
      defaultMode: 'PER_KM',
      fixedAmount: 100_000,
      perKmAmount: 10_000,
      freeKm: 3,
      minimumAmount: 50_000,
      roundTrip: true,
    });
    expectKeys(policy, K.policy, 'putTravelFeePolicy');
    expectVnd(policy.perKmAmount, 'perKmAmount');
    expect(policy.freeKm).toBe(3);
  });

  it('dịch vụ, giá, gói', async () => {
    main = await catalog.createService(
      orgId,
      { code: 'cd-main', name: 'Makeup cô dâu', durationMinutes: 120, categoryId: category.id, listPrice: 1_500_000 },
      newIdempotencyKey(),
    );
    expectKeys(main, K.service, 'createService');
    expect(main.code).toBe('CD-MAIN');
    expectKeys(main.category, keysOf<NonNullable<Service['category']>>()({ id: true, name: true }), 'Service.category');
    expectKeys(main.currentPrice, K.price, 'Service.currentPrice');
    expectVnd(main.currentPrice?.unitPrice, 'unitPrice');
    addon = await catalog.createService(orgId, { code: 'TOC', name: 'Làm tóc', kind: 'ADDON', durationMinutes: 30, listPrice: 300_000 }, newIdempotencyKey());
    surcharge = await catalog.createService(orgId, { code: 'SOM', name: 'Ca sớm', kind: 'SURCHARGE', durationMinutes: 1, listPrice: 200_000 }, newIdempotencyKey());
    expectKeys(await catalog.updateService(orgId, main.id, { description: 'Gồm tóc cơ bản' }), K.service, 'updateService');
    expectKeys(await catalog.getService(orgId, main.id), K.service, 'getService');
    const addons = await catalog.listServices(orgId, { kind: 'ADDON' });
    expectKeys(addons, K.page, 'listServices');
    expectKeys(first(addons.items, 'dịch vụ phụ'), K.service, 'listServices.items');

    const v = await catalog.addServicePrice(orgId, main.id, { listPrice: 1_600_000, salePrice: 1_500_000, note: 'Tăng giá' }, newIdempotencyKey());
    expectKeys(v, K.version, 'addServicePrice');
    expectKeys(v.createdBy, keysOf<PriceVersion['createdBy']>()({ id: true, fullName: true }), 'PriceVersion.createdBy');
    const hist = await catalog.listServicePrices(orgId, main.id);
    expectKeys(hist, K.page, 'listServicePrices');
    expectKeys(first(hist.items, 'lịch sử giá'), K.version, 'listServicePrices.items');

    pkg = await catalog.createPackage(
      orgId,
      {
        code: 'GOI-CD',
        name: 'Gói cô dâu',
        durationMinutes: 180,
        subjectId: subject.id,
        depositAmount: 500_000,
        items: [{ serviceId: main.id }, { serviceId: addon.id, isOptional: true }],
        listPrice: 2_700_000,
      },
      newIdempotencyKey(),
    );
    expectKeys(pkg, K.pkg, 'createPackage');
    expectKeys(pkg.subject, K.pkgSubject, 'ServicePackage.subject');
    const item = first(pkg.items, 'dịch vụ trong gói');
    expectKeys(item, K.pkgItem, 'PackageItem');
    expectKeys(item.service, K.pkgItemService, 'PackageItem.service');
    expectKeys(item.currentPrice, K.price, 'PackageItem.currentPrice');
    expectVnd(pkg.depositAmount, 'depositAmount');
    expectKeys(await catalog.updatePackage(orgId, pkg.id, { staffCount: 2 }), K.pkg, 'updatePackage');
    expectKeys(await catalog.getPackage(orgId, pkg.id), K.pkg, 'getPackage');
    const pkgs = await catalog.listPackages(orgId, { isActive: true });
    expectKeys(pkgs, K.page, 'listPackages');
    expectKeys(first(pkgs.items, 'gói'), K.pkg, 'listPackages.items');
    expectKeys(await catalog.addPackagePrice(orgId, pkg.id, { listPrice: 2_800_000 }, newIdempotencyKey()), K.version, 'addPackagePrice');
    expectKeys(first((await catalog.listPackagePrices(orgId, pkg.id)).items, 'giá gói'), K.version, 'listPackagePrices');
  });

  it('bậc lương, thợ, tiền công', async () => {
    tier = await staff.createStaffTier(orgId, { name: 'Bậc 1' }, newIdempotencyKey());
    expectKeys(tier, K.tier, 'createStaffTier');
    expectKeys(await staff.updateStaffTier(orgId, tier.id, { sortOrder: 1 }), K.tier, 'updateStaffTier');
    expectKeys(first((await staff.listStaffTiers(orgId)).items, 'bậc'), K.tier, 'listStaffTiers');
    const members = await staff.listStaff(orgId);
    expectKeys(members, K.items, 'listStaff');
    expectKeys(first(members.items, 'thợ'), K.member, 'listStaff.items');
    const me = await staff.updateStaff(orgId, membershipId, { tierId: tier.id, displayName: 'Hoa Khớp' });
    expectKeys(me, K.member, 'updateStaff');
    expectKeys(me.tier, K.memberTier, 'StaffMember.tier');

    const sheet = await staff.getPackagePayRates(orgId, pkg.id);
    expectKeys(sheet, K.paySheet, 'getPackagePayRates');
    expectKeys(sheet.owner, K.payOwner, 'PayRateSheet.owner');
    const row = first(sheet.items, 'bậc tiền công');
    expectKeys(row, K.payRow, 'PayRateRow');
    expectKeys(row.tier, K.payTier, 'PayRateRow.tier');
    expectKeys(first(row.staff, 'thợ trong bậc'), K.payStaff, 'PayRateStaff');
    const put = await staff.putPackagePayRates(orgId, pkg.id, { rates: [{ tierId: tier.id, amount: 400_000 }] });
    expectKeys(put, K.paySheet, 'putPackagePayRates');
    expect(first(put.items, 'bậc').amount).toBe(400_000);
    expectIso(first(put.items, 'bậc').updatedAt, 'PayRateRow.updatedAt');
    expectKeys(await staff.getServicePayRates(orgId, main.id), K.paySheet, 'getServicePayRates');
    expectKeys(await staff.putServicePayRates(orgId, main.id, { rates: [{ tierId: tier.id, amount: null }] }), K.paySheet, 'putServicePayRates');
  });

  it('khách hàng', async () => {
    customer = await schedule.createCustomer(orgId, { fullName: 'Nguyễn Thị Lan', phone: '+84 912 345 678' }, newIdempotencyKey());
    expectKeys(customer, K.customer, 'createCustomer');
    expect(customer.phone).toBe('0912345678');
    expectKeys(await schedule.updateCustomer(orgId, customer.id, { note: 'Khách quen' }), K.customer, 'updateCustomer');
    expectKeys(await schedule.getCustomer(orgId, customer.id), K.customer, 'getCustomer');
    const list = await schedule.listCustomers(orgId, { q: 'Lan' });
    expectKeys(list, K.page, 'listCustomers');
    expectKeys(first(list.items, 'khách'), K.customer, 'listCustomers.items');
  });

  it('hợp đồng: quote, tạo, xem, sửa, thêm dòng, huỷ dòng, xác nhận', async () => {
    const body: ContractBody = {
      customerId: customer.id,
      eventDate: '2026-12-20T00:00:00+07:00',
      lines: [
        {
          kind: 'PACKAGE',
          packageId: pkg.id,
          subjectId: subject.id,
          quantity: 1,
          locationType: 'CUSTOMER_HOME',
          address: '12 Nguyễn Huệ, Quận 1',
          addons: [{ serviceId: addon.id, quantity: 1 }],
          travel: { mode: 'PER_KM', distanceKm: 12.35 },
        },
        { kind: 'SURCHARGE', serviceId: surcharge.id, quantity: 1 },
      ],
    };
    const q = await contracts.quoteContract(orgId, body);
    expectKeys(q, K.quote, 'quoteContract');
    const ql = first(q.lines, 'dòng quote');
    expectKeys(ql, K.groupedLine, 'quote.lines[0]');
    expect(ql.id).toBeNull();
    expectKeys(first(ql.addons, 'dịch vụ phụ'), K.line, 'quote.lines[0].addons[0]');
    expectKeys(ql.travel, K.line, 'quote.lines[0].travel');
    expect(ql.travel?.distanceKm).toBe(12.35);
    expectVnd(q.total, 'quote.total');

    contract = await contracts.createContract(orgId, body, newIdempotencyKey());
    expectKeys(contract, K.detail, 'createContract');
    expectKeys(contract.customer, K.detailCustomer, 'ContractDetail.customer');
    const line = first(contract.lines, 'dòng hợp đồng');
    expectKeys(line, K.groupedLine, 'ContractDetail.lines[0]');
    expect(typeof line.id).toBe('string');
    expect(contract.total).toBe(q.total);

    const list = await contracts.listContracts(orgId, { status: 'DRAFT' });
    expectKeys(list, K.page, 'listContracts');
    const sum = first(list.items, 'hợp đồng');
    expectKeys(sum, K.summary, 'listContracts.items');
    expectKeys(sum.customer, K.summaryCustomer, 'ContractSummary.customer');
    expectKeys(await contracts.getContract(orgId, contract.id), K.detail, 'getContract');
    expectKeys(await contracts.updateContract(orgId, contract.id, { notes: 'Đến sớm 15 phút' }), K.detail, 'updateContract');

    const added = await contracts.addContractLine(orgId, contract.id, { kind: 'CUSTOM', name: 'Thuê váy', unitPrice: 800_000, quantity: 1 }, newIdempotencyKey());
    expectKeys(added, K.detail, 'addContractLine');
    const custom = added.lines.find((l) => l.kind === 'CUSTOM');
    if (!custom) throw new Error('Không thấy dòng CUSTOM vừa thêm');
    // Đặt cọc bằng tổng hiện tại để huỷ dòng làm cọc vượt tổng mới → máy chủ tự hạ cọc và báo trong adjustments.
    await contracts.updateContract(orgId, contract.id, { depositRequired: added.total });
    const voided = await contracts.voidContractLine(orgId, contract.id, custom.id, { reason: 'Khách tự thuê' });
    expectKeys(voided, K.voidResult, 'voidContractLine');
    const adj = first(voided.adjustments, 'điều chỉnh');
    expectKeys(adj, K.adjustment, 'ContractAdjustment');
    expect(adj).toMatchObject({ field: 'depositRequired', from: added.total, to: voided.total });
    const voidedLine = voided.lines.find((l) => l.id === custom.id);
    expectIso(voidedLine?.voidedAt, 'voidedAt');

    const confirmed = await contracts.changeContractStatus(orgId, contract.id, { to: 'CONFIRMED' });
    expectKeys(confirmed, K.statusResult, 'changeContractStatus');
    expect(confirmed.cancelledAppointments).toEqual([]);
    contract = confirmed;
    expect(confirmed.status).toBe('CONFIRMED');
    expectIso(confirmed.confirmedAt, 'confirmedAt');
  });

  it('lịch: tạo (gắn hợp đồng), xem, danh sách, sửa, đổi trạng thái', async () => {
    const line = first(contract.lines, 'dòng gói');
    const startsAt = '2026-12-20T07:00:00+07:00';
    appointment = await schedule.createAppointment(
      orgId,
      {
        contractId: contract.id,
        contractLineId: line.id,
        startsAt,
        endsAt: '2026-12-20T10:00:00+07:00',
        travelBeforeMin: 30,
        locationType: 'CUSTOMER_HOME',
        address: '12 Nguyễn Huệ, Quận 1',
        staff: [{ membershipId, role: 'PRIMARY' }],
        status: 'CONFIRMED',
      },
      newIdempotencyKey(),
    );
    expectKeys(appointment, K.appointmentDetail, 'createAppointment');
    expectKeys(appointment.customer, K.appointmentCustomer, 'Appointment.customer');
    expectKeys(appointment.contract, K.appointmentContract, 'Appointment.contract');
    expectKeys(first(appointment.staff, 'thợ'), K.appointmentStaff, 'Appointment.staff[0]');
    expectKeys(first(appointment.statusHistory, 'lịch sử'), K.statusChange, 'Appointment.statusHistory[0]');
    expectIso(appointment.startsAt, 'startsAt');

    expectKeys(await schedule.getAppointment(orgId, appointment.id), K.appointmentDetail, 'getAppointment');
    const list = await schedule.listAppointments(orgId, { from: '2026-12-19T00:00:00+07:00', to: '2026-12-22T00:00:00+07:00' });
    expectKeys(list, K.appointmentList, 'listAppointments');
    expectKeys(first(list.items, 'lịch'), K.appointment, 'listAppointments.items (không có statusHistory)');
    expectKeys(await schedule.updateAppointment(orgId, appointment.id, { notes: 'Mang thêm mi giả' }), K.appointmentDetail, 'updateAppointment');
    const moved = await schedule.changeAppointmentStatus(orgId, appointment.id, { to: 'IN_PROGRESS' });
    expectKeys(moved, K.appointmentDetail, 'changeAppointmentStatus');
    expect(moved.statusHistory.length).toBe(2);

    const withAppt = await contracts.getContract(orgId, contract.id);
    expectKeys(first(withAppt.appointments, 'lịch của hợp đồng'), K.detailAppointment, 'ContractDetail.appointments[0]');

    // Huỷ hợp đồng kéo theo huỷ lịch đã gắn: cancelledAppointments có cùng dạng với appointments.
    const c2 = await contracts.createContract(
      orgId,
      { newCustomer: { fullName: 'Khách huỷ' }, lines: [{ kind: 'CUSTOM', name: 'Thử', unitPrice: 100_000, quantity: 1 }] },
      newIdempotencyKey(),
    );
    const a2 = await schedule.createAppointment(
      orgId,
      { contractId: c2.id, startsAt: '2026-12-21T07:00:00+07:00', endsAt: '2026-12-21T08:00:00+07:00' },
      newIdempotencyKey(),
    );
    const cancelled = await contracts.changeContractStatus(orgId, c2.id, { to: 'CANCELLED', reason: 'Khách đổi ý' });
    expectKeys(cancelled, K.statusResult, 'changeContractStatus (huỷ)');
    const ca = first(cancelled.cancelledAppointments, 'lịch bị huỷ theo hợp đồng');
    expectKeys(ca, K.detailAppointment, 'cancelledAppointments[0]');
    expect(ca).toMatchObject({ id: a2.id, status: 'CANCELLED' });
  });
});
