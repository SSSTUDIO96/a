import { describe, expect, it } from 'vitest';
import { ApiError, conflictFields, errorKind, fieldErrors, parseRetryAfter, userMessage, validationIssues } from './errors';

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
  });

  it('đọc details.issues: lỗi theo đường dẫn lồng, vẫn giữ khoá gốc của fieldErrors', () => {
    const err = e('VALIDATION_FAILED', 400, {
      formErrors: ['Chọn đúng một khách'],
      fieldErrors: { lines: ['Số tiền không được âm'], discount: ['Số tiền phải là số'] },
      issues: [
        { path: 'lines.0.travel.amount', message: 'Số tiền không được âm' },
        { path: 'lines.0.travel.amount', message: 'lời thứ hai bị bỏ' },
        { path: 'discount', message: 'Số tiền phải là số' },
        { path: '', message: 'Chọn đúng một khách' },
        { path: 3, message: 'sai dạng — bỏ qua' },
      ],
    });
    expect(fieldErrors(err)).toEqual({
      'lines.0.travel.amount': 'Số tiền không được âm',
      lines: 'Số tiền không được âm',
      discount: 'Số tiền phải là số',
    });
    expect(validationIssues(err)).toHaveLength(4);
    expect(validationIssues(e('CONFLICT', 409, { issues: [{ path: 'a', message: 'b' }] }))).toEqual([]);
    expect(conflictFields(e('CONFLICT', 409, { fields: ['slug'] }))).toEqual(['slug']);
  });
});

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-10-18T10:00:00.000Z');
  it('số giây', () => {
    expect(parseRetryAfter('12', now)).toBe(12);
    expect(parseRetryAfter(' 0 ', now)).toBe(0);
  });
  it('ngày giờ HTTP → số giây làm tròn lên; đã qua → 0', () => {
    expect(parseRetryAfter('Sun, 18 Oct 2026 10:00:30 GMT', now)).toBe(30);
    expect(parseRetryAfter('Sun, 18 Oct 2026 10:00:30 GMT', now + 200)).toBe(30);
    expect(parseRetryAfter('Sun, 18 Oct 2026 09:59:00 GMT', now)).toBe(0);
  });
  it('thiếu hoặc hỏng → null', () => {
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter('', now)).toBeNull();
    expect(parseRetryAfter('mai nhé', now)).toBeNull();
    expect(parseRetryAfter('1.5', now)).toBeNull();
    expect(parseRetryAfter('-3', now)).toBeNull();
  });
  it('ApiError luôn có trường retryAfterSeconds (mặc định null)', () => {
    expect(new ApiError('X', 'x', 429, null)).toHaveProperty('retryAfterSeconds', null);
  });
});
