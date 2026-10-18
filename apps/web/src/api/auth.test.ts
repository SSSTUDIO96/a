import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fresh() {
  vi.resetModules();
  const [auth, client] = await Promise.all([import('./auth'), import('./client')]);
  return { ...auth, hasAccessToken: client.hasAccessToken };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('auth.ts', () => {
  it('đăng nhập giữ access token trong bộ nhớ; đăng xuất xoá', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/auth/login')
          ? json(200, { user: { id: 'u', email: 'a@b.vn', fullName: 'A' }, accessToken: 'tok', expiresIn: 900 })
          : new Response(null, { status: 204 }),
      ),
    );
    const { login, logout, hasAccessToken } = await fresh();
    await login('a@b.vn', 'mat-khau-dai-du');
    expect(hasAccessToken()).toBe(true);
    await logout();
    expect(hasAccessToken()).toBe(false);
  });

  it('đăng xuất: máy chủ báo phiên đã hết (401) coi như xong; mất mạng thì ném lỗi, không giả vờ thành công', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { error: { code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập không hợp lệ', requestId: 'r' } })));
    let m = await fresh();
    await expect(m.logout()).resolves.toBeUndefined();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    m = await fresh();
    await expect(m.logout()).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
