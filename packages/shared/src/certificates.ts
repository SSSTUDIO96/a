// Giấy chứng nhận — hằng số và hàm dùng chung cho máy chủ và web (docs/rnd/BAN-VE-F-GIAY-CHUNG-NHAN.md mục 3.2).
// Database có chốt khớp các hàm này (migration 20261019210000_giay_chung_nhan, CHECK certificates_number / _template):
// đổi ở đây mà không đổi chốt thì bài thử apps/api/test/giay-chung-nhan-database.test.ts đỏ.

export const CERTIFICATE_TITLE = 'Giấy chứng nhận';
// Chức danh người ký thứ hai khi hồ sơ để trống cert_signer_title.
export const DEFAULT_SIGNER_TITLE = 'Giám đốc trung tâm';

// Mã mẫu và phiên bản bố cục. Danh mục hiển thị (tên, phông, ô) nằm ở DESIGN_TEMPLATES (kind CERTIFICATE);
// bài thử design-templates.test.ts kiểm hai nơi khớp nhau. 16 mẫu cc-01..cc-16 (đính chính 19/10 tối của bản vẽ F).
export const CERTIFICATE_TEMPLATES = {
  'cc-01': { version: 1 },
  'cc-02': { version: 1 },
  'cc-03': { version: 1 },
  'cc-04': { version: 1 },
  'cc-05': { version: 1 },
  'cc-06': { version: 1 },
  'cc-07': { version: 1 },
  'cc-08': { version: 1 },
  'cc-09': { version: 1 },
  'cc-10': { version: 1 },
  'cc-11': { version: 1 },
  'cc-12': { version: 1 },
  'cc-13': { version: 1 },
  'cc-14': { version: 1 },
  'cc-15': { version: 1 },
  'cc-16': { version: 1 },
} as const;

export type CertificateTemplateCode = keyof typeof CERTIFICATE_TEMPLATES;

export const CERTIFICATE_TEMPLATE_CODES = Object.keys(CERTIFICATE_TEMPLATES) as CertificateTemplateCode[];

// Chỉ khoá RIÊNG của danh mục (không nhận 'toString', 'constructor'… của nguyên mẫu đối tượng).
export function isCertificateTemplateCode(v: string): v is CertificateTemplateCode {
  return Object.prototype.hasOwnProperty.call(CERTIFICATE_TEMPLATES, v);
}

// Ảnh xuất: A4 ngang 150 dpi. Khung vẽ trong tệp mẫu: 1123×794 px (A4 ở 96 dpi).
export const CERTIFICATE_IMAGE = { width: 1754, height: 1240 } as const;
export const CERTIFICATE_FRAME = { width: 1123, height: 794 } as const;
// Trang PDF A4 ngang tính bằng point.
export const CERTIFICATE_PAGE_PT = { width: 841.89, height: 595.28 } as const;

// = trần số học viên một lớp.
export const CERTIFICATE_MAX_BATCH = 500;
// Lọc sổ theo ids (in lại nhiều bản).
export const CERTIFICATE_IDS_MAX = 50;

// Miền giá trị khớp CHECK certificates_number của database.
export const CERTIFICATE_YEAR_MIN = 2000;
export const CERTIFICATE_YEAR_MAX = 2999;
export const CERTIFICATE_SEQ_MAX = 999_999;

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < CERTIFICATE_YEAR_MIN || year > CERTIFICATE_YEAR_MAX) {
    throw new RangeError(`Năm giấy chứng nhận không hợp lệ: ${String(year)} (cần số nguyên ${CERTIFICATE_YEAR_MIN}–${CERTIFICATE_YEAR_MAX})`);
  }
}

// (2026, 7) → "CC-2026-0007"; (2026, 12345) → "CC-2026-12345" (từ 10000 in đủ chữ số, không cắt).
// Năm hay số ngoài miền → ném lỗi (không có giá trị mặc định im lặng).
export function certificateCode(year: number, seq: number): string {
  assertYear(year);
  if (!Number.isInteger(seq) || seq < 1 || seq > CERTIFICATE_SEQ_MAX) {
    throw new RangeError(`Số thứ tự giấy chứng nhận không hợp lệ: ${String(seq)} (cần số nguyên 1–${CERTIFICATE_SEQ_MAX})`);
  }
  return `CC-${year}-${String(seq).padStart(4, '0')}`;
}

// Khoá bộ đếm trong org_counters: "certificate:2026".
export function certificateCounterKey(year: number): string {
  assertYear(year);
  return `certificate:${year}`;
}

export const REISSUE_REASONS = ['Sai tên / sai dấu', 'Đổi mẫu', 'Khác'] as const;
