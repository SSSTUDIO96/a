// Trần tiền MỘT NGUỒN: hằng MAX_MONEY_VND nằm ở @makeup/shared (packages/shared/src/money.ts) để máy chủ và web dùng chung
// — ở đây chỉ nhập lại, không chép số. Lời báo lỗi của máy chủ dựng từ chính hằng đó.
import { MAX_MONEY_VND } from '@makeup/shared';

export { MAX_MONEY_VND };

export const MONEY_TOO_LARGE_MESSAGE = `Số tiền quá lớn (tối đa ${MAX_MONEY_VND.toLocaleString('vi-VN')} đ)`;
