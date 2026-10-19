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

describe('auth.ts — đặt lại mật khẩu', () => {
  it('yêu cầu đặt lại: POST đúng đường, thân chỉ có email, không gửi Authorization', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return json(202, { message: 'Nếu email này có tài khoản…' });
      }),
    );
    const m = await fresh();
    await expect(m.requestPasswordReset('a@b.vn')).resolves.toEqual({ message: 'Nếu email này có tài khoản…' });
    expect(calls[0]?.url).toBe('/api/v1/auth/password-reset/request');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ email: 'a@b.vn' });
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('đặt mật khẩu mới: 204 → bỏ access token trong bộ nhớ (máy chủ đã thu hồi mọi phiên); thẻ hỏng → nhận ra RESET_TOKEN_INVALID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/auth/login')) return json(200, { user: { id: 'u', email: 'a@b.vn', fullName: 'A' }, accessToken: 'tok', expiresIn: 900 });
        const body = JSON.parse(String(init?.body)) as { token: string };
        if (body.token === 'the-hong-xxxxxxxxxxxxxxxx') {
          return json(400, { error: { code: 'VALIDATION_FAILED', message: 'Đường dẫn… hết hạn', details: { reason: 'RESET_TOKEN_INVALID' }, requestId: 'r' } });
        }
        return new Response(null, { status: 204 });
      }),
    );
    const m = await fresh();
    await m.login('a@b.vn', 'mat-khau-dai-du');
    expect(m.hasAccessToken()).toBe(true);
    await m.confirmPasswordReset('the-dung-xxxxxxxxxxxxxxxx', 'mat-khau-moi-456');
    expect(m.hasAccessToken()).toBe(false);
    const err = await m.confirmPasswordReset('the-hong-xxxxxxxxxxxxxxxx', 'mat-khau-moi-456').catch((e: unknown) => e);
    expect(m.isResetTokenInvalid(err)).toBe(true);
    expect(m.isResetTokenInvalid(new Error('khác'))).toBe(false);
  });
});
