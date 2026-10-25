import { describe, expect, expectTypeOf, it } from 'vitest';
import { MAX_MONEY_VND } from './money';
import { PERMISSIONS } from './permissions';
import {
  ALWAYS_ON_BLOCKS,
  DEFAULT_CLOSING_TEXT,
  DEFAULT_OPENING_TEXT,
  DEFAULT_PRINT_TITLE,
  LAYOUT_DEFAULT_OFF,
  PRINT_BLANK,
  PRINT_BLOCK_KEYS,
  PRINT_DATA_VERSION,
  PRINT_LAYOUTS,
  PRINT_LAYOUT_NAMES,
  PRINT_VARIABLES,
  PrintCatalogError,
  TOGGLE_BLOCKS,
  TOGGLE_BLOCK_KEYS,
  VndInWordsError,
  checkTemplateText,
  fillVariables,
  formatLocalDate,
  longLocalDate,
  resolvePrintConfig,
  splitClauses,
  variableValues,
  variablesIn,
  vndInWords,
  type ContractPrintData,
  type PrintBlockKey,
  type PrintLayout,
  type PrintLine,
  type PrintSubLine,
  type PrintTemplateLike,
  type PrintTravel,
  type ResolvedPrintConfig,
  type ToggleBlockKey,
} from './print';

// =====================================================================================================================
// Tiền bằng chữ
// =====================================================================================================================

// Bộ đọc ngược NGHIÊM (độc lập với vndInWords): chỉ nhận đúng dạng chuẩn, trả số; sai dạng → ném lỗi kèm lý do.
// Luật: "linh" chỉ sau "trăm" và trước một chữ số (dạng thường: một, bốn, năm); sau "mười": một, bốn, lăm (không "năm",
// "tư", "mốt"); sau "X mươi": mốt, tư, lăm (không "một", "bốn", "năm"); nhóm KHÔNG đứng đầu phải có "… trăm"
// (kể cả "không trăm"); nhóm đầu không được bắt đầu bằng "không trăm"; đơn vị giảm dần tỷ > triệu > nghìn.
const DIGIT: Record<string, number> = { không: 0, một: 1, hai: 2, ba: 3, bốn: 4, năm: 5, sáu: 6, bảy: 7, tám: 8, chín: 9 };
const UNIT: Record<string, number> = { tỷ: 1_000_000_000, triệu: 1_000_000, nghìn: 1_000 };
const AFTER_LINH: Record<string, number> = { một: 1, hai: 2, ba: 3, bốn: 4, năm: 5, sáu: 6, bảy: 7, tám: 8, chín: 9 };
const AFTER_MUOI_10: Record<string, number> = { một: 1, hai: 2, ba: 3, bốn: 4, lăm: 5, sáu: 6, bảy: 7, tám: 8, chín: 9 };
const AFTER_MUOI_X: Record<string, number> = { mốt: 1, hai: 2, ba: 3, tư: 4, lăm: 5, sáu: 6, bảy: 7, tám: 8, chín: 9 };
const has = (o: Record<string, number>, k: string | undefined): k is string => k !== undefined && Object.prototype.hasOwnProperty.call(o, k);

function parseVndWords(s: string): number {
  if (!s.endsWith(' đồng')) throw new Error('thiếu " đồng" ở cuối');
  if (s.charAt(0) !== s.charAt(0).toUpperCase() || s.charAt(0) === s.charAt(0).toLowerCase()) throw new Error('chữ đầu chưa viết hoa');
  const body = s.slice(0, -' đồng'.length);
  if (body.slice(1) !== body.slice(1).toLowerCase()) throw new Error('chữ hoa giữa câu');
  const tok = (body.charAt(0).toLowerCase() + body.slice(1)).split(' ');
  if (tok.some((t) => t === '')) throw new Error('thừa dấu cách');
  if (tok.length === 1 && tok[0] === 'không') return 0;
  let i = 0;
  let total = 0;
  let lastUnit = Infinity;
  let first = true;
  while (i < tok.length) {
    let g = 0;
    let hasHundreds = false;
    if (has(DIGIT, tok[i]) && tok[i + 1] === 'trăm') {
      const h = DIGIT[tok[i]!]!;
      if (first && h === 0) throw new Error('nhóm đầu bắt đầu bằng "không trăm"');
      g = h * 100;
      hasHundreds = true;
      i += 2;
    } else if (!first) {
      throw new Error(`nhóm giữa thiếu "… trăm" ở "${tok.slice(i).join(' ')}"`);
    }
    const t = tok[i];
    if (t === 'linh') {
      if (!hasHundreds) throw new Error('"linh" không đứng sau "trăm"');
      if (!has(AFTER_LINH, tok[i + 1])) throw new Error(`sau "linh" phải là chữ số thường, gặp "${tok[i + 1]}"`);
      g += AFTER_LINH[tok[i + 1]!]!;
      i += 2;
    } else if (t === 'mười') {
      g += 10;
      i += 1;
      if (has(AFTER_MUOI_10, tok[i])) g += AFTER_MUOI_10[tok[i++]!]!;
      else if (tok[i] !== undefined && !has(UNIT, tok[i])) throw new Error(`sau "mười" gặp "${tok[i]}"`);
    } else if (has(DIGIT, t) && DIGIT[t]! >= 2 && tok[i + 1] === 'mươi') {
      g += DIGIT[t]! * 10;
      i += 2;
      if (has(AFTER_MUOI_X, tok[i])) g += AFTER_MUOI_X[tok[i++]!]!;
      else if (tok[i] !== undefined && !has(UNIT, tok[i])) throw new Error(`sau "mươi" gặp "${tok[i]}"`);
    } else if (!hasHundreds && has(DIGIT, t) && DIGIT[t]! >= 1) {
      g += DIGIT[t]!;
      i += 1;
    } else if (t !== undefined && !has(UNIT, t)) {
      throw new Error(`chữ lạ hoặc sai chỗ: "${t}"`);
    }
    if (g === 0) throw new Error('nhóm bằng không mà vẫn đọc');
    const u = tok[i];
    if (u === undefined) {
      total += g;
    } else if (has(UNIT, u)) {
      const v = UNIT[u]!;
      if (v >= lastUnit) throw new Error(`đơn vị không giảm dần ở "${u}"`);
      lastUnit = v;
      total += g * v;
      i += 1;
    } else {
      throw new Error(`thiếu đơn vị trước "${u}"`);
    }
    first = false;
  }
  return total;
}

// Bảng ca khó (bản vẽ G mục 3.1 + lệnh giao gói). Đọc "linh" theo ký duyệt G mục 8.
const CASES: [number, string][] = [
  [0, 'Không đồng'],
  [1, 'Một đồng'],
  [4, 'Bốn đồng'],
  [5, 'Năm đồng'],
  [9, 'Chín đồng'],
  [10, 'Mười đồng'],
  [11, 'Mười một đồng'],
  [14, 'Mười bốn đồng'],
  [15, 'Mười lăm đồng'],
  [19, 'Mười chín đồng'],
  [20, 'Hai mươi đồng'],
  [21, 'Hai mươi mốt đồng'],
  [24, 'Hai mươi tư đồng'],
  [25, 'Hai mươi lăm đồng'],
  [31, 'Ba mươi mốt đồng'],
  [44, 'Bốn mươi tư đồng'],
  [45, 'Bốn mươi lăm đồng'],
  [50, 'Năm mươi đồng'],
  [55, 'Năm mươi lăm đồng'],
  [91, 'Chín mươi mốt đồng'],
  [99, 'Chín mươi chín đồng'],
  [100, 'Một trăm đồng'],
  [101, 'Một trăm linh một đồng'],
  [104, 'Một trăm linh bốn đồng'],
  [105, 'Một trăm linh năm đồng'],
  [110, 'Một trăm mười đồng'],
  [111, 'Một trăm mười một đồng'],
  [115, 'Một trăm mười lăm đồng'],
  [121, 'Một trăm hai mươi mốt đồng'],
  [205, 'Hai trăm linh năm đồng'],
  [999, 'Chín trăm chín mươi chín đồng'],
  [1_000, 'Một nghìn đồng'],
  [1_001, 'Một nghìn không trăm linh một đồng'],
  [1_005, 'Một nghìn không trăm linh năm đồng'],
  [1_010, 'Một nghìn không trăm mười đồng'],
  [1_015, 'Một nghìn không trăm mười lăm đồng'],
  [1_021, 'Một nghìn không trăm hai mươi mốt đồng'],
  [1_100, 'Một nghìn một trăm đồng'],
  [2_024, 'Hai nghìn không trăm hai mươi tư đồng'],
  [10_000, 'Mười nghìn đồng'],
  [15_000, 'Mười lăm nghìn đồng'],
  [21_000, 'Hai mươi mốt nghìn đồng'],
  [24_000, 'Hai mươi tư nghìn đồng'],
  [100_000, 'Một trăm nghìn đồng'],
  [105_000, 'Một trăm linh năm nghìn đồng'],
  [250_000, 'Hai trăm năm mươi nghìn đồng'],
  [500_000, 'Năm trăm nghìn đồng'],
  [1_000_000, 'Một triệu đồng'],
  [1_000_001, 'Một triệu không trăm linh một đồng'],
  [1_000_005, 'Một triệu không trăm linh năm đồng'],
  [1_000_010, 'Một triệu không trăm mười đồng'],
  [1_001_000, 'Một triệu không trăm linh một nghìn đồng'],
  [1_050_000, 'Một triệu không trăm năm mươi nghìn đồng'],
  [1_500_000, 'Một triệu năm trăm nghìn đồng'],
  [2_005_000, 'Hai triệu không trăm linh năm nghìn đồng'],
  [7_152_000, 'Bảy triệu một trăm năm mươi hai nghìn đồng'],
  [10_000_000, 'Mười triệu đồng'],
  [15_200_000, 'Mười lăm triệu hai trăm nghìn đồng'],
  [21_000_000, 'Hai mươi mốt triệu đồng'],
  [25_500_000, 'Hai mươi lăm triệu năm trăm nghìn đồng'],
  [100_000_000, 'Một trăm triệu đồng'],
  [999_999_999, 'Chín trăm chín mươi chín triệu chín trăm chín mươi chín nghìn chín trăm chín mươi chín đồng'],
  [1_000_000_000, 'Một tỷ đồng'],
  [1_000_000_001, 'Một tỷ không trăm linh một đồng'],
  [1_001_000_000, 'Một tỷ không trăm linh một triệu đồng'],
  [1_500_000_000, 'Một tỷ năm trăm triệu đồng'],
  [2_000_500_000, 'Hai tỷ năm trăm nghìn đồng'],
  [15_000_000_015, 'Mười lăm tỷ không trăm mười lăm đồng'],
  [21_024_000_105, 'Hai mươi mốt tỷ không trăm hai mươi tư triệu một trăm linh năm đồng'],
  [99_999_999_999, 'Chín mươi chín tỷ chín trăm chín mươi chín triệu chín trăm chín mươi chín nghìn chín trăm chín mươi chín đồng'],
  [100_000_000_000, 'Một trăm tỷ đồng'],
];

describe('vndInWords — bảng ca khó', () => {
  it('bảng có ít nhất 60 ca, không trùng số', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(CASES.map(([n]) => n)).size).toBe(CASES.length);
  });
  it.each(CASES)('%i → %s', (n, words) => {
    expect(vndInWords(n)).toBe(words);
  });
  it.each(CASES)('bộ đọc ngược nghiêm nhận %i', (n, words) => {
    expect(parseVndWords(words)).toBe(n);
  });
  it('nhận bigint (cột BIGINT database) cho ra đúng chữ như số', () => {
    for (const [n, words] of CASES) expect(vndInWords(BigInt(n))).toBe(words);
  });
});

describe('vndInWords — quét tự động', () => {
  const check = (n: number): string | null => {
    const w = vndInWords(n);
    try {
      const back = parseVndWords(w);
      return back === n ? null : `${n} → "${w}" đọc ngược ra ${back}`;
    } catch (e) {
      return `${n} → "${w}": ${(e as Error).message}`;
    }
  };
  it('0..2.000: mọi số đọc ngược đúng, đúng dạng chuẩn', () => {
    const bad: string[] = [];
    for (let n = 0; n <= 2_000; n++) {
      const r = check(n);
      if (r) bad.push(r);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
  it('mọi số dạng a·10^k + b quanh ranh giới nhóm (nghìn, triệu, tỷ)', () => {
    const bad: string[] = [];
    const tails = [0, 1, 4, 5, 10, 11, 14, 15, 21, 24, 25, 100, 101, 105, 110, 115, 999];
    for (const base of [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 1_000_000_000, 10_000_000_000]) {
      for (const a of [1, 2, 4, 5, 9]) {
        for (const b of tails) {
          for (const mid of [0, 1_000, 5_000, 105_000]) {
            const n = a * base + b + (base > 1_000_000 ? mid : 0);
            if (n > MAX_MONEY_VND) continue;
            const r = check(n);
            if (r) bad.push(r);
          }
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
  it('5.000 số giả ngẫu nhiên (cố định hạt giống) trong 0..MAX_MONEY_VND', () => {
    let seed = 20261025;
    const next = () => {
      seed = (seed * 48_271) % 2_147_483_647; // Park–Miller, mọi phép tính dưới 2^53
      return seed;
    };
    const bad: string[] = [];
    for (let k = 0; k < 5_000; k++) {
      const n = Math.min(MAX_MONEY_VND, (next() % 100_001) * 1_000_000 + (next() % 1_000_000));
      const r = check(n);
      if (r) bad.push(r);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

describe('vndInWords — luật chữ', () => {
  const sample = Array.from({ length: 3_000 }, (_, i) => vndInWords(i * 337 + i));
  it('không bao giờ dùng "lẻ" (ký duyệt G: "linh")', () => {
    expect(sample.filter((s) => /\blẻ\b/.test(s))).toEqual([]);
  });
  it('không có "mươi một", "mươi bốn", "mươi năm", "mười năm", "mười tư", "mười mốt", "linh lăm", "linh tư", "linh mốt"', () => {
    const banned = /mươi một|mươi bốn|mươi năm|mười năm|mười tư|mười mốt|linh lăm|linh tư|linh mốt/u;
    expect(sample.filter((s) => banned.test(s))).toEqual([]);
  });
  it('chữ đầu viết hoa, phần sau viết thường, kết thúc " đồng", không thừa dấu cách', () => {
    for (const s of sample) {
      expect(s).toMatch(/^\p{Lu}[\p{Ll} ]* đồng$/u);
      expect(s).not.toMatch(/ {2}/);
    }
  });
});

describe('vndInWords — ném lỗi có tên, không trả chuỗi rỗng', () => {
  const bad: [string, unknown][] = [
    ['số âm −1', -1],
    ['số âm −1.000.000', -1_000_000],
    ['không nguyên 1.5', 1.5],
    ['không nguyên 0.1', 0.1],
    ['vượt trần 100.000.000.001', MAX_MONEY_VND + 1],
    ['vượt trần 1.000 tỷ', 1_000_000_000_000],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['chuỗi "100"', '100'],
    ['null', null],
    ['bigint âm', -1n],
    ['bigint vượt trần', BigInt(MAX_MONEY_VND) + 1n],
  ];
  it.each(bad)('%s → VndInWordsError', (_label, v) => {
    expect(() => vndInWords(v as number)).toThrow(VndInWordsError);
    try {
      vndInWords(v as number);
    } catch (e) {
      expect((e as Error).name).toBe('VndInWordsError');
      expect(e).toBeInstanceOf(RangeError);
      expect((e as Error).message.length).toBeGreaterThan(0);
    }
  });
  it('đúng trần MAX_MONEY_VND vẫn đọc được', () => {
    expect(vndInWords(MAX_MONEY_VND)).toBe('Một trăm tỷ đồng');
  });
});

// =====================================================================================================================
// Danh mục
// =====================================================================================================================

// Khoá khối của R&D, chép từ docs/rnd/v9-mau-in/chung/ban-in.js:22-44 (KHOI) và :46 (MAC_DINH_TAT).
const RND_KHOI = [
  'quoc-hieu', 'dau-trang', 'tieu-de', 'hai-ben', 'giay-to', 'chu-dau', 'dich-vu', 'chi-tiet', 'tho', 'tien', 'bang-chu',
  'tien-do', 'da-thu', 'chuyen-khoan', 'dieu-khoan', 'noi-quy', 'ghi-chu', 'chu-cuoi', 'chu-ky', 'ky-nhay', 'so-trang',
];
const RND_MAC_DINH_TAT = { 1: [], 2: ['quoc-hieu', 'ky-nhay'], 3: ['quoc-hieu'], 4: ['quoc-hieu', 'ky-nhay', 'giay-to'], 5: ['quoc-hieu', 'ky-nhay'] };

describe('danh mục bố cục + khối', () => {
  it('5 bố cục, tên tiếng Việt đúng bản vẽ', () => {
    expect(PRINT_LAYOUTS).toEqual([1, 2, 3, 4, 5]);
    expect(PRINT_LAYOUT_NAMES).toEqual({
      1: 'Cổ điển trang trọng', 2: 'Hiện đại tối giản', 3: 'Bảng kẻ đầy đủ', 4: 'Gọn một trang', 5: 'Sang trọng viền & logo lớn',
    });
  });
  it('4 khối luôn có + 17 khối bật/tắt = đúng 21 khoá của R&D, không trùng', () => {
    expect(ALWAYS_ON_BLOCKS).toEqual(['tieu-de', 'dich-vu', 'tien', 'chu-ky']);
    expect(TOGGLE_BLOCK_KEYS).toHaveLength(17);
    expect(PRINT_BLOCK_KEYS).toHaveLength(21);
    expect(new Set(PRINT_BLOCK_KEYS).size).toBe(21);
    expect([...PRINT_BLOCK_KEYS].sort()).toEqual([...RND_KHOI].sort());
    for (const k of ALWAYS_ON_BLOCKS) expect(Object.keys(TOGGLE_BLOCKS)).not.toContain(k);
  });
  it('mỗi khối bật/tắt có nhãn tiếng Việt, kinds không rỗng, chỉ SERVICE/COURSE', () => {
    for (const k of TOGGLE_BLOCK_KEYS) {
      const b = TOGGLE_BLOCKS[k];
      expect(b.label.length, k).toBeGreaterThan(0);
      expect(b.kinds.length, k).toBeGreaterThan(0);
      for (const kind of b.kinds) expect(['SERVICE', 'COURSE']).toContain(kind);
    }
    expect(TOGGLE_BLOCKS.tho.kinds).toEqual(['SERVICE']);
    expect(TOGGLE_BLOCKS['noi-quy'].kinds).toEqual(['COURSE']);
    expect(TOGGLE_BLOCKS['bang-chu'].hint).toContain(vndInWords(7_152_000).replace(/ đồng$/, ''));
  });
  it('khối tắt sẵn theo bố cục đúng MAC_DINH_TAT của R&D, chỉ chứa khoá bật/tắt được', () => {
    expect(LAYOUT_DEFAULT_OFF).toEqual(RND_MAC_DINH_TAT);
    for (const l of PRINT_LAYOUTS) for (const k of LAYOUT_DEFAULT_OFF[l]) expect(TOGGLE_BLOCK_KEYS).toContain(k);
  });
  it('chữ mặc định: tiêu đề, mở đầu, kết thúc; biến trong chữ mặc định hợp lệ cho đúng loại', () => {
    expect(DEFAULT_PRINT_TITLE).toEqual({ SERVICE: 'HỢP ĐỒNG DỊCH VỤ TRANG ĐIỂM', COURSE: 'HỢP ĐỒNG ĐÀO TẠO' });
    expect(checkTemplateText(DEFAULT_OPENING_TEXT.SERVICE, ['SERVICE'])).toEqual({ unknown: [], wrongKind: [] });
    expect(checkTemplateText(DEFAULT_OPENING_TEXT.COURSE, ['COURSE'])).toEqual({ unknown: [], wrongKind: [] });
    expect(checkTemplateText(DEFAULT_CLOSING_TEXT, ['SERVICE', 'COURSE'])).toEqual({ unknown: [], wrongKind: [] });
    expect(variablesIn(DEFAULT_OPENING_TEXT.COURSE)).toEqual(['Tên khoá', 'Tên lớp', 'Ngày khai giảng']);
  });
  it('17 biến chèn, đúng loại hợp đồng', () => {
    expect(Object.keys(PRINT_VARIABLES)).toHaveLength(17);
    expect(PRINT_VARIABLES['Ngày sự kiện']).toEqual(['SERVICE']);
    for (const v of ['Tên khoá', 'Tên lớp', 'Ngày khai giảng'] as const) expect(PRINT_VARIABLES[v]).toEqual(['COURSE']);
  });
  it('nhãn quyền contracts.texts gồm mẫu in (bản vẽ G mục 3.1)', () => {
    expect(PERMISSIONS['contracts.texts']).toBe('Sửa mẫu điều khoản, nội quy, mẫu in hợp đồng');
  });
});

// =====================================================================================================================
// resolvePrintConfig
// =====================================================================================================================

const tpl = (over: Partial<PrintTemplateLike> = {}): PrintTemplateLike => ({
  id: 't1', name: 'Mẫu thử', version: 3, layout: 2, blocks: {}, title: null, openingText: null, closingText: null, ...over,
});

describe('resolvePrintConfig — 5 bố cục × 2 loại', () => {
  const combos = PRINT_LAYOUTS.flatMap((layout) => (['SERVICE', 'COURSE'] as const).map((kind) => [layout, kind] as const));
  it.each(combos)('bố cục %i, %s: đủ 21 khoá; luôn có = true; tắt sẵn theo bố cục; khối khác loại = false', (layout, kind) => {
    const c = resolvePrintConfig(tpl({ layout }), kind);
    expect(Object.keys(c.blocks).sort()).toEqual([...PRINT_BLOCK_KEYS].sort());
    for (const k of ALWAYS_ON_BLOCKS) expect(c.blocks[k], k).toBe(true);
    for (const k of TOGGLE_BLOCK_KEYS) {
      const applies = (TOGGLE_BLOCKS[k].kinds as readonly string[]).includes(kind);
      const expected = applies && !LAYOUT_DEFAULT_OFF[layout as PrintLayout].includes(k);
      expect(c.blocks[k], `${layout}/${kind}/${k}`).toBe(expected);
    }
    expect(c.layout).toBe(layout);
    expect(c.title).toBe(DEFAULT_PRINT_TITLE[kind]);
    expect(c.openingText).toBe(DEFAULT_OPENING_TEXT[kind]);
    expect(c.closingText).toBe(DEFAULT_CLOSING_TEXT);
    expect({ id: c.templateId, name: c.templateName, v: c.templateVersion }).toEqual({ id: 't1', name: 'Mẫu thử', v: 3 });
  });
  it('mẫu 2 không có blocks → quoc-hieu = false; mẫu 1 → true; noi-quy của dịch vụ = false', () => {
    expect(resolvePrintConfig(tpl({ layout: 2 }), 'SERVICE').blocks['quoc-hieu']).toBe(false);
    expect(resolvePrintConfig(tpl({ layout: 1 }), 'SERVICE').blocks['quoc-hieu']).toBe(true);
    expect(resolvePrintConfig(tpl({ layout: 1 }), 'SERVICE').blocks['noi-quy']).toBe(false);
    expect(resolvePrintConfig(tpl({ layout: 1 }), 'COURSE').blocks['noi-quy']).toBe(true);
    expect(resolvePrintConfig(tpl({ layout: 1 }), 'COURSE').blocks.tho).toBe(false);
  });
  it('blocks của mẫu đè mặc định bố cục; overrides đè blocks; khối khác loại vẫn false dù bật', () => {
    const t = tpl({ layout: 2, blocks: { 'quoc-hieu': true, 'bang-chu': false, 'noi-quy': true } });
    const c = resolvePrintConfig(t, 'SERVICE');
    expect(c.blocks['quoc-hieu']).toBe(true);
    expect(c.blocks['bang-chu']).toBe(false);
    expect(c.blocks['noi-quy']).toBe(false);
    const o = resolvePrintConfig(t, 'SERVICE', { 'quoc-hieu': false, 'bang-chu': true });
    expect(o.blocks['quoc-hieu']).toBe(false);
    expect(o.blocks['bang-chu']).toBe(true);
  });
  it('chữ đã nhập giữ nguyên, không thay mặc định', () => {
    const c = resolvePrintConfig(tpl({ title: 'HĐ RIÊNG', openingText: 'Mở {Tên khách}', closingText: 'Hết.' }), 'COURSE');
    expect([c.title, c.openingText, c.closingText]).toEqual(['HĐ RIÊNG', 'Mở {Tên khách}', 'Hết.']);
  });
  it('dữ liệu hỏng → PrintCatalogError (không lặng lẽ bỏ qua)', () => {
    expect(() => resolvePrintConfig(tpl({ layout: 6 }), 'SERVICE')).toThrow(PrintCatalogError);
    expect(() => resolvePrintConfig(tpl({ layout: 0 }), 'SERVICE')).toThrow(PrintCatalogError);
    expect(() => resolvePrintConfig(tpl({ blocks: { 'khoi-la': true } }), 'SERVICE')).toThrow(/khoá khối lạ/);
    expect(() => resolvePrintConfig(tpl({ blocks: { 'tieu-de': false } }), 'SERVICE')).toThrow(PrintCatalogError);
    expect(() => resolvePrintConfig(tpl({ blocks: { 'bang-chu': 'false' } }), 'SERVICE')).toThrow(/true\/false/);
    expect(() => resolvePrintConfig(tpl({ blocks: null }), 'SERVICE')).toThrow(PrintCatalogError);
    expect(() => resolvePrintConfig(tpl({ blocks: [] }), 'SERVICE')).toThrow(PrintCatalogError);
    expect(() => resolvePrintConfig(tpl(), 'SERVICE', { 'chu-ky': false } as never)).toThrow(PrintCatalogError);
    expect(() => resolvePrintConfig(tpl(), 'KHAC' as never)).toThrow(PrintCatalogError);
  });
});

// =====================================================================================================================
// Điều khoản, biến, ngày
// =====================================================================================================================

describe('splitClauses', () => {
  it('null / rỗng → []', () => {
    expect(splitClauses(null)).toEqual([]);
    expect(splitClauses('')).toEqual([]);
    expect(splitClauses('\n \r\n')).toEqual([]);
  });
  it('bỏ dòng trống, \\r\\n, số đầu dòng "1." "12)"; số giữa câu giữ nguyên', () => {
    const body = '1. Bên A trang điểm đúng giờ.\r\n\r\n12) Huỷ trước 7 ngày hoàn 50%.\n   \nKhông số đầu dòng 3. vẫn giữ\n2.Liền chữ';
    expect(splitClauses(body)).toEqual([
      'Bên A trang điểm đúng giờ.',
      'Huỷ trước 7 ngày hoàn 50%.',
      'Không số đầu dòng 3. vẫn giữ',
      'Liền chữ',
    ]);
  });
  it('năm ở đầu câu không có dấu chấm/ngoặc thì giữ ("2026 là năm …")', () => {
    expect(splitClauses('2026 là năm ký')).toEqual(['2026 là năm ký']);
  });
});

describe('variablesIn + checkTemplateText', () => {
  it('lấy tên biến theo thứ tự, không lặp, không lồng', () => {
    expect(variablesIn('A {Tên khách} B {Mã hợp đồng} {Tên khách} {{x}}')).toEqual(['Tên khách', 'Mã hợp đồng', 'x']);
    expect(variablesIn('không có biến')).toEqual([]);
  });
  it('{Tên lớp} với [SERVICE, COURSE] → wrongKind (chỉ COURSE)', () => {
    expect(checkTemplateText('Lớp {Tên lớp}', ['SERVICE', 'COURSE'])).toEqual({
      unknown: [], wrongKind: [{ name: 'Tên lớp', onlyFor: ['COURSE'] }],
    });
    expect(checkTemplateText('Lớp {Tên lớp}', ['COURSE'])).toEqual({ unknown: [], wrongKind: [] });
  });
  it('{Ngày sự kiện} cho khoá học → wrongKind; biến lạ → unknown', () => {
    expect(checkTemplateText('{Ngày sự kiện} {Tên cô dâu}', ['COURSE'])).toEqual({
      unknown: ['Tên cô dâu'], wrongKind: [{ name: 'Ngày sự kiện', onlyFor: ['SERVICE'] }],
    });
  });
  it('phạm vi loại hợp đồng rỗng → ném lỗi', () => {
    expect(() => checkTemplateText('{Tên khách}', [])).toThrow(PrintCatalogError);
  });
});

describe('formatLocalDate + longLocalDate', () => {
  it('định dạng ngày', () => {
    expect(formatLocalDate('2026-10-19')).toBe('19/10/2026');
    expect(formatLocalDate('2026-01-05')).toBe('05/01/2026');
    expect(longLocalDate('2026-10-19')).toBe('ngày 19 tháng 10 năm 2026');
    expect(longLocalDate('2026-02-05')).toBe('ngày 05 tháng 02 năm 2026');
    expect(longLocalDate('2026-03-05')).toBe('ngày 05 tháng 3 năm 2026');
  });
  it('sai dạng / ngày không có thật → ném lỗi', () => {
    for (const bad of ['19/10/2026', '2026-2-5', '2026-02-30', '2026-13-01', '']) {
      expect(() => formatLocalDate(bad), bad).toThrow(PrintCatalogError);
      expect(() => longLocalDate(bad), bad).toThrow(PrintCatalogError);
    }
  });
});

// =====================================================================================================================
// Kiểu dữ liệu in + variableValues + fillVariables
// =====================================================================================================================

const sub = (name: string, quantity: number, unitPrice: number): PrintSubLine => ({
  name, quantity, unitPrice, lineDiscount: 0, lineTotal: quantity * unitPrice, addedAfterConfirm: false, addedOn: null,
});

const line = (over: Partial<PrintLine>): PrintLine => ({
  kind: 'PACKAGE', name: 'Gói', subjectName: null, quantity: 1, unitPrice: 0, lineDiscount: 0, lineTotal: 0,
  date: '2026-11-08', startTime: '05:00', endTime: '07:30', location: { type: 'CUSTOMER_HOME', text: '12 Hàng Bạc' }, note: null,
  staff: { primary: ['Lan'], assist: [] }, addedAfterConfirm: false, addedOn: null,
  addons: [], surcharges: [], travel: null, course: null, ...over,
});

// Ca phù dâu × 2 + phụ phí × 2 (đính chính 5): dòng con SURCHARGE nằm trong `surcharges` của dòng gốc.
const serviceData = (): ContractPrintData => {
  const lines = [
    line({ name: 'Trang điểm cô dâu', unitPrice: 3_500_000, lineTotal: 3_500_000, surcharges: [sub('Phụ phí sáng sớm', 1, 300_000)] }),
    line({
      kind: 'SERVICE', name: 'Trang điểm phù dâu', subjectName: 'Phù dâu', quantity: 2, unitPrice: 600_000, lineTotal: 1_200_000,
      surcharges: [sub('Phụ phí sáng sớm', 2, 150_000)], addons: [sub('Mi giả', 2, 50_000)],
    }),
  ];
  const subtotal = lines.reduce((s, l) => s + l.lineTotal + [...l.addons, ...l.surcharges].reduce((a, x) => a + x.lineTotal, 0), 0);
  return {
    version: PRINT_DATA_VERSION,
    kind: 'SERVICE',
    contract: { code: 'HĐDV-000128', status: 'CONFIRMED', issuedOn: '2026-10-19', eventDate: '2026-11-08', notes: null },
    studio: {
      name: 'SS Bridal', tagline: null, address: '1 Tràng Tiền', phone: '0901234567', email: null, website: null, logoFileId: null,
      representative: { name: 'Nguyễn Văn Chiến', title: 'Chủ studio' }, bank: null,
    },
    customer: { fullName: 'Trần Thị Mai', phone: '0912345678', email: null, contactHidden: false },
    lines,
    money: {
      subtotal, discount: 0, total: subtotal, totalInWords: vndInWords(subtotal), depositRequired: 2_000_000,
      depositInWords: vndInWords(2_000_000), travelTotal: 0,
    },
    payments: {
      installments: [], receipts: [], paid: 2_000_000, remaining: subtotal - 2_000_000, remainingInWords: vndInWords(subtotal - 2_000_000),
      scheduleDifference: null,
    },
    paymentsHidden: false,
    terms: null,
    rules: null,
  };
};

describe('kiểu dữ liệu in (bản vẽ G mục 3.1 + đính chính 5)', () => {
  it('PrintLine có surcharges: PrintSubLine[]; PrintSubLine chỉ có tên, số lượng, tiền, phát sinh — không có tên luật, ghi chú ghi đè', () => {
    expectTypeOf<PrintLine['surcharges']>().toEqualTypeOf<PrintSubLine[]>();
    expectTypeOf<PrintLine['addons']>().toEqualTypeOf<PrintSubLine[]>();
    expectTypeOf<keyof PrintSubLine>().toEqualTypeOf<
      'name' | 'quantity' | 'unitPrice' | 'lineDiscount' | 'lineTotal' | 'addedAfterConfirm' | 'addedOn'
    >();
    expectTypeOf<PrintTravel>().toMatchTypeOf<PrintSubLine>();
    expectTypeOf<ResolvedPrintConfig['blocks']>().toEqualTypeOf<Record<PrintBlockKey, boolean>>();
    expectTypeOf<ToggleBlockKey>().not.toEqualTypeOf<PrintBlockKey>();
    expectTypeOf<ContractPrintData['version']>().toEqualTypeOf<1>();
    const d = serviceData();
    const s = d.lines[1]!.surcharges[0]!;
    expect(Object.keys(s).sort()).toEqual(['addedAfterConfirm', 'addedOn', 'lineDiscount', 'lineTotal', 'name', 'quantity', 'unitPrice']);
  });
  it('ca phù dâu × 2 + phụ phí × 2: tổng dòng gốc + dịch vụ phụ + phụ phí = subtotal; tiền là số nguyên', () => {
    const d = serviceData();
    const printed = d.lines.flatMap((l) => [l.lineTotal, ...l.addons.map((x) => x.lineTotal), ...l.surcharges.map((x) => x.lineTotal)]);
    expect(printed.reduce((a, b) => a + b, 0)).toBe(d.money.subtotal);
    expect(d.money.subtotal).toBe(3_500_000 + 300_000 + 1_200_000 + 300_000 + 100_000);
    for (const v of printed) expect(Number.isSafeInteger(v)).toBe(true);
    expect(d.money.totalInWords).toBe('Năm triệu bốn trăm nghìn đồng');
  });
});

describe('variableValues', () => {
  it('dịch vụ: đủ 17 biến, đã định dạng; biến khoá học → "……"', () => {
    const v = variableValues(serviceData());
    expect(Object.keys(v).sort()).toEqual(Object.keys(PRINT_VARIABLES).sort());
    expect(v['Tên studio']).toBe('SS Bridal');
    expect(v['SĐT khách']).toBe('0912345678');
    expect(v['Mã hợp đồng']).toBe('HĐDV-000128');
    expect(v['Ngày lập']).toBe('19/10/2026');
    expect(v['Ngày sự kiện']).toBe('08/11/2026');
    expect(v['Tổng tiền']).toMatch(/^5\.400\.000\s₫$/);
    expect(v['Tổng tiền bằng chữ']).toBe('Năm triệu bốn trăm nghìn đồng');
    expect(v['Đã thu']).toMatch(/^2\.000\.000\s₫$/);
    expect(v['Người đại diện']).toBe('Nguyễn Văn Chiến');
    expect([v['Tên khoá'], v['Tên lớp'], v['Ngày khai giảng']]).toEqual([PRINT_BLANK, PRINT_BLANK, PRINT_BLANK]);
  });
  it('SĐT bị che → "……"; tiền đã thu bị che → "……"; không có địa chỉ/đại diện → "……"', () => {
    const d = serviceData();
    d.customer = { ...d.customer, contactHidden: true };
    d.payments = null;
    d.paymentsHidden = true;
    d.studio = { ...d.studio, address: null, representative: null };
    const v = variableValues(d);
    expect(v['SĐT khách']).toBe('……');
    expect(v['Đã thu']).toBe('……');
    expect(v['Còn lại']).toBe('……');
    expect(v['Địa chỉ studio']).toBe('……');
    expect(v['Người đại diện']).toBe('……');
    expect(JSON.stringify(v)).not.toContain('0912345678');
  });
  it('khoá học: lấy tên khoá, lớp, ngày khai giảng từ dòng COURSE; ngày sự kiện → "……"', () => {
    const d = serviceData();
    d.kind = 'COURSE';
    d.lines = [
      line({
        kind: 'COURSE', name: 'Khoá makeup cá nhân', course: {
          courseName: 'Makeup cá nhân', className: 'K12', startDate: '2026-11-02', endDate: '2026-12-20', weekdays: [2, 4],
          startTime: '18:00', endTime: '21:00', sessionCount: 14, instructorName: 'Chiến', location: null,
        },
      }),
    ];
    const v = variableValues(d);
    expect([v['Tên khoá'], v['Tên lớp'], v['Ngày khai giảng'], v['Ngày sự kiện']]).toEqual(['Makeup cá nhân', 'K12', '02/11/2026', '……']);
  });
});

describe('fillVariables', () => {
  it('thay biến thành đoạn riêng; biến lạ giữ nguyên chữ; chữ có ký tự HTML giữ nguyên là chữ', () => {
    const segs = fillVariables('Bên B: {Tên khách} <b>{Lạ}</b> — {Mã hợp đồng}.', { 'Tên khách': 'Mai <i>', 'Mã hợp đồng': 'HĐDV-1' });
    expect(segs).toEqual([
      { text: 'Bên B: ' },
      { variable: 'Tên khách', value: 'Mai <i>' },
      { text: ' <b>{Lạ}</b> — ' },
      { variable: 'Mã hợp đồng', value: 'HĐDV-1' },
      { text: '.' },
    ]);
  });
  it('mở đầu mặc định dịch vụ với giá trị thật', () => {
    const v = variableValues(serviceData());
    const out = fillVariables(DEFAULT_OPENING_TEXT.SERVICE, v)
      .map((s) => ('text' in s ? s.text : s.value))
      .join('');
    expect(out).toBe('Hai bên thoả thuận ký hợp đồng dịch vụ trang điểm cho sự kiện ngày 08/11/2026 với các nội dung sau:');
    expect(fillVariables('', v)).toEqual([]);
    expect(fillVariables('{Tên khách}', v)).toEqual([{ variable: 'Tên khách', value: 'Trần Thị Mai' }]);
  });
  it('tra khoá thuộc nguyên mẫu Object (toString) không coi là biến', () => {
    expect(fillVariables('{toString}', {})).toEqual([{ text: '{toString}' }]);
  });
});
