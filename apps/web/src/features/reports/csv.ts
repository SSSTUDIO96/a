import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from '@makeup/shared';
import type { PaymentLedgerEntry } from '../../api/types';
import { fmtDate } from '../payments/vnTime';

// Tải CSV sổ thu — tạo phía máy từ các phiếu đã tải đủ (máy chủ chưa có đường xuất riêng).
// Mở được bằng Excel tiếng Việt: có BOM UTF-8, phân cách dấu phẩy, số tiền là số nguyên đồng (phiếu hoàn mang dấu âm).

const HEADERS = ['Ngày thu', 'Mã phiếu', 'Loại phiếu', 'Trạng thái', 'Lý do huỷ', 'Mã hợp đồng', 'Khách', 'Cách trả', 'Số tiền (đồng)', 'Ghi chú', 'Người ghi'];

function cell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  // Chặn công thức khi mở bằng bảng tính (ô bắt đầu bằng = + - @ do người dùng gõ).
  const safe = typeof v === 'string' && /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function ledgerCsv(items: PaymentLedgerEntry[]): string {
  const lines = [HEADERS.map(cell).join(',')];
  for (const p of items) {
    lines.push(
      [
        fmtDate(p.receivedAt),
        p.code,
        PAYMENT_KIND_LABELS[p.kind],
        p.voidedAt ? 'Đã huỷ' : 'Hiệu lực',
        p.voidReason,
        p.contract.code,
        p.contract.customer.fullName,
        PAYMENT_METHOD_LABELS[p.method],
        p.kind === 'REFUND' ? -p.amount : p.amount,
        p.note,
        p.createdBy.fullName,
      ]
        .map(cell)
        .join(','),
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
