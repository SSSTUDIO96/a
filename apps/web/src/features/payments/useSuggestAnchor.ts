import { useEffect, useState } from 'react';
import { getContract } from '../../api/contracts';
import { listClasses } from '../../api/courses';
import type { ContractPayments } from '../../api/types';
import type { SuggestAnchor } from './suggestPlan';
import { vnDate } from './vnTime';

export type AnchorState = { status: 'loading' } | { status: 'ready'; anchor: SuggestAnchor | null };

/**
 * Mốc cho gợi ý tiến độ: ngày sự kiện của hợp đồng; hợp đồng không có ngày sự kiện mà là hợp đồng khoá học thì lấy NGÀY
 * KẾT THÚC LỚP muộn nhất trong các dòng khoá học chưa huỷ (GET /contracts/:id → courseClassId; GET /classes → endDate,
 * lớp đã huỷ không tính). Phản hồi tiến độ thu tiền (GET /contracts/:id/payments) không mang ngày lớp nên phải hỏi thêm.
 * Không đọc được (thiếu quyền contracts.read / courses.read, lỗi mạng) → không có mốc: gợi ý giữ 30 ngày một đợt.
 */
export function useSuggestAnchor(orgId: string, contract: ContractPayments['contract'], open: boolean): AnchorState {
  const eventDay = contract.eventDate ? vnDate(contract.eventDate) : null;
  const [course, setCourse] = useState<AnchorState>({ status: 'loading' });

  useEffect(() => {
    if (!open || eventDay) return;
    const controller = new AbortController();
    setCourse({ status: 'loading' });
    (async () => {
      const detail = await getContract(orgId, contract.id, controller.signal);
      if (detail.kind !== 'COURSE') return null;
      const ids = new Set(
        (detail.lines ?? []).filter((l) => l.kind === 'COURSE' && !l.voidedAt && l.courseClassId).map((l) => l.courseClassId as string),
      );
      if (ids.size === 0) return null;
      const { items } = await listClasses(orgId, { includeCancelled: true, includeArchived: true }, controller.signal);
      const ends = items.filter((k) => ids.has(k.id) && k.status !== 'CANCELLED').map((k) => k.endDate.slice(0, 10));
      if (ends.length === 0) return null;
      ends.sort();
      return { date: ends[ends.length - 1] as string, kind: 'course' as const };
    })()
      .catch(() => null)
      .then((anchor) => {
        if (!controller.signal.aborted) setCourse({ status: 'ready', anchor });
      });
    return () => controller.abort();
  }, [open, eventDay, orgId, contract.id]);

  if (eventDay) return { status: 'ready', anchor: { date: eventDay, kind: 'event' } };
  return course;
}
