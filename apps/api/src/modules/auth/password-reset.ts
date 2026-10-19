// Đặt lại mật khẩu qua email (thợ K1).
// 1) POST /auth/password-reset/request { email } → LUÔN 202 cùng một lời (có tài khoản hay không — chống dò tài khoản),
//    thời gian trả lời được kéo về cùng một mức sàn; thư gửi nền, không chờ.
// 2) POST /auth/password-reset/confirm { token, password } → 204: thẻ dùng một lần, đổi mật khẩu, vô hiệu MỌI thẻ đặt lại
//    còn lại và thu hồi MỌI phiên đăng nhập (refresh token) của người đó.
// Thẻ: 32 byte ngẫu nhiên (base64url), database chỉ giữ sha256. Thẻ thật và mật khẩu KHÔNG BAO GIỜ vào nhật ký hay audit
// (ngoại lệ có chủ đích: người gửi thư "console" khi chạy thử in nguyên thư — production không bao giờ dựng driver đó).
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { defineRoute, type Deps } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { hashPassword } from '../../lib/password';
import { mailSetupFor, type Mailer, type MailMessage } from '../../lib/mailer';
import { Email, Password } from './schemas';
import { CLEAR_REFRESH_COOKIE } from './transport';

// Đường trên web đọc thẻ trong PHẦN SAU DẤU # (không gửi lên máy chủ web, không lọt vào Referer / nhật ký truy cập).
export const RESET_WEB_PATH = '/dat-lai-mat-khau';
// Một email nhận tối đa ngần này thư đặt lại mỗi giờ (chống dội thư vào hộp thư người khác). Vượt thì vẫn trả 202 như thường.
export const RESET_REQUESTS_PER_EMAIL_PER_HOUR = 3;
// Mức sàn thời gian trả lời của đường yêu cầu: có tài khoản (ghi database) hay không (chỉ đọc) đều trả sau chừng ấy.
export const RESET_REQUEST_MIN_RESPONSE_MS = 300;

export const RESET_REQUEST_ACCEPTED_MESSAGE =
  'Nếu email này có tài khoản, chúng tôi đã gửi đường dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (cả mục thư rác).';
const INVALID_TOKEN_MESSAGE = 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đường dẫn mới.';

export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Sau MỌI lần đổi mật khẩu (đặt lại qua email hôm nay; đổi mật khẩu khi đã đăng nhập sau này): vô hiệu các thẻ đặt lại
// còn hiệu lực và thu hồi mọi phiên đăng nhập. Gọi trong CÙNG transaction đổi mật khẩu.
export async function revokeCredentialsAfterPasswordChange(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<{ resetTokens: number; sessions: number }> {
  const resetTokens = await tx.passwordResetToken.updateMany({
    where: { userId, usedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });
  const sessions = await tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokeReason: 'PASSWORD_RESET' },
  });
  return { resetTokens: resetTokens.count, sessions: sessions.count };
}

// Bài thử có thể gắn người gửi thư riêng vào deps (deps.mailer) — mã chạy thật luôn chọn theo env.
type MailDeps = Deps & { mailer?: Mailer };

function mailFor(deps: Deps): { mailer: Mailer; webAppUrl: string } {
  const setup = mailSetupFor(deps.env, deps.logger);
  if (!setup.ok) {
    // Kiểm TRƯỚC khi tra email: lỗi cấu hình giống nhau cho mọi email, không lộ tài khoản nào tồn tại.
    throw new AppError(
      'NOT_CONFIGURED',
      'Máy chủ chưa cấu hình gửi thư nên chưa đặt lại mật khẩu qua email được. Vui lòng liên hệ quản trị viên.',
      { reason: setup.reason },
      setup.hint,
    );
  }
  return { mailer: (deps as MailDeps).mailer ?? setup.mailer, webAppUrl: setup.webAppUrl };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function resetMail(to: string, fullName: string, link: string, ttlMinutes: number): MailMessage {
  const text = [
    `Chào ${fullName},`,
    '',
    'Có người (có thể là bạn) vừa yêu cầu đặt lại mật khẩu tài khoản Makeup Pro gắn với email này.',
    `Mở đường dẫn sau để đặt mật khẩu mới (hết hạn sau ${ttlMinutes} phút, chỉ dùng được một lần):`,
    link,
    '',
    'Đặt mật khẩu mới xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.',
    'Nếu không phải bạn yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.',
  ].join('\n');
  const html =
    `<p>Chào ${escapeHtml(fullName)},</p>` +
    '<p>Có người (có thể là bạn) vừa yêu cầu đặt lại mật khẩu tài khoản Makeup Pro gắn với email này.</p>' +
    `<p><a href="${escapeHtml(link)}">Đặt mật khẩu mới</a> — hết hạn sau ${ttlMinutes} phút, chỉ dùng được một lần.</p>` +
    '<p>Đặt mật khẩu mới xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.</p>' +
    '<p>Nếu không phải bạn yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.</p>';
  return { to, subject: 'Đặt lại mật khẩu Makeup Pro', text, html };
}

type RequestOutcome = { kind: 'none' } | { kind: 'mail'; message: MailMessage; userId: string; token: string };

async function handleResetRequest(deps: Deps, email: string, requestId: string, mail: { mailer: Mailer; webAppUrl: string }): Promise<RequestOutcome> {
  const now = new Date();
  const user = await deps.db.user.findUnique({ where: { email }, select: { id: true, email: true, fullName: true, status: true } });
  if (!user || user.status !== 'ACTIVE') {
    // Không có tài khoản (hoặc tài khoản bị khoá): không gửi gì. Ghi audit KHÔNG kèm email (không cất email lạ).
    await deps.db.$transaction((tx) =>
      writeAudit(tx, { organizationId: null, actorUserId: null, action: 'auth.password_reset_requested', entityType: 'user', data: { matched: false }, requestId }),
    );
    return { kind: 'none' };
  }
  const recent = await deps.db.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
  });
  if (recent >= RESET_REQUESTS_PER_EMAIL_PER_HOUR) {
    await deps.db.$transaction((tx) =>
      writeAudit(tx, { organizationId: null, actorUserId: user.id, action: 'auth.password_reset_throttled', entityType: 'user', entityId: user.id, requestId }),
    );
    return { kind: 'none' };
  }
  const { token, hash } = newResetToken();
  const ttl = deps.env.PASSWORD_RESET_TTL_MINUTES;
  await deps.db.$transaction(async (tx) => {
    // Chỉ thẻ MỚI NHẤT còn dùng được: thư cũ (có thể nằm trong hộp thư bị lộ) hết tác dụng.
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, createdAt: now, expiresAt: new Date(now.getTime() + ttl * 60_000) },
    });
    await writeAudit(tx, {
      organizationId: null,
      actorUserId: user.id,
      action: 'auth.password_reset_requested',
      entityType: 'user',
      entityId: user.id,
      data: { matched: true, mailDriver: mail.mailer.driver, ttlMinutes: ttl },
      requestId,
    });
  });
  const link = `${mail.webAppUrl}${RESET_WEB_PATH}#the=${token}`;
  deps.logger.info({ link }, 'đã tạo đường dẫn');
  return { kind: 'mail', userId: user.id, token, message: resetMail(user.email, user.fullName, link, ttl) };
}

const InvalidToken = () => new AppError('VALIDATION_FAILED', INVALID_TOKEN_MESSAGE, { reason: 'RESET_TOKEN_INVALID' });

export const passwordResetRoutes = [
  defineRoute({
    method: 'post',
    path: '/auth/password-reset/request',
    scope: 'public',
    tag: 'Đăng nhập',
    summary:
      'Quên mật khẩu: gửi đường dẫn đặt lại qua email. Luôn trả 202 cùng một lời dù email có tài khoản hay không; 503 NOT_CONFIGURED khi máy chủ chưa cấu hình gửi thư',
    rateLimit: 'auth',
    body: z.object({ email: Email }),
    handler: async ({ deps, body, requestId }) => {
      const mail = mailFor(deps);
      const started = Date.now();
      const outcome = await handleResetRequest(deps, body.email, requestId, mail);
      if (outcome.kind === 'mail') {
        // Gửi NỀN, không chờ: thời gian gọi dịch vụ thư không được làm lộ email nào có tài khoản.
        // Lỗi gửi chỉ ghi log — không kèm nội dung thư, không kèm email; lời lỗi của driver bị che thẻ phòng khi driver chép thư vào.
        mail.mailer.send(outcome.message).catch((err: unknown) => {
          const error = (err instanceof Error ? err.message : 'lỗi không rõ').replaceAll(outcome.token, '[ẩn]');
          deps.logger.error(
            { requestId, userId: outcome.userId, mailDriver: mail.mailer.driver, error },
            'Gửi thư đặt lại mật khẩu thất bại',
          );
        });
      }
      const wait = RESET_REQUEST_MIN_RESPONSE_MS - (Date.now() - started);
      if (wait > 0) await sleep(wait);
      return { status: 202, body: { message: RESET_REQUEST_ACCEPTED_MESSAGE } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/auth/password-reset/confirm',
    scope: 'public',
    tag: 'Đăng nhập',
    summary:
      'Đặt mật khẩu mới bằng thẻ trong thư (dùng một lần). Thành công: 204, mọi thẻ đặt lại cũ hết hiệu lực, mọi phiên đăng nhập bị thu hồi',
    rateLimit: 'auth',
    body: z.object({ token: z.string().min(20).max(200), password: Password }),
    handler: async ({ deps, body, requestId }) => {
      const row = await deps.db.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(body.token) } });
      if (!row) throw InvalidToken();
      const now = new Date();
      const rejected = row.usedAt ? 'USED' : row.revokedAt ? 'REVOKED' : row.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : null;
      const user = await deps.db.user.findUnique({ where: { id: row.userId }, select: { status: true } });
      const reason = rejected ?? (user?.status === 'ACTIVE' ? null : 'USER_INACTIVE');
      if (reason) {
        // Thẻ có thật nhưng không dùng được (dùng lại thẻ đã dùng = dấu hiệu đáng chú ý) — ghi audit, không ghi thẻ.
        await deps.db.$transaction((tx) =>
          writeAudit(tx, {
            organizationId: null,
            actorUserId: row.userId,
            action: 'auth.password_reset_rejected',
            entityType: 'password_reset_token',
            entityId: row.id,
            data: { reason },
            requestId,
          }),
        );
        throw InvalidToken();
      }
      const passwordHash = await hashPassword(body.password);
      await deps.db.$transaction(async (tx) => {
        // Giành thẻ trong cùng câu lệnh (điều kiện còn hiệu lực): hai yêu cầu đồng thời chỉ một bên thắng.
        const claimed = await tx.passwordResetToken.updateMany({
          where: { id: row.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (claimed.count !== 1) throw InvalidToken();
        await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
        const revoked = await revokeCredentialsAfterPasswordChange(tx, row.userId, new Date());
        await writeAudit(tx, {
          organizationId: null,
          actorUserId: row.userId,
          action: 'auth.password_reset_completed',
          entityType: 'user',
          entityId: row.userId,
          data: { revokedSessions: revoked.sessions, revokedResetTokens: revoked.resetTokens },
          requestId,
        });
      });
      // Phiên trên chính trình duyệt này cũng đã bị thu hồi → xoá luôn cookie refresh.
      return { status: 204, cookies: [CLEAR_REFRESH_COOKIE] };
    },
  }),
];
