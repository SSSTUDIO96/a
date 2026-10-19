import { useId } from 'react';
import type { StaffMember, StaffTier } from '../../api/types';
import type { StaffNaming } from '../../ui/staffName';
import { Avatar, Button, Select, WithTooltip } from '../../ui';
import { tierOptions } from './logic';
import { staffInitials } from './useStaffNaming';

// Một dòng thợ (C2 1.2): ảnh 32 · tên + vai trò (· tắt nhận lịch) · ô chọn bậc (đổi là lưu ngay) · "Hồ sơ".
export interface StaffRowProps {
  row: StaffMember;
  // L2: màu ảnh đại diện theo sổ thợ chung (ui/staffName.ts) — một người một màu ở mọi màn.
  naming: StaffNaming;
  tiers: StaffTier[];
  roleText: string;
  // Không có quyền đổi bậc: ô chọn thành chữ.
  canSeeSelect: boolean;
  // Lý do khoá ô chọn (dòng của chính mình) — hiện ở tooltip.
  lockReason: string | null;
  saving: boolean;
  error: string | null;
  highlight: boolean;
  onTierChange: (tierId: string | null) => void;
  onOpenProfile: () => void;
}

export function StaffRow({ row, naming, tiers, roleText, canSeeSelect, lockReason, saving, error, highlight, onTierChange, onOpenProfile }: StaffRowProps) {
  const errId = useId();
  const selectLabel = `Bậc lương của ${row.displayName}`;
  let tierCell;
  if (!canSeeSelect) {
    tierCell = <span className={row.tier ? 'st-row__tier' : 'st-row__tier st-row__tier--none'}>{row.tier ? row.tier.name : 'Chưa gán bậc'}</span>;
  } else {
    const select = (
      <Select
        aria-label={selectLabel}
        options={tierOptions(tiers, row.tier)}
        value={row.tier?.id ?? ''}
        disabled={lockReason !== null || saving}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => onTierChange(e.target.value === '' ? null : e.target.value)}
      />
    );
    tierCell = lockReason ? <WithTooltip text={lockReason}>{select}</WithTooltip> : select;
  }
  return (
    <div className={highlight ? 'st-row st-row--new' : 'st-row'} data-membership={row.membershipId}>
      <Avatar name={row.displayName} initials={staffInitials(row)} avatarUrl={row.avatarUrl} colorKey={naming.colorKey(row.membershipId)} />
      <div className="st-row__who">
        <div className="st-row__name">{row.displayName}</div>
        <div className="st-row__sub">
          {roleText}
          {!row.isBookable && (
            <>
              {roleText ? ' · ' : ''}
              <b className="st-warn">tắt nhận lịch</b>
            </>
          )}
        </div>
      </div>
      <div className="st-row__tierbox">{tierCell}</div>
      <Button size="sm" className="st-row__btn" onClick={onOpenProfile} aria-label={`Hồ sơ ${row.displayName}`}>
        Hồ sơ
      </Button>
      {error && (
        <div className="st-row__err" id={errId} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
