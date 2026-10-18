import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { isPermission, type Permission } from '@makeup/shared';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';
import type { Deps, OrgContext } from './route';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export async function authenticate(req: Request, deps: Deps): Promise<string> {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHENTICATED', 'Chưa đăng nhập');
  }
  const { sub } = verifyAccessToken(header.slice(7), deps.env.JWT_ACCESS_SECRET);
  const user = await deps.db.user.findUnique({ where: { id: sub }, select: { id: true, status: true } });
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('UNAUTHENTICATED', 'Tài khoản không còn hoạt động');
  }
  return user.id;
}

const OrgIdSchema = z.uuid();

// Quyền luôn tra lại từ database theo từng yêu cầu — không tin organization_id hay vai trò do máy khách gửi.
export async function loadOrgContext(
  deps: Deps,
  userId: string,
  rawOrgId: string | undefined,
  required: Permission,
): Promise<OrgContext> {
  const parsed = OrgIdSchema.safeParse(rawOrgId);
  if (!parsed.success) {
    throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
  }
  const membership = await deps.db.membership.findUnique({
    where: { organizationId_userId: { organizationId: parsed.data, userId } },
    select: {
      id: true,
      status: true,
      organization: { select: { status: true } },
      roles: { select: { role: { select: { key: true, permissions: true } } } },
    },
  });
  // Không phải thành viên và tổ chức không tồn tại trả cùng một lỗi để không lộ tổ chức nào có thật.
  if (!membership || membership.status !== 'ACTIVE') {
    throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
  }
  if (membership.organization.status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', 'Tổ chức đang bị tạm khoá');
  }
  const permissions = new Set<Permission>();
  for (const { role } of membership.roles) {
    for (const p of role.permissions) {
      if (isPermission(p)) permissions.add(p);
    }
  }
  if (!permissions.has(required)) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', { required });
  }
  return {
    id: parsed.data,
    membershipId: membership.id,
    roleKeys: membership.roles.map((r) => r.role.key),
    permissions,
  };
}

export function errorHandler(deps: Deps) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = String(res.locals.requestId ?? '');
    let appErr: AppError;
    if (err instanceof AppError) {
      appErr = err;
    } else if (err instanceof z.ZodError) {
      appErr = new AppError('VALIDATION_FAILED', 'Dữ liệu gửi lên không hợp lệ', z.flattenError(err));
    } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      appErr = new AppError('CONFLICT', 'Dữ liệu bị trùng', { fields: err.meta?.target });
    } else if (isExclusionViolation(err)) {
      appErr = new AppError('CONFLICT', 'Trùng lịch: thợ đã có lịch khác trong khoảng thời gian này');
    } else if (isBodyParseError(err)) {
      appErr = new AppError('VALIDATION_FAILED', 'Nội dung gửi lên không phải JSON hợp lệ');
    } else {
      deps.logger.error({ err, requestId, path: req.path }, 'Lỗi không lường trước');
      appErr = new AppError('INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại');
    }
    res.status(appErr.status).json({
      error: { code: appErr.code, message: appErr.message, details: appErr.details, requestId },
    });
  };
}

function isBodyParseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed';
}

// Database từ chối do ràng buộc EXCLUDE (chặn trùng lịch, mã Postgres 23P01).
// Prisma 6.19 báo lỗi này theo hai dạng (đã thí nghiệm thật):
// - qua create/update: PrismaClientUnknownRequestError, không có code, mã nằm trong message;
// - qua $queryRaw/$executeRaw: PrismaClientKnownRequestError P2010, meta.code = '23P01'.
export function isExclusionViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2010' && (err.meta as { code?: string } | undefined)?.code === '23P01';
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return err.message.includes('23P01');
  }
  return false;
}
