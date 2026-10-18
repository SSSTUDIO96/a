import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import * as contractsApi from '../../api/contracts';
import * as coursesApi from '../../api/courses';
import { ContractKindRouter } from './ContractKindRouter';

// Hợp đồng khoá học (bản vẽ C3 mục 2.3) với tầng API giả: chọn loại, lớp đầy tắt, chọn sẵn lớp từ màn Khoá & lớp,
// luật trộn dòng (chỉ khoá học + khoản tự đặt tên), chọn mẫu điều khoản / nội quy, 409 lớp vừa đầy, quyền, bản in.

vi.mock('../../api/contracts', () => ({
  quoteContract: vi.fn(),
  createContract: vi.fn(),
  getContract: vi.fn(),
  updateContract: vi.fn(),
  addContractLine: vi.fn(),
  voidContractLine: vi.fn(),
  changeContractStatus: vi.fn(),
  listContracts: vi.fn(),
  listContractTexts: vi.fn(),
  createContractText: vi.fn(),
  updateContractText: vi.fn(),
}));

vi.mock('../../api/courses', () => ({
  listCourseGroups: vi.fn(),
  listCourses: vi.fn(),
  listClasses: vi.fn(),
}));

vi.mock('../../api/catalog', () => ({
  listPackages: vi.fn(async () => ({ items: [], page: 1, pageSize: 100, total: 0 })),
  listServices: vi.fn(async () => ({ items: [], page: 1, pageSize: 100, total: 0 })),
  listMakeupSubjects: vi.fn(async () => ({ items: [] })),
  listStudioLocations: vi.fn(async () => ({ items: [] })),
  getTravelFeePolicy: vi.fn(async () => ({ defaultMode: 'PER_KM', fixedAmount: 0, perKmAmount: 0, freeKm: 0, minimumAmount: 0, roundTrip: true, tiers: [], updatedAt: '' })),
}));

vi.mock('../../api/staff', () => ({
  getStaffAvailability: vi.fn(),
  listStaffTiers: vi.fn(async () => ({ items: [] })),
  listStaff: vi.fn(async () => ({
    items: [{ membershipId: 'm-hm', userId: 'u', fullName: 'Lương Hà My', displayName: 'Lương Hà My', initials: 'HM', avatarUrl: null, phone: null, tier: null, isBookable: true, hasProfile: true, status: 'ACTIVE', roleKeys: [] }],
  })),
}));

vi.mock('../../api/schedule', () => ({
  listCustomers: vi.fn(),
  getCustomer: vi.fn(async () => ({ id: 'kh-1', fullName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', phone: '0912345678', email: null })),
}));

vi.mock('../../api/payments', () => ({
  getContractPayments: vi.fn(async () => ({
    contract: { id: 'hd-1', code: 'HĐKH-2026-0057', status: 'DRAFT', eventDate: null, confirmedAt: null, customer: { id: 'kh-1', fullName: 'Tôn Nữ', phone: null, phoneHidden: false } },
    summary: { total: 18_500_000, depositRequired: 5_000_000, received: 0, refunded: 0, paid: 0, remaining: 18_500_000, overpaid: 0, depositOutstanding: 5_000_000 },
    installments: [],
    installmentsTotal: 0,
    scheduleDifference: null,
    payments: [],
  })),
  putInstallments: vi.fn(),
}));

configure({ asyncUtilTimeout: 5000 });
const api = vi.mocked(contractsApi);
const courses = vi.mocked(coursesApi);
const TZ = 'Asia/Ho_Chi_Minh';
const T = '2026-10-01T03:00:00.000Z';

function cls(id: string, name: string, enrolled: number, capacity: number, status: 'OPEN' | 'CLOSED' = 'OPEN', start = '2026-11-02') {
  const seatState = enrolled >= capacity ? 'FULL' : enrolled / capacity >= 0.75 ? 'ALMOST_FULL' : 'AVAILABLE';
  return {
    id,
    courseId: 'c-mcp',
    name,
    startDate: start,
    endDate: '2026-12-17',
    weekdays: [2, 4, 6],
    startTime: '18:00',
    endTime: '22:00',
    capacity,
    enrolledCount: enrolled,
    seatsLeft: Math.max(0, capacity - enrolled),
    seatState,
    status,
    note: null,
    instructor: { membershipId: 'm-th', name: 'Nguyễn Thu Hà' },
    location: { id: 'st', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt' },
    course: { id: 'c-mcp', code: 'MCP-01', name: 'Makeup chuyên nghiệp', mode: 'MULTI_CLASS' },
  };
}

const CLASSES = [
  cls('k11', 'K11', 12, 12, 'OPEN', '2026-10-26'),
  cls('k12', 'K12', 9, 12),
  cls('k13', 'K13', 3, 12, 'OPEN', '2026-12-07'),
  cls('k14', 'K14', 1, 12, 'CLOSED', '2027-01-05'),
];
const COURSE = {
  id: 'c-mcp',
  code: 'MCP-01',
  name: 'Makeup chuyên nghiệp',
  mode: 'MULTI_CLASS',
  groupId: 'g-cn',
  tuitionFee: 18_000_000,
  depositAmount: 5_000_000,
  defaultCapacity: 12,
  sessionCount: 24,
  sessionMinutes: 240,
  description: null,
  sortOrder: 1,
  archivedAt: null,
  createdAt: T,
  updatedAt: T,
  classSummary: { total: 4, open: 3, withSeats: 2, nextStartDate: '2026-11-02' },
  singleClass: null,
};
const TERMS = { id: 't-dk', kind: 'TERMS', appliesTo: ['COURSE'], name: 'Điều khoản khoá học', body: '1. Học phí đã đóng không hoàn lại.\n2. Nghỉ quá 3 buổi không học bù.', version: 3, isDefault: true, isActive: true, createdAt: T, updatedAt: T, updatedBy: { id: 'u', fullName: 'Chiến' } };
const RULES = { id: 't-nq', kind: 'RULES', appliesTo: [], name: 'Nội quy trung tâm', body: '1. Có mặt trước giờ học 10 phút.\n2. Giữ gìn dụng cụ chung.', version: 2, isDefault: true, isActive: true, createdAt: T, updatedAt: T, updatedBy: { id: 'u', fullName: 'Chiến' } };

function lineView(over: Record<string, unknown>) {
  return {
    id: null,
    kind: 'COURSE',
    name: 'Makeup chuyên nghiệp · K12',
    serviceId: null,
    packageId: null,
    priceVersionId: null,
    subjectId: null,
    subjectName: null,
    locationType: null,
    studioLocationId: null,
    address: null,
    latitude: null,
    longitude: null,
    scheduledStart: null,
    scheduledEnd: null,
    quantity: 1,
    unitPrice: 18_000_000,
    lineDiscount: 0,
    lineTotal: 18_000_000,
    travelMode: null,
    distanceKm: null,
    perKmAmount: null,
    note: null,
    courseClassId: 'k12',
    addedAfterConfirm: false,
    createdAt: null,
    voidedAt: null,
    voidReason: null,
    staff: [],
    staffWarnings: [],
    travelBreakdown: null,
    addons: [],
    travel: null,
    ...over,
  };
}

function quoteFor(body: { lines: { kind: string; courseClassId?: string; name?: string; unitPrice?: number }[] }) {
  const lines = body.lines.map((l) =>
    l.kind === 'COURSE'
      ? lineView({ courseClassId: l.courseClassId, name: `Makeup chuyên nghiệp · ${String(l.courseClassId).toUpperCase()}` })
      : lineView({ kind: 'CUSTOM', name: l.name, courseClassId: null, unitPrice: l.unitPrice, lineTotal: l.unitPrice }),
  );
  const subtotal = lines.reduce((s, l) => s + (l.lineTotal as number), 0);
  return {
    kind: 'COURSE',
    lines,
    travelTotal: 0,
    subtotal,
    discount: 0,
    total: subtotal,
    depositRequired: 5_000_000,
    suggestedDeposit: 5_000_000,
    classes: body.lines.filter((l) => l.kind === 'COURSE').map((l) => {
      const c = CLASSES.find((k) => k.id === l.courseClassId) ?? CLASSES[1]!;
      return { classId: c.id, name: c.name, status: c.status, capacity: c.capacity, enrolledCount: c.enrolledCount, seatsLeft: c.seatsLeft, seatState: c.seatState };
    }),
  };
}

function detail(status: 'DRAFT' | 'CONFIRMED', over: Record<string, unknown> = {}) {
  return {
    id: 'hd-1',
    code: 'HĐKH-2026-0057',
    kind: 'COURSE',
    status,
    ownerMembershipId: 'm-hm',
    eventDate: null,
    subtotal: 18_000_000,
    discount: 0,
    total: 18_000_000,
    depositRequired: 5_000_000,
    travelTotal: 0,
    notes: null,
    terms: status === 'CONFIRMED' ? TERMS.body : null,
    rules: status === 'CONFIRMED' ? RULES.body : null,
    termsTemplateId: 't-dk',
    termsTemplateVersion: 3,
    rulesTemplateId: 't-nq',
    rulesTemplateVersion: 2,
    cancelReason: null,
    confirmedAt: status === 'CONFIRMED' ? '2026-10-18T07:00:00.000Z' : null,
    createdById: 'u',
    createdAt: T,
    updatedAt: '2026-10-18T06:00:00.000Z',
    customer: { id: 'kh-1', fullName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', phone: '0912345678', email: null },
    lines: [lineView({ id: 'ln-1', createdAt: T })],
    appointments: [],
    enrollments: status === 'CONFIRMED' ? [{ id: 'e1', contractLineId: 'ln-1', courseClassId: 'k12', status: 'ACTIVE', enrolledAt: T, cancelledAt: null, cancelReason: null }] : [],
    ...over,
  };
}

const OWNER = new Set<string>(SYSTEM_ROLES.owner.permissions);

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.pathname + loc.search}</output>;
}

function renderAt(path: string, opts: { academy?: boolean; perms?: Set<string> } = {}) {
  const perms = opts.perms ?? OWNER;
  const has = (p: Permission) => perms.has(p);
  // Như routes.tsx: MỘT đường hop-dong/:id cho cả "moi" và id — đổi moi → id sau lần lưu đầu không dựng lại màn.
  function Page() {
    const { id } = useParams();
    return (
      <>
        <ContractKindRouter orgId="org-1" slug="hv" tz={TZ} orgName="Chiến Makeup Academy" academy={opts.academy ?? true} has={has} contractId={id === 'moi' ? null : (id ?? null)} />
        <Where />
      </>
    );
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:orgSlug/hop-dong/:id" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  courses.listCourseGroups.mockResolvedValue({ items: [{ id: 'g-cn', name: 'Makeup chuyên nghiệp', sortOrder: 1, isActive: true, courseCount: 1, createdAt: T, updatedAt: T }] } as never);
  courses.listCourses.mockResolvedValue({ items: [COURSE] } as never);
  courses.listClasses.mockResolvedValue({ items: CLASSES } as never);
  api.listContractTexts.mockResolvedValue([TERMS, RULES] as never);
  api.quoteContract.mockImplementation(async (_o, body) => quoteFor(body as never) as never);
});
afterEach(() => vi.useRealTimers());

const NEW = '/hv/hop-dong/moi?kind=COURSE&classId=k12&customerId=kh-1';
const lastQuote = () => api.quoteContract.mock.calls.at(-1)?.[1] as unknown as Record<string, unknown>;

describe('chọn loại hợp đồng', () => {
  it('tổ chức đào tạo: seg "Khoá học / Dịch vụ makeup", mặc định Khoá học; bấm Dịch vụ → màn hợp đồng dịch vụ', async () => {
    const user = userEvent.setup();
    renderAt('/hv/hop-dong/moi');
    const seg = await screen.findAllByRole('radiogroup', { name: 'Loại hợp đồng' });
    const g = seg[0]!;
    expect(within(g).getByRole('radio', { name: 'Khoá học' }).getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByRole('textbox', { name: 'Tìm khoá học' })).toBeTruthy();
    await user.click(within(g).getByRole('radio', { name: 'Dịch vụ makeup' }));
    expect(screen.getByTestId('where').textContent).toBe('/hv/hop-dong/moi?kind=SERVICE');
    expect(await screen.findByRole('textbox', { name: 'Tìm gói, dịch vụ, phụ phí' })).toBeTruthy();
  });

  it('tổ chức không phải đào tạo: không có seg loại, chỉ hợp đồng dịch vụ (kể cả ?kind=COURSE)', async () => {
    renderAt('/hv/hop-dong/moi?kind=COURSE', { academy: false });
    expect(await screen.findByRole('textbox', { name: 'Tìm gói, dịch vụ, phụ phí' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Loại hợp đồng' })).toBeNull();
    expect(courses.listCourses).not.toHaveBeenCalled();
  });

  it('hợp đồng đã lưu: loại theo máy chủ, không đổi được', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    renderAt('/hv/hop-dong/hd-1');
    const g = (await screen.findAllByRole('radiogroup', { name: 'Loại hợp đồng' }))[0]!;
    expect(within(g).getByRole('radio', { name: 'Khoá học' }).getAttribute('aria-checked')).toBe('true');
    expect(within(g).getByRole('radio', { name: 'Dịch vụ makeup' }).hasAttribute('disabled') || within(g).getByRole('radio', { name: 'Dịch vụ makeup' }).getAttribute('aria-disabled') === 'true').toBe(true);
    expect(await screen.findByRole('heading', { name: /HĐKH-2026-0057/ })).toBeTruthy();
  });
});

describe('chọn lớp', () => {
  it('Ghi danh từ màn Khoá & lớp: chọn sẵn lớp K12; lớp đầy / ngừng nhận tắt kèm lý do; "còn N chỗ"', async () => {
    renderAt(NEW);
    const group = await screen.findByRole('radiogroup', { name: 'Chọn lớp — Makeup chuyên nghiệp' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(4);
    const k11 = radios.find((r) => r.value === 'k11')!;
    const k12 = radios.find((r) => r.value === 'k12')!;
    const k14 = radios.find((r) => r.value === 'k14')!;
    expect(k12.checked).toBe(true);
    expect(k11.disabled).toBe(true);
    expect(k14.disabled).toBe(true);
    expect(within(group).getByText('Lớp đã đủ 12/12 học viên')).toBeTruthy();
    expect(within(group).getByText('Lớp đã ngừng nhận ghi danh')).toBeTruthy();
    expect(within(group).getByText('còn 9 chỗ')).toBeTruthy();
    expect(within(group).getByText('Sắp đầy · còn 3')).toBeTruthy();
    // Cột trái: khoá theo nhóm thực tế của trung tâm, "x/y lớp còn chỗ".
    expect(screen.getByRole('group', { name: 'Lọc theo nhóm khoá' }).textContent).toContain('Makeup chuyên nghiệp');
    expect(screen.getByText('2/4 lớp còn chỗ')).toBeTruthy();
  });

  it('classId lạ → bỏ chọn, báo một dòng', async () => {
    renderAt('/hv/hop-dong/moi?kind=COURSE&classId=khong-co');
    expect(await screen.findByText(/Không tìm thấy lớp này/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: /Chọn lớp/ })).toBeNull();
  });

  it('classId của lớp đã đầy → thêm khoá nhưng không chọn lớp, báo lý do', async () => {
    renderAt('/hv/hop-dong/moi?kind=COURSE&classId=k11');
    expect(await screen.findByText('Lớp đã đủ 12/12 học viên — chọn lớp khác.')).toBeTruthy();
    const group = screen.getByRole('radiogroup', { name: 'Chọn lớp — Makeup chuyên nghiệp' });
    expect((within(group).getAllByRole('radio') as HTMLInputElement[]).some((r) => r.checked)).toBe(false);
  });
});

describe('luật trộn dòng, mẫu điều khoản / nội quy, số tiền máy chủ', () => {
  it('chỉ dòng khoá học + khoản tự đặt tên; thân gửi kind COURSE, mẫu mặc định gợi ý sẵn; tổng là số quote', async () => {
    const user = userEvent.setup();
    renderAt(NEW);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    expect(lastQuote()).toMatchObject({ kind: 'COURSE', customerId: 'kh-1', termsTemplateId: 't-dk', rulesTemplateId: 't-nq', lines: [{ kind: 'COURSE', courseClassId: 'k12' }] });
    // Không có phụ phí cài sẵn / gói dịch vụ ở hợp đồng khoá học.
    expect(screen.queryByRole('button', { name: 'Phụ phí cài sẵn' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Khoản tự đặt tên' }));
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByRole('textbox', { name: 'Tên khoản' }), 'Giáo trình');
    await user.type(within(dlg).getByRole('textbox', { name: 'Số tiền' }), '500000');
    await user.click(within(dlg).getByRole('button', { name: 'Thêm' }));
    await waitFor(() => expect((lastQuote().lines as unknown[]).length).toBe(2));
    expect(lastQuote().lines).toEqual([
      { kind: 'COURSE', courseClassId: 'k12' },
      { kind: 'CUSTOM', name: 'Giáo trình', unitPrice: 500_000, quantity: 1 },
    ]);
    await waitFor(() => expect(document.querySelector('[data-o="tong"]')?.textContent).toBe('18.500.000 ₫'));
    // Chọn lớp khác → thân quote đổi lớp.
    const group = screen.getByRole('radiogroup', { name: 'Chọn lớp — Makeup chuyên nghiệp' });
    await user.click((within(group).getAllByRole('radio') as HTMLInputElement[]).find((r) => r.value === 'k13')!);
    await waitFor(() => expect((lastQuote().lines as { courseClassId?: string }[])[0]?.courseClassId).toBe('k13'));
  });

  it('chọn mẫu khác / xem nội dung mẫu; không có contracts.texts thì không có "Quản lý mẫu"', async () => {
    const user = userEvent.setup();
    const OTHER = { ...TERMS, id: 't-dk2', name: 'Điều khoản ngắn', isDefault: false, version: 1 };
    api.listContractTexts.mockResolvedValue([TERMS, OTHER, RULES] as never);
    const perms = new Set(OWNER);
    perms.delete('contracts.texts');
    renderAt(NEW, { perms });
    const sel = (await screen.findByRole('combobox', { name: 'Mẫu điều khoản' })) as HTMLSelectElement;
    await waitFor(() => expect(sel.value).toBe('t-dk'));
    await user.selectOptions(sel, 't-dk2');
    await waitFor(() => expect(lastQuote().termsTemplateId).toBe('t-dk2'));
    expect(screen.queryByRole('button', { name: 'Quản lý mẫu' })).toBeNull();
    const rules = document.querySelector('[data-o="mau-rules"]') as HTMLElement;
    expect(within(rules).getByText('Bản v2 · sửa 01/10/2026')).toBeTruthy();
    await user.click(within(rules).getByRole('button', { name: 'Xem' }));
    expect(await screen.findByText('2. Giữ gìn dụng cụ chung.')).toBeTruthy();
  });

  it('Quản lý mẫu (contracts.texts): thêm mẫu nội quy → POST đúng thân, danh sách mẫu tải lại', async () => {
    const user = userEvent.setup();
    api.createContractText.mockResolvedValue({ ...RULES, id: 't-nq2', name: 'Nội quy mới' } as never);
    renderAt(NEW);
    await user.click(await screen.findByRole('button', { name: 'Quản lý mẫu' }));
    const dlg = await screen.findByRole('dialog', { name: 'Mẫu điều khoản & nội quy' });
    expect(await within(dlg).findByText('Điều khoản khoá học')).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Thêm mẫu' }));
    const form = await screen.findByRole('dialog', { name: 'Thêm mẫu điều khoản / nội quy' });
    await user.click(within(form).getByRole('radio', { name: 'Nội quy' }));
    await user.type(within(form).getByRole('textbox', { name: /Tên mẫu/ }), 'Nội quy mới');
    await user.type(within(form).getByRole('textbox', { name: /Nội dung/ }), 'Không ăn trong lớp.');
    await user.click(within(form).getByRole('button', { name: 'Thêm mẫu' }));
    await waitFor(() => expect(api.createContractText).toHaveBeenCalled());
    expect(api.createContractText.mock.calls[0]?.[1]).toEqual({ kind: 'RULES', appliesTo: ['COURSE'], name: 'Nội quy mới', body: 'Không ăn trong lớp.' });
    await waitFor(() => expect(api.listContractTexts.mock.calls.length).toBeGreaterThanOrEqual(3));
  });
});

describe('xác nhận', () => {
  it('409 lớp vừa đầy → dải đỏ lời máy chủ + "chọn lớp khác", tải lại số chỗ; hợp đồng vẫn là nháp', async () => {
    const user = userEvent.setup();
    api.createContract.mockResolvedValue(detail('DRAFT') as never);
    api.changeContractStatus.mockRejectedValue(
      new ApiError('CONFLICT', 'Lớp K12 đã đủ 12/12 học viên', 409, 'r', { reason: 'CLASS_FULL', classId: 'k12', enrolledCount: 12, capacity: 12, seatsLeft: 0, lineId: 'ln-1' }),
    );
    renderAt(NEW);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    const before = courses.listClasses.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Xác nhận hợp đồng' }));
    expect(await screen.findByText('Lớp K12 đã đủ 12/12 học viên — chọn lớp khác')).toBeTruthy();
    await waitFor(() => expect(courses.listClasses.mock.calls.length).toBe(before + 1));
    expect(api.createContract.mock.calls[0]?.[1]).toMatchObject({ kind: 'COURSE', lines: [{ kind: 'COURSE', courseClassId: 'k12' }] });
    expect(screen.getAllByText('Nháp').length).toBeGreaterThan(0);
  });

  it('thành công → báo đã ghi danh, liên kết Thu tiền; điều khoản / nội quy hiện bản chụp', async () => {
    const user = userEvent.setup();
    api.createContract.mockResolvedValue(detail('DRAFT') as never);
    api.changeContractStatus.mockResolvedValue({ ...detail('CONFIRMED'), lines: [lineView({ id: 'ln-1', createdAt: T })], cancelledAppointments: [], createdAppointments: [] } as never);
    renderAt(NEW);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Xác nhận hợp đồng' }));
    const ok = await screen.findByText(/Đã xác nhận và ghi danh vào Makeup chuyên nghiệp · K12/);
    expect(ok.closest('[role="status"]')?.querySelector('a')?.getAttribute('href')).toBe('/hv/thu-tien/hd-1');
    expect(screen.getByText('Đã ghi danh')).toBeTruthy();
    expect(screen.getByText('Bản v2 đã chụp vào hợp đồng')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/hv/hop-dong/hd-1'));
    // Đổi đường không dựng lại màn: lời báo vẫn còn.
    expect(screen.getByText(/Đã xác nhận và ghi danh/)).toBeTruthy();
  });

  it('bản in: nội dung hợp đồng, cọc, tiến độ, điều khoản, nội quy', async () => {
    const user = userEvent.setup();
    renderAt(NEW);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('[data-o="tong"]')?.textContent).toBe('18.000.000 ₫'));
    await user.click(screen.getByRole('button', { name: 'Xem bản in' }));
    const paper = await screen.findByRole('article', { name: 'Bản in hợp đồng' });
    expect(within(paper).getByText('HỢP ĐỒNG ĐÀO TẠO')).toBeTruthy();
    expect(paper.textContent).toContain('Makeup chuyên nghiệp · K12');
    expect(paper.textContent).toContain('Cọc phải thu5.000.000 ₫');
    expect(paper.textContent).toContain('Tiến độ thanh toán');
    expect(paper.textContent).toContain('Nội quy trung tâm');
    expect(within(paper).getByText('Giữ gìn dụng cụ chung.')).toBeTruthy();
    expect(paper.textContent?.toLowerCase()).not.toContain('lợi nhuận');
  });
});

describe('quyền', () => {
  it('không có contracts.write: không có danh mục khoá, không Xác nhận; vẫn xem được bản in', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    const perms = new Set(OWNER);
    perms.delete('contracts.write');
    renderAt('/hv/hop-dong/hd-1', { perms });
    expect(await screen.findByRole('heading', { name: /HĐKH-2026-0057/ })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Tìm khoá học' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xác nhận hợp đồng' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Xem bản in' })).toBeTruthy();
    const group = screen.getByRole('radiogroup', { name: 'Chọn lớp — Makeup chuyên nghiệp' });
    expect(within(group).queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('đổi học viên của hợp đồng khoá học nháp đã lưu', () => {
  it('nút "Đổi" gửi PATCH chỉ customerId; 409 CUSTOMER_IN_USE báo rõ; đã xác nhận thì không có nút', async () => {
    const sched = vi.mocked(await import('../../api/schedule'));
    sched.listCustomers.mockResolvedValue({ items: [{ id: 'kh-2', fullName: 'Nguyễn Thị Lan', phone: '0987654321', email: null }], page: 1, pageSize: 8, total: 1 } as never);
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.updateContract
      .mockRejectedValueOnce(new ApiError('CONFLICT', 'x', 409, 'r', { reason: 'CUSTOMER_IN_USE', appointments: 0, designCards: 2 }))
      .mockResolvedValueOnce({ ...detail('DRAFT'), updatedAt: '2026-10-18T06:01:00.000Z', customer: { id: 'kh-2', fullName: 'Nguyễn Thị Lan', phone: '0987654321', email: null } } as never);
    renderAt('/hv/hop-dong/hd-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Đổi khách' }));
    await userEvent.type(screen.getByLabelText('Tìm khách theo tên hoặc số điện thoại'), 'Lan');
    await userEvent.click(await screen.findByRole('option', { name: /Nguyễn Thị Lan/ }));
    expect(await screen.findByText('Chưa đổi được khách: hợp đồng đã có 2 thẻ thiết kế mang tên khách hiện tại. Muốn đổi, xoá thẻ thiết kế trước.')).toBeTruthy();
    expect(api.updateContract.mock.calls[0]?.[2]).toEqual({ customerId: 'kh-2', expectedUpdatedAt: '2026-10-18T06:00:00.000Z' });
    await userEvent.click(screen.getByRole('option', { name: /Nguyễn Thị Lan/ }));
    expect(await screen.findByText('Đã đổi sang Nguyễn Thị Lan — đã lưu vào hợp đồng.')).toBeTruthy();
    expect(screen.queryByLabelText('Tìm khách theo tên hoặc số điện thoại')).toBeNull();
  });

  it('đã xác nhận: không bày nút đổi học viên', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    renderAt('/hv/hop-dong/hd-1');
    expect(await screen.findByRole('heading', { name: /HĐKH-2026-0057/ })).toBeTruthy();
    await screen.findByText('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo');
    expect(screen.queryByRole('button', { name: 'Đổi khách' })).toBeNull();
  });
});
