import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { Segmented } from '../../ui';
import { PRICING_GROUPS, type GroupKey } from './logic';

// Đầu trang Bảng giá: tiêu đề nhóm (máy tính, máy tính bảng — thanh trái có 4 mục con);
// điện thoại: thanh trên ghi "Bảng giá" và nhóm nút chuyển 4 ô Gói · Dịch vụ phụ · Di chuyển · Nhân vật.
export function PricingHeader({ group, actions, phoneAction }: { group: GroupKey; actions?: ReactNode; phoneAction?: ReactNode }) {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const phone = useBreakpoint() === 'phone';
  const label = PRICING_GROUPS.find((g) => g.key === group)?.label ?? 'Bảng giá';
  return (
    <>
      <PageHeader title={phone ? 'Bảng giá' : label} actions={actions} phoneAction={phoneAction} />
      {phone && (
        <Segmented
          className="pr-tabs"
          block
          aria-label="Nhóm bảng giá"
          options={PRICING_GROUPS.map((g) => ({ value: g.key, label: g.short }))}
          value={group}
          onChange={(k) => void navigate(`/${orgSlug ?? ''}/bang-gia/${k}`)}
        />
      )}
    </>
  );
}
