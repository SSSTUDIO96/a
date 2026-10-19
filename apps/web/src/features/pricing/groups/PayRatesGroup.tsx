import { useId, useMemo } from 'react';
import type { PayRateSheet, Vnd } from '../../../api/types';
import { Avatar, MoneyInput, Skeleton } from '../../../ui';
import { staffInitials, useCurrentOrgStaffNaming, rosterEntryOf } from '../../staff/useStaffNaming';
import type { Resource } from '../hooks';
import type { FormErrors } from '../logic';
import { Group, GroupError, LoadError } from '../parts';

// Chồng ảnh: tối đa 3 ảnh rồi "+n" (như AvatarStack).
const STACK_MAX = 3;

export const TIP_PAY = 'Số tiền trả cho thợ mỗi lần làm, theo bậc lương của thợ. Bỏ trống = chưa đặt.';

export interface PayRatesGroupProps {
  // 'create': gói/dịch vụ chưa có id nên chưa có bảng công.
  sheet: 'create' | Resource<PayRateSheet>;
  rates: Record<string, Vnd | null>;
  onChange: (tierId: string, amount: Vnd | null) => void;
  errors: FormErrors;
  canWrite: boolean;
  onInputError: (key: string, message: string | null) => void;
  retry: () => void;
}

// "Tiền công thợ theo bậc": mỗi bậc = ảnh đại diện + tên bậc + tên thợ → ô nhập tiền ("Chưa đặt" khi null).
// Người gọi chỉ dựng nhóm khi có payroll.read; thiếu payroll.write thì ô khoá.
export function PayRatesGroup({ sheet, rates, onChange, errors, canWrite, onInputError, retry }: PayRatesGroupProps) {
  const id = useId();
  // L2: màu ảnh thợ qua sổ thợ chung (ui/staffName.ts) — không dùng AvatarStack (băm thẳng mã thành viên).
  const shownStaff = useMemo(
    () => (sheet !== 'create' && sheet.status === 'ready' ? sheet.data.items.flatMap((r) => r.staff.map(rosterEntryOf)) : []),
    [sheet],
  );
  const naming = useCurrentOrgStaffNaming(shownStaff);
  let body;
  if (sheet === 'create') {
    body = <p className="pr-muted">Lưu xong mới đặt được tiền công.</p>;
  } else if (sheet.status === 'loading') {
    body = (
      <div role="status" aria-label="Đang tải tiền công">
        {[0, 1].map((i) => (
          <div key={i} className="pr-tier">
            <span className="pr-tier__who">
              <Skeleton width={28} height={28} circle />
              <Skeleton width={140} height={14} />
            </span>
            <Skeleton height={36} />
          </div>
        ))}
      </div>
    );
  } else if (sheet.status === 'error') {
    body = <LoadError error={sheet.error} retry={retry} />;
  } else if (sheet.data.items.length === 0) {
    body = <p className="pr-muted">Chưa có bậc thợ.</p>;
  } else {
    body = sheet.data.items.map((row) => {
      const names = row.staff.map((s) => s.displayName).join(', ');
      return (
        <div key={row.tier.id} className="pr-tier">
          <span className="pr-tier__who">
            {row.staff.length > 0 && (
              <span className="ui-avs" role="group" aria-label={names}>
                {row.staff.slice(0, STACK_MAX).map((s) => (
                  <Avatar key={s.membershipId} name={s.displayName} initials={staffInitials(s)} avatarUrl={s.avatarUrl} colorKey={naming.colorKey(s.membershipId)} size="sm" />
                ))}
                {row.staff.length > STACK_MAX && (
                  <span className="ui-av ui-av--sm ui-avs__more" aria-hidden="true">
                    +{row.staff.length - STACK_MAX}
                  </span>
                )}
              </span>
            )}
            <span className="pr-tier__txt">
              <label className="pr-tier__name" htmlFor={`${id}-${row.tier.id}`}>
                {row.tier.name}
              </label>
              <span className="pr-fx">{names || 'Chưa có thợ'}</span>
            </span>
          </span>
          <MoneyInput
            id={`${id}-${row.tier.id}`}
            value={rates[row.tier.id] ?? null}
            placeholder="Chưa đặt"
            onChange={(v) => onChange(row.tier.id, v)}
            onInputError={(m) => onInputError(`payRates.${row.tier.id}`, m)}
            error={errors[`payRates.${row.tier.id}`]}
            disabled={!canWrite}
          />
        </div>
      );
    });
  }
  return (
    <Group title="Tiền công thợ theo bậc" tip={TIP_PAY}>
      {body}
      <GroupError message={errors.payRates} />
    </Group>
  );
}
