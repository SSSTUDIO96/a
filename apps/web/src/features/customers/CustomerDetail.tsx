import { useState } from 'react';
import { useNavigate } from 'react-router';
import { errorKind } from '../../api/errors';
import type { Customer } from '../../api/types';
import { Button, Card, EmptyState, IconBack, Skeleton } from '../../ui';
import { LoadErrorStrip } from '../staff/parts';
import { CustomerAppointmentsCard } from './CustomerAppointmentsCard';
import { CustomerContractsCard } from './CustomerContractsCard';
import { CustomerEditForm } from './CustomerEditForm';
import { CustomerInfoCard } from './CustomerInfoCard';
import type { CustomerPerms } from './logic';
import { CONTRACT_LIMIT, useCustomerHistory } from './useCustomerHistory';

// Cột phải màn Khách hàng (C2 2.2): Thông tin khách · Hợp đồng · Lịch makeup (khe 16).
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
