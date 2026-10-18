import type { Request } from 'express';
import { z } from 'zod';
import type { Permission } from '@makeup/shared';
import type { Env } from '../env';
import type { Db } from '../lib/prisma';
import type { Logger } from '../lib/logger';

export type Scope = 'public' | 'auth' | 'org';
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
}

export interface HandlerResult {
  status?: number;
  body?: unknown;
}

type AnySchema = z.ZodType;

export interface RouteDef<B extends AnySchema, Q extends AnySchema, P extends AnySchema> {
  method: Method;
  // Đường tương đối sau /api/v1, ví dụ "/orgs/:orgId/members".
  path: string;
  scope: Scope;
  // Bắt buộc với scope "org": thiếu là lỗi lúc khởi động, không có đường lui im lặng.
  permission?: Permission;
  summary: string;
  tag: string;
  rateLimit?: 'auth';
  // Bắt buộc header Idempotency-Key, chống tạo trùng khi bấm hai lần / mạng gửi lại.
  idempotent?: boolean;
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
  } else if (def.path.includes(':orgId')) {
    throw new Error(`Đường ${def.method.toUpperCase()} ${def.path} có :orgId nhưng không khai scope "org"`);
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
