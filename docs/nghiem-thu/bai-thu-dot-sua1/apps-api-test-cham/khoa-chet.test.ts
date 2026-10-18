// Bài thợ chấm: dựng chắc chắn tình huống "khoá chết" (deadlock) giữa yêu cầu đổi giờ của API và một giao dịch khác
// cùng chen vào một giờ — đúng thứ ràng buộc EXCLUDE gây ra khi hai bên ghi gần như cùng lúc. Xem API trả gì.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
afterAll(async () => { await deps.db.$disconnect(); });

async function waitForLockWait() {
  for (let i = 0; i < 200; i++) {
    const rows = await deps.db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if ((rows[0]?.n ?? 0n) > 0n) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('không thấy chờ khoá');
}

describe('khoá chết', () => {
  let app: App; let owner: TestUser; let orgId: string; let mid: string;
  const at = (day: number, hh: string, mm = 0) => new Date(Date.UTC(2036, 0, 1 + day, Number(hh), mm)).toISOString();
  beforeAll(async () => {
    app = makeApp(deps);
    owner = await registerUser(app, 'cham-kc'); orgId = await createOrg(app, owner, 'cham-kc');
    mid = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } })).id;
  });
  it('API dính deadlock khi đổi giờ', async () => {
    const mk = (day: number) => request(app).post(`/api/v1/orgs/${orgId}/appointments`).set(bearer(owner)).set('Idempotency-Key', randomUUID())
      .send({ startsAt: at(day, '01'), endsAt: at(day, '02'), status: 'CONFIRMED', staff: [{ membershipId: mid, role: 'PRIMARY' }] });
    const a1 = (await mk(1)).body.id; const a2 = (await mk(2)).body.id; const a3 = (await mk(3)).body.id;
    const T = { startsAt: new Date(at(9, '01')), endsAt: new Date(at(9, '02')) };
    let step2!: () => void; const go2 = new Promise<void>((r) => (step2 = r));
    let ready!: () => void; const isReady = new Promise<void>((r) => (ready = r));
    const other = deps.db.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id: a2 }, data: T }); // chiếm giờ T, chưa commit
      ready();
      await go2;
      await tx.appointment.update({ where: { id: a3 }, data: { startsAt: new Date(at(9, '02')), endsAt: new Date(at(9, '03')) } }); // [02:00,03:00) đụng dòng API [01:30,02:30), không đụng a2 [01:00,02:00) → chờ API → vòng chờ
    }, { timeout: 30_000 }).then(() => 'commit', (e: Error) => `rollback: ${String(e.message).split('\n').slice(-2).join(' ').slice(0, 200)}`);
    await isReady;
    const t0 = Date.now();
    const api = request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a1}`).set(bearer(owner)).send({ startsAt: at(9, '01', 30), endsAt: at(9, '02', 30) }).then((r) => r);
    await waitForLockWait();
    step2();
    const [r, o] = await Promise.all([api, other]);
    console.log(`[CHAM-KC] API: ${r.status} (${Date.now() - t0}ms) ${JSON.stringify(r.body).slice(0, 400)}`);
    console.log(`[CHAM-KC] giao dịch kia: ${o}`);
    const dl = await deps.db.$queryRaw<{ deadlocks: bigint }[]>`SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`;
    console.log(`[CHAM-KC] pg_stat_database.deadlocks = ${dl[0]?.deadlocks}`);
    expect([200, 409]).toContain(r.status);
  }, 60_000);
});
