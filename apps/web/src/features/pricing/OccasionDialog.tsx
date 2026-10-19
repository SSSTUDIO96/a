import { useId, useRef, useState } from 'react';
import { createOccasion, updateOccasion } from '../../api/catalog';
import type { OccasionColor, OccasionView } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Dialog, SettingRow, TextInput } from '../../ui';
import { useFirstErrorFocus, useStableKey } from './formHooks';
import {
  OCCASION_COLOR_LABEL,
  OCCASION_COLOR_LIST,
  OCCASION_NAME_MAX,
  buildOccasionCreate,
  buildOccasionPatch,
  mapOccasionError,
  occasionToForm,
  validateOccasionForm,
  type FormErrors,
  type OccasionForm,
} from './logic';
import { ErrorBanner } from './parts';

// 12 ô màu dùng chung với Lịch. Đang chọn: viền đậm. Tooltip mỗi ô = tên màu tiếng Việt.
// `readOnly`: chỉ hiện ô đang chọn (không có catalog.write).
export function ColorSwatches({
  value,
  onPick,
  subject,
  disabled,
  readOnly,
}: {
  value: OccasionColor | null;
  onPick: (c: OccasionColor) => void;
  // Tên loại (đọc cho trình đọc màn hình): "Lễ cưới: màu Hồng".
  subject?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const colors = readOnly ? OCCASION_COLOR_LIST.filter((c) => c === value) : OCCASION_COLOR_LIST;
  return (
    <span className="pr-sws" role="group" aria-label={subject ? `Màu của ${subject}` : 'Màu'}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`pr-sw pr-sw--${c}`}
          aria-pressed={value === c}
          aria-label={subject ? `${subject}: màu ${OCCASION_COLOR_LABEL[c]}` : `Màu ${OCCASION_COLOR_LABEL[c]}`}
          title={OCCASION_COLOR_LABEL[c]}
          disabled={disabled || readOnly}
          onClick={() => onPick(c)}
        />
      ))}
    </span>
  );
}

// Thêm loại sự kiện / đổi tên (và màu) một loại. POST /occasions · PATCH /occasions/:id.
export function OccasionDialog({
  orgId,
  occasion,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  orgId: string;
  // null = thêm mới.
  occasion: OccasionView | null;
  // Loại mới xếp cuối danh sách.
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (o: OccasionView) => void;
}) {
  const id = useId();
  const online = useOnline();
  const [form, setForm] = useState<OccasionForm>(() => occasionToForm(occasion));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useStableKey();
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFirstErrorFocus(bodyRef);

  const set = (patch: Partial<OccasionForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  async function save() {
    setBanner(null);
    const v = validateOccasionForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      if (occasion) {
        const patch = buildOccasionPatch(occasion, form);
        if (!patch) {
          onClose();
          return;
        }
        onSaved(await updateOccasion(orgId, occasion.id, patch));
      } else {
        const body = buildOccasionCreate(form, nextSortOrder);
        onSaved(await createOccasion(orgId, body, key.get(JSON.stringify(body))));
      }
    } catch (err) {
      const m = mapOccasionError(err);
      setErrors(m.fields);
      setBanner(m.banner);
      focusFirstError();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title={occasion ? 'Sửa loại sự kiện' : 'Thêm loại sự kiện'}
      primaryLabel="Lưu"
      onPrimary={() => void save()}
      primaryLoading={saving}
      primaryDisabled={!online}
    >
      <div ref={bodyRef}>
        {banner && <ErrorBanner>{banner}</ErrorBanner>}
        <SettingRow label="Tên loại" htmlFor={`${id}-ten`} required tip="Hiện trong ô chọn sự kiện ở dòng hợp đồng. Đổi tên không đổi các dòng hợp đồng đã lưu." controlWidth={220}>
          <TextInput
            id={`${id}-ten`}
            value={form.name}
            maxLength={OCCASION_NAME_MAX}
            onChange={(e) => set({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
            error={errors.name}
          />
        </SettingRow>
        <SettingRow label="Màu" required tip="12 màu dùng chung với Lịch. Ca trên Lịch tô theo màu hiện tại của loại." stack>
          <div className="pr-sw-field">
            <ColorSwatches value={form.color} onPick={(c) => set({ color: c })} />
            {errors.color && (
              <div className="pr-gerr" role="alert">
                {errors.color}
              </div>
            )}
          </div>
        </SettingRow>
      </div>
    </Dialog>
  );
}
