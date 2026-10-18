// Bài thử trang quản trị nền tảng (W13): cổng vào 200/404, PATCH gói chỉ trường đổi, khoá cần lý do,
// thêm thuê bao (months XOR endsAt), hạn mức null → "Không giới hạn".
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../../api/client';
import type { OrgDetail, PlanView, PlatformStats } from '../../api/platform';
import { PlatformApp } from './index';
import { addMonths, fmtLimit, fmtMb } from './labels';
import { PlanDialog, parsePlanForm, planPatch, formFromPlan } from './PlanDialog';
import { PlanCard, planLimitLines } from './PlansPage';
import { buildSubscriptionInput, renewTargetFromDetail, SubscriptionDialog, type RenewTarget } from './SubscriptionDialog';
import { statusInput, SuspendDialog } from './SuspendDialog';
import { UsageBars } from './UsageBars';

vi.mock('../../app/session', () => ({
  useSession: () => ({
    user: { id: 'u-admin', fullName: 'Nguyễn Trọng Chiến', email: 'a@x.vn' },
    logout: async () => undefined,
  }),
}));

interface Seen {
  url: string;
  method: string;
  body: unknown;
}
let seen: Seen[] = [];
type Handler = (url: string, method: string) => { status: number; body: unknown } | undefined;
let handler: Handler = () => undefined;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  seen = [];
  setAccessToken('tok');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      seen.push({ url, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const r = handler(url, method);
      if (r) return json(r.status, r.body);
      return json(404, { error: { code: 'NOT_FOUND', message: 'Không có đường API này' } });
    }),
  );
});
afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
  handler = () => undefined;
});

const STATS: PlatformStats = {
  organizations: {
    total: 7,
    byStatus: { ACTIVE: 6, SUSPENDED: 1 },
    bySubscriptionStatus: { NONE: 1, TRIAL: 1, ACTIVE: 3, PAST_DUE: 1, EXPIRED: 1, CANCELLED: 0 },
  },
  expiringIn30Days: 4,
  projectedMonthlyRevenue: 1_396_000,
  projectedMonthlyRevenueNote: 'Dự kiến: tổng giá/tháng HIỆN TẠI … Không phải tiền đã thu.',
  generatedAt: '2026-10-18T08:40:00.000Z',
};

const PLAN: PlanView = {
  id: 'p-team',
  code: 'team',
  name: 'Team',
  priceMonthly: 299_000,
  maxStaff: 10,
  maxAppointmentsPerMonth: 600,
  maxStorageMb: 5120,
  maxStudents: null,
  maxCourses: null,
  customDomain: false,
  features: ['Lịch', 'Hợp đồng'],
  isActive: true,
  sortOrder: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
const TRIAL: PlanView = { ...PLAN, id: 'p-trial', code: 'trial', name: 'Dùng thử', priceMonthly: 0, isActive: false, sortOrder: 0 };
const OLD: PlanView = { ...PLAN, id: 'p-old', code: 'cu', name: 'Gói cũ', isActive: false };

const page = (items: unknown[] = []) => ({ items, page: 1, pageSize: 20, total: items.length });

function renderApp(path = '/quan-tri') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/quan-tri/*" element={<PlatformApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('cổng vào /quan-tri (GET /platform/stats)', () => {
  it('404 → đúng màn "Không có trang này.", không chữ "quyền", không khung quản trị', async () => {
    handler = () => ({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Không có đường API này' } } });
    renderApp();
    expect(await screen.findByText('Không có trang này.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/quyền/i);
    expect(document.body.textContent).not.toMatch(/Quản trị nền tảng|Gói cước|Trang chủ quản trị/);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(seen.map((s) => s.url)).toEqual(['/api/v1/platform/stats']);
  });

  it('đang kiểm quyền: chỉ khối chờ, không vẽ thanh trái', async () => {
    let release: (v: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (release = r))));
    renderApp();
    expect(screen.getByRole('status', { name: 'Đang tải' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Quản trị nền tảng/);
    await act(async () => release(json(404, { error: { code: 'NOT_FOUND', message: 'x' } })));
  });

  it('200 → hiện trang chủ: 4 ô số từ máy chủ, doanh thu ghi rõ "không phải tiền đã thu", tooltip nguyên văn', async () => {
    handler = (url) => {
      if (url.endsWith('/platform/stats')) return { status: 200, body: STATS };
      if (url.includes('/platform/organizations')) return { status: 200, body: page() };
      return undefined;
    };
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Trang chủ quản trị' })).toBeTruthy();
    const tiles = screen.getByRole('group', { name: 'Số liệu nền tảng' });
    expect(within(tiles).getByText('Doanh thu thuê bao dự kiến/tháng')).toBeTruthy();
    expect(within(tiles).getByText('không phải tiền đã thu')).toBeTruthy();
    expect(tiles.textContent).toContain('1.396.000');
    expect(tiles.textContent).toContain('1 đang khoá');
    expect(tiles.textContent).toContain('1 đã hết hạn · 1 chậm thanh toán');
    expect(document.body.textContent).toContain(STATS.projectedMonthlyRevenueNote);
    expect(document.body.textContent).not.toMatch(/lợi nhuận/i);
    // Ba mục khung, không có mục nào khác.
    const nav = screen.getByRole('navigation', { name: 'Mục chính' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Trang chủ', 'Tổ chức', 'Gói cước']);
    await waitFor(() => expect(screen.getByText('Không có tổ chức nào hết hạn trong 30 ngày tới.')).toBeTruthy());
    const urls = seen.map((s) => s.url);
    expect(urls).toContain('/api/v1/platform/organizations?expiringWithinDays=30&pageSize=5');
    expect(urls).toContain('/api/v1/platform/organizations?subscriptionStatus=EXPIRED&pageSize=20');
    expect(urls).toContain('/api/v1/platform/organizations?pageSize=5');
  });

  it('lỗi khác 404 (máy chủ 500) → báo lỗi có nút thử lại, không giả làm 404', async () => {
    handler = () => ({ status: 500, body: { error: { code: 'INTERNAL', message: 'Máy chủ gặp lỗi' } } });
    renderApp();
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeTruthy();
    expect(screen.queryByText('Không có trang này.')).toBeNull();
  });
});

describe('gói cước: PATCH chỉ trường đã đổi', () => {
  it('planPatch: chỉ đổi giá → thân chỉ có priceMonthly; không bao giờ có code', () => {
    const f = { ...formFromPlan(PLAN), priceMonthly: 349_000 };
    const parsed = parsePlanForm(f, 'edit');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(planPatch(PLAN, parsed.value)).toEqual({ priceMonthly: 349_000 });
  });

  it('planPatch: xoá trắng ô giới hạn → null (không giới hạn); thêm tính năng → gửi cả mảng', () => {
    const f = { ...formFromPlan(PLAN), maxStaff: '', features: ['Lịch', 'Hợp đồng', 'Thu tiền'] };
    const parsed = parsePlanForm(f, 'edit');
    if (!parsed.ok) throw new Error('form lỗi');
    expect(planPatch(PLAN, parsed.value)).toEqual({ maxStaff: null, features: ['Lịch', 'Hợp đồng', 'Thu tiền'] });
  });

  it('không đổi gì → thân rỗng; ô giới hạn gõ chữ → lỗi dưới ô', () => {
    const parsed = parsePlanForm(formFromPlan(PLAN), 'edit');
    if (!parsed.ok) throw new Error('form lỗi');
    expect(planPatch(PLAN, parsed.value)).toEqual({});
    const bad = parsePlanForm({ ...formFromPlan(PLAN), maxStaff: 'mười' }, 'edit');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.maxStaff).toMatch(/số nguyên/);
  });

  it('hộp Sửa gói: đổi giá → dải vàng, Lưu gửi PATCH {priceMonthly} và không gì khác', async () => {
    handler = (url, method) => (method === 'PATCH' ? { status: 200, body: { ...PLAN, priceMonthly: 349_000 } } : undefined);
    const onSaved = vi.fn();
    render(<PlanDialog state={{ plan: PLAN }} onClose={() => undefined} onSaved={onSaved} />);
    const price = screen.getByLabelText(/Giá mỗi tháng/);
    fireEvent.focus(price);
    fireEvent.change(price, { target: { value: '349000' } });
    fireEvent.blur(price);
    expect(screen.getByRole('status').textContent).toContain('mọi thuê bao đang dùng gói này');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu gói' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(seen).toEqual([{ url: '/api/v1/platform/plans/p-team', method: 'PATCH', body: { priceMonthly: 349_000 } }]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ priceMonthly: 349_000 }), true);
  });

  it('hộp Tạo gói: mã sai luật → lỗi dưới ô, không gọi máy chủ', () => {
    render(<PlanDialog state={{ plan: null }} onClose={() => undefined} onSaved={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/Mã gói/), { target: { value: 'Đội Nhỏ' } });
    fireEvent.change(screen.getByLabelText(/Tên gói/), { target: { value: 'Đội nhỏ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo gói' }));
    expect(screen.getByText(/Mã gói: chữ thường không dấu/)).toBeTruthy();
    expect(seen).toHaveLength(0);
  });
});

describe('tạm khoá cần lý do', () => {
  it('statusInput: khoá thiếu lý do → ném lỗi; mở khoá không lý do → chỉ status', () => {
    expect(() => statusInput('SUSPENDED', '   ')).toThrow('Nhập lý do tạm khoá');
    expect(statusInput('SUSPENDED', ' quá hạn ')).toEqual({ status: 'SUSPENDED', reason: 'quá hạn' });
    expect(statusInput('ACTIVE', '')).toEqual({ status: 'ACTIVE' });
  });

  it('bấm "Tạm khoá" khi trống lý do → lỗi dưới ô, không gọi; có lý do → PATCH {status, reason}', async () => {
    handler = (_u, method) => (method === 'PATCH' ? { status: 200, body: { id: 'o1', status: 'SUSPENDED' } } : undefined);
    const onDone = vi.fn();
    render(<SuspendDialog target={{ id: 'o1', name: 'Mai Anh Bridal', status: 'ACTIVE' }} onClose={() => undefined} onDone={onDone} />);
    expect(screen.getByRole('heading', { name: 'Tạm khoá Mai Anh Bridal?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạm khoá' }));
    expect(screen.getByText(/Nhập lý do trước khi tạm khoá/)).toBeTruthy();
    expect(seen).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Quá hạn 30 ngày' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạm khoá' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(seen).toEqual([{ url: '/api/v1/platform/organizations/o1', method: 'PATCH', body: { status: 'SUSPENDED', reason: 'Quá hạn 30 ngày' } }]);
  });

  it('mở khoá: lý do tuỳ chọn, gửi {status: ACTIVE}', async () => {
    handler = (_u, method) => (method === 'PATCH' ? { status: 200, body: { id: 'o1', status: 'ACTIVE' } } : undefined);
    const onDone = vi.fn();
    render(<SuspendDialog target={{ id: 'o1', name: 'Bông', status: 'SUSPENDED' }} onClose={() => undefined} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở khoá' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(seen[0]?.body).toEqual({ status: 'ACTIVE' });
  });
});

describe('thêm dòng thuê bao', () => {
  const now = new Date('2026-10-18T08:00:00.000Z'); // 15:00 giờ Việt Nam
  const base = { planId: 'p-team', status: 'ACTIVE' as const, note: '' };

  it('12 tháng nối tiếp đúng mốc hạn cũ: gửi startsAt = endsAt cũ và months, KHÔNG gửi endsAt', () => {
    const r = buildSubscriptionInput({ ...base, startDay: '2026-11-12', duration: '12', endDay: null }, '2026-11-12T03:00:00.000Z', now);
    if (!r.ok) throw new Error('lỗi');
    expect(r.input).toEqual({ planId: 'p-team', status: 'ACTIVE', startsAt: '2026-11-12T03:00:00.000Z', months: 12 });
    expect('endsAt' in r.input).toBe(false);
    expect(r.endsAt?.toISOString()).toBe('2027-11-12T03:00:00.000Z');
  });

  it('bắt đầu hôm nay → không gửi startsAt (máy chủ lấy "bây giờ"); Không hạn → endsAt: null, không months', () => {
    const r = buildSubscriptionInput({ ...base, startDay: '2026-10-18', duration: 'khong-han', endDay: null, note: ' đã nhận CK ' }, null, now);
    if (!r.ok) throw new Error('lỗi');
    expect(r.input).toEqual({ planId: 'p-team', status: 'ACTIVE', endsAt: null, note: 'đã nhận CK' });
  });

  it('Đến ngày…: endsAt 00:00 giờ VN; trước ngày bắt đầu → lỗi "Ngày hết hạn phải sau ngày bắt đầu"', () => {
    const ok = buildSubscriptionInput({ ...base, startDay: '2026-11-01', duration: 'den-ngay', endDay: '2027-01-01' }, null, now);
    if (!ok.ok) throw new Error('lỗi');
    expect(ok.input).toEqual({ planId: 'p-team', status: 'ACTIVE', startsAt: '2026-11-01T00:00:00+07:00', endsAt: '2027-01-01T00:00:00+07:00' });
    const bad = buildSubscriptionInput({ ...base, startDay: '2026-11-01', duration: 'den-ngay', endDay: '2026-10-30' }, null, now);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.endsAt).toBe('Ngày hết hạn phải sau ngày bắt đầu.');
  });

  it('cộng tháng giống máy chủ: 31/01 + 1 tháng → cuối tháng 2', () => {
    expect(addMonths(new Date('2027-01-31T05:00:00.000Z'), 1).toISOString()).toBe('2027-02-28T05:00:00.000Z');
  });

  it('mốc nối tiếp lấy từ dòng thuê bao mới nhất còn hiệu lực (kể cả kỳ đã hẹn)', () => {
    const d = {
      id: 'o1',
      name: 'Studio',
      currentSubscription: { endsAt: '2026-11-12T03:00:00.000Z' },
      effectivePlan: { source: 'subscription', plan: PLAN },
      subscriptions: [
        { id: 's2', status: 'ACTIVE', startsAt: '2026-11-12T03:00:00.000Z', endsAt: '2027-11-12T03:00:00.000Z', isCurrent: false },
        { id: 's1', status: 'ACTIVE', startsAt: '2026-10-12T03:00:00.000Z', endsAt: '2026-11-12T03:00:00.000Z', isCurrent: true },
      ],
    } as unknown as OrgDetail;
    expect(renewTargetFromDetail(d, now.getTime()).renewFrom).toBe('2027-11-12T03:00:00.000Z');
  });

  it('hộp Đổi gói / gia hạn: chỉ gói đang bán + trial; mặc định gói hiện tại, Đang dùng, 12 tháng; Lưu → POST một dòng', async () => {
    handler = (url, method) => {
      if (url.endsWith('/platform/plans')) return { status: 200, body: { items: [TRIAL, PLAN, OLD] } };
      if (method === 'POST') return { status: 201, body: { id: 's-new' } };
      return undefined;
    };
    const ends = new Date(Date.now() + 20 * 86400_000).toISOString();
    const target: RenewTarget = { id: 'o1', name: 'Studio Chiến', hasSubscription: true, planId: 'p-team', planName: 'Team', endsAt: ends, renewFrom: ends };
    const onSaved = vi.fn();
    render(<SubscriptionDialog target={target} onClose={() => undefined} onSaved={onSaved} />);
    const select = (await screen.findByLabelText('Gói cước')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('p-team'));
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Chọn gói', 'Dùng thử · 0 ₫/tháng', 'Team · 299.000 ₫/tháng']);
    expect(screen.getByRole('radio', { name: 'Đang dùng' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '12 tháng' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Thêm một dòng thuê bao mới; dòng cũ giữ làm lịch sử.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thuê bao' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = seen.find((s) => s.method === 'POST');
    expect(post?.url).toBe('/api/v1/platform/organizations/o1/subscriptions');
    expect(post?.body).toEqual({ planId: 'p-team', status: 'ACTIVE', startsAt: ends, months: 12 });
  });

  it('409 từ máy chủ → dải đỏ trong hộp, chữ máy chủ, hộp không đóng', async () => {
    handler = (url, method) => {
      if (url.endsWith('/platform/plans')) return { status: 200, body: { items: [PLAN] } };
      if (method === 'POST') {
        return { status: 409, body: { error: { code: 'CONFLICT', message: 'Ngày bắt đầu không được trước ngày bắt đầu của thuê bao mới nhất' } } };
      }
      return undefined;
    };
    const onClose = vi.fn();
    const target: RenewTarget = { id: 'o1', name: 'X', hasSubscription: false, planId: 'p-team', planName: 'Team', endsAt: null, renewFrom: null };
    render(<SubscriptionDialog target={target} onClose={onClose} onSaved={() => undefined} />);
    await waitFor(() => expect((screen.getByLabelText('Gói cước') as HTMLSelectElement).value).toBe('p-team'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thuê bao' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ngày bắt đầu không được trước ngày bắt đầu của thuê bao mới nhất');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('hạn mức null hiện "Không giới hạn"', () => {
  it('định dạng', () => {
    expect(fmtLimit(null)).toBe('Không giới hạn');
    expect(fmtMb(null)).toBe('Không giới hạn');
    expect(fmtLimit(1200)).toBe('1.200');
    expect(fmtMb(5120)).toBe('5 GB');
    expect(fmtMb(412)).toBe('412 MB');
  });

  it('thẻ gói: 5 dòng hạn mức + tên miền riêng, null → "Không giới hạn"', () => {
    const p = { ...PLAN, maxAppointmentsPerMonth: null };
    expect(planLimitLines(p)).toEqual([
      'Thành viên: 10',
      'Lịch mỗi tháng: Không giới hạn',
      'Dung lượng: 5 GB',
      'Học viên: Không giới hạn',
      'Khoá học: Không giới hạn',
      'Tên miền riêng: không',
    ]);
    render(<PlanCard plan={p} onEdit={() => undefined} />);
    expect(screen.getByText('Lịch mỗi tháng: Không giới hạn')).toBeTruthy();
    expect(screen.getByText('Đang bán')).toBeTruthy();
  });

  it('mức dùng: giới hạn null → "x / Không giới hạn", không vẽ thanh; ≥ 90% → thanh đỏ; không vẽ Học viên/Khoá học', () => {
    const d = {
      effectivePlan: { source: 'subscription', plan: { ...PLAN, maxAppointmentsPerMonth: null } },
      usage: { staff: 9, appointmentsThisMonth: 188, storageMb: 412, students: null, courses: null },
    } as unknown as OrgDetail;
    render(<UsageBars detail={d} />);
    expect(screen.getByTestId('muc-dung-appointments').textContent).toContain('188 / Không giới hạn');
    expect(within(screen.getByTestId('muc-dung-appointments')).queryByRole('meter')).toBeNull();
    const staff = within(screen.getByTestId('muc-dung-staff')).getByRole('meter');
    expect(staff.getAttribute('aria-valuenow')).toBe('90');
    expect(staff.querySelector('i')?.className).toBe('hi');
    expect(screen.getByTestId('muc-dung-storage').textContent).toContain('412 MB / 5 GB');
    expect(document.body.textContent).not.toMatch(/Học viên|Khoá học/);
  });
});
