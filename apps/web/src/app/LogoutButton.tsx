import { useState } from 'react';
import { useSession } from './session';
import { ErrorNotice } from './ErrorNotice';

export function LogoutButton() {
  const { logout } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          // Chỉ rời trang khi máy chủ đã thu hồi phiên; lỗi thì ở lại và báo.
          logout().catch((err: unknown) => {
            setError(err);
            setPending(false);
          });
        }}
      >
        {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>
      <ErrorNotice error={error} />
    </div>
  );
}
