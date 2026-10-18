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
    await user.click(sw);
    await waitFor(() => expect(writes(calls)).toEqual(['PATCH /orgs/org-1/makeup-subjects/s1']));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ isActive: false });
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
