// Lỗi máy chủ có dạng { error: { code, message, details, requestId } } — giữ nguyên để hiện đúng lời máy chủ.

export const NETWORK_MESSAGE = 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.';

export class ApiError extends Error {
  override readonly name = 'ApiError';
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly requestId: string | null,
    readonly details: unknown = undefined,
  ) {
    super(message);
  }
}

export interface ServerErrorBody {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

export function isServerErrorBody(v: unknown): v is ServerErrorBody {
  if (typeof v !== 'object' || v === null || !('error' in v)) return false;
  const e = (v as { error: unknown }).error;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { code?: unknown }).code === 'string' &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

// Nhóm lỗi theo bản vẽ (docs/rnd/BAN-VE-C.md mục 5) để màn hình chọn cách hiện.
export type ErrorKind =
  | 'validation' // 400: lỗi dưới ô
  | 'unauthenticated' // 401: đã thử refresh một lần, vẫn hỏng → về đăng nhập
  | 'forbidden' // 403: dải "Bạn không có quyền …"
  | 'not_found' // 404: "Không tìm thấy …" + nút quay lại
  | 'conflict' // 409: lời máy chủ, giữ dữ liệu đã nhập
  | 'rate_limited' // 429
  | 'network' // mất mạng: dải cảnh báo, khoá nút lưu
  | 'server'; // 5xx hoặc trả lời không đọc được

export function errorKind(err: unknown): ErrorKind {
  if (!(err instanceof ApiError)) return 'server';
  if (err.code === 'NETWORK') return 'network';
  switch (err.status) {
    case 400:
      return 'validation';
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 429:
      return 'rate_limited';
    default:
      return 'server';
  }
}

const FALLBACK_MESSAGE: Record<ErrorKind, string> = {
  validation: 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.',
  unauthenticated: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  not_found: 'Không tìm thấy dữ liệu.',
  conflict: 'Dữ liệu bị trùng hoặc đã thay đổi.',
  rate_limited: 'Thử quá nhiều lần, vui lòng đợi một phút.',
  network: NETWORK_MESSAGE,
  server: 'Máy chủ gặp lỗi, vui lòng thử lại.',
};

// Lời cho người dùng: ưu tiên lời máy chủ (đã viết tiếng Việt), thiếu thì dùng lời mặc định theo nhóm.
export function userMessage(err: unknown): string {
  if (err instanceof ApiError && err.message) return err.message;
  return FALLBACK_MESSAGE[errorKind(err)];
}

// Lỗi kiểm dữ liệu 400: details = { formErrors: string[], fieldErrors: { tên_ô: string[] } } (z.flattenError).
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return out;
  const d = err.details;
  if (typeof d !== 'object' || d === null || !('fieldErrors' in d)) return out;
  const fe = (d as { fieldErrors: unknown }).fieldErrors;
  if (typeof fe !== 'object' || fe === null) return out;
  for (const [k, v] of Object.entries(fe)) {
    if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
  }
  return out;
}

// 409 do trùng khoá duy nhất: details = { fields: ['slug', ...] }.
export function conflictFields(err: unknown): string[] {
  if (!(err instanceof ApiError) || err.code !== 'CONFLICT') return [];
  const fields = (err.details as { fields?: unknown } | undefined)?.fields;
  return Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [];
}
