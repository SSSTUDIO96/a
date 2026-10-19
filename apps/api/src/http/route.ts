import type { Request } from 'express';
import { z } from 'zod';
import type { Permission } from '@makeup/shared';
import type { Env } from '../env';
import type { Db } from '../lib/prisma';
import type { Logger } from '../lib/logger';
import { fieldsFilledWhenMissing } from './partial';

// platform = người quản trị toàn nền tảng (bảng platform_admins); người khác nhận 404.
// portal = học viên cầm phiên cổng (cookie mp_portal + X-Client: portal, bản vẽ E 4.1). Loại thẻ RIÊNG: đường nhân viên
// từ chối phiên cổng, đường cổng từ chối thẻ nhân viên (tường chắn hai chiều, bản vẽ E 2.3).
export type Scope = 'public' | 'auth' | 'org' | 'platform' | 'portal';
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

// Ngữ cảnh học viên lấy TỪ PHIÊN (modules/portal/auth.ts), không bao giờ từ yêu cầu (bản vẽ E 2.2 luật 1).
// Mọi truy vấn ở đường cổng lọc CẢ organizationId LẪN customerId lấy từ đây.
export interface PortalContext {
  organizationId: string;
  customerId: string;
  deviceId: string;
  sessionId: string;
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
  // Chỉ có ở đường scope "portal"; mọi scope khác luôn null.
  portal: PortalContext | null;
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
  // không được ăn vào hạn mức đăng nhập — biên bản nghiệm thu web 1, T3). 'portal': bộ đếm RIÊNG cho mở cổng học viên
  // (PORTAL_RATE_LIMIT_PER_MINUTE, bản vẽ E 2.6). Mức cụ thể: xem app.ts.
  rateLimit?: 'auth' | 'refresh' | 'portal';
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

// Hai đường DUY NHẤT dưới /portal/ được mở không cần phiên (đổi chìa / mã chuyển máy thành phiên). Bắt buộc
// rateLimit: 'portal'. Mọi đường khác dưới /portal/ phải là scope "portal" (bản vẽ E 4.1).
export const PORTAL_PUBLIC_ROUTES = ['POST /portal/session', 'POST /portal/session/claim'] as const;

// Địa chỉ thuộc cổng học viên. Express mặc định KHÔNG phân biệt hoa thường (router caseSensitive=false), nên
// "/Portal/x" cũng ăn yêu cầu gửi tới "/portal/x" — so ở dạng chữ thường để không lách được luật bằng chữ hoa.
export function isPortalPath(path: string): boolean {
  const p = path.toLowerCase();
  return p === '/portal' || p.startsWith('/portal/');
}

// Các đường dẫn trường tên kết thúc bằng Id/Ids ở BẤT KỲ độ sâu nào của một schema zod (đi trên JSON Schema).
// Chép cách đi của test/gate.ts refFieldPaths (không nhập từ thư mục test) nhưng đi MỌI nhánh của cây (properties,
// items, anyOf/oneOf/allOf, additionalProperties, prefixItems, $defs…) để trường lồng sâu kiểu gì cũng bị bắt.
export function idFieldPaths(schema: AnySchema | undefined): string[] {
  if (!schema) return [];
  const out = new Set<string>();
  const walk = (node: unknown, prefix: string) => {
    if (Array.isArray(node)) {
      for (const x of node) walk(x, prefix);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(n)) {
      if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [name, child] of Object.entries(v as Record<string, unknown>)) {
          if (/Ids?$/.test(name)) out.add(`${prefix}${name}`);
          walk(child, `${prefix}${name}.`);
        }
      } else if (k === 'items' || k === 'prefixItems') {
        walk(v, `${prefix.replace(/\.$/, '')}[].`);
      } else {
        walk(v, prefix);
      }
    }
  };
  walk(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), '');
  return [...out].sort();
}

// Luật riêng của cổng học viên (bản vẽ E 4.1, 2.2 luật 1 và 4). Sai → ném lỗi lúc khởi động.
function checkPortalRules(def: RouteDef<AnySchema, AnySchema, AnySchema>): void {
  const name = `${def.method.toUpperCase()} ${def.path}`;
  const portalPath = isPortalPath(def.path);
  if (def.scope === 'portal') {
    if (!def.path.startsWith('/portal/')) {
      throw new Error(`Đường ${name} scope "portal" phải bắt đầu bằng /portal/`);
    }
  } else if (portalPath) {
    // Luật 3 (auth/org/platform dưới /portal/) và luật 2 (public chỉ ở hai đường cho phép, có bộ đếm riêng).
    if (def.scope !== 'public') {
      throw new Error(`Đường ${name} dưới /portal/ không được khai scope "${def.scope}" — chỉ "portal" hoặc public trong danh sách cho phép`);
    }
    if (!(PORTAL_PUBLIC_ROUTES as readonly string[]).includes(name)) {
      throw new Error(`Đường ${name} dưới /portal/ khai public nhưng không nằm trong PORTAL_PUBLIC_ROUTES`);
    }
    if (def.rateLimit !== 'portal') {
      throw new Error(`Đường ${name} public dưới /portal/ phải khai rateLimit: 'portal'`);
    }
  } else {
    return;
  }
  // Chung cho mọi đường dưới /portal/ (cả hai đường public): học viên lấy từ PHIÊN, không có tham số nào trên địa chỉ;
  // không nhận thẻ/chìa/mã qua query string.
  if (def.path.includes(':')) throw new Error(`Đường ${name} của cổng học viên không được có tham số đường dẫn (:…)`);
  if (def.params) throw new Error(`Đường ${name} của cổng học viên không được khai params`);
  if (def.query) throw new Error(`Đường ${name} của cổng học viên không được khai query`);
  if (def.permission) throw new Error(`Đường ${name} của cổng học viên không khai quyền tổ chức`);
  if (def.idempotent) {
    // Kho chống gửi trùng cất NGUYÊN phản hồi (có thể là chìa/thẻ bản rõ) — bản vẽ E 2.2 luật 5.
    throw new Error(`Đường ${name} của cổng học viên không được khai idempotent`);
  }
  if (def.scope === 'portal') {
    const ids = idFieldPaths(def.body);
    if (ids.length > 0) {
      throw new Error(`Đường ${name} scope "portal": thân không được có trường mã (${ids.join(', ')}) — học viên lấy từ phiên`);
    }
  }
}

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
  checkPortalRules(def as unknown as RouteDef<AnySchema, AnySchema, AnySchema>);
  if (def.scope === 'portal') return def as unknown as AnyRoute;
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

// Đường "portal" luôn có ngữ cảnh học viên; rỗng là lỗi lắp ráp (cùng khuôn mustOrg).
export function mustPortal(portal: PortalContext | null): PortalContext {
  if (!portal) throw new Error('Thiếu ngữ cảnh học viên ở đường cổng học viên — lỗi lắp ráp route');
  return portal;
}
