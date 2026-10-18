import { describe, expect, it } from 'vitest';
import { anchorNote, suggestDates } from './suggestPlan';

// Biên bản nghiệm thu cuối T1: "Cọc + 2/3 đợt" từng cách nhau cố định 30 ngày → đợt hạn sau ngày cưới / sau khi lớp kết thúc.
const TODAY = '2026-10-18';
const WEDDING = { date: '2026-11-22', kind: 'event' as const };
const CLASS_END = { date: '2026-11-30', kind: 'course' as const };

describe('suggestDates — chia đều từ hôm nay tới mốc', () => {
  it('HD-000001 (cưới 22/11): Cọc + 2 đợt → cọc hôm nay, đợt cuối đúng ngày cưới, không đợt nào sau ngày cưới', () => {
    const r = suggestDates(TODAY, WEDDING, 2, true);
    expect(r).toEqual({ ok: true, days: ['2026-10-18', '2026-11-05', '2026-11-22'], note: null });
  });

  it('Cọc + 3 đợt tới ngày cưới: khoảng cách đều (±1 ngày), tăng dần, đợt cuối = ngày cưới', () => {
    const r = suggestDates(TODAY, WEDDING, 3, true);
    expect(r.ok && r.days).toEqual(['2026-10-18', '2026-10-30', '2026-11-10', '2026-11-22']);
  });

  it('HĐKH (lớp kết thúc 30/11): đợt cuối = ngày kết thúc lớp, không phải 18/12', () => {
    const r = suggestDates(TODAY, CLASS_END, 2, true);
    expect(r.ok && r.days).toEqual(['2026-10-18', '2026-11-09', '2026-11-30']);
  });

  it('không có cọc: chỉ n đợt, đợt cuối = mốc', () => {
    expect(suggestDates(TODAY, WEDDING, 2, false)).toEqual({ ok: true, days: ['2026-11-05', '2026-11-22'], note: null });
    expect(suggestDates(TODAY, WEDDING, 1, false)).toEqual({ ok: true, days: ['2026-11-22'], note: null });
  });

  it('mốc vừa đủ chỗ (còn đúng n ngày): mỗi đợt cách nhau đúng 1 ngày', () => {
    const r = suggestDates(TODAY, { date: '2026-10-21', kind: 'event' }, 3, true);
    expect(r.ok && r.days).toEqual(['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']);
  });

  it('mốc quá gần (còn ít hơn n ngày) → không gợi ý, nói rõ vì sao; không dồn đợt cùng ngày, không đẩy ra sau mốc', () => {
    expect(suggestDates(TODAY, { date: '2026-10-20', kind: 'event' }, 3, true)).toEqual({
      ok: false,
      reason:
        'Còn 2 ngày tới ngày sự kiện (20/10/2026): không đủ chỗ cho 3 đợt cách nhau ít nhất 1 ngày mà không đợt nào hạn sau ngày sự kiện. Chia ít đợt hơn hoặc sửa tay hạn từng đợt.',
    });
    expect(suggestDates(TODAY, { date: '2026-10-20', kind: 'event' }, 2, true).ok).toBe(true);
    const sameDay = suggestDates(TODAY, { date: TODAY, kind: 'course' }, 1, true);
    expect(sameDay.ok).toBe(false);
    expect(!sameDay.ok && sameDay.reason).toMatch(/^Hôm nay là ngày kết thúc lớp: không đủ chỗ cho 1 đợt/);
  });

  it('mốc đã qua → giữ 30 ngày một đợt kể từ hôm nay, kèm ghi chú', () => {
    expect(suggestDates(TODAY, { date: '2026-10-01', kind: 'event' }, 2, true)).toEqual({
      ok: true,
      days: ['2026-10-18', '2026-11-17', '2026-12-17'],
      note: 'Ngày sự kiện (01/10/2026) đã qua — gợi ý chia 30 ngày một đợt kể từ hôm nay.',
    });
  });

  it('không có mốc → giữ 30 ngày một đợt (như cũ), đợt đầu không cọc hạn hôm nay', () => {
    expect(suggestDates(TODAY, null, 2, true)).toEqual({ ok: true, days: ['2026-10-18', '2026-11-17', '2026-12-17'], note: null });
    expect(suggestDates(TODAY, null, 2, false)).toEqual({ ok: true, days: ['2026-10-18', '2026-11-17'], note: null });
  });

  it('mọi số ngày tới mốc 0..400 × 1..3 đợt × có/không cọc: hoặc tắt, hoặc ngày tăng ngặt và đợt cuối đúng mốc', () => {
    const add = (n: number) => new Date(Date.UTC(2026, 9, 18) + n * 86_400_000).toISOString().slice(0, 10);
    for (let d = 0; d <= 400; d++) {
      for (const n of [1, 2, 3]) {
        for (const dep of [true, false]) {
          const r = suggestDates(TODAY, { date: add(d), kind: 'event' }, n, dep);
          if (d < n) {
            expect(r.ok).toBe(false);
            continue;
          }
          if (!r.ok) throw new Error(`d=${d} n=${n}`);
          expect(r.days).toHaveLength(n + (dep ? 1 : 0));
          expect(r.days.at(-1)).toBe(add(d));
          for (let i = 1; i < r.days.length; i++) expect(r.days[i]! > r.days[i - 1]!).toBe(true);
          expect(r.days[0]! >= TODAY).toBe(true);
        }
      }
    }
  });
});

describe('anchorNote', () => {
  it('nói rõ mốc chia đợt; mốc đã qua hoặc không có mốc → không ghi', () => {
    expect(anchorNote(TODAY, WEDDING)).toBe('Các đợt chia đều từ hôm nay tới ngày sự kiện 22/11/2026; không đợt nào hạn sau ngày đó.');
    expect(anchorNote(TODAY, CLASS_END)).toContain('ngày kết thúc lớp 30/11/2026 (lớp kết thúc muộn nhất trong hợp đồng)');
    expect(anchorNote(TODAY, { date: '2026-10-01', kind: 'event' })).toBeNull();
    expect(anchorNote(TODAY, null)).toBeNull();
  });
});
