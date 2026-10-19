// Xác thực phiên cổng học viên (bản vẽ E 4.1). Chỉ app.ts gọi, cho đường scope "portal".
// Tường chắn hai chiều (bản vẽ E 2.3): đường cổng KHÔNG đọc header Authorization (có là từ chối, kể cả JWT nhân viên hợp
// lệ), KHÔNG đọc cookie mp_refresh; bắt buộc X-Client: portal (chống trang lạ giả yêu cầu).
import type { Request } from 'express';
import { PORTAL_DENIED_MESSAGE, PORTAL_SESSION_DAYS, PORTAL_SESSION_INVALID_MESSAGE, PORTAL_SESSION_TOUCH_MINUTES } from '@makeup/shared';
import { AppError } from '../../lib/errors';
import type { Deps, PortalContext } from '../../http/route';
import { readPortalCookie } from './cookie';
import { PORTAL_TOKEN_PATTERN, sha256Hex } from './tokens';

export const PORTAL_CLIENT_HEADER_VALUE = 'portal';
export const PORTAL_ORG_CLOSED_MESSAGE = 'Trang học viên đang tạm đóng. Vui lòng liên hệ trung tâm.';

// MỘT lời cho mọi phiên hỏng (không cookie, có Authorization, thiếu X-Client, thẻ sai dạng, không có, đã thu hồi, hết hạn,
// máy đã kết thúc): cùng mã, cùng thân, cùng bộ header — không dò được lý do.
export function portalSessionInvalidError(): AppError {
  return new AppError('UNAUTHENTICATED', PORTAL_SESSION_INVALID_MESSAGE, { reason: 'PORTAL_SESSION_INVALID' });
}

// MỘT lời chung cho mọi lần MỞ cổng hỏng (POST /portal/session, /portal/session/claim — gói E3 dùng), bản vẽ E 2.5.
export function portalDeniedError(): AppError {
  return new AppError('UNAUTHENTICATED', PORTAL_DENIED_MESSAGE, { reason: 'PORTAL_DENIED' });
}

export async function authenticatePortal(req: Request, deps: Deps): Promise<PortalContext> {
  // 1. Có Authorization → từ chối, không xét tiếp. Thiếu X-Client: portal → từ chối.
  if (req.header('authorization') !== undefined) throw portalSessionInvalidError();
  if (req.header('x-client') !== PORTAL_CLIENT_HEADER_VALUE) throw portalSessionInvalidError();
  // 2. Cookie đúng dạng mới tra database.
  const token = readPortalCookie(req);
  if (token === null || !PORTAL_TOKEN_PATTERN.test(token)) throw portalSessionInvalidError();
  // 3. Tra theo BẢN BĂM (database không có bản rõ).
  const session = await deps.db.portalSession.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: {
      id: true,
      organizationId: true,
      customerId: true,
      deviceId: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      device: { select: { endedAt: true } },
      organization: { select: { status: true } },
    },
  });
  const now = new Date();
  if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime() || session.device.endedAt !== null) {
    throw portalSessionInvalidError();
  }
  // 4. Tổ chức bị khoá: phiên vẫn còn, nhưng trang tạm đóng.
  if (session.organization.status !== 'ACTIVE') throw new AppError('FORBIDDEN', PORTAL_ORG_CLOSED_MESSAGE);
  // 5. Hết hạn trượt: chạm mốc tối đa mỗi 60 phút, MỘT transaction cho phiên + máy.
  if (now.getTime() - session.lastUsedAt.getTime() > PORTAL_SESSION_TOUCH_MINUTES * 60_000) {
    await deps.db.$transaction([
      deps.db.portalSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now, expiresAt: new Date(now.getTime() + PORTAL_SESSION_DAYS * 86_400_000) },
      }),
      deps.db.portalDevice.update({ where: { id: session.deviceId }, data: { lastSeenAt: now } }),
    ]);
  }
  // 6.
  return {
    organizationId: session.organizationId,
    customerId: session.customerId,
    deviceId: session.deviceId,
    sessionId: session.id,
  };
}
