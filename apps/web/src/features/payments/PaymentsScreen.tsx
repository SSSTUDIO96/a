import { useCallback, useMemo, useState } from 'react';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { PageHeader } from '../../layout/PageHeader';
import { Card, EmptyState, ListDetail } from '../../ui';
import { ContractQueue } from './ContractQueue';
import { PaymentPanel, type PaymentAccess } from './PaymentPanel';
import './payments.css';

export interface PaymentsScreenProps {
  orgId: string;
  orgSlug: string;
  /** Hợp đồng trên đường /thu-tien/:contractId; null = /thu-tien. */
  contractId: string | null;
  access: PaymentAccess & { contractsRead: boolean };
}

// Màn Thu tiền (bản vẽ C2 mục 3, phương án A): ListDetail 380 | 1fr.
// Máy tính / máy tính bảng ở /thu-tien: mở sẵn hợp đồng đầu danh sách. Điện thoại: /thu-tien là danh sách, /thu-tien/:id là màn con.
export function PaymentsScreen({ orgId, orgSlug, contractId, access }: PaymentsScreenProps) {
  const bp = useBreakpoint();
  const [firstId, setFirstId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const onFirst = useCallback((id: string | null) => setFirstId(id), []);
  const onLoaded = useCallback((c: string) => setCode(c), []);
  const listPath = `/${orgSlug}/thu-tien`;

  const shownId = contractId ?? (bp === 'phone' ? null : firstId);
  const title = useMemo(
    () =>
      bp === 'phone' ? (
        contractId && code ? code : 'Thu tiền'
      ) : (
        <>
          Thu tiền <span className="pm-ph-sub">hợp đồng dịch vụ makeup</span>
        </>
      ),
    [bp, contractId, code],
  );

  const list = access.contractsRead ? (
    <ContractQueue orgId={orgId} orgSlug={orgSlug} selectedId={shownId} onFirst={onFirst} />
  ) : (
    <Card title="Hợp đồng cần thu" className="pm-queue">
      <EmptyState message="Bạn không có quyền xem danh sách hợp đồng" />
    </Card>
  );

  const detail = shownId ? (
    <PaymentPanel
      key={shownId}
      orgId={orgId}
      orgSlug={orgSlug}
      contractId={shownId}
      access={access}
      backTo={listPath}
      onLoaded={onLoaded}
    />
  ) : (
    <Card className="pm-card">
      <EmptyState message="Chọn một hợp đồng ở danh sách bên trái để thu tiền." />
    </Card>
  );

  return (
    <div className="pm-page">
      <PageHeader title={title} backTo={contractId ? listPath : undefined} />
      <ListDetail list={list} detail={detail} mobileView={contractId ? 'detail' : 'list'} listLabel="Hợp đồng cần thu" detailLabel="Thu tiền hợp đồng" />
    </div>
  );
}
