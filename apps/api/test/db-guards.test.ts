// Chốt chặn ở database: chạy cả khi máy chủ có lỗi hoặc ai đó ghi thẳng vào database.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { isBlockingStatus, WORK_STATUSES } from '@makeup/shared';
import { databaseError, pgErrorCode } from '../src/http/middleware';
import { createOrg, makeApp, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
let owner: TestUser;
let orgId: string;
let memberId: string;

beforeAll(async () => {
  const app = makeApp(deps);
  owner = await registerUser(app, 'db-gac');
  orgId = await createOrg(app, owner, 'db-gac');
  memberId = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } })).id;
});
afterAll(async () => {
  await deps.db.$disconnect();
});

function appt(status: (typeof WORK_STATUSES)[number], startH: number, endH: number) {
  return deps.db.appointment.create({
    data: {
      organizationId: orgId,
      code: `DB-${randomUUID().slice(0, 8)}`,
      startsAt: new Date(Date.UTC(2027, 0, 1, startH)),
      endsAt: new Date(Date.UTC(2027, 0, 1, endH)),
      status,
      createdById: owner.id,
    },
  });
}

// Máy chủ gửi khoảng bận SAI có chủ đích: database phải tự tính lại, không tin số gửi lên.
const bogusBlock = { blockStart: new Date('2000-01-01'), blockEnd: new Date('2000-01-02'), isBlocking: false };

describe('khoảng bận do database tự tính', () => {
  it('luật "trạng thái nào chiếm giờ" của database khớp hàm isBlockingStatus — từng trạng thái', async () => {
    let same = 0;
    for (const status of WORK_STATUSES) {
      const a = await appt(status, 20, 21);
      const row = await deps.db.appointmentStaff.create({
        data: { organizationId: orgId, appointmentId: a.id, membershipId: memberId, ...bogusBlock, isBlocking: !isBlockingStatus(status) },
      }).catch(() => null);
      // Trạng thái chiếm giờ ở cùng giờ với lịch trước có thể đụng trùng — dọn để mỗi vòng độc lập.
      if (row) {
        if (row.isBlocking === isBlockingStatus(status)) same++;
        await deps.db.$executeRaw`DELETE FROM appointment_staff WHERE appointment_id = ${a.id}::uuid`;
      }
    }
    console.log(`[database] trạng thái khớp luật chiếm giờ: ${same}/${WORK_STATUSES.length}`);
    expect(same).toBe(WORK_STATUSES.length);
  });

  it('số khoảng bận gửi lên bị bỏ qua; đổi giờ lịch thì khoảng bận tự đổi theo', async () => {
    const a = await appt('CONFIRMED', 1, 2);
    const s = await deps.db.appointmentStaff.create({
      data: { organizationId: orgId, appointmentId: a.id, membershipId: memberId, ...bogusBlock },
    });
    expect(s.blockStart.toISOString()).toBe(a.startsAt.toISOString());
    expect(s.isBlocking).toBe(true);
    await deps.db.appointment.update({ where: { id: a.id }, data: { endsAt: new Date(Date.UTC(2027, 0, 1, 3)), travelAfterMin: 30 } });
    const after = await deps.db.appointmentStaff.findFirstOrThrow({ where: { appointmentId: a.id } });
    expect(after.blockEnd.toISOString()).toBe(new Date(Date.UTC(2027, 0, 1, 3, 30)).toISOString());
  });

  it('BẮT: dời giờ lịch chồng lên lịch khác của cùng thợ (ghi thẳng database) → bị từ chối, trả 409', async () => {
    const a = await appt('CONFIRMED', 5, 6);
    const b = await appt('CONFIRMED', 7, 8);
    for (const x of [a, b]) {
      await deps.db.appointmentStaff.create({ data: { organizationId: orgId, appointmentId: x.id, membershipId: memberId, ...bogusBlock } });
    }
    const err = await deps.db.appointment
      .update({ where: { id: b.id }, data: { startsAt: new Date(Date.UTC(2027, 0, 1, 5, 30)) } })
      .catch((e: unknown) => e);
    expect(pgErrorCode(err)).toBe('23P01');
    expect(databaseError(err)?.status).toBe(409);
  });

  it('huỷ lịch nhả giờ ngay (không cần máy chủ cập nhật khoảng bận)', async () => {
    const a = await appt('CONFIRMED', 10, 11);
    await deps.db.appointmentStaff.create({ data: { organizationId: orgId, appointmentId: a.id, membershipId: memberId, ...bogusBlock } });
    await deps.db.appointment.update({ where: { id: a.id }, data: { status: 'CANCELLED', cancelReason: 'thử' } });
    const s = await deps.db.appointmentStaff.findFirstOrThrow({ where: { appointmentId: a.id } });
    expect(s.isBlocking).toBe(false);
  });
});

describe('lịch sử và hợp đồng', () => {
  it('lịch sử trạng thái không sửa, không xoá được; lịch có lịch sử không xoá được', async () => {
    const a = await appt('DRAFT', 12, 13);
    const h = await deps.db.appointmentStatusHistory.create({
      data: { organizationId: orgId, appointmentId: a.id, toStatus: 'DRAFT', changedById: owner.id },
    });
    const e1 = await deps.db.appointmentStatusHistory.update({ where: { id: h.id }, data: { reason: 'sửa' } }).catch((e: unknown) => e);
    expect(databaseError(e1)?.message).toMatch(/chỉ được ghi thêm/);
    const e2 = await deps.db.appointment.delete({ where: { id: a.id } }).catch((e: unknown) => e);
    expect(e2).toBeInstanceOf(Error);
  });

  it('dòng hợp đồng đã xác nhận: sửa giá / xoá bị chặn (409), huỷ có lý do thì được; hợp đồng nháp thì sửa tự do', async () => {
    const customer = await deps.db.customer.create({ data: { organizationId: orgId, fullName: 'Khách thử' } });
    const c = await deps.db.contract.create({
      data: { organizationId: orgId, code: `HD-T-${randomUUID().slice(0, 6)}`, customerId: customer.id, createdById: owner.id },
    });
    // Thêm dòng và cập nhật tổng trong CÙNG transaction (database kiểm tổng khớp dòng lúc lưu).
    const line = await deps.db.$transaction(async (tx) => {
      const l = await tx.contractLine.create({
        data: { organizationId: orgId, contractId: c.id, kind: 'CUSTOM', name: 'Phụ phí', unitPrice: 100000n, lineTotal: 100000n, createdById: owner.id },
      });
      await tx.contract.update({ where: { id: c.id }, data: { subtotal: 100000n, total: 100000n } });
      return l;
    });
    await deps.db.contractLine.update({ where: { id: line.id }, data: { note: 'nháp sửa được' } });
    await deps.db.contract.update({ where: { id: c.id }, data: { status: 'CONFIRMED' } });
    const e1 = await deps.db.contractLine.update({ where: { id: line.id }, data: { unitPrice: 1n, lineTotal: 1n } }).catch((e: unknown) => e);
    expect(databaseError(e1)?.status).toBe(409);
    expect(databaseError(e1)?.message).toMatch(/không được sửa/);
    const e2 = await deps.db.contractLine.delete({ where: { id: line.id } }).catch((e: unknown) => e);
    expect(databaseError(e2)?.message).toMatch(/không được xoá/);
    const voided = await deps.db.$transaction(async (tx) => {
      const v = await tx.contractLine.update({ where: { id: line.id }, data: { voidedAt: new Date(), voidReason: 'khách bỏ' } });
      await tx.contract.update({ where: { id: c.id }, data: { subtotal: 0n, total: 0n } });
      return v;
    });
    expect(voided.voidedAt).not.toBeNull();
    const e3 = await deps.db.contractLine.update({ where: { id: line.id }, data: { voidReason: 'đổi lý do' } }).catch((e: unknown) => e);
    expect(databaseError(e3)?.status).toBe(409);
  });

  it('N3 — hợp đồng đã xác nhận: không về nháp, không tăng giảm giá, tổng tiền phải khớp các dòng', async () => {
    const customer = await deps.db.customer.create({ data: { organizationId: orgId, fullName: 'Khách N3' } });
    const c = await deps.db.$transaction(async (tx) => {
      const k = await tx.contract.create({
        data: { organizationId: orgId, code: `HD-N3-${randomUUID().slice(0, 6)}`, customerId: customer.id, createdById: owner.id, subtotal: 200000n, total: 200000n },
      });
      await tx.contractLine.create({
        data: { organizationId: orgId, contractId: k.id, kind: 'CUSTOM', name: 'Dòng', unitPrice: 200000n, lineTotal: 200000n, createdById: owner.id },
      });
      return k;
    });
    await deps.db.contract.update({ where: { id: c.id }, data: { status: 'CONFIRMED' } });
    const back = await deps.db.contract.update({ where: { id: c.id }, data: { status: 'DRAFT' } }).catch((e: unknown) => e);
    expect(databaseError(back)?.message).toMatch(/không được đưa về nháp/);
    const disc = await deps.db.contract.update({ where: { id: c.id }, data: { discount: 50000n, total: 150000n } }).catch((e: unknown) => e);
    expect(databaseError(disc)?.message).toMatch(/chỉ được hạ/);
    // Sửa tổng mà không có dòng tương ứng → bị từ chối lúc lưu.
    const total = await deps.db.contract.update({ where: { id: c.id }, data: { subtotal: 1n, total: 1n } }).catch((e: unknown) => e);
    expect(databaseError(total)?.message).toMatch(/không khớp tổng các dòng/);
    // Thêm dòng mà quên cập nhật tổng → bị từ chối lúc lưu.
    const extra = await deps.db.contractLine.create({
      data: { organizationId: orgId, contractId: c.id, kind: 'CUSTOM', name: 'Lén thêm', unitPrice: 9n, lineTotal: 9n, createdById: owner.id },
    }).catch((e: unknown) => e);
    expect(databaseError(extra)?.message).toMatch(/không khớp tổng các dòng/);
    const after = await deps.db.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect([after.status, after.subtotal]).toEqual(['CONFIRMED', 200000n]);
  });

  it('vi phạm CHECK trả 400 chứ không 500', async () => {
    const err = await deps.db.contractLine.create({
      data: { organizationId: orgId, contractId: randomUUID(), kind: 'CUSTOM', name: 'x', unitPrice: 5n, lineTotal: 999n, createdById: owner.id },
    }).catch((e: unknown) => e);
    // Thiếu hợp đồng (23503) hoặc sai công thức (23514) — cả hai đều là 400 có nghĩa.
    expect(databaseError(err)?.status).toBe(400);
  });
});
