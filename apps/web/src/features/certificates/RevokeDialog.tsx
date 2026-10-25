import { revokeCertificate, type CertificateView } from '../../api/certificates';
import { ApiError, userMessage } from '../../api/errors';
import { ConfirmDialog } from '../../ui';

// Hộp "Thu hồi" (bản vẽ F mục 6.5, 4.7): hộp xác nhận loại nguy hiểm, lý do bắt buộc (≤ 500). Câu hậu quả ngắn (≤ 90 ký tự):
// số không dùng lại, giấy đã in hết giá trị. Thu hồi lần hai (đã có người thu hồi trước) → máy chủ 409, hiện lời đó và báo màn tải lại.

export const REVOKE_REASON_MAX = 500;
export const REVOKE_MESSAGE_MAX = 90;

// "Số CC-2026-0011 không dùng lại. Giấy đã in coi như hết giá trị." — không quá 90 ký tự với mọi số hợp lệ.
export function revokeConsequence(code: string): string {
  const text = `Số ${code} không dùng lại. Giấy đã in coi như hết giá trị.`;
  if (text.length > REVOKE_MESSAGE_MAX) throw new Error(`Câu hậu quả thu hồi dài ${text.length} ký tự (tối đa ${REVOKE_MESSAGE_MAX})`);
  return text;
}

export interface RevokeDialogProps {
  orgId: string;
  // null = đóng hộp.
  target: CertificateView | null;
  onClose: () => void;
  // Thu hồi xong (máy chủ trả bản đã thu hồi).
  onRevoked: (view: CertificateView) => void;
  // Máy chủ báo bản đã thu hồi từ trước (409): màn tải lại danh sách.
  onStale: () => void;
}

export function RevokeDialog({ orgId, target, onClose, onRevoked, onStale }: RevokeDialogProps) {
  const t = target;
  return (
    <ConfirmDialog
      open={t !== null}
      onClose={onClose}
      danger
      title={t ? `Thu hồi ${t.code}?` : 'Thu hồi giấy chứng nhận?'}
      eyebrow={t ? `${t.studentName} · ${t.courseName} · ${t.className}` : undefined}
      message={t ? revokeConsequence(t.code) : undefined}
      confirmLabel="Thu hồi"
      cancelLabel="Giữ lại"
      requireReason
      reasonLabel="Lý do thu hồi"
      reasonPlaceholder="Ví dụ: cấp nhầm học viên"
      reasonMaxLength={REVOKE_REASON_MAX}
      errorMessage={userMessage}
      onConfirm={async (reason) => {
        if (!t) return;
        try {
          const view = await revokeCertificate(orgId, t.id, { reason });
          onRevoked(view);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) onStale();
          throw err;
        }
      }}
    />
  );
}
