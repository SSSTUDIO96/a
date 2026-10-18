import type { ReactNode } from 'react';
import type { RoleView } from '../../api/org';
import type { StaffMember, StaffTier } from '../../api/types';
import { Button, Card, EmptyState, Skeleton } from '../../ui';
import { roleNames, tierLockReason, type StaffPerms } from './logic';
import { Strip } from './parts';
import { StaffRow } from './StaffRow';

// Cột phải màn "Thợ & bậc lương" — thẻ danh sách thợ của nhóm đang chọn (C2 1.2).
export interface UndoNotice {
  membershipId: string;
  text: string;
  undo: () => void;
}

export interface StaffListProps {
  title: string;
  rows: StaffMember[] | null;
  tiers: StaffTier[];
  roles: RoleView[] | null;
  perms: StaffPerms;
  me: { membershipId: string; roleKeys: readonly string[] };
  search?: ReactNode;
  // Đang tìm mà không có ai khớp.
  query: string;
  savingId: string | null;
  rowErrors: Record<string, string>;
  highlightId: string | null;
  notice: UndoNotice | null;
  // Dải thông báo khác (ví dụ "Đã thêm …").
  info?: ReactNode;
  onTierChange: (row: StaffMember, tierId: string | null) => void;
  onOpenProfile: (row: StaffMember) => void;
}

export function StaffList(p: StaffListProps) {
  const count = p.rows?.length ?? 0;
  return (
    <Card
      className="st-list"
      flush
      title={p.title}
      actions={
        <span className="st-list__head">
          {p.rows && <span className="st-list__count">{`${count} người đang làm`}</span>}
          {p.search}
        </span>
      }
    >
      {p.notice && (
        <Strip
          tone="grey"
          action={
            <Button size="sm" variant="ghost" onClick={p.notice.undo}>
              Hoàn tác
            </Button>
          }
        >
          {p.notice.text}
        </Strip>
      )}
      {p.info}
      {!p.rows ? (
        <div role="status" aria-label="Đang tải danh sách thợ">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="st-row" aria-hidden="true">
              <Skeleton circle width={32} height={32} />
              <div className="st-row__who">
                <Skeleton width="55%" height={14} />
                <Skeleton width="30%" height={11} style={{ marginTop: 6 }} />
              </div>
              <Skeleton height={30} className="st-row__tierbox" />
              <Skeleton width={60} height={30} />
            </div>
          ))}
        </div>
      ) : p.rows.length === 0 ? (
        <EmptyState message={p.query ? `Không có thợ nào khớp "${p.query}".` : 'Chưa có thợ nào ở nhóm này.'} />
      ) : (
        p.rows.map((row) => (
          <StaffRow
            key={row.membershipId}
            row={row}
            tiers={p.tiers}
            roleText={roleNames(row.roleKeys, p.roles)}
            canSeeSelect={p.perms.changeTier}
            lockReason={p.perms.changeTier ? tierLockReason(p.perms, row, p.me) : null}
            saving={p.savingId === row.membershipId}
            error={p.rowErrors[row.membershipId] ?? null}
            highlight={p.highlightId === row.membershipId}
            onTierChange={(tierId) => p.onTierChange(row, tierId)}
            onOpenProfile={() => p.onOpenProfile(row)}
          />
        ))
      )}
    </Card>
  );
}
