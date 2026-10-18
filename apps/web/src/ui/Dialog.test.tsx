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

describe('Dialog — tiêu điểm rơi ra ngoài hộp (nghiệm thu web 1, N1)', () => {
  it('bấm chuột ra nền mờ (tiêu điểm về <body>) rồi Esc → hộp vẫn đóng, tiêu điểm về nút đã mở', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByText('Mở chi tiết gói'));
    await user.click(document.querySelector('.ui-overlay')!);
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole('dialog')).toBeTruthy(); // closeOnOverlay mặc định false: bấm nền không đóng
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByText('Mở chi tiết gói'));
  });

  it('tiêu điểm ở <body>: Tab và Shift+Tab kéo tiêu điểm về trong hộp', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Mở chi tiết gói'));
    const dlg = screen.getByRole('dialog');
    await user.click(document.querySelector('.ui-overlay')!);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng' }));
    await user.click(document.querySelector('.ui-overlay')!);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Lưu' }));
    expect(dlg.contains(document.activeElement)).toBe(true);
  });

  it('hai hộp chồng, tiêu điểm ở <body>: Esc chỉ đóng hộp trên cùng; Esc lần nữa đóng hộp dưới', async () => {
    const user = userEvent.setup();
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      return (
        <>
          <Dialog open={outer} onClose={() => setOuter(false)} title="Hộp dưới" footer={null}>
            <input aria-label="Ô dưới" />
          </Dialog>
          <Dialog open={inner} onClose={() => setInner(false)} title="Hộp trên" size="sm" footer={null}>
            <input aria-label="Ô trên" />
          </Dialog>
        </>
      );
    }
    render(<Nested />);
    const overlays = document.querySelectorAll('.ui-overlay');
    await user.click(overlays[overlays.length - 1]!);
    expect(document.activeElement).toBe(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Hộp trên' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Hộp dưới' })).toBeTruthy();
    await user.click(document.querySelector('.ui-overlay')!);
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

  it('bấm ra ngoài ngăn kéo không đóng được (closeOnOverlay=false), tiêu điểm về <body> → Esc vẫn đóng', async () => {
    const user = userEvent.setup();
    function SheetHarness() {
      const [open, setOpen] = useState(true);
      return (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Chọn thợ" closeOnOverlay={false}>
          <input aria-label="Tìm thợ" />
        </BottomSheet>
      );
    }
    render(<SheetHarness />);
    await user.click(document.querySelector('.ui-sheet-overlay')!);
    expect(document.activeElement).toBe(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
