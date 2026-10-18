import type { Request } from 'express';
import { z } from 'zod';
import type { Permission } from '@makeup/shared';
import type { Env } from '../env';
import type { Db } from '../lib/prisma';
import type { Logger } from '../lib/logger';
import { fieldsFilledWhenMissing } from './partial';

// platform = người quản trị toàn nền tảng (bảng platform_admins); người khác nhận 404.
export type Scope = 'public' | 'auth' | 'org' | 'platform';
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface Deps {
  db: Db;
  env: Env;
  logger: Logger;
}

export interface OrgContext {
  id: string;
  userId: string;
  membershipId: string;
  roleKeys: string[];
  permissions: ReadonlySet<Permission>;
}

export interface HandlerCtx<B, Q, P> {
  req: Request;
  deps: Deps;
  requestId: string;
  body: B;
  query: Q;
  params: P;
  userId: string | null;
  org: OrgContext | null;
  // Chỉ có ở đường khai idempotent: 'new-org' khi máy khách gửi Idempotency-Key. Handler phải gọi
  // recordNewOrgIdempotency (http/middleware.ts) trong CÙNG transaction tạo tổ chức.
  idempotency?: IdempotencyCtx | null;
}

export interface IdempotencyCtx {
  key: string;
  routeKey: string;
  requestHash: string;
}

export interface CookieInstruction {
  name: string;
  // null = xoá cookie
  value: string | null;
  path: string;
  maxAgeMs?: number;
}

export interface HandlerResult {
  status?: number;
  body?: unknown;
  cookies?: CookieInstruction[];
}

type AnySchema = z.ZodType;

// Dạng hợp lệ của header Idempotency-Key (dùng chung cho app.ts và đường đăng ký).
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export interface RouteDef<B extends AnySchema, Q extends AnySchema, P extends AnySchema> {
  method: Method;
  // Đường tương đối sau /api/v1, ví dụ "/orgs/:orgId/members".
  path: string;
  scope: Scope;
  // Bắt buộc với scope "org": thiếu là lỗi lúc khởi động, không có đường lui im lặng.
  permission?: Permission;
  summary: string;
  tag: string;
  // 'auth': đăng ký + đăng nhập chung một bộ đếm theo IP. 'refresh': bộ đếm RIÊNG cho đổi thẻ (tải lại trang
  // không được ăn vào hạn mức đăng nhập — biên bản nghiệm thu web 1, T3). Mức cụ thể: xem app.ts.
  rateLimit?: 'auth' | 'refresh';
  // true (đường thuộc tổ chức): bắt buộc header Idempotency-Key, chống tạo trùng khi bấm hai lần / mạng gửi lại.
  // 'new-org' (POST /orgs): khoá TUỲ CHỌN; dòng idempotency_keys gắn vào chính tổ chức vừa tạo + người tạo
  // (bảng bắt buộc có organization_id — biên bản nghiệm thu web 1, N2).
  idempotent?: boolean | 'new-org';
  body?: B;
  query?: Q;
  params?: P;
  handler: (ctx: HandlerCtx<z.infer<B>, z.infer<Q>, z.infer<P>>) => Promise<HandlerResult>;
}

export type AnyRoute = RouteDef<AnySchema, AnySchema, AnySchema>;

export function defineRoute<
  B extends AnySchema = z.ZodUndefined,
  Q extends AnySchema = z.ZodUndefined,
  P extends AnySchema = z.ZodUndefined,
>(def: RouteDef<B, Q, P>): AnyRoute {
  // PATCH = sửa một phần: trường không gửi phải giữ nguyên. Thân có .default()/.prefault()/.catch() ở trường
  // (kể cả object lồng) sẽ bị zod điền giá trị mặc định cho trường vắng mặt → lỗi lúc khởi động, không chạy âm thầm.
  if (def.method === 'patch') {
    const filled = fieldsFilledWhenMissing(def.body);
    if (filled.length > 0) {
      throw new Error(
        `Đường PATCH ${def.path}: thân yêu cầu có giá trị mặc định ở ${filled.join(', ')} — trường không gửi sẽ bị ghi đè. ` +
          'Bỏ .default() trong thân sửa một phần (dùng .optional()).',
      );
    }
  }
  if (def.scope === 'org') {
    if (!def.permission) {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} thuộc tổ chức nhưng không khai quyền`);
    }
    if (!def.path.startsWith('/orgs/:orgId')) {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} thuộc tổ chức phải bắt đầu bằng /orgs/:orgId`);
    }
    if (def.idempotent && def.method !== 'post') {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path}: chống gửi trùng chỉ dùng cho POST`);
    }
    if (def.idempotent === 'new-org') {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path}: 'new-org' chỉ dành cho đường tạo tổ chức (scope "auth")`);
    }
  } else if (def.scope === 'platform') {
    if (!def.path.startsWith('/platform/')) {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} quản trị nền tảng phải bắt đầu bằng /platform/`);
    }
    // Quyền tổ chức không áp cho quản trị nền tảng: chỉ cần có tên trong bảng platform_admins.
    if (def.permission) {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} quản trị nền tảng không khai quyền tổ chức`);
    }
    if (def.idempotent) {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path}: chống gửi trùng chỉ dùng cho đường thuộc tổ chức`);
    }
  } else if (def.path.startsWith('/platform/')) {
    throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} dưới /platform/ phải khai scope "platform"`);
  } else if (def.path.includes(':orgId')) {
    throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} có :orgId nhưng không khai scope "org"`);
  } else if (def.idempotent === 'new-org') {
    if (def.scope !== 'auth' || def.method !== 'post') {
      throw new Error(`Đường ${def.method.toUpperCase()} ${def.path}: 'new-org' chỉ dùng cho POST cần đăng nhập`);
    }
  } else if (def.idempotent) {
    throw new Error(`Đường ${def.method.toUpperCase()} ${def.path}: chống gửi trùng chỉ dùng cho đường thuộc tổ chức`);
  } else if (def.permission) {
    throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} khai quyền nhưng không thuộc tổ chức`);
  }
  return def as unknown as AnyRoute;
}

// Đường "auth"/"org" luôn có người dùng; nếu vẫn rỗng là lỗi lắp ráp, ném lỗi chứ không đoán.
export function mustUser(userId: string | null): string {
  if (!userId) throw new Error('Thiếu userId ở đường cần đăng nhập — lỗi lắp ráp route');
  return userId;
}

export function mustOrg(org: OrgContext | null): OrgContext {
  if (!org) throw new Error('Thiếu ngữ cảnh tổ chức ở đường thuộc tổ chức — lỗi lắp ráp route');
  return org;
}
