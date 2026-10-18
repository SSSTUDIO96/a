import { z } from 'zod';
import type { AnyRoute } from './route';

// Tài liệu OpenAPI sinh thẳng từ bảng đường API — không có bản viết tay để lệch khỏi mã.
export function buildOpenApi(routes: AnyRoute[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const path = `/api/v1${r.path.replace(/:([A-Za-z]+)/g, '{$1}')}`;
    const params = [...r.path.matchAll(/:([A-Za-z]+)/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const op: Record<string, unknown> = {
      summary: r.summary,
      tags: [r.tag],
      parameters: params,
      'x-permission': r.permission ?? null,
      security: r.scope === 'public' ? [] : [{ bearer: [] }],
      responses: { default: { description: 'Xem schema ErrorResponse khi lỗi' } },
    };
    if (r.body) {
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: z.toJSONSchema(r.body, { io: 'input', unrepresentable: 'any' }) } },
      };
    }
    if (r.query) {
      op['x-query-schema'] = z.toJSONSchema(r.query, { io: 'input', unrepresentable: 'any' });
    }
    paths[path] = { ...(paths[path] ?? {}), [r.method]: op };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Makeup Pro API', version: '0.1.0' },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths,
  };
}
