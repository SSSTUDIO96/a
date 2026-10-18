import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from './session';
import '../ui/ui.css';
import './app.css';

// Đang tải (khôi phục phiên, tải tệp của màn ngoài khung): vòng xoay 16px + chữ, giữa màn, không nhảy bố cục.
// Không gắn role="status": thông báo "Máy chủ đang bận" của phiên đã dùng vai trò đó, hai cái cùng lúc sẽ lẫn nhau.
export function Loading() {
  return (
    <div className="app-loading" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" />
      <span>Đang tải…</span>
    </div>
  );
}

interface FromState {
  from?: string;
}

function fromOf(state: unknown): string | undefined {
  const from = (state as FromState | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : undefined;
}

// Trang chỉ dành cho người chưa đăng nhập: đăng nhập xong thì quay về trang định vào.
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'loading') return <Loading />;
  if (status === 'authenticated') return <Navigate to={fromOf(location.state) ?? '/'} replace />;
  return children;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'loading') return <Loading />;
  if (status === 'anonymous') {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname + location.search } satisfies FromState} />;
  }
  return children;
}

// "/" → trang lịch của tổ chức đang chọn, hoặc tạo tổ chức nếu chưa có.
export function HomeRedirect() {
  const { status, currentOrg } = useSession();
  if (status === 'loading') return <Loading />;
  if (status === 'anonymous') return <Navigate to="/dang-nhap" replace />;
  if (!currentOrg) return <Navigate to="/tao-to-chuc" replace />;
  return <Navigate to={`/${currentOrg.slug}/lich`} replace />;
}
