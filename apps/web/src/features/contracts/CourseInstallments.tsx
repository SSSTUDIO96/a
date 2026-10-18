import { useEffect, useRef, useState } from 'react';
import { errorKind, userMessage } from '../../api/errors';
import type { PaymentInstallment } from '../../api/types';
import { Button, Card, EmptyState, SkeletonText } from '../../ui';
import { InstallmentsCard } from '../payments/InstallmentsCard';
import { InstallmentsDialog } from '../payments/InstallmentsDialog';
import { usePaymentProgress } from '../payments/usePaymentProgress';
import '../payments/payments.css';

// Thẻ "Tiến độ thanh toán" trong hợp đồng khoá học — dùng NGUYÊN phần thu tiền (module payments): GET/PUT tiến độ,
// chia gợi ý Cọc + 1/2/3 đợt, máy chủ kiểm tổng các đợt = tổng hợp đồng. Hợp đồng chưa lưu: chưa lập được.
export interface CourseInstallmentsProps {
  orgId: string;
  contractId: string;
  canWrite: boolean;
  // Tổng hợp đồng đổi (lưu nháp, thêm / huỷ dòng) → tải lại để thấy chênh lệch.
  version: string;
  onInstallments: (items: PaymentInstallment[] | null) => void;
}

export function CourseInstallments({ orgId, contractId, canWrite, version, onInstallments }: CourseInstallmentsProps) {
  const progress = usePaymentProgress(orgId, contractId);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { state } = progress;
  const { reload } = progress;

  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    void reload().catch(() => undefined);
  }, [version, reload]);

  const items = state.status === 'ready' ? state.data.installments : null;
  useEffect(() => onInstallments(items), [items, onInstallments]);

  if (state.status === 'loading') {
    return (
      <Card title="Tiến độ thanh toán">
        <SkeletonText lines={3} label="Đang tải tiến độ thanh toán" />
      </Card>
    );
  }
  if (state.status === 'error') {
    return (
      <Card title="Tiến độ thanh toán">
        <EmptyState
          message={errorKind(state.error) === 'forbidden' ? 'Bạn không có quyền xem tiến độ thanh toán.' : userMessage(state.error)}
          action={errorKind(state.error) === 'forbidden' ? undefined : <Button onClick={progress.retry}>Thử lại</Button>}
        />
      </Card>
    );
  }
  return (
    <div className="ct-inst">
      {notice && (
        <div className="ct-okband" role="status">
          <span>{notice}</span>
        </div>
      )}
      <InstallmentsCard data={state.data} canWrite={canWrite} onEdit={() => setOpen(true)} />
      {canWrite && (
        <InstallmentsDialog
          open={open}
          orgId={orgId}
          data={state.data}
          onClose={() => setOpen(false)}
          onSaved={(next) => {
            progress.replace(next);
            setOpen(false);
            setNotice(next.installments.length > 0 ? `Đã lưu tiến độ ${next.installments.length} đợt.` : 'Đã bỏ tiến độ thanh toán.');
          }}
        />
      )}
    </div>
  );
}

export function InstallmentsPlaceholder() {
  return (
    <Card title="Tiến độ thanh toán">
      <p className="ct-fx" style={{ margin: 0 }}>
        Lưu nháp để lập tiến độ thanh toán (chia gợi ý Cọc + 1, 2 hoặc 3 đợt).
      </p>
    </Card>
  );
}
