// Việc của học viên trên MÁY của phiên (bản vẽ E 4.2, gói E3):
//   POST /portal/session/handoff — mã chuyển sang app vừa cài (8 ký tự, 10 phút, dùng một lần; ghi đè mã cũ)
//   DELETE /portal/session       — "Thoát khỏi máy này": máy kết thúc SIGNED_OUT, mọi phiên của máy bị thu hồi
// Học viên / máy lấy TỪ PHIÊN (PortalContext), mọi câu ghi lọc cả organizationId lẫn customerId (bản vẽ E 2.2 luật 1).
// Mã bản rõ chỉ có trong phản hồi tạo mã; database giữ sha256, audit không có mã (bản vẽ E 2.2 luật 5, 2.7).
import { PORTAL_HANDOFF_MINUTES } from '@makeup/shared';
import type { Deps, PortalContext } from '../../http/route';
import { writeAudit } from '../../lib/audit';
import { portalSessionInvalidError } from './auth';
import { newHandoffCode } from './tokens';

export interface CreatedHandoff {
  code: string; // "ABCD-EFGH"
  expiresAt: string;
}

export async function createHandoff(deps: Deps, p: PortalContext, requestId: string): Promise<CreatedHandoff> {
  const { code, hash } = newHandoffCode();
  return deps.db.$transaction(async (tx) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PORTAL_HANDOFF_MINUTES * 60_000);
    // Máy vừa bị chặn / thoát giữa lúc xác thực và lúc ghi: không đặt mã (CHECK portal_devices_handoff_only_live là lưới cuối).
    const set = await tx.portalDevice.updateMany({
      where: { id: p.deviceId, organizationId: p.organizationId, customerId: p.customerId, endedAt: null },
      data: { handoffHash: hash, handoffExpiresAt: expiresAt },
    });
    if (set.count !== 1) throw portalSessionInvalidError();
    await writeAudit(tx, {
      organizationId: p.organizationId,
      actorUserId: null,
      action: 'portal.handoff_created',
      entityType: 'portal_device',
      entityId: p.deviceId,
      data: { customerId: p.customerId },
      requestId,
    });
    return { code, expiresAt: expiresAt.toISOString() };
  });
}

export async function signOutDevice(deps: Deps, p: PortalContext, requestId: string): Promise<void> {
  await deps.db.$transaction(async (tx) => {
    const now = new Date();
    // Suất máy vẫn tính (đếm trên số máy TỪNG mở) — thoát rồi mở máy khác không lách được giới hạn 2 máy.
    const ended = await tx.portalDevice.updateMany({
      where: { id: p.deviceId, organizationId: p.organizationId, customerId: p.customerId, endedAt: null },
      data: { endedAt: now, endReason: 'SIGNED_OUT', handoffHash: null, handoffExpiresAt: null },
    });
    if (ended.count !== 1) throw portalSessionInvalidError();
    await tx.portalSession.updateMany({
      where: { deviceId: p.deviceId, organizationId: p.organizationId, customerId: p.customerId, revokedAt: null },
      data: { revokedAt: now },
    });
    await writeAudit(tx, {
      organizationId: p.organizationId,
      actorUserId: null,
      action: 'portal.signed_out',
      entityType: 'portal_device',
      entityId: p.deviceId,
      data: { customerId: p.customerId },
      requestId,
    });
  });
}
