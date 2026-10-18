// TRẦN DUY NHẤT cho mọi số tiền nhập tay: một phiếu thu/hoàn, giá bảng giá, cọc gói, phí di chuyển, tiền công theo bậc.
// 100 tỷ đồng — hợp đồng makeup lớn nhất thực tế cỡ vài trăm triệu; trần cũ là Number.MAX_SAFE_INTEGER (~9 triệu tỷ) nên
// gõ thừa vài số 0 vẫn lọt, và cộng vài số như vậy là vượt ngưỡng số nguyên an toàn (biên bản máy chủ lát 2, M3; thợ chấm
// web 2, T6: bảng giá nhận 900 nghìn tỷ không hỏi lại). Đổi trần thì đổi ở đây — không chép số sang nơi khác.
export const MAX_MONEY_VND = 100_000_000_000;

export const MONEY_TOO_LARGE_MESSAGE = `Số tiền quá lớn (tối đa ${MAX_MONEY_VND.toLocaleString('vi-VN')} đ)`;
