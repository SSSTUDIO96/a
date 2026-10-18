import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';
import { BottomSheet } from './BottomSheet';
import { Tooltip } from './Tooltip';

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button">Nút ngoài</button>
      <button type="button" onClick={() => setOpen(true)}>
        Mở chi tiết gói
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        eyebrow="Cô dâu · G-CD01"
        title="Cô dâu – Ngày cưới"
        primaryLabel="Lưu"
      >
        <label>
          Tên gói <input defaultValue="Cô dâu – Ngày cưới" />
        </label>
        <span>
          Giá bán <Tooltip text="Bỏ trống nếu không giảm." />
        </span>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('mở: tiêu điểm vào ô nhập đầu tiên, có role dialog và tên', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Mở chi tiết gói'));
    const dlg = screen.getByRole('dialog', { name: 'Cô dâu – Ngày cưới' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Tên gói'));
  });

  it('Esc đóng và trả tiêu điểm về nút đã mở', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByText('Mở chi tiết gói'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByText('Mở chi tiết gói'));
  });

  it('nhốt tiêu điểm: Tab và Shift+Tab chỉ vòng trong hộp', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Mở chi tiết gói'));
    const dlg = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Đóng' });
    const save = screen.getByRole('button', { name: 'Lưu' });
    // Thứ tự: Đóng · Tên gói · ? · Huỷ · Lưu
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(dlg.contains(document.activeElement)).toBe(true);
    }
    save.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(save);
    expect(document.activeElement).not.toBe(screen.getByText('Nút ngoài'));
  });

  it('nút "Huỷ" và ✕ đóng hộp', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByText('Mở chi tiết gói'));
    await user.click(screen.getByRole('button', { name: 'Huỷ' }));
    await user.click(screen.getByText('Mở chi tiết gói'));
    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Esc khi tooltip trong hộp đang mở: đóng tooltip trước, hộp vẫn mở', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Mở chi tiết gói'));
    await user.tab(); // Tên gói → ?
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Giải thích' }));
    expect(screen.getByRole('tooltip').textContent).toContain('Bỏ trống nếu không giảm.');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('BottomSheet', () => {
  it('Esc đóng, nhốt tiêu điểm', async () => {
    const user = userEvent.setup();
    function SheetHarness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button">Ngoài</button>
          <BottomSheet open={open} onClose={() => setOpen(false)} title="Thêm từ bảng giá">
            <input aria-label="Tìm gói" />
          </BottomSheet>
        </>
      );
    }
    render(<SheetHarness />);
    const sheet = screen.getByRole('dialog', { name: 'Thêm từ bảng giá' });
    expect(document.activeElement).toBe(screen.getByLabelText('Tìm gói'));
    await user.tab();
    await user.tab();
    await user.tab();
    expect(sheet.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
