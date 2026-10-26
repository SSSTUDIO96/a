import { useState } from 'react';
import { useNavigate } from 'react-router';
import { errorKind } from '../../api/errors';
import type { Customer } from '../../api/types';
import { useSession } from '../../app/session';
import { Button, Card, EmptyState, IconBack, Skeleton } from '../../ui';
import { LoadErrorStrip } from '../staff/parts';
import { CustomerAppointmentsCard } from './CustomerAppointmentsCard';
import { CustomerCertificatesCard } from './CustomerCertificatesCard';
import { CustomerContractsCard } from './CustomerContractsCard';
import { CustomerEditForm } from './CustomerEditForm';
import { CustomerInfoCard } from './CustomerInfoCard';
import { PortalCard } from './PortalCard';
import type { CustomerPerms } from './logic';
import { CONTRACT_LIMIT, useCustomerHistory } from './useCustomerHistory';

// Cột phải màn Khách hàng (C2 2.2): Thông tin khách · Hợp đồng · Cổng học viên · Giấy chứng nhận · Lịch makeup (khe 16).
export interface CustomerDetailProps {
  orgId: string;
  slug: string;
  timezone: string;
  customerId: string;
  perms: CustomerPerms;
  onSaved: (c: Customer) => void;
}

export function CustomerDetail({ orgId, slug, timezone, customerId, perms, onSaved }: CustomerDetailProps) {
  const navigate = useNavigate();
  const { customer, history, retry, setCustomerData } = useCustomerHistory(orgId, customerId, perms.contractsRead);
  const [editing, setEditing] = useState(false);
  const orgKind = useSession().organizations.find((o) => o.id === orgId)?.kind;

  if (customer.status === 'loading') {
    return (
      <Card>
        <div role="status" aria-label="Đang tải hồ sơ khách" className="kh-skel">
          <Skeleton width="45%" height={20} />
          <Skeleton width="70%" />
          <Skeleton width="60%" />
          <Skeleton width="50%" />
        </div>
      </Card>
    );
  }
  if (customer.status === 'error') {
    if (errorKind(customer.error) === 'not_found') {
      return (
        <Card>
          <EmptyState
            message="Không tìm thấy khách hàng"
            action={
              <Button icon={<IconBack />} onClick={() => navigate(`/${slug}/khach-hang`)}>
                Về danh sách
              </Button>
            }
          />
        </Card>
      );
    }
    return <LoadErrorStrip error={customer.error} retry={retry} />;
  }

  const c = customer.data;
  const contracts = history.contracts;
  const hasContracts = contracts?.status === 'ready' && contracts.data.items.length > 0;
  return (
    <>
      {editing ? (
        <CustomerEditForm
          orgId={orgId}
          c={c}
          canFiles={perms.files}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            setCustomerData(next);
            onSaved(next);
            setEditing(false);
          }}
        />
      ) : (
        <CustomerInfoCard c={c} timezone={timezone} canWrite={perms.write} onEdit={() => setEditing(true)} />
      )}
      {contracts && (
        <CustomerContractsCard
          slug={slug}
          customerId={c.id}
          timezone={timezone}
          contracts={contracts}
          details={history.details}
          canCreate={perms.contractsWrite}
          onRetry={retry}
        />
      )}
      {/* Thẻ Cổng học viên: sau thẻ Hợp đồng; tự ẩn khi không phải ACADEMY hoặc thiếu portal.manage (bản vẽ E 5.2). */}
      {!editing && perms.portalManage && <PortalCard orgId={orgId} customerId={c.id} orgKind={orgKind} timezone={timezone} />}
      {/* Thẻ Giấy chứng nhận (bản vẽ F 6.6): sau thẻ Cổng học viên để Cổng giữ nguyên chỗ ngay sau Hợp đồng. Tự ẩn khi không phải ACADEMY,
          thiếu certificates.read hoặc học viên chưa có giấy nào. */}
      {!editing && perms.certRead && <CustomerCertificatesCard key={c.id} orgId={orgId} slug={slug} customerId={c.id} orgKind={orgKind} />}
      {hasContracts && history.details && !editing && (
        <CustomerAppointmentsCard
          slug={slug}
          timezone={timezone}
          details={history.details}
          truncated={contracts.data.total > CONTRACT_LIMIT}
          onRetry={retry}
        />
      )}
    </>
  );
}
