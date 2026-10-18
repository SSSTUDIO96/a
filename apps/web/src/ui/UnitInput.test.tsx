import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
