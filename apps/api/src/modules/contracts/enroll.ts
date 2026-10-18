// GIỮ CHỖ / TRẢ CHỖ của hợp đồng khoá học (BAN-VE-C3-DAO-TAO mục 1.2).
// - Hợp đồng nháp KHÔNG giữ chỗ. Chỗ chỉ bị trừ khi hợp đồng xác nhận (hoặc thêm dòng khoá học vào hợp đồng đã xác nhận).
// - Giữ chỗ = MỘT câu UPDATE có điều kiện (status = 'OPEN' AND enrolled_count < capacity). Câu này khoá dòng lớp: hai
//   xác nhận cùng lúc vào chỗ cuối thì người sau chờ người trước xong, đánh giá lại điều kiện trên dữ liệu mới và nhận
//   0 dòng → 409. CHECK enrolled_count <= capacity của database là lưới cuối cho mọi đường khác.
// - Mọi hàm ở đây chạy TRONG transaction của nơi gọi (đã khoá dòng hợp đồng), nên giữ chỗ / ghi danh / đổi trạng thái
//   hợp đồng cùng thành công hoặc cùng quay lui.
import { Prisma } from '@prisma/client';
import { seatState, seatsLeft, type SeatState } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { assertQuota } from '../../lib/quota';

type Tx = Prisma.TransactionClient;

interface ClassSeatSource {
  id: string;
  name: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  capacity: number;
  enrolledCount: number;
}

export interface ClassSeats {
  classId: string;
  name: string;
  status: ClassSeatSource['status'];
  capacity: number;
  enrolledCount: number;
  seatsLeft: number;
  seatState: SeatState;
}

function seatsOf(c: ClassSeatSource): ClassSeats {
  return {
    classId: c.id,
    name: c.name,
    status: c.status,
    capacity: c.capacity,
    enrolledCount: c.enrolledCount,
    seatsLeft: seatsLeft(c.enrolledCount, c.capacity),
    seatState: seatState(c.enrolledCount, c.capacity),
  };
}

// Lớp không nhận thêm học viên: lời báo + chi tiết cho web (tự tải lại danh sách lớp). null = còn nhận.
export function seatConflict(c: ClassSeatSource): { message: string; details: Record<string, unknown> } | null {
  const details = { ...seatsOf(c) };
  if (c.status === 'CANCELLED') return { message: `Lớp ${c.name} đã huỷ — chọn lớp khác`, details: { ...details, reason: 'CLASS_CANCELLED' } };
  if (c.status === 'CLOSED') {
    return { message: `Lớp ${c.name} đã ngừng nhận ghi danh — chọn lớp khác`, details: { ...details, reason: 'CLASS_CLOSED' } };
  }
  if (c.enrolledCount >= c.capacity) {
    return { message: `Lớp ${c.name} đã đủ ${c.enrolledCount}/${c.capacity} học viên`, details: { ...details, reason: 'CLASS_FULL' } };
  }
  return null;
}

const classSeatSelect = { id: true, name: true, status: true, capacity: true, enrolledCount: true } satisfies Prisma.CourseClassSelect;

// Tình trạng chỗ của các lớp (xem trước hợp đồng trả kèm để web báo lớp vừa đầy). Dùng seatState() của @makeup/shared.
export async function classSeats(db: Tx, orgId: string, classIds: string[]): Promise<ClassSeats[]> {
  const ids = [...new Set(classIds)];
  if (ids.length === 0) return [];
  const rows = await db.courseClass.findMany({ where: { id: { in: ids }, organizationId: orgId }, select: classSeatSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [seatsOf(r)] : [];
  });
}

function duplicateEnrollment(className: string, contractCode: string | null): AppError {
  return new AppError(
    'CONFLICT',
    `Học viên này đã ghi danh lớp ${className}${contractCode ? ` (hợp đồng ${contractCode})` : ''}`,
    { reason: 'ALREADY_ENROLLED' },
  );
}

// Giữ chỗ + ghi danh cho các dòng COURSE còn hiệu lực của hợp đồng (hoặc chỉ các dòng onlyLineIds).
// Lớp xử lý theo thứ tự id để hai hợp đồng cùng có hai lớp X, Y không khoá chéo nhau (deadlock).
export async function enrollContractLines(
  tx: Tx,
  orgId: string,
  contract: { id: string; customerId: string },
  onlyLineIds?: string[],
): Promise<string[]> {
  const lines = await tx.contractLine.findMany({
    where: {
      contractId: contract.id,
      organizationId: orgId,
      kind: 'COURSE',
      voidedAt: null,
      ...(onlyLineIds ? { id: { in: onlyLineIds } } : {}),
    },
    select: { id: true, courseClassId: true },
    orderBy: [{ courseClassId: 'asc' }, { id: 'asc' }],
  });
  if (lines.length === 0) return [];
  // Học viên mới = chưa có ghi danh còn hiệu lực nào trong tổ chức (đọc TRƯỚC khi ghi danh của hợp đồng này).
  const wasStudent = (await tx.enrollment.count({ where: { organizationId: orgId, customerId: contract.customerId, status: 'ACTIVE' } })) > 0;
  const enrolledAt = new Date();
  const created: string[] = [];
  for (const l of lines) {
    const classId = l.courseClassId;
    if (!classId) throw new Error(`Dòng khoá học ${l.id} không có lớp — CHECK contract_lines_course_class đã bị lách`);
    // (1) GIỮ CHỖ: điều kiện nằm trong chính câu UPDATE — không đọc-rồi-ghi.
    const held = await tx.$queryRaw<{ id: string; name: string }[]>`
      UPDATE course_classes SET enrolled_count = enrolled_count + 1, updated_at = now()
      WHERE id = ${classId}::uuid AND organization_id = ${orgId}::uuid AND status = 'OPEN' AND enrolled_count < capacity
      RETURNING id, name`;
    const cls = held[0];
    if (!cls) {
      const now = await tx.courseClass.findFirstOrThrow({ where: { id: classId, organizationId: orgId }, select: classSeatSelect });
      const conflict = seatConflict(now) ?? { message: `Lớp ${now.name} không nhận thêm học viên`, details: seatsOf(now) };
      throw new AppError('CONFLICT', conflict.message, { lineId: l.id, ...conflict.details });
    }
    // (2) GHI DANH. Trùng (cùng học viên, cùng lớp, còn hiệu lực) → 409 có lời; index một phần enrollments_one_active
    //     là lưới cuối khi hai hợp đồng của cùng học viên xác nhận cùng lúc.
    const dup = await tx.enrollment.findFirst({
      where: { organizationId: orgId, courseClassId: classId, customerId: contract.customerId, status: 'ACTIVE' },
      select: { contract: { select: { code: true } } },
    });
    if (dup) throw duplicateEnrollment(cls.name, dup.contract.code);
    try {
      const e = await tx.enrollment.create({
        data: {
          organizationId: orgId,
          courseClassId: classId,
          contractId: contract.id,
          contractLineId: l.id,
          customerId: contract.customerId,
          enrolledAt,
        },
        select: { id: true },
      });
      created.push(e.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw duplicateEnrollment(cls.name, null);
      throw err;
    }
  }
  // (3) GIỚI HẠN GÓI "học viên" (số khách khác nhau đang có ghi danh): chỉ xét khi đây là học viên MỚI. Gọi SAU khi ghi
  //     danh với adding = 0: số đang dùng đã gồm học viên này, nên vượt khi used > limit. assertQuota khoá tư vấn theo
  //     (tổ chức, loại) rồi mới đếm, nên hai học viên mới xác nhận cùng lúc xếp hàng, người sau thấy người trước.
  if (!wasStudent) await assertQuota(tx, orgId, 'students', 0);
  return created;
}

// Trả chỗ: huỷ ghi danh còn hiệu lực của hợp đồng (hoặc của các dòng lineIds) và trừ số đã ghi danh của lớp.
export async function releaseEnrollments(
  tx: Tx,
  orgId: string,
  target: { contractId: string; lineIds?: string[] },
  reason: string,
): Promise<{ id: string; courseClassId: string }[]> {
  const active = await tx.enrollment.findMany({
    where: {
      organizationId: orgId,
      contractId: target.contractId,
      status: 'ACTIVE',
      ...(target.lineIds ? { contractLineId: { in: target.lineIds } } : {}),
    },
    select: { id: true, courseClassId: true },
    orderBy: [{ courseClassId: 'asc' }, { id: 'asc' }],
  });
  const cancelledAt = new Date();
  for (const e of active) {
    await tx.enrollment.update({ where: { id: e.id }, data: { status: 'CANCELLED', cancelledAt, cancelReason: reason } });
    const freed = await tx.$queryRaw<{ id: string }[]>`
      UPDATE course_classes SET enrolled_count = enrolled_count - 1, updated_at = now()
      WHERE id = ${e.courseClassId}::uuid AND organization_id = ${orgId}::uuid AND enrolled_count > 0
      RETURNING id`;
    if (freed.length === 0) throw new Error(`Lớp ${e.courseClassId} có ghi danh còn hiệu lực nhưng số đã ghi danh = 0 — dữ liệu lệch`);
  }
  return active;
}
