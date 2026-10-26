import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES, type SystemRoleKey } from '@makeup/shared';
import type { CertificatePage, CertificateView } from '../../api/certificates';
import { routes } from '../../app/routes';
import { permissionsValue, StaticPermissionsProvider } from '../../layout/usePermissions';
import { fakeView } from '../certificates/fixtures';
import { CustomerCertificatesCard } from './CustomerCertificatesCard';

// Thẻ "Giấy chứng nhận" trong hồ sơ học viên (bản vẽ F 6.6; ký duyệt F câu 1, câu 2): chỉ ACADEMY + certificates.read,
// 0 giấy thì ẩn, liệt kê số · khoá · lớp · ngày · trạng thái, "In lại" lấy URL ảnh mới rồi mở PrintSheet, "Xem trong sổ" → ?khach=.
configure({ asyncUtilTimeout: 5000 });

// Bản in thật cần canvas + iframe: thay bằng khối ghi lại đầu vào (PrintSheet có bài thử riêng ở features/certificates).
vi.mock('../certificates/PrintSheet', () => ({
  PrintSheet: (p: { items: CertificateView[]; baseName: string; pdfTitle: string; orgId: string }) => (
    <div data-testid="print-sheet" data-base={p.baseName} data-title={p.pdfTitle} data-org={p.orgId}>
      {p.items.map((c) => (
        <span key={c.id} data-photo={c.photo?.url ?? ''}>
          {c.code}
        </span>
      ))}
    </div>
  ),
}));

const T = '2026-10-18T03:00:00.000Z';
const ORG = 'org-1';
const CUS = 'cus-1';
const SLUG = 'hv';

interface Call {
  method: string;
  path: string;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const apiErr = (status: number, code: string, message: string) => json(status, { error: { code, message, requestId: 'r' } });

const photo = (url: string) => ({ url, expiresAt: '2026-10-18T03:10:00.000Z', width: 800, height: 800 });
const mine = (n: number, over: Partial<CertificateView> = {}) => fakeView(n, { customer: { id: CUS, fullName: 'Lê Thị Mai' }, studentName: 'Lê Thị Mai', ...over });
// Ba giấy của một học viên: bản cấp lại đang hiệu lực (0011), bản gốc 0011 đã thu hồi, giấy lớp khác (0002).
const REISSUED = mine(15, { code: 'CC-2026-0011', seq: 11, reissueNo: 1, reissuedOn: '2026-10-20', issuedOn: '2026-12-20', photo: photo('https://f/old-1') });
const REVOKED = mine(12, { code: 'CC-2026-0011', seq: 11, status: 'REVOKED', revokedAt: T, revokeReason: 'Sai tên người nhận', replacedById: REISSUED.id, issuedOn: '2026-12-20' });
const PLAIN = mine(2, { courseName: 'Trang điểm cá nhân', className: 'CN5', issuedOn: '2026-08-15', photo: photo('https://f/old-2') });
const OWN: CertificateView[] = [REISSUED, REVOKED, PLAIN];

const pageOf = (items: CertificateView[], over: Partial<CertificatePage> = {}): CertificatePage => ({ items, page: 1, pageSize: 100, total: items.length, years: [2026], ...over });

type Reply = (call: Call) => Response | undefined;

function stub(list: CertificateView[] | (() => Response), reply?: Reply) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const call: Call = { method: init?.method ?? 'GET', path: url.pathname.replace('/api/v1', '') + url.search };
      calls.push(call);
      const r = reply?.(call);
      if (r) return r;
      if (call.method === 'GET' && call.path.startsWith(`/orgs/${ORG}/certificates?`)) {
        const q = new URL(call.path, 'http://x').searchParams;
        const ids = q.get('ids');
        if (ids) return json(200, pageOf(OWN.filter((c) => ids.split(',').includes(c.id)).map((c) => ({ ...c, photo: c.photo ? photo(`${c.photo.url}-moi`) : null }))));
        return typeof list === 'function' ? list() : json(200, pageOf(list));
      }
      return apiErr(404, 'NOT_FOUND', `Không có đường ${call.method} ${call.path}`);
    }),
  );
  return calls;
}

const stateOf = (perms: readonly string[]) => ({
  status: 'ready' as const,
  org: { id: ORG, slug: SLUG, name: 'X', kind: 'ACADEMY', timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', createdAt: T, updatedAt: T, myRoles: [], myPermissions: [...perms] } as never,
  permissions: new Set(perms),
});

function renderCard(perms: readonly string[] = SYSTEM_ROLES.manager.permissions, kind: 'ACADEMY' | 'TEAM' | 'INDIVIDUAL' | 'chua-ro' = 'ACADEMY') {
  return render(
    <MemoryRouter>
      <StaticPermissionsProvider value={permissionsValue(stateOf(perms))}>
        <CustomerCertificatesCard orgId={ORG} slug={SLUG} customerId={CUS} orgKind={kind === 'chua-ro' ? undefined : kind} breakpoint="desktop" />
      </StaticPermissionsProvider>
    </MemoryRouter>,
  );
}

const card = () => screen.findByRole('region', { name: 'Giấy chứng nhận của học viên' });
const certCalls = (calls: Call[]) => calls.filter((c) => c.path.includes('/certificates'));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Thẻ Giấy chứng nhận — loại tổ chức và quyền', () => {
  it.each(['TEAM', 'INDIVIDUAL', 'chua-ro'] as const)('tổ chức %s → không hiện gì và KHÔNG gọi máy chủ', (kind) => {
    const calls = stub(OWN);
    const { container } = renderCard(SYSTEM_ROLES.owner.permissions, kind);
    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });

  // Quyền theo từng vai trò mẫu (SYSTEM_ROLES): ai có certificates.read thì thấy, ai không có thì không hiện và không gọi máy chủ.
  const ROLES = Object.keys(SYSTEM_ROLES) as SystemRoleKey[];
  const SEE: Record<SystemRoleKey, boolean> = {
    owner: true,
    admin: true,
    manager: true,
    artist: false,
    assistant: false,
    receptionist: true,
    accountant: false,
    instructor: true,
    teaching_assistant: false,
  };
  it('bảng quyền khớp đủ 9 vai trò mẫu (không vai nào bị bỏ sót)', () => {
    expect(ROLES.sort()).toEqual(Object.keys(SEE).sort());
    for (const r of ROLES) expect((SYSTEM_ROLES[r].permissions as readonly string[]).includes('certificates.read')).toBe(SEE[r]);
  });
  it.each(ROLES)('vai trò %s', async (role) => {
    const calls = stub(OWN);
    const { container } = renderCard(SYSTEM_ROLES[role].permissions);
    if (SEE[role]) {
      const c = await card();
      expect(within(c).getByText('CC-2026-0002 · cấp 15/08/2026')).toBeTruthy();
    } else {
      expect(container.textContent).toBe('');
      expect(certCalls(calls)).toHaveLength(0);
    }
  });

  it('chỉ có certificates.read (Lễ tân, Giảng viên): vẫn In lại được, và thẻ không có nút cấp / cấp lại / thu hồi', async () => {
    stub(OWN);
    renderCard(['certificates.read']);
    const c = await card();
    expect(within(c).getAllByRole('button', { name: /^In lại / })).toHaveLength(2);
    expect(within(c).queryByRole('button', { name: /Cấp|Thu hồi/ })).toBeNull();
  });
});

describe('Thẻ Giấy chứng nhận — danh sách', () => {
  it('gọi đúng đường danh sách theo học viên (customerId, tối đa 100 dòng)', async () => {
    const calls = stub(OWN);
    renderCard();
    await card();
    const list = calls.find((c) => c.path.startsWith(`/orgs/${ORG}/certificates?`));
    expect(list?.method).toBe('GET');
    const q = new URL(list?.path ?? '', 'http://x').searchParams;
    expect(q.get('customerId')).toBe(CUS);
    expect(q.get('pageSize')).toBe('100');
  });

  it('0 giấy → ẩn cả thẻ (không nháy thẻ rồi mất)', async () => {
    const calls = stub([]);
    const { container } = renderCard();
    await waitFor(() => expect(certCalls(calls)).toHaveLength(1));
    await waitFor(() => expect(container.textContent).toBe(''));
    expect(screen.queryByRole('region', { name: 'Giấy chứng nhận của học viên' })).toBeNull();
  });

  it('mỗi giấy: "{khoá} · {lớp}", "{số} · cấp dd/mm/yyyy", trạng thái (hiệu lực / bản cấp lại / đã thu hồi + lý do)', async () => {
    stub(OWN);
    renderCard();
    const c = await card();
    const rows = within(c).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    const [reissued, revoked, plain] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(reissued).getByText('Makeup chuyên nghiệp · K12')).toBeTruthy();
    expect(within(reissued).getByText('CC-2026-0011 · cấp 20/12/2026')).toBeTruthy();
    expect(within(reissued).getByText('Hiệu lực · bản cấp lại 20/10/2026')).toBeTruthy();
    expect(within(revoked).getByText('Đã thu hồi')).toBeTruthy();
    expect(within(revoked).getByText('Lý do: Sai tên người nhận')).toBeTruthy();
    expect(within(plain).getByText('Trang điểm cá nhân · CN5')).toBeTruthy();
    expect(within(plain).getByText('CC-2026-0002 · cấp 15/08/2026')).toBeTruthy();
    expect(within(plain).getByText('Hiệu lực')).toBeTruthy();
    expect(within(c).getByText('3 giấy')).toBeTruthy();
  });

  it('bản đã thu hồi KHÔNG có nút "In lại"; bản hiệu lực có', async () => {
    stub(OWN);
    renderCard();
    const c = await card();
    const [reissued, revoked, plain] = within(c).getAllByRole('listitem') as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(reissued).getByRole('button', { name: 'In lại CC-2026-0011' })).toBeTruthy();
    expect(within(revoked).queryByRole('button')).toBeNull();
    expect(within(plain).getByRole('button', { name: 'In lại CC-2026-0002' })).toBeTruthy();
  });

  it('"Xem trong sổ" dẫn tới /:slug/giay-chung-nhan?khach=<mã học viên>', async () => {
    stub(OWN);
    renderCard();
    const link = within(await card()).getByRole('link', { name: 'Xem trong sổ' });
    expect(link.getAttribute('href')).toBe(`/${SLUG}/giay-chung-nhan?khach=${CUS}`);
  });

  it('lỗi 500 khi tải → dải lỗi + Thử lại; thử lại được thì hiện danh sách', async () => {
    let fail = true;
    stub(() => (fail ? apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi') : json(200, pageOf(OWN))));
    renderCard();
    const c = await card();
    expect(within(c).getByRole('alert')).toBeTruthy();
    fail = false;
    await userEvent.setup().click(within(c).getByRole('button', { name: /Thử lại/ }));
    expect(await within(await card()).findByText('CC-2026-0002 · cấp 15/08/2026')).toBeTruthy();
  });
});

describe('Thẻ Giấy chứng nhận — In lại', () => {
  it('lấy URL ảnh MỚI của đúng giấy (GET ?ids=) rồi mở PrintSheet một bản, tên tệp theo số giấy', async () => {
    const calls = stub(OWN);
    renderCard();
    const c = await card();
    await userEvent.setup().click(within(c).getByRole('button', { name: 'In lại CC-2026-0002' }));
    const sheet = await screen.findByTestId('print-sheet');
    const ids = calls.find((x) => x.path.includes('ids='));
    expect(new URL(ids?.path ?? '', 'http://x').searchParams.get('ids')).toBe(PLAIN.id);
    expect(sheet.getAttribute('data-base')).toBe('Giay-chung-nhan-CC-2026-0002');
    expect(sheet.getAttribute('data-title')).toBe('Giấy chứng nhận CC-2026-0002');
    expect(sheet.getAttribute('data-org')).toBe(ORG);
    const items = within(sheet).getAllByText(/^CC-/);
    expect(items).toHaveLength(1);
    // Ảnh là URL vừa lấy lại, không phải URL cũ trong danh sách (URL ký chỉ sống 10 phút).
    expect(items[0]?.getAttribute('data-photo')).toBe('https://f/old-2-moi');
    expect(screen.getByRole('dialog', { name: /In lại giấy chứng nhận CC-2026-0002/ })).toBeTruthy();
  });

  it('bấm "Xong" đóng hộp in', async () => {
    stub(OWN);
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'In lại CC-2026-0002' }));
    await screen.findByTestId('print-sheet');
    await user.click(screen.getByRole('button', { name: 'Xong' }));
    await waitFor(() => expect(screen.queryByTestId('print-sheet')).toBeNull());
  });

  it('giấy vừa bị thu hồi ở máy khác → báo bằng lời, KHÔNG mở bản in, tải lại danh sách', async () => {
    let calls: Call[] = [];
    calls = stub(OWN, (c) => {
      if (c.path.includes('ids=')) return json(200, pageOf([{ ...PLAIN, status: 'REVOKED', revokedAt: T, revokeReason: 'Nhầm' }]));
      return undefined;
    });
    renderCard();
    await userEvent.setup().click(within(await card()).getByRole('button', { name: 'In lại CC-2026-0002' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Giấy CC-2026-0002 không còn hiệu lực');
    expect(screen.queryByTestId('print-sheet')).toBeNull();
    await waitFor(() => expect(calls.filter((c) => c.path.includes('customerId=')).length).toBe(2));
  });

  it('máy chủ lỗi khi lấy giấy để in → báo lỗi tiếng Việt, không mở bản in, bấm lại được', async () => {
    let fail = true;
    stub(OWN, (c) => (c.path.includes('ids=') && fail ? apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại.') : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'In lại CC-2026-0002' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa lấy được giấy để in');
    expect(screen.queryByTestId('print-sheet')).toBeNull();
    fail = false;
    await user.click(within(await card()).getByRole('button', { name: 'In lại CC-2026-0002' }));
    expect(await screen.findByTestId('print-sheet')).toBeTruthy();
  });
});

// Trong hồ sơ học viên thật (CustomerDetail): chỗ đặt thẻ, và ACADEMY / quyền quyết định có gọi máy chủ hay không.
describe('CustomerDetail — chỗ đặt thẻ Giấy chứng nhận', () => {
  const CUSTOMER = { id: 'k1', fullName: 'Lê Thị Mai', phone: '0912222333', email: null, note: null, avatarFileId: null, avatarUrl: null, createdAt: T, updatedAt: T };

  function server(kind: 'ACADEMY' | 'TEAM', permissions: readonly string[], certs: CertificateView[] = OWN) {
    const org = { membershipId: 'm-1', id: ORG, name: 'Học viện', slug: SLUG, kind, roles: [{ key: 'owner', name: 'Chủ' }] };
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'http://localhost');
        const path = url.pathname.replace('/api/v1', '');
        calls.push({ method: init?.method ?? 'GET', path: path + url.search });
        if (path === '/auth/refresh') return json(200, { accessToken: 't', expiresIn: 900 });
        if (path === '/auth/me') return json(200, { id: 'u', email: 'a@b.vn', fullName: 'Chiến', organizations: [org] });
        if (path === `/orgs/${ORG}`) return json(200, { ...org, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
        if (path === `/orgs/${ORG}/customers`) return json(200, { items: [CUSTOMER], page: 1, pageSize: 20, total: 1 });
        if (path === `/orgs/${ORG}/customers/k1`) return json(200, CUSTOMER);
        if (path === `/orgs/${ORG}/contracts`) return json(200, { items: [], page: 1, pageSize: 10, total: 0 });
        if (path === `/orgs/${ORG}/customers/k1/portal`) return json(200, { eligible: { ok: true, reasons: [] }, phoneLast4: '2333', hasCourseContract: true, link: null, devices: [], limits: { linkTtlDays: 7, maxDevices: 2, maxFailed: 5, rememberDays: 90 } });
        if (path === `/orgs/${ORG}/certificates`) return json(200, pageOf(certs));
        return apiErr(404, 'NOT_FOUND', path);
      }),
    );
    return calls;
  }
  const open = () => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [`/${SLUG}/khach-hang/k1`] })} />);

  it('ACADEMY + chủ: thẻ nằm SAU thẻ Hợp đồng và SAU thẻ Cổng học viên (Cổng giữ nguyên chỗ ngay sau Hợp đồng)', async () => {
    const calls = server('ACADEMY', SYSTEM_ROLES.owner.permissions);
    open();
    const cert = await screen.findByRole('region', { name: 'Giấy chứng nhận của học viên' });
    const contracts = screen.getByRole('region', { name: 'Hợp đồng của khách' });
    const portal = await screen.findByRole('region', { name: 'Cổng học viên' });
    expect(contracts.compareDocumentPosition(portal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(portal.compareDocumentPosition(cert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const list = calls.find((c) => c.path.startsWith(`/orgs/${ORG}/certificates?`));
    expect(new URL(list?.path ?? '', 'http://x').searchParams.get('customerId')).toBe('k1');
  });

  it('tổ chức TEAM: không có thẻ và không gọi đường giấy chứng nhận', async () => {
    const calls = server('TEAM', SYSTEM_ROLES.owner.permissions);
    open();
    await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    expect(screen.queryByRole('region', { name: 'Giấy chứng nhận của học viên' })).toBeNull();
    expect(certCalls(calls)).toHaveLength(0);
  });

  it('thiếu certificates.read: không có thẻ và không gọi đường giấy chứng nhận', async () => {
    const calls = server('ACADEMY', SYSTEM_ROLES.owner.permissions.filter((p) => p !== 'certificates.read'));
    open();
    await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    expect(screen.queryByRole('region', { name: 'Giấy chứng nhận của học viên' })).toBeNull();
    expect(certCalls(calls)).toHaveLength(0);
  });

  it('học viên chưa có giấy nào: ẩn thẻ', async () => {
    const calls = server('ACADEMY', SYSTEM_ROLES.owner.permissions, []);
    open();
    await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    await waitFor(() => expect(certCalls(calls)).toHaveLength(1));
    expect(screen.queryByRole('region', { name: 'Giấy chứng nhận của học viên' })).toBeNull();
  });
  it('đổi sang học viên khác: KHÔNG hiện lại giấy của học viên trước trong lúc chờ (tránh In lại nhầm người)', async () => {
    const other = { ...CUSTOMER, id: 'k2', fullName: 'Phạm Quỳnh Hương' };
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const org = { membershipId: 'm-1', id: ORG, name: 'Học viện', slug: SLUG, kind: 'ACADEMY', roles: [{ key: 'owner', name: 'Chủ' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'http://localhost');
        const path = url.pathname.replace('/api/v1', '');
        if (path === '/auth/refresh') return json(200, { accessToken: 't', expiresIn: 900 });
        if (path === '/auth/me') return json(200, { id: 'u', email: 'a@b.vn', fullName: 'Chiến', organizations: [org] });
        if (path === `/orgs/${ORG}`) return json(200, { ...org, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...SYSTEM_ROLES.owner.permissions] });
        if (path === `/orgs/${ORG}/customers`) return json(200, { items: [CUSTOMER, other], page: 1, pageSize: 20, total: 2 });
        if (path === `/orgs/${ORG}/customers/k1`) return json(200, CUSTOMER);
        if (path === `/orgs/${ORG}/customers/k2`) return json(200, other);
        if (path === `/orgs/${ORG}/contracts`) return json(200, { items: [], page: 1, pageSize: 10, total: 0 });
        if (path.endsWith('/portal')) return json(200, { eligible: { ok: true, reasons: [] }, phoneLast4: '2333', hasCourseContract: true, link: null, devices: [], limits: { linkTtlDays: 7, maxDevices: 2, maxFailed: 5, rememberDays: 90 } });
        if (path === `/orgs/${ORG}/certificates`) {
          if (url.searchParams.get('customerId') === 'k2') {
            await gate;
            return json(200, pageOf([]));
          }
          return json(200, pageOf(OWN));
        }
        return apiErr(404, 'NOT_FOUND', path);
      }),
    );
    open();
    const first = await screen.findByRole('region', { name: 'Giấy chứng nhận của học viên' });
    expect(within(first).getByText('CC-2026-0002 · cấp 15/08/2026')).toBeTruthy();
    await userEvent.setup().click(await screen.findByRole('link', { name: /Phạm Quỳnh Hương/ }));
    await waitFor(() => expect(screen.queryByText('CC-2026-0002 · cấp 15/08/2026')).toBeNull());
    release();
  });
});
