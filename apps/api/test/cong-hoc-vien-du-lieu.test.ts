// Bản vẽ E, gói E3 — DỮ LIỆU của GET /portal/me (mục 4.2; bài thử 6.2 phần E3, tệp cong-hoc-vien-du-lieu.test.ts, ca 1–3)
// + ký duyệt E câu 2 (thẻ portalVisible = false không hiện) và câu 4 (huỷ ghi danh vẫn xem hợp đồng cũ).
// Mỗi bài ghi BẮT / GIỮ. Dữ liệu dựng qua đường thật (lớp, hợp đồng, xác nhận, tiến độ, phiếu, huỷ phiếu, huỷ dòng, buổi học
// của K2); chỉ thẻ thiết kế, hồ sơ trung tâm, cài đặt ngân hàng ghi thẳng database.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callName, transferNote, type PortalMe } from '@makeup/shared';
import { bearer, type App } from './helpers';
import {
  api,
  createLink,
  enroll,
  makeApp,
  makeClass,
  makePortalDeps,
  makeStudent,
  me,
  openOk,
  post,
  receipt,
  seedCard,
  setupAcademy,
  uuidsIn,
  type Academy,
  type Student,
} from './portal-helpers';

const deps = makePortalDeps();
let app: App;
let A: Academy;
let B: Academy;
let K: { id: string; name: string };
let KB: { id: string; name: string };
let A1: Student;
let A2: Student;
let T1: Student;
let C1: { id: string; code: string };
let C2: { id: string; code: string };
let C3: { id: string; code: string };
let CB: { id: string; code: string };
let draft: { id: string; code: string };
let cancelled: { id: string; code: string };
let p1: { id: string; code: string };
let pVoid: { id: string; code: string };
let p2: { id: string; code: string };
let pB: { id: string; code: string };
let rulesId: string;
let tokA1: string;
let tokA2: string;
let tokT1: string;
let hiddenCardId: string;
const RULES_V1 = 'Nội quy lớp bản một: đi học đúng giờ.';

async function getMe(token: string): Promise<PortalMe> {
  const r = await me(app, token);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as PortalMe;
}

beforeAll(async () => {
  app = makeApp(deps);
  A = await setupAcademy(app, deps, 'da');
  B = await setupAcademy(app, deps, 'db');
  // Nội quy mẫu mặc định cho hợp đồng khoá học (hợp đồng chụp bản lúc xác nhận).
  const rules = await post(app, A.owner, `${api(A)}/contract-texts`, { kind: 'RULES', appliesTo: ['COURSE'], name: 'Nội quy lớp', body: RULES_V1, isDefault: true });
  expect(rules.status, JSON.stringify(rules.body)).toBe(201);
  rulesId = rules.body.id;
  // Hồ sơ trung tâm (tên thương hiệu, liên hệ).
  await deps.db.organizationProfile.create({
    data: { organizationId: A.orgId, brandName: 'Học viện Makeup Hoa', phone: '0281234567', zalo: '0909000111', address: '1 Lê Lợi, Huế', email: `${A.secret}@noi-bo.local` },
  });

  K = await makeClass(app, A, `Lớp A ${randomUUID().slice(0, 4)}`);
  const K3 = await makeClass(app, A, `Lớp A3 ${randomUUID().slice(0, 4)}`);
  KB = await makeClass(app, B, `Lớp B ${randomUUID().slice(0, 4)}`);
  A1 = await makeStudent(deps, A, 'Tôn Nữ Phương Thảo', { email: `${A.secret}-a1@thu.local` });
  A2 = await makeStudent(deps, A, 'Lê Bạn Cùng Lớp', { email: `${A.secret}-a2@thu.local` });
  T1 = await makeStudent(deps, B, 'Trần Tổ Chức Khác');

  C1 = await enroll(app, A, A1.id, K.id);
  C2 = await enroll(app, A, A2.id, K.id);
  // Mã hợp đồng / phiếu đánh số THEO TỔ CHỨC (A và B đều bắt đầu từ 000001): đẩy số của B đi trước để chuỗi mã của B
  // khác hẳn của A — quét chuỗi mới có nghĩa.
  for (let i = 0; i < 6; i++) {
    expect((await post(app, B.owner, `${api(B)}/contracts`, { kind: 'COURSE', customerId: T1.id, lines: [{ kind: 'COURSE', courseClassId: KB.id }] })).status).toBe(201);
  }
  CB = await enroll(app, B, T1.id, KB.id);
  // Câu 4: hợp đồng có dòng khoá học bị huỷ (ghi danh huỷ), hợp đồng vẫn CONFIRMED.
  const c3 = await enroll(app, A, A1.id, K3.id, {
    lines: [
      { kind: 'COURSE', courseClassId: K3.id },
      { kind: 'CUSTOM', name: 'Giáo trình', unitPrice: 300_000, quantity: 1 },
    ],
  });
  C3 = c3;
  const courseLine = c3.lines.find((l) => l.courseClassId === K3.id);
  const voided = await request(app).post(`${api(A)}/contracts/${C3.id}/lines/${courseLine?.id}/void`).set(bearer(A.owner)).send({ reason: `${A.secret}-ly-do-huy-dong` });
  expect(voided.status, JSON.stringify(voided.body)).toBe(200);
  // Nháp + đã huỷ: không hiện.
  const d = await post(app, A.owner, `${api(A)}/contracts`, { kind: 'COURSE', customerId: A1.id, lines: [{ kind: 'COURSE', courseClassId: K3.id }] });
  expect(d.status).toBe(201);
  draft = d.body;
  const cx = await post(app, A.owner, `${api(A)}/contracts`, { kind: 'COURSE', customerId: A1.id, lines: [{ kind: 'COURSE', courseClassId: K3.id }] });
  expect(cx.status).toBe(201);
  cancelled = cx.body;
  expect((await request(app).post(`${api(A)}/contracts/${cancelled.id}/status`).set(bearer(A.owner)).send({ to: 'CANCELLED', reason: `${A.secret}-huy-hd` })).status).toBe(200);

  // Tiến độ + phiếu cho C1: cọc 1tr (đã quá hạn) + đợt 2 4tr (còn hạn); thu 1,5tr; một phiếu 300k bị huỷ.
  const inst = await request(app)
    .put(`${api(A)}/contracts/${C1.id}/installments`)
    .set(bearer(A.owner))
    .send({
      installments: [
        { name: 'Đặt cọc', dueDate: '2026-01-01T00:00:00+07:00', amount: 1_000_000, isDeposit: true },
        { name: 'Đợt 2', dueDate: '2099-01-01T00:00:00+07:00', amount: 4_000_000, isDeposit: false },
      ],
    });
  expect(inst.status, JSON.stringify(inst.body)).toBe(200);
  p1 = await receipt(app, A, C1.id, 1_500_000);
  pVoid = await receipt(app, A, C1.id, 300_000);
  expect((await request(app).post(`${api(A)}/payments/${pVoid.id}/void`).set(bearer(A.owner)).send({ reason: `${A.secret}-ly-do-huy-phieu` })).status).toBe(200);
  p2 = await receipt(app, A, C2.id, 700_000);
  for (let i = 0; i < 4; i++) await receipt(app, B, CB.id, 100_000);
  pB = await receipt(app, B, CB.id, 900_000);

  // Thẻ: A1 có WELCOME + FEEDBACK hiện; FEEDBACK bị trung tâm ẩn; GREETING; WELCOME đã xoá; tệp đã xoá. A2, T1 mỗi người một thẻ.
  const a1 = { customerId: A1.id, contractId: C1.id, courseClassId: K.id };
  await seedCard(deps, A, a1, 'WELCOME');
  await seedCard(deps, A, a1, 'FEEDBACK');
  hiddenCardId = (await seedCard(deps, A, a1, 'FEEDBACK', { portalVisible: false })).cardId;
  await seedCard(deps, A, a1, 'GREETING');
  await seedCard(deps, A, a1, 'WELCOME', { deleted: true });
  await seedCard(deps, A, a1, 'WELCOME', { fileStatus: 'DELETED' });
  await seedCard(deps, A, { customerId: A2.id, contractId: C2.id, courseClassId: K.id }, 'WELCOME');
  await seedCard(deps, B, { customerId: T1.id, contractId: CB.id, courseClassId: KB.id }, 'WELCOME');

  tokA1 = await openOk(app, await createLink(app, A, A1.id), A1.last4);
  tokA2 = await openOk(app, await createLink(app, A, A2.id), A2.last4);
  tokT1 = await openOk(app, await createLink(app, B, T1.id), T1.last4);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('1. /me trả đúng dữ liệu của chính học viên', () => {
  it('GIỮ: trung tâm, học viên, máy, múi giờ; bank null khi chưa điền, có khi đủ 3 trường', async () => {
    const m = await getMe(tokA1);
    expect(m.center).toEqual({ name: 'Học viện Makeup Hoa', logoUrl: null, phone: '0281234567', zalo: '0909000111', address: '1 Lê Lợi, Huế' });
    expect(m.student).toEqual({ fullName: 'Tôn Nữ Phương Thảo', callName: callName('Tôn Nữ Phương Thảo'), avatarUrl: null });
    expect(m.device.label).toBe('iPhone · Safari');
    expect(m.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(Object.keys(m).sort()).toEqual(['bank', 'cards', 'center', 'contracts', 'device', 'enrollments', 'serverTime', 'student', 'timezone']);
    expect(m.bank).toBeNull();
    await deps.db.portalSettings.create({
      data: { organizationId: A.orgId, bankName: 'Vietcombank', bankAccountNo: '0123456789', bankAccountName: 'HOC VIEN HOA', updatedById: A.owner.id },
    });
    expect((await getMe(tokA1)).bank).toEqual({ bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'HOC VIEN HOA' });
    // Tổ chức B chưa điền → null (không lấy nhầm của A).
    expect((await getMe(tokT1)).bank).toBeNull();
  });

  it('BẮT: lớp chưa sinh buổi → sessions []; sau sync của K2 → 8 buổi SCHEDULED; buổi huỷ → CANCELLED', async () => {
    const before = await getMe(tokA1);
    expect(before.enrollments).toHaveLength(1);
    const e = before.enrollments[0]!;
    expect(e).toMatchObject({
      className: K.name,
      classStatus: 'OPEN',
      startDate: '2027-03-01',
      endDate: '2027-03-28',
      weekdays: [1, 3],
      startTime: '18:00',
      endTime: '20:00',
      sessionCount: 8,
      instructor: { name: 'Cô DA', avatarUrl: null },
      location: { name: 'Studio da', address: '12 Hàng Bài, Hà Nội', latitude: null, longitude: null },
      contractCode: C1.code,
      sessions: [],
    });
    const sync = await post(app, A.owner, `${api(A)}/classes/${K.id}/sessions/sync`, { dryRun: false });
    expect(sync.status, JSON.stringify(sync.body)).toBe(200);
    const after = (await getMe(tokA1)).enrollments[0]!;
    expect(after.sessions).toHaveLength(8);
    expect(after.sessions.every((s) => s.status === 'SCHEDULED')).toBe(true);
    expect(after.sessions[0]).toEqual({ date: '2027-03-01', startsAt: '2027-03-01T11:00:00.000Z', endsAt: '2027-03-01T13:00:00.000Z', status: 'SCHEDULED' });
    const first = await deps.db.appointment.findFirstOrThrow({ where: { courseClassId: K.id, organizationId: A.orgId }, orderBy: { startsAt: 'asc' } });
    const st = await request(app).post(`${api(A)}/appointments/${first.id}/status`).set(bearer(A.owner)).set('idempotency-key', randomUUID()).send({ to: 'CANCELLED', reason: `${A.secret}-ly-do-huy-buoi` });
    expect(st.status, JSON.stringify(st.body)).toBe(200);
    const cancelledSession = (await getMe(tokA1)).enrollments[0]!.sessions;
    expect(cancelledSession).toHaveLength(8);
    expect(cancelledSession[0]!.status).toBe('CANCELLED');
  });

  it('BẮT: chỉ hợp đồng khoá học CONFIRMED/COMPLETED (không nháp, không huỷ); dòng đã huỷ không hiện; câu 4: hợp đồng có ghi danh đã huỷ VẪN hiện', async () => {
    const m = await getMe(tokA1);
    const codes = m.contracts.map((c) => c.code).sort();
    expect(codes).toEqual([C1.code, C3.code].sort());
    expect(codes).not.toContain(draft.code);
    expect(codes).not.toContain(cancelled.code);
    const c3 = m.contracts.find((c) => c.code === C3.code)!;
    expect(c3.lines).toEqual([{ name: 'Giáo trình', quantity: 1, unitPrice: 300_000, lineTotal: 300_000 }]);
    expect(c3.total).toBe(300_000);
    // Ghi danh lớp K3 đã huỷ → không còn trong enrollments.
    expect(m.enrollments.map((e) => e.contractCode)).toEqual([C1.code]);
  });

  it('BẮT: tiền khớp màn Thu tiền (summarizePayments / allocateToInstallments); phiếu đã huỷ không hiện; nội dung chuyển khoản', async () => {
    const c1 = (await getMe(tokA1)).contracts.find((c) => c.code === C1.code)!;
    const staff = (await request(app).get(`${api(A)}/contracts/${C1.id}/payments`).set(bearer(A.owner)).expect(200)).body;
    expect([c1.total, c1.paid, c1.remaining]).toEqual([staff.summary.total, staff.summary.paid, staff.summary.remaining]);
    expect([c1.paid, c1.remaining]).toEqual([1_500_000, 3_500_000]);
    expect(c1.installments).toEqual(
      staff.installments.map((i: { name: string; dueDate: string; amount: number; isDeposit: boolean; paidAmount: number; status: string }) => ({
        name: i.name,
        dueDate: new Date(i.dueDate).toISOString(),
        amount: i.amount,
        isDeposit: i.isDeposit,
        paidAmount: i.paidAmount,
        status: i.status,
      })),
    );
    expect(c1.installments.map((i) => [i.name, i.paidAmount, i.status])).toEqual([
      ['Đặt cọc', 1_000_000, 'PAID'],
      ['Đợt 2', 500_000, 'PARTIAL'],
    ]);
    expect(c1.receipts.map((r) => r.code)).toEqual([p1.code]);
    expect(c1.receipts[0]).toEqual({ code: p1.code, kind: 'RECEIPT', method: 'BANK_TRANSFER', amount: 1_500_000, receivedAt: expect.any(String) });
    expect(c1.transferNote).toBe(transferNote(C1.code, 'Tôn Nữ Phương Thảo'));
    expect(c1.transferNote).toMatch(/^HDKH-\d{6} Ton Nu Phuong Thao$/);
    expect(c1.lines).toEqual([{ name: expect.any(String), quantity: 1, unitPrice: 5_000_000, lineTotal: 5_000_000 }]);
    expect([c1.subtotal, c1.discount, c1.status]).toEqual([5_000_000, 0, 'CONFIRMED']);
  });

  it('GIỮ: nội quy là bản chụp lúc xác nhận (sửa mẫu sau không đổi)', async () => {
    const patched = await request(app).patch(`${api(A)}/contract-texts/${rulesId}`).set(bearer(A.owner)).send({ body: 'Nội quy bản HAI — đã sửa.' });
    expect(patched.status, JSON.stringify(patched.body)).toBe(200);
    const c1 = (await getMe(tokA1)).contracts.find((c) => c.code === C1.code)!;
    expect(c1.rules).toBe(RULES_V1);
  });

  it('BẮT: chỉ ảnh WELCOME/FEEDBACK của mình, chưa xoá, tệp READY, trung tâm không ẩn (portalVisible); bật lại → hiện', async () => {
    const m = await getMe(tokA1);
    expect(m.cards.map((c) => c.kind).sort()).toEqual(['FEEDBACK', 'WELCOME']);
    for (const c of m.cards) {
      expect(Object.keys(c).sort()).toEqual(['className', 'createdAt', 'height', 'kind', 'url', 'urlExpiresAt', 'width']);
      expect(c.className).toBe(K.name);
      expect([c.width, c.height]).toEqual([1080, 1350]);
      expect(c.url.length).toBeGreaterThan(0);
      expect(Math.abs(new Date(c.urlExpiresAt).getTime() - (Date.now() + 600_000))).toBeLessThan(60_000);
    }
    await deps.db.designCard.update({ where: { id: hiddenCardId }, data: { portalVisible: true } });
    expect((await getMe(tokA1)).cards).toHaveLength(3);
    await deps.db.designCard.update({ where: { id: hiddenCardId }, data: { portalVisible: false } });
    expect((await getMe(tokA1)).cards).toHaveLength(2);
  });
});

describe('2. Cách ly: bạn cùng lớp, tổ chức khác, trường nội bộ', () => {
  it('BẮT: /me của A1 không chứa gì của A2 (cùng lớp), của tổ chức B, email chủ, SĐT giảng viên, ghi chú nội bộ; không có UUID', async () => {
    const m = await getMe(tokA1);
    const text = JSON.stringify(m);
    const forbidden: [string, string][] = [
      ['tên A2', A2.fullName],
      ['SĐT A2', A2.phone],
      ['hợp đồng A2', C2.code],
      ['phiếu A2', p2.code],
      ['phiếu đã huỷ', pVoid.code],
      ['tên T1', T1.fullName],
      ['lớp B', KB.name],
      ['hợp đồng B', CB.code],
      ['phiếu B', pB.code],
      ['email chủ A', A.owner.email],
      ['email chủ B', B.owner.email],
      ['email giảng viên', A.instructor.email],
      ['SĐT giảng viên', A.instructorPhone],
      ['SĐT của chính A1 (không trả lại)', A1.phone],
      ['tên người lập (chủ)', 'Người thử cong-chu'],
      // Customer.note, Customer.email, Contract.notes, Payment.note, voidReason, lý do huỷ dòng / buổi / hợp đồng,
      // tiêu đề / nội dung / snapshot thẻ, tên tệp, email hồ sơ trung tâm: đều mang chuỗi bí mật của tổ chức.
      ['bí mật nội bộ A', A.secret],
      ['bí mật B', B.secret],
    ];
    for (const [what, s] of forbidden) expect(text.includes(s), what).toBe(false);
    expect(uuidsIn(m)).toEqual([]);
    // GIỮ: thấy đúng của mình.
    expect(text).toContain(C1.code);
    expect(text).toContain(A1.fullName);
    expect(text).toContain(p1.code);
  });

  it('BẮT: A2 không thấy gì của A1; T1 (tổ chức B) không thấy gì của A', async () => {
    const a2 = JSON.stringify(await getMe(tokA2));
    for (const s of [A1.fullName, C1.code, C3.code, p1.code, A.secret]) expect(a2.includes(s), s).toBe(false);
    expect(a2).toContain(C2.code);
    const t1 = await getMe(tokT1);
    const t1s = JSON.stringify(t1);
    for (const s of [A1.fullName, A2.fullName, C1.code, C2.code, K.name, 'Học viện Makeup Hoa', A.secret, B.secret, B.instructorPhone]) {
      expect(t1s.includes(s), s).toBe(false);
    }
    expect(t1.contracts.map((c) => c.code)).toEqual([CB.code]);
    expect(t1.cards).toHaveLength(1);
    expect(uuidsIn(t1)).toEqual([]);
  });
});

describe('3. Lớp chưa sinh buổi', () => {
  it('GIỮ: A2 trong lớp đã sync thấy buổi; T1 ở lớp chưa sync → sessions []', async () => {
    expect((await getMe(tokA2)).enrollments[0]!.sessions).toHaveLength(8);
    expect((await getMe(tokT1)).enrollments[0]!.sessions).toEqual([]);
  });
});
