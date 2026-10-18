import { useMemo } from 'react';
import type { ContractPayments } from '../../api/types';
import { anchorOf, type SuggestAnchor } from './suggestPlan';

/**
 * Mốc cho gợi ý tiến độ (T1): ngày sự kiện; hợp đồng khoá học thì ngày kết thúc lớp muộn nhất — máy chủ trả sẵn trong
 * phản hồi tiến độ thu tiền (contract.courseEndDate), nên không còn hỏi thêm GET /contracts/:id + GET /classes (người chỉ có
 * quyền thu tiền từng bị 403 ở hai lời gọi đó và rơi về 30 ngày một đợt). Có ngay khi mở hộp, không có trạng thái "đang tải".
 */
export function useSuggestAnchor(contract: ContractPayments['contract']): SuggestAnchor | null {
  const { eventDate, courseEndDate } = contract;
  return useMemo(() => anchorOf({ eventDate, courseEndDate }), [eventDate, courseEndDate]);
}
