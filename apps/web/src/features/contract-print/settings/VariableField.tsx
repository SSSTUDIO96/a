import { useLayoutEffect, useRef, useState } from 'react';
import type { ContractKind } from '../../../api/types';
import { SettingRow, Textarea, TextInput } from '../../../ui';
import { usableVariables } from './logic';

// Biến hay dùng hiện sẵn; còn lại sau nút "Thêm biến".
const COMMON = ['Tên khách', 'Ngày sự kiện', 'Tên khoá', 'Mã hợp đồng', 'Tổng tiền', 'Tiền cọc', 'Tên studio'];

export interface VariableFieldProps {
  id: string;
  label: string;
  tip: string;
  value: string;
  onChange: (v: string) => void;
  kinds: readonly ContractKind[];
  error?: string | null;
  multiline?: boolean;
  rows?: number;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
}

// Ô chữ có chip biến: bấm chip thì chèn {Tên biến} đúng chỗ con trỏ (nhớ vị trí cả khi ô đã mất tiêu điểm vì bấm chip).
export function VariableField({ id, label, tip, value, onChange, kinds, error, multiline, rows = 3, maxLength, placeholder, disabled }: VariableFieldProps) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const sel = useRef<{ s: number; e: number } | null>(null);
  const pending = useRef<number | null>(null);
  const [all, setAll] = useState(false);

  const usable = usableVariables(kinds);
  const common = COMMON.filter((v) => (usable as string[]).includes(v));
  const rest = usable.filter((v) => !common.includes(v));
  const shown = all ? [...common, ...rest] : common;

  function remember() {
    const el = ref.current;
    if (el) sel.current = { s: el.selectionStart ?? el.value.length, e: el.selectionEnd ?? el.value.length };
  }

  function insert(name: string) {
    const token = `{${name}}`;
    const at = sel.current ?? { s: value.length, e: value.length };
    const s = Math.min(at.s, value.length);
    const e = Math.min(at.e, value.length);
    pending.current = s + token.length;
    onChange(value.slice(0, s) + token + value.slice(e));
  }

  useLayoutEffect(() => {
    const p = pending.current;
    const el = ref.current;
    if (p !== null && el) {
      el.focus();
      el.setSelectionRange(p, p);
      sel.current = { s: p, e: p };
    }
    pending.current = null;
  });

  const common_ = {
    id,
    ref,
    value,
    disabled,
    maxLength: maxLength + 200, // cho gõ quá một chút để báo lỗi "Tối đa …" thay vì cắt lặng lẽ
    placeholder,
    error: error ?? null,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onSelect: remember,
    onKeyUp: remember,
    onClick: remember,
    onBlur: remember,
  };

  return (
    <SettingRow label={label} htmlFor={id} tip={tip} stack>
      <div className="mi-var">
        {multiline ? <Textarea rows={rows} {...common_} /> : <TextInput {...common_} />}
        {!disabled && (
          <div className="mi-var__chips" role="group" aria-label={`Chèn biến vào ${label.toLocaleLowerCase('vi')}`}>
            {shown.map((v) => (
              <button key={v} type="button" className="mi-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)}>
                {`{${v}}`}
              </button>
            ))}
            {rest.length > 0 && (
              <button type="button" className="mi-chip mi-chip--more" aria-expanded={all} onClick={() => setAll((x) => !x)}>
                {all ? 'Ít biến hơn' : `Thêm biến (${rest.length})`}
              </button>
            )}
          </div>
        )}
      </div>
    </SettingRow>
  );
}
