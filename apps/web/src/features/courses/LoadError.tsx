import { errorKind, userMessage } from '../../api/errors';
import { Button, IconLock, IconWarn } from '../../ui';

// Dải lỗi tải: mạng / 5xx → lời + "Thử lại"; 403 (thiếu quyền, tổ chức chưa bật đào tạo) → lời máy chủ, không có nút.
export function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  const forbidden = errorKind(error) === 'forbidden';
  return (
    <div className="kc-strip" role="alert">
      {forbidden ? <IconLock /> : <IconWarn />}
      <span className="kc-strip__text">{userMessage(error)}</span>
      {!forbidden && (
        <Button size="sm" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
