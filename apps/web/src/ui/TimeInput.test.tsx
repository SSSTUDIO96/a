import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import { parseTime, TimeInput } from './TimeInput';

function Harness({ initial = null as string | null, onValue = (_: string | null) => {} }) {
  const [v, setV] = useState<string | null>(initial);
  return (
    <TimeInput
      aria-label="Giờ bắt đầu"
      value={v}
      onChange={(x) => {
        setV(x);
        onValue(x);
      }}
    />
  );
}

describe('parseTime', () => {
  it('24 giờ: "5:00" → "05:00", nhận nhiều cách gõ, phút bất kỳ', () => {
    expect(parseTime('5:00')).toEqual({ ok: true, value: '05:00' });
    expect(parseTime('17:07')).toEqual({ ok: true, value: '17:07' });
    expect(parseTime('0530')).toEqual({ ok: true, value: '05:30' });
    expect(parseTime('530')).toEqual({ ok: true, value: '05:30' });
    expect(parseTime('5h30')).toEqual({ ok: true, value: '05:30' });
    expect(parseTime('5')).toEqual({ ok: true, value: '05:00' });
    expect(parseTime('')).toEqual({ ok: true, value: null });
  });

  it('"25:00", "10:60", "5:3" và chữ lạ báo lỗi', () => {
    expect(parseTime('25:00')).toEqual({ ok: false, error: 'Không có giờ 25:00 (từ 00:00 đến 23:59).' });
    expect(parseTime('10:60').ok).toBe(false);
    expect(parseTime('5:3').ok).toBe(false);
    expect(parseTime('5 PM').ok).toBe(false);
  });
});

describe('TimeInput', () => {
  it('gõ "5:00" → onChange("05:00"), rời ô thì hiện "05:00"', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Giờ bắt đầu') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5:00' } });
    expect(onValue).toHaveBeenLastCalledWith('05:00');
    fireEvent.blur(input);
    expect(input.value).toBe('05:00');
  });

  it('gõ "25:00" rồi rời ô: báo lỗi, không gọi onChange', () => {
    const onValue = vi.fn();
    render(<Harness initial="08:00" onValue={onValue} />);
    const input = screen.getByLabelText('Giờ bắt đầu') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25:00' } });
    fireEvent.blur(input);
    expect(onValue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Không có giờ 25:00');
  });

  it('bảng chọn: cột giờ 00–23, cột phút bước 5; chọn giờ rồi phút', () => {
    const onValue = vi.fn();
    render(<Harness initial="08:00" onValue={onValue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn giờ bắt đầu' }));
    const pop = screen.getByRole('dialog', { name: 'Chọn giờ bắt đầu' });
    const hours = within(within(pop).getByRole('group', { name: 'Giờ' })).getAllByRole('button');
    const mins = within(within(pop).getByRole('group', { name: 'Phút' })).getAllByRole('button');
    expect(hours).toHaveLength(24);
    expect(mins.map((b) => b.textContent)).toEqual(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']);
    fireEvent.click(within(pop).getByRole('button', { name: '14' }));
    expect(onValue).toHaveBeenLastCalledWith('14:00');
    fireEvent.click(within(pop).getByRole('button', { name: '35' }));
    expect(onValue).toHaveBeenLastCalledWith('14:35');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('TimeInput trong Dialog', () => {
  it('Esc khi bảng chọn đang mở chỉ đóng bảng, không đóng hộp thoại', () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Thêm lịch" onClose={onClose}>
        <Harness initial="08:00" />
      </Dialog>,
    );
    const btn = screen.getByRole('button', { name: 'Chọn giờ bắt đầu' });
    fireEvent.click(btn);
    expect(screen.getByRole('dialog', { name: 'Chọn giờ bắt đầu' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? btn, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Chọn giờ bắt đầu' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
