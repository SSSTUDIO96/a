import type { Deps } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { hashRefreshToken, newFamilyId, newRefreshToken, signAccessToken } from '../../lib/tokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueTokens(deps: Deps, userId: string, familyId = newFamilyId()): Promise<TokenPair> {
  const { token, hash } = newRefreshToken();
  await deps.db.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + deps.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return {
    accessToken: signAccessToken(userId, deps.env.JWT_ACCESS_SECRET, deps.env.ACCESS_TOKEN_TTL_SECONDS),
    refreshToken: token,
    expiresIn: deps.env.ACCESS_TOKEN_TTL_SECONDS,
  };
}

// Mỗi refresh token dùng đúng một lần. Thẻ đã dùng mà bị đem ra dùng lại = dấu hiệu bị đánh cắp:
// thu hồi cả "họ" thẻ, buộc đăng nhập lại.
export async function rotateRefreshToken(deps: Deps, presented: string, requestId: string): Promise<TokenPair> {
  const row = await deps.db.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(presented) } });
  if (!row) {
    throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ');
  }
  if (row.revokedAt && row.revokeReason !== 'ROTATED') {
    // Thẻ đã đăng xuất / đã bị thu hồi cả họ: chỉ từ chối, không phải dấu hiệu đánh cắp mới.
    throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc, vui lòng đăng nhập lại');
  }
  if (row.revokedAt) {
    await deps.db.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'REUSE_DETECTED' },
      });
      await writeAudit(tx, {
        organizationId: null,
        actorUserId: row.userId,
        action: 'auth.refresh_reuse_detected',
        entityType: 'refresh_token_family',
        entityId: row.familyId,
        requestId,
      });
    });
    throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại');
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn');
  }
  const user = await deps.db.user.findUnique({ where: { id: row.userId }, select: { status: true } });
  if (user?.status !== 'ACTIVE') {
    throw new AppError('UNAUTHENTICATED', 'Tài khoản không còn hoạt động');
  }
  // Điều kiện revokedAt = null trong cùng câu lệnh: hai yêu cầu đồng thời chỉ một cái thắng.
  const claimed = await deps.db.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: 'ROTATED' },
  });
  if (claimed.count !== 1) {
    throw new AppError('UNAUTHENTICATED', 'Phiên đăng nhập đã được dùng');
  }
  const pair = await issueTokens(deps, row.userId, row.familyId);
  const next = await deps.db.refreshToken.findUniqueOrThrow({
    where: { tokenHash: hashRefreshToken(pair.refreshToken) },
    select: { id: true },
  });
  await deps.db.refreshToken.update({ where: { id: row.id }, data: { replacedById: next.id } });
  return pair;
}

export async function revokeFamily(deps: Deps, presented: string, requestId: string): Promise<void> {
  const row = await deps.db.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(presented) } });
  if (!row) return;
  await deps.db.$transaction(async (tx) => {
    const res = await tx.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
    });
    if (res.count > 0) {
      await writeAudit(tx, {
        organizationId: null,
        actorUserId: row.userId,
        action: 'auth.logout',
        entityType: 'refresh_token_family',
        entityId: row.familyId,
        requestId,
      });
    }
  });
}
