import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitInput } from './UnitInput';
import { formatKm, parseKm } from './format';

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

  it('N7: số lớn gõ liền "2500" → 2500 km; rời ô hiện "2500" (đúng như formatKm), vào lại ô vẫn "2500" (không tự sinh dạng mơ hồ)', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('2500');
    expect(onValue).toHaveBeenLastCalledWith(2500);
    await user.click(screen.getByText('Ô khác'));
    expect(input().value).toBe('2500');
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
    expect(el.value).toBe('2500');
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

// Nghiệm thu đợt sửa 1, N-J1 (ô km): như MoneyInput — form đặt lại đúng giá cũ thì báo bằng `resetKey`.
describe('UnitInput — form đặt lại đúng giá cũ (N-J1)', () => {
  function ResetHarness({ onInputError }: { onInputError?: (m: string | null) => void }) {
    const [form, setForm] = useState({ km: 12.5 as number | null, note: '', rev: 0 });
    return (
      <>
        <UnitInput
          aria-label="Số đo"
          unit="km"
          value={form.km}
          resetKey={form.rev}
          onChange={(km) => setForm((f) => ({ ...f, km }))}
          onInputError={onInputError}
        />
        <input aria-label="Ghi chú" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        <button type="button" onClick={() => setForm((f) => ({ km: 12.5, note: '', rev: f.rev + 1 }))}>
          Huỷ thay đổi
        </button>
      </>
    );
  }

  it('ô đang lỗi (",,"), form đặt lại đúng 12,5 → ô hiện "12,5", hết lỗi, báo form hết lỗi', async () => {
    const user = userEvent.setup();
    const onInputError = vi.fn();
    render(<ResetHarness onInputError={onInputError} />);
    const el = input();
    await user.click(el);
    await user.type(el, ',,', { initialSelectionStart: 0, initialSelectionEnd: el.value.length });
    await user.click(screen.getByLabelText('Ghi chú'));
    expect(el.value).toBe(',,');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    await user.click(screen.getByText('Huỷ thay đổi'));
    expect(el.value).toBe('12,5');
    expect(el.hasAttribute('aria-invalid')).toBe(false);
    expect(onInputError).toHaveBeenLastCalledWith(null);
  });

  it('GIỮ: form vẽ lại vì ô khác đổi (cùng giá, cùng resetKey) → ô km vẫn giữ chữ sai và lỗi', async () => {
    const user = userEvent.setup();
    render(<ResetHarness />);
    const el = input();
    await user.click(el);
    await user.type(el, ',,', { initialSelectionStart: 0, initialSelectionEnd: el.value.length });
    await user.click(screen.getByLabelText('Ghi chú'));
    await user.keyboard('abc');
    expect(el.value).toBe(',,');
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });

  it('N-J3: dán đúng chữ app in ra (formatKm) vào ô km → đọc lại đúng số', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    for (const km of [2500, 12_345.6, 0.5]) {
      await user.click(input());
      await user.clear(input());
      await user.paste(formatKm(km));
      expect(input().hasAttribute('aria-invalid'), formatKm(km)).toBe(false);
      expect(onValue).toHaveBeenLastCalledWith(km);
    }
  });

  it('N-J3: gõ "1 5" vào ô km → báo lỗi, không thành 15 km', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await user.click(input());
    await user.keyboard('1 5');
    expect(onValue).not.toHaveBeenCalledWith(15);
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });
});

// Điều phối quyết (đợt sửa 1): ô km rời ô hiện đúng như formatKm (không ngăn nghìn) — chép chữ trong ô km dán sang ô km khác luôn nhận.
describe('UnitInput km — chữ hiện khi rời ô đọc lại được', () => {
  it('rời ô: chữ trong ô (bỏ hậu tố) === formatKm(x) bỏ " km", và parseKm đọc lại đúng x', () => {
    for (const km of [0.5, 999, 1000, 2500, 12_345.6, 99_999.99]) {
      const { unmount } = render(<Harness initial={km} />);
      expect(input().value, String(km)).toBe(formatKm(km).replace(/ km$/, ''));
      expect(parseKm(input().value)).toEqual({ ok: true, value: km });
      unmount();
    }
  });
  it('ô phút/lần (số nguyên) vẫn ngăn nghìn khi rời ô: 1440 phút → "1.440"', () => {
    render(<Harness unit="phút" initial={1440} />);
    expect(input().value).toBe('1.440');
  });
});

// Điều phối quyết (đợt sửa 1): ô bị gỡ khỏi form khi đang lỗi phải báo onInputError(null) lúc gỡ.
describe('UnitInput — gỡ ô đang lỗi khỏi form', () => {
  it('ô km đang lỗi (",,") bị gỡ (xoá bậc) → báo hết lỗi, form lưu được', async () => {
    const user = userEvent.setup();
    function Form() {
      const [errors, setErrors] = useState<Record<string, string>>({});
      const [shown, setShown] = useState(true);
      const [km, setKm] = useState<number | null>(3);
      return (
        <>
          {shown && (
            <UnitInput
              aria-label="Số đo"
              unit="km"
              value={km}
              onChange={setKm}
              onInputError={(m) =>
                setErrors((e) => {
                  const next = { ...e };
                  if (m) next.km = m;
                  else delete next.km;
                  return next;
                })
              }
            />
          )}
          <button type="button" onClick={() => setShown(false)}>
            Bỏ bậc
          </button>
          <button type="button" disabled={Object.keys(errors).length > 0}>
            Lưu
          </button>
        </>
      );
    }
    render(<Form />);
    await user.click(input());
    await user.type(input(), ',,', { initialSelectionStart: 0, initialSelectionEnd: input().value.length });
    expect((screen.getByText('Lưu') as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByText('Bỏ bậc'));
    expect(screen.queryByLabelText('Số đo')).toBeNull();
    expect((screen.getByText('Lưu') as HTMLButtonElement).disabled).toBe(false);
  });
});
