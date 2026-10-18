import type { ReactNode } from 'react';
import { errorKind, userMessage } from '../../api/errors';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { Button, EmptyState, Tooltip } from '../../ui';

// Khối nhỏ dùng riêng trong màn Bảng giá.

// Nhóm trong hộp chi tiết / thẻ cài đặt: tiêu đề 13/700 gạch chân 1px --line (bản vẽ mục 1.2).
export function Group({ title, tip, children, className }: { title: ReactNode; tip?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `pr-ng ${className}` : 'pr-ng'}>
      <h3 className="pr-ng__h">
        {title}
        {tip !== undefined && <Tooltip text={tip} />}
      </h3>
      {children}
    </section>
  );
}

// Dải lỗi trong thân (lỗi không gắn được vào ô nào).
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="pr-banner" role="alert">
      {children}
    </div>
  );
}

// Lỗi tải lần đầu: 403 → dải "Bạn không có quyền …"; còn lại một dòng lời máy chủ + "Thử lại".
export function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  if (errorKind(error) === 'forbidden') return <ForbiddenBanner>{userMessage(error)}</ForbiddenBanner>;
  return <EmptyState message={userMessage(error)} action={<Button onClick={retry}>Thử lại</Button>} />;
}

// Dòng lỗi 12px --danger dưới một nhóm (không có ô riêng để gắn).
export function GroupError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="pr-gerr" role="alert">
      {message}
    </div>
  );
}

export function IconGrip() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <circle cx="9" cy="6" r="1.3" />
      <circle cx="15" cy="6" r="1.3" />
      <circle cx="9" cy="12" r="1.3" />
      <circle cx="15" cy="12" r="1.3" />
      <circle cx="9" cy="18" r="1.3" />
      <circle cx="15" cy="18" r="1.3" />
    </svg>
  );
}
