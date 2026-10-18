// Tiền VND lưu bằng số nguyên đồng. Không bao giờ dùng số thực cho tiền.
export type Vnd = number;

// TRẦN DUY NHẤT cho mọi số tiền nhập tay (máy chủ + web): một phiếu thu/hoàn, giá bảng giá, cọc gói, phí di chuyển,
// tiền công theo bậc, mỗi dòng / tổng hợp đồng. 100 tỷ đồng — hợp đồng makeup lớn nhất thực tế cỡ vài trăm triệu; trần cũ
// là Number.MAX_SAFE_INTEGER (~9 triệu tỷ) nên gõ thừa vài số 0 vẫn lọt (biên bản máy chủ lát 2, M3; thợ chấm web 2, T6).
// Đổi trần thì đổi Ở ĐÂY và viết migration mới đổi CHECK "<= …" ở database (migration 20261018250000_tran_so_tien ghi
// số này; bài thử apps/api/test/tran-tien-mot-nguon.test.ts đỏ nếu hai nơi lệch). Không chép số sang nơi khác.
export const MAX_MONEY_VND: Vnd = 100_000_000_000;

export function assertVnd(value: unknown, field = 'số tiền'): Vnd {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RangeError(`${field} phải là số nguyên đồng, nhận: ${String(value)}`);
  }
  return value;
}

// Chuyển BigInt từ database sang số; ném lỗi nếu vượt ngưỡng an toàn thay vì làm tròn im lặng.
export function vndFromBigInt(value: bigint, field = 'số tiền'): Vnd {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${field} vượt ngưỡng số nguyên an toàn: ${value.toString()}`);
  }
  return Number(value);
}

export function formatVnd(value: Vnd): string {
  return `${assertVnd(value).toLocaleString('vi-VN')} ₫`;
}
