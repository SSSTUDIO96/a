// Ngày hạn của gợi ý "Cọc + n đợt" (biên bản nghiệm thu cuối T1, quyết định điều phối 01:40).
// Chỉ đổi NGÀY: tiền từng đợt vẫn do suggestInstallments của @makeup/shared chia (máy chủ kiểm lại khi lưu).
//
// Luật:
// - Có mốc (ngày sự kiện; hợp đồng khoá học: ngày kết thúc lớp muộn nhất) và còn đủ chỗ: đợt cọc hạn hôm nay, n đợt còn
//   lại chia đều từ hôm nay tới mốc — đợt i hạn hôm nay + round(i × D / n) ngày (D = số ngày tới mốc), nên đợt cuối
//   đúng ngày mốc, không đợt nào muộn hơn mốc, hai đợt liền nhau cách nhau ít nhất 1 ngày.
// - Mốc còn D ngày mà D < n (kể cả mốc là hôm nay): không đủ chỗ cho n đợt cách nhau ≥ 1 ngày → KHÔNG gợi ý (nút tắt,
//   ghi lý do). Không dồn nhiều đợt vào cùng một ngày, không đẩy đợt nào ra sau mốc.
// - Mốc đã qua: không còn ngày nào trước mốc → giữ cách cũ (30 ngày một đợt kể từ hôm nay) và ghi rõ là mốc đã qua.
// - Không có mốc: giữ cách cũ (30 ngày một đợt).
import { addDays, daysBetween, fmtIsoDay } from './vnTime';

export const SUGGEST_INTERVAL_DAYS = 30;

export interface SuggestAnchor {
  /** "YYYY-MM-DD" giờ Việt Nam. */
  date: string;
  kind: 'event' | 'course';
}

export type SuggestDates =
  /** Ngày hạn theo đúng thứ tự các đợt suggestInstallments trả (đợt cọc trước, nếu có). */
  | { ok: true; days: string[]; note: string | null }
  | { ok: false; reason: string };

const anchorName = (a: SuggestAnchor) => (a.kind === 'event' ? 'ngày sự kiện' : 'ngày kết thúc lớp');

/** Có thể gợi ý n đợt không (để tắt nút trước khi bấm). */
export function suggestDates(today: string, anchor: SuggestAnchor | null, count: number, hasDeposit: boolean): SuggestDates {
  const slots = count + (hasDeposit ? 1 : 0);
  const every30 = (note: string | null): SuggestDates => ({
    ok: true,
    days: Array.from({ length: slots }, (_, i) => addDays(today, i * SUGGEST_INTERVAL_DAYS)),
    note,
  });
  if (!anchor) return every30(null);
  const d = daysBetween(today, anchor.date);
  if (d < 0) {
    return every30(
      `${anchorName(anchor)[0]!.toUpperCase()}${anchorName(anchor).slice(1)} (${fmtIsoDay(anchor.date)}) đã qua — gợi ý chia ${SUGGEST_INTERVAL_DAYS} ngày một đợt kể từ hôm nay.`,
    );
  }
  if (d < count) {
    const left = d === 0 ? `Hôm nay là ${anchorName(anchor)}` : `Còn ${d} ngày tới ${anchorName(anchor)} (${fmtIsoDay(anchor.date)})`;
    return {
      ok: false,
      reason: `${left}: không đủ chỗ cho ${count} đợt cách nhau ít nhất 1 ngày mà không đợt nào hạn sau ${anchorName(anchor)}. Chia ít đợt hơn hoặc sửa tay hạn từng đợt.`,
    };
  }
  const rest = Array.from({ length: count }, (_, i) => addDays(today, Math.round(((i + 1) * d) / count)));
  return { ok: true, days: hasDeposit ? [today, ...rest] : rest, note: null };
}

/** Dòng giải thích dưới các nút gợi ý: các đợt chia tới mốc nào. */
export function anchorNote(today: string, anchor: SuggestAnchor | null): string | null {
  if (!anchor || daysBetween(today, anchor.date) < 0) return null;
  return anchor.kind === 'event'
    ? `Các đợt chia đều từ hôm nay tới ngày sự kiện ${fmtIsoDay(anchor.date)}; không đợt nào hạn sau ngày đó.`
    : `Các đợt chia đều từ hôm nay tới ngày kết thúc lớp ${fmtIsoDay(anchor.date)} (lớp kết thúc muộn nhất trong hợp đồng); không đợt nào hạn sau ngày đó.`;
}
