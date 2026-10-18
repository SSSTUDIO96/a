import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Textarea } from './Textarea';
import './list.css';

export interface ConfirmDialogProps {
  open: boolean;
  /** Bấm nút huỷ, ✕ hoặc Esc. Không gọi khi đang chờ onConfirm. */
  onClose: () => void;
  /** Câu hỏi, ví dụ "Huỷ phiếu PT-000087?". */
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Câu giải thích hậu quả (13px --muted). */
  message?: ReactNode;
  /** Chữ nút xác nhận, ví dụ "Huỷ phiếu", "Tạm khoá", "Gỡ trang", "Bỏ thay đổi". */
  confirmLabel: string;
  /** Chữ nút lùi, ví dụ "Giữ phiếu", "Ở lại". Mặc định "Huỷ". */
  cancelLabel?: string;
  /**
   * Bấm xác nhận. Nhận lý do đã cắt khoảng trắng (chuỗi rỗng nếu không hỏi lý do).
   * Trả Promise thì nút quay, hộp không đóng được cho tới khi xong; Promise bị từ chối → hiện lỗi trong hộp.
   * Đóng hộp khi thành công là việc của màn (gọi onClose / đặt open=false).
   */
  onConfirm: (reason: string) => void | Promise<unknown>;
  /** Nút xác nhận màu đỏ — cho xoá, khoá, huỷ. */
  danger?: boolean;
  /** Có ô lý do bắt buộc (Textarea). Để trống mà bấm xác nhận → báo lỗi ngay dưới ô. */
  requireReason?: boolean;
  /** Có ô lý do nhưng không bắt buộc (ví dụ "Mở khoá"). */
  askReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Độ dài tối đa lý do (máy chủ thường giới hạn). */
  reasonMaxLength?: number;
  /** Đang chạy (màn tự quản). Promise của onConfirm cũng tự bật trạng thái này. */
  loading?: boolean;
  /** Lỗi từ màn (ví dụ 409). Lỗi do Promise bị từ chối dùng errorMessage để ra chữ. */
  error?: string | null;
  errorMessage?: (err: unknown) => string;
  /** Rộng, mặc định 440 (bản vẽ). Hộp "Tạm khoá" dùng 460. */
  width?: number;
}

function defaultErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Không thực hiện được. Vui lòng thử lại.';
}

/**
 * Hộp xác nhận — bản vẽ C2 mục 0.2. Dùng lại Dialog (rộng 440, Esc đóng, nhốt tiêu điểm).
 * Có ô lý do khi requireReason. Biến thể danger: nút xác nhận đỏ.
 * Tiêu điểm đầu: ô lý do nếu có, không thì nút lùi (an toàn: Enter không vô tình xác nhận).
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  eyebrow,
  message,
  confirmLabel,
  cancelLabel = 'Huỷ',
  onConfirm,
  danger = false,
  requireReason = false,
  askReason = false,
  reasonLabel = 'Lý do',
  reasonPlaceholder,
  reasonMaxLength,
  loading = false,
  error,
  errorMessage = defaultErrorMessage,
  width,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  const reasonId = useId();
  const busy = loading || pending;
  const hasReason = requireReason || askReason;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Mở lại hộp → xoá lý do và lỗi cũ.
  useEffect(() => {
    if (open) {
      setReason('');
      setReasonError(null);
      setFailed(null);
      setPending(false);
    }
  }, [open]);

  async function confirm() {
    if (busy) return;
    const text = reason.trim();
    if (requireReason && text === '') {
      setReasonError(`Nhập ${reasonLabel.toLowerCase()} trước khi ${confirmLabel.toLowerCase()}.`);
      reasonRef.current?.focus();
      return;
    }
    setFailed(null);
    const r = onConfirm(text);
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      setPending(true);
      try {
        await r;
      } catch (err) {
        if (mounted.current) setFailed(errorMessage(err));
      } finally {
        if (mounted.current) setPending(false);
      }
    }
  }

  const shownError = failed ?? error ?? null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      eyebrow={eyebrow}
      size="sm"
      width={width}
      footer={
        <>
          <Button onClick={onClose} disabled={busy} data-autofocus={hasReason ? undefined : true}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => void confirm()} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message !== undefined && <div className="ui-confirm__msg">{message}</div>}
      {hasReason && (
        <div className="ui-confirm__reason">
          <label htmlFor={reasonId}>
            {reasonLabel}
            {requireReason && (
              <span className="ui-req" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <Textarea
            ref={reasonRef}
            id={reasonId}
            value={reason}
            required={requireReason}
            aria-required={requireReason || undefined}
            maxLength={reasonMaxLength}
            placeholder={reasonPlaceholder}
            disabled={busy}
            error={reasonError}
            data-autofocus
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError && e.target.value.trim() !== '') setReasonError(null);
            }}
          />
        </div>
      )}
      {shownError && (
        <div className="ui-field__error ui-confirm__err" role="alert">
          {shownError}
        </div>
      )}
    </Dialog>
  );
}
