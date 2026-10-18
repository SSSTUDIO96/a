import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Customer } from '../../api/types';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { usePermissions } from '../../layout/usePermissions';
import { Button, IconPlus, ListDetail } from '../../ui';
import { useOrgInfo } from '../staff/useOrgInfo';
import { CustomerDetail } from './CustomerDetail';
import { CustomerList } from './CustomerList';
import { customerPerms } from './logic';
import { NewCustomerDialog } from './NewCustomerDialog';
import { useCustomerList } from './useCustomerHistory';
import '../staff/staff.css';
import './customers.css';

// Màn Khách hàng (C2 mục 2, phương án C): danh sách trái, hồ sơ phải.
// /khach-hang: danh sách + hồ sơ khách đầu danh sách (máy tính, máy tính bảng); điện thoại chỉ danh sách.
// /khach-hang/:customerId: hồ sơ một khách (điện thoại: màn con có ‹).
export function CustomersPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const org = useOrgInfo();
  const has = usePermissions();
  const perms = useMemo(() => customerPerms(has), [has]);
  const phone = useBreakpoint() === 'phone';
  const [q, setQ] = useState('');
  const list = useCustomerList(org.orgId, q);
  const [adding, setAdding] = useState<{ open: boolean; prefill: string }>({ open: false, prefill: '' });

  const isChild = customerId !== undefined;
  const selectedId = customerId ?? (phone ? null : (list.state.items[0]?.id ?? null));

  function onCreated(c: Customer) {
    setAdding({ open: false, prefill: '' });
    list.prepend(c);
    navigate(`/${org.slug}/khach-hang/${c.id}`);
  }

  const addBtn = perms.write ? (
    <Button variant="primary" icon={<IconPlus />} onClick={() => setAdding({ open: true, prefill: '' })}>
      Khách mới
    </Button>
  ) : undefined;
  const phoneAdd =
    perms.write && !isChild ? <Button variant="primary" size="sm" icon={<IconPlus />} aria-label="Khách mới" onClick={() => setAdding({ open: true, prefill: '' })} /> : undefined;

  return (
    <>
      <PageHeader title="Khách hàng" backTo={phone && isChild ? `/${org.slug}/khach-hang` : undefined} actions={addBtn} phoneAction={phoneAdd} />
      <ListDetail
        mobileView={isChild ? 'detail' : 'list'}
        listLabel="Danh sách khách"
        detailLabel="Hồ sơ khách"
        list={
          <CustomerList
            slug={org.slug}
            q={q}
            onQ={setQ}
            state={list.state}
            selectedId={phone ? null : selectedId}
            canWrite={perms.write}
            onRetry={list.retry}
            onMore={list.loadMore}
            onAdd={(prefill) => setAdding({ open: true, prefill })}
          />
        }
        detail={
          selectedId ? (
            <CustomerDetail
              key={selectedId}
              orgId={org.orgId}
              slug={org.slug}
              timezone={org.timezone}
              customerId={selectedId}
              perms={perms}
              onSaved={list.replace}
            />
          ) : null
        }
      />
      <NewCustomerDialog orgId={org.orgId} open={adding.open} phone={phone} prefill={adding.prefill} onClose={() => setAdding({ open: false, prefill: '' })} onCreated={onCreated} />
    </>
  );
}
