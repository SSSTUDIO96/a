import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button, EmptyState, IconBack, Skeleton } from '../ui';

// Trạng thái lỗi và tải của khung — bản vẽ C mục 5.

// 403: dải đỏ trên đầu thân trang. Nút đã ẩn theo quyền từ đầu; dải này cho trường hợp vẫn gặp (vào thẳng đường dẫn, quyền vừa đổi).
export function ForbiddenBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="sh-banner sh-banner--danger" role="alert">
      {children ?? 'Bạn không có quyền xem mục này.'}
    </div>
  );
}

// 404: một dòng "Không tìm thấy …" + nút quay lại.
export function NotFoundView({ message = 'Không tìm thấy trang này.', backTo }: { message?: ReactNode; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      message={message}
      action={
        <Button icon={<IconBack />} onClick={() => void (backTo ? navigate(backTo) : navigate(-1))}>
          Quay lại
        </Button>
      }
    />
  );
}

// Trạng thái mạng của trình duyệt. Trang có nút lưu dùng để khoá nút khi mất mạng.
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// Mất mạng: dải --warn-bg trên đầu thân trang.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="sh-banner sh-banner--warn" role="status">
      Mất kết nối mạng. Thay đổi chưa lưu được cho tới khi có mạng lại.
    </div>
  );
}

// Tải lần đầu: khối chờ đúng bố cục (tiêu đề + vài dòng), không vòng xoay giữa màn.
export function PageSkeleton() {
  return (
    <div className="sh-skel" role="status" aria-label="Đang tải">
      <Skeleton width={220} height={24} />
      <Skeleton height={44} />
      <Skeleton height={44} />
      <Skeleton height={44} width="70%" />
    </div>
  );
}
