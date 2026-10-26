import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { apiErr, BASE, json, PROFILE_NO_BANK, renderAt, setupServer, setViewport, tpl, type Call } from './testServer';

// Màn tạo / sửa mẫu in (bản vẽ G 4.5): bật/tắt khối + xem trước trực tiếp, chữ có biến, mặc định, ngừng dùng, phiên bản.
configure({ asyncUtilTimeout: 5000 });
afterEach(() => {
  vi.unstubAllGlobals();
});

const OWNER = SYSTEM_ROLES.owner.permissions;
const MANAGER = SYSTEM_ROLES.manager.permissions;

const HD = tpl({ id: 'hd', name: 'Hiện đại — Chiến Makeup', layout: 2, version: 3, defaultFor: ['SERVICE'], usage: { printedContracts: 46, lastPrintedAt: null } });
const CD = tpl({ id: 'cd', name: 'Cổ điển có quốc hiệu', layout: 1, version: 1 });
const BOTH = tpl({ id: 'both', name: 'Sang trọng cả hai', layout: 5, appliesTo: ['SERVICE', 'COURSE'] });
const ALL = [HD, CD, BOTH];

const patches = (calls: Call[]) => calls.filter((c) => c.method === 'PATCH');
const posts = (calls: Call[]) => calls.filter((c) => c.method === 'POST');
const preview = () => within(screen.getByRole('region', { name: 'Xem trước bản in' }));
const norm = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');
const sw = (name: RegExp) => screen.getByRole('switch', { name }) as HTMLButtonElement;
const field = (label: RegExp) => screen.getByRole('textbox', { name: label }) as HTMLInputElement & HTMLTextAreaElement;
async function open(id: string, opts: Parameters<typeof setupServer>[1] = {}, perms: readonly string[] = OWNER) {
  const calls = setupServer(perms, { templates: ALL, ...opts });
  const router = renderAt(`${BASE}/${id}`);
  await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
  return { calls, router };
}

describe('màn sửa: đầu màn, phiên bản, dải vàng', () => {
  it('hiện tên, nhãn Mặc định · dịch vụ, "đang là bản v3", dải vàng "Lưu là tạo bản v4. 46 hợp đồng…"; chưa đổi gì thì nút Lưu khoá', async () => {
    await open('hd');
    expect(screen.getByRole('heading', { level: 1, name: 'Hiện đại — Chiến Makeup' })).toBeTruthy();
    expect(screen.getByText('Mặc định · dịch vụ')).toBeTruthy();
    expect(screen.getByText('đang là bản v3')).toBeTruthy();
    expect(screen.getByText('Lưu là tạo bản v4. 46 hợp đồng đã in bằng bản cũ vẫn in lại đúng như cũ; hợp đồng in sau dùng bản mới.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('mẫu chưa in lần nào: không có dải vàng', async () => {
    await open('cd');
    expect(screen.queryByText(/Lưu là tạo bản/)).toBeNull();
  });

  it('đổi TÊN: nút vẫn là "Lưu" (không tạo bản mới), PATCH chỉ {name}, báo "Đã lưu."', async () => {
    const { calls } = await open('hd');
    const user = userEvent.setup();
    await user.clear(field(/^Tên mẫu/));
    await user.type(field(/^Tên mẫu/), 'Tên mới');
    expect(screen.queryByRole('button', { name: /Lưu thành bản/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.path).toBe('/orgs/org-1/print-templates/hd');
    expect(patches(calls)[0]!.body).toEqual({ name: 'Tên mới' });
    expect(await screen.findByText('Đã lưu.')).toBeTruthy();
    expect(screen.getByText('đang là bản v3')).toBeTruthy();
  });

  it('đổi NỘI DUNG IN (tắt khối): nút ghi "Lưu thành bản v4", PATCH chỉ {blocks} (cả bảng), sau lưu "đang là bản v4" và dải vàng nhắc bản v5', async () => {
    const { calls } = await open('hd');
    const user = userEvent.setup();
    await user.click(sw(/Tên thợ/));
    expect(sw(/Tên thợ/).getAttribute('aria-checked')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Lưu thành bản v4' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toEqual({ blocks: { tho: false } });
    expect(await screen.findByText('Đã lưu — mẫu đang là bản v4.')).toBeTruthy();
    expect(screen.getByText('đang là bản v4')).toBeTruthy();
    expect(screen.getByText(/^Lưu là tạo bản v5\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeTruthy();
  });

  it('tắt rồi bật lại cùng khối → trở về y bản đã lưu: không bẩn, nút Lưu khoá, không gửi gì', async () => {
    const { calls } = await open('hd');
    const user = userEvent.setup();
    await user.click(sw(/Tên thợ/));
    await user.click(sw(/Tên thợ/));
    expect((screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
    expect(patches(calls)).toHaveLength(0);
  });

  it('đổi bố cục bằng ảnh: radio đúng; PATCH {layout}; nút "Lưu thành bản v{n+1}"', async () => {
    const { calls } = await open('cd');
    const user = userEvent.setup();
    const group = within(screen.getByRole('radiogroup', { name: 'Bố cục bản in' }));
    expect(group.getAllByRole('radio')).toHaveLength(5);
    expect(group.getByRole('radio', { name: /^1\. / }).getAttribute('aria-checked')).toBe('true');
    await user.click(group.getByRole('radio', { name: /^4\. Gọn một trang/ }));
    expect(group.getByRole('radio', { name: /^4\. / }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Lưu thành bản v2' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toEqual({ layout: 4 });
  });
});

describe('xem trước trực tiếp', () => {
  it('bật/tắt khối đổi tờ giấy ngay: tắt Quốc hiệu thì "CỘNG HOÀ XÃ HỘI" biến mất, bật lại thì có', async () => {
    await open('cd'); // bố cục 1: quốc hiệu bật sẵn
    await waitFor(() => expect(norm(preview().getByLabelText('Bản in hợp đồng'))).toContain('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
    const user = userEvent.setup();
    await user.click(sw(/Quốc hiệu/));
    await waitFor(() => expect(norm(preview().getByLabelText('Bản in hợp đồng'))).not.toContain('CỘNG HOÀ XÃ HỘI'));
    await user.click(sw(/Quốc hiệu/));
    await waitFor(() => expect(norm(preview().getByLabelText('Bản in hợp đồng'))).toContain('CỘNG HOÀ XÃ HỘI'));
  });

  it('chữ mở đầu có biến: biến được thay bằng dữ liệu mẫu; tiêu đề đổi theo', async () => {
    await open('cd');
    const user = userEvent.setup();
    await user.click(field(/^Chữ mở đầu/));
    await user.paste('Kính chào {Tên khách}, hợp đồng {Mã hợp đồng}.');
    await user.click(field(/^Tiêu đề/));
    await user.paste('HỢP ĐỒNG CỦA TÔI');
    await waitFor(() => {
      const t = norm(preview().getByLabelText('Bản in hợp đồng'));
      expect(t).toContain('Kính chào Nguyễn Thu Trang, hợp đồng HĐDV-000128.');
      expect(t).toContain('HỢP ĐỒNG CỦA TÔI');
    });
  });

  it('studio trên tờ xem trước lấy từ hồ sơ thật (tên, địa chỉ), không phải tên giả của dữ liệu mẫu', async () => {
    await open('cd');
    await waitFor(() => expect(norm(preview().getByLabelText('Bản in hợp đồng'))).toContain('25 Thái Hà, Đống Đa, Hà Nội'));
    expect(norm(preview().getByLabelText('Bản in hợp đồng'))).not.toContain('Trọng Liệt');
  });

  it('mẫu cả hai loại: có nút chuyển Hợp đồng dịch vụ / khoá học; chuyển thì tờ đổi sang hợp đồng đào tạo', async () => {
    await open('both');
    const user = userEvent.setup();
    await user.click(preview().getByRole('radio', { name: 'Hợp đồng khoá học' }));
    await waitFor(() => expect(norm(preview().getByLabelText('Bản in hợp đồng'))).toContain('HĐKH-000046'));
    await user.click(preview().getByRole('radio', { name: 'Bản ngắn' }));
    await waitFor(() => expect(norm(preview().getByLabelText('Bản in hợp đồng'))).not.toContain('HĐKH-000046'));
  });
});

describe('chữ trên bản in: chip biến, biến lạ báo đúng ô', () => {
  it('bấm chip chèn {biến} đúng chỗ con trỏ giữa chữ', async () => {
    await open('cd');
    const user = userEvent.setup();
    const area = field(/^Chữ mở đầu/);
    await user.click(area);
    await user.keyboard('ab');
    await user.keyboard('{ArrowLeft}');
    const group = within(screen.getByRole('group', { name: 'Chèn biến vào chữ mở đầu' }));
    await user.click(group.getByRole('button', { name: '{Tên khách}' }));
    expect(area.value).toBe('a{Tên khách}b');
  });

  it('chip chỉ có biến dùng được cho loại đang chọn; "Thêm biến" mở nốt', async () => {
    await open('cd'); // chỉ dịch vụ
    const group = within(screen.getByRole('group', { name: 'Chèn biến vào chữ mở đầu' }));
    expect(group.queryByRole('button', { name: '{Tên khoá}' })).toBeNull();
    expect(group.queryByRole('button', { name: '{Tên lớp}' })).toBeNull();
    expect(group.getByRole('button', { name: '{Ngày sự kiện}' })).toBeTruthy();
    expect(group.queryByRole('button', { name: '{Người đại diện}' })).toBeNull();
    await userEvent.click(group.getByRole('button', { name: /^Thêm biến/ }));
    expect(group.getByRole('button', { name: '{Người đại diện}' })).toBeTruthy();
  });

  it('biến lạ: báo ngay dưới đúng ô (không phải ô khác), kèm danh sách biến dùng được; bấm Lưu không gửi gì', async () => {
    const { calls } = await open('cd');
    const user = userEvent.setup();
    await user.click(field(/^Chữ mở đầu/));
    await user.paste('Chào {Xyz}');
    const area = field(/^Chữ mở đầu/);
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(await screen.findByText(/^Không có biến \{Xyz\}\. Biến dùng được: \{Tên studio\}/)).toBeTruthy();
    expect(field(/^Chữ kết thúc/).getAttribute('aria-invalid')).toBeNull();
    expect(field(/^Tiêu đề/).getAttribute('aria-invalid')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Lưu/ }));
    expect(patches(calls)).toHaveLength(0);
    expect(document.activeElement).toBe(area);
  });

  it('biến sai loại: mẫu dùng cả hai loại mà gõ {Tên lớp} → báo đúng lời', async () => {
    await open('both');
    const user = userEvent.setup();
    await user.click(field(/^Chữ kết thúc/));
    await user.paste('Lớp {Tên lớp}');
    expect(await screen.findByText('Biến {Tên lớp} chỉ dùng cho hợp đồng khoá học — mẫu này dùng cho cả hợp đồng dịch vụ')).toBeTruthy();
    expect(field(/^Chữ kết thúc/).getAttribute('aria-invalid')).toBe('true');
    expect(field(/^Chữ mở đầu/).getAttribute('aria-invalid')).toBeNull();
  });

  it('sửa lại cho đúng thì lỗi biến mất và lưu được; chữ gửi đã cắt khoảng trắng', async () => {
    const { calls } = await open('cd');
    const user = userEvent.setup();
    await user.click(field(/^Chữ kết thúc/));
    await user.paste(' Kết {Xyz} ');
    await screen.findByText(/Không có biến \{Xyz\}/);
    await user.clear(field(/^Chữ kết thúc/));
    await user.paste(' Cảm ơn {Tên khách} ');
    await waitFor(() => expect(screen.queryByText(/Không có biến/)).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Lưu thành bản v2' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toEqual({ closingText: 'Cảm ơn {Tên khách}' });
  });

  it('lời MÁY CHỦ: 400 có fields ["closingText"] → hiện đúng dưới ô chữ kết thúc, ô khác không đỏ', async () => {
    const { calls } = await open('cd', {
      patch: () =>
        apiErr(400, 'VALIDATION_FAILED', 'Không có biến {Mới}. Biến dùng được: {Tên studio}', {
          fields: ['closingText'],
          fieldErrors: { closingText: ['Không có biến {Mới}. Biến dùng được: {Tên studio}'] },
        }),
    });
    const user = userEvent.setup();
    await user.click(field(/^Chữ kết thúc/));
    await user.paste('Cảm ơn {Tên khách}');
    await user.click(screen.getByRole('button', { name: 'Lưu thành bản v2' }));
    expect(await screen.findByText('Không có biến {Mới}. Biến dùng được: {Tên studio}')).toBeTruthy();
    expect(patches(calls)).toHaveLength(1);
    expect(field(/^Chữ kết thúc/).getAttribute('aria-invalid')).toBe('true');
    expect(field(/^Chữ mở đầu/).getAttribute('aria-invalid')).toBeNull();
    // Sửa ô đó thì lỗi của máy chủ đi.
    await user.type(field(/^Chữ kết thúc/), '!');
    await waitFor(() => expect(screen.queryByText(/Không có biến \{Mới\}/)).toBeNull());
  });
});

describe('mặc định và ngừng dùng', () => {
  it('mẫu đang là mặc định: công tắc mặc định + "Đang dùng" bị khoá, có chú thích; "Dùng cho" không cho bỏ loại đang mặc định', async () => {
    await open('hd');
    expect(sw(/Mặc định cho hợp đồng dịch vụ/).disabled).toBe(true);
    expect(sw(/Mặc định cho hợp đồng dịch vụ/).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Muốn đổi mặc định: bật ở mẫu khác')).toBeTruthy();
    expect(sw(/Đang dùng/).disabled).toBe(true);
    const seg = within(screen.getByRole('radiogroup', { name: 'Dùng cho' }));
    expect((seg.getByRole('radio', { name: 'Khoá học' }) as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');
    expect((seg.getByRole('radio', { name: 'Dịch vụ' }) as HTMLButtonElement).getAttribute('aria-disabled')).toBeNull();
    expect((seg.getByRole('radio', { name: 'Cả hai' }) as HTMLButtonElement).getAttribute('aria-disabled')).toBeNull();
  });

  it('đặt mặc định: PATCH {defaultFor:["SERVICE"]}; sau đó nhãn Mặc định hiện và công tắc khoá', async () => {
    const { calls } = await open('cd');
    const user = userEvent.setup();
    await user.click(sw(/Mặc định cho hợp đồng dịch vụ/));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toEqual({ defaultFor: ['SERVICE'] });
    expect(await screen.findByText('Mặc định · dịch vụ')).toBeTruthy();
    await waitFor(() => expect(sw(/Mặc định cho hợp đồng dịch vụ/).disabled).toBe(true));
  });

  it('409 DEFAULT_TAKEN → lời tiếng Việt ngay dưới công tắc mặc định; giữ nguyên công tắc đã bật để thử lại', async () => {
    await open('cd', {
      patch: () =>
        apiErr(409, 'CONFLICT', 'Hợp đồng dịch vụ vừa có mẫu in mặc định khác — tải lại danh sách mẫu rồi thử lại', { reason: 'DEFAULT_TAKEN', kind: 'SERVICE' }),
    });
    const user = userEvent.setup();
    await user.click(sw(/Mặc định cho hợp đồng dịch vụ/));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    const msg = await screen.findByText('Hợp đồng dịch vụ vừa có mẫu in mặc định khác — tải lại danh sách mẫu rồi thử lại');
    expect(msg.getAttribute('role')).toBe('alert');
    expect(sw(/Mặc định cho hợp đồng dịch vụ/).getAttribute('aria-checked')).toBe('true');
    expect(msg.closest('.ui-row')?.textContent).toContain('Mặc định cho hợp đồng dịch vụ');
  });

  it('ngừng dùng mẫu thường: PATCH {isActive:false}, hiện nhãn "Ngừng dùng"; công tắc mặc định khoá khi đã ngừng', async () => {
    const { calls } = await open('cd');
    const user = userEvent.setup();
    await user.click(sw(/Đang dùng/));
    expect(sw(/Mặc định cho hợp đồng dịch vụ/).disabled).toBe(true);
    expect(screen.getByText('Bật "Đang dùng" trước')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toEqual({ isActive: false });
    expect(await screen.findByText('Ngừng dùng')).toBeTruthy();
  });

  it('409 DEFAULT_REQUIRED khi gửi ngừng dùng (mẫu vừa thành mặc định ở máy khác) → lời máy chủ dưới công tắc "Đang dùng"', async () => {
    await open('cd', { patch: () => apiErr(409, 'CONFLICT', 'Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác', { reason: 'DEFAULT_REQUIRED' }) });
    const user = userEvent.setup();
    await user.click(sw(/Đang dùng/));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    const msg = await screen.findByText('Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác');
    expect(msg.closest('.ui-row')?.textContent).toContain('Đang dùng');
  });

  it('sau 409 DEFAULT_REQUIRED máy khách lấy lại mẫu: công tắc khớp máy chủ (nay là mặc định → khoá), lời máy chủ vẫn hiện, chữ đang sửa còn nguyên', async () => {
    const stale = tpl({ id: 'st', name: 'Mẫu cũ', layout: 1, version: 2 });
    const templates = [stale];
    const { calls } = await open('st', {
      templates,
      patch: () => {
        templates[0] = { ...stale, defaultFor: ['SERVICE'] }; // người khác vừa đặt mẫu này làm mặc định
        return apiErr(409, 'CONFLICT', 'Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác', { reason: 'DEFAULT_REQUIRED' });
      },
    });
    const user = userEvent.setup();
    await user.click(field(/^Chữ kết thúc/));
    await user.paste('Cảm ơn quý khách');
    await user.click(sw(/Đang dùng/));
    await user.click(screen.getByRole('button', { name: /^Lưu/ }));
    expect(await screen.findByText('Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác')).toBeTruthy();
    await waitFor(() => expect(sw(/Đang dùng/).disabled).toBe(true));
    expect(sw(/Đang dùng/).getAttribute('aria-checked')).toBe('true');
    expect(sw(/Mặc định cho hợp đồng dịch vụ/).getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByText('Mặc định · dịch vụ')).toBeTruthy();
    expect(field(/^Chữ kết thúc/).value).toBe('Cảm ơn quý khách');
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/orgs/org-1/print-templates/st')).toHaveLength(2);
  });

  it('409 DEFAULT_REQUIRED khi gửi đổi "Dùng cho" → lời máy chủ dưới ô "Dùng cho"', async () => {
    await open('both', { patch: () => apiErr(409, 'CONFLICT', 'Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác', { reason: 'DEFAULT_REQUIRED' }) });
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Dùng cho' })).getByRole('radio', { name: 'Khoá học' }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    const msg = await screen.findByText('Mỗi loại hợp đồng cần một mẫu mặc định — bật mặc định ở mẫu khác');
    expect(msg.closest('.ui-row')?.textContent).toContain('Dùng cho');
  });
});

describe('loại hợp đồng và tổ chức', () => {
  it('tổ chức KHÔNG phải ACADEMY: không có lựa chọn Khoá học / Cả hai, không có khối Nội quy, không có mặc định khoá học', async () => {
    await open('cd', { kind: 'TEAM' });
    expect(screen.queryByRole('radiogroup', { name: 'Dùng cho' })).toBeNull();
    expect(screen.getByText('Hợp đồng dịch vụ', { selector: '.mi-fixed' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Nội quy/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Mặc định cho hợp đồng khoá học/ })).toBeNull();
    expect(sw(/Tên thợ/)).toBeTruthy();
  });

  it('ACADEMY chọn "Cả hai": PATCH {appliesTo}; hiện thêm khối Nội quy + công tắc mặc định khoá học; chip biến chỉ còn biến dùng cho cả hai', async () => {
    const { calls } = await open('cd');
    const user = userEvent.setup();
    expect(screen.queryByRole('switch', { name: /Nội quy/ })).toBeNull();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Dùng cho' })).getByRole('radio', { name: 'Cả hai' }));
    expect(sw(/Nội quy/)).toBeTruthy();
    expect(sw(/Mặc định cho hợp đồng khoá học/)).toBeTruthy();
    const group = within(screen.getByRole('group', { name: 'Chèn biến vào chữ mở đầu' }));
    expect(group.queryByRole('button', { name: '{Ngày sự kiện}' })).toBeNull();
    expect(group.queryByRole('button', { name: '{Tên khoá}' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(patches(calls)[0]!.body).toEqual({ appliesTo: ['SERVICE', 'COURSE'] });
  });

  it('khối khoá học không có "Tên thợ"; khối dịch vụ không có "Nội quy"', async () => {
    setupServer(OWNER, { templates: [tpl({ id: 'kh', name: 'Khoá', layout: 1, appliesTo: ['COURSE'], defaultFor: ['COURSE'] })] });
    renderAt(`${BASE}/kh`);
    await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
    expect(screen.queryByRole('switch', { name: /Tên thợ/ })).toBeNull();
    expect(sw(/Nội quy/)).toBeTruthy();
    expect(sw(/Mặc định cho hợp đồng khoá học/).disabled).toBe(true);
  });

  it('bốn khối luôn có hiện chữ "luôn có" và không có công tắc', async () => {
    await open('cd');
    expect(screen.getAllByText('luôn có')).toHaveLength(4);
    for (const n of ['Tiêu đề và số hợp đồng', 'Bảng dịch vụ / khoá học', 'Tổng tiền', 'Chỗ ký hai bên']) {
      expect(screen.getByText(n)).toBeTruthy();
      expect(screen.queryByRole('switch', { name: new RegExp(n) })).toBeNull();
    }
  });

  it('nhãn "chưa nhập" ở khối Tài khoản chuyển khoản khi chưa có ngân hàng; "điền tay" ở CCCD; có ngân hàng thì không có "chưa nhập"', async () => {
    await open('cd', { profile: PROFILE_NO_BANK });
    expect(await screen.findByText('chưa nhập')).toBeTruthy();
    expect(screen.getByText('điền tay')).toBeTruthy();
  });

  it('có ngân hàng: không có nhãn "chưa nhập"', async () => {
    await open('cd');
    await waitFor(() => expect(norm(preview().getByLabelText('Bản in hợp đồng'))).toContain('Vietcombank'));
    expect(screen.queryByText('chưa nhập')).toBeNull();
  });
});

describe('mẫu không có / rời màn', () => {
  it('mã mẫu không có → "Không tìm thấy mẫu in." + liên kết về danh sách', async () => {
    setupServer(OWNER, { templates: ALL });
    renderAt(`${BASE}/khong-co`);
    expect(await screen.findByText('Không tìm thấy mẫu in.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về danh sách mẫu in' }).getAttribute('href')).toBe(BASE);
  });

  it('chưa đổi gì: Huỷ về danh sách ngay; đã đổi: hỏi "Bỏ thay đổi mẫu in?" — Ở lại giữ nguyên, Bỏ thay đổi thì rời', async () => {
    const { router } = await open('cd');
    const user = userEvent.setup();
    await user.click(sw(/Tên thợ/));
    await user.click(screen.getByRole('button', { name: 'Huỷ' }));
    const dlg = within(await screen.findByRole('dialog'));
    expect(dlg.getByText('Bỏ thay đổi mẫu in?')).toBeTruthy();
    await user.click(dlg.getByRole('button', { name: 'Ở lại' }));
    expect(router.state.location.pathname).toBe(`${BASE}/cd`);
    expect(sw(/Tên thợ/).getAttribute('aria-checked')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Huỷ' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(BASE));
  });

  it('chưa đổi gì: Huỷ về danh sách, không hỏi', async () => {
    const { router } = await open('cd');
    await userEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(BASE));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('tạo mẫu từ bố cục', () => {
  const NEW = tpl({ id: 'new-1', name: 'Mẫu Gọn một trang', layout: 4 });

  it('mở /moi?bo-cuc=4&loai=SERVICE: bố cục 4 được chọn, tên gợi ý, nút "Tạo mẫu"; lưu → POST có Idempotency-Key, thân tối thiểu, rồi sang màn sửa mẫu vừa tạo', async () => {
    const calls = setupServer(OWNER, { templates: [...ALL, NEW] });
    const router = renderAt(`${BASE}/moi?bo-cuc=4&loai=SERVICE`);
    await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
    expect(within(screen.getByRole('radiogroup', { name: 'Bố cục bản in' })).getByRole('radio', { name: /^4\./ }).getAttribute('aria-checked')).toBe('true');
    expect(field(/^Tên mẫu/).value).toBe('Mẫu Gọn một trang');
    expect(screen.getByText('Mẫu mới')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Đang dùng/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    const post = posts(calls)[0]!;
    expect(post.path).toBe('/orgs/org-1/print-templates');
    expect(post.body).toEqual({ name: 'Mẫu Gọn một trang', layout: 4, appliesTo: ['SERVICE'] });
    expect(post.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${BASE}/new-1`));
    expect(await screen.findByText('Đã tạo mẫu in.')).toBeTruthy();
    expect(await screen.findByText('đang là bản v1')).toBeTruthy();
  });

  it('tạo có chỉnh: đổi bố cục, tắt khối, tiêu đề, đặt mặc định → POST đủ các trường đó', async () => {
    const calls = setupServer(OWNER, { templates: [...ALL, NEW] });
    renderAt(`${BASE}/moi?bo-cuc=2&loai=SERVICE`);
    await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Bố cục bản in' })).getByRole('radio', { name: /^5\./ }));
    await user.click(sw(/Tên thợ/));
    await user.click(field(/^Tiêu đề/));
    await user.paste('HỢP ĐỒNG CỦA TÔI');
    await user.click(sw(/Mặc định cho hợp đồng dịch vụ/));
    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0]!.body).toEqual({
      name: 'Mẫu Hiện đại tối giản',
      layout: 5,
      appliesTo: ['SERVICE'],
      blocks: { tho: false },
      title: 'HỢP ĐỒNG CỦA TÔI',
      defaultFor: ['SERVICE'],
    });
  });

  it('loai=COURSE ở ACADEMY: mẫu khoá học, không có Tên thợ, có Nội quy; POST appliesTo ["COURSE"]', async () => {
    const calls = setupServer(OWNER, { templates: [...ALL, NEW] });
    renderAt(`${BASE}/moi?bo-cuc=1&loai=COURSE`);
    await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
    expect(screen.queryByRole('switch', { name: /Tên thợ/ })).toBeNull();
    expect(sw(/Nội quy/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0]!.body).toEqual({ name: 'Mẫu Cổ điển trang trọng', layout: 1, appliesTo: ['COURSE'] });
  });

  it('tên trống: báo lỗi dưới ô tên, KHÔNG gửi', async () => {
    const calls = setupServer(OWNER, { templates: ALL });
    renderAt(`${BASE}/moi?bo-cuc=2&loai=SERVICE`);
    await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
    const user = userEvent.setup();
    await user.clear(field(/^Tên mẫu/));
    expect(await screen.findByText('Tên mẫu không được để trống')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    expect(posts(calls)).toHaveLength(0);
    expect(document.activeElement).toBe(field(/^Tên mẫu/));
  });

  it('gửi lại sau lỗi mạng/5xx: CÙNG khoá chống trùng; sửa nội dung thì khoá MỚI', async () => {
    let n = 0;
    const calls = setupServer(OWNER, {
      templates: [...ALL, NEW],
      post: () => {
        n += 1;
        return n <= 2 ? apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại.') : json(201, NEW);
      },
    });
    renderAt(`${BASE}/moi?bo-cuc=4&loai=SERVICE`);
    await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    expect(await screen.findByText('Máy chủ gặp lỗi, vui lòng thử lại.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    expect(posts(calls)[1]!.headers['idempotency-key']).toBe(posts(calls)[0]!.headers['idempotency-key']);
    await user.type(field(/^Tên mẫu/), ' 2');
    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(3));
    expect(posts(calls)[2]!.headers['idempotency-key']).not.toBe(posts(calls)[0]!.headers['idempotency-key']);
  });

  it('thiếu hoặc sai tham số → không dựng màn tạo, nói rõ + liên kết về danh sách (không đoán mặc định)', async () => {
    for (const q of ['', '?bo-cuc=2', '?loai=SERVICE', '?bo-cuc=9&loai=SERVICE', '?bo-cuc=x&loai=SERVICE', '?bo-cuc=2&loai=ABC']) {
      setupServer(OWNER, { templates: ALL });
      renderAt(`${BASE}/moi${q}`);
      expect(await screen.findByText('Đường dẫn tạo mẫu không hợp lệ — hãy mở lại từ danh sách mẫu in.'), q).toBeTruthy();
      expect(screen.queryByRole('radiogroup', { name: 'Bố cục bản in' })).toBeNull();
      document.body.innerHTML = '';
    }
  });

  it('loai=COURSE ở tổ chức không phải ACADEMY → "Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ"', async () => {
    setupServer(OWNER, { kind: 'TEAM', templates: ALL });
    renderAt(`${BASE}/moi?bo-cuc=1&loai=COURSE`);
    expect(await screen.findByText('Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ')).toBeTruthy();
  });

  it('Quản lý (contracts.texts) tạo được mẫu', async () => {
    const calls = setupServer(MANAGER, { templates: [...ALL, NEW] });
    renderAt(`${BASE}/moi?bo-cuc=2&loai=SERVICE`);
    await screen.findByRole('radiogroup', { name: 'Bố cục bản in' });
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
  });
});

describe('điện thoại 390', () => {
  it('xem trước mở trong hộp thoại; thanh dưới có "Xem trước" và "Lưu"; không có nút ở đầu trang', async () => {
    setViewport('phone');
    await open('cd');
    expect(screen.queryByRole('region', { name: 'Xem trước bản in' })).toBeNull();
    const bar = within(screen.getByRole('region', { name: 'Lưu mẫu in' }));
    expect(bar.getByRole('button', { name: 'Lưu' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Huỷ' })).toBeNull();
    await userEvent.click(bar.getByRole('button', { name: 'Xem trước' }));
    const dlg = within(await screen.findByRole('dialog'));
    expect(dlg.getByText('Xem trước bản in', { selector: 'h2, h3, [class*=title]' })).toBeTruthy();
    await waitFor(() => expect(norm(dlg.getByLabelText('Bản in hợp đồng'))).toContain('CỘNG HOÀ XÃ HỘI'));
    await userEvent.click(dlg.getAllByRole('button', { name: 'Đóng' }).at(-1)!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
