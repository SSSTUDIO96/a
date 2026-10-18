import { useRef, useState } from 'react';
import { Button, IconClose, IconPlus, SettingRow, TextInput } from '../../../ui';
import { addStyle, MAX_STYLE_LENGTH, MAX_STYLES } from '../model';
import { GroupTitle, TextRow, type GroupProps } from './common';

// Nhóm "Thương hiệu": tên, câu giới thiệu, giới thiệu, kinh nghiệm, phong cách, khu vực phục vụ.
export function IdentityGroup(props: GroupProps) {
  return (
    <div className="br-group" data-group="thuong-hieu">
      <GroupTitle>Thương hiệu</GroupTitle>
      <TextRow {...props} field="brandName" label="Tên thương hiệu" required />
      <TextRow {...props} field="tagline" label="Câu giới thiệu ngắn" tip="Hiện ngay dưới tên trên trang. Tối đa 200 ký tự." />
      <TextRow {...props} field="bio" label="Giới thiệu" multiline rows={3} />
      <TextRow {...props} field="experience" label="Kinh nghiệm" />
      <StylesRow {...props} />
      <TextRow {...props} field="serviceArea" label="Khu vực phục vụ" />
    </div>
  );
}

function StylesRow({ draft, setDraft, errors, disabled }: GroupProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const r = addStyle(draft.styles, text);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDraft((d) => ({ ...d, styles: r.styles }));
    setText('');
    setError(null);
    inputRef.current?.focus();
  }

  function cancel() {
    setAdding(false);
    setText('');
    setError(null);
  }

  const shownError = error ?? errors.styles;
  const full = draft.styles.length >= MAX_STYLES;
  return (
    <SettingRow label="Phong cách" tip={`Tối đa ${MAX_STYLES} phong cách, mỗi cái tối đa ${MAX_STYLE_LENGTH} ký tự. Gõ rồi nhấn Enter để thêm.`} controlWidth={360} className="br-row">
      <div className="br-styles" data-field="styles">
        {draft.styles.map((s) => (
          <span key={s} className="br-style">
            {s}
            <button
              type="button"
              className="br-style__x"
              aria-label={`Bỏ phong cách ${s}`}
              disabled={disabled}
              onClick={() => setDraft((d) => ({ ...d, styles: d.styles.filter((x) => x !== s) }))}
            >
              <IconClose />
            </button>
          </span>
        ))}
        {adding ? (
          <span className="br-style-add">
            <TextInput
              ref={inputRef}
              size="sm"
              autoFocus
              value={text}
              maxLength={MAX_STYLE_LENGTH + 10}
              aria-label="Phong cách mới"
              placeholder="Ví dụ: Tự nhiên"
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancel();
                }
              }}
              onBlur={() => {
                if (text.trim() === '') cancel();
              }}
            />
          </span>
        ) : (
          !full && (
            <Button size="sm" variant="dashed" icon={<IconPlus />} disabled={disabled} onClick={() => setAdding(true)}>
              Thêm
            </Button>
          )
        )}
        {shownError && (
          <span className="br-err" role="alert">
            {shownError}
          </span>
        )}
      </div>
    </SettingRow>
  );
}
