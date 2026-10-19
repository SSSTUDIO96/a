import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';

// Màn Đào tạo — Khoá & lớp chạy thật trong khung (phiên, router, quyền) với máy chủ giả lập qua fetch (C3 mục 2.1, 2.2).
configure({ asyncUtilTimeout: 5000 });

const T = '2026-10-18T03:00:00.000Z';
const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Makeup Pro Academy', slug: 'hv', kind: 'ACADEMY', roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };

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

const GROUPS = [
  { id: 'g1', name: 'Makeup cá nhân', sortOrder: 0, isActive: true, courseCount: 1, createdAt: T, updatedAt: T },
  { id: 'g3', name: 'Nâng cao', sortOrder: 2, isActive: true, courseCount: 2, createdAt: T, updatedAt: T },
];

const cls = (id: string, courseId: string, name: string, enrolledCount: number, capacity: number, extra: object = {}) => ({
  id,
  courseId,
  name,
  startDate: '2026-10-25',
  endDate: '2026-11-22',
  weekdays: [6, 7],
  startTime: '08:30',
  endTime: '12:30',
  capacity,
  enrolledCount,
  seatsLeft: Math.max(0, capacity - enrolledCount),
  seatState: enrolledCount >= capacity ? 'FULL' : enrolledCount / capacity >= 0.75 ? 'ALMOST_FULL' : 'AVAILABLE',
  status: 'OPEN',
  note: null,
  instructor: { membershipId: 'm-2', name: 'Nguyễn Thu Hà' },
  location: { id: 'l1', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt' },
  calendar: { total: 0, upcoming: 0 },
  ...extra,
});

const course = (id: string, name: string, mode: 'SINGLE_CLASS' | 'MULTI_CLASS', extra: object = {}) => ({
  id,
  code: id === 'nc' ? 'NC-03' : 'NC-01',
  name,
  mode,
  groupId: 'g3',
  tuitionFee: mode === 'MULTI_CLASS' ? 9_500_000 : 6_500_000,
  depositAmount: mode === 'MULTI_CLASS' ? 3_000_000 : 2_000_000,
  defaultCapacity: 8,
  sessionCount: mode === 'MULTI_CLASS' ? 8 : null,
  sessionMinutes: mode === 'MULTI_CLASS' ? 240 : null,
  description: null,
  sortOrder: 0,
  archivedAt: null,
  createdAt: T,
  updatedAt: T,
  ...extra,
});

const NC = course('nc', 'Makeup nâng cao', 'MULTI_CLASS');
const NC_CLASSES = [cls('k1', 'nc', 'Nâng cao K1', 8, 8), cls('k2', 'nc', 'Nâng cao K2', 7, 8), cls('k3', 'nc', 'Nâng cao K3', 1, 10)];
const HQ = course('hq', 'Makeup Hàn Quốc', 'SINGLE_CLASS');
const HQ_CLASSES = [cls('h1', 'hq', 'Makeup Hàn Quốc', 5, 8, { startDate: '2026-11-15', endDate: '2026-12-02', weekdays: [1, 3] })];
const TIEC = course('tiec', 'Makeup cá nhân đi tiệc', 'SINGLE_CLASS', { groupId: 'g1', tuitionFee: 2_500_000 });
const TIEC_CLASSES = [cls('t1', 'tiec', 'Makeup cá nhân đi tiệc', 7, 10, { startDate: '2026-10-31', endDate: '2026-11-21' })];

const LIST = [
  { ...TIEC, classSummary: { total: 1, open: 1, withSeats: 1, nextStartDate: '2026-10-31' }, singleClass: TIEC_CLASSES[0] },
  { ...HQ, classSummary: { total: 1, open: 1, withSeats: 1, nextStartDate: '2026-11-15' }, singleClass: HQ_CLASSES[0] },
  { ...NC, classSummary: { total: 3, open: 3, withSeats: 2, nextStartDate: '2026-10-25' }, singleClass: null },
];
const DETAIL: Record<string, { course: object; classes: object[] }> = {
  nc: { course: NC, classes: NC_CLASSES },
  hq: { course: HQ, classes: HQ_CLASSES },
  tiec: { course: TIEC, classes: TIEC_CLASSES },
};

const STAFF = [
  { membershipId: 'm-2', userId: 'u2', fullName: 'Nguyễn Thu Hà', displayName: 'Nguyễn Thu Hà', initials: 'TH', avatarUrl: null, phone: null, tier: null, isBookable: true, hasProfile: true, status: 'ACTIVE', roleKeys: ['instructor'] },
];
const LOCS = [{ id: 'l1', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt', latitude: null, longitude: null, isDefault: true, isActive: true, createdAt: T, updatedAt: T }];

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
      if (path === '/orgs/org-1/course-groups') return json(200, { items: GROUPS });
      if (path === '/orgs/org-1/courses' && method === 'GET') return json(200, { items: LIST });
      if (path === '/orgs/org-1/staff') return json(200, { items: STAFF });
      if (path === '/orgs/org-1/studio-locations') return json(200, { items: LOCS });
      const one = /^\/orgs\/org-1\/courses\/(\w+)$/.exec(path);
      if (one && method === 'GET') return DETAIL[one[1]!] ? json(200, DETAIL[one[1]!]) : err(404, 'NOT_FOUND', 'Không tìm thấy khoá học');
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
const INSTRUCTOR = SYSTEM_ROLES.instructor.permissions;
const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');

async function openAdd() {
  // Nút trên đầu trang (máy tính); thanh trên điện thoại có nút biểu tượng cùng tên.
  fireEvent.click((await screen.findAllByRole('button', { name: 'Thêm khoá' }))[0]!);
  return screen.findByRole('dialog', { name: 'Thêm khoá' });
}

async function fillRequired(d: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  await user.type(within(d).getByLabelText(/^Tên khoá/), 'Makeup cá nhân đi tiệc');
  await user.type(within(d).getByLabelText(/^Học phí/), '2500000');
  await user.type(within(d).getByLabelText('Ngày bắt đầu'), '31/10/2026');
  await user.type(within(d).getByLabelText('Ngày kết thúc'), '21/11/2026');
  await user.click(within(d).getByRole('button', { name: 'Thứ Sáu' }));
  await user.type(within(d).getByLabelText(/^Số học viên tối đa/), '10');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Khoá & lớp — danh sách và chi tiết (C3 mục 2.1)', () => {
  it('danh sách theo nhóm: khoá Một lớp xen Nhiều lớp, dòng phụ "31/10–21/11 · 7/10 học viên" và "3 lớp · 2 còn chỗ", chip nhóm có số đếm', async () => {
    setupServer(OWNER);
    renderAt('/hv/dao-tao');
    const nav = await screen.findByRole('navigation', { name: 'Danh sách khoá học' });
    const rows = within(nav).getAllByRole('link');
    expect(rows.map((r) => r.textContent)).toEqual([
      'Makeup cá nhân đi tiệcMột lớp31/10–21/11 · 7/10 học viên2.500.000 ₫',
      'Makeup Hàn QuốcMột lớp15/11–02/12 · 5/8 học viên6.500.000 ₫',
      'Makeup nâng caoNhiều lớp3 lớp · 2 còn chỗ9.500.000 ₫',
    ]);
    expect(within(nav).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Makeup cá nhân', 'Nâng cao']);
    const chips = within(screen.getByRole('group', { name: 'Lọc theo nhóm khoá' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Tất cả3', 'Makeup cá nhân1', 'Nâng cao2']);
    fireEvent.click(chips[2]!);
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    // Máy tính: khoá đầu danh sách được mở ở cột phải.
    expect(await screen.findByRole('heading', { name: 'Makeup cá nhân đi tiệc', level: 2 })).toBeTruthy();
  });

  it('seatState 3 mức: Hết chỗ / Sắp đầy · còn 1 / còn 9 chỗ; lớp hết chỗ: nút "Hết chỗ" tắt; lớp còn chỗ: "Ghi danh" mở Lập hợp đồng khoá học chọn sẵn lớp', async () => {
    setupServer(OWNER);
    renderAt('/hv/dao-tao/nc');
    const k1 = await screen.findByRole('article', { name: 'Lớp Nâng cao K1' });
    const k2 = screen.getByRole('article', { name: 'Lớp Nâng cao K2' });
    const k3 = screen.getByRole('article', { name: 'Lớp Nâng cao K3' });
    expect(within(k1).getByText('Hết chỗ', { selector: '.ui-tag' })).toBeTruthy();
    expect(within(k2).getByText('Sắp đầy · còn 1')).toBeTruthy();
    expect(within(k3).getByText('còn 9 chỗ')).toBeTruthy();
    expect(k1.className).toContain('kc-class--full');
    expect(within(k1).getByText('đã ghi danh / tối đa', { exact: false }).textContent).toBe('8 đã ghi danh / tối đa 8');
    expect(k1.querySelector('.kc-bar--full')).toBeTruthy();
    expect(k2.querySelector('.kc-bar--almost-full')).toBeTruthy();
    expect(k3.querySelector('.kc-bar--available')).toBeTruthy();
    const full = within(k1).getByRole('button', { name: 'Hết chỗ' });
    expect(full.getAttribute('aria-disabled')).toBe('true');
    expect(within(k1).queryByRole('link', { name: 'Ghi danh' })).toBeNull();
    expect(document.getElementById(full.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Lớp đã đủ số học viên tối đa');
    // Bấm nút tắt không chuyển trang.
    fireEvent.click(full);
    expect(window.location.pathname).not.toContain('hop-dong');
    // Lớp còn chỗ: "Ghi danh" là liên kết sang hợp đồng khoá học mới, chọn sẵn đúng lớp.
    const enroll = within(k2).getByRole('link', { name: 'Ghi danh' });
    expect(enroll.getAttribute('href')).toBe('/hv/hop-dong/moi?kind=COURSE&classId=k2');
    expect(within(k3).getByRole('link', { name: 'Ghi danh' }).getAttribute('href')).toBe('/hv/hop-dong/moi?kind=COURSE&classId=k3');
    // 4 ô số của khoá Nhiều lớp.
    const head = screen.getByRole('region', { name: 'Khoá Makeup nâng cao' });
    expect([...head.querySelectorAll('.ui-stat__label')].map((e) => e.textContent)).toEqual(['Học phí', 'Cọc mặc định', 'Số buổi', expect.stringContaining('Tối đa mặc định')]);
    expect([...head.querySelectorAll('.ui-stat__value')].map((e) => e.textContent)).toEqual(['9.500.000 ₫', '3.000.000 ₫', '8 buổi × 4 giờ', '8 học viên']);
  });

  it('khoá Một lớp: 4 ô Học phí · Cọc · Thời gian · Số học viên tối đa, một thẻ lớp mang tên khoá, nút "Chuyển sang nhiều lớp"', async () => {
    setupServer(OWNER);
    renderAt('/hv/dao-tao/hq');
    const head = await screen.findByRole('region', { name: 'Khoá Makeup Hàn Quốc' });
    expect([...head.querySelectorAll('.ui-stat__value')].map((e) => e.textContent)).toEqual(['6.500.000 ₫', '2.000.000 ₫', '15/11 → 02/12', '8']);
    expect(screen.getByRole('article', { name: 'Lớp Makeup Hàn Quốc' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chuyển sang nhiều lớp' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mở lớp' })).toBeNull();
  });

  it('quyền: chỉ courses.read (giảng viên) → không có Thêm khoá, Cài đặt nhóm, Sửa, Mở lớp, Ghi danh; vẫn xem được học viên', async () => {
    setupServer(INSTRUCTOR);
    renderAt('/hv/dao-tao/nc');
    await screen.findByRole('article', { name: 'Lớp Nâng cao K1' });
    expect(INSTRUCTOR).toContain('courses.read');
    expect(INSTRUCTOR).not.toContain('courses.write');
    for (const name of ['Thêm khoá', 'Cài đặt nhóm', 'Sửa', 'Mở lớp', 'Ghi danh', 'Hết chỗ']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ghi danh' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Học viên' })).toHaveLength(3);
  });

  it('quyền: courses.write mà không có contracts.write → có Sửa / Mở lớp, không có nút Ghi danh', async () => {
    setupServer(OWNER.filter((p) => p !== 'contracts.write'));
    renderAt('/hv/dao-tao/nc');
    await screen.findByRole('article', { name: 'Lớp Nâng cao K1' });
    expect(screen.getByRole('button', { name: 'Mở lớp' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ghi danh' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ghi danh' })).toBeNull();
  });

  it('máy chủ trả 403 "Tổ chức chưa bật đào tạo" → dải lỗi đúng lời máy chủ, không có nút Thử lại', async () => {
    setupServer(OWNER, (m, p) => (p.startsWith('/orgs/org-1/courses') || p.startsWith('/orgs/org-1/course-groups') ? err(403, 'FORBIDDEN', 'Tổ chức chưa bật đào tạo', { reason: 'ACADEMY_REQUIRED' }) : undefined));
    renderAt('/hv/dao-tao');
    const alert = await screen.findByText('Tổ chức chưa bật đào tạo');
    expect(alert.closest('[role="alert"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });
});

describe('Thêm khoá (C3 mục 2.2): 4 ô bắt buộc + Một lớp / Nhiều lớp', () => {
  it('bấm Lưu khi trống: báo lỗi đúng 4 ô bắt buộc (tên, thời gian, học phí, số học viên tối đa) + lịch học; không gửi máy chủ', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/dao-tao');
    const d = await openAdd();
    expect(within(d).getByRole('radio', { name: 'Một lớp' }).getAttribute('aria-checked')).toBe('true');
    const req = [...d.querySelectorAll('.ui-row__label')].filter((l) => l.querySelector('.ui-req')).map((l) => (l.querySelector('label, span')?.textContent ?? '').replace('*', ''));
    expect(req).toEqual(['Tên khoá', 'Học phí', 'Thời gian', 'Lịch học', 'Số học viên tối đa']);
    fireEvent.click(within(d).getByRole('button', { name: 'Lưu' }));
    const errors = within(d).getAllByRole('alert').map((e) => e.textContent);
    expect(errors).toEqual(['Nhập tên khoá', 'Nhập học phí', 'Nhập ngày bắt đầu và ngày kết thúc', 'Chọn ít nhất một ngày trong tuần', 'Nhập số học viên tối đa']);
    expect(writes(calls)).toEqual([]);
  });

  it('kiểm ở web: ngày kết thúc trước ngày bắt đầu, giờ kết thúc trước giờ bắt đầu, cọc lớn hơn học phí', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER);
    renderAt('/hv/dao-tao');
    const d = await openAdd();
    await fillRequired(d, user);
    await user.clear(within(d).getByLabelText('Ngày kết thúc'));
    await user.type(within(d).getByLabelText('Ngày kết thúc'), '01/10/2026');
    await user.type(within(d).getByLabelText('Giờ bắt đầu'), '21:30');
    await user.type(within(d).getByLabelText('Giờ kết thúc'), '18:30');
    await user.type(within(d).getByLabelText('Cọc mặc định'), '3000000');
    await user.click(within(d).getByRole('button', { name: 'Lưu' }));
    const errors = within(d).getAllByRole('alert').map((e) => e.textContent);
    expect(errors).toEqual(['Cọc mặc định không được lớn hơn học phí', 'Ngày kết thúc phải từ ngày bắt đầu trở đi', 'Giờ kết thúc phải sau giờ bắt đầu']);
    expect(writes(calls)).toEqual([]);
  });

  it('Một lớp: POST /courses mode SINGLE_CLASS, firstClass KHÔNG có name, số tối đa = số tối đa của lớp; có Idempotency-Key; mở khoá vừa tạo', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p, body) =>
      m === 'POST' && p === '/orgs/org-1/courses'
        ? json(201, { course: { ...TIEC, id: 'moi', name: (body as { name: string }).name }, classes: [] })
        : p === '/orgs/org-1/courses/moi'
          ? json(200, { course: { ...TIEC, id: 'moi' }, classes: TIEC_CLASSES })
          : undefined,
    );
    const router = renderAt('/hv/dao-tao');
    const d = await openAdd();
    await fillRequired(d, user);
    await user.type(within(d).getByLabelText('Giờ bắt đầu'), '18:30');
    await user.type(within(d).getByLabelText('Giờ kết thúc'), '21:30');
    await user.selectOptions(within(d).getByLabelText('Nhóm khoá'), 'g1');
    await waitFor(() => expect(within(d).getByRole('combobox', { name: 'Giảng viên' })).toHaveProperty('disabled', false));
    await user.selectOptions(within(d).getByRole('combobox', { name: 'Giảng viên' }), 'm-2');
    await user.selectOptions(within(d).getByRole('combobox', { name: 'Ở đâu' }), 'l1');
    await user.click(within(d).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/hv/dao-tao/moi'));
    const post = writes(calls)[0];
    expect(post?.path).toBe('/orgs/org-1/courses');
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
    expect(post?.body).toEqual({
      name: 'Makeup cá nhân đi tiệc',
      mode: 'SINGLE_CLASS',
      tuitionFee: 2_500_000,
      defaultCapacity: 10,
      groupId: 'g1',
      firstClass: {
        startDate: '2026-10-31',
        endDate: '2026-11-21',
        weekdays: [5],
        startTime: '18:30',
        endTime: '21:30',
        capacity: 10,
        instructorMembershipId: 'm-2',
        studioLocationId: 'l1',
      },
    });
  });

  it('Nhiều lớp: hiện "Lớp đầu tiên" — tên lớp gợi ý "<tên khoá> K1", số tối đa của lớp lấy từ khoá; POST có firstClass.name và số tối đa riêng', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p) =>
      m === 'POST' && p === '/orgs/org-1/courses' ? json(201, { course: { ...NC, id: 'nc' }, classes: [] }) : undefined,
    );
    renderAt('/hv/dao-tao');
    const d = await openAdd();
    await user.click(within(d).getByRole('radio', { name: 'Nhiều lớp' }));
    expect(within(d).getByRole('heading', { name: /Lớp đầu tiên/ })).toBeTruthy();
    await user.type(within(d).getByLabelText(/^Tên khoá/), 'Nâng cao');
    await user.type(within(d).getByLabelText(/^Học phí/), '9500000');
    await user.type(within(d).getByLabelText(/^Số học viên tối đa/), '8');
    expect((within(d).getByLabelText(/^Tên lớp/) as HTMLInputElement).value).toBe('Nâng cao K1');
    expect((within(d).getByLabelText(/^Số tối đa của lớp/) as HTMLInputElement).value).toBe('8');
    await user.clear(within(d).getByLabelText(/^Số tối đa của lớp/));
    await user.type(within(d).getByLabelText(/^Số tối đa của lớp/), '6');
    await user.type(within(d).getByLabelText('Ngày bắt đầu'), '25/10/2026');
    await user.type(within(d).getByLabelText('Ngày kết thúc'), '22/11/2026');
    await user.click(within(d).getByRole('button', { name: 'Thứ Bảy' }));
    await user.click(within(d).getByRole('button', { name: 'Chủ nhật' }));
    await user.click(within(d).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]?.body).toEqual({
      name: 'Nâng cao',
      mode: 'MULTI_CLASS',
      tuitionFee: 9_500_000,
      defaultCapacity: 8,
      firstClass: { name: 'Nâng cao K1', startDate: '2026-10-25', endDate: '2026-11-22', weekdays: [6, 7], capacity: 6 },
    });
  });

  it('400 của máy chủ hiện ngay dưới đúng ô (firstClass.endDate → Thời gian, tuitionFee → Học phí)', async () => {
    const user = userEvent.setup();
    setupServer(OWNER, (m, p) =>
      m === 'POST' && p === '/orgs/org-1/courses'
        ? err(400, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
            issues: [
              { path: 'firstClass.endDate', message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' },
              { path: 'tuitionFee', message: 'Học phí quá lớn' },
            ],
          })
        : undefined,
    );
    renderAt('/hv/dao-tao');
    const d = await openAdd();
    await fillRequired(d, user);
    await user.click(within(d).getByRole('button', { name: 'Lưu' }));
    const fee = await within(d).findByText('Học phí quá lớn');
    expect(fee.closest('.ui-row')?.querySelector('.ui-row__label')?.textContent).toContain('Học phí');
    const dates = within(d).getByText('Ngày kết thúc phải từ ngày bắt đầu trở đi');
    expect(dates.closest('.ui-row')?.querySelector('.ui-row__label')?.textContent).toContain('Thời gian');
    // Dữ liệu đã nhập giữ nguyên.
    expect((within(d).getByLabelText(/^Tên khoá/) as HTMLInputElement).value).toBe('Makeup cá nhân đi tiệc');
  });
});

describe('Sửa khoá, mở lớp, lỗi 409', () => {
  it('sửa khoá Một lớp: có hộp nhắc vàng; bấm Nhiều lớp → ô Tên lớp; PATCH chỉ gửi { mode, firstClassName }', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p) => (m === 'PATCH' && p === '/orgs/org-1/courses/hq' ? json(200, { course: { ...HQ, mode: 'MULTI_CLASS' }, classes: HQ_CLASSES }) : undefined));
    renderAt('/hv/dao-tao/hq');
    fireEvent.click(within(await screen.findByRole('region', { name: 'Khoá Makeup Hàn Quốc' })).getByRole('button', { name: 'Sửa' }));
    const d = await screen.findByRole('dialog', { name: 'Sửa khoá' });
    expect(within(d).getByRole('note').textContent).toBe(
      'Bấm “Nhiều lớp”: khoá giữ tên, học phí; lớp hiện tại (15/11/2026 → 02/12/2026, 5/8 học viên) thành lớp đầu tiên, đặt tên được. Không mất học viên hay hợp đồng.',
    );
    expect(within(d).queryByLabelText(/^Tên lớp/)).toBeNull();
    await user.click(within(d).getByRole('radio', { name: 'Nhiều lớp' }));
    const name = within(d).getByLabelText(/^Tên lớp/) as HTMLInputElement;
    expect(name.value).toBe('Makeup Hàn Quốc K1');
    await user.clear(name);
    await user.type(name, 'Hàn Quốc K1');
    await user.click(within(d).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({ method: 'PATCH', path: '/orgs/org-1/courses/hq', body: { mode: 'MULTI_CLASS', firstClassName: 'Hàn Quốc K1' } });
  });

  it('khoá Nhiều lớp đang có 3 lớp: ô "Một lớp" bị khoá kèm lý do', async () => {
    setupServer(OWNER);
    renderAt('/hv/dao-tao/nc');
    fireEvent.click(within(await screen.findByRole('region', { name: 'Khoá Makeup nâng cao' })).getByRole('button', { name: 'Sửa' }));
    const d = await screen.findByRole('dialog', { name: 'Sửa khoá' });
    const single = within(d).getByRole('radio', { name: 'Một lớp' });
    expect(single.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(single.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Khoá đang có 3 lớp — chỉ chuyển về Một lớp khi còn 1 lớp');
  });

  it('mở lớp: tên gợi ý "Nâng cao K4", số tối đa lấy từ khoá (8); 409 SINGLE_CLASS → hiện lời máy chủ trong hộp và tải lại khoá', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p) =>
      m === 'POST' && p === '/orgs/org-1/courses/nc/classes'
        ? err(409, 'CONFLICT', 'Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm', { reason: 'SINGLE_CLASS' })
        : undefined,
    );
    renderAt('/hv/dao-tao/nc');
    fireEvent.click(await screen.findByRole('button', { name: 'Mở lớp' }));
    const d = await screen.findByRole('dialog', { name: 'Mở lớp mới' });
    expect((within(d).getByLabelText(/^Tên lớp/) as HTMLInputElement).value).toBe('Nâng cao K4');
    expect((within(d).getByLabelText(/^Số học viên tối đa/) as HTMLInputElement).value).toBe('8');
    await user.type(within(d).getByLabelText('Ngày bắt đầu'), '10/01/2027');
    await user.type(within(d).getByLabelText('Ngày kết thúc'), '07/02/2027');
    await user.click(within(d).getByRole('button', { name: 'Thứ Ba' }));
    const before = calls.filter((c) => c.method === 'GET' && c.path === '/orgs/org-1/courses/nc').length;
    await user.click(within(d).getByRole('button', { name: 'Mở lớp' }));
    expect(await within(d).findByText('Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm')).toBeTruthy();
    const post = writes(calls)[0];
    expect(post?.body).toEqual({ name: 'Nâng cao K4', startDate: '2027-01-10', endDate: '2027-02-07', weekdays: [2], capacity: 8 });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.path === '/orgs/org-1/courses/nc').length).toBeGreaterThan(before));
  });

  it('hạ số tối đa dưới số đã ghi danh: 409 CAPACITY_BELOW_ENROLLED hiện ngay dưới ô Số học viên tối đa', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p) =>
      m === 'PATCH' && p === '/orgs/org-1/classes/k2'
        ? err(409, 'CONFLICT', 'Lớp đã có 7 học viên — không đặt tối đa thấp hơn 7', { reason: 'CAPACITY_BELOW_ENROLLED', enrolledCount: 7 })
        : undefined,
    );
    renderAt('/hv/dao-tao/nc');
    fireEvent.click(within(await screen.findByRole('article', { name: 'Lớp Nâng cao K2' })).getByRole('button', { name: 'Sửa' }));
    const d = await screen.findByRole('dialog', { name: 'Sửa lớp Nâng cao K2' });
    const cap = within(d).getByLabelText(/^Số học viên tối đa/);
    await user.clear(cap);
    await user.type(cap, '5');
    await user.click(within(d).getByRole('button', { name: 'Lưu' }));
    const msg = await within(d).findByText('Lớp đã có 7 học viên — không đặt tối đa thấp hơn 7');
    expect(msg.closest('.ui-row')?.querySelector('.ui-row__label')?.textContent).toContain('Số học viên tối đa');
    expect(writes(calls)[0]).toMatchObject({ method: 'PATCH', body: { capacity: 5 } });
  });

  it('lưu trữ khoá bắt buộc lý do; huỷ lớp còn học viên → lời 409 của máy chủ trong hộp', async () => {
    const user = userEvent.setup();
    const calls = setupServer(OWNER, (m, p) =>
      m === 'POST' && p === '/orgs/org-1/classes/k3/cancel'
        ? err(409, 'CONFLICT', 'Lớp còn 1 học viên — chuyển hoặc huỷ ghi danh trước', { reason: 'CLASS_HAS_STUDENTS' })
        : m === 'POST' && p === '/orgs/org-1/courses/nc/archive'
          ? json(200, { course: { ...NC, archivedAt: T } })
          : undefined,
    );
    const router = renderAt('/hv/dao-tao/nc');
    fireEvent.click(within(await screen.findByRole('article', { name: 'Lớp Nâng cao K3' })).getByRole('button', { name: 'Sửa' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Sửa lớp Nâng cao K3' })).getByRole('button', { name: 'Huỷ lớp' }));
    let c = await screen.findByRole('dialog', { name: 'Huỷ lớp Nâng cao K3?' });
    await user.type(within(c).getByLabelText(/Lý do/), 'Không đủ học viên');
    await user.click(within(c).getByRole('button', { name: 'Huỷ lớp' }));
    expect(await within(c).findByText('Lớp còn 1 học viên — chuyển hoặc huỷ ghi danh trước')).toBeTruthy();
    await user.click(within(c).getByRole('button', { name: 'Giữ lớp' }));

    fireEvent.click(within(screen.getByRole('region', { name: 'Khoá Makeup nâng cao' })).getByRole('button', { name: 'Sửa' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Sửa khoá' })).getByRole('button', { name: 'Lưu trữ khoá' }));
    c = await screen.findByRole('dialog', { name: 'Lưu trữ khoá Makeup nâng cao?' });
    await user.click(within(c).getByRole('button', { name: 'Lưu trữ' }));
    expect(within(c).getByText(/Nhập lý do/)).toBeTruthy();
    await user.type(within(c).getByLabelText(/Lý do/), 'Ngừng mở');
    await user.click(within(c).getByRole('button', { name: 'Lưu trữ' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/hv/dao-tao'));
    expect(writes(calls).map((w) => [w.path, w.body])).toEqual([
      ['/orgs/org-1/classes/k3/cancel', { reason: 'Không đủ học viên' }],
      ['/orgs/org-1/courses/nc/archive', { reason: 'Ngừng mở' }],
    ]);
  });

  it('danh sách học viên của lớp: tên, số điện thoại, mã hợp đồng, đã thu / tổng; thiếu quyền tiền thì ghi rõ, không đoán', async () => {
    setupServer(OWNER, (m, p) =>
      p === '/orgs/org-1/classes/k2/enrollments'
        ? json(200, {
            items: [
              { id: 'e1', customer: { id: 'c1', fullName: 'Hồ Bảo Ngọc', phone: '0910071271', phoneHidden: false }, contract: { id: 'h1', code: 'HĐKH-000009', status: 'CONFIRMED', total: 9_500_000, paid: 3_000_000 }, status: 'ACTIVE', enrolledAt: T, cancelledAt: null, cancelReason: null },
              { id: 'e2', customer: { id: 'c2', fullName: 'Vũ Minh Châu', phone: null, phoneHidden: true }, contract: { id: 'h2', code: 'HĐKH-000015', status: 'CONFIRMED', total: null, paid: null }, status: 'ACTIVE', enrolledAt: T, cancelledAt: null, cancelReason: null },
            ],
          })
        : undefined,
    );
    renderAt('/hv/dao-tao/nc');
    fireEvent.click(within(await screen.findByRole('article', { name: 'Lớp Nâng cao K2' })).getByRole('button', { name: 'Học viên' }));
    const d = await screen.findByRole('dialog', { name: 'Học viên lớp Nâng cao K2' });
    expect(await within(d).findByText('Hồ Bảo Ngọc')).toBeTruthy();
    expect(within(d).getByText('0910071271 · HĐKH-000009')).toBeTruthy();
    expect(within(d).getByText('Đã thu 3.000.000 ₫ / 9.500.000 ₫')).toBeTruthy();
    expect(within(d).getByText('Số điện thoại: cần quyền xem khách · HĐKH-000015')).toBeTruthy();
    expect(within(d).getByText('Tiền: cần quyền xem hợp đồng')).toBeTruthy();
  });
});

describe('Buổi học lên Lịch ở thẻ lớp (việc tồn 6)', () => {
  const SUMMARY = { create: 8, update: 0, cancel: 0, keep: 0, past: 0, skippedManual: [], firstNewDate: '2026-10-25', lastNewDate: '2026-11-22' };
  const synced = { ...NC_CLASSES[2]!, calendar: { total: 8, upcoming: 8 } };

  it('BẮT: thẻ lớp ghi "Chưa lên Lịch"; bấm "Đưa lên Lịch" → xem trước (dryRun) → xác nhận ghi thật → thẻ tải lại thành "Đã lên Lịch · 8 buổi sắp tới"', async () => {
    let done = false;
    const calls = setupServer(OWNER, (method, path, body) => {
      if (method === 'POST' && path === '/orgs/org-1/classes/k3/sessions/sync') {
        const dry = (body as { dryRun: boolean }).dryRun;
        if (!dry) done = true;
        return json(200, { dryRun: dry, summary: SUMMARY, conflicts: [], class: dry ? NC_CLASSES[2] : synced });
      }
      if (method === 'GET' && path === '/orgs/org-1/courses/nc' && done) return json(200, { course: NC, classes: [NC_CLASSES[0], NC_CLASSES[1], synced] });
      return undefined;
    });
    renderAt('/hv/dao-tao/nc');
    const k3 = await screen.findByRole('article', { name: 'Lớp Nâng cao K3' });
    expect(k3.textContent).toContain('Chưa lên Lịch');
    fireEvent.click(within(k3).getByRole('button', { name: 'Đưa lên Lịch' }));
    const d = await screen.findByRole('dialog', { name: 'Buổi học lớp Nâng cao K3 trên Lịch' });
    expect(await within(d).findByText('Thêm 8 buổi học (25/10/2026 → 22/11/2026)')).toBeTruthy();
    expect(d.textContent).toContain('giữ giờ của giảng viên');
    expect(writes(calls).map((c) => c.body)).toEqual([{ dryRun: true }]);
    fireEvent.click(within(d).getByRole('button', { name: 'Đưa lên Lịch' }));
    expect(await within(d).findByText(/Đã cập nhật Lịch: 8 buổi sắp tới/)).toBeTruthy();
    expect(writes(calls).map((c) => c.body)).toEqual([{ dryRun: true }, { dryRun: false }]);
    fireEvent.click(within(d).getByRole('button', { name: 'Xong' }));
    await waitFor(() => expect(screen.getByRole('article', { name: 'Lớp Nâng cao K3' }).textContent).toContain('Đã lên Lịch · 8 buổi sắp tới'));
    expect(within(screen.getByRole('article', { name: 'Lớp Nâng cao K3' })).getByRole('button', { name: 'Cập nhật Lịch' })).toBeTruthy();
  });

  it('BẮT: xem trước thấy trùng giờ giảng viên → liệt kê lịch trùng, KHÔNG có nút ghi', async () => {
    const calls = setupServer(OWNER, (method, path) => {
      if (method === 'POST' && path === '/orgs/org-1/classes/k3/sessions/sync') {
        return json(200, {
          dryRun: true,
          summary: SUMMARY,
          conflicts: [{ appointmentId: 'x', code: 'LH-000777', startsAt: '2026-11-01T01:30:00.000Z', endsAt: '2026-11-01T03:00:00.000Z', blockStart: '2026-11-01T01:30:00.000Z', blockEnd: '2026-11-01T03:00:00.000Z', membershipId: 'm-2', staffName: 'Nguyễn Thu Hà' }],
          class: NC_CLASSES[2],
        });
      }
      return undefined;
    });
    renderAt('/hv/dao-tao/nc');
    const k3 = await screen.findByRole('article', { name: 'Lớp Nâng cao K3' });
    fireEvent.click(within(k3).getByRole('button', { name: 'Đưa lên Lịch' }));
    const d = await screen.findByRole('dialog', { name: 'Buổi học lớp Nâng cao K3 trên Lịch' });
    const alert = await within(d).findByRole('alert');
    expect(alert.textContent).toContain('LH-000777');
    expect(alert.textContent).toContain('Nguyễn Thu Hà');
    expect(alert.textContent).toContain('01/11 08:30–10:00');
    expect(within(d).queryByRole('button', { name: 'Đưa lên Lịch' })).toBeNull();
    expect(writes(calls).filter((c) => (c.body as { dryRun?: boolean })?.dryRun === false)).toEqual([]);
  });

  it('GIỮ: lớp chưa có giờ học → nút tắt kèm lý do; thiếu schedule.write (giảng viên) → không có nút', async () => {
    setupServer(OWNER, (method, path) =>
      method === 'GET' && path === '/orgs/org-1/courses/nc' ? json(200, { course: NC, classes: [{ ...NC_CLASSES[2], startTime: null, endTime: null }] }) : undefined,
    );
    renderAt('/hv/dao-tao/nc');
    const k3 = await screen.findByRole('article', { name: 'Lớp Nâng cao K3' });
    const off = within(k3).getByRole('button', { name: 'Đưa lên Lịch' });
    expect(off.getAttribute('aria-disabled')).toBe('true');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    setupServer(INSTRUCTOR);
    renderAt('/hv/dao-tao/nc');
    const k3b = await screen.findByRole('article', { name: 'Lớp Nâng cao K3' });
    expect(within(k3b).queryByRole('button', { name: /Lên Lịch|Đưa lên Lịch|Cập nhật Lịch/ })).toBeNull();
  });
});
