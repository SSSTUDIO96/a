import './matchers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PORTAL_DENIED_MESSAGE, PORTAL_SESSION_INVALID_MESSAGE, type PortalMe } from '@makeup/shared';
import { PortalApp, REFRESH_AFTER_MS, readKeyFromHash } from './PortalApp';
import { makeMe } from './fixtures';

interface Reply {
  status: number;
  body?: unknown;
}
type Handler = Reply | ((call: Call) => Reply);
interface Call {
  method: string;
  path: string;
  url: string;
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
  body: unknown;
}

let calls: Call[] = [];

function installFetch(routes: Record<string, Handler>) {
  calls = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: Call = {
      method,
      url,
      path: url.replace('/api/v1/portal', ''),
      headers,
      credentials: init?.credentials,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const h = routes[`${method} ${call.path}`];
    if (!h) throw new Error(`Không có giả lập cho ${method} ${call.path}`);
    const r = typeof h === 'function' ? h(call) : h;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const DENIED = { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: PORTAL_DENIED_MESSAGE, details: { reason: 'PORTAL_DENIED' } } } };
const NO_SESSION = { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: PORTAL_SESSION_INVALID_MESSAGE } } };

function setHash(h: string) {
  window.history.replaceState(null, '', `/hv${h}`);
}

beforeEach(() => {
  setHash('');
  document.title = 'Trang học viên';
  document.head.querySelector('meta[name="apple-mobile-web-app-title"]')?.remove();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function typeDigits(user: ReturnType<typeof userEvent.setup>, digits: string) {
  await user.click(screen.getByLabelText('Số thứ 1 trong 4 số cuối'));
  await user.keyboard(digits);
}

describe('readKeyFromHash', () => {
  it('đọc #k=, trống/thiếu thì null', () => {
    expect(readKeyFromHash('#k=abc_DEF-123')).toBe('abc_DEF-123');
    expect(readKeyFromHash('')).toBeNull();
    expect(readKeyFromHash('#x=1')).toBeNull();
    expect(readKeyFromHash('#k=')).toBeNull();
  });
});

describe('PortalApp: vào bằng đường dẫn', () => {
  it('đã có phiên: vào thẳng trang, KHÔNG gọi POST /portal/session, xoá # khỏi địa chỉ', async () => {
    setHash('#k=chia-bi-mat');
    installFetch({ 'GET /me': { status: 200, body: makeMe() } });
    render(<PortalApp />);
    expect(await screen.findByRole('heading', { name: 'Chào Thảo' })).toBeInTheDocument();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /me']);
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('chia-bi-mat');
  });

  it('chưa có phiên + có chìa: hiện nhập 4 số; nhập đủ 4 số, mở → POST đúng thân, xoá #, gọi /me, vào trang', async () => {
    setHash('#k=chia-bi-mat');
    let meCalls = 0;
    installFetch({
      'GET /me': () => (meCalls++ === 0 ? NO_SESSION : { status: 200, body: makeMe() }),
      'POST /session': { status: 201, body: { ok: true } },
    });
    const user = userEvent.setup();
    render(<PortalApp />);
    expect(await screen.findByRole('heading', { name: 'Mở trang học viên' })).toBeInTheDocument();
    const open = screen.getByRole('button', { name: 'Mở trang của tôi' });
    expect(open).toBeDisabled();
    await typeDigits(user, '3321');
    expect(open).toBeEnabled();
    await user.click(open);
    expect(await screen.findByRole('heading', { name: 'Chào Thảo' })).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.path).toBe('/session');
    expect(post.body).toEqual({ key: 'chia-bi-mat', last4: '3321' });
    expect(window.location.hash).toBe('');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /me', 'POST /session', 'GET /me']);
  });

  it('dán 4 số vào một ô điền đủ cả 4 ô', async () => {
    setHash('#k=k1');
    installFetch({ 'GET /me': NO_SESSION });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Mở trang học viên' });
    await user.click(screen.getByLabelText('Số thứ 2 trong 4 số cuối'));
    await user.paste('9876');
    expect((screen.getByLabelText('Số thứ 1 trong 4 số cuối') as HTMLInputElement).value).toBe('9');
    expect((screen.getByLabelText('Số thứ 4 trong 4 số cuối') as HTMLInputElement).value).toBe('6');
    expect(screen.getByRole('button', { name: 'Mở trang của tôi' })).toBeEnabled();
  });

  it('sai 4 số: ĐÚNG MỘT lời chung PORTAL_DENIED_MESSAGE, xoá 4 ô, không có "còn N lần", không màn khoá riêng, có dòng nhắc cố định', async () => {
    setHash('#k=k1');
    installFetch({ 'GET /me': NO_SESSION, 'POST /session': DENIED });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Mở trang học viên' });
    await typeDigits(user, '5678');
    await user.click(screen.getByRole('button', { name: 'Mở trang của tôi' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(PORTAL_DENIED_MESSAGE);
    expect(screen.getAllByText(PORTAL_DENIED_MESSAGE)).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/còn\s+\d+\s+lần/i);
    expect(screen.queryByText(/Đường dẫn đã bị khoá/)).toBeNull();
    expect(screen.getByText(/Nhập sai nhiều lần, đường dẫn sẽ bị khoá/)).toBeInTheDocument();
    for (let i = 1; i <= 4; i++) expect((screen.getByLabelText(`Số thứ ${i} trong 4 số cuối`) as HTMLInputElement).value).toBe('');
    expect(window.location.hash).toBe('#k=k1'); // chưa mở được thì giữ chìa để nhập lại
  });

  it('mọi nguyên nhân hỏng (401) hiện CÙNG một lời: lời của máy chủ không được hiện, lời cố định mới hiện', async () => {
    setHash('#k=k1');
    installFetch({
      'GET /me': NO_SESSION,
      'POST /session': { status: 401, body: { error: { message: 'Đường dẫn đã bị khoá vì nhập sai 5 lần (lời lạ)', details: { reason: 'LOCKED' } } } },
    });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Mở trang học viên' });
    await typeDigits(user, '0000');
    await user.click(screen.getByRole('button', { name: 'Mở trang của tôi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(PORTAL_DENIED_MESSAGE);
    expect(document.body.textContent).not.toContain('lời lạ');
  });

  it('429: báo đợi một phút', async () => {
    setHash('#k=k1');
    installFetch({ 'GET /me': NO_SESSION, 'POST /session': { status: 429, body: {} } });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Mở trang học viên' });
    await typeDigits(user, '1111');
    await user.click(screen.getByRole('button', { name: 'Mở trang của tôi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Thử quá nhiều lần, vui lòng đợi một phút');
  });

  it('mở trong Zalo: dải vàng nhắc mở bằng trình duyệt, vẫn bấm được "Mở trang của tôi"', async () => {
    setHash('#k=k1');
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Zalo/23.1');
    installFetch({ 'GET /me': NO_SESSION });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Mở trang học viên' });
    expect(screen.getByTestId('zalo-warning')).toHaveTextContent('Mở bằng trình duyệt');
    await typeDigits(user, '1234');
    expect(screen.getByRole('button', { name: 'Mở trang của tôi' })).toBeEnabled();
  });

  it('không Zalo thì không có dải vàng; không có ô "Nhớ máy này"', async () => {
    setHash('#k=k1');
    installFetch({ 'GET /me': NO_SESSION });
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Mở trang học viên' });
    expect(screen.queryByTestId('zalo-warning')).toBeNull();
    expect(screen.queryByText(/Nhớ máy này/)).toBeNull();
  });
});

describe('PortalApp: chưa có phiên, mã chuyển máy, tạm đóng, mất mạng', () => {
  it('không chìa + 401: "Chưa có phiên"; nhập mã chuyển → POST /session/claim → vào trang', async () => {
    let meCalls = 0;
    installFetch({
      'GET /me': () => (meCalls++ === 0 ? NO_SESSION : { status: 200, body: makeMe() }),
      'POST /session/claim': { status: 201, body: { ok: true } },
    });
    const user = userEvent.setup();
    render(<PortalApp />);
    expect(await screen.findByText('Mở trang học viên bằng đường dẫn trung tâm gửi qua Zalo.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tôi có mã chuyển sang app' }));
    await user.type(screen.getByLabelText(/Mã chuyển sang app/), 'abcd-2345');
    await user.click(screen.getByRole('button', { name: 'Nhận trang trên app' }));
    expect(await screen.findByRole('heading', { name: 'Chào Thảo' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/session/claim')?.body).toEqual({ code: 'ABCD-2345' });
  });

  it('mã chuyển sai: cùng MỘT lời chung', async () => {
    installFetch({ 'GET /me': NO_SESSION, 'POST /session/claim': DENIED });
    const user = userEvent.setup();
    render(<PortalApp />);
    await user.click(await screen.findByRole('button', { name: 'Tôi có mã chuyển sang app' }));
    await user.type(screen.getByLabelText(/Mã chuyển sang app/), 'XXXXXXXX');
    await user.click(screen.getByRole('button', { name: 'Nhận trang trên app' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(PORTAL_DENIED_MESSAGE);
  });

  it('403: trang tạm đóng', async () => {
    installFetch({ 'GET /me': { status: 403, body: {} } });
    render(<PortalApp />);
    expect(await screen.findByRole('heading', { name: 'Trang tạm đóng' })).toBeInTheDocument();
  });

  it('mất mạng: màn "Chưa tải được trang" + Thử lại gọi lại /me', async () => {
    const fn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fn);
    const user = userEvent.setup();
    render(<PortalApp />);
    expect(await screen.findByRole('heading', { name: 'Chưa tải được trang' })).toBeInTheDocument();
    installFetch({ 'GET /me': { status: 200, body: makeMe() } });
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('heading', { name: 'Chào Thảo' })).toBeInTheDocument();
  });
});

describe('PortalApp: trang chính', () => {
  it('đặt tên trung tâm lên tiêu đề tab và apple-mobile-web-app-title', async () => {
    installFetch({ 'GET /me': { status: 200, body: makeMe() } });
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Chào Thảo' });
    expect(document.title).toBe('Chiến Makeup Academy');
    expect(document.head.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')).toBe('Chiến Makeup Academy');
  });

  it('mọi lệnh fetch: /api/v1/portal/…, X-Client: portal, credentials same-origin, KHÔNG có Authorization', async () => {
    setHash('#k=k1');
    let meCalls = 0;
    installFetch({
      'GET /me': () => (meCalls++ === 0 ? NO_SESSION : { status: 200, body: makeMe() }),
      'POST /session': { status: 201, body: { ok: true } },
      'POST /session/handoff': { status: 201, body: { code: 'ABCD-EFGH', expiresAt: '2026-11-10T10:10:00.000Z' } },
      'DELETE /session': { status: 204 },
    });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Mở trang học viên' });
    await typeDigits(user, '3321');
    await user.click(screen.getByRole('button', { name: 'Mở trang của tôi' }));
    await screen.findByRole('heading', { name: 'Chào Thảo' });
    await user.click(screen.getByRole('button', { name: 'Lấy mã chuyển sang app' }));
    await screen.findByText('ABCD-EFGH');
    await user.click(screen.getByRole('button', { name: 'Thoát khỏi máy này' }));
    const dlg = screen.getByRole('alertdialog');
    await user.click(within(dlg).getByRole('button', { name: 'Thoát khỏi máy này' }));
    await screen.findByText('Đã thoát khỏi máy này.');
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const c of calls) {
      expect(c.url.startsWith('/api/v1/portal/')).toBe(true);
      expect(c.headers['X-Client']).toBe('portal');
      expect(c.credentials).toBe('same-origin');
      expect(Object.keys(c.headers).map((k) => k.toLowerCase())).not.toContain('authorization');
      expect(c.url).not.toContain('/auth');
    }
  });

  it('không lưu gì vào localStorage / sessionStorage (thẻ là cookie HttpOnly do máy chủ đặt)', async () => {
    setHash('#k=chia-bi-mat');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    installFetch({ 'GET /me': { status: 200, body: makeMe() } });
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Chào Thảo' });
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('thoát khỏi máy này: hỏi lại; "Ở lại" không gọi gì; xác nhận → DELETE /session → "Chưa có phiên" + "Đã thoát khỏi máy này."', async () => {
    installFetch({ 'GET /me': { status: 200, body: makeMe() }, 'DELETE /session': { status: 204 } });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Chào Thảo' });
    expect(screen.getByText(/Đang mở trên iPhone · Safari/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thoát khỏi máy này' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Ở lại' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Thoát khỏi máy này' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Thoát khỏi máy này' }));
    expect(await screen.findByTestId('notice')).toHaveTextContent('Đã thoát khỏi máy này.');
    expect(screen.getByText('Mở trang học viên bằng đường dẫn trung tâm gửi qua Zalo.')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  });

  it('lấy mã chuyển sang app: hiện mã; 401 → về "Chưa có phiên"', async () => {
    installFetch({ 'GET /me': { status: 200, body: makeMe() }, 'POST /session/handoff': NO_SESSION });
    const user = userEvent.setup();
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Chào Thảo' });
    await user.click(screen.getByRole('button', { name: 'Lấy mã chuyển sang app' }));
    expect(await screen.findByTestId('notice')).toHaveTextContent(PORTAL_SESSION_INVALID_MESSAGE);
  });

  it('quay lại trang sau ≥ 8 phút: tải lại /me; chưa đủ 8 phút thì không', async () => {
    let n = 0;
    installFetch({ 'GET /me': () => ({ status: 200, body: makeMe({ student: { fullName: 'Tôn Nữ Phương Thảo', callName: n++ === 0 ? 'Thảo' : 'Thảo Mới', avatarUrl: null } }) }) });
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Chào Thảo' });
    const t0 = Date.now();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(t0 + REFRESH_AFTER_MS - 60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(calls.filter((c) => c.path === '/me')).toHaveLength(1);
    now.mockReturnValue(t0 + REFRESH_AFTER_MS + 1000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByRole('heading', { name: 'Chào Thảo Mới' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/me')).toHaveLength(2);
  });

  it('tải lại nền gặp 401: về "Chưa có phiên" kèm lời phiên đã hết', async () => {
    let n = 0;
    installFetch({ 'GET /me': () => (n++ === 0 ? { status: 200, body: makeMe() } : NO_SESSION) });
    render(<PortalApp />);
    await screen.findByRole('heading', { name: 'Chào Thảo' });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + REFRESH_AFTER_MS + 1000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByTestId('notice')).toHaveTextContent(PORTAL_SESSION_INVALID_MESSAGE);
  });
});

export type { PortalMe };
