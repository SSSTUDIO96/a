import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from './Button';
import { cx } from './cx';
import { IconUpload } from './icons';
import './list.css';

export interface ImageUploadContext {
  /** Huỷ khi component bị gỡ khỏi trang giữa chừng. */
  signal: AbortSignal;
  /** Báo tiến độ 0..1 nếu hàm tải lên biết (không bắt buộc; không báo thì chỉ có vòng xoay). */
  onProgress: (fraction: number) => void;
}

export interface ImageUploadProps {
  /** URL ảnh đang có (signedUrl / avatarUrl). null = chưa có ảnh. */
  value: string | null | undefined;
  /**
   * Hàm tải lên do màn truyền vào (ví dụ gọi uploadFile của src/api/files.ts rồi PATCH fileId).
   * Component KHÔNG tự gọi API. Promise bị từ chối → hiện lỗi dưới ô (errorMessage đổi lỗi ra chữ).
   */
  onUpload: (file: File, ctx: ImageUploadContext) => Promise<unknown>;
  /** Có thì hiện nút "Bỏ ảnh" khi đang có ảnh. Trả Promise thì nút quay trong lúc chờ. */
  onRemove?: () => void | Promise<unknown>;
  /** square 96 · round 96 (ảnh đại diện) · wide: ngang, kéo hết chỗ còn lại (ảnh bìa). */
  shape?: 'square' | 'round' | 'wide';
  /** Cạnh ô (square/round) hoặc chiều cao (wide), px. Mặc định 96. */
  size?: number;
  /** stack: nhãn trên, ô, nút dưới (Hồ sơ thương hiệu) · inline: ô bên trái, chữ + nút bên phải (Hồ sơ thợ). */
  layout?: 'stack' | 'inline';
  /** Nhãn nhỏ trên ô (stack), ví dụ "Logo". Cũng là tên ô cho trình đọc màn hình. */
  label?: string;
  /** inline: nội dung bên phải phía trên nút (tên, "Tên tài khoản: …"). */
  children?: ReactNode;
  /** Ô trống hiện gì: mặc định biểu tượng tải lên; ảnh đại diện có thể truyền Avatar chữ viết tắt. */
  emptyContent?: ReactNode;
  /** Loại tệp nhận (kiểm sớm phía máy khách; máy chủ vẫn là chốt). Mặc định JPEG, PNG, WebP. */
  accept?: readonly string[];
  /** Dung lượng tối đa (byte), kiểm sớm. Mặc định 5 MB (ảnh đại diện); logo 2 MB; album 15 MB. */
  maxBytes?: number;
  disabled?: boolean;
  /** Lỗi do màn đặt (ví dụ 400 từ máy chủ đã bắt ở ngoài). */
  error?: string | null;
  /** Đổi lỗi của onUpload/onRemove ra chữ tiếng Việt (ví dụ userMessage của src/api/errors.ts). */
  errorMessage?: (err: unknown) => string;
  /** Dòng gợi ý 12px dưới ô (ẩn khi có lỗi). */
  hint?: ReactNode;
  uploadLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
  className?: string;
  /** Chỉ cho trang xem thử: ép trạng thái tĩnh. */
  demo?: { busy?: boolean; progress?: number; focus?: boolean; hover?: boolean };
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MB = 1024 * 1024;
const TYPE_NAMES: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'application/pdf': 'PDF',
};

function joinVi(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} hoặc ${parts[parts.length - 1]}`;
}

function formatMb(bytes: number): string {
  const mb = bytes / MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1).replace('.', ',')} MB`;
}

/** Kiểm sớm loại và dung lượng. Trả chữ lỗi tiếng Việt, hoặc null nếu hợp lệ. */
export function checkImageFile(file: File, accept: readonly string[] = IMAGE_TYPES, maxBytes = 5 * MB): string | null {
  if (!accept.includes(file.type)) {
    return `Chỉ nhận ảnh ${joinVi(accept.map((t) => TYPE_NAMES[t] ?? t))}.`;
  }
  if (file.size > maxBytes) {
    return `Ảnh ${formatMb(file.size)} — vượt quá ${formatMb(maxBytes)}. Chọn ảnh nhỏ hơn.`;
  }
  return null;
}

function defaultErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Tải ảnh không được. Vui lòng thử lại.';
}

function canPreview(): boolean {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
}

/**
 * Ô ảnh tải lên — bản vẽ C2 mục 0.2. Chỉ là giao diện: chọn tệp, xem trước, tiến độ, lỗi, bỏ ảnh.
 * Đang tải: vòng xoay trên ảnh, các nút khoá. Lỗi (sai loại / quá dung lượng / máy chủ 400) hiện dưới ô.
 */
export function ImageUpload({
  value,
  onUpload,
  onRemove,
  shape = 'square',
  size = 96,
  layout = 'stack',
  label,
  children,
  emptyContent,
  accept = IMAGE_TYPES,
  maxBytes = 5 * MB,
  disabled = false,
  error,
  errorMessage = defaultErrorMessage,
  hint,
  uploadLabel = 'Tải ảnh',
  changeLabel = 'Đổi ảnh',
  removeLabel = 'Bỏ ảnh',
  className,
  demo,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const valueRef = useRef(value);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const id = useId();
  const errorId = `${id}-loi`;
  const hintId = `${id}-goi-y`;

  // Ảnh mới từ màn (value đổi) thay cho ảnh xem trước.
  useEffect(() => {
    valueRef.current = value;
    if (!busy) setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Thu hồi URL xem trước khi thay hoặc gỡ.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Gỡ khỏi trang giữa chừng → huỷ lần tải.
  useEffect(() => () => abortRef.current?.abort(), []);

  const isBusy = busy || Boolean(demo?.busy);
  const shownProgress = demo?.progress ?? progress;
  const shownUrl = preview ?? value ?? null;
  const shownError = localError ?? error ?? null;
  const locked = disabled || isBusy || removing;
  const name = label ?? 'Ảnh';

  async function handleFile(file: File) {
    const problem = checkImageFile(file, accept, maxBytes);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    const startValue = valueRef.current;
    const url = canPreview() ? URL.createObjectURL(file) : null;
    setPreview(url);
    setProgress(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await onUpload(file, {
        signal: ctrl.signal,
        onProgress: (f) => setProgress(Math.max(0, Math.min(1, f))),
      });
      if (ctrl.signal.aborted) return;
      // Màn đã đổi value trong lúc chờ → bỏ ảnh xem trước; chưa đổi thì giữ đến khi value mới tới.
      if (valueRef.current !== startValue) setPreview(null);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setPreview(null);
      setLocalError(errorMessage(err));
    } finally {
      if (!ctrl.signal.aborted) {
        setBusy(false);
        setProgress(null);
      }
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setLocalError(null);
    const r = onRemove();
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      setRemoving(true);
      try {
        await r;
      } catch (err) {
        setLocalError(errorMessage(err));
      } finally {
        setRemoving(false);
      }
    }
  }

  function pick() {
    if (locked) return;
    inputRef.current?.click();
  }

  const describedBy = shownError ? errorId : hint ? hintId : undefined;
  const boxStyle = (shape === 'wide' ? { height: size } : { '--img-size': `${size}px` }) as CSSProperties;
  const boxCls = cx(
    'ui-img__box',
    shape === 'round' && 'ui-img__box--round',
    shape === 'wide' && 'ui-img__box--wide',
    !shownUrl && 'ui-img__box--empty',
    shownError && 'ui-img__box--error',
  );

  const busyLayer = isBusy && (
    <span className="ui-img__busy" role="status">
      <span className="ui-spinner" aria-hidden="true" />
      {shownProgress !== null && shownProgress !== undefined ? (
        <span>{Math.round(shownProgress * 100)}%</span>
      ) : null}
      <span className="sr-only">Đang tải ảnh lên</span>
    </span>
  );

  const box = shownUrl ? (
    <span className={boxCls} style={boxStyle} aria-busy={isBusy || undefined}>
      <img src={shownUrl} alt={name} />
      {busyLayer}
    </span>
  ) : (
    <button
      type="button"
      className={boxCls}
      style={boxStyle}
      onClick={pick}
      disabled={locked}
      aria-label={`${uploadLabel}: ${name}`}
      aria-describedby={describedBy}
      aria-busy={isBusy || undefined}
      data-demo={demo?.focus ? 'focus' : demo?.hover ? 'hover' : undefined}
    >
      {busyLayer || (emptyContent ?? <IconUpload />)}
    </button>
  );

  const actions = (
    <span className="ui-img__actions">
      <Button
        size="sm"
        icon={layout === 'inline' ? <IconUpload /> : undefined}
        onClick={pick}
        disabled={locked}
        aria-describedby={describedBy}
        aria-label={label ? `${shownUrl ? changeLabel : uploadLabel} — ${label}` : undefined}
      >
        {shownUrl ? changeLabel : uploadLabel}
      </Button>
      {onRemove && shownUrl && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRemove}
          disabled={disabled || isBusy}
          loading={removing}
          aria-label={label ? `${removeLabel} — ${label}` : undefined}
        >
          {removeLabel}
        </Button>
      )}
    </span>
  );

  const messages = shownError ? (
    <span id={errorId} className="ui-img__error" role="alert">
      {shownError}
    </span>
  ) : hint ? (
    <span id={hintId} className="ui-img__hint">
      {hint}
    </span>
  ) : null;

  const input = (
    <input
      ref={inputRef}
      type="file"
      className="ui-img__input"
      accept={accept.join(',')}
      tabIndex={-1}
      aria-hidden="true"
      disabled={locked}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // chọn lại đúng tệp cũ vẫn chạy
        if (file) void handleFile(file);
      }}
    />
  );

  if (layout === 'inline') {
    return (
      <div className={cx('ui-img', 'ui-img--inline', className)} role="group" aria-label={name}>
        {box}
        <span className="ui-img__side">
          {children}
          {actions}
          {messages}
        </span>
        {input}
      </div>
    );
  }

  return (
    <div className={cx('ui-img', className)} role="group" aria-label={name}>
      {label && (
        <span className="ui-img__label" aria-hidden="true">
          {label}
        </span>
      )}
      {box}
      {actions}
      {messages}
      {input}
    </div>
  );
}
