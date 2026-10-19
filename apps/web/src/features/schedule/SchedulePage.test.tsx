import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment, StaffMember } from '../../api/types';
import { ScheduleScreen } from './index';
import type { ScheduleAccess } from './model';

// Màn Lịch chạy thật (router, gọi API qua src/api/schedule.ts) với máy chủ giả lập qua fetch.
// Hôm nay = Thứ Tư 21/10/2026 (giờ Việt Nam) → tuần 19 – 25/10/2026.

const ORG_ID = 'org-1';

// fullName = họ tên tài khoản; mặc định trùng tên hiển thị (studio chưa đặt tên hiển thị).
function staffRow(membershipId: string, displayName: string, initials: string, tier: string | null, fullName = displayName): StaffMember {
  return {
    membershipId,
    userId: `u-${membershipId}`,
    fullName,
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

// Studio đã đặt tên hiển thị khác họ tên → tên ngắn đầu hàng là nguyên tên hiển thị (ui/staffName.ts).
const STAFF = [
  staffRow('m-ha', 'Thu Hà', 'TH', 'Thợ chính', 'Nguyễn Thu Hà'),
  staffRow('m-anh', 'Minh Anh', 'MA', 'Thợ chính', 'Trần Minh Anh'),
  staffRow('m-vy', 'Bảo Vy', 'BV', 'Thợ phụ', 'Phạm Bảo Vy'),
];

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
    quantity: null,
    courseClass: null,
    sessionDate: null,
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
      fullName: STAFF.find((s) => s.membershipId === m)?.fullName ?? m,
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
    expect(rows).toEqual(['THThu HàThợ chính1 ca/tuần', 'MAMinh AnhThợ chính1 ca/tuần', 'BVBảo VyThợ phụ1 ca/tuần', '?Chưa có thợ1 ca/tuần']);
    // L3: bậc thợ và "n ca/tuần" là hai dòng riêng; "1 ca/tuần" không được bẻ dòng.
    const meta = [...document.querySelectorAll('[role="rowheader"] .ws-c__meta')].map((m) => m.textContent);
    expect(meta.slice(0, 2)).toEqual(['Thợ chính', '1 ca/tuần']);
    expect(document.querySelectorAll('[role="rowheader"] .ws-c__meta.ws-nb')).toHaveLength(4);
    const cell = document.querySelector('[data-cell="m-ha|2026-10-24"]') as HTMLElement;
    expect(within(cell).getByText('06:00')).toBeTruthy();
    expect(within(cell).getByText('Khách L-0001')).toBeTruthy();
    expect(document.querySelector('[data-cell="chua-co-tho|2026-10-24"]')?.textContent).toContain('15:00');
    const sat = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('24/10'));
    expect(sat?.textContent).toBe('Thứ Bảy24/103 ca');
  });
});

describe('chữ viết tắt ảnh đại diện: một người một kiểu trên mọi chỗ (biên bản cuối L2)', () => {
  it('"Trần Khánh Linh": đầu hàng (chữ máy chủ "TL") và thẻ ca (web tự tính theo luật máy chủ) cùng là "TL" ở C, B và A', async () => {
    const linh = staffRow('m-linh', 'Trần Khánh Linh', 'TL', 'Thợ chính');
    const appt = a('a9', 'L-0009', '2026-10-21T06:00:00+07:00', '2026-10-21T07:00:00+07:00', [], {
      subjectName: 'Cô dâu',
      staff: [{ membershipId: 'm-linh', fullName: 'Trần Khánh Linh', displayName: 'Trần Khánh Linh', avatarUrl: null, role: 'PRIMARY', blockStart: '2026-10-21T06:00:00+07:00', blockEnd: '2026-10-21T07:00:00+07:00', isBlocking: true }],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/appointments?')) return json(200, { items: [appt], from: '', to: '' });
        if (url.endsWith(`/orgs/${ORG_ID}/staff`)) return json(200, { items: [linh] });
        return json(404, { error: { code: 'NOT_FOUND', message: 'Không có', requestId: 'r' } });
      }),
    );
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    const texts = () => screen.getAllByRole('img', { name: 'Trần Khánh Linh' }).map((el) => el.textContent);
    expect(texts().length).toBeGreaterThan(0);
    expect(new Set(texts())).toEqual(new Set(['TL']));
    fireEvent.click(modeButton('Ngày'));
    await screen.findByTestId('che-do-B');
    // Chip lọc (chữ máy chủ) + thẻ ca (tự tính) + bảng thợ trong ngày.
    expect(texts().length).toBeGreaterThanOrEqual(2);
    expect(new Set(texts())).toEqual(new Set(['TL']));
    fireEvent.click(modeButton('Cột thợ'));
    await screen.findByTestId('che-do-A');
    expect(new Set(texts())).toEqual(new Set(['TL']));
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

describe('L7: ca phù dâu 2 người ghi "× 2" ở mọi chế độ lịch', () => {
  // a4 (Thứ Tư 21/10 = hôm nay): dòng hợp đồng số lượng 2. q1: dòng số lượng 1. free: ca không gắn dòng hợp đồng.
  const ITEMS: Appointment[] = [
    a('a4', 'L-0004', '2026-10-21T09:00:00+07:00', '2026-10-21T11:00:00+07:00', ['m-vy'], {
      title: 'Makeup phù dâu',
      contract: { id: 'hd-9', code: 'HD-0009', status: 'CONFIRMED' },
      contractLineId: 'line-1',
      subjectName: 'Phù dâu',
      quantity: 2,
    }),
    a('q1', 'L-0011', '2026-10-21T06:00:00+07:00', '2026-10-21T07:00:00+07:00', ['m-ha'], {
      contract: { id: 'hd-9', code: 'HD-0009', status: 'CONFIRMED' },
      contractLineId: 'line-2',
      subjectName: 'Cô dâu',
      quantity: 1,
    }),
    a('free', 'L-0012', '2026-10-21T13:00:00+07:00', '2026-10-21T14:00:00+07:00', ['m-anh'], { title: 'Makeup tiệc' }),
  ];
  const textOf = (sel: string) => [...document.querySelectorAll(sel)].map((el) => el.textContent ?? '');

  it('BẮT: lưới C (ô ca + tooltip), B, A và hộp chi tiết đều có "× 2" cho a4; ca số lượng 1 / không gắn dòng không có "×"', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    const chip = document.querySelector('[data-appt="a4"]') as HTMLElement;
    // "× 2" là thẻ riêng (không bị cắt "…" cùng tên loại ca), nằm cùng dòng giờ.
    expect(chip.querySelector('.ws-chip__kind')?.textContent).toBe('Phù dâu');
    expect(chip.querySelector('.ws-chip__top .ws-chip__qty')?.textContent).toBe('× 2');
    expect(document.querySelector('[data-appt="q1"] .ws-chip__kind')?.textContent).toBe('Cô dâu');
    expect(document.querySelector('[data-appt="free"] .ws-chip__kind')?.textContent).toBe('Tiệc');
    expect(document.querySelectorAll('[data-appt="q1"] .ws-chip__qty, [data-appt="free"] .ws-chip__qty')).toHaveLength(0);
    expect(document.body.textContent).toContain('Makeup phù dâu × 2'); // tooltip đầy đủ (apptTip)

    fireEvent.click(modeButton('Ngày'));
    await screen.findByTestId('che-do-B');
    const b = textOf('.ws-item__sv');
    expect(b.filter((t) => t.includes('× 2'))).toHaveLength(1);
    expect(b.some((t) => t.startsWith('Makeup phù dâu × 2'))).toBe(true);
    expect(b.filter((t) => t.includes('×'))).toHaveLength(1);

    fireEvent.click(modeButton('Cột thợ'));
    await screen.findByTestId('che-do-A');
    const a4 = document.querySelector('[data-appt="a4"]') as HTMLElement;
    expect(a4.textContent).toContain('Makeup phù dâu × 2');
    expect(a4.getAttribute('title')).toContain('Makeup phù dâu × 2');
    expect(document.querySelector('[data-appt="q1"]')?.textContent).not.toContain('×');
    expect(document.querySelector('[data-appt="free"]')?.textContent).not.toContain('×');

    fireEvent.click(a4);
    const dlg = await screen.findByRole('dialog');
    expect(dlg.textContent).toContain('L-0004 · Makeup phù dâu × 2');
  });

  it('BẮT (CSS): thẻ "× n" không co, không cắt, và KHÔNG bị ẩn ở khổ máy tính bảng (chỉ tên loại ca bị ẩn/rút gọn)', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schedule.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: (m[1] ?? '').trim(), body: m[2] ?? '' }));
    const qty = rules.filter((r) => r.sel.split(',').some((x) => x.trim().endsWith('.ws-chip__qty')));
    expect(qty.length).toBeGreaterThan(0);
    expect(qty.some((r) => /flex:\s*none/.test(r.body))).toBe(true);
    for (const r of qty) {
      expect(r.body).not.toMatch(/display:\s*none|overflow:\s*hidden|text-overflow/);
    }
    // Tên loại ca vẫn là phần rút gọn "…" (và bị ẩn ở máy tính bảng như cũ).
    expect(rules.some((r) => r.sel === '.ws-chip__kind' && /text-overflow:\s*ellipsis/.test(r.body))).toBe(true);
  });

  it('BẮT (M2): chế độ "Cột thợ" — "× 2" là thẻ riêng ws-ev__qty, tên loại ca là phần riêng ws-ev__kind; ca số lượng 1 / không gắn dòng không có thẻ', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Cột thợ'));
    await screen.findByTestId('che-do-A');
    const sv = document.querySelector('[data-appt="a4"] .ws-ev__sv') as HTMLElement;
    expect(sv.querySelector('.ws-ev__kind')?.textContent).toBe('Makeup phù dâu');
    expect(sv.querySelector(':scope > .ws-ev__qty')?.textContent).toBe('× 2');
    // GIỮ: chữ đọc liền vẫn là "Makeup phù dâu × 2" (có dấu cách cho trình đọc màn hình).
    expect(sv.textContent).toBe('Makeup phù dâu × 2');
    expect(document.querySelectorAll('[data-appt="q1"] .ws-ev__qty, [data-appt="free"] .ws-ev__qty')).toHaveLength(0);
    expect(document.querySelector('[data-appt="free"] .ws-ev__kind')?.textContent).toBe('Makeup tiệc');
  });

  it('BẮT (M2, CSS): ô ca chế độ "Cột thợ" — thẻ "× n" không co, không cắt ở mọi khổ; ô chứa không cắt; chỉ tên loại ca rút "…"', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schedule.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: (m[1] ?? '').trim(), body: m[2] ?? '' }));
    const ending = (cls: string) => rules.filter((r) => r.sel.split(',').some((x) => x.trim().endsWith(cls)));
    const qty = ending('.ws-ev__qty');
    expect(qty.length).toBeGreaterThan(0);
    expect(qty.some((r) => /flex:\s*none/.test(r.body))).toBe(true);
    for (const r of qty) expect(r.body).not.toMatch(/display:\s*none|overflow:\s*hidden|text-overflow/);
    const sv = ending('.ws-ev__sv');
    expect(sv.some((r) => /display:\s*flex/.test(r.body))).toBe(true);
    for (const r of sv) expect(r.body).not.toMatch(/overflow:\s*hidden|text-overflow/);
    expect(ending('.ws-ev__kind').some((r) => /text-overflow:\s*ellipsis/.test(r.body) && /min-width:\s*0/.test(r.body))).toBe(true);
  });

  it('BẮT: lưới C trên điện thoại (WeekGridCMobile) cũng ghi "× 2"', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(max-width: 640px)',
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await waitFor(() => expect(document.querySelectorAll('.ws-ag__kind').length).toBeGreaterThan(0));
    expect(document.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('C');
    const kinds = textOf('.ws-ag__kind');
    expect(kinds.filter((t) => t.includes('Makeup phù dâu × 2')).length).toBeGreaterThan(0);
    expect(kinds.filter((t) => t.includes('×')).every((t) => t.includes('Makeup phù dâu × 2'))).toBe(true);
  });
});

describe('M4: đầu cột "Chưa có thợ" ở chế độ "Cột thợ" không bị cắt "Chưa có t…"', () => {
  it('BẮT: đầu cột ca chưa phân thợ là is-na, ghi đủ "Chưa có thợ"', async () => {
    setupServer();
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Cột thợ'));
    await screen.findByTestId('che-do-A');
    const heads = [...document.querySelectorAll('.ws-a__colh')];
    const na = heads.filter((h) => h.classList.contains('is-na'));
    expect(na).toHaveLength(1);
    expect(na[0]?.querySelector('.ws-a__nm')?.textContent).toBe('Chưa có thợ');
    expect(heads.at(-1)).toBe(na[0]);
  });

  // R3 (biên bản lần 3) đổi luật: MỌI tên đầu cột xuống dòng giữa các chữ (tên đầy đủ khi trùng tiếng cuối từng bị cắt
  // "Phạm Thu …"), nên "Chưa có thợ" xuống dòng nhờ chính luật chung .ws-a__nm.
  it('BẮT (CSS): tên đầu cột — kể cả "Chưa có thợ" — xuống dòng (white-space: normal), không cắt "…"', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schedule.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: (m[1] ?? '').trim(), body: m[2] ?? '' }));
    const hit = rules.filter((r) => r.sel.split(',').some((x) => ['.ws-a__nm', '.ws-a__colh.is-na .ws-a__nm'].includes(x.trim())));
    expect(hit.length).toBeGreaterThan(0);
    for (const r of hit) expect(r.body).not.toMatch(/text-overflow:\s*ellipsis|white-space:\s*nowrap/);
    const base = rules.find((r) => r.sel === '.ws-a__nm')?.body ?? '';
    expect(base).toMatch(/white-space:\s*normal/);
  });
});

describe('quyền xem', () => {
  it('chỉ schedule.read_own: không gửi membershipId, một hàng là chính mình, không có "Thêm lịch" và hàng "Chưa có thợ"', async () => {
    setupServer({ ownOnly: 'm-anh' });
    renderScreen(ARTIST, { membershipId: 'm-anh', name: 'Minh Anh' });
    await screen.findByTestId('che-do-C');
    const list = calls.find((c) => c.url.includes('/appointments?'));
    expect(list?.url).not.toContain('membershipId');
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent)).toEqual(['MAMinh AnhThợ chính1 ca/tuần']);
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

// Biên bản web 2, T3 (sửa quyết định 7 cũ của thợ W6): giờ kết thúc ≤ giờ bắt đầu là lỗi, trừ khi tick "Kết thúc hôm sau".
describe('T3: giờ kết thúc trước giờ bắt đầu', () => {
  async function openCreate() {
    setupServer();
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm lịch' }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText(/^Ngày/), { target: { value: '24/10/2026' } });
    fireEvent.change(within(dlg).getByLabelText('Giờ bắt đầu'), { target: { value: '09:00' } });
    fireEvent.change(within(dlg).getByLabelText('Giờ kết thúc'), { target: { value: '08:30' } });
    return dlg;
  }

  it('09:00 – 08:30 không tick → báo lỗi dưới ô NGAY, bấm Lưu không gửi gì', async () => {
    const dlg = await openCreate();
    expect(within(dlg).getByText('Giờ kết thúc phải sau giờ bắt đầu')).toBeTruthy();
    expect(within(dlg).queryByText(/Kết thúc Chủ nhật/)).toBeNull();
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu lịch' }));
    });
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(screen.getByRole('dialog')).toBe(dlg);
  });

  it('tick "Kết thúc hôm sau" → hết lỗi, ghi rõ ngày kết thúc, gửi endsAt ngày hôm sau', async () => {
    const dlg = await openCreate();
    fireEvent.click(within(dlg).getByRole('checkbox', { name: 'Kết thúc hôm sau' }));
    expect(within(dlg).queryByText('Giờ kết thúc phải sau giờ bắt đầu')).toBeNull();
    expect(within(dlg).getByText('Kết thúc Chủ nhật 25/10')).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu lịch' }));
    });
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({ startsAt: '2026-10-24T09:00:00+07:00', endsAt: '2026-10-25T08:30:00+07:00' });
  });

  it('đã tick mà giờ kết thúc muộn hơn giờ bắt đầu (ca > 24 giờ) → báo lỗi, không gửi', async () => {
    const dlg = await openCreate();
    fireEvent.click(within(dlg).getByRole('checkbox', { name: 'Kết thúc hôm sau' }));
    fireEvent.change(within(dlg).getByLabelText('Giờ kết thúc'), { target: { value: '10:00' } });
    expect(within(dlg).getByText(/Ca qua đêm tối đa 24 giờ/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu lịch' }));
    });
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('09:00 – 10:00 bình thường: không lỗi, không tick, cùng ngày', async () => {
    const dlg = await openCreate();
    fireEvent.change(within(dlg).getByLabelText('Giờ kết thúc'), { target: { value: '10:00' } });
    expect(within(dlg).queryByText('Giờ kết thúc phải sau giờ bắt đầu')).toBeNull();
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu lịch' }));
    });
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ endsAt: '2026-10-24T10:00:00+07:00' });
  });
});

describe('Buổi học trên Lịch (việc tồn 6)', () => {
  // Buổi học của lớp "K12 tối" (Thứ Tư 21/10 = hôm nay), giảng viên Thu Hà; cạnh một ca makeup thường của Minh Anh.
  const SESSION = a('bh1', 'LH-0101', '2026-10-21T18:00:00+07:00', '2026-10-21T20:00:00+07:00', ['m-ha'], {
    kind: 'COURSE_SESSION',
    title: null,
    customer: null,
    courseClass: { id: 'k12', name: 'K12 tối', courseId: 'kh-1', courseName: 'Makeup cá nhân' },
    sessionDate: '2026-10-21',
    locationType: 'STUDIO',
    address: '25 Hoàng Quốc Việt',
  });
  const MAKEUP = a('mk1', 'L-0201', '2026-10-21T08:00:00+07:00', '2026-10-21T09:00:00+07:00', ['m-anh'], { title: 'Makeup tiệc' });
  const ITEMS = [SESSION, MAKEUP];

  it('BẮT: lưới C, B, A đều ghi "Buổi học" + tên lớp và tô màu riêng (is-course); ca makeup không bị tô; chú thích có "Buổi học"', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    const chip = document.querySelector('[data-appt="bh1"]') as HTMLElement;
    expect(chip.classList.contains('is-course')).toBe(true);
    expect(chip.querySelector('.ws-chip__kind')?.textContent).toBe('Buổi học');
    expect(chip.querySelector('.ws-chip__who')?.textContent).toBe('K12 tối');
    expect(document.querySelector('[data-appt="mk1"]')?.classList.contains('is-course')).toBe(false);
    expect(document.body.textContent).toContain('Lớp K12 tối'); // tooltip
    expect(screen.getByLabelText('Chú thích màu').textContent).toContain('Buổi học');

    fireEvent.click(modeButton('Ngày'));
    await screen.findByTestId('che-do-B');
    const item = [...document.querySelectorAll('.ws-item')].find((el) => el.textContent?.includes('K12 tối')) as HTMLElement;
    expect(item.classList.contains('is-course')).toBe(true);
    expect(item.querySelector('.ws-item__sv')?.textContent).toContain('Buổi học');
    expect(item.querySelector('.ws-item__kh')?.textContent).toBe('K12 tối');

    fireEvent.click(modeButton('Cột thợ'));
    await screen.findByTestId('che-do-A');
    const ev = document.querySelector('[data-appt="bh1"]') as HTMLElement;
    expect(ev.classList.contains('is-course')).toBe(true);
    expect(ev.querySelector('.ws-ev__kind')?.textContent).toBe('Buổi học');
    expect(ev.querySelector('.ws-ev__kh')?.textContent).toBe('K12 tối');
  });

  it('BẮT: bấm vào buổi học mở chi tiết: tên lớp, khoá, giảng viên, nơi học; KHÔNG có nút "Sửa" (lịch theo lớp), vẫn đổi trạng thái được', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(document.querySelector('[data-appt="bh1"]') as HTMLElement);
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('heading').textContent).toContain('K12 tối');
    expect(dlg.textContent).toContain('LH-0101 · Buổi học');
    expect(dlg.textContent).toContain('Makeup cá nhân');
    expect(dlg.textContent).toContain('Giảng viên');
    expect(dlg.textContent).not.toContain('Chưa gắn khách');
    expect(within(dlg).getByRole('link', { name: 'Mở khoá học' }).getAttribute('href')).toBe('/hoa-dao/dao-tao/kh-1');
    expect(within(dlg).queryByRole('button', { name: 'Sửa' })).toBeNull();
    expect(within(dlg).getByRole('button', { name: 'Bắt đầu làm' })).toBeTruthy();
  });

  it('GIỮ: ca makeup thường vẫn có nút "Sửa" và dòng "Khách"', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(document.querySelector('[data-appt="mk1"]') as HTMLElement);
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('button', { name: 'Sửa' })).toBeTruthy();
    expect(dlg.textContent).toContain('Khách L-0201');
  });

  it('BẮT: lưới C trên điện thoại ghi "Buổi học" + tên lớp, màu riêng', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(max-width: 640px)',
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await waitFor(() => expect(document.querySelectorAll('.ws-ag').length).toBeGreaterThan(0));
    const row = [...document.querySelectorAll('.ws-ag')].find((el) => el.textContent?.includes('K12 tối')) as HTMLElement;
    expect(row.classList.contains('is-course')).toBe(true);
    expect(row.querySelector('.ws-ag__kind')?.textContent).toContain('Buổi học');
    expect(document.querySelectorAll('.ws-pt.is-course').length).toBe(1);
  });
});

describe('K8: ca đã huỷ / nháp / khách không đến hiện mờ nhưng không được đếm và không bị nhắc "Phân thợ"', () => {
  // Thứ Tư 21/10 (hôm nay). Ca còn hiệu lực: z (Hà 08:00), y (chưa có thợ 12:00), s (buổi học 18:30–20:30 của Hà).
  // Ca không còn hiệu lực: x huỷ chưa có thợ, w huỷ của Minh Anh, d nháp chưa có thợ, n khách không đến chưa có thợ.
  const Z = a('kz', 'L-0301', '2026-10-21T08:00:00+07:00', '2026-10-21T09:00:00+07:00', ['m-ha']);
  const Y = a('ky', 'L-0302', '2026-10-21T12:00:00+07:00', '2026-10-21T13:00:00+07:00', [], { title: 'Makeup tiệc' });
  const S = a('ks', 'LH-0303', '2026-10-21T18:30:00+07:00', '2026-10-21T20:30:00+07:00', ['m-ha'], {
    kind: 'COURSE_SESSION',
    title: null,
    customer: null,
    courseClass: { id: 'k12', name: 'K12 tối', courseId: 'kh-1', courseName: 'Makeup cá nhân' },
    sessionDate: '2026-10-21',
  });
  const X = a('kx', 'L-0304', '2026-10-21T10:00:00+07:00', '2026-10-21T11:00:00+07:00', [], { status: 'CANCELLED', title: 'Makeup đã huỷ' });
  const W = a('kw', 'L-0305', '2026-10-21T14:00:00+07:00', '2026-10-21T15:00:00+07:00', ['m-anh'], { status: 'CANCELLED' });
  const D = a('kd', 'L-0306', '2026-10-21T15:30:00+07:00', '2026-10-21T16:30:00+07:00', [], { status: 'DRAFT' });
  const N = a('kn', 'L-0307', '2026-10-21T16:30:00+07:00', '2026-10-21T17:00:00+07:00', [], { status: 'NO_SHOW' });
  const ITEMS = [Z, Y, S, X, W, D, N];

  const phoneQuery = (q: string) => ({
    matches: q === '(max-width: 640px)',
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });

  it('BẮT: chế độ B — "Cần xử lý", "Phân thợ", chip, tiêu đề buổi, "Tổng trong ngày" chỉ tính ca còn hiệu lực; ca huỷ vẫn hiện mờ', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Ngày'));
    const b = await screen.findByTestId('che-do-B');
    // Chỉ ca y (còn hiệu lực, chưa có thợ) được nhắc.
    const tasks = [...b.querySelectorAll('.ws-task')];
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.textContent).toContain('Makeup tiệc');
    expect(within(b).getAllByRole('button', { name: 'Phân thợ' })).toHaveLength(1);
    // Ca huỷ / nháp / không đến vẫn có trên danh sách và mờ.
    for (const id of ['L-0304', 'L-0305', 'L-0306', 'L-0307']) {
      const row = [...b.querySelectorAll('.ws-item')].find((el) => el.textContent?.includes('Khách ' + id)) as HTMLElement;
      expect(row, id).toBeTruthy();
      expect(row.classList.contains('is-off'), id).toBe(true);
    }
    expect(b.querySelectorAll('.ws-item')).toHaveLength(7);
    // Số đếm.
    expect(b.querySelector('.ws-load__sum')?.textContent).toBe('Tổng trong ngày3 ca · 1 ca chưa có thợ');
    const chip = (name: RegExp) => within(b.querySelector('.ws-filters') as HTMLElement).getByRole('button', { name }).querySelector('.ui-chip__count')?.textContent;
    expect(chip(/^Tất cả/)).toBe('3');
    expect(chip(/Chưa có thợ/)).toBe('1');
    expect(chip(/Minh Anh/)).toBe('0');
    expect(chip(/Thu Hà/)).toBe('2');
    expect(b.querySelector('.ws-day.is-on')?.textContent).toContain('3 ca');
    const heads = [...b.querySelectorAll('.ws-caps')].map((h) => h.textContent);
    expect(heads).toContain('Buổi sáng · 1 ca');
    expect(heads).toContain('Buổi chiều · 2 ca');
  });

  it('BẮT: lưới C — "N ca" đầu cột và "N ca/tuần" đầu hàng không đếm ca huỷ / nháp / không đến', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    const rows = screen.getAllByRole('rowheader').map((r) => r.textContent);
    expect(rows).toEqual(['THThu HàThợ chính2 ca/tuần', 'MAMinh AnhThợ chính0 ca/tuần', 'BVBảo VyThợ phụ0 ca/tuần', '?Chưa có thợ1 ca/tuần']);
    const wed = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('21/10'));
    expect(wed?.textContent).toBe('Thứ Tư21/103 ca');
    // Ca huỷ vẫn nằm trong ô, mờ.
    expect(document.querySelector('[data-appt="kx"]')?.classList.contains('is-off')).toBe(true);
  });

  it('BẮT: chế độ A — đầu cột "N ca" (kể cả cột "Chưa có thợ") không đếm ca huỷ / nháp / không đến', async () => {
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Cột thợ'));
    const col = await screen.findByTestId('che-do-A');
    const meta = (name: string) => [...col.querySelectorAll('[role="columnheader"]')].find((h) => h.textContent?.includes(name))?.querySelector('.ws-a__meta')?.textContent;
    expect(meta('Chưa có thợ')).toBe('1 ca');
    expect(meta('Minh Anh')).toMatch(/^0 ca/);
    expect(meta('Thu Hà')).toMatch(/^2 ca/);
    expect(document.querySelector('[data-appt="kx"]')?.classList.contains('is-off')).toBe(true);
  });

  it('BẮT: lưới C điện thoại — "N ca · M chưa có thợ" và "Xem cả ngày (N ca)" không đếm ca huỷ; ô huỷ vẫn hiện mờ', async () => {
    vi.stubGlobal('matchMedia', phoneQuery);
    setupServer({ items: ITEMS });
    renderScreen(OWNER);
    await waitFor(() => expect(document.querySelectorAll('.ws-ag').length).toBeGreaterThan(0));
    expect(document.querySelector('.ws-cm-day__h span')?.textContent).toBe('3 ca · 1 chưa có thợ');
    expect(screen.getByRole('button', { name: 'Xem cả ngày (3 ca)' })).toBeTruthy();
    const wed = screen.getAllByRole('rowheader').find((h) => h.getAttribute('aria-label')?.includes('21/10'));
    expect(wed?.getAttribute('aria-label')).toBe('Thứ Tư 21/10, 3 ca');
    expect(document.querySelector('[data-cell="chua-co-tho|2026-10-21"] .ws-pt.is-off')).toBeTruthy();
  });

  it('GIỮ: ca huỷ có thợ / ca còn hiệu lực chưa có thợ vẫn được nhắc đúng (không "tắt nhắc" quá tay)', async () => {
    setupServer({ items: [Y, X] });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Ngày'));
    const b = await screen.findByTestId('che-do-B');
    expect(b.querySelectorAll('.ws-task')).toHaveLength(1);
    expect(b.querySelector('.ws-load__sum')?.textContent).toBe('Tổng trong ngày1 ca · 1 ca chưa có thợ');
  });

  it('BẮT: chế độ B — buổi học 18:30–20:30 hiện trên thanh "Thợ trong ngày"; trục nới 04:00 – 21:00, nhãn mốc đủ', async () => {
    setupServer({ items: [Z, S] });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Ngày'));
    const b = await screen.findByTestId('che-do-B');
    expect(b.querySelector('.ws-load__sub')?.textContent).toContain('04:00 – 21:00');
    const ha = [...b.querySelectorAll('.ws-load__row')].find((r) => r.textContent?.includes('Thu Hà')) as HTMLElement;
    const bars = [...ha.querySelectorAll('.ws-track i')] as HTMLElement[];
    expect(bars).toHaveLength(2);
    const course = bars.find((i) => i.classList.contains('is-course')) as HTMLElement;
    // (18:30 − 04:00) / 17 giờ = 85,29% ; rộng 2 / 17 = 11,76%.
    expect(parseFloat(course.style.left)).toBeCloseTo((870 / 1020) * 100, 1);
    expect(parseFloat(course.style.width)).toBeCloseTo((120 / 1020) * 100, 1);
    expect([...b.querySelectorAll('.ws-scale span')].map((x) => x.textContent)).toEqual(['4h', '8h', '12h', '16h', '21h']);
  });

  it('GIỮ: ngày không có ca ngoài khung → trục vẫn 04:00 – 18:00 như cũ', async () => {
    setupServer({ items: [Z] });
    renderScreen(OWNER);
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Ngày'));
    const b = await screen.findByTestId('che-do-B');
    expect(b.querySelector('.ws-load__sub')?.textContent).toContain('04:00 – 18:00');
    expect([...b.querySelectorAll('.ws-scale span')].map((x) => x.textContent)).toEqual(['4h', '8h', '12h', '16h', '18h']);
  });
});
