// GET /portal/me (bản vẽ E 4.2, gói E3): toàn bộ dữ liệu MỘT trang của học viên.
// Luật cứng (bản vẽ E 2.2):
// - Học viên lấy TỪ PHIÊN (PortalContext). MỌI câu truy vấn có organizationId = phiên, và customerId = phiên ở bảng mang cột
//   đó; lớp / buổi học chỉ đi qua lớp của CHÍNH ghi danh của mình; đợt / phiếu chỉ đi qua hợp đồng của mình.
// - Phản hồi chỉ chứa trường liệt kê ở kiểu PortalMe (packages/shared/src/portal.ts) — từng trường chọn tay, KHÔNG trải
//   `...row`, KHÔNG có UUID nào (khoá hiển thị: mã hợp đồng, ngày, thứ tự). Không bao giờ có: ghi chú nội bộ
//   (Customer.note, Contract.notes, Payment.note, ContractLine.note), lý do huỷ, giá vốn / tiền công thợ, SĐT / email của
//   học viên hay nhân viên, người lập, snapshot / body của thẻ, storageKey.
// - Thẻ thiết kế: chỉ WELCOME / FEEDBACK của chính mình, chưa xoá, trung tâm KHÔNG ẩn (portalVisible, ký duyệt E câu 2),
//   tệp xuất READY chưa xoá. Ảnh đi qua URL ký 10 phút (signedUrlOf), không bật isPublic.
// - Hợp đồng: khoá học CONFIRMED / COMPLETED, KHÔNG phụ thuộc ghi danh còn hiệu lực (ký duyệt E câu 4: học viên đã huỷ ghi
//   danh vẫn xem hợp đồng cũ khi còn phiên).
import {
  allocateToInstallments,
  callName,
  summarizePayments,
  transferNote,
  vndFromBigInt,
  type PortalMe,
  type PortalSessionStatus,
} from '@makeup/shared';
import type { WorkStatus } from '@prisma/client';
import type { Deps, PortalContext } from '../../http/route';
import { dateToWire, timeToWire } from '../courses/present';
import { resolveAvatarUrls, signedUrlOf } from '../files/service';
import { paymentMath } from '../payments/common';

type Db = Deps['db'];

// Buổi học hiện cho học viên: bỏ nháp / chờ xác nhận; gộp trạng thái về 3 loại (bản vẽ E 4.2).
const SESSION_STATUS: Partial<Record<WorkStatus, PortalSessionStatus>> = {
  CONFIRMED: 'SCHEDULED',
  IN_PROGRESS: 'SCHEDULED',
  COMPLETED: 'DONE',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'CANCELLED',
};
const SHOWN_SESSION_STATUSES = Object.keys(SESSION_STATUS) as WorkStatus[];

const vnd = (v: bigint, field: string) => paymentMath(() => vndFromBigInt(v, field));
const decimalOrNull = (d: { toNumber(): number } | null): number | null => (d === null ? null : d.toNumber());

// URL ký của MỘT tệp thuộc tổ chức, còn dùng được (READY, chưa xoá); không có → null.
async function fileUrl(db: Db, orgId: string, fileId: string | null): Promise<string | null> {
  if (fileId === null) return null;
  const f = await db.storedFile.findFirst({
    where: { id: fileId, organizationId: orgId, status: 'READY', deletedAt: null },
    select: { storageKey: true },
  });
  return f ? (await signedUrlOf(f)).signedUrl : null;
}

export async function loadPortalMe(db: Db, p: PortalContext): Promise<PortalMe> {
  const orgId = p.organizationId;
  const customerId = p.customerId;
  const now = new Date();

  const [org, settings, customer, device, enrollments, contracts, cards] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        name: true,
        timezone: true,
        profile: { select: { brandName: true, logoFileId: true, phone: true, zalo: true, address: true } },
      },
    }),
    db.portalSettings.findUnique({
      where: { organizationId: orgId },
      select: { bankName: true, bankAccountNo: true, bankAccountName: true },
    }),
    db.customer.findFirstOrThrow({
      where: { id: customerId, organizationId: orgId },
      select: { fullName: true, avatarFileId: true },
    }),
    db.portalDevice.findFirstOrThrow({
      where: { id: p.deviceId, organizationId: orgId, customerId },
      select: { label: true, createdAt: true },
    }),
    db.enrollment.findMany({
      where: { organizationId: orgId, customerId, status: 'ACTIVE' },
      select: {
        courseClassId: true,
        contract: { select: { code: true } },
        courseClass: {
          select: {
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            weekdays: true,
            startMinute: true,
            endMinute: true,
            course: { select: { name: true, sessionCount: true } },
            instructor: {
              select: {
                user: { select: { fullName: true } },
                staffProfile: { select: { displayName: true, avatarFileId: true, avatarUrl: true } },
              },
            },
            studioLocation: { select: { name: true, address: true, latitude: true, longitude: true } },
          },
        },
      },
    }),
    db.contract.findMany({
      where: { organizationId: orgId, customerId, kind: 'COURSE', status: { in: ['CONFIRMED', 'COMPLETED'] } },
      select: {
        code: true,
        status: true,
        confirmedAt: true,
        subtotal: true,
        discount: true,
        total: true,
        depositRequired: true,
        terms: true,
        rules: true,
        lines: {
          where: { organizationId: orgId, voidedAt: null },
          select: { name: true, quantity: true, unitPrice: true, lineTotal: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        installments: {
          where: { organizationId: orgId },
          select: { id: true, name: true, dueDate: true, amount: true, isDeposit: true, sortOrder: true },
          orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
        },
        payments: {
          where: { organizationId: orgId },
          select: { code: true, kind: true, method: true, amount: true, receivedAt: true, voidedAt: true },
          orderBy: [{ receivedAt: 'asc' }, { code: 'asc' }],
        },
      },
      orderBy: [{ confirmedAt: 'desc' }, { code: 'desc' }],
    }),
    db.designCard.findMany({
      where: {
        organizationId: orgId,
        customerId,
        kind: { in: ['WELCOME', 'FEEDBACK'] },
        deletedAt: null,
        portalVisible: true,
        outputFile: { is: { organizationId: orgId, status: 'READY', deletedAt: null } },
      },
      select: {
        kind: true,
        createdAt: true,
        courseClass: { select: { name: true } },
        outputFile: { select: { storageKey: true, width: true, height: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    }),
  ]);

  // Buổi học: chỉ lớp của ghi danh còn hiệu lực của MÌNH, lọc thêm tổ chức.
  const classIds = [...new Set(enrollments.map((e) => e.courseClassId))];
  const sessions = classIds.length
    ? await db.appointment.findMany({
        where: {
          organizationId: orgId,
          kind: 'COURSE_SESSION',
          courseClassId: { in: classIds },
          status: { in: SHOWN_SESSION_STATUSES },
        },
        select: { courseClassId: true, sessionDate: true, startsAt: true, endsAt: true, status: true },
        orderBy: [{ startsAt: 'asc' }],
      })
    : [];
  const sessionsByClass = new Map<string, PortalMe['enrollments'][number]['sessions']>();
  for (const s of sessions) {
    if (s.courseClassId === null) continue;
    const status = SESSION_STATUS[s.status];
    if (status === undefined) continue;
    const list = sessionsByClass.get(s.courseClassId) ?? [];
    list.push({
      date: s.sessionDate ? dateToWire(s.sessionDate) : dateToWire(s.startsAt),
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      status,
    });
    sessionsByClass.set(s.courseClassId, list);
  }

  const instructorAvatar = await resolveAvatarUrls(
    db,
    orgId,
    enrollments.map((e) => e.courseClass.instructor?.staffProfile),
  );

  const presentEnrollments: PortalMe['enrollments'] = enrollments
    .map((e) => {
      const k = e.courseClass;
      return {
        sortKey: k.startDate.getTime(),
        value: {
          courseName: k.course.name,
          className: k.name,
          classStatus: k.status,
          startDate: dateToWire(k.startDate),
          endDate: dateToWire(k.endDate),
          weekdays: [...k.weekdays],
          startTime: timeToWire(k.startMinute),
          endTime: timeToWire(k.endMinute),
          sessionCount: k.course.sessionCount,
          instructor: k.instructor
            ? {
                name: k.instructor.staffProfile?.displayName ?? k.instructor.user.fullName,
                avatarUrl: instructorAvatar(k.instructor.staffProfile),
              }
            : null,
          location: k.studioLocation
            ? {
                name: k.studioLocation.name,
                address: k.studioLocation.address,
                latitude: decimalOrNull(k.studioLocation.latitude),
                longitude: decimalOrNull(k.studioLocation.longitude),
              }
            : null,
          contractCode: e.contract.code,
          sessions: sessionsByClass.get(e.courseClassId) ?? [],
        },
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey || a.value.className.localeCompare(b.value.className))
    .map((x) => x.value);

  const presentContracts: PortalMe['contracts'] = contracts.map((c) => {
    const summary = paymentMath(() =>
      summarizePayments(
        vnd(c.total, 'tổng hợp đồng'),
        vnd(c.depositRequired, 'tiền cọc'),
        c.payments.map((x) => ({ kind: x.kind, amount: vnd(x.amount, 'số tiền phiếu'), voided: x.voidedAt !== null })),
      ),
    );
    const allocated = paymentMath(() =>
      allocateToInstallments(
        c.installments.map((i) => ({ ...i, amount: vnd(i.amount, 'số tiền đợt') })),
        summary.paid,
        now,
      ),
    );
    return {
      code: c.code,
      status: c.status as 'CONFIRMED' | 'COMPLETED',
      confirmedAt: c.confirmedAt ? c.confirmedAt.toISOString() : null,
      lines: c.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPrice: vnd(l.unitPrice, 'đơn giá'),
        lineTotal: vnd(l.lineTotal, 'thành tiền'),
      })),
      subtotal: vnd(c.subtotal, 'tạm tính'),
      discount: vnd(c.discount, 'giảm giá'),
      total: summary.total,
      paid: summary.paid,
      remaining: summary.remaining,
      installments: allocated.map((i) => ({
        name: i.name,
        dueDate: i.dueDate.toISOString(),
        amount: i.amount,
        isDeposit: i.isDeposit,
        paidAmount: i.paidAmount,
        status: i.status,
      })),
      receipts: c.payments
        .filter((x) => x.voidedAt === null)
        .map((x) => ({
          code: x.code,
          kind: x.kind,
          method: x.method,
          amount: vnd(x.amount, 'số tiền phiếu'),
          receivedAt: x.receivedAt.toISOString(),
        })),
      terms: c.terms,
      rules: c.rules,
      transferNote: transferNote(c.code, customer.fullName),
    };
  });

  const presentCards: PortalMe['cards'] = [];
  for (const card of cards) {
    if (card.outputFile === null || (card.kind !== 'WELCOME' && card.kind !== 'FEEDBACK')) continue;
    const signed = await signedUrlOf(card.outputFile);
    presentCards.push({
      kind: card.kind,
      createdAt: card.createdAt.toISOString(),
      className: card.courseClass?.name ?? null,
      url: signed.signedUrl,
      urlExpiresAt: signed.signedUrlExpiresAt,
      width: card.outputFile.width,
      height: card.outputFile.height,
    });
  }

  const bank =
    settings && settings.bankName !== null && settings.bankAccountNo !== null && settings.bankAccountName !== null
      ? { bankName: settings.bankName, accountNo: settings.bankAccountNo, accountName: settings.bankAccountName }
      : null;

  return {
    center: {
      name: org.profile?.brandName ?? org.name,
      logoUrl: await fileUrl(db, orgId, org.profile?.logoFileId ?? null),
      phone: org.profile?.phone ?? null,
      zalo: org.profile?.zalo ?? null,
      address: org.profile?.address ?? null,
    },
    bank,
    student: {
      fullName: customer.fullName,
      callName: callName(customer.fullName),
      avatarUrl: await fileUrl(db, orgId, customer.avatarFileId),
    },
    device: { label: device.label, openedAt: device.createdAt.toISOString() },
    timezone: org.timezone,
    serverTime: now.toISOString(),
    enrollments: presentEnrollments,
    contracts: presentContracts,
    cards: presentCards,
  };
}
