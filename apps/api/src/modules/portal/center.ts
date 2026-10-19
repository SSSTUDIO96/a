// Nghiệp vụ cổng học viên PHÍA TRUNG TÂM (bản vẽ E 4.3, gói E4): tạo / thu hồi đường dẫn, chặn máy, xem trạng thái.
// - Mọi tra cứu lọc theo (id, organizationId): mã của tổ chức khác ra 404 giống mã bịa (cửa gác crossId).
// - Thứ tự kiểm: tìm bản ghi trong tổ chức (404) → tổ chức ACADEMY (403) → điều kiện nghiệp vụ (409).
// - Chìa bản rõ chỉ có trong phản hồi tạo đường dẫn, MỘT lần; database chỉ giữ sha256 (tokens.ts newLinkKey).
// - Thu hồi đường dẫn / chặn máy thu hồi luôn phiên trong CÙNG transaction: authenticatePortal (auth.ts) đọc
//   revokedAt / device.endedAt ở MỖI yêu cầu, nên phiên đang mở bị chặn ngay ở lần gọi kế.
// - Audit (bản vẽ E 2.7) ghi trong cùng transaction với thay đổi; không bao giờ có chìa / bản băm / 4 số.
import type { Prisma } from '@prisma/client';
import {
  callName,
  PORTAL_LINK_TTL_DAYS,
  PORTAL_MAX_DEVICES,
  PORTAL_MAX_FAILED,
  PORTAL_SESSION_DAYS,
  type Permission,
  type PortalAdminView,
  type PortalDeviceStatus,
  type PortalIneligibleReason,
  type PortalLinkStatus,
} from '@makeup/shared';
import type { OrgContext } from '../../http/route';
import { writeAudit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import type { Db } from '../../lib/prisma';
import { assertAcademy } from '../courses/service';
import { newLinkKey } from './tokens';

type Tx = Prisma.TransactionClient;

export interface PortalActor {
  org: OrgContext;
  userId: string;
  requestId: string;
}

// Tạo đường dẫn là cho học viên xem tiền, hợp đồng của chính họ: người gửi phải tự xem được những thứ đó (bản vẽ E 2.1 H7,
// ký duyệt câu 3). Thiếu → 403, details.required liệt kê đúng quyền còn thiếu.
export const PORTAL_LINK_EXTRA_PERMISSIONS: readonly Permission[] = ['customers.read', 'contracts.read', 'payments.read'];
export const PORTAL_NO_PHONE_MESSAGE = 'Học viên chưa có số điện thoại — thêm số trước khi gửi đường dẫn';
export const PORTAL_DEVICE_ENDED_MESSAGE = 'Máy này đã bị chặn hoặc đã thoát';
const DEVICES_SHOWN = 20;
const DAY_MS = 86_400_000;

const notFound = {
  customer: () => new AppError('NOT_FOUND', 'Không tìm thấy khách hàng'),
  device: () => new AppError('NOT_FOUND', 'Không tìm thấy máy'),
};

// 4 số cuối của số điện thoại đã chuẩn hoá; ít hơn 4 chữ số / không có số → null.
export function phoneLast4(phone: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

// ---------- Tra cứu theo tổ chức ----------

async function findCustomer(db: Tx | Db, orgId: string, customerId: string) {
  const c = await db.customer.findFirst({
    where: { id: customerId, organizationId: orgId },
    select: { id: true, fullName: true, phone: true },
  });
  if (!c) throw notFound.customer();
  return c;
}

// Khoá dòng khách (lọc cả tổ chức): hai lần "Tạo đường dẫn" / "Thu hồi" đồng thời xếp hàng, không đè nhau.
async function lockCustomer(tx: Tx, orgId: string, customerId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM customers WHERE id = ${customerId}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound.customer();
}

// ---------- Trạng thái ----------

export function linkStatus(
  link: { revokedAt: Date | null; lockedAt: Date | null; firstOpenedAt: Date | null; expiresAt: Date },
  devicesUsed: number,
  now: Date,
): PortalLinkStatus {
  if (link.revokedAt) return 'REVOKED';
  if (link.lockedAt) return 'LOCKED';
  if (link.firstOpenedAt === null && now.getTime() >= link.expiresAt.getTime()) return 'EXPIRED';
  // Suất máy tính trên số máy TỪNG mở (kể cả đã thoát / đã chặn) — bản vẽ E 2.4.
  if (devicesUsed >= PORTAL_MAX_DEVICES) return 'FULL';
  return 'ACTIVE';
}

function deviceStatus(endReason: 'SIGNED_OUT' | 'BLOCKED' | 'LINK_REVOKED' | null): PortalDeviceStatus {
  return endReason ?? 'ACTIVE';
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

// Thẻ "Cổng học viên" trên hồ sơ học viên. Liệt kê từng trường — không trải hàng database (không bao giờ có
// keyHash / tokenHash / handoffHash).
export async function buildAdminView(db: Tx | Db, orgId: string, customerId: string): Promise<PortalAdminView> {
  const now = new Date();
  const [org, customer, courseContracts, link, devices] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { kind: true } }),
    db.customer.findFirst({ where: { id: customerId, organizationId: orgId }, select: { phone: true } }),
    db.contract.count({
      where: { organizationId: orgId, customerId, kind: 'COURSE', status: { in: ['CONFIRMED', 'COMPLETED'] } },
    }),
    // Đường dẫn mới nhất; cùng mốc thời gian thì đường dẫn còn sống đứng trước.
    db.portalLink.findFirst({
      where: { organizationId: orgId, customerId },
      orderBy: [{ createdAt: 'desc' }, { revokedAt: { sort: 'asc', nulls: 'first' } }],
      select: {
        createdAt: true,
        expiresAt: true,
        firstOpenedAt: true,
        failedAttempts: true,
        lockedAt: true,
        revokedAt: true,
        createdBy: { select: { fullName: true } },
        _count: { select: { devices: true } },
      },
    }),
    db.portalDevice.findMany({
      where: { organizationId: orgId, customerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: DEVICES_SHOWN,
      select: {
        id: true,
        label: true,
        createdAt: true,
        lastSeenAt: true,
        endedAt: true,
        endReason: true,
        endedBy: { select: { fullName: true } },
      },
    }),
  ]);
  if (!customer) throw notFound.customer();
  const last4 = phoneLast4(customer.phone);
  const reasons: PortalIneligibleReason[] = [];
  if (org.kind !== 'ACADEMY') reasons.push('NOT_ACADEMY');
  if (last4 === null) reasons.push('NO_PHONE');
  return {
    eligible: { ok: reasons.length === 0, reasons },
    phoneLast4: last4,
    hasCourseContract: courseContracts > 0,
    link: link
      ? {
          status: linkStatus(link, link._count.devices, now),
          createdAt: link.createdAt.toISOString(),
          createdByName: link.createdBy.fullName,
          expiresAt: link.expiresAt.toISOString(),
          firstOpenedAt: iso(link.firstOpenedAt),
          failedAttempts: link.failedAttempts,
          devicesUsed: link._count.devices,
        }
      : null,
    devices: devices.map((d) => ({
      id: d.id,
      label: d.label,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt.toISOString(),
      status: deviceStatus(d.endReason),
      endedAt: iso(d.endedAt),
      endedByName: d.endedBy?.fullName ?? null,
    })),
    limits: {
      linkTtlDays: PORTAL_LINK_TTL_DAYS,
      maxDevices: PORTAL_MAX_DEVICES,
      maxFailed: PORTAL_MAX_FAILED,
      rememberDays: PORTAL_SESSION_DAYS,
    },
  };
}

// ---------- GET trạng thái ----------

export async function getAdminView(db: Db, orgId: string, customerId: string): Promise<PortalAdminView> {
  await findCustomer(db, orgId, customerId);
  await assertAcademy(db, orgId);
  return buildAdminView(db, orgId, customerId);
}

// ---------- Tạo đường dẫn ----------

export interface CreatedLink {
  key: string;
  expiresAt: string;
  callName: string;
  centerName: string;
  view: PortalAdminView;
}

export async function createLink(db: Db, actor: PortalActor, customerId: string): Promise<CreatedLink> {
  const orgId = actor.org.id;
  const missing = PORTAL_LINK_EXTRA_PERMISSIONS.filter((p) => !actor.org.permissions.has(p));
  if (missing.length > 0) {
    throw new AppError('FORBIDDEN', 'Gửi đường dẫn cổng học viên cần thêm quyền xem khách hàng, hợp đồng và phiếu thu', {
      required: missing,
    });
  }
  const customer = await findCustomer(db, orgId, customerId);
  await assertAcademy(db, orgId);
  if (phoneLast4(customer.phone) === null) throw new AppError('CONFLICT', PORTAL_NO_PHONE_MESSAGE, { reason: 'NO_PHONE' });

  const { key, hash } = newLinkKey();
  const result = await db.$transaction(async (tx) => {
    await lockCustomer(tx, orgId, customerId);
    const now = new Date();
    // Mỗi học viên MỘT đường dẫn sống: cái cũ thôi nhận máy mới (REPLACED); máy đã mở GIỮ NGUYÊN.
    const live = await tx.portalLink.findFirst({
      where: { organizationId: orgId, customerId, revokedAt: null },
      select: { id: true },
    });
    if (live) {
      await tx.portalLink.update({
        where: { id: live.id },
        data: { revokedAt: now, revokeReason: 'REPLACED', revokedById: actor.userId },
      });
    }
    const link = await tx.portalLink.create({
      data: {
        organizationId: orgId,
        customerId,
        keyHash: hash,
        createdById: actor.userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + PORTAL_LINK_TTL_DAYS * DAY_MS),
      },
      select: { id: true, expiresAt: true },
    });
    await writeAudit(tx, {
      organizationId: orgId,
      actorUserId: actor.userId,
      action: 'portal.link_created',
      entityType: 'portal_link',
      entityId: link.id,
      data: {
        customerId,
        expiresAt: link.expiresAt.toISOString(),
        ...(live ? { replacedLinkId: live.id } : {}),
        phoneConfirmed: true,
      },
      requestId: actor.requestId,
    });
    const profile = await tx.organizationProfile.findUnique({ where: { organizationId: orgId }, select: { brandName: true } });
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } });
    return { expiresAt: link.expiresAt, centerName: profile?.brandName ?? org.name };
  });
  return {
    key,
    expiresAt: result.expiresAt.toISOString(),
    callName: callName(customer.fullName),
    centerName: result.centerName,
    view: await buildAdminView(db, orgId, customerId),
  };
}

// ---------- Thu hồi đường dẫn + chặn mọi máy ----------

export async function revokeAll(
  db: Db,
  actor: PortalActor,
  customerId: string,
  reason: string,
): Promise<{ devicesEnded: number; view: PortalAdminView }> {
  const orgId = actor.org.id;
  await findCustomer(db, orgId, customerId);
  await assertAcademy(db, orgId);
  const devicesEnded = await db.$transaction(async (tx) => {
    await lockCustomer(tx, orgId, customerId);
    const now = new Date();
    const live = await tx.portalLink.findFirst({
      where: { organizationId: orgId, customerId, revokedAt: null },
      select: { id: true },
    });
    if (live) {
      await tx.portalLink.update({
        where: { id: live.id },
        data: { revokedAt: now, revokeReason: 'REVOKED', revokedById: actor.userId },
      });
    }
    // MỌI máy chưa kết thúc của học viên (kể cả máy mở bằng đường dẫn cũ đã REPLACED).
    const ended = await tx.portalDevice.updateMany({
      where: { organizationId: orgId, customerId, endedAt: null, linkId: live?.id ?? '' },
      data: {
        endedAt: now,
        endReason: 'LINK_REVOKED',
        endedById: actor.userId,
        endNote: reason,
        handoffHash: null,
        handoffExpiresAt: null,
      },
    });
    // Phiên sống của học viên: thu hồi ngay (yêu cầu kế tiếp của máy đó → 401).
    await tx.portalSession.updateMany({
      where: { organizationId: orgId, customerId, revokedAt: null },
      data: { revokedAt: now },
    });
    await writeAudit(tx, {
      organizationId: orgId,
      actorUserId: actor.userId,
      action: 'portal.link_revoked',
      entityType: 'portal_link',
      ...(live ? { entityId: live.id } : {}),
      data: { customerId, reason, devicesEnded: ended.count },
      requestId: actor.requestId,
    });
    return ended.count;
  });
  return { devicesEnded, view: await buildAdminView(db, orgId, customerId) };
}

// ---------- Chặn một máy ----------

export async function blockDevice(
  db: Db,
  actor: PortalActor,
  deviceId: string,
  reason: string,
): Promise<{ view: PortalAdminView }> {
  const orgId = actor.org.id;
  const found = await db.portalDevice.findFirst({
    where: { id: deviceId, organizationId: orgId },
    select: { id: true },
  });
  if (!found) throw notFound.device();
  await assertAcademy(db, orgId);
  const customerId = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ customer_id: string; ended_at: Date | null }[]>`
      SELECT customer_id, ended_at FROM portal_devices
      WHERE id = ${deviceId}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
    const row = rows[0];
    if (!row) throw notFound.device();
    if (row.ended_at !== null) throw new AppError('CONFLICT', PORTAL_DEVICE_ENDED_MESSAGE);
    const now = new Date();
    await tx.portalDevice.update({
      where: { id: deviceId },
      data: {
        endedAt: now,
        endReason: 'BLOCKED',
        endedById: actor.userId,
        endNote: reason,
        handoffHash: null,
        handoffExpiresAt: null,
      },
    });
    await tx.portalSession.updateMany({
      where: { organizationId: orgId, deviceId, revokedAt: null },
      data: { revokedAt: now },
    });
    await writeAudit(tx, {
      organizationId: orgId,
      actorUserId: actor.userId,
      action: 'portal.device_blocked',
      entityType: 'portal_device',
      entityId: deviceId,
      data: { customerId: row.customer_id, reason },
      requestId: actor.requestId,
    });
    return row.customer_id;
  });
  return { view: await buildAdminView(db, orgId, customerId) };
}
