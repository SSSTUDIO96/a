import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';
import { HIDDEN_SUBJECT_NOTE } from './groups/PublicPackagesGroup';

// Biên bản nghiệm thu lần 4, màn Cài đặt → Thương hiệu, nhân vật "Mẹ cô dâu" đang ẩn, gói "Mẹ cô dâu" đang bật công khai.
// L1: mục "Gói hiện trên trang" phải ghi rõ "Nhân vật đang ẩn, gói không hiện" ở gói đó (lý do trong tooltip).
// D2 (đột biến lọt): khung "Xem trước" lấy danh sách nhân vật ĐANG DÙNG (useProfileDraft.ts usePreviewCatalog gọi
// GET /makeup-subjects?isActive=true). Máy chủ giả lập ở đây làm đúng như máy chủ thật: có isActive=true thì chỉ trả nhân vật
// đang dùng, không có thì trả cả nhân vật ẩn — bỏ bộ lọc là khung xem trước bày lại gói "Mẹ cô dâu" dưới tên nhân vật đó.
configure({ asyncUtilTimeout: 5000 });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Studio Chiến', slug: 'chien', kind: 'TEAM', roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };
const T = '2026-10-12T03:00:00.000Z';
const PROFILE = {
  brandName: 'Studio Chiến Makeup', tagline: null, bio: null, experience: null, styles: [], serviceArea: null, address: null,
  phone: null, email: null, zalo: null, facebook: null, instagram: null, tiktok: null, website: null,
  logoFileId: null, avatarFileId: null, coverFileId: null, workingHours: [], bookingPolicy: null, cancellationPolicy: null,
  depositPolicy: null, isPublished: true, publishedAt: T, updatedAt: T, logo: null, avatar: null, cover: null,
};
const price = (v: number) => ({ priceVersionId: `v-${v}`, listPrice: v, salePrice: null, unitPrice: v, effectiveFrom: T });
const basePkg = {
  description: null, durationMinutes: 120, staffCount: 1, depositAmount: 0, locationTypes: ['STUDIO'], includedKm: null, terms: null,
  isActive: true, isPublic: true, sortOrder: 0, createdAt: T, updatedAt: T, items: [],
};
const PKG_CD = { ...basePkg, id: 'p-cd', code: 'CD', name: 'Cô dâu cao cấp', subjectId: 's-cd', subject: { id: 's-cd', name: 'Cô dâu', isActive: true }, currentPrice: price(2_500_000) };
const PKG_ME = { ...basePkg, id: 'p-me', code: 'ME', name: 'Gói mẹ', subjectId: 's-me', subject: { id: 's-me', name: 'Mẹ cô dâu', isActive: false }, currentPrice: price(800_000) };
const PKG_LE = { ...basePkg, id: 'p-le', code: 'LE', name: 'Gói lẻ', subjectId: null, subject: null, currentPrice: price(300_000) };
const SUBJECTS = [
  { id: 's-cd', organizationId: 'org-1', name: 'Cô dâu', sortOrder: 0, isActive: true, createdAt: T, updatedAt: T },
  { id: 's-me', organizationId: 'org-1', name: 'Mẹ cô dâu', sortOrder: 1, isActive: false, createdAt: T, updatedAt: T },
];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fail = (status: number, code: string, message: string) => json(status, { error: { code, message, requestId: 'r' } });

function setupServer() {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      calls.push(`${method} ${path}${url.search}`);
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Trọng Chiến', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', createdAt: T, updatedAt: T, myRoles: ['owner'], myPermissions: [...SYSTEM_ROLES.owner.permissions] });
      if (path === '/orgs/org-1/profile') return json(200, { hasProfile: true, profile: PROFILE });
      if (path === '/orgs/org-1/packages' && method === 'GET') return json(200, { items: [PKG_CD, PKG_ME, PKG_LE], page: 1, pageSize: 100, total: 3 });
      if (path === '/orgs/org-1/packages/p-me' && method === 'PATCH') return json(200, { ...PKG_ME, ...(JSON.parse(String(init?.body)) as object) });
      // Như máy chủ thật: isActive=true → chỉ nhân vật đang dùng.
      if (path === '/orgs/org-1/makeup-subjects') {
        const only = url.searchParams.get('isActive');
        return json(200, { items: only === 'true' ? SUBJECTS.filter((s) => s.isActive) : only === 'false' ? SUBJECTS.filter((s) => !s.isActive) : SUBJECTS });
      }
      if (path === '/orgs/org-1/travel-fee-policy') return fail(404, 'NOT_FOUND', 'Chưa có cấu hình phí di chuyển');
      return fail(404, 'NOT_FOUND', `Không có đường ${method} ${path}`);
    }),
  );
  return calls;
}

function renderPage() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/chien/cai-dat/thuong-hieu'] })} />);
}
const preview = () => screen.getByRole('complementary', { name: 'Xem trước trang giới thiệu' });
const rowOf = (name: string) => screen.getByRole('switch', { name: `Hiện gói ${name} trên trang` }).closest('.br-pk') as HTMLElement;

describe('Lần 4 — D2: khung xem trước lấy nhân vật đang dùng', () => {
  it('BẮT: nhân vật "Mẹ cô dâu" ẩn → xem trước không bày gói/nhóm của nhân vật đó; hỏi máy chủ đúng isActive=true', async () => {
    const calls = setupServer();
    renderPage();
    await within(await screen.findByRole('complementary', { name: 'Xem trước trang giới thiệu' })).findByText('Cô dâu cao cấp');
    expect(calls.filter((c) => c.startsWith('GET /orgs/org-1/makeup-subjects'))).toEqual(['GET /orgs/org-1/makeup-subjects?isActive=true']);
    console.log(`[D2] xem trước có "Mẹ cô dâu": ${preview().textContent?.includes('Mẹ cô dâu') ? 'CÓ ⇒ LỖI' : 'không ⇒ ĐÚNG'}`);
    expect(preview().textContent).not.toContain('Mẹ cô dâu');
    expect(within(preview()).queryByText('Gói mẹ')).toBeNull();
    // GIỮ: gói không gắn nhân vật vẫn hiện ("Gói khác").
    expect(within(preview()).getByText('Gói lẻ')).toBeTruthy();
  });
});

describe('Lần 4 — L1: "Gói hiện trên trang" ghi rõ gói của nhân vật đang ẩn', () => {
  it('BẮT: gói "Gói mẹ" (nhân vật ẩn, công tắc bật) → ghi chú ngắn + tooltip nói rõ vì sao; gói khác không ghi', async () => {
    setupServer();
    renderPage();
    await screen.findByRole('switch', { name: 'Hiện gói Gói mẹ trên trang' });
    const me = rowOf('Gói mẹ');
    expect(within(me).getByText(HIDDEN_SUBJECT_NOTE)).toBeTruthy();
    expect(HIDDEN_SUBJECT_NOTE).toBe('Nhân vật đang ẩn, gói không hiện');
    await userEvent.click(within(me).getByRole('button', { name: 'Vì sao gói Gói mẹ không hiện' }));
    expect((await screen.findAllByText(/Nhân vật "Mẹ cô dâu" đang ẩn \(Bảng giá → Nhân vật\) nên gói này không hiện trên trang giới thiệu/)).length).toBeGreaterThan(0);
    expect(within(rowOf('Cô dâu cao cấp')).queryByText(HIDDEN_SUBJECT_NOTE)).toBeNull();
    expect(within(rowOf('Gói lẻ')).queryByText(HIDDEN_SUBJECT_NOTE)).toBeNull();
  });

  it('GIỮ: công tắc của gói nhân vật ẩn vẫn bật/tắt được (lưu ngay), ghi chú vẫn còn', async () => {
    const calls = setupServer();
    renderPage();
    const sw = await screen.findByRole('switch', { name: 'Hiện gói Gói mẹ trên trang' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(sw);
    await waitFor(() => expect(calls).toContain('PATCH /orgs/org-1/packages/p-me'));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Hiện gói Gói mẹ trên trang' }).getAttribute('aria-checked')).toBe('false'));
    expect(within(rowOf('Gói mẹ')).getByText(HIDDEN_SUBJECT_NOTE)).toBeTruthy();
  });
});
