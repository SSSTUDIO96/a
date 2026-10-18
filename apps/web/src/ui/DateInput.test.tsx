import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateInput, formatVnDate, parseVnDate } from './DateInput';

function Harness({ initial = null as string | null, onValue = (_: string | null) => {} }) {
  const [v, setV] = useState<string | null>(initial);
  return (
    <DateInput
      aria-label="Ngày"
      value={v}
      onChange={(x) => {
        setV(x);
        onValue(x);
      }}
    />
  );
}

describe('parseVnDate / formatVnDate', () => {
  it('đọc dd/mm/yyyy (và dấu . -, 8 chữ số liền) thành YYYY-MM-DD', () => {
    expect(parseVnDate('24/10/2026')).toEqual({ ok: true, value: '2026-10-24' });
    expect(parseVnDate('1/2/2026')).toEqual({ ok: true, value: '2026-02-01' });
    expect(parseVnDate('24.10.2026')).toEqual({ ok: true, value: '2026-10-24' });
    expect(parseVnDate('24102026')).toEqual({ ok: true, value: '2026-10-24' });
    expect(parseVnDate('')).toEqual({ ok: true, value: null });
    expect(formatVnDate('2026-10-24')).toBe('24/10/2026');
  });

  it('ngày không có thật và sai dạng báo lỗi có chữ, không tự đoán', () => {
    expect(parseVnDate('31/02/2026')).toEqual({ ok: false, error: 'Không có ngày 31/02/2026.' });
    expect(parseVnDate('29/02/2026').ok).toBe(false);
    expect(parseVnDate('29/02/2028')).toEqual({ ok: true, value: '2028-02-29' });
    expect(parseVnDate('2026-10-24').ok).toBe(false);
    expect(parseVnDate('24/13/2026').ok).toBe(false);
  });
});

describe('DateInput', () => {
  it('hiện giá trị dd/mm/yyyy; gõ "24/10/2026" → onChange("2026-10-24")', () => {
    const onValue = vi.fn();
    render(<Harness initial="2026-10-19" onValue={onValue} />);
    const input = screen.getByLabelText('Ngày') as HTMLInputElement;
    expect(input.value).toBe('19/10/2026');
    fireEvent.change(input, { target: { value: '24/10/2026' } });
    expect(onValue).toHaveBeenLastCalledWith('2026-10-24');
    fireEvent.blur(input);
    expect(input.value).toBe('24/10/2026');
  });

  it('gõ "31/02/2026" rồi rời ô: báo lỗi, không gọi onChange, giữ chữ đã gõ', () => {
    const onValue = vi.fn();
    render(<Harness initial="2026-10-19" onValue={onValue} />);
    const input = screen.getByLabelText('Ngày') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '31/02/2026' } });
    fireEvent.blur(input);
    expect(onValue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Không có ngày 31/02/2026.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('31/02/2026');
  });

  it('bảng lịch: tuần bắt đầu Thứ Hai, bấm ngày thì chọn và đóng bảng', () => {
    const onValue = vi.fn();
    render(<Harness initial="2026-10-19" onValue={onValue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }));
    const pop = screen.getByRole('dialog', { name: 'Chọn ngày' });
    expect(within(pop).getByText('Tháng 10, 2026')).toBeTruthy();
    // 01/10/2026 là Thứ Năm: 3 ô trống đầu tuần (T2, T3, T4).
    const cells = pop.querySelectorAll('.ui-cal > *');
    expect([...cells].slice(7, 11).map((c) => c.textContent)).toEqual(['', '', '', '1']);
    expect(within(pop).getByRole('button', { name: '19/10/2026' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(pop).getByRole('button', { name: 'Tháng sau' }));
    fireEvent.click(within(pop).getByRole('button', { name: '05/11/2026' }));
    expect(onValue).toHaveBeenLastCalledWith('2026-11-05');
    expect(screen.queryByRole('dialog', { name: 'Chọn ngày' })).toBeNull();
    expect((screen.getByLabelText('Ngày') as HTMLInputElement).value).toBe('05/11/2026');
  });
});
