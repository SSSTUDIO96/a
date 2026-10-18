import { useId, useState } from 'react';
import type { Service } from '../../../api/types';
import { Button, IconClose, IconPlus, Select, SettingRow, UnitInput } from '../../../ui';
import { Group, GroupError } from '../parts';
import type { GroupProps } from './InfoPriceGroup';

// "Đã gồm trong gói": mỗi dịch vụ một dòng số lần. Gửi lại toàn bộ items khi lưu (logic.itemsFromForm).
// Dịch vụ chọn được: loại chính hoặc phụ đang bán; phụ phí không gộp vào gói được (máy chủ chặn).
export function IncludedGroup({ form, set, errors, perms, onInputError, services }: GroupProps & { services: readonly Service[] }) {
  const id = useId();
  const [picking, setPicking] = useState(false);
  const canEdit = perms.catalogWrite;
  const used = new Set([...form.included.map((r) => r.serviceId), ...form.addons]);
  const choices = services.filter((s) => s.kind !== 'SURCHARGE' && s.isActive && !used.has(s.id));

  function setQty(i: number, quantity: number | null) {
    set({ included: form.included.map((r, j) => (j === i ? { ...r, quantity } : r)) });
  }

  return (
    <Group title="Đã gồm trong gói">
      {form.included.map((row, i) => (
        <SettingRow key={row.serviceId} label={row.name} htmlFor={`${id}-${i}`} controlWidth={canEdit ? 220 : 180}>
          <span className="pr-qty">
            <UnitInput
              id={`${id}-${i}`}
              unit="lần"
              min={1}
              max={100}
              value={row.quantity}
              onChange={(v) => setQty(i, v)}
              onInputError={(m) => onInputError(`included.${i}`, m)}
              error={errors[`included.${i}`]}
              disabled={!canEdit}
            />
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={<IconClose />}
                aria-label={`Bỏ ${row.name} khỏi gói`}
                onClick={() => set({ included: form.included.filter((_, j) => j !== i) })}
              />
            )}
          </span>
        </SettingRow>
      ))}
      {canEdit &&
        (picking ? (
          <SettingRow label="Thêm dịch vụ" htmlFor={`${id}-chon`} controlWidth={220}>
            <Select
              id={`${id}-chon`}
              placeholder={choices.length > 0 ? 'Chọn dịch vụ' : 'Hết dịch vụ để thêm'}
              options={choices.map((s) => ({ value: s.id, label: s.name }))}
              value=""
              autoFocus
              onBlur={() => setPicking(false)}
              onChange={(e) => {
                const s = choices.find((x) => x.id === e.target.value);
                if (s) set({ included: [...form.included, { serviceId: s.id, name: s.name, quantity: 1 }] });
                setPicking(false);
              }}
            />
          </SettingRow>
        ) : (
          <Button variant="ghost" size="sm" className="pr-add-link" icon={<IconPlus />} onClick={() => setPicking(true)}>
            Thêm dịch vụ
          </Button>
        ))}
      {!canEdit && form.included.length === 0 && <p className="pr-muted">Chưa có dịch vụ nào.</p>}
      <GroupError message={errors.included} />
    </Group>
  );
}
