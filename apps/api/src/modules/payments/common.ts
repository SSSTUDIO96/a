import type { Prisma } from '@prisma/client';
import { allocateToInstallments, PaymentMathError, summarizePayments, vndFromBigInt, type Permission, type Vnd } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { dateToWire } from '../courses/present';

export type Tx = Prisma.TransactionClient;

export const TAG = 'Thu tiền';

// Lỗi tính tiền từ hàm thuần → 400 kèm chi tiết; lỗi khác giữ nguyên.
export function paymentMath<T>(work: () => T): T {
  try {
    return work();
  } catch (err) {
    if (err instanceof PaymentMathError) throw new AppError('VALIDATION_FAILED', err.message, err.details);
    throw err;
  }
}

export function vnd(v: bigint, field: string): Vnd {
  return vndFromBigInt(v, field);
}

// TỔNG GỘP nhiều phiếu (sổ thu, báo cáo): vượt ngưỡng số nguyên an toàn thì trả null thay vì ném lỗi 500 — danh sách
// phiếu vẫn trả về để người dùng tìm ra phiếu gõ nhầm (biên bản máy chủ lát 2, M3: sổ thu là công cụ đối soát mà chính nó sập).
// Nơi gọi đặt cờ totalsOverflow để giao diện báo "tổng quá lớn, kiểm lại phiếu".
export function vndOrNull(v: bigint): Vnd | null {
  return v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER) ? null : Number(v);
}

// Khoá dòng hợp đồng: phiếu thu, huỷ phiếu, đổi tiến độ của cùng hợp đồng xếp hàng — kiểm "vượt tổng"/"hoàn vượt thu"
// luôn dựa trên số liệu mới nhất. Hợp đồng của tổ chức khác trả đúng lỗi như mã bịa.
export async function lockContract(tx: Tx, orgId: string, contractId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM contracts WHERE id = ${contractId}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
  return tx.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { id: true, code: true, status: true, total: true, depositRequired: true, createdAt: true },
  });
}

export const paymentSelect = {
  id: true,
  code: true,
  contractId: true,
  kind: true,
  method: true,
  amount: true,
  receivedAt: true,
  note: true,
  voidedAt: true,
  voidReason: true,
  createdAt: true,
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

export function presentPayment(p: PaymentRow) {
  return { ...p, amount: vnd(p.amount, 'số tiền phiếu') };
}

// Tóm tắt tiền của một hợp đồng từ các phiếu đang có (đọc trong transaction đã khoá hợp đồng khi cần chắc chắn).
export async function contractSummary(db: Tx, orgId: string, c: { id: string; total: bigint; depositRequired: bigint }) {
  const rows = await db.payment.findMany({
    where: { contractId: c.id, organizationId: orgId },
    select: { kind: true, amount: true, voidedAt: true },
  });
  return paymentMath(() =>
    summarizePayments(
      vnd(c.total, 'tổng hợp đồng'),
      vnd(c.depositRequired, 'tiền cọc'),
      rows.map((r) => ({ kind: r.kind, amount: vnd(r.amount, 'số tiền phiếu'), voided: r.voidedAt !== null })),
    ),
  );
}

// Toàn bộ tình hình thu tiền của một hợp đồng: tiến độ + trạng thái từng đợt, phiếu (mới nhất trước), tóm tắt.
// Số điện thoại khách chỉ trả cho người có quyền xem khách (customers.read) — quyền thu tiền không kéo theo quyền xem
// thông tin liên lạc của khách (biên bản máy chủ lát 2, N5). Không có quyền: phone = null, phoneHidden = true.
export async function loadProgress(db: Tx, orgId: string, contractId: string, now: Date, viewer: { permissions: ReadonlySet<Permission> }) {
  const contract = await db.contract.findFirst({
    where: { id: contractId, organizationId: orgId },
    select: {
      id: true,
      code: true,
      status: true,
      total: true,
      depositRequired: true,
      eventDate: true,
      confirmedAt: true,
      customer: { select: { id: true, fullName: true, phone: true } },
    },
  });
  if (!contract) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
  const [installments, payments, courseEnd] = await Promise.all([
    db.paymentInstallment.findMany({
      where: { contractId, organizationId: orgId },
      select: { id: true, name: true, dueDate: true, amount: true, isDeposit: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
    }),
    db.payment.findMany({
      where: { contractId, organizationId: orgId },
      select: paymentSelect,
      orderBy: [{ receivedAt: 'desc' }, { code: 'desc' }],
    }),
    // Mốc gợi ý tiến độ của hợp đồng khoá học (T1): ngày kết thúc lớp MUỘN NHẤT trong các dòng khoá học chưa huỷ, bỏ lớp
    // đã huỷ. Trả ngay ở đây để người chỉ có quyền thu tiền (không contracts.read / courses.read) vẫn có mốc. Lọc tổ chức
    // ở CẢ lớp lẫn dòng hợp đồng (quan hệ lớp ↔ dòng cũng là khoá ngoại kép theo tổ chức). Chỉ dòng COURSE mới có lớp
    // (CHECK của database: kind = COURSE ⇔ có course_class_id) nên không cần lọc thêm theo loại dòng.
    db.courseClass.aggregate({
      _max: { endDate: true },
      where: {
        organizationId: orgId,
        status: { not: 'CANCELLED' },
        contractLines: { some: { contractId, organizationId: orgId, voidedAt: null } },
      },
    }),
  ]);
  const summary = paymentMath(() =>
    summarizePayments(
      vnd(contract.total, 'tổng hợp đồng'),
      vnd(contract.depositRequired, 'tiền cọc'),
      payments.map((p) => ({ kind: p.kind, amount: vnd(p.amount, 'số tiền phiếu'), voided: p.voidedAt !== null })),
    ),
  );
  const allocated = paymentMath(() =>
    allocateToInstallments(
      installments.map((i) => ({ ...i, amount: vnd(i.amount, 'số tiền đợt') })),
      summary.paid,
      now,
    ),
  );
  const installmentsTotal = allocated.reduce((s, i) => s + i.amount, 0);
  return {
    contract: {
      id: contract.id,
      code: contract.code,
      status: contract.status,
      eventDate: contract.eventDate,
      confirmedAt: contract.confirmedAt,
      // "YYYY-MM-DD" (ngày lớp, không giờ); null = không có dòng khoá học nào còn hiệu lực ở lớp chưa huỷ.
      courseEndDate: courseEnd._max.endDate ? dateToWire(courseEnd._max.endDate) : null,
      customer: viewer.permissions.has('customers.read')
        ? { ...contract.customer, phoneHidden: false }
        : { id: contract.customer.id, fullName: contract.customer.fullName, phone: null, phoneHidden: true },
    },
    summary,
    installments: allocated,
    installmentsTotal,
    // null = chưa lập tiến độ. Khác 0 khi tổng hợp đồng đổi sau khi lập tiến độ (thêm/huỷ dòng) — giao diện nhắc lập lại tiến độ.
    scheduleDifference: allocated.length === 0 ? null : summary.total - installmentsTotal,
    payments: payments.map(presentPayment),
  };
}
