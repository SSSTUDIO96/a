// GIẤY CHỨNG NHẬN — bài đua (BAN-VE-F mục 9.1). 10 lượt mỗi ca, đếm RIÊNG từng kết cục: thắng / thua đúng 409 / lỗi khác.
// "Lỗi khác" phải bằng 0 (sổ lỗi 18). Hai yêu cầu gửi CÙNG LÚC qua HTTP thật (supertest, Promise.all).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, createAcademyOrg, grantUnlimitedPlan, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;
beforeAll(() => {
  app = makeApp(deps);
});
afterAll(async () => {
  await db.$disconnect();
});

const ROUNDS = 10;
const ENDED = '2026-03-30';
const idem = () => `k-${randomUUID()}`;

interface Org {
  orgId: string;
  owner: TestUser;
}

async function academy(label: string): Promise<Org> {
  const owner = await registerUser(app, `gcn-dua-${label}`);
  const orgId = await createAcademyOrg(app, owner, `gcn-dua-${label}`);
  await grantUnlimitedPlan(db, orgId);
  return { orgId, owner };
}

const api = (a: Org, rest: string) => `/api/v1/orgs/${a.orgId}${rest}`;

async function postOk(a: Org, path: string, body: object) {
  const r = await request(app).post(api(a, path)).set(bearer(a.owner)).set('idempotency-key', idem()).send(body);
  if (r.status !== 201 && r.status !== 200) throw new Error(`${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

async function klass(a: Org): Promise<string> {
  const c = await postOk(a, '/courses', {
    name: `Khoá ${randomUUID().slice(0, 6)}`,
    mode: 'MULTI_CLASS',
    tuitionFee: 1_000_000,
    defaultCapacity: 100,
    firstClass: { name: `Lớp ${randomUUID().slice(0, 6)}`, startDate: '2026-02-01', endDate: ENDED, weekdays: [2] },
  });
  return c.classes[0].id as string;
}

async function students(a: Org, classId: string, n: number): Promise<string[]> {
  const customerIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const customerId = (await postOk(a, '/customers', { fullName: `Học viên đua ${i}` })).id as string;
    const contractId = (await postOk(a, '/contracts', { kind: 'COURSE', customerId, lines: [{ kind: 'COURSE', courseClassId: classId }] })).id;
    await postOk(a, `/contracts/${contractId}/status`, { to: 'CONFIRMED' });
    customerIds.push(customerId);
  }
  const list = await request(app).get(api(a, `/classes/${classId}/enrollments`)).set(bearer(a.owner)).expect(200);
  const items = list.body.items as { id: string; customer: { id: string } }[];
  return customerIds.map((c) => items.find((e) => e.customer.id === c)!.id);
}

const issue = (a: Org, classId: string, enrollmentIds: string[]) =>
  request(app)
    .post(api(a, `/classes/${classId}/certificates`))
    .set(bearer(a.owner))
    .set('idempotency-key', idem())
    .send({ enrollmentIds, templateCode: 'cc-01', issuedOn: ENDED });

const reissue = (a: Org, id: string) =>
  request(app).post(api(a, `/certificates/${id}/reissue`)).set(bearer(a.owner)).set('idempotency-key', idem()).send({ reason: 'Đua cấp lại' });

const revoke = (a: Org, id: string) => request(app).post(api(a, `/certificates/${id}/revoke`)).set(bearer(a.owner)).send({ reason: 'Đua thu hồi' });

interface Tally {
  win: number;
  lose409: number;
  other: number;
  notes: string[];
}
const tally = (): Tally => ({ win: 0, lose409: 0, other: 0, notes: [] });

describe('đua cấp giấy chứng nhận', () => {
  it('ca 1 — hai lệnh cấp hàng loạt cùng lớp, cùng học viên, khác khoá, cùng lúc: cả hai 201, đúng N bản, số không trùng', async () => {
    const a = await academy('ca1');
    const t = tally();
    for (let r = 0; r < ROUNDS; r++) {
      const classId = await klass(a);
      const ids = await students(a, classId, 3);
      const res = await Promise.all([issue(a, classId, ids), issue(a, classId, [...ids].reverse())]);
      for (const x of res) {
        if (x.status === 201) t.win++;
        else if (x.status === 409) t.lose409++;
        else (t.other++, t.notes.push(`${x.status} ${JSON.stringify(x.body)}`));
      }
      const rows = await db.certificate.findMany({ where: { organizationId: a.orgId, courseClassId: classId }, select: { code: true, enrollmentId: true } });
      expect(rows.length, `lượt ${r}`).toBe(3);
      expect(new Set(rows.map((x) => x.enrollmentId)).size).toBe(3);
      // Hai phản hồi trả CÙNG bộ số (một bên cấp mới, bên kia thấy đã có).
      const codes = res.map((x) => (x.body.items as { code: string }[] | undefined)?.map((i) => i.code).join(','));
      expect(codes[0]).toBe(codes[1]);
      expect(res.map((x) => x.body.issuedCount).sort()).toEqual([0, 3]);
    }
    const all = await db.certificate.findMany({ where: { organizationId: a.orgId }, select: { code: true } });
    console.log(`[đua ca 1] thắng ${t.win}, thua 409 ${t.lose409}, lỗi khác ${t.other}; ${all.length} bản, ${new Set(all.map((x) => x.code)).size} số khác nhau ${t.notes.join(' | ')}`);
    expect(t).toMatchObject({ win: 2 * ROUNDS, lose409: 0, other: 0 });
    expect(new Set(all.map((x) => x.code)).size).toBe(all.length);
  });

  it('ca 2 — hai lớp khác nhau cấp cùng lúc: mọi seq duy nhất và liền nhau 1..N', async () => {
    const a = await academy('ca2');
    const t = tally();
    for (let r = 0; r < ROUNDS; r++) {
      const k1 = await klass(a);
      const k2 = await klass(a);
      const e1 = await students(a, k1, 2);
      const e2 = await students(a, k2, 2);
      const res = await Promise.all([issue(a, k1, e1), issue(a, k2, e2)]);
      for (const x of res) {
        if (x.status === 201) t.win++;
        else if (x.status === 409) t.lose409++;
        else (t.other++, t.notes.push(`${x.status} ${JSON.stringify(x.body)}`));
      }
    }
    const seqs = (await db.certificate.findMany({ where: { organizationId: a.orgId, year: 2026 }, select: { seq: true } })).map((x) => x.seq).sort((x, y) => x - y);
    console.log(`[đua ca 2] thắng ${t.win}, thua 409 ${t.lose409}, lỗi khác ${t.other}; seq ${seqs[0]}..${seqs[seqs.length - 1]} (${seqs.length} bản) ${t.notes.join(' | ')}`);
    expect(t).toMatchObject({ win: 2 * ROUNDS, lose409: 0, other: 0 });
    expect(seqs).toEqual(Array.from({ length: 4 * ROUNDS }, (_, i) => i + 1));
  });

  it('ca 3 — cấp lại và thu hồi cùng một bản cùng lúc: một bên thắng, bên kia 409 CERTIFICATE_REVOKED', async () => {
    const a = await academy('ca3');
    const classId = await klass(a);
    const ids = await students(a, classId, ROUNDS);
    const certs = (await postOk(a, `/classes/${classId}/certificates`, { enrollmentIds: ids, templateCode: 'cc-01', issuedOn: ENDED })).items as { id: string }[];
    const t = tally();
    for (let r = 0; r < ROUNDS; r++) {
      const id = certs[r]!.id;
      const res = await Promise.all([reissue(a, id), revoke(a, id)]);
      for (const x of res) {
        if (x.status === 201 || x.status === 200) t.win++;
        else if (x.status === 409 && x.body.error?.details?.reason === 'CERTIFICATE_REVOKED') t.lose409++;
        else (t.other++, t.notes.push(`${x.status} ${JSON.stringify(x.body)}`));
      }
      const live = await db.certificate.count({ where: { organizationId: a.orgId, enrollmentId: ids[r], status: 'ISSUED' } });
      // Cấp lại thắng → 1 bản hiệu lực (bản mới); thu hồi thắng → 0.
      expect(live).toBe(res[0]!.status === 201 ? 1 : 0);
    }
    console.log(`[đua ca 3] thắng ${t.win}, thua 409 ${t.lose409}, lỗi khác ${t.other} ${t.notes.join(' | ')}`);
    expect(t).toMatchObject({ win: ROUNDS, lose409: ROUNDS, other: 0 });
  });

  it('ca 4 — cấp hàng loạt và cấp lại trên cùng ghi danh cùng lúc: luôn đúng 1 bản hiệu lực, lỗi khác = 0', async () => {
    const a = await academy('ca4');
    const classId = await klass(a);
    const ids = await students(a, classId, ROUNDS);
    const certs = (await postOk(a, `/classes/${classId}/certificates`, { enrollmentIds: ids, templateCode: 'cc-01', issuedOn: ENDED })).items as { id: string; code: string }[];
    const t = tally();
    for (let r = 0; r < ROUNDS; r++) {
      const res = await Promise.all([issue(a, classId, [ids[r]!]), reissue(a, certs[r]!.id)]);
      for (const x of res) {
        if (x.status === 201) t.win++;
        else if (x.status === 409) t.lose409++;
        else (t.other++, t.notes.push(`${x.status} ${JSON.stringify(x.body)}`));
      }
      const live = await db.certificate.findMany({ where: { organizationId: a.orgId, enrollmentId: ids[r], status: 'ISSUED' }, select: { code: true } });
      expect(live.map((x) => x.code)).toEqual([certs[r]!.code]);
    }
    console.log(`[đua ca 4] thắng ${t.win}, thua 409 ${t.lose409}, lỗi khác ${t.other} ${t.notes.join(' | ')}`);
    expect(t).toMatchObject({ win: 2 * ROUNDS, lose409: 0, other: 0 });
  });
});
