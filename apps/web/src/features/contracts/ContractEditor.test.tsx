import { configure, render, screen, waitFor, within } from '@testing-library/react';
import { useState as useStateForTest } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import * as contractsApi from '../../api/contracts';
import * as scheduleApi from '../../api/schedule';
import * as catalogApi from '../../api/catalog';
import * as staffApi from '../../api/staff';
import { avatarColorIndex } from '../../ui/Avatar';
import { staffNaming } from '../../ui/staffName';
import { ContractEditor } from './ContractEditor';
import { ExtraPackageDialog } from './ExtraPackageDialog';
import { StaffRow as ContractStaffRow } from './StaffRow';
import { BottomSheet, Dialog } from '../../ui';

// Màn hợp đồng với tầng API giả (vi.mock): cảnh báo thợ 3 mức, chặn xác nhận khi đỏ, lỗi 400/403/409, ẩn/khoá theo quyền.

vi.mock('../../api/contracts', () => ({
  quoteContract: vi.fn(),
  createContract: vi.fn(),
  getContract: vi.fn(),
  updateContract: vi.fn(),
  addContractLine: vi.fn(),
  voidContractLine: vi.fn(),
  changeContractStatus: vi.fn(),
  listContracts: vi.fn(),
}));

vi.mock('../../api/catalog', () => ({
  listPackages: vi.fn(async () => ({ items: [PKG_ME], page: 1, pageSize: 100, total: 1 })),
  listServices: vi.fn(async () => ({ items: [], page: 1, pageSize: 100, total: 0 })),
  listMakeupSubjects: vi.fn(async () => ({ items: [{ id: 's-me', name: 'Mẹ cô dâu', sortOrder: 1, isActive: true }] })),
  listOccasions: vi.fn(async () => ({ items: OCCASIONS })),
  listSurchargeRules: vi.fn(async () => ({ items: RULES })),
  listStudioLocations: vi.fn(async () => ({
    items: [{ id: 'st-1', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt', isDefault: true, isActive: true }],
  })),
  getTravelFeePolicy: vi.fn(async () => ({
    defaultMode: 'PER_KM',
    fixedAmount: 150_000,
    perKmAmount: 10_000,
    freeKm: 1.5,
    minimumAmount: 0,
    roundTrip: true,
    tiers: [],
    updatedAt: '',
  })),
}));

vi.mock('../../api/staff', () => ({
  getStaffAvailability: vi.fn(),
  listStaffTiers: vi.fn(async () => ({ items: [] })),
  // R2/R4: màn hợp đồng đọc danh sách thợ của tổ chức (sổ thợ để xét trùng tên ngắn / màu ảnh).
  listStaff: vi.fn(async () => ({ items: [] })),
}));

vi.mock('../../api/schedule', () => ({ listCustomers: vi.fn(), getCustomer: vi.fn() }));

const api = vi.mocked(contractsApi);
// Quote đợi 300ms rồi mới gọi; khi cả bộ vitest chạy song song, 1 giây chờ mặc định không đủ.
configure({ asyncUtilTimeout: 5000 });
const TZ = 'Asia/Ho_Chi_Minh';

const OCCASIONS = [
  { id: 'oc-vq', name: 'Lễ vu quy', color: 'taupe', sortOrder: 1, isActive: true, lineCount: 0, createdAt: '', updatedAt: '' },
  { id: 'oc-tiec', name: 'Tiệc', color: 'violet', sortOrder: 2, isActive: true, lineCount: 0, createdAt: '', updatedAt: '' },
];

// Hai luật: "Ngoài giờ" tính theo số lượng dòng, "Ngày lễ" luôn 1.
const RULES = [
  { id: 'r-gio', name: 'Ngoài giờ', serviceId: 'sv-gio', perQuantity: true, isActive: true },
  { id: 'r-le', name: 'Ngày lễ', serviceId: 'sv-le', perQuantity: false, isActive: true },
];

const PKG_ME = {
  id: 'p-me',
  code: 'ME',
  name: 'Mẹ – Trang điểm nhẹ nhàng',
  subjectId: 's-me',
  locationTypes: ['STUDIO', 'CUSTOMER_HOME'],
  includedKm: null,
  items: [],
  currentPrice: { unitPrice: 600_000, listPrice: 600_000, salePrice: null, priceVersionId: 'pv', effectiveFrom: '' },
};

// Máy chủ gửi tên hiển thị + họ tên (contracts/present.ts StaffView). Minh Anh: studio chưa đặt tên hiển thị.
const MINH_ANH = { membershipId: 'm2', role: 'PRIMARY', displayName: 'Trần Minh Anh', fullName: 'Trần Minh Anh', avatarUrl: null, initials: 'TA', tier: null };
// Linh: studio đã đặt tên hiển thị khác họ tên.
const LINH = { membershipId: 'm7', role: 'PRIMARY', displayName: 'Linh Trần', fullName: 'Trần Khánh Linh', avatarUrl: null, initials: 'LT', tier: null };

function line(over: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    kind: 'PACKAGE',
    name: 'Mẹ – Trang điểm nhẹ nhàng',
    serviceId: null,
    packageId: 'p-me',
    priceVersionId: 'pv',
    subjectId: 's-me',
    subjectName: 'Mẹ cô dâu',
    locationType: 'STUDIO',
    studioLocationId: 'st-1',
    address: null,
    latitude: null,
    longitude: null,
    scheduledStart: '2026-10-23T22:00:00.000Z',
    scheduledEnd: '2026-10-23T22:45:00.000Z',
    quantity: 1,
    unitPrice: 600_000,
    lineDiscount: 0,
    lineTotal: 600_000,
    travelMode: null,
    distanceKm: null,
    perKmAmount: null,
    note: null,
    addedAfterConfirm: false,
    voidedAt: null,
    voidReason: null,
    staff: [MINH_ANH],
    staffWarnings: [],
    travelBreakdown: null,
    addons: [],
    travel: null,
    occasionId: null,
    occasionName: null,
    surchargeRuleId: null,
    surchargeRuleName: null,
    dismissedRuleIds: [],
    surcharges: [],
    ...over,
  };
}

function detail(status: string, over: Record<string, unknown> = {}) {
  return {
    id: 'hd-1',
    code: 'HĐ-2026-0142',
    status,
    eventDate: '2026-10-23T17:00:00.000Z',
    subtotal: 600_000,
    discount: 0,
    total: 600_000,
    depositRequired: 0,
    travelTotal: 0,
    notes: null,
    terms: null,
    cancelReason: null,
    confirmedAt: status === 'CONFIRMED' ? '2026-10-20T07:05:00.000Z' : null,
    createdById: 'u',
    createdAt: '',
    updatedAt: '',
    customer: { id: 'c-1', fullName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', phone: '0912345678', email: null },
    lines: [line()],
    appointments: [],
    ...over,
  };
}

function quote(staffWarnings: unknown[]) {
  return {
    lines: [line({ id: null, staffWarnings })],
    travelTotal: 0,
    subtotal: 600_000,
    discount: 0,
    total: 600_000,
    depositRequired: 0,
    suggestedDeposit: 0,
    classes: [],
    autoSurcharge: { applied: [], removed: [], skipped: [] },
  };
}

const OVERLAP = {
  membershipId: 'm2',
  level: 'OVERLAP',
  overlaps: [
    {
      appointmentId: 'a1',
      code: 'L-0001',
      status: 'CONFIRMED',
      startsAt: '2026-10-23T22:00:00.000Z',
      endsAt: '2026-10-23T23:30:00.000Z',
      blockStart: '2026-10-23T22:00:00.000Z',
      blockEnd: '2026-10-23T23:30:00.000Z',
      title: 'Makeup ăn hỏi',
      customerName: 'Vũ Hồng Nhung',
    },
  ],
  sameDay: [],
  draftHolds: [],
};

const SAME_DAY = { ...OVERLAP, level: 'SAME_DAY', overlaps: [], sameDay: OVERLAP.overlaps };

function renderEditor(perms: readonly Permission[], contractId: string | null = 'hd-1', url = '/studio/hop-dong/hd-1') {
  const has = (p: Permission) => perms.includes(p);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ContractEditor orgId="org-1" slug="studio" tz={TZ} has={has} contractId={contractId} />
    </MemoryRouter>,
  );
}

const OWNER = SYSTEM_ROLES.owner.permissions;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

async function confirmButton() {
  return screen.findByRole('button', { name: /^Xác nhận hợp đồng/ });
}

describe('cảnh báo thợ trong thẻ dòng', () => {
  it('rảnh: không dải; nút xác nhận bấm được', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(OWNER);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    expect(await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' })).toBeTruthy();
    expect(screen.queryByText(/Trùng giờ/)).toBeNull();
    expect(screen.queryByText(/có lịch trong ngày/)).toBeNull();
    expect((await confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  // M3 (biên bản nghiệm thu lại): tên ngắn theo hàm chung staffShortName. Máy chủ nay gửi kèm họ tên (fullName):
  // chưa đặt tên hiển thị (trùng họ tên) → tiếng cuối của họ tên; đã đặt → nguyên tên hiển thị.
  it('vàng: "Anh có lịch trong ngày · 1 ca" (chưa đặt tên hiển thị); hàng thợ cũng "Anh"; vẫn xác nhận được', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([SAME_DAY]) as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Anh có lịch trong ngày · 1 ca')).toBeTruthy();
    expect(document.querySelector('.ct-tn')?.textContent).toBe('Anh');
    // Tên đầy đủ vẫn ở nhãn đọc / tooltip.
    expect(screen.getByRole('group', { name: 'Trần Minh Anh (thợ chính)' })).toBeTruthy();
    expect((await confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('M3: thợ có tên hiển thị khác họ tên ("Linh Trần" / "Trần Khánh Linh") → dải và hàng thợ ghi nguyên "Linh Trần"', async () => {
    const withLinh = (over: Record<string, unknown> = {}) => line({ staff: [LINH], ...over });
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [withLinh()] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [withLinh({ id: null, staffWarnings: [{ ...SAME_DAY, membershipId: 'm7' }] })] } as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Linh Trần có lịch trong ngày · 1 ca')).toBeTruthy();
    expect(document.querySelector('.ct-tn')?.textContent).toBe('Linh Trần');
    expect(screen.queryByText(/^Linh có lịch|^Trần có lịch/)).toBeNull();
  });

  it('đỏ: "Trùng giờ 05:00–06:30" và khoá nút xác nhận, lý do ở tooltip', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([OVERLAP]) as never);
    renderEditor(OWNER);
    const band = await screen.findByText('Trùng giờ 05:00–06:30');
    expect((band.closest('[data-muc]'))?.getAttribute('data-muc')).toBe('OVERLAP');
    const btn = await confirmButton();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Xác nhận hợp đồng — Còn 1 dòng thợ trùng giờ. Đổi thợ hoặc đổi giờ trước khi xác nhận.');
  });
});

describe('xác nhận và lỗi máy chủ', () => {
  it('409 trùng giờ khi xác nhận: hiện danh sách ca trùng, vẫn là nháp, gọi lại quote', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.changeContractStatus.mockRejectedValue(
      new ApiError('CONFLICT', 'Trùng lịch của thợ', 409, 'r', {
        conflicts: [
          {
            appointmentId: 'a1',
            code: 'L-0123',
            startsAt: '2026-10-23T23:00:00.000Z',
            endsAt: '2026-10-24T00:30:00.000Z',
            blockStart: '',
            blockEnd: '',
            membershipId: 'm2',
            staffName: 'Trần Minh Anh',
          },
        ],
      }),
    );
    renderEditor(OWNER);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalledTimes(1));
    const btn = await confirmButton();
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    // Đợi số tiền về để bảo đảm không còn yêu cầu quote đang chờ.
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    api.quoteContract.mockResolvedValue(quote([OVERLAP]) as never);
    await userEvent.click(btn);
    expect(await screen.findByText('Trùng lịch: Trần Minh Anh đã có lịch L-0123 06:00–07:30')).toBeTruthy();
    expect(api.updateContract).not.toHaveBeenCalled();
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Trùng giờ 05:00–06:30')).toBeTruthy();
    expect(screen.getByText('Nháp')).toBeTruthy();
  });

  it('400 khi lưu: lỗi hiện ngay dưới ô theo đường dẫn trường', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(
      new ApiError('VALIDATION_FAILED', 'Dữ liệu không hợp lệ', 400, 'r', {
        issues: [{ path: 'depositRequired', message: 'Tiền cọc không được lớn hơn tổng' }],
      }),
    );
    renderEditor(OWNER);
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    await userEvent.clear(screen.getByLabelText('Ghi chú hợp đồng'));
    await userEvent.type(screen.getByLabelText('Ghi chú hợp đồng'), 'Nhà ở ngõ nhỏ');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(await screen.findByText('Tiền cọc không được lớn hơn tổng')).toBeTruthy();
    expect((screen.getByLabelText('Cọc cần thu'))?.getAttribute('aria-invalid')).toBe('true');
  });

  it('403 khi lưu: dải đỏ lời máy chủ, giữ dữ liệu đã nhập', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(new ApiError('FORBIDDEN', 'Bạn không có quyền sửa hợp đồng', 403, 'r'));
    renderEditor(OWNER);
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    await userEvent.type(screen.getByLabelText('Ghi chú hợp đồng'), 'Ghi chú mới');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect((await screen.findByRole('alert', { name: '' })).textContent).toContain('Bạn không có quyền sửa hợp đồng');
    expect(((screen.getByLabelText('Ghi chú hợp đồng')) as HTMLTextAreaElement).value).toBe('Ghi chú mới');
  });
});

describe('dòng phí di chuyển', () => {
  it('đổi sang Tại nhà: hiện hàng Di chuyển bắt buộc; quote chỉ gọi khi đã có km, và thân có travel', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalledTimes(1));
    await userEvent.click(within(card).getByRole('radio', { name: 'Tại nhà' }));
    expect(within(card).getByText('Di chuyển')).toBeTruthy();
    expect(within(card).getByLabelText('bắt buộc')).toBeTruthy();
    // Thiếu km: không gửi quote mới (giữ số cũ, số mờ).
    await new Promise((r) => setTimeout(r, 400));
    expect(api.quoteContract).toHaveBeenCalledTimes(1);
    await userEvent.type(within(card).getByLabelText('Số km một chiều'), '12,35');
    // Máy chậm có thể gọi quote giữa các phím gõ ("1", "12"…): kiểm thân của lần gọi CUỐI.
    await waitFor(() => {
      const body = api.quoteContract.mock.calls.at(-1)?.[1] as unknown as { lines: Record<string, unknown>[] };
      expect(body.lines[0]).toMatchObject({ locationType: 'CUSTOMER_HOME', travel: { mode: 'PER_KM', distanceKm: 12.35 } });
    });
    // Mọi lần gọi sau khi chọn Tại nhà đều có travel (không có lần nào gửi dòng tại nhà thiếu phí di chuyển).
    for (const call of api.quoteContract.mock.calls.slice(1)) {
      expect((call[1] as unknown as { lines: Record<string, unknown>[] }).lines[0]).toHaveProperty('travel');
    }
  });
});

describe('ẩn / khoá theo quyền', () => {
  it('kế toán (chỉ xem): không có Lưu nháp, Xác nhận, Bảng giá; ô bị khoá', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(SYSTEM_ROLES.accountant.permissions);
    await screen.findByRole('heading', { name: 'Lập hợp đồng HĐ-2026-0142' });
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Xác nhận hợp đồng/ })).toBeNull();
    expect(screen.queryByText('Bảng giá')).toBeNull();
    expect((screen.getByLabelText('Giờ bắt đầu') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Đổi khách' })).toBeNull();
  });

  it('đã xác nhận + lễ tân (không có contracts.adjust): có "+ Phát sinh", KHÔNG có "Huỷ dòng"', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    renderEditor(SYSTEM_ROLES.receptionist.permissions);
    expect(await screen.findByText('Dòng đã chốt. Chỉ thêm phát sinh hoặc huỷ dòng kèm lý do.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Phát sinh' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Huỷ dòng' })).toBeNull();
    expect(api.quoteContract).not.toHaveBeenCalled();
  });

  it('đã xác nhận + chủ: "Huỷ dòng" bắt buộc lý do → gọi void', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    api.voidContractLine.mockResolvedValue({ ...detail('CONFIRMED'), adjustments: [] } as never);
    renderEditor(OWNER);
    await userEvent.click(await screen.findByRole('button', { name: 'Huỷ dòng' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Huỷ dòng' }));
    expect(await within(dialog).findByText('Nhập lý do.')).toBeTruthy();
    expect(api.voidContractLine).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), 'Khách đổi ý');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Huỷ dòng' }));
    await waitFor(() => expect(api.voidContractLine).toHaveBeenCalledWith('org-1', 'hd-1', 'l1', { reason: 'Khách đổi ý' }));
  });
});

describe('mở từ màn Khách hàng: /hop-dong/moi?customerId=…', () => {
  const sched = vi.mocked(scheduleApi);

  it('khách thuộc tổ chức → chọn sẵn thẻ khách', async () => {
    sched.getCustomer.mockResolvedValue({
      id: 'c-9',
      fullName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo',
      phone: '0912345678',
      email: 'phuongthao@gmail.com',
      note: null,
      avatarFileId: null,
      avatarUrl: null,
      createdAt: '',
      updatedAt: '',
    });
    renderEditor(OWNER, null, '/studio/hop-dong/moi?customerId=c-9');
    expect(await screen.findByText('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo')).toBeTruthy();
    expect(screen.getByText('0912345678 · phuongthao@gmail.com')).toBeTruthy();
    expect(sched.getCustomer).toHaveBeenCalledWith('org-1', 'c-9', expect.anything());
    expect(screen.queryByLabelText('Tìm khách theo tên hoặc số điện thoại')).toBeNull();
  });

  it('mã lạ / không thuộc tổ chức (404) → bỏ chọn, báo một dòng, vẫn tìm khách được', async () => {
    sched.getCustomer.mockRejectedValue(new ApiError('NOT_FOUND', 'Không tìm thấy khách hàng', 404, 'r'));
    renderEditor(OWNER, null, '/studio/hop-dong/moi?customerId=khong-co');
    expect(await screen.findByText('Không tìm thấy khách này trong tổ chức. Chọn lại khách.')).toBeTruthy();
    expect(screen.getByLabelText('Tìm khách theo tên hoặc số điện thoại')).toBeTruthy();
  });

  it('không có customerId → không gọi máy chủ tìm khách', async () => {
    renderEditor(OWNER, null, '/studio/hop-dong/moi');
    await screen.findByText('Lập hợp đồng mới');
    expect(sched.getCustomer).not.toHaveBeenCalled();
  });
});

describe('liên kết "Thu tiền"', () => {
  it('đã xác nhận + payments.read → /studio/thu-tien/:id', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    renderEditor(OWNER);
    // Một ở đầu thẻ (máy tính, máy tính bảng), một ở hàng hành động điện thoại — CSS chọn cái hiện.
    const links = await screen.findAllByRole('link', { name: 'Thu tiền' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/studio/thu-tien/hd-1', '/studio/thu-tien/hd-1']);
  });

  it('không có payments.read → không hiện', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    renderEditor(OWNER.filter((p) => p !== 'payments.read'));
    await screen.findByText('Dòng đã chốt. Chỉ thêm phát sinh hoặc huỷ dòng kèm lý do.');
    expect(screen.queryByRole('link', { name: 'Thu tiền' })).toBeNull();
  });

  it('hợp đồng nháp → không hiện', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(OWNER);
    await screen.findByRole('heading', { name: 'Lập hợp đồng HĐ-2026-0142' });
    expect(screen.queryByRole('link', { name: 'Thu tiền' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Biên bản nghiệm thu web 2 (thợ T): S1, T1, T2, T4, N1, N6, N7, N8.
describe('biên bản web 2', () => {
  const HOLD = {
    membershipId: 'm2',
    level: 'OVERLAP', // máy chủ gán OVERLAP khi chỉ có giữ chỗ nháp — web không tin mức này
    overlaps: [],
    sameDay: [],
    draftHolds: [
      {
        contractId: 'hd-khac',
        code: 'HĐ-2026-0139',
        lineId: 'lx',
        lineName: 'Mẹ – Trang điểm nhẹ nhàng',
        scheduledStart: '2026-10-23T22:00:00.000Z',
        scheduledEnd: '2026-10-23T22:45:00.000Z',
        overlaps: true,
      },
    ],
  };

  it('T1: giữ chỗ của hợp đồng NHÁP khác → dải xám "Giữ chỗ nháp ở HĐ-…", KHÔNG đỏ, nút Xác nhận bấm được', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([HOLD]) as never);
    renderEditor(OWNER);
    const band = await screen.findByText(/Giữ chỗ nháp ở HĐ-2026-0139/);
    expect(band.closest('[data-muc]')?.getAttribute('data-muc')).toBe('DRAFT_HOLD');
    expect(screen.queryByText(/hợp đồng sẽ không xác nhận được/)).toBeNull();
    expect(((await confirmButton()) as HTMLButtonElement).disabled).toBe(false);
  });

  it('T1 (máy chủ mới, level DRAFT_HOLD, giữ chỗ cùng ngày khác giờ): dải xám "… · cùng ngày, khác giờ", không chặn', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    const sameDayHold = { ...HOLD, level: 'DRAFT_HOLD', draftHolds: [{ ...HOLD.draftHolds[0]!, overlaps: false }] };
    api.quoteContract.mockResolvedValue(quote([sameDayHold]) as never);
    renderEditor(OWNER);
    expect(await screen.findByText(/Giữ chỗ nháp ở HĐ-2026-0139 · cùng ngày, khác giờ/)).toBeTruthy();
    expect(((await confirmButton()) as HTMLButtonElement).disabled).toBe(false);
  });

  it('S1: dòng có giờ chưa có thợ → dòng vàng ở thanh tổng, KHÔNG chặn xác nhận; xác nhận xong báo số lịch máy chủ đã tạo', async () => {
    const noStaff = detail('DRAFT', { lines: [line({ staff: [] })] });
    api.getContract.mockResolvedValue(noStaff as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [line({ id: null, staff: [], staffWarnings: [] })] } as never);
    api.changeContractStatus.mockResolvedValue({
      ...detail('CONFIRMED', { lines: [line({ staff: [] })] }),
      createdAppointments: [{ id: 'a9', code: 'LH-000009', startsAt: '2026-10-23T22:00:00.000Z', status: 'CONFIRMED', contractLineId: 'l1' }],
      cancelledAppointments: [],
    } as never);
    renderEditor(OWNER);
    const bar = await screen.findByRole('region', { name: 'Tổng tiền' });
    const note = await screen.findByText('1 dòng chưa có thợ — lịch sẽ nằm ở hàng Chưa có thợ');
    expect(note.closest('.ct-totbar')?.contains(bar)).toBe(true);
    const btn = await confirmButton();
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    await userEvent.click(btn);
    await waitFor(() => expect(api.changeContractStatus).toHaveBeenCalledWith('org-1', 'hd-1', { to: 'CONFIRMED' }));
    expect(await screen.findByText('Đã xác nhận hợp đồng · đã tạo 1 lịch (1 lịch chưa có thợ — ở hàng Chưa có thợ).')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem lịch' }).getAttribute('href')).toBe('/studio/lich');
  });

  it('T2: Lưu gửi kèm expectedUpdatedAt; 409 STALE_VERSION → dải "vừa được người khác sửa", giữ chữ đang nhập; Tải bản mới → so khác biệt, dùng lại được bản của mình', async () => {
    const v1 = detail('DRAFT', { updatedAt: '2026-10-18T10:00:00.000Z' });
    const v2 = detail('DRAFT', { updatedAt: '2026-10-18T10:05:00.000Z', discount: 100_000, total: 500_000 });
    api.getContract.mockResolvedValueOnce(v1 as never).mockResolvedValueOnce(v2 as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(
      new ApiError('CONFLICT', 'Hợp đồng vừa được người khác sửa — tải lại để xem bản mới', 409, 'r', {
        reason: 'STALE_VERSION',
        currentUpdatedAt: '2026-10-18T10:05:00.000Z',
        expectedUpdatedAt: '2026-10-18T10:00:00.000Z',
      }),
    );
    renderEditor(OWNER);
    const discount = await screen.findByLabelText('Giảm giá');
    await userEvent.type(discount, '150000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(api.updateContract).toHaveBeenCalledTimes(1));
    expect(api.updateContract.mock.calls[0]?.[2]).toMatchObject({ expectedUpdatedAt: '2026-10-18T10:00:00.000Z', discount: 150_000 });
    expect(await screen.findByText('Hợp đồng vừa được người khác sửa.')).toBeTruthy();
    // Không đè im lặng: ô vẫn giữ số đang nhập.
    expect((screen.getByLabelText('Giảm giá') as HTMLInputElement).value).toContain('150.000');
    await userEvent.click(screen.getByRole('button', { name: 'Tải bản mới' }));
    expect(await screen.findByText('Giảm giá: bản của bạn 150.000 ₫ · bản mới 100.000 ₫')).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText('Giảm giá') as HTMLInputElement).value).toContain('100.000'));
    await userEvent.click(screen.getByRole('button', { name: 'Dùng lại bản của tôi' }));
    await waitFor(() => expect((screen.getByLabelText('Giảm giá') as HTMLInputElement).value).toContain('150.000'));
    // Lần lưu sau dùng phiên bản MỚI (người dùng chủ ý ghi bản của mình lên bản mới).
    api.updateContract.mockResolvedValue({ ...v2, discount: 150_000, updatedAt: '2026-10-18T10:06:00.000Z' } as never);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(api.updateContract.mock.calls.at(-1)?.[2]).toMatchObject({ expectedUpdatedAt: '2026-10-18T10:05:00.000Z' }));
  });

  it('resetKey: ô Giảm giá đang lỗi "-5", tải bản mới (cùng số 0) → ô hết lỗi', async () => {
    const v1 = detail('DRAFT', { updatedAt: '2026-10-18T10:00:00.000Z' });
    api.getContract.mockResolvedValue(v1 as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(new ApiError('CONFLICT', 'x', 409, 'r', { reason: 'STALE_VERSION' }));
    renderEditor(OWNER);
    await userEvent.type(await screen.findByLabelText('Ghi chú hợp đồng'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await screen.findByText('Hợp đồng vừa được người khác sửa.');
    await userEvent.type(screen.getByLabelText('Giảm giá'), '-5');
    expect(await screen.findByText('Số tiền không được âm.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tải bản mới' }));
    await screen.findByText('Đã tải bản mới.', { exact: false });
    await waitFor(() => expect(screen.queryByText('Số tiền không được âm.')).toBeNull());
  });

  it('N6: hợp đồng mới với khách mới — lưu xong khối khách thành thẻ (không còn ô nhập), có liên kết sửa ở hồ sơ khách', async () => {
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.createContract.mockResolvedValue(detail('DRAFT', { customer: { id: 'c-moi', fullName: 'Lê Thu Trang', phone: null, email: null } }) as never);
    renderEditor(OWNER, null, '/studio/hop-dong/moi');
    await userEvent.click(await screen.findByRole('button', { name: 'Khách mới' }));
    await userEvent.type(screen.getByLabelText('Họ tên khách'), 'Lê Thu Trang');
    // Thêm gói từ bảng giá (cột trái).
    await userEvent.click((await screen.findAllByRole('button', { name: 'Thêm Mẹ – Trang điểm nhẹ nhàng' }))[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(api.createContract).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText('Họ tên khách')).toBeNull());
    expect(screen.getByText('Lê Thu Trang')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sửa ở hồ sơ khách' }).getAttribute('href')).toBe('/studio/khach-hang/c-moi');
  });

  it('N8: lời lỗi giảm giá của máy chủ in tiền Việt dưới ô Giảm giá; thẻ tổng + thanh tổng về "—", không giữ số cũ', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValueOnce(quote([]) as never);
    renderEditor(OWNER);
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    api.quoteContract.mockRejectedValue(new ApiError('VALIDATION_FAILED', 'Giảm giá hợp đồng (99000000) lớn hơn tổng các dòng (600000)', 400, 'r', {}));
    await userEvent.type(screen.getByLabelText('Giảm giá'), '99000000');
    expect(await screen.findByText('Giảm giá hợp đồng (99.000.000 ₫) lớn hơn tổng các dòng (600.000 ₫)')).toBeTruthy();
    expect(screen.queryByText(/99000000/)).toBeNull();
    await waitFor(() => expect(screen.getByText('—', { selector: '[data-o="tong"]' })).toBeTruthy());
    const bar = screen.getByRole('region', { name: 'Tổng tiền' });
    expect(within(bar).queryByText('600.000 ₫')).toBeNull();
  });

  it('N7: giờ kết thúc trước giờ bắt đầu báo NGAY dưới ô (không đợi Lưu); lý do khoá "Chọn thợ" hiện thành chữ', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [line({ staff: [] })] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [line({ id: null, staff: [], staffWarnings: [] })] } as never);
    renderEditor(OWNER);
    const end = await screen.findByLabelText('Giờ kết thúc');
    await userEvent.clear(end);
    await userEvent.type(end, '04:00');
    await userEvent.tab();
    // Lỗi gắn đúng ô giờ kết thúc (aria-invalid + aria-describedby trỏ tới lời lỗi), chưa bấm Lưu.
    await waitFor(() => expect(end.getAttribute('aria-invalid')).toBe('true'));
    const described = (end.getAttribute('aria-describedby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '');
    expect(described).toContain('Giờ kết thúc phải sau giờ bắt đầu.');
    expect(api.updateContract).not.toHaveBeenCalled();
    expect(screen.getByText('Giờ kết thúc phải sau giờ bắt đầu.', { selector: '[data-o="ly-do-khoa-tho"]' })).toBeTruthy();
  });

  it('T4: hợp đồng đã xác nhận + lễ tân → không có nút "Huỷ hợp đồng"; chủ thì có', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    const { unmount } = renderEditor(SYSTEM_ROLES.receptionist.permissions);
    await screen.findByText('Dòng đã chốt. Chỉ thêm phát sinh hoặc huỷ dòng kèm lý do.');
    expect(screen.queryByRole('button', { name: 'Huỷ hợp đồng' })).toBeNull();
    unmount();
    renderEditor(OWNER);
    expect((await screen.findAllByRole('button', { name: 'Huỷ hợp đồng' })).length).toBeGreaterThan(0);
  });

  it('máy chủ mới: quote của hợp đồng đã lưu gửi excludeContractId; dòng hai thợ trùng (sameContract) → đỏ, khoá xác nhận', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    const SAME = {
      membershipId: 'm2',
      level: 'OVERLAP',
      overlaps: [],
      sameDay: [],
      draftHolds: [],
      sameContract: [{ lineId: null, lineIndex: 1, lineName: 'Cô dâu', scheduledStart: '2026-10-23T21:30:00.000Z', scheduledEnd: '2026-10-24T00:00:00.000Z' }],
    };
    api.quoteContract.mockResolvedValue(quote([SAME]) as never);
    renderEditor(OWNER);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    expect(api.quoteContract.mock.calls[0]?.[1]).toMatchObject({ excludeContractId: 'hd-1' });
    expect(await screen.findByText('Trùng giờ 04:30–07:00')).toBeTruthy();
    expect(((await confirmButton()) as HTMLButtonElement).disabled).toBe(true);
  });

  it('hợp đồng mới (chưa lưu): quote KHÔNG gửi excludeContractId', async () => {
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    renderEditor(OWNER, null, '/studio/hop-dong/moi');
    await userEvent.click(await screen.findByRole('button', { name: 'Khách mới' }));
    await userEvent.type(screen.getByLabelText('Họ tên khách'), 'Lê Thu Trang');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Thêm Mẹ – Trang điểm nhẹ nhàng' }))[0]!);
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    expect(api.quoteContract.mock.calls.at(-1)?.[1]).not.toHaveProperty('excludeContractId');
  });

  it('dòng thêm sau xác nhận ghi "Phát sinh {ngày}" theo createdAt', async () => {
    const extra = line({ id: 'l2', kind: 'CUSTOM', name: 'Thêm giờ chờ', packageId: null, staff: [], addedAfterConfirm: true, createdAt: '2026-10-20T03:00:00.000Z', unitPrice: 100_000, lineTotal: 100_000 });
    api.getContract.mockResolvedValue(detail('CONFIRMED', { lines: [line(), extra] }) as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Phát sinh 20/10/2026')).toBeTruthy();
  });

  it('409 TOTAL_BELOW_PAID khi sửa nháp: một dòng báo, tiền định dạng VN', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(new ApiError('CONFLICT', 'x', 409, 'r', { reason: 'TOTAL_BELOW_PAID', paid: 1_000_000, newTotal: 600_000, total: 1_950_000 }));
    renderEditor(OWNER);
    await userEvent.type(await screen.findByLabelText('Ghi chú hợp đồng'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(
      await screen.findByText('Hợp đồng đã thu 1.000.000 ₫ — tổng mới 600.000 ₫ thấp hơn số đã thu. Ghi phiếu hoàn tiền phần chênh trước, hoặc giữ tổng không thấp hơn số đã thu.'),
    ).toBeTruthy();
  });

  it('N1: mã hợp đồng nằm trong một khối không bẻ dòng', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    renderEditor(OWNER);
    const code = await screen.findByText('HĐ-2026-0142', { selector: '.ct-code' });
    expect(code.tagName).toBe('SPAN');
  });
});

// Máy chủ (contracts/routes.ts checkCustomerChange): PATCH hợp đồng NHÁP nhận customerId; 409 CUSTOMER_IN_USE kèm số
// lịch chưa huỷ / thẻ thiết kế; 404 khách không thuộc tổ chức; hợp đồng đã xác nhận → 409.
describe('đổi khách của hợp đồng nháp đã lưu', () => {
  const sched = vi.mocked(scheduleApi);
  const LAN = { id: 'c-2', fullName: 'Nguyễn Thị Lan', phone: '0987654321', email: null, note: null, avatarFileId: null, avatarUrl: null, createdAt: '', updatedAt: '' };

  async function pickLan() {
    sched.listCustomers.mockResolvedValue({ items: [LAN], page: 1, pageSize: 8, total: 1 } as never);
    await userEvent.click(await screen.findByRole('button', { name: 'Đổi khách' }));
    await userEvent.type(screen.getByLabelText('Tìm khách theo tên hoặc số điện thoại'), 'Lan');
    await userEvent.click(await screen.findByRole('option', { name: /Nguyễn Thị Lan/ }));
  }

  it('nút "Đổi" gửi PATCH CHỈ customerId kèm expectedUpdatedAt; xong hiện thẻ khách mới, không đụng phần đang sửa dở', async () => {
    const v1 = detail('DRAFT', { updatedAt: '2026-10-18T10:00:00.000Z' });
    api.getContract.mockResolvedValue(v1 as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockResolvedValue({ ...v1, updatedAt: '2026-10-18T10:01:00.000Z', customer: { id: 'c-2', fullName: 'Nguyễn Thị Lan', phone: '0987654321', email: null } } as never);
    renderEditor(OWNER);
    // Sửa dở ghi chú (chưa lưu) — đổi khách không được gửi kèm, ghi chú vẫn là "chưa lưu".
    await userEvent.type(await screen.findByLabelText('Ghi chú hợp đồng'), 'Đến sớm');
    await pickLan();
    await waitFor(() => expect(api.updateContract).toHaveBeenCalledTimes(1));
    expect(api.updateContract.mock.calls[0]?.[2]).toEqual({ customerId: 'c-2', expectedUpdatedAt: '2026-10-18T10:00:00.000Z' });
    expect(await screen.findByText('Đã đổi sang Nguyễn Thị Lan — đã lưu vào hợp đồng.')).toBeTruthy();
    expect(screen.getByText('0987654321')).toBeTruthy();
    expect(screen.queryByLabelText('Tìm khách theo tên hoặc số điện thoại')).toBeNull();
    expect((screen.getByLabelText('Ghi chú hợp đồng') as HTMLTextAreaElement).value).toBe('Đến sớm');
    expect(screen.getByRole('link', { name: 'Sửa ở hồ sơ khách' }).getAttribute('href')).toBe('/studio/khach-hang/c-2');
    // Lưu nháp sau đó dùng phiên bản MỚI (sau lần đổi khách).
    api.updateContract.mockResolvedValue({ ...v1, updatedAt: '2026-10-18T10:02:00.000Z' } as never);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(api.updateContract.mock.calls.at(-1)?.[2]).toMatchObject({ expectedUpdatedAt: '2026-10-18T10:01:00.000Z', notes: 'Đến sớm' }));
    expect(api.updateContract.mock.calls.at(-1)?.[2]).not.toHaveProperty('customerId');
  });

  it('409 CUSTOMER_IN_USE → lời báo rõ số lịch / thẻ thiết kế; vẫn giữ khách cũ; "Giữ khách hiện tại" quay về thẻ cũ', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(
      new ApiError('CONFLICT', 'Hợp đồng đã có lịch hoặc thẻ thiết kế mang tên khách hiện tại — huỷ lịch / xoá thẻ trước khi đổi khách', 409, 'r', {
        reason: 'CUSTOMER_IN_USE',
        appointments: 2,
        designCards: 1,
      }),
    );
    renderEditor(OWNER);
    await pickLan();
    expect(
      await screen.findByText('Chưa đổi được khách: hợp đồng đã có 2 lịch và 1 thẻ thiết kế mang tên khách hiện tại. Muốn đổi, huỷ lịch và xoá thẻ thiết kế trước.'),
    ).toBeTruthy();
    expect(screen.queryByText('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Giữ khách hiện tại' }));
    expect(screen.getByText('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo')).toBeTruthy();
    expect(screen.queryByText(/Chưa đổi được khách/)).toBeNull();
  });

  it('404 (khách không thuộc tổ chức) → báo chọn lại khách', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(new ApiError('NOT_FOUND', 'Không tìm thấy khách hàng', 404, 'r'));
    renderEditor(OWNER);
    await pickLan();
    expect(await screen.findByText('Không tìm thấy khách này trong tổ chức. Chọn lại khách.')).toBeTruthy();
  });

  it('hợp đồng đã xác nhận: không bày nút "Đổi" (máy chủ không cho đổi khách)', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    renderEditor(OWNER);
    await screen.findByText('Dòng đã chốt. Chỉ thêm phát sinh hoặc huỷ dòng kèm lý do.');
    expect(screen.queryByRole('button', { name: 'Đổi khách' })).toBeNull();
    expect(screen.getByText('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
describe('biên bản nghiệm thu cuối', () => {
  const NO_TIME = detail('DRAFT', { lines: [line({ scheduledStart: null, scheduledEnd: null, staff: [] })] });
  const noTimeQuote = { ...quote([]), lines: [line({ id: null, scheduledStart: null, scheduledEnd: null, staff: [], staffWarnings: [] })] };

  it('N2: dòng chưa có giờ → khoá "Xác nhận hợp đồng", lý do ở tooltip; dải đỏ kể đúng dòng, bấm tên dòng cuộn tới ô giờ', async () => {
    const scroll = vi.fn();
    const before = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    onTestFinished(() => {
      Element.prototype.scrollIntoView = before;
    });
    api.getContract.mockResolvedValue(NO_TIME as never);
    api.quoteContract.mockResolvedValue(noTimeQuote as never);
    renderEditor(OWNER);
    const reason =
      'Còn 1 dòng chưa có giờ (Dòng 1 · Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng). Nhập giờ bắt đầu và giờ kết thúc rồi mới xác nhận được — hợp đồng đã chốt phải có lịch.';
    const btn = await screen.findByRole('button', { name: `Xác nhận hợp đồng — ${reason}` });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    const band = document.querySelector('[data-o="thieu-gio"]') as HTMLElement;
    expect(band.textContent).toContain('1 dòng chưa có giờ — nhập giờ mới xác nhận được:');
    const go = within(band).getByRole('button', { name: 'Dòng 1 · Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng' });
    expect(go.getAttribute('title')).toBe('Cuộn tới dòng này để nhập giờ');
    await userEvent.click(go);
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    const start = screen.getByLabelText('Giờ bắt đầu');
    await waitFor(() => expect(document.activeElement).toBe(start));
    expect(api.changeContractStatus).not.toHaveBeenCalled();

    // Nhập đủ giờ → hết dải đỏ, nút bấm được.
    await userEvent.type(start, '05:00');
    await userEvent.type(screen.getByLabelText('Giờ kết thúc'), '06:00');
    await waitFor(() => expect(document.querySelector('[data-o="thieu-gio"]')).toBeNull());
    await waitFor(async () => expect(((await confirmButton()) as HTMLButtonElement).disabled).toBe(false));
  });

  it('N2: máy chủ vẫn chặn (409 LINES_MISSING_TIME — bản trên máy chủ đã khác) → dải đỏ kể dòng, đánh dấu thẻ dòng, mời tải bản mới', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.changeContractStatus.mockRejectedValue(
      new ApiError('CONFLICT', 'Dòng "Mẹ – Trang điểm nhẹ nhàng — Mẹ cô dâu" chưa có giờ bắt đầu và giờ kết thúc', 409, 'r', {
        reason: 'LINES_MISSING_TIME',
        lineIds: ['l1'],
        lines: [{ id: 'l1', name: 'Mẹ – Trang điểm nhẹ nhàng', subjectName: 'Mẹ cô dâu', missing: ['scheduledStart', 'scheduledEnd'] }],
      }),
    );
    renderEditor(OWNER);
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    const btn = await confirmButton();
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(btn);
    await waitFor(() => expect(api.changeContractStatus).toHaveBeenCalled());
    expect(
      await screen.findByText(
        'Chưa xác nhận được: trên máy chủ còn 1 dòng chưa có giờ (Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng: chưa có giờ bắt đầu và giờ kết thúc) — hợp đồng có thể vừa được sửa ở máy khác. Tải bản mới, nhập giờ cho dòng đó rồi xác nhận lại.',
      ),
    ).toBeTruthy();
    const card = document.querySelector('[data-dong="0"]') as HTMLElement;
    expect(within(card).getByRole('alert').textContent).toBe('Dòng này chưa có giờ bắt đầu và giờ kết thúc — nhập giờ rồi xác nhận lại.');
    expect(screen.getByRole('button', { name: 'Tải bản mới' })).toBeTruthy();
  });

  it('L1: gõ giờ bắt đầu → giờ kết thúc tự điền theo thời lượng gói; giờ kết thúc tự gõ thì giữ nguyên', async () => {
    vi.mocked(catalogApi).listPackages.mockImplementationOnce(async () => ({ items: [{ ...PKG_ME, durationMinutes: 120 }], page: 1, pageSize: 100, total: 1 }) as never);
    api.getContract.mockResolvedValue(NO_TIME as never);
    api.quoteContract.mockResolvedValue(noTimeQuote as never);
    renderEditor(OWNER);
    const start = await screen.findByLabelText('Giờ bắt đầu');
    await screen.findByText(/thời lượng gói \(120 phút\)/);
    const end = screen.getByLabelText('Giờ kết thúc') as HTMLInputElement;
    await userEvent.type(start, '05:00');
    await waitFor(() => expect(end.value).toBe('07:00'));
    // Đổi giờ bắt đầu khi kết thúc vẫn là giờ tự điền → đi theo.
    await userEvent.clear(start);
    await userEvent.type(start, '06:30');
    await waitFor(() => expect(end.value).toBe('08:30'));
    // Người dùng tự gõ giờ kết thúc → đổi giờ bắt đầu không ghi đè.
    await userEvent.clear(end);
    await userEvent.type(end, '10:15');
    await userEvent.clear(start);
    await userEvent.type(start, '07:00');
    await waitFor(() => expect((screen.getByLabelText('Giờ bắt đầu') as HTMLInputElement).value).toBe('07:00'));
    expect(end.value).toBe('10:15');
  });
});

describe('biên bản nghiệm thu lại', () => {
  const PKG_CD = {
    ...PKG_ME,
    id: 'p-cd',
    code: 'CD',
    name: 'Cô dâu – Ngày cưới',
    subjectId: 's-cd',
    currentPrice: { ...PKG_ME.currentPrice, unitPrice: 2_000_000, listPrice: 2_000_000 },
  };
  const SUBJECTS_ME_HIDDEN = [
    { id: 's-me', name: 'Mẹ cô dâu', sortOrder: 1, isActive: false },
    { id: 's-cd', name: 'Cô dâu', sortOrder: 0, isActive: true },
  ];
  const lineCd = (over: Record<string, unknown> = {}) =>
    line({ id: 'l2', packageId: 'p-cd', name: 'Cô dâu – Ngày cưới', subjectId: 's-cd', subjectName: 'Cô dâu', unitPrice: 2_000_000, lineTotal: 2_000_000, staff: [], ...over });
  const catalogMeHidden = () => {
    vi.mocked(catalogApi).listPackages.mockImplementationOnce(async () => ({ items: [PKG_ME, PKG_CD], page: 1, pageSize: 100, total: 2 }) as never);
    vi.mocked(catalogApi).listMakeupSubjects.mockImplementationOnce(async () => ({ items: SUBJECTS_ME_HIDDEN }) as never);
  };

  it('M1: nhân vật đang ẩn → cột Bảng giá KHÔNG bày gói của nhân vật đó (và không có chip lọc), báo số gói bị ẩn kèm "?"', async () => {
    catalogMeHidden();
    renderEditor(OWNER, null, '/studio/hop-dong/moi');
    expect(await screen.findByRole('button', { name: 'Thêm Cô dâu – Ngày cưới' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm Mẹ – Trang điểm nhẹ nhàng' })).toBeNull();
    expect(screen.queryByText('Mẹ – Trang điểm nhẹ nhàng')).toBeNull();
    const chips = screen.getByRole('group', { name: 'Lọc theo nhân vật' });
    expect(within(chips).queryByText('Mẹ cô dâu')).toBeNull();
    const note = document.querySelector('[data-o="goi-nhan-vat-an"]') as HTMLElement;
    expect(note.textContent).toContain('1 gói của nhân vật đang ẩn (Mẹ cô dâu) không hiện ở đây.');
    expect(within(note).getByRole('button', { name: 'Vì sao có gói không hiện' })).toBeTruthy();
  });

  it('M1: nháp ĐÃ có dòng của nhân vật vừa bị ẩn → lời báo ngay ở dòng đó; dòng khác vẫn có tiền; Tổng "—" có lý do; không lưu, không xác nhận', async () => {
    catalogMeHidden();
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [line({ staff: [] }), lineCd()] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [lineCd({ id: null, staffWarnings: [] })], subtotal: 2_000_000, total: 2_000_000 } as never);
    renderEditor(OWNER);
    const hiddenCard = await screen.findByRole('region', { name: 'Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng' });
    expect(hiddenCard.getAttribute('data-dong')).toBe('0');
    expect((await within(hiddenCard).findByRole('alert')).textContent).toBe(
      'Nhân vật "Mẹ cô dâu" đang ẩn ở Bảng giá → Nhân vật nên dòng này chưa tính được tiền và hợp đồng chưa lưu được. Bật lại nhân vật hoặc bỏ dòng này.',
    );
    // Bảng tính chỉ gửi dòng còn tính được; dòng Cô dâu vẫn có tiền.
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    const body = api.quoteContract.mock.calls.at(-1)![1] as { lines: { packageId?: string }[] };
    expect(body.lines.map((l) => l.packageId)).toEqual(['p-cd']);
    const cdCard = document.querySelector('[data-dong="1"]') as HTMLElement;
    expect(await within(cdCard).findByText('2.000.000 ₫', { selector: '.ct-ln__ft b' })).toBeTruthy();
    // Tạm tính / Tổng "—" (thiếu một dòng thì không phải tổng thật) — lý do kể đúng dòng ở thanh tổng.
    expect(screen.getByText('—', { selector: '[data-o="tong"]' })).toBeTruthy();
    expect(screen.getByText('—', { selector: '[data-o="tam-tinh"]' })).toBeTruthy();
    const band = document.querySelector('[data-o="nhan-vat-an"]') as HTMLElement;
    expect(band.textContent).toContain('Chưa tính được tổng — 1 dòng dùng nhân vật đang ẩn:');
    expect(within(band).getByRole('button', { name: 'Dòng 1 · Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng' })).toBeTruthy();
    const confirm = await confirmButton();
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.getAttribute('aria-label')).toContain('dòng dùng nhân vật đang ẩn');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(api.updateContract).not.toHaveBeenCalled();
    // Bỏ dòng → hết báo, tổng tính lại đủ.
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [lineCd({ id: null, staffWarnings: [] })], subtotal: 2_000_000, total: 2_000_000 } as never);
    await userEvent.click(within(hiddenCard).getByRole('button', { name: 'Bỏ dòng Mẹ – Trang điểm nhẹ nhàng' }));
    await waitFor(() => expect(document.querySelector('[data-o="nhan-vat-an"]')).toBeNull());
    expect(await screen.findByText('2.000.000 ₫', { selector: '[data-o="tong"]' })).toBeTruthy();
  });

  it('M5: một dòng có giờ bắt đầu mà giờ kết thúc trống → mọi dòng khác và Tạm tính / Tổng vẫn có tiền; báo ngay dưới ô giờ kết thúc của đúng dòng', async () => {
    const two = detail('DRAFT', { lines: [line(), lineCd({ staff: [MINH_ANH] })] });
    vi.mocked(catalogApi).listPackages.mockImplementationOnce(async () => ({ items: [PKG_ME, PKG_CD], page: 1, pageSize: 100, total: 2 }) as never);
    api.getContract.mockResolvedValue(two as never);
    api.quoteContract.mockResolvedValue({
      ...quote([]),
      lines: [line({ id: null, staffWarnings: [] }), lineCd({ id: null, staffWarnings: [] })],
      subtotal: 2_600_000,
      total: 2_600_000,
    } as never);
    renderEditor(OWNER);
    expect(await screen.findByText('2.600.000 ₫', { selector: '[data-o="tong"]' })).toBeTruthy();
    const card2 = document.querySelector('[data-dong="1"]') as HTMLElement;
    const end2 = within(card2).getByLabelText('Giờ kết thúc');
    api.quoteContract.mockClear();
    await userEvent.clear(end2);
    await userEvent.tab();
    // Bảng tính VẪN được gọi; dòng thiếu giờ gửi không kèm giờ và thợ (máy chủ đòi giờ khi có thợ).
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    const body = api.quoteContract.mock.calls.at(-1)![1] as unknown as { lines: Record<string, unknown>[] };
    expect(body.lines).toHaveLength(2);
    expect(body.lines[0]).toHaveProperty('scheduledStart');
    expect(body.lines[0]).toHaveProperty('staff');
    expect(body.lines[1]).not.toHaveProperty('scheduledStart');
    expect(body.lines[1]).not.toHaveProperty('scheduledEnd');
    expect(body.lines[1]).not.toHaveProperty('staff');
    // Tiền vẫn hiện ở mọi dòng và ở thẻ tổng / thanh tổng.
    await waitFor(() => expect(screen.queryByText('—', { selector: '[data-o="tong"]' })).toBeNull());
    expect(screen.getByText('2.600.000 ₫', { selector: '[data-o="tong"]' })).toBeTruthy();
    expect(within(document.querySelector('[data-dong="0"]') as HTMLElement).getByText('600.000 ₫', { selector: '.ct-ln__ft b' })).toBeTruthy();
    expect(within(card2).getByText('2.000.000 ₫', { selector: '.ct-ln__ft b' })).toBeTruthy();
    // Lời báo ở đúng ô (giờ kết thúc dòng 2), chưa bấm Lưu; ô của dòng 1 không bị đánh dấu.
    await waitFor(() => expect(end2.getAttribute('aria-invalid')).toBe('true'));
    const described = (end2.getAttribute('aria-describedby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '');
    expect(described).toContain('Nhập đủ giờ bắt đầu và kết thúc.');
    expect(within(document.querySelector('[data-dong="0"]') as HTMLElement).getByLabelText('Giờ kết thúc').getAttribute('aria-invalid')).toBeNull();
  });
});

describe('N2 ở cửa thêm phát sinh (hợp đồng đã xác nhận)', () => {
  const CATALOG = {
    packages: [PKG_ME],
    surcharges: [],
    subjects: [{ id: 's-me', name: 'Mẹ cô dâu', sortOrder: 1, isActive: true }],
    studios: [{ id: 'st-1', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt', isDefault: true, isActive: true }],
    policy: { defaultMode: 'PER_KM', fixedAmount: 150_000, perKmAmount: 10_000, freeKm: 1.5, minimumAmount: 0, roundTrip: true, tiers: [], updatedAt: '' },
    occasions: OCCASIONS,
    rules: RULES,
  };
  const renderDialog = (det: unknown = detail('CONFIRMED')) =>
    render(
      <ExtraPackageDialog
        pkg={PKG_ME as never}
        orgId="org-1"
        tz={TZ}
        detail={det as never}
        catalog={CATALOG as never}
        canPickStaff
        staffRoster={[]}
        phone={false}
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );

  it('chưa có giờ → không gửi, báo ngay dưới ô giờ bắt đầu và kết thúc', async () => {
    api.quoteContract.mockResolvedValue(noTimeQuoteFor() as never);
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm phát sinh' }));
    expect(await screen.findByText('Nhập giờ bắt đầu.')).toBeTruthy();
    expect(screen.getByText('Nhập giờ kết thúc.')).toBeTruthy();
    expect(screen.getByText('Dòng phát sinh phải có giờ bắt đầu và giờ kết thúc để lên lịch.').getAttribute('role')).toBe('alert');
    expect(api.addContractLine).not.toHaveBeenCalled();
  });

  it('máy chủ trả 409 LINES_MISSING_TIME (dòng vừa thêm bị quay lui) → đánh dấu đúng ô giờ thiếu của dòng đang thêm', async () => {
    api.quoteContract.mockResolvedValue(noTimeQuoteFor() as never);
    api.addContractLine.mockRejectedValue(
      new ApiError('CONFLICT', 'Dòng "Mẹ – Trang điểm nhẹ nhàng" chưa có giờ kết thúc', 409, 'r', {
        reason: 'LINES_MISSING_TIME',
        lineIds: ['l-new'],
        lines: [{ id: 'l-new', name: 'Mẹ – Trang điểm nhẹ nhàng', subjectName: 'Mẹ cô dâu', missing: ['scheduledEnd'] }],
      }),
    );
    renderDialog();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Giờ bắt đầu' }), '05:00');
    await userEvent.type(screen.getByRole('textbox', { name: 'Giờ kết thúc' }), '06:00');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm phát sinh' }));
    await waitFor(() => expect(api.addContractLine).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Chưa thêm được: Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng: chưa có giờ kết thúc. Dòng phát sinh phải có giờ để lên lịch — nhập giờ rồi thêm lại.')).toBeTruthy();
    const end = screen.getByRole('textbox', { name: 'Giờ kết thúc' });
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Nhập giờ kết thúc.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Giờ bắt đầu' }).getAttribute('aria-invalid')).toBeNull();
  });
  // R2: hộp thêm phát sinh dùng sổ thợ của màn hợp đồng (staffRoster) — không chỉ những người vừa chọn trong hộp.
  it('BẮT (R2): chọn "Phạm Thu Hà" trong hộp phát sinh khi tổ chức còn "Nguyễn Thu Hà" → hàng thợ ghi "Phạm Thu Hà"', async () => {
    const HA_P = { membershipId: 'm-pha', displayName: 'Phạm Thu Hà', fullName: 'Phạm Thu Hà', avatarUrl: null, initials: 'PH', tier: null };
    const HA_N = { membershipId: 'm-ngha', displayName: 'Nguyễn Thu Hà', fullName: 'Nguyễn Thu Hà', avatarUrl: null, initials: 'NH', tier: null };
    const asMember = (x: typeof HA_P) => ({ ...x, userId: `u-${x.membershipId}`, phone: null, isBookable: true, hasProfile: true, status: 'ACTIVE', roleKeys: ['artist'] });
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [asMember(HA_P), asMember(HA_N)] } as never);
    vi.mocked(staffApi.getStaffAvailability).mockResolvedValue({
      startsAt: '', endsAt: '', dayStart: '', dayEnd: '', timezone: TZ,
      items: [{ ...HA_P, isBookable: true, level: 'FREE', overlaps: [], sameDay: [], draftHolds: [] }],
    } as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [line({ id: null, staff: [], staffWarnings: [] })] } as never);
    render(
      <ExtraPackageDialog
        pkg={PKG_ME as never}
        orgId="org-1"
        tz={TZ}
        detail={detail('CONFIRMED') as never}
        catalog={CATALOG as never}
        canPickStaff
        staffRoster={[HA_P, HA_N]}
        phone={false}
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );
    await userEvent.type(await screen.findByRole('textbox', { name: 'Giờ bắt đầu' }), '05:00');
    await userEvent.type(screen.getByRole('textbox', { name: 'Giờ kết thúc' }), '06:00');
    await userEvent.click(screen.getByRole('button', { name: 'Chọn thợ' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Phạm Thu Hà' }));
    await userEvent.click(screen.getByRole('button', { name: 'Chọn' }));
    await waitFor(() => expect(document.querySelector('.ct-tn')?.textContent).toBe('Phạm Thu Hà'));
  });
});


function noTimeQuoteFor() {
  return { ...quote([]), lines: [line({ id: null, scheduledStart: null, scheduledEnd: null, staff: [], staffWarnings: [] })] };
}

// ---------------------------------------------------------------------------------------------------------------------
// Biên bản nghiệm thu lần 3 — R2: hợp đồng dùng CHUNG luật trùng tên với Lịch (sổ thợ = danh sách thợ của tổ chức ∪
// thợ của các dòng); R4: cùng chữ tắt → khác màu, cùng màu với Lịch (cùng hàm ui/staffName.ts staffNaming).
describe('R2/R4: trùng tên ngắn và trùng chữ tắt ở hợp đồng', () => {
  const HA_P = { membershipId: 'm-pha', role: 'PRIMARY', displayName: 'Phạm Thu Hà', fullName: 'Phạm Thu Hà', avatarUrl: null, initials: 'PH', tier: null };
  const HA_N = { membershipId: 'm-ngha', role: 'ASSIST', displayName: 'Nguyễn Thu Hà', fullName: 'Nguyễn Thu Hà', avatarUrl: null, initials: 'NH', tier: null };
  const asMember = (s: typeof HA_P) => ({ ...s, userId: `u-${s.membershipId}`, phone: null, isBookable: true, hasProfile: true, status: 'ACTIVE', roleKeys: ['artist'] });

  it('BẮT: hai thợ "… Thu Hà" trên một dòng → hàng thợ "Phạm Thu Hà (chính), Nguyễn Thu Hà"; dải vàng ghi "Nguyễn Thu Hà có lịch…"', async () => {
    const two = (over: Record<string, unknown> = {}) => line({ staff: [HA_P, HA_N], ...over });
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [two()] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [two({ id: null, staffWarnings: [{ ...SAME_DAY, membershipId: 'm-ngha' }] })] } as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Nguyễn Thu Hà có lịch trong ngày · 1 ca')).toBeTruthy();
    expect(document.querySelector('.ct-tn')?.textContent).toBe('Phạm Thu Hà (chính), Nguyễn Thu Hà');
    expect(screen.queryByText(/^Hà có lịch/)).toBeNull();
  });

  it('BẮT: dòng chỉ có "Phạm Thu Hà" nhưng tổ chức còn "Nguyễn Thu Hà" (GET /staff) → "Phạm Thu Hà", đúng như Lịch', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [asMember(HA_P), asMember(HA_N)] } as never);
    const one = (over: Record<string, unknown> = {}) => line({ staff: [HA_P], ...over });
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [one()] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [one({ id: null, staffWarnings: [{ ...SAME_DAY, membershipId: 'm-pha' }] })] } as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Phạm Thu Hà có lịch trong ngày · 1 ca')).toBeTruthy();
    expect(document.querySelector('.ct-tn')?.textContent).toBe('Phạm Thu Hà');
  });

  it('GIỮ: tổ chức chỉ có một "Hà" → hàng thợ và dải vàng ghi "Hà"', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [asMember(HA_P)] } as never);
    const one = (over: Record<string, unknown> = {}) => line({ staff: [HA_P], ...over });
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [one()] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [one({ id: null, staffWarnings: [{ ...SAME_DAY, membershipId: 'm-pha' }] })] } as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Hà có lịch trong ngày · 1 ca')).toBeTruthy();
    expect(document.querySelector('.ct-tn')?.textContent).toBe('Hà');
  });

  it('BẮT (R4): "Linh Trần" + "Lê Minh Tú" (cùng LT, cùng màu băm) → hai ảnh khác màu, đúng màu sổ thợ như Lịch', async () => {
    let tuId = 'm-0';
    for (let i = 0; avatarColorIndex(tuId) !== avatarColorIndex('m7'); i += 1) tuId = `m-${i}`;
    const TU = { membershipId: tuId, role: 'ASSIST', displayName: 'Lê Minh Tú', fullName: 'Lê Minh Tú', avatarUrl: null, initials: 'LT', tier: null };
    const two = (over: Record<string, unknown> = {}) => line({ staff: [LINH, TU], ...over });
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [two()] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [two({ id: null })] } as never);
    renderEditor(OWNER);
    await waitFor(() => expect(document.querySelectorAll('.ct-avs .ui-av').length).toBe(2));
    const tones = [...document.querySelectorAll('.ct-avs .ui-av')].map((e) => (e as HTMLElement).style.background);
    const want = staffNaming([LINH, TU]);
    expect(tones[0]).not.toBe(tones[1]);
    expect(tones).toEqual([`var(--av-${avatarColorIndex(want.colorKey('m7'))})`, `var(--av-${avatarColorIndex(want.colorKey(tuId))})`]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Biên bản nghiệm thu lần 4.
// N2: điện thoại — hộp "Thêm phát sinh" (Dialog) mở ô chọn thợ (BottomSheet); ô chọn thợ phải nằm TRÊN hộp.
// Trước khi sửa: .ui-overlay z-index 50 > .ui-sheet-overlay z-index 40 → ngăn kéo mở sau nằm dưới, bấm "Chọn thợ" như chết.
// Cách đo (jsdom không vẽ): các lớp phủ đều là con trực tiếp của <body>, position: fixed + z-index đọc từ ui/ui.css →
// lớp trên cùng = z-index lớn nhất, bằng nhau thì phần tử sau trong DOM (đúng luật xếp lớp của trình duyệt).
function overlayZ(): Record<'ui-overlay' | 'ui-sheet-overlay', number> {
  // Dự án "dom" (jsdom) không cho import.meta.url dạng file: → tìm theo thư mục chạy (apps/web hoặc gốc kho).
  const file = [join(process.cwd(), 'src/ui/ui.css'), join(process.cwd(), 'apps/web/src/ui/ui.css')].find((f) => existsSync(f));
  if (!file) throw new Error('Không tìm thấy ui/ui.css');
  const css = readFileSync(file, 'utf8');
  const z = (cls: string) => Number(new RegExp(`\\.${cls}\\s*\\{[^}]*?z-index:\\s*(\\d+)`).exec(css)?.[1] ?? Number.NaN);
  return { 'ui-overlay': z('ui-overlay'), 'ui-sheet-overlay': z('ui-sheet-overlay') };
}
export function topOverlay(): Element | null {
  const z = overlayZ();
  let top: Element | null = null;
  let topZ = -Infinity;
  for (const el of Array.from(document.body.children)) {
    const cls = el.classList.contains('ui-sheet-overlay') ? 'ui-sheet-overlay' : el.classList.contains('ui-overlay') ? 'ui-overlay' : null;
    if (!cls) continue;
    expect(Number.isFinite(z[cls]), `z-index của .${cls} trong ui.css`).toBe(true);
    if (z[cls] >= topZ) {
      top = el;
      topZ = z[cls];
    }
  }
  return top;
}

describe('Lần 4 — N2/L3: hộp "Thêm phát sinh" chọn thợ', () => {
  const CATALOG = {
    packages: [PKG_ME],
    surcharges: [],
    subjects: [{ id: 's-me', name: 'Mẹ cô dâu', sortOrder: 1, isActive: true }],
    studios: [{ id: 'st-1', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt', isDefault: true, isActive: true }],
    policy: { defaultMode: 'PER_KM', fixedAmount: 150_000, perKmAmount: 10_000, freeKm: 1.5, minimumAmount: 0, roundTrip: true, tiers: [], updatedAt: '' },
  };
  const HA_P = { membershipId: 'm-pha', displayName: 'Phạm Thu Hà', fullName: 'Phạm Thu Hà', avatarUrl: null, initials: 'PH', tier: null };
  const HA_N = { membershipId: 'm-ngha', displayName: 'Nguyễn Thu Hà', fullName: 'Nguyễn Thu Hà', avatarUrl: null, initials: 'NH', tier: null };
  const avail = (x: typeof HA_P) => ({ ...x, isBookable: true, level: 'FREE', overlaps: [], sameDay: [], draftHolds: [] });

  const asMember = (x: typeof HA_P) => ({ ...x, userId: `u-${x.membershipId}`, phone: null, isBookable: true, hasProfile: true, status: 'ACTIVE', roleKeys: ['artist'] });
  async function openPicker(phone: boolean) {
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [asMember(HA_P), asMember(HA_N)] } as never);
    vi.mocked(staffApi.getStaffAvailability).mockResolvedValue({ startsAt: '', endsAt: '', dayStart: '', dayEnd: '', timezone: TZ, items: [avail(HA_P), avail(HA_N)] } as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [line({ id: null, staff: [], staffWarnings: [] })] } as never);
    render(
      <ExtraPackageDialog
        pkg={PKG_ME as never}
        orgId="org-1"
        tz={TZ}
        detail={detail('CONFIRMED') as never}
        catalog={CATALOG as never}
        canPickStaff
        staffRoster={[HA_P, HA_N]}
        phone={phone}
        onClose={() => {}}
        onAdded={() => {}}
      />,
    );
    await userEvent.type(await screen.findByRole('textbox', { name: 'Giờ bắt đầu' }), '15:00');
    await userEvent.type(screen.getByRole('textbox', { name: 'Giờ kết thúc' }), '16:00');
    await userEvent.click(screen.getByRole('button', { name: 'Chọn thợ' }));
    return screen.findByRole('dialog', { name: /Chọn thợ phụ trách/ });
  }

  it('BẮT (N2, 390): bấm "Chọn thợ" trong hộp phát sinh → ngăn kéo chọn thợ nằm TRÊN hộp phát sinh', async () => {
    const sheet = await openPicker(true);
    expect(sheet.closest('.ui-sheet-overlay')).not.toBeNull();
    const top = topOverlay();
    console.log(`[N2] lớp trên cùng: ${top?.className} (z: ${JSON.stringify(overlayZ())}) ⇒ ${top?.contains(sheet) ? 'ĐÃ HẾT' : 'LỖI CÒN'}`);
    expect(top?.contains(sheet)).toBe(true);
  });

  it('GIỮ (N2, máy tính): ô chọn thợ là hộp thoại mở sau → cũng nằm trên hộp phát sinh', async () => {
    const picker = await openPicker(false);
    expect(picker.closest('.ui-overlay')).not.toBeNull();
    expect(topOverlay()?.contains(picker)).toBe(true);
  });

  it('BẮT (L3): chọn hai chị Hà trong hộp phát sinh → ảnh ghi "PH", "NH" (không "PC", "NP")', async () => {
    await openPicker(false);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Phạm Thu Hà' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Nguyễn Thu Hà' }));
    await userEvent.click(screen.getByRole('button', { name: 'Chọn' }));
    await waitFor(() => expect(document.querySelector('.ct-tn')?.textContent).toBe('Phạm Thu Hà (chính), Nguyễn Thu Hà'));
    const ini = Array.from(document.querySelectorAll('.ct-avs .ui-av')).map((a) => a.textContent);
    expect(ini).toEqual(['PH', 'NH']);
  });

  it('BẮT (L3, gốc ở hàng thợ): người thiếu chữ tắt → rút từ tên, không từ "tên · thợ chính/phụ"', () => {
    const people = [
      { membershipId: 'm-pha', role: 'PRIMARY' as const, displayName: 'Phạm Thu Hà' },
      { membershipId: 'm-ngha', role: 'ASSIST' as const, displayName: 'Nguyễn Thu Hà' },
    ];
    const { container } = render(<ContractStaffRow people={people} mode="view" naming={staffNaming(people)} />);
    expect(Array.from(container.querySelectorAll('.ui-av')).map((a) => a.textContent)).toEqual(['PH', 'NH']);
    // Tên + vai trò vẫn đọc được ở chữ nổi của ảnh.
    expect(container.querySelector('.ui-av')?.getAttribute('title')).toBe('Phạm Thu Hà · thợ chính');
  });
});

describe('Lần 4 — N1 ở màn hợp đồng: huỷ dòng báo lịch đã huỷ theo', () => {
  it('máy chủ trả lịch của dòng ở trạng thái "Đã huỷ" → dải báo "Đã huỷ 1 lịch của dòng này trên Lịch (LH-000008)."', async () => {
    const appt = { id: 'a-8', code: 'LH-000008', startsAt: '2026-11-22T08:00:00.000Z', contractLineId: 'l1' };
    api.getContract.mockResolvedValue(detail('CONFIRMED', { appointments: [{ ...appt, status: 'CONFIRMED' }] }) as never);
    api.voidContractLine.mockResolvedValue({ ...detail('CONFIRMED', { appointments: [{ ...appt, status: 'CANCELLED' }] }), adjustments: [] } as never);
    renderEditor(OWNER);
    await userEvent.click(await screen.findByRole('button', { name: 'Huỷ dòng' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), 'Khách bớt một người');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Huỷ dòng' }));
    expect(await screen.findByText('Đã huỷ 1 lịch của dòng này trên Lịch (LH-000008).')).toBeTruthy();
  });
});

// N2 — mọi kiểu lồng: hộp/ngăn kéo mở SAU (từ bên trong cái đang mở) luôn nằm trên, dù là Dialog hay BottomSheet.
describe('Lần 4 — N2: thứ tự lớp của mọi kiểu hộp lồng hộp', () => {
  const kinds = { Dialog, BottomSheet } as const;
  const cases: [keyof typeof kinds, keyof typeof kinds][] = [
    ['Dialog', 'BottomSheet'],
    ['BottomSheet', 'Dialog'],
    ['Dialog', 'Dialog'],
    ['BottomSheet', 'BottomSheet'],
  ];
  it.each(cases)('%s mở %s → cái mở sau nằm trên', async (outer, inner) => {
    function Nested() {
      const Outer = kinds[outer] as typeof Dialog;
      const Inner = kinds[inner] as typeof Dialog;
      const [open, setOpen] = useStateForTest(false);
      return (
        <Outer open onClose={() => {}} title="Ngoài">
          <button type="button" onClick={() => setOpen(true)}>Mở trong</button>
          <Inner open={open} onClose={() => setOpen(false)} title="Trong">
            <span>nội dung trong</span>
          </Inner>
        </Outer>
      );
    }
    render(<Nested />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở trong' }));
    const innerDlg = await screen.findByRole('dialog', { name: 'Trong' });
    expect(topOverlay()?.contains(innerDlg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Bản vẽ D 3.4 (gói W3): ô Sự kiện, ngày của dòng, dòng phụ phí tự thêm. Máy chủ giả "tính" phụ phí theo luật Ngoài giờ.
type BodyLine = { occasionId?: string; dismissedRuleIds?: string[]; surchargeOverrides?: { ruleId: string; quantity?: number; unitPrice?: number; note?: string }[]; scheduledStart?: string; quantity?: number };
const bodyLine = (call: unknown[] | undefined): BodyLine => ((call?.[1] as { lines: BodyLine[] }).lines[0] ?? {}) as BodyLine;
const lastBody = () => bodyLine(api.quoteContract.mock.calls.at(-1));

function surRow(over: Record<string, unknown> = {}) {
  return line({
    id: null,
    kind: 'SURCHARGE',
    name: 'Phụ phí ngoài giờ',
    serviceId: 'sv-gio',
    packageId: null,
    subjectId: null,
    subjectName: null,
    priceVersionId: 'pv-gio',
    surchargeRuleId: 'r-gio',
    surchargeRuleName: 'Ngoài giờ',
    unitPrice: 100_000,
    lineTotal: 100_000,
    staff: [],
    scheduledStart: null,
    scheduledEnd: null,
    ...over,
  });
}

// Máy chủ giả: luật Ngoài giờ khớp mọi dòng, trừ khi dòng đã bỏ luật (dismissedRuleIds). Tiền do máy chủ giả "tính" (giá × số lượng
// hoặc giá ghi đè) — web chỉ hiện. total cố ý lệch 1.000 so với tổng các dòng để bắt việc web tự cộng.
function ruleServer(opts: { report?: Partial<ReturnType<typeof emptyReport>>; price?: boolean } = {}) {
  api.quoteContract.mockImplementation((async (_org: string, body: { lines: BodyLine[] }) => {
    const l = body.lines[0] ?? {};
    const off = (l.dismissedRuleIds ?? []).includes('r-gio');
    const ov = (l.surchargeOverrides ?? []).find((o) => o.ruleId === 'r-gio');
    const qty = ov?.quantity ?? l.quantity ?? 1;
    const unit = ov?.unitPrice ?? 100_000;
    const row = surRow({ quantity: qty, unitPrice: unit, lineTotal: unit * qty, priceVersionId: ov?.unitPrice !== undefined ? null : 'pv-gio', note: ov?.note ?? null });
    const g = line({ id: null, surcharges: off || opts.price === false ? [] : [row] });
    return {
      lines: [g],
      travelTotal: 0,
      subtotal: 700_000,
      discount: 0,
      total: 701_000,
      depositRequired: 0,
      suggestedDeposit: 0,
      classes: [],
      autoSurcharge: {
        applied: off || opts.price === false ? [] : [{ line: 0, ruleId: 'r-gio', ruleName: 'Ngoài giờ', serviceName: 'Phụ phí ngoài giờ', quantity: qty, lineTotal: unit * qty, overridden: Boolean(ov) }],
        removed: [],
        skipped: [],
        ...opts.report,
      },
    };
  }) as never);
}
const emptyReport = () => ({ applied: [], removed: [], skipped: [] as { line: number; ruleId: string; ruleName: string; reason: string; by?: string }[] });

describe('D 3.4 — ô Sự kiện', () => {
  it('chỉ loại đang bật để chọn, mục đầu "Chưa chọn sự kiện"; chọn → thân quote có occasionId; bỏ chọn → không gửi', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    const sel = within(card).getByLabelText('Sự kiện') as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Chưa chọn sự kiện', 'Lễ vu quy', 'Tiệc']);
    await userEvent.selectOptions(sel, 'Lễ vu quy');
    await waitFor(() => expect(lastBody().occasionId).toBe('oc-vq'));
    expect(card.querySelector('.ct-oc__dot')?.getAttribute('data-color')).toBe('taupe');
    await userEvent.selectOptions(sel, 'Chưa chọn sự kiện');
    await waitFor(() => expect(lastBody()).not.toHaveProperty('occasionId'));
  });

  it('"Sửa danh sách" dẫn tới Bảng giá › Loại sự kiện, chỉ khi có catalog.write', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    const { unmount } = renderEditor(OWNER);
    const link = await screen.findByRole('link', { name: 'Sửa danh sách' });
    expect(link.getAttribute('href')).toBe('/studio/bang-gia/su-kien');
    unmount();
    renderEditor(OWNER.filter((p) => p !== 'catalog.write'));
    await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect(screen.queryByRole('link', { name: 'Sửa danh sách' })).toBeNull();
  });

  it('dòng đã lưu mang loại đang ẩn: hiện tên đã chụp "(đang ẩn)" kèm lời báo, không lưu im lặng', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [line({ occasionId: 'oc-cu', occasionName: 'Ăn hỏi' })] }) as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect(within(card).getByRole('option', { name: 'Ăn hỏi (đang ẩn)' })).toBeTruthy();
    expect(within(card).getByText(/Loại sự kiện này đang ẩn/)).toBeTruthy();
  });
});

describe('D 3.4 — ngày của dòng', () => {
  it('mặc định "Theo ngày sự kiện"; gõ ngày khác → chip "Khác ngày sự kiện", quote gửi giờ ở ngày đó; "Về ngày sự kiện" trả lại', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect(within(card).getByText('Theo ngày sự kiện (24/10/2026)')).toBeTruthy();
    expect(within(card).getByText('Ngày & giờ')).toBeTruthy();
    await userEvent.type(within(card).getByLabelText('Ngày của dòng'), '19/10/2026');
    expect(await within(card).findByText('Khác ngày sự kiện')).toBeTruthy();
    await waitFor(() => expect(lastBody().scheduledStart).toBe('2026-10-19T05:00:00+07:00'));
    await userEvent.click(within(card).getByRole('button', { name: 'Về ngày sự kiện' }));
    await waitFor(() => expect(lastBody().scheduledStart).toBe('2026-10-24T05:00:00+07:00'));
    expect(within(card).queryByText('Khác ngày sự kiện')).toBeNull();
  });

  it('đổi ngày sự kiện: dòng theo ngày sự kiện đi theo, dòng có ngày riêng giữ nguyên', async () => {
    api.getContract.mockResolvedValue(
      detail('DRAFT', {
        lines: [
          line({ id: 'l1', scheduledStart: '2026-10-18T22:00:00.000Z', scheduledEnd: '2026-10-18T22:45:00.000Z' }), // 19/10 05:00 — ngày riêng
          line({ id: 'l2' }), // 24/10 05:00 — theo ngày sự kiện
        ],
      }) as never,
    );
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [line({ id: null }), line({ id: null })] } as never);
    renderEditor(OWNER);
    await screen.findAllByRole('region', { name: /Mẹ cô dâu/ });
    await userEvent.clear(screen.getByLabelText('Ngày sự kiện'));
    await userEvent.type(screen.getByLabelText('Ngày sự kiện'), '05/11/2026');
    await waitFor(() => {
      const lines = (api.quoteContract.mock.calls.at(-1)?.[1] as unknown as { lines: BodyLine[] }).lines;
      expect(lines[0]?.scheduledStart).toBe('2026-10-19T05:00:00+07:00');
      expect(lines[1]?.scheduledStart).toBe('2026-11-05T05:00:00+07:00');
    });
  });
});

describe('D 3.4 — dòng phụ phí tự thêm', () => {
  it('hiện tên × số lượng, tiền máy chủ trả và nhãn "tự thêm theo luật …"; tổng lấy từ máy chủ, web không cộng', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    ruleServer();
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    const row = await within(card).findByText('Phụ phí ngoài giờ');
    const r = row.closest('.ct-sr__r') as HTMLElement;
    expect(within(r).getByText('100.000 ₫')).toBeTruthy();
    expect(within(r).getByText('tự thêm theo luật Ngoài giờ')).toBeTruthy();
    // Cộng dòng = số máy chủ trả (600.000 gói + 100.000 phụ phí), thanh tổng = total của máy chủ (701.000, lệch 1.000 có chủ ý).
    expect(card.querySelector('.ct-ln__ft b')?.textContent).toBe('700.000 ₫');
    expect(await screen.findAllByText('701.000 ₫')).not.toHaveLength(0);
  });

  it('bỏ một dòng (×): gửi dismissedRuleIds; báo giá lại không hiện lại; hiện "Đã bỏ: … · Áp lại"; Áp lại → luật tự thêm lại + thông báo', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    ruleServer();
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await within(card).findByText('Phụ phí ngoài giờ');
    await userEvent.click(within(card).getByRole('button', { name: 'Bỏ phụ phí Phụ phí ngoài giờ ở dòng này' }));
    await waitFor(() => expect(lastBody().dismissedRuleIds).toEqual(['r-gio']));
    await waitFor(() => expect(within(card).queryByText('Phụ phí ngoài giờ')).toBeNull());
    expect(within(card).getByText('Đã bỏ: Ngoài giờ')).toBeTruthy();
    // Đổi giờ → báo giá lại: vẫn không hiện lại, vẫn gửi dismissedRuleIds.
    const calls = api.quoteContract.mock.calls.length;
    await userEvent.clear(within(card).getByLabelText('Giờ bắt đầu'));
    await userEvent.type(within(card).getByLabelText('Giờ bắt đầu'), '0530');
    await waitFor(() => expect(api.quoteContract.mock.calls.length).toBeGreaterThan(calls));
    expect(lastBody().dismissedRuleIds).toEqual(['r-gio']);
    expect(within(card).queryByText('Phụ phí ngoài giờ')).toBeNull();
    // Áp lại.
    await userEvent.click(within(card).getByRole('button', { name: 'Áp lại' }));
    await waitFor(() => expect(lastBody()).not.toHaveProperty('dismissedRuleIds'));
    expect(await within(card).findByText('Phụ phí ngoài giờ')).toBeTruthy();
    expect(await screen.findByText('Đã tự thêm Phụ phí ngoài giờ cho dòng Mẹ cô dâu · Mẹ – Trang điểm nhẹ nhàng theo luật Ngoài giờ')).toBeTruthy();
  });

  it('sửa giá bắt buộc ghi lý do: thiếu lý do báo lỗi, không đổi; có lý do → thân gửi surchargeOverrides, dòng ghi "đã sửa giá"; "Về theo luật" bỏ phần sửa', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    ruleServer();
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await within(card).findByText('Phụ phí ngoài giờ');
    await userEvent.click(within(card).getByRole('button', { name: 'Sửa phụ phí Phụ phí ngoài giờ' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Giá phụ phí'), '50000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Ghi đè giá phải ghi lý do.')).toBeTruthy();
    expect(lastBody()).not.toHaveProperty('surchargeOverrides');
    await userEvent.type(within(dlg).getByLabelText('Lý do sửa giá'), 'Khách quen');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(lastBody().surchargeOverrides).toEqual([{ ruleId: 'r-gio', unitPrice: 50_000, note: 'Khách quen' }]));
    const r = (await within(card).findByText('tự thêm theo luật Ngoài giờ · đã sửa giá')).closest('.ct-sr__r') as HTMLElement;
    expect(within(r).getByText('50.000 ₫')).toBeTruthy();
    expect(within(r).getByText('Lý do: Khách quen')).toBeTruthy();
    await userEvent.click(within(card).getByRole('button', { name: 'Sửa phụ phí Phụ phí ngoài giờ' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Về theo luật' }));
    await waitFor(() => expect(lastBody()).not.toHaveProperty('surchargeOverrides'));
  });

  it('sửa số lượng không cần lý do; số lượng bằng mặc định của luật thì không gửi', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    ruleServer();
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await within(card).findByText('Phụ phí ngoài giờ');
    await userEvent.click(within(card).getByRole('button', { name: 'Sửa phụ phí Phụ phí ngoài giờ' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Tăng số lượng phụ phí' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(lastBody().surchargeOverrides).toEqual([{ ruleId: 'r-gio', quantity: 2 }]));
    expect(await within(card).findByText('Phụ phí ngoài giờ × 2')).toBeTruthy();
  });

  it('luật bị bỏ qua (skipped) hiện lý do tiếng Việt trong thẻ dòng', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    ruleServer({
      price: false,
      report: {
        skipped: [
          { line: 0, ruleId: 'r-gio', ruleName: 'Ngoài giờ', reason: 'NO_PRICE' },
          { line: 0, ruleId: 'r-le', ruleName: 'Ngày lễ', reason: 'SERVICE_UNAVAILABLE' },
          { line: 0, ruleId: 'r-3', ruleName: 'Cuối tuần', reason: 'MANUAL_LINE_EXISTS' },
          { line: 0, ruleId: 'r-4', ruleName: 'Sáng sớm', reason: 'SAME_SERVICE', by: 'Ngoài giờ' },
        ],
      },
    });
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect(await within(card).findByText('Luật "Ngoài giờ" khớp nhưng phụ phí chưa có giá — chưa thêm.')).toBeTruthy();
    expect(within(card).getByText('Luật "Ngày lễ" khớp nhưng phụ phí đang ngừng — chưa thêm.')).toBeTruthy();
    expect(within(card).getByText(/Luật "Cuối tuần" khớp nhưng đã có dòng phụ phí cùng loại nhập tay/)).toBeTruthy();
    expect(within(card).getByText(/Luật "Sáng sớm" khớp nhưng cùng phụ phí với luật "Ngoài giờ" đứng trước/)).toBeTruthy();
  });

  it('phần sửa bị máy chủ bỏ (removed) hiện lý do', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    ruleServer({ price: false, report: { removed: [{ line: 0, ruleId: 'r-gio', ruleName: 'Ngoài giờ', reason: 'NO_LONGER_MATCHES' }] } as never });
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect(await within(card).findByText('Đã bỏ phần bạn sửa ở luật "Ngoài giờ" vì luật không còn khớp dòng này.')).toBeTruthy();
  });

  it('nháp cũ vừa mở: luật tự thêm dòng mà bản lưu chưa có → dải xanh "đã thêm 1 dòng — kiểm lại"; không bắn thông báo từng dòng; Lưu xong thì hết', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    ruleServer();
    api.updateContract.mockResolvedValue(detail('DRAFT', { lines: [line({ surcharges: [surRow({ id: 's1' })] })], updatedAt: 'moi' }) as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Luật phụ phí đã thêm 1 dòng — kiểm lại trước khi lưu.')).toBeTruthy();
    expect(screen.queryByText(/^Đã tự thêm/)).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(api.updateContract).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Luật phụ phí đã thêm/)).toBeNull());
  });

  it('nháp đã lưu có dòng tự thêm: không có dải xanh, dòng con KHÔNG thành khoản riêng ở thẻ "Phụ phí & khoản khác", mở lại số tiền không đổi', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [line({ surcharges: [surRow({ id: 's1' })] })] }) as never);
    ruleServer();
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await within(card).findByText('Phụ phí ngoài giờ');
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    expect(screen.queryByText(/Luật phụ phí đã thêm/)).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Phụ phí & khoản khác' })).queryByText(/Phụ phí ngoài giờ/)).toBeNull();
    expect(screen.getAllByText('Phụ phí ngoài giờ')).toHaveLength(1);
    expect(lastBody()).not.toHaveProperty('surchargeOverrides');
    expect(lastBody()).not.toHaveProperty('dismissedRuleIds');
    expect(card.querySelector('.ct-ln__ft b')?.textContent).toBe('700.000 ₫');
  });

  it('nháp đã lưu có phần sửa số lượng: mở lại gửi đúng phần sửa (không im lặng đổi tiền)', async () => {
    // Dòng 2 người, luật Ngoài giờ tính theo số lượng (mặc định 2) nhưng người lập đã sửa còn 1.
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [line({ quantity: 2, surcharges: [surRow({ id: 's1', quantity: 1 })] })] }) as never);
    ruleServer();
    renderEditor(OWNER);
    await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await waitFor(() => expect(lastBody().surchargeOverrides).toEqual([{ ruleId: 'r-gio', quantity: 1 }]));
  });

  it('hợp đồng cũ (không sự kiện, không phụ phí): thân gửi KHÔNG có trường mới, số tiền như cũ', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockResolvedValue(detail('DRAFT') as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalled());
    for (const k of ['occasionId', 'dismissedRuleIds', 'surchargeOverrides']) expect(lastBody()).not.toHaveProperty(k);
    expect(within(card).queryByLabelText('Phụ phí tự thêm')).toBeNull();
    expect(await within(card).findByText('600.000 ₫', { selector: '.ct-ln__ft b' })).toBeTruthy();
    expect(screen.queryByText(/Luật phụ phí đã thêm/)).toBeNull();
  });
});

describe('D 3.4 — hợp đồng đã xác nhận', () => {
  const confirmed = (extra: Record<string, unknown> = {}) =>
    detail('CONFIRMED', {
      total: 700_000,
      lines: [line({ occasionId: 'oc-vq', occasionName: 'Lễ vu quy', surcharges: [surRow({ id: 's1', lineTotal: 100_000 }), surRow({ id: 's2', name: 'Phụ phí ngày lễ', surchargeRuleId: 'r-le', surchargeRuleName: 'Ngày lễ', voidedAt: '2026-10-21T00:00:00Z', voidReason: 'Khách đổi ý' })] })],
      ...extra,
    });

  it('dòng tự thêm hiện như dịch vụ phụ kèm "tự thêm theo luật …"; KHÔNG sửa, KHÔNG bỏ; sự kiện và ngày chỉ là chữ; không báo giá', async () => {
    api.getContract.mockResolvedValue(confirmed() as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect(within(card).getByText('Phụ phí ngoài giờ')).toBeTruthy();
    expect(within(card).getByText('tự thêm theo luật Ngoài giờ')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /^Sửa phụ phí/ })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Bỏ phụ phí/ })).toBeNull();
    expect(within(card).queryByLabelText('Sự kiện')).toBeNull();
    expect(within(card).getByText('Lễ vu quy')).toBeTruthy();
    expect((within(card).getByLabelText('Ngày của dòng') as HTMLInputElement).disabled).toBe(true);
    // Phụ phí đã huỷ hiện gạch kèm lý do; "Cộng" chỉ tính dòng chưa huỷ (số máy chủ trả).
    expect(within(card).getByText('Đã huỷ: Khách đổi ý')).toBeTruthy();
    expect(card.querySelector('.ct-ln__ft b')?.textContent).toBe('700.000 ₫');
    expect(api.quoteContract).not.toHaveBeenCalled();
  });

  it('huỷ một dòng tự thêm: cần contracts.adjust (lễ tân không có nút), bắt buộc lý do, gọi void đúng mã dòng con', async () => {
    api.getContract.mockResolvedValue(confirmed() as never);
    api.voidContractLine.mockResolvedValue({ ...confirmed(), adjustments: [] } as never);
    const { unmount } = renderEditor(SYSTEM_ROLES.receptionist.permissions);
    await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect(screen.queryByTitle('Huỷ phụ phí này (bắt buộc ghi lý do)')).toBeNull();
    unmount();
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await userEvent.click(within(card).getByTitle('Huỷ phụ phí này (bắt buộc ghi lý do)'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Huỷ dòng' }));
    expect(await within(dlg).findByText('Nhập lý do.')).toBeTruthy();
    await userEvent.type(within(dlg).getByLabelText(/Lý do/), 'Khách xin bớt');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Huỷ dòng' }));
    await waitFor(() => expect(api.voidContractLine).toHaveBeenCalledWith('org-1', 'hd-1', 's1', { reason: 'Khách xin bớt' }));
  });
});

describe('D 3.4 — thông báo nhỏ', () => {
  it('tự tắt sau 5 giây, đóng được bằng nút', async () => {
    vi.useFakeTimers();
    const { SurchargeToasts, TOAST_MS } = await import('./AutoSurchargeRows');
    expect(TOAST_MS).toBe(5000);
    function Host() {
      const [items, setItems] = useStateForTest([
        { id: 1, text: 'Đã tự thêm A' },
        { id: 2, text: 'Đã tự thêm B' },
      ]);
      return <SurchargeToasts items={items} onDone={(id) => setItems((l) => l.filter((x) => x.id !== id))} />;
    }
    const { act } = await import('@testing-library/react');
    render(<Host />);
    expect(screen.getByText('Đã tự thêm A')).toBeTruthy();
    act(() => {
      screen.getAllByRole('button', { name: 'Đóng thông báo' })[0]?.click();
    });
    expect(screen.queryByText('Đã tự thêm A')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(screen.getByText('Đã tự thêm B')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Đã tự thêm B')).toBeNull();
  });
});

// Biên bản nghiệm thu D, T1: dữ liệu giả CỐ Ý có thành tiền ≠ đơn giá × số lượng và số người (số lượng dòng) > 1,
// để việc web tự nhân / tự cộng tiền phụ phí làm bài đỏ. Số đúng là số máy chủ trả (lineTotal), không phải phép tính của màn.
describe('D 3.4 — T1: web hiện đúng số máy chủ trả, không tự tính tiền phụ phí', () => {
  // Dòng gói: 3 người, đơn giá 600.000, giảm 100.000 → thành tiền 1.700.000 (khác 600.000 × 3 = 1.800.000).
  // Phụ phí A (theo số người): 3 × 100.000 nhưng máy chủ trả 250.000 (khác 300.000 và khác 100.000 × 1).
  // Phụ phí B (luôn 1): 100.000 × 1 nhưng máy chủ trả 70.000 (khác 100.000; còn khác 100.000 × 3 = 300.000 của dòng).
  // Phụ phí C (2 lần, đã huỷ): máy chủ trả 150.000 (khác 2 × 100.000) nhưng đã huỷ → không vào "Cộng".
  const sA = (over: Record<string, unknown> = {}) => surRow({ quantity: 3, unitPrice: 100_000, lineTotal: 250_000, ...over });
  const sB = (over: Record<string, unknown> = {}) =>
    surRow({ name: 'Phụ phí ngày lễ', serviceId: 'sv-le', priceVersionId: 'pv-le', surchargeRuleId: 'r-le', surchargeRuleName: 'Ngày lễ', quantity: 1, unitPrice: 100_000, lineTotal: 70_000, ...over });
  const grouped = (id: string | null, surcharges: unknown[]) => line({ id, quantity: 3, unitPrice: 600_000, lineDiscount: 100_000, lineTotal: 1_700_000, surcharges });
  const CONG = '2.020.000 ₫'; // 1.700.000 + 250.000 + 70.000

  it('nháp: mỗi dòng tự thêm hiện đúng lineTotal máy chủ trả; "Cộng" = tổng lineTotal (không phải đơn giá × số lượng)', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT', { lines: [grouped('l1', [])] }) as never);
    api.quoteContract.mockResolvedValue({ ...quote([]), lines: [grouped(null, [sA(), sB()])], subtotal: 2_020_000, total: 2_021_000 } as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    const a = (await within(card).findByText('Phụ phí ngoài giờ × 3')).closest('.ct-sr__r') as HTMLElement;
    const b = within(card).getByText('Phụ phí ngày lễ').closest('.ct-sr__r') as HTMLElement;
    expect(a.querySelector('b')?.textContent).toBe('250.000 ₫');
    expect(b.querySelector('b')?.textContent).toBe('70.000 ₫');
    expect(card.querySelector('.ct-ln__ft b')?.textContent).toBe(CONG);
    // Không số nào trong chuỗi "tự nhân" lọt lên màn.
    for (const sai of ['300.000 ₫', '100.000 ₫', '1.800.000 ₫', '2.300.000 ₫', '2.100.000 ₫']) expect(within(card).queryByText(sai)).toBeNull();
    // Thanh tổng là total của máy chủ (lệch 1.000 có chủ ý so với tổng các dòng).
    expect((await screen.findAllByText('2.021.000 ₫')).length).toBeGreaterThan(0);
  });

  it('đã xác nhận: dòng tự thêm hiện lineTotal đã lưu, dòng đã huỷ không vào "Cộng"', async () => {
    const huy = sA({ id: 's3', name: 'Phụ phí cuối tuần', surchargeRuleId: 'r-cuoituan', surchargeRuleName: 'Cuối tuần', quantity: 2, lineTotal: 150_000, voidedAt: '2026-10-21T00:00:00Z', voidReason: 'Khách đổi ý' });
    api.getContract.mockResolvedValue(detail('CONFIRMED', { total: 2_020_000, lines: [grouped('l1', [sA({ id: 's1' }), sB({ id: 's2' }), huy])] }) as never);
    renderEditor(OWNER);
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect((within(card).getByText('Phụ phí ngoài giờ × 3').closest('.ct-sr__r') as HTMLElement).querySelector('b')?.textContent).toBe('250.000 ₫');
    expect((within(card).getByText('Phụ phí ngày lễ').closest('.ct-sr__r') as HTMLElement).querySelector('b')?.textContent).toBe('70.000 ₫');
    expect((within(card).getByText('Phụ phí cuối tuần × 2').closest('.ct-sr__r') as HTMLElement).querySelector('b')?.textContent).toBe('150.000 ₫');
    expect(card.querySelector('.ct-ln__ft b')?.textContent).toBe(CONG);
  });
});

describe('D 3.4 — hộp "Thêm phát sinh" (hợp đồng đã xác nhận)', () => {
  const CATALOG = {
    packages: [PKG_ME],
    surcharges: [],
    subjects: [{ id: 's-me', name: 'Mẹ cô dâu', sortOrder: 1, isActive: true }],
    studios: [{ id: 'st-1', name: 'Studio Chiến', address: '25 Hoàng Quốc Việt', isDefault: true, isActive: true }],
    policy: { defaultMode: 'PER_KM', fixedAmount: 150_000, perKmAmount: 10_000, freeKm: 1.5, minimumAmount: 0, roundTrip: true, tiers: [], updatedAt: '' },
    occasions: OCCASIONS,
    rules: RULES,
  };
  const renderDialog = (det: unknown = detail('CONFIRMED')) =>
    render(<ExtraPackageDialog pkg={PKG_ME as never} orgId="org-1" tz={TZ} detail={det as never} catalog={CATALOG as never} canPickStaff staffRoster={[]} phone={false} onClose={() => {}} onAdded={() => {}} />);
  const sentLine = () => (api.addContractLine.mock.calls.at(-1)?.[2] ?? {}) as unknown as BodyLine;
  const fillTimes = async () => {
    await userEvent.type(await screen.findByRole('textbox', { name: 'Giờ bắt đầu' }), '05:00');
    await userEvent.type(screen.getByRole('textbox', { name: 'Giờ kết thúc' }), '06:00');
  };

  it('có ô Sự kiện, ngày riêng và dòng phụ phí tự thêm; MỘT dấu "?" ở nhãn "Ngày & giờ"; thêm → thân gửi occasionId + giờ đúng ngày riêng', async () => {
    ruleServer();
    api.addContractLine.mockResolvedValue(detail('CONFIRMED') as never);
    renderDialog();
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect([...(within(card).getByLabelText('Sự kiện') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Chưa chọn sự kiện', 'Lễ vu quy', 'Tiệc']);
    // Nhãn "Ngày & giờ": đúng một dấu "?" (lời giải thích gộp).
    const lbl = within(card).getByText('Ngày & giờ').closest('.ct-rw__l') as HTMLElement;
    expect(lbl.querySelectorAll('.ui-tip')).toHaveLength(1);
    await userEvent.selectOptions(within(card).getByLabelText('Sự kiện'), 'Lễ vu quy');
    await userEvent.type(within(card).getByRole('textbox', { name: 'Ngày của dòng' }), '19/10/2026');
    await fillTimes();
    expect(await within(card).findByText('Phụ phí ngoài giờ')).toBeTruthy();
    expect(within(card).getByText('tự thêm theo luật Ngoài giờ')).toBeTruthy();
    await waitFor(() => expect(lastBody().occasionId).toBe('oc-vq'));
    // Bảng tính xem trước kèm ngày sự kiện của hợp đồng (như lúc thêm thật).
    expect((api.quoteContract.mock.calls.at(-1)?.[1] as unknown as { eventDate?: string }).eventDate).toBe('2026-10-24T00:00:00+07:00');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm phát sinh' }));
    await waitFor(() => expect(api.addContractLine).toHaveBeenCalled());
    expect(sentLine()).toMatchObject({ occasionId: 'oc-vq', scheduledStart: '2026-10-19T05:00:00+07:00' });
  });

  it('bỏ luật (×) → thân thêm dòng gửi dismissedRuleIds, báo giá lại không hiện lại; sửa giá bắt buộc lý do → gửi surchargeOverrides', async () => {
    ruleServer();
    api.addContractLine.mockResolvedValue(detail('CONFIRMED') as never);
    renderDialog();
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    await fillTimes();
    await within(card).findByText('Phụ phí ngoài giờ');
    await userEvent.click(within(card).getByRole('button', { name: 'Sửa phụ phí Phụ phí ngoài giờ' }));
    const dlg = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    await userEvent.type(within(dlg).getByLabelText('Giá phụ phí'), '60000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    expect(await within(dlg).findByText('Ghi đè giá phải ghi lý do.')).toBeTruthy();
    await userEvent.type(within(dlg).getByLabelText('Lý do sửa giá'), 'Khách ruột');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(lastBody().surchargeOverrides).toEqual([{ ruleId: 'r-gio', unitPrice: 60_000, note: 'Khách ruột' }]));
    await userEvent.click(await within(card).findByRole('button', { name: 'Bỏ phụ phí Phụ phí ngoài giờ ở dòng này' }));
    await waitFor(() => expect(lastBody().dismissedRuleIds).toEqual(['r-gio']));
    await waitFor(() => expect(within(card).queryByText('Phụ phí ngoài giờ')).toBeNull());
    expect(within(card).getByText('Đã bỏ: Ngoài giờ')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm phát sinh' }));
    await waitFor(() => expect(api.addContractLine).toHaveBeenCalled());
    expect(sentLine().dismissedRuleIds).toEqual(['r-gio']);
    expect(sentLine()).not.toHaveProperty('surchargeOverrides');
  });

  it('dòng phát sinh lấy sự kiện và ngày của dòng đặt chỗ cuối chưa huỷ của hợp đồng', async () => {
    api.quoteContract.mockResolvedValue(quote([]) as never);
    // Dòng cuối: sự kiện Tiệc, ngày 19/10 (khác ngày sự kiện 24/10).
    const last = line({ id: 'l2', occasionId: 'oc-tiec', occasionName: 'Tiệc', scheduledStart: '2026-10-18T22:00:00.000Z', scheduledEnd: '2026-10-18T23:00:00.000Z' });
    renderDialog(detail('CONFIRMED', { lines: [line(), last] }));
    const card = await screen.findByRole('region', { name: /Mẹ cô dâu/ });
    expect((within(card).getByLabelText('Sự kiện') as HTMLSelectElement).value).toBe('oc-tiec');
    expect((within(card).getByRole('textbox', { name: 'Ngày của dòng' }) as HTMLInputElement).value).toBe('19/10/2026');
    expect(within(card).getByText('Khác ngày sự kiện')).toBeTruthy();
  });
});
