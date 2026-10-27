// Bản vẽ H mục 2.3–2.4 + 5.1 (gói H-M1) — bài thử GHI THẲNG database cho mã số học viên trong lớp (đi vòng qua máy chủ,
// sổ lỗi 24). Migration 20261026200000_ma_so_hoc_vien. Mỗi dòng bảng 2.4 có:
//   - vế BẮT: ghi sai phải bị chặn đúng mã Postgres VÀ đúng tên chốt (hoặc đúng lời của trigger);
//   - vế GIỮ: ghi đúng phải ghi được (chốt viết quá tay chặn nhầm → đỏ).
// Cộng 2 ca của ký duyệt H điều kiện 4 (đổi dòng CANCELLED về ACTIVE), ca đua (2 giao dịch cùng lớp cùng lúc), và chạy
// lại CHÍNH tệp migration.sql trên "dữ liệu cũ" tự dựng trong một giao dịch rồi quay lui (đổ số trước chốt, đoạn BACKFILL
// chạy hai lần ra y nguyên).
// Trigger BEFORE chạy TRƯỚC CHECK, nên mỗi ca CHECK được dựng sao cho trigger cho qua; chỗ nào trigger chặn trước (seat_no
// 1000 → bộ đếm 1000) thì ghi rõ chốt chặn thật, còn chốt sau được kiểm bằng danh mục ở khối cuối.
// Ghi danh viết bằng SQL thô (không qua mô hình Prisma); bản ghi phụ (khách, hợp đồng, dòng) dựng bằng Prisma.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgErrorCode } from '../src/http/middleware';
import { createAcademyOrg, makeApp, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const MIGRATION = new URL('../prisma/migrations/20261026200000_ma_so_hoc_vien/migration.sql', import.meta.url);

let owner: TestUser;
let orgId: string;
let courseId: string;

// ---------- Ghi SQL thô + đếm ca ----------
type Outcome = { ok: true; n: number } | { ok: false; code: string | null; text: string };

const str = (s: string) => `'${s.replace(/'/g, "''")}'`;
const uuid = (s: string) => `${str(s)}::uuid`;

function failOf(err: unknown): Outcome {
  const meta = (err as { meta?: unknown }).meta;
  return { ok: false, code: pgErrorCode(err), text: `${String((err as Error).message)} ${JSON.stringify(meta ?? {})}` };
}

async function run(sql: string, client: Pick<Tx, '$executeRawUnsafe'> = db): Promise<Outcome> {
  try {
    return { ok: true, n: await client.$executeRawUnsafe(sql) };
  } catch (err) {
    return failOf(err);
  }
}

const tally = { blocked: 0, blockedTotal: 0, allowed: 0, allowedTotal: 0 };

// Ca vi phạm: phải bị chặn đúng mã và đúng chốt ('msg:…' = lời của RAISE EXCEPTION trong trigger; 'Key (…)=' = chốt
// duy nhất, Prisma chỉ trả lời Postgres kèm cột chứ không kèm tên index; còn lại = tên chốt CHECK).
function expectBlocked(label: string, out: Outcome, code: string, constraint: string) {
  tally.blockedTotal++;
  const needle = constraint.startsWith('msg:') ? constraint.slice(4) : constraint.startsWith('Key (') ? constraint : `"${constraint}"`;
  const hit = !out.ok && out.code === code && out.text.includes(needle);
  if (hit) tally.blocked++;
  expect(hit, `${label}: mong bị chặn ${code} bởi ${constraint}, nhận ${out.ok ? 'GHI ĐƯỢC' : `${out.code} ${out.text.slice(0, 400)}`}`).toBe(true);
}

// Ca hợp lệ: ghi được đúng `rows` dòng.
function expectAllowed(label: string, out: Outcome, rows = 1) {
  tally.allowedTotal++;
  const hit = out.ok && out.n === rows;
  if (hit) tally.allowed++;
  expect(hit, `${label}: mong ghi được ${rows} dòng, nhận ${out.ok ? `${out.n} dòng` : `${out.code} ${out.text.slice(0, 400)}`}`).toBe(true);
}

const GUARD_BACKWARDS = 'msg:Bộ đếm mã số của lớp không được lùi';
// enrollments_seat_active là chốt duy nhất DUY NHẤT trên (course_class_id, seat_no) — enrollments_one_active là (course_class_id, customer_id).
const SEAT_ACTIVE = 'Key (course_class_id, seat_no)=';

// ---------- Dựng bản ghi ----------
let counter = 0;

async function newClass(over: { seatCounter?: number } = {}): Promise<string> {
  const k = await db.courseClass.create({
    data: {
      organizationId: orgId,
      courseId,
      name: `Lớp H ${++counter}-${randomUUID().slice(0, 6)}`,
      startDate: new Date('2026-11-02'),
      endDate: new Date('2027-01-30'),
      weekdays: [2, 4],
      capacity: 500,
      createdById: owner.id,
      ...over,
    },
  });
  return k.id;
}

interface Seat {
  customerId: string;
  contractId: string;
  lineId: string;
}

// Khách + hợp đồng khoá học + dòng khoá học trỏ vào lớp (đủ khoá ngoại cho một dòng ghi danh).
async function student(classId: string): Promise<Seat> {
  const tag = `${++counter}-${randomUUID().slice(0, 6)}`;
  const customer = await db.customer.create({ data: { organizationId: orgId, fullName: `Học viên H ${tag}` } });
  const contract = await db.contract.create({
    data: { organizationId: orgId, code: `HĐKH-H-${tag}`, kind: 'COURSE', customerId: customer.id, createdById: owner.id },
  });
  const line = await db.contractLine.create({
    data: { organizationId: orgId, contractId: contract.id, kind: 'COURSE', name: `Lớp ${tag}`, unitPrice: 0n, lineTotal: 0n, courseClassId: classId, createdById: owner.id },
  });
  return { customerId: customer.id, contractId: contract.id, lineId: line.id };
}

interface EnrOpts {
  id?: string;
  status?: 'ACTIVE' | 'CANCELLED';
  seat?: number | null; // undefined = không ghi cột (để trigger tự cấp); null = ghi thẳng NULL
  at?: string; // enrolled_at, mảnh SQL
  prefix?: string; // chú thích đầu câu (để tìm câu trong pg_stat_activity)
}

function enrSql(classId: string, s: Seat, o: EnrOpts & { id: string }): string {
  const status = o.status ?? 'ACTIVE';
  const cols: Record<string, string> = {
    id: uuid(o.id),
    organization_id: uuid(orgId),
    course_class_id: uuid(classId),
    contract_id: uuid(s.contractId),
    contract_line_id: uuid(s.lineId),
    customer_id: uuid(s.customerId),
    status: `'${status}'`,
    enrolled_at: o.at ?? 'now()',
    cancelled_at: status === 'CANCELLED' ? 'now()' : 'NULL',
    cancel_reason: status === 'CANCELLED' ? `'Thử H'` : 'NULL',
  };
  if (o.seat !== undefined) cols.seat_no = o.seat === null ? 'NULL' : String(o.seat);
  return `${o.prefix ?? ''}INSERT INTO "enrollments" (${Object.keys(cols).map((c) => `"${c}"`).join(', ')}) VALUES (${Object.values(cols).join(', ')})`;
}

async function insertEnr(classId: string, o: EnrOpts = {}, client: Pick<Tx, '$executeRawUnsafe'> = db) {
  const id = o.id ?? randomUUID();
  const s = await student(classId);
  return { id, s, out: await run(enrSql(classId, s, { ...o, id }), client) };
}

async function mustEnr(label: string, classId: string, o: EnrOpts = {}) {
  const r = await insertEnr(classId, o);
  if (!r.out.ok) throw new Error(`Dựng ghi danh "${label}" thất bại: ${r.out.code} ${r.out.text}`);
  return r.id;
}

const seatOf = async (id: string) =>
  (await db.$queryRawUnsafe<Array<{ s: number | null }>>(`SELECT "seat_no" AS s FROM "enrollments" WHERE id = ${uuid(id)}`))[0]!.s;
const counterOf = async (classId: string) =>
  (await db.$queryRawUnsafe<Array<{ c: number }>>(`SELECT "seat_counter" AS c FROM "course_classes" WHERE id = ${uuid(classId)}`))[0]!.c;
const setEnr = (id: string, set: string) => run(`UPDATE "enrollments" SET ${set} WHERE id = ${uuid(id)}`);
const setClass = (id: string, set: string) => run(`UPDATE "course_classes" SET ${set} WHERE id = ${uuid(id)}`);
const REACTIVATE = `"status" = 'ACTIVE', "cancelled_at" = NULL, "cancel_reason" = NULL`;
const CANCEL = `"status" = 'CANCELLED', "cancelled_at" = now(), "cancel_reason" = 'Thử H'`;

// Lớp viết thẳng bằng SQL (để thử seat_counter lúc INSERT — trigger không lùi chỉ chạy lúc UPDATE).
const classSql = (seatCounter: string) =>
  `INSERT INTO "course_classes" ("id", "organization_id", "course_id", "name", "start_date", "end_date", "weekdays", "capacity", "created_by_id", "updated_at", "seat_counter")
   VALUES (${uuid(randomUUID())}, ${uuid(orgId)}, ${uuid(courseId)}, ${str(`Lớp SQL ${++counter}-${randomUUID().slice(0, 6)}`)}, '2026-11-02', '2027-01-30', '{2,4}', 500, ${uuid(owner.id)}, now(), ${seatCounter})`;

beforeAll(async () => {
  const app = makeApp(deps);
  owner = await registerUser(app, 'h-m1');
  orgId = await createAcademyOrg(app, owner, 'h-m1');
  const course = await db.course.create({
    data: { organizationId: orgId, code: `KH-H-${randomUUID().slice(0, 6)}`, name: 'Makeup cá nhân', mode: 'MULTI_CLASS', tuitionFee: 0n, defaultCapacity: 20, createdById: owner.id },
  });
  courseId = course.id;
});

afterAll(async () => {
  console.log(
    `[bản vẽ H — database] ca vi phạm bị chặn ${tally.blocked}/${tally.blockedTotal}; ca hợp lệ ghi được ${tally.allowed}/${tally.allowedTotal}`,
  );
  await db.$disconnect();
});

// ======================================================================================================
describe('enrollments_active_seat — ACTIVE bắt buộc có số (bẫy NULL: phải là IS NOT NULL, không phải > 0)', () => {
  it('UPDATE seat_no = NULL trên dòng ACTIVE → chặn; dòng CANCELLED mang NULL → ghi được', async () => {
    const k = await newClass();
    const a = await mustEnr('ACTIVE', k);
    expectBlocked('ACTIVE: UPDATE seat_no = NULL', await setEnr(a, `"seat_no" = NULL`), '23514', 'enrollments_active_seat');
    expect(await seatOf(a)).toBe(1);
    // Vế GIỮ: huỷ trước ngày có tính năng → NULL, không chiếm số.
    const c = await insertEnr(k, { status: 'CANCELLED' });
    expectAllowed('CANCELLED không số (INSERT)', c.out);
    expect(await seatOf(c.id)).toBeNull();
    const c2 = await mustEnr('CANCELLED có số', k, { status: 'CANCELLED', seat: 7 });
    expectAllowed('CANCELLED: UPDATE seat_no = NULL', await setEnr(c2, `"seat_no" = NULL`));
  });
});

// ======================================================================================================
describe('enrollments_seat_range — 1..999 (vế IS NULL cho qua có chủ đích)', () => {
  it('0, -1 bị chặn ở INSERT và UPDATE; 1000 bị bộ đếm chặn trước; 1 và 999 ghi được', async () => {
    const k = await newClass();
    for (const v of [0, -1]) {
      expectBlocked(`INSERT seat_no = ${v}`, (await insertEnr(k, { seat: v })).out, '23514', 'enrollments_seat_range');
      expectBlocked(`INSERT CANCELLED seat_no = ${v}`, (await insertEnr(k, { status: 'CANCELLED', seat: v })).out, '23514', 'enrollments_seat_range');
    }
    const a = await mustEnr('ACTIVE', k);
    for (const v of [0, -1]) expectBlocked(`UPDATE seat_no = ${v}`, await setEnr(a, `"seat_no" = ${v}`), '23514', 'enrollments_seat_range');
    // seat_no = 1000: trigger nâng bộ đếm lên 1000 TRƯỚC khi CHECK của enrollments chạy → course_classes_seat_counter_range
    // chặn trước (lưới thứ nhất); enrollments_seat_range là lưới thứ hai, kiểm bằng danh mục ở khối cuối.
    expectBlocked('INSERT seat_no = 1000', (await insertEnr(k, { seat: 1000 })).out, '23514', 'course_classes_seat_counter_range');
    expectBlocked('UPDATE seat_no = 1000', await setEnr(a, `"seat_no" = 1000`), '23514', 'course_classes_seat_counter_range');
    expect(await seatOf(a)).toBe(1);
    expect(await counterOf(k)).toBe(1);
    // Vế GIỮ: đúng hai biên.
    const k2 = await newClass();
    expectAllowed('INSERT seat_no = 1', (await insertEnr(k2, { seat: 1 })).out);
    expectAllowed('INSERT seat_no = 999', (await insertEnr(k2, { seat: 999 })).out);
    expect(await counterOf(k2)).toBe(999);
  });
});

// ======================================================================================================
describe('enrollments_seat_active — không trùng số giữa các ACTIVE cùng lớp (index một phần)', () => {
  it('hai ACTIVE cùng lớp cùng số → chặn (INSERT và UPDATE); ACTIVE + CANCELLED cùng số, hay khác lớp cùng số → ghi được', async () => {
    const k = await newClass();
    const a1 = await mustEnr('A1', k); // 1
    const a2 = await mustEnr('A2', k); // 2
    expectBlocked('INSERT ACTIVE trùng số 1', (await insertEnr(k, { seat: 1 })).out, '23505', SEAT_ACTIVE);
    expectBlocked('UPDATE ACTIVE sang số của người khác', await setEnr(a2, `"seat_no" = 1`), '23505', SEAT_ACTIVE);
    // Vế GIỮ: index chỉ tính ACTIVE.
    expectAllowed('INSERT CANCELLED cùng số 1 với ACTIVE', (await insertEnr(k, { status: 'CANCELLED', seat: 1 })).out);
    expectAllowed('huỷ A2 (giữ số 2)', await setEnr(a2, CANCEL));
    expect(await seatOf(a2)).toBe(2);
    expectAllowed('ACTIVE mới lấy lại số 2 của người đã huỷ (ghi thẳng)', (await insertEnr(k, { seat: 2 })).out);
    const k2 = await newClass();
    expectAllowed('lớp khác cùng số 1', (await insertEnr(k2, { seat: 1 })).out);
    expect(await seatOf(a1)).toBe(1);
  });
});

// ======================================================================================================
describe('course_classes_seat_counter_range — bộ đếm 0..999', () => {
  it('-1, 1000 bị chặn; 0, 999 ghi được; ghi danh tự cấp khi bộ đếm 999 → chặn', async () => {
    // INSERT: trigger không lùi chỉ chạy lúc UPDATE → CHECK là chốt duy nhất.
    expectBlocked('INSERT lớp seat_counter = -1', await run(classSql('-1')), '23514', 'course_classes_seat_counter_range');
    expectBlocked('INSERT lớp seat_counter = 1000', await run(classSql('1000')), '23514', 'course_classes_seat_counter_range');
    expectAllowed('INSERT lớp seat_counter = 0', await run(classSql('0')));
    expectAllowed('INSERT lớp seat_counter = 999', await run(classSql('999')));
    const k = await newClass();
    expectBlocked('UPDATE seat_counter = 1000', await setClass(k, `"seat_counter" = 1000`), '23514', 'course_classes_seat_counter_range');
    expectAllowed('UPDATE seat_counter = 999', await setClass(k, `"seat_counter" = 999`));
    // Hết số: tự cấp 1000 bị chặn, không lặng lẽ cấp NULL hay trùng.
    expectBlocked('INSERT ACTIVE tự cấp khi bộ đếm 999', (await insertEnr(k)).out, '23514', 'course_classes_seat_counter_range');
    expect(await counterOf(k)).toBe(999);
  });
});

// ======================================================================================================
describe('course_classes_seat_counter_guard — bộ đếm không lùi (trigger)', () => {
  it('seat_counter - 1 → chặn; giữ nguyên / tăng / sửa cột khác của lớp → ghi được', async () => {
    const k = await newClass();
    await mustEnr('1', k);
    await mustEnr('2', k);
    await mustEnr('3', k);
    expect(await counterOf(k)).toBe(3);
    expectBlocked('UPDATE seat_counter = seat_counter - 1', await setClass(k, `"seat_counter" = "seat_counter" - 1`), '23514', GUARD_BACKWARDS);
    expectBlocked('UPDATE seat_counter = 0', await setClass(k, `"seat_counter" = 0`), '23514', GUARD_BACKWARDS);
    // -1 cũng bị chặn, nhưng bởi trigger (chạy trước CHECK) — ghi rõ chốt chặn thật.
    expectBlocked('UPDATE seat_counter = -1', await setClass(k, `"seat_counter" = -1`), '23514', GUARD_BACKWARDS);
    expect(await counterOf(k)).toBe(3);
    expectAllowed('UPDATE seat_counter = seat_counter', await setClass(k, `"seat_counter" = "seat_counter"`));
    expectAllowed('UPDATE seat_counter = 4', await setClass(k, `"seat_counter" = 4`));
    expectAllowed('UPDATE enrolled_count, name (không đụng bộ đếm)', await setClass(k, `"enrolled_count" = 0, "name" = ${str(`Lớp H đổi tên ${randomUUID().slice(0, 6)}`)}`));
    // Huỷ ghi danh không lùi bộ đếm.
    const a = await mustEnr('5', k);
    expect(await seatOf(a)).toBe(5);
    expectAllowed('huỷ ghi danh 5', await setEnr(a, CANCEL));
    expect(await counterOf(k)).toBe(5);
  });
});

// ======================================================================================================
describe('enrollments_seat_guard — nhánh tự cấp và nhánh nâng (ca GIỮ)', () => {
  it('INSERT ACTIVE không số → seat_counter + 1; CANCELLED không số → NULL, bộ đếm đứng yên', async () => {
    const k = await newClass();
    expectAllowed('UPDATE seat_counter = 3', await setClass(k, `"seat_counter" = 3`));
    const a = await insertEnr(k);
    expectAllowed('INSERT ACTIVE không số', a.out);
    expect(await seatOf(a.id)).toBe(4);
    expect(await counterOf(k)).toBe(4);
    const c = await insertEnr(k, { status: 'CANCELLED' });
    expectAllowed('INSERT CANCELLED không số', c.out);
    expect(await seatOf(c.id)).toBeNull();
    expect(await counterOf(k)).toBe(4);
  });

  it('ghi seat_no = 50 khi bộ đếm 3 → bộ đếm 50, ghi danh kế tiếp 51; số nhỏ hơn bộ đếm không kéo lùi', async () => {
    const k = await newClass();
    for (let i = 0; i < 3; i++) await mustEnr(`#${i + 1}`, k);
    expect(await counterOf(k)).toBe(3);
    const fifty = await insertEnr(k, { seat: 50 });
    expectAllowed('INSERT seat_no = 50', fifty.out);
    expect(await counterOf(k)).toBe(50);
    const next = await insertEnr(k);
    expectAllowed('INSERT kế tiếp', next.out);
    expect(await seatOf(next.id)).toBe(51);
    // Nhánh nâng qua UPDATE (đường sửa tay): 51 → 70, rồi về 10 (số trống) → bộ đếm giữ 70.
    expectAllowed('UPDATE seat_no = 70', await setEnr(next.id, `"seat_no" = 70`));
    expect(await counterOf(k)).toBe(70);
    expectAllowed('UPDATE seat_no = 10', await setEnr(next.id, `"seat_no" = 10`));
    expect(await counterOf(k)).toBe(70);
    expect(await seatOf((await insertEnr(k)).id)).toBe(71);
  });

  it('UPDATE seat_no của dòng CANCELLED không đụng các dòng ACTIVE', async () => {
    const k = await newClass();
    const ids = [await mustEnr('1', k), await mustEnr('2', k), await mustEnr('3', k)];
    const c = await mustEnr('huỷ', k, { status: 'CANCELLED' });
    const before = await db.$queryRawUnsafe<Array<{ id: string; s: number }>>(
      `SELECT id::text, "seat_no" AS s FROM "enrollments" WHERE "course_class_id" = ${uuid(k)} AND "status" = 'ACTIVE' ORDER BY id`,
    );
    expectAllowed('CANCELLED: UPDATE seat_no = 2 (trùng số người đang học — index chỉ tính ACTIVE)', await setEnr(c, `"seat_no" = 2`));
    expectAllowed('CANCELLED: UPDATE seat_no = 8', await setEnr(c, `"seat_no" = 8`));
    const after = await db.$queryRawUnsafe<Array<{ id: string; s: number }>>(
      `SELECT id::text, "seat_no" AS s FROM "enrollments" WHERE "course_class_id" = ${uuid(k)} AND "status" = 'ACTIVE' ORDER BY id`,
    );
    expect(after).toEqual(before);
    expect(before.map((r) => r.s).sort()).toEqual([1, 2, 3]);
    expect(ids).toHaveLength(3);
  });
});

// ======================================================================================================
describe('ký duyệt H điều kiện 4 — đổi dòng CANCELLED về ACTIVE (đường "kích hoạt lại")', () => {
  it('CANCELLED không số → ACTIVE: chặn bởi enrollments_active_seat', async () => {
    const k = await newClass();
    await mustEnr('đang học', k);
    const c = await mustEnr('huỷ cũ không số', k, { status: 'CANCELLED' });
    expect(await seatOf(c)).toBeNull();
    expectBlocked('CANCELLED (NULL) → ACTIVE', await setEnr(c, REACTIVATE), '23514', 'enrollments_active_seat');
    // Vế GIỮ: kích hoạt lại kèm số còn trống thì ghi được.
    expectAllowed('CANCELLED → ACTIVE kèm số trống 9', await setEnr(c, `${REACTIVATE}, "seat_no" = 9`));
    expect(await counterOf(k)).toBe(9);
  });

  it('CANCELLED có số đã bị người khác giữ → ACTIVE: chặn bởi index một phần; số chưa ai giữ → ghi được', async () => {
    const k = await newClass();
    const a = await mustEnr('A (số 1)', k);
    expectAllowed('huỷ A — giữ số 1', await setEnr(a, CANCEL));
    const b = await mustEnr('B lấy lại số 1 (sửa tay)', k, { seat: 1 });
    expect(await seatOf(b)).toBe(1);
    expectBlocked('A (số 1, đã có B giữ) → ACTIVE', await setEnr(a, REACTIVATE), '23505', SEAT_ACTIVE);
    expect(await seatOf(a)).toBe(1);
    const c = await mustEnr('C (số 2)', k);
    expectAllowed('huỷ C — giữ số 2', await setEnr(c, CANCEL));
    expectAllowed('C (số 2, không ai giữ) → ACTIVE', await setEnr(c, REACTIVATE));
  });
});

// ======================================================================================================
describe('đua — hai giao dịch ghi danh cùng lớp cùng lúc không trùng số', () => {
  // Chờ tới khi câu mang `tag` đang kẹt khoá ở một phiên khác (chứng minh hai giao dịch thật sự chồng lên nhau).
  async function waitLocked(tag: string): Promise<boolean> {
    for (let i = 0; i < 100; i++) {
      const n = Number(
        (
          await db.$queryRawUnsafe<Array<{ n: bigint }>>(
            `SELECT count(*) AS n FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query LIKE $1`,
            `%${tag}%`,
          )
        )[0]!.n,
      );
      if (n > 0) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  // A ghi danh (chưa commit) → B ghi danh cùng lớp (phải chờ khoá dòng lớp) → A commit → B chạy tiếp.
  async function raceTwo(k: string) {
    const sA = await student(k);
    const sB = await student(k);
    const idA = randomUUID();
    const idB = randomUUID();
    const tag = `ma-so-dua-${idB}`;
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    let inserted!: () => void;
    const aInserted = new Promise<void>((r) => (inserted = r));
    const pA = db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(enrSql(k, sA, { id: idA }));
        inserted();
        await hold;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
    await aInserted;
    const pB = db.$transaction(async (tx) => tx.$executeRawUnsafe(enrSql(k, sB, { id: idB, prefix: `/* ${tag} */ ` })), { timeout: 20_000, maxWait: 10_000 });
    const waited = await waitLocked(tag);
    release();
    const [rA, rB] = await Promise.allSettled([pA, pB]);
    const errors = [rA, rB].flatMap((r) => (r.status === 'rejected' ? [`${pgErrorCode(r.reason) ?? '?'} ${String((r.reason as Error).message).slice(0, 200)}`] : []));
    return { a: rA.status === 'fulfilled' ? await seatOf(idA) : null, b: rB.status === 'fulfilled' ? await seatOf(idB) : null, waited, errors };
  }

  it('10 lượt × 2 giao dịch chồng nhau: số liền nhau, không trùng, lỗi 0', async () => {
    const k = await newClass();
    const res = { ok: 0, waited: 0, errors: [] as string[] };
    const seats: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await raceTwo(k);
      if (r.waited) res.waited++;
      res.errors.push(...r.errors);
      if (r.a !== null && r.b !== null && r.b === r.a + 1) res.ok++;
      seats.push(...[r.a, r.b].filter((s): s is number => s !== null));
    }
    console.log(`[bản vẽ H — đua] 2 giao dịch chồng nhau: đúng ${res.ok}/10; B thật sự chờ khoá ${res.waited}/10; lỗi khác ${res.errors.length}`);
    expect(res.errors).toEqual([]);
    expect(res.waited).toBe(10);
    expect(res.ok).toBe(10);
    expect(seats.sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(await counterOf(k)).toBe(20);
  });

  it('8 ghi danh đồng thời vào cùng lớp → đúng {1..8}', async () => {
    const k = await newClass();
    const studs = await Promise.all(Array.from({ length: 8 }, () => student(k)));
    const ids = studs.map(() => randomUUID());
    const outs = await Promise.all(studs.map((s, i) => run(enrSql(k, s, { id: ids[i]! }))));
    const fails = outs.filter((o) => !o.ok);
    const got = (await Promise.all(ids.map(seatOf))).filter((s): s is number => s !== null).sort((x, y) => x - y);
    console.log(`[bản vẽ H — đua] 8 ghi danh đồng thời: ghi được ${outs.length - fails.length}/8; số ${got.join(',')}`);
    expect(fails).toEqual([]);
    expect(got).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

// ======================================================================================================
// Tách tệp SQL thành từng câu (bỏ chú thích '--', giữ nguyên thân hàm $$…$$ và chuỗi '…').
function splitSql(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl < 0 ? sql.length : nl;
      continue;
    }
    if (ch === '$' && sql[i + 1] === '$') {
      const end = sql.indexOf('$$', i + 2);
      if (end < 0) throw new Error('Thân hàm $$ không đóng');
      cur += sql.slice(i, end + 2);
      i = end + 2;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      cur += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === ';') {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Đưa hai bảng về đúng hình dạng TRƯỚC migration (trong giao dịch sẽ quay lui).
const TEARDOWN = [
  `DROP TRIGGER IF EXISTS enrollments_seat_guard ON "enrollments"`,
  `DROP FUNCTION IF EXISTS enrollments_seat_guard()`,
  `DROP TRIGGER IF EXISTS course_classes_seat_counter_guard ON "course_classes"`,
  `DROP FUNCTION IF EXISTS course_classes_seat_counter_guard()`,
  `ALTER TABLE "enrollments" DROP COLUMN "seat_no" CASCADE`,
  `ALTER TABLE "course_classes" DROP COLUMN "seat_counter" CASCADE`,
];

class Rollback extends Error {}

describe('migration.sql trên dữ liệu cũ — đổ số TRƯỚC chốt; đoạn BACKFILL chạy hai lần ra y nguyên', () => {
  it('3 ACTIVE lệch giờ → 1, 2, 3 theo giờ; CANCELLED NULL; bộ đếm 3 và 0; cùng mili giây xếp theo id; toàn database khớp', async () => {
    const text = readFileSync(MIGRATION, 'utf8');
    const begin = text.indexOf('-- BACKFILL BEGIN');
    const end = text.indexOf('-- BACKFILL END');
    expect(begin, 'thiếu dấu -- BACKFILL BEGIN').toBeGreaterThan(0);
    expect(end, 'thiếu dấu -- BACKFILL END hoặc nằm trước BEGIN').toBeGreaterThan(begin);
    const head = splitSql(text.slice(0, end)); // ADD COLUMN + BACKFILL (và bất cứ gì lỡ đặt trước BACKFILL END)
    const backfill = splitSql(text.slice(begin, end));
    const tail = splitSql(text.slice(end));
    expect(backfill.length).toBeGreaterThan(0);

    // Dữ liệu cũ: lớp K (A3 ghi danh sớm nhất nhưng id lớn nhất — xếp theo id thì sai), CANCELLED ghi danh sớm hơn cả;
    // lớp rỗng; lớp T có hai người ghi danh cùng một mili giây.
    const K = await newClass();
    const E = await newClass();
    const T = await newClass();
    const t0 = `'2026-10-01 09:00:00.000+07'::timestamptz`;
    const plan = [
      { cls: K, id: '00000000-0000-4000-8000-00000000000c', at: `${t0} + interval '2 hours'`, status: 'ACTIVE' as const, want: 3 },
      { cls: K, id: '00000000-0000-4000-8000-00000000000a', at: `${t0} + interval '1 hour'`, status: 'ACTIVE' as const, want: 2 },
      { cls: K, id: '00000000-0000-4000-8000-00000000000e', at: t0, status: 'ACTIVE' as const, want: 1 },
      { cls: K, id: '00000000-0000-4000-8000-0000000000ff', at: `${t0} - interval '1 day'`, status: 'CANCELLED' as const, want: null },
      { cls: T, id: '00000000-0000-4000-8000-0000000000b2', at: t0, status: 'ACTIVE' as const, want: 2 },
      { cls: T, id: '00000000-0000-4000-8000-0000000000b1', at: t0, status: 'ACTIVE' as const, want: 1 },
    ];
    const studs = await Promise.all(plan.map((p) => student(p.cls)));
    // Mã cố định được: mọi dòng dựng ở đây nằm trong giao dịch sẽ quay lui.

    const snapshot = async (tx: Tx) =>
      tx.$queryRawUnsafe<Array<{ id: string; s: number | null }>>(
        `SELECT id::text, "seat_no" AS s FROM "enrollments" ORDER BY id`,
      );
    const counters = async (tx: Tx) =>
      tx.$queryRawUnsafe<Array<{ id: string; c: number }>>(`SELECT id::text, "seat_counter" AS c FROM "course_classes" ORDER BY id`);
    const q = async (tx: Tx, sql: string) => Number((await tx.$queryRawUnsafe<Array<{ n: bigint }>>(sql))[0]!.n);

    let report = '';
    const runAll = async (tx: Tx, stmts: string[], label: string) => {
      for (const s of stmts) {
        const out = await run(s, tx);
        if (!out.ok) throw new Error(`${label}: câu hỏng ${out.code}: ${s.slice(0, 160)} — ${out.text.slice(0, 300)}`);
      }
    };
    try {
      await db.$transaction(
        async (tx) => {
          await runAll(tx, TEARDOWN, 'đưa về trước migration');
          for (const [i, p] of plan.entries()) {
            // Không ghi cột seat_no (lúc này chưa có cột).
            await runAll(tx, [enrSql(p.cls, studs[i]!, { id: p.id, at: p.at, status: p.status })], `dữ liệu cũ ${p.id}`);
          }
          await runAll(tx, head, 'đầu migration (tới BACKFILL END)');
          const s1 = await snapshot(tx);
          const c1 = await counters(tx);
          await runAll(tx, backfill, 'BACKFILL lần hai');
          expect(await snapshot(tx), 'BACKFILL lần hai đổi seat_no').toEqual(s1);
          expect(await counters(tx), 'BACKFILL lần hai đổi seat_counter').toEqual(c1);
          await runAll(tx, tail, 'phần chốt + trigger');

          const bySeat = new Map(s1.map((r) => [r.id, r.s]));
          for (const p of plan) expect(bySeat.get(p.id), `seat_no của ${p.id}`).toBe(p.want);
          const byCounter = new Map(c1.map((r) => [r.id, r.c]));
          expect([byCounter.get(K), byCounter.get(E), byCounter.get(T)]).toEqual([3, 0, 2]);

          // Số đo mục 2.3 trên toàn database thử (gồm dữ liệu của mọi bài khác).
          const active = await q(tx, `SELECT count(*) AS n FROM "enrollments" WHERE "status" = 'ACTIVE'`);
          const activeSeat = await q(tx, `SELECT count(*) AS n FROM "enrollments" WHERE "status" = 'ACTIVE' AND "seat_no" IS NOT NULL`);
          const cancelledSeat = await q(tx, `SELECT count(*) AS n FROM "enrollments" WHERE "status" = 'CANCELLED' AND "seat_no" IS NOT NULL`);
          const classes = await q(tx, `SELECT count(*) AS n FROM "course_classes"`);
          const badCounter = await q(
            tx,
            `SELECT count(*) AS n FROM "course_classes" k
              WHERE k."seat_counter" <> (SELECT count(*) FROM "enrollments" e WHERE e."course_class_id" = k.id AND e."status" = 'ACTIVE')`,
          );
          const sameMs = await q(
            tx,
            `SELECT count(*) AS n FROM "enrollments" a JOIN "enrollments" b
               ON a."course_class_id" = b."course_class_id" AND a."enrolled_at" = b."enrolled_at" AND a.id < b.id
              WHERE a."status" = 'ACTIVE' AND b."status" = 'ACTIVE'`,
          );
          report =
            `ACTIVE có seat_no ${activeSeat}/${active}; lớp có seat_counter = số ACTIVE ${classes - badCounter}/${classes}; ` +
            `CANCELLED có seat_no ${cancelledSeat} dòng; cặp ACTIVE cùng lớp cùng mili giây ${sameMs}`;
          expect(activeSeat).toBe(active);
          expect(badCounter).toBe(0);
          expect(cancelledSeat).toBe(0);
          expect(sameMs).toBeGreaterThanOrEqual(1);
          throw new Rollback();
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
    console.log(`[bản vẽ H — migration trên dữ liệu cũ] ${report} (giao dịch đã quay lui)`);
    // Quay lui trọn: cột, chốt, trigger còn nguyên.
    expect(await counterOf(K)).toBe(0);
  });
});

// ======================================================================================================
describe('danh mục — đủ chốt, đúng định nghĩa (bắt cả chốt lưới thứ hai)', () => {
  it('3 CHECK, 1 index một phần, 2 trigger của bản vẽ H', async () => {
    const cons = await db.$queryRawUnsafe<Array<{ conname: string; def: string }>>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid IN ('enrollments'::regclass, 'course_classes'::regclass) AND contype = 'c'
          AND conname IN ('enrollments_seat_range', 'enrollments_active_seat', 'course_classes_seat_counter_range')`,
    );
    const byCon = new Map(cons.map((c) => [c.conname, c.def]));
    const want: Record<string, string> = {
      enrollments_seat_range: 'CHECK (((seat_no IS NULL) OR ((seat_no >= 1) AND (seat_no <= 999))))',
      enrollments_active_seat: `CHECK (((status <> 'ACTIVE'::"EnrollmentStatus") OR (seat_no IS NOT NULL)))`,
      course_classes_seat_counter_range: 'CHECK (((seat_counter >= 0) AND (seat_counter <= 999)))',
    };
    const idx = await db.$queryRawUnsafe<Array<{ indexdef: string }>>(`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'enrollments_seat_active'`);
    const triggers = await db.$queryRawUnsafe<Array<{ t: string }>>(
      `SELECT pg_get_triggerdef(t.oid) || CASE WHEN t.tgenabled = 'O' THEN '' ELSE ' (TẮT)' END AS t
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND t.tgname IN ('enrollments_seat_guard', 'course_classes_seat_counter_guard') ORDER BY t.tgname`,
    );
    const cols = await db.$queryRawUnsafe<Array<{ c: string }>>(
      `SELECT table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-') AS c
         FROM information_schema.columns WHERE table_schema = 'public'
          AND ((table_name = 'enrollments' AND column_name = 'seat_no') OR (table_name = 'course_classes' AND column_name = 'seat_counter'))
        ORDER BY 1`,
    );
    const bad = Object.keys(want).filter((n) => byCon.get(n) !== want[n]);
    console.log(`[bản vẽ H — danh mục] CHECK đúng ${3 - bad.length}/3; index một phần ${idx.length}/1; trigger ${triggers.length}/2; cột ${cols.length}/2`);
    expect(Object.fromEntries(Object.keys(want).map((n) => [n, byCon.get(n)]))).toEqual(want);
    expect(idx.map((r) => r.indexdef)).toEqual([
      `CREATE UNIQUE INDEX enrollments_seat_active ON public.enrollments USING btree (course_class_id, seat_no) WHERE (status = 'ACTIVE'::"EnrollmentStatus")`,
    ]);
    expect(triggers.map((r) => r.t)).toEqual([
      'CREATE TRIGGER course_classes_seat_counter_guard BEFORE UPDATE OF seat_counter ON public.course_classes FOR EACH ROW EXECUTE FUNCTION course_classes_seat_counter_guard()',
      'CREATE TRIGGER enrollments_seat_guard BEFORE INSERT OR UPDATE OF seat_no ON public.enrollments FOR EACH ROW EXECUTE FUNCTION enrollments_seat_guard()',
    ]);
    expect(cols.map((r) => r.c)).toEqual(['course_classes.seat_counter integer NO 0', 'enrollments.seat_no integer YES -']);
  });
});
