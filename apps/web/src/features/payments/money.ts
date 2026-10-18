import { formatVnd, type Vnd } from '@makeup/shared';

// Hiện số tiền máy chủ trả. Không tính lại: chỉ đổi dạng chữ.
// - Số âm dùng dấu trừ "−" (U+2212), ví dụ hoàn nhiều hơn thu trong kỳ: "−300.000 ₫".
// - null (máy chủ báo tổng vượt ngưỡng / hợp đồng đã huỷ không còn phải thu): "—".
export function money(v: Vnd | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v < 0 ? `−${formatVnd(-v)}` : formatVnd(v);
}

/** Số tiền một phiếu: phiếu hoàn có dấu "−" phía trước. */
export function paymentAmount(kind: 'RECEIPT' | 'REFUND', amount: Vnd): string {
  return kind === 'REFUND' ? `−${formatVnd(amount)}` : formatVnd(amount);
}
