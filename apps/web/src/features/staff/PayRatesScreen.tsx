import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { Button, Card, EmptyState, IconBack, ListDetail, ListRowSkeleton } from '../../ui';
import type { OwnerKind, PayOwner, StaffPerms } from './logic';
import { PayRateOwnerList } from './PayRateOwnerList';
import { PayRateSheet } from './PayRateSheet';
import { StaffSegmented } from './StaffSegmented';
import { usePayOwners } from './usePayRates';
import type { OrgInfo } from './useOrgInfo';

// Màn "Tiền công theo gói" (C2 1.3): ListDetail thường — trái: gói / dịch vụ phụ; phải: thẻ tiền công theo bậc.
// Đường: /nhan-su/tien-cong · /nhan-su/tien-cong/:loai/:id (loai = goi | dich-vu).
export function PayRatesScreen({ org, perms }: { org: OrgInfo; perms: StaffPerms }) {
  const { loai, id } = useParams();
  const navigate = useNavigate();
  const phone = useBreakpoint() === 'phone';
  const owners = usePayOwners(org.orgId, perms.catalogRead);
  const [q, setQ] = useState('');

  const all: PayOwner[] = owners.state.status === 'ready' ? owners.state.data.flatMap((g) => g.owners) : [];
  const kind: OwnerKind | null = loai === 'goi' || loai === 'dich-vu' ? loai : null;
  const isChild = loai !== undefined;
  // Máy tính, máy tính bảng: mở màn lần đầu chọn sẵn gói đầu tiên (không đổi đường).
  const selected: PayOwner | null = isChild ? (all.find((o) => o.kind === kind && o.id === id) ?? null) : phone ? null : (all[0] ?? null);

  let detail;
  if (isChild && (kind === null || (owners.state.status === 'ready' && !selected))) {
    detail = (
      <Card>
        <EmptyState
          message="Không tìm thấy gói hay dịch vụ phụ này — có thể đã ngừng bán hoặc bị xoá."
          action={
            <Button icon={<IconBack />} onClick={() => navigate(`/${org.slug}/nhan-su/tien-cong`)}>
              Về danh sách
            </Button>
          }
        />
      </Card>
    );
  } else if (selected) {
    detail = (
      <PayRateSheet
        key={`${selected.kind}-${selected.id}`}
        orgId={org.orgId}
        slug={org.slug}
        timezone={org.timezone}
        owner={selected}
        canWrite={perms.payrollWrite}
        canAddTier={perms.write}
      />
    );
  } else if (owners.state.status === 'loading' && perms.catalogRead && (isChild || !phone)) {
    detail = (
      <Card>
        <ListRowSkeleton rows={3} avatar amount label="Đang tải tiền công" />
      </Card>
    );
  } else detail = null;

  return (
    <>
      <PageHeader
        title={phone && isChild ? (selected?.name ?? 'Tiền công theo gói') : 'Tiền công theo gói'}
        backTo={phone && isChild ? `/${org.slug}/nhan-su/tien-cong` : undefined}
      />
      {phone && !isChild && <StaffSegmented slug={org.slug} active="tien" payrollRead={perms.payrollRead} />}
      <ListDetail
        mobileView={isChild ? 'detail' : 'list'}
        listLabel="Gói và dịch vụ phụ"
        detailLabel="Tiền công theo bậc"
        list={
          <PayRateOwnerList
            slug={org.slug}
            state={perms.catalogRead ? owners.state : null}
            catalogRead={perms.catalogRead}
            q={q}
            onQ={setQ}
            selected={phone ? null : selected}
            retry={owners.reload}
          />
        }
        detail={detail}
      />
    </>
  );
}
