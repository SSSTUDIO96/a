import { useState } from 'react';
import { Button } from '../ui';
import { useSession } from './session';
import { ErrorNotice } from './ErrorNotice';

// Nút đăng xuất ở màn ngoài khung (Tạo tổ chức khi chưa thuộc tổ chức nào). Nút nhẹ, nằm ở chân thẻ.
export function LogoutButton({ errorClassName }: { errorClassName?: string }) {
  const { logout } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        loading={pending}
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
        Đăng xuất
      </Button>
      <ErrorNotice error={error} className={errorClassName} />
    </>
  );
}
