import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as auth from './auth';
import * as certificates from './certificates';
import { api, setAccessToken } from './client';
import * as contracts from './contracts';
import * as courses from './courses';
import { errorKind } from './errors';
import * as files from './files';
import { newIdempotencyKey } from './idempotency';
import { napKieu, soKieu, type Kieu } from './khop-kieu';
import { orgPath } from './org';
import * as profile from './profile';
import * as schedule from './schedule';
import { frameInputOfView, certificateFrameQuery } from '../features/certificates/frame';
import { fetchImageBlob, refreshViewsOf } from '../features/certificates/render';
import { todayInTz } from '../features/certificates/logic';

// "Khớp hai đầu" của GIẤY CHỨNG NHẬN (bản vẽ F mục 9.3): chạy máy chủ API THẬT trên một database thử RIÊNG, gọi MỖI hàm của
// api/certificates.ts với dữ liệu thật (khoá + lớp đã kết thúc, hợp đồng khoá học xác nhận → ghi danh, ảnh học viên, logo,
// người ký), rồi so giá trị trả về với kiểu mà hàm đó khai: đủ/thừa tên trường, kiểu giá trị, giá trị liệt kê, chuỗi ISO, số
// nguyên đồng — lồng sâu tới từng phần tử mảng. Khuôn so đọc thẳng khai báo TypeScript lúc chạy (khop-kieu.ts → certificates.ts).
//
// Cần: PostgreSQL chạy, cổng 4127 trống, biến KHOP_CHUNG_NHAN_DATABASE_URL trỏ tới database thử riêng (tên bắt đầu makeup_test,
// vd. makeup_test_f_w2). Bài tự chạy `prisma migrate deploy` trên database đó trước khi bật máy chủ.

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(HERE, '..', '..', '..', 'api');
const PORT = Number(process.env.KHOP_CHUNG_NHAN_PORT ?? 4127);
const BASE = `http://localhost:${PORT}`;
const DB_ENV = 'KHOP_CHUNG_NHAN_DATABASE_URL';

function khopDatabaseUrl(): string {
  const url = process.env[DB_ENV];
  if (!url) {
    throw new Error(
      [
        `Thiếu biến môi trường ${DB_ENV} — bài "khớp hai đầu" không tự dùng database mặc định nào.`,
        'Tạo một database thử RIÊNG (tên bắt đầu makeup_test) rồi chạy lại, ví dụ:',
        '  su postgres -c "createdb -O makeup makeup_test_<ten_ban>"',
        `  su postgres -c "psql -d makeup_test_<ten_ban> -c 'CREATE EXTENSION IF NOT EXISTS btree_gist'"`,
        `  ${DB_ENV}=postgresql://makeup:<mật khẩu>@localhost:5432/makeup_test_<ten_ban> pnpm --filter @makeup/web exec vitest run src/api/khop-chung-nhan.test.ts`,
      ].join('\n'),
    );
  }
  let dbName: string;
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error(`${DB_ENV} không phải chuỗi kết nối hợp lệ (dạng postgresql://user:pass@host:5432/makeup_test_xxx)`);
  }
  if (!/^makeup_test[a-z0-9_]*$/.test(dbName)) {
    throw new Error(`Từ chối chạy bài thử trên database "${dbName}": ${DB_ENV} phải trỏ tới database thử có tên bắt đầu makeup_test`);
  }
  return url;
}

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

// Gói thử không giới hạn (như apps/api/test/helpers.ts grantUnlimitedPlan) để tổ chức đào tạo có khoá / học viên.
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

// Mọi hàm gọi của api/certificates.ts: thêm hàm mới mà bài này chưa gọi → bài "đã gọi đủ" đỏ.
const HAM = Object.entries(certificates)
  .filter(([, v]) => typeof v === 'function')
  .map(([fn]) => `certificates.${fn}`);
let KIEU: Record<string, Kieu> = {};
const called = new Set<string>();

// Gọi một hàm của web và so giá trị nó trả về với kiểu hàm đó khai.
async function chk<T>(ham: string, p: Promise<T>, label = ham): Promise<T> {
  const kieu = KIEU[ham];
  if (!kieu) throw new Error(`Chưa nạp kiểu cho ${ham}`);
  const v = await p;
  called.add(ham);
  expect(soKieu(v, kieu, label), `${label} lệch kiểu khai trong certificates.ts`).toEqual([]);
  return v;
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

function addDays(wire: string, n: number): string {
  const d = new Date(`${wire}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
  KIEU = napKieu(join(HERE, 'certificates.ts'), join(HERE, '..', '..', 'tsconfig.json'), Object.fromEntries(HAM.map((h) => [h, `ham:${h}`])));
  storageDir = mkdtempSync(join(tmpdir(), 'khop-chung-nhan-tep-'));
  server = spawn(join(API_DIR, 'node_modules', '.bin', 'tsx'), ['src/server.ts'], {
    cwd: API_DIR,
    detached: true,
    env: {
      PATH: process.env.PATH ?? '',
      NODE_ENV: 'development',
      PORT: String(PORT),
      DATABASE_URL: db,
      DIRECT_URL: db,
      JWT_ACCESS_SECRET: 'khop-chung-nhan-chi-dung-cho-bai-thu-0123456789',
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

describe('certificates.ts khớp đúng dữ liệu máy chủ thật trả về (tên trường và kiểu giá trị)', () => {
  const stamp = Date.now();
  let orgId = '';
  let classId = '';
  let endDate = '';
  let today = '';
  const enrollmentIds: string[] = [];
  const customerIds: string[] = [];
  let issued: certificates.CertificateView[] = [];
  let tuition = 0;

  it('dựng dữ liệu: tổ chức đào tạo, khoá + lớp đã kết thúc, 3 học viên ghi danh (một người có ảnh), logo', async () => {
    await auth.register({ fullName: 'Thợ Khớp Chứng Nhận', email: `khop-cn-${stamp}@makeup.test`, password: 'mat-khau-khop-du-dai' }, newIdempotencyKey());
    const created = await auth.createOrganization({ name: `Học viện khớp ${stamp}`, slug: `cn-${stamp}`, kind: 'ACADEMY' }, newIdempotencyKey());
    orgId = created.id;
    grantUnlimitedPlan(khopDatabaseUrl(), orgId);
    today = todayInTz(created.timezone);
    endDate = addDays(today, -3);
    tuition = 5_000_000;
    const made = await courses.createCourse(
      orgId,
      {
        name: 'Makeup chuyên nghiệp',
        mode: 'MULTI_CLASS',
        tuitionFee: tuition,
        defaultCapacity: 10,
        firstClass: { name: 'K12', startDate: addDays(endDate, -30), endDate, weekdays: [2] },
      },
      newIdempotencyKey(),
    );
    classId = first(made.classes, 'lớp đầu tiên').id;

    const names = ['Lê Thị Mai', 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', 'Đặng Quỳnh Như'];
    for (const fullName of names) {
      const c = await schedule.createCustomer(orgId, { fullName }, newIdempotencyKey());
      customerIds.push(c.id);
      const contract = await contracts.createContract(orgId, { kind: 'COURSE', customerId: c.id, lines: [{ kind: 'COURSE', courseClassId: classId }] }, newIdempotencyKey());
      await contracts.changeContractStatus(orgId, contract.id, { to: 'CONFIRMED' });
    }
    const roster = await courses.listEnrollments(orgId, classId);
    expect(roster.items).toHaveLength(3);
    for (const id of customerIds) enrollmentIds.push(first(roster.items.filter((e) => e.customer.id === id), 'ghi danh').id);

    // Ảnh học viên đầu tiên (tệp CUSTOMER_AVATAR, 400×500) + logo trung tâm (ORG_LOGO) qua hồ sơ thương hiệu.
    const avatar = await files.uploadFile(orgId, { purpose: 'CUSTOMER_AVATAR', name: 'mai.png', data: makePng(400, 500) }, newIdempotencyKey());
    await api.patch(orgPath(orgId, `/customers/${customerIds[0]}`), { avatarFileId: avatar.id });
    const logo = await files.uploadFile(orgId, { purpose: 'ORG_LOGO', name: 'logo.png', data: makePng(64, 64) }, newIdempotencyKey());
    await profile.putBrandProfile(orgId, { brandName: 'Học viện Chiến Makeup', logoFileId: logo.id });
  }, 120_000);

  it('người ký: chưa có hồ sơ → hasProfile false; đặt người ký bằng đường PUT; chưa có hồ sơ thì 409', async () => {
    // Tổ chức thứ hai chưa có hồ sơ thương hiệu: GET trả hasProfile false, PUT → 409 PROFILE_REQUIRED.
    const other = await auth.createOrganization({ name: `Chưa hồ sơ ${stamp}`, slug: `cn-trong-${stamp}`, kind: 'ACADEMY' }, newIdempotencyKey());
    const none = await chk('certificates.getCertificateSigner', certificates.getCertificateSigner(other.id), 'getCertificateSigner (chưa có hồ sơ)');
    expect(none).toEqual({ hasProfile: false, signerName: null, signerTitle: null, defaultTitle: 'Giám đốc trung tâm' });
    const err: unknown = await certificates.putCertificateSigner(other.id, { signerName: 'A', signerTitle: null }).catch((e: unknown) => e);
    expect(errorKind(err)).toBe('conflict');
    expect((err as { details?: { reason?: string } }).details?.reason).toBe('PROFILE_REQUIRED');

    const set = await chk('certificates.putCertificateSigner', certificates.putCertificateSigner(orgId, { signerName: 'Nguyễn Trọng Chiến', signerTitle: null }));
    expect(set).toEqual({ hasProfile: true, signerName: 'Nguyễn Trọng Chiến', signerTitle: null, defaultTitle: 'Giám đốc trung tâm' });
    expect((await chk('certificates.getCertificateSigner', certificates.getCertificateSigner(orgId))).signerName).toBe('Nguyễn Trọng Chiến');
  });

  it('danh sách cấp của lớp: lớp đã kết thúc, số dự kiến, tiền thấy được, ảnh học viên có URL', async () => {
    const r = await chk('certificates.getClassCertificateRoster', certificates.getClassCertificateRoster(orgId, classId, { issuedOn: endDate }));
    expect(r.ended).toBe(true);
    expect(r.defaultIssuedOn).toBe(endDate);
    expect(r.moneyVisible).toBe(true);
    expect(r.today).toBe(today);
    expect(r.nextNumber).toEqual({ year: Number(endDate.slice(0, 4)), seq: 1, code: `CC-${endDate.slice(0, 4)}-0001` });
    expect(r.signer).toEqual({ name: 'Nguyễn Trọng Chiến', title: 'Giám đốc trung tâm' });
    expect(r.items).toHaveLength(3);
    const withPhoto = r.items.filter((i) => i.customer.photo !== null);
    expect(withPhoto).toHaveLength(1);
    expect(withPhoto[0]?.customer.photo).toMatchObject({ width: 400, height: 500 });
    expect(r.logo).not.toBeNull();
    for (const it of r.items) {
      expect(it.certificate).toBeNull();
      expect(it.contract).toMatchObject({ total: tuition, paid: 0, debt: tuition });
      expect(Number.isInteger(it.contract.debt)).toBe(true);
    }
  });

  it('cấp hàng loạt: 3 giấy liên tiếp, cảnh báo nợ không chặn; cùng khoá chống gửi trùng → cùng phản hồi', async () => {
    const key = newIdempotencyKey();
    const body: certificates.IssueInput = { enrollmentIds, templateCode: 'cc-05', issuedOn: endDate, fontOverride: 'ky-2' };
    const res = await chk('certificates.issueCertificates', certificates.issueCertificates(orgId, classId, body, key));
    expect(res.issuedCount).toBe(3);
    expect(res.existingCount).toBe(0);
    expect(res.debtWarnings).toHaveLength(3);
    for (const w of res.debtWarnings) expect(w.debt).toBe(tuition);
    issued = res.items;
    const year = endDate.slice(0, 4);
    expect(issued.map((c) => c.code)).toEqual([`CC-${year}-0001`, `CC-${year}-0002`, `CC-${year}-0003`]);
    for (const c of issued) {
      expect(c).toMatchObject({ status: 'ISSUED', templateCode: 'cc-05', fontOverride: 'ky-2', issuedOn: endDate, reissueNo: 0, reissuedOn: null, courseName: 'Makeup chuyên nghiệp', className: 'K12', signerName: 'Nguyễn Trọng Chiến', brandName: 'Học viện Chiến Makeup' });
      expect(c.logo).not.toBeNull();
    }
    expect(issued.filter((c) => c.photo !== null)).toHaveLength(1);
    // Gửi lại cùng khoá, cùng thân: đúng phản hồi lần đầu.
    const again = await certificates.issueCertificates(orgId, classId, body, key);
    expect(again.items.map((c) => c.id)).toEqual(issued.map((c) => c.id));
    expect(again.issuedCount).toBe(3);
  });

  it('URL ảnh ký lấy được thật: tải về blob cùng nguồn đúng như bộ in làm (render.ts)', async () => {
    const withPhoto = first(issued.filter((c) => c.photo !== null), 'giấy có ảnh');
    const blob = await fetchImageBlob((withPhoto.photo as certificates.SignedPhoto).url);
    expect(blob.size).toBeGreaterThan(0);
    const logo = await fetchImageBlob((withPhoto.logo as certificates.SignedImage).url);
    expect(logo.size).toBeGreaterThan(0);
    // Bản in dựng được tham số mẫu từ chính dữ liệu máy chủ trả (chữ chụp lúc cấp).
    const q = new URLSearchParams(certificateFrameQuery(frameInputOfView(withPhoto), { photo: 'blob:x/p', logo: 'blob:x/l' }));
    expect(q.get('ten')).toBe(withPhoto.studentName);
    expect(q.get('so')).toBe(withPhoto.code);
    expect(q.get('ncap')).toBe(endDate.split('-').reverse().join('/'));
    expect(q.get('ky')).toBe('2');
    expect(q.get('gd')).toBe('Nguyễn Trọng Chiến');
  });

  it('sổ: lọc theo lớp / năm / từ khoá / ids; refreshViewsOf lấy lại URL ảnh mới theo mã', async () => {
    const year = Number(endDate.slice(0, 4));
    const page = await chk('certificates.listCertificates', certificates.listCertificates(orgId, { classId, year, status: 'ISSUED' }));
    expect(page.total).toBe(3);
    expect(page.years).toEqual([year]);
    expect(page.items.map((c) => c.code)).toEqual([`CC-${year}-0003`, `CC-${year}-0002`, `CC-${year}-0001`]);
    const byName = await certificates.listCertificates(orgId, { q: 'Quỳnh Như' });
    expect(byName.items.map((c) => c.studentName)).toEqual(['Đặng Quỳnh Như']);
    const ids = issued.slice(0, 2).map((c) => c.id);
    const byIds = await chk('certificates.listCertificates', certificates.listCertificates(orgId, { ids }), 'listCertificates (ids)');
    expect(byIds.items.map((c) => c.id).sort()).toEqual([...ids].sort());
    const fresh = await refreshViewsOf(orgId)(issued.map((c) => c.id));
    expect(fresh.map((c) => c.id).sort()).toEqual(issued.map((c) => c.id).sort());
    // Mã bịa / mã sai dạng: 400, bản in không lấy được URL mới.
    const bad: unknown = await certificates.listCertificates(orgId, { ids: ['khong-phai-uuid'] }).catch((e: unknown) => e);
    expect(errorKind(bad)).toBe('validation');
  });

  it('một bản: getCertificate trả đúng một giấy, mã bịa 404', async () => {
    const one = await chk('certificates.getCertificate', certificates.getCertificate(orgId, first(issued, 'giấy').id));
    expect(one.id).toBe(first(issued, 'giấy').id);
    const miss: unknown = await certificates.getCertificate(orgId, '00000000-0000-4000-8000-000000000000').catch((e: unknown) => e);
    expect(errorKind(miss)).toBe('not_found');
  });

  it('cấp lại giữ số: bản mới cùng số, reissueNo 1, có ngày cấp lại, tên đổi; bản cũ thu hồi; in lại dùng ảnh lúc cấp', async () => {
    const target = first(issued, 'giấy');
    const re = await chk(
      'certificates.reissueCertificate',
      certificates.reissueCertificate(orgId, target.id, { reason: 'Sai tên / sai dấu', studentName: 'Lê Thị Mai Hoa', templateCode: 'cc-01' }, newIdempotencyKey()),
    );
    expect(re).toMatchObject({ code: target.code, reissueNo: 1, status: 'ISSUED', studentName: 'Lê Thị Mai Hoa', templateCode: 'cc-01', replacesId: target.id, reissuedOn: today });
    const q = new URLSearchParams(certificateFrameQuery(frameInputOfView(re), { photo: null, logo: null }));
    expect(q.get('lai')).toBe(today.split('-').reverse().join('/'));
    const old = await certificates.getCertificate(orgId, target.id);
    expect(old).toMatchObject({ status: 'REVOKED', revokeReason: 'Sai tên / sai dấu', replacedById: re.id });
    issued = [re, ...issued.slice(1)];
  });

  it('thu hồi: bản bị thu hồi mang lý do; thu hồi lần hai → 409', async () => {
    const target = first(issued.slice(1), 'giấy');
    const rv = await chk('certificates.revokeCertificate', certificates.revokeCertificate(orgId, target.id, { reason: 'Cấp nhầm lớp' }));
    expect(rv).toMatchObject({ id: target.id, status: 'REVOKED', revokeReason: 'Cấp nhầm lớp' });
    expect(rv.revokedAt).not.toBeNull();
    const twice: unknown = await certificates.revokeCertificate(orgId, target.id, { reason: 'Lần hai' }).catch((e: unknown) => e);
    expect(errorKind(twice)).toBe('conflict');
    // Sau thu hồi, danh sách lớp báo "lastRevoked" cho người đó.
    const r = await certificates.getClassCertificateRoster(orgId, classId);
    const row = first(r.items.filter((i) => i.enrollmentId === target.enrollmentId), 'dòng');
    expect(row.certificate).toBeNull();
    expect(row.lastRevoked).toMatchObject({ id: target.id, revokeReason: 'Cấp nhầm lớp' });
  });

  it('đã gọi đủ mọi hàm gọi của certificates.ts', () => {
    expect([...called].sort()).toEqual([...HAM].sort());
  });
});
