import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

function Harness(props: Partial<ConfirmDialogProps> & { onConfirmSpy?: (r: string) => void | Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const { onConfirmSpy, ...rest } = props;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Huỷ phiếu PT-000087
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Huỷ phiếu PT-000087?"
        message="Phiếu không bị xoá: vẫn hiện trong sổ thu, gạch ngang, kèm lý do. Chỉ huỷ được một lần."
        confirmLabel="Huỷ phiếu"
        cancelLabel="Giữ phiếu"
        danger
        requireReason
        reasonLabel="Lý do huỷ"
        reasonPlaceholder="Ví dụ: ghi nhầm hợp đồng"
        {...rest}
        onConfirm={async (r) => {
          await onConfirmSpy?.(r);
          setOpen(false);
        }}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('dùng Dialog: role dialog có tên, rộng 440, nút đỏ; tiêu điểm vào ô lý do', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    const dlg = screen.getByRole('dialog', { name: 'Huỷ phiếu PT-000087?' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.className).toContain('ui-dialog--sm');
    expect(screen.getByRole('button', { name: 'Huỷ phiếu' }).className).toContain('ui-btn--danger');
    const reason = screen.getByRole('textbox', { name: /Lý do huỷ/ });
    expect(document.activeElement).toBe(reason);
    expect(reason.getAttribute('aria-required')).toBe('true');
  });

  it('lý do trống: không gọi onConfirm, báo lỗi dưới ô và giữ tiêu điểm ở ô', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness onConfirmSpy={spy} />);
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    await user.type(screen.getByRole('textbox', { name: /Lý do huỷ/ }), '   ');
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu' }));
    expect(spy).not.toHaveBeenCalled();
    const reason = screen.getByRole('textbox', { name: /Lý do huỷ/ });
    expect(reason.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Nhập lý do huỷ trước khi huỷ phiếu.');
    expect(document.activeElement).toBe(reason);
    await user.type(reason, 'ghi nhầm');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('xác nhận: gửi lý do đã cắt khoảng trắng; đang chờ thì nút quay, Esc không đóng', async () => {
    const user = userEvent.setup();
    let done!: () => void;
    const spy = vi.fn(() => new Promise<void>((r) => (done = r)));
    render(<Harness onConfirmSpy={spy} />);
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    await user.type(screen.getByRole('textbox', { name: /Lý do huỷ/ }), '  ghi nhầm hợp đồng  ');
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu' }));
    expect(spy).toHaveBeenCalledWith('ghi nhầm hợp đồng');
    const btn = screen.getAllByRole('button').find((b) => b.className.includes('ui-btn--danger'))!;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect((screen.getByRole('button', { name: 'Giữ phiếu' }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => done());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Tiêu điểm trả về nút đã mở hộp
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
  });

  it('onConfirm lỗi: hộp ở lại, hiện lỗi; mở lại thì sạch lý do và lỗi', async () => {
    const user = userEvent.setup();
    const spy = vi.fn(() => Promise.reject(new Error('Phiếu đã bị huỷ trước đó.')));
    render(<Harness onConfirmSpy={spy} />);
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    await user.type(screen.getByRole('textbox', { name: /Lý do huỷ/ }), 'trùng');
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Phiếu đã bị huỷ trước đó.'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Giữ phiếu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    expect((screen.getByRole('textbox', { name: /Lý do huỷ/ }) as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('không hỏi lý do: tiêu điểm vào nút lùi; Tab vòng trong hộp; Esc đóng; Enter trên nút lùi đóng', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <Harness
        onConfirmSpy={spy}
        requireReason={false}
        danger={false}
        title="Bỏ thay đổi tiền công của Cô dâu – Ngày cưới?"
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Ở lại"
        message={undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    const stay = screen.getByRole('button', { name: 'Ở lại' });
    expect(document.activeElement).toBe(stay);
    expect(screen.getByRole('button', { name: 'Bỏ thay đổi' }).className).toContain('ui-btn--primary');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('lý do tuỳ chọn (Mở khoá) và rộng 460; Space trên nút xác nhận gửi chuỗi rỗng', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <Harness
        onConfirmSpy={spy}
        requireReason={false}
        askReason
        width={460}
        title="Mở khoá Studio Chiến?"
        confirmLabel="Mở khoá"
        reasonLabel="Lý do"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    const dlg = screen.getByRole('dialog');
    expect(dlg.style.getPropertyValue('--dlg-w')).toBe('460px');
    const reason = screen.getByRole('textbox', { name: 'Lý do' });
    expect(reason.getAttribute('aria-required')).toBeNull();
    await user.tab(); // → Giữ phiếu
    await user.tab(); // → Mở khoá
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mở khoá' }));
    await user.keyboard(' ');
    await waitFor(() => expect(spy).toHaveBeenCalledWith(''));
  });

  it('lỗi do màn truyền vào (prop error) hiện trong hộp', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Gỡ trang giới thiệu?"
        confirmLabel="Gỡ trang"
        danger
        onConfirm={() => {}}
        error="Không kết nối được máy chủ."
        loading
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Không kết nối được máy chủ.');
    const btn = screen.getAllByRole('button').find((b) => b.className.includes('ui-btn--danger'))!;
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });
});
