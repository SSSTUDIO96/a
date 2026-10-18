import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ClientModule = typeof import('./client');
type ErrorsModule = typeof import('./errors');

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  credentials: RequestCredentials | undefined;
}

const calls: Call[] = [];

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function unauth(message = 'Chưa đăng nhập'): Response {
  return json(401, { error: { code: 'UNAUTHENTICATED', message, requestId: 'req-401' } });
}

// Máy chủ giả: chỉ chấp nhận thẻ "tok-moi"; refresh trả "tok-moi" (hoặc theo hàm refresh tuỳ bài).
function installServer(opts: { refresh?: () => Promise<Response> | Response; delayRefreshMs?: number } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = { ...(init?.headers as Record<string, string> | undefined) };
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : undefined;
    calls.push({ url, method: init?.method ?? 'GET', headers, body, credentials: init?.credentials });
    if (url === '/api/v1/auth/refresh') {
      if (opts.delayRefreshMs) await new Promise((r) => setTimeout(r, opts.delayRefreshMs));
      return opts.refresh ? opts.refresh() : json(200, { accessToken: 'tok-moi', expiresIn: 900 });
    }
    if (headers.Authorization !== 'Bearer tok-moi') return unauth();
    return json(url.startsWith('/api/v1/orgs') && init?.method === 'POST' ? 201 : 200, { ok: true, url });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// Mỗi bài một bản module mới: thẻ trong bộ nhớ và hàng đợi refresh không lây sang bài khác.
async function freshApi(): Promise<ClientModule & ErrorsModule & { newIdempotencyKey: () => string }> {
  vi.resetModules();
  const [client, errors, idem] = await Promise.all([import('./client'), import('./errors'), import('./idempotency')]);
  return { ...client, ...errors, newIdempotencyKey: idem.newIdempotencyKey };
}

const refreshCalls = () => calls.filter((c) => c.url === '/api/v1/auth/refresh');

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('refresh khi gặp 401', () => {
  it('nhiều yêu cầu cùng 401 thì chỉ refresh MỘT lần, rồi tất cả gửi lại với thẻ mới', async () => {
    installServer({ delayRefreshMs: 20 });
    const { api } = await freshApi();
    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c'), api.get('/d')]);
    expect(results).toHaveLength(4);
    expect(refreshCalls()).toHaveLength(1);
    const r = refreshCalls()[0];
    expect(r?.method).toBe('POST');
    expect(r?.body).toBe('{}');
    expect(r?.headers['X-Client']).toBe('web');
    expect(r?.credentials).toBe('same-origin');
    const retried = calls.filter((c) => c.headers.Authorization === 'Bearer tok-moi');
    expect(retried.map((c) => c.url).sort()).toEqual(['/api/v1/a', '/api/v1/b', '/api/v1/c', '/api/v1/d']);
  });

  it('yêu cầu mới đến lúc đang refresh thì chờ refresh xong, không tự refresh thêm', async () => {
    installServer({ delayRefreshMs: 30 });
    const { api } = await freshApi();
    const first = api.get('/a');
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    const second = api.get('/b');
    await Promise.all([first, second]);
    expect(refreshCalls()).toHaveLength(1);
    // /b chỉ gửi một lần, và gửi với thẻ mới.
    expect(calls.filter((c) => c.url === '/api/v1/b').map((c) => c.headers.Authorization)).toEqual(['Bearer tok-moi']);
  });

  it('mọi yêu cầu luôn có X-Client: web và credentials same-origin', async () => {
    installServer();
    const { api } = await freshApi();
    await api.get('/x');
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.headers['X-Client']).toBe('web');
      expect(c.credentials).toBe('same-origin');
    }
  });

  it('refresh bị từ chối → xoá phiên, gọi hàm hết phiên ĐÚNG một lần, ném ApiError', async () => {
    installServer({ refresh: () => unauth('Phiên đăng nhập đã hết hạn'), delayRefreshMs: 10 });
    const { api, setSessionExpiredHandler, hasAccessToken, ApiError } = await freshApi();
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    const results = await Promise.allSettled([api.get('/a'), api.get('/b')]);
    expect(refreshCalls()).toHaveLength(1);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(hasAccessToken()).toBe(false);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ApiError);
        expect(r.reason).toMatchObject({ code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập đã hết hạn', status: 401 });
      }
    }
  });

  it('refresh lỗi mạng → báo NETWORK, KHÔNG xoá phiên (mất mạng không phải hết phiên)', async () => {
    installServer({
      refresh: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const { api, setSessionExpiredHandler } = await freshApi();
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    await expect(api.get('/a')).rejects.toMatchObject({ code: 'NETWORK' });
    expect(expired).not.toHaveBeenCalled();
  });

  it('khôi phục phiên lúc tải trang (expireOnFailure=false) thất bại thì không gọi hàm hết phiên', async () => {
    installServer({ refresh: () => unauth() });
    const { refreshSession, setSessionExpiredHandler } = await freshApi();
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    await expect(refreshSession(false)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(expired).not.toHaveBeenCalled();
  });

  it('đường auth:false (đăng nhập) gặp 401 thì trả lỗi thật, không refresh', async () => {
    installServer();
    const { api } = await freshApi();
    await expect(api.post('/auth/login', { email: 'a@b.vn', password: 'x' }, { auth: false })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    expect(refreshCalls()).toHaveLength(0);
  });

  it('không đụng localStorage/sessionStorage khi giữ thẻ', async () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    installServer();
    const { api } = await freshApi();
    await api.get('/a');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});

describe('Idempotency-Key', () => {
  it('giữ nguyên khoá khi tự gửi lại sau refresh', async () => {
    installServer();
    const { api, newIdempotencyKey } = await freshApi();
    const key = newIdempotencyKey();
    await api.create('/orgs', { name: 'Hoa' }, key);
    const sends = calls.filter((c) => c.url === '/api/v1/orgs');
    expect(sends).toHaveLength(2);
    expect(sends.map((c) => c.headers['Idempotency-Key'])).toEqual([key, key]);
    expect(sends[0]?.body).toBe(sends[1]?.body);
  });

  it('mỗi lần bấm một khoá mới, đúng dạng máy chủ nhận (8–128 ký tự chữ, số, -, _)', async () => {
    const { newIdempotencyKey } = await freshApi();
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });

  it('GET và đăng nhập không gửi Idempotency-Key', async () => {
    installServer();
    const { api } = await freshApi();
    await api.get('/a');
    await api.post('/auth/login', {}, { auth: false }).catch(() => undefined);
    for (const c of calls) expect(c.headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('ApiError', () => {
  it('giữ nguyên code, message, requestId, details từ máy chủ', async () => {
    const details = { fieldErrors: { slug: ['Đường dẫn chỉ gồm chữ thường'] } };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(400, { error: { code: 'VALIDATION_FAILED', message: 'Dữ liệu gửi lên không hợp lệ', details, requestId: 'req-123' } }),
      ),
    );
    const { api, ApiError } = await freshApi();
    const err: unknown = await api.post('/x', {}, { auth: false }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Dữ liệu gửi lên không hợp lệ',
      requestId: 'req-123',
      status: 400,
      details,
    });
  });

  it('lỗi mạng → ApiError code NETWORK, lời tiếng Việt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const { api, ApiError } = await freshApi();
    const err: unknown = await api.get('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'NETWORK', status: 0 });
    expect((err as Error).message).toContain('Không kết nối được máy chủ');
  });

  it('trang lỗi không phải JSON (vd 502 của proxy) → ApiError HTTP_502, lấy requestId từ header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502, headers: { 'x-request-id': 'req-hdr' } })));
    const { api } = await freshApi();
    await expect(api.post('/x', {}, { auth: false })).rejects.toMatchObject({ code: 'HTTP_502', status: 502, requestId: 'req-hdr' });
  });

  it('huỷ yêu cầu thì giữ nguyên lỗi huỷ, không đổi thành lỗi mạng', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('Đã huỷ', 'AbortError');
      }),
    );
    const { api } = await freshApi();
    await expect(api.get('/x')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('204 trả undefined', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const { api } = await freshApi();
    await expect(api.post('/auth/logout', {}, { auth: false })).resolves.toBeUndefined();
  });
});
