import { describe, expect, it } from 'vitest';
import { ApiError, conflictFields, errorKind, fieldErrors, userMessage } from './errors';

const e = (code: string, status: number, details?: unknown) => new ApiError(code, `lời ${code}`, status, 'req-1', details);

describe('ánh xạ lỗi theo bản vẽ mục 5', () => {
  it('400/401/403/404/409/429/5xx/mạng', () => {
    expect(errorKind(e('VALIDATION_FAILED', 400))).toBe('validation');
    expect(errorKind(e('UNAUTHENTICATED', 401))).toBe('unauthenticated');
    expect(errorKind(e('FORBIDDEN', 403))).toBe('forbidden');
    expect(errorKind(e('NOT_FOUND', 404))).toBe('not_found');
    expect(errorKind(e('CONFLICT', 409))).toBe('conflict');
    expect(errorKind(e('RATE_LIMITED', 429))).toBe('rate_limited');
    expect(errorKind(e('INTERNAL', 500))).toBe('server');
    expect(errorKind(e('NETWORK', 0))).toBe('network');
    expect(errorKind(new Error('lạ'))).toBe('server');
  });

  it('ưu tiên lời máy chủ; lỗi không phải ApiError dùng lời mặc định tiếng Việt', () => {
    expect(userMessage(e('FORBIDDEN', 403))).toBe('lời FORBIDDEN');
    expect(userMessage(new Error('x'))).toBe('Máy chủ gặp lỗi, vui lòng thử lại.');
  });

  it('đọc lỗi từng ô (400) và ô bị trùng (409)', () => {
    expect(fieldErrors(e('VALIDATION_FAILED', 400, { formErrors: [], fieldErrors: { email: ['Email không hợp lệ'] } }))).toEqual({
      email: 'Email không hợp lệ',
    });
    expect(fieldErrors(e('CONFLICT', 409))).toEqual({});
    expect(conflictFields(e('CONFLICT', 409, { fields: ['slug'] }))).toEqual(['slug']);
  });
});
