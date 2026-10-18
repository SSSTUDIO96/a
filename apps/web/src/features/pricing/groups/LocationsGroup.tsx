import { useId } from 'react';
import { Checkbox, SettingRow, Tooltip, UnitInput } from '../../../ui';
import { LOCATION_ORDER, PLACE_LABEL } from '../logic';
import { Group, GroupError } from '../parts';
import type { GroupProps } from './InfoPriceGroup';

export const TIP_TRAVEL_PLACE = 'Lập hợp đồng ở đây sẽ bắt buộc có phí di chuyển.';
export const TIP_INCLUDED_KM =
  'Khoảng cách một chiều trong bán kính này không tính phí di chuyển (trừ khi nhập tay). Bỏ trống = dùng bán kính chung ở Phí di chuyển.';

// Nhóm "Địa điểm cho phép" — anh Chiến đã nhắc thiếu nhóm này. Gồm 3 ô tick và bán kính miễn phí của gói.
export function LocationsGroup({ form, set, errors, perms, onInputError }: GroupProps) {
  const id = useId();
  const canEdit = perms.catalogWrite;
  const travels = form.locationTypes.includes('CUSTOMER_HOME') || form.locationTypes.includes('OTHER');
  return (
    <Group title="Địa điểm cho phép">
      <div className="pr-ckl">
        {LOCATION_ORDER.map((t) => (
          <Checkbox
            key={t}
            label={PLACE_LABEL[t]}
            checked={form.locationTypes.includes(t)}
            disabled={!canEdit}
            onChange={(e) =>
              set({
                locationTypes: e.target.checked
                  ? LOCATION_ORDER.filter((x) => x === t || form.locationTypes.includes(x))
                  : form.locationTypes.filter((x) => x !== t),
              })
            }
            tip={t === 'STUDIO' ? undefined : <Tooltip text={TIP_TRAVEL_PLACE} />}
          />
        ))}
      </div>
      <GroupError message={errors.locationTypes} />
      {travels && (
        <SettingRow label="Bán kính miễn phí" htmlFor={`${id}-km`} tip={TIP_INCLUDED_KM} controlWidth={180}>
          <UnitInput
            id={`${id}-km`}
            unit="km"
            value={form.includedKm}
            placeholder="Theo mức chung"
            onChange={(v) => set({ includedKm: v })}
            onInputError={(m) => onInputError('includedKm', m)}
            error={errors.includedKm}
            disabled={!canEdit}
          />
        </SettingRow>
      )}
    </Group>
  );
}
