import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { AppError } from './lib/errors';
import { authenticate, errorHandler, loadOrgContext, requestId } from './http/middleware';
import { buildOpenApi } from './http/openapi';
import { IDEMPOTENCY_KEY_PATTERN, type AnyRoute, type Deps, type HandlerResult, type IdempotencyCtx } from './http/route';
import { authRoutes } from './modules/auth/routes';
import { orgRoutes } from './modules/orgs/routes';
import { catalogRoutes } from './modules/catalog/routes';
import { scheduleRoutes } from './modules/schedule/routes';
import { contractRoutes } from './modules/contracts/routes';
import { staffRoutes } from './modules/staff/routes';
import { fileRoutes } from './modules/files/routes';
import { paymentRoutes } from './modules/payments/routes';
import { platformRoutes } from './modules/platform/routes';
import { profileRoutes } from './modules/profile/routes';
import { createHash, type Hash } from 'node:crypto';
import { RAW_ROUTE, rawFileHandler } from './modules/files/raw';
import { hasPresentedRefreshToken } from './modules/auth/transport';
import { Prisma } from '@prisma/client';

// Lời báo lỗi mặc định của zod bằng tiếng Việt (lời riêng trong từng schema vẫn được ưu tiên).
z.config(z.locales.vi());

export const ALL_ROUTES: AnyRoute[] = [...authRoutes, ...orgRoutes, ...catalogRoutes, ...scheduleRoutes, ...contractRoutes, ...staffRoutes, ...fileRoutes, ...paymentRoutes, ...platformRoutes, ...profileRoutes];

export function createApp(deps: Deps, routes: AnyRoute[] = ALL_ROUTES) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.env.TRUST_PROXY_HOPS);
  app.use(requestId);
  app.use(pinoHttp({ logger: deps.logger, customProps: (_req, res) => ({ requestId: res.locals.requestId }) }));
  app.use(helmet());
  const origins = deps.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins, credentials: false }));
  app.use(
    express.json({
      limit: '100kb',
      // Ký tự rỗng \u0000 làm PostgreSQL báo lỗi 500 — từ chối ngay ở cửa (biên bản mốc 2, L6).
      verify: (_req, _res, buf) => {
        if (buf.includes('\\u0000')) {
          throw new AppError('VALIDATION_FAILED', 'Nội dung chứa ký tự không hợp lệ (\\u0000)');
        }
      },
    }),
  );

  const limited = (_req: Request, _res: Response, next: (err: unknown) => void) =>
    next(new AppError('RATE_LIMITED', 'Thử quá nhiều lần, vui lòng đợi một phút'));
  // Đăng ký + đăng nhập: chung một bộ đếm theo IP (đoán mật khẩu là mối lo chính).
  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: deps.env.AUTH_RATE_LIMIT_PER_MINUTE,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: limited,
  });
  // Đổi thẻ (/auth/refresh) có bộ đếm RIÊNG — web gọi nó MỖI LẦN tải trang, cả studio chung một IP
  // (biên bản nghiệm thu web 1, T3: dùng chung bộ đếm đăng nhập thì tải lại ~10 lần/phút là tự khoá mình).
  // Refresh token là chuỗi ngẫu nhiên dài, dò mò không ra; cái cần chặn là dò hàng loạt và dội tải:
  // 1) Chống dò: chỉ đếm lần THẤT BẠI có kèm thẻ — REFRESH_PROBE_LIMIT_PER_MINUTE (mặc định 3× mức đăng nhập = 30 lần sai/phút/IP).
  //    Tải lại trang bình thường (thẻ đúng) và trang chưa đăng nhập (không có cookie) không bị đếm.
  // 2) Trần tổng: REFRESH_RATE_LIMIT_PER_MINUTE (mặc định 30× mức đăng nhập = 300 lần/phút/IP ≈ 30 máy cùng mạng,
  //    mỗi máy tải lại 10 lần/phút). Hai biến bỏ trống thì tính theo AUTH_RATE_LIMIT_PER_MINUTE (env.ts).
  const refreshProbeLimiter = rateLimit({
    windowMs: 60_000,
    limit: deps.env.REFRESH_PROBE_LIMIT_PER_MINUTE,
    standardHeaders: false,
    legacyHeaders: false,
    skip: (req) => !hasPresentedRefreshToken(req),
    skipSuccessfulRequests: true,
    handler: limited,
  });
  const refreshCeilingLimiter = rateLimit({
    windowMs: 60_000,
    limit: deps.env.REFRESH_RATE_LIMIT_PER_MINUTE,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: limited,
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  const openapi = buildOpenApi(routes);
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openapi);
  });

  const router = express.Router();
  for (const route of routes) {
    const handlers = [];
    if (route.rateLimit === 'auth') handlers.push(authLimiter);
    if (route.rateLimit === 'refresh') handlers.push(refreshCeilingLimiter, refreshProbeLimiter);
    handlers.push(async (req: Request, res: Response) => {
      const userId = route.scope === 'public' ? null : await authenticate(req, deps);
      // Đường quản trị nền tảng: người không có tên trong platform_admins nhận đúng lời "không có đường" — không lộ là có.
      if (route.scope === 'platform' && !(await deps.db.platformAdmin.findUnique({ where: { userId: userId ?? '' } }))) {
        throw new AppError('NOT_FOUND', 'Không có đường API này');
      }
      const org =
        route.scope === 'org' && userId && route.permission
          ? await loadOrgContext(
              deps.db,
              userId,
              typeof req.params.orgId === 'string' ? req.params.orgId : undefined,
              route.permission,
            )
          : null;
      const run = (idempotency: IdempotencyCtx | null = null) =>
        route.handler({
          req,
          deps,
          requestId: String(res.locals.requestId),
          body: route.body ? route.body.parse(req.body) : undefined,
          query: route.query ? route.query.parse(req.query) : undefined,
          params: route.params ? route.params.parse(req.params) : undefined,
          userId,
          org,
          idempotency,
        });
      const result =
        route.idempotent === 'new-org' && userId
          ? await runNewOrgIdempotent(deps, req, userId, route, run)
          : route.idempotent && org && userId
            ? await runIdempotent(deps, req, org.id, userId, route, () => run())
            : await run();
      for (const c of result.cookies ?? []) {
        const opts = {
          httpOnly: true,
          secure: deps.env.NODE_ENV === 'production',
          sameSite: 'strict' as const,
          path: c.path,
        };
        if (c.value === null) res.clearCookie(c.name, opts);
        else res.cookie(c.name, c.value, { ...opts, maxAge: c.maxAgeMs });
      }
      if (result.body === undefined) {
        res.status(result.status ?? 204).end();
      } else {
        res.status(result.status ?? 200).json(result.body);
      }
    });
    router[route.method](route.path, ...handlers);
  }
  // Đường trả tệp nhị phân của driver đĩa cục bộ (bảng route chỉ trả JSON nên gắn riêng). Vé ký trong URL là quyền đọc.
  app.get(RAW_ROUTE, rawFileHandler(deps));
  app.use('/api/v1', router);

  app.use((_req, _res, next) => next(new AppError('NOT_FOUND', 'Không có đường API này')));
  app.use(errorHandler(deps));
  return app;
}

const IDEM_PENDING_TTL_MS = 2 * 60_000;
// Thân nhị phân lớn nhất mà một đường có chống gửi trùng nhận (tệp 25 MB) cộng chút dư. Gửi lại vượt mức này
// không thể trùng với lần đầu (lần đầu đã bị từ chối vì quá lớn) nên coi là yêu cầu khác.
const IDEM_MAX_RAW_BODY = 26 * 1024 * 1024;

function readIdemKey(req: Request, required: boolean): string | null {
  const key = req.header('idempotency-key');
  if (key === undefined && !required) return null;
  if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AppError('VALIDATION_FAILED', 'Thiếu hoặc sai header Idempotency-Key (8–128 ký tự chữ, số, - hoặc _)');
  }
  return key;
}

// So ĐƯỜNG DẪN THẬT (kèm id), không so mẫu: cùng khoá gửi vào hai hợp đồng khác nhau là hai yêu cầu khác nhau.
// (Biên bản nghiệm thu lát 1, lỗi T1: so mẫu đường → trả kết quả của hợp đồng đầu, báo thành công giả.)
function routeKeyOf(route: AnyRoute, req: Request): string {
  return `${route.method.toUpperCase()} ${req.baseUrl}${req.path}`;
}

// Thân nhị phân (tải tệp): express.json không đọc nên req.body rỗng, handler tự đọc luồng.
function hasRawBody(req: Request): boolean {
  if (req.body !== undefined) return false;
  return req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] ?? 0) > 0;
}

// Dấu vân tay của "cùng một yêu cầu": thân JSON + query (vd ?purpose=) + nội dung thân nhị phân.
// Thân nhị phân: dùng header X-Content-SHA256 nếu có (module tệp kiểm header này khớp nội dung, sai thì từ chối),
// không có thì băm chính nội dung (phiếu vướng module tệp: trước đây cùng khoá + khác tệp nhận lại kết quả lần đầu).
// Yêu cầu JSON không query giữ đúng công thức cũ (băm thân) để khoá đang dở lúc triển khai bản mới vẫn khớp.
function requestHashOf(req: Request, rawBodySha256: string | null): string {
  const declared = req.header('x-content-sha256')?.trim().toLowerCase() ?? null;
  const content = declared ?? rawBodySha256;
  const query = (req.query ?? {}) as Record<string, unknown>;
  const material =
    content === null && Object.keys(query).length === 0
      ? JSON.stringify(req.body ?? null)
      : JSON.stringify([req.body ?? null, query, content]);
  return createHash('sha256').update(material).digest('hex');
}

function needsRawBodyHash(req: Request): boolean {
  return hasRawBody(req) && req.header('x-content-sha256') === undefined;
}

// Băm thân nhị phân NGAY LÚC handler đọc nó (không đọc thân hai lần): bọc bộ lặp của luồng yêu cầu.
// Module tệp đọc thân bằng `for await (const chunk of req)` (files/service.ts readLimitedBody).
function tapRawBody(req: Request): () => string {
  const hash: Hash = createHash('sha256');
  const source = req[Symbol.asyncIterator].bind(req);
  Object.defineProperty(req, Symbol.asyncIterator, {
    configurable: true,
    value: async function* tapped() {
      for await (const chunk of source()) {
        hash.update(chunk as Buffer);
        yield chunk;
      }
    },
  });
  return () => hash.digest('hex');
}

// Gửi lại (khoá đã có): handler không chạy nên ở đây là lần DUY NHẤT đọc thân.
async function hashRawBody(req: Request): Promise<string | null> {
  const hash = createHash('sha256');
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > IDEM_MAX_RAW_BODY) return null;
    hash.update(chunk);
  }
  return hash.digest('hex');
}

// Chống gửi trùng: máy khách gửi kèm header Idempotency-Key (mỗi lần bấm "Lưu" một khoá mới).
// Gửi lại cùng khoá + cùng nội dung → trả đúng kết quả lần đầu, không tạo bản ghi thứ hai.
async function runIdempotent(
  deps: Deps,
  req: Request,
  organizationId: string,
  userId: string,
  route: AnyRoute,
  run: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  const key = readIdemKey(req, true) ?? '';
  const routeKey = routeKeyOf(route, req);
  const rawPending = needsRawBodyHash(req);
  // Thân nhị phân không kèm X-Content-SHA256: chưa biết dấu vân tay cho tới khi handler đọc xong thân.
  const requestHash = rawPending ? '' : requestHashOf(req, null);
  const pk = { organizationId_userId_key: { organizationId, userId, key } };
  try {
    // Dòng "đang xử lý" (status 0) giữ chỗ: yêu cầu trùng đến cùng lúc sẽ đụng khoá chính và bị từ chối.
    await deps.db.idempotencyKey.create({
      data: { organizationId, userId, key, routeKey, requestHash, responseStatus: 0, responseBody: {} },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    const prev = await deps.db.idempotencyKey.findUniqueOrThrow({ where: pk });
    if (prev.routeKey !== routeKey) throw new AppError('CONFLICT', 'Idempotency-Key này đã dùng cho một yêu cầu khác');
    if (prev.responseStatus === 0) {
      // Dòng "đang xử lý" của thân nhị phân chưa có dấu vân tay (handler chưa đọc xong) — chỉ so được đường dẫn.
      if (!rawPending && prev.requestHash !== requestHash) {
        throw new AppError('CONFLICT', 'Idempotency-Key này đã dùng cho một yêu cầu khác');
      }
      // Máy chủ chết giữa lúc xử lý thì dòng "đang xử lý" kẹt lại. Quá hạn thì cho lấy lại khoá.
      // Rủi ro còn lại (đã ghi sổ): nếu máy chủ chết SAU khi ghi dữ liệu và TRƯỚC khi lưu kết quả, gửi lại sẽ tạo bản thứ hai.
      const stale = Date.now() - prev.createdAt.getTime() > IDEM_PENDING_TTL_MS;
      if (!stale) throw new AppError('CONFLICT', 'Yêu cầu giống hệt đang được xử lý, vui lòng đợi');
      const taken = await deps.db.idempotencyKey.deleteMany({ where: { ...pk.organizationId_userId_key, responseStatus: 0, createdAt: prev.createdAt } });
      if (taken.count !== 1) throw new AppError('CONFLICT', 'Yêu cầu giống hệt đang được xử lý, vui lòng đợi');
      return runIdempotent(deps, req, organizationId, userId, route, run);
    }
    let hashNow = requestHash;
    if (rawPending) {
      const bodySha = await hashRawBody(req);
      hashNow = bodySha === null ? '' : requestHashOf(req, bodySha);
    }
    if (prev.requestHash !== hashNow) throw new AppError('CONFLICT', 'Idempotency-Key này đã dùng cho một yêu cầu khác');
    return { status: prev.responseStatus, body: prev.responseBody };
  }
  const rawDigest = rawPending ? tapRawBody(req) : null;
  try {
    const result = await run();
    const status = result.status ?? (result.body === undefined ? 204 : 200);
    await deps.db.idempotencyKey.update({
      where: pk,
      data: {
        responseStatus: status,
        responseBody: (result.body ?? null) as Prisma.InputJsonValue,
        ...(rawDigest ? { requestHash: requestHashOf(req, rawDigest()) } : {}),
      },
    });
    return result;
  } catch (err) {
    // Thất bại thì nhả khoá để người dùng sửa rồi gửi lại được.
    await deps.db.idempotencyKey.delete({ where: pk });
    throw err;
  }
}

// Chống gửi trùng cho đường tạo tổ chức (idempotent: 'new-org'). Khoá TUỲ CHỌN (app cũ không gửi vẫn chạy).
// Dòng khoá do handler ghi cùng transaction tạo tổ chức (recordNewOrgIdempotency) và tra theo (NGƯỜI DÙNG, khoá):
// người khác gửi cùng khoá không bao giờ nhận được phản hồi của người này.
async function runNewOrgIdempotent(
  deps: Deps,
  req: Request,
  userId: string,
  route: AnyRoute,
  run: (idem: IdempotencyCtx | null) => Promise<HandlerResult>,
): Promise<HandlerResult> {
  const key = readIdemKey(req, false);
  if (key === null) return run(null);
  const idem: IdempotencyCtx = { key, routeKey: routeKeyOf(route, req), requestHash: requestHashOf(req, null) };
  const replay = async (): Promise<HandlerResult | null> => {
    const prev = await deps.db.idempotencyKey.findFirst({ where: { userId, key } });
    if (!prev) return null;
    if (prev.routeKey !== idem.routeKey || prev.requestHash !== idem.requestHash) {
      throw new AppError('CONFLICT', 'Idempotency-Key này đã dùng cho một yêu cầu khác');
    }
    return { status: prev.responseStatus, body: prev.responseBody };
  };
  const before = await replay();
  if (before) return before;
  try {
    const result = await run(idem);
    // Handler quên ghi khoá thì gửi lại sẽ tạo bản thứ hai — chặn ngay ở đây (lỗi lắp ráp, không im lặng).
    if (!(await deps.db.idempotencyKey.findFirst({ where: { userId, key }, select: { key: true } }))) {
      throw new Error(`Đường ${idem.routeKey} khai idempotent 'new-org' nhưng không ghi khoá (recordNewOrgIdempotency)`);
    }
    return result;
  } catch (err) {
    // Hai yêu cầu cùng khoá chạy đồng thời: bên thua vấp đường dẫn trùng / khoá đã ghi → trả kết quả của bên thắng.
    const after = await replay();
    if (after) return after;
    throw err;
  }
}
