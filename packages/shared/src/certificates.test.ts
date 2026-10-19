import { describe, expect, it } from 'vitest';
import {
  CERTIFICATE_FRAME,
  CERTIFICATE_IDS_MAX,
  CERTIFICATE_IMAGE,
  CERTIFICATE_MAX_BATCH,
  CERTIFICATE_PAGE_PT,
  CERTIFICATE_TEMPLATES,
  CERTIFICATE_TEMPLATE_CODES,
  CERTIFICATE_TITLE,
  DEFAULT_SIGNER_TITLE,
  REISSUE_REASONS,
  certificateCode,
  certificateCounterKey,
  isCertificateTemplateCode,
} from './certificates';
import * as shared from './index';

describe('certificateCode — số giấy chứng nhận', () => {
  it('4 chữ số có số 0 đầu tới 9999; từ 10000 in đủ, không cắt', () => {
    expect(certificateCode(2026, 1)).toBe('CC-2026-0001');
    expect(certificateCode(2026, 7)).toBe('CC-2026-0007');
    expect(certificateCode(2026, 9999)).toBe('CC-2026-9999');
    expect(certificateCode(2026, 10000)).toBe('CC-2026-10000');
    expect(certificateCode(2026, 12345)).toBe('CC-2026-12345');
    expect(certificateCode(2027, 999_999)).toBe('CC-2027-999999');
    expect(certificateCode(2000, 1)).toBe('CC-2000-0001');
    expect(certificateCode(2999, 1)).toBe('CC-2999-0001');
  });

  it('số ngoài miền của database (seq 1..999999) → ném lỗi, không trả mã sai', () => {
    for (const seq of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000]) {
      expect(() => certificateCode(2026, seq), `seq ${seq}`).toThrow(RangeError);
    }
  });

  it('năm ngoài 2000..2999 hoặc không nguyên → ném lỗi', () => {
    for (const year of [1999, 3000, 2026.5, Number.NaN, 0, -2026]) {
      expect(() => certificateCode(year, 1), `năm ${year}`).toThrow(RangeError);
    }
  });
});

describe('certificateCounterKey — khoá bộ đếm', () => {
  it('"certificate:<năm>", năm khác nhau ra khoá khác nhau', () => {
    expect(certificateCounterKey(2026)).toBe('certificate:2026');
    expect(certificateCounterKey(2027)).toBe('certificate:2027');
  });
  it('năm sai → ném lỗi', () => {
    for (const year of [1999, 3000, 2026.5, Number.NaN]) {
      expect(() => certificateCounterKey(year), `năm ${year}`).toThrow(RangeError);
    }
  });
});

describe('danh mục mẫu giấy chứng nhận', () => {
  it('đúng 16 mã cc-01..cc-16, đúng thứ tự (đính chính 19/10 tối)', () => {
    const want = Array.from({ length: 16 }, (_, i) => `cc-${String(i + 1).padStart(2, '0')}`);
    expect(CERTIFICATE_TEMPLATE_CODES).toEqual(want);
    expect(Object.keys(CERTIFICATE_TEMPLATES)).toEqual(want);
  });

  it('mọi mã khớp chốt database ^cc-[0-9]{2}$; phiên bản là số nguyên ≥ 1', () => {
    for (const code of CERTIFICATE_TEMPLATE_CODES) {
      expect(code).toMatch(/^cc-[0-9]{2}$/);
      const v = CERTIFICATE_TEMPLATES[code].version;
      expect(Number.isInteger(v) && v >= 1, `${code} version ${v}`).toBe(true);
    }
  });

  it('isCertificateTemplateCode: mã thẻ khác, mã bịa, khoá của nguyên mẫu đều sai', () => {
    expect(isCertificateTemplateCode('cc-01')).toBe(true);
    expect(isCertificateTemplateCode('cc-16')).toBe(true);
    for (const bad of ['shd-01', 'cc-17', 'cc-00', 'cc-99', 'CC-01', 'cc-1', '', 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(isCertificateTemplateCode(bad), bad).toBe(false);
    }
  });
});

describe('hằng số in, xuất, giới hạn', () => {
  it('tiêu đề và chức danh mặc định (vừa trần 120 ký tự của database)', () => {
    expect(CERTIFICATE_TITLE).toBe('Giấy chứng nhận');
    expect(DEFAULT_SIGNER_TITLE).toBe('Giám đốc trung tâm');
    expect(DEFAULT_SIGNER_TITLE.trim().length).toBeGreaterThan(0);
    expect(DEFAULT_SIGNER_TITLE.length).toBeLessThanOrEqual(120);
  });

  it('ảnh xuất, khung vẽ, trang PDF: A4 ngang (tỉ lệ √2, sai lệch < 0,1%)', () => {
    expect(CERTIFICATE_IMAGE).toEqual({ width: 1754, height: 1240 });
    expect(CERTIFICATE_FRAME).toEqual({ width: 1123, height: 794 });
    expect(CERTIFICATE_PAGE_PT).toEqual({ width: 841.89, height: 595.28 });
    for (const s of [CERTIFICATE_IMAGE, CERTIFICATE_FRAME, CERTIFICATE_PAGE_PT]) {
      expect(s.width).toBeGreaterThan(s.height);
      expect(Math.abs(s.width / s.height - Math.SQRT2) / Math.SQRT2).toBeLessThan(0.001);
    }
  });

  it('giới hạn lô cấp và lọc theo ids', () => {
    expect(CERTIFICATE_MAX_BATCH).toBe(500);
    expect(CERTIFICATE_IDS_MAX).toBe(50);
  });

  it('lý do cấp lại', () => {
    expect(REISSUE_REASONS).toEqual(['Sai tên / sai dấu', 'Đổi mẫu', 'Khác']);
  });

  it('xuất qua packages/shared/src/index.ts', () => {
    expect(shared.certificateCode).toBe(certificateCode);
    expect(shared.CERTIFICATE_TEMPLATE_CODES).toBe(CERTIFICATE_TEMPLATE_CODES);
    expect(shared.isCertificateTemplateCode).toBe(isCertificateTemplateCode);
  });
});
