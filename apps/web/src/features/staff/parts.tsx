import type { ReactNode } from 'react';
import { errorKind, userMessage } from '../../api/errors';
import { BottomSheet, Button, Dialog, IconLock, IconWarn, TextInput } from '../../ui';

// Khối nhỏ dùng riêng trong màn Thợ makeup (và màn Khách hàng nhập lại ô tìm).
// IconSearch / IconGrip chưa có trong src/ui → dựng tạm ở đây (phiếu vướng gửi W2).

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function IconGrip() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico st-grip-ico">
      <circle cx="9" cy="6" r="1.3" />
      <circle cx="15" cy="6" r="1.3" />
      <circle cx="9" cy="12" r="1.3" />
      <circle cx="15" cy="12" r="1.3" />
      <circle cx="9" cy="18" r="1.3" />
      <circle cx="15" cy="18" r="1.3" />
    </svg>
  );
}

// Ô tìm có kính lúp bên trái.
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  size = 'md',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  size?: 'md' | 'sm';
  className?: string;
}) {
  return (
    <div className={className ? `st-search ${className}` : 'st-search'}>
      <IconSearch />
      <TextInput type="text" enterKeyHint="search" size={size} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

// Dải trong thẻ: đỏ (lỗi) hoặc xám (khoá / gợi ý). Một dòng chữ + tuỳ chọn nút.
export function Strip({ tone, icon, children, action }: { tone: 'danger' | 'grey'; icon?: 'warn' | 'lock'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`st-strip st-strip--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon === 'lock' ? <IconLock /> : icon === 'warn' ? <IconWarn /> : null}
      <span className="st-strip__text">{children}</span>
      {action}
    </div>
  );
}

// Lỗi tải: mạng / 5xx → dải đỏ + "Thử lại" (C2 1.5); 403 → dải đỏ lời máy chủ.
export function LoadErrorStrip({ error, retry }: { error: unknown; retry: () => void }) {
  const kind = errorKind(error);
  return (
    <Strip
      tone="danger"
      icon={kind === 'forbidden' ? 'lock' : 'warn'}
      action={
        kind === 'forbidden' ? undefined : (
          <Button size="sm" onClick={retry}>
            Thử lại
          </Button>
        )
      }
    >
      {userMessage(error)}
    </Strip>
  );
}

// Hộp thoại theo khổ màn: máy tính / máy tính bảng = Dialog rộng `width`; điện thoại = BottomSheet (C2 1.2, 2.2).
export function FormDialog({
  open,
  phone,
  onClose,
  title,
  eyebrow,
  sub,
  footer,
  width = 560,
  children,
}: {
  open: boolean;
  phone: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: ReactNode;
  // Dòng phụ dưới tiêu đề (12px --muted).
  sub?: ReactNode;
  footer: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  if (phone) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        closeOnOverlay={false}
        title={
          <span className="st-dlg-title">
            {eyebrow !== undefined && <span className="st-dlg-title__eyebrow">{eyebrow}</span>}
            {title}
            {sub !== undefined && <span className="st-dlg-title__sub">{sub}</span>}
          </span>
        }
        footer={footer}
        className="st-sheet-form"
      >
        <div className="st-form-body">{children}</div>
      </BottomSheet>
    );
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      width={width}
      eyebrow={eyebrow}
      title={
        <span className="st-dlg-title">
          {title}
          {sub !== undefined && <span className="st-dlg-title__sub">{sub}</span>}
        </span>
      }
      footer={footer}
    >
      {children}
    </Dialog>
  );
}
