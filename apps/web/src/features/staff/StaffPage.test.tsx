import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';

// Màn Thợ makeup chạy thật trong khung (phiên, router, quyền) với máy chủ giả lập qua fetch — C2 mục 1.
configure({ asyncUtilTimeout: 5000 });

const T = '2026-10-12T03:00:00.000Z';

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

const tierRow = (id: string, name: string, sortOrder: number, staffCount: number, isActive = true) => ({ id, name, sortOrder, isActive, staffCount, createdAt: T, updatedAt: T });
const person = (id: string, name: string, tier: { id: string; name: string; isActive: boolean } | null, roleKeys = ['artist'], extra: object = {}) => ({
  membershipId: id,
  userId: `u-${id}`,
  fullName: name,
  displayName: name,
  initials: 'XX',
  avatarUrl: null,
  phone: null,
  tier,
  isBookable: true,
  hasProfile: true,
  status: 'ACTIVE',
  roleKeys,
  ...extra,
});
const T1 = { id: 't1', name: 'Thợ chính', isActive: true };
const T2 = { id: 't2', name: 'Thợ phụ', isActive: true };

function initialState() {
  return {
    tiers: [tierRow('t1', 'Thợ chính', 0, 2), tierRow('t2', 'Thợ phụ', 1, 1), tierRow('t3', 'Cộng tác viên (cũ)', 2, 0, false)],
    staff: [
      person('m-1', 'Nguyễn Trọng Chiến', null, ['owner']),
      person('a', 'Lương Hà My', T1, ['artist'], { phone: '0912445667' }),
      person('b', 'Trần Ngọc Anh', T1, ['artist'], { isBookable: false }),
      person('c', 'Phạm Minh Thư', T2, ['assistant']),
    ],
  };
}

const SHEET = {
  owner: { kind: 'package', id: 'p1', name: 'Cô dâu – Ngày cưới' },
  items: [
    { tier: { id: 't1', name: 'Thợ chính', sortOrder: 0 }, amount: 700_000, updatedAt: T, staff: [{ membershipId: 'a', displayName: 'Lương Hà My', avatarUrl: null, initials: 'LM' }, { membershipId: 'b', displayName: 'Trần Ngọc Anh', avatarUrl: null, initials: 'TA' }] },
    { tier: { id: 't2', name: 'Thợ phụ', sortOrder: 1 }, amount: null, updatedAt: null, staff: [] },
  ],
};
const price = (unitPrice: number) => ({ priceVersionId: 'v', listPrice: unitPrice, salePrice: null, unitPrice, effectiveFrom: T });
const PKGS = [
  { id: 'p1', code: 'G1', name: 'Cô dâu – Ngày cưới', subjectId: 's1', subject: { id: 's1', name: 'Cô dâu', isActive: true }, currentPrice: price(2_700_000) },
  { id: 'p2', code: 'G2', name: 'Khách dự tiệc', subjectId: null, subject: null, currentPrice: price(450_000) },
];

function setupServer(permissions: readonly string[], opts: { myRoles?: string[]; override?: Override } = {}) {
  const calls: Call[] = [];
  const state = initialState();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      if (!path.startsWith('/auth')) calls.push({ method, path: path + url.search, body, headers: { ...(init?.headers as Record<string, string>) } });
      const o = opts.override?.(method, path + url.search, body);
      if (o) return o;
      const myRoles = opts.myRoles ?? ['owner'];
      const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Studio Chiến', slug: 'chien', kind: 'TEAM', roles: myRoles.map((key) => ({ key, name: key })) };
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Trọng Chiến', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles, myPermissions: [...permissions] });
      if (path === '/orgs/org-1/staff-tiers' && method === 'GET') return json(200, { items: state.tiers });
      if (path === '/orgs/org-1/staff-tiers' && method === 'POST') {
        const t = tierRow('t9', (body as { name: string }).name, 9, 0);
        state.tiers.push(t);
        return json(201, t);
      }
      const tierMatch = /^\/orgs\/org-1\/staff-tiers\/(\w+)$/.exec(path);
      if (tierMatch && method === 'PATCH') {
        const t = state.tiers.find((x) => x.id === tierMatch[1])!;
        Object.assign(t, body);
        return json(200, t);
      }
      if (path === '/orgs/org-1/staff' && method === 'GET') {
        const q = url.searchParams.get('q');
        return json(200, { items: q ? state.staff.filter((s) => s.displayName.toLowerCase().includes(q.toLowerCase())) : state.staff });
      }
      const staffMatch = /^\/orgs\/org-1\/staff\/([\w-]+)$/.exec(path);
      if (staffMatch && method === 'PATCH') {
        const s = state.staff.find((x) => x.membershipId === staffMatch[1])!;
        const b = body as { tierId?: string | null; displayName?: string | null };
        if (b.tierId !== undefined) {
          const t = state.tiers.find((x) => x.id === b.tierId);
          s.tier = t ? { id: t.id, name: t.name, isActive: t.isActive } : null;
        }
        if (b.displayName !== undefined) s.displayName = b.displayName ?? s.fullName;
        return json(200, { ...s });
      }
      if (path === '/orgs/org-1/members' && method === 'POST') {
        return json(201, { id: 'm-new', status: 'ACTIVE', createdAt: T, user: { id: 'u9', email: (body as { email: string }).email, fullName: 'Đinh Bảo Ngọc' }, roles: [] });
      }
      if (path === '/orgs/org-1/roles') return json(200, { items: [] });
      if (path === '/orgs/org-1/files' && method === 'POST') {
        return json(201, { id: 'f-anh', purpose: url.searchParams.get('purpose'), status: 'READY', originalName: url.searchParams.get('name'), mimeType: 'image/png', sizeBytes: 4, sha256: null, width: 1, height: 1, createdAt: T, signedUrl: 'https://anh.local/f-anh.png', signedUrlExpiresAt: T });
      }
      if (path === '/orgs/org-1/makeup-subjects') return json(200, { items: [{ id: 's1', organizationId: 'org-1', name: 'Cô dâu', sortOrder: 0, isActive: true, createdAt: T, updatedAt: T }] });
      if (path === '/orgs/org-1/packages') return json(200, { items: PKGS, page: 1, pageSize: 100, total: PKGS.length });
      if (path === '/orgs/org-1/services') return json(200, { items: [], page: 1, pageSize: 100, total: 0 });
      if (path === '/orgs/org-1/packages/p1/pay-rates' && method === 'GET') return json(200, SHEET);
      if (path === '/orgs/org-1/packages/p2/pay-rates' && method === 'GET') return json(200, { ...SHEET, owner: { kind: 'package', id: 'p2', name: 'Khách dự tiệc' } });
      if (path === '/orgs/org-1/packages/p1/pay-rates' && method === 'PUT') {
        const rates = (body as { rates: { tierId: string; amount: number | null }[] }).rates;
        return json(200, { ...SHEET, items: SHEET.items.map((r) => { const x = rates.find((y) => y.tierId === r.tier.id); return x ? { ...r, amount: x.amount, updatedAt: '2026-10-18T03:00:00.000Z' } : r; }) });
      }
      return err(404, 'NOT_FOUND', `Không có đường ${method} ${path}`);
    }),
  );
  return { calls, state };
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const OWNER = SYSTEM_ROLES.owner.permissions;
const ADMIN = SYSTEM_ROLES.admin.permissions;
const MANAGER = SYSTEM_ROLES.manager.permissions;
const ARTIST = SYSTEM_ROLES.artist.permissions;
const ACCOUNTANT = SYSTEM_ROLES.accountant.permissions;
const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');
const rowOf = (name: string) => screen.getByText(name, { selector: '.st-row__name' }).closest('.st-row') as HTMLElement;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Thợ & bậc lương — hiển thị và quyền', () => {
  it('chủ: thẻ bậc (Tất cả · bậc · bậc ẩn · Chưa gán bậc), dòng thợ có ô chọn bậc + Hồ sơ, "tắt nhận lịch"', async () => {
    setupServer(OWNER);
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    const nav = screen.getByRole('navigation', { name: 'Nhóm thợ theo bậc lương' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Tất cả thợ4', 'Thợ chính2', 'Thợ phụ1', 'Cộng tác viên (cũ) · đang ẩn0', 'Chưa gán bậc1']);
    expect(screen.getByText('4 người đang làm')).toBeTruthy();
    const select = within(rowOf('Lương Hà My')).getByRole('combobox', { name: 'Bậc lương của Lương Hà My' }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['Không có bậc', 'Thợ chính', 'Thợ phụ']);
    expect(select.value).toBe('t1');
    expect(rowOf('Trần Ngọc Anh').textContent).toContain('tắt nhận lịch');
    expect(screen.getAllByRole('button', { name: 'Thêm thợ' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm bậc lương' })).toBeTruthy();
  });

  it('chọn một bậc → chỉ thợ của bậc đó; "Chưa gán bậc" lọc tier = null', async () => {
    setupServer(OWNER);
    renderAt('/chien/nhan-su/bac/t1');
    await screen.findByText('Lương Hà My');
    expect(screen.queryByText('Phạm Minh Thư')).toBeNull();
    expect(screen.getByRole('heading', { name: /Thợ chính/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: /Chưa gán bậc/ }));
    await screen.findByText('1 người đang làm');
    expect(screen.getByText('Nguyễn Trọng Chiến', { selector: '.st-row__name' })).toBeTruthy();
  });

  it('bậc không còn (404 ở máy khác) → "Không tìm thấy bậc lương này" + Về danh sách', async () => {
    setupServer(OWNER);
    renderAt('/chien/nhan-su/bac/khong-co');
    expect(await screen.findByText(/Không tìm thấy bậc lương này/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Về danh sách' })).toBeTruthy();
  });

  it('thợ makeup (chỉ staff.read): bậc hiện thành chữ, không Sửa / Thêm bậc / Thêm thợ; Hồ sơ chỉ xem, không có ô số điện thoại', async () => {
    setupServer(ARTIST, { myRoles: ['artist'] });
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(within(rowOf('Lương Hà My')).getByText('Thợ chính')).toBeTruthy();
    expect(within(rowOf('Nguyễn Trọng Chiến')).getByText('Chưa gán bậc')).toBeTruthy();
    for (const name of ['Thêm thợ', 'Sửa', 'Thêm bậc lương']) expect(screen.queryByRole('button', { name })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ Lương Hà My' }));
    const dlg = await screen.findByRole('dialog', { name: /Hồ sơ thợ/ });
    expect(within(dlg).queryByLabelText('Số điện thoại')).toBeNull();
    expect((within(dlg).getByLabelText('Tên hiển thị') as HTMLInputElement).disabled).toBe(true);
    expect(within(dlg).queryByRole('button', { name: 'Lưu' })).toBeNull();
    expect(within(dlg).queryByRole('button', { name: /Đổi ảnh|Tải ảnh/ })).toBeNull();
  });

  it('quản lý (staff.write, không payroll.write): sửa hồ sơ được nhưng không có ô chọn bậc', async () => {
    setupServer(MANAGER, { myRoles: ['manager'] });
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    expect(screen.queryAllByRole('combobox', { name: /Bậc lương của/ })).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeTruthy();
  });

  it('quản trị (không phải chủ): dòng của chính mình khoá ô chọn bậc', async () => {
    setupServer(ADMIN, { myRoles: ['admin'] });
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    const own = within(rowOf('Nguyễn Trọng Chiến')).getByRole('combobox') as HTMLSelectElement;
    expect(own.disabled).toBe(true);
    expect((within(rowOf('Lương Hà My')).getByRole('combobox') as HTMLSelectElement).disabled).toBe(false);
  });
});

describe('Đổi bậc trên dòng: lưu ngay, Hoàn tác, lỗi 403', () => {
  it('đổi → PATCH {tierId}; dải "Đã chuyển … sang …" có Hoàn tác → PATCH lại bậc cũ', async () => {
    const { calls } = setupServer(OWNER);
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.selectOptions(within(rowOf('Lương Hà My')).getByRole('combobox'), 't2');
    expect(await screen.findByText('Đã chuyển Lương Hà My sang Thợ phụ')).toBeTruthy();
    expect(writes(calls).map((c) => [c.method, c.path, c.body])).toEqual([['PATCH', '/orgs/org-1/staff/a', { tierId: 't2' }]]);
    expect((within(rowOf('Lương Hà My')).getByRole('combobox') as HTMLSelectElement).value).toBe('t2');
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    await waitFor(() => expect((within(rowOf('Lương Hà My')).getByRole('combobox') as HTMLSelectElement).value).toBe('t1'));
    expect(writes(calls).map((c) => c.body)).toEqual([{ tierId: 't2' }, { tierId: 't1' }]);
    expect(screen.queryByText(/Đã chuyển/)).toBeNull();
  });

  it('dải Hoàn tác tự tắt sau 6 giây', async () => {
    setupServer(OWNER);
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.change(within(rowOf('Lương Hà My')).getByRole('combobox'), { target: { value: '' } });
    await screen.findByText('Đã chuyển Lương Hà My sang Không có bậc');
    vi.advanceTimersByTime(6100);
    await waitFor(() => expect(screen.queryByText(/Đã chuyển/)).toBeNull());
  });

  it('403 → ô chọn về bậc cũ + dải đỏ dưới dòng là lời máy chủ', async () => {
    setupServer(OWNER, { override: (m, p) => (m === 'PATCH' && p === '/orgs/org-1/staff/a' ? err(403, 'FORBIDDEN', 'Đổi bậc lương cần quyền đặt tiền công') : undefined) });
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.selectOptions(within(rowOf('Lương Hà My')).getByRole('combobox'), 't2');
    expect((await within(rowOf('Lương Hà My')).findByRole('alert')).textContent).toBe('Đổi bậc lương cần quyền đặt tiền công');
    expect((within(rowOf('Lương Hà My')).getByRole('combobox') as HTMLSelectElement).value).toBe('t1');
  });
});

describe('Hộp Hồ sơ thợ', () => {
  it('chỉ gửi trường đã đổi; 400 số điện thoại → lỗi dưới ô', async () => {
    const { calls } = setupServer(OWNER, {
      override: (m, p, b) =>
        m === 'PATCH' && p === '/orgs/org-1/staff/a' && (b as { phone?: string }).phone === '0912'
          ? err(400, 'VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', { issues: [{ path: 'phone', message: 'Số điện thoại không hợp lệ (ví dụ đúng: 0912 345 678 hoặc +84 912 345 678)' }] })
          : undefined,
    });
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ Lương Hà My' }));
    const dlg = await screen.findByRole('dialog', { name: /Hồ sơ thợ/ });
    expect(within(dlg).getByText('Tên tài khoản: Lương Hà My')).toBeTruthy();
    expect((within(dlg).getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0912445667');
    const phone = within(dlg).getByLabelText('Số điện thoại');
    await userEvent.clear(phone);
    await userEvent.type(phone, '0912');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText(/Số điện thoại không hợp lệ/)).toBeTruthy();
    expect(writes(calls).map((c) => c.body)).toEqual([{ phone: '0912' }]);
    await userEvent.clear(phone);
    await userEvent.type(phone, '0912445667');
    await userEvent.clear(within(dlg).getByLabelText('Tên hiển thị'));
    await userEvent.type(within(dlg).getByLabelText('Tên hiển thị'), 'My Lương');
    await userEvent.click(within(dlg).getByRole('switch', { name: 'Nhận lịch' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls).at(-1)?.body).toEqual({ displayName: 'My Lương', isBookable: false });
    expect(await screen.findByText('My Lương')).toBeTruthy();
  });
});

describe('Hộp Hồ sơ thợ — ảnh đại diện', () => {
  it('chọn ảnh → POST /files?purpose=STAFF_AVATAR (thân nhị phân, có Idempotency-Key); Lưu mới gửi avatarFileId, không gửi avatarUrl', async () => {
    const { calls } = setupServer(OWNER);
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ Lương Hà My' }));
    const dlg = await screen.findByRole('dialog', { name: /Hồ sơ thợ/ });
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'my.png', { type: 'image/png' });
    await userEvent.upload(dlg.querySelector('input[type=file]') as HTMLInputElement, file);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.startsWith('/orgs/org-1/files?purpose=STAFF_AVATAR&name=my.png'))).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.headers['Idempotency-Key']).toMatch(/.{8,}/);
    expect(post.headers['Content-Type']).toBe('application/octet-stream');
    expect(writes(calls).filter((c) => c.method === 'PATCH')).toHaveLength(0);
    await within(dlg).findByRole('button', { name: /Đổi ảnh/ });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const patch = writes(calls).find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ avatarFileId: 'f-anh' });
  });

  it('ảnh sai loại → lỗi dưới ô, không gọi máy chủ', async () => {
    const { calls } = setupServer(OWNER);
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ Lương Hà My' }));
    const dlg = await screen.findByRole('dialog', { name: /Hồ sơ thợ/ });
    const input = dlg.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } });
    expect((await within(dlg).findByRole('alert')).textContent).toMatch(/Chỉ nhận ảnh/);
    expect(writes(calls)).toHaveLength(0);
  });
});

describe('Hộp Bậc lương', () => {
  it('"+ Thêm bậc lương" → tiêu điểm ô tên mới; Thêm → POST có Idempotency-Key, bậc mới ở cuối', async () => {
    const { calls } = setupServer(OWNER);
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm bậc lương' }));
    const dlg = await screen.findByRole('dialog', { name: /Bậc lương/ });
    const input = within(dlg).getByLabelText('Tên bậc mới');
    await waitFor(() => expect(document.activeElement).toBe(input));
    await userEvent.type(input, 'Học việc');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Thêm' }));
    await within(dlg).findByDisplayValue('Học việc');
    const post = writes(calls).find((c) => c.method === 'POST');
    expect(post?.body).toEqual({ name: 'Học việc' });
    expect(post?.headers['Idempotency-Key']).toMatch(/.{8,}/);
    expect(within(dlg).getAllByLabelText(/^Tên bậc \d/).map((i) => (i as HTMLInputElement).value)).toEqual(['Thợ chính', 'Thợ phụ', 'Cộng tác viên (cũ)', 'Học việc']);
  });

  it('Lưu: mỗi bậc đã đổi một PATCH; 409 ẩn bậc còn thợ → dải đỏ dưới hàng + công tắc bật lại; 409 trùng tên → dưới ô tên', async () => {
    const { calls } = setupServer(OWNER, {
      override: (m, p, b) => {
        if (m !== 'PATCH') return undefined;
        if (p === '/orgs/org-1/staff-tiers/t1') return err(409, 'CONFLICT', 'Còn 2 thợ đang thuộc bậc "Thợ chính", hãy chuyển họ sang bậc khác trước khi ẩn');
        if (p === '/orgs/org-1/staff-tiers/t2' && (b as { name?: string }).name) return err(409, 'CONFLICT', 'Đã có bậc lương tên "Thợ chính"');
        return undefined;
      },
    });
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    const dlg = await screen.findByRole('dialog', { name: /Bậc lương/ });
    await userEvent.click(within(dlg).getByRole('switch', { name: 'Đang dùng: Thợ chính' }));
    const name2 = within(dlg).getByLabelText('Tên bậc 2');
    await userEvent.clear(name2);
    await userEvent.type(name2, 'Thợ chính');
    await userEvent.click(within(dlg).getByRole('switch', { name: 'Đang dùng: Cộng tác viên (cũ)' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText(/Còn 2 thợ đang thuộc bậc/)).toBeTruthy();
    expect(within(dlg).getByText('Đã có bậc lương tên "Thợ chính"')).toBeTruthy();
    expect(within(dlg).getAllByRole('switch')[0]?.getAttribute('aria-checked')).toBe('true');
    expect(writes(calls).map((c) => [c.path, c.body])).toEqual([
      ['/orgs/org-1/staff-tiers/t1', { isActive: false }],
      ['/orgs/org-1/staff-tiers/t2', { name: 'Thợ chính' }],
      ['/orgs/org-1/staff-tiers/t3', { isActive: true }],
    ]);
  });

  it('kéo bằng bàn phím (mũi tên lên) → PATCH sortOrder các bậc lệch vị trí', async () => {
    const { calls } = setupServer(OWNER);
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    const dlg = await screen.findByRole('dialog', { name: /Bậc lương/ });
    within(dlg).getByRole('button', { name: /Kéo để đổi thứ tự bậc Thợ phụ/ }).focus();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls).map((c) => [c.path, c.body])).toEqual([
      ['/orgs/org-1/staff-tiers/t2', { sortOrder: 0 }],
      ['/orgs/org-1/staff-tiers/t1', { sortOrder: 1 }],
    ]);
  });
});

describe('Hộp Thêm thợ', () => {
  it('404 → lỗi dưới ô email; thêm được → POST /members {email, roleKeys}, đóng hộp, gợi ý mở Hồ sơ', async () => {
    const { calls } = setupServer(OWNER, {
      override: (m, p, b) => (m === 'POST' && p === '/orgs/org-1/members' && (b as { email: string }).email === 'chua@co.vn' ? err(404, 'NOT_FOUND', 'Chưa có tài khoản hoạt động với email này') : undefined),
    });
    renderAt('/chien/nhan-su');
    await screen.findByText('Lương Hà My');
    // Nút trên tiêu đề (máy tính) và nút + ở thanh trên (điện thoại, CSS ẩn) cùng tên.
    await userEvent.click(screen.getAllByRole('button', { name: 'Thêm thợ' })[0]!);
    const dlg = await screen.findByRole('dialog', { name: /Thêm thợ vào studio/ });
    expect((within(dlg).getByLabelText(/Vai trò/) as HTMLSelectElement).value).toBe('artist');
    await userEvent.type(within(dlg).getByLabelText(/Email tài khoản/), 'chua@co.vn');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Thêm' }));
    expect(await within(dlg).findByText('Chưa có tài khoản hoạt động với email này')).toBeTruthy();
    await userEvent.clear(within(dlg).getByLabelText(/Email tài khoản/));
    await userEvent.type(within(dlg).getByLabelText(/Email tài khoản/), 'ngoc@co.vn');
    await userEvent.selectOptions(within(dlg).getByLabelText(/Vai trò/), 'assistant');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Thêm' }));
    expect(await screen.findByText('Đã thêm Đinh Bảo Ngọc. Mở “Hồ sơ” để gán bậc lương.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writes(calls).map((c) => c.body)).toEqual([
      { email: 'chua@co.vn', roleKeys: ['artist'] },
      { email: 'ngoc@co.vn', roleKeys: ['assistant'] },
    ]);
  });
});

describe('Tiền công theo gói', () => {
  it('chủ: nhóm gói theo nhân vật, chọn sẵn gói đầu; mỗi bậc: tên · n thợ · ảnh + tên · ô tiền; lưu chỉ bậc đã đổi', async () => {
    const { calls } = setupServer(OWNER);
    renderAt('/chien/nhan-su/tien-cong');
    const sheet = await screen.findByRole('region', { name: 'Tiền công Cô dâu – Ngày cưới' });
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Gói · Cô dâu', 'Gói · Mọi nhân vật']);
    expect(within(sheet).getByText('Gói · Cô dâu')).toBeTruthy();
    expect(within(sheet).getByText('2.700.000 ₫')).toBeTruthy();
    const g1 = await within(sheet).findByRole('group', { name: 'Thợ chính' });
    expect(within(g1).getByText('2 thợ')).toBeTruthy();
    expect(within(g1).getByText('Lương Hà My')).toBeTruthy();
    expect(within(g1).getByText('Cập nhật 12/10/2026')).toBeTruthy();
    const g2 = within(sheet).getByRole('group', { name: 'Thợ phụ' });
    expect(within(g2).getByText('Chưa có thợ ở bậc này')).toBeTruthy();
    expect(within(g2).getByText('Chưa đặt mức')).toBeTruthy();
    expect((within(g2).getByLabelText('Tiền công bậc Thợ phụ') as HTMLInputElement).placeholder).toBe('Chưa đặt');
    expect((within(sheet).getByRole('button', { name: 'Lưu tiền công' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(within(g2).getByLabelText('Tiền công bậc Thợ phụ'), '300000');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lưu tiền công' }));
    await within(g2).findByText('Cập nhật 18/10/2026');
    expect(writes(calls).map((c) => [c.method, c.path, c.body])).toEqual([['PUT', '/orgs/org-1/packages/p1/pay-rates', { rates: [{ tierId: 't2', amount: 300_000 }] }]]);
  });

  it('400 có details.tierIds → lỗi dưới đúng ô; số đang gõ giữ nguyên', async () => {
    setupServer(OWNER, {
      override: (m, p) => (m === 'PUT' && p === '/orgs/org-1/packages/p1/pay-rates' ? err(400, 'VALIDATION_FAILED', 'Có bậc lương đang ẩn, không đặt tiền công được', { tierIds: ['t2'] }) : undefined),
    });
    renderAt('/chien/nhan-su/tien-cong/goi/p1');
    const g2 = await screen.findByRole('group', { name: 'Thợ phụ' });
    await userEvent.type(within(g2).getByLabelText('Tiền công bậc Thợ phụ'), '250000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu tiền công' }));
    expect(await within(g2).findByText('Có bậc lương đang ẩn, không đặt tiền công được')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Thợ chính' })).queryByRole('alert')).toBeNull();
    expect((within(g2).getByLabelText('Tiền công bậc Thợ phụ') as HTMLInputElement).value).toMatch(/250\.000/);
  });

  it('có thay đổi chưa lưu mà bấm gói khác → hỏi "Bỏ thay đổi…?"; Ở lại giữ số; Bỏ thay đổi chuyển gói', async () => {
    const router = (setupServer(OWNER), renderAt('/chien/nhan-su/tien-cong/goi/p1'));
    const g2 = await screen.findByRole('group', { name: 'Thợ phụ' });
    await userEvent.type(within(g2).getByLabelText('Tiền công bậc Thợ phụ'), '1000');
    await userEvent.click(screen.getByRole('link', { name: /Khách dự tiệc/ }));
    const ask = await screen.findByRole('dialog', { name: 'Bỏ thay đổi tiền công của Cô dâu – Ngày cưới?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Ở lại' }));
    expect(router.state.location.pathname).toBe('/chien/nhan-su/tien-cong/goi/p1');
    expect((within(g2).getByLabelText('Tiền công bậc Thợ phụ') as HTMLInputElement).value).toMatch(/1\.000/);
    await userEvent.click(screen.getByRole('link', { name: /Khách dự tiệc/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: /Bỏ thay đổi/ })).getByRole('button', { name: 'Bỏ thay đổi' }));
    await screen.findByRole('region', { name: 'Tiền công Khách dự tiệc' });
    expect(router.state.location.pathname).toBe('/chien/nhan-su/tien-cong/goi/p2');
  });

  it('kế toán (payroll.read): ô khoá, không có nút Lưu, dải xám "Bạn chỉ được xem tiền công…"', async () => {
    setupServer(ACCOUNTANT, { myRoles: ['accountant'] });
    renderAt('/chien/nhan-su/tien-cong/goi/p1');
    const sheet = await screen.findByRole('region', { name: 'Tiền công Cô dâu – Ngày cưới' });
    expect(await within(sheet).findByText('Bạn chỉ được xem tiền công. Chủ studio hoặc quản trị đặt mức.')).toBeTruthy();
    expect((within(sheet).getByLabelText('Tiền công bậc Thợ chính') as HTMLInputElement).disabled).toBe(true);
    expect(within(sheet).queryByRole('button', { name: 'Lưu tiền công' })).toBeNull();
  });

  it('quản lý (không payroll.read) vào thẳng /tien-cong → dải 403, không gọi pay-rates', async () => {
    const { calls } = setupServer(MANAGER, { myRoles: ['manager'] });
    renderAt('/chien/nhan-su/tien-cong');
    expect((await screen.findByRole('alert')).textContent).toMatch(/không có quyền/);
    expect(calls.some((c) => c.path.includes('pay-rates'))).toBe(false);
  });

  it('chưa có bậc nào → "Chưa có bậc lương nào…" + Thêm bậc lương (mở hộp Bậc lương ở màn thợ)', async () => {
    setupServer(OWNER, { override: (m, p) => (m === 'GET' && p === '/orgs/org-1/packages/p1/pay-rates' ? json(200, { ...SHEET, items: [] }) : undefined) });
    renderAt('/chien/nhan-su/tien-cong/goi/p1');
    expect(await screen.findByText('Chưa có bậc lương nào. Tạo bậc trước rồi mới đặt tiền công.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm bậc lương' }));
    expect(await screen.findByRole('dialog', { name: /Bậc lương/ })).toBeTruthy();
  });

  it('gói bị xoá ở máy khác (404 pay-rates) → "Không tìm thấy gói này…" + Về danh sách', async () => {
    setupServer(OWNER, { override: (m, p) => (p === '/orgs/org-1/packages/p1/pay-rates' ? err(404, 'NOT_FOUND', 'Không tìm thấy gói') : undefined) });
    renderAt('/chien/nhan-su/tien-cong/goi/p1');
    expect(await screen.findByText(/Không tìm thấy gói này/)).toBeTruthy();
  });

  it('lỗi mạng khi tải gói → dải đỏ + Thử lại', async () => {
    let fail = true;
    setupServer(OWNER, {
      override: (m, p) => {
        if (p.startsWith('/orgs/org-1/packages?') && fail) {
          fail = false;
          throw new TypeError('Failed to fetch');
        }
        return undefined;
      },
    });
    renderAt('/chien/nhan-su/tien-cong');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Không kết nối được máy chủ/);
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('region', { name: 'Tiền công Cô dâu – Ngày cưới' })).toBeTruthy();
  });
});
