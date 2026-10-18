import { useCallback, useEffect, useState } from 'react';
import { getContract } from '../../api/contracts';
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
  /** Tổ chức đào tạo (ACADEMY): chip loại hợp đồng ở hàng đợi; hợp đồng khoá học có dòng phụ "Khoá · Lớp". */
  academy?: boolean;
}

// Dòng phụ của hợp đồng khoá học: tên các dòng khoá học còn hiệu lực ("Makeup chuyên nghiệp · K12") — tên máy chủ chép
// lúc thêm dòng. null = không phải hợp đồng khoá học / chưa tải.
function useCourseSubline(orgId: string, contractId: string | null, enabled: boolean): { id: string; text: string } | null {
  const [v, setV] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (!enabled || !contractId) return undefined;
    const controller = new AbortController();
    getContract(orgId, contractId, controller.signal)
      .then((d) => {
        if (d.kind !== 'COURSE') return setV(null);
        const names = d.lines.filter((l) => l.kind === 'COURSE' && !l.voidedAt).map((l) => l.name);
        setV({ id: d.id, text: names.length > 0 ? names.join(', ') : 'Khoá học' });
      })
      .catch(() => {
        // Không tải được: giữ dòng phụ mặc định, không đoán.
        if (!controller.signal.aborted) setV(null);
      });
    return () => controller.abort();
  }, [orgId, contractId, enabled]);
  return v && v.id === contractId ? v : null;
}

// Màn Thu tiền (bản vẽ C2 mục 3, phương án A): ListDetail 380 | 1fr.
// Máy tính / máy tính bảng ở /thu-tien: mở sẵn hợp đồng đầu danh sách. Điện thoại: /thu-tien là danh sách, /thu-tien/:id là màn con.
export function PaymentsScreen({ orgId, orgSlug, contractId, access, academy = false }: PaymentsScreenProps) {
  const bp = useBreakpoint();
  const [firstId, setFirstId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const onFirst = useCallback((id: string | null) => setFirstId(id), []);
  const onLoaded = useCallback((c: string) => setCode(c), []);
  const listPath = `/${orgSlug}/thu-tien`;

  const shownId = contractId ?? (bp === 'phone' ? null : firstId);
  const course = useCourseSubline(orgId, shownId, academy && access.contractsRead);
  // Tiêu đề = tên mục con điều hướng ("Thu tiền"); điện thoại ở màn con: mã hợp đồng (bản mẫu #a-ct). Chữ phụ nằm
  // trong vùng nội dung của màn, không đè tiêu đề khung.
  const title = bp === 'phone' && contractId && code ? code : 'Thu tiền';

  const list = access.contractsRead ? (
    <ContractQueue orgId={orgId} orgSlug={orgSlug} selectedId={shownId} onFirst={onFirst} academy={academy} />
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
      renderSubline={
        course
          ? (c) => (
              <>
                {' · '}
                <span data-o="khoa-lop">{course.text}</span>
                {c.phone ? ` · ${c.phone}` : ''}
              </>
            )
          : undefined
      }
    />
  ) : (
    <Card className="pm-card">
      <EmptyState message="Chọn một hợp đồng ở danh sách bên trái để thu tiền." />
    </Card>
  );

  return (
    <div className="pm-page">
      <PageHeader title={title} backTo={contractId ? listPath : undefined} actions={<span className="pm-ph-sub">{academy ? 'khoá học + dịch vụ makeup' : 'hợp đồng dịch vụ makeup'}</span>} />
      <ListDetail list={list} detail={detail} mobileView={contractId ? 'detail' : 'list'} listLabel="Hợp đồng cần thu" detailLabel="Thu tiền hợp đồng" />
    </div>
  );
}
