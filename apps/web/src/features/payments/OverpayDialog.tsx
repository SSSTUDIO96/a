import { useEffect, useId, useState } from 'react';
import type { Vnd } from '@makeup/shared';
import { Button, Dialog, IconWarn, Textarea } from '../../ui';
import { money } from './money';

export interface OverpayInfo {
  overBy: Vnd;
  remaining: Vnd;
}

export interface OverpayDialogProps {
  info: OverpayInfo | null;
  /** Ghi chú đang có trong form — điền sẵn vào ô lý do để không mất. */
  initialNote: string;
  busy: boolean;
  error: string | null;
  onFixAmount: () => void;
  onConfirm: (reason: string) => void;
}

// 409 thu vượt tổng hợp đồng (details.overBy). "Vẫn ghi phiếu" gửi lại kèm allowOverpay: true và ghi chú lý do.
export function OverpayDialog({ info, initialNote, busy, error, onFixAmount, onConfirm }: OverpayDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (info) {
      setReason(initialNote);
      setReasonError(null);
    }
  }, [info, initialNote]);

  function confirm() {
    const text = reason.trim();
    if (text === '') {
      setReasonError('Nhập lý do khách trả thừa trước khi ghi phiếu.');
      return;
    }
    onConfirm(text);
  }

  return (
    <Dialog
      open={info !== null}
      onClose={() => {
        if (!busy) onFixAmount();
      }}
      title="Khách trả thừa?"
      size="sm"
      width={480}
      footer={
        <>
          <Button onClick={onFixAmount} disabled={busy}>
            Sửa lại số tiền
          </Button>
          <Button variant="primary" loading={busy} onClick={confirm}>
            Vẫn ghi phiếu
          </Button>
        </>
      }
    >
      {info && (
        <div className="pm-band pm-band--warn pm-band--dlg" role="status">
          <IconWarn />
          <span>
            Thu vượt tổng hợp đồng {money(info.overBy)} (còn phải thu {money(Math.max(0, info.remaining))}).
          </span>
        </div>
      )}
      <div className="pm-dlg-field">
        <label htmlFor={id}>
          Lý do
          <span className="ui-req" aria-hidden="true">
            *
          </span>
        </label>
        <Textarea
          id={id}
          value={reason}
          required
          maxLength={1000}
          placeholder="Ví dụ: khách chuyển dư, sẽ trừ vào lần sau"
          error={reasonError}
          disabled={busy}
          data-autofocus
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError && e.target.value.trim()) setReasonError(null);
          }}
        />
      </div>
      {error && (
        <div className="ui-field__error pm-dlg-err" role="alert">
          {error}
        </div>
      )}
    </Dialog>
  );
}
