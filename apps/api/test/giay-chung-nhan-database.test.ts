// Bản vẽ F mục 9.1 — bài thử GHI THẲNG database cho giấy chứng nhận (đi vòng qua máy chủ, sổ lỗi 24).
// Migration 20261019210000_giay_chung_nhan. Mỗi chốt (CHECK, khoá ngoại kép theo tổ chức, chỉ mục duy nhất / một phần,
// NOT NULL, trigger) có:
//   - ca VI PHẠM: phải bị chặn đúng mã Postgres VÀ đúng tên chốt (hoặc đúng lời của trigger). Chốt bị bỏ thì ca này ghi
//     được hoặc bị chốt khác chặn → đỏ;
//   - ca HỢP LỆ (vế GIỮ): phải ghi được (chốt viết quá tay chặn nhầm → đỏ).
// Cột cho phép NULL nào nằm trong CHECK cũng có ca ghi thẳng NULL. Trigger BEFORE chạy TRƯỚC CHECK, nên mỗi ca CHECK được
// dựng sao cho trigger cho qua (vd. thu hồi thử bằng UPDATE vì INSERT bản REVOKED bị trigger chặn trước).
// Ba chốt là lưới thứ hai (khi các chốt khác còn thì không ca ghi nào chạm tới chúng trước): certificates_code_issued,
// certificates_replaced_once (certificates_number_key bắt trước) và certificates_org/class/customer_fkey (trigger hoặc khoá
// 4 cột bắt trước). Chúng được kiểm bằng danh mục (pg_constraint / pg_indexes) ở khối cuối: bỏ một chốt → khối đó đỏ.
// Dùng SQL thô cho bảng certificates (không qua mô hình Prisma của bảng mới).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { certificateCode } from '@makeup/shared';
import { pgErrorCode } from '../src/http/middleware';
import { createAcademyOrg, makeApp, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;

interface Enr {
  id: string;
  classId: string;
  customerId: string;
}

interface Org {
  id: string;
  tz: string;
  today: string; // YYYY-MM-DD theo múi giờ của tổ chức
  courseId: string;
  k1: string; // lớp đã kết thúc 2026-03-05
  k2: string; // lớp khác, đã kết thúc 2026-03-05
  kOld: string; // lớp kết thúc 2025-12-20 (đánh số năm 2025)
  kToday: string; // lớp kết thúc HÔM NAY theo múi giờ tổ chức
  kRunning: string; // lớp chưa kết thúc (kết thúc sau hôm nay 30 ngày)
  kCancelled: string; // lớp đã huỷ (đã qua ngày kết thúc)
  file: string; // tệp của tổ chức này
  seq: number; // số thứ tự kế tiếp dùng trong bài (từ 100)
}

let owner: TestUser;
let A: Org;
let B: Org;

// ---------- Ghi SQL thô + đếm ca ----------
type Outcome = { ok: true; n: number } | { ok: false; code: string | null; text: string };

const str = (s: string) => `'${s.replace(/'/g, "''")}'`;
const uuid = (s: string) => `${str(s)}::uuid`;
const date = (d: string) => `${str(d)}::date`;

async function run(sql: string): Promise<Outcome> {
  try {
    const n = await db.$executeRawUnsafe(sql);
    return { ok: true, n };
  } catch (err) {
    const meta = (err as { meta?: unknown }).meta;
    return { ok: false, code: pgErrorCode(err), text: `${String((err as Error).message)} ${JSON.stringify(meta ?? {})}` };
  }
}

const tally = { blocked: 0, blockedTotal: 0, allowed: 0, allowedTotal: 0 };

// Ca vi phạm: phải bị chặn đúng mã và đúng chốt.
//   - 'Key (…)=' : chốt duy nhất (lời Postgres qua Prisma kèm cột);
//   - 'msg:…'    : lời của RAISE EXCEPTION trong trigger;
//   - còn lại    : tên chốt CHECK / khoá ngoại.
function expectBlocked(label: string, out: Outcome, code: string, constraint?: string) {
  tally.blockedTotal++;
  const needle = !constraint
    ? ''
    : constraint.startsWith('Key (')
      ? constraint
      : constraint.startsWith('msg:')
        ? constraint.slice(4)
        : `"${constraint}"`;
  const hit = !out.ok && out.code === code && out.text.includes(needle);
  if (hit) tally.blocked++;
  expect(hit, `${label}: mong bị chặn ${code}${constraint ? ` bởi ${constraint}` : ''}, nhận ${out.ok ? 'GHI ĐƯỢC' : `${out.code} ${out.text.slice(0, 400)}`}`).toBe(true);
}

// Ca hợp lệ: ghi được, và (với UPDATE / DELETE) đúng 1 dòng.
function expectAllowed(label: string, out: Outcome, rows = 1) {
  tally.allowedTotal++;
  const hit = out.ok && out.n === rows;
  if (hit) tally.allowed++;
  expect(hit, `${label}: mong ghi được ${rows} dòng, nhận ${out.ok ? `${out.n} dòng` : `${out.code} ${out.text.slice(0, 400)}`}`).toBe(true);
}

// Lời của trigger (khớp đúng chữ trong migration).
const G_NEW_STATUS = 'msg:Giấy chứng nhận mới phải ở trạng thái đã cấp';
const G_CLASS = 'msg:Lớp không tồn tại hoặc đã huỷ';
const G_BEFORE_END = 'msg:Ngày cấp phải từ ngày kết thúc lớp';
const G_FUTURE = 'msg:Ngày cấp không được sau hôm nay';
const G_ENROLLMENT = 'msg:Ghi danh không còn hiệu lực';
const G_REISSUE = 'msg:Cấp lại phải từ bản đã thu hồi và số lần cấp lại tăng đúng 1';
const U_REVOKED = 'msg:Giấy chứng nhận đã thu hồi: không được thay đổi';
const U_ONLY_REVOKE = 'msg:Giấy chứng nhận đã cấp: chỉ được thu hồi, không sửa';
const U_FROZEN = 'msg:Giấy chứng nhận đã cấp: số, tên, mẫu, ngày cấp không sửa được';
const D_NO_DELETE = 'msg:Sổ giấy chứng nhận chỉ ghi thêm, không xoá';

// ---------- Dựng bản ghi ----------
const num = (seq: number, year = 2026) => ({ year: String(year), seq: String(seq), code: str(`CC-${year}-${String(seq).padStart(4, '0')}`) });
const nextNum = (org: Org, year = 2026) => num(org.seq++, year);

function insertSql(cols: Record<string, string>): string {
  const names = Object.keys(cols).map((c) => `"${c}"`).join(', ');
  return `INSERT INTO "certificates" (${names}) VALUES (${Object.values(cols).join(', ')})`;
}

// Một bản gốc hợp lệ (ngày cấp 2026-03-10, sau ngày kết thúc lớp k1 2026-03-05); `over` ghi đè từng cột bằng mảnh SQL.
async function insertCert(org: Org, enr: Enr, over: Record<string, string> = {}) {
  const id = randomUUID();
  const n = over.seq === undefined && over.code === undefined ? nextNum(org) : {};
  const out = await run(
    insertSql({
      id: uuid(id),
      organization_id: uuid(org.id),
      enrollment_id: uuid(enr.id),
      course_class_id: uuid(enr.classId),
      customer_id: uuid(enr.customerId),
      ...n,
      reissue_no: '0',
      issued_on: date('2026-03-10'),
      reissued_on: 'NULL',
      template_code: `'cc-01'`,
      template_version: '1',
      font_override: 'NULL',
      background_style: 'NULL',
      background_file_id: 'NULL',
      frame_style: 'NULL',
      student_name: str('Nguyễn Thị Hoa'),
      course_name: str('Makeup cá nhân'),
      class_name: str('K1'),
      instructor_name: str('Trần Minh Thư'),
      signer_name: 'NULL',
      signer_title: 'NULL',
      brand_name: str('Học viện Hoa'),
      photo_file_id: 'NULL',
      logo_file_id: 'NULL',
      status: `'ISSUED'`,
      revoked_at: 'NULL',
      revoke_reason: 'NULL',
      revoked_by_id: 'NULL',
      replaces_id: 'NULL',
      issued_by_id: uuid(owner.id),
      ...over,
    }),
  );
  return { id, out };
}

async function mustOk<T extends { out: Outcome }>(label: string, p: Promise<T>): Promise<T> {
  const r = await p;
  if (!r.out.ok) throw new Error(`Dựng dữ liệu "${label}" thất bại: ${r.out.code} ${r.out.text}`);
  return r;
}

// Thu hồi đủ cột (vế GIỮ của chốt trạng thái).
const REVOKE_SET = (by = owner.id) => `status = 'REVOKED', revoked_at = now(), revoke_reason = 'Sai tên', revoked_by_id = ${uuid(by)}`;
const updateCert = (id: string, set: string) => run(`UPDATE "certificates" SET ${set} WHERE id = ${uuid(id)}`);
async function revoke(id: string) {
  const out = await updateCert(id, REVOKE_SET());
  if (!out.ok || out.n !== 1) throw new Error(`Thu hồi ${id} thất bại: ${JSON.stringify(out)}`);
}

// Bản cấp lại của `prev` (đã thu hồi): cùng số, reissue_no = prevReissue + 1.
function reissueOver(prevId: string, n: { year: string; seq: string; code: string }, reissueNo = 1, over: Record<string, string> = {}) {
  return { ...n, replaces_id: uuid(prevId), reissue_no: String(reissueNo), reissued_on: date('2026-04-01'), ...over };
}

// Bản gốc đã thu hồi + số của nó (để thử cấp lại).
async function revokedOriginal(org: Org, enr?: Enr) {
  const e = enr ?? (await newEnrollment(org));
  const n = nextNum(org);
  const { id } = await mustOk('bản gốc', insertCert(org, e, n));
  await revoke(id);
  return { id, n, enr: e };
}

let counter = 0;
async function newEnrollment(org: Org, classId = org.k1, status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE'): Promise<Enr> {
  const tag = `${++counter}-${randomUUID().slice(0, 6)}`;
  const customer = await db.customer.create({ data: { organizationId: org.id, fullName: `Học viên ${tag}` } });
  const contract = await db.contract.create({
    data: { organizationId: org.id, code: `HĐKH-F-${tag}`, kind: 'COURSE', customerId: customer.id, createdById: owner.id },
  });
  const line = await db.contractLine.create({
    data: { organizationId: org.id, contractId: contract.id, kind: 'COURSE', name: `Lớp ${tag}`, unitPrice: 0n, lineTotal: 0n, courseClassId: classId, createdById: owner.id },
  });
  const e = await db.enrollment.create({
    data: {
      organizationId: org.id,
      courseClassId: classId,
      contractId: contract.id,
      contractLineId: line.id,
      customerId: customer.id,
      status,
      enrolledAt: new Date(),
      ...(status === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: 'Thử' } : {}),
    },
  });
  return { id: e.id, classId, customerId: customer.id };
}

async function todayIn(tz: string): Promise<string> {
  const rows = await db.$queryRawUnsafe<Array<{ d: string }>>(`SELECT ((now() AT TIME ZONE $1)::date)::text AS d`, tz);
  return rows[0]!.d;
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function buildOrg(app: ReturnType<typeof makeApp>, label: string, tz: string): Promise<Org> {
  const orgId = await createAcademyOrg(app, owner, label);
  await db.organization.update({ where: { id: orgId }, data: { timezone: tz } });
  const today = await todayIn(tz);
  const course = await db.course.create({
    data: { organizationId: orgId, code: `KH-F-${randomUUID().slice(0, 6)}`, name: 'Makeup cá nhân', mode: 'MULTI_CLASS', tuitionFee: 0n, defaultCapacity: 20, createdById: owner.id },
  });
  const klass = async (name: string, start: string, end: string, status: 'OPEN' | 'CLOSED' | 'CANCELLED' = 'OPEN') =>
    (
      await db.courseClass.create({
        data: { organizationId: orgId, courseId: course.id, name, startDate: new Date(start), endDate: new Date(end), weekdays: [2, 4], capacity: 20, status, createdById: owner.id },
      })
    ).id;
  const file = await db.storedFile.create({
    data: { organizationId: orgId, purpose: 'CUSTOMER_AVATAR', storageKey: `f-s1a/${randomUUID()}.jpg`, originalName: 'anh.jpg', mimeType: 'image/jpeg', sizeBytes: 100n, status: 'READY', createdById: owner.id },
  });
  return {
    id: orgId,
    tz,
    today,
    courseId: course.id,
    k1: await klass('K1', '2026-01-05', '2026-03-05'),
    k2: await klass('K2', '2026-01-06', '2026-03-05', 'CLOSED'),
    kOld: await klass('K2025', '2025-10-01', '2025-12-20', 'CLOSED'),
    kToday: await klass('Hôm nay', addDays(today, -20), today),
    kRunning: await klass('Đang học', addDays(today, -5), addDays(today, 30)),
    kCancelled: await klass('Đã huỷ', '2026-01-05', '2026-03-05', 'CANCELLED'),
    file: file.id,
    // Bộ đếm của bài bắt đầu từ 100: các số nhỏ (1..7) dành cho ca ghi số cố định ở khối certificates_number.
    seq: 100,
  };
}

const count = async (sql: string) => Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(sql))[0]!.n);

beforeAll(async () => {
  const app = makeApp(deps);
  owner = await registerUser(app, 'f-s1a');
  // Hai múi giờ lệch xa UTC (+14 và −11): giờ nào trong ngày cũng có ít nhất một tổ chức mà "hôm nay" khác ngày UTC,
  // nên trigger lỡ tính "hôm nay" theo UTC / múi giờ máy thì bài "hôm nay / ngày mai" đỏ.
  A = await buildOrg(app, 'f-s1a-a', 'Pacific/Kiritimati');
  B = await buildOrg(app, 'f-s1a-b', 'Pacific/Pago_Pago');
});

afterAll(async () => {
  console.log(
    `[bản vẽ F — database] ca vi phạm bị chặn ${tally.blocked}/${tally.blockedTotal}; ca hợp lệ ghi được ${tally.allowed}/${tally.allowedTotal}`,
  );
  await db.$disconnect();
});

// ======================================================================================================
describe('certificates_number — số CC-<năm>-<seq>', () => {
  it('mã khớp năm + số; từ 10000 in đủ chữ số; năm = năm ngày cấp; miền năm / seq / reissue_no', async () => {
    const e = () => newEnrollment(B);
    // Vế GIỮ: đúng hàm certificateCode của packages/shared (máy chủ và database cùng một luật).
    for (const seq of [1, 9999, 10000, 999_999]) {
      expectAllowed(`seq ${seq} = ${certificateCode(2026, seq)}`, (await insertCert(B, await e(), { year: '2026', seq: String(seq), code: str(certificateCode(2026, seq)) })).out);
    }
    const bad: Array<[string, Record<string, string>]> = [
      ['mã lệch seq (seq 2, mã 0003)', { year: '2026', seq: '2', code: `'CC-2026-0003'` }],
      ['mã lệch năm (năm 2026, mã CC-2025)', { year: '2026', seq: '3', code: `'CC-2025-0003'` }],
      ['mã thiếu số 0 đầu (CC-2026-4)', { year: '2026', seq: '4', code: `'CC-2026-4'` }],
      ['mã chữ thường', { year: '2026', seq: '5', code: `'cc-2026-0005'` }],
      ['seq 10000 mà mã cắt còn 4 chữ số', { year: '2026', seq: '10000', code: `'CC-2026-1000'` }],
      ['seq 10001 mà mã có số 0 đầu', { year: '2026', seq: '10001', code: `'CC-2026-010001'` }],
      ['seq = 0', { year: '2026', seq: '0', code: `'CC-2026-0000'` }],
      ['seq âm', { year: '2026', seq: '-1', code: `'CC-2026--001'` }],
      ['seq 1000000 (quá trần)', { year: '2026', seq: '1000000', code: `'CC-2026-1000000'` }],
      ['năm khác năm ngày cấp (2025, cấp 2026-03-10)', { year: '2025', seq: '6', code: `'CC-2025-0006'` }],
      ['reissue_no âm', { ...num(7), reissue_no: '-1' }],
    ];
    for (const [label, over] of bad) expectBlocked(label, (await insertCert(B, await e(), over)).out, '23514', 'certificates_number');
  });

  it('đánh số theo năm: cùng seq ở năm khác / tổ chức khác ghi được', async () => {
    const n = nextNum(A);
    expectAllowed('A 2026', (await insertCert(A, await newEnrollment(A), n)).out);
    expectAllowed('A 2025 cùng seq (lớp kết thúc 2025-12-20)', (await insertCert(A, await newEnrollment(A, A.kOld), { ...num(Number(n.seq), 2025), issued_on: date('2025-12-31') })).out);
    expectAllowed('B 2026 cùng seq', (await insertCert(B, await newEnrollment(B), num(Number(n.seq) + 500_000))).out);
  });
});

// ======================================================================================================
describe('certificates_status — đã cấp / đã thu hồi (bẫy NULL: ghi thẳng NULL từng cột)', () => {
  it('bản ISSUED không mang dấu vết thu hồi', async () => {
    const bad: Array<[string, Record<string, string>]> = [
      ['ISSUED có revoked_at', { revoked_at: 'now()' }],
      ['ISSUED có revoke_reason', { revoke_reason: `'Sai tên'` }],
      ['ISSUED có revoked_by_id', { revoked_by_id: uuid(owner.id) }],
    ];
    for (const [label, over] of bad) expectBlocked(label, (await insertCert(A, await newEnrollment(A), over)).out, '23514', 'certificates_status');
  });

  it('thu hồi (UPDATE): thiếu / rỗng / quá dài từng cột bị chặn; đủ cột ghi được', async () => {
    const { id } = await mustOk('bản để thu hồi', insertCert(A, await newEnrollment(A)));
    const bad: Array<[string, string]> = [
      ['revoke_reason NULL', `status = 'REVOKED', revoked_at = now(), revoke_reason = NULL, revoked_by_id = ${uuid(owner.id)}`],
      ['revoke_reason "   "', `status = 'REVOKED', revoked_at = now(), revoke_reason = '   ', revoked_by_id = ${uuid(owner.id)}`],
      ['revoke_reason rỗng', `status = 'REVOKED', revoked_at = now(), revoke_reason = '', revoked_by_id = ${uuid(owner.id)}`],
      ['revoke_reason 501 ký tự', `status = 'REVOKED', revoked_at = now(), revoke_reason = ${str('ễ'.repeat(501))}, revoked_by_id = ${uuid(owner.id)}`],
      ['revoked_by_id NULL', `status = 'REVOKED', revoked_at = now(), revoke_reason = 'Sai tên', revoked_by_id = NULL`],
      ['revoked_at NULL', `status = 'REVOKED', revoked_at = NULL, revoke_reason = 'Sai tên', revoked_by_id = ${uuid(owner.id)}`],
    ];
    for (const [label, set] of bad) expectBlocked(label, await updateCert(id, set), '23514', 'certificates_status');
    expectAllowed('thu hồi đủ cột, lý do 500 ký tự', await updateCert(id, `status = 'REVOKED', revoked_at = now(), revoke_reason = ${str('ễ'.repeat(500))}, revoked_by_id = ${uuid(owner.id)}`));
  });
});

// ======================================================================================================
describe('certificates_reissue — bản gốc / bản cấp lại (bẫy NULL)', () => {
  it('bản cấp lại thiếu replaces_id / reissued_on, hoặc cấp lại trước ngày cấp → chặn; bản gốc có ngày cấp lại → chặn', async () => {
    const p1 = await revokedOriginal(A);
    expectBlocked('reissue_no 1 + reissued_on NULL', (await insertCert(A, p1.enr, reissueOver(p1.id, p1.n, 1, { reissued_on: 'NULL' }))).out, '23514', 'certificates_reissue');
    expectBlocked('reissued_on trước issued_on', (await insertCert(A, p1.enr, reissueOver(p1.id, p1.n, 1, { reissued_on: date('2026-03-09') }))).out, '23514', 'certificates_reissue');
    const p2 = await revokedOriginal(A);
    expectBlocked('reissue_no 1 + replaces_id NULL', (await insertCert(A, p2.enr, reissueOver(p2.id, p2.n, 1, { replaces_id: 'NULL' }))).out, '23514', 'certificates_reissue');
    expectBlocked('bản gốc (reissue_no 0) có reissued_on', (await insertCert(A, await newEnrollment(A), { reissued_on: date('2026-04-01') })).out, '23514', 'certificates_reissue');
    // Bản gốc trỏ bản cũ: trigger chặn trước (0 ≠ reissue_no cũ + 1) — CHECK là lưới sau.
    const p3 = await revokedOriginal(A);
    expectBlocked('reissue_no 0 có replaces_id', (await insertCert(A, p3.enr, reissueOver(p3.id, p3.n, 0))).out, '23514', G_REISSUE);
    // Vế GIỮ: cấp lại đúng (ngày cấp lại = ngày cấp cũng được), rồi cấp lại lần 2 từ bản cấp lại.
    const r1 = await insertCert(A, p1.enr, reissueOver(p1.id, p1.n, 1, { reissued_on: date('2026-03-10') }));
    expectAllowed('cấp lại lần 1 (giữ số)', r1.out);
    await revoke(r1.id);
    expectAllowed('cấp lại lần 2 từ bản cấp lại', (await insertCert(A, p1.enr, reissueOver(r1.id, p1.n, 2))).out);
    expect(await count(`SELECT count(*) AS n FROM certificates WHERE organization_id = ${uuid(A.id)} AND year = ${p1.n.year} AND seq = ${p1.n.seq}`)).toBe(3);
    expect(await count(`SELECT count(*) AS n FROM certificates WHERE organization_id = ${uuid(A.id)} AND year = ${p1.n.year} AND seq = ${p1.n.seq} AND status = 'ISSUED'`)).toBe(1);
  });
});

// ======================================================================================================
describe('certificates_template — mẫu, phông', () => {
  it('chỉ mẫu cc-NN, phiên bản ≥ 1, phông ky-1..ky-4 hoặc NULL', async () => {
    const bad: Array<[string, Record<string, string>]> = [
      ['mẫu shd-01', { template_code: `'shd-01'` }],
      ['mẫu cc-1', { template_code: `'cc-1'` }],
      ['mẫu CC-01', { template_code: `'CC-01'` }],
      ['mẫu cc-001', { template_code: `'cc-001'` }],
      ['phiên bản 0', { template_version: '0' }],
      ['phông ky-9', { font_override: `'ky-9'` }],
      ['phông rỗng', { font_override: `''` }],
    ];
    for (const [label, over] of bad) expectBlocked(label, (await insertCert(A, await newEnrollment(A), over)).out, '23514', 'certificates_template');
    expectAllowed('mẫu cc-16, phông ky-4', (await insertCert(A, await newEnrollment(A), { template_code: `'cc-16'`, font_override: `'ky-4'` })).out);
    expectAllowed('phông NULL (theo mẫu)', (await insertCert(A, await newEnrollment(A), { font_override: 'NULL' })).out);
  });
});

// ======================================================================================================
describe('certificates_background — chỗ chừa cho bộ nền', () => {
  it('có ảnh nền mà kiểu nền NULL → chặn; khoá kiểu nền / khung sai dạng → chặn', async () => {
    const bad: Array<[string, Record<string, string>]> = [
      ['ảnh nền có, kiểu nền NULL', { background_file_id: uuid(A.file), background_style: 'NULL' }],
      ['kiểu nền chữ hoa', { background_style: `'Hoa-Van'` }],
      ['kiểu nền rỗng', { background_style: `''` }],
      ['kiểu nền 65 ký tự', { background_style: str(`a${'b'.repeat(64)}`) }],
      ['khung có dấu cách', { frame_style: `'khung vat'` }],
      ['khung bắt đầu bằng gạch', { frame_style: `'-vat'` }],
    ];
    for (const [label, over] of bad) expectBlocked(label, (await insertCert(A, await newEnrollment(A), over)).out, '23514', 'certificates_background');
    expectAllowed('kiểu nền + ảnh nền + khung', (await insertCert(A, await newEnrollment(A), { background_style: `'hv:damask:vua'`, background_file_id: uuid(A.file), frame_style: `'vat-2'` })).out);
    expectAllowed('kiểu nền 64 ký tự, không ảnh', (await insertCert(A, await newEnrollment(A), { background_style: str(`a${'b'.repeat(63)}`) })).out);
  });
});

// ======================================================================================================
describe('certificates_texts — chữ chụp lúc cấp', () => {
  it('rỗng / toàn dấu cách / quá dài bị chặn (kể cả cột cho phép NULL); NULL ở cột cho phép thì ghi được', async () => {
    const bad: Array<[string, Record<string, string>]> = [
      ['student_name "  "', { student_name: `'  '` }],
      ['student_name rỗng', { student_name: `''` }],
      ['student_name 201 ký tự', { student_name: str('ễ'.repeat(201)) }],
      ['course_name "  "', { course_name: `'  '` }],
      ['class_name rỗng', { class_name: `''` }],
      ['brand_name "   "', { brand_name: `'   '` }],
      ['instructor_name rỗng', { instructor_name: `''` }],
      ['instructor_name "  "', { instructor_name: `'  '` }],
      ['signer_name rỗng', { signer_name: `''` }],
      ['signer_name 121 ký tự', { signer_name: str('ễ'.repeat(121)) }],
      ['signer_title "  "', { signer_title: `'  '` }],
    ];
    for (const [label, over] of bad) expectBlocked(label, (await insertCert(A, await newEnrollment(A), over)).out, '23514', 'certificates_texts');
    expectAllowed('giảng viên / người ký NULL', (await insertCert(A, await newEnrollment(A), { instructor_name: 'NULL', signer_name: 'NULL', signer_title: 'NULL' })).out);
    expectAllowed('tên 200 ký tự, người ký 120 ký tự', (await insertCert(A, await newEnrollment(A), { student_name: str('ễ'.repeat(200)), signer_name: str('ễ'.repeat(120)), signer_title: str('Giám đốc trung tâm') })).out);
  });
});

// ======================================================================================================
describe('organization_profiles_cert_signer — người ký trong hồ sơ', () => {
  it('rỗng / toàn dấu cách / quá 120 ký tự bị chặn; NULL và tên thật ghi được', async () => {
    await run(`INSERT INTO organization_profiles (organization_id, brand_name, updated_at) VALUES (${uuid(A.id)}, 'Học viện Hoa', now())`);
    const upd = (set: string) => run(`UPDATE organization_profiles SET ${set} WHERE organization_id = ${uuid(A.id)}`);
    const bad: Array<[string, string]> = [
      ['tên rỗng', `cert_signer_name = ''`],
      ['tên "   "', `cert_signer_name = '   '`],
      ['tên 121 ký tự', `cert_signer_name = ${str('ễ'.repeat(121))}`],
      ['chức danh rỗng', `cert_signer_title = ''`],
      ['chức danh 121 ký tự', `cert_signer_title = ${str('ễ'.repeat(121))}`],
    ];
    for (const [label, set] of bad) expectBlocked(label, await upd(set), '23514', 'organization_profiles_cert_signer');
    expectAllowed('tên + chức danh', await upd(`cert_signer_name = 'Nguyễn Thị Hoa', cert_signer_title = ${str('ễ'.repeat(120))}`));
    expectAllowed('xoá về NULL', await upd(`cert_signer_name = NULL, cert_signer_title = NULL`));
  });
});

// ======================================================================================================
describe('duy nhất — một bản còn hiệu lực, số không dùng lại', () => {
  it('2 bản ISSUED cùng ghi danh bị chặn; thu hồi rồi thì cấp bản mới (số mới) được', async () => {
    const e = await newEnrollment(A);
    const first = await insertCert(A, e);
    expectAllowed('bản 1', first.out);
    expectBlocked('bản 2 cùng ghi danh (số khác)', (await insertCert(A, e)).out, '23505', 'Key (enrollment_id)=');
    await revoke(first.id);
    expectAllowed('sau thu hồi: bản mới số mới cùng ghi danh', (await insertCert(A, e)).out);
  });

  it('2 bản ISSUED cùng (tổ chức, năm, seq) khác ghi danh bị chặn; số đã thu hồi không dùng cho người khác', async () => {
    const n = nextNum(A);
    const first = await insertCert(A, await newEnrollment(A), n);
    expectAllowed('bản giữ số', first.out);
    expectBlocked('bản khác ghi danh, cùng số', (await insertCert(A, await newEnrollment(A), n)).out, '23505', 'Key (organization_id, year, seq, reissue_no)=');
    await revoke(first.id);
    expectBlocked('số đã thu hồi, người khác', (await insertCert(A, await newEnrollment(A), n)).out, '23505', 'Key (organization_id, year, seq, reissue_no)=');
  });

  it('một bản chỉ bị cấp lại một lần (không rẽ nhánh)', async () => {
    const p = await revokedOriginal(A);
    const r1 = await insertCert(A, p.enr, reissueOver(p.id, p.n));
    expectAllowed('cấp lại lần 1', r1.out);
    await revoke(r1.id);
    const branch = await insertCert(A, p.enr, reissueOver(p.id, p.n));
    // Chỉ mục certificates_number_key bắt trước certificates_replaced_once (cùng năm, seq, reissue_no) — chỉ cần 23505.
    expectBlocked('cấp lại lần 2 từ CHÍNH bản gốc', branch.out, '23505');
  });
});

// ======================================================================================================
describe('khoá ngoại — kép theo tổ chức, 4 cột theo ghi danh, cấp lại cùng ghi danh cùng số', () => {
  it('cấp lại trỏ bản của ghi danh khác / bản khác số → chặn (certificates_replaces_fkey)', async () => {
    const p = await revokedOriginal(A);
    const other = await newEnrollment(A);
    expectBlocked('trỏ bản của ghi danh khác (cùng số)', (await insertCert(A, other, reissueOver(p.id, p.n))).out, '23503', 'certificates_replaces_fkey');
    const q = await revokedOriginal(A, await newEnrollment(A));
    // Cùng ghi danh với p? Dựng bản thứ hai của CHÍNH ghi danh p (p đã thu hồi nên được cấp bản mới), rồi trỏ p với số mới.
    const pSecond = await revokedOriginal(A, p.enr);
    expectBlocked('trỏ bản khác số (cùng ghi danh)', (await insertCert(A, p.enr, reissueOver(p.id, pSecond.n))).out, '23503', 'certificates_replaces_fkey');
    expectAllowed('vế GIỮ: cấp lại đúng bản, đúng số', (await insertCert(A, q.enr, reissueOver(q.id, q.n))).out);
  });

  it('ghi danh của lớp khác / khách khác (khoá 4 cột) → chặn', async () => {
    const e = await newEnrollment(A);
    expectBlocked('course_class_id = lớp khác cùng tổ chức', (await insertCert(A, { ...e, classId: A.k2 })).out, '23503', 'certificates_enrollment_fkey');
    const otherCustomer = (await newEnrollment(A)).customerId;
    expectBlocked('customer_id = khách khác cùng tổ chức', (await insertCert(A, { ...e, customerId: otherCustomer })).out, '23503', 'certificates_enrollment_fkey');
    expectAllowed('vế GIỮ: đúng lớp, đúng khách', (await insertCert(A, e)).out);
  });

  it('ghi danh / lớp của tổ chức khác, mã bịa → chặn (trigger tra theo (id, tổ chức) chặn trước khoá ngoại)', async () => {
    const eB = await newEnrollment(B);
    const eA = await newEnrollment(A);
    expectBlocked('ghi danh + lớp + khách của B trong tổ chức A', (await insertCert(A, eB)).out, '23514', G_CLASS);
    expectBlocked('ghi danh của B, lớp của A', (await insertCert(A, { ...eB, classId: A.k1 })).out, '23514', G_ENROLLMENT);
    expectBlocked('ghi danh bịa', (await insertCert(A, { ...eA, id: randomUUID() })).out, '23514', G_ENROLLMENT);
    expectBlocked('tổ chức bịa', (await insertCert({ ...A, id: randomUUID() }, eA)).out, '23514', G_CLASS);
  });

  it('tệp ảnh / logo / ảnh nền của tổ chức khác → chặn; tệp cùng tổ chức ghi được', async () => {
    expectBlocked('ảnh học viên của B', (await insertCert(A, await newEnrollment(A), { photo_file_id: uuid(B.file) })).out, '23503', 'certificates_photo_fkey');
    expectBlocked('logo của B', (await insertCert(A, await newEnrollment(A), { logo_file_id: uuid(B.file) })).out, '23503', 'certificates_logo_fkey');
    expectBlocked('ảnh nền của B', (await insertCert(A, await newEnrollment(A), { background_style: `'hv:damask'`, background_file_id: uuid(B.file) })).out, '23503', 'certificates_background_fkey');
    expectAllowed('ảnh + logo của A', (await insertCert(A, await newEnrollment(A), { photo_file_id: uuid(A.file), logo_file_id: uuid(A.file) })).out);
  });

  it('người cấp / người thu hồi không có thật → chặn', async () => {
    expectBlocked('issued_by_id bịa', (await insertCert(A, await newEnrollment(A), { issued_by_id: uuid(randomUUID()) })).out, '23503', 'certificates_issued_by_fkey');
    const { id } = await mustOk('bản để thu hồi', insertCert(A, await newEnrollment(A)));
    expectBlocked('revoked_by_id bịa', await updateCert(id, REVOKE_SET(randomUUID())), '23503', 'certificates_revoked_by_fkey');
  });

  it('ghi danh đã có giấy: không xoá, không đổi lớp / khách (ON UPDATE RESTRICT); huỷ ghi danh thì giấy giữ nguyên', async () => {
    const e = await newEnrollment(A);
    await mustOk('giấy', insertCert(A, e));
    expectBlocked('đổi lớp của ghi danh', await run(`UPDATE enrollments SET course_class_id = ${uuid(A.k2)} WHERE id = ${uuid(e.id)}`), '23503', 'certificates_enrollment_fkey');
    // Khách chưa ghi danh lớp này (khách đã ghi danh thì chỉ mục enrollments_one_active chặn trước).
    const c2 = (await db.customer.create({ data: { organizationId: A.id, fullName: 'Khách khác' } })).id;
    expectBlocked('đổi khách của ghi danh', await run(`UPDATE enrollments SET customer_id = ${uuid(c2)} WHERE id = ${uuid(e.id)}`), '23503', 'certificates_enrollment_fkey');
    expectBlocked('xoá ghi danh', await run(`DELETE FROM enrollments WHERE id = ${uuid(e.id)}`), '23503', 'certificates_enrollment_fkey');
    expectAllowed('huỷ ghi danh (chỉ đổi trạng thái)', await run(`UPDATE enrollments SET status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'Thử' WHERE id = ${uuid(e.id)}`));
    expect(await count(`SELECT count(*) AS n FROM certificates WHERE enrollment_id = ${uuid(e.id)} AND status = 'ISSUED'`)).toBe(1);
  });
});

// ======================================================================================================
describe('trigger thêm mới — certificates_insert_guard', () => {
  it('bản mới phải ISSUED (thêm thẳng bản REVOKED đủ cột → chặn)', async () => {
    expectBlocked('thêm bản REVOKED', (await insertCert(A, await newEnrollment(A), { status: `'REVOKED'`, revoked_at: 'now()', revoke_reason: `'x'`, revoked_by_id: uuid(owner.id) })).out, '23514', G_NEW_STATUS);
  });

  it('lớp đã huỷ / ngày cấp trước ngày kết thúc / lớp chưa kết thúc → chặn; đúng ngày kết thúc ghi được', async () => {
    expectBlocked('lớp CANCELLED', (await insertCert(A, await newEnrollment(A, A.kCancelled))).out, '23514', G_CLASS);
    expectBlocked('issued_on = end_date − 1', (await insertCert(A, await newEnrollment(A), { issued_on: date('2026-03-04') })).out, '23514', G_BEFORE_END);
    expectBlocked('lớp đang học, cấp hôm nay', (await insertCert(A, await newEnrollment(A, A.kRunning), { issued_on: date(A.today) })).out, '23514', G_BEFORE_END);
    expectAllowed('issued_on = end_date', (await insertCert(A, await newEnrollment(A), { issued_on: date('2026-03-05') })).out);
    expectAllowed('lớp CLOSED đã kết thúc', (await insertCert(A, await newEnrollment(A, A.k2))).out);
  });

  it('"hôm nay" theo múi giờ của TỔ CHỨC: hôm nay ghi được, ngày mai bị chặn (cả +14 và −11)', async () => {
    for (const org of [A, B]) {
      const today = await todayIn(org.tz);
      const tomorrow = addDays(today, 1);
      const y = Number(today.slice(0, 4));
      const n = () => num(org.seq++, y);
      expectAllowed(`${org.tz}: lớp kết thúc hôm nay ${today}, cấp hôm nay`, (await insertCert(org, await newEnrollment(org, org.kToday), { ...n(), issued_on: date(today) })).out);
      const ty = Number(tomorrow.slice(0, 4));
      expectBlocked(`${org.tz}: cấp ngày mai ${tomorrow}`, (await insertCert(org, await newEnrollment(org, org.kToday), { ...num(org.seq++, ty), issued_on: date(tomorrow) })).out, '23514', G_FUTURE);
      // Ngày cấp lại cũng không được sau hôm nay.
      const p = await revokedOriginal(org);
      expectBlocked(`${org.tz}: ngày cấp lại = ngày mai`, (await insertCert(org, p.enr, reissueOver(p.id, p.n, 1, { reissued_on: date(tomorrow) }))).out, '23514', G_FUTURE);
      expectAllowed(`${org.tz}: ngày cấp lại = hôm nay`, (await insertCert(org, p.enr, reissueOver(p.id, p.n, 1, { reissued_on: date(today) }))).out);
    }
  });

  it('ghi danh đã huỷ → chặn', async () => {
    expectBlocked('ghi danh CANCELLED', (await insertCert(A, await newEnrollment(A, A.k1, 'CANCELLED'))).out, '23514', G_ENROLLMENT);
  });

  it('cấp lại từ bản còn ISSUED / số lần cấp lại nhảy 2 → chặn', async () => {
    const e = await newEnrollment(A);
    const n = nextNum(A);
    const live = await mustOk('bản còn hiệu lực', insertCert(A, e, n));
    expectBlocked('cấp lại từ bản ISSUED', (await insertCert(A, e, reissueOver(live.id, n))).out, '23514', G_REISSUE);
    await revoke(live.id);
    expectBlocked('reissue_no nhảy 2', (await insertCert(A, e, reissueOver(live.id, n, 2))).out, '23514', G_REISSUE);
    expectBlocked('replaces_id bịa', (await insertCert(A, e, reissueOver(randomUUID(), n))).out, '23514', G_REISSUE);
    expectAllowed('vế GIỮ: reissue_no 1 từ bản đã thu hồi', (await insertCert(A, e, reissueOver(live.id, n))).out);
  });
});

// ======================================================================================================
describe('trigger sửa / xoá — đóng băng, chỉ thu hồi, chỉ ghi thêm', () => {
  it('bản ISSUED: sửa cột nào cũng bị chặn; thu hồi kèm sửa cột khác bị chặn; thu hồi đúng ghi được', async () => {
    const { id } = await mustOk('bản', insertCert(A, await newEnrollment(A)));
    expectBlocked('đổi student_name', await updateCert(id, `student_name = 'Tên khác'`), '23514', U_ONLY_REVOKE);
    expectBlocked('đổi template_code', await updateCert(id, `template_code = 'cc-02'`), '23514', U_ONLY_REVOKE);
    expectBlocked('không đổi gì (ISSUED → ISSUED)', await updateCert(id, `status = 'ISSUED'`), '23514', U_ONLY_REVOKE);
    for (const [label, extra] of [
      ['student_name', `student_name = 'Tên khác'`],
      ['issued_on', `issued_on = '2026-03-11'`],
      ['code', `code = 'CC-2026-9998', seq = 9998`],
      ['photo_file_id', `photo_file_id = ${uuid(A.file)}`],
      ['created_at', `created_at = now() - interval '1 day'`],
    ] as const) {
      expectBlocked(`thu hồi kèm đổi ${label}`, await updateCert(id, `${REVOKE_SET()}, ${extra}`), '23514', U_FROZEN);
    }
    expectAllowed('thu hồi đúng', await updateCert(id, REVOKE_SET()));
  });

  it('bản REVOKED đóng băng hoàn toàn (không về ISSUED, không sửa lý do)', async () => {
    const { id } = await mustOk('bản', insertCert(A, await newEnrollment(A)));
    await revoke(id);
    expectBlocked('REVOKED → ISSUED', await updateCert(id, `status = 'ISSUED', revoked_at = NULL, revoke_reason = NULL, revoked_by_id = NULL`), '23514', U_REVOKED);
    expectBlocked('sửa lý do thu hồi', await updateCert(id, `revoke_reason = 'Lý do khác'`), '23514', U_REVOKED);
  });

  it('không xoá được (bản ISSUED lẫn REVOKED)', async () => {
    const a = await mustOk('bản ISSUED', insertCert(A, await newEnrollment(A)));
    const b = await mustOk('bản REVOKED', insertCert(A, await newEnrollment(A)));
    await revoke(b.id);
    expectBlocked('xoá bản ISSUED', await run(`DELETE FROM certificates WHERE id = ${uuid(a.id)}`), '23514', D_NO_DELETE);
    expectBlocked('xoá bản REVOKED', await run(`DELETE FROM certificates WHERE id = ${uuid(b.id)}`), '23514', D_NO_DELETE);
    expect(await count(`SELECT count(*) AS n FROM certificates WHERE id IN (${uuid(a.id)}, ${uuid(b.id)})`)).toBe(2);
  });
});

// ======================================================================================================
describe('NOT NULL — ghi thẳng NULL từng cột bắt buộc', () => {
  it('cột trigger không đọc: 23502; cột trigger đọc: trigger chặn trước (vẫn bị chặn)', async () => {
    const plain = [
      'id', 'customer_id', 'year', 'seq', 'reissue_no', 'code', 'issued_on', 'template_code', 'template_version',
      'student_name', 'course_name', 'class_name', 'brand_name', 'issued_by_id', 'created_at',
    ];
    for (const col of plain) {
      expectBlocked(`certificates.${col} NULL`, (await insertCert(A, await newEnrollment(A), { [col]: 'NULL' })).out, '23502');
    }
    const byTrigger: Array<[string, string]> = [
      ['status', G_NEW_STATUS],
      ['organization_id', G_CLASS],
      ['course_class_id', G_CLASS],
      ['enrollment_id', G_ENROLLMENT],
    ];
    for (const [col, msg] of byTrigger) {
      expectBlocked(`certificates.${col} NULL`, (await insertCert(A, await newEnrollment(A), { [col]: 'NULL' })).out, '23514', msg);
    }
  });
});

// ======================================================================================================
describe('danh mục — đủ chốt, đúng định nghĩa (bắt cả chốt lưới thứ hai)', () => {
  it('7 CHECK, 10 khoá ngoại, 11 chỉ mục, 3 trigger của bản vẽ F', async () => {
    const cons = await db.$queryRawUnsafe<Array<{ conname: string; def: string }>>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid IN ('certificates'::regclass, 'organization_profiles'::regclass) AND contype IN ('c', 'f')`,
    );
    const byCon = new Map(cons.map((c) => [c.conname, c.def]));
    const wantCon: Record<string, RegExp> = {
      certificates_number: /^CHECK /,
      certificates_status: /^CHECK /,
      certificates_reissue: /^CHECK /,
      certificates_template: /^CHECK /,
      certificates_background: /^CHECK /,
      certificates_texts: /^CHECK /,
      organization_profiles_cert_signer: /^CHECK /,
      certificates_org_fkey: /^FOREIGN KEY \(organization_id\) REFERENCES organizations\(id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
      certificates_enrollment_fkey:
        /^FOREIGN KEY \(enrollment_id, organization_id, course_class_id, customer_id\) REFERENCES enrollments\(id, organization_id, course_class_id, customer_id\) ON UPDATE RESTRICT ON DELETE RESTRICT$/,
      certificates_class_fkey: /^FOREIGN KEY \(course_class_id, organization_id\) REFERENCES course_classes\(id, organization_id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
      certificates_customer_fkey: /^FOREIGN KEY \(customer_id, organization_id\) REFERENCES customers\(id, organization_id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
      certificates_photo_fkey: /^FOREIGN KEY \(photo_file_id, organization_id\) REFERENCES stored_files\(id, organization_id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
      certificates_logo_fkey: /^FOREIGN KEY \(logo_file_id, organization_id\) REFERENCES stored_files\(id, organization_id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
      certificates_background_fkey: /^FOREIGN KEY \(background_file_id, organization_id\) REFERENCES stored_files\(id, organization_id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
      certificates_replaces_fkey:
        /^FOREIGN KEY \(replaces_id, organization_id, enrollment_id, year, seq\) REFERENCES certificates\(id, organization_id, enrollment_id, year, seq\) ON UPDATE RESTRICT ON DELETE RESTRICT$/,
      certificates_issued_by_fkey: /^FOREIGN KEY \(issued_by_id\) REFERENCES users\(id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
      certificates_revoked_by_fkey: /^FOREIGN KEY \(revoked_by_id\) REFERENCES users\(id\) ON UPDATE CASCADE ON DELETE RESTRICT$/,
    };
    const badCon = Object.keys(wantCon).filter((n) => !wantCon[n]!.test(byCon.get(n) ?? ''));
    // Chốt NULL: mọi CHECK của bảng mới phải nhắc IS NULL / IS NOT NULL cho cột cho phép NULL mà nó đọc (sổ lỗi 24).
    const nullGuards: Record<string, string[]> = {
      certificates_status: ['revoked_at IS NULL', 'revoked_at IS NOT NULL', 'revoke_reason IS NOT NULL', 'revoked_by_id IS NOT NULL'],
      certificates_reissue: ['replaces_id IS NULL', 'reissued_on IS NULL', 'replaces_id IS NOT NULL', 'reissued_on IS NOT NULL'],
      certificates_template: ['font_override IS NULL'],
      certificates_background: ['background_style IS NULL', 'frame_style IS NULL', 'background_file_id IS NULL', 'background_style IS NOT NULL'],
      certificates_texts: ['instructor_name IS NULL', 'signer_name IS NULL', 'signer_title IS NULL'],
      organization_profiles_cert_signer: ['cert_signer_name IS NULL', 'cert_signer_title IS NULL'],
    };
    const missingGuards = Object.entries(nullGuards).flatMap(([n, gs]) => gs.filter((g) => !(byCon.get(n) ?? '').includes(g)).map((g) => `${n}: ${g}`));

    const wantIdx: Record<string, RegExp> = {
      certificates_pkey: /^CREATE UNIQUE INDEX certificates_pkey ON public\.certificates USING btree \(id\)$/,
      certificates_id_org_key: /^CREATE UNIQUE INDEX certificates_id_org_key ON public\.certificates USING btree \(id, organization_id\)$/,
      certificates_reissue_target_key: /^CREATE UNIQUE INDEX certificates_reissue_target_key ON public\.certificates USING btree \(id, organization_id, enrollment_id, year, seq\)$/,
      certificates_number_key: /^CREATE UNIQUE INDEX certificates_number_key ON public\.certificates USING btree \(organization_id, year, seq, reissue_no\)$/,
      certificates_org_class_idx: /^CREATE INDEX certificates_org_class_idx ON public\.certificates USING btree \(organization_id, course_class_id\)$/,
      certificates_org_customer_idx: /^CREATE INDEX certificates_org_customer_idx ON public\.certificates USING btree \(organization_id, customer_id\)$/,
      certificates_org_number_idx: /^CREATE INDEX certificates_org_number_idx ON public\.certificates USING btree \(organization_id, year, seq\)$/,
      certificates_one_issued_per_enrollment:
        /^CREATE UNIQUE INDEX certificates_one_issued_per_enrollment ON public\.certificates USING btree \(enrollment_id\) WHERE \(status = 'ISSUED'::"CertificateStatus"\)$/,
      certificates_code_issued:
        /^CREATE UNIQUE INDEX certificates_code_issued ON public\.certificates USING btree \(organization_id, year, seq\) WHERE \(status = 'ISSUED'::"CertificateStatus"\)$/,
      certificates_replaced_once: /^CREATE UNIQUE INDEX certificates_replaced_once ON public\.certificates USING btree \(replaces_id\) WHERE \(replaces_id IS NOT NULL\)$/,
      enrollments_cert_target_key:
        /^CREATE UNIQUE INDEX enrollments_cert_target_key ON public\.enrollments USING btree \(id, organization_id, course_class_id, customer_id\)$/,
    };
    const idx = await db.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      Object.keys(wantIdx),
    );
    const byIdx = new Map(idx.map((r) => [r.indexname, r.indexdef]));
    const badIdx = Object.keys(wantIdx).filter((n) => !wantIdx[n]!.test(byIdx.get(n) ?? ''));

    const triggers = await db.$queryRawUnsafe<Array<{ t: string }>>(
      `SELECT c.relname || '.' || t.tgname || ' ' ||
              CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END || ' ' ||
              concat_ws('/', CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END, CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
                             CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END) ||
              CASE WHEN t.tgenabled = 'O' THEN '' ELSE ' (TẮT)' END AS t
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname = 'certificates' ORDER BY t.tgname`,
    );
    const total = Object.keys(wantCon).length + Object.keys(wantIdx).length + 3;
    const bad = [...badCon, ...badIdx];
    console.log(
      `[bản vẽ F — danh mục] chốt + chỉ mục đúng ${total - 3 - bad.length}/${total - 3}${bad.length ? `; THIẾU/SAI: ${bad.join(', ')}` : ''}; ` +
        `vế NULL viết rõ ${Object.values(nullGuards).flat().length - missingGuards.length}/${Object.values(nullGuards).flat().length}; trigger ${triggers.length}/3`,
    );
    expect(bad).toEqual([]);
    expect(missingGuards).toEqual([]);
    expect(triggers.map((t) => t.t)).toEqual([
      'certificates.certificates_insert_guard BEFORE INSERT',
      'certificates.certificates_no_delete BEFORE DELETE',
      'certificates.certificates_update_guard BEFORE UPDATE',
    ]);
  });
});
