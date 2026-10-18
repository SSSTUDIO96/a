import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitInput } from './UnitInput';

function Harness({ unit = 'km', initial = null, onValue = () => {} }: { unit?: string; initial?: number | null; onValue?: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <UnitInput
        aria-label="Số đo"
        unit={unit}
        value={value}
        onChange={(v) => {
          setValue(v);
          onValue(v);
        }}
      />
      <button type="button">Ô khác</button>
    </>
  );
}

const input = () => screen.getByLabelText('Số đo') as HTMLInputElement;

describe('UnitInput km', () => {
  it('hiện hậu tố và số kiểu Việt', () => {
    render(<Harness initial={12.35} />);
    expect(input().value).toBe('12,35');
    expect(screen.getByText('km').classList.contains('ui-unit__suffix')).toBe(true);
  });

  it('gõ "12,35" (dấu phẩy) → 12.35', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('12,35');
    expect(onValue).toHaveBeenLastCalledWith(12.35);
    await user.click(screen.getByText('Ô khác'));
    expect(input().value).toBe('12,35');
  });

  it('chữ số lẻ thứ 3 → lỗi, không nhận', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('12,345');
    expect(screen.getByRole('alert').textContent).toContain('Tối đa 2 chữ số sau dấu phẩy');
    expect(onValue).toHaveBeenLastCalledWith(12.34);
    expect(onValue).not.toHaveBeenCalledWith(12.345);
  });

  it('dấu chấm làm phần lẻ ("12.35") → lỗi chỉ dùng dấu phẩy', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.paste('12.35');
    expect(screen.getByRole('alert').textContent).toContain('Phần lẻ dùng dấu phẩy');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('giới hạn 99.999,99 km', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.paste('99999,99');
    expect(onValue).toHaveBeenLastCalledWith(99_999.99);
    await user.clear(input());
    await user.paste('100000');
    expect(screen.getByRole('alert').textContent).toContain('Tối đa 99.999,99 km');
    expect(onValue).not.toHaveBeenCalledWith(100_000);
  });

  it('dán chữ → không nhận, báo lỗi', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={3} onValue={onValue} />);
    await user.click(input());
    await user.paste('mười hai');
    expect(input().value).toBe('3');
    expect(screen.getByRole('alert').textContent).toContain('Chỉ nhập chữ số');
    expect(onValue).not.toHaveBeenCalled();
  });
});

// Nghiệm thu web 1 — N7, N8 (và N6 cho ô km). Quy ước VN: km có phần lẻ bằng dấu phẩy (12,5).
describe('UnitInput km — dấu chấm mơ hồ, đơn vị dán kèm, giá trị đặt từ ngoài (nghiệm thu web 1)', () => {
  it('N7: gõ "2.500" → báo lỗi có chữ, KHÔNG thành 2.500 km', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('2.500');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Dấu chấm dễ nhầm');
    expect(onValue).not.toHaveBeenCalledWith(2500);
  });

  it('N7: số lớn gõ liền "2500" → 2500 km; rời ô hiện "2.500", vào lại ô hiện "2500" (không tự sinh dạng mơ hồ)', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('2500');
    expect(onValue).toHaveBeenLastCalledWith(2500);
    await user.click(screen.getByText('Ô khác'));
    expect(input().value).toBe('2.500');
    await user.click(input());
    expect(input().value).toBe('2500');
    await user.keyboard(',5');
    expect(onValue).toHaveBeenLastCalledWith(2500.5);
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('N8: dán "12,5 km" (có đơn vị) → 12,5 km, không báo "Chỉ nhập chữ số"', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.paste('12,5 km');
    expect(onValue).toHaveBeenLastCalledWith(12.5);
    expect(input().value).toBe('12,5');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('N8: "12,5KM", "12,5 Km " cũng nhận; "12,5 dặm" vẫn báo lỗi', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    for (const s of ['12,5KM', '7,25 Km ']) {
      await user.clear(input());
      await user.paste(s);
      expect(input().hasAttribute('aria-invalid'), s).toBe(false);
    }
    expect(onValue).toHaveBeenLastCalledWith(7.25);
    await user.clear(input());
    await user.paste('12,5 dặm');
    expect(screen.getByRole('alert').textContent).toContain('Chỉ nhập chữ số');
  });

  it('N6 (ô km): ô đang báo lỗi mà form đặt số mới → ô hiện số mới, hết lỗi', async () => {
    const user = userEvent.setup();
    function H() {
      const [v, setV] = useState<number | null>(3);
      return (
        <>
          <UnitInput aria-label="Số đo" unit="km" value={v} onChange={setV} />
          <button type="button" onClick={() => setV(21.7)}>
            Chọn địa chỉ khác
          </button>
        </>
      );
    }
    render(<H />);
    await user.click(input());
    await user.clear(input());
    await user.keyboard('2.500');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    await user.click(screen.getByText('Chọn địa chỉ khác'));
    expect(input().value).toBe('21,7');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('UnitInput phút/lần', () => {
  it('chỉ nhận số nguyên', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness unit="phút" onValue={onValue} />);
    await user.click(input());
    await user.keyboard('150');
    expect(onValue).toHaveBeenLastCalledWith(150);
    await user.keyboard(',5');
    expect(screen.getByRole('alert').textContent).toContain('Chỉ nhập số nguyên');
    expect(screen.getByText('phút')).toBeTruthy();
  });
});

// Phiếu vướng W4 (cùng bệnh với MoneyInput): số ≥ 1.000 đổi dạng lúc nhận tiêu điểm ("2.500" → "2500") làm mất vùng chọn.
describe('UnitInput — chọn hết rồi gõ thay cả ô', () => {
  it('chọn hết TRƯỚC khi ô nhận tiêu điểm (kiểu Playwright fill) → gõ thay cả ô', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness initial={2500} onValue={onValue} />);
    const el = input();
    expect(el.value).toBe('2.500');
    el.setSelectionRange(0, el.value.length);
    await act(async () => el.focus());
    expect([el.selectionStart, el.selectionEnd]).toEqual([0, 4]);
    await user.keyboard('12,5');
    expect(el.value).toBe('12,5');
    expect(onValue).toHaveBeenLastCalledWith(12.5);
  });

  it('bấm 3 lần chọn hết rồi gõ → thay cả ô', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness unit="phút" initial={1440} onValue={onValue} />);
    await user.tripleClick(input());
    await user.keyboard('90');
    expect(input().value).toBe('90');
    expect(onValue).toHaveBeenLastCalledWith(90);
  });
});
