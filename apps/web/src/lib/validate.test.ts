import { describe, expect, it } from 'vitest';
import { checkNewPassword, checkSlug, slugify } from './validate';

describe('kiểm dữ liệu form', () => {
  it('slugify bỏ dấu tiếng Việt, đ → d', () => {
    expect(slugify('Studio Hoa Đào  Quận 1!')).toBe('studio-hoa-dao-quan-1');
    expect(checkSlug(slugify('Trang điểm Bé Nguyễn'))).toBeUndefined();
  });

  it('chặn đường dẫn trùng trang hệ thống và sai dạng', () => {
    expect(checkSlug('dang-nhap')).toBeDefined();
    expect(checkSlug('-abc')).toBeDefined();
    expect(checkSlug('ab')).toBeDefined();
  });

  it('mật khẩu 10 ký tự tới 72 byte như máy chủ', () => {
    expect(checkNewPassword('123456789')).toBeDefined();
    expect(checkNewPassword('1234567890')).toBeUndefined();
    expect(checkNewPassword('ệ'.repeat(25))).toBeDefined();
  });
});
