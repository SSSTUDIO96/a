import { act, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import { routes } from '../app/routes';
import { activeBottomKey, activeNavChild, activeNavItem, bottomNav, NAV_ITEMS, navEntryAllowed, visibleNav, type VisibleNavItem } from './nav';

// Chạy cả bộ thử song song thì máy bận: hạn chờ 1 giây mặc định không đủ cho chuỗi phiên → quyền → chuyển đường.
configure({ asyncUtilTimeout: 5000 });
const waitFor = (fn: () => unknown) => vi.waitFor(fn, { timeout: 5000 });

// Khung chạy thật (phiên, router, quyền) với máy chủ giả lập qua fetch: /auth/refresh, /auth/me, /orgs/:orgId.
// Bài thử chỉ kiểm KHUNG (mục điều hướng, quyền, mục đang chọn, chuyển đường) — không phụ thuộc nội dung từng màn.

type Kind = 'INDIVIDUAL' | 'TEAM' | 'ACADEMY';
const orgOf = (kind: Kind) => ({ membershipId: 'm-1', id: 'org-1', name: 'Studio Hoa Đào', slug: 'hoa-dao', kind, roles: [{ key: 'owner', name: 'Chủ tài khoản' }] });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setupServer(permissions: readonly string[] | 'not-member' | 'anonymous', opts: { holdOrg?: Promise<void>; kind?: Kind } = {}) {
  const ORG = orgOf(opts.kind ?? 'TEAM');
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/refresh')) {
      if (permissions === 'anonymous') return json(401, { error: { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập', requestId: 'r' } });
      return json(200, { accessToken: 'tok', expiresIn: 900 });
    }
    if (url.endsWith('/auth/me')) return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Thị Hoa', organizations: [ORG] });
    if (url.endsWith('/orgs/org-1')) {
      if (opts.holdOrg) await opts.holdOrg;
      if (permissions === 'not-member') return json(404, { error: { code: 'NOT_FOUND', message: 'Không tìm thấy tổ chức', requestId: 'r' } });
      return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions].sort() });
    }
    return json(404, { error: { code: 'NOT_FOUND', message: 'Không có đường API này', requestId: 'r' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const OWNER = SYSTEM_ROLES.owner.permissions;
const ARTIST = SYSTEM_ROLES.artist.permissions;
const RECEPTIONIST = SYSTEM_ROLES.receptionist.permissions;
const SCHEDULE_ONLY: Permission[] = ['org.read', 'schedule.read_own'];

async function mainNav() {
  const nav = await screen.findByRole('navigation', { name: 'Mục chính' });
  await within(nav).findAllByRole('link');
  return nav;
}

async function mainMenuLinks(): Promise<string[]> {
  const nav = await mainNav();
  return within(nav)
    .getAllByRole('link')
    .filter((a) => a.classList.contains('sh-menu__a'))
    .map((a) => a.textContent ?? '');
}

// Mục con đang hiện dưới mục đang chọn (thanh trái máy tính).
async function subMenuLinks(): Promise<string[]> {
  const nav = await mainNav();
  return [...nav.querySelectorAll('.sh-kids__a')].map((a) => a.textContent ?? '');
}

function activeMenu(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Mục chính' });
  return [...nav.querySelectorAll('a.on')].map((a) => a.textContent ?? '');
}

function phoneNavItems(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Mục chính (điện thoại)' });
  return [...nav.querySelectorAll('a,button')].map((el) => el.textContent ?? '');
}

function phoneActive(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Mục chính (điện thoại)' });
  return [...nav.querySelectorAll('.on')].map((el) => el.textContent ?? '');
}

function shellMain(): HTMLElement {
  const main = document.querySelector<HTMLElement>('main.sh-main');
  if (!main) throw new Error('Không thấy vùng nội dung của khung');
  return main;
}

function menuLink(name: string): HTMLElement {
  return within(screen.getByRole('navigation', { name: 'Mục chính' })).getByRole('link', { name });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ẩn mục điều hướng theo quyền (bản vẽ C mục 6, C2 mục 3.1)', () => {
  it('chủ tổ chức thấy đủ 8 mục, thanh dưới có Lịch · Hợp đồng · Bảng giá · Khách · Thêm; vùng nội dung có màn, không có dải 403', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/lich');
    expect(await mainMenuLinks()).toEqual(['Lịch makeup', 'Hợp đồng', 'Bảng giá', 'Khách hàng', 'Thợ makeup', 'Báo cáo', 'Mẫu thiết kế', 'Cài đặt']);
    expect(phoneNavItems()).toEqual(['Lịch', 'Hợp đồng', 'Bảng giá', 'Khách', 'Thêm']);
    expect(activeMenu()).toEqual(['Lịch makeup']);
    expect(within(shellMain()).queryByRole('alert', { name: /không có quyền/ })).toBeNull();
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

  it('vào thẳng đường không có quyền → dải 403 là thứ duy nhất trong vùng nội dung', async () => {
    setupServer(SCHEDULE_ONLY);
    renderAt('/hoa-dao/hop-dong');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Bạn không có quyền xem hợp đồng.');
    expect(shellMain().textContent).toBe('Bạn không có quyền xem hợp đồng.');
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/hoa-dao/lich'));
  });
});

describe('menu con theo quyền (C2 mục 1.1, 3.1, 4.1)', () => {
  it('Thợ makeup: staff.read → chỉ "Thợ & bậc lương"; thêm payroll.read → có "Tiền công theo gói"', async () => {
    setupServer(ARTIST);
    renderAt('/hoa-dao/nhan-su');
    await waitFor(async () => expect(await subMenuLinks()).toEqual(['Thợ & bậc lương']));
    expect(activeMenu()).toEqual(['Thợ makeup', 'Thợ & bậc lương']);
  });

  it('Thợ makeup đủ quyền: hai mục con; ở /nhan-su/tien-cong/goi/:id mục con "Tiền công theo gói" đang chọn, có nút quay lại', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/nhan-su/tien-cong/goi/g-1');
    await waitFor(async () => expect(await subMenuLinks()).toEqual(['Thợ & bậc lương', 'Tiền công theo gói']));
    expect(activeMenu()).toEqual(['Thợ makeup', 'Tiền công theo gói']);
    expect(screen.getByRole('link', { name: 'Quay lại' }).getAttribute('href')).toBe('/hoa-dao/nhan-su/tien-cong');
  });

  it('chỉ có payroll.read (không staff.read): vẫn thấy "Thợ makeup", trỏ tới Tiền công; vào /nhan-su → 403', async () => {
    setupServer(['org.read', 'schedule.read_own', 'payroll.read']);
    renderAt('/hoa-dao/nhan-su');
    expect(await mainMenuLinks()).toEqual(['Lịch makeup', 'Thợ makeup']);
    expect(menuLink('Thợ makeup').getAttribute('href')).toBe('/hoa-dao/nhan-su/tien-cong');
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem thợ makeup.');
  });

  it('Hợp đồng: ở /thu-tien (đường không bắt đầu bằng hop-dong) mục "Hợp đồng" và mục con "Thu tiền" đang chọn', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/thu-tien');
    await waitFor(async () => expect(await subMenuLinks()).toEqual(['Lập hợp đồng', 'Danh sách hợp đồng', 'Thu tiền']));
    expect(activeMenu()).toEqual(['Hợp đồng', 'Thu tiền']);
    expect(menuLink('Hợp đồng').getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('.sh-top__title')?.textContent).toBe('Thu tiền');
  });

  it('Hợp đồng: /thu-tien/:contractId → vẫn "Thu tiền", nút quay lại về /thu-tien', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/thu-tien/hd-1');
    await waitFor(() => expect(activeMenu()).toEqual(['Hợp đồng', 'Thu tiền']));
    expect(screen.getByRole('link', { name: 'Quay lại' }).getAttribute('href')).toBe('/hoa-dao/thu-tien');
  });

  it('Hợp đồng chỉ có contracts.read: chỉ "Danh sách hợp đồng"; /hop-dong/moi (cần contracts.write) → 403; /thu-tien → 403', async () => {
    setupServer(['org.read', 'schedule.read_own', 'contracts.read']);
    const router = renderAt('/hoa-dao/hop-dong');
    await waitFor(async () => expect(await subMenuLinks()).toEqual(['Danh sách hợp đồng']));
    // Menu đang chọn tính lại sau khi đường đổi xong — chờ, đừng đọc ngay (bài chập chờn khi máy bận, báo cáo Y3).
    await waitFor(() => expect(activeMenu()).toEqual(['Hợp đồng', 'Danh sách hợp đồng']));
    await act(() => router.navigate('/hoa-dao/hop-dong/moi'));
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền lập hợp đồng.');
    await act(() => router.navigate('/hoa-dao/thu-tien'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Bạn không có quyền xem thu tiền.'));
  });

  it('Báo cáo hiện với payments.read mà không reports.read (lễ tân): thấy Sổ thu, không thấy Doanh thu; /bao-cao → Sổ thu', async () => {
    setupServer(RECEPTIONIST);
    const router = renderAt('/hoa-dao/bao-cao');
    await waitFor(() => expect(router.state.location.pathname).toBe('/hoa-dao/bao-cao/so-thu'));
    expect(await mainMenuLinks()).toContain('Báo cáo');
    expect(menuLink('Báo cáo').getAttribute('href')).toBe('/hoa-dao/bao-cao/so-thu');
    expect(await subMenuLinks()).toEqual(['Sổ thu']);
    // Menu đang chọn tính lại sau khi đường đổi xong — chờ, đừng đọc ngay (bài chập chờn khi máy bận, báo cáo Y3).
    await waitFor(() => expect(activeMenu()).toEqual(['Báo cáo', 'Sổ thu']));
    await act(() => router.navigate('/hoa-dao/bao-cao/doanh-thu'));
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem doanh thu.');
  });

  it('không có reports.read lẫn payments.read → không có mục Báo cáo; /bao-cao → 403', async () => {
    setupServer(ARTIST);
    renderAt('/hoa-dao/bao-cao');
    expect(await mainMenuLinks()).not.toContain('Báo cáo');
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem báo cáo.');
  });

  it('Cài đặt: /cai-dat chuyển tới Hồ sơ thương hiệu, mục con đang chọn', async () => {
    setupServer(OWNER);
    const router = renderAt('/hoa-dao/cai-dat');
    await waitFor(() => expect(router.state.location.pathname).toBe('/hoa-dao/cai-dat/thuong-hieu'));
    await waitFor(async () => expect(await subMenuLinks()).toEqual(['Hồ sơ thương hiệu']));
    // Màn thật (không còn "Đang dựng") cần vài chục ms mới hiện trong jsdom — chờ, đừng đọc ngay.
    await waitFor(() => expect(activeMenu()).toEqual(['Cài đặt', 'Hồ sơ thương hiệu']));
  });

  it('ở Bảng giá: hiện menu con dưới mục đang chọn', async () => {
    setupServer(OWNER);
    renderAt('/hoa-dao/bang-gia/goi');
    await mainMenuLinks();
    expect(menuLink('Gói theo nhân vật').className).toContain('on');
  });
});

describe('thanh dưới điện thoại theo loại tổ chức (C3 mục 1.0)', () => {
  it('ACADEMY: Lịch · Hợp đồng · Thu tiền · Khoá học · Thêm (màn Khoá & lớp đã có); ở /thu-tien ô "Thu tiền" đang chọn', async () => {
    setupServer(OWNER, { kind: 'ACADEMY' });
    renderAt('/hoa-dao/thu-tien');
    await mainMenuLinks();
    expect(phoneNavItems()).toEqual(['Lịch', 'Hợp đồng', 'Thu tiền', 'Khoá học', 'Thêm']);
    expect(phoneActive()).toEqual(['Thu tiền']);
  });

  it('ACADEMY: ngăn "Thêm" có Bảng giá, Khách hàng, Thợ makeup, Báo cáo, Mẫu thiết kế, Cài đặt', async () => {
    setupServer(OWNER, { kind: 'ACADEMY' });
    renderAt('/hoa-dao/hop-dong');
    await mainMenuLinks();
    expect(phoneActive()).toEqual(['Hợp đồng']);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Mục chính (điện thoại)' })).getByRole('button', { name: 'Thêm' }));
    const sheet = await screen.findByRole('dialog', { name: 'Thêm' });
    const list = sheet.querySelector('.sh-more__list');
    expect([...(list?.querySelectorAll('a') ?? [])].map((a) => a.textContent)).toEqual(['Bảng giá', 'Khách hàng', 'Thợ makeup', 'Báo cáo', 'Mẫu thiết kế', 'Cài đặt']);
  });

  it('INDIVIDUAL: Lịch · Hợp đồng · Bảng giá · Khách · Thêm; ở /thu-tien ô "Hợp đồng" đang chọn', async () => {
    setupServer(OWNER, { kind: 'INDIVIDUAL' });
    renderAt('/hoa-dao/thu-tien');
    await mainMenuLinks();
    expect(phoneNavItems()).toEqual(['Lịch', 'Hợp đồng', 'Bảng giá', 'Khách', 'Thêm']);
    expect(phoneActive()).toEqual(['Hợp đồng']);
  });

  it('INDIVIDUAL: ở Báo cáo ô "Thêm" đang chọn', async () => {
    setupServer(OWNER, { kind: 'INDIVIDUAL' });
    renderAt('/hoa-dao/bao-cao/doanh-thu');
    await mainMenuLinks();
    expect(phoneActive()).toEqual(['Thêm']);
  });
});

describe('đường ngoài khung tổ chức', () => {
  it('/trang/:slug mở được khi chưa đăng nhập, không chuyển trang, không khôi phục phiên', async () => {
    const fetchMock = setupServer('anonymous');
    const router = renderAt('/trang/hoa-dao');
    await act(async () => undefined);
    expect(router.state.location.pathname).toBe('/trang/hoa-dao');
    expect(screen.queryByRole('navigation', { name: 'Mục chính' })).toBeNull();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/'))).toBe(false);
  });

  it('/quan-tri khi chưa đăng nhập → chuyển tới đăng nhập (nhớ trang định vào)', async () => {
    setupServer('anonymous');
    const router = renderAt('/quan-tri/to-chuc');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dang-nhap'));
    expect(router.state.location.state).toEqual({ from: '/quan-tri/to-chuc' });
  });

  it('/quan-tri đã đăng nhập → không dùng khung tổ chức', async () => {
    setupServer(OWNER);
    const router = renderAt('/quan-tri');
    await waitFor(() => expect(router.state.location.pathname).toBe('/quan-tri'));
    await act(async () => undefined);
    expect(screen.queryByRole('navigation', { name: 'Mục chính' })).toBeNull();
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
    renderAt('/hoa-dao/khach-hang');
    await mainMenuLinks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/Mất kết nối mạng/)).toBeTruthy();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/Mất kết nối mạng/)).toBeNull();
  });
});

describe('nav.ts', () => {
  it('quyền của mục và mục con đúng bản vẽ C mục 6 + C2 mục 1.1, 3.1, 4.1', () => {
    expect(NAV_ITEMS.map((i) => [i.key, i.permission, (i.children ?? []).map((c) => [c.path, c.permission ?? i.permission])])).toEqual([
      ['lich', 'schedule.read_own', []],
      [
        'hop-dong',
        'contracts.read',
        [
          ['hop-dong/moi', 'contracts.write'],
          ['hop-dong', 'contracts.read'],
          ['thu-tien', 'payments.read'],
        ],
      ],
      [
        'bang-gia',
        'catalog.read',
        [
          ['bang-gia/goi', 'catalog.read'],
          ['bang-gia/dich-vu', 'catalog.read'],
          ['bang-gia/di-chuyen', 'catalog.read'],
          ['bang-gia/nhan-vat', 'catalog.read'],
        ],
      ],
      ['khach-hang', 'customers.read', []],
      [
        'nhan-su',
        'staff.read',
        [
          ['nhan-su', 'staff.read'],
          ['nhan-su/tien-cong', 'payroll.read'],
        ],
      ],
      [
        'bao-cao',
        undefined,
        [
          ['bao-cao/doanh-thu', 'reports.read'],
          ['bao-cao/so-thu', 'payments.read'],
        ],
      ],
      ['dao-tao', 'courses.read', []],
      ['mau-thiet-ke', 'designs.read', []],
      ['cai-dat', 'org.update', [['cai-dat/thuong-hieu', 'org.update']]],
    ]);
    expect(visibleNav(() => false)).toEqual([]);
  });

  it('bày ra được thì phải dùng được: mọi mục và mục con đều có đường thật (không rơi vào 404)', () => {
    const paths = NAV_ITEMS.flatMap((i) => [i.path, ...(i.children ?? []).map((c) => c.path)]);
    for (const p of paths) {
      const leaf = matchRoutes(routes, `/hoa-dao/${p}`)?.at(-1);
      expect(leaf?.route.path, p).not.toBe('*');
    }
    // Đào tạo đã có màn (Khoá & lớp) → đã vào bảng điều hướng, chỉ cho tổ chức ACADEMY. Mục chưa có màn chưa đưa vào.
    expect(NAV_ITEMS.find((i) => i.key === 'dao-tao')).toMatchObject({ path: 'dao-tao', permission: 'courses.read', orgKinds: ['ACADEMY'] });
    // Mẫu thiết kế đã có màn → có ở MỌI loại tổ chức (Feedback, Lời chúc dùng cho hợp đồng dịch vụ; C3 mục 1.0).
    expect(NAV_ITEMS.find((i) => i.key === 'mau-thiet-ke')).toEqual({ key: 'mau-thiet-ke', path: 'mau-thiet-ke', label: 'Mẫu thiết kế', shortLabel: 'Mẫu', icon: 'mau', permission: 'designs.read' });
    expect(matchRoutes(routes, '/hoa-dao/mau-thiet-ke/feedback')?.at(-1)?.route.path).toBe('mau-thiet-ke/*');
  });

  it('mục đang chọn và mục con đang chọn theo đường', () => {
    expect(activeNavItem('thu-tien')?.key).toBe('hop-dong');
    expect(activeNavItem('thu-tien/abc')?.key).toBe('hop-dong');
    const hd = activeNavItem('hop-dong/moi');
    expect(activeNavChild(hd, 'hop-dong/moi')?.key).toBe('hop-dong-moi');
    expect(activeNavChild(hd, 'hop-dong/9b1c')?.key).toBe('hop-dong-ds');
    expect(activeNavChild(activeNavItem('thu-tien/abc'), 'thu-tien/abc')?.key).toBe('thu-tien');
    expect(activeNavChild(activeNavItem('nhan-su/bac/chua-gan'), 'nhan-su/bac/chua-gan')?.key).toBe('tho-bac');
    expect(activeNavItem('khong-co')).toBeUndefined();
  });

  it('mục chỉ hiện nhờ mục con: Hợp đồng với payments.read trỏ tới /thu-tien; navEntryAllowed theo mục con', () => {
    const has = (p: Permission) => p === 'payments.read';
    const items = visibleNav(has);
    expect(items.map((i) => [i.key, i.href, i.children.map((c) => c.key)])).toEqual([
      ['hop-dong', 'thu-tien', ['thu-tien']],
      ['bao-cao', 'bao-cao/so-thu', ['so-thu']],
    ]);
    expect(navEntryAllowed('thu-tien', has)).toBe(true);
    expect(navEntryAllowed('hop-dong-ds', has)).toBe(false);
    expect(navEntryAllowed('doanh-thu', has)).toBe(false);
    // ACADEMY: không lặp hai ô cùng trỏ /thu-tien.
    expect(bottomNav(items, 'ACADEMY').main.map((m) => m.shortLabel)).toEqual(['Thu tiền']);
  });

  it('thêm mục Đào tạo bằng một dòng → thanh dưới ACADEMY tự có ô "Khoá học", tổ chức khác không có', () => {
    const daoTao: VisibleNavItem = { key: 'dao-tao', path: 'dao-tao', label: 'Đào tạo', shortLabel: 'Khoá học', icon: 'khoa-hoc', href: 'dao-tao', children: [], orgKinds: ['ACADEMY'] };
    const items = [...visibleNav(() => true, 'ACADEMY'), daoTao];
    const academy = bottomNav(items, 'ACADEMY');
    expect(academy.main.map((m) => m.shortLabel)).toEqual(['Lịch', 'Hợp đồng', 'Thu tiền', 'Khoá học']);
    expect(academy.rest.map((i) => i.key)).toEqual(['bang-gia', 'khach-hang', 'nhan-su', 'bao-cao', 'mau-thiet-ke', 'cai-dat']);
    expect(activeBottomKey(academy.main, activeNavItem('thu-tien'), activeNavChild(activeNavItem('thu-tien'), 'thu-tien'))).toBe('thu-tien');
    expect(bottomNav(visibleNav(() => true, 'INDIVIDUAL'), 'INDIVIDUAL').main.map((m) => m.shortLabel)).toEqual(['Lịch', 'Hợp đồng', 'Bảng giá', 'Khách']);
  });
});
