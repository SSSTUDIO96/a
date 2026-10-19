import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { defineRoute, IDEMPOTENCY_KEY_PATTERN, mustUser, type Deps, type HandlerResult } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../../lib/password';
import { issueTokens, revokeFamily, rotateRefreshToken } from './service';
import { CLEAR_REFRESH_COOKIE, deliverTokens, presentedRefreshToken } from './transport';
import { Email, Password } from './schemas';
import { passwordResetRoutes } from './password-reset';

const RegisterBody = z.object({ email: Email, password: Password, fullName: z.string().trim().min(1).max(120) });
type RegisterInput = z.infer<typeof RegisterBody>;

// Gửi lại đăng ký cùng Idempotency-Key chỉ được nhận trong 24 giờ sau lần đầu.
const REGISTER_REPLAY_WINDOW_MS = 24 * 60 * 60_000;

// Header Idempotency-Key TUỲ CHỌN của đăng ký: có thì phải đúng dạng; trả về mã băm của khoá (không cất khoá gốc).
function registerKeySha(req: Request): string | null {
  const key = req.header('idempotency-key');
  if (key === undefined) return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AppError('VALIDATION_FAILED', 'Sai header Idempotency-Key (8–128 ký tự chữ, số, - hoặc _)');
  }
  return createHash('sha256').update(key).digest('hex');
}

// Chống gửi trùng cho ĐĂNG KÝ (biên bản nghiệm thu web 1, N2). Bảng idempotency_keys bắt buộc gắn tổ chức nên
// không dùng được ở đây (xem đề xuất migration trong báo cáo). Thay vào đó: mã băm của khoá ghi vào nhật ký
// "user.registered" cùng transaction tạo tài khoản. Gửi lại CÙNG khoá + CÙNG email/tên + ĐÚNG mật khẩu trong 24 giờ
// → 201 với đúng tài khoản đó và cặp thẻ MỚI (refresh token không bao giờ được cất để trả lại).
// Người khác không có mật khẩu thì không nhận được gì ngoài 409 như cũ.
async function replayRegistration(
  req: Request,
  deps: Deps,
  body: RegisterInput,
  keySha: string | null,
  requestId: string,
): Promise<HandlerResult | null> {
  if (!keySha) return null;
  const user = await deps.db.user.findUnique({ where: { email: body.email } });
  if (!user || user.status !== 'ACTIVE' || user.fullName !== body.fullName) return null;
  if (Date.now() - user.createdAt.getTime() > REGISTER_REPLAY_WINDOW_MS) return null;
  const registered = await deps.db.auditLog.findFirst({
    where: {
      organizationId: null,
      action: 'user.registered',
      entityType: 'user',
      entityId: user.id,
      // Nhật ký ghi cùng transaction với tài khoản; khoảng hẹp để dùng chỉ mục (organization_id, created_at).
      createdAt: { gte: new Date(user.createdAt.getTime() - 60_000), lte: new Date(user.createdAt.getTime() + 60_000) },
    },
    select: { data: true },
  });
  const recorded = (registered?.data as { idempotencyKeySha256?: unknown } | null | undefined)?.idempotencyKeySha256;
  if (recorded !== keySha) return null;
  if (!(await verifyPassword(body.password, user.passwordHash))) return null;
  await deps.db.$transaction((tx) =>
    writeAudit(tx, {
      organizationId: null,
      actorUserId: user.id,
      action: 'user.register_replayed',
      entityType: 'user',
      entityId: user.id,
      requestId,
    }),
  );
  const presented = { id: user.id, email: user.email, fullName: user.fullName };
  return { status: 201, ...deliverTokens(req, deps, await issueTokens(deps, user.id), { user: presented }) };
}

export const authRoutes = [
  defineRoute({
    method: 'post',
    path: '/auth/register',
    scope: 'public',
    tag: 'Đăng nhập',
    summary:
      'Đăng ký tài khoản. Header Idempotency-Key tuỳ chọn: gửi lại cùng khoá + cùng nội dung trong 24 giờ → 201 cùng tài khoản, cặp thẻ mới',
    rateLimit: 'auth',
    body: RegisterBody,
    handler: async ({ req, deps, body, requestId }) => {
      const keySha = registerKeySha(req);
      const exists = await deps.db.user.findUnique({ where: { email: body.email }, select: { id: true } });
      if (exists) {
        const again = await replayRegistration(req, deps, body, keySha, requestId);
        if (again) return again;
        throw new AppError('CONFLICT', 'Email này đã được đăng ký');
      }
      const passwordHash = await hashPassword(body.password);
      let user: { id: string; email: string; fullName: string };
      try {
        user = await deps.db.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: { email: body.email, passwordHash, fullName: body.fullName },
            select: { id: true, email: true, fullName: true },
          });
          await writeAudit(tx, {
            organizationId: null,
            actorUserId: created.id,
            action: 'user.registered',
            entityType: 'user',
            entityId: created.id,
            ...(keySha ? { data: { idempotencyKeySha256: keySha } } : {}),
            requestId,
          });
          return created;
        });
      } catch (err) {
        // Hai yêu cầu cùng email chạy đồng thời: bên thua vấp khoá duy nhất. Cùng khoá → trả tài khoản của bên thắng.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        const again = await replayRegistration(req, deps, body, keySha, requestId);
        if (again) return again;
        throw new AppError('CONFLICT', 'Email này đã được đăng ký');
      }
      return { status: 201, ...deliverTokens(req, deps, await issueTokens(deps, user.id), { user }) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/auth/login',
    scope: 'public',
    tag: 'Đăng nhập',
    summary: 'Đăng nhập bằng email và mật khẩu',
    rateLimit: 'auth',
    body: z.object({ email: Email, password: z.string().min(1).max(128) }),
    handler: async ({ req, deps, body, requestId }) => {
      const user = await deps.db.user.findUnique({ where: { email: body.email } });
      const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok || user.status !== 'ACTIVE') {
        if (user) {
          await deps.db.$transaction((tx) =>
            writeAudit(tx, {
              organizationId: null,
              actorUserId: user.id,
              action: 'auth.login_failed',
              entityType: 'user',
              entityId: user.id,
              requestId,
            }),
          );
        }
        throw new AppError('UNAUTHENTICATED', 'Email hoặc mật khẩu không đúng');
      }
      await deps.db.$transaction((tx) =>
        writeAudit(tx, {
          organizationId: null,
          actorUserId: user.id,
          action: 'auth.login',
          entityType: 'user',
          entityId: user.id,
          requestId,
        }),
      );
      return deliverTokens(req, deps, await issueTokens(deps, user.id), {
        user: { id: user.id, email: user.email, fullName: user.fullName },
      });
    },
  }),

  defineRoute({
    method: 'post',
    path: '/auth/refresh',
    scope: 'public',
    tag: 'Đăng nhập',
    summary: 'Đổi refresh token lấy cặp thẻ mới',
    // Bộ đếm riêng, không ăn vào hạn mức đăng nhập (web gọi mỗi lần tải trang) — xem app.ts.
    rateLimit: 'refresh',
    body: z.object({ refreshToken: z.string().min(20).max(200).optional() }),
    handler: async ({ req, deps, body, requestId }) =>
      deliverTokens(req, deps, await rotateRefreshToken(deps, presentedRefreshToken(req, deps, body.refreshToken), requestId)),
  }),

  defineRoute({
    method: 'post',
    path: '/auth/logout',
    scope: 'public',
    tag: 'Đăng nhập',
    summary: 'Đăng xuất: thu hồi phiên trên thiết bị này',
    body: z.object({ refreshToken: z.string().min(20).max(200).optional() }),
    handler: async ({ req, deps, body, requestId }) => {
      await revokeFamily(deps, presentedRefreshToken(req, deps, body.refreshToken), requestId);
      return { status: 204, cookies: [CLEAR_REFRESH_COOKIE] };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/auth/me',
    scope: 'auth',
    tag: 'Đăng nhập',
    summary: 'Thông tin tài khoản và các tổ chức đang tham gia',
    handler: async ({ deps, userId }) => {
      const user = await deps.db.user.findUniqueOrThrow({
        where: { id: mustUser(userId) },
        select: {
          id: true,
          email: true,
          fullName: true,
          memberships: {
            where: { status: 'ACTIVE', organization: { status: 'ACTIVE' } },
            select: {
              id: true,
              organization: { select: { id: true, name: true, slug: true, kind: true } },
              roles: { select: { role: { select: { key: true, name: true } } } },
            },
          },
        },
      });
      return {
        body: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          organizations: user.memberships.map((m) => ({
            membershipId: m.id,
            ...m.organization,
            roles: m.roles.map((r) => r.role),
          })),
        },
      };
    },
  }),

  // Quên mật khẩu → thư có đường dẫn → đặt mật khẩu mới (password-reset.ts).
  ...passwordResetRoutes,
];
