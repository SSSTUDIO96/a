import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';

// Màn Khách hàng chạy thật trong khung với máy chủ giả lập qua fetch — C2 mục 2.
configure({ asyncUtilTimeout: 5000 });

const T = '2026-08-12T03:00:00.000Z';
const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Studio Chiến', slug: 'chien', kind: 'TEAM', roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };

interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}
type Override = (method: string, path: string, body: unknown) => Response | undefined;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

const cus = (id: string, fullName: string, phone: string | null, extra: object = {}) => ({ id, fullName, phone, email: null, note: null, createdAt: T, updatedAt: T, ...extra });
const MAIN = cus('k1', 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', '0912345678', { email: 'phuongthao.tnhbn@gmail.com', note: 'Da nhạy cảm,\nkhông dùng keo dán mi.' });
// 25 khách: trang 1 = 20, trang 2 = 5.
const ALL = [MAIN, cus('k2', 'Nguyễn Thị Mai', '0903778221'), ...Array.from({ length: 23 }, (_, i) => cus(`x${i}`, `Khách số ${i + 3}`, null))];

const summary = (id: string, code: string, status: string, eventDate: string | null, total: number) => ({
  id, code, status, eventDate, subtotal: total, discount: 0, total, depositRequired: 0, confirmedAt: null, createdAt: T, customer: { id: 'k1', fullName: MAIN.fullName, phone: MAIN.phone },
});
const line = (id: string, name: string) => ({ id, kind: 'PACKAGE', name, voidedAt: null, addons: [], travel: null });
const CONTRACTS = [summary('c3', 'HD-000151', 'DRAFT', '2027-01-01T17:00:00.000Z', 1_500_000), summary('c2', 'HD-000142', 'CONFIRMED', '2026-10-23T17:00:00.000Z', 5_300_000)];
const DETAILS: Record<string, unknown> = {
  c3: { id: 'c3', code: 'HD-000151', lines: [line('l3', 'Chụp ảnh cưới')], appointments: [] },
  c2: {
    id: 'c2',
    code: 'HD-000142',
    lines: [line('l2', 'Ngày cưới'), line('l4', 'Mẹ – Trang điểm nhẹ nhàng')],
    appointments: [
      { id: 'a2', code: 'LH-000413', startsAt: '2099-10-23T22:00:00.000Z', status: 'CONFIRMED', contractLineId: 'l4' },
      { id: 'a1', code: 'LH-000412', startsAt: '2099-10-23T21:30:00.000Z', status: 'CONFIRMED', contractLineId: 'l2' },
      { id: 'a0', code: 'LH-000301', startsAt: '2026-08-14T22:30:00.000Z', status: 'COMPLETED', contractLineId: 'l2' },
    ],
  },
};

function setupServer(permissions: readonly string[], override?: Override) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      if (!path.startsWith('/auth')) calls.push({ method, path: path + url.search, body, headers: { ...(init?.headers as Record<string, string>) } });
      const o = override?.(method, path + url.search, body);
      if (o) return o;
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Trọng Chiến', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
      if (path === '/orgs/org-1/customers' && method === 'GET') {
        const q = url.searchParams.get('q');
        const page = Number(url.searchParams.get('page') ?? 1);
        const size = Number(url.searchParams.get('pageSize') ?? 20);
        const digits = q?.replace(/\D/g, '') ?? '';
        const list = q ? ALL.filter((c) => c.fullName.toLowerCase().includes(q.toLowerCase()) || (digits.length >= 3 && c.phone?.includes(digits))) : ALL;
        return json(200, { items: list.slice((page - 1) * size, page * size), page, pageSize: size, total: list.length });
      }
      if (path === '/orgs/org-1/customers' && method === 'POST') return json(201, cus('k-new', (body as { fullName: string }).fullName, (body as { phone?: string }).phone ?? null));
      const one = /^\/orgs\/org-1\/customers\/([\w-]+)$/.exec(path);
      if (one && method === 'GET') {
        const c = ALL.find((x) => x.id === one[1]) ?? (one[1] === 'k-new' ? cus('k-new', 'Đinh Bảo Ngọc', null) : null);
        return c ? json(200, c) : err(404, 'NOT_FOUND', 'Không tìm thấy khách hàng');
      }
      if (one && method === 'PATCH') return json(200, { ...ALL.find((x) => x.id === one[1]), ...(body as object) });
      if (path === '/orgs/org-1/contracts') {
        const id = url.searchParams.get('customerId');
        const items = id === 'k1' ? CONTRACTS : [];
        return json(200, { items, page: 1, pageSize: 10, total: items.length });
      }
      const ct = /^\/orgs\/org-1\/contracts\/(\w+)$/.exec(path);
      if (ct) return json(200, DETAILS[ct[1]!]);
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
const ACCOUNTANT = SYSTEM_ROLES.accountant.permissions;
const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');
const listNav = () => screen.getByRole('navigation', { name: 'Danh sách khách' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Khách hàng — danh sách và hồ sơ', () => {
  it('danh sách: "Mới thêm gần đây · 25 khách", dòng = ảnh · tên · số; khách đầu được mở ở cột phải với 3 thẻ', async () => {
    renderAt((setupServer(OWNER), '/chien/khach-hang'));
    const row = await within(await screen.findByRole('navigation', { name: 'Danh sách khách' })).findByRole('link', { name: /Tôn Nữ/ });
    expect(screen.getByRole('heading', { name: /Mới thêm gần đây.*25 khách/ })).toBeTruthy();
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(row.textContent).toBe('TTTôn Nữ Hoàng Bảo Ngọc Phương Thảo0912 345 678');
    const info = await screen.findByRole('region', { name: 'Thông tin khách' });
    expect(within(info).getByRole('link', { name: '0912 345 678' }).getAttribute('href')).toBe('tel:0912345678');
    expect(within(info).getByText('phuongthao.tnhbn@gmail.com')).toBeTruthy();
    expect(within(info).getByText('12/08/2026')).toBeTruthy();
    const cts = await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    expect(within(cts).getByText('2 hợp đồng')).toBeTruthy();
    expect(within(cts).getByRole('link', { name: /Lập hợp đồng/ }).getAttribute('href')).toBe('/chien/hop-dong/moi?customerId=k1');
    const first = await within(cts).findByRole('link', { name: /HD-000151 · Chụp ảnh cưới/ });
    expect(first.getAttribute('href')).toBe('/chien/hop-dong/c3');
    expect(first.textContent).toContain('Sự kiện 02/01/2027');
    expect(first.textContent).toContain('1.500.000 ₫');
    expect(first.textContent).toContain('Nháp');
    const aps = await screen.findByRole('region', { name: 'Lịch makeup của khách' });
    const links = within(aps).getAllByRole('link');
    expect(links.map((a) => a.querySelector('.kh-ap__sub')?.textContent)).toEqual(['LH-000412 · HD-000142', 'LH-000413 · HD-000142', 'LH-000301 · HD-000142']);
    expect(links[0]?.getAttribute('href')).toBe('/chien/lich?ngay=2099-10-24&ca=a1');
    expect(links[0]?.textContent).toContain('04:30');
    expect(links[0]?.textContent).toContain('Ngày cưới');
  });

  it('gọi song song khách + hợp đồng (pageSize 10) rồi chi tiết từng hợp đồng', async () => {
    const calls = setupServer(OWNER);
    renderAt('/chien/khach-hang/k1');
    await screen.findByRole('region', { name: 'Lịch makeup của khách' });
    const gets = calls.filter((c) => c.method === 'GET').map((c) => c.path);
    expect(gets).toContain('/orgs/org-1/customers/k1');
    expect(gets).toContain('/orgs/org-1/contracts?customerId=k1&pageSize=10');
    expect(gets).toContain('/orgs/org-1/contracts/c2');
    expect(gets).toContain('/orgs/org-1/contracts/c3');
  });

  it('khách chưa có hợp đồng → "Chưa có hợp đồng." + Lập hợp đồng; thẻ Lịch ẩn', async () => {
    setupServer(OWNER);
    renderAt('/chien/khach-hang/k2');
    const cts = await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    expect(await within(cts).findByText('Chưa có hợp đồng.')).toBeTruthy();
    expect(within(cts).getByRole('link', { name: /Lập hợp đồng/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Lịch makeup của khách' })).toBeNull();
  });

  it('không có contracts.read → không gọi API hợp đồng, ẩn thẻ Hợp đồng và Lịch; không có customers.write → không Sửa / Khách mới', async () => {
    const calls = setupServer(['org.read', 'customers.read']);
    renderAt('/chien/khach-hang/k1');
    await screen.findByRole('region', { name: 'Thông tin khách' });
    expect(screen.queryByRole('region', { name: 'Hợp đồng của khách' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Lịch makeup của khách' })).toBeNull();
    expect(calls.some((c) => c.path.includes('/contracts'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Khách mới' })).toHaveLength(0);
  });

  it('403 khi tải hợp đồng → ẩn hai thẻ, không hiện dải đỏ', async () => {
    setupServer(OWNER, (m, p) => (p.startsWith('/orgs/org-1/contracts?') ? err(403, 'FORBIDDEN', 'Bạn không có quyền xem hợp đồng') : undefined));
    renderAt('/chien/khach-hang/k1');
    await screen.findByRole('region', { name: 'Thông tin khách' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Hợp đồng của khách' })).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('kế toán: xem, không sửa, không lập hợp đồng', async () => {
    setupServer(ACCOUNTANT);
    renderAt('/chien/khach-hang/k1');
    const cts = await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    expect(within(cts).queryByRole('link', { name: /Lập hợp đồng/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull();
  });

  it('khách không còn (404) → "Không tìm thấy khách hàng" + Về danh sách', async () => {
    setupServer(OWNER);
    const router = renderAt('/chien/khach-hang/khong-co');
    expect(await screen.findByText('Không tìm thấy khách hàng')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
    expect(router.state.location.pathname).toBe('/chien/khach-hang');
  });

  it('"Xem thêm 5 khách" → page=2, nối vào danh sách, hết thì ẩn nút', async () => {
    const calls = setupServer(OWNER);
    renderAt('/chien/khach-hang');
    await within(await screen.findByRole('navigation', { name: 'Danh sách khách' })).findByRole('link', { name: /Tôn Nữ/ });
    expect(within(listNav()).getAllByRole('link')).toHaveLength(20);
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm 5 khách' }));
    await waitFor(() => expect(within(listNav()).getAllByRole('link')).toHaveLength(25));
    expect(calls.some((c) => c.path === '/orgs/org-1/customers?page=2&pageSize=20')).toBe(true);
    expect(screen.queryByRole('button', { name: /Xem thêm/ })).toBeNull();
  });
});

describe('Tìm khách', () => {
  it('gõ số: đợi 300 ms rồi mới gọi q=; "Kết quả · 1 khách"; phần số khớp in đậm', async () => {
    const calls = setupServer(OWNER);
    renderAt('/chien/khach-hang');
    await within(await screen.findByRole('navigation', { name: 'Danh sách khách' })).findByRole('link', { name: /Tôn Nữ/ });
    await userEvent.type(screen.getByLabelText('Tìm khách theo tên hoặc số điện thoại'), '0912 34');
    await screen.findByRole('heading', { name: /Kết quả.*1 khách/ });
    const searches = calls.filter((c) => c.path.startsWith('/orgs/org-1/customers?') && c.path.includes('q='));
    // Gõ 7 ký tự liền nhau → chỉ 1 lần hỏi máy chủ.
    expect(searches.map((c) => c.path)).toEqual(['/orgs/org-1/customers?page=1&pageSize=20&q=0912+34']);
    const row = within(listNav()).getByRole('link', { name: /Tôn Nữ/ });
    expect(row.querySelector('b')?.textContent).toBe('0912 34');
  });

  it('không thấy → EmptyState + "Thêm khách "0987 1"" mở hộp điền sẵn ô Số điện thoại', async () => {
    setupServer(OWNER);
    renderAt('/chien/khach-hang');
    await within(await screen.findByRole('navigation', { name: 'Danh sách khách' })).findByRole('link', { name: /Tôn Nữ/ });
    await userEvent.type(screen.getByLabelText('Tìm khách theo tên hoặc số điện thoại'), '0987 1');
    expect(await screen.findByText('Không có khách nào khớp "0987 1". Kiểm tra lại số hoặc thêm khách mới.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm khách "0987 1"' }));
    const dlg = await screen.findByRole('dialog', { name: 'Khách mới' });
    expect((within(dlg).getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0987 1');
    expect((within(dlg).getByLabelText(/Họ và tên/) as HTMLInputElement).value).toBe('');
  });
});

describe('Khách mới, sửa tại chỗ', () => {
  it('Khách mới: 400 số điện thoại → lỗi dưới ô; thêm được → POST có Idempotency-Key, khách lên đầu danh sách, mở hồ sơ', async () => {
    let first = true;
    const calls = setupServer(OWNER, (m, p) => {
      if (m === 'POST' && p === '/orgs/org-1/customers' && first) {
        first = false;
        return err(400, 'VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', { issues: [{ path: 'phone', message: 'Số điện thoại không hợp lệ (ví dụ đúng: 0912 345 678 hoặc +84 912 345 678)' }] });
      }
      return undefined;
    });
    const router = renderAt('/chien/khach-hang');
    await within(await screen.findByRole('navigation', { name: 'Danh sách khách' })).findByRole('link', { name: /Tôn Nữ/ });
    await userEvent.click(screen.getAllByRole('button', { name: 'Khách mới' })[0]!);
    const dlg = await screen.findByRole('dialog', { name: 'Khách mới' });
    await userEvent.type(within(dlg).getByLabelText(/Họ và tên/), 'Đinh Bảo Ngọc');
    await userEvent.type(within(dlg).getByLabelText('Số điện thoại'), '0912 345');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Thêm khách' }));
    expect(await within(dlg).findByText(/Số điện thoại không hợp lệ/)).toBeTruthy();
    await userEvent.clear(within(dlg).getByLabelText('Số điện thoại'));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Thêm khách' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/chien/khach-hang/k-new'));
    const posts = writes(calls);
    expect(posts.map((c) => c.body)).toEqual([{ fullName: 'Đinh Bảo Ngọc', phone: '0912 345' }, { fullName: 'Đinh Bảo Ngọc' }]);
    // Thử lại trong cùng một lần mở hộp → cùng khoá chống gửi trùng.
    expect(posts[0]?.headers['Idempotency-Key']).toBeTruthy();
    expect(posts[1]?.headers['Idempotency-Key']).toBe(posts[0]?.headers['Idempotency-Key']);
    expect(within(listNav()).getAllByRole('link')[0]?.textContent).toContain('Đinh Bảo Ngọc');
  });

  it('Sửa tại chỗ: PATCH chỉ trường đã đổi, xoá trắng = null; Lưu xong về thẻ Thông tin', async () => {
    const calls = setupServer(OWNER);
    renderAt('/chien/khach-hang/k1');
    const info = await screen.findByRole('region', { name: 'Thông tin khách' });
    await userEvent.click(within(info).getByRole('button', { name: 'Sửa' }));
    const form = await screen.findByRole('region', { name: 'Sửa thông tin khách' });
    expect((within(form).getByLabelText('Ghi chú') as HTMLTextAreaElement).value).toBe('Da nhạy cảm,\nkhông dùng keo dán mi.');
    await userEvent.clear(within(form).getByLabelText('Email'));
    await userEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    const back = await screen.findByRole('region', { name: 'Thông tin khách' });
    expect(within(back).queryByText('phuongthao.tnhbn@gmail.com')).toBeNull();
    expect(writes(calls).map((c) => [c.method, c.path, c.body])).toEqual([['PATCH', '/orgs/org-1/customers/k1', { email: null }]]);
  });

  it('Sửa: bỏ trống họ tên → lỗi dưới ô, không gọi máy chủ; lỗi mạng → dải đỏ, giữ chữ đang gõ', async () => {
    const calls = setupServer(OWNER, (m) => {
      if (m === 'PATCH') throw new TypeError('Failed to fetch');
      return undefined;
    });
    renderAt('/chien/khach-hang/k1');
    const info = await screen.findByRole('region', { name: 'Thông tin khách' });
    await userEvent.click(within(info).getByRole('button', { name: 'Sửa' }));
    const form = await screen.findByRole('region', { name: 'Sửa thông tin khách' });
    await userEvent.clear(within(form).getByLabelText(/Họ và tên/));
    await userEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect(await within(form).findByText('Nhập họ và tên khách.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    await userEvent.type(within(form).getByLabelText(/Họ và tên/), 'Phương Thảo');
    await userEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect((await within(form).findByRole('alert')).textContent).toMatch(/Không kết nối được máy chủ/);
    expect((within(form).getByLabelText(/Họ và tên/) as HTMLInputElement).value).toBe('Phương Thảo');
  });
});

describe('Lỗi tải danh sách', () => {
  it('lỗi mạng → dải đỏ + Thử lại', async () => {
    let fail = true;
    setupServer(OWNER, (m, p) => {
      if (p.startsWith('/orgs/org-1/customers?') && fail) {
        fail = false;
        throw new TypeError('Failed to fetch');
      }
      return undefined;
    });
    renderAt('/chien/khach-hang');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Không kết nối được máy chủ/);
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await within(await screen.findByRole('navigation', { name: 'Danh sách khách' })).findByRole('link', { name: /Tôn Nữ/ })).toBeTruthy();
  });

  it('chưa có khách → "Chưa có khách nào…" + Thêm khách', async () => {
    setupServer(OWNER, (m, p) => (m === 'GET' && p.startsWith('/orgs/org-1/customers?') ? json(200, { items: [], page: 1, pageSize: 20, total: 0 }) : undefined));
    renderAt('/chien/khach-hang');
    expect(await screen.findByText('Chưa có khách nào. Khách cũng tự được thêm khi lập hợp đồng.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm khách' })).toBeTruthy();
  });
});
