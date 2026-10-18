import { ApiError, isServerErrorBody, NETWORK_MESSAGE } from './errors';

// Máy khách API: gọi đường tương đối /api/v1 (cùng tên miền với trang web).
// Access token chỉ nằm trong biến của module này — tải lại trang là mất, khôi phục bằng refresh (cookie httpOnly).

export const API_BASE = '/api/v1';

// ---- Phiên trong bộ nhớ ----
let accessToken: string | null = null;
let refreshing: Promise<void> | null = null;
let onSessionExpired: (() => void) | null = null;
// Mỗi lần refresh thất bại chỉ báo hết phiên một lần dù nhiều yêu cầu cùng chờ.
let expiredBy: Promise<void> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

// session.tsx đăng ký hàm này: xoá trạng thái phiên và chuyển về trang đăng nhập.
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  // Khoá chống gửi trùng — sinh MỘT lần cho mỗi lần bấm, giữ nguyên khi tự thử lại sau refresh.
  idempotencyKey?: string;
  // false: đường đăng nhập/đăng ký/refresh — 401 là câu trả lời thật, không tự refresh.
  auth?: boolean;
  signal?: AbortSignal;
}

async function send(method: Method, path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'X-Client': 'web', Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    // Người dùng tự huỷ thì giữ nguyên lỗi huỷ, không đổi thành lỗi mạng.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK', NETWORK_MESSAGE, 0, null, err instanceof Error ? err.message : undefined);
  }
}

async function readResult<T>(res: Response): Promise<T> {
  const headerRequestId = res.headers.get('x-request-id');
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }
  if (!res.ok) {
    if (isServerErrorBody(parsed)) {
      const e = parsed.error;
      throw new ApiError(e.code, e.message, res.status, e.requestId ?? headerRequestId, e.details);
    }
    throw new ApiError(`HTTP_${res.status}`, `Máy chủ trả lỗi không rõ (mã ${res.status}). Vui lòng thử lại.`, res.status, headerRequestId);
  }
  if (parsed === undefined) {
    throw new ApiError('INVALID_RESPONSE', 'Máy chủ trả dữ liệu không đọc được.', res.status, headerRequestId);
  }
  return parsed as T;
}

// Khoá giữa các thẻ trình duyệt: refresh token chỉ dùng được một lần, hai thẻ cùng refresh bằng một cookie thì một thẻ bị từ chối.
async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return fn();
  return locks.request('makeup-pro-refresh', fn);
}

async function doRefresh(): Promise<void> {
  const res = await send('POST', '/auth/refresh', { body: {} }, null);
  const data = await readResult<{ accessToken: string; expiresIn: number }>(res);
  accessToken = data.accessToken;
}

/**
 * Đổi cookie refresh lấy access token mới. Nhiều yêu cầu cùng gặp 401 thì chỉ có MỘT lần refresh — các yêu cầu khác chờ chung.
 * expireOnFailure: máy chủ từ chối thì xoá phiên và gọi onSessionExpired (chuyển về đăng nhập).
 * Khôi phục phiên lúc tải trang dùng expireOnFailure = false: chưa đăng nhập không phải là "hết phiên".
 */
export function refreshSession(expireOnFailure = true): Promise<void> {
  if (!refreshing) {
    refreshing = withCrossTabLock(doRefresh).finally(() => {
      refreshing = null;
    });
  }
  const current = refreshing;
  return current.catch((err: unknown) => {
    if (expireOnFailure && isSessionRejected(err) && expiredBy !== current) {
      expiredBy = current;
      accessToken = null;
      onSessionExpired?.();
    }
    throw err;
  });
}

// Mất mạng, máy chủ lỗi 5xx hay bị giới hạn tốc độ không có nghĩa phiên đã hết — giữ phiên, chỉ báo lỗi.
function isSessionRejected(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429;
}

export async function apiRequest<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth !== false;
  if (useAuth && refreshing) await refreshSession();
  const tokenUsed = useAuth ? accessToken : null;
  let res = await send(method, path, opts, tokenUsed);
  if (res.status === 401 && useAuth) {
    // Một yêu cầu khác đã refresh xong trong lúc chờ thì chỉ cần gửi lại với thẻ mới.
    if (accessToken === null || accessToken === tokenUsed) await refreshSession();
    res = await send(method, path, opts, accessToken);
  }
  return readResult<T>(res);
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>('GET', path, { signal }),
  // POST tạo dữ liệu: bắt buộc có khoá chống gửi trùng do nơi bấm nút sinh ra.
  create: <T>(path: string, body: unknown, idempotencyKey: string, opts: Omit<RequestOptions, 'body' | 'idempotencyKey'> = {}) =>
    apiRequest<T>('POST', path, { ...opts, body, idempotencyKey }),
  // POST không tạo dữ liệu (đăng nhập, đăng xuất...).
  post: <T>(path: string, body: unknown, opts: Omit<RequestOptions, 'body'> = {}) => apiRequest<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>('PATCH', path, { body }),
  delete: <T>(path: string) => apiRequest<T>('DELETE', path),
};
