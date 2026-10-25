import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContractPrintData, PrintLine } from '@makeup/shared';
import { buildRows, courseWeekdays, dayMonth, isMultiDay, travelFormula, weekdayName, type PrintRow } from './rows';
import { SAMPLE } from './sampleData';

// Hàng in: mọi số tiền là BẢN SAO nguyên văn số trong PrintData (web không cộng / nhân tiền). Phụ phí in tên + số lượng + tiền.
const ALL: [string, ContractPrintData][] = [
  ['SERVICE.long', SAMPLE.SERVICE.long],
  ['SERVICE.short', SAMPLE.SERVICE.short],
  ['SERVICE.multiDay', SAMPLE.SERVICE.multiDay],
  ['SERVICE.longTable', SAMPLE.SERVICE.longTable],
  ['COURSE.long', SAMPLE.COURSE.long],
  ['COURSE.short', SAMPLE.COURSE.short],
];
const FULL = { detail: true, staff: true };

// Thứ tự hàng mong đợi, viết ĐỘC LẬP với buildRows: dòng gốc → dịch vụ phụ → phụ phí → phí di chuyển.
function expectedMoney(lines: PrintLine[]): { cap: 0 | 1; name: string; sl: number; dg: number; giam: number; tt: number }[] {
  const out: { cap: 0 | 1; name: string; sl: number; dg: number; giam: number; tt: number }[] = [];
  for (const l of lines) {
    out.push({ cap: 0, name: l.subjectName ? `${l.subjectName} — ${l.name}` : l.name, sl: l.quantity, dg: l.unitPrice, giam: l.lineDiscount, tt: l.lineTotal });
    for (const s of [...l.addons, ...l.surcharges, ...(l.travel ? [l.travel] : [])]) {
      out.push({ cap: 1, name: s.name, sl: s.quantity, dg: s.unitPrice, giam: s.lineDiscount, tt: s.lineTotal });
    }
  }
  return out;
}

describe('rows: số tiền trên hàng in đúng bằng số trong dữ liệu (không cộng lại)', () => {
  for (const [name, data] of ALL) {
    it(`${name}: từng hàng khớp từng số máy chủ trả (toBe), đúng thứ tự gốc → phụ → phụ phí → di chuyển`, () => {
      const rows = buildRows(data, FULL);
      const want = expectedMoney(data.lines);
      expect(rows).toHaveLength(want.length);
      rows.forEach((r, i) => {
        const w = want[i]!;
        expect({ cap: r.cap, ten: r.ten, sl: r.sl }).toEqual({ cap: w.cap, ten: w.name, sl: w.sl });
        expect(r.dg, `${name}[${i}] đơn giá`).toBe(w.dg);
        expect(r.giam, `${name}[${i}] giảm`).toBe(w.giam);
        expect(r.tt, `${name}[${i}] thành tiền`).toBe(w.tt);
      });
    });

    it(`${name}: fixture tự nhất quán — Σ lineTotal các dòng in (gồm phụ, phụ phí, di chuyển) = money.subtotal; subtotal − giảm = tổng`, () => {
      // Đây là kiểm DỮ LIỆU GIẢ (như bài máy chủ G-M4 sẽ kiểm dữ liệu thật); bộ vẽ không làm phép này.
      const sum = buildRows(data, FULL).reduce((s, r) => s + r.tt, 0);
      expect(sum).toBe(data.money.subtotal);
      expect(data.money.subtotal - data.money.discount).toBe(data.money.total);
    });
  }

  it('STT chỉ đánh cho dòng gốc, liên tục từ 1; dòng con không có STT', () => {
    const rows = buildRows(SAMPLE.SERVICE.long, FULL);
    expect(rows.filter((r) => r.cap === 0).map((r) => r.stt)).toEqual([1, 2]);
    expect(rows.filter((r) => r.cap === 1).every((r) => r.stt === null)).toBe(true);
  });

  it('mã nguồn bộ vẽ không có phép tính tiền (BẮT: quét rows.ts, model.ts, parts.tsx, layouts/*.tsx)', () => {
    const here = new URL('.', import.meta.url);
    const files = ['rows.ts', 'model.ts', 'parts.tsx', ...readdirSync(new URL('layouts/', here)).map((f) => `layouts/${f}`)];
    const money = '(unitPrice|lineTotal|lineDiscount|subtotal|total|discount|paid|remaining|amount|deposit|dg|tt|giam|sl|quantity|perKmAmount)';
    const arith = new RegExp(`\\b${money}\\b\\s*[-+*/%]\\s*[\\w(]|[\\w)]\\s*[-+*/%]\\s*\\b${money}\\b`);
    for (const f of files) {
      const src = readFileSync(new URL(f, here), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/"[^"\n]*"/g, '""') // tên lớp, thuộc tính JSX
        .replace(/'[^'\n]*'|`[^`\n]*`/g, (m) => (m.includes('${') ? m.replace(/\$\{/g, ' ${') : "''"));
      expect(src, `${f}: không được dùng reduce`).not.toMatch(/\.reduce\(/);
      const hit = src.split('\n').findIndex((ln) => arith.test(ln));
      expect(hit, `${f}:${hit + 1} có phép tính trên số tiền: ${src.split('\n')[hit]?.trim()}`).toBe(-1);
    }
  });
});

describe('rows: phụ phí in tên + số lượng + tiền, KHÔNG in tên luật / ghi chú ghi đè (đính chính 25/10/2026 mục 5)', () => {
  it('phụ phí ×2 của hợp đồng dài thành hai hàng con đúng tên, số lượng, đơn giá, thành tiền', () => {
    const rows = buildRows(SAMPLE.SERVICE.long, FULL);
    const sc = rows.filter((r) => r.cap === 1 && r.ten.startsWith('Phụ phí'));
    expect(sc.map((r) => [r.ten, r.sl, r.dg, r.tt])).toEqual([
      ['Phụ phí ca sớm (bắt đầu trước 5:30)', 1, 300_000, 300_000],
      ['Phụ phí ca sớm — phù dâu', 2, 50_000, 100_000],
    ]);
  });

  it('trường lạ (tên luật, ghi chú ghi đè, "tự thêm theo luật") có trong đối tượng cũng KHÔNG lọt ra hàng in', () => {
    const base = SAMPLE.SERVICE.long;
    const dirty = {
      ...base,
      lines: base.lines.map((l, i) =>
        i === 0
          ? {
              ...l,
              surcharges: l.surcharges.map((s) => ({ ...s, ruleName: 'LUAT-CA-SOM', ruleId: 'r-123', note: 'ghi đè giá thủ công', auto: true, source: 'tự thêm theo luật' })),
            }
          : l,
      ),
    } as ContractPrintData;
    const json = JSON.stringify(buildRows(dirty, FULL));
    for (const leak of ['LUAT-CA-SOM', 'r-123', 'ghi đè giá', 'tự thêm theo luật']) expect(json).not.toContain(leak);
  });
});

describe('rows: giờ, ngày, thợ, địa điểm, lịch học, công thức km', () => {
  it('hợp đồng MỘT ngày: "HH:MM–HH:MM · Thứ Bảy 12/12/2026" và không có tiền tố dd/mm', () => {
    expect(isMultiDay(SAMPLE.SERVICE.long.lines)).toBe(false);
    const r = buildRows(SAMPLE.SERVICE.long, FULL)[0]!;
    expect(r.chiTiet[0]).toBe('05:00–07:30 · Thứ Bảy 12/12/2026');
    expect(r.chiTiet.join('|')).not.toMatch(/\b12\/12 ·/);
  });

  it('hợp đồng NHIỀU ngày: mỗi dòng in "dd/mm · HH:MM–HH:MM" của riêng nó', () => {
    expect(isMultiDay(SAMPLE.SERVICE.multiDay.lines)).toBe(true);
    const rows = buildRows(SAMPLE.SERVICE.multiDay, FULL).filter((r) => r.cap === 0);
    expect(rows.map((r) => r.chiTiet[0])).toEqual(['11/12 · 06:30–08:30', '12/12 · 04:30–07:30', '13/12 · 08:00–09:30']);
  });

  it('nhiều ngày mà tắt "chi-tiet": giờ biến mất nhưng ngày dd/mm vẫn còn để phân biệt các dòng', () => {
    const rows = buildRows(SAMPLE.SERVICE.multiDay, { detail: false, staff: false }).filter((r) => r.cap === 0);
    expect(rows.map((r) => r.chiTiet)).toEqual([['11/12'], ['12/12'], ['13/12']]);
  });

  it('một ngày mà tắt "chi-tiet": không còn dòng giờ / địa điểm; ghi chú dòng vẫn in', () => {
    const rows = buildRows(SAMPLE.SERVICE.long, { detail: false, staff: false });
    expect(rows[0]!.chiTiet).toEqual(['Gồm makeup, làm tóc, 1 lần dặm lại trước lễ']);
  });

  it('thợ chính / thợ phụ; tắt khối "tho" thì không in', () => {
    const on = buildRows(SAMPLE.SERVICE.long, FULL);
    expect(on[0]!.chiTiet).toContain('Thợ chính: Chiến · Thợ phụ: Lan');
    expect(on.find((r) => r.ten.startsWith('Phù dâu'))!.chiTiet).toContain('Thợ chính: Hà');
    const off = buildRows(SAMPLE.SERVICE.long, { detail: true, staff: false });
    expect(off.flatMap((r) => r.chiTiet).join('|')).not.toContain('Thợ');
  });

  it('địa điểm theo loại: nhà khách / studio', () => {
    expect(buildRows(SAMPLE.SERVICE.long, FULL)[0]!.chiTiet).toContain('Tại nhà khách: Số 8 ngõ 102 Trường Chinh, Đống Đa, Hà Nội');
    expect(buildRows(SAMPLE.SERVICE.short, FULL)[0]!.chiTiet).toContain('Tại studio: Cơ sở Thái Hà — 25 Thái Hà, Đống Đa, Hà Nội');
  });

  it('công thức km đúng mẫu "18,4 km một chiều, gói miễn 10 km → vượt 8,4 km × 2 chiều = 16,8 km × 15.000 ₫"', () => {
    const travel = SAMPLE.SERVICE.long.lines[0]!.travel!;
    expect(travelFormula(travel)).toBe('18,4 km một chiều, gói miễn 10 km → vượt 8,4 km × 2 chiều = 16,8 km × 15.000 ₫');
    const row = buildRows(SAMPLE.SERVICE.long, FULL).find((r) => r.ten === 'Phí di chuyển')!;
    expect(row.chiTiet).toEqual([travelFormula(travel)]);
    expect(row.tt).toBe(252_000);
  });

  it('công thức km: một chiều không có "× 2 chiều"; studio miễn; thiếu số liệu thì rút gọn, không bịa', () => {
    const t = SAMPLE.SERVICE.long.lines[0]!.travel!;
    const oneWay = { ...t, breakdown: { ...t.breakdown!, roundTrip: false, includedFrom: 'ORGANIZATION' as const } };
    expect(travelFormula(oneWay)).toBe('18,4 km một chiều, studio miễn 10 km → vượt 8,4 km = 16,8 km × 15.000 ₫');
    expect(travelFormula({ ...t, breakdown: null })).toBe('Quãng đường 18,4 km');
    expect(travelFormula({ ...t, distanceKm: null })).toBeNull();
    expect(travelFormula({ ...t, breakdown: { ...t.breakdown!, tier: { fromKm: 10, toKm: 20, amount: 252_000 }, excessKm: null } })).toBe('Quãng đường 18,4 km, bậc 10–20 km');
  });

  it('khoá học: lớp, lịch, giảng viên, cơ sở', () => {
    const r = buildRows(SAMPLE.COURSE.long, FULL)[0]!;
    expect(r.chiTiet).toEqual([
      'Lớp K12 · 03/11/2026 – 26/12/2026',
      'Thứ 3, 5, 7 · 18:00–21:00 · 24 buổi',
      'Giảng viên: Nguyễn Trọng Chiến · Tại 25 Thái Hà, Đống Đa, Hà Nội',
    ]);
  });

  it('thứ trong tuần của lớp: 2,4,6 → "Thứ 3, 5, 7"; chỉ Chủ nhật → "Chủ nhật"; có CN → "Thứ 2, CN"; ngoài 1–7 → ném lỗi', () => {
    expect(courseWeekdays([2, 4, 6])).toBe('Thứ 3, 5, 7');
    expect(courseWeekdays([7])).toBe('Chủ nhật');
    expect(courseWeekdays([1, 7])).toBe('Thứ 2, CN');
    expect(() => courseWeekdays([0])).toThrow(RangeError);
    expect(() => courseWeekdays([8])).toThrow(RangeError);
  });

  it('"phát sinh dd/mm" cho dòng thêm sau lúc xác nhận', () => {
    const rows = buildRows(SAMPLE.SERVICE.multiDay, FULL).filter((r) => r.cap === 0);
    expect(rows.map((r) => r.phatSinh)).toEqual([null, null, 'phát sinh 28/10']);
  });

  it('ngày: dd/mm, tên thứ', () => {
    expect(dayMonth('2026-12-05')).toBe('05/12');
    expect(weekdayName('2026-12-12')).toBe('Thứ Bảy');
    expect(weekdayName('2026-12-13')).toBe('Chủ nhật');
  });
});

describe('rows: kiểu hàng', () => {
  it('PrintRow có đủ trường', () => {
    const r: PrintRow = buildRows(SAMPLE.SERVICE.short, FULL)[0]!;
    expect(Object.keys(r).sort()).toEqual(['cap', 'chiTiet', 'dg', 'giam', 'phatSinh', 'sl', 'stt', 'ten', 'tt']);
  });
});
