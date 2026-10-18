import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation, type RouteObject } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from '../api/auth';
import { api, hasAccessToken } from '../api/client';
import { ApiError } from '../api/errors';
import { RequireAuth } from './guards';
import { retryAfterSeconds, SessionProvider, useSession } from './session';

// Khôi phục phiên lúc tải trang: máy chủ giả lập qua fetch (/auth/refresh, /auth/me), router + cửa gác thật.
// refreshSession mặc định gọi bản thật (đi qua client.ts → fetch); vài bài thay bằng lỗi dựng sẵn.
vi.mock('../api/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/auth')>();
  return { ...real, refreshSession: vi.fn(real.refreshSession) };
});

const ME = { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Thị Hoa', organizations: [] };

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const RATE_LIMITED = { error: { code: 'RATE_LIMITED', message: 'Thử quá nhiều lần, vui lòng đợi một phút', requestId: 'r-429' } };
const UNAUTH = { error: { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập', requestId: 'r-401' } };

type RefreshReply = () => Response;
let refreshReplies: RefreshReply[] = [];
let refreshCalls = 0;

function setupServer(...replies: RefreshReply[]) {
  refreshReplies = replies;
  refreshCalls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        const reply = refreshReplies[Math.min(refreshCalls, refreshReplies.length - 1)] ?? ok;
        refreshCalls += 1;
        return reply();
      }
      if (url.endsWith('/auth/me')) return json(200, ME);
      return json(404, { error: { code: 'NOT_FOUND', message: 'Không có đường API này', requestId: 'r' } });
    }),
  );
}

const ok: RefreshReply = () => json(200, { accessToken: 'tok', expiresIn: 900 });
const busy =
  (headers: Record<string, string> = {}): RefreshReply =>
  () =>
    json(429, RATE_LIMITED, headers);
const unauth: RefreshReply = () => json(401, UNAUTH);

function Inside() {
  const { user } = useSession();
  return <p>Trang trong của {user?.fullName}</p>;
}

const testRoutes: RouteObject[] = [
  {
    element: (
      <SessionProvider>
        <RequireAuthOutlet />
      </SessionProvider>
    ),
    children: [
      { index: true, element: <Inside /> },
      { path: 'dang-nhap', element: <p>Trang đăng nhập</p> },
    ],
  },
];

function RequireAuthOutlet() {
  const { pathname } = useLocation();
  if (pathname === '/dang-nhap') return <Outlet />;
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

function renderApp() {
  const router = createMemoryRouter(testRoutes, { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);
  return router;
}

// Fake timers: không dùng findBy/waitFor (chúng chờ bằng setTimeout giả) — tự đẩy thời gian và vi nhiệm.
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(auth.refreshSession).mockClear();
});

describe('khôi phục phiên: 401 vẫn là chưa đăng nhập', () => {
  it('401 → về trang đăng nhập, không có dải bận', async () => {
    setupServer(unauth);
    const router = renderApp();
    await settle();
    expect(router.state.location.pathname).toBe('/dang-nhap');
    expect(screen.getByText('Trang đăng nhập')).toBeTruthy();
    expect(screen.queryByText(/Máy chủ đang bận/)).toBeNull();
  });

  it('200 → vào trang trong', async () => {
    setupServer(ok);
    const router = renderApp();
    await settle();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByText('Trang trong của Nguyễn Thị Hoa')).toBeTruthy();
  });
});

describe('khôi phục phiên: 429 là lỗi tạm thời, không phải chưa đăng nhập', () => {
  it('429 không kèm Retry-After → ở lại trang, báo bận 60 giây, không xoá phiên, tự thử lại đúng một lần sau 60 giây', async () => {
    setupServer(busy(), ok);
    const router = renderApp();
    await settle();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Trang đăng nhập')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Máy chủ đang bận, thử lại sau 60 giây');
    expect(refreshCalls).toBe(1);

    await settle(3_000);
    expect(screen.getByRole('status').textContent).toContain('thử lại sau 57 giây');

    await settle(56_000);
    expect(refreshCalls).toBe(1);

    await settle(1_000);
    expect(refreshCalls).toBe(2);
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByText('Trang trong của Nguyễn Thị Hoa')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(hasAccessToken()).toBe(true);
  });

  it('lỗi 429 mang retryAfterSeconds → chờ đúng số giây đó', async () => {
    setupServer(ok);
    vi.mocked(auth.refreshSession).mockRejectedValueOnce(
      Object.assign(new ApiError('RATE_LIMITED', 'Thử quá nhiều lần', 429, 'r'), { retryAfterSeconds: 7 }),
    );
    const router = renderApp();
    await settle();
    expect(screen.getByRole('status').textContent).toContain('Máy chủ đang bận, thử lại sau 7 giây');
    await settle(6_000);
    expect(vi.mocked(auth.refreshSession)).toHaveBeenCalledTimes(1);
    await settle(1_000);
    expect(vi.mocked(auth.refreshSession)).toHaveBeenCalledTimes(2);
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByText('Trang trong của Nguyễn Thị Hoa')).toBeTruthy();
  });

  it('429 hai lần → chỉ tự thử lại một lần, rồi chờ người dùng bấm "Thử lại"; vẫn không về đăng nhập', async () => {
    setupServer(busy(), busy(), ok);
    const router = renderApp();
    await settle();
    await settle(60_000);
    expect(refreshCalls).toBe(2);
    expect(screen.getByRole('status').textContent).toContain('Máy chủ vẫn đang bận');

    await settle(10 * 60_000);
    expect(refreshCalls).toBe(2);
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Trang đăng nhập')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await settle();
    expect(refreshCalls).toBe(3);
    expect(screen.getByText('Trang trong của Nguyễn Thị Hoa')).toBeTruthy();
  });

  it('429 rồi 401 → lúc đó mới là chưa đăng nhập', async () => {
    setupServer(busy(), unauth);
    const router = renderApp();
    await settle();
    expect(router.state.location.pathname).toBe('/');
    await settle(60_000);
    expect(router.state.location.pathname).toBe('/dang-nhap');
  });

  // Đọc header Retry-After cần client.ts gắn số giây vào ApiError (retryAfterSeconds) — phiếu vướng gửi thợ L.
  // Bài tự chạy khi ApiError có trường đó.
  it.skipIf(!('retryAfterSeconds' in new ApiError('X', 'x', 429, null)))(
    'header Retry-After: 12 đi qua client.ts → báo bận 12 giây',
    async () => {
      setupServer(busy({ 'Retry-After': '12' }), ok);
      renderApp();
      await settle();
      expect(screen.getByRole('status').textContent).toContain('thử lại sau 12 giây');
    },
  );
});

// Biên bản N-M1 (M-d): 429 khi refresh GIỮA phiên (thẻ hết hạn lúc đang dùng) không phải hết phiên.
// Xử lý như lúc khôi phục: giữ phiên, báo bận, tự refresh lại theo Retry-After (một lần), rồi chờ người dùng bấm.
describe('refresh giữa phiên gặp 429', () => {
  // Máy chủ: /viec chỉ nhận thẻ mới nhất; refresh trả lần lượt theo `replies` (thẻ tok-1, tok-2…).
  function setupMidSession(...replies: RefreshReply[]) {
    let latest = '';
    setupServer(...replies);
    const realFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) {
          const res = await realFetch(input, init);
          if (res.ok) latest = `tok-${refreshCalls}`;
          return res.ok ? json(200, { accessToken: latest, expiresIn: 900 }) : res;
        }
        if (url.endsWith('/viec')) {
          const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
          return auth === `Bearer ${latest}` ? json(200, { ok: true }) : json(401, UNAUTH);
        }
        return realFetch(input, init);
      }),
    );
    return { expireToken: () => (latest = 'het-han') };
  }

  async function callApi() {
    let result: unknown;
    await act(async () => {
      result = await api.get('/viec').then(
        (v) => v,
        (e: unknown) => e,
      );
    });
    return result;
  }

  it('thẻ hết hạn, refresh trả 429 (Retry-After: 12) → ở lại trang, giữ phiên, báo bận 12 giây; hết giờ tự refresh lại và gọi API được', async () => {
    const server = setupMidSession(ok, busy({ 'Retry-After': '12' }), ok);
    const router = renderApp();
    await settle();
    expect(screen.getByText('Trang trong của Nguyễn Thị Hoa')).toBeTruthy();
    expect(await callApi()).toEqual({ ok: true });

    server.expireToken();
    const err = await callApi();
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(429);
    await settle();
    expect(refreshCalls).toBe(2);
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('Trang đăng nhập')).toBeNull();
    expect(screen.getByText('Trang trong của Nguyễn Thị Hoa')).toBeTruthy();
    expect(hasAccessToken()).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Máy chủ đang bận, thử lại sau 12 giây');

    await settle(11_000);
    expect(refreshCalls).toBe(2);
    await settle(1_000);
    expect(refreshCalls).toBe(3);
    expect(screen.queryByRole('status')).toBeNull();
    expect(router.state.location.pathname).toBe('/');
    expect(await callApi()).toEqual({ ok: true });
  });

  it('429 hai lần giữa phiên → tự thử lại đúng một lần, rồi chờ bấm "Thử lại"; vẫn không về đăng nhập', async () => {
    const server = setupMidSession(ok, busy({ 'Retry-After': '5' }), busy({ 'Retry-After': '5' }), ok);
    const router = renderApp();
    await settle();
    server.expireToken();
    await callApi();
    await settle(5_000);
    expect(refreshCalls).toBe(3);
    expect(screen.getByRole('status').textContent).toContain('Máy chủ vẫn đang bận');
    await settle(10 * 60_000);
    expect(refreshCalls).toBe(3);
    expect(router.state.location.pathname).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await settle();
    expect(refreshCalls).toBe(4);
    expect(screen.queryByRole('status')).toBeNull();
    expect(await callApi()).toEqual({ ok: true });
  });

  it('429 rồi lần tự thử lại bị 401 → lúc đó mới là hết phiên: về trang đăng nhập, xoá thẻ', async () => {
    const server = setupMidSession(ok, busy({ 'Retry-After': '5' }), unauth);
    const router = renderApp();
    await settle();
    server.expireToken();
    await callApi();
    await settle();
    expect(router.state.location.pathname).toBe('/');
    await settle(5_000);
    expect(router.state.location.pathname).toBe('/dang-nhap');
    expect(hasAccessToken()).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('retryAfterSeconds', () => {
  const e429 = (extra: object = {}) => Object.assign(new ApiError('RATE_LIMITED', 'm', 429, null), extra);
  it('thiếu hoặc hỏng → 60 giây (cửa sổ đếm của máy chủ)', () => {
    expect(retryAfterSeconds(e429())).toBe(60);
    expect(retryAfterSeconds(e429({ retryAfterSeconds: null }))).toBe(60);
    expect(retryAfterSeconds(e429({ retryAfterSeconds: Number.NaN }))).toBe(60);
    expect(retryAfterSeconds(e429({ retryAfterSeconds: -5 }))).toBe(60);
    expect(retryAfterSeconds(new Error('x'))).toBe(60);
  });
  it('làm tròn lên, kẹp trong 1…300 giây', () => {
    expect(retryAfterSeconds(e429({ retryAfterSeconds: 7 }))).toBe(7);
    expect(retryAfterSeconds(e429({ retryAfterSeconds: 2.1 }))).toBe(3);
    expect(retryAfterSeconds(e429({ retryAfterSeconds: 0 }))).toBe(1);
    expect(retryAfterSeconds(e429({ retryAfterSeconds: 86_400 }))).toBe(300);
  });
});
