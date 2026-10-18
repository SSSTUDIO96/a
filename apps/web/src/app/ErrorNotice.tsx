import { ApiError, userMessage } from '../api/errors';

// Hiện lỗi máy chủ đúng như máy chủ báo (tiếng Việt), kèm mã yêu cầu để tra log.
// className: chỗ gọi tự gắn khung (vd dải đỏ ở màn đăng nhập); mặc định không có lớp, giữ như cũ cho các chỗ khác.
export function ErrorNotice({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  if (error instanceof ApiError) {
    return (
      <div role="alert" className={className}>
        <p>{userMessage(error)}</p>
        {error.requestId ? <p>Mã yêu cầu: {error.requestId}</p> : null}
      </div>
    );
  }
  return (
    <div role="alert" className={className}>
      <p>Lỗi không lường trước: {error instanceof Error ? error.message : String(error)}</p>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert">
      {message}
    </p>
  );
}
