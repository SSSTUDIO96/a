// Đổi chìa đường dẫn / mã chuyển máy thành PHIÊN cổng học viên (bản vẽ E 4.2, gói E3):
//   POST /portal/session        — chìa (sau #k=) + 4 số cuối SĐT
//   POST /portal/session/claim  — mã chuyển máy 8 ký tự (app vừa cài lên màn hình chính)
// Luật (bản vẽ E 2.5): MỌI nguyên nhân hỏng trả MỘT lời chung (portalDeniedError ở auth.ts) — cùng mã, cùng thân, cùng bộ
// header, không đặt cookie — và mọi kết quả (kể cả thành công, kể cả lỗi lạ) trả sau ít nhất PORTAL_MIN_RESPONSE_MS.
// Transaction KHÔNG ném lỗi nghiệp vụ bên trong: trả kết quả, commit (để audit / bộ đếm sai được lưu), rồi mới quyết.
// Chìa, thẻ, mã, 4 số KHÔNG BAO GIỜ vào database (chỉ sha256), audit hay log.
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import {
  deviceLabelFromUserAgent,
  PORTAL_MAX_DEVICES,
  PORTAL_MAX_FAILED,
  PORTAL_MAX_SESSIONS_PER_DEVICE,
  PORTAL_MIN_RESPONSE_MS,
  PORTAL_SESSION_DAYS,
} from '@makeup/shared';
import type { Deps } from '../../http/route';
import { writeAudit } from '../../lib/audit';
import { PORTAL_CLIENT_HEADER_VALUE } from './auth';
import { phoneLast4 } from './center';
import { readPortalCookie } from './cookie';
import { hashHandoffCode, newSessionToken, PORTAL_TOKEN_PATTERN, sha256Hex } from './tokens';

type Tx = Prisma.TransactionClient;

// Lý do từ chối ghi vào audit portal.open_rejected (bản vẽ E 2.7). KHÔNG bao giờ ra phản hồi.
export type OpenRejectReason = 'WRONG_DIGITS' | 'LOCKED' | 'REVOKED' | 'EXPIRED' | 'FULL' | 'NO_PHONE' | 'ORG_SUSPENDED';

export type RedeemResult = { ok: true; token: string } | { ok: false };

const DENIED: RedeemResult = { ok: false };
const DAY_MS = 86_400_000;
// So 4 số khi chìa không có thật / khách không còn SĐT: vẫn chạy timingSafeEqual cho đều nhịp.
const DUMMY_LAST4 = '0000';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Mức sàn thời gian: chạy việc, rồi chờ cho đủ PORTAL_MIN_RESPONSE_MS tính từ `start` — cả khi việc ném lỗi lạ.
export async function withResponseFloor<T>(start: number, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } finally {
    const left = PORTAL_MIN_RESPONSE_MS - (Date.now() - start);
    if (left > 0) await sleep(left);
  }
}

// So 4 chữ số không lộ thời gian (đầu vào đã qua zod /^\d{4}$/; chuỗi so luôn 4 byte ASCII).
function sameDigits(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

function hasPortalClient(req: Request): boolean {
  return req.header('x-client') === PORTAL_CLIENT_HEADER_VALUE;
}

// Một trình duyệt giữ MỘT phiên: cookie mp_portal cũ còn sống thì thu hồi trong cùng transaction tạo phiên mới.
async function revokeBrowserSession(tx: Tx, req: Request, now: Date): Promise<void> {
  const old = readPortalCookie(req);
  if (old === null || !PORTAL_TOKEN_PATTERN.test(old)) return;
  await tx.portalSession.updateMany({ where: { tokenHash: sha256Hex(old), revokedAt: null }, data: { revokedAt: now } });
}

async function createSession(tx: Tx, s: { organizationId: string; customerId: string; deviceId: string }, now: Date) {
  const { token, hash } = newSessionToken();
  await tx.portalSession.create({
    data: {
      organizationId: s.organizationId,
      customerId: s.customerId,
      deviceId: s.deviceId,
      tokenHash: hash,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + PORTAL_SESSION_DAYS * DAY_MS),
    },
  });
  return token;
}

// ---------- POST /portal/session ----------

export async function redeemLink(deps: Deps, req: Request, input: { key: string; last4: string }, requestId: string): Promise<RedeemResult> {
  if (!hasPortalClient(req)) return DENIED; // không audit
  const keyHash = sha256Hex(input.key);
  return deps.db.$transaction(async (tx) => {
    const now = new Date();
    // Khoá dòng đường dẫn: hai lần mở đồng thời xếp hàng (đếm suất máy, bộ đếm sai luôn trên số liệu mới nhất).
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM portal_links WHERE key_hash = ${keyHash} FOR UPDATE`;
    const linkId = locked[0]?.id;
    if (linkId === undefined) {
      sameDigits(input.last4, DUMMY_LAST4);
      return DENIED; // chìa không có thật: không audit (người ngoài không làm đầy bảng audit)
    }
    const link = await tx.portalLink.findUniqueOrThrow({
      where: { id: linkId },
      select: {
        id: true,
        organizationId: true,
        customerId: true,
        expiresAt: true,
        firstOpenedAt: true,
        lockedAt: true,
        revokedAt: true,
        customer: { select: { phone: true } },
        organization: { select: { status: true } },
        _count: { select: { devices: true } },
      },
    });
    const expected = phoneLast4(link.customer.phone);
    const digitsOk = sameDigits(input.last4, expected ?? DUMMY_LAST4);
    // Thứ tự xét đúng bản vẽ E 4.2. Suất máy tính trên số máy TỪNG mở (cả máy đã thoát / đã chặn) — bản vẽ E 2.4.
    const reason: OpenRejectReason | null =
      link.organization.status !== 'ACTIVE'
        ? 'ORG_SUSPENDED'
        : link.revokedAt !== null
          ? 'REVOKED'
          : link.lockedAt !== null
            ? 'LOCKED'
            : link.firstOpenedAt === null && now.getTime() >= link.expiresAt.getTime()
              ? 'EXPIRED'
              : link._count.devices >= PORTAL_MAX_DEVICES
                ? 'FULL'
                : expected === null
                  ? 'NO_PHONE'
                  : !digitsOk
                    ? 'WRONG_DIGITS'
                    : null;
    const audit = (action: string, entityType: string, entityId: string, data: Prisma.InputJsonValue) =>
      writeAudit(tx, { organizationId: link.organizationId, actorUserId: null, action, entityType, entityId, data, requestId });

    if (reason !== null) {
      await audit('portal.open_rejected', 'portal_link', link.id, { reason });
      if (reason === 'WRONG_DIGITS') {
        // Sai đủ PORTAL_MAX_FAILED lần → khoá vĩnh viễn (CHECK portal_links_lock_pair: khoá ⇔ đủ 5 lần).
        const bumped = await tx.$queryRaw<{ locked: boolean }[]>`
          UPDATE portal_links
             SET failed_attempts = failed_attempts + 1,
                 locked_at = CASE WHEN failed_attempts + 1 >= ${PORTAL_MAX_FAILED} THEN now() ELSE NULL END
           WHERE id = ${link.id}::uuid AND locked_at IS NULL
          RETURNING (locked_at IS NOT NULL) AS locked`;
        if (bumped[0]?.locked) await audit('portal.link_locked', 'portal_link', link.id, { customerId: link.customerId });
      }
      return DENIED;
    }

    await tx.portalLink.update({
      where: { id: link.id },
      data: { failedAttempts: 0, firstOpenedAt: link.firstOpenedAt ?? now },
    });
    // Tên máy do MÁY CHỦ đọc từ User-Agent, không nhận từ máy khách.
    const label = deviceLabelFromUserAgent(req.header('user-agent'));
    const device = await tx.portalDevice.create({
      data: {
        organizationId: link.organizationId,
        customerId: link.customerId,
        linkId: link.id,
        label,
        createdAt: now,
        lastSeenAt: now,
      },
      select: { id: true },
    });
    await revokeBrowserSession(tx, req, now);
    const token = await createSession(tx, { organizationId: link.organizationId, customerId: link.customerId, deviceId: device.id }, now);
    await audit('portal.device_added', 'portal_device', device.id, { customerId: link.customerId, linkId: link.id, label });
    return { ok: true, token } satisfies RedeemResult;
  });
}

// ---------- POST /portal/session/claim ----------

export async function claimHandoff(deps: Deps, req: Request, input: { code: string }, requestId: string): Promise<RedeemResult> {
  if (!hasPortalClient(req)) return DENIED;
  const handoffHash = hashHandoffCode(input.code);
  return deps.db.$transaction(async (tx) => {
    const now = new Date();
    // Khoá dòng máy: hai lần nhận cùng mã đồng thời → chỉ một lần thắng (mã dùng MỘT lần).
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM portal_devices WHERE handoff_hash = ${handoffHash} FOR UPDATE`;
    const deviceId = locked[0]?.id;
    if (deviceId === undefined) return DENIED;
    const device = await tx.portalDevice.findUniqueOrThrow({
      where: { id: deviceId },
      select: {
        id: true,
        organizationId: true,
        customerId: true,
        endedAt: true,
        handoffExpiresAt: true,
        organization: { select: { status: true } },
      },
    });
    const valid =
      device.endedAt === null &&
      device.handoffExpiresAt !== null &&
      device.handoffExpiresAt.getTime() > now.getTime() &&
      device.organization.status === 'ACTIVE';
    if (!valid) return DENIED;
    // Dùng một lần: xoá mã ngay trong transaction nhận phiên.
    await tx.portalDevice.update({ where: { id: device.id }, data: { handoffHash: null, handoffExpiresAt: null } });
    await revokeBrowserSession(tx, req, now);
    // Mỗi máy tối đa PORTAL_MAX_SESSIONS_PER_DEVICE phiên sống: phiên mới đẩy phiên dùng lâu nhất ra.
    const live = await tx.portalSession.findMany({
      where: { deviceId: device.id, organizationId: device.organizationId, revokedAt: null, expiresAt: { gt: now } },
      select: { id: true },
      orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }],
    });
    const excess = live.length - (PORTAL_MAX_SESSIONS_PER_DEVICE - 1);
    if (excess > 0) {
      await tx.portalSession.updateMany({
        where: { id: { in: live.slice(0, excess).map((s) => s.id) }, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    const token = await createSession(tx, { organizationId: device.organizationId, customerId: device.customerId, deviceId: device.id }, now);
    await writeAudit(tx, {
      organizationId: device.organizationId,
      actorUserId: null,
      action: 'portal.handoff_claimed',
      entityType: 'portal_device',
      entityId: device.id,
      data: { customerId: device.customerId },
      requestId,
    });
    return { ok: true, token } satisfies RedeemResult;
  });
}
