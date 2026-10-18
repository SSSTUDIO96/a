import type { Service } from '../../../api/types';
import { Checkbox, formatVnd, Tooltip } from '../../../ui';
import { Group, GroupError } from '../parts';
import type { GroupProps } from './InfoPriceGroup';

export const TIP_ADDONS = 'Khi lập hợp đồng, các dịch vụ được chọn ở đây hiện thành ô tick dưới gói.';

// "Dịch vụ phụ cho tick": mỗi dịch vụ loại ADDON một ô tick, giá bên phải. Tick = có trong items với isOptional = true.
export function AddonsGroup({ form, set, errors, perms, addons }: GroupProps & { addons: readonly Service[] }) {
  const canEdit = perms.catalogWrite;
  const included = new Set(form.included.map((r) => r.serviceId));
  // Dịch vụ phụ đã ngừng bán nhưng gói vẫn đang để tick: vẫn hiện để bỏ tick được.
  const list = addons.filter((s) => s.isActive || form.addons.includes(s.id));
  return (
    <Group title="Dịch vụ phụ cho tick" tip={TIP_ADDONS}>
      {list.length === 0 ? (
        <p className="pr-muted">Chưa có dịch vụ phụ.</p>
      ) : (
        <div className="pr-ckl">
          {list.map((s) => {
            const inPackage = included.has(s.id);
            return (
              <Checkbox
                key={s.id}
                label={s.name}
                muteWhenOff
                trailing={s.currentPrice ? formatVnd(s.currentPrice.unitPrice) : 'Chưa có giá'}
                checked={form.addons.includes(s.id)}
                disabled={!canEdit || inPackage}
                tip={inPackage ? <Tooltip text="Dịch vụ này đã gồm trong gói." /> : undefined}
                onChange={(e) =>
                  set({ addons: e.target.checked ? [...form.addons, s.id] : form.addons.filter((x) => x !== s.id) })
                }
              />
            );
          })}
        </div>
      )}
      <GroupError message={errors.addons} />
    </Group>
  );
}
