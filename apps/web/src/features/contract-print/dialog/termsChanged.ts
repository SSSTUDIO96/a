import { splitClauses, type ContractPrintData } from '@makeup/shared';

// Cảnh báo khi xác nhận (bản vẽ G mục 2.5 rủi ro 4, mục 4.4): in NHÁP, khách ký, rồi mẫu điều khoản bị sửa trước khi bấm
// "Xác nhận" — bản chụp lúc xác nhận lấy chữ mới. Gói G-W5 gọi hàm này trong luồng "Xác nhận hợp đồng" của cả hai màn;
// nếu true thì hỏi "Điều khoản sẽ chụp khác bản đã in cho khách — vẫn xác nhận?". Máy chủ KHÔNG chặn.

type Clauses = string | readonly string[] | null | undefined;

export interface TermsToSnapshot {
  /** Điều khoản sắp chụp: nội dung thô (tách theo dòng như bản in) hoặc danh sách điều đã tách. null/rỗng = không có điều khoản. */
  terms: Clauses;
  /** Nội quy sắp chụp (khoá học). undefined = hợp đồng này không có nội quy, không so. */
  rules?: Clauses;
}

function items(c: Clauses): string[] {
  if (c === null || c === undefined) return [];
  return typeof c === 'string' ? splitClauses(c) : c.map((s) => s.trim()).filter((s) => s !== '');
}

const sameItems = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * So chữ điều khoản (và nội quy) của LẦN IN GẦN NHẤT với chữ sắp được chụp. Chưa có lần in nào (lastPrintData = null) → false.
 * Chỉ so các điều (từng dòng đã bỏ số đầu dòng), không so tên mẫu hay số bản.
 */
export function termsChangedSincePrint(lastPrintData: ContractPrintData | null, current: TermsToSnapshot): boolean {
  if (lastPrintData === null) return false;
  if (!sameItems(lastPrintData.terms?.items ?? [], items(current.terms))) return true;
  if (current.rules !== undefined && !sameItems(lastPrintData.rules?.items ?? [], items(current.rules))) return true;
  return false;
}
