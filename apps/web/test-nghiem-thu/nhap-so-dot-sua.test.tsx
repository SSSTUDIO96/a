// THỢ CHẤM ĐỢT SỬA 1 — ô tiền / ô km với chuỗi lạ. Mỗi bài viết theo hành vi ĐÚNG: đỏ = lỗi có thật.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyInput } from '../src/ui/MoneyInput';
import { UnitInput } from '../src/ui/UnitInput';
import { formatKm, parseKm, parseMoney } from '../src/ui/format';

describe('hàm đọc số với chuỗi lạ', () => {
  const cases: [string, unknown][] = [
    ['1.500,5', false], ['  2 500 ', 2500], ['1e6', false], ['１５００', false], ['١٥٠٠', false],
    ['1500000\t', 1_500_000], ['1.500.000\r\n', 1_500_000], ['"1.500.000"', false], ['1.500.000,00', false],
    ['​1.500.000', false], ['1 500 000 VND', 1_500_000], ['0', 0], ['0012', 12], ['–5', false],
  ];
  for (const [s, want] of cases) {
    it(`parseMoney(${JSON.stringify(s)}) → ${want === false ? 'lỗi' : want}`, () => {
      const r = parseMoney(s);
      if (want === false) expect(r.ok).toBe(false);
      else expect(r).toEqual({ ok: true, value: want });
    });
  }
  it('km: chữ do chính app in ra (formatKm) dán lại vào ô km phải đọc được', () => {
    for (const km of [12.5, 999, 2500, 1234.5]) {
      const shown = formatKm(km); // "2.500 km"
      expect(parseKm(shown), shown).toEqual({ ok: true, value: km });
    }
  });
  it('km: "1 5" (gõ nhầm dấu cách giữa hai chữ số) không được lặng lẽ thành 15 km', () => {
    expect(parseKm('1 5').ok).toBe(false);
  });
});

function MoneyHarness({ ext, initial = 3_000_000 }: { ext: { set?: (v: number | null) => void }; initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  ext.set = setValue;
  return (
    <>
      <MoneyInput aria-label="Giá bán" value={value} onChange={setValue} />
      <output data-testid="gia-tri">{String(value)}</output>
      <button type="button">Ô khác</button>
    </>
  );
}

describe('MoneyInput — biến thể N5/N6', () => {
  it('N6 biến thể: ô đang lỗi ("-5"), form ĐẶT LẠI đúng giá cũ (nút "Huỷ thay đổi") → ô phải hiện lại giá thật, hết lỗi', async () => {
    const user = userEvent.setup();
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness ext={ext} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    await user.click(el);
    // Bôi đen cả ô rồi gõ đè "-5" (không xoá trắng trước — xoá trắng sẽ làm giá trị thành null).
    await user.type(el, '-5', { initialSelectionStart: 0, initialSelectionEnd: el.value.length });
    await user.click(screen.getByText('Ô khác'));
    expect(el.value).toBe('-5');
    expect(screen.getByTestId('gia-tri').textContent).toBe('3000000'); // số thật chưa đổi
    act(() => ext.set?.(3_000_000)); // đặt lại đúng giá đang có
    console.log(`[N6-biến-thể] sau khi đặt lại: ô hiện "${el.value}", aria-invalid=${el.getAttribute('aria-invalid')}, số thật=${screen.getByTestId('gia-tri').textContent}`);
    expect(el.value).toBe('3.000.000 ₫');
    expect(el.getAttribute('aria-invalid')).toBeNull();
  });

  it('N5: gõ "1.5" từng phím → báo lỗi, giá trị không thành 15', async () => {
    const user = userEvent.setup();
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness ext={ext} initial={null} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    await user.click(el);
    await user.type(el, '1.5');
    // Gõ "1" là số hợp lệ (1 đ); tới dấu chấm thì ô báo lỗi và giữ nguyên — không được thành 15.
    expect(screen.getByTestId('gia-tri').textContent).not.toBe('15');
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });

  it('dán từ Excel "1500000\\r\\n" vào ô trống → 1.500.000', () => {
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness ext={ext} initial={null} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    fireEvent.focus(el);
    fireEvent.paste(el, { clipboardData: { getData: () => '1500000\r\n' } });
    expect(screen.getByTestId('gia-tri').textContent).toBe('1500000');
  });

  it('dán "  2 500 " vào ô trống → 2.500', () => {
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness ext={ext} initial={null} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    fireEvent.focus(el);
    fireEvent.paste(el, { clipboardData: { getData: () => '  2 500 ' } });
    expect(screen.getByTestId('gia-tri').textContent).toBe('2500');
  });

  it('dán số toàn chiều rộng "１５００" → báo lỗi, không đổi giá trị', () => {
    const ext: { set?: (v: number | null) => void } = {};
    render(<MoneyHarness ext={ext} initial={null} />);
    const el = screen.getByLabelText('Giá bán') as HTMLInputElement;
    fireEvent.focus(el);
    fireEvent.paste(el, { clipboardData: { getData: () => '１５００' } });
    expect(screen.getByTestId('gia-tri').textContent).toBe('null');
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('UnitInput km — biến thể N6/N7/N8', () => {
  function KmHarness({ ext, initial = 12.5 }: { ext: { set?: (v: number | null) => void; v?: number | null }; initial?: number | null }) {
    const [x, setX] = useState<number | null>(initial);
    ext.set = setX;
    ext.v = x;
    return (
      <>
        <UnitInput aria-label="Số km" unit="km" value={x} onChange={setX} />
        <button type="button">Ô khác</button>
      </>
    );
  }
  it('N8: gõ thẳng "12,5 km" → 12,5', () => {
    const ext: { set?: (v: number | null) => void; v?: number | null } = {};
    render(<KmHarness ext={ext} initial={null} />);
    const el = screen.getByLabelText('Số km') as HTMLInputElement;
    fireEvent.change(el, { target: { value: '12,5 km' } });
    expect(ext.v).toBe(12.5);
  });
  it('N7: "2.500" → báo lỗi, không thành 2.500 km', () => {
    const ext: { set?: (v: number | null) => void; v?: number | null } = {};
    render(<KmHarness ext={ext} initial={null} />);
    const el = screen.getByLabelText('Số km') as HTMLInputElement;
    fireEvent.change(el, { target: { value: '2.500' } });
    expect(ext.v).toBeNull();
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });
  it('N6 biến thể ở ô km: đang lỗi, form đặt lại đúng giá cũ → ô hiện lại giá thật', async () => {
    const user = userEvent.setup();
    const ext: { set?: (v: number | null) => void; v?: number | null } = {};
    render(<KmHarness ext={ext} />);
    const el = screen.getByLabelText('Số km') as HTMLInputElement;
    await user.click(el);
    await user.type(el, ',,', { initialSelectionStart: 0, initialSelectionEnd: el.value.length }); // gõ đè chuỗi sai ngay từ phím đầu
    await user.click(screen.getByText('Ô khác'));
    expect(ext.v).toBe(12.5); // số thật chưa đổi
    act(() => ext.set?.(12.5));
    console.log(`[N6-biến-thể km] ô hiện "${el.value}", aria-invalid=${el.getAttribute('aria-invalid')}, số thật=${ext.v}`);
    expect(el.value).toBe('12,5');
  });
});
