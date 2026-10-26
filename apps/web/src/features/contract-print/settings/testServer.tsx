import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../../../app/routes';
import type { BrandProfileResult, PrintTemplateView } from '../../../api/types';
import { PROFILE_FULL, T, tpl } from './fixtures';

export * from './fixtures';

// Máy chủ giả (fetch) cho bài thử màn Cài đặt › Mẫu in hợp đồng. Chỉ dùng trong *.test.tsx của thư mục này.
export interface Call {
  method: string;
  path: string;
  query: string;
  body: unknown;
  headers: Record<string, string>;
}
export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const apiErr = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

export type Kind = 'ACADEMY' | 'TEAM' | 'INDIVIDUAL';
export interface ServerOpts {
  kind?: Kind;
  templates?: PrintTemplateView[];
  profile?: BrandProfileResult;
  post?: (body: unknown, headers: Record<string, string>) => Response;
  patch?: (id: string, body: unknown) => Response;
  putInfo?: (body: unknown) => Response;
}

export function setupServer(permissions: readonly string[], opts: ServerOpts = {}) {
  const kind = opts.kind ?? 'ACADEMY';
  const templates = opts.templates ?? [];
  const org = { membershipId: 'm-1', id: 'org-1', name: 'Studio Hoa Đào', slug: 'hoa-dao', kind, roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => {
        headers[k] = v;
      });
      if (!path.startsWith('/auth')) calls.push({ method, path, query: url.search, body, headers });
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Chiến', organizations: [org] });
      if (path === '/orgs/org-1') return json(200, { ...org, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
      if (path === '/orgs/org-1/profile' && method === 'GET') return json(200, opts.profile ?? PROFILE_FULL);
      if (path === '/orgs/org-1/profile/contract-info' && method === 'PUT') {
        if (opts.putInfo) return opts.putInfo(body);
        const cur = (opts.profile ?? PROFILE_FULL) as { profile: object };
        return json(200, { hasProfile: true, profile: { ...cur.profile, ...(body as object) } });
      }
      if (path === '/orgs/org-1/print-templates' && method === 'GET') return json(200, { items: templates });
      if (path === '/orgs/org-1/print-templates' && method === 'POST') {
        if (opts.post) return opts.post(body, headers);
        return json(201, tpl({ id: 'new-1', name: (body as { name: string }).name, ...(body as object) } as Partial<PrintTemplateView> & { id: string; name: string }));
      }
      const m = /^\/orgs\/org-1\/print-templates\/([^/]+)$/.exec(path);
      if (m) {
        const found = templates.find((t) => t.id === m[1]);
        if (method === 'GET') return found ? json(200, found) : apiErr(404, 'NOT_FOUND', 'Không tìm thấy mẫu in');
        if (method === 'PATCH') {
          if (opts.patch) return opts.patch(m[1]!, body);
          if (!found) return apiErr(404, 'NOT_FOUND', 'Không tìm thấy mẫu in');
          const b = body as Record<string, unknown>;
          const bump = ['layout', 'blocks', 'title', 'openingText', 'closingText'].some((k) => k in b);
          return json(200, { ...found, ...b, version: found.version + (bump ? 1 : 0) });
        }
      }
      return apiErr(404, 'NOT_FOUND', `Không có đường ${method} ${path}`);
    }),
  );
  return calls;
}

export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

export type Viewport = 'phone' | 'tablet' | 'desktop';
export function setViewport(v: Viewport) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: (v === 'phone' && q === '(max-width: 640px)') || (v === 'tablet' && q === '(min-width: 641px) and (max-width: 1180px)'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

export const BASE = '/hoa-dao/cai-dat/mau-in';
