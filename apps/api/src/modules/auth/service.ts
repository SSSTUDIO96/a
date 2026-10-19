import type { Deps } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { hashRefreshToken, newFamilyId, newRefreshToken } from '../../lib/tokens';
import { passwordMarkOf, PASSWORD_CHANGED_MESSAGE, signAccessToken } from './access-token';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Người được cấp thẻ + mốc đổi mật khẩu ĐÃ ĐỌC lúc kiểm danh tính (đăng nhập: cùng dòng với bản băm vừa so mật khẩu;
// đổi thẻ: đọc TRƯỚC khi giành refresh token). Cấp thẻ chỉ khi mốc trong database vẫn y nguyên.
export interface TokenSubject {
  id: string;
  passwordChangedAt: Date | null;
}

// Đối chiếu-rồi-ghi trong MỘT transaction, khoá chia sẻ dòng users: đặt lại mật khẩu (UPDATE users → khoá ghi) và cấp
// thẻ không thể xen nhau. Không có bước này: đăng nhập bằng mật khẩu CŨ đang chờ bcrypt, hoặc đổi thẻ đã giành refresh
// token, mà lần đặt lại mật khẩu chen vào giữa thì refresh token mới sinh SAU lúc đặt lại thu hồi → phiên sống sót.
// - Đặt lại commit trước: FOR SHARE đọc bản mới, mốc lệch → 401.
// - Cấp thẻ commit trước: đặt lại chờ khoá, rồi lệnh thu hồi (cùng transaction đặt lại) thấy và thu hồi refresh token mới.
export async function issueTokens(deps: Deps, subject: TokenSubject, familyId = newFamilyId()): Promise<TokenPair> {
  const { token, hash } = newRefreshToken();
  const expected = passwordMarkOf(subject.passwordChangedAt);
  await deps.db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ password_changed_at: Date | null }[]>`
      SELECT password_changed_at FROM users WHERE id = ${subject.id}::uuid FOR SHARE`;
    const current = rows[0];
    if (!current) {
      throw new AppError('UNAUTHENTICATED', PASSWORD_CHANGED_MESSAGE);
    }
    await tx.refreshToken.create({
      data: {
        userId: subject.id,
        familyId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + deps.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    });
  });
  return {
    accessToken: signAccessToken(subject.id, subject.passwordChangedAt, deps.env.JWT_ACCESS_SECRET, deps.env.ACCESS_TOKEN_TTL_SECONDS),
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
  // Mốc đổi mật khẩu đọc TRƯỚC khi giành thẻ (issueTokens đối chiếu lại): đặt lại mật khẩu chen vào sau bước giành thì
  // mốc đã lệch → không cấp; chen vào trước thì thẻ đã bị thu hồi → giành thất bại.
  const user = await deps.db.user.findUnique({ where: { id: row.userId }, select: { status: true, passwordChangedAt: true } });
  if (!user || user.status !== 'ACTIVE') {
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
  const pair = await issueTokens(deps, { id: row.userId, passwordChangedAt: user.passwordChangedAt }, row.familyId);
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
