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
// Nhận cả transaction client để tra lại quyền SAU khi khoá tổ chức (xem lockOrgAndRecheck).
export async function loadOrgContext(
  db: Prisma.TransactionClient,
  userId: string,
  rawOrgId: string | undefined,
  required: Permission,
): Promise<OrgContext> {
  const parsed = OrgIdSchema.safeParse(rawOrgId);
  if (!parsed.success) {
    throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
  }
  const membership = await db.membership.findUnique({
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
    userId,
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
      // Trả cả đường dẫn đầy đủ của từng lỗi (vd "lines.0.travel.amount") để giao diện đặt lỗi đúng ô.
      appErr = new AppError('VALIDATION_FAILED', 'Dữ liệu gửi lên không hợp lệ', {
        ...z.flattenError(err),
        issues: err.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
      });
    } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      appErr = new AppError('CONFLICT', 'Dữ liệu bị trùng', { fields: err.meta?.target });
    } else if (databaseError(err)) {
      appErr = databaseError(err) ?? new AppError('INTERNAL', '');
      // Ràng buộc database phải bắt được lỗi thì máy chủ đã để lọt dữ liệu sai — ghi lại để sửa ở khâu trước.
      if (appErr.code === 'VALIDATION_FAILED') deps.logger.warn({ requestId, path: req.path, pg: pgErrorCode(err) }, 'Database chặn dữ liệu sai');
    } else if (bodyErrorMessage(err)) {
      appErr = new AppError('VALIDATION_FAILED', bodyErrorMessage(err) ?? '');
    } else {
      deps.logger.error({ err, requestId, path: req.path }, 'Lỗi không lường trước');
      appErr = new AppError('INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại');
    }
    res.status(appErr.status).json({
      error: { code: appErr.code, message: appErr.message, details: appErr.details, requestId },
    });
  };
}

const BODY_ERROR_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'Nội dung gửi lên không phải JSON hợp lệ',
  'entity.too.large': 'Nội dung gửi lên quá lớn (tối đa 100 KB)',
  'encoding.unsupported': 'Kiểu nén nội dung không được hỗ trợ',
  'charset.unsupported': 'Bảng mã ký tự không được hỗ trợ',
  'request.aborted': 'Yêu cầu bị ngắt giữa chừng',
};

function bodyErrorMessage(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const type = (err as { type?: string }).type;
  return type ? (BODY_ERROR_MESSAGES[type] ?? null) : null;
}

// Mã lỗi PostgreSQL bên trong lỗi Prisma. Prisma 6.19 báo theo hai dạng (đã thí nghiệm thật):
// - qua create/update: PrismaClientUnknownRequestError, không có code — mã nằm trong message (code: "23P01");
// - qua $queryRaw/$executeRaw: PrismaClientKnownRequestError P2010, meta.code = '23P01'.
export function pgErrorCode(err: unknown): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const code = (err.meta as { code?: unknown } | undefined)?.code;
    return err.code === 'P2010' && typeof code === 'string' ? code : null;
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return /code: "([0-9A-Z]{5})"/.exec(err.message)?.[1] ?? null;
  }
  return null;
}

// Lời của RAISE EXCEPTION trong trigger (mã P0001) — đã viết sẵn bằng tiếng Việt cho người dùng đọc.
function pgRaisedMessage(err: unknown): string | null {
  const text =
    err instanceof Prisma.PrismaClientKnownRequestError
      ? String((err.meta as { message?: unknown } | undefined)?.message ?? '')
      : err instanceof Error
        ? err.message
        : '';
  return /message: "((?:[^"\\]|\\.)*)"/.exec(text)?.[1] ?? /ERROR: ([^\n]+)/.exec(text)?.[1] ?? null;
}

export function isExclusionViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23P01';
}

// Đổi lỗi database đã biết thành lỗi có nghĩa. Lỗi lạ trả null để bộ bắt lỗi ghi log và trả 500.
export function databaseError(err: unknown): AppError | null {
  switch (pgErrorCode(err)) {
    case '23P01':
      return new AppError('CONFLICT', 'Trùng lịch: thợ đã có lịch khác trong khoảng thời gian này');
    case 'P0001':
      return new AppError('CONFLICT', pgRaisedMessage(err) ?? 'Thao tác bị database từ chối');
    case '23514':
      return new AppError('VALIDATION_FAILED', 'Dữ liệu vi phạm ràng buộc của hệ thống');
    case '23503':
      return new AppError('VALIDATION_FAILED', 'Dữ liệu tham chiếu tới bản ghi không tồn tại hoặc không hợp lệ');
    case '22021':
    case '22P05':
      return new AppError('VALIDATION_FAILED', 'Nội dung chứa ký tự không hợp lệ');
    default:
      return null;
  }
}

// Khoá dòng tổ chức rồi TRA LẠI quyền người thao tác bên trong cùng transaction.
// Quyền tra ở cửa vào có thể đã cũ: một người vừa bị hạ quyền vẫn ra lệnh được nếu yêu cầu của họ
// đã qua cửa trước khi lệnh hạ quyền xong. Mọi thao tác đổi người/vai trò phải dùng ngữ cảnh trả về từ đây.
export async function lockOrgAndRecheck(
  tx: Prisma.TransactionClient,
  actor: OrgContext,
  required: Permission,
): Promise<OrgContext> {
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${actor.id}::uuid FOR UPDATE`;
  return loadOrgContext(tx, actor.userId, actor.id, required);
}
