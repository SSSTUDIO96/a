import { act, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import { routes } from '../app/routes';
import { NAV_ITEMS, visibleNav } from './nav';

// Khung chạy thật (phiên, router, quyền) với máy chủ giả lập qua fetch: /auth/refresh, /auth/me, /orgs/:orgId.

const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Studio Hoa Đào', slug: 'hoa-dao', kind: 'TEAM', roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setupServer(permissions: readonly string[] | 'not-member', opts: { holdOrg?: Promise<void> } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (url.endsWith('/auth/me')) return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Thị Hoa', organizations: [ORG] });
      if (url.endsWith('/orgs/org-1')) {
        if (opts.holdOrg) await opts.holdOrg;
        if (permissions === 'not-member') return json(404, { error: { code: 'NOT_FOUND', message: 'Không tìm thấy tổ chức', requestId: 'r' } });
        return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions].sort() });
      }
      return json(404, { error: { code: 'NOT_FOUND', message: 'Không có đường API này', requestId: 'r' } });
    }),
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const OWNER = SYSTEM_ROLES.owner.permissions;
const ARTIST = SYSTEM_ROLES.artist.permissions;
const SCHEDULE_ONLY: Permission[] = ['org.read', 'schedule.read_own'];

async function mainMenuLinks(): Promise<string[]> {
  const nav = await screen.findByRole('navigation', { name: 'Mục chính' });
  await within(nav).findAllByRole('link');
  return within(nav)
    .getAllByRole('link')
    .map((a) => a.textContent ?? '');
}

function phoneNavItems(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Mục chính (điện thoại)' });
  return [...nav.querySelectorAll('a,button')].map((el) => el.textContent ?? '');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ẩn mục điều hướng theo quyền (bản vẽ C mục 6)', () => {
  it('chủ tổ chức thấy đủ 6 mục, thanh dưới có Lịch · Hợp đồng · Bảng giá · Khách · Thêm', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/lich');
    expect(await mainMenuLinks()).toEqual(['Lịch makeup', 'Hợp đồng', 'Bảng giá', 'Khách hàng', 'Thợ makeup', 'Cài đặt']);
    expect(phoneNavItems()).toEqual(['Lịch', 'Hợp đồng', 'Bảng giá', 'Khách', 'Thêm']);
    expect(screen.getByText('Đang dựng')).toBeTruthy();
  });

  it('thợ chỉ có quyền xem lịch của mình → chỉ thấy Lịch (thanh dưới: Lịch · Thêm)', async () => {
    setupServer(SCHEDULE_ONLY);
    renderAt('/hoa-dao/lich');
    expect(await mainMenuLinks()).toEqual(['Lịch makeup']);
    expect(phoneNavItems()).toEqual(['Lịch', 'Thêm']);
  });

  it('vai trò hệ thống "Thợ makeup" (artist) có catalog.read và staff.read nên thấy thêm Bảng giá và Thợ makeup', async () => {
    setupServer(ARTIST);
    renderAt('/hoa-dao/lich');
    expect(await mainMenuLinks()).toEqual(['Lịch makeup', 'Bảng giá', 'Thợ makeup']);
  });

  it('vào thẳng đường không có quyền → dải 403, không hiện màn', async () => {
    setupServer(SCHEDULE_ONLY);
    renderAt('/hoa-dao/hop-dong');
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem hợp đồng.');
    expect(screen.queryByText('Đang dựng')).toBeNull();
  });

  it('đang tải quyền: chưa hiện mục nào (không lộ rồi mới giấu), có khối chờ', async () => {
    let release = () => undefined as void;
    const hold = new Promise<void>((r) => {
      release = r;
    });
    setupServer(SCHEDULE_ONLY, { holdOrg: hold });
    renderAt('/hoa-dao/lich');
    const nav = await screen.findByRole('navigation', { name: 'Mục chính' });
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
    expect(within(nav).getByRole('status', { name: 'Đang tải mục' })).toBeTruthy();
    await act(async () => release());
    expect(await mainMenuLinks()).toEqual(['Lịch makeup']);
  });

  it('/:orgSlug chuyển tới mục đầu tiên được xem', async () => {
    setupServer(SCHEDULE_ONLY);
    const router = renderAt('/hoa-dao');
    await mainMenuLinks();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/hoa-dao/lich'));
  });
});

describe('trạng thái lỗi của khung (bản vẽ C mục 5)', () => {
  it('đường không có trong tổ chức → "Không tìm thấy trang này." + nút quay lại', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/khong-co');
    expect(await screen.findByText('Không tìm thấy trang này.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeTruthy();
  });

  it('máy chủ báo không phải thành viên (404) → báo không tìm thấy tổ chức', async () => {
    setupServer('not-member');
    renderAt('/hoa-dao/lich');
    expect(await screen.findByText('Không tìm thấy tổ chức này, hoặc bạn không còn là thành viên.')).toBeTruthy();
  });

  it('mất mạng → dải cảnh báo; có mạng lại → dải mất', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/lich');
    await mainMenuLinks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status', { name: '' }).textContent).toContain('Mất kết nối mạng');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/Mất kết nối mạng/)).toBeNull();
  });

  it('ở Bảng giá: hiện menu con dưới mục đang chọn', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/bang-gia/goi');
    await mainMenuLinks();
    const nav = screen.getByRole('navigation', { name: 'Mục chính' });
    const sub = within(nav).getByRole('link', { name: 'Gói theo nhân vật' });
    expect(sub.className).toContain('on');
  });
});

describe('nav.ts', () => {
  it('mỗi mục một quyền, đúng bảng bản vẽ C mục 6 + chỉ đạo điều phối', () => {
    expect(NAV_ITEMS.map((i) => [i.key, i.permission])).toEqual([
      ['lich', 'schedule.read_own'],
      ['hop-dong', 'contracts.read'],
      ['bang-gia', 'catalog.read'],
      ['khach-hang', 'customers.read'],
      ['nhan-su', 'staff.read'],
      ['cai-dat', 'org.update'],
    ]);
    expect(visibleNav(() => false)).toEqual([]);
  });
});
