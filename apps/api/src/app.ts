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

export const ALL_ROUTES: AnyRoute[] = [...authRoutes, ...orgRoutes];

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
      const result = await route.handler({
        req,
        deps,
        requestId: String(res.locals.requestId),
        body: route.body ? route.body.parse(req.body) : undefined,
        query: route.query ? route.query.parse(req.query) : undefined,
        params: route.params ? route.params.parse(req.params) : undefined,
        userId,
        org,
      });
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
