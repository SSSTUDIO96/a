import { useId } from 'react';
import type { MakeupSubject } from '../../../api/types';
import { MoneyInput, Select, SettingRow, Switch, TextInput, UnitInput, type SelectOption } from '../../../ui';
import { ALL_SUBJECTS_LABEL, type FormErrors, type PackageForm, type PricingPerms } from '../logic';
import { Group } from '../parts';

export interface GroupProps {
  form: PackageForm;
  set: (patch: Partial<PackageForm>) => void;
  errors: FormErrors;
  perms: PricingPerms;
  // Lỗi tự phát hiện khi gõ (MoneyInput/UnitInput): chặn lưu cho tới khi sửa.
  onInputError: (key: string, message: string | null) => void;
}

export const TIP_SUBJECT = 'Để Mọi nhân vật nếu gói dùng cho ai cũng được.';
export const TIP_ACTIVE = 'Tắt = ngừng bán: ẩn khỏi danh sách, không xoá. Hợp đồng đã lập không đổi.';
export const TIP_SALE = 'Bỏ trống nếu không giảm. Hợp đồng dùng giá bán khi có. Đổi giá = thêm bản giá mới; hợp đồng cũ giữ giá đã chốt.';

// Số nguyên dương từ ô chữ: rỗng → null; có ký tự khác chữ số → giữ nguyên giá trị cũ.
function parseCount(raw: string, prev: number | null): number | null {
  const t = raw.trim();
  if (t === '') return null;
  return /^\d{1,4}$/.test(t) ? Number(t) : prev;
}

export function InfoPriceGroup({
  form,
  set,
  errors,
  perms,
  onInputError,
  mode,
  subjects,
}: GroupProps & { mode: 'create' | 'edit'; subjects: readonly MakeupSubject[] }) {
  const id = useId();
  const canEdit = perms.catalogWrite;
  // Tạo gói: giá đầu tiên đi cùng thân tạo (đã cần cả catalog.write lẫn prices.write để mở hộp).
  const canPrice = perms.pricesWrite;
  const subjectOptions: SelectOption[] = [
    { value: '', label: ALL_SUBJECTS_LABEL },
    ...subjects.filter((s) => s.isActive || s.id === form.subjectId).map((s) => ({ value: s.id, label: s.name })),
  ];
  return (
    <Group title="Thông tin & giá">
      {mode === 'create' && (
        <SettingRow label="Mã gói" htmlFor={`${id}-ma`} controlWidth={180}>
          <TextInput id={`${id}-ma`} value={form.code} onChange={(e) => set({ code: e.target.value })} error={errors.code} disabled={!canEdit} maxLength={32} />
        </SettingRow>
      )}
      <SettingRow label="Tên gói" htmlFor={`${id}-ten`} controlWidth={180}>
        <TextInput id={`${id}-ten`} value={form.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} disabled={!canEdit} maxLength={120} />
      </SettingRow>
      <SettingRow label="Nhân vật" htmlFor={`${id}-nv`} tip={TIP_SUBJECT} controlWidth={180}>
        <Select
          id={`${id}-nv`}
          options={subjectOptions}
          value={form.subjectId ?? ''}
          onChange={(e) => set({ subjectId: e.target.value === '' ? null : e.target.value })}
          error={errors.subjectId}
          disabled={!canEdit}
        />
      </SettingRow>
      <SettingRow label="Thời lượng" htmlFor={`${id}-tl`} controlWidth={180}>
        <UnitInput
          id={`${id}-tl`}
          unit="phút"
          min={1}
          max={1440}
          value={form.durationMinutes}
          onChange={(v) => set({ durationMinutes: v })}
          onInputError={(m) => onInputError('durationMinutes', m)}
          error={errors.durationMinutes}
          disabled={!canEdit}
        />
      </SettingRow>
      <SettingRow label="Số thợ" htmlFor={`${id}-st`} controlWidth={180}>
        <TextInput
          id={`${id}-st`}
          inputMode="numeric"
          align="right"
          value={form.staffCount === null ? '' : String(form.staffCount)}
          onChange={(e) => set({ staffCount: parseCount(e.target.value, form.staffCount) })}
          error={errors.staffCount}
          disabled={!canEdit}
        />
      </SettingRow>
      <SettingRow label="Giá niêm yết" htmlFor={`${id}-gny`} controlWidth={180}>
        <MoneyInput
          id={`${id}-gny`}
          value={form.listPrice}
          onChange={(v) => set({ listPrice: v })}
          onInputError={(m) => onInputError('listPrice', m)}
          error={errors.listPrice}
          disabled={!canPrice}
        />
      </SettingRow>
      <SettingRow label="Giá bán" htmlFor={`${id}-gb`} tip={TIP_SALE} controlWidth={180}>
        <MoneyInput
          id={`${id}-gb`}
          value={form.salePrice}
          placeholder="Không giảm"
          onChange={(v) => set({ salePrice: v })}
          onInputError={(m) => onInputError('salePrice', m)}
          error={errors.salePrice}
          disabled={!canPrice}
        />
      </SettingRow>
      <SettingRow label="Cọc mặc định" htmlFor={`${id}-coc`} controlWidth={180}>
        <MoneyInput
          id={`${id}-coc`}
          value={form.depositAmount}
          onChange={(v) => set({ depositAmount: v })}
          onInputError={(m) => onInputError('depositAmount', m)}
          error={errors.depositAmount}
          disabled={!canEdit}
        />
      </SettingRow>
      <SettingRow label="Đang bán" htmlFor={`${id}-ban`} tip={TIP_ACTIVE} controlWidth={180}>
        <Switch id={`${id}-ban`} checked={form.isActive} onChange={(v) => set({ isActive: v })} disabled={!canEdit} />
      </SettingRow>
    </Group>
  );
}
