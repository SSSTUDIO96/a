import { CONTRACT_STATUS_LABELS, formatLocalDate, formatVnd, type ContractPrintData, type PrintLine } from '@makeup/shared';

// Danh sách thay đổi giữa dữ liệu của lần in trước và dữ liệu hiện tại (hộp In, công tắc "In lại y hệt bản đã in").
// Hàm thuần: không đọc giờ, không gọi mạng. Mọi câu là tiếng Việt, ngắn, đủ để người in quyết định.

// So sánh sâu theo giá trị (khoá đối tượng không phụ thuộc thứ tự). Dữ liệu in chỉ gồm chuỗi, số, boolean, null, mảng, đối tượng.
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  if (ka.length !== Object.keys(rb).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && same(ra[k], rb[k]));
}

// Số mục "phát sinh sau khi xác nhận" (dòng gốc, dịch vụ phụ, phụ phí, phí di chuyển).
function addedAfterConfirmCount(lines: readonly PrintLine[]): number {
  let n = 0;
  for (const l of lines) {
    if (l.addedAfterConfirm) n += 1;
    for (const s of l.addons) if (s.addedAfterConfirm) n += 1;
    for (const s of l.surcharges) if (s.addedAfterConfirm) n += 1;
    if (l.travel?.addedAfterConfirm) n += 1;
  }
  return n;
}

const termsItems = (t: ContractPrintData['terms']) => (t === null ? null : t.items);

export function printDiff(old: ContractPrintData, now: ContractPrintData): string[] {
  const out: string[] = [];
  if (old.contract.status !== now.contract.status) {
    out.push(`Trạng thái hợp đồng: ${CONTRACT_STATUS_LABELS[old.contract.status]} → ${CONTRACT_STATUS_LABELS[now.contract.status]}`);
  }
  if (old.money.total !== now.money.total) out.push(`Tổng ${formatVnd(old.money.total)} → ${formatVnd(now.money.total)}`);
  else if (old.money.discount !== now.money.discount) out.push(`Giảm giá ${formatVnd(old.money.discount)} → ${formatVnd(now.money.discount)}`);

  const added = addedAfterConfirmCount(now.lines) - addedAfterConfirmCount(old.lines);
  if (added > 0) out.push(`Thêm ${added} dòng phát sinh`);
  else if (added < 0) out.push(`Bớt ${-added} dòng phát sinh`);
  else if (!same(old.lines, now.lines)) out.push('Dòng dịch vụ có thay đổi');

  if (old.payments !== null && now.payments !== null) {
    if (old.payments.paid < now.payments.paid) out.push(`Đã thu thêm ${formatVnd(now.payments.paid - old.payments.paid)}`);
    else if (old.payments.paid > now.payments.paid) out.push(`Đã thu giảm ${formatVnd(old.payments.paid - now.payments.paid)}`);
    else if (!same(old.payments, now.payments)) out.push('Tiến độ thanh toán hoặc phiếu thu có thay đổi');
  } else if ((old.payments === null) !== (now.payments === null)) {
    out.push(now.payments === null ? 'Phần thu tiền nay bị ẩn theo quyền của bạn' : 'Phần thu tiền nay hiện ra theo quyền của bạn');
  }

  if (!same(termsItems(old.terms), termsItems(now.terms))) out.push('Điều khoản đổi');
  if (!same(termsItems(old.rules), termsItems(now.rules))) out.push('Nội quy đổi');
  if (!same(old.studio, now.studio)) out.push('Thông tin studio đổi (tên, địa chỉ, người đại diện, ngân hàng…)');
  if (!same(old.customer, now.customer)) out.push('Thông tin khách đổi');
  if (old.contract.eventDate !== now.contract.eventDate) {
    const f = (d: string | null) => (d === null ? 'chưa có' : formatLocalDate(d));
    out.push(`Ngày sự kiện ${f(old.contract.eventDate)} → ${f(now.contract.eventDate)}`);
  }
  if (old.contract.notes !== now.contract.notes) out.push('Ghi chú hợp đồng đổi');
  // Dữ liệu khác nhau mà chưa có câu nào mô tả (ví dụ mã hợp đồng, ngày lập): vẫn phải nói là có đổi.
  if (out.length === 0 && !same(old, now)) out.push('Dữ liệu hợp đồng có thay đổi nhỏ');
  return out;
}
