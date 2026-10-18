import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import * as contractsApi from '../../api/contracts';
import { ContractEditor } from './ContractEditor';

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
}));

vi.mock('../../api/schedule', () => ({ listCustomers: vi.fn() }));

const api = vi.mocked(contractsApi);
const TZ = 'Asia/Ho_Chi_Minh';

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

const MINH_ANH = { membershipId: 'm2', role: 'PRIMARY', displayName: 'Trần Minh Anh', avatarUrl: null, initials: 'TA', tier: null };

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

function renderEditor(perms: readonly Permission[], contractId: string | null = 'hd-1') {
  const has = (p: Permission) => perms.includes(p);
  return render(
    <MemoryRouter>
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
    expect(await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' })).toBeInTheDocument();
    expect(screen.queryByText(/Trùng giờ/)).toBeNull();
    expect(screen.queryByText(/có lịch trong ngày/)).toBeNull();
    expect(await confirmButton()).toBeEnabled();
  });

  it('vàng: "Anh có lịch trong ngày · 1 ca"; vẫn xác nhận được', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([SAME_DAY]) as never);
    renderEditor(OWNER);
    expect(await screen.findByText('Anh có lịch trong ngày · 1 ca')).toBeInTheDocument();
    expect(await confirmButton()).toBeEnabled();
  });

  it('đỏ: "Trùng giờ 05:00–06:30" và khoá nút xác nhận, lý do ở tooltip', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([OVERLAP]) as never);
    renderEditor(OWNER);
    const band = await screen.findByText('Trùng giờ 05:00–06:30');
    expect(band.closest('[data-muc]')).toHaveAttribute('data-muc', 'OVERLAP');
    const btn = await confirmButton();
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleName('Xác nhận hợp đồng — Còn 1 dòng thợ trùng giờ. Đổi thợ hoặc đổi giờ trước khi xác nhận.');
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
    await waitFor(() => expect(btn).toBeEnabled());
    // Đợi số tiền về để bảo đảm không còn yêu cầu quote đang chờ.
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    api.quoteContract.mockResolvedValue(quote([OVERLAP]) as never);
    await userEvent.click(btn);
    expect(await screen.findByText('Trùng lịch: Trần Minh Anh đã có lịch L-0123 06:00–07:30')).toBeInTheDocument();
    expect(api.updateContract).not.toHaveBeenCalled();
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Trùng giờ 05:00–06:30')).toBeInTheDocument();
    expect(screen.getByText('Nháp')).toBeInTheDocument();
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
    expect(await screen.findByText('Tiền cọc không được lớn hơn tổng')).toBeInTheDocument();
    expect(screen.getByLabelText('Cọc cần thu')).toHaveAttribute('aria-invalid', 'true');
  });

  it('403 khi lưu: dải đỏ lời máy chủ, giữ dữ liệu đã nhập', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    api.updateContract.mockRejectedValue(new ApiError('FORBIDDEN', 'Bạn không có quyền sửa hợp đồng', 403, 'r'));
    renderEditor(OWNER);
    await screen.findByText('600.000 ₫', { selector: '.ct-ln__ft b' });
    await userEvent.type(screen.getByLabelText('Ghi chú hợp đồng'), 'Ghi chú mới');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(await screen.findByRole('alert', { name: '' })).toHaveTextContent('Bạn không có quyền sửa hợp đồng');
    expect(screen.getByLabelText('Ghi chú hợp đồng')).toHaveValue('Ghi chú mới');
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
    expect(within(card).getByText('Di chuyển')).toBeInTheDocument();
    expect(within(card).getByLabelText('bắt buộc')).toBeInTheDocument();
    // Thiếu km: không gửi quote mới (giữ số cũ, số mờ).
    await new Promise((r) => setTimeout(r, 400));
    expect(api.quoteContract).toHaveBeenCalledTimes(1);
    await userEvent.type(within(card).getByLabelText('Số km một chiều'), '12,35');
    await waitFor(() => expect(api.quoteContract).toHaveBeenCalledTimes(2));
    const body = api.quoteContract.mock.calls[1]?.[1] as { lines: Record<string, unknown>[] };
    expect(body.lines[0]).toMatchObject({ locationType: 'CUSTOMER_HOME', travel: { mode: 'PER_KM', distanceKm: 12.35 } });
  });
});

describe('ẩn / khoá theo quyền', () => {
  it('kế toán (chỉ xem): không có Lưu nháp, Xác nhận, Bảng giá; ô bị khoá', async () => {
    api.getContract.mockResolvedValue(detail('DRAFT') as never);
    api.quoteContract.mockResolvedValue(quote([]) as never);
    renderEditor(SYSTEM_ROLES.accountant.permissions);
    await screen.findByText('Lập hợp đồng HĐ-2026-0142');
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Xác nhận hợp đồng/ })).toBeNull();
    expect(screen.queryByText('Bảng giá')).toBeNull();
    expect(screen.getByLabelText('Giờ bắt đầu')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Đổi' })).toBeNull();
  });

  it('đã xác nhận + lễ tân (không có contracts.adjust): có "+ Phát sinh", KHÔNG có "Huỷ dòng"', async () => {
    api.getContract.mockResolvedValue(detail('CONFIRMED') as never);
    renderEditor(SYSTEM_ROLES.receptionist.permissions);
    expect(await screen.findByText('Dòng đã chốt. Chỉ thêm phát sinh hoặc huỷ dòng kèm lý do.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phát sinh' })).toBeInTheDocument();
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
    expect(await within(dialog).findByText('Nhập lý do.')).toBeInTheDocument();
    expect(api.voidContractLine).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), 'Khách đổi ý');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Huỷ dòng' }));
    await waitFor(() => expect(api.voidContractLine).toHaveBeenCalledWith('org-1', 'hd-1', 'l1', { reason: 'Khách đổi ý' }));
  });
});
