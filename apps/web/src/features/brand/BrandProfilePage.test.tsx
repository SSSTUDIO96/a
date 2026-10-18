import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';

// Màn Hồ sơ thương hiệu chạy thật trong khung (phiên, router, quyền) với máy chủ giả lập qua fetch.
// Máy chủ giả lập áp đúng các luật của apps/api/src/modules/profile/schemas.ts mà bài thử cần (https, giờ chồng).
configure({ asyncUtilTimeout: 5000 });

const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Studio Chiến', slug: 'chien', kind: 'TEAM', roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };
const T = '2026-10-12T03:00:00.000Z';
const LOGO_ID = '11111111-1111-4111-8111-111111111111';

const PROFILE = {
  brandName: 'Studio Chiến Makeup',
  tagline: 'Trang điểm cô dâu tự nhiên',
  bio: 'Chuyên trang điểm cô dâu tại Hà Nội.',
  experience: null,
  styles: ['Tự nhiên', 'Hàn Quốc'],
  serviceArea: null,
  address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội',
  phone: '0903112233',
  email: 'studiochien@gmail.com',
  zalo: null,
  facebook: 'https://facebook.com/studiochien',
  instagram: null,
  tiktok: null,
  website: null,
  logoFileId: LOGO_ID,
  avatarFileId: null,
  coverFileId: null,
  workingHours: [
    { weekday: 1, open: '08:00', close: '12:00' },
    { weekday: 1, open: '13:30', close: '20:00' },
    { weekday: 2, open: '08:00', close: '20:00' },
  ],
  bookingPolicy: 'Đặt trước 7 ngày.',
  cancellationPolicy: null,
  depositPolicy: null,
  isPublished: true,
  publishedAt: T,
  updatedAt: T,
  logo: { url: 'data:image/png;base64,iVBORw0KGgo=', expiresAt: '2099-01-01T00:00:00.000Z' },
  avatar: null,
  cover: null,
};

const price = (listPrice: number, salePrice: number | null = null) => ({ priceVersionId: `v-${listPrice}`, listPrice, salePrice, unitPrice: salePrice ?? listPrice, effectiveFrom: T });
const PKG = {
  id: 'p1',
  code: 'G-CD01',
  name: 'Cô dâu – Ngày cưới',
  description: null,
  durationMinutes: 150,
  staffCount: 1,
  depositAmount: 1_234_000,
  subjectId: 's1',
  locationTypes: ['STUDIO', 'CUSTOMER_HOME'],
  includedKm: null,
  terms: null,
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  createdAt: T,
  updatedAt: T,
  subject: { id: 's1', name: 'Cô dâu', isActive: true },
  items: [{ serviceId: 'mcd', quantity: 1, isOptional: false, service: { id: 'mcd', code: 'MCD', name: 'Makeup cô dâu', kind: 'MAIN', isActive: true }, currentPrice: price(1_500_000) }],
  currentPrice: price(3_000_000, 2_700_000),
};
const PKG2 = { ...PKG, id: 'p2', code: 'G-PD01', name: 'Phù dâu', isPublic: false, subjectId: null, subject: null, items: [], currentPrice: price(400_000) };

interface Call {
  method: string;
  path: string;
  body: unknown;
  auth: string | undefined;
}
type Override = (method: string, path: string, body: unknown) => Response | undefined;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const fail = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

// Luật máy chủ cần cho bài thử (profile/schemas.ts): liên kết chỉ https, mỗi thứ ≤ 2 ca, ca không chồng.
function serverValidate(body: Record<string, unknown>): Response | undefined {
  const issues: { path: string; message: string }[] = [];
  for (const k of ['facebook', 'instagram', 'tiktok', 'website']) {
    const v = body[k];
    if (typeof v === 'string' && !v.startsWith('https://')) issues.push({ path: k, message: 'Liên kết phải là địa chỉ https:// đầy đủ' });
  }
  const hours = (body.workingHours ?? []) as { weekday: number; open: string; close: string }[];
  hours.forEach((s, i) => {
    if (s.close <= s.open) issues.push({ path: `workingHours.${i}.close`, message: `Thứ ${s.weekday}: giờ đóng (${s.close}) phải sau giờ mở (${s.open})` });
  });
  for (let d = 1; d <= 7; d++) {
    const day = hours.filter((s) => s.weekday === d).sort((a, b) => a.open.localeCompare(b.open));
    for (let i = 1; i < day.length; i++) {
      const a = day[i - 1]!;
      const b = day[i]!;
      if (b.open < a.close) issues.push({ path: 'workingHours', message: `Thứ ${d}: ca ${a.open}–${a.close} và ca ${b.open}–${b.close} chồng nhau` });
    }
  }
  if (issues.length) return fail(400, 'VALIDATION_FAILED', 'Dữ liệu gửi lên không hợp lệ', { issues });
  return undefined;
}

function setupServer(permissions: readonly string[], opts: { profile?: Record<string, unknown> | null; override?: Override } = {}) {
  const calls: Call[] = [];
  let profile: Record<string, unknown> | null = opts.profile === undefined ? { ...PROFILE } : opts.profile;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (!path.startsWith('/auth')) calls.push({ method, path: path + url.search, body, auth });
      const o = opts.override?.(method, path, body);
      if (o) return o;
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Trọng Chiến', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', createdAt: T, updatedAt: T, myRoles: ['owner'], myPermissions: [...permissions] });
      if (path === '/orgs/org-1/profile' && method === 'GET') return json(200, profile ? { hasProfile: true, profile } : { hasProfile: false, profile: null });
      if (path === '/orgs/org-1/profile' && method === 'PUT') {
        const bad = serverValidate(body);
        if (bad) return bad;
        profile = { ...(profile ?? { isPublished: false, publishedAt: null }), ...body, updatedAt: T, logo: body.logoFileId ? PROFILE.logo : null, avatar: null, cover: null };
        return json(200, { hasProfile: true, profile });
      }
      if (path === '/orgs/org-1/profile/publish') {
        if (!profile) return fail(400, 'VALIDATION_FAILED', 'Chưa có hồ sơ thương hiệu; lưu hồ sơ có tên thương hiệu trước khi xuất bản');
        profile = { ...profile, isPublished: true, publishedAt: '2026-10-18T02:00:00.000Z' };
        return json(200, { hasProfile: true, profile });
      }
      if (path === '/orgs/org-1/profile/unpublish') {
        profile = { ...profile!, isPublished: false, publishedAt: null };
        return json(200, { hasProfile: true, profile });
      }
      if (path === '/orgs/org-1/packages' && method === 'GET') return json(200, { items: [PKG, PKG2], page: 1, pageSize: 100, total: 2 });
      if (path === '/orgs/org-1/packages/p2' && method === 'PATCH') return json(200, { ...PKG2, ...(body as object) });
      if (path === '/orgs/org-1/makeup-subjects') return json(200, { items: [{ id: 's1', organizationId: 'org-1', name: 'Cô dâu', sortOrder: 0, isActive: true, createdAt: T, updatedAt: T }] });
      if (path === '/orgs/org-1/travel-fee-policy') return fail(404, 'NOT_FOUND', 'Tổ chức chưa có cấu hình phí di chuyển');
      return fail(404, 'NOT_FOUND', `Không có đường ${method} ${path}`);
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
const PAGE = '/chien/cai-dat/thuong-hieu';
const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
const form = () => screen.getByRole('region', { name: 'Sửa hồ sơ thương hiệu' });
const preview = () => screen.getByRole('complementary', { name: 'Xem trước trang giới thiệu' });

// Lời lỗi gắn với ô qua aria-describedby.
function errorOf(el: HTMLElement): string | null {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  for (const id of ids) {
    const n = document.getElementById(id);
    if (n && n.className.includes('error')) return n.textContent;
  }
  return null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Hồ sơ thương hiệu — tải, xem trước', () => {
  it('form + xem trước dùng chung SiteView; gõ tới đâu xem trước đổi tới đó; không lộ mã gói, tiền cọc', async () => {
    setupServer(OWNER);
    renderAt(PAGE);
    const name = await screen.findByLabelText(/Tên thương hiệu/);
    expect(name).toHaveProperty('value', 'Studio Chiến Makeup');
    expect(within(preview()).getByRole('heading', { name: 'Studio Chiến Makeup' })).toBeTruthy();
    await userEvent.clear(name);
    await userEvent.type(name, 'Hoa Makeup');
    expect(within(preview()).getByRole('heading', { name: 'Hoa Makeup' })).toBeTruthy();
    // Bảng giá trong xem trước: chỉ gói bật hiện; không mã, không cọc.
    await within(preview()).findByText('Cô dâu – Ngày cưới');
    expect(within(preview()).queryByText('Phù dâu')).toBeNull();
    expect(preview().textContent).not.toContain('G-CD01');
    expect(preview().textContent).not.toMatch(/1\.234\.000/);
    expect(within(preview()).getByText('2.700.000 ₫')).toBeTruthy();
    expect(within(preview()).getByText('Gọi 0903 112 233')).toBeTruthy();
    // Thanh xuất bản: không có cấu hình tên miền trong bài thử → đường dẫn tương đối, không đoán.
    expect(screen.getByText('/trang/', { exact: false }).textContent).toBe('/trang/chien');
    expect(screen.getByText(/Đang công khai từ 12\/10\/2026/)).toBeTruthy();
    // Có thay đổi → thanh lưu; Bỏ thay đổi → về như cũ.
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(screen.queryByText('Có thay đổi chưa lưu')).toBeNull();
    expect(screen.getByLabelText(/Tên thương hiệu/)).toHaveProperty('value', 'Studio Chiến Makeup');
  });

  it('Lưu hồ sơ: PUT gửi đủ 21 trường, không gửi isPublished/publishedAt', async () => {
    const calls = setupServer(OWNER);
    renderAt(PAGE);
    const tagline = await screen.findByLabelText(/Câu giới thiệu ngắn/);
    await userEvent.type(tagline, ', bền đẹp');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(writes(calls)).toEqual(['PUT /orgs/org-1/profile']));
    const body = calls.find((c) => c.method === 'PUT')!.body as Record<string, unknown>;
    expect(Object.keys(body)).toHaveLength(21);
    expect(body).not.toHaveProperty('isPublished');
    expect(body.tagline).toBe('Trang điểm cô dâu tự nhiên, bền đẹp');
    expect(body.logoFileId).toBe(LOGO_ID);
    expect(body.workingHours).toEqual(PROFILE.workingHours);
    await waitFor(() => expect(screen.queryByText('Có thay đổi chưa lưu')).toBeNull());
  });
});

describe('Lỗi 400 dưới đúng ô', () => {
  it('liên kết http bị máy chủ từ chối → lời lỗi dưới ô Facebook, giữ bản nháp; sửa ô thì lỗi tắt', async () => {
    const calls = setupServer(OWNER);
    renderAt(PAGE);
    const fb = await screen.findByLabelText('Facebook');
    await userEvent.clear(fb);
    await userEvent.type(fb, 'http://facebook.com/studiochien');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(errorOf(screen.getByLabelText('Facebook'))).toBe('Liên kết phải là địa chỉ https:// đầy đủ'));
    expect(screen.getByLabelText('Facebook')).toHaveProperty('value', 'http://facebook.com/studiochien');
    expect(screen.getByLabelText('Facebook').getAttribute('aria-invalid')).toBe('true');
    // Ô khác không bị đánh lỗi.
    expect(errorOf(screen.getByLabelText('TikTok'))).toBeNull();
    expect(writes(calls)).toEqual(['PUT /orgs/org-1/profile']);
    expect(screen.getByText('Có thay đổi chưa lưu')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Facebook'), '2');
    expect(errorOf(screen.getByLabelText('Facebook'))).toBeNull();
  });

  it('giờ làm việc chồng nhau → lời lỗi dưới hàng Thứ Hai (không phải "Thứ 1")', async () => {
    setupServer(OWNER);
    renderAt(PAGE);
    const open2 = await screen.findByLabelText('Thứ Hai ca 2 giờ mở');
    await userEvent.clear(open2);
    await userEvent.type(open2, '11:00');
    fireEvent.blur(open2);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    const row = form().querySelector<HTMLElement>('[data-field="hours.1"]')!;
    await waitFor(() => expect(within(row).getByRole('alert').textContent).toBe('Ca 08:00–12:00 và ca 11:00–20:00 chồng nhau'));
    expect(form().querySelector('[data-field="hours.2"] [role="alert"]')).toBeNull();
  });

  it('giờ đóng trước giờ mở (đường dẫn [i, "close"]) → dưới đúng hàng thứ của ca đó', async () => {
    setupServer(OWNER);
    renderAt(PAGE);
    const close = await screen.findByLabelText('Thứ Ba ca 1 giờ đóng');
    await userEvent.clear(close);
    await userEvent.type(close, '07:00');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    const row = form().querySelector<HTMLElement>('[data-field="hours.2"]')!;
    await waitFor(() => expect(within(row).getByRole('alert').textContent).toBe('Giờ đóng (07:00) phải sau giờ mở (08:00)'));
  });

  it('bật một thứ mà chưa nhập giờ → chặn trước khi gửi, lỗi dưới hàng', async () => {
    const calls = setupServer(OWNER);
    renderAt(PAGE);
    await userEvent.click(await screen.findByRole('switch', { name: 'Thứ Tư mở cửa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    const row = form().querySelector<HTMLElement>('[data-field="hours.3"]')!;
    expect(within(row).getByRole('alert').textContent).toBe('Nhập đủ giờ mở và giờ đóng của ca');
    expect(writes(calls)).toEqual([]);
  });

  it('tải ảnh: máy chủ trả 400 → lỗi dưới ô Logo, giữ ảnh cũ; ảnh logo > 2 MB chặn ngay', async () => {
    const calls = setupServer(OWNER, {
      override: (m, p) => (m === 'POST' && p === '/orgs/org-1/files' ? fail(400, 'VALIDATION_FAILED', 'Tệp không phải ảnh JPEG/PNG/WebP') : undefined),
    });
    renderAt(PAGE);
    const logo = await screen.findByRole('group', { name: 'Logo' });
    const input = logo.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, new File(['x'], 'logo.png', { type: 'image/png' }));
    expect(await within(logo).findByText('Tệp không phải ảnh JPEG/PNG/WebP')).toBeTruthy();
    expect(within(logo).getByRole('img', { name: 'Logo' }).getAttribute('src')).toBe(PROFILE.logo.url);
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'to.png', { type: 'image/png' });
    await userEvent.upload(input, big);
    expect(await within(logo).findByText(/vượt quá 2 MB/)).toBeTruthy();
    expect(calls.filter((c) => c.method === 'POST' && c.path.startsWith('/orgs/org-1/files'))).toHaveLength(1);
    expect(calls.find((c) => c.path.startsWith('/orgs/org-1/files'))!.path).toContain('purpose=ORG_LOGO');
  });
});

describe('Quyền', () => {
  it('thiếu org.update → dải 403, không có form, không gọi /profile', async () => {
    const calls = setupServer(SYSTEM_ROLES.artist.permissions);
    renderAt(PAGE);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Sửa hồ sơ thương hiệu' })).toBeNull();
    expect(calls.some((c) => c.path.includes('/profile'))).toBe(false);
  });

  it('có org.update nhưng thiếu files.write và catalog.write → ô ảnh chỉ xem, công tắc gói khoá', async () => {
    const perms = ['org.read', 'org.update', 'catalog.read'];
    setupServer(perms);
    renderAt(PAGE);
    await screen.findByLabelText(/Tên thương hiệu/);
    expect(within(screen.getByRole('group', { name: 'Logo' })).getByRole('button', { name: /Đổi — Logo/ })).toHaveProperty('disabled', true);
    const sw = await screen.findByRole('switch', { name: 'Hiện gói Phù dâu trên trang' });
    expect(sw).toHaveProperty('disabled', true);
  });

  it('thiếu catalog.read → không có nhóm "Gói hiện trên trang", không gọi /packages', async () => {
    const calls = setupServer(['org.read', 'org.update', 'files.write']);
    renderAt(PAGE);
    await screen.findByLabelText(/Tên thương hiệu/);
    expect(screen.queryByText('Gói hiện trên trang')).toBeNull();
    expect(calls.some((c) => c.path.startsWith('/orgs/org-1/packages'))).toBe(false);
  });

  it('bật "hiện trên trang" của một gói → PATCH /packages/:id {isPublic} lưu ngay, không cần Lưu hồ sơ', async () => {
    const calls = setupServer(OWNER);
    renderAt(PAGE);
    const sw = await screen.findByRole('switch', { name: 'Hiện gói Phù dâu trên trang' });
    await userEvent.click(sw);
    await waitFor(() => expect(writes(calls)).toEqual(['PATCH /orgs/org-1/packages/p2']));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ isPublic: true });
    await within(preview()).findByText('Phù dâu');
    expect(screen.queryByText('Có thay đổi chưa lưu')).toBeNull();
  });
});

describe('Xuất bản / gỡ', () => {
  it('chưa xuất bản → Xuất bản → POST publish → "Đang công khai từ"; Gỡ trang → hộp xác nhận → POST unpublish', async () => {
    const calls = setupServer(OWNER, { profile: { ...PROFILE, isPublished: false, publishedAt: null } });
    renderAt(PAGE);
    expect(await screen.findByText('Chưa xuất bản')).toBeTruthy();
    // Đang sửa dở: xuất bản không được đè bản nháp.
    await userEvent.type(screen.getByLabelText(/Câu giới thiệu ngắn/), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    expect(await screen.findByText('Đang công khai từ 18/10/2026')).toBeTruthy();
    expect(screen.getByLabelText(/Câu giới thiệu ngắn/)).toHaveProperty('value', 'Trang điểm cô dâu tự nhiên!');
    expect(screen.getByRole('link', { name: /Mở trang/ }).getAttribute('href')).toBe('/trang/chien');
    await userEvent.click(screen.getByRole('button', { name: 'Gỡ trang' }));
    const dlg = await screen.findByRole('dialog', { name: 'Gỡ trang giới thiệu?' });
    expect(dlg.textContent).toContain('Không tìm thấy trang giới thiệu');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Gỡ trang' }));
    expect(await screen.findByText('Chưa xuất bản')).toBeTruthy();
    expect(writes(calls)).toEqual(['POST /orgs/org-1/profile/publish', 'POST /orgs/org-1/profile/unpublish']);
  });

  it('Lưu và xuất bản: PUT rồi POST publish', async () => {
    const calls = setupServer(OWNER, { profile: { ...PROFILE, isPublished: false, publishedAt: null } });
    renderAt(PAGE);
    await userEvent.type(await screen.findByLabelText(/Câu giới thiệu ngắn/), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu và xuất bản' }));
    await waitFor(() => expect(writes(calls)).toEqual(['PUT /orgs/org-1/profile', 'POST /orgs/org-1/profile/publish']));
    expect(await screen.findByText(/Đang công khai từ/)).toBeTruthy();
  });

  it('chưa có hồ sơ → Xuất bản khoá (tooltip "Lưu tên thương hiệu trước"); "Lưu và tiếp tục" tạo hồ sơ rồi hiện form đầy đủ', async () => {
    const calls = setupServer(OWNER, { profile: null });
    renderAt(PAGE);
    expect(await screen.findByText('Chưa có hồ sơ thương hiệu. Bắt đầu bằng tên thương hiệu.')).toBeTruthy();
    const pub = screen.getByRole('button', { name: 'Xuất bản' });
    expect(pub).toHaveProperty('disabled', true);
    expect(screen.getByText('Lưu tên thương hiệu trước')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
    expect(screen.getByText('Tên thương hiệu không được để trống')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Tên thương hiệu'), 'Hoa Makeup');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
    expect(await screen.findByRole('region', { name: 'Sửa hồ sơ thương hiệu' })).toBeTruthy();
    const put = calls.find((c) => c.method === 'PUT')!.body as Record<string, unknown>;
    expect(put.brandName).toBe('Hoa Makeup');
    expect(Object.keys(put)).toHaveLength(21);
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toHaveProperty('disabled', false);
  });

  it('xuất bản bị máy chủ từ chối (400) → dải lỗi đúng lời máy chủ', async () => {
    setupServer(OWNER, {
      profile: { ...PROFILE, isPublished: false, publishedAt: null },
      override: (m, p) => (p === '/orgs/org-1/profile/publish' ? fail(400, 'VALIDATION_FAILED', 'Chưa có hồ sơ thương hiệu; lưu hồ sơ có tên thương hiệu trước khi xuất bản') : undefined),
    });
    renderAt(PAGE);
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất bản' }));
    expect(await screen.findByText('Chưa có hồ sơ thương hiệu; lưu hồ sơ có tên thương hiệu trước khi xuất bản')).toBeTruthy();
    expect(screen.getByText('Chưa xuất bản')).toBeTruthy();
  });
});
