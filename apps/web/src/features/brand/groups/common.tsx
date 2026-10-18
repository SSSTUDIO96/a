// Phần dùng chung của các nhóm form hồ sơ: tiêu đề nhóm, dòng chữ "nhãn + ô" (bản vẽ C2 mục 4.2, dòng "wide").
import { useId, type ReactNode } from 'react';
import { SettingRow, Textarea, TextInput, Tooltip } from '../../../ui';
import { MAX_LENGTH, type Draft, type FormErrors, type TextField } from '../model';

export interface GroupProps {
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  errors: FormErrors;
  // Không có org.update / đang lưu → khoá.
  disabled: boolean;
}

export function GroupTitle({ children, tip }: { children: ReactNode; tip?: ReactNode }) {
  return (
    <h3 className="br-grp">
      {children}
      {tip !== undefined && <Tooltip text={tip} />}
    </h3>
  );
}

const CONTROL_WIDTH = 360;

export function TextRow({
  field,
  label,
  tip,
  required,
  multiline,
  rows,
  placeholder,
  inputMode,
  type,
  draft,
  setDraft,
  errors,
  disabled,
}: GroupProps & {
  field: TextField;
  label: string;
  tip?: ReactNode;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'url';
  type?: 'text' | 'tel' | 'email' | 'url';
}) {
  const id = `${useId()}-${field}`;
  const common = {
    id,
    value: draft[field],
    maxLength: MAX_LENGTH[field],
    placeholder,
    disabled,
    error: errors[field],
    'data-field': field,
    'aria-required': required || undefined,
  };
  return (
    <SettingRow label={label} htmlFor={id} tip={tip} required={required} controlWidth={CONTROL_WIDTH} stack={multiline} className="br-row">
      {multiline ? (
        <Textarea {...common} rows={rows ?? 2} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))} />
      ) : (
        <TextInput
          {...common}
          type={type ?? 'text'}
          inputMode={inputMode}
          onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
        />
      )}
    </SettingRow>
  );
}
