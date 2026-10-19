import { cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';
import { avatarColorIndex } from '../../ui/avatarColor';
import { staffNaming } from '../../ui/staffName';

// L2 (biên bản nghiệm thu lần 4, việc tồn 48): "Linh Trần" và "Lê Minh Tú" (cùng chữ tắt LT, cùng màu băm gốc) từng KHÁC màu
// ở Lịch/Hợp đồng nhưng CÙNG màu nâu cam ở Thợ makeup và Tiền công → Lê Minh Tú mang hai màu ở hai màn.
// Bài này chạy app thật trong khung (phiên, router, quyền) với máy chủ giả lập, đo màu ảnh ở: Thợ makeup, Lịch,
// Tiền công theo gói, thanh trái (ảnh của chính chủ). Một người một màu một chữ tắt ở mọi màn.
configure({ asyncUtilTimeout: 5000 });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const T = '2026-10-12T03:00:00.000Z';
const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Studio Chiến', slug: 'chien', kind: 'TEAM', roles: [{ key: 'owner', name: 'Chủ' }] };
const LINH = 'm-linh';
let TU = '';
for (let n = 0; n < 1000 && !TU; n += 1) if (avatarColorIndex(`m-tu-${n}`) === avatarColorIndex(LINH)) TU = `m-tu-${n}`;
const person = (membershipId: string, fullName: string, displayName: string, initials: string) => ({
  membershipId, userId: `u-${membershipId}`, fullName, displayName, initials, avatarUrl: null, phone: null,
  tier: { id: 't1', name: 'Thợ chính', isActive: true }, isBookable: true, hasProfile: true, status: 'ACTIVE', roleKeys: ['artist'],
});
const STAFF = [
  person('m-1', 'Nguyễn Trọng Chiến', 'Chiến Makeup', 'CM'),
  person(LINH, 'Trần Khánh Linh', 'Linh Trần', 'LT'),
  person(TU, 'Lê Minh Tú', 'Lê Minh Tú', 'LT'),
];
const SHEET = {
  owner: { kind: 'package', id: 'p1', name: 'Cô dâu' },
  items: [{ tier: { id: 't1', name: 'Thợ chính', sortOrder: 0 }, amount: 700_000, updatedAt: T, staff: STAFF.map((s) => ({ membershipId: s.membershipId, displayName: s.displayName, avatarUrl: null, initials: s.initials })) }],
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setupServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Trọng Chiến', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...SYSTEM_ROLES.owner.permissions] });
      if (path === '/orgs/org-1/staff') return json(200, { items: STAFF });
      if (path === '/orgs/org-1/staff-tiers') return json(200, { items: [{ id: 't1', name: 'Thợ chính', sortOrder: 0, isActive: true, staffCount: 3, createdAt: T, updatedAt: T }] });
      if (path === '/orgs/org-1/roles') return json(200, { items: [] });
      if (path === '/orgs/org-1/appointments') return json(200, { items: [] });
      if (path === '/orgs/org-1/makeup-subjects') return json(200, { items: [] });
      if (path === '/orgs/org-1/packages') return json(200, { items: [{ id: 'p1', code: 'G1', name: 'Cô dâu', subjectId: null, subject: null, currentPrice: null }], page: 1, pageSize: 100, total: 1 });
      if (path === '/orgs/org-1/services') return json(200, { items: [], page: 1, pageSize: 100, total: 0 });
      if (path === '/orgs/org-1/packages/p1/pay-rates') return json(200, SHEET);
      return json(404, { error: { code: 'NOT_FOUND', message: `Không có đường ${method} ${path}`, requestId: 'r' } });
    }),
  );
}

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}
// Ảnh có title = tên hiển thị; nền = var(--av-i). Thanh trái cũng có ảnh — chọn trong vùng của màn.
function tone(scope: ParentNode, title: string): { bg: string; ini: string } {
  const el = scope.querySelector(`.ui-av[title="${title}"]`) as HTMLElement | null;
  if (!el) throw new Error(`Không thấy ảnh "${title}"`);
  return { bg: el.style.background, ini: el.textContent ?? '' };
}
const want = staffNaming(STAFF);
const WANT = (id: string) => `var(--av-${avatarColorIndex(want.colorKey(id))})`;

describe('L2: một người một màu, một chữ tắt ở Thợ makeup, Lịch, Tiền công, thanh trái', () => {
  it('BẮT: Linh Trần và Lê Minh Tú khác màu, và mỗi người cùng một màu ở mọi màn', async () => {
    expect(TU).not.toBe('');
    setupServer();
    // Thợ makeup.
    renderAt('/chien/nhan-su');
    await screen.findByText('Lê Minh Tú');
    const main = () => document.querySelector('.sh-main') as HTMLElement;
    await waitFor(() => expect(tone(main(), 'Lê Minh Tú').bg).toBe(WANT(TU)));
    const staffPage = { linh: tone(main(), 'Linh Trần'), tu: tone(main(), 'Lê Minh Tú') };
    // Thanh trái: ảnh của chính chủ (họ tên "Nguyễn Trọng Chiến", tên hiển thị "Chiến Makeup").
    const side = document.querySelector('.sh-user') as HTMLElement;
    await waitFor(() => expect(tone(side, 'Nguyễn Trọng Chiến')).toEqual({ bg: WANT('m-1'), ini: 'CM' }));
    expect(tone(main(), 'Chiến Makeup')).toEqual({ bg: WANT('m-1'), ini: 'CM' });
    cleanup();

    // Lịch.
    renderAt('/chien/lich');
    await waitFor(() => expect(document.querySelector('.sh-main .ui-av[title="Lê Minh Tú"]')).not.toBeNull());
    const lich = { linh: tone(main(), 'Linh Trần'), tu: tone(main(), 'Lê Minh Tú') };
    cleanup();

    // Tiền công theo gói.
    renderAt('/chien/nhan-su/tien-cong/goi/p1');
    await waitFor(() => expect(document.querySelector('.sh-main .ui-av[title="Lê Minh Tú"]')).not.toBeNull());
    const pay = { linh: tone(main(), 'Linh Trần'), tu: tone(main(), 'Lê Minh Tú') };

    console.log(`[L2] Lê Minh Tú: Thợ makeup ${staffPage.tu.bg} · Lịch ${lich.tu.bg} · Tiền công ${pay.tu.bg}; Linh Trần ${staffPage.linh.bg}`);
    expect(staffPage.linh.bg).not.toBe(staffPage.tu.bg);
    expect(lich).toEqual(staffPage);
    expect(pay).toEqual(staffPage);
    expect(staffPage).toEqual({ linh: { bg: WANT(LINH), ini: 'LT' }, tu: { bg: WANT(TU), ini: 'LT' } });
  });
});
