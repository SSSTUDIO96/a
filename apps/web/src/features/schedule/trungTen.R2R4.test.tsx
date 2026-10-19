import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment, StaffMember } from '../../api/types';
import { avatarColorIndex } from '../../ui/Avatar';
import { staffNaming } from '../../ui/staffName';
import { ScheduleScreen } from './index';
import type { ScheduleAccess } from './model';

// Biên bản nghiệm thu lần 3 — R2 (trùng tên ngắn xét trên SỔ THỢ), R4 (cùng chữ tắt → khác màu), R3 (tên đầu hàng không cắt).
// Màn Lịch chạy thật với máy chủ giả qua fetch. Hôm nay = Thứ Tư 21/10/2026 → tuần 19 – 25/10/2026.
const ORG_ID = 'org-1';

function member(membershipId: string, displayName: string, initials: string, over: Partial<StaffMember> = {}): StaffMember {
  return {
    membershipId,
    userId: `u-${membershipId}`,
    fullName: displayName,
    displayName,
    initials,
    avatarUrl: null,
    phone: null,
    tier: null,
    isBookable: true,
    hasProfile: true,
    status: 'ACTIVE',
    roleKeys: ['artist'],
    ...over,
  };
}

function appt(id: string, staff: StaffMember[]): Appointment {
  const start = '2026-10-21T09:00:00+07:00';
  const end = '2026-10-21T10:00:00+07:00';
  return {
    id,
    code: `L-${id}`,
    title: 'Makeup cô dâu',
    status: 'CONFIRMED',
    customer: { id: `c-${id}`, fullName: `Khách ${id}`, phone: null },
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
    locationType: 'STUDIO',
    address: null,
    latitude: null,
    longitude: null,
    notes: null,
    cancelReason: null,
    staff: staff.map((s, i) => ({
      membershipId: s.membershipId,
      fullName: s.fullName,
      displayName: s.displayName,
      avatarUrl: null,
      role: i === 0 ? 'PRIMARY' : 'ASSIST',
      blockStart: start,
      blockEnd: end,
      isBlocking: true,
    })),
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  } as Appointment;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setupServer(staff: StaffMember[], items: Appointment[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.includes('/appointments?')) return json(200, { items, from: '', to: '' });
      if (method === 'GET' && url.endsWith(`/orgs/${ORG_ID}/staff`)) return json(200, { items: staff });
      return json(404, { error: { code: 'NOT_FOUND', message: 'Không có đường API này', requestId: 'r' } });
    }),
  );
}

const OWNER: ScheduleAccess = { readAll: true, write: true, staffRead: true, customersRead: true, customersWrite: true, contractsRead: true, catalogRead: false };

function renderScreen() {
  const router = createMemoryRouter([{ path: '/:orgSlug/lich', element: <ScheduleScreen orgId={ORG_ID} orgSlug="hoa-dao" self={{ membershipId: 'm-chu', name: 'Chủ' }} access={OWNER} /> }], {
    initialEntries: ['/hoa-dao/lich'],
  });
  return render(<RouterProvider router={router} />);
}

const modeButton = (name: string) => within(screen.getByRole('radiogroup', { name: 'Chế độ xem lịch' })).getByRole('radio', { name });
const toneOf = (el: Element | null | undefined) => (el as HTMLElement | null)?.style.background ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T03:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------- R2 ----------------
// "Nguyễn Thu Hà" đang TẮT nhận lịch và không có ca → không có hàng trên Lịch, nhưng vẫn là thợ của tổ chức (GET /staff).
// Hợp đồng (cùng sổ) sẽ ghi "Phạm Thu Hà"; Lịch phải ghi y như vậy — một người một tên.
const PHAM_HA = member('m-pha', 'Phạm Thu Hà', 'PH');
const NGUYEN_HA_OFF = member('m-ngha', 'Nguyễn Thu Hà', 'NH', { isBookable: false });

describe('R2: Lịch xét trùng tên ngắn trên sổ thợ (danh sách thợ của tổ chức ∪ thợ của ca), không chỉ các hàng đang hiện', () => {
  it('BẮT: chỉ một hàng "Hà" nhưng tổ chức có hai "… Thu Hà" → đầu hàng ghi đủ "Phạm Thu Hà" ở lưới C và cột thợ A', async () => {
    setupServer([PHAM_HA, NGUYEN_HA_OFF], [appt('1', [PHAM_HA])]);
    renderScreen();
    await screen.findByTestId('che-do-C');
    await waitFor(() => expect([...document.querySelectorAll('.ws-c__nm')].map((e) => e.textContent)).toEqual(['Phạm Thu Hà', 'Chưa có thợ']));
    fireEvent.click(modeButton('Cột thợ'));
    await screen.findByTestId('che-do-A');
    expect([...document.querySelectorAll('.ws-a__nm')].map((e) => e.textContent)).toEqual(['Phạm Thu Hà', 'Chưa có thợ']);
  });

  it('GIỮ: tổ chức chỉ có một "Hà" → "Hà"', async () => {
    setupServer([PHAM_HA, member('m-vy', 'Phạm Bảo Vy', 'PV', { isBookable: false })], [appt('1', [PHAM_HA])]);
    renderScreen();
    await screen.findByTestId('che-do-C');
    await waitFor(() => expect(document.querySelector('.ws-c__nm')?.textContent).toBe('Hà'));
  });
});

// ---------------- R4 ----------------
// Hai mã thành viên có cùng màu băm (ca xấu của biên bản: LT nâu + LT nâu).
function sameBase(seed: string): string {
  for (let i = 0; ; i += 1) if (avatarColorIndex(`m-${i}`) === avatarColorIndex(seed)) return `m-${i}`;
}
const LINH = member('m7', 'Linh Trần', 'LT', { fullName: 'Trần Khánh Linh' });
const TU = member(sameBase('m7'), 'Lê Minh Tú', 'LT');

describe('R4: "Linh Trần" và "Lê Minh Tú" (cùng LT) khác màu ở mọi ảnh thợ trên Lịch', () => {
  const want = staffNaming([LINH, TU]);
  const wantTone = (id: string) => `var(--av-${avatarColorIndex(want.colorKey(id))})`;

  it('dựng đúng ca xấu: hai mã cùng màu băm', () => {
    expect(avatarColorIndex(LINH.membershipId)).toBe(avatarColorIndex(TU.membershipId));
  });

  it('BẮT: đầu hàng lưới C — hai ảnh LT khác màu, đúng màu của sổ thợ (cùng hàm Hợp đồng dùng)', async () => {
    setupServer([LINH, TU], [appt('1', [LINH, TU])]);
    renderScreen();
    await screen.findByTestId('che-do-C');
    await waitFor(() => expect(document.querySelectorAll('.ws-c__rh .ui-av').length).toBe(2));
    const [a, b] = [...document.querySelectorAll('.ws-c__rh .ui-av')];
    expect(toneOf(a)).not.toBe(toneOf(b));
    expect([toneOf(a), toneOf(b)]).toEqual([wantTone(LINH.membershipId), wantTone(TU.membershipId)]);
  });

  it('BẮT: ảnh chồng trên ca (chế độ Ngày) và đầu cột thợ A cùng màu với đầu hàng — một người một màu', async () => {
    setupServer([LINH, TU], [appt('1', [LINH, TU])]);
    renderScreen();
    await screen.findByTestId('che-do-C');
    fireEvent.click(modeButton('Ngày'));
    await waitFor(() => expect(document.querySelectorAll('.ui-avs .ui-av').length).toBeGreaterThanOrEqual(2));
    const stack = [...document.querySelectorAll('.ui-avs')][0];
    const tones = [...(stack?.querySelectorAll('.ui-av') ?? [])].map(toneOf);
    expect(tones).toEqual([wantTone(LINH.membershipId), wantTone(TU.membershipId)]);
    fireEvent.click(modeButton('Cột thợ'));
    await screen.findByTestId('che-do-A');
    expect([...document.querySelectorAll('.ws-a__colh .ui-av')].map(toneOf)).toEqual([wantTone(LINH.membershipId), wantTone(TU.membershipId)]);
  });
});

// ---------------- R3 ----------------
describe('R3: tên đầu hàng / đầu cột không bị cắt "…" (xuống dòng như "Chưa có thợ")', () => {
  it('BẮT (CSS): .ws-c__nm, .ws-cm__tn, .ws-a__nm — white-space: normal, không nowrap / ellipsis / overflow: hidden', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schedule.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: (m[1] ?? '').trim(), body: m[2] ?? '' }));
    for (const sel of ['.ws-c__nm', '.ws-cm__tn', '.ws-a__nm']) {
      const hit = rules.filter((r) => r.sel.split(',').some((x) => x.trim() === sel || x.trim().endsWith(` ${sel}`)));
      expect(hit.length, sel).toBeGreaterThan(0);
      for (const r of hit) expect(r.body, `${r.sel}`).not.toMatch(/white-space:\s*nowrap|text-overflow:\s*ellipsis|overflow:\s*hidden/);
      expect(rules.find((r) => r.sel === sel)?.body ?? '', sel).toMatch(/white-space:\s*normal/);
    }
  });
});
