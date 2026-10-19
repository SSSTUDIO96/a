import { api } from './client';
import { orgPath } from './org';
import type { TodayView } from './types';

// Trang Hôm nay (bản vẽ D 2.6; apps/api/src/modules/today/). Cần org.read để vào; từng thẻ theo quyền — thẻ thiếu quyền
// trả null (ẩn thẻ), có quyền mà không có gì trả mảng rỗng. Chỉ đọc, không ghi nhật ký, không idempotent.
// Con số tiền do máy chủ tính (theo tiền đã thu đến lúc gọi) — web chỉ định dạng, không tự cộng.
export function getToday(orgId: string, signal?: AbortSignal) {
  return api.get<TodayView>(orgPath(orgId, '/today'), signal);
}
