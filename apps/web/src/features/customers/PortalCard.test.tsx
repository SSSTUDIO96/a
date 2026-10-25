import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { portalMessage, type PortalAdminView } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import { forbiddenMessage, requiredPermissions } from '../../api/portal';
import { permissionsValue, StaticPermissionsProvider } from '../../layout/usePermissions';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';
import { PortalCard } from './PortalCard';
import { PORTAL_CONSEQUENCE, PORTAL_CONSEQUENCE_MAX } from './logic';

// Thẻ Cổng học viên (bản vẽ E 5.2): quyền, trạng thái, chìa chỉ hiện một lần, chặn máy, thu hồi, lỗi 403 mảng lẫn chuỗi.
configure({ asyncUtilTimeout: 5000 });

const ORG = 'org-1';
const CUS = 'cus-1';
const KEY = 'Q7xK2m9vR4tLp8WcAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const T = '2026-10-20T03:00:00.000Z';

const FULL = ['portal.manage', 'customers.read', 'contracts.read', 'payments.read'];

const view = (over: Partial<PortalAdminView> = {}): PortalAdminView => ({
  eligible: { ok: true, reasons: [] },
  phoneLast4: '4321',
  hasCourseContract: true,
  link: null,
  devices: [],
  limits: { linkTtlDays: 7, maxDevices: 2, maxFailed: 5, rememberDays: 90 },
  ...over,
});
const link = (status: NonNullable<PortalAdminView['link']>['status'], over = {}) => ({
  status,
  createdAt: '2026-10-19T03:00:00.000Z',
  createdByName: 'Chiến',
  expiresAt: '2026-10-26T03:00:00.000Z',
  firstOpenedAt: null,
  failedAttempts: 0,
  devicesUsed: 0,
  ...over,
});
const device = (id: string, status: 'ACTIVE' | 'BLOCKED' = 'ACTIVE') => ({
  id,
  label: 'iPhone · Safari',
  createdAt: '2026-10-19T13:14:00.000Z',
  lastSeenAt: '2026-10-20T00:52:00.000Z',
  status,
  endedAt: status === 'ACTIVE' ? null : T,
  endedByName: status === 'ACTIVE' ? null : 'Chiến',
});

interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}
type Reply = (call: Call) => Response | undefined;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

function setup(initial: PortalAdminView, reply?: Reply) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const call: Call = {
        method: init?.method ?? 'GET',
        path: url.pathname.replace('/api/v1', '') + url.search,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        headers: { ...(init?.headers as Record<string, string>) },
      };
      calls.push(call);
      const r = reply?.(call);
      if (r) return r;
      if (call.method === 'GET' && call.path === `/orgs/${ORG}/customers/${CUS}/portal`) return json(200, initial);
      return err(404, 'NOT_FOUND', `Không có đường ${call.method} ${call.path}`);
    }),
  );
  return calls;
}

function renderCard(perms: readonly string[] = FULL, kind: 'ACADEMY' | 'TEAM' | 'INDIVIDUAL' | undefined | 'chua-ro' = 'ACADEMY') {
  const state = {
    status: 'ready' as const,
    org: { id: ORG, slug: 'chien', name: 'X', kind: 'ACADEMY', timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', createdAt: T, updatedAt: T, myRoles: [], myPermissions: [...perms] } as never,
    permissions: new Set(perms),
  };
  return render(
    <StaticPermissionsProvider value={permissionsValue(state)}>
      <PortalCard orgId={ORG} customerId={CUS} orgKind={kind === 'chua-ro' ? undefined : kind} timezone="Asia/Ho_Chi_Minh" />
    </StaticPermissionsProvider>,
  );
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');
const card = () => screen.findByRole('region', { name: 'Cổng học viên' });

let clip: ReturnType<typeof vi.fn>;
beforeEach(() => {
  clip = vi.fn(async () => undefined);
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-25T03:00:00.000Z'));
});
// userEvent.setup() thay navigator.clipboard bằng bản giả của nó → đặt bản của bài thử SAU khi setup.
function userWithClipboard(withClipboard = true) {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', { value: withClipboard ? { writeText: clip } : undefined, configurable: true });
  return user;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('PortalCard — quyền và loại tổ chức', () => {
  it('thiếu portal.manage → không hiện gì và không gọi máy chủ', () => {
    const calls = setup(view());
    const { container } = renderCard(['customers.read', 'contracts.read', 'payments.read']);
    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });

  it('tổ chức không phải ACADEMY (hoặc chưa rõ loại) → không hiện gì và không gọi máy chủ', () => {
    const calls = setup(view());
    expect(renderCard(FULL, 'TEAM').container.textContent).toBe('');
    expect(renderCard(FULL, 'chua-ro').container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });

  it('có portal.manage nhưng thiếu quyền xem phiếu thu → xem được thẻ, KHÔNG có nút tạo, có lời nêu lý do', async () => {
    setup(view({ link: link('ACTIVE') }));
    renderCard(['portal.manage', 'customers.read', 'contracts.read']);
    const c = await card();
    expect(within(c).getByText('Đang mở')).toBeTruthy();
    expect(within(c).queryByRole('button', { name: /Tạo đường dẫn/ })).toBeNull();
    expect(within(c).getByText('Gửi đường dẫn cần thêm quyền xem khách hàng, hợp đồng và phiếu thu.')).toBeTruthy();
    // Thu hồi chỉ cần portal.manage.
    expect(within(c).getByRole('button', { name: 'Thu hồi đường dẫn và chặn mọi máy' })).toBeTruthy();
  });
});

describe('PortalCard — trạng thái', () => {
  it('chưa có số điện thoại: nút "Tạo đường dẫn" bị khoá + lời nhắc thêm số', async () => {
    setup(view({ eligible: { ok: false, reasons: ['NO_PHONE'] }, phoneLast4: null }));
    renderCard();
    const c = await card();
    expect((within(c).getByRole('button', { name: 'Tạo đường dẫn' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(c).getByText('Thêm số điện thoại cho học viên trước.')).toBeTruthy();
  });

  it('chưa gửi: nhãn "Chưa gửi", nút chính "Tạo đường dẫn"; chưa có hợp đồng khoá học → dải xám', async () => {
    setup(view({ hasCourseContract: false }));
    renderCard();
    const c = await card();
    expect(within(c).getByText('Chưa gửi')).toBeTruthy();
    expect(within(c).getByRole('button', { name: 'Tạo đường dẫn' }).className).toContain('ui-btn--primary');
    expect(within(c).getByText('Học viên chưa có hợp đồng khoá học đã xác nhận — trang sẽ trống.')).toBeTruthy();
    expect(within(c).queryByRole('button', { name: /Thu hồi/ })).toBeNull();
  });

  it.each([
    ['REVOKED', 'Đã thu hồi'],
    ['EXPIRED', 'Hết hạn'],
    ['LOCKED', 'Bị khoá'],
    ['FULL', 'Đủ 2 máy'],
    ['ACTIVE', 'Đang mở'],
  ] as const)('link %s → nhãn "%s"', async (status, label) => {
    setup(view({ link: link(status, { devicesUsed: status === 'FULL' ? 2 : 0 }) }));
    renderCard();
    expect(within(await card()).getByText(label)).toBeTruthy();
  });

  it('bị khoá: nêu "nhập sai 5 lần"; chân thẻ luôn có dòng hạn 7 ngày / khoá 5 lần', async () => {
    setup(view({ link: link('LOCKED', { failedAttempts: 5 }) }));
    renderCard();
    const c = await card();
    expect(within(c).getByText(/Bị khoá vì nhập sai 5 lần/)).toBeTruthy();
    // L2: dòng xám nằm TRONG thẻ, ở chân thẻ (bản vẽ 5.2), không phải khối riêng dưới thẻ.
    const line = within(c).getByText('Đường dẫn chưa mở hết hạn sau 7 ngày. Nhập sai 4 số cuối 5 lần là khoá, trung tâm phải tạo đường dẫn mới.');
    expect(line.closest('footer')).toBeTruthy();
    expect(c.contains(line)).toBe(true);
  });

  it('chân thẻ: nút "Thu hồi…" rồi tới dòng xám, cùng nằm trong <footer> của thẻ', async () => {
    setup(view({ link: link('ACTIVE') }));
    renderCard();
    const foot = (await card()).querySelector('footer');
    expect(foot).toBeTruthy();
    const f = within(foot as HTMLElement);
    const btn = f.getByRole('button', { name: 'Thu hồi đường dẫn và chặn mọi máy' });
    const line = f.getByText(/Đường dẫn chưa mở hết hạn sau 7 ngày/);
    expect(btn.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('danh sách máy: tên, mở lần đầu · lần cuối, nút "Chặn máy này" chỉ ở máy đang dùng', async () => {
    setup(view({ link: link('ACTIVE', { devicesUsed: 2, firstOpenedAt: T }), devices: [device('d1'), device('d2', 'BLOCKED')] }));
    renderCard();
    const c = await card();
    const list = within(await within(c).findByRole('region', { name: 'Máy đã mở cổng' }));
    expect(list.getAllByText('iPhone · Safari')).toHaveLength(2);
    // L1: tiêu đề ghi "(n/2)" = số suất đã dùng của đường dẫn hiện tại (cùng số với nhãn "Đủ 2 máy"), không phải "(tối đa 2)".
    expect(list.getByRole('heading', { name: /Máy đã mở cổng/ }).textContent).toBe('Máy đã mở cổng (2/2)');
    expect(list.queryByText(/tối đa/)).toBeNull();
    expect(list.getAllByRole('button', { name: /Chặn máy/ })).toHaveLength(1);
    expect(list.getByText('Đã chặn')).toBeTruthy();
    expect(list.getAllByText(/Mở lần đầu 19\/10 20:14 · lần cuối 20\/10 07:52/).length).toBeGreaterThan(0);
  });
});

describe('PortalCard — "Máy đã mở (n/2)"', () => {
  it('mới mở 1 máy → (1/2); đã chặn máy cũ vẫn tính suất đã dùng', async () => {
    setup(view({ link: link('ACTIVE', { devicesUsed: 1, firstOpenedAt: T }), devices: [device('d1')] }));
    renderCard();
    const list = within(await within(await card()).findByRole('region', { name: 'Máy đã mở cổng' }));
    expect(list.getByRole('heading', { name: /Máy đã mở cổng/ }).textContent).toBe('Máy đã mở cổng (1/2)');
  });
});

describe('PortalCard — tạo đường dẫn, chìa chỉ hiện một lần', () => {
  const created = (v: PortalAdminView) => ({ key: KEY, expiresAt: '2026-10-27T03:00:00.000Z', callName: 'Thảo', centerName: 'Chiến Makeup Academy', view: v });

  it('hộp xác nhận: nêu 4 số cuối, nút "Tạo" khoá tới khi tick; gửi {phoneConfirmed:true} không kèm Idempotency-Key', async () => {
    const after = view({ link: link('ACTIVE') });
    const calls = setup(view(), (c) => (c.method === 'POST' ? json(201, created(after)) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    const dlg = within(await screen.findByRole('dialog'));
    expect(dlg.getByText('4321')).toBeTruthy();
    const create = dlg.getByRole('button', { name: 'Tạo' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    await user.click(dlg.getByRole('checkbox'));
    expect(create.disabled).toBe(false);
    await user.click(create);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toHaveLength(1);
    expect(writes(calls)[0]).toMatchObject({ method: 'POST', path: `/orgs/${ORG}/customers/${CUS}/portal/links`, body: { phoneConfirmed: true } });
    expect(writes(calls)[0]!.headers['Idempotency-Key']).toBeUndefined();
  });

  it('vừa tạo: hộp tin nhắn có chìa + "Sao chép tin nhắn" chép đúng chữ portalMessage; chìa không vào URL / localStorage / sessionStorage', async () => {
    setup(view(), (c) => (c.method === 'POST' ? json(201, created(view({ link: link('ACTIVE') }))) : undefined));
    renderCard();
    const user = userWithClipboard();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
    const box = await screen.findByTestId('portal-message');
    const expected = portalMessage({ callName: 'Thảo', centerName: 'Chiến Makeup Academy', url: `${window.location.origin}/hv#k=${KEY}` });
    expect(box.textContent).toBe(expected);
    expect(screen.getByText(/Tin này chỉ hiện/).textContent).toContain('một lần');
    await user.click(screen.getByRole('button', { name: 'Sao chép tin nhắn' }));
    expect(clip).toHaveBeenCalledTimes(1);
    expect(clip).toHaveBeenCalledWith(expected);
    expect(await screen.findByRole('button', { name: 'Đã sao chép' })).toBeTruthy();
    // Chìa chỉ nằm trong state.
    expect(window.location.href).not.toContain(KEY);
    expect(window.location.hash).toBe('');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(KEY);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(KEY);
  });

  it('L3: vừa tạo → cuộn khối tin nhắn (cả dải vàng "một lần" và nút Sao chép) lên đầu màn hình, không bắt người dùng tự cuộn', async () => {
    const scrolled: { el: Element; arg: unknown }[] = [];
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: function (this: Element, arg?: unknown) {
        scrolled.push({ el: this, arg });
      },
    });
    try {
      setup(view(), (c) => (c.method === 'POST' ? json(201, created(view({ link: link('ACTIVE') }))) : undefined));
      renderCard();
      const user = userEvent.setup();
      await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
      expect(scrolled).toHaveLength(0); // chưa có tin thì không cuộn
      await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
      await screen.findByTestId('portal-message');
      expect(scrolled).toHaveLength(1);
      const target = scrolled[0]!.el as HTMLElement;
      // Phần tử được cuộn chứa đủ ba thứ cần thấy ngay: hộp tin, dải vàng, nút sao chép.
      expect(target.contains(screen.getByTestId('portal-message'))).toBe(true);
      expect(target.contains(screen.getByText(/Tin này chỉ hiện/))).toBe(true);
      expect(target.contains(screen.getByRole('button', { name: 'Sao chép tin nhắn' }))).toBe(true);
      expect(scrolled[0]!.arg).toMatchObject({ block: 'start' });
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('đã chép rồi đóng → mất tin; tải lại thẻ không còn chìa (máy chủ chỉ trả trạng thái)', async () => {
    setup(view(), (c) => (c.method === 'POST' ? json(201, created(view({ link: link('ACTIVE') }))) : undefined));
    const first = renderCard();
    const user = userWithClipboard();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
    await screen.findByTestId('portal-message');
    await user.click(screen.getByRole('button', { name: 'Sao chép tin nhắn' }));
    await user.click(await screen.findByRole('button', { name: 'Đóng tin nhắn' }));
    expect(screen.queryByTestId('portal-message')).toBeNull();
    expect(document.body.textContent).not.toContain(KEY);
    first.unmount();
    renderCard();
    await card();
    expect(document.body.textContent).not.toContain(KEY);
  });

  it('chưa chép mà đóng → hỏi lại; "Giữ lại" thì tin còn, "Đóng tin" thì mất', async () => {
    setup(view(), (c) => (c.method === 'POST' ? json(201, created(view({ link: link('ACTIVE') }))) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
    await screen.findByTestId('portal-message');
    await user.click(screen.getByRole('button', { name: 'Đóng tin nhắn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Giữ lại' }));
    expect(screen.getByTestId('portal-message')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Đóng tin nhắn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Đóng tin' }));
    await waitFor(() => expect(screen.queryByTestId('portal-message')).toBeNull());
  });

  it('không có clipboard → chọn sẵn chữ và báo chép tay', async () => {
    setup(view(), (c) => (c.method === 'POST' ? json(201, created(view({ link: link('ACTIVE') }))) : undefined));
    renderCard();
    const user = userWithClipboard(false);
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
    await screen.findByTestId('portal-message');
    await user.click(screen.getByRole('button', { name: 'Sao chép tin nhắn' }));
    expect(await screen.findByText(/không cho chép tự động/)).toBeTruthy();
    expect(window.getSelection()?.toString()).toContain(KEY);
  });

  it('đã có link đang mở: "Tạo đường dẫn mới" hỏi lại, nêu hậu quả', async () => {
    setup(view({ link: link('ACTIVE') }));
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn mới' }));
    expect(within(await screen.findByRole('dialog')).getByText(PORTAL_CONSEQUENCE.create)).toBeTruthy();
  });

  it('lỗi 403 có details.required là MẢNG → nêu tên từng quyền còn thiếu, hộp vẫn mở', async () => {
    setup(view(), (c) => (c.method === 'POST' ? err(403, 'FORBIDDEN', 'Gửi đường dẫn cổng học viên cần thêm quyền xem khách hàng, hợp đồng và phiếu thu', { required: ['contracts.read', 'payments.read'] }) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
    const alert = await within(screen.getByRole('dialog')).findByRole('alert');
    expect(alert.textContent).toBe('Gửi đường dẫn cổng học viên cần thêm quyền xem khách hàng, hợp đồng và phiếu thu. Còn thiếu quyền: Xem hợp đồng, Xem tiến độ thanh toán, phiếu thu.');
    expect(screen.queryByTestId('portal-message')).toBeNull();
  });

  it('lỗi 403 có details.required là CHUỖI (middleware cũ) → cũng đọc được', async () => {
    setup(view(), (c) => (c.method === 'POST' ? err(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', { required: 'portal.manage' }) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
    const alert = await within(screen.getByRole('dialog')).findByRole('alert');
    expect(alert.textContent).toBe('Bạn không có quyền thực hiện thao tác này. Còn thiếu quyền: Gửi, thu hồi đường dẫn cổng học viên; xem, chặn máy đã mở.');
  });

  it('lỗi 409 chưa có số điện thoại → hiện lời máy chủ', async () => {
    setup(view(), (c) => (c.method === 'POST' ? err(409, 'CONFLICT', 'Học viên chưa có số điện thoại — thêm số trước khi gửi đường dẫn', { reason: 'NO_PHONE' }) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(within(await card()).getByRole('button', { name: 'Tạo đường dẫn' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('checkbox'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo' }));
    expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe('Học viên chưa có số điện thoại — thêm số trước khi gửi đường dẫn');
  });
});

describe('PortalCard — chặn máy và thu hồi', () => {
  it('chặn máy: hộp nêu hậu quả (≤ 90 ký tự), lý do điền sẵn, gửi đúng đường; danh sách cập nhật', async () => {
    const before = view({ link: link('ACTIVE', { devicesUsed: 1, firstOpenedAt: T }), devices: [device('dev-1')] });
    const after = view({ link: link('ACTIVE', { devicesUsed: 1, firstOpenedAt: T }), devices: [device('dev-1', 'BLOCKED')] });
    const calls = setup(before, (c) => (c.method === 'POST' ? json(200, { view: after }) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Chặn máy iPhone/ }));
    const dlg = within(await screen.findByRole('dialog'));
    expect(dlg.getByText(PORTAL_CONSEQUENCE.block)).toBeTruthy();
    const reason = dlg.getByRole('textbox') as HTMLTextAreaElement;
    expect(reason.value).toBe('Học viên báo mất máy');
    await user.click(dlg.getByRole('button', { name: 'Chặn máy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)[0]).toMatchObject({ method: 'POST', path: `/orgs/${ORG}/portal-devices/dev-1/block`, body: { reason: 'Học viên báo mất máy' } });
    expect(await screen.findByText('Đã chặn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Chặn máy iPhone/ })).toBeNull();
  });

  it('lý do trống → không gửi, báo lỗi; sửa lý do thì gửi lý do mới', async () => {
    const calls = setup(view({ link: link('ACTIVE'), devices: [device('dev-1')] }), (c) => (c.method === 'POST' ? json(200, { view: view({ devices: [device('dev-1', 'BLOCKED')] }) }) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Chặn máy iPhone/ }));
    const dlg = within(await screen.findByRole('dialog'));
    await user.clear(dlg.getByRole('textbox'));
    await user.click(dlg.getByRole('button', { name: 'Chặn máy' }));
    expect((await dlg.findByRole('alert')).textContent).toBe('Nhập lý do trước khi xác nhận.');
    expect(writes(calls)).toHaveLength(0);
    await user.type(dlg.getByRole('textbox'), 'Máy lạ');
    await user.click(dlg.getByRole('button', { name: 'Chặn máy' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]!.body).toEqual({ reason: 'Máy lạ' });
  });

  it('thu hồi tất cả: hộp nêu hậu quả, lý do điền sẵn "Đường dẫn bị lộ", gửi đúng đường; nhãn thành "Đã thu hồi"', async () => {
    const before = view({ link: link('ACTIVE'), devices: [device('d1')] });
    const after = view({ link: link('REVOKED'), devices: [{ ...device('d1'), status: 'LINK_REVOKED' as const, endedAt: T, endedByName: 'Chiến' }] });
    const calls = setup(before, (c) => (c.method === 'POST' ? json(200, { devicesEnded: 1, view: after }) : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Thu hồi đường dẫn và chặn mọi máy' }));
    const dlg = within(await screen.findByRole('dialog'));
    expect(dlg.getByText(PORTAL_CONSEQUENCE.revoke)).toBeTruthy();
    expect((dlg.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Đường dẫn bị lộ');
    await user.click(dlg.getByRole('button', { name: 'Thu hồi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)[0]).toMatchObject({ method: 'POST', path: `/orgs/${ORG}/customers/${CUS}/portal/revoke`, body: { reason: 'Đường dẫn bị lộ' } });
    expect((await screen.findAllByText('Đã thu hồi', { selector: '.ui-tag' })).length).toBe(2);
  });

  it('lỗi 409 khi chặn (máy đã thoát) → lời máy chủ trong hộp, hộp không đóng', async () => {
    setup(view({ link: link('ACTIVE'), devices: [device('dev-1')] }), (c) => (c.method === 'POST' ? err(409, 'CONFLICT', 'Máy này đã bị chặn hoặc đã thoát') : undefined));
    renderCard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Chặn máy iPhone/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chặn máy' }));
    expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe('Máy này đã bị chặn hoặc đã thoát');
  });

  it('mọi câu hậu quả một dòng, tối đa 90 ký tự, không xuống dòng', () => {
    for (const m of Object.values(PORTAL_CONSEQUENCE)) {
      expect(m.length).toBeLessThanOrEqual(PORTAL_CONSEQUENCE_MAX);
      expect(m).not.toContain('\n');
    }
  });
});

describe('api/portal — đọc details.required', () => {
  const e = (status: number, details: unknown) => new ApiError('FORBIDDEN', 'Không đủ quyền.', status, 'r', details);
  it('mảng, chuỗi, thiếu, sai kiểu, không phải 403', () => {
    expect(requiredPermissions(e(403, { required: ['a', 'b'] }))).toEqual(['a', 'b']);
    expect(requiredPermissions(e(403, { required: 'a' }))).toEqual(['a']);
    expect(requiredPermissions(e(403, { required: [1, 'b', ''] }))).toEqual(['b']);
    expect(requiredPermissions(e(403, {}))).toEqual([]);
    expect(requiredPermissions(e(403, undefined))).toEqual([]);
    expect(requiredPermissions(e(403, { required: 5 }))).toEqual([]);
    expect(requiredPermissions(e(409, { required: ['a'] }))).toEqual([]);
    expect(requiredPermissions(new Error('x'))).toEqual([]);
  });
  it('lời: khoá lạ giữ nguyên, bỏ dấu chấm cuối của lời máy chủ', () => {
    expect(forbiddenMessage(e(403, { required: ['customers.read', 'khoa.la'] }))).toBe('Không đủ quyền. Còn thiếu quyền: Xem khách hàng, khoa.la.');
    expect(forbiddenMessage(e(403, undefined))).toBe('Không đủ quyền.');
    expect(forbiddenMessage(e(409, undefined))).toBeNull();
  });
});

// Trong hồ sơ khách thật (CustomerDetail): thẻ đứng ngay sau thẻ Hợp đồng; ẩn khi không phải ACADEMY hoặc thiếu portal.manage.
describe('CustomerDetail — chỗ đặt thẻ Cổng học viên', () => {
  const CUSTOMER = { id: 'k1', fullName: 'Phương Thảo', phone: '0912344321', email: null, note: null, createdAt: T, updatedAt: T };

  function server(kind: 'ACADEMY' | 'TEAM', permissions: readonly string[]) {
    const org = { membershipId: 'm-1', id: ORG, name: 'Học viện', slug: 'chien', kind, roles: [{ key: 'owner', name: 'Chủ' }] };
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'http://localhost');
        const path = url.pathname.replace('/api/v1', '');
        calls.push({ method: init?.method ?? 'GET', path, body: undefined, headers: {} });
        if (path === '/auth/refresh') return json(200, { accessToken: 't', expiresIn: 900 });
        if (path === '/auth/me') return json(200, { id: 'u', email: 'a@b.vn', fullName: 'Chiến', organizations: [org] });
        if (path === `/orgs/${ORG}`) return json(200, { ...org, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
        if (path === `/orgs/${ORG}/customers`) return json(200, { items: [CUSTOMER], page: 1, pageSize: 20, total: 1 });
        if (path === `/orgs/${ORG}/customers/k1`) return json(200, CUSTOMER);
        if (path === `/orgs/${ORG}/contracts`) return json(200, { items: [], page: 1, pageSize: 10, total: 0 });
        if (path === `/orgs/${ORG}/customers/k1/portal`) return json(200, view({ link: link('ACTIVE') }));
        return err(404, 'NOT_FOUND', path);
      }),
    );
    return calls;
  }
  const open = () => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/chien/khach-hang/k1'] })} />);

  it('ACADEMY + portal.manage: thẻ nằm SAU thẻ Hợp đồng', async () => {
    server('ACADEMY', SYSTEM_ROLES.owner.permissions);
    open();
    const portal = await screen.findByRole('region', { name: 'Cổng học viên' });
    const contracts = screen.getByRole('region', { name: 'Hợp đồng của khách' });
    expect(contracts.compareDocumentPosition(portal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tổ chức TEAM: không có thẻ và không gọi đường cổng', async () => {
    const calls = server('TEAM', SYSTEM_ROLES.owner.permissions);
    open();
    await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    expect(screen.queryByRole('region', { name: 'Cổng học viên' })).toBeNull();
    expect(calls.some((c) => c.path.endsWith('/portal'))).toBe(false);
  });

  it('thiếu portal.manage: không có thẻ và không gọi đường cổng', async () => {
    const calls = server('ACADEMY', SYSTEM_ROLES.owner.permissions.filter((p) => p !== 'portal.manage'));
    open();
    await screen.findByRole('region', { name: 'Hợp đồng của khách' });
    expect(screen.queryByRole('region', { name: 'Cổng học viên' })).toBeNull();
    expect(calls.some((c) => c.path.endsWith('/portal'))).toBe(false);
  });
});
