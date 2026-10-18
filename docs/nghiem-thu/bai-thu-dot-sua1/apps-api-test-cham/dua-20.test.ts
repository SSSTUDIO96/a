// Bài thợ chấm: K lịch cùng một thợ, đồng loạt dời vào CÙNG một giờ. Đúng: 1×200, (K-1)×409 kèm conflicts trỏ đúng lịch thắng.
// Đồng thời: tổ chức B có lịch cùng giờ (thợ khác) — conflicts của A không được chứa lịch của B.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import request from 'supertest';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
afterAll(async () => { await deps.db.$disconnect(); });
const K = Number(process.env.K ?? 20);
const ROUNDS = Number(process.env.ROUNDS ?? 5);

describe('đua K lịch', () => {
  let app: App; let owner: TestUser; let orgId: string; let mid: string;
  let ownerB: TestUser; let orgB: string; let midB: string;
  const at = (day: number, hh: string) => new Date(Date.UTC(2035, 0, 1 + day, Number(hh))).toISOString();
  beforeAll(async () => {
    app = makeApp(deps);
    owner = await registerUser(app, 'cham-k'); orgId = await createOrg(app, owner, 'cham-k');
    mid = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } })).id;
    ownerB = await registerUser(app, 'cham-kb'); orgB = await createOrg(app, ownerB, 'cham-kb');
    midB = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgB } })).id;
  });
  it('đua', async () => {
    const mk = (u: TestUser, o: string, m: string, day: number) => request(app).post(`/api/v1/orgs/${o}/appointments`).set(bearer(u)).set('Idempotency-Key', randomUUID())
      .send({ startsAt: at(day, '01'), endsAt: at(day, '02'), status: 'CONFIRMED', staff: [{ membershipId: m, role: 'PRIMARY' }] });
    const ids: string[] = [];
    for (let i = 0; i < K; i++) { const r = await mk(owner, orgId, mid, i); if (r.status !== 201) throw new Error(JSON.stringify(r.body)); ids.push(r.body.id); }
    const dist: Record<string, number> = {};
    const notes: string[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const day = 100 + round;
      const bAppt = await mk(ownerB, orgB, midB, day); // lịch tổ chức B cùng giờ đích
      const target = { startsAt: at(day, '01'), endsAt: at(day, '02') };
      const t0 = Date.now();
      const res = await Promise.all(ids.map((id) => request(app).patch(`/api/v1/orgs/${orgId}/appointments/${id}`).set(bearer(owner)).send(target)));
      const ms = Date.now() - t0;
      const winners = res.map((r, i) => (r.status === 200 ? ids[i] : null)).filter(Boolean) as string[];
      let n200 = 0, n409ok = 0, n409empty = 0, n409nodetail = 0, other = 0, leakB = 0, wrongRef = 0;
      for (const r of res) {
        if (r.status === 200) n200++;
        else if (r.status === 409) {
          const c = r.body.error?.details?.conflicts;
          if (!Array.isArray(c)) n409nodetail++;
          else if (c.length === 0) n409empty++;
          else {
            n409ok++;
            if (c.some((x: { appointmentId: string }) => x.appointmentId === bAppt.body.id)) leakB++;
            if (!c.every((x: { appointmentId: string }) => winners.includes(x.appointmentId))) wrongRef++;
          }
        } else { other++; notes.push(`vòng ${round}: ${r.status} ${JSON.stringify(r.body).slice(0, 250)}`); }
      }
      const busy = await deps.db.appointmentStaff.count({ where: { membershipId: mid, isBlocking: true, blockStart: { lt: new Date(target.endsAt) }, blockEnd: { gt: new Date(target.startsAt) } } });
      const sig = `200×${n200} 409có×${n409ok} 409rỗng×${n409empty} 409thiếu×${n409nodetail} khác×${other} lộB×${leakB} sai-tham-chiếu×${wrongRef} bận-thật×${busy}`;
      dist[sig] = (dist[sig] ?? 0) + 1;
      console.log(`[CHAM-K] vòng ${round} (${ms}ms): ${sig}`);
      for (let i = 0; i < K; i++) {
        const r = await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${ids[i]}`).set(bearer(owner)).send({ startsAt: at(i, '01'), endsAt: at(i, '02') });
        if (r.status !== 200) notes.push(`trả chỗ cũ ${i}: ${r.status}`);
      }
    }
    console.log(`[CHAM-K] K=${K} ROUNDS=${ROUNDS} phân bố: ${JSON.stringify(dist)}`);
    for (const n of notes) console.log(`[CHAM-K-LECH] ${n}`);
  }, 600_000);
});
