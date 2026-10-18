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
    // Số giây máy chủ bảo chờ (header Retry-After, thường đi kèm 429/503); không có hoặc đọc không được → null.
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

// Header Retry-After (RFC 9110 mục 10.2.3): số giây ("12") hoặc ngày giờ HTTP ("Wed, 21 Oct 2026 07:28:00 GMT").
// Ngày giờ → số giây từ bây giờ, làm tròn lên (đã qua → 0). Thiếu hoặc hỏng → null.
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (value === null) return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : null;
  }
  // Chỉ nhận dạng ngày giờ có tên thứ/tháng kiểu HTTP, không đoán những chuỗi số lạ như "1.5" hay "-3".
  if (!/[A-Za-z]{3}/.test(v)) return null;
  const at = Date.parse(v);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
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

export interface ValidationIssue {
  // Đường dẫn đầy đủ tới ô, nối bằng dấu chấm: "lines.0.travel.amount". Rỗng = lỗi chung của cả thân.
  path: string;
  message: string;
}

// Lỗi kiểm dữ liệu 400: details = { formErrors, fieldErrors (z.flattenError), issues: [{path, message}] }.
export function validationIssues(err: unknown): ValidationIssue[] {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return [];
  const issues = (err.details as { issues?: unknown } | undefined)?.issues;
  if (!Array.isArray(issues)) return [];
  return issues.filter(
    (i): i is ValidationIssue =>
      typeof i === 'object' && i !== null && typeof (i as { path?: unknown }).path === 'string' && typeof (i as { message?: unknown }).message === 'string',
  );
}

/**
 * Lời lỗi theo ô: { đường_dẫn: lời } — lời đầu tiên của mỗi ô.
 * Có cả khoá đường dẫn đầy đủ ("lines.0.travel.amount", từ details.issues) lẫn khoá gốc ("lines", từ fieldErrors),
 * nên form phẳng (email, password, slug...) vẫn đọc như cũ.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return out;
  for (const i of validationIssues(err)) {
    if (i.path && out[i.path] === undefined) out[i.path] = i.message;
  }
  const fe = (err.details as { fieldErrors?: unknown } | undefined)?.fieldErrors;
  if (typeof fe === 'object' && fe !== null) {
    for (const [k, v] of Object.entries(fe)) {
      if (out[k] === undefined && Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
    }
  }
  return out;
}

// 409 do trùng khoá duy nhất: details = { fields: ['slug', ...] }.
export function conflictFields(err: unknown): string[] {
  if (!(err instanceof ApiError) || err.code !== 'CONFLICT') return [];
  const fields = (err.details as { fields?: unknown } | undefined)?.fields;
  return Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [];
}
