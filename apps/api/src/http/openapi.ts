import { z } from 'zod';
import type { AnyRoute } from './route';

// Đường quản trị nền tảng KHÔNG vào tài liệu công khai: người ngoài không được biết có những đường nào
// (biên bản máy chủ lát 2, lỗi M2). Lọc theo CẢ địa chỉ lẫn nhãn — đường dưới /platform/ khai nhầm scope vẫn bị bỏ
// (sổ lỗi mục 15: lọc theo nhãn thì đường khai nhầm nhãn lọt qua).
export function isPlatformRoute(r: Pick<AnyRoute, 'scope' | 'path'>): boolean {
  return r.scope === 'platform' || r.path === '/platform' || r.path.startsWith('/platform/');
}

// Tài liệu OpenAPI sinh thẳng từ bảng đường API — không có bản viết tay để lệch khỏi mã.
export function buildOpenApi(routes: AnyRoute[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    if (isPlatformRoute(r)) continue;
    const path = `/api/v1${r.path.replace(/:([A-Za-z]+)/g, '{$1}')}`;
    const params: Record<string, unknown>[] = [...r.path.matchAll(/:([A-Za-z]+)/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }));
    if (r.query) {
      const q = z.toJSONSchema(r.query, { io: 'input', unrepresentable: 'any' }) as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      for (const [name, schema] of Object.entries(q.properties ?? {})) {
        params.push({ name, in: 'query', required: q.required?.includes(name) ?? false, schema });
      }
    }
    if (r.idempotent) {
      // 'new-org' (tạo tổ chức): khoá TUỲ CHỌN — app cũ và bài thử tạo tổ chức không gửi khoá.
      params.push({ name: 'Idempotency-Key', in: 'header', required: r.idempotent === true, schema: { type: 'string', minLength: 8, maxLength: 128 } });
    }
    const op: Record<string, unknown> = {
      summary: r.summary,
      tags: [r.tag],
      parameters: params,
      'x-permission': r.permission ?? null,
      security: r.scope === 'public' ? [] : [{ bearer: [] }],
      responses: {
        default: {
          description: 'Lỗi',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    };
    if (r.body) {
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: z.toJSONSchema(r.body, { io: 'input', unrepresentable: 'any' }) } },
      };
    }
    paths[path] = { ...(paths[path] ?? {}), [r.method]: op };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Makeup Pro API', version: '0.1.0' },
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'requestId'],
              properties: {
                code: {
                  type: 'string',
                  enum: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'RATE_LIMITED', 'INTERNAL', 'NOT_CONFIGURED'],
                },
                message: { type: 'string' },
                details: {},
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    paths,
  };
}
