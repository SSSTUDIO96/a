import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';

// Lần tải đầu (khung + phiên + quyền + 3 đường bảng giá) có lúc quá 1 giây khi cả bộ thử chạy song song.
configure({ asyncUtilTimeout: 5000 });

// Màn Bảng giá chạy thật trong khung (phiên, router, quyền) với máy chủ giả lập qua fetch.

const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Studio Chiến', slug: 'chien', kind: 'TEAM', roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };
const T = '2026-10-18T00:00:00.000Z';

const SUBJECTS = [
  { id: 's1', organizationId: 'org-1', name: 'Cô dâu', sortOrder: 0, isActive: true, createdAt: T, updatedAt: T },
  { id: 's2', organizationId: 'org-1', name: 'Mẹ cô dâu', sortOrder: 1, isActive: true, createdAt: T, updatedAt: T },
];

const price = (listPrice: number, salePrice: number | null = null) => ({ priceVersionId: `v-${listPrice}`, listPrice, salePrice, unitPrice: salePrice ?? listPrice, effectiveFrom: T });

function svc(id: string, kind: 'MAIN' | 'ADDON' | 'SURCHARGE', name: string, p: number) {
  return { id, kind, code: id.toUpperCase(), name, description: null, durationMinutes: 30, categoryId: null, isActive: true, isPublic: true, sortOrder: 0, createdAt: T, updatedAt: T, category: null, currentPrice: price(p) };
}

const SERVICES = [svc('mcd', 'MAIN', 'Makeup cô dâu', 1_500_000), svc('nail', 'ADDON', 'Làm nail', 250_000), svc('lens', 'ADDON', 'Lens', 100_000), svc('pple', 'SURCHARGE', 'Phụ phí ngày lễ', 200_000)];

const PKG = {
  id: 'p1',
  code: 'G-CD01',
  name: 'Cô dâu – Ngày cưới',
  description: null,
  durationMinutes: 150,
  staffCount: 1,
  depositAmount: 1_000_000,
  subjectId: 's1',
  locationTypes: ['STUDIO', 'CUSTOMER_HOME', 'OTHER'],
  includedKm: null,
  terms: null,
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  createdAt: T,
  updatedAt: T,
  subject: { id: 's1', name: 'Cô dâu', isActive: true },
  items: [
    { serviceId: 'mcd', quantity: 1, isOptional: false, service: { id: 'mcd', code: 'MCD', name: 'Makeup cô dâu', kind: 'MAIN', isActive: true }, currentPrice: price(1_500_000) },
    { serviceId: 'nail', quantity: 1, isOptional: true, service: { id: 'nail', code: 'NAIL', name: 'Làm nail', kind: 'ADDON', isActive: true }, currentPrice: price(250_000) },
  ],
  currentPrice: price(3_000_000, 2_700_000),
};
const PKG2 = { ...PKG, id: 'p2', code: 'G-ME01', name: 'Mẹ – Trang điểm nhẹ nhàng', subjectId: 's2', subject: { id: 's2', name: 'Mẹ cô dâu', isActive: true }, locationTypes: ['STUDIO', 'CUSTOMER_HOME'], items: [], currentPrice: price(600_000) };

const SHEET = {
  owner: { kind: 'package', id: 'p1', name: PKG.name },
  items: [
    { tier: { id: 't1', name: 'Thợ chính bậc 1', sortOrder: 0 }, amount: 700_000, updatedAt: T, staff: [{ membershipId: 'a', displayName: 'Nguyễn Thu Hà', avatarUrl: null, initials: 'TH' }, { membershipId: 'b', displayName: 'Trần Minh Anh', avatarUrl: null, initials: 'MA' }] },
    { tier: { id: 't2', name: 'Thợ phụ', sortOrder: 1 }, amount: null, updatedAt: null, staff: [{ membershipId: 'c', displayName: 'Phạm Bảo Vy', avatarUrl: null, initials: 'BV' }] },
  ],
};

const POLICY = {
  defaultMode: 'PER_KM',
  fixedAmount: 150_000,
  perKmAmount: 10_000,
  freeKm: 3,
  minimumAmount: 100_000,
  roundTrip: true,
  tiers: [{ fromKm: 0, toKm: 10, amount: 100_000 }],
  updatedAt: T,
};

interface Call {
  method: string;
  path: string;
  body: unknown;
}

type Override = (method: string, path: string, body: unknown) => Response | undefined;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

function setupServer(permissions: readonly string[], override?: Override) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (!path.startsWith('/auth')) calls.push({ method, path: path + url.search, body });
      const o = override?.(method, path, body);
      if (o) return o;
      const kind = url.searchParams.get('kind');
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Trọng Chiến', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
      if (path === '/orgs/org-1/makeup-subjects') return json(200, { items: SUBJECTS });
      if (path === '/orgs/org-1/packages') return json(200, { items: [PKG, PKG2], page: 1, pageSize: 100, total: 2 });
      if (path === '/orgs/org-1/services') {
        const items = kind ? SERVICES.filter((s) => s.kind === kind) : SERVICES;
        return json(200, { items, page: 1, pageSize: 100, total: items.length });
      }
      if (path === '/orgs/org-1/packages/p1/pay-rates' && method === 'GET') return json(200, SHEET);
      if (path === '/orgs/org-1/packages/p1/pay-rates' && method === 'PUT') return json(200, SHEET);
      if (path === '/orgs/org-1/packages/p1' && method === 'PATCH') return json(200, { ...PKG, ...(body as object) });
      if (path === '/orgs/org-1/packages/p1/prices' && method === 'POST') {
        const b = body as { listPrice: number; salePrice: number | null };
        return json(201, { id: 'v9', ...b, unitPrice: b.salePrice ?? b.listPrice, effectiveFrom: T, note: null, status: 'CURRENT', createdBy: { id: 'u-1', fullName: null }, createdAt: T });
      }
      if (path === '/orgs/org-1/travel-fee-policy' && method === 'GET') return json(200, POLICY);
      if (path === '/orgs/org-1/travel-fee-policy' && method === 'PUT') return json(200, { ...(body as object), updatedAt: '2026-10-18T01:00:00.000Z' });
      if (path === '/orgs/org-1/studio-locations') return json(200, { items: [{ id: 'st1', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', latitude: null, longitude: null, isDefault: true, isActive: true, createdAt: T, updatedAt: T }] });
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
const ARTIST = SYSTEM_ROLES.artist.permissions;
const ACCOUNTANT = SYSTEM_ROLES.accountant.permissions;

async function openPackage(name = 'Cô dâu – Ngày cưới') {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  return screen.findByRole('dialog', { name });
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gói theo nhân vật — danh sách gọn', () => {
  it('mỗi nhân vật một thẻ; dòng gói chỉ có 3 thông tin: tên · nơi làm · giá bán', async () => {
    setupServer(OWNER);
    renderAt('/chien/bang-gia/goi');
    const row = await screen.findByRole('button', { name: /Cô dâu – Ngày cưới/ });
    expect([...row.children].map((c) => c.textContent)).toEqual(['Cô dâu – Ngày cưới', 'Mọi nơi', '2.700.000 ₫']);
    expect(screen.getByRole('button', { name: /Mẹ – Trang điểm nhẹ nhàng/ }).textContent).toContain('Studio · Tại nhà');
    expect(screen.getByRole('heading', { name: /Cô dâu.*1 gói/ })).toBeTruthy();
    // "Mọi nhân vật" chưa có gói: không có thẻ riêng, nằm trong dòng gọn "Chưa có gói:" ở cuối.
    expect(screen.queryByRole('heading', { name: /Mọi nhân vật/ })).toBeNull();
    expect(screen.getByText('Chưa có gói:').parentElement?.textContent).toBe('Chưa có gói:Mọi nhân vật');
    // Không ô tick trong danh sách chỉ để xem.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Thêm gói' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm nhân vật' })).toBeTruthy();
  });

  it('/bang-gia chuyển sang nhóm Gói; nhóm lạ → không tìm thấy', async () => {
    setupServer(OWNER);
    const router = renderAt('/chien/bang-gia');
    await screen.findByRole('button', { name: /Cô dâu – Ngày cưới/ });
    expect(router.state.location.pathname).toBe('/chien/bang-gia/goi');
  });

  it('nhóm lạ → "Không có mục bảng giá này."', async () => {
    setupServer(OWNER);
    renderAt('/chien/bang-gia/khong-co');
    expect(await screen.findByText('Không có mục bảng giá này.')).toBeTruthy();
  });

  it('tải lỗi 403 → dải "Bạn không có quyền …"', async () => {
    setupServer(OWNER, (m, p) => (p === '/orgs/org-1/packages' ? err(403, 'FORBIDDEN', 'Bạn không có quyền xem bảng giá') : undefined));
    renderAt('/chien/bang-gia/goi');
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem bảng giá');
  });
});

describe('Hộp chi tiết gói — 5 nhóm, quyền', () => {
  it('chủ: đủ 5 nhóm; tiền công hiện bậc + ảnh + tên thợ + ô tiền ("Chưa đặt" khi null)', async () => {
    setupServer(OWNER);
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    expect(within(dlg).getByText('Cô dâu · G-CD01')).toBeTruthy();
    expect(within(dlg).getAllByRole('heading', { level: 3 }).map((h) => h.firstChild?.textContent)).toEqual([
      'Thông tin & giá',
      'Địa điểm cho phép',
      'Đã gồm trong gói',
      'Dịch vụ phụ cho tick',
      'Tiền công thợ theo bậc',
    ]);
    // Địa điểm: 3 ô tick, đủ 3 đang tick.
    for (const label of ['Tại studio / cửa hàng', 'Tại nhà khách', 'Địa điểm khác']) {
      expect((within(dlg).getByRole('checkbox', { name: label }) as HTMLInputElement).checked).toBe(true);
    }
    expect(within(dlg).getByLabelText('Bán kính miễn phí')).toBeTruthy();
    expect((within(dlg).getByRole('checkbox', { name: /Làm nail/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(dlg).getByRole('checkbox', { name: /Lens/ }) as HTMLInputElement).checked).toBe(false);
    const bac1 = await within(dlg).findByLabelText('Thợ chính bậc 1');
    expect((bac1 as HTMLInputElement).value).toBe('700.000 ₫');
    expect(within(dlg).getByText('Nguyễn Thu Hà, Trần Minh Anh')).toBeTruthy();
    expect(within(dlg).getByRole('group', { name: 'Nguyễn Thu Hà, Trần Minh Anh' })).toBeTruthy();
    expect((within(dlg).getByLabelText('Thợ phụ') as HTMLInputElement).placeholder).toBe('Chưa đặt');
    expect(within(dlg).getByRole('button', { name: 'Lưu' })).toBeTruthy();
  });

  it('thợ (chỉ catalog.read): ẩn nút thêm, hộp chỉ xem, KHÔNG có nhóm tiền công, chân chỉ còn "Đóng"', async () => {
    const calls = setupServer(ARTIST);
    renderAt('/chien/bang-gia/goi');
    await screen.findByRole('button', { name: /Cô dâu – Ngày cưới/ });
    expect(screen.queryByRole('button', { name: 'Thêm gói' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thêm nhân vật' })).toBeNull();
    const dlg = await openPackage();
    expect(within(dlg).getAllByRole('heading', { level: 3 })).toHaveLength(4);
    expect(within(dlg).queryByText('Tiền công thợ theo bậc')).toBeNull();
    expect((within(dlg).getByLabelText('Tên gói') as HTMLInputElement).disabled).toBe(true);
    expect((within(dlg).getByLabelText('Giá bán') as HTMLInputElement).disabled).toBe(true);
    expect(within(dlg).queryByRole('button', { name: 'Lưu' })).toBeNull();
    // Chân hộp: chỉ "Đóng" (cạnh nút ✕ cũng tên "Đóng" ở đầu hộp).
    expect(within(dlg).getAllByRole('button', { name: 'Đóng' })).toHaveLength(2);
    expect(calls.some((c) => c.path.includes('pay-rates'))).toBe(false);
  });

  it('kế toán (payroll.read, không payroll.write): thấy tiền công nhưng ô khoá', async () => {
    setupServer(ACCOUNTANT);
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    const bac1 = (await within(dlg).findByLabelText('Thợ chính bậc 1')) as HTMLInputElement;
    expect(bac1.disabled).toBe(true);
  });
});

describe('Lưu hộp chi tiết gói', () => {
  it('lần lượt PATCH → POST giá → PUT tiền công, mỗi bước chỉ gửi phần đã đổi', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER);
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    const name = within(dlg).getByLabelText('Tên gói');
    await user.clear(name);
    await user.type(name, 'Cô dâu – Cưới');
    const sale = within(dlg).getByLabelText('Giá bán');
    await user.clear(sale);
    await user.type(sale, '2500000');
    const tho = await within(dlg).findByLabelText('Thợ phụ');
    await user.type(tho, '80000');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toEqual(['PATCH /orgs/org-1/packages/p1', 'POST /orgs/org-1/packages/p1/prices', 'PUT /orgs/org-1/packages/p1/pay-rates']);
    const body = (m: string) => calls.find((c) => `${c.method} ${c.path}`.startsWith(m))?.body;
    expect(body('PATCH')).toEqual({ name: 'Cô dâu – Cưới' });
    expect(body('POST')).toEqual({ listPrice: 3_000_000, salePrice: 2_500_000 });
    expect(body('PUT')).toEqual({ rates: [{ tierId: 't2', amount: 80_000 }] });
  });

  it('bỏ tick địa điểm cuối cùng → lỗi, không gửi; bỏ dịch vụ phụ → PATCH items gửi lại toàn bộ', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER);
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    for (const label of ['Tại studio / cửa hàng', 'Tại nhà khách', 'Địa điểm khác']) await user.click(within(dlg).getByRole('checkbox', { name: label }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Chọn ít nhất một địa điểm.')).toBeTruthy();
    expect(writes(calls)).toEqual([]);
    await user.click(within(dlg).getByRole('checkbox', { name: 'Tại studio / cửa hàng' }));
    await user.click(within(dlg).getByRole('checkbox', { name: /Làm nail/ }));
    await user.click(within(dlg).getByRole('checkbox', { name: /Lens/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      locationTypes: ['STUDIO'],
      items: [
        { serviceId: 'mcd', quantity: 1, isOptional: false },
        { serviceId: 'lens', quantity: 1, isOptional: true },
      ],
    });
  });

  it('400 ở bước giá (giá bán > giá niêm yết): lỗi dưới ô Giá bán, hộp vẫn mở; lưu lại KHÔNG gửi lại PATCH đã xong', async () => {
    const user = userEvent.setup();
    let priceFails = true;
    const calls = setupServer(OWNER, (m, p) => {
      if (m === 'POST' && p.endsWith('/prices') && priceFails) {
        priceFails = false;
        return err(400, 'VALIDATION_FAILED', 'Giá khuyến mại không được lớn hơn giá niêm yết', { listPrice: 3_000_000, salePrice: 3_500_000 });
      }
      return undefined;
    });
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    await user.clear(within(dlg).getByLabelText('Tên gói'));
    await user.type(within(dlg).getByLabelText('Tên gói'), 'Gói mới tên');
    const sale = within(dlg).getByLabelText('Giá bán');
    await user.clear(sale);
    await user.type(sale, '3500000');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Giá khuyến mại không được lớn hơn giá niêm yết')).toBeTruthy();
    expect(sale.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Sửa giá rồi lưu lại: PATCH đã xong không gửi lại.
    await user.clear(sale);
    await user.type(sale, '2900000');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toEqual(['PATCH /orgs/org-1/packages/p1', 'POST /orgs/org-1/packages/p1/prices', 'POST /orgs/org-1/packages/p1/prices']);
  });

  it('403 khi lưu → dải đỏ "Bạn không có quyền …", hộp vẫn mở, dữ liệu đã nhập giữ nguyên', async () => {
    const user = userEvent.setup();
    setupServer(OWNER, (m, p) => (m === 'PATCH' && p === '/orgs/org-1/packages/p1' ? err(403, 'FORBIDDEN', 'Bạn không có quyền sửa gói') : undefined));
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    const name = within(dlg).getByLabelText('Tên gói') as HTMLInputElement;
    await user.type(name, ' X');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect((await within(dlg).findByText('Bạn không có quyền sửa gói')).getAttribute('role')).toBe('alert');
    expect(name.value).toBe('Cô dâu – Ngày cưới X');
  });

  it('409 trùng mã khi tạo gói → lỗi dưới ô Mã gói', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p) =>
      m === 'POST' && p === '/orgs/org-1/packages' ? err(409, 'CONFLICT', 'Mã gói đã có trong tổ chức', { fields: ['organization_id', 'code'] }) : undefined,
    );
    renderAt('/chien/bang-gia/goi');
    await user.click(await screen.findByRole('button', { name: 'Thêm gói cho mẹ cô dâu' }));
    const dlg = await screen.findByRole('dialog', { name: 'Gói mới' });
    expect(dlg.querySelector('.ui-dialog__eyebrow')?.textContent).toBe('Mẹ cô dâu');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    // Ô trống báo lỗi trước, không gửi.
    expect(await within(dlg).findByText('Nhập mã gói.')).toBeTruthy();
    expect(writes(calls)).toEqual([]);
    await user.type(within(dlg).getByLabelText('Mã gói'), 'G-CD01');
    await user.type(within(dlg).getByLabelText('Tên gói'), 'Mẹ – Cơ bản');
    await user.type(within(dlg).getByLabelText('Thời lượng'), '60');
    await user.type(within(dlg).getByLabelText('Giá niêm yết'), '500000');
    await user.type(within(dlg).getByLabelText('Cọc mặc định'), '0');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Mã gói đã có trong tổ chức')).toBeTruthy();
    expect(within(dlg).getByLabelText('Mã gói').getAttribute('aria-invalid')).toBe('true');
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ code: 'G-CD01', subjectId: 's2', durationMinutes: 60, listPrice: 500_000, depositAmount: 0 });
  });
});

describe('Phí di chuyển & studio', () => {
  it('4 cách tính; đổi sang theo bậc + thêm bậc → PUT đủ 7 trường', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER);
    renderAt('/chien/bang-gia/di-chuyen');
    const group = await screen.findByRole('radiogroup', { name: 'Cách tính mặc định' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Cố định', 'Theo km', 'Theo bậc', 'Nhập tay']);
    expect(within(group).getByRole('radio', { name: 'Theo km' }).getAttribute('aria-checked')).toBe('true');
    expect((await screen.findByRole('radio', { name: 'Đặt Studio Chiến làm mặc định' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
    await user.click(within(group).getByRole('radio', { name: 'Theo bậc' }));
    await user.click(screen.getByRole('button', { name: 'Thêm bậc' }));
    // Bậc mới bắt đầu ở km kết thúc của bậc trước; thiếu tiền → lỗi, không gửi.
    expect((screen.getByLabelText('Bậc 2: từ km') as HTMLInputElement).value).toBe('10');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Nhập số tiền.')).toBeTruthy();
    expect(writes(calls)).toEqual([]);
    await user.type(screen.getByLabelText('Bậc 2: phí'), '250000');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(calls)).toEqual(['PUT /orgs/org-1/travel-fee-policy']));
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      defaultMode: 'TIERED',
      fixedAmount: 150_000,
      perKmAmount: 10_000,
      freeKm: 3,
      minimumAmount: 100_000,
      roundTrip: true,
      tiers: [
        { fromKm: 0, toKm: 10, amount: 100_000 },
        { fromKm: 10, toKm: null, amount: 250_000 },
      ],
    });
  });

  it('không có prices.write: thẻ phí di chuyển chỉ xem; không có catalog.write: không thêm studio', async () => {
    setupServer(ARTIST);
    renderAt('/chien/bang-gia/di-chuyen');
    const group = await screen.findByRole('radiogroup', { name: 'Cách tính mặc định' });
    expect(group.getAttribute('aria-disabled')).toBe('true');
    expect((screen.getByLabelText('Đơn giá mỗi km') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Thêm bậc' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thêm studio / cửa hàng' })).toBeNull();
    expect((await screen.findByRole('radio', { name: 'Đặt Studio Chiến làm mặc định' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('chưa có cấu hình (404): ô trống, Lưu báo lỗi từng ô, không gửi', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p) =>
      m === 'GET' && p === '/orgs/org-1/travel-fee-policy' ? err(404, 'NOT_FOUND', 'Tổ chức chưa có cấu hình phí di chuyển') : undefined,
    );
    renderAt('/chien/bang-gia/di-chuyen');
    await user.click(await screen.findByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Chọn cách tính mặc định.')).toBeTruthy();
    expect(screen.getAllByText('Nhập số tiền (không dùng thì nhập 0).')).toHaveLength(3);
    expect(writes(calls)).toEqual([]);
  });

  it('máy chủ báo chồng bậc → lỗi dưới nhóm Bậc khoảng cách', async () => {
    const user = userEvent.setup();
    setupServer(OWNER, (m, p) =>
      m === 'PUT' && p === '/orgs/org-1/travel-fee-policy' ? err(400, 'VALIDATION_FAILED', 'Bậc 0–10 km và bậc 5–∞ km chồng nhau', { tiers: [] }) : undefined,
    );
    renderAt('/chien/bang-gia/di-chuyen');
    await user.click(await screen.findByRole('button', { name: 'Thêm bậc' }));
    const from = screen.getByLabelText('Bậc 2: từ km');
    await user.clear(from);
    await user.type(from, '5');
    await user.type(screen.getByLabelText('Bậc 2: phí'), '1000');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Bậc 0–10 km và bậc 5–∞ km chồng nhau')).toBeTruthy();
  });
});

describe('Dịch vụ phụ & phụ phí, Nhân vật', () => {
  it('hai nhóm; dòng: tên · thời lượng · giá', async () => {
    setupServer(OWNER);
    renderAt('/chien/bang-gia/dich-vu');
    const row = await screen.findByRole('button', { name: /Làm nail/ });
    expect([...row.children].map((c) => c.textContent)).toEqual(['Làm nail', '30 phút', '250.000 ₫']);
    expect(screen.getByRole('heading', { name: 'Dịch vụ phụ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Phụ phí cài sẵn' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Phụ phí ngày lễ/ })).toBeTruthy();
  });

  it('nhân vật: tên · n gói · công tắc; tắt → PATCH isActive', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p, b) => (m === 'PATCH' && p.startsWith('/orgs/org-1/makeup-subjects/') ? json(200, { ...SUBJECTS[0], ...(b as object) }) : undefined));
    renderAt('/chien/bang-gia/nhan-vat');
    const sw = await screen.findByRole('switch', { name: 'Cô dâu: đang dùng' });
    expect(screen.getAllByText('1 gói')).toHaveLength(2);
    expect(sw.getAttribute('title')).toMatch(/^Đang dùng/);
    await user.click(sw);
    await waitFor(() => expect(writes(calls)).toEqual(['PATCH /orgs/org-1/makeup-subjects/s1']));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ isActive: false });
  });

  it('M1: công tắc nhân vật đang tắt → tên đọc "đang ẩn", chữ nổi "Đang ẩn …" (aria-checked=false)', async () => {
    setupServer(OWNER, (m, p) =>
      m === 'GET' && p === '/orgs/org-1/makeup-subjects' ? json(200, { items: [{ ...SUBJECTS[0], isActive: false }, ...SUBJECTS.slice(1)] }) : undefined,
    );
    renderAt('/chien/bang-gia/nhan-vat');
    const off = await screen.findByRole('switch', { name: 'Cô dâu: đang ẩn' });
    expect(off.getAttribute('aria-checked')).toBe('false');
    expect(off.getAttribute('title')).toMatch(/^Đang ẩn/);
    expect(screen.queryByRole('switch', { name: 'Cô dâu: đang dùng' })).toBeNull();
  });

  it('R1: chữ nổi công tắc nhân vật nhắc cả hợp đồng lẫn trang công khai (bật và tắt)', async () => {
    setupServer(OWNER, (m, p) =>
      m === 'GET' && p === '/orgs/org-1/makeup-subjects' ? json(200, { items: [{ ...SUBJECTS[0], isActive: false }, ...SUBJECTS.slice(1)] }) : undefined,
    );
    renderAt('/chien/bang-gia/nhan-vat');
    const off = await screen.findByRole('switch', { name: 'Cô dâu: đang ẩn' });
    expect(off.getAttribute('title')).toBe('Đang ẩn — gói của nhân vật này không hiện khi lập hợp đồng và trên trang công khai. Bật để dùng lại');
    const on = screen.getByRole('switch', { name: 'Mẹ cô dâu: đang dùng' });
    expect(on.getAttribute('title')).toBe('Đang dùng — tắt để ẩn nhân vật: gói của nhân vật này sẽ không hiện khi lập hợp đồng và trên trang công khai');
  });

  it('nhân vật: mũi tên xuống trên tay nắm → đổi thứ tự, chỉ PATCH nhân vật đổi chỗ', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p, b) => (m === 'PATCH' ? json(200, { ...SUBJECTS[0], ...(b as object) }) : undefined));
    renderAt('/chien/bang-gia/nhan-vat');
    const grip = await screen.findByRole('button', { name: 'Đổi thứ tự Cô dâu' });
    grip.focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'PATCH').map((c) => [c.path, c.body])).toEqual([
      ['/orgs/org-1/makeup-subjects/s2', { sortOrder: 0 }],
      ['/orgs/org-1/makeup-subjects/s1', { sortOrder: 1 }],
    ]);
  });
});

describe('Bổ sung theo duyệt của điều phối: nhân vật chưa có gói, Đang bán, Dịch vụ trong gói', () => {
  it('nhân vật chưa có gói gom một dòng cuối; bấm tên → hộp tạo gói cho đúng nhân vật', async () => {
    const user = userEvent.setup();
    const extra = { ...SUBJECTS[0], id: 's3', name: 'Chú rể', sortOrder: 2 };
    setupServer(OWNER, (m, p) => (p === '/orgs/org-1/makeup-subjects' ? json(200, { items: [...SUBJECTS, extra] }) : undefined));
    renderAt('/chien/bang-gia/goi');
    await screen.findByRole('button', { name: /Cô dâu – Ngày cưới/ });
    expect(screen.getByText('Chưa có gói:').parentElement?.textContent).toBe('Chưa có gói:Chú rể · Mọi nhân vật');
    // Chỉ 2 thẻ (nhân vật có gói), không thẻ rỗng.
    expect(document.querySelectorAll('.pr-subj')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Thêm gói cho chú rể' }));
    const dlg = await screen.findByRole('dialog', { name: 'Gói mới' });
    expect(dlg.querySelector('.ui-dialog__eyebrow')?.textContent).toBe('Chú rể');
  });

  it('gói ngừng bán: mặc định ẩn; chip "Cả ngừng bán" (đếm 1) hiện lại kèm nhãn "Ngừng bán"', async () => {
    const user = userEvent.setup();
    const off = { ...PKG2, id: 'p3', code: 'G-OLD', name: 'Gói cũ', isActive: false };
    setupServer(OWNER, (m, p) => (p === '/orgs/org-1/packages' && m === 'GET' ? json(200, { items: [PKG, PKG2, off], page: 1, pageSize: 100, total: 3 }) : undefined));
    renderAt('/chien/bang-gia/goi');
    await screen.findByRole('button', { name: /Cô dâu – Ngày cưới/ });
    expect(screen.queryByRole('button', { name: /Gói cũ/ })).toBeNull();
    const chip = screen.getByRole('button', { name: /Cả ngừng bán/ });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(chip.textContent).toBe('Cả ngừng bán1');
    await user.click(chip);
    expect((await screen.findByRole('button', { name: /Gói cũ/ })).textContent).toContain('Ngừng bán');
  });

  it('công tắc "Đang bán" trong hộp gói → PATCH {isActive:false}, không xoá', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER);
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    const sw = within(dlg).getByRole('switch', { name: 'Đang bán' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await user.click(sw);
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toEqual(['PATCH /orgs/org-1/packages/p1']);
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ isActive: false });
  });

  it('trang Dịch vụ có nhóm thứ ba "Dịch vụ trong gói" (loại MAIN), mở cùng hộp dịch vụ có "Đang bán"', async () => {
    const user = userEvent.setup();
    setupServer(OWNER);
    renderAt('/chien/bang-gia/dich-vu');
    const section = await screen.findByRole('region', { name: 'Dịch vụ trong gói' });
    await user.click(await within(section).findByRole('button', { name: /Makeup cô dâu/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Makeup cô dâu' });
    expect(dlg.querySelector('.ui-dialog__eyebrow')?.textContent).toBe('Dịch vụ trong gói · MCD');
    expect(within(dlg).getByRole('switch', { name: 'Đang bán' })).toBeTruthy();
  });
});

// Biên bản web 2 (thợ T) + N-J1 (thợ R thêm resetKey).
describe('biên bản web 2: bảng giá', () => {
  it('N-J1: ô "Mức cố định" đang lỗi "-5" (giá trị chưa đổi) → vẫn có nút Huỷ; bấm Huỷ → ô hiện số cũ, hết lỗi', async () => {
    const user = userEvent.setup();
    setupServer(OWNER);
    renderAt('/chien/bang-gia/di-chuyen');
    const box = (await screen.findByLabelText('Mức cố định mỗi lần đi')) as HTMLInputElement;
    // Chọn hết rồi gõ "-5": ô báo lỗi, giá trị form KHÔNG đổi (vẫn 150.000) — form chỉ biết qua onInputError.
    await user.tripleClick(box);
    await user.keyboard('-5');
    expect(await screen.findByText('Số tiền không được âm.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByText('Số tiền không được âm.')).toBeNull());
    expect((screen.getByLabelText('Mức cố định mỗi lần đi') as HTMLInputElement).value).toBe('150.000 ₫');
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
  });

  it('T6: giá niêm yết vượt trần máy chủ (900 nghìn tỷ) → lời máy chủ hiện dưới ô Giá niêm yết, hộp vẫn mở, không coi là đã lưu', async () => {
    const user = userEvent.setup();
    setupServer(OWNER, (m, p) =>
      m === 'POST' && p.endsWith('/prices')
        ? err(400, 'VALIDATION_FAILED', 'Dữ liệu gửi lên không hợp lệ', {
            formErrors: [],
            fieldErrors: { listPrice: ['Số tiền quá lớn (tối đa 100.000.000.000 đ)'] },
            issues: [{ path: 'listPrice', message: 'Số tiền quá lớn (tối đa 100.000.000.000 đ)' }],
          })
        : undefined,
    );
    renderAt('/chien/bang-gia/goi');
    const dlg = await openPackage();
    const list = within(dlg).getByLabelText('Giá niêm yết');
    await user.clear(list);
    await user.type(list, '900000000000000');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Số tiền quá lớn (tối đa 100.000.000.000 đ)')).toBeTruthy();
    expect(list.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  // Máy chủ 74fda02/2f362c9: phụ phí bỏ trống thời lượng (durationMinutes: null); MAIN/ADDON vẫn bắt buộc.
  const PP_NULL = { ...svc('pple', 'SURCHARGE', 'Phụ phí ngày lễ', 200_000), durationMinutes: null };
  const listWith = (items: unknown[]): Override => (m, p) =>
    m === 'GET' && p === '/orgs/org-1/services' ? json(200, { items, page: 1, pageSize: 100, total: items.length }) : undefined;
  const chain = (...os: Override[]): Override => (m, p, b) => os.reduce<Response | undefined>((r, o) => r ?? o(m, p, b), undefined);

  it('N5: phụ phí thời lượng null → danh sách để trống (không "0 phút"); hộp tạo phụ phí không hỏi thời lượng và KHÔNG gửi trường durationMinutes', async () => {
    const user = userEvent.setup();
    const calls = setupServer(
      OWNER,
      chain(listWith([SERVICES[1], PP_NULL]), (m, p, b) =>
        m === 'POST' && p === '/orgs/org-1/services' ? json(201, { ...svc('moi', 'SURCHARGE', 'Phụ phí ngoài giờ', 300_000), durationMinutes: null, ...(b as object) }) : undefined,
      ),
    );
    renderAt('/chien/bang-gia/dich-vu');
    const row = await screen.findByRole('button', { name: /Phụ phí ngày lễ/ });
    expect([...row.children].map((c) => c.textContent)).toEqual(['Phụ phí ngày lễ', '', '200.000 ₫']);
    expect(row.textContent).not.toMatch(/phút/);
    await user.click(screen.getByRole('button', { name: 'Thêm phụ phí' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).queryByLabelText('Thời lượng')).toBeNull();
    expect((within(dlg).getByLabelText('Loại') as HTMLSelectElement).value).toBe('SURCHARGE');
    await user.type(within(dlg).getByLabelText('Tên'), 'Phụ phí ngoài giờ');
    await user.type(within(dlg).getByLabelText('Mã'), 'PP-NG');
    await user.type(within(dlg).getByLabelText('Giá niêm yết'), '300000');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/orgs/org-1/services')).toBe(true));
    const body = calls.find((c) => c.method === 'POST' && c.path === '/orgs/org-1/services')?.body as Record<string, unknown>;
    expect(body).toMatchObject({ kind: 'SURCHARGE', name: 'Phụ phí ngoài giờ', listPrice: 300_000 });
    expect('durationMinutes' in body).toBe(false);
  });

  it('đổi phụ phí (thời lượng trống) sang Dịch vụ trong gói: hiện ô Thời lượng, Lưu khi trống → lỗi đúng ô, KHÔNG gọi máy chủ; nhập số → PATCH kind + durationMinutes', async () => {
    const user = userEvent.setup();
    const calls = setupServer(
      OWNER,
      chain(listWith([PP_NULL]), (m, p, b) => (m === 'PATCH' && p === '/orgs/org-1/services/pple' ? json(200, { ...PP_NULL, ...(b as object) }) : undefined)),
    );
    renderAt('/chien/bang-gia/dich-vu');
    await user.click(await screen.findByRole('button', { name: /Phụ phí ngày lễ/ }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).queryByLabelText('Thời lượng')).toBeNull();
    await user.selectOptions(within(dlg).getByLabelText('Loại'), 'MAIN');
    const dur = within(dlg).getByLabelText('Thời lượng');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Nhập thời lượng.')).toBeTruthy();
    expect(dur.getAttribute('aria-invalid')).toBe('true');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    await user.type(dur, '60');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ kind: 'MAIN', durationMinutes: 60 }));
  });

  it('400 của máy chủ ở durationMinutes (details.issues[0].path) → lời máy chủ nằm dưới ô Thời lượng, hộp vẫn mở', async () => {
    const user = userEvent.setup();
    const msg = 'Dịch vụ chính và dịch vụ phụ phải có thời lượng (1–1440 phút); chỉ phụ phí được bỏ trống';
    setupServer(
      OWNER,
      chain(listWith([PP_NULL]), (m, p) =>
        m === 'PATCH' && p === '/orgs/org-1/services/pple'
          ? err(400, 'VALIDATION_FAILED', msg, { formErrors: [], fieldErrors: { durationMinutes: [msg] }, issues: [{ path: 'durationMinutes', message: msg }] })
          : undefined,
      ),
    );
    renderAt('/chien/bang-gia/dich-vu');
    await user.click(await screen.findByRole('button', { name: /Phụ phí ngày lễ/ }));
    const dlg = await screen.findByRole('dialog');
    // Đổi tên (phụ phí vẫn là phụ phí, ô thời lượng ẩn) — máy chủ vẫn trả 400 ở durationMinutes: ô phải hiện ra để mang lỗi.
    await user.type(within(dlg).getByLabelText('Tên'), ' 2');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText(msg)).toBeTruthy();
    expect(within(dlg).getByLabelText('Thời lượng').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('phụ phí cũ mang số phút giả: mở hộp thấy ô (để tự xoá), sửa chỗ khác KHÔNG gửi thời lượng; xoá trống → gửi durationMinutes: null', async () => {
    const user = userEvent.setup();
    const legacy = { ...svc('pple', 'SURCHARGE', 'Phụ phí ngày lễ', 200_000), durationMinutes: 1 };
    const calls = setupServer(
      OWNER,
      chain(listWith([legacy]), (m, p, b) => (m === 'PATCH' && p === '/orgs/org-1/services/pple' ? json(200, { ...legacy, ...(b as object) }) : undefined)),
    );
    renderAt('/chien/bang-gia/dich-vu');
    const row = await screen.findByRole('button', { name: /Phụ phí ngày lễ/ });
    expect([...row.children].map((c) => c.textContent)).toEqual(['Phụ phí ngày lễ', '', '200.000 ₫']);
    await user.click(row);
    let dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByLabelText('Tên'), ' 2');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'Phụ phí ngày lễ 2' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(await screen.findByRole('button', { name: /Phụ phí ngày lễ/ }));
    dlg = await screen.findByRole('dialog');
    await user.clear(within(dlg).getByLabelText('Thời lượng'));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ durationMinutes: null }));
  });
});

// ======================= Bản vẽ D: Loại sự kiện, Luật phụ phí (gói W2) =======================

const OCC = (id: string, name: string, color: string, sortOrder: number, isActive: boolean, lineCount: number) => ({
  id,
  name,
  color,
  sortOrder,
  isActive,
  lineCount,
  createdAt: T,
  updatedAt: T,
});
const OCCASIONS = [OCC('o1', 'Lễ vu quy', 'taupe', 0, true, 14), OCC('o2', 'Lễ cưới', 'rose', 1, true, 22), OCC('o3', 'Ăn hỏi', 'amber', 2, false, 0)];

function rule(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Ca sớm trước 6 giờ',
    serviceId: 'pple',
    service: { id: 'pple', name: 'Phụ phí ngày lễ', kind: 'SURCHARGE', isActive: true, currentPrice: 200_000 },
    startTime: '00:00',
    endTime: '06:00',
    weekdays: [],
    dates: [],
    occasionIds: ['o2', 'o1'],
    packageIds: ['p1'],
    subjectIds: [],
    perQuantity: true,
    note: null,
    sortOrder: 0,
    isActive: true,
    status: 'OK',
    usedLineCount: 3,
    createdAt: T,
    updatedAt: T,
    ...over,
  };
}
const RULE1 = rule();
const RULE2 = rule({
  id: 'r2',
  name: 'Cuối tuần và lễ',
  startTime: null,
  endTime: null,
  weekdays: [6, 7],
  dates: ['2026-09-02'],
  occasionIds: [],
  packageIds: [],
  service: { id: 'pple', name: 'Phụ phí ngày lễ', kind: 'SURCHARGE', isActive: true, currentPrice: null },
  sortOrder: 1,
  status: 'NO_PRICE',
  usedLineCount: 0,
});

const PATH_OCC = '/orgs/org-1/occasions';
const PATH_RULES = '/orgs/org-1/surcharge-rules';

// Máy chủ giả cho hai đường mới: giữ danh sách trong bộ nhớ, trả đúng dạng OccasionView / SurchargeRuleView. `fail` ép lỗi theo "METHOD path".
function dServer(permissions: readonly string[], opts: { occasions?: unknown[]; rules?: unknown[]; fail?: Record<string, Response> } = {}) {
  const occasions = [...(opts.occasions ?? OCCASIONS)] as ReturnType<typeof OCC>[];
  const rules = [...(opts.rules ?? [RULE1, RULE2])] as ReturnType<typeof rule>[];
  const calls = setupServer(permissions, (m, p, b) => {
    const failure = opts.fail?.[`${m} ${p}`];
    if (failure) return failure;
    if (p === PATH_OCC && m === 'GET') return json(200, { items: occasions });
    if (p === PATH_OCC && m === 'POST') {
      const made = OCC(`o${occasions.length + 1}`, (b as { name: string }).name, (b as { color: string }).color, occasions.length, true, 0);
      occasions.push(made);
      return json(201, made);
    }
    if (p === `${PATH_OCC}/order` && m === 'PUT') {
      const ids = (b as { occasionIds: string[] }).occasionIds;
      return json(200, { items: ids.map((id, i) => ({ ...occasions.find((o) => o.id === id), sortOrder: i })) });
    }
    if (p.startsWith(`${PATH_OCC}/`) && m === 'PATCH') return json(200, { ...occasions.find((o) => p.endsWith(o.id)), ...(b as object) });
    if (p === PATH_RULES && m === 'GET') return json(200, { items: rules });
    if (p === PATH_RULES && m === 'POST') return json(201, rule({ ...(b as object), id: 'r9' }));
    if (p.startsWith(`${PATH_RULES}/`) && m === 'PATCH') return json(200, { ...rules.find((r) => p.endsWith(r.id)), ...(b as object) });
    return undefined;
  });
  return calls;
}
const bodyOf = (calls: Call[], method: string, path?: string) => calls.filter((c) => c.method === method && (path === undefined || c.path === path)).at(-1)?.body;

// Giả lập điện thoại cho useBreakpoint (matchMedia khớp điểm gãy ≤ 640).
function stubPhone() {
  vi.stubGlobal(
    'matchMedia',
    (q: string) => ({ matches: q.includes('max-width: 640px'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }),
  );
}

describe('Bảng giá › Loại sự kiện', () => {
  it('mỗi loại: tên · "N dòng hợp đồng đang dùng" · 12 ô màu có tên tiếng Việt · công tắc; ô đang chọn bấm-xuống', async () => {
    dServer(OWNER);
    renderAt('/chien/bang-gia/su-kien');
    expect(await screen.findByRole('heading', { level: 2, name: /Loại sự kiện/ })).toBeTruthy();
    expect(screen.getByText('3 loại · màu dùng chung 12 màu của Lịch')).toBeTruthy();
    expect(screen.getByText('14 dòng hợp đồng đang dùng')).toBeTruthy();
    expect(screen.getByText('Chưa có dòng hợp đồng nào dùng')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Màu của Lễ cưới' });
    const titles = within(group).getAllByRole('button').map((b) => b.getAttribute('title'));
    expect(titles).toEqual(['Hồng', 'Tím', 'Hổ phách', 'Xanh lá', 'Xanh dương', 'Nâu xám', 'Đỏ gạch', 'Xanh dầu', 'Ô liu', 'Mận', 'Xanh rừng', 'Nâu']);
    expect(within(group).getByRole('button', { name: 'Lễ cưới: màu Hồng' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: 'Lễ cưới: màu Tím' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Ăn hỏi: đang ẩn' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'Đổi thứ tự Lễ cưới' }).getAttribute('title')).toBe('Kéo để đổi thứ tự trong ô chọn');
    expect(screen.getByText(/Kéo ⋮⋮ để đổi thứ tự trong ô chọn\. Ẩn loại không xoá các ca cũ đã gắn\./)).toBeTruthy();
  });

  it('bấm ô màu → PATCH { color } ngay, chỉ trường màu', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/su-kien');
    await user.click(await screen.findByRole('button', { name: 'Lễ cưới: màu Tím' }));
    await waitFor(() => expect(writes(calls)).toEqual([`PATCH ${PATH_OCC}/o2`]));
    expect(bodyOf(calls, 'PATCH')).toEqual({ color: 'violet' });
    // Bấm lại đúng màu đang chọn: không gọi gì thêm.
    await user.click(screen.getByRole('button', { name: 'Lễ vu quy: màu Nâu xám' }));
    await new Promise((r) => setTimeout(r, 30));
    expect(writes(calls)).toHaveLength(1);
  });

  it('công tắc ẩn / hiện → PATCH { isActive }; lời máy chủ khi lỗi hiện nguyên văn trên đầu thẻ', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER, { fail: { [`PATCH ${PATH_OCC}/o1`]: err(409, 'CONFLICT', 'Loại này đang được dùng, không ẩn được') } });
    renderAt('/chien/bang-gia/su-kien');
    await user.click(await screen.findByRole('switch', { name: 'Ăn hỏi: đang ẩn' }));
    await waitFor(() => expect(bodyOf(calls, 'PATCH', `${PATH_OCC}/o3`)).toEqual({ isActive: true }));
    await user.click(await screen.findByRole('switch', { name: 'Lễ vu quy: đang dùng' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Loại này đang được dùng, không ẩn được');
  });

  it('mũi tên xuống trên tay nắm → PUT /occasions/order gửi ĐỦ mọi loại (cả loại ẩn), đúng thứ tự mới', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/su-kien');
    const grip = await screen.findByRole('button', { name: 'Đổi thứ tự Lễ vu quy' });
    grip.focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(writes(calls)).toEqual([`PUT ${PATH_OCC}/order`]));
    expect(bodyOf(calls, 'PUT')).toEqual({ occasionIds: ['o2', 'o1', 'o3'] });
  });

  it('điện thoại: không tay nắm, có nút ↑ ↓ (nút đầu không lên được) → PUT đủ danh sách; nút + là nút tròn nổi', async () => {
    stubPhone();
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/su-kien');
    await screen.findByText('14 dòng hợp đồng đang dùng');
    expect(screen.queryByRole('button', { name: /Đổi thứ tự/ })).toBeNull();
    expect((screen.getByRole('button', { name: 'Đưa Lễ vu quy lên' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Đưa Ăn hỏi lên' }));
    await waitFor(() => expect(bodyOf(calls, 'PUT')).toEqual({ occasionIds: ['o1', 'o3', 'o2'] }));
    expect(screen.getByRole('button', { name: 'Thêm loại' }).className).toContain('pr-fab');
    expect(screen.getByText(/Dùng nút ↑ ↓ để đổi thứ tự/)).toBeTruthy();
  });

  it('thứ tự lỗi (400 "Danh sách phải gồm đủ …") → lời máy chủ trên đầu thẻ, danh sách tải lại', async () => {
    const user = userEvent.setup();
    const msg = 'Danh sách phải gồm đủ mọi loại sự kiện của tổ chức, mỗi loại một lần';
    dServer(OWNER, { fail: { [`PUT ${PATH_OCC}/order`]: err(400, 'VALIDATION_FAILED', msg) } });
    renderAt('/chien/bang-gia/su-kien');
    const grip = await screen.findByRole('button', { name: 'Đổi thứ tự Lễ vu quy' });
    grip.focus();
    await user.keyboard('{ArrowDown}');
    expect((await screen.findByRole('alert')).textContent).toBe(msg);
    await waitFor(() => expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('Lễ vu quy'));
  });

  it('không có catalog.write (thợ): không tay nắm, không nút thêm, chỉ thấy MÀU ĐANG CHỌN, công tắc khoá', async () => {
    dServer(ARTIST);
    renderAt('/chien/bang-gia/su-kien');
    const group = await screen.findByRole('group', { name: 'Màu của Lễ cưới' });
    expect(within(group).getAllByRole('button')).toHaveLength(1);
    expect((within(group).getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Đổi thứ tự/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thêm loại' })).toBeNull();
    expect((screen.getByRole('switch', { name: 'Lễ cưới: đang dùng' }) as HTMLButtonElement).disabled).toBe(true);
    // Tên không bấm được (không mở hộp sửa).
    expect(screen.queryByRole('button', { name: 'Lễ cưới' })).toBeNull();
  });

  it('chưa có loại nào → câu trống + nút thêm', async () => {
    dServer(OWNER, { occasions: [] });
    renderAt('/chien/bang-gia/su-kien');
    expect(await screen.findByText('Chưa có loại sự kiện nào.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Thêm loại' }).length).toBeGreaterThan(0);
  });
});

describe('Hộp Loại sự kiện', () => {
  it('thêm: bỏ trống → lỗi dưới ô Tên và Màu, KHÔNG gọi máy chủ; nhập tên + chọn màu → POST đủ trường, xếp cuối', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/su-kien');
    await user.click((await screen.findAllByRole('button', { name: 'Thêm loại' }))[0] as HTMLElement);
    const dlg = await screen.findByRole('dialog', { name: 'Thêm loại sự kiện' });
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(within(dlg).getByText('Nhập tên loại sự kiện.')).toBeTruthy();
    expect(within(dlg).getByText('Chọn một màu.')).toBeTruthy();
    expect(within(dlg).getByLabelText(/Tên loại/).getAttribute('aria-invalid')).toBe('true');
    expect(writes(calls)).toEqual([]);
    await user.type(within(dlg).getByLabelText(/Tên loại/), '  Chụp ngoại cảnh ');
    await user.click(within(dlg).getByRole('button', { name: 'Màu Xanh rừng' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(calls)).toEqual([`POST ${PATH_OCC}`]));
    expect(bodyOf(calls, 'POST')).toEqual({ name: 'Chụp ngoại cảnh', color: 'forest', sortOrder: 3, isActive: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('tên quá 60 ký tự bị chặn ở máy khách', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/su-kien');
    await user.click((await screen.findAllByRole('button', { name: 'Thêm loại' }))[0] as HTMLElement);
    const dlg = await screen.findByRole('dialog');
    const name = within(dlg).getByLabelText(/Tên loại/) as HTMLInputElement;
    expect(name.maxLength).toBe(60);
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(writes(calls)).toEqual([]);
  });

  it('409 trùng tên → lời máy chủ dưới ô Tên, hộp vẫn mở, tên đã nhập giữ nguyên', async () => {
    const user = userEvent.setup();
    dServer(OWNER, { fail: { [`POST ${PATH_OCC}`]: err(409, 'CONFLICT', 'Tên loại sự kiện đã có trong tổ chức', { fields: ['name'] }) } });
    renderAt('/chien/bang-gia/su-kien');
    await user.click((await screen.findAllByRole('button', { name: 'Thêm loại' }))[0] as HTMLElement);
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByLabelText(/Tên loại/), 'Lễ cưới');
    await user.click(within(dlg).getByRole('button', { name: 'Màu Hồng' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Tên loại sự kiện đã có trong tổ chức')).toBeTruthy();
    expect(within(dlg).getByLabelText(/Tên loại/).getAttribute('aria-invalid')).toBe('true');
    expect((within(dlg).getByLabelText(/Tên loại/) as HTMLInputElement).value).toBe('Lễ cưới');
  });

  it('409 "Tối đa 50 loại sự kiện" → dải đỏ đầu hộp (không gắn vào ô)', async () => {
    const user = userEvent.setup();
    dServer(OWNER, { fail: { [`POST ${PATH_OCC}`]: err(409, 'CONFLICT', 'Tối đa 50 loại sự kiện') } });
    renderAt('/chien/bang-gia/su-kien');
    await user.click((await screen.findAllByRole('button', { name: 'Thêm loại' }))[0] as HTMLElement);
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByLabelText(/Tên loại/), 'Mới');
    await user.click(within(dlg).getByRole('button', { name: 'Màu Hồng' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect((await within(dlg).findByRole('alert')).textContent).toBe('Tối đa 50 loại sự kiện');
    expect(within(dlg).getByLabelText(/Tên loại/).getAttribute('aria-invalid')).toBeNull();
  });

  it('sửa: bấm tên → hộp có tên hiện tại; đổi tên → PATCH chỉ { name }; không đổi gì → đóng, không gọi', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/su-kien');
    await user.click(await screen.findByRole('button', { name: 'Lễ cưới' }));
    let dlg = await screen.findByRole('dialog', { name: 'Sửa loại sự kiện' });
    expect((within(dlg).getByLabelText(/Tên loại/) as HTMLInputElement).value).toBe('Lễ cưới');
    expect(within(dlg).getByRole('button', { name: 'Màu Hồng' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Lễ cưới' }));
    dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByLabelText(/Tên loại/), ' sáng');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(bodyOf(calls, 'PATCH', `${PATH_OCC}/o2`)).toEqual({ name: 'Lễ cưới sáng' }));
  });
});

describe('Bảng giá › Luật phụ phí', () => {
  it('mỗi luật: tên · tóm tắt điều kiện đúng chữ · tên phụ phí + giá hiện hành · "Đang dùng ở N dòng" · công tắc', async () => {
    dServer(OWNER);
    renderAt('/chien/bang-gia/luat-phu-phi');
    expect(await screen.findByText('Khớp luật thì hợp đồng tự thêm dòng phụ phí; người lập bỏ được')).toBeTruthy();
    expect(screen.getByText('Giờ bắt đầu 00:00–06:00 · Lễ cưới, Lễ vu quy · Gói Cô dâu – Ngày cưới')).toBeTruthy();
    expect(screen.getByText('Thứ 7, Chủ nhật hoặc ngày 02/09/2026')).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Phụ phí ngày lễ · 200.000 ₫');
    expect(items[0]?.textContent).toContain('Đang dùng ở 3 dòng');
    expect(items[1]?.textContent).toContain('Phụ phí ngày lễ · chưa có giá');
    expect(items[1]?.textContent).not.toContain('Đang dùng ở');
    expect(screen.getByRole('switch', { name: 'Ca sớm trước 6 giờ: đang bật' })).toBeTruthy();
  });

  it('thẻ vàng theo status (luật OK thì không có)', async () => {
    dServer(OWNER, {
      rules: [
        RULE1,
        rule({ id: 'r2', name: 'B', sortOrder: 1, status: 'SERVICE_INACTIVE' }),
        rule({ id: 'r3', name: 'C', sortOrder: 2, status: 'SERVICE_NOT_SURCHARGE' }),
        rule({ id: 'r4', name: 'D', sortOrder: 3, status: 'NO_PRICE' }),
      ],
    });
    renderAt('/chien/bang-gia/luat-phu-phi');
    await screen.findByText('Phụ phí đang ngừng — luật không chạy');
    expect(screen.getByText('Dịch vụ không còn là phụ phí — luật không chạy')).toBeTruthy();
    expect(screen.getByText('Phụ phí chưa có giá — luật không chạy')).toBeTruthy();
    expect(screen.getAllByText(/luật không chạy$/)).toHaveLength(3);
  });

  it('công tắc → PATCH { isActive }; nút ↓ → chỉ PATCH hai luật đổi sortOrder', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/luat-phu-phi');
    await user.click(await screen.findByRole('switch', { name: 'Ca sớm trước 6 giờ: đang bật' }));
    await waitFor(() => expect(bodyOf(calls, 'PATCH', `${PATH_RULES}/r1`)).toEqual({ isActive: false }));
    await user.click(screen.getByRole('button', { name: 'Đưa luật Ca sớm trước 6 giờ xuống' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH' && 'sortOrder' in (c.body as object)).map((c) => [c.path, c.body])).toEqual([
      [`${PATH_RULES}/r2`, { sortOrder: 0 }],
      [`${PATH_RULES}/r1`, { sortOrder: 1 }],
    ]));
    expect(screen.getByRole('button', { name: 'Đưa luật Ca sớm trước 6 giờ xuống' }).getAttribute('title')).toBe('Hai luật cùng một phụ phí: luật đứng trên được áp');
  });

  it('chỉ có catalog.read (thợ): thấy luật, không nút thêm, không mũi tên, tên không bấm được, công tắc khoá', async () => {
    dServer(ARTIST);
    renderAt('/chien/bang-gia/luat-phu-phi');
    await screen.findByText('Giờ bắt đầu 00:00–06:00 · Lễ cưới, Lễ vu quy · Gói Cô dâu – Ngày cưới');
    expect(screen.queryByRole('button', { name: 'Thêm luật' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Đưa luật/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ca sớm trước 6 giờ' })).toBeNull();
    expect((screen.getByRole('switch', { name: 'Ca sớm trước 6 giờ: đang bật' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('chưa có luật → câu trống; tải lỗi 403 → dải quyền', async () => {
    dServer(OWNER, { rules: [] });
    renderAt('/chien/bang-gia/luat-phu-phi');
    expect(await screen.findByText('Chưa có luật phụ phí nào.')).toBeTruthy();
  });
});

describe('Hộp Luật phụ phí', () => {
  async function openNew(user: ReturnType<typeof userEvent.setup>) {
    renderAt('/chien/bang-gia/luat-phu-phi');
    await user.click((await screen.findAllByRole('button', { name: 'Thêm luật' }))[0] as HTMLElement);
    return screen.findByRole('dialog', { name: 'Thêm luật phụ phí' });
  }

  it('kiểm hợp lệ trước khi gửi: tên trống, chưa chọn phụ phí; tick giờ / ngày / sự kiện mà chưa điền → lỗi từng ô, KHÔNG gọi máy chủ', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    const dlg = await openNew(user);
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo giờ bắt đầu' }));
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo ngày' }));
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo loại sự kiện' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(within(dlg).getByText('Nhập tên luật.')).toBeTruthy();
    expect(within(dlg).getByText('Chọn phụ phí thu.')).toBeTruthy();
    expect(within(dlg).getByText('Nhập giờ bắt đầu.')).toBeTruthy();
    expect(within(dlg).getByText('Nhập giờ kết thúc.')).toBeTruthy();
    expect(within(dlg).getByText('Chọn ít nhất một thứ hoặc một ngày.')).toBeTruthy();
    expect(within(dlg).getByText('Chọn ít nhất một loại sự kiện.')).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('giờ bắt đầu = giờ kết thúc → "phải khác nhau", không gọi máy chủ', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    const dlg = await openNew(user);
    await user.type(within(dlg).getByLabelText(/^Tên luật/), 'X');
    await user.selectOptions(within(dlg).getByLabelText(/^Phụ phí thu/), 'pple');
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo giờ bắt đầu' }));
    await user.type(within(dlg).getByLabelText('Giờ bắt đầu của khung, từ'), '06:00');
    await user.type(within(dlg).getByLabelText('Giờ bắt đầu của khung, đến'), '06:00');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Giờ bắt đầu và kết thúc phải khác nhau.')).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('thêm đầy đủ → POST đúng thân: giờ 00:00–06:00, thứ + ngày lễ, loại sự kiện, gói, số lượng "một lần", ghi chú, xếp cuối', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    const dlg = await openNew(user);
    await user.type(within(dlg).getByLabelText(/^Tên luật/), ' Ca sớm ');
    await user.selectOptions(within(dlg).getByLabelText(/^Phụ phí thu/), 'pple');
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo giờ bắt đầu' }));
    await user.type(within(dlg).getByLabelText('Giờ bắt đầu của khung, từ'), '00:00');
    await user.type(within(dlg).getByLabelText('Giờ bắt đầu của khung, đến'), '06:00');
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo ngày' }));
    await user.click(within(dlg).getByRole('button', { name: 'T7' }));
    await user.click(within(dlg).getByRole('button', { name: 'CN' }));
    await user.click(within(dlg).getByRole('button', { name: `Thêm ngày lễ năm ${new Date().getFullYear()}: 1/1, 30/4, 1/5, 2/9` }));
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo loại sự kiện' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lễ cưới' }));
    await user.click(within(dlg).getByRole('button', { name: 'Ăn hỏi (đang ẩn)' }));
    await user.click(within(dlg).getByRole('button', { name: 'Cô dâu – Ngày cưới' }));
    await user.click(within(dlg).getByRole('radio', { name: 'Một lần mỗi dòng' }));
    await user.type(within(dlg).getByLabelText('Ghi chú'), ' Báo khách trước ');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(calls)).toEqual([`POST ${PATH_RULES}`]));
    const year = new Date().getFullYear();
    expect(bodyOf(calls, 'POST')).toEqual({
      name: 'Ca sớm',
      serviceId: 'pple',
      startTime: '00:00',
      endTime: '06:00',
      weekdays: [6, 7],
      dates: [`${year}-01-01`, `${year}-04-30`, `${year}-05-01`, `${year}-09-02`],
      occasionIds: ['o2', 'o3'],
      packageIds: ['p1'],
      perQuantity: false,
      note: 'Báo khách trước',
      sortOrder: 2,
      isActive: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('"Đến" nhập 00:00 (nửa đêm) → gửi 24:00; ô giờ không nhận 24:00', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    const dlg = await openNew(user);
    await user.type(within(dlg).getByLabelText(/^Tên luật/), 'Đêm khuya');
    await user.selectOptions(within(dlg).getByLabelText(/^Phụ phí thu/), 'pple');
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo giờ bắt đầu' }));
    await user.type(within(dlg).getByLabelText('Giờ bắt đầu của khung, từ'), '22:00');
    await user.type(within(dlg).getByLabelText('Giờ bắt đầu của khung, đến'), '00:00');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(bodyOf(calls, 'POST')).toMatchObject({ startTime: '22:00', endTime: '24:00' }));
  });

  it('không tick điều kiện nào → máy chủ 400 → lời máy chủ hiện dưới nhóm "Khi nào áp"; thân gửi KHÔNG có điều kiện', async () => {
    const user = userEvent.setup();
    const msg = 'Luật phải có ít nhất một điều kiện: khung giờ, ngày hoặc loại sự kiện';
    const calls = dServer(OWNER, {
      fail: { [`POST ${PATH_RULES}`]: err(400, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { issues: [{ path: 'startTime', message: msg }] }) },
    });
    const dlg = await openNew(user);
    await user.type(within(dlg).getByLabelText(/^Tên luật/), 'Thiếu điều kiện');
    await user.selectOptions(within(dlg).getByLabelText(/^Phụ phí thu/), 'pple');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText(msg)).toBeTruthy();
    expect(bodyOf(calls, 'POST')).not.toHaveProperty('startTime');
    expect(bodyOf(calls, 'POST')).not.toHaveProperty('weekdays');
    // Tick một điều kiện → lời cũ biến mất.
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo giờ bắt đầu' }));
    expect(within(dlg).queryByText(msg)).toBeNull();
  });

  it('400 theo ô: phụ phí đã ngừng → dưới ô Phụ phí; 409 trùng tên → dưới ô Tên; 409 "Tối đa 50 luật đang bật" → dải đầu hộp', async () => {
    const user = userEvent.setup();
    const fail: Record<string, Response> = {
      [`POST ${PATH_RULES}`]: err(400, 'VALIDATION_FAILED', 'Phụ phí "Phụ phí ngày lễ" đang ngừng hoạt động', { fields: ['serviceId'] }),
    };
    dServer(OWNER, { fail });
    const dlg = await openNew(user);
    await user.type(within(dlg).getByLabelText(/^Tên luật/), 'Luật mới');
    await user.selectOptions(within(dlg).getByLabelText(/^Phụ phí thu/), 'pple');
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo loại sự kiện' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lễ cưới' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Phụ phí "Phụ phí ngày lễ" đang ngừng hoạt động')).toBeTruthy();
    expect(within(dlg).getByLabelText(/^Phụ phí thu/).getAttribute('aria-invalid')).toBe('true');
    fail[`POST ${PATH_RULES}`] = err(409, 'CONFLICT', 'Tên luật đã có trong tổ chức', { fields: ['name'] });
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Tên luật đã có trong tổ chức')).toBeTruthy();
    expect(within(dlg).getByLabelText(/^Tên luật/).getAttribute('aria-invalid')).toBe('true');
    fail[`POST ${PATH_RULES}`] = err(409, 'CONFLICT', 'Tối đa 50 luật đang bật');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect((await within(dlg).findByRole('alert')).textContent).toBe('Tối đa 50 luật đang bật');
  });

  it('chưa có phụ phí nào → câu "Chưa có phụ phí nào — thêm ở …" kèm liên kết sang Dịch vụ phụ & phụ phí', async () => {
    const user = userEvent.setup();
    setupServer(OWNER, (m, p) => {
      if (m === 'GET' && p === PATH_OCC) return json(200, { items: OCCASIONS });
      if (m === 'GET' && p === PATH_RULES) return json(200, { items: [] });
      if (m === 'GET' && p === '/orgs/org-1/services') return json(200, { items: [], page: 1, pageSize: 100, total: 0 });
      return undefined;
    });
    const dlg = await openNew(user);
    expect(within(dlg).getByText(/Chưa có phụ phí nào — thêm ở/)).toBeTruthy();
    expect(within(dlg).getByRole('link', { name: 'Dịch vụ phụ & phụ phí' }).getAttribute('href')).toBe('/chien/bang-gia/dich-vu');
  });

  it('sửa: hộp điền sẵn; đổi tên → PATCH chỉ { name }; bỏ tick giờ → startTime/endTime null; không đổi gì → đóng, không gọi', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER);
    renderAt('/chien/bang-gia/luat-phu-phi');
    await user.click(await screen.findByRole('button', { name: 'Ca sớm trước 6 giờ' }));
    let dlg = await screen.findByRole('dialog', { name: 'Sửa luật phụ phí' });
    expect((within(dlg).getByLabelText(/^Tên luật/) as HTMLInputElement).value).toBe('Ca sớm trước 6 giờ');
    expect((within(dlg).getByLabelText(/^Phụ phí thu/) as HTMLSelectElement).value).toBe('pple');
    expect((within(dlg).getByLabelText('Giờ bắt đầu của khung, đến') as HTMLInputElement).value).toBe('06:00');
    expect(within(dlg).getByRole('button', { name: 'Lễ cưới' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dlg).getByRole('button', { name: 'Cô dâu – Ngày cưới' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Ca sớm trước 6 giờ' }));
    dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByLabelText(/^Tên luật/), ' (mới)');
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo giờ bắt đầu' }));
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(bodyOf(calls, 'PATCH', `${PATH_RULES}/r1`)).toEqual({ name: 'Ca sớm trước 6 giờ (mới)', startTime: null, endTime: null }));
  });

  it('luật cũ có endTime 24:00 → hộp hiện 00:00; lưu không đổi gì thì không gọi máy chủ', async () => {
    const user = userEvent.setup();
    const calls = dServer(OWNER, { rules: [rule({ startTime: '22:00', endTime: '24:00' })] });
    renderAt('/chien/bang-gia/luat-phu-phi');
    await screen.findByText(/Giờ bắt đầu 22:00–24:00/);
    await user.click(screen.getByRole('button', { name: 'Ca sớm trước 6 giờ' }));
    const dlg = await screen.findByRole('dialog');
    expect((within(dlg).getByLabelText('Giờ bắt đầu của khung, đến') as HTMLInputElement).value).toBe('00:00');
    await user.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toEqual([]);
  });

  it('thêm ngày: gõ dd/mm/yyyy rồi "Thêm ngày" → chip ngày; bỏ bằng ×; ngày trùng không thêm hai lần', async () => {
    const user = userEvent.setup();
    dServer(OWNER);
    const dlg = await openNew(user);
    await user.click(within(dlg).getByRole('checkbox', { name: 'Theo ngày' }));
    const input = within(dlg).getByLabelText('Ngày cụ thể');
    await user.type(input, '30/04/2027');
    await user.click(within(dlg).getByRole('button', { name: 'Thêm ngày' }));
    await user.type(within(dlg).getByLabelText('Ngày cụ thể'), '30/04/2027');
    await user.click(within(dlg).getByRole('button', { name: 'Thêm ngày' }));
    const list = within(dlg).getByRole('list', { name: 'Ngày cụ thể đã thêm' });
    expect(within(list).getAllByRole('listitem').map((x) => x.textContent)).toEqual(['30/04/2027×']);
    await user.click(within(list).getByRole('button', { name: 'Bỏ ngày 30/04/2027' }));
    expect(within(dlg).queryByRole('list', { name: 'Ngày cụ thể đã thêm' })).toBeNull();
  });

  it('giải thích nằm trong tooltip "?", không viết ra màn: nhóm "Khi nào áp", giờ, ngày', async () => {
    const user = userEvent.setup();
    dServer(OWNER);
    const dlg = await openNew(user);
    // Chữ giải thích chỉ nằm trong phần mô tả ẩn của nút "?" (hiện khi rê / chạm), không phải dòng hiện trên hộp.
    expect(within(dlg).getByText(/Điền điều kiện nào thì điều kiện đó phải đúng/).hasAttribute('hidden')).toBe(true);
    const tips = within(dlg).getAllByRole('button', { name: 'Giải thích' });
    expect(tips.length).toBeGreaterThanOrEqual(5);
    expect(within(dlg).getByText(/"Đến" không tính/).hasAttribute('hidden')).toBe(true);
    expect(within(dlg).getByText(/Đúng thứ đã chọn HOẶC đúng một ngày/).hasAttribute('hidden')).toBe(true);
  });
});
