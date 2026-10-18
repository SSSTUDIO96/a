import { useCallback, useState } from 'react';
import { useSession } from '../app/session';

// Đăng xuất chỉ rời trang khi máy chủ đã thu hồi phiên; lỗi (mất mạng...) thì ở lại và trả lỗi để hiện.
export function useLogout() {
  const { logout } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(() => {
    setPending(true);
    setError(null);
    logout().catch((err: unknown) => {
      setError(err);
      setPending(false);
    });
  }, [logout]);
  return { logout: run, pending, error };
}
