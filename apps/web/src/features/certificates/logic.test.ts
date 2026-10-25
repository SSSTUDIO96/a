import { describe, expect, it } from 'vitest';
import { asciiSlug, codeRange, estimateMegabytes, fontNumber, formatBytes, isLargeBatch, isSmallPhoto, pdfFileName, pngFileName, progressText, todayInTz, viDate, withPdfExt } from './logic';

describe('logic.ts: ngày, tên tệp, cỡ tệp', () => {
  it('viDate đổi YYYY-MM-DD → dd/mm/yyyy, sai dạng thì ném lỗi', () => {
    expect(viDate('2026-12-20')).toBe('20/12/2026');
    expect(() => viDate('20/12/2026')).toThrow('YYYY-MM-DD');
    expect(() => viDate('')).toThrow();
  });

  it('todayInTz theo múi giờ tổ chức, không theo UTC', () => {
    const t = new Date('2026-12-20T20:00:00Z');
    expect(todayInTz('Asia/Ho_Chi_Minh', t)).toBe('2026-12-21');
    expect(todayInTz('UTC', t)).toBe('2026-12-20');
    expect(() => todayInTz('')).toThrow('múi giờ');
  });

  it('asciiSlug bỏ dấu, đ → d, chỉ giữ [a-z0-9-]', () => {
    expect(asciiSlug('Lê Thị Mai')).toBe('le-thi-mai');
    expect(asciiSlug('Đặng Văn Đức')).toBe('dang-van-duc');
    expect(asciiSlug('Lớp K12 (sáng) / 2026')).toBe('lop-k12-sang-2026');
    expect(asciiSlug('')).toBe('');
  });

  it('tên PDF: một lớp một ngày cấp → có lớp + ngày; không có lớp → ngày hôm nay', () => {
    expect(pdfFileName({ className: 'K12 Tối', issuedOn: '2026-12-20', today: '2026-12-22' })).toBe('Giay-chung-nhan-k12-toi-2026-12-20.pdf');
    expect(pdfFileName({ className: null, issuedOn: null, today: '2026-12-22' })).toBe('Giay-chung-nhan-2026-12-22.pdf');
    expect(() => pdfFileName({ className: 'K1', issuedOn: '20/12/2026', today: '2026-12-22' })).toThrow();
    expect(() => pdfFileName({ className: null, issuedOn: null, today: 'hôm nay' })).toThrow();
  });

  it('tên PNG: GCN-{số}-{tên-không-dấu}.png', () => {
    expect(pngFileName('CC-2026-0007', 'Lê Thị Mai')).toBe('GCN-CC-2026-0007-le-thi-mai.png');
    expect(pngFileName('CC-2026-0007', '???')).toBe('GCN-CC-2026-0007.png');
    expect(() => pngFileName('', 'A')).toThrow();
  });

  it('withPdfExt thêm đuôi một lần, tên rỗng thì ném lỗi', () => {
    expect(withPdfExt('Giay-chung-nhan-K12')).toBe('Giay-chung-nhan-K12.pdf');
    expect(withPdfExt('a.PDF')).toBe('a.PDF');
    expect(() => withPdfExt(' ')).toThrow();
  });

  it('formatBytes, lô lớn, ước tính, tiến độ, dải số, phông, ảnh nhỏ', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(300 * 1024)).toBe('300 KB');
    expect(formatBytes(3.456 * 1024 * 1024)).toBe('3,5 MB');
    expect(() => formatBytes(-1)).toThrow();
    expect(isLargeBatch(60)).toBe(false);
    expect(isLargeBatch(61)).toBe(true);
    expect(estimateMegabytes(61)).toBe(27);
    expect(progressText(2, 8, 'Lê Thị Mai')).toBe('Đang vẽ 3/8 · Lê Thị Mai…');
    expect(progressText(8, 8, null)).toBe('Đã vẽ 8/8');
    expect(codeRange([{ code: 'CC-2026-0014' }, { code: 'CC-2026-0008' }, { code: 'CC-2026-0009' }])).toBe('CC-2026-0008 → 0014');
    expect(codeRange([{ code: 'CC-2026-0008' }])).toBe('CC-2026-0008');
    expect(fontNumber('ky-3')).toBe('3');
    expect(fontNumber(null)).toBeNull();
    expect(() => fontNumber('ky-9')).toThrow();
    expect(isSmallPhoto({ width: 200, height: 900 })).toBe(true);
    expect(isSmallPhoto({ width: 800, height: 900 })).toBe(false);
    expect(isSmallPhoto({ width: null, height: null })).toBe(false);
    expect(isSmallPhoto(null)).toBe(false);
  });
});
