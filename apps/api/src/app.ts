import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { AppError } from './lib/errors';
import { authenticate, errorHandler, loadOrgContext, requestId } from './http/middleware';
import { buildOpenApi } from './http/openapi';
import type { AnyRoute, Deps } from './http/route';
import { authRoutes } from './modules/auth/routes';
import { orgRoutes } from './modules/orgs/routes';
import { catalogRoutes } from './modules/catalog/routes';
import { scheduleRoutes } from './modules/schedule/routes';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

export const ALL_ROUTES: AnyRoute[] = [...authRoutes, ...orgRoutes, ...catalogRoutes, ...scheduleRoutes];

export function createApp(deps: Deps, routes: AnyRoute[] = ALL_ROUTES) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(pinoHttp({ logger: deps.logger, customProps: (_req, res) => ({ requestId: res.locals.requestId }) }));
  app.use(helmet());
  const origins = deps.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins, credentials: false }));
  app.use(express.json({ limit: '100kb' }));

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: deps.env.AUTH_RATE_LIMIT_PER_MINUTE,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED', 'Thử quá nhiều lần, vui lòng đợi một phút')),
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
    handlers.push(async (req: Request, res: Response) => {
      const userId = route.scope === 'public' ? null : await authenticate(req, deps);
      const org =
        route.scope === 'org' && userId && route.permission
          ? await loadOrgContext(deps, userId, typeof req.params.orgId === "string" ? req.params.orgId : undefined, route.permission)
          : null;
      const run = () =>
        route.handler({
          req,
          deps,
          requestId: String(res.locals.requestId),
          body: route.body ? route.body.parse(req.body) : undefined,
          query: route.query ? route.query.parse(req.query) : undefined,
          params: route.params ? route.params.parse(req.params) : undefined,
          userId,
          org,
        });
      const result = route.idempotent && org && userId ? await runIdempotent(deps, req, org.id, userId, route, run) : await run();
      if (result.body === undefined) {
        res.status(result.status ?? 204).end();
      } else {
        res.status(result.status ?? 200).json(result.body);
      }
    });
    router[route.method](route.path, ...handlers);
  }
  app.use('/api/v1', router);

  app.use((_req, _res, next) => next(new AppError('NOT_FOUND', 'Không có đường API này')));
  app.use(errorHandler(deps));
  return app;
}

const IdemKeySchema = /^[A-Za-z0-9_-]{8,128}$/;

// Chống gửi trùng: máy khách gửi kèm header Idempotency-Key (mỗi lần bấm "Lưu" một khoá mới).
// Gửi lại cùng khoá + cùng nội dung → trả đúng kết quả lần đầu, không tạo bản ghi thứ hai.
async function runIdempotent(
  deps: Deps,
  req: Request,
  organizationId: string,
  userId: string,
  route: AnyRoute,
  run: () => Promise<{ status?: number; body?: unknown }>,
) {
  const key = req.header('idempotency-key');
  if (!key || !IdemKeySchema.test(key)) {
    throw new AppError('VALIDATION_FAILED', 'Thiếu hoặc sai header Idempotency-Key (8–128 ký tự chữ, số, - hoặc _)');
  }
  const routeKey = `${route.method} ${route.path}`;
  const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex');
  const pk = { organizationId_userId_key: { organizationId, userId, key } };
  try {
    // Dòng "đang xử lý" (status 0) giữ chỗ: yêu cầu trùng đến cùng lúc sẽ đụng khoá chính và bị từ chối.
    await deps.db.idempotencyKey.create({
      data: { organizationId, userId, key, routeKey, requestHash, responseStatus: 0, responseBody: {} },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    const prev = await deps.db.idempotencyKey.findUniqueOrThrow({ where: pk });
    if (prev.routeKey !== routeKey || prev.requestHash !== requestHash) {
      throw new AppError('CONFLICT', 'Idempotency-Key này đã dùng cho một yêu cầu khác');
    }
    if (prev.responseStatus === 0) {
      throw new AppError('CONFLICT', 'Yêu cầu giống hệt đang được xử lý, vui lòng đợi');
    }
    return { status: prev.responseStatus, body: prev.responseBody };
  }
  try {
    const result = await run();
    const status = result.status ?? (result.body === undefined ? 204 : 200);
    await deps.db.idempotencyKey.update({
      where: pk,
      data: { responseStatus: status, responseBody: (result.body ?? null) as Prisma.InputJsonValue },
    });
    return result;
  } catch (err) {
    // Thất bại thì nhả khoá để người dùng sửa rồi gửi lại được.
    await deps.db.idempotencyKey.delete({ where: pk });
    throw err;
  }
}
