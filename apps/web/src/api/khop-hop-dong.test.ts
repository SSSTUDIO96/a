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
import * as courses from './courses';
import { errorKind, fieldErrors } from './errors';
import { draftFromDetail, draftIndexesOfLineIds, linesWithoutTime, missingTimeOf } from '../features/contracts/model';
import * as files from './files';
import { newIdempotencyKey } from './idempotency';
import { napKieu, soKieu, type Kieu } from './khop-kieu';
import * as org from './org';
import * as payments from './payments';
import * as profile from './profile';
import * as schedule from './schedule';
import * as staff from './staff';
import * as today from './today';
import type {
  AppointmentDetail,
  ContractBody,
  ContractDetail,
  Customer,
  MakeupSubject,
  OccasionView,
  Service,
  ServiceCategory,
  ServicePackage,
  StaffTier,
  SurchargeRuleView,
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

// Tổ chức đào tạo cần gói có khoá học / học viên (gói mặc định 'trial' không có). Như apps/api/test/helpers.ts
// grantUnlimitedPlan: một gói thử không giới hạn + thuê bao ACTIVE — ghi thẳng vào database thử của bài này.
function grantUnlimitedPlan(url: string, orgId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(orgId)) throw new Error(`Mã tổ chức lạ: ${orgId}`);
  const sql = `
    WITH p AS (
      INSERT INTO subscription_plans (id, code, name, price_monthly, features, updated_at)
      VALUES (gen_random_uuid(), 'khop_' || substr(md5(random()::text), 1, 10), 'Gói thử không giới hạn', 0, '{}', now())
      RETURNING id
    )
    INSERT INTO organization_subscriptions (id, organization_id, plan_id, status, starts_at)
    SELECT gen_random_uuid(), '${orgId}'::uuid, p.id, 'ACTIVE', now() - interval '1 day' FROM p;`;
  execFileSync(join(API_DIR, 'node_modules', '.bin', 'prisma'), ['db', 'execute', '--url', url, '--stdin'], { cwd: API_DIR, input: sql, stdio: 'pipe' });
}

// Mọi hàm gọi của các module nghiệp vụ: thêm hàm mới mà bài này chưa gọi → bài "đã gọi đủ" đỏ.
const MODULES = { catalog, contracts, schedule, staff, payments, files, profile, today } as const;
const DOMAIN_HAM = Object.entries(MODULES).flatMap(([mod, exports]) =>
  Object.entries(exports)
    .filter(([, v]) => typeof v === 'function')
    .map(([fn]) => `${mod}.${fn}`),
);
// courses.syncClassSessions (thợ K2, buổi học lên Lịch): nạp kiểu để so, gọi trong bài hợp đồng khoá học.
const EXTRA_HAM = ['auth.register', 'auth.createOrganization', 'auth.getMe', 'org.getOrganization', 'courses.syncClassSessions'];

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
    // Phụ phí bỏ trống thời lượng (máy chủ 74fda02): không gửi trường → máy chủ lưu và trả durationMinutes: null.
    surcharge = await chk(
      'catalog.createService',
      catalog.createService(orgId, { code: 'SOM', name: 'Ca sớm', kind: 'SURCHARGE', listPrice: 200_000 }, newIdempotencyKey()),
      'createService (phụ phí không thời lượng)',
    );
    expect(surcharge.durationMinutes).toBeNull();
    // Đổi phụ phí (thời lượng trống) sang MAIN mà không gửi thời lượng → 400, lỗi đúng trường durationMinutes.
    const toMain: unknown = await catalog.updateService(orgId, surcharge.id, { kind: 'MAIN' }).catch((e: unknown) => e);
    expect(errorKind(toMain)).toBe('validation');
    expect(Object.keys(fieldErrors(toMain))).toEqual(['durationMinutes']);
    // Dịch vụ phụ đặt null → 400 đúng trường; phụ phí đặt null → nhận (giữ null).
    const addonNull: unknown = await catalog.updateService(orgId, addon.id, { durationMinutes: null }).catch((e: unknown) => e);
    expect(Object.keys(fieldErrors(addonNull))).toEqual(['durationMinutes']);
    const kept = await chk('catalog.updateService', catalog.updateService(orgId, surcharge.id, { durationMinutes: null }), 'updateService (phụ phí null)');
    expect(kept.durationMinutes).toBeNull();
    // Tạo dịch vụ phụ thiếu thời lượng → 400 đúng trường.
    const addonMissing: unknown = await catalog
      .createService(orgId, { code: 'THIEU', name: 'Thiếu thời lượng', kind: 'ADDON', listPrice: 1 }, newIdempotencyKey())
      .catch((e: unknown) => e);
    expect(Object.keys(fieldErrors(addonMissing))).toEqual(['durationMinutes']);
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

  // Biên bản nghiệm thu D, T2: 7 hàm Loại sự kiện / Luật phụ phí gọi THẬT vào máy chủ, so JSON thật với types.ts.
  it('loại sự kiện và luật phụ phí (bản vẽ D 2.2, 2.3): liệt kê, tạo, sửa, đổi thứ tự', async () => {
    // Tổ chức mới có sẵn 6 loại mặc định (đã bật).
    const seeded = await chk('catalog.listOccasions', catalog.listOccasions(orgId));
    expect(seeded.items.length).toBeGreaterThanOrEqual(6);
    expect(seeded.items.every((o) => o.isActive)).toBe(true);
    const hon = first(seeded.items, 'loại sự kiện mặc định');
    expectIso(hon.createdAt, 'OccasionView.createdAt');

    const tiec = await chk('catalog.createOccasion', catalog.createOccasion(orgId, { name: `Tiệc thử ${stamp}`, color: 'plum' }, newIdempotencyKey()));
    expect(tiec).toMatchObject({ name: `Tiệc thử ${stamp}`, color: 'plum', isActive: true, lineCount: 0 });
    const hidden = await chk('catalog.updateOccasion', catalog.updateOccasion(orgId, tiec.id, { color: 'olive', isActive: false }));
    expect(hidden).toMatchObject({ id: tiec.id, color: 'olive', isActive: false });
    // Lọc theo trạng thái: loại đang ẩn không có trong danh sách "đang bật".
    const active = await chk('catalog.listOccasions', catalog.listOccasions(orgId, { isActive: true }), 'listOccasions (đang bật)');
    expect(active.items.map((o) => o.id)).not.toContain(tiec.id);
    // Đổi thứ tự: phải gồm ĐỦ mọi loại (cả loại đang ẩn); đảo ngược danh sách.
    const all = await catalog.listOccasions(orgId);
    const reversed = all.items.map((o) => o.id).reverse();
    const ordered = await chk('catalog.reorderOccasions', catalog.reorderOccasions(orgId, { occasionIds: reversed }));
    expect(ordered.items.map((o) => o.id)).toEqual(reversed);
    const missing: unknown = await catalog.reorderOccasions(orgId, { occasionIds: reversed.slice(1) }).catch((e: unknown) => e);
    expect(errorKind(missing)).toBe('validation');

    // Luật phụ phí: dịch vụ loại SURCHARGE (đã tạo ở bài trước), điều kiện khung giờ + thứ + sự kiện + gói.
    expect((await chk('catalog.listSurchargeRules', catalog.listSurchargeRules(orgId))).items).toEqual([]);
    const rule: SurchargeRuleView = await chk(
      'catalog.createSurchargeRule',
      catalog.createSurchargeRule(
        orgId,
        { name: 'Ca sớm cuối tuần', serviceId: surcharge.id, startTime: '05:00', endTime: '08:00', weekdays: [6, 7], dates: ['2026-12-25', '2026-12-24'], occasionIds: [tiec.id], packageIds: [pkg.id], perQuantity: true, note: 'Thử khớp' },
        newIdempotencyKey(),
      ),
    );
    expect(rule).toMatchObject({ startTime: '05:00', endTime: '08:00', weekdays: [6, 7], dates: ['2026-12-24', '2026-12-25'], occasionIds: [tiec.id], packageIds: [pkg.id], perQuantity: true, isActive: true, usedLineCount: 0 });
    expect(rule.service).toMatchObject({ id: surcharge.id, kind: 'SURCHARGE' });
    const edited = await chk('catalog.updateSurchargeRule', catalog.updateSurchargeRule(orgId, rule.id, { startTime: null, endTime: null, dates: [], perQuantity: false, isActive: false }));
    expect(edited).toMatchObject({ startTime: null, endTime: null, dates: [], weekdays: [6, 7], perQuantity: false, isActive: false });
    const rules = await chk('catalog.listSurchargeRules', catalog.listSurchargeRules(orgId, { isActive: false }), 'listSurchargeRules (đang tắt)');
    expect(rules.items.map((r) => r.id)).toEqual([rule.id]);
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
    // Dòng TRAVEL đã lưu: máy chủ dựng lại công thức từ số liệu đã chụp lúc lưu (migration 20261018240000).
    expect(line.travel?.travelBreakdown).toMatchObject({ includedKm: 5, includedFrom: 'PACKAGE', roundTrip: true, tier: null });
    expect(contract.total).toBe(q.total);

    first((await chk('contracts.listContracts', contracts.listContracts(orgId, { status: 'DRAFT' }))).items, 'hợp đồng');
    await chk('contracts.getContract', contracts.getContract(orgId, contract.id));
    // PATCH bắt buộc expectedUpdatedAt = updatedAt của bản đang sửa (biên bản web 2, T2).
    await chk('contracts.updateContract', contracts.updateContract(orgId, contract.id, { expectedUpdatedAt: (await contracts.getContract(orgId, contract.id)).updatedAt, notes: 'Đến sớm 15 phút' }));

    const added = await chk(
      'contracts.addContractLine',
      contracts.addContractLine(orgId, contract.id, { kind: 'CUSTOM', name: 'Thuê váy', unitPrice: 800_000, quantity: 1 }, newIdempotencyKey()),
    );
    expect(added.createdAppointments).toEqual([]);
    const custom = added.lines.find((l) => l.kind === 'CUSTOM');
    if (!custom) throw new Error('Không thấy dòng CUSTOM vừa thêm');
    // Đặt cọc bằng tổng hiện tại để huỷ dòng làm cọc vượt tổng mới → máy chủ tự hạ cọc và báo trong adjustments.
    await contracts.updateContract(orgId, contract.id, { expectedUpdatedAt: (await contracts.getContract(orgId, contract.id)).updatedAt, depositRequired: added.total });
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

  it('409 LINES_MISSING_TIME: web đọc đúng lỗi máy chủ ở cửa xác nhận và cửa thêm phát sinh (biên bản nghiệm thu cuối N2)', async () => {
    const tz = 'Asia/Ho_Chi_Minh';
    const noTime = {
      kind: 'PACKAGE' as const,
      packageId: pkg.id,
      subjectId: subject.id,
      quantity: 1,
      locationType: 'CUSTOMER_HOME' as const,
      address: '12 Nguyễn Huệ, Quận 1',
      travel: { mode: 'PER_KM' as const, distanceKm: 3 },
    };
    // Cửa xác nhận: nháp có một dòng gói chưa có giờ (kèm khoản tự đặt tên — không cần lên lịch).
    const nt = await contracts.createContract(
      orgId,
      { customerId: customer.id, eventDate: '2026-12-21T00:00:00+07:00', lines: [noTime, { kind: 'CUSTOM', name: 'Phí gửi xe', unitPrice: 50_000, quantity: 1 }] },
      newIdempotencyKey(),
    );
    const ntLine = first(nt.lines.filter((l) => l.kind === 'PACKAGE'), 'dòng gói chưa có giờ');
    const draft = draftFromDetail(nt, tz);
    // Web chặn đúng tập dòng máy chủ chặn: dòng PACKAGE/SERVICE chưa huỷ, không tính CUSTOM.
    expect(linesWithoutTime(draft, () => null).map((x) => x.index)).toEqual([0]);
    const e1: unknown = await contracts.changeContractStatus(orgId, nt.id, { to: 'CONFIRMED' }).catch((e: unknown) => e);
    const m1 = missingTimeOf(e1);
    expect(m1, `lỗi máy chủ lệch hình dạng web đọc: ${JSON.stringify((e1 as { details?: unknown }).details)}`).not.toBeNull();
    expect(m1).toEqual({
      lineIds: [ntLine.id],
      lines: [{ id: ntLine.id, name: ntLine.name, subjectName: subject.name, missing: ['scheduledStart', 'scheduledEnd'] }],
    });
    expect(draftIndexesOfLineIds(nt.lines, draft, m1?.lineIds ?? [])).toEqual([{ id: ntLine.id, index: 0, name: ntLine.name }]);
    expect((await contracts.getContract(orgId, nt.id)).status).toBe('DRAFT');

    // Cửa thêm phát sinh vào hợp đồng đã xác nhận: dòng vừa thêm bị quay lui, lineIds là mã dòng đó.
    const before = await contracts.getContract(orgId, contract.id);
    const e2: unknown = await contracts.addContractLine(orgId, contract.id, noTime, newIdempotencyKey()).catch((e: unknown) => e);
    const m2 = missingTimeOf(e2);
    expect(m2, `lỗi máy chủ lệch hình dạng web đọc: ${JSON.stringify((e2 as { details?: unknown }).details)}`).not.toBeNull();
    expect(m2?.lineIds).toHaveLength(1);
    expect(m2?.lines).toEqual([{ id: m2?.lineIds[0], name: pkg.name, subjectName: subject.name, missing: ['scheduledStart', 'scheduledEnd'] }]);
    expect((await contracts.getContract(orgId, contract.id)).lines.map((l) => l.id)).toEqual(before.lines.map((l) => l.id));
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
    // Thu hẹp kiểu theo groupBy (expect không thu hẹp được kiểu hợp).
    if (byMonth.groupBy !== 'month') throw new Error('Báo cáo phải nhóm theo tháng');
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
    // Đổi khách hợp đồng NHÁP đã có lịch chưa huỷ → 409 CUSTOMER_IN_USE kèm số lượng (contracts/routes.ts checkCustomerChange).
    const inUse: unknown = await contracts.updateContract(orgId, c2.id, { expectedUpdatedAt: c2.updatedAt, customerId: customer.id }).catch((e: unknown) => e);
    expect(errorKind(inUse)).toBe('conflict');
    expect((inUse as { details?: unknown }).details).toEqual({ reason: 'CUSTOMER_IN_USE', appointments: 1, designCards: 0 });
    // Nháp chưa có lịch / thẻ: đổi được; khách lạ (không thuộc tổ chức) → 404; hợp đồng đã xác nhận → 409.
    const c3 = await contracts.createContract(
      orgId,
      { newCustomer: { fullName: 'Khách sẽ đổi' }, lines: [{ kind: 'CUSTOM', name: 'Thử', unitPrice: 100_000, quantity: 1 }] },
      newIdempotencyKey(),
    );
    const swapped = await chk('contracts.updateContract', contracts.updateContract(orgId, c3.id, { expectedUpdatedAt: c3.updatedAt, customerId: customer.id }), 'updateContract (đổi khách)');
    expect(swapped.customer.id).toBe(customer.id);
    const stranger: unknown = await contracts
      .updateContract(orgId, c3.id, { expectedUpdatedAt: swapped.updatedAt, customerId: '00000000-0000-4000-8000-000000000000' })
      .catch((e: unknown) => e);
    expect(errorKind(stranger)).toBe('not_found');
    const confirmedSwap: unknown = await contracts
      .updateContract(orgId, contract.id, { expectedUpdatedAt: (await contracts.getContract(orgId, contract.id)).updatedAt, customerId: c3.customer.id })
      .catch((e: unknown) => e);
    expect(errorKind(confirmedSwap)).toBe('conflict');

    const cancelled = await chk('contracts.changeContractStatus', contracts.changeContractStatus(orgId, c2.id, { to: 'CANCELLED', reason: 'Khách đổi ý' }), 'changeContractStatus (huỷ)');
    expect(first(cancelled.cancelledAppointments, 'lịch bị huỷ theo hợp đồng')).toMatchObject({ id: a2.id, status: 'CANCELLED' });
  });

  it('hợp đồng khoá học: mẫu điều khoản / nội quy, dòng COURSE + khoản tự đặt tên, giữ chỗ khi xác nhận, lớp đầy 409, báo cáo theo khoá', async () => {
    // Tổ chức TEAM: hợp đồng khoá học bị chặn 403.
    const team = await contracts
      .quoteContract(orgId, { kind: 'COURSE', customerId: customer.id, lines: [{ kind: 'CUSTOM', name: 'Giáo trình', unitPrice: 1, quantity: 1 }] })
      .catch((e: unknown) => e);
    expect(errorKind(team)).toBe('forbidden');

    const academy = await auth.createOrganization({ name: `Học viện khớp ${stamp}`, slug: `hv-${slug}`, kind: 'ACADEMY' }, newIdempotencyKey());
    const hv = academy.id;
    grantUnlimitedPlan(khopDatabaseUrl(), hv);
    const group = await courses.createCourseGroup(hv, { name: 'Makeup chuyên nghiệp' }, newIdempotencyKey());
    const made = await courses.createCourse(
      hv,
      {
        name: 'Makeup chuyên nghiệp',
        groupId: group.id,
        mode: 'MULTI_CLASS',
        tuitionFee: 18_000_000,
        depositAmount: 5_000_000,
        defaultCapacity: 1,
        firstClass: { name: 'K1', startDate: '2026-11-02', endDate: '2026-12-17', weekdays: [2, 4, 6], startTime: '18:00', endTime: '22:00', capacity: 1 },
      },
      newIdempotencyKey(),
    );
    const k1 = first(made.classes, 'lớp đầu tiên');
    expect(k1.calendar).toEqual({ total: 0, upcoming: 0 });

    // Buổi học lên Lịch (thợ K2): xem trước rồi ghi thật; bấm lại không sinh trùng; buổi học trên Lịch đúng dạng Appointment.
    const preview = await chk('courses.syncClassSessions', courses.syncClassSessions(hv, k1.id, true), 'syncClassSessions (xem trước)');
    expect(preview.summary.create).toBeGreaterThan(0);
    const synced = await chk('courses.syncClassSessions', courses.syncClassSessions(hv, k1.id, false), 'syncClassSessions (ghi)');
    expect(synced.class.calendar.total).toBe(preview.summary.create);
    expect((await courses.syncClassSessions(hv, k1.id, false)).summary).toMatchObject({ create: 0, keep: preview.summary.create });
    const onCal = await chk('schedule.listAppointments', schedule.listAppointments(hv, { from: '2026-11-02T00:00:00+07:00', to: '2026-11-09T00:00:00+07:00' }), 'listAppointments (buổi học)');
    expect(first(onCal.items, 'buổi học trên Lịch')).toMatchObject({ kind: 'COURSE_SESSION', status: 'CONFIRMED', sessionDate: '2026-11-03', courseClass: { id: k1.id, name: 'K1' } });

    // Mẫu điều khoản / nội quy: thêm, sửa nội dung (phiên bản tăng), đặt mặc định, danh sách theo loại hợp đồng.
    const terms = await chk(
      'contracts.createContractText',
      contracts.createContractText(hv, { kind: 'TERMS', appliesTo: ['COURSE'], name: 'Điều khoản khoá học', body: '1. Học phí đã đóng không hoàn lại.', isDefault: true }, newIdempotencyKey()),
    );
    expect(terms).toMatchObject({ version: 1, isDefault: true, isActive: true });
    const rules0 = await contracts.createContractText(hv, { kind: 'RULES', appliesTo: [], name: 'Nội quy trung tâm', body: 'Có mặt trước giờ học 10 phút.' }, newIdempotencyKey());
    const rules = await chk('contracts.updateContractText', contracts.updateContractText(hv, rules0.id, { body: '1. Có mặt trước giờ học 10 phút.\n2. Giữ gìn dụng cụ chung.', isDefault: true }));
    expect(rules).toMatchObject({ version: 2, isDefault: true });
    const texts = await chk('contracts.listContractTexts', contracts.listContractTexts(hv, { appliesTo: 'COURSE' }));
    expect(texts.map((t) => t.id).sort()).toEqual([terms.id, rules.id].sort());
    expectIso(first(texts, 'mẫu').updatedAt, 'ContractText.updatedAt');

    const student = await schedule.createCustomer(hv, { fullName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', phone: '0912345678' }, newIdempotencyKey());
    const body: ContractBody = {
      kind: 'COURSE',
      customerId: student.id,
      ownerMembershipId: first(
        (await auth.getMe()).organizations.filter((o) => o.id === hv),
        'tổ chức học viện',
      ).membershipId,
      termsTemplateId: terms.id,
      rulesTemplateId: rules.id,
      discount: 1_000_000,
      lines: [
        { kind: 'COURSE', courseClassId: k1.id },
        { kind: 'CUSTOM', name: 'Giáo trình', unitPrice: 500_000, quantity: 1 },
      ],
    };
    // Luật trộn dòng: hợp đồng dịch vụ không nhận dòng khoá học.
    const mixed = await contracts.quoteContract(hv, { ...body, kind: 'SERVICE', termsTemplateId: undefined, rulesTemplateId: undefined }).catch((e: unknown) => e);
    expect(errorKind(mixed)).toBe('validation');

    const q = await chk('contracts.quoteContract', contracts.quoteContract(hv, body), 'quoteContract (khoá học)');
    expect(q.kind).toBe('COURSE');
    expect(first(q.classes, 'lớp trong quote')).toMatchObject({ classId: k1.id, capacity: 1, enrolledCount: 0, seatsLeft: 1, seatState: 'AVAILABLE' });
    expect(first(q.lines, 'dòng khoá học')).toMatchObject({ kind: 'COURSE', courseClassId: k1.id, unitPrice: 18_000_000, quantity: 1 });
    expect(q.total).toBe(17_500_000);

    const draft = await chk('contracts.createContract', contracts.createContract(hv, body, newIdempotencyKey()), 'createContract (khoá học)');
    expect(draft.code.startsWith('HĐKH-')).toBe(true);
    expect(draft).toMatchObject({ kind: 'COURSE', termsTemplateId: terms.id, rulesTemplateId: rules.id, rulesTemplateVersion: 2, rules: null, enrollments: [] });
    const confirmed = await chk('contracts.changeContractStatus', contracts.changeContractStatus(hv, draft.id, { to: 'CONFIRMED' }), 'changeContractStatus (khoá học)');
    const enr = first(confirmed.enrollments, 'ghi danh');
    expect(enr).toMatchObject({ courseClassId: k1.id, status: 'ACTIVE', cancelledAt: null });
    expectIso(enr.enrolledAt, 'Enrollment.enrolledAt');
    expect(confirmed.rules).toBe(rules.body);
    expect(confirmed.terms).toBe(terms.body);
    first((await chk('contracts.listContracts', contracts.listContracts(hv, { kind: 'COURSE' }), 'listContracts (khoá học)')).items, 'hợp đồng khoá học');

    // Lớp đã đủ 1/1: hợp đồng thứ hai vào cùng lớp → 409 ngay lúc lưu, details có số chỗ mới.
    const other = await schedule.createCustomer(hv, { fullName: 'Đỗ Minh Ngọc' }, newIdempotencyKey());
    const full = await contracts.createContract(hv, { kind: 'COURSE', customerId: other.id, lines: [{ kind: 'COURSE', courseClassId: k1.id }] }, newIdempotencyKey()).catch((e: unknown) => e);
    expect(errorKind(full)).toBe('conflict');
    expect((full as { details?: unknown }).details).toMatchObject({ reason: 'CLASS_FULL', classId: k1.id, enrolledCount: 1, capacity: 1, seatsLeft: 0 });

    // Thu tiền dùng nguyên module payments; báo cáo lọc khoá học, nhóm theo khoá / nhóm khoá / loại.
    await payments.putInstallments(hv, draft.id, {
      installments: [
        { name: 'Đặt cọc', dueDate: '2026-10-20T00:00:00+07:00', amount: 5_000_000, isDeposit: true },
        { name: 'Khai giảng', dueDate: '2026-11-02T00:00:00+07:00', amount: 12_500_000 },
      ],
    });
    await payments.createPayment(hv, draft.id, { method: 'BANK_TRANSFER', amount: 5_000_000 }, newIdempotencyKey());
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const byCourse = await chk('payments.getRevenueReport', payments.getRevenueReport(hv, { from, to, kind: 'COURSE', groupBy: 'course' }), 'getRevenueReport (khoá)');
    if (byCourse.groupBy !== 'course') throw new Error('Báo cáo phải nhóm theo khoá');
    expect(byCourse.kind).toBe('COURSE');
    expect(byCourse.totals).toMatchObject({ contractCount: 1, sales: 17_500_000, depositRequired: 5_000_000, collected: 5_000_000, outstanding: 12_500_000 });
    expect(first(byCourse.rows, 'dòng khoá')).toMatchObject({ segment: 'COURSE', course: { id: made.course.id }, group: { id: group.id }, sales: 17_500_000 });
    const byGroup = await chk('payments.getRevenueReport', payments.getRevenueReport(hv, { from, to, kind: 'COURSE', groupBy: 'courseGroup' }), 'getRevenueReport (nhóm khoá)');
    if (byGroup.groupBy !== 'courseGroup') throw new Error('Báo cáo phải nhóm theo nhóm khoá');
    expect(first(byGroup.rows, 'dòng nhóm khoá').group?.name).toBe('Makeup chuyên nghiệp');
    await chk('payments.getRevenueReport', payments.getRevenueReport(hv, { from, to, groupBy: 'kind' }), 'getRevenueReport (loại)');
    const byContract = await chk('payments.getRevenueReport', payments.getRevenueReport(hv, { from, to, kind: 'COURSE', groupBy: 'contract' }), 'getRevenueReport (hợp đồng khoá học)');
    if (byContract.groupBy !== 'contract') throw new Error('Báo cáo phải nhóm theo hợp đồng');
    expect(first(byContract.rows, 'hợp đồng khoá học')).toMatchObject({ kind: 'COURSE', courses: [{ id: made.course.id, groupId: group.id }], paid: 5_000_000, remaining: 12_500_000 });

    // Hôm nay của tổ chức đào tạo (bản vẽ D 3.1): ghi danh mới 24 giờ qua + lớp gần đầy (3/4). Lớp K1 đã đầy (1/1) nên không vào.
    const k2 = await courses.createClass(
      hv,
      made.course.id,
      { name: 'K2', startDate: '2027-01-04', endDate: '2027-02-26', weekdays: [2, 4], startTime: '18:00', endTime: '21:00', capacity: 4 },
      newIdempotencyKey(),
    );
    for (const fullName of ['Lê Thu A', 'Lê Thu B', 'Lê Thu C']) {
      const hs = await schedule.createCustomer(hv, { fullName }, newIdempotencyKey());
      const d = await contracts.createContract(hv, { kind: 'COURSE', customerId: hs.id, lines: [{ kind: 'COURSE', courseClassId: k2.id }] }, newIdempotencyKey());
      await contracts.changeContractStatus(hv, d.id, { to: 'CONFIRMED' });
    }
    const todayHv = await chk('today.getToday', today.getToday(hv), 'getToday (tổ chức đào tạo)');
    expect(todayHv.scheduleScope).toBe('ALL');
    expect(todayHv.newEnrollments).toHaveLength(4);
    expect(first(todayHv.newEnrollments ?? [], 'ghi danh mới')).toMatchObject({ course: { id: made.course.id } });
    expect(todayHv.almostFullClasses).toHaveLength(1);
    expect(first(todayHv.almostFullClasses ?? [], 'lớp gần đầy')).toMatchObject({ id: k2.id, name: 'K2', enrolledCount: 3, capacity: 4, seatsLeft: 1 });
  });

  it('Hôm nay (bản vẽ D 3.1): ca hôm nay / ngày mai / sau đó, ca chưa có thợ, đợt thu quá hạn / sắp tới, hợp đồng mới', async () => {
    const t0 = await today.getToday(orgId);
    expect(t0.timezone).toBe('Asia/Ho_Chi_Minh');
    const plus = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const at = (date: string, hhmm: string) => `${date}T${hhmm}:00+07:00`;
    const day0 = t0.today;
    expect(t0.tomorrow).toBe(plus(day0, 1));
    // Ca hôm nay có thợ (23:00 để luôn nằm trong ngày), ngày mai chưa có thợ, ba ngày sau có thợ và khách mới.
    const aToday = await schedule.createAppointment(orgId, { startsAt: at(day0, '23:00'), endsAt: at(day0, '23:30'), staff: [{ membershipId, role: 'PRIMARY' }], status: 'CONFIRMED', title: 'Ca hôm nay' }, newIdempotencyKey());
    const aTomorrow = await schedule.createAppointment(orgId, { startsAt: at(plus(day0, 1), '09:00'), endsAt: at(plus(day0, 1), '10:00'), status: 'CONFIRMED', title: 'Ca ngày mai chưa thợ' }, newIdempotencyKey());
    const aLater = await schedule.createAppointment(
      orgId,
      { startsAt: at(plus(day0, 3), '09:00'), endsAt: at(plus(day0, 3), '10:00'), staff: [{ membershipId, role: 'PRIMARY' }], newCustomer: { fullName: 'Khách sau đó' }, status: 'CONFIRMED', title: 'Ca sau đó' },
      newIdempotencyKey(),
    );
    // Hợp đồng đã xác nhận vừa xong (hợp đồng mới 24 giờ) với một đợt quá hạn hôm qua và một đợt tới hạn sau 2 ngày.
    const draft = await contracts.createContract(orgId, { customerId: customer.id, lines: [{ kind: 'CUSTOM', name: 'Thử hôm nay', unitPrice: 1_000_000, quantity: 1 }] }, newIdempotencyKey());
    const done = await contracts.changeContractStatus(orgId, draft.id, { to: 'CONFIRMED' });
    await payments.putInstallments(orgId, done.id, {
      installments: [
        { name: 'Đặt cọc', dueDate: at(plus(day0, -1), '00:00'), amount: 400_000, isDeposit: true },
        { name: 'Đợt hai', dueDate: at(plus(day0, 2), '00:00'), amount: 600_000 },
      ],
    });

    const v = await chk('today.getToday', today.getToday(orgId));
    expect(v).toMatchObject({ today: day0, tomorrow: plus(day0, 1), scheduleScope: 'ALL' });
    expect(v.appointments?.today.map((a) => a.id)).toContain(aToday.id);
    expect(v.appointments?.tomorrow.map((a) => a.id)).toEqual([aTomorrow.id]);
    expect(v.appointments?.later.map((a) => a.id)).toContain(aLater.id);
    expect(first(v.appointments?.later ?? [], 'ca sau đó').customer).not.toBeNull();
    expect(first(v.appointments?.today ?? [], 'ca hôm nay').staff).toHaveLength(1);
    expect(v.unassigned?.map((a) => a.id)).toEqual([aTomorrow.id]);
    expect(v.counts).toMatchObject({ unassignedSoon: 1, overdue: { count: 1, amount: 400_000 }, dueSoon: { count: 1, amount: 600_000 } });
    expect(first(v.installments?.overdue ?? [], 'đợt quá hạn')).toMatchObject({ name: 'Đặt cọc', amount: 400_000, outstanding: 400_000, status: 'OVERDUE', overdueDays: 1, isDeposit: true, contract: { id: done.id } });
    expect(first(v.installments?.dueSoon ?? [], 'đợt sắp tới hạn')).toMatchObject({ name: 'Đợt hai', outstanding: 600_000, overdueDays: 0, isDeposit: false });
    expect(v.newContracts?.map((c) => c.id)).toContain(done.id);
    expect(first(v.newContracts ?? [], 'hợp đồng mới').confirmedBy).not.toBeNull();
    // Tổ chức dịch vụ (TEAM): không có thẻ đào tạo → null, không phải mảng rỗng.
    expect(v.newEnrollments).toBeNull();
    expect(v.almostFullClasses).toBeNull();
  });

  it('đã gọi đủ mọi hàm gọi của các module nghiệp vụ', () => {
    expect(DOMAIN_HAM.filter((h) => !called.has(h))).toEqual([]);
  });
});
