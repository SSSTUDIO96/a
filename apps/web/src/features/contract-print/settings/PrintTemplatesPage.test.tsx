import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import { apiErr, BASE, json, PROFILE_NONE, PROFILE_NO_BANK, renderAt, setupServer, tpl, type Call } from './testServer';

// Cài đặt › Mẫu in hợp đồng — danh sách + thẻ Thông tin trên hợp đồng (bản vẽ G 4.5), chạy thật trong khung, máy chủ giả qua fetch.
configure({ asyncUtilTimeout: 5000 });
afterEach(() => {
  vi.unstubAllGlobals();
});

const OWNER = SYSTEM_ROLES.owner.permissions;
const MANAGER = SYSTEM_ROLES.manager.permissions;

const TEMPLATES = [
  tpl({ id: 'hd', name: 'Hiện đại — Chiến Makeup', layout: 2, version: 3, defaultFor: ['SERVICE'], usage: { printedContracts: 46, lastPrintedAt: null } }),
  tpl({ id: 'cd', name: 'Cổ điển có quốc hiệu', layout: 1, version: 1, usage: { printedContracts: 3, lastPrintedAt: null } }),
  tpl({ id: 'kh', name: 'Hợp đồng đào tạo — Cổ điển', layout: 1, version: 2, appliesTo: ['COURSE'], defaultFor: ['COURSE'] }),
  tpl({ id: 'both', name: 'Sang trọng cả hai', layout: 5, appliesTo: ['SERVICE', 'COURSE'] }),
  tpl({ id: 'off', name: 'Mẫu cũ ngừng dùng', layout: 4, isActive: false, version: 5 }),
];
const group = (name: string) => within(screen.getByRole('region', { name }));
const listGets = (calls: Call[]) => calls.filter((c) => c.method === 'GET' && c.path === '/orgs/org-1/print-templates');

describe('danh sách mẫu in', () => {
  it('ACADEMY: nhóm Hợp đồng dịch vụ và Hợp đồng khoá học; nhãn Mặc định đúng nhóm; "bản v{n}"; "đã in {k} hợp đồng"; mẫu dùng cả hai loại ở cả hai nhóm', async () => {
    setupServer(OWNER, { templates: TEMPLATES });
    renderAt(BASE);
    await screen.findByRole('region', { name: 'Hợp đồng dịch vụ' });
    const dv = group('Hợp đồng dịch vụ');
    expect(await dv.findByText('Hiện đại — Chiến Makeup')).toBeTruthy();
    expect(dv.getByText('3 mẫu')).toBeTruthy(); // hd, cd, both — mẫu ngừng dùng ẩn
    expect(dv.getByText('bản v3')).toBeTruthy();
    expect(dv.getByText(/Bố cục 2 · Hiện đại tối giản · đã in 46 hợp đồng/)).toBeTruthy();
    expect(dv.getAllByText('Mặc định')).toHaveLength(1);
    expect(dv.getByRole('link', { name: /Hiện đại — Chiến Makeup \(mặc định\)/ })).toBeTruthy();
    expect(dv.queryByText('Hợp đồng đào tạo — Cổ điển')).toBeNull();
    const kh = group('Hợp đồng khoá học');
    expect(kh.getByText('Hợp đồng đào tạo — Cổ điển')).toBeTruthy();
    expect(kh.getByText('2 mẫu')).toBeTruthy(); // kh + both
    expect(kh.getAllByText('Mặc định')).toHaveLength(1);
    expect(kh.getByText('Sang trọng cả hai')).toBeTruthy();
    expect(dv.getByText('Sang trọng cả hai')).toBeTruthy();
  });

  it('tổ chức không phải ACADEMY: không có nhóm khoá học, không có mẫu khoá học', async () => {
    setupServer(OWNER, { kind: 'TEAM', templates: [TEMPLATES[0]!, TEMPLATES[1]!] });
    renderAt(BASE);
    await screen.findByText('Hiện đại — Chiến Makeup');
    expect(screen.queryByRole('region', { name: 'Hợp đồng khoá học' })).toBeNull();
    expect(screen.queryByText('Hợp đồng khoá học')).toBeNull();
  });

  it('công tắc "Hiện mẫu ngừng dùng": mặc định ẩn; bật thì hiện nhãn "Ngừng dùng"; chỉ một lần gọi danh sách', async () => {
    const calls = setupServer(OWNER, { templates: TEMPLATES });
    renderAt(BASE);
    await screen.findByText('Hiện đại — Chiến Makeup');
    expect(screen.queryByText('Mẫu cũ ngừng dùng')).toBeNull();
    expect(listGets(calls)).toHaveLength(1);
    expect(listGets(calls)[0]!.query).toBe('?includeInactive=true');
    await userEvent.click(screen.getByRole('switch', { name: /Hiện mẫu ngừng dùng/ }));
    expect(await screen.findByText('Mẫu cũ ngừng dùng')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Hợp đồng dịch vụ' })).getByText('Ngừng dùng')).toBeTruthy();
    expect(listGets(calls)).toHaveLength(1);
  });

  it('mỗi dòng mở màn sửa đúng mẫu; nút "Tạo mẫu in" mở mẫu mới theo bố cục 2 dịch vụ; 5 ảnh bố cục mở mẫu mới đúng bố cục', async () => {
    setupServer(OWNER, { templates: TEMPLATES });
    renderAt(BASE);
    await screen.findByText('Hiện đại — Chiến Makeup');
    expect(group('Hợp đồng dịch vụ').getByRole('link', { name: /Cổ điển có quốc hiệu/ }).getAttribute('href')).toBe(`${BASE}/cd`);
    expect(screen.getByRole('link', { name: /Tạo mẫu in/ }).getAttribute('href')).toBe(`${BASE}/moi?bo-cuc=2&loai=SERVICE`);
    const gallery = within(screen.getByRole('region', { name: '5 bố cục có sẵn' }) ?? document.body);
    for (let n = 1; n <= 5; n += 1) {
      const a = gallery.getByRole('link', { name: new RegExp(`^Tạo mẫu từ bố cục ${n} —`) });
      expect(a.getAttribute('href')).toBe(`${BASE}/moi?bo-cuc=${n}&loai=SERVICE`);
      expect(a.querySelector('img')!.getAttribute('src')).toBe(`/mau-in/bo-cuc-${n}.png`);
    }
  });

  it('lỗi tải danh sách: dải đỏ + Thử lại', async () => {
    setupServer(OWNER, { templates: TEMPLATES });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), 'http://localhost').pathname.replace('/api/v1', '');
        if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
        if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Chiến', organizations: [{ membershipId: 'm', id: 'org-1', name: 'S', slug: 'hoa-dao', kind: 'ACADEMY', roles: [] }] });
        if (path === '/orgs/org-1') return json(200, { id: 'org-1', name: 'S', slug: 'hoa-dao', kind: 'ACADEMY', timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...OWNER] });
        if (path === '/orgs/org-1/print-templates') return apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại.');
        return json(200, { hasProfile: false, profile: null });
      }),
    );
    renderAt(BASE);
    expect(await screen.findByText('Máy chủ gặp lỗi, vui lòng thử lại.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });
});

describe('quyền theo vai trò', () => {
  // Xem mẫu in cần contracts.read; mục điều hướng + tạo/sửa mẫu cần contracts.texts (Chủ, Quản trị, Quản lý); sửa thông tin hợp đồng org.update.
  for (const key of Object.keys(SYSTEM_ROLES) as (keyof typeof SYSTEM_ROLES)[]) {
    const perms = SYSTEM_ROLES[key].permissions as readonly Permission[];
    const canOpen = perms.includes('contracts.texts');
    const canInfo = perms.includes('org.update');
    it(`${SYSTEM_ROLES[key].name}: ${canOpen ? `vào được; ${canInfo ? 'có' : 'không có'} nút Sửa thông tin hợp đồng` : 'dải 403'}`, async () => {
      setupServer(perms, { templates: TEMPLATES });
      renderAt(BASE);
      if (!canOpen) {
        expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền sửa mẫu in hợp đồng.');
        expect(screen.queryByText('Hiện đại — Chiến Makeup')).toBeNull();
        return;
      }
      await screen.findByText('Hiện đại — Chiến Makeup');
      expect(screen.getByRole('link', { name: /Tạo mẫu in/ })).toBeTruthy();
      const card = within(screen.getByRole('region', { name: /Thông tin trên hợp đồng/ }));
      await card.findByText('Nguyễn Trọng Chiến');
      expect(card.queryByRole('button', { name: 'Sửa' }) !== null).toBe(canInfo);
      expect(!!card.queryByText(/Chỉ Chủ và Quản trị sửa được/)).toBe(!canInfo);
    });
  }

  it('đủ quyền xem hợp đồng nhưng thiếu quyền sửa mẫu: vào thẳng đường mẫu mới ra dải 403 (không có màn tạo)', async () => {
    setupServer(SYSTEM_ROLES.receptionist.permissions, { templates: TEMPLATES });
    renderAt(`${BASE}/moi?bo-cuc=2&loai=SERVICE`);
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền sửa mẫu in hợp đồng.');
  });
});

describe('thẻ Thông tin trên hợp đồng', () => {
  it('hiện 5 dòng; ô trống ghi "Chưa nhập"; có câu nói logo/tên/địa chỉ lấy từ Hồ sơ thương hiệu', async () => {
    setupServer(OWNER, { templates: TEMPLATES, profile: PROFILE_NO_BANK });
    renderAt(BASE);
    const card = within(await screen.findByRole('region', { name: /Thông tin trên hợp đồng/ }));
    await waitFor(() => expect(card.getAllByText('Chưa nhập')).toHaveLength(5));
    expect(card.getByRole('link', { name: 'Hồ sơ thương hiệu' }).getAttribute('href')).toBe('/hoa-dao/cai-dat/thuong-hieu');
  });

  it('Sửa → hộp 5 ô; lưu bằng PUT đủ 5 khoá, số tài khoản bỏ khoảng trắng + viết hoa, ô trống = null; thẻ cập nhật', async () => {
    const calls = setupServer(OWNER, { templates: TEMPLATES, profile: PROFILE_NO_BANK });
    renderAt(BASE);
    const user = userEvent.setup();
    const card = within(await screen.findByRole('region', { name: /Thông tin trên hợp đồng/ }));
    await user.click(await card.findByRole('button', { name: 'Sửa' }));
    const dlg = within(await screen.findByRole('dialog'));
    await user.type(dlg.getByLabelText('Người đại diện'), 'Nguyễn Trọng Chiến');
    await user.type(dlg.getByLabelText('Ngân hàng'), 'Vietcombank');
    await user.type(dlg.getByLabelText('Số tài khoản'), '0011 0045 abc6');
    await user.type(dlg.getByLabelText('Chủ tài khoản'), 'NGUYEN TRONG CHIEN');
    await user.click(dlg.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe('/orgs/org-1/profile/contract-info');
    expect(put.body).toEqual({
      representativeName: 'Nguyễn Trọng Chiến',
      representativeTitle: null,
      bankName: 'Vietcombank',
      bankAccountNumber: '00110045ABC6',
      bankAccountName: 'NGUYEN TRONG CHIEN',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await card.findByText('00110045ABC6')).toBeTruthy();
    expect(card.getByText('Đã lưu thông tin trên hợp đồng.')).toBeTruthy();
  });

  it('kiểm ở máy khách: chỉ điền một ô ngân hàng, chức vụ không tên, số tài khoản sai → báo đúng ô, KHÔNG gửi', async () => {
    const calls = setupServer(OWNER, { templates: TEMPLATES, profile: PROFILE_NO_BANK });
    renderAt(BASE);
    const user = userEvent.setup();
    const card = within(await screen.findByRole('region', { name: /Thông tin trên hợp đồng/ }));
    await user.click(await card.findByRole('button', { name: 'Sửa' }));
    const dlg = within(await screen.findByRole('dialog'));
    await user.type(dlg.getByLabelText('Chức vụ'), 'Chủ studio');
    await user.type(dlg.getByLabelText('Ngân hàng'), 'Vietcombank');
    await user.click(dlg.getByRole('button', { name: 'Lưu' }));
    expect(await dlg.findByText('Nhập tên người đại diện khi có chức vụ')).toBeTruthy();
    expect(dlg.getAllByText('Nhập đủ ngân hàng, số tài khoản, chủ tài khoản (hoặc để trống cả ba)')).toHaveLength(2);
    await user.type(dlg.getByLabelText('Người đại diện'), 'A');
    await user.type(dlg.getByLabelText('Số tài khoản'), '12-3');
    await user.type(dlg.getByLabelText('Chủ tài khoản'), 'NGUYEN A');
    await user.click(dlg.getByRole('button', { name: 'Lưu' }));
    expect(await dlg.findByText('Số tài khoản chỉ gồm chữ số / chữ cái, 4–30 ký tự')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  it('máy chủ trả 400 theo ô → lời máy chủ hiện đúng dưới ô đó', async () => {
    const calls = setupServer(OWNER, {
      templates: TEMPLATES,
      profile: PROFILE_NO_BANK,
      putInfo: () => apiErr(400, 'VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', { issues: [{ path: 'bankAccountNumber', message: 'Số tài khoản đã được dùng' }], fieldErrors: { bankAccountNumber: ['Số tài khoản đã được dùng'] } }),
    });
    renderAt(BASE);
    const user = userEvent.setup();
    const card = within(await screen.findByRole('region', { name: /Thông tin trên hợp đồng/ }));
    await user.click(await card.findByRole('button', { name: 'Sửa' }));
    const dlg = within(await screen.findByRole('dialog'));
    await user.type(dlg.getByLabelText('Ngân hàng'), 'Vietcombank');
    await user.type(dlg.getByLabelText('Số tài khoản'), '123456');
    await user.type(dlg.getByLabelText('Chủ tài khoản'), 'NGUYEN A');
    await user.click(dlg.getByRole('button', { name: 'Lưu' }));
    expect(await dlg.findByText('Số tài khoản đã được dùng')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('409 PROFILE_REQUIRED → lời máy chủ + liên kết "Hồ sơ thương hiệu"; hộp vẫn mở, dữ liệu giữ nguyên', async () => {
    setupServer(OWNER, {
      templates: TEMPLATES,
      profile: PROFILE_NONE,
      putInfo: () => apiErr(409, 'CONFLICT', 'Chưa có hồ sơ thương hiệu — lưu hồ sơ ở Cài đặt › Hồ sơ thương hiệu trước', { reason: 'PROFILE_REQUIRED' }),
    });
    renderAt(BASE);
    const user = userEvent.setup();
    const card = within(await screen.findByRole('region', { name: /Thông tin trên hợp đồng/ }));
    await user.click(await card.findByRole('button', { name: 'Sửa' }));
    const dlg = within(await screen.findByRole('dialog'));
    await user.type(dlg.getByLabelText('Người đại diện'), 'Chiến');
    await user.click(dlg.getByRole('button', { name: 'Lưu' }));
    const alert = await dlg.findByRole('alert');
    expect(alert.textContent).toContain('Chưa có hồ sơ thương hiệu');
    expect(dlg.getByRole('link', { name: 'Hồ sơ thương hiệu' }).getAttribute('href')).toBe('/hoa-dao/cai-dat/thuong-hieu');
    expect((dlg.getByLabelText('Người đại diện') as HTMLInputElement).value).toBe('Chiến');
  });
});
