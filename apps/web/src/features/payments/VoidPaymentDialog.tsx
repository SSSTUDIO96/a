import { voidPayment } from '../../api/payments';
import { userMessage } from '../../api/errors';
import type { Payment, PaymentResult } from '../../api/types';
import { ConfirmDialog } from '../../ui';

export interface VoidPaymentDialogProps {
  orgId: string;
  payment: Payment | null;
  onClose: () => void;
  onDone: (result: PaymentResult) => void;
}

// Huỷ phiếu (POST /payments/:id/void): không xoá, bắt buộc lý do, chỉ một lần. Lỗi 409 hiện đúng chữ máy chủ trong hộp.
export function VoidPaymentDialog({ orgId, payment, onClose, onDone }: VoidPaymentDialogProps) {
  return (
    <ConfirmDialog
      open={payment !== null}
      onClose={onClose}
      title={`Huỷ phiếu ${payment?.code ?? ''}?`}
      message="Phiếu không bị xoá: vẫn hiện trong sổ thu, gạch ngang, kèm lý do. Chỉ huỷ được một lần."
      requireReason
      reasonLabel="Lý do huỷ"
      reasonPlaceholder="Ví dụ: ghi nhầm hợp đồng"
      reasonMaxLength={1000}
      confirmLabel="Huỷ phiếu"
      cancelLabel="Giữ phiếu"
      danger
      errorMessage={userMessage}
      onConfirm={async (reason) => {
        if (!payment) return;
        const result = await voidPayment(orgId, payment.id, { reason });
        onDone(result);
      }}
    />
  );
}
