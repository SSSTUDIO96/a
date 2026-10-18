export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  // Máy chủ chưa được cấu hình đủ để làm việc này (vd. chưa có gói dịch vụ mặc định) — lỗi VẬN HÀNH, không phải lỗi người
  // dùng hay lỗi lập trình. 503: người dùng không tự sửa được, thử lại sau khi người vận hành cấu hình; giám sát 5xx vẫn báo.
  | 'NOT_CONFIGURED';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  NOT_CONFIGURED: 503,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    // Hướng dẫn cho NGƯỜI VẬN HÀNH (lệnh sửa cấu hình…): chỉ ghi vào log máy chủ, KHÔNG gửi cho máy khách.
    readonly operatorHint?: string,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
