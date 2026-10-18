import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment, StaffMember } from '../../api/types';
import { ScheduleScreen } from './index';
import type { ScheduleAccess } from './model';

// Màn Lịch chạy thật (router, gọi API qua src/api/schedule.ts) với máy chủ giả lập qua fetch.
// Hôm nay = Thứ Tư 21/10/2026 (giờ Việt Nam) → tuần 19 – 25/10/2026.

const ORG_ID = 'org-1';

function staffRow(membershipId: string, displayName: string, initials: string, tier: string | null): StaffMember {
  return {
    membershipId,
    userId: `u-${membershipId}`,
    fullName: displayName,
    displayName,
    initials,
    avatarUrl: null,
    phone: null,
    tier: tier ? { id: `t-${tier}`, name: tier, isActive: true } : null,
    isBookable: true,
    hasProfile: true,
    status: 'ACTIVE',
    roleKeys: ['artist'],
  };
}

const STAFF = [staffRow('m-ha', 'Thu Hà', 'TH', 'Thợ chính'), staffRow('m-anh', 'Minh Anh', 'MA', 'Thợ chính'), staffRow('m-vy', 'Bảo Vy', 'BV', 'Thợ phụ')];

function a(id: string, code: string, start: string, end: string, staff: string[], extra: Partial<Appointment> = {}): Appointment {
  return {
    id,
    code,
    kind: 'MAKEUP',
    title: 'Makeup cô dâu',
    status: 'CONFIRMED',
    customer: { id: `c-${id}`, fullName: `Khách ${code}`, phone: '0912345678' },
    contract: null,
    contractLineId: null,
    subjectName: null,
    startsAt: start,
    endsAt: end,
    travelBeforeMin: 0,
    travelAfterMin: 0,
    locationType: null,
    address: null,
    latitude: null,
    longitude: null,
    notes: null,
    cancelReason: null,
    staff: staff.map((m, i) => ({
      membershipId: m,
      fullName: STAFF.find((s) => s.membershipId === m)?.displayName ?? m,
      displayName: STAFF.find((s) => s.membershipId === m)?.displayName ?? m,
      avatarUrl: null,
      role: i === 0 ? 'PRIMARY' : 'ASSIST',
      blockStart: start,
      blockEnd: end,
      isBlocking: true,
    })),
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...extra,
  };
}

const APPTS: Appointment[] = [
  a('a1', 'L-0001', '2026-10-24T06:00:00+07:00', '2026-10-24T07:30:00+07:00', ['m-ha'], { subjectName: 'Cô dâu' }),
  a('a2', 'L-0002', '2026-10-24T05:00:00+07:00', '2026-10-24T06:30:00+07:00', ['m-anh'], { title: 'Makeup ăn hỏi' }),
  a('a3', 'L-0003', '2026-10-24T15:00:00+07:00', '2026-10-24T16:00:00+07:00', [], { title: 'Makeup tiệc' }),
  a('a4', 'L-0004', '2026-10-21T09:00:00+07:00', '2026-10-21T15:00:00+07:00', ['m-vy'], {
    contract: { id: 'hd-9', code: 'HD-0009', status: 'CONFIRMED' },
    contractLineId: 'line-1',
    subjectName: 'Phù dâu',
  }),
];

const CONFLICT = {
  appointmentId: 'a1',
  code: 'L-0001',
  startsAt: '2026-10-24T06:00:00+07:00',
  endsAt: '2026-10-24T07:30:00+07:00',
  blockStart: '2026-10-24T06:00:00+07:00',
  blockEnd: '2026-10-24T07:30:00+07:00',
  membershipId: 'm-ha',
  staffName: 'Thu Hà',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let calls: { method: string; url: string; body: unknown }[] = [];

function setupServer(opts: { items?: Appointment[]; ownOnly?: string } = {}) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (method === 'GET' && url.includes('/appointments?')) {
        const items = (opts.items ?? APPTS).filter((x) => !opts.ownOnly || x.staff.some((s) => s.membershipId === opts.ownOnly));
        return json(200, { items, from: '', to: '' });
      }
      if (method === 'GET' && url.endsWith(`/orgs/${ORG_ID}/staff`)) return json(200, { items: STAFF });
      if (method === 'POST' && url.endsWith('/appointments')) {
        return json(409, { error: { code: 'CONFLICT', message: 'Trùng lịch: Thu Hà đã có lịch L-0001', details: { conflicts: [CONFLICT] }, requestId: 'r' } });
      }
      return json(404, { error: { code: 'NOT_FOUND', message: 'Không có đường API này', requestId: 'r' } });
    }),
  );
}

const OWNER: ScheduleAccess = { readAll: true, write: true, staffRead: true, customersRead: true, customersWrite: true, contractsRead: true, catalogRead: false };
const ARTIST: ScheduleAccess = { readAll: false, write: false, staffRead: true, customersRead: false, customersWrite: false, contractsRead: false, catalogRead: false };

function renderScreen(access: ScheduleAccess, self = { membershipId: 'm-chu', name: 'Nguyễn Trọng Chiến' }) {
  const router = createMemoryRouter(
    [
      { path: '/:orgSlug/lich', element: <ScheduleScreen orgId={ORG_ID} orgSlug="hoa-dao" self={self} access={access} /> },
      { path: '/:orgSlug/hop-dong/:id', element: <p>Trang hợp đồng</p> },
    ],
    { initialEntries: ['/hoa-dao/lich'] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

function currentMode(): string | null {
  return document.querySelector('[data-mode]')?.getAttribute('data-mode') ?? null;
}

function modeButton(name: string) {
  return within(screen.getByRole('radiogroup', { name: 'Chế độ xem lịch' })).getByRole('radio', { name });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T03:00:00Z'));
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mặc định chế độ C, đổi chế độ', () => {
  it('mở màn là C (lưới thợ × ngày), tuần chứa hôm nay, gọi đúng khoảng from/to giờ Việt Nam', async () => {
    setupServer();
    renderScreen(OWNER);
    expect(await screen.findByTestId('che-do-C')).toBeTruthy();
    expect(currentMode()).toBe('C');
    expect(modeButton('Thợ × ngày').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('19 – 25/10/2026')).toBeTruthy();
    const list = calls.find((c) => c.url.includes('/appointments?'));
    expect(decodeURIComponent(list?.url ?? '')).toContain('from=2026-10-19T00:00:00+07:00&to=2026-10-26T00:00:00+07:00');
  });

  it('đổi sang B rồi A; mở lại màn thì vẫn là C (không nhớ lựa chọn trước, không ghi localStorage)', async () => {
    setupServer();
    const first = renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Ngày'));
    expect(currentMode()).toBe('B');
    expect(screen.getByTestId('che-do-B')).toBeTruthy();
    fireEvent.click(modeButton('Cột thợ'));
    expect(currentMode()).toBe('A');
    expect(screen.getByTestId('che-do-A')).toBeTruthy();
    // A là xem theo ngày: nhãn điều hướng đổi sang ngày.
    expect(screen.getByText('Thứ Tư, 21/10/2026')).toBeTruthy();
    first.unmount();

    renderScreen(OWNER);
    expect(await screen.findByTestId('che-do-C')).toBeTruthy();
    expect(currentMode()).toBe('C');
    expect(window.localStorage.length).toBe(0);
  });

  it('lưới C: đủ hàng thợ + "Chưa có thợ", ca nằm đúng ô, đầu cột có số ca', async () => {
    setupServer();
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    const rows = screen.getAllByRole('rowheader').map((r) => r.textContent);
    expect(rows).toEqual(['THThu HàThợ chính · 1 ca/tuần', 'MAMinh AnhThợ chính · 1 ca/tuần', 'BVBảo VyThợ phụ · 1 ca/tuần', '?Chưa có thợ1 ca/tuần']);
    const cell = document.querySelector('[data-cell="m-ha|2026-10-24"]') as HTMLElement;
    expect(within(cell).getByText('06:00')).toBeTruthy();
    expect(within(cell).getByText('Khách L-0001')).toBeTruthy();
    expect(document.querySelector('[data-cell="chua-co-tho|2026-10-24"]')?.textContent).toContain('15:00');
    const sat = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('24/10'));
    expect(sat?.textContent).toBe('Thứ Bảy24/103 ca');
  });
});

describe('màu ca theo nhân vật', () => {
  it('ô ca tô theo subjectName, ca không có nhân vật là "Khác" (dù tên ca có chữ "ăn hỏi"); chú thích liệt kê nhân vật thật trong tuần', async () => {
    setupServer();
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    expect(document.querySelector('[data-appt="a1"]')?.className).toContain('ws-sw-rose');
    expect(document.querySelector('[data-appt="a4"]')?.className).toContain('ws-sw-amber');
    // a2 tên "Makeup ăn hỏi" nhưng subjectName null → Khác.
    expect(document.querySelector('[data-appt="a2"]')?.className).toContain('ws-sw-other');
    const legend = screen.getByLabelText('Chú thích màu');
    expect([...legend.querySelectorAll('.ws-legend__i')].map((x) => x.textContent)).toEqual([
      'Cô dâu',
      'Phù dâu',
      'Khác',
      'Chưa có thợ',
      'Không chặn lịch',
    ]);
    expect(legend.textContent).not.toMatch(/Ăn hỏi|Tiệc & sự kiện/);
  });
});

describe('quyền xem', () => {
  it('chỉ schedule.read_own: không gửi membershipId, một hàng là chính mình, không có "Thêm lịch" và hàng "Chưa có thợ"', async () => {
    setupServer({ ownOnly: 'm-anh' });
    renderScreen(ARTIST, { membershipId: 'm-anh', name: 'Minh Anh' });
    await screen.findByTestId('che-do-C');
    const list = calls.find((c) => c.url.includes('/appointments?'));
    expect(list?.url).not.toContain('membershipId');
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent)).toEqual(['MAMinh AnhThợ chính · 1 ca/tuần']);
    expect(screen.queryByRole('button', { name: 'Thêm lịch' })).toBeNull();
    // Mở ca của mình: không có nút sửa / đổi trạng thái.
    fireEvent.click(screen.getByText('Khách L-0002'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).queryByRole('button', { name: 'Sửa' })).toBeNull();
    expect(within(dlg).queryByRole('button', { name: 'Huỷ lịch' })).toBeNull();
  });

  it('schedule.read_all + schedule.write: có "Thêm lịch"; ca hiện nút trạng thái đúng bảng chuyển', async () => {
    setupServer();
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    expect(screen.getByRole('button', { name: 'Thêm lịch' })).toBeTruthy();
    fireEvent.click(screen.getByText('Khách L-0001'));
    const dlg = await screen.findByRole('dialog');
    const names = within(dlg)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(expect.arrayContaining(['Bắt đầu làm', 'Huỷ lịch', 'Khách không đến', 'Sửa']));
    expect(names).not.toContain('Hoàn thành');
  });

  it('ca gắn hợp đồng: liên kết sang /:orgSlug/hop-dong/:id, không hiện số tiền', async () => {
    setupServer();
    const { router } = renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(screen.getByText('Khách L-0004'));
    const dlg = await screen.findByRole('dialog');
    const link = within(dlg).getByRole('link', { name: 'HD-0009' });
    expect(link.getAttribute('href')).toBe('/hoa-dao/hop-dong/hd-9');
    expect(dlg.textContent).not.toMatch(/₫/);
    fireEvent.click(link);
    expect(router.state.location.pathname).toBe('/hoa-dao/hop-dong/hd-9');
  });
});

describe('409 trùng lịch', () => {
  it('giữ hộp thoại, hiện dải đỏ đúng chữ, nhãn "1 ca trùng lịch" trên thanh công cụ, viền đỏ ô của ca trùng', async () => {
    setupServer();
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    expect(screen.queryByText(/ca trùng lịch/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm lịch' }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText(/^Ngày/), { target: { value: '24/10/2026' } });
    fireEvent.change(within(dlg).getByLabelText('Giờ bắt đầu'), { target: { value: '06:30' } });
    fireEvent.change(within(dlg).getByLabelText('Giờ kết thúc'), { target: { value: '08:00' } });
    fireEvent.click(within(dlg).getByRole('checkbox', { name: /Thu Hà/ }));
    fireEvent.click(within(dlg).getByRole('radio', { name: 'Đã xác nhận' }));
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu lịch' }));
    });

    const banner = await within(dlg).findByTestId('bang-trung-lich');
    expect(banner.textContent).toContain('Trùng lịch: Thu Hà đã có lịch L-0001 06:00–07:30');
    expect(within(banner).getByRole('button', { name: 'Đổi thợ' })).toBeTruthy();
    expect(within(banner).getByRole('button', { name: 'Đổi giờ' })).toBeTruthy();
    expect(screen.getByRole('dialog')).toBe(dlg);
    expect(screen.getByText('1 ca trùng lịch')).toBeTruthy();
    expect(document.querySelector('[data-cell="m-ha|2026-10-24"]')?.className).toContain('is-conf');
    expect(document.querySelector('[data-appt="a1"]')?.className).toContain('is-x');

    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({
      startsAt: '2026-10-24T06:30:00+07:00',
      endsAt: '2026-10-24T08:00:00+07:00',
      staff: [{ membershipId: 'm-ha', role: 'PRIMARY' }],
      status: 'CONFIRMED',
    });

    // "Đổi giờ" đưa tiêu điểm về ô giờ bắt đầu; đóng hộp thì hết nhãn trùng và viền đỏ.
    fireEvent.click(within(banner).getByRole('button', { name: 'Đổi giờ' }));
    expect(document.activeElement).toBe(within(dlg).getByLabelText('Giờ bắt đầu'));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Huỷ' }));
    expect(screen.queryByText('1 ca trùng lịch')).toBeNull();
    expect(document.querySelector('[data-cell="m-ha|2026-10-24"]')?.className).not.toContain('is-conf');
  });
});
