import { ApiError, userMessage } from '../api/errors';

// Hiện lỗi máy chủ đúng như máy chủ báo (tiếng Việt), kèm mã yêu cầu để tra log.
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof ApiError) {
    return (
      <div role="alert">
        <p>{userMessage(error)}</p>
        {error.requestId ? <p>Mã yêu cầu: {error.requestId}</p> : null}
      </div>
    );
  }
  return (
    <div role="alert">
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
