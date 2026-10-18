// THỢ CHẤM — ô tiền, ô km, hàm đọc số. "LỖI:" xanh = lỗi có thật; "CHẶN:" xanh = xử lý đúng.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyInput } from '../src/ui/MoneyInput';
import { UnitInput } from '../src/ui/UnitInput';
import { parseKm, parseMoney } from '../src/ui/format';

describe('parseMoney / parseKm', () => {
  it('CHẶN: dán chữ, số âm, phần lẻ, dấu phẩy kiểu Mỹ, số quá lớn → lỗi; dạng VN hợp lệ → số nguyên', () => {
    const bad = ['abc', '-1', '−1', '1,5', '1,500,000', '1.5', '9007199254740993', '1.50.000', '1e6', '₫1.500.000'];
    for (const s of bad) expect(parseMoney(s).ok, s).toBe(false);
    expect(parseMoney('1.500.000 ₫')).toEqual({ ok: true, value: 1_500_000 });
    expect(parseMoney('1 500 000đ')).toEqual({ ok: true, value: 1_500_000 });
    expect(parseMoney('9007199254740991')).toEqual({ ok: true, value: 9_007_199_254_740_991 });
    expect(parseMoney('')).toEqual({ ok: true, value: null });
  });
  it('CHẶN: km — "12,35" → 12.35; "12.35", 3 chữ số lẻ, âm, chữ → lỗi; quá 99.999,99 → lỗi', () => {
    expect(parseKm('12,35')).toEqual({ ok: true, value: 12.35 });
    expect(parseKm('12,35 km')).toEqual({ ok: true, value: 12.35 });
    for (const s of ['12.35', '12,345', '-1', 'abc', '100.000', '1,2,3']) expect(parseKm(s).ok, s).toBe(false);
  });
  it('LỖI (nhẹ): km gõ "2.500" (kiểu viết thập phân bằng dấu chấm) được đọc thành 2.500 km, không báo gì', () => {
    expect(parseKm('2.500')).toEqual({ ok: true, value: 2500 });
  });
});

function MoneyHarness({ external }: { external: { set?: (v: number | null) => void } }) {
  const [value, setValue] = useState<number | null>(500_000);
  external.set = setValue;
  return (
    <>
      <MoneyInput aria-label="Giá bán" value={value} onChange={setValue} />
      <output data-testid="gia-tri">{String(value)}</output>
      <button type="button">Ô khác</button>
    </>
  );
}

describe('MoneyInput', () => {
  it('LỖI (nhẹ): gõ "1.5" từng phím được nhận thành 15 đ (dấu chấm bị nuốt), trong khi DÁN "1.5" thì báo lỗi', async () => {
    const user = userEvent.setup();
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness external={ext} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    await user.click(el);
    await user.clear(el);
    await user.type(el, '1.5');
    expect(screen.getByTestId('gia-tri').textContent).toBe('15');
    expect(el.getAttribute('aria-invalid')).toBeNull();
  });

  it('LỖI (nhẹ): sau khi ô đang báo lỗi (gõ số âm) mà form đổi giá trị từ ngoài, ô vẫn hiện chữ cũ và lỗi cũ — chữ trên ô khác số thật', async () => {
    const user = userEvent.setup();
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness external={ext} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    await user.click(el);
    await user.clear(el);
    await user.type(el, '-5');
    await user.click(screen.getByText('Ô khác'));
    expect(el.value).toBe('-5');
    // Form tự điền giá mới (ví dụ chọn gói khác)
    act(() => ext.set?.(3_000_000));
    expect(screen.getByTestId('gia-tri').textContent).toBe('3000000');
    expect(el.value).toBe('-5'); // ô vẫn hiện "-5"
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });

  it('CHẶN: dán chữ / "1,5" / số quá lớn vào ô trống → báo lỗi, không đổi giá trị', async () => {
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness external={ext} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    for (const s of ['mười triệu', '1,5', '99999999999999999']) {
      fireEvent.focus(el);
      el.setSelectionRange(0, el.value.length);
      fireEvent.paste(el, { clipboardData: { getData: () => s } });
      expect(screen.getByTestId('gia-tri').textContent, s).toBe('500000');
      expect(el.getAttribute('aria-invalid'), s).toBe('true');
    }
  });
});

describe('UnitInput km', () => {
  it('LỖI (nhẹ): dán "12,5 km" (có đơn vị — parseKm nhận được) vào ô km bị báo "Chỉ nhập chữ số"', async () => {
    let v: number | null = null;
    function H() {
      const [x, setX] = useState<number | null>(null);
      v = x;
      return <UnitInput aria-label="Số km" unit="km" value={x} onChange={setX} />;
    }
    render(<H />);
    const el = screen.getByLabelText('Số km') as HTMLInputElement;
    fireEvent.change(el, { target: { value: '12,5 km' } });
    expect(v).toBeNull();
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(parseKm('12,5 km')).toEqual({ ok: true, value: 12.5 });
  });
});
