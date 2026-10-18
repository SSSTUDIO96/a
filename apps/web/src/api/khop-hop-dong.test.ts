import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as auth from './auth';
import * as catalog from './catalog';
import { setAccessToken } from './client';
import * as contracts from './contracts';
import { errorKind, fieldErrors } from './errors';
import * as files from './files';
import { newIdempotencyKey } from './idempotency';
import { napKieu, soKieu, type Kieu } from './khop-kieu';
import * as org from './org';
import * as payments from './payments';
import * as profile from './profile';
import * as schedule from './schedule';
import * as staff from './staff';
import type {
  AppointmentDetail,
  ContractBody,
  ContractDetail,
  Customer,
  MakeupSubject,
  Service,
  ServiceCategory,
  ServicePackage,
  StaffTier,
  StoredFileView,
} from './types';

// "Khớp hai đầu": chạy máy chủ API THẬT trên một database thử RIÊNG, gọi MỖI hàm gọi của catalog/contracts/schedule/staff/
// payments/files/profile ít nhất một lần với dữ liệu thật, rồi so giá trị trả về với kiểu mà hàm đó khai (types.ts):
// đủ/thừa tên trường, kiểu giá trị string/number/boolean/null/mảng/đối tượng, giá trị liệt kê, chuỗi ISO, số nguyên đồng —
// lồng sâu tới từng phần tử mảng. Khuôn so đọc thẳng khai báo TypeScript lúc chạy (khop-kieu.ts), không chép tay.
//
// Cần: PostgreSQL chạy, cổng 4123 trống, và biến KHOP_HOP_DONG_DATABASE_URL trỏ tới database thử riêng (tên bắt đầu
// makeup_test). Bài tự chạy `prisma migrate deploy` trên database đó trước khi bật máy chủ (như apps/api/test/global-setup.ts).

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(HERE, '..', '..', '..', 'api');
const PORT = Number(process.env.KHOP_PORT ?? 4123);
const BASE = `http://localhost:${PORT}`;
const DB_ENV = 'KHOP_HOP_DONG_DATABASE_URL';

// Không có database mặc định: database dùng chung (vd makeup_test_web) có thể thiếu migration mới hoặc đang được người
// khác dùng — từng làm bài đỏ vì 500 "cột không tồn tại" mà không ai biết vì sao.
function khopDatabaseUrl(): string {
  const url = process.env[DB_ENV];
  if (!url) {
    throw new Error(
      [
        `Thiếu biến môi trường ${DB_ENV} — bài "khớp hai đầu" không tự dùng database mặc định nào.`,
        'Tạo một database thử RIÊNG (tên bắt đầu makeup_test) rồi chạy lại, ví dụ:',
        '  su postgres -c "createdb -O makeup makeup_test_<ten_ban>"',
        `  su postgres -c "psql -d makeup_test_<ten_ban> -c 'CREATE EXTENSION IF NOT EXISTS btree_gist'"`,
        `  ${DB_ENV}=postgresql://makeup:makeup_local@localhost:5432/makeup_test_<ten_ban> pnpm --filter @makeup/web exec vitest run src/api/khop-hop-dong.test.ts`,
        'Bài tự áp migration (prisma migrate deploy) trước khi chạy; không xoá dữ liệu.',
      ].join('\n'),
    );
  }
  let dbName: string;
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error(`${DB_ENV} không phải chuỗi kết nối hợp lệ (dạng postgresql://user:pass@host:5432/makeup_test_xxx)`);
  }
  // Kiểm đúng TÊN database (không phải bất kỳ chỗ nào trong chuỗi kết nối).
  if (!/^makeup_test[a-z0-9_]*$/.test(dbName)) {
    throw new Error(`Từ chối chạy bài thử trên database "${dbName}": ${DB_ENV} phải trỏ tới database thử có tên bắt đầu makeup_test`);
  }
  return url;
}

// Chỉ `prisma migrate deploy` (áp migration còn thiếu, không xoá dữ liệu) — đúng lệnh dùng khi triển khai thật.
function migrateDeploy(url: string): void {
  try {
    execFileSync(join(API_DIR, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
      cwd: API_DIR,
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message: string };
    throw new Error(`prisma migrate deploy thất bại trên ${DB_ENV}:\n${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? e.message}`);
  }
}

// Mọi hàm gọi của các module nghiệp vụ: thêm hàm mới mà bài này chưa gọi → bài "đã gọi đủ" đỏ.
const MODULES = { catalog, contracts, schedule, staff, payments, files, profile } as const;
const DOMAIN_HAM = Object.entries(MODULES).flatMap(([mod, exports]) =>
  Object.entries(exports)
    .filter(([, v]) => typeof v === 'function')
    .map(([fn]) => `${mod}.${fn}`),
);
const EXTRA_HAM = ['auth.register', 'auth.createOrganization', 'auth.getMe', 'org.getOrganization'];

let KIEU: Record<string, Kieu> = {};
const called = new Set<string>();

function expectKieu(value: unknown, kieu: Kieu, label: string): void {
  expect(soKieu(value, kieu, label), `${label} lệch kiểu khai trong types.ts`).toEqual([]);
}

// Gọi một hàm của web và so giá trị nó trả về với kiểu hàm đó khai.
async function chk<T>(ham: string, p: Promise<T>, label = ham): Promise<T> {
  const kieu = KIEU[ham];
  if (!kieu) throw new Error(`Chưa nạp kiểu cho ${ham}`);
  const v = await p;
  called.add(ham);
  expectKieu(v, kieu, label);
  return v;
}

function expectIso(v: unknown, label: string): void {
  expect(typeof v, label).toBe('string');
  expect(Number.isNaN(Date.parse(v as string)), label).toBe(false);
}

function first<T>(arr: T[], label: string): T {
  const v = arr[0];
  if (v === undefined) throw new Error(`${label}: danh sách rỗng`);
  return v;
}

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Ảnh PNG thật (w×h) tự dựng — máy chủ kiểm chữ ký đầu tệp và đọc kích thước ở IHDR.
function makePng(width: number, height: number): Blob {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc(height * (1 + width * 4), 0x7f);
  for (let y = 0; y < height; y++) raw[y * (1 + width * 4)] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return new Blob([new Uint8Array(png)]);
}

let server: ChildProcess | null = null;
let serverLog = '';
let storageDir = '';
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
  const db = khopDatabaseUrl();
  migrateDeploy(db);
  KIEU = napKieu(join(HERE, 'types.ts'), join(HERE, '..', '..', 'tsconfig.json'), Object.fromEntries([...DOMAIN_HAM, ...EXTRA_HAM].map((h) => [h, `ham:${h}`])));
  storageDir = mkdtempSync(join(tmpdir(), 'khop-hop-dong-tep-'));
  server = spawn(join(API_DIR, 'node_modules', '.bin', 'tsx'), ['src/server.ts'], {
    cwd: API_DIR,
    detached: true,
    env: {
      PATH: process.env.PATH ?? '',
      NODE_ENV: 'development',
      PORT: String(PORT),
      DATABASE_URL: db,
      DIRECT_URL: db,
      JWT_ACCESS_SECRET: 'khop-hop-dong-chi-dung-cho-bai-thu-0123456789',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      LOG_LEVEL: 'warn',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: storageDir,
    },
  });
  server.stdout?.on('data', (d: Buffer) => (serverLog += d.toString()));
  server.stderr?.on('data', (d: Buffer) => (serverLog += d.toString()));
  await waitHealthy();
  // Hàm của web gọi đường tương đối /api/v1/... như trên trình duyệt; ở đây ghép thêm địa chỉ máy chủ thử.
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => realFetch(new URL(String(input), BASE), init));
}, 120_000);

afterAll(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
  if (server?.pid) process.kill(-server.pid, 'SIGTERM');
  if (storageDir) rmSync(storageDir, { recursive: true, force: true });
});

describe('types.ts khớp đúng dữ liệu máy chủ thật trả về (tên trường và kiểu giá trị)', () => {
  const stamp = Date.now();
  const slug = `khop-${stamp}`;
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
  let avatarFile: StoredFileView;
  let contract: ContractDetail;
  let appointment: AppointmentDetail;

  it('đăng ký, tạo tổ chức', async () => {
    await chk(
      'auth.register',
      auth.register({ fullName: 'Thợ Khớp Hợp Đồng', email: `khop-${stamp}@makeup.test`, password: 'mat-khau-khop-du-dai' }, newIdempotencyKey()),
    );
    const created = await chk('auth.createOrganization', auth.createOrganization({ name: `Khớp ${stamp}`, slug, kind: 'TEAM' }, newIdempotencyKey()));
    orgId = created.id;
    const me = await chk('auth.getMe', auth.getMe());
    membershipId = first(
      me.organizations.filter((o) => o.id === orgId),
      'tổ chức của tôi',
    ).membershipId;
    await chk('org.getOrganization', org.getOrganization(orgId));
  });

  it('nhân vật makeup, danh mục, studio, phí di chuyển', async () => {
    const subjects = await chk('catalog.listMakeupSubjects', catalog.listMakeupSubjects(orgId));
    subject = first(subjects.items, 'nhân vật mặc định');
    await chk('catalog.createMakeupSubject', catalog.createMakeupSubject(orgId, { name: `Nhân vật thử ${stamp}` }, newIdempotencyKey()));
    await chk('catalog.updateMakeupSubject', catalog.updateMakeupSubject(orgId, subject.id, { sortOrder: 0 }));

    category = await chk('catalog.createServiceCategory', catalog.createServiceCategory(orgId, { name: 'Trang điểm' }, newIdempotencyKey()));
    await chk('catalog.updateServiceCategory', catalog.updateServiceCategory(orgId, category.id, { sortOrder: 1 }));
    first((await chk('catalog.listServiceCategories', catalog.listServiceCategories(orgId, { isActive: true }))).items, 'danh mục');

    const loc = await chk(
      'catalog.createStudioLocation',
      catalog.createStudioLocation(
        orgId,
        { name: 'Studio Quận 1', address: '1 Lê Lợi, Quận 1', latitude: 10.776, longitude: 106.701, isDefault: true },
        newIdempotencyKey(),
      ),
    );
    expect(typeof loc.latitude).toBe('number');
    await chk('catalog.updateStudioLocation', catalog.updateStudioLocation(orgId, loc.id, { name: 'Studio Q1' }));
    first((await chk('catalog.listStudioLocations', catalog.listStudioLocations(orgId))).items, 'studio');

    await chk('catalog.getTravelFeePolicy', catalog.getTravelFeePolicy(orgId));
    const policy = await chk(
      'catalog.putTravelFeePolicy',
      catalog.putTravelFeePolicy(orgId, {
        defaultMode: 'PER_KM',
        fixedAmount: 100_000,
        perKmAmount: 10_000,
        freeKm: 3,
        minimumAmount: 50_000,
        roundTrip: true,
        tiers: [
          { fromKm: 20, toKm: null, amount: 400_000 },
          { fromKm: 10, toKm: 20, amount: 200_000 },
        ],
      }),
    );
    expect(policy.tiers.map((t) => t.fromKm)).toEqual([10, 20]);
    expect(policy.tiers[1]?.toKm).toBeNull();
    expect(policy.freeKm).toBe(3);
  });

  it('dịch vụ, giá, gói', async () => {
    main = await chk(
      'catalog.createService',
      catalog.createService(
        orgId,
        { code: 'cd-main', name: 'Makeup cô dâu', durationMinutes: 120, categoryId: category.id, isPublic: true, listPrice: 1_500_000 },
        newIdempotencyKey(),
      ),
    );
    expect(main.code).toBe('CD-MAIN');
    expect(main.category).not.toBeNull();
    expect(main.currentPrice).not.toBeNull();
    addon = await catalog.createService(
      orgId,
      { code: 'TOC', name: 'Làm tóc', kind: 'ADDON', durationMinutes: 30, isPublic: true, listPrice: 300_000 },
      newIdempotencyKey(),
    );
    surcharge = await catalog.createService(orgId, { code: 'SOM', name: 'Ca sớm', kind: 'SURCHARGE', durationMinutes: 1, listPrice: 200_000 }, newIdempotencyKey());
    await chk('catalog.updateService', catalog.updateService(orgId, main.id, { description: 'Gồm tóc cơ bản' }));
    await chk('catalog.getService', catalog.getService(orgId, main.id));
    first((await chk('catalog.listServices', catalog.listServices(orgId, { kind: 'ADDON' }))).items, 'dịch vụ phụ');

    await chk('catalog.addServicePrice', catalog.addServicePrice(orgId, main.id, { listPrice: 1_600_000, salePrice: 1_500_000, note: 'Tăng giá' }, newIdempotencyKey()));
    first((await chk('catalog.listServicePrices', catalog.listServicePrices(orgId, main.id))).items, 'lịch sử giá');

    pkg = await chk(
      'catalog.createPackage',
      catalog.createPackage(
        orgId,
        {
          code: 'GOI-CD',
          name: 'Gói cô dâu',
          durationMinutes: 180,
          subjectId: subject.id,
          depositAmount: 500_000,
          includedKm: 5,
          isPublic: true,
          items: [{ serviceId: main.id }, { serviceId: addon.id, isOptional: true }],
          listPrice: 2_700_000,
        },
        newIdempotencyKey(),
      ),
    );
    expect(pkg.subject).not.toBeNull();
    expect(first(pkg.items, 'dịch vụ trong gói').currentPrice).not.toBeNull();
    expect(pkg.includedKm).toBe(5);
    await chk('catalog.updatePackage', catalog.updatePackage(orgId, pkg.id, { staffCount: 2 }));
    await chk('catalog.getPackage', catalog.getPackage(orgId, pkg.id));
    first((await chk('catalog.listPackages', catalog.listPackages(orgId, { isActive: true }))).items, 'gói');
    await chk('catalog.addPackagePrice', catalog.addPackagePrice(orgId, pkg.id, { listPrice: 2_800_000 }, newIdempotencyKey()));
    first((await chk('catalog.listPackagePrices', catalog.listPackagePrices(orgId, pkg.id))).items, 'giá gói');
  });

  it('tệp: tải lên, xem, xoá', async () => {
    avatarFile = await chk('files.uploadFile', files.uploadFile(orgId, { purpose: 'STAFF_AVATAR', name: 'hoa.png', data: makePng(4, 5) }, newIdempotencyKey()));
    expect(avatarFile).toMatchObject({ purpose: 'STAFF_AVATAR', status: 'READY', mimeType: 'image/png', width: 4, height: 5 });
    expect(typeof avatarFile.signedUrl).toBe('string');
    await chk('files.getFile', files.getFile(orgId, avatarFile.id));
    const extra = await files.uploadFile(orgId, { purpose: 'OTHER', name: 'tam.png', data: makePng(1, 1) }, newIdempotencyKey());
    await chk('files.deleteFile', files.deleteFile(orgId, extra.id));
    await expect(files.getFile(orgId, extra.id)).rejects.toMatchObject({ status: 404 });
  });

  it('bậc lương, thợ (ảnh đại diện từ tệp), tiền công', async () => {
    tier = await chk('staff.createStaffTier', staff.createStaffTier(orgId, { name: 'Bậc 1' }, newIdempotencyKey()));
    await chk('staff.updateStaffTier', staff.updateStaffTier(orgId, tier.id, { sortOrder: 1 }));
    first((await chk('staff.listStaffTiers', staff.listStaffTiers(orgId))).items, 'bậc');
    first((await chk('staff.listStaff', staff.listStaff(orgId))).items, 'thợ');
    const me = await chk('staff.updateStaff', staff.updateStaff(orgId, membershipId, { tierId: tier.id, displayName: 'Hoa Khớp', avatarFileId: avatarFile.id }));
    expect(me.tier).not.toBeNull();
    // avatarUrl = URL hiển thị được (URL ký có hạn của tệp vừa tải), không phải mã tệp hay chuỗi tạm.
    expect(me.avatarUrl).toMatch(/^(https?:\/\/|\/)/);

    const sheet = await chk('staff.getPackagePayRates', staff.getPackagePayRates(orgId, pkg.id));
    const row = first(sheet.items, 'bậc tiền công');
    expect(first(row.staff, 'thợ trong bậc').avatarUrl).toMatch(/^(https?:\/\/|\/)/);
    const put = await chk('staff.putPackagePayRates', staff.putPackagePayRates(orgId, pkg.id, { rates: [{ tierId: tier.id, amount: 400_000 }] }));
    expect(first(put.items, 'bậc').amount).toBe(400_000);
    expectIso(first(put.items, 'bậc').updatedAt, 'PayRateRow.updatedAt');
    await chk('staff.getServicePayRates', staff.getServicePayRates(orgId, main.id));
    await chk('staff.putServicePayRates', staff.putServicePayRates(orgId, main.id, { rates: [{ tierId: tier.id, amount: null }] }));
  });

  it('khách hàng', async () => {
    customer = await chk('schedule.createCustomer', schedule.createCustomer(orgId, { fullName: 'Nguyễn Thị Lan', phone: '+84 912 345 678' }, newIdempotencyKey()));
    expect(customer.phone).toBe('0912345678');
    await chk('schedule.updateCustomer', schedule.updateCustomer(orgId, customer.id, { note: 'Khách quen' }));
    await chk('schedule.getCustomer', schedule.getCustomer(orgId, customer.id));
    first((await chk('schedule.listCustomers', schedule.listCustomers(orgId, { q: 'Lan' }))).items, 'khách');
  });

  it('mức rảnh của thợ', async () => {
    // Ca riêng (không gắn hợp đồng) 07:00–10:00 → hỏi 08:00–09:00 phải ra trùng giờ.
    await schedule.createAppointment(
      orgId,
      { startsAt: '2026-12-25T07:00:00+07:00', endsAt: '2026-12-25T10:00:00+07:00', staff: [{ membershipId }], status: 'CONFIRMED' },
      newIdempotencyKey(),
    );
    const avail = await chk(
      'staff.getStaffAvailability',
      staff.getStaffAvailability(orgId, { startsAt: '2026-12-25T08:00:00+07:00', endsAt: '2026-12-25T09:00:00+07:00', membershipIds: [membershipId] }),
    );
    const me = first(avail.items, 'mức rảnh của thợ');
    expect(me.level).toBe('OVERLAP');
    first(me.overlaps, 'ca trùng');
  });

  it('hợp đồng: quote (thợ dự kiến, cảnh báo, công thức phí), tạo, xem, sửa, thêm dòng, huỷ dòng, xác nhận', async () => {
    const pkgLine = {
      kind: 'PACKAGE' as const,
      packageId: pkg.id,
      subjectId: subject.id,
      quantity: 1,
      locationType: 'CUSTOMER_HOME' as const,
      address: '12 Nguyễn Huệ, Quận 1',
      addons: [{ serviceId: addon.id, quantity: 1 }],
      travel: { mode: 'PER_KM' as const, distanceKm: 12.35 },
    };
    // Lỗi kiểm dữ liệu lồng: máy chủ trả đường dẫn đầy đủ trong details.issues.
    const bad: ContractBody = { customerId: customer.id, lines: [{ ...pkgLine, travel: { mode: 'MANUAL', amount: -1 } }] };
    const badErr: unknown = await contracts.quoteContract(orgId, bad).catch((e: unknown) => e);
    expect(errorKind(badErr)).toBe('validation');
    expect(fieldErrors(badErr)['lines.0.travel.amount']).toBe('Số tiền không được âm');

    // Xem trước: thợ đã có ca 25/12 07:00–10:00 → dòng 08:00–09:00 có cảnh báo trùng giờ (không chặn).
    const warned = await chk(
      'contracts.quoteContract',
      contracts.quoteContract(orgId, {
        customerId: customer.id,
        lines: [
          { ...pkgLine, scheduledStart: '2026-12-25T08:00:00+07:00', scheduledEnd: '2026-12-25T09:00:00+07:00', staff: [{ membershipId, role: 'PRIMARY' }] },
        ],
      }),
      'quoteContract (có thợ, trùng giờ)',
    );
    const wl = first(warned.lines, 'dòng quote');
    expect(wl.id).toBeNull();
    expect(first(wl.staff, 'thợ dự kiến')).toMatchObject({ membershipId, role: 'PRIMARY', displayName: 'Hoa Khớp' });
    const warning = first(wl.staffWarnings, 'cảnh báo thợ');
    expect(warning.level).toBe('OVERLAP');
    first(warning.overlaps, 'ca trùng trong cảnh báo');
    expect(wl.travel?.distanceKm).toBe(12.35);
    expect(wl.travel?.travelBreakdown).toMatchObject({ includedKm: 5, includedFrom: 'PACKAGE', roundTrip: true });
    // TIERED: bậc đã áp có trong công thức.
    const tiered = await chk(
      'contracts.quoteContract',
      contracts.quoteContract(orgId, { customerId: customer.id, lines: [{ ...pkgLine, travel: { mode: 'TIERED', distanceKm: 15 } }] }),
      'quoteContract (TIERED)',
    );
    expect(first(tiered.lines, 'dòng quote').travel?.travelBreakdown?.tier).not.toBeNull();

    const body: ContractBody = {
      customerId: customer.id,
      eventDate: '2026-12-20T00:00:00+07:00',
      lines: [
        { ...pkgLine, scheduledStart: '2026-12-20T07:00:00+07:00', scheduledEnd: '2026-12-20T10:00:00+07:00', staff: [{ membershipId }] },
        { kind: 'SURCHARGE', serviceId: surcharge.id, quantity: 1 },
      ],
    };
    const q = await chk('contracts.quoteContract', contracts.quoteContract(orgId, body));
    contract = await chk('contracts.createContract', contracts.createContract(orgId, body, newIdempotencyKey()));
    const line = first(contract.lines, 'dòng hợp đồng');
    expect(typeof line.id).toBe('string');
    expect(first(line.staff, 'thợ của dòng đã lưu').membershipId).toBe(membershipId);
    expect(line.staffWarnings).toEqual([]);
    expect(line.travel?.travelBreakdown).toBeNull();
    expect(contract.total).toBe(q.total);

    first((await chk('contracts.listContracts', contracts.listContracts(orgId, { status: 'DRAFT' }))).items, 'hợp đồng');
    await chk('contracts.getContract', contracts.getContract(orgId, contract.id));
    await chk('contracts.updateContract', contracts.updateContract(orgId, contract.id, { notes: 'Đến sớm 15 phút' }));

    const added = await chk(
      'contracts.addContractLine',
      contracts.addContractLine(orgId, contract.id, { kind: 'CUSTOM', name: 'Thuê váy', unitPrice: 800_000, quantity: 1 }, newIdempotencyKey()),
    );
    expect(added.createdAppointments).toEqual([]);
    const custom = added.lines.find((l) => l.kind === 'CUSTOM');
    if (!custom) throw new Error('Không thấy dòng CUSTOM vừa thêm');
    // Đặt cọc bằng tổng hiện tại để huỷ dòng làm cọc vượt tổng mới → máy chủ tự hạ cọc và báo trong adjustments.
    await contracts.updateContract(orgId, contract.id, { depositRequired: added.total });
    const voided = await chk('contracts.voidContractLine', contracts.voidContractLine(orgId, contract.id, custom.id, { reason: 'Khách tự thuê' }));
    expect(first(voided.adjustments, 'điều chỉnh')).toMatchObject({ field: 'depositRequired', from: added.total, to: voided.total });
    expectIso(voided.lines.find((l) => l.id === custom.id)?.voidedAt, 'voidedAt');

    // Xác nhận: dòng gói có thợ dự kiến → máy chủ tạo một lịch đã xác nhận.
    const confirmed = await chk('contracts.changeContractStatus', contracts.changeContractStatus(orgId, contract.id, { to: 'CONFIRMED' }));
    expect(confirmed.cancelledAppointments).toEqual([]);
    expect(first(confirmed.createdAppointments, 'lịch tạo khi xác nhận')).toMatchObject({ contractLineId: line.id, status: 'CONFIRMED' });
    contract = confirmed;
    expect(confirmed.status).toBe('CONFIRMED');
  });

  it('thu tiền: tiến độ, phiếu thu, huỷ phiếu, sổ thu, báo cáo doanh số', async () => {
    const empty = await chk('payments.getContractPayments', payments.getContractPayments(orgId, contract.id));
    expect(empty.scheduleDifference).toBeNull();
    const half = Math.floor(contract.total / 2);
    const plan = await chk(
      'payments.putInstallments',
      payments.putInstallments(orgId, contract.id, {
        installments: [
          { name: 'Đặt cọc', dueDate: '2026-10-01T00:00:00+07:00', amount: half, isDeposit: true },
          { name: 'Còn lại', dueDate: '2026-12-19T00:00:00+07:00', amount: contract.total - half },
        ],
      }),
    );
    expect(plan.scheduleDifference).toBe(0);
    const receipt = await chk('payments.createPayment', payments.createPayment(orgId, contract.id, { method: 'CASH', amount: half }, newIdempotencyKey()));
    expect(receipt.summary.paid).toBe(half);
    const wrong = await payments.createPayment(orgId, contract.id, { method: 'BANK_TRANSFER', amount: 100_000, note: 'Ghi nhầm' }, newIdempotencyKey());
    const cancelled = await chk('payments.voidPayment', payments.voidPayment(orgId, wrong.id, { reason: 'Ghi nhầm số tiền' }));
    expectIso(cancelled.voidedAt, 'Payment.voidedAt');
    const progress = await payments.getContractPayments(orgId, contract.id);
    expect(progress.installments.map((i) => i.status)).toEqual(['PAID', 'DUE']);
    expect(progress.payments.length).toBe(2);

    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const ledger = await chk('payments.listPayments', payments.listPayments(orgId, { from, to }));
    expect(ledger.totals).toMatchObject({ received: half, receiptCount: 1 });
    first(ledger.items, 'phiếu trong sổ thu');
    const byMonth = await chk('payments.getRevenueReport', payments.getRevenueReport(orgId, { from, to }), 'getRevenueReport (tháng)');
    expect(byMonth.groupBy).toBe('month');
    first(byMonth.rows, 'tháng');
    const byContract = await chk('payments.getRevenueReport', payments.getRevenueReport(orgId, { from, to, groupBy: 'contract' }), 'getRevenueReport (hợp đồng)');
    if (byContract.groupBy !== 'contract') throw new Error('Báo cáo phải nhóm theo hợp đồng');
    expect(byContract.rows.find((r) => r.contractId === contract.id)).toMatchObject({ bookedInPeriod: true, paid: half });
  });

  it('hồ sơ thương hiệu và trang giới thiệu công khai', async () => {
    expect(await chk('profile.getBrandProfile', profile.getBrandProfile(orgId))).toEqual({ hasProfile: false, profile: null });
    const logo = await files.uploadFile(orgId, { purpose: 'ORG_LOGO', name: 'logo.png', data: makePng(8, 8) }, newIdempotencyKey());
    const saved = await chk(
      'profile.putBrandProfile',
      profile.putBrandProfile(orgId, {
        brandName: 'Hoa Makeup',
        tagline: 'Trang điểm cô dâu tự nhiên',
        styles: ['Cô dâu', 'Tự nhiên'],
        phone: '0912 345 678',
        facebook: 'https://facebook.com/hoamakeup',
        workingHours: [
          { weekday: 1, open: '13:00', close: '20:00' },
          { weekday: 1, open: '08:00', close: '12:00' },
        ],
        logoFileId: logo.id,
        avatarFileId: avatarFile.id,
      }),
    );
    if (!saved.hasProfile) throw new Error('Lưu xong phải có hồ sơ');
    expect(saved.profile.logo).not.toBeNull();
    expect(saved.profile.workingHours.map((s) => s.open)).toEqual(['08:00', '13:00']);
    const published = await chk('profile.publishBrandProfile', profile.publishBrandProfile(orgId));
    expect(published.profile?.isPublished).toBe(true);

    const site = await chk('profile.getPublicSite', profile.getPublicSite(slug));
    expect(site.profile.logo).not.toBeNull();
    first(site.services, 'dịch vụ công khai');
    const sitePkg = first(site.packages, 'gói công khai');
    first(sitePkg.included, 'dịch vụ trong gói công khai');
    first(sitePkg.addons, 'dịch vụ phụ của gói công khai');

    const hidden = await chk('profile.unpublishBrandProfile', profile.unpublishBrandProfile(orgId));
    expect(hidden.profile?.isPublished).toBe(false);
    await expect(profile.getPublicSite(slug)).rejects.toMatchObject({ status: 404 });
  });

  it('lịch: tạo (gắn hợp đồng), xem, danh sách, sửa, đổi trạng thái', async () => {
    const line = first(contract.lines, 'dòng gói');
    // 13:00–15:00: ca 07:00–10:00 của dòng này đã được tạo khi xác nhận hợp đồng.
    appointment = await chk(
      'schedule.createAppointment',
      schedule.createAppointment(
        orgId,
        {
          contractId: contract.id,
          contractLineId: line.id,
          startsAt: '2026-12-20T13:00:00+07:00',
          endsAt: '2026-12-20T15:00:00+07:00',
          travelBeforeMin: 30,
          locationType: 'CUSTOMER_HOME',
          address: '12 Nguyễn Huệ, Quận 1',
          staff: [{ membershipId, role: 'PRIMARY' }],
          status: 'CONFIRMED',
        },
        newIdempotencyKey(),
      ),
    );
    expect(appointment.customer).not.toBeNull();
    expect(appointment.contract).not.toBeNull();
    first(appointment.staff, 'thợ');
    first(appointment.statusHistory, 'lịch sử');

    await chk('schedule.getAppointment', schedule.getAppointment(orgId, appointment.id));
    const list = await chk('schedule.listAppointments', schedule.listAppointments(orgId, { from: '2026-12-19T00:00:00+07:00', to: '2026-12-22T00:00:00+07:00' }));
    // Danh sách không có statusHistory (kiểu Appointment, không phải AppointmentDetail).
    expect(Object.keys(first(list.items, 'lịch'))).not.toContain('statusHistory');
    await chk('schedule.updateAppointment', schedule.updateAppointment(orgId, appointment.id, { notes: 'Mang thêm mi giả' }));
    const moved = await chk('schedule.changeAppointmentStatus', schedule.changeAppointmentStatus(orgId, appointment.id, { to: 'IN_PROGRESS' }));
    expect(moved.statusHistory.length).toBe(2);

    const withAppt = await contracts.getContract(orgId, contract.id);
    expect(withAppt.appointments.length).toBe(2);

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
    const cancelled = await chk('contracts.changeContractStatus', contracts.changeContractStatus(orgId, c2.id, { to: 'CANCELLED', reason: 'Khách đổi ý' }), 'changeContractStatus (huỷ)');
    expect(first(cancelled.cancelledAppointments, 'lịch bị huỷ theo hợp đồng')).toMatchObject({ id: a2.id, status: 'CANCELLED' });
  });

  it('đã gọi đủ mọi hàm gọi của các module nghiệp vụ', () => {
    expect(DOMAIN_HAM.filter((h) => !called.has(h))).toEqual([]);
  });
});
