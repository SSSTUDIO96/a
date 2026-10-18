// T-I1 (biên bản nghiệm thu đợt sửa 1): hai lệnh ghi lịch vào cùng giờ đôi khi KHOÁ CHẾT (PostgreSQL 40P01) ở bước
// kiểm ràng buộc chặn trùng appointment_staff_no_overlap bên trong trigger appointments_sync_staff_block —
// bên thua nhận 500 thay vì 409 kèm danh sách lịch trùng.
//
// Gốc: mỗi lệnh ghi lịch ghi khoảng bận của thợ HAI lần trong một transaction (câu ghi appointment_staff, rồi trigger
// của câu UPDATE appointments ghi lại lần nữa). Ràng buộc EXCLUDE chờ dòng CHƯA commit của bên kia, nên hai bên mỗi
// bên giữ một dòng mới và chờ dòng của bên kia → vòng chờ.
// Sửa (modules/schedule/service.ts):
//   1) lockStaffSchedule: mọi cửa ghi lịch xin khoá tư vấn theo (tổ chức, thợ), xếp theo thứ tự cố định, TRƯỚC bước
//      kiểm trước → hai lệnh ghi cùng thợ xếp hàng, bên sau thấy lịch đã commit của bên trước → 409 kèm danh sách.
//   2) Lưới an toàn trong guardOverlap: gặp 40P01 (bên ghi lạ không xin khoá thợ) → quay về điểm lưu, ghi lại MỘT lần
//      để database chờ bên kia kết thúc rồi trả lời dứt khoát → 409 kèm conflicts (hoặc 200 nếu bên kia đã lui).
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { lockStaffSchedule } from '../src/modules/schedule/service';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

async function deadlocks(): Promise<bigint> {
  const rows = await deps.db.$queryRaw<{ deadlocks: bigint }[]>`SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`;
  return rows[0]?.deadlocks ?? 0n;
}

// Đợi tới khi có câu lệnh đang chờ khoá. kind = 'advisory': chỉ nhận chờ KHOÁ THỢ (khoá tư vấn), không nhận chờ
// dòng/giao dịch — để chứng minh yêu cầu API xếp hàng ở khoá thợ TRƯỚC khi ghi, chứ không phải bị ràng buộc chặn sau khi ghi.
async function waitForLockWait(kind: 'any' | 'advisory', timeoutMs = 4000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const rows =
      kind === 'advisory'
        ? await deps.db.$queryRaw<{ n: bigint }[]>`
            SELECT count(*) AS n FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
            WHERE a.datname = current_database() AND l.locktype = 'advisory' AND NOT l.granted`
        : await deps.db.$queryRaw<{ n: bigint }[]>`
            SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if ((rows[0]?.n ?? 0n) > 0n) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(kind === 'advisory' ? 'yêu cầu API KHÔNG xếp hàng ở khoá thợ (không có khoá tư vấn nào đang chờ)' : 'không thấy chờ khoá');
}

// Một transaction "bên ngoài" chạy từng bước theo lệnh của bài thử.
// holdAfterMs: giữ transaction thêm một lúc sau bước hai rồi mới commit (bên kia còn việc khác trong transaction).
function outsideTx(steps: {
  first: (tx: Prisma.TransactionClient) => Promise<unknown>;
  second?: (tx: Prisma.TransactionClient) => Promise<unknown>;
  holdAfterMs?: number;
}) {
  let go!: () => void;
  const gate = new Promise<void>((r) => (go = r));
  let ready!: () => void;
  const isReady = new Promise<void>((r) => (ready = r));
  const done = deps.db
    .$transaction(
      async (tx) => {
        await steps.first(tx);
        ready();
        await gate;
        if (steps.second) await steps.second(tx);
        if (steps.holdAfterMs) await new Promise((r) => setTimeout(r, steps.holdAfterMs));
      },
      { timeout: 30_000 },
    )
    .then(
      () => 'commit' as const,
      (e: Error) => `rollback: ${String(e.message).split('\n').slice(-2).join(' ').slice(0, 200)}`,
    );
  return { isReady, go, done };
}

type Res = request.Response;
const conflictIds = (r: Res): string[] => (r.body.error?.details?.conflicts ?? []).map((c: { appointmentId: string }) => c.appointmentId);

describe('T-I1 — khoá chết khi ghi lịch: không bao giờ 500', () => {
  let app: App;
  let owner: TestUser;
  let orgId: string;
  let mid: string;
  let mid2: string;
  let customerId: string;
  let serviceId: string;
  const at = (day: number, hh: string, mm = 0) => new Date(Date.UTC(2037, 0, 1 + day, Number(hh), mm)).toISOString();
  const post = (body: Record<string, unknown>) =>
    request(app).post(`/api/v1/orgs/${orgId}/appointments`).set(bearer(owner)).set('Idempotency-Key', randomUUID()).send(body);
  const slot = (day: number, status = 'CONFIRMED', m = mid) => ({ startsAt: at(day, '01'), endsAt: at(day, '02'), status, staff: [{ membershipId: m, role: 'PRIMARY' }] });
  const mk = async (day: number, status = 'CONFIRMED', m = mid) => {
    const r = await post(slot(day, status, m));
    if (r.status !== 201) throw new Error(`tạo lịch thử thất bại ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.id as string;
  };
  const moveTo = (tx: Prisma.TransactionClient, id: string, day: number, h1 = '01', h2 = '02') =>
    tx.appointment.update({ where: { id }, data: { startsAt: new Date(at(day, h1)), endsAt: new Date(at(day, h2)) } });

  beforeAll(async () => {
    app = makeApp(deps);
    owner = await registerUser(app, 'khoa-chet');
    orgId = await createOrg(app, owner, 'khoa-chet');
    mid = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } })).id;
    mid2 = await addMember(app, owner, orgId, await registerUser(app, 'khoa-chet-2'), ['artist']);
    customerId = (await deps.db.customer.create({ data: { organizationId: orgId, fullName: 'Khách khoá chết' } })).id;
    const svc = await deps.db.service.create({
      data: { organizationId: orgId, code: `KC-${randomUUID().slice(0, 6)}`, name: 'Makeup', kind: 'MAIN', durationMinutes: 60 },
    });
    await deps.db.priceVersion.create({
      data: { organizationId: orgId, serviceId: svc.id, listPrice: 100_000n, effectiveFrom: new Date(Date.now() - 60_000), createdById: owner.id },
    });
    serviceId = svc.id;
  });

  // Đúng bài khoa-chet.test.ts của thợ chấm (docs/nghiem-thu/bai-thu-dot-sua1/apps-api-test-cham): một giao dịch ngoài
  // KHÔNG xin khoá thợ chiếm giờ T, chờ API ghi, rồi đụng lại đúng dòng API vừa ghi → vòng chờ chắc chắn.
  // Trước khi sửa: 500 sau ~1,1 giây. Sau khi sửa: lưới an toàn trong guardOverlap trả 409 kèm lịch đang chiếm giờ.
  it('BẮT (lưới an toàn): khoá chết dựng chắc chắn → 409 kèm conflicts trỏ đúng lịch chiếm giờ, không 500', async () => {
    const a1 = await mk(1);
    const a2 = await mk(2);
    const a3 = await mk(3);
    const dl0 = await deadlocks();
    const other = outsideTx({
      first: (tx) => moveTo(tx, a2, 9), // chiếm [01:00, 02:00), chưa commit
      // [02:00, 03:00) đụng dòng API [01:30, 02:30), không đụng a2 → chờ API → vòng chờ
      second: (tx) => moveTo(tx, a3, 9, '02', '03'),
      // Bên kia còn 300 ms việc khác rồi mới commit: tra lại NGAY sau khoá chết sẽ chưa thấy lịch nào (409 rỗng);
      // lưới đúng phải đợi bên kia kết thúc rồi mới trả lời.
      holdAfterMs: 300,
    });
    await other.isReady;
    const t0 = Date.now();
    const api = request(app)
      .patch(`/api/v1/orgs/${orgId}/appointments/${a1}`)
      .set(bearer(owner))
      .send({ startsAt: at(9, '01', 30), endsAt: at(9, '02', 30) })
      .then((r) => r);
    await waitForLockWait('any');
    other.go();
    const [r, o] = await Promise.all([api, other.done]);
    const dl = (await deadlocks()) - dl0;
    console.log(`[T-I1] API ${r.status} (${Date.now() - t0}ms) conflicts=${JSON.stringify(conflictIds(r))}; giao dịch ngoài: ${o}; khoá chết +${dl}`);
    // Bài chỉ có giá trị khi khoá chết THẬT xảy ra (lưới an toàn được chạm tới).
    expect(dl).toBeGreaterThanOrEqual(1n);
    expect(r.status, JSON.stringify(r.body)).not.toBe(500);
    if (r.status === 409) {
      // API bị huỷ trong khoá chết: giao dịch ngoài commit, lịch a2 chiếm giờ → phải được nêu tên.
      expect(o).toBe('commit');
      expect(conflictIds(r)).toContain(a2);
      expect(r.body.error.message).toMatch(/^Trùng lịch: /);
    } else {
      // Giao dịch ngoài bị huỷ thay: giờ đó trống thật → API được ghi.
      expect(r.status).toBe(200);
      expect(o).toMatch(/^rollback/);
    }
    // Không bao giờ hai khoảng bận chồng nhau.
    const busy = await deps.db.appointmentStaff.count({
      where: { membershipId: mid, isBlocking: true, blockStart: { lt: new Date(at(9, '03')) }, blockEnd: { gt: new Date(at(9, '01')) } },
    });
    expect(busy).toBeLessThanOrEqual(2); // a2 [01–02) + a3 [02–03) hoặc a1 [01:30–02:30) một mình
  });

  // Khoá thợ: giao dịch ngoài xin CÙNG khoá thợ như mọi cửa ghi lịch, rồi làm đúng chuỗi bước gây khoá chết ở trên.
  // Đúng: API xếp hàng ở khoá thợ (chưa ghi gì) → không còn vòng chờ, khoá chết +0, API 409 kèm a2 ngay ở bước kiểm trước.
  it('GIỮ (khoá thợ): cùng chuỗi bước nhưng bên ngoài xin khoá thợ → API xếp hàng, khoá chết +0, 409 kèm conflicts', async () => {
    const a1 = await mk(21);
    const a2 = await mk(22);
    const a3 = await mk(23);
    const dl0 = await deadlocks();
    const other = outsideTx({
      first: async (tx) => {
        await lockStaffSchedule(tx, orgId, [mid], 'shared');
        await moveTo(tx, a2, 29);
      },
      second: (tx) => moveTo(tx, a3, 29, '02', '03'),
    });
    await other.isReady;
    const t0 = Date.now();
    const api = request(app)
      .patch(`/api/v1/orgs/${orgId}/appointments/${a1}`)
      .set(bearer(owner))
      .send({ startsAt: at(29, '01', 30), endsAt: at(29, '02', 30) })
      .then((r) => r);
    await waitForLockWait('advisory');
    other.go();
    const [r, o] = await Promise.all([api, other.done]);
    const dl = (await deadlocks()) - dl0;
    console.log(`[T-I1 khoá thợ] API ${r.status} (${Date.now() - t0}ms) conflicts=${JSON.stringify(conflictIds(r))}; giao dịch ngoài: ${o}; khoá chết +${dl}`);
    expect(o).toBe('commit');
    expect(dl).toBe(0n);
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(conflictIds(r).sort()).toEqual([a2, a3].sort());
  });

  // MỌI cửa ghi lịch có thể chạm ràng buộc chặn trùng phải xin khoá thợ TRƯỚC bước kiểm trước.
  // Cách đo: bên ngoài cầm khoá thợ + chiếm giờ (chưa commit); yêu cầu API phải đứng chờ Ở KHOÁ TƯ VẤN (không phải chờ
  // dòng sau khi đã ghi). Bỏ khoá ở cửa nào → bài của cửa đó đỏ ("KHÔNG xếp hàng ở khoá thợ").
  describe('mọi cửa ghi lịch xin khoá thợ trước bước kiểm', () => {
    async function expectQueuedThen409(day: number, send: () => Promise<Res>, label: string, m = mid) {
      const holder = await mk(day + 1, 'CONFIRMED', m);
      const other = outsideTx({
        first: async (tx) => {
          await lockStaffSchedule(tx, orgId, [m], 'shared');
          await moveTo(tx, holder, day);
        },
      });
      await other.isReady;
      const pending = send().then((r) => r);
      let queued = true;
      try {
        await waitForLockWait('advisory');
      } catch {
        queued = false;
      }
      other.go();
      const [r, o] = await Promise.all([pending, other.done]);
      console.log(`[T-I1 cửa] ${label}: xếp hàng ở khoá thợ=${queued}, API ${r.status}, conflicts=${JSON.stringify(conflictIds(r))}, ngoài: ${o}`);
      expect(queued, `${label}: không xếp hàng ở khoá thợ`).toBe(true);
      expect(o).toBe('commit');
      expect(r.status, `${label}: ${JSON.stringify(r.body)}`).toBe(409);
      expect(conflictIds(r), label).toContain(holder);
      return r;
    }

    it('cửa 1/5 — tạo lịch (POST /appointments)', async () => {
      await expectQueuedThen409(40, () => post(slot(40)), 'tạo lịch');
    });

    it('cửa 2/5 — sửa lịch: đổi giờ và đổi thợ (PATCH /appointments/:id)', async () => {
      const a = await mk(42);
      await expectQueuedThen409(44, () => request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a}`).set(bearer(owner)).send({ startsAt: at(44, '01'), endsAt: at(44, '02') }), 'đổi giờ');
      const b = await mk(46, 'CONFIRMED', mid);
      // b đang ở thợ 1 ngày 46; đổi sang thợ 2, thợ 2 đã bị chiếm ngày 46.
      await expectQueuedThen409(46, () => request(app).patch(`/api/v1/orgs/${orgId}/appointments/${b}`).set(bearer(owner)).send({ staff: [{ membershipId: mid2, role: 'PRIMARY' }] }), 'đổi thợ', mid2);
    });

    it('cửa 3/5 — đổi trạng thái nháp → đã xác nhận (POST /appointments/:id/status)', async () => {
      const draft = await mk(48, 'DRAFT');
      await expectQueuedThen409(48, () => request(app).post(`/api/v1/orgs/${orgId}/appointments/${draft}/status`).set(bearer(owner)).send({ to: 'CONFIRMED' }), 'đổi trạng thái');
    });

    const contractLine = (day: number) => ({
      kind: 'SERVICE',
      serviceId,
      quantity: 1,
      locationType: 'STUDIO',
      scheduledStart: at(day, '01'),
      scheduledEnd: at(day, '02'),
      staff: [{ membershipId: mid, role: 'PRIMARY' }],
    });

    it('cửa 4/5 — xác nhận hợp đồng (createAppointmentTx qua module hợp đồng)', async () => {
      const c = await request(app).post(`/api/v1/orgs/${orgId}/contracts`).set(bearer(owner)).set('Idempotency-Key', randomUUID()).send({ customerId, lines: [contractLine(50)] });
      expect(c.status, JSON.stringify(c.body)).toBe(201);
      await expectQueuedThen409(50, () => request(app).post(`/api/v1/orgs/${orgId}/contracts/${c.body.id}/status`).set(bearer(owner)).send({ to: 'CONFIRMED' }), 'xác nhận hợp đồng');
      expect((await deps.db.contract.findUniqueOrThrow({ where: { id: c.body.id } })).status).toBe('DRAFT');
    });

    it('cửa 5/5 — thêm dòng có thợ vào hợp đồng đã xác nhận (createAppointmentTx qua module hợp đồng)', async () => {
      const c = await request(app)
        .post(`/api/v1/orgs/${orgId}/contracts`)
        .set(bearer(owner))
        .set('Idempotency-Key', randomUUID())
        .send({ customerId, lines: [{ ...contractLine(52), staff: [] }] });
      expect(c.status, JSON.stringify(c.body)).toBe(201);
      const conf = await request(app).post(`/api/v1/orgs/${orgId}/contracts/${c.body.id}/status`).set(bearer(owner)).send({ to: 'CONFIRMED' });
      expect(conf.status, JSON.stringify(conf.body)).toBe(200);
      await expectQueuedThen409(
        54,
        () => request(app).post(`/api/v1/orgs/${orgId}/contracts/${c.body.id}/lines`).set(bearer(owner)).set('Idempotency-Key', randomUUID()).send(contractLine(54)),
        'thêm dòng sau xác nhận',
      );
    });
  });

  // Thứ tự khoá cố định: mọi lời gọi xin khoá tổ chức trước, rồi khoá thợ theo giá trị khoá tăng dần, không lặp —
  // bất kể thứ tự thợ trong yêu cầu. Đo bằng một transaction giả ghi lại từng câu khoá.
  it('GIỮ (thứ tự khoá): khoá tổ chức trước, khoá thợ tăng dần và không lặp, bất kể thứ tự đầu vào', async () => {
    const calls: { sql: string; key: bigint }[] = [];
    const fake = {
      $executeRaw: (strings: TemplateStringsArray, ...vals: unknown[]) => {
        calls.push({ sql: strings.join('?'), key: vals[0] as bigint });
        return Promise.resolve(1);
      },
    } as unknown as Prisma.TransactionClient;
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const orders = [ids, [...ids].reverse(), [ids[2]!, ids[0]!, ids[3]!, ids[1]!, ids[0]!]];
    const seen: string[] = [];
    for (const [i, order] of orders.entries()) {
      calls.length = 0;
      await lockStaffSchedule(fake, orgId, order, i === 0 ? 'exclusive' : 'shared');
      expect(calls[0]!.sql).toMatch(i === 0 ? /pg_advisory_xact_lock\(/ : /pg_advisory_xact_lock_shared\(/);
      const staffKeys = calls.slice(1).map((c) => c.key);
      expect(calls.slice(1).every((c) => /pg_advisory_xact_lock\(/.test(c.sql))).toBe(true);
      expect(staffKeys).toHaveLength(4);
      expect(staffKeys).toEqual([...staffKeys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
      seen.push(staffKeys.join(','));
    }
    expect(new Set(seen).size).toBe(1);
  });

  // Tạo lịch giữ khoá tổ chức ĐỘC QUYỀN: module hợp đồng gọi createAppointmentTx nhiều lần trong một transaction nên
  // khoá thợ của nó không theo một thứ tự chung — phải đợi mọi lệnh ghi lịch khác của tổ chức xong, kể cả của thợ khác.
  it('GIỮ (khoá tổ chức độc quyền khi tạo lịch): đang có lệnh ghi lịch của THỢ KHÁC → tạo lịch xếp hàng, xong thì 201', async () => {
    const other = outsideTx({ first: (tx) => lockStaffSchedule(tx, orgId, [mid2], 'shared') });
    await other.isReady;
    const pending = post(slot(56)).then((r) => r);
    let queued = true;
    try {
      await waitForLockWait('advisory');
    } catch {
      queued = false;
    }
    other.go();
    const [r, o] = await Promise.all([pending, other.done]);
    console.log(`[T-I1 khoá tổ chức] tạo lịch xếp hàng sau lệnh của thợ khác=${queued}, API ${r.status}, ngoài: ${o}`);
    expect(queued).toBe(true);
    expect(o).toBe('commit');
    expect(r.status, JSON.stringify(r.body)).toBe(201);
  });

  // Bài đua N4 viết lại: đếm RIÊNG lượt bên thua nhận 500 (bài cũ gộp vào "không có bên thua").
  // Mỗi lượt: hai lệnh ghi đồng thời vào cùng một giờ của cùng thợ, trộn đủ kiểu cửa (dời–dời, tạo–dời, tạo–tạo, xác nhận–dời).
  it('BẮT (đua N4): 20 lượt hai lệnh ghi cùng giờ → mỗi lượt đúng 1 thắng + 1 thua 409 có conflicts; 500 = 0', async () => {
    const ROUNDS = 20;
    const a1 = await mk(60);
    const a2 = await mk(61);
    const dl0 = await deadlocks();
    const dist: Record<string, number> = {};
    let n500 = 0;
    let n409empty = 0;
    let overlapInDb = 0;
    const odd: string[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      const day = 70 + i;
      const target = { startsAt: at(day, '01'), endsAt: at(day, '02') };
      const kind = ['dời–dời', 'tạo–dời', 'tạo–tạo', 'xác nhận–dời'][i % 4]!;
      const draft = kind === 'xác nhận–dời' ? await mk(day, 'DRAFT') : null;
      const patch = (id: string) => request(app).patch(`/api/v1/orgs/${orgId}/appointments/${id}`).set(bearer(owner)).send(target);
      const pair: Promise<Res>[] =
        kind === 'dời–dời'
          ? [patch(a1), patch(a2)]
          : kind === 'tạo–dời'
            ? [post(slot(day)), patch(a2)]
            : kind === 'tạo–tạo'
              ? [post(slot(day)), post(slot(day))]
              : [request(app).post(`/api/v1/orgs/${orgId}/appointments/${draft}/status`).set(bearer(owner)).send({ to: 'CONFIRMED' }), patch(a2)];
      const res = await Promise.all(pair);
      const ok = res.filter((r) => r.status === 200 || r.status === 201);
      const lost = res.filter((r) => r.status === 409);
      n500 += res.filter((r) => r.status >= 500).length;
      for (const l of lost) if (conflictIds(l).length === 0) n409empty++;
      const sig = `${kind}: ${res.map((r) => (r.status === 409 ? `409(${conflictIds(r).length})` : String(r.status))).sort().join('+')}`;
      dist[sig] = (dist[sig] ?? 0) + 1;
      if (ok.length !== 1 || lost.length !== 1) odd.push(`lượt ${i} ${sig} :: ${res.map((r) => JSON.stringify(r.body).slice(0, 200)).join(' || ')}`);
      const busy = await deps.db.appointmentStaff.count({
        where: { membershipId: mid, isBlocking: true, blockStart: { lt: new Date(target.endsAt) }, blockEnd: { gt: new Date(target.startsAt) } },
      });
      if (busy > 1) overlapInDb++;
      // Trả hai lịch dời về chỗ cũ cho lượt sau.
      await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a1}`).set(bearer(owner)).send({ startsAt: at(60, '01'), endsAt: at(60, '02') }).expect(200);
      await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a2}`).set(bearer(owner)).send({ startsAt: at(61, '01'), endsAt: at(61, '02') }).expect(200);
    }
    const dl = (await deadlocks()) - dl0;
    console.log(`[N4-Q] ${ROUNDS} lượt; bên thua 500: ${n500}; 409 thiếu conflicts: ${n409empty}; trùng thật trong DB: ${overlapInDb}; khoá chết +${dl}; phân bố ${JSON.stringify(dist)}`);
    for (const o of odd) console.log(`[N4-Q-LECH] ${o}`);
    expect(n500).toBe(0);
    expect(n409empty).toBe(0);
    expect(overlapInDb).toBe(0);
    expect(odd).toEqual([]);
    expect(dl).toBe(0n);
  }, 120_000);
});
