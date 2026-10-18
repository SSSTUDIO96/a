import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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

// Nghiệm thu web 1 — N5, N6. Quy ước VN: tiền dùng dấu chấm ngăn nghìn, không có phần lẻ; chữ mơ hồ thì báo lỗi, không đoán.
describe('MoneyInput — dấu chấm tự gõ và giá trị đặt từ ngoài (nghiệm thu web 1)', () => {
  function ExternalHarness({ onValue = () => {}, onInputError = () => {} }: { onValue?: (v: Vnd | null) => void; onInputError?: (m: string | null) => void }) {
    const [value, setValue] = useState<Vnd | null>(500_000);
    return (
      <>
        <MoneyInput
          aria-label="Giá bán"
          value={value}
          onInputError={onInputError}
          onChange={(v) => {
            setValue(v);
            onValue(v);
          }}
        />
        <button type="button" onClick={() => setValue(3_000_000)}>
          Chọn gói khác
        </button>
      </>
    );
  }

  it('N5: gõ từng phím "1.5" → báo lỗi có chữ, KHÔNG thành 15 đ; gõ tiếp thành "1.500" → nhận 1.500 đ', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('1.5');
    expect(input().value).toBe('1.5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Dấu chấm chỉ dùng ngăn nghìn');
    expect(onValue).not.toHaveBeenCalledWith(15);
    await user.keyboard('00');
    expect(input().value).toBe('1.500');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
    expect(onValue).toHaveBeenLastCalledWith(1_500);
    expect(onValue).not.toHaveBeenCalledWith(15);
    expect(onValue).not.toHaveBeenCalledWith(150);
  });

  it('N5: gõ dấu chấm cuối "1.500." hoặc chèn dấu chấm sai chỗ → báo lỗi, giữ số cũ', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={1_500} onValue={onValue} />);
    await user.click(input());
    await user.keyboard('.');
    expect(input().value).toBe('1.500.');
    expect(screen.getByRole('alert').textContent).toContain('Dấu chấm');
    await user.keyboard('5');
    expect(input().value).toBe('1.500.5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(onValue).not.toHaveBeenCalled();
    await user.keyboard('00');
    expect(input().value).toBe('1.500.500');
    expect(onValue).toHaveBeenLastCalledWith(1_500_500);
  });

  it('N5: gõ "1.500.000" bằng tay (có dấu chấm) vẫn nhận đúng 1.500.000 đ', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('1.500.000');
    expect(input().value).toBe('1.500.000');
    expect(onValue).toHaveBeenLastCalledWith(1_500_000);
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('N6: ô đang báo lỗi ("-5"), rời ô, form tự điền giá mới → ô hiện giá mới, hết lỗi', async () => {
    const user = userEvent.setup();
    const onInputError = vi.fn();
    render(<ExternalHarness onInputError={onInputError} />);
    await user.click(input());
    await user.clear(input());
    await user.keyboard('-5');
    await user.click(screen.getByText('Chọn gói khác'));
    expect(input().value).toBe('3.000.000 ₫');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onInputError).toHaveBeenLastCalledWith(null);
  });

  it('N6: ô đang báo lỗi dấu chấm ("1.5") mà form đặt giá mới → ô hiện giá mới; gõ lại thì đọc bình thường', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<ExternalHarness onValue={onValue} />);
    await user.click(input());
    await user.clear(input());
    await user.keyboard('1.5');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    await user.click(screen.getByText('Chọn gói khác'));
    expect(input().value).toBe('3.000.000 ₫');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
    await user.click(input());
    await user.keyboard('0');
    expect(input().value).toBe('30.000.000');
    expect(onValue).toHaveBeenLastCalledWith(30_000_000);
  });
});

// Phiếu vướng W4: chữ trong ô đổi dạng lúc nhận tiêu điểm ("1.500.000 ₫" → "1.500.000") làm mất vùng chọn,
// nên "chọn hết rồi gõ" (Playwright fill, bấm 3 lần chọn hết) bị nối số mới vào sau số cũ.
describe('MoneyInput — chọn hết rồi gõ thay cả ô', () => {
  it('chọn hết TRƯỚC khi ô nhận tiêu điểm (kiểu Playwright fill) → gõ thay cả ô', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={2_700_000} onValue={onValue} />);
    const el = input();
    el.setSelectionRange(0, el.value.length);
    await act(async () => el.focus());
    expect([el.selectionStart, el.selectionEnd]).toEqual([0, el.value.length]);
    await user.keyboard('3500000');
    expect(el.value).toBe('3.500.000');
    expect(onValue).toHaveBeenLastCalledWith(3_500_000);
  });

  it('bấm 3 lần chọn hết rồi gõ → thay cả ô', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={2_700_000} onValue={onValue} />);
    await user.tripleClick(input());
    await user.keyboard('80000');
    expect(input().value).toBe('80.000');
    expect(onValue).toHaveBeenLastCalledWith(80_000);
  });

  it('bấm vào giữa số: con trỏ giữ đúng sau chữ số đã đứng trước nó (bỏ " ₫" không làm nhảy con trỏ)', async () => {
    render(<Harness initial={2_700_000} />);
    const el = input();
    // "2.700.000 ₫": con trỏ sau "2.7" (3 ký tự, 2 chữ số).
    el.setSelectionRange(3, 3);
    await act(async () => el.focus());
    expect(el.value).toBe('2.700.000');
    expect([el.selectionStart, el.selectionEnd]).toEqual([3, 3]);
  });
});

// Nghiệm thu đợt sửa 1, N-J1: ô đang lỗi, form đặt lại ĐÚNG giá cũ ("Huỷ thay đổi") → ô vẫn hiện chữ sai.
// Số không đổi thì `value` không mang tín hiệu gì (React còn bỏ qua cả lần vẽ khi setState cùng số), nên form báo bằng
// `resetKey`: đổi khoá mỗi lần form tự đặt lại giá trị → ô bỏ chữ đang gõ và lỗi, hiện theo `value`.
describe('MoneyInput — form đặt lại đúng giá cũ (N-J1)', () => {
  function ResetHarness({ onInputError }: { onInputError?: (m: string | null) => void }) {
    const [form, setForm] = useState({ price: 3_000_000 as Vnd | null, note: '', rev: 0 });
    return (
      <>
        <MoneyInput
          aria-label="Giá bán"
          value={form.price}
          resetKey={form.rev}
          onChange={(price) => setForm((f) => ({ ...f, price }))}
          onInputError={onInputError}
        />
        <input aria-label="Ghi chú" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        <button type="button" onClick={() => setForm((f) => ({ price: 3_000_000, note: '', rev: f.rev + 1 }))}>
          Huỷ thay đổi
        </button>
        <output data-testid="gia-tri">{String(form.price)}</output>
      </>
    );
  }

  it('ô đang lỗi ("-5"), form đặt lại đúng 3.000.000 → ô hiện "3.000.000 ₫", hết lỗi, báo form hết lỗi', async () => {
    const user = userEvent.setup();
    const onInputError = vi.fn();
    render(<ResetHarness onInputError={onInputError} />);
    const el = input();
    await user.click(el);
    await user.type(el, '-5', { initialSelectionStart: 0, initialSelectionEnd: el.value.length });
    await user.click(screen.getByLabelText('Ghi chú'));
    expect(el.value).toBe('-5');
    expect(screen.getByTestId('gia-tri').textContent).toBe('3000000');
    expect(onInputError).toHaveBeenLastCalledWith('Số tiền không được âm.');
    await user.click(screen.getByText('Huỷ thay đổi'));
    expect(el.value).toBe('3.000.000 ₫');
    expect(el.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onInputError).toHaveBeenLastCalledWith(null);
  });

  it('ô đang lỗi dấu chấm ("1.5", chế độ đọc chặt), đặt lại đúng giá cũ → gõ lại thì tự chia nhóm như thường', async () => {
    const user = userEvent.setup();
    render(<ResetHarness />);
    const el = input();
    await user.click(el);
    await user.type(el, '1.5', { initialSelectionStart: 0, initialSelectionEnd: el.value.length });
    expect(el.getAttribute('aria-invalid')).toBe('true');
    await user.click(screen.getByText('Huỷ thay đổi'));
    expect(el.value).toBe('3.000.000 ₫');
    await user.click(el);
    await user.keyboard('0');
    expect(el.value).toBe('30.000.000');
    expect(screen.getByTestId('gia-tri').textContent).toBe('30000000');
  });

  it('GIỮ: form vẽ lại vì ô khác đổi (cùng giá, cùng resetKey) → ô vẫn giữ chữ sai và lỗi, form vẫn bị chặn', async () => {
    const user = userEvent.setup();
    const onInputError = vi.fn();
    render(<ResetHarness onInputError={onInputError} />);
    const el = input();
    await user.click(el);
    await user.type(el, '-5', { initialSelectionStart: 0, initialSelectionEnd: el.value.length });
    await user.click(screen.getByLabelText('Ghi chú'));
    await user.keyboard('abc');
    expect(el.value).toBe('-5');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(onInputError).not.toHaveBeenLastCalledWith(null);
  });
});
