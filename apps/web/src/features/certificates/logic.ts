import type { CertificateView } from '../../api/certificates';

// Hàm thuần của giấy chứng nhận (bản vẽ F mục 6–7): ngày, tên tệp, cỡ tệp, tóm tắt lô. Không đụng DOM, không đoán giá trị thiếu.

// "Hôm nay" theo múi giờ của tổ chức, dạng YYYY-MM-DD (mẫu customers/logic.ts: Intl.DateTimeFormat('en-CA', { timeZone })).
export function todayInTz(timeZone: string, now: Date = new Date()): string {
  if (!timeZone) throw new Error('todayInTz: thiếu múi giờ của tổ chức');
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const WIRE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// "2026-12-20" → "20/12/2026". Sai dạng → ném lỗi (không in ngày bịa lên giấy).
export function viDate(wire: string): string {
  const m = WIRE_DATE.exec(wire);
  if (!m) throw new Error(`Ngày không đúng dạng YYYY-MM-DD: "${wire}"`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Bỏ dấu tiếng Việt (NFD, đ → d), chữ thường, chỉ giữ [a-z0-9-]; khoảng trắng và ký tự lạ thành một dấu gạch.
export function asciiSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// PDF: Giay-chung-nhan-{lop-khong-dau}-{issuedOn}.pdf. Một lớp một ngày cấp → tên lớp + ngày cấp;
// in từ sổ, nhiều lớp (không có lớp) → Giay-chung-nhan-{hôm nay}.pdf.
export function pdfFileName(opts: { className: string | null; issuedOn: string | null; today: string }): string {
  if (!WIRE_DATE.test(opts.today)) throw new Error(`pdfFileName: ngày hôm nay sai dạng: "${opts.today}"`);
  const cls = opts.className ? asciiSlug(opts.className) : '';
  if (cls && opts.issuedOn) {
    if (!WIRE_DATE.test(opts.issuedOn)) throw new Error(`pdfFileName: ngày cấp sai dạng: "${opts.issuedOn}"`);
    return `Giay-chung-nhan-${cls}-${opts.issuedOn}.pdf`;
  }
  return `Giay-chung-nhan-${opts.today}.pdf`;
}

// PNG: GCN-{code}-{ten-khong-dau}.png, ví dụ GCN-CC-2026-0007-le-thi-mai.png.
export function pngFileName(code: string, studentName: string): string {
  if (!code) throw new Error('pngFileName: thiếu số giấy chứng nhận');
  const name = asciiSlug(studentName);
  return name ? `GCN-${code}-${name}.png` : `GCN-${code}.png`;
}

// Tên gốc (không đuôi) của tệp PDF, để PrintSheet nhận từ nơi gọi dạng "Giay-chung-nhan-K12-2026-12-20" hoặc có đuôi.
export function withPdfExt(base: string): string {
  const b = base.trim();
  if (!b) throw new Error('Thiếu tên tệp PDF');
  return /\.pdf$/i.test(b) ? b : `${b}.pdf`;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) throw new Error(`formatBytes: cỡ tệp không hợp lệ: ${String(n)}`);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

// Lớp từ 61 người: dải vàng "Tệp lớn" (bản vẽ F 7.3). Mỗi trang JPEG ước 250–450 KB → lấy 450 KB cho ước tính trên.
export const LARGE_BATCH = 60;
export const ESTIMATE_BYTES_PER_PAGE = 450 * 1024;

export function isLargeBatch(count: number): boolean {
  return count > LARGE_BATCH;
}

export function estimateMegabytes(count: number): number {
  return Math.ceil((count * ESTIMATE_BYTES_PER_PAGE) / 1024 / 1024);
}

// "Đang vẽ 3/8 · Lê Thị Mai…"
export function progressText(done: number, total: number, current: string | null): string {
  return current ? `Đang vẽ ${Math.min(done + 1, total)}/${total} · ${current}…` : `Đã vẽ ${done}/${total}`;
}

// Tóm tắt dải số của một lô vừa cấp: "CC-2026-0008 → 0014"; một giấy thì chỉ số đó.
export function codeRange(items: Pick<CertificateView, 'code'>[]): string {
  if (items.length === 0) return '';
  const codes = items.map((c) => c.code).sort();
  const first = codes[0] as string;
  const last = codes[codes.length - 1] as string;
  if (first === last) return first;
  const tail = last.split('-').pop() ?? last;
  return `${first} → ${tail}`;
}

// Số phông trong fontOverride: 'ky-3' → '3'. Giá trị lạ → ném lỗi.
export function fontNumber(font: string | null): string | null {
  if (font === null) return null;
  const m = /^ky-([1-68])$/.exec(font);
  if (!m) throw new Error(`Phông chữ tên không hợp lệ: "${font}"`);
  return m[1] as string;
}

// Ảnh học viên nhỏ quá thì in mờ: báo trước khi in. Ngưỡng theo bản vẽ F 6.2 (và R&D-08 "ảnh mờ khi in"): chiều rộng HOẶC chiều cao
// dưới 500 px, tức cạnh ngắn < 500. Dùng ở hộp cấp (nhãn "ảnh nhỏ, in có thể mờ") và bản in (dòng "Ảnh nhỏ, in có thể mờ: …").
export const SMALL_PHOTO_PX = 500;
export function isSmallPhoto(photo: { width: number | null; height: number | null } | null): boolean {
  if (!photo || photo.width === null || photo.height === null) return false;
  return Math.min(photo.width, photo.height) < SMALL_PHOTO_PX;
}
