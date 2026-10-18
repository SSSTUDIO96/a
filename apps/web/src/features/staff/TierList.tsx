import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { StaffMember, StaffTier } from '../../api/types';
import { Button, Card, IconPlus, ListRow, ListRowSkeleton } from '../../ui';
import { ALL_GROUP, sortTiers, UNASSIGNED_GROUP } from './logic';

// Cột trái màn "Thợ & bậc lương" — thẻ "Bậc lương" (C2 1.2).
export interface TierListProps {
  slug: string;
  tiers: StaffTier[] | null;
  staff: StaffMember[] | null;
  // Nhóm đang chọn (máy tính); null = không tô dòng nào (điện thoại).
  selected: string | null;
  // Điện thoại: "Tất cả thợ" cũng là màn con (/nhan-su/bac/tat-ca); máy tính: /nhan-su.
  phone: boolean;
  canWrite: boolean;
  onEditTiers: () => void;
  onAddTier: () => void;
  // Ô tìm (điện thoại tìm ở đây).
  search?: ReactNode;
}

export function TierList({ slug, tiers, staff, selected, phone, canWrite, onEditTiers, onAddTier, search }: TierListProps) {
  const href = (group: string) => (group === ALL_GROUP && !phone ? `/${slug}/nhan-su` : `/${slug}/nhan-su/bac/${group}`);
  const unassigned = staff ? staff.filter((s) => s.tier === null).length : 0;
  return (
    <Card
      title="Bậc lương"
      className="st-tiers"
      flush
      actions={
        canWrite ? (
          <Button variant="ghost" size="sm" onClick={onEditTiers}>
            Sửa
          </Button>
        ) : undefined
      }
      footer={
        canWrite ? (
          <Button variant="dashed" block icon={<IconPlus />} onClick={onAddTier}>
            Thêm bậc lương
          </Button>
        ) : undefined
      }
    >
      {search}
      {!tiers || !staff ? (
        <ListRowSkeleton rows={6} label="Đang tải bậc lương" />
      ) : (
        <nav aria-label="Nhóm thợ theo bậc lương">
          <ListRow as={Link} linkProps={{ to: href(ALL_GROUP) }} title="Tất cả thợ" trailing={staff.length} selected={selected === ALL_GROUP} />
          {sortTiers(tiers).map((t) => (
            <ListRow
              key={t.id}
              as={Link}
              linkProps={{ to: href(t.id) }}
              title={t.isActive ? t.name : `${t.name} · đang ẩn`}
              tone={t.isActive ? 'default' : 'faint'}
              trailing={t.staffCount}
              selected={selected === t.id}
            />
          ))}
          {unassigned > 0 && (
            <ListRow
              as={Link}
              linkProps={{ to: href(UNASSIGNED_GROUP) }}
              title="Chưa gán bậc"
              tone="warn"
              trailing={unassigned}
              selected={selected === UNASSIGNED_GROUP}
            />
          )}
        </nav>
      )}
    </Card>
  );
}
