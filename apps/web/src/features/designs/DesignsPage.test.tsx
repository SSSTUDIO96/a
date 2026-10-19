import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';

// Màn Mẫu thiết kế chạy thật trong khung (router, phiên, quyền) với máy chủ giả lập qua fetch — C3 mục 2.6.
configure({ asyncUtilTimeout: 5000 });

const T = '2026-10-18T03:00:00.000Z';
type Kind = 'ACADEMY' | 'TEAM';
const orgOf = (kind: Kind) => ({ membershipId: 'm-1', id: 'org-1', name: 'Quỳnh Hương', slug: 'qh', kind, roles: [{ key: 'owner', name: 'Chủ tài khoản' }] });

interface Call {
  method: string;
  path: string;
  body: unknown;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

const contract = (id: string, code: string, kind: 'COURSE' | 'SERVICE', name: string) => ({
  id, code, kind, status: 'DRAFT', eventDate: null, subtotal: 0, discount: 0, total: 0, depositRequired: 0, confirmedAt: null, createdAt: T,
  customer: { id: `k-${id}`, fullName: name, phone: null },
});
const CONTRACTS = [contract('c1', 'HĐKH-000001', 'COURSE', 'Quỳnh Như'), contract('c2', 'HD-000001', 'SERVICE', 'Thuý Tây')];
const DATA = {
  c1: { contractKind: 'COURSE', courseClassId: 'cls-1', th: 'Quỳnh Hương Makeup Academy', diachi: '18 Nguyễn Chí Thanh', sdt: null, web: null, ten: 'Quỳnh Như', khoa: 'Makeup chuyên nghiệp', lop: 'K12', ngay: '2026-11-03', nkt: '2026-12-20', lich: null, gv: null, nv: null, goi: null, nsk: null, logoUrl: null, anhUrl: null, signedUrlExpiresAt: null },
  c2: { contractKind: 'SERVICE', courseClassId: null, th: 'Quỳnh Hương Makeup Academy', diachi: null, sdt: null, web: null, ten: 'Thuý Tây', khoa: null, lop: null, ngay: null, nkt: null, lich: null, gv: null, nv: 'Cô dâu', goi: 'Ngày cưới trọn gói', nsk: null, logoUrl: null, anhUrl: null, signedUrlExpiresAt: null },
};
const CARD = {
  id: 'card-1', kind: 'FEEDBACK', templateCode: 'fb-05', templateVersion: 1, contractId: 'c2', contract: { id: 'c2', code: 'HD-000001', kind: 'SERVICE' },
  customerId: 'k-c2', customer: { id: 'k-c2', fullName: 'Thuý Tây' }, courseClassId: null, title: null, body: 'Cảm ơn', rating: null, receivedAt: null,
  fontOverride: null, size: '1080x1350', snapshot: {}, photos: [], outputFileId: 'f-out', outputUrl: '/api/v1/files/raw/out', outputUrlExpiresAt: T, createdById: 'u-1', createdAt: T, updatedAt: T,
};
const PHRASE = { id: 'p1', name: 'Ngày cưới', appliesTo: ['SERVICE'], title: 'Trăm năm hạnh phúc', body: 'Chúc hai bạn trăm năm hạnh phúc.', sortOrder: 0, isActive: true, createdAt: T, updatedAt: T };

type Override = (method: string, path: string, body: unknown) => Response | undefined;

function setupServer(permissions: readonly string[], kind: Kind, override?: Override) {
  const calls: Call[] = [];
  const ORG = orgOf(kind);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      if (!path.startsWith('/auth')) calls.push({ method, path: path + url.search, body });
      const o = override?.(method, path + url.search, body);
      if (o) return o;
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Thu Hà', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
      if (path === '/orgs/org-1/contracts') {
        const k = url.searchParams.get('kind');
        const items = CONTRACTS.filter((c) => !k || c.kind === k);
        return json(200, { items, page: 1, pageSize: 100, total: items.length });
      }
      const dd = /^\/orgs\/org-1\/contracts\/(\w+)\/design-data$/.exec(path);
      if (dd) return json(200, DATA[dd[1] as 'c1' | 'c2']);
      if (path === '/orgs/org-1/greeting-phrases' && method === 'GET') return json(200, [PHRASE]);
      if (path === '/orgs/org-1/design-cards' && method === 'GET') return json(200, [CARD]);
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

afterEach(() => {
  vi.unstubAllGlobals();
});

async function pickContract(code: string) {
  const sel = await screen.findByRole('combobox', { name: 'Hợp đồng' });
  await waitFor(() => expect(within(sel).getByRole('option', { name: new RegExp(code) })).toBeTruthy());
  await userEvent.selectOptions(sel, within(sel).getByRole('option', { name: new RegExp(code) }));
}

describe('Mẫu thiết kế — tạo thẻ', () => {
  it('ACADEMY: vào /mau-thiet-ke tới Thẻ chào mừng; hộp xám hiện giá trị tự lấy, ngày khai giảng dd/mm/yyyy', async () => {
    setupServer(OWNER, 'ACADEMY');
    const router = renderAt('/qh/mau-thiet-ke');
    await waitFor(() => expect(router.state.location.pathname).toBe('/qh/mau-thiet-ke/the-chao'));
    // Thẻ chào mừng chỉ dùng hợp đồng khoá học: ô Dịch vụ tắt.
    expect(await screen.findByRole('radio', { name: 'Dịch vụ makeup' })).toHaveProperty('ariaDisabled', 'true');
    await pickContract('HĐKH-000001');
    const box = await screen.findByLabelText('Giá trị tự lấy từ hợp đồng');
    await waitFor(() => expect(box.textContent).toContain('Học viên Quỳnh Như'));
    expect(box.textContent).toContain('Khai giảng 03/11/2026');
    // shd-01 có ô Logo nhưng hồ sơ chưa có logo → báo ảnh bỏ ô logo (mẫu ẩn hẳn ô, không in ô trống), không tự điền.
    expect(box.textContent).toContain('Chưa có logo: ảnh bỏ ô logo');
    expect(box.textContent).not.toContain('Ô trống trên ảnh: Logo');
  });

  it('400 mẫu sai loại hợp đồng → lời máy chủ hiện ở ô chọn mẫu (không chỉ dải chung)', async () => {
    // Học viên có ảnh (mẫu nào cũng có ô ảnh — thiếu ảnh thì web chặn trước, không gửi máy chủ).
    const calls = setupServer(OWNER, 'ACADEMY', (method, path) =>
      method === 'POST' && path === '/orgs/org-1/design-cards'
        ? err(400, 'VALIDATION_FAILED', 'Mẫu shd-01 chỉ dùng cho hợp đồng khoá học', {
            issues: [{ path: 'templateCode', message: 'Mẫu shd-01 chỉ dùng cho hợp đồng khoá học' }],
          })
        : path === '/orgs/org-1/contracts/c1/design-data'
          ? json(200, { ...DATA.c1, anhUrl: '/api/v1/files/raw/anh' })
          : undefined,
    );
    renderAt('/qh/mau-thiet-ke/the-chao');
    await pickContract('HĐKH-000001');
    await screen.findByText(/Học viên/);
    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh PNG' }));
    const grid = screen.getByRole('region', { name: 'Chọn mẫu' });
    expect((await within(grid).findByRole('alert')).textContent).toBe('Mẫu shd-01 chỉ dùng cho hợp đồng khoá học');
    const post = calls.find((c) => c.method === 'POST' && c.path === '/orgs/org-1/design-cards');
    expect(post?.body).toEqual({ kind: 'WELCOME', templateCode: 'shd-01', contractId: 'c1', courseClassId: 'cls-1', photoFileIds: [], fontOverride: null, size: '1080x1350' });
  });

  it('BẮT: thẻ chào mừng mà học viên chưa có ảnh → chặn xuất, báo "Mẫu này cần đúng 1 ảnh", không gửi máy chủ', async () => {
    const calls = setupServer(OWNER, 'ACADEMY');
    renderAt('/qh/mau-thiet-ke/the-chao');
    await pickContract('HĐKH-000001');
    await screen.findByText(/Học viên/);
    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh PNG' }));
    expect(await screen.findByText('Mẫu này cần đúng 1 ảnh (đang có 0). Thêm ảnh học viên.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.path.includes('design-cards'))).toBe(false);
  });

  it('Feedback: thiếu lời khen và ảnh → lỗi đúng ô, không gửi máy chủ', async () => {
    const calls = setupServer(OWNER, 'ACADEMY');
    renderAt('/qh/mau-thiet-ke/feedback');
    await userEvent.click(await screen.findByRole('radio', { name: 'Dịch vụ makeup' }));
    await pickContract('HD-000001');
    await screen.findByText(/Nhân vật/);
    await userEvent.click(screen.getByRole('button', { name: /^fb-05 / }));
    expect(screen.getByText('Mẫu này cần đúng 2 ảnh · đã có 0')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh PNG' }));
    expect(await screen.findByText('Dán nội dung lời khen.')).toBeTruthy();
    expect(screen.getByText('Mẫu này cần đúng 2 ảnh (đang có 0).')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.path.includes('design-cards'))).toBe(false);
  });

  it('TEAM (chưa bật đào tạo): không có Thẻ chào mừng; Feedback mặc định hợp đồng dịch vụ, ô Khoá học tắt', async () => {
    setupServer(OWNER, 'TEAM');
    const router = renderAt('/qh/mau-thiet-ke');
    await waitFor(() => expect(router.state.location.pathname).toBe('/qh/mau-thiet-ke/feedback'));
    const tabs = await screen.findByRole('navigation', { name: 'Mẫu thiết kế' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Feedback', 'Lời chúc', 'Thẻ đã tạo', 'Câu chúc soạn sẵn']);
    expect(screen.getByRole('radio', { name: 'Dịch vụ makeup' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Khoá học' })).toHaveProperty('ariaDisabled', 'true');
  });

  it('Lời chúc: câu chúc soạn sẵn theo loại hợp đồng điền sẵn tiêu đề và lời chúc, sửa được', async () => {
    const calls = setupServer(OWNER, 'TEAM');
    renderAt('/qh/mau-thiet-ke/loi-chuc');
    const radio = await screen.findByRole('radio', { name: /Ngày cưới/ });
    await waitFor(() => expect((radio as HTMLInputElement).checked).toBe(true));
    expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Trăm năm hạnh phúc');
    expect(calls.some((c) => c.path === '/orgs/org-1/greeting-phrases?contractKind=SERVICE')).toBe(true);
  });
});

describe('Mẫu thiết kế — quyền', () => {
  it('chỉ designs.read: không có thẻ tạo mới; vào thẳng /feedback → không có mục; danh sách không có nút Xoá', async () => {
    setupServer(['org.read', 'designs.read'], 'ACADEMY');
    const router = renderAt('/qh/mau-thiet-ke');
    await waitFor(() => expect(router.state.location.pathname).toBe('/qh/mau-thiet-ke/da-tao'));
    // Đổi đường dẫn xong chưa chắc thanh mục đã vẽ (máy bận khi chạy cả bộ) → chờ, không getBy ngay (từng đỏ 1/2 lần chạy cả bộ).
    const tabs = await screen.findByRole('navigation', { name: 'Mẫu thiết kế' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Thẻ đã tạo', 'Câu chúc soạn sẵn']);
    expect(await screen.findByText('Thuý Tây')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải ảnh' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  });

  it('chỉ designs.read: vào thẳng /mau-thiet-ke/feedback → báo không có mục, không có ô tạo thẻ', async () => {
    setupServer(['org.read', 'designs.read'], 'ACADEMY');
    renderAt('/qh/mau-thiet-ke/feedback');
    expect(await screen.findByText('Không có mục này trong Mẫu thiết kế.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tải ảnh PNG' })).toBeNull();
  });

  it('không có designs.read → dải 403 của khung', async () => {
    setupServer(['org.read', 'schedule.read_own'], 'ACADEMY');
    renderAt('/qh/mau-thiet-ke/feedback');
    expect((await screen.findByRole('alert')).textContent).toContain('không có quyền');
  });

  it('có designs.write nhưng không files.write → không có ô thêm ảnh', async () => {
    setupServer(['org.read', 'designs.read', 'designs.write', 'contracts.read'], 'TEAM');
    renderAt('/qh/mau-thiet-ke/feedback');
    await pickContract('HD-000001');
    await screen.findByText(/Nhân vật/);
    expect(screen.getByText('Bạn chưa có quyền tải ảnh lên.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm ảnh' })).toBeNull();
  });

  it('không có contracts.read → không chọn được hợp đồng nguồn, báo rõ', async () => {
    setupServer(['org.read', 'designs.read', 'designs.write', 'files.write'], 'TEAM');
    renderAt('/qh/mau-thiet-ke/feedback');
    expect(await screen.findByText('Cần quyền xem hợp đồng để chọn hợp đồng nguồn.')).toBeTruthy();
  });
});
