// Tiền VND lưu bằng số nguyên đồng. Không bao giờ dùng số thực cho tiền.
export type Vnd = number;

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
