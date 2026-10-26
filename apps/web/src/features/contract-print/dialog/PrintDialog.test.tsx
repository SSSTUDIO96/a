import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractPrintData } from '@makeup/shared';
import { ApiError } from '../../../api/errors';
import * as printApi from '../../../api/print';
import type { PrintCreateInput } from '../../../api/types';
import { SAMPLE } from '../paper/sampleData';
import { PrintDialog } from './PrintDialog';
import { HASH_NOW, HASH_SNAP, T_MODERN, T_TABLE, printData, record, snapshot, tpl, withStatus } from './PrintDialog.fixtures';

// Hộp In (bản vẽ G mục 4.4) với tầng API giả: thân POST đúng cho từng nguồn; 201 → window.print SAU phản hồi, đúng 1 lần;
// 409 → tải lại, KHÔNG in; Idempotency-Key giữ khi thử lại; "Mở lại" không POST; mất mạng / phông chưa sẵn sàng → nút tắt;
// REPRINT ẩn công tắc nhanh; BẢN NHÁP; che theo quyền; cảnh báo Safari.

vi.mock('../../../api/print', () => ({
  getPrintData: vi.fn(),
  getContractPrint: vi.fn(),
  createContractPrint: vi.fn(),
  listPrintTemplates: vi.fn(),
}));

const api = vi.mocked(printApi);
let printSpy: ReturnType<typeof vi.spyOn>;
const events: string[] = [];

function mountDialog(props: Partial<React.ComponentProps<typeof PrintDialog>> = {}) {
  const onClose = vi.fn();
  const r = render(
    <MemoryRouter initialEntries={['/chien/hop-dong/hd-1']}>
      <Routes>
        <Route
          path="/:orgSlug/hop-dong/:id"
          element={<PrintDialog open onClose={onClose} orgId="org-1" tz="Asia/Ho_Chi_Minh" contractId="hd-1" canManageTemplates={false} phone={false} {...props} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...r, onClose };
}

const printBtn = () => screen.getByRole('button', { name: /In \/ (Lưu )?PDF|Đang chuẩn bị bản in/ });
const paper = () => document.querySelector('article.hdin-giay') as HTMLElement;
const pageStyle = () => Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
const lastBody = (): PrintCreateInput => api.createContractPrint.mock.calls.at(-1)![2];
const lastKey = (): string => api.createContractPrint.mock.calls.at(-1)![3];

async function loaded() {
  await screen.findByText(/Chọn mẫu in/);
  await waitFor(() => expect(printBtn()).toHaveProperty('disabled', false));
}

beforeEach(() => {
  events.length = 0;
  vi.resetAllMocks();
  printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
    events.push('print');
  });
  api.getPrintData.mockResolvedValue(printData());
  api.createContractPrint.mockImplementation(async () => {
    events.push('post');
    return record({ id: 'pr-new', printNo: 1 });
  });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => {
  cleanup();
  printSpy.mockRestore();
  Reflect.deleteProperty(document, 'fonts');
  vi.unstubAllGlobals();
});

describe('hộp In: tải và xem trước dữ liệu thật', () => {
  it('mở ra gọi print-data, vẽ đúng tờ in của mẫu mặc định (hiện đại, bố cục 2) với mã hợp đồng và tổng tiền của máy chủ', async () => {
    mountDialog();
    await loaded();
    expect(api.getPrintData).toHaveBeenCalledWith('org-1', 'hd-1', expect.any(AbortSignal));
    expect(paper().className).toContain('hdin-g2');
    expect(paper().textContent).toContain(SAMPLE.SERVICE.long.contract.code);
    expect(paper().textContent).toContain(SAMPLE.SERVICE.long.money.totalInWords);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveProperty('checked', true);
    expect(screen.getByText('Mặc định')).toBeTruthy();
    expect(screen.getByText(/Bố cục 3 · Bảng kẻ đầy đủ/)).toBeTruthy();
  });

  it('đổi mẫu → tờ in đổi bố cục theo mẫu; thân POST mang đúng mẫu + phiên bản + mã băm', async () => {
    const u = userEvent.setup();
    mountDialog();
    await loaded();
    await u.click(screen.getByRole('radio', { name: /Bảng kẻ đầy đủ/ }));
    expect(paper().className).toContain('hdin-g3');
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(api.createContractPrint).toHaveBeenCalledWith('org-1', 'hd-1', { source: 'TEMPLATE', templateId: T_TABLE.id, expectedTemplateVersion: 4, expectedDataHash: HASH_NOW }, expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('hợp đồng nháp: tờ in có BẢN NHÁP (cạnh số hợp đồng và ở chân trang)', async () => {
    mountDialog();
    await loaded();
    expect(paper().textContent).toContain('BẢN NHÁP');
    expect(pageStyle()).toContain('BẢN NHÁP');
  });

  it('lỗi tải: hiện lời máy chủ + nút Thử lại; bấm thử lại tải lại được', async () => {
    const u = userEvent.setup();
    api.getPrintData.mockRejectedValueOnce(new ApiError('NOT_FOUND', 'Không tìm thấy hợp đồng', 404, null));
    mountDialog();
    expect(await screen.findByText('Không tìm thấy hợp đồng')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Thử lại' }));
    await loaded();
    expect(api.getPrintData).toHaveBeenCalledTimes(2);
  });

  it('không có mẫu nào: báo "Chưa có mẫu in cho loại hợp đồng này", có liên kết Cài đặt khi được quyền; nút In tắt', async () => {
    api.getPrintData.mockResolvedValue(printData({ templates: [], defaultTemplateId: null }));
    mountDialog({ canManageTemplates: true });
    expect(await screen.findByText('Chưa có mẫu in cho loại hợp đồng này')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Cài đặt › Mẫu in hợp đồng' });
    expect(link.getAttribute('href')).toBe('/chien/cai-dat/mau-in');
    expect(printBtn()).toHaveProperty('disabled', true);
  });

  it('không có quyền quản lý mẫu → không có liên kết Cài đặt', async () => {
    api.getPrintData.mockResolvedValue(printData({ templates: [], defaultTemplateId: null }));
    mountDialog({ canManageTemplates: false });
    await screen.findByText('Chưa có mẫu in cho loại hợp đồng này');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('có quyền quản lý mẫu → liên kết "Sửa mẫu in"', async () => {
    mountDialog({ canManageTemplates: true });
    await loaded();
    expect(screen.getByRole('link', { name: 'Sửa mẫu in' }).getAttribute('href')).toBe('/chien/cai-dat/mau-in');
  });
});

describe('hộp In: công tắc nhanh chỉ cho lần in này', () => {
  it('bật/tắt khối → blockOverrides trong thân POST, tờ in đổi theo; không gửi khoá chưa đụng tới', async () => {
    const u = userEvent.setup();
    mountDialog();
    await loaded();
    expect(paper().textContent).not.toContain('Ký nháy'); // mẫu 2 tắt sẵn ký nháy (chân trang nằm trong CSS)
    await u.click(screen.getByRole('switch', { name: 'Ô ký nháy cuối mỗi trang' }));
    expect(pageStyle()).toContain('Ký nháy');
    await u.click(screen.getByRole('switch', { name: 'Kèm phiếu thu đã nhận' }));
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    const body = lastBody();
    expect(body).toMatchObject({ source: 'TEMPLATE', templateId: T_MODERN.id });
    expect((body as { blockOverrides?: unknown }).blockOverrides).toEqual({ 'ky-nhay': true, 'da-thu': expect.any(Boolean) });
    expect(Object.keys((body as { blockOverrides: object }).blockOverrides)).toHaveLength(2);
  });

  it('chưa nhập ngân hàng → công tắc chuyển khoản tắt + khoá + có chú thích; không có quyền xem thu tiền → công tắc phiếu thu khoá', async () => {
    const d: ContractPrintData = { ...SAMPLE.SERVICE.long, studio: { ...SAMPLE.SERVICE.long.studio, bank: null }, payments: null, paymentsHidden: true };
    api.getPrintData.mockResolvedValue(printData({}, 'DRAFT', d));
    mountDialog();
    await loaded();
    const bank = screen.getByRole('switch', { name: /Tài khoản chuyển khoản/ });
    expect(bank).toHaveProperty('disabled', true);
    expect(bank.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/chưa nhập ngân hàng/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Kèm phiếu thu đã nhận/ })).toHaveProperty('disabled', true);
    expect(screen.getByText(/không có quyền xem thu tiền/)).toBeTruthy();
  });
});

describe('hộp In: in theo mẫu đã in / in lại y hệt', () => {
  const confirmedNow = (extra: Partial<ContractPrintData['money']> = {}): ContractPrintData => {
    const d = withStatus(SAMPLE.SERVICE.long, 'CONFIRMED');
    return { ...d, money: { ...d.money, ...extra } };
  };

  it('đã xác nhận, dữ liệu KHÔNG đổi: chọn sẵn "Giữ mẫu đã in", gửi REPRINT bằng bản chụp, không có công tắc "In lại y hệt", ẩn công tắc nhanh', async () => {
    const u = userEvent.setup();
    const snap = snapshot();
    api.getPrintData.mockResolvedValue(printData({ lastPrint: { ...record(), sameData: true }, printCount: 1 }, 'CONFIRMED'));
    api.getContractPrint.mockResolvedValue(snap);
    mountDialog();
    await loaded();
    expect(api.getContractPrint).toHaveBeenCalledWith('org-1', 'hd-1', 'pr-1', expect.any(AbortSignal));
    expect(screen.getByRole('radio', { name: /Giữ mẫu đã in — Mẫu thử · bản v1/ })).toHaveProperty('checked', true);
    expect(screen.getByText(/Lần in 1: 20\/10\/2026 14:30 · Nguyễn Trọng Chiến/)).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'In lại y hệt bản đã in' })).toBeNull();
    expect(screen.queryByText('Chỉ cho lần in này')).toBeNull();
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(lastBody()).toEqual({ source: 'REPRINT', basedOnPrintId: 'pr-1', expectedDataHash: HASH_SNAP });
    expect(lastBody()).not.toHaveProperty('blockOverrides');
    // Dấu chân trang của bản in lại: "In lại bản lần <số của bản gốc>".
    expect(pageStyle()).toContain('In lại bản lần 1');
  });

  it('đã xác nhận, dữ liệu ĐÃ đổi: chọn sẵn PRIOR_CONFIG + danh sách thay đổi; bật "In lại y hệt" → REPRINT với mã băm của bản chụp', async () => {
    const u = userEvent.setup();
    const now = confirmedNow({ total: 7_452_000 });
    api.getPrintData.mockResolvedValue(printData({ lastPrint: { ...record(), sameData: false }, printCount: 1 }, 'CONFIRMED', now));
    api.getContractPrint.mockResolvedValue(snapshot());
    mountDialog();
    await loaded();
    const toggle = screen.getByRole('switch', { name: 'In lại y hệt bản đã in' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Tổng 7.152.000 ₫ → 7.452.000 ₫')).toBeTruthy();
    // Tờ in là DỮ LIỆU MỚI + cấu hình cũ.
    expect(paper().textContent).toContain('7.452.000');
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(lastBody()).toEqual({ source: 'PRIOR_CONFIG', basedOnPrintId: 'pr-1', expectedDataHash: HASH_NOW });
    await u.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(paper().textContent).toContain('7.152.000');
    expect(paper().textContent).not.toContain('7.452.000');
    expect(screen.queryByText('Chỉ cho lần in này')).toBeNull();
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(2));
    expect(lastBody()).toEqual({ source: 'REPRINT', basedOnPrintId: 'pr-1', expectedDataHash: HASH_SNAP });
  });

  it('PRIOR_CONFIG kèm công tắc nhanh → blockOverrides trong thân; mẫu đã sửa sau lần in được nhắc', async () => {
    const u = userEvent.setup();
    const now = confirmedNow({ total: 7_452_000 });
    const newer = tpl(T_MODERN.id, 'Hiện đại', 2, 3, { defaultFor: ['SERVICE'] });
    api.getPrintData.mockResolvedValue(printData({ templates: [newer, T_TABLE], lastPrint: { ...record(), sameData: false } }, 'CONFIRMED', now));
    api.getContractPrint.mockResolvedValue(snapshot());
    mountDialog();
    await loaded();
    expect(screen.getByText('Đã sửa từ v1 lên v3 sau lần in trước')).toBeTruthy();
    await u.click(screen.getByRole('switch', { name: 'Ô ký nháy cuối mỗi trang' }));
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(lastBody()).toEqual({ source: 'PRIOR_CONFIG', basedOnPrintId: 'pr-1', blockOverrides: { 'ky-nhay': expect.any(Boolean) }, expectedDataHash: HASH_NOW });
  });

  it('nháp đã in: chọn sẵn MẪU của lần in trước (nếu còn dùng được), vẫn cho chọn "Giữ mẫu đã in"', async () => {
    api.getPrintData.mockResolvedValue(printData({ lastPrint: { ...record({ templateId: T_TABLE.id, templateName: 'Bảng kẻ đầy đủ', templateVersion: 4 }), sameData: true } }));
    api.getContractPrint.mockResolvedValue(snapshot());
    mountDialog();
    await loaded();
    expect(screen.getByRole('radio', { name: /Bảng kẻ đầy đủ · bản v4/ })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: /Giữ mẫu đã in/ })).toHaveProperty('checked', false);
  });

  it('không tải được bản chụp lần in trước: hiện lời, vẫn in được theo mẫu', async () => {
    api.getPrintData.mockResolvedValue(printData({ lastPrint: { ...record(), sameData: true } }, 'CONFIRMED'));
    api.getContractPrint.mockRejectedValue(new ApiError('NOT_FOUND', 'Không tìm thấy lần in', 404, null));
    mountDialog();
    await loaded();
    expect(screen.getByText(/Không tải được bản đã in lần trước: Không tìm thấy lần in/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Giữ mẫu đã in/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Hiện đại/ })).toHaveProperty('checked', true);
  });
});

describe('hộp In: bấm In — ghi nhật ký TRƯỚC rồi mới mở hộp in', () => {
  it('window.print chỉ được gọi SAU khi máy chủ trả 201, đúng 1 lần; dấu "In lần k" gắn vào tờ; hiện "Đã ghi lần in thứ k"', async () => {
    const u = userEvent.setup();
    let release!: () => void;
    api.createContractPrint.mockImplementation(
      () =>
        new Promise((res) => {
          events.push('post-gửi');
          release = () => {
            events.push('post-xong');
            res(record({ id: 'pr-new', printNo: 3, printedAt: '2026-10-25T17:30:00.000Z' }));
          };
        }),
    );
    mountDialog();
    await loaded();
    await u.click(printBtn());
    await waitFor(() => expect(api.createContractPrint).toHaveBeenCalledTimes(1));
    expect(printSpy).not.toHaveBeenCalled();
    expect(printBtn()).toHaveProperty('disabled', true); // đang chờ: khoá, không gửi hai lần
    await act(async () => release());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(events).toEqual(['post-gửi', 'post-xong', 'print']);
    expect(await screen.findByText('Đã ghi lần in thứ 3')).toBeTruthy();
    // 17:30 UTC ngày 25 = 00:30 ngày 26 theo giờ Hà Nội: dấu ghi NGÀY ĐỊA PHƯƠNG.
    expect(pageStyle()).toContain('In lần 3 · 26/10/2026');
  });

  it('bấm hai lần liên tiếp khi đang chờ chỉ gửi MỘT yêu cầu', async () => {
    const u = userEvent.setup();
    let release!: () => void;
    api.createContractPrint.mockImplementation(() => new Promise((res) => (release = () => res(record()))));
    mountDialog();
    await loaded();
    const b = printBtn();
    await u.click(b);
    await u.click(b);
    await u.dblClick(b);
    expect(api.createContractPrint).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
  });

  it('"Hộp in không hiện? Mở lại" chỉ gọi window.print, KHÔNG ghi thêm nhật ký', async () => {
    const u = userEvent.setup();
    mountDialog();
    await loaded();
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    await u.click(await screen.findByRole('button', { name: 'Hộp in không hiện? Mở lại' }));
    expect(printSpy).toHaveBeenCalledTimes(2);
    expect(api.createContractPrint).toHaveBeenCalledTimes(1);
  });

  it('đổi lựa chọn sau khi đã ghi → bỏ dấu lần in cũ và dải "Đã ghi" (lần in mới sẽ ghi lần mới)', async () => {
    const u = userEvent.setup();
    mountDialog();
    await loaded();
    await u.click(printBtn());
    await screen.findByText('Đã ghi lần in thứ 1');
    await u.click(screen.getByRole('radio', { name: /Bảng kẻ đầy đủ/ }));
    expect(screen.queryByText('Đã ghi lần in thứ 1')).toBeNull();
    expect(pageStyle()).not.toContain('In lần 1');
  });

  it('in lần nữa sau khi đã ghi → khoá chống trùng MỚI (đây là một lần in mới)', async () => {
    const u = userEvent.setup();
    mountDialog();
    await loaded();
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    const first = lastKey();
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(2));
    expect(lastKey()).not.toBe(first);
  });
});

describe('hộp In: lỗi khi ghi nhật ký — không bao giờ mở hộp in', () => {
  it('409 DATA_CHANGED: tải lại print-data, không in, hiện lời máy chủ + danh sách thay đổi + cách xử lý; bản xem trước đã là dữ liệu mới', async () => {
    const u = userEvent.setup();
    const fresh = withStatus(SAMPLE.SERVICE.long, 'DRAFT');
    const changed: ContractPrintData = { ...fresh, money: { ...fresh.money, total: fresh.money.total + 300_000 } };
    api.getPrintData.mockResolvedValueOnce(printData()).mockResolvedValueOnce(printData({ dataHash: 'c'.repeat(64) }, 'DRAFT', changed));
    api.createContractPrint.mockRejectedValue(
      new ApiError('CONFLICT', 'Hợp đồng vừa thay đổi — đã tải dữ liệu mới, xem lại rồi bấm In lần nữa', 409, null, { reason: 'DATA_CHANGED' }),
    );
    mountDialog();
    await loaded();
    await u.click(printBtn());
    expect(await screen.findByText(/Hợp đồng vừa thay đổi — đã tải dữ liệu mới/)).toBeTruthy();
    expect(screen.getByText(/Bản xem trước đã được làm mới/)).toBeTruthy();
    expect(screen.getByText('Tổng 7.152.000 ₫ → 7.452.000 ₫')).toBeTruthy();
    expect(printSpy).not.toHaveBeenCalled();
    expect(api.getPrintData).toHaveBeenCalledTimes(2);
    expect(paper().textContent).toContain('7.452.000');
    // Bấm In lần nữa: gửi mã băm MỚI với khoá MỚI.
    api.createContractPrint.mockResolvedValueOnce(record());
    const firstKey = lastKey();
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(lastBody()).toMatchObject({ expectedDataHash: 'c'.repeat(64) });
    expect(lastKey()).not.toBe(firstKey);
  });

  it('409 TEMPLATE_CHANGED: tải lại, không in, báo bản mẫu mới; gửi lại với phiên bản mới', async () => {
    const u = userEvent.setup();
    const newer = tpl(T_MODERN.id, 'Hiện đại', 2, 2, { defaultFor: ['SERVICE'] });
    api.getPrintData.mockResolvedValueOnce(printData()).mockResolvedValueOnce(printData({ templates: [newer, T_TABLE] }));
    api.createContractPrint.mockRejectedValueOnce(
      new ApiError('CONFLICT', 'Mẫu in vừa được sửa (nay là bản v2) — xem lại bản in rồi bấm In lần nữa', 409, null, { reason: 'TEMPLATE_CHANGED', templateVersion: 2 }),
    );
    mountDialog();
    await loaded();
    await u.click(printBtn());
    expect(await screen.findByText(/Mẫu in vừa được sửa \(nay là bản v2\)/)).toBeTruthy();
    expect(screen.getByText(/Bản xem trước đã dùng bản mẫu mới/)).toBeTruthy();
    expect(printSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Hiện đại · bản v2/ })).toHaveProperty('checked', true);
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(lastBody()).toMatchObject({ source: 'TEMPLATE', expectedTemplateVersion: 2 });
  });

  it('409 CONTRACT_CANCELLED: lời tiếng Việt + cách xử lý, nút In tắt hẳn, không in', async () => {
    const u = userEvent.setup();
    api.createContractPrint.mockRejectedValue(new ApiError('CONFLICT', 'Hợp đồng đã huỷ — không in', 409, null, { reason: 'CONTRACT_CANCELLED' }));
    mountDialog();
    await loaded();
    await u.click(printBtn());
    expect(await screen.findAllByText('Hợp đồng đã huỷ — không in')).not.toHaveLength(0);
    expect(screen.getByText(/Hợp đồng đã huỷ nên không có bản in/)).toBeTruthy();
    expect(printSpy).not.toHaveBeenCalled();
    expect(printBtn()).toHaveProperty('disabled', true);
  });

  it('mở hộp cho hợp đồng đã huỷ → báo ngay, nút In tắt', async () => {
    api.getPrintData.mockResolvedValue(printData({}, 'CANCELLED'));
    mountDialog();
    expect(await screen.findByText('Hợp đồng đã huỷ — không in')).toBeTruthy();
    expect(printBtn()).toHaveProperty('disabled', true);
  });

  it('mất mạng giữa chừng: không in; bấm lại gửi lại với CÙNG Idempotency-Key (không ghi trùng); xong thì in 1 lần', async () => {
    const u = userEvent.setup();
    api.createContractPrint
      .mockRejectedValueOnce(new ApiError('NETWORK', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.', 0, null))
      .mockRejectedValueOnce(new ApiError('INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại.', 503, null))
      .mockResolvedValueOnce(record());
    mountDialog();
    await loaded();
    await u.click(printBtn());
    expect(await screen.findByText(/Không kết nối được máy chủ/)).toBeTruthy();
    expect(screen.getByText(/hệ thống không ghi trùng/)).toBeTruthy();
    expect(printSpy).not.toHaveBeenCalled();
    const key = lastKey();
    await u.click(printBtn());
    await screen.findByText(/Máy chủ gặp lỗi/);
    expect(lastKey()).toBe(key);
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(lastKey()).toBe(key);
    expect(api.createContractPrint).toHaveBeenCalledTimes(3);
  });

  it('đổi nội dung giữa hai lần thử → khoá MỚI (cùng khoá khác thân sẽ bị máy chủ từ chối)', async () => {
    const u = userEvent.setup();
    api.createContractPrint.mockRejectedValueOnce(new ApiError('NETWORK', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.', 0, null));
    mountDialog();
    await loaded();
    await u.click(printBtn());
    await screen.findByText(/Không kết nối được máy chủ/);
    const key = lastKey();
    await u.click(screen.getByRole('radio', { name: /Bảng kẻ đầy đủ/ }));
    await u.click(printBtn());
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(lastKey()).not.toBe(key);
  });

  it('403 / 404 của máy chủ: hiện đúng lời máy chủ, không in', async () => {
    const u = userEvent.setup();
    api.createContractPrint.mockRejectedValueOnce(new ApiError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.', 403, null));
    mountDialog();
    await loaded();
    await u.click(printBtn());
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeTruthy();
    expect(screen.getByText(/không có quyền in hợp đồng này/)).toBeTruthy();
    expect(printSpy).not.toHaveBeenCalled();
  });
});

describe('hộp In: nút In tắt khi chưa sẵn sàng (L9) hoặc mất mạng', () => {
  it('phông chưa tải xong → nút ghi "Đang chuẩn bị bản in…" và tắt; xong phông mới bấm được', async () => {
    let resolveFonts!: () => void;
    const fonts = { ready: new Promise<void>((res) => (resolveFonts = res)), [Symbol.iterator]: () => [][Symbol.iterator]() };
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    mountDialog();
    await screen.findByText(/Chọn mẫu in/);
    const b = await screen.findByRole('button', { name: 'Đang chuẩn bị bản in…' });
    expect(b).toHaveProperty('disabled', true);
    await act(async () => resolveFonts());
    await waitFor(() => expect(screen.getByRole('button', { name: 'In / Lưu PDF' })).toHaveProperty('disabled', false));
  });

  it('mất mạng → nút In tắt + dòng "Cần mạng để ghi nhật ký in"; có mạng lại thì bấm được', async () => {
    mountDialog();
    await loaded();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(printBtn()).toHaveProperty('disabled', true);
    expect(screen.getByText('Cần mạng để ghi nhật ký in')).toBeTruthy();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(printBtn()).toHaveProperty('disabled', false);
  });

  it('điện thoại: nút ghi "In / PDF"', async () => {
    mountDialog({ phone: true });
    await screen.findByText(/Chọn mẫu in/);
    expect(await screen.findByRole('button', { name: 'In / PDF' })).toBeTruthy();
  });
});

describe('hộp In: che theo quyền, cảnh báo, Safari', () => {
  it('người không có quyền xem liên hệ / thu tiền: tờ in "……", không có tiến độ thanh toán; lời cảnh báo của máy chủ hiện ra', async () => {
    const d: ContractPrintData = {
      ...SAMPLE.SERVICE.long,
      customer: { ...SAMPLE.SERVICE.long.customer, phone: null, email: null, contactHidden: true },
      payments: null,
      paymentsHidden: true,
    };
    api.getPrintData.mockResolvedValue(
      printData(
        {
          warnings: [
            { code: 'CONTACT_HIDDEN', message: 'Bạn không có quyền xem SĐT và email khách, nên chỗ đó in "……"' },
            { code: 'PAYMENTS_HIDDEN', message: 'Bạn không có quyền xem thu tiền, nên không in tiến độ và phiếu thu' },
          ],
        },
        'DRAFT',
        d,
      ),
    );
    mountDialog();
    await loaded();
    expect(paper().textContent).toContain('……');
    expect(paper().textContent).not.toContain('Tiến độ thanh toán');
    const warns = screen.getByRole('list', { name: 'Lưu ý khi in' });
    expect(within(warns).getByText(/không có quyền xem SĐT và email khách/)).toBeTruthy();
    expect(within(warns).getByText(/không có quyền xem thu tiền/)).toBeTruthy();
  });

  it('Safari (iPhone) với số trang / ký nháy đang bật: một dòng cảnh báo ≤ 90 ký tự', async () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    Object.defineProperty(navigator, 'userAgent', { value: iphone, configurable: true });
    try {
      mountDialog();
      await loaded();
      const line = screen.getByText('Safari không in số trang và ô ký nháy ở chân trang');
      expect(line.textContent!.length).toBeLessThanOrEqual(90);
    } finally {
      Reflect.deleteProperty(navigator, 'userAgent');
    }
  });

  it('Chrome / Android không có dòng cảnh báo Safari', async () => {
    mountDialog();
    await loaded();
    expect(screen.queryByText(/Safari không in/)).toBeNull();
  });

  it('app thêm ra màn hình chính iPhone (standalone) → "Mở bằng Safari để in" + nút chép đường dẫn', async () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    try {
      mountDialog();
      await loaded();
      expect(screen.getByText('Mở bằng Safari để in')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Chép đường dẫn' })).toBeTruthy();
    } finally {
      Reflect.deleteProperty(navigator, 'standalone');
    }
  });
});

describe('hộp In: an toàn chuỗi (L10)', () => {
  it('tên khách có thẻ HTML ra CHỮ trên tờ in; mã hợp đồng có " và \\ không phá CSS chân trang', async () => {
    const d = withStatus(SAMPLE.SERVICE.long, 'DRAFT');
    const evil: ContractPrintData = { ...d, customer: { ...d.customer, fullName: '<b>x</b>' }, contract: { ...d.contract, code: 'HĐ"\\1' } };
    api.getPrintData.mockResolvedValue(printData({}, 'DRAFT', evil));
    mountDialog();
    await loaded();
    expect(paper().textContent).toContain('<b>x</b>');
    expect(paper().querySelector('b')?.textContent).not.toBe('x');
    expect(pageStyle()).toContain('HĐ\\"\\\\1');
  });
});
