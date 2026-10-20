import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { permissionsValue, StaticPermissionsProvider } from '../../layout/usePermissions';
import { PortalSettingsPage } from './PortalSettingsPage';

// Người không có org.update (số tài khoản đụng tiền: chỉ Chủ, Quản trị — ký duyệt E câu 3) chỉ xem, không sửa, không có nút Lưu.
// Nav đã chặn đường theo quyền; bài này kiểm lớp thứ hai nằm ngay trong màn.
vi.mock('../../app/session', () => ({
  useSession: () => ({ organizations: [{ id: 'org-1', slug: 'chien', name: 'X', kind: 'ACADEMY', membershipId: 'm', roles: [] }] }),
}));

const T = '2026-10-20T03:00:00.000Z';
afterEach(() => vi.unstubAllGlobals());

describe('Cài đặt cổng — chỉ xem', () => {
  it('chỉ có org.read: ô bị khoá, không có nút Lưu, có dải "chỉ xem được"; PUT không bao giờ được gọi', async () => {
    const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify({ bankName: 'ACB', bankAccountNo: '123456789', bankAccountName: 'LE VAN A', updatedAt: T }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const perms = ['org.read'];
    const state = { status: 'ready' as const, org: {} as never, permissions: new Set(perms) };
    const router = createMemoryRouter(
      [{ path: '/:orgSlug/cai-dat/cong-hoc-vien', element: <StaticPermissionsProvider value={permissionsValue(state)}><PortalSettingsPage /></StaticPermissionsProvider> }],
      { initialEntries: ['/chien/cai-dat/cong-hoc-vien'] },
    );
    render(<RouterProvider router={router} />);
    const bank = (await screen.findByLabelText('Ngân hàng')) as HTMLInputElement;
    expect(bank.disabled).toBe(true);
    expect((screen.getByLabelText('Số tài khoản') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Chủ tài khoản') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
    expect(screen.getByText('Bạn chỉ xem được. Đổi số tài khoản cần quyền Chủ hoặc Quản trị.')).toBeTruthy();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== 'PUT')).toBe(true);
  });
});
