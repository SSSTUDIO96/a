import { useEffect, useState } from 'react';
import { userMessage } from '../../api/errors';
import { Dialog, Textarea } from '../../ui';

// Hộp hỏi lý do bắt buộc: huỷ dòng (POST /contracts/:id/lines/:lineId/void) hoặc huỷ hợp đồng ({to: 'CANCELLED', reason}).
export interface VoidLineDialogProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  confirmLabel: string;
  onClose: () => void;
  // Trả lời lỗi (chuỗi) để giữ hộp mở; null khi xong.
  onConfirm: (reason: string) => Promise<string | null>;
}

export function VoidLineDialog({ open, title, eyebrow, confirmLabel, onClose, onConfirm }: VoidLineDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    if (reason.trim() === '') {
      setError('Nhập lý do.');
      return;
    }
    setBusy(true);
    try {
      const err = await onConfirm(reason.trim());
      if (err) setError(err);
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      size="sm"
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      primaryLabel={confirmLabel}
      primaryLoading={busy}
      onPrimary={() => void submit()}
    >
      <label htmlFor="ly-do-huy" style={{ display: 'block', fontWeight: 500, padding: '8px 0 6px' }}>
        Lý do<span className="ct-req" aria-label="bắt buộc">*</span>
      </label>
      <Textarea id="ly-do-huy" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={error} />
    </Dialog>
  );
}
