import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as printApi from '../../../api/print';
import { PrintButton, printButtonLabel, type PrintButtonProps } from './PrintButton';
import { printData } from './PrintDialog.fixtures';

// Nút In dùng chung cho CẢ HAI loại hợp đồng (bản vẽ G mục 4.2): chữ trên nút, đã huỷ thì tắt + chú thích,
// chưa lưu thì lưu trước rồi mới mở hộp; lưu hỏng thì không mở.

vi.mock('../../../api/print', () => ({
  getPrintData: vi.fn(),
  getContractPrint: vi.fn(),
  createContractPrint: vi.fn(),
  listPrintTemplates: vi.fn(),
}));
const api = vi.mocked(printApi);

function mount(over: Partial<PrintButtonProps> = {}) {
  const props: PrintButtonProps = {
    orgId: 'org-1',
    tz: 'Asia/Ho_Chi_Minh',
    contractId: 'hd-1',
    status: 'DRAFT',
    needsSave: false,
    ensureSaved: vi.fn(async () => 'hd-1'),
    canManageTemplates: false,
    phone: false,
    size: 'md',
    ...over,
  };
  render(
    <MemoryRouter>
      <PrintButton {...props} />
    </MemoryRouter>,
  );
  return props;
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getPrintData.mockResolvedValue(printData());
});
afterEach(cleanup);

describe('chữ trên nút In', () => {
  it('máy tính: "In hợp đồng" / "Lưu nháp & in"; điện thoại: "In" / "Lưu & in"', () => {
    expect(printButtonLabel(false, false)).toBe('In hợp đồng');
    expect(printButtonLabel(false, true)).toBe('Lưu nháp & in');
    expect(printButtonLabel(true, false)).toBe('In');
    expect(printButtonLabel(true, true)).toBe('Lưu & in');
  });
  it('nút hiện đúng chữ theo needsSave và khổ', () => {
    mount({ needsSave: true });
    expect(screen.getByRole('button', { name: 'Lưu nháp & in' })).toBeTruthy();
  });
  it('điện thoại', () => {
    mount({ phone: true, size: 'sm' });
    expect(screen.getByRole('button', { name: 'In' })).toBeTruthy();
  });
});

describe('PrintButton: mở hộp In', () => {
  it('hợp đồng đã lưu, không có thay đổi: không gọi ensureSaved, mở hộp cho đúng hợp đồng', async () => {
    const u = userEvent.setup();
    const p = mount();
    await u.click(screen.getByRole('button', { name: 'In hợp đồng' }));
    expect(await screen.findByText('Chọn mẫu in')).toBeTruthy();
    expect(p.ensureSaved).not.toHaveBeenCalled();
    expect(api.getPrintData).toHaveBeenCalledWith('org-1', 'hd-1', expect.any(AbortSignal));
  });

  it('có thay đổi chưa lưu: LƯU TRƯỚC rồi mới mở hộp, bằng id ensureSaved trả về', async () => {
    const u = userEvent.setup();
    const order: string[] = [];
    const ensureSaved = vi.fn(async () => {
      order.push('lưu');
      return 'hd-moi';
    });
    api.getPrintData.mockImplementation(async () => {
      order.push('tải');
      return printData();
    });
    mount({ needsSave: true, contractId: 'hd-1', ensureSaved });
    await u.click(screen.getByRole('button', { name: 'Lưu nháp & in' }));
    await screen.findByText('Chọn mẫu in');
    expect(order).toEqual(['lưu', 'tải']);
    expect(api.getPrintData).toHaveBeenCalledWith('org-1', 'hd-moi', expect.any(AbortSignal));
  });

  it('hợp đồng mới chưa lưu (contractId = null): phải lưu mới có id', async () => {
    const u = userEvent.setup();
    const ensureSaved = vi.fn(async () => 'hd-vua-tao');
    mount({ contractId: null, needsSave: true, ensureSaved });
    await u.click(screen.getByRole('button', { name: 'Lưu nháp & in' }));
    await screen.findByText('Chọn mẫu in');
    expect(api.getPrintData).toHaveBeenCalledWith('org-1', 'hd-vua-tao', expect.any(AbortSignal));
  });

  it('lưu hỏng (null): KHÔNG mở hộp, không gọi máy chủ in', async () => {
    const u = userEvent.setup();
    const ensureSaved = vi.fn(async () => null);
    mount({ needsSave: true, ensureSaved });
    await u.click(screen.getByRole('button', { name: 'Lưu nháp & in' }));
    await waitFor(() => expect(ensureSaved).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Chọn mẫu in')).toBeNull();
    expect(api.getPrintData).not.toHaveBeenCalled();
    // Nút trở lại bấm được (không kẹt ở trạng thái đang lưu).
    expect((screen.getByRole('button', { name: 'Lưu nháp & in' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('đóng hộp bằng nút Đóng', async () => {
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByRole('button', { name: 'In hợp đồng' }));
    await screen.findByText('Chọn mẫu in');
    await u.click(screen.getAllByRole('button', { name: 'Đóng' })[0]!);
    expect(screen.queryByText('Chọn mẫu in')).toBeNull();
  });
});

describe('PrintButton: hợp đồng đã huỷ', () => {
  it('nút tắt + chú thích "Hợp đồng đã huỷ — không in"; bấm không mở gì', async () => {
    const u = userEvent.setup();
    const p = mount({ status: 'CANCELLED' });
    const b = screen.getByRole('button', { name: 'In hợp đồng' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(screen.getByText('Hợp đồng đã huỷ — không in')).toBeTruthy();
    await u.click(b);
    expect(p.ensureSaved).not.toHaveBeenCalled();
    expect(api.getPrintData).not.toHaveBeenCalled();
  });
});
