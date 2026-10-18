import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyInput } from './MoneyInput';
import type { Vnd } from './format';

function Harness({ initial = null, onValue = () => {}, error }: { initial?: Vnd | null; onValue?: (v: Vnd | null) => void; error?: string }) {
  const [value, setValue] = useState<Vnd | null>(initial);
  return (
    <>
      <MoneyInput
        aria-label="Giá bán"
        placeholder="Không giảm"
        value={value}
        error={error}
        onChange={(v) => {
          setValue(v);
          onValue(v);
        }}
      />
      <button type="button">Ô khác</button>
    </>
  );
}

const input = () => screen.getByLabelText('Giá bán') as HTMLInputElement;

describe('MoneyInput', () => {
  it('rời ô: hiện "1.500.000 ₫"; null: hiện chữ gợi ý', () => {
    const { unmount } = render(<Harness initial={1_500_000} />);
    expect(input().value).toBe('1.500.000 ₫');
    unmount();
    render(<Harness />);
    expect(input().value).toBe('');
    expect(input().placeholder).toBe('Không giảm');
  });

  it('vào ô thì bỏ " ₫"', async () => {
    const user = userEvent.setup();
    render(<Harness initial={2_700_000} />);
    await user.click(input());
    expect(input().value).toBe('2.700.000');
  });

  it('gõ chữ số: tự chèn dấu chấm, trả ra số nguyên đồng', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('1500000');
    expect(input().value).toBe('1.500.000');
    expect(onValue).toHaveBeenLastCalledWith(1_500_000);
    expect(Number.isInteger(onValue.mock.lastCall?.[0])).toBe(true);
    await user.click(screen.getByText('Ô khác'));
    expect(input().value).toBe('1.500.000 ₫');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('gõ thêm chữ số giữa chừng: dấu chấm chia lại đúng nhóm', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={150_000} onValue={onValue} />);
    await user.click(input());
    await user.keyboard('0');
    expect(input().value).toBe('1.500.000');
    expect(onValue).toHaveBeenLastCalledWith(1_500_000);
    await user.keyboard('{Backspace}{Backspace}');
    expect(input().value).toBe('15.000');
    expect(onValue).toHaveBeenLastCalledWith(15_000);
  });

  it('dấu phẩy ("1,5") → lỗi phần lẻ, không trả số lẻ', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('1,5');
    expect(screen.getByRole('alert').textContent).toContain('không có phần lẻ');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(onValue.mock.calls.every(([v]) => v === null || Number.isInteger(v))).toBe(true);
    expect(onValue).not.toHaveBeenCalledWith(1.5);
    // Lỗi còn khi rời ô; chữ sai vẫn hiện để người dùng sửa.
    await user.click(screen.getByText('Ô khác'));
    expect(input().value).toBe('1,5');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('số âm → lỗi', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('-5');
    expect(screen.getByRole('alert').textContent).toContain('không được âm');
    expect(onValue).not.toHaveBeenCalledWith(-5);
  });

  it('gõ chữ cái: không nhận, báo lỗi, giữ số cũ', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={500_000} onValue={onValue} />);
    await user.click(input());
    await user.keyboard('a');
    expect(input().value).toBe('500.000');
    expect(screen.getByRole('alert').textContent).toContain('Chỉ nhập chữ số');
    expect(onValue).not.toHaveBeenCalled();
    await user.keyboard('0');
    expect(input().value).toBe('5.000.000');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dán chữ: không nhận, báo lỗi', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.paste('hai triệu');
    expect(input().value).toBe('');
    expect(screen.getByRole('alert').textContent).toContain('Chỉ nhập chữ số');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('dán "1.500.000 ₫" → 1500000; dán "1.5" → lỗi, không đoán', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.paste('1.500.000 ₫');
    expect(onValue).toHaveBeenLastCalledWith(1_500_000);
    expect(input().value).toBe('1.500.000');
    input().setSelectionRange(0, input().value.length);
    await user.paste('1.5');
    expect(screen.getByRole('alert').textContent).toContain('Dấu chấm chỉ dùng ngăn nghìn');
    expect(onValue).toHaveBeenCalledTimes(1);
  });

  it('giới hạn Number.MAX_SAFE_INTEGER', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.paste(String(Number.MAX_SAFE_INTEGER));
    expect(onValue).toHaveBeenLastCalledWith(Number.MAX_SAFE_INTEGER);
    await user.keyboard('1');
    expect(screen.getByRole('alert').textContent).toContain('quá lớn');
    expect(onValue).toHaveBeenCalledTimes(1);
  });

  it('xoá trắng → null', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={80_000} onValue={onValue} />);
    await user.clear(input());
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it('lỗi từ ngoài (máy chủ) hiện dưới ô', () => {
    render(<Harness initial={3_000_000} error="Giá bán lớn hơn giá niêm yết" />);
    expect(screen.getByRole('alert').textContent).toContain('Giá bán lớn hơn giá niêm yết');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});
