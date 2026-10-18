import { z } from 'zod';
import { defineRoute, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../../lib/password';
import { issueTokens, revokeFamily, rotateRefreshToken } from './service';
import { CLEAR_REFRESH_COOKIE, deliverTokens, presentedRefreshToken } from './transport';

const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Email không hợp lệ' }).max(254));
// bcrypt chỉ dùng 72 byte đầu: mật khẩu dài hơn sẽ bị cắt âm thầm, nên chặn ngay ở cửa (biên bản mốc 2, L9).
const Password = z
  .string()
  .min(10, 'Mật khẩu tối thiểu 10 ký tự')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Mật khẩu tối đa 72 byte (khoảng 24–72 ký tự tuỳ dấu)');

export const authRoutes = [
  defineRoute({
    method: 'post',
    path: '/auth/register',
    scope: 'public',
    tag: 'Đăng nhập',
    summary: 'Đăng ký tài khoản',
    rateLimit: 'auth',
    body: z.object({ email: Email, password: Password, fullName: z.string().trim().min(1).max(120) }),
    handler: async ({ req, deps, body, requestId }) => {
      const exists = await deps.db.user.findUnique({ where: { email: body.email }, select: { id: true } });
      if (exists) throw new AppError('CONFLICT', 'Email này đã được đăng ký');
      const passwordHash = await hashPassword(body.password);
      const user = await deps.db.$transaction(async (tx) => {
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
          requestId,
        });
        return created;
      });
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
    rateLimit: 'auth',
    body: z.object({ refreshToken: z.string().min(20).max(200).optional() }),
    handler: async ({ req, deps, body, requestId }) =>
      deliverTokens(req, deps, await rotateRefreshToken(deps, presentedRefreshToken(req, body.refreshToken), requestId)),
  }),

  defineRoute({
    method: 'post',
    path: '/auth/logout',
    scope: 'public',
    tag: 'Đăng nhập',
    summary: 'Đăng xuất: thu hồi phiên trên thiết bị này',
    body: z.object({ refreshToken: z.string().min(20).max(200).optional() }),
    handler: async ({ req, deps, body, requestId }) => {
      await revokeFamily(deps, presentedRefreshToken(req, body.refreshToken), requestId);
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
];
