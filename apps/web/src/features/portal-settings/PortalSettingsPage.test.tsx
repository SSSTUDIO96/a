import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';
import { draftOf, groupAccountNo, normalizeAccountName, toInput, validateDraft } from './logic';

// Cài đặt → Cổng học viên (bản vẽ E 5.2) chạy thật trong khung, máy chủ giả qua fetch.
configure({ asyncUtilTimeout: 5000 });

const T = '2026-10-20T03:00:00.000Z';
interface Call {
  method: string;
  path: string;
  body: unknown;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

type Kind = 'ACADEMY' | 'TEAM';
const SAVED = { bankName: 'Vietcombank', bankAccountNo: '0123456789', bankAccountName: 'TON NU PHUONG THAO', updatedAt: T };
const EMPTY = { bankName: null, bankAccountNo: null, bankAccountName: null, updatedAt: null };

function setup(permissions: readonly string[], opts: { kind?: Kind; settings?: object; put?: (body: unknown) => Response } = {}) {
  const kind = opts.kind ?? 'ACADEMY';
  const org = { membershipId: 'm-1', id: 'org-1', name: 'Học viện', slug: 'chien', kind, roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      if (!path.startsWith('/auth')) calls.push({ method, path, body });
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Chiến', organizations: [org] });
      if (path === '/orgs/org-1') return json(200, { ...org, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
      if (path === '/orgs/org-1/portal-settings' && method === 'GET') return json(200, opts.settings ?? SAVED);
      if (path === '/orgs/org-1/portal-settings' && method === 'PUT') return opts.put ? opts.put(body) : json(200, { ...(body as object), updatedAt: T });
      return err(404, 'NOT_FOUND', `Không có đường ${method} ${path}`);
    }),
  );
  return calls;
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const OWNER = SYSTEM_ROLES.owner.permissions;
const READONLY = ['org.read'];
const puts = (calls: Call[]) => calls.filter((c) => c.method === 'PUT');
const gets = (calls: Call[]) => calls.filter((c) => c.path === '/orgs/org-1/portal-settings' && c.method === 'GET');
const PATH = '/chien/cai-dat/cong-hoc-vien';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cài đặt cổng học viên', () => {
  it('tổ chức không phải ACADEMY: "Tổ chức chưa bật đào tạo", không gọi cài đặt cổng', async () => {
    const calls = setup(OWNER, { kind: 'TEAM' });
    renderAt(PATH);
    expect(await screen.findByText('Tổ chức chưa bật đào tạo')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(gets(calls)).toHaveLength(0);
  });

  it('ACADEMY + org.update: ba dòng nhãn + ô, giải thích nằm trong tooltip "?" (không viết ra màn), có nút Lưu và khung xem trước', async () => {
    setup(OWNER);
    renderAt(PATH);
    const bank = (await screen.findByLabelText('Ngân hàng')) as HTMLInputElement;
    expect(bank.value).toBe('Vietcombank');
    expect((screen.getByLabelText('Số tài khoản') as HTMLInputElement).value).toBe('0123456789');
    expect((screen.getByLabelText('Chủ tài khoản') as HTMLInputElement).value).toBe('TON NU PHUONG THAO');
    // Giải thích không hiện sẵn trên màn.
    expect(screen.queryByRole('tooltip')).toBeNull();
    const tips = screen.getAllByRole('button', { name: 'Giải thích' });
    expect(tips).toHaveLength(3);
    await userEvent.click(tips[1]!);
    expect((await screen.findByRole('tooltip')).textContent).toMatch(/Khoảng trắng, dấu chấm và gạch/);
    expect((screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
    const prev = within(screen.getByRole('region', { name: 'Xem trước trang học viên' }));
    expect(prev.getByText('Cách đóng tiền')).toBeTruthy();
    expect(prev.getByText('0123 4567 89')).toBeTruthy();
    expect(prev.getByText('HDKH-000042 Phuong Thao')).toBeTruthy();
  });

  it('sửa và lưu: PUT đủ ba khoá, số tài khoản bỏ khoảng trắng/chấm/gạch, tên chủ tài khoản chữ hoa không dấu; báo "Đã lưu."', async () => {
    const calls = setup(OWNER, { settings: EMPTY });
    renderAt(PATH);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Ngân hàng'), ' Techcombank ');
    await user.type(screen.getByLabelText('Số tài khoản'), '1903 4567-89.01');
    await user.type(screen.getByLabelText('Chủ tài khoản'), 'Tôn Nữ  Phương Thảo');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]!.path).toBe('/orgs/org-1/portal-settings');
    expect(puts(calls)[0]!.body).toEqual({ bankName: 'Techcombank', bankAccountNo: '190345678901', bankAccountName: 'TON NU PHUONG THAO' });
    expect(await screen.findByText('Đã lưu.')).toBeTruthy();
  });

  it('xoá trắng cả ba rồi lưu → PUT null cả ba (cổng không hiện thẻ)', async () => {
    const calls = setup(OWNER);
    renderAt(PATH);
    const user = userEvent.setup();
    for (const l of ['Ngân hàng', 'Số tài khoản', 'Chủ tài khoản']) await user.clear(await screen.findByLabelText(l));
    expect(within(screen.getByRole('region', { name: 'Xem trước trang học viên' })).getByText(/không hiện thẻ "Cách đóng tiền"/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]!.body).toEqual({ bankName: null, bankAccountNo: null, bankAccountName: null });
  });

  it('chỉ điền một hoặc hai ô → không gửi, ô còn trống báo lỗi; số tài khoản ngắn → lỗi ô đó', async () => {
    const calls = setup(OWNER, { settings: EMPTY });
    renderAt(PATH);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Ngân hàng'), 'Vietcombank');
    await user.type(screen.getByLabelText('Số tài khoản'), '123');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Số tài khoản chỉ gồm 6 đến 20 chữ số')).toBeTruthy();
    expect(screen.getByText('Điền ô này, hoặc để trống cả ba ô.')).toBeTruthy();
    expect(puts(calls)).toHaveLength(0);
  });

  it('máy chủ trả 400 lệch ba ô (lỗi chung) → hiện lời máy chủ, dữ liệu đã nhập còn nguyên', async () => {
    setup(OWNER, {
      put: () => err(400, 'VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', { formErrors: [], fieldErrors: {}, issues: [{ path: '', message: 'Điền đủ ngân hàng, số tài khoản, chủ tài khoản — hoặc để trống cả ba' }] }),
    });
    renderAt(PATH);
    const user = userEvent.setup();
    const bank = (await screen.findByLabelText('Ngân hàng')) as HTMLInputElement;
    await user.type(bank, ' A');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Điền đủ ngân hàng, số tài khoản, chủ tài khoản — hoặc để trống cả ba')).toBeTruthy();
    expect(bank.value).toBe('Vietcombank A');
  });

  it('máy chủ trả 403 (thiếu quyền) → hiện lời máy chủ', async () => {
    setup(OWNER, { put: () => err(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', { required: 'org.update' }) });
    renderAt(PATH);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Ngân hàng'), ' A');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này')).toBeTruthy();
  });

  it('thiếu org.update (chỉ org.read): vào thẳng đường → 403 theo nav, không tải màn', async () => {
    const calls = setup(READONLY);
    renderAt(PATH);
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    expect(gets(calls)).toHaveLength(0);
  });
});

describe('logic cài đặt cổng', () => {
  it('chuẩn hoá giống máy chủ; đủ ba hoặc trống ba', () => {
    expect(normalizeAccountName(' đỗ  Thị Ánh ')).toBe('DO THI ANH');
    expect(groupAccountNo('0123456789')).toBe('0123 4567 89');
    expect(toInput({ bankName: '', bankAccountNo: ' ', bankAccountName: '' })).toEqual({ bankName: null, bankAccountNo: null, bankAccountName: null });
    expect(() => toInput({ bankName: 'ACB', bankAccountNo: '', bankAccountName: '' })).toThrow();
    expect(validateDraft(draftOf(null))).toEqual({});
    expect(validateDraft({ bankName: 'A', bankAccountNo: '123456', bankAccountName: 'Lê' })).toEqual({ bankName: 'Tên ngân hàng từ 2 đến 80 ký tự' });
  });
});
