import { getContractPrint, getPrintData } from '../../api/print';
import { termsChangedSincePrint } from '../contract-print/dialog';

// Câu hỏi lại khi xác nhận hợp đồng mà điều khoản sắp chụp khác bản ĐÃ IN cho khách (bản vẽ G mục 2.5 rủi ro 4, mục 4.4).
// Máy chủ không chặn; màn hợp đồng (dịch vụ và khoá học) hỏi người dùng. Đúng câu bản vẽ ghi:
export const TERMS_CHANGED_QUESTION = 'Điều khoản sẽ chụp khác bản đã in cho khách — vẫn xác nhận?';

/**
 * Điều khoản (và nội quy với hợp đồng khoá học) mà bản lưu hiện tại sắp chụp có khác lần in gần nhất không.
 * - "Sắp chụp" lấy từ print-data của máy chủ (nháp: mẫu đang chọn / lời tự nhập / mẫu mặc định — đúng thứ tự lúc xác nhận),
 *   nên gọi SAU KHI đã lưu nháp.
 * - Chưa có lần in nào → false (không tải bản chụp).
 * - Lỗi mạng / máy chủ: ném lại — màn báo lỗi và KHÔNG xác nhận, không im lặng bỏ qua cảnh báo.
 */
export async function termsChangedSinceLastPrint(orgId: string, contractId: string, signal?: AbortSignal): Promise<boolean> {
  const now = await getPrintData(orgId, contractId, signal);
  if (now.lastPrint === null) return false;
  const last = await getContractPrint(orgId, contractId, now.lastPrint.id, signal);
  return termsChangedSincePrint(last.data, {
    terms: now.data.terms?.items ?? null,
    // Nội quy chỉ có ở hợp đồng khoá học: dịch vụ không truyền (undefined) để khỏi so.
    ...(now.contract.kind === 'COURSE' ? { rules: now.data.rules?.items ?? null } : {}),
  });
}
