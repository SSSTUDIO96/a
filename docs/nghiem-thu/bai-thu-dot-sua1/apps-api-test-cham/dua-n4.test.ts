// Bài thợ chấm: đua đổi giờ N4, ghi chi tiết từng lượt. ROUNDS, LOAD qua biến môi trường.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import request from 'supertest';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
afterAll(async () => { await deps.db.$disconnect(); });
const ROUNDS = Number(process.env.ROUNDS ?? 20);

describe('đua N4 chi tiết', () => {
  let app: App; let owner: TestUser; let orgId: string; let mid: string;
  const at = (day: number, hh: string) => `2034-0${1 + Math.floor(day / 28)}-${String(1 + (day % 28)).padStart(2, '0')}T${hh}:00:00Z`;
  beforeAll(async () => {
    app = makeApp(deps);
    owner = await registerUser(app, 'cham-dua');
    orgId = await createOrg(app, owner, 'cham-dua');
    mid = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } })).id;
  });
  it('đua', async () => {
    const post = (day: number) => request(app).post(`/api/v1/orgs/${orgId}/appointments`).set(bearer(owner)).set('Idempotency-Key', randomUUID())
      .send({ startsAt: at(day, '01'), endsAt: at(day, '02'), status: 'CONFIRMED', staff: [{ membershipId: mid, role: 'PRIMARY' }] });
    const a1 = await post(0); const a2 = await post(1);
    const dist: Record<string, number> = {};
    const odd: string[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      const target = { startsAt: at(2 + i, '01'), endsAt: at(2 + i, '02') };
      const t0 = Date.now();
      const [x, y] = await Promise.all([
        request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a1.body.id}`).set(bearer(owner)).send(target),
        request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a2.body.id}`).set(bearer(owner)).send(target),
      ]);
      const ms = Date.now() - t0;
      const sig = [x, y].map((r) => r.status === 409 ? `409(${(r.body.error?.details?.conflicts ?? 'KHONG').length ?? '?'})` : String(r.status)).sort().join('+');
      dist[sig] = (dist[sig] ?? 0) + 1;
      if (!sig.includes('409(1)') || sig !== '200+409(1)') odd.push(`lượt ${i}: ${sig} ${ms}ms :: ${[x, y].map((r) => JSON.stringify(r.body).slice(0, 300)).join(' || ')}`);
      // số dòng chiếm giờ thực trong DB ở khung đích
      const busy = await deps.db.appointmentStaff.count({ where: { organizationId: orgId, isBlocking: true, blockStart: { lt: new Date(target.endsAt) }, blockEnd: { gt: new Date(target.startsAt) } } });
      if (busy > 1) odd.push(`lượt ${i}: TRÙNG LỊCH THẬT trong DB: ${busy} khoảng bận`);
      const r1 = await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a1.body.id}`).set(bearer(owner)).send({ startsAt: at(0, '01'), endsAt: at(0, '02') });
      const r2 = await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a2.body.id}`).set(bearer(owner)).send({ startsAt: at(1, '01'), endsAt: at(1, '02') });
      if (r1.status !== 200 || r2.status !== 200) odd.push(`lượt ${i}: trả về chỗ cũ ${r1.status}/${r2.status}`);
    }
    console.log(`[CHAM-N4] ROUNDS=${ROUNDS} phân bố: ${JSON.stringify(dist)}`);
    for (const o of odd) console.log(`[CHAM-N4-LECH] ${o}`);
  }, 300_000);
});
