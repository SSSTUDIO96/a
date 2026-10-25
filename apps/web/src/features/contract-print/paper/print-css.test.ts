import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRINT_LAYOUTS, type PrintLayout } from '@makeup/shared';
import { A4_HEIGHT_MM, PAGE_CONTENT_MM, PAGE_MM } from './pageCss';

// Luật in L1–L8 của bản vẽ G mục 4.6 — cửa gác nhanh (không cần trình duyệt) trên paper.css + layout-1..5.css + fonts.css.
// Bài in thật bằng Chromium: print.pdf.test.ts. Luật nào mất ở đây là bản in hỏng.

const DIR = fileURLToPath(new URL('.', import.meta.url));
const WEB = join(DIR, '..', '..', '..', '..');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const PAPER = read('paper.css');
const LAYOUT: Record<PrintLayout, string> = { 1: read('layout-1.css'), 2: read('layout-2.css'), 3: read('layout-3.css'), 4: read('layout-4.css'), 5: read('layout-5.css') };
const FONTS = read('fonts.css');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

interface Rule {
  selectors: string[]; // đã tách dấu phẩy, gộp khoảng trắng
  decls: Record<string, string>;
  media: string | null; // chuỗi điều kiện @media bao quanh, null = ngoài mọi @media
  at: string | null; // '@page hdin-1', '@page hdin-1 @bottom-left', '@font-face'
}

function block(src: string, open: number): { body: string; end: number } {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return { body: src.slice(open + 1, i), end: i + 1 };
    }
  }
  throw new Error('CSS thiếu dấu }');
}

function decls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of body.split(';')) {
    const k = d.indexOf(':');
    if (k > 0) out[d.slice(0, k).trim().toLowerCase()] = norm(d.slice(k + 1)).replace(/\s*!important$/, '');
  }
  return out;
}

function parse(src: string, media: string | null = null, at: string | null = null): Rule[] {
  const out: Rule[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const prelude = norm(src.slice(i, open));
    const { body, end } = block(src, open);
    i = end;
    if (prelude.startsWith('@media')) out.push(...parse(body, prelude, at));
    else if (prelude.startsWith('@page')) {
      // phần khai báo trực tiếp + các hộp lề lồng bên trong
      const own = body.replace(/@[a-z-]+\s*\{[^{}]*\}/g, '');
      out.push({ selectors: [prelude], decls: decls(own), media, at: prelude });
      for (const m of body.matchAll(/(@[a-z-]+)\s*\{([^{}]*)\}/g)) out.push({ selectors: [`${prelude} ${m[1]}`], decls: decls(m[2] ?? ''), media, at: `${prelude} ${m[1]}` });
    } else if (prelude.startsWith('@font-face')) out.push({ selectors: ['@font-face'], decls: decls(body), media, at: '@font-face' });
    else out.push({ selectors: prelude.split(',').map(norm), decls: decls(body), media, at });
  }
  return out;
}

const PAPER_RULES = parse(PAPER);
const LAYOUT_RULES: Record<PrintLayout, Rule[]> = { 1: parse(LAYOUT[1]), 2: parse(LAYOUT[2]), 3: parse(LAYOUT[3]), 4: parse(LAYOUT[4]), 5: parse(LAYOUT[5]) };
const ALL_RULES = [...PAPER_RULES, ...PRINT_LAYOUTS.flatMap((n) => LAYOUT_RULES[n])];

// Gộp khai báo của mọi luật có bộ chọn đúng `selector` (theo thứ tự xuất hiện — luật sau đè luật trước), lọc theo @media.
function cascade(rules: Rule[], selector: string, media: 'print' | 'screen' | 'none' = 'none'): Record<string, string> {
  const want = norm(selector);
  const out: Record<string, string> = {};
  for (const r of rules) {
    const m = r.media === null ? 'none' : /\bprint\b/.test(r.media) ? 'print' : /\bscreen\b/.test(r.media) ? 'screen' : 'other';
    if (m !== media) continue;
    if (r.selectors.includes(want)) Object.assign(out, r.decls);
  }
  return out;
}
const mm = (v: string): number => {
  const m = /^(-?[\d.]+)(mm|pt|px)?$/.exec(v.trim());
  if (!m) throw new Error(`Không đọc được độ dài "${v}"`);
  const n = Number(m[1]);
  return m[2] === 'pt' ? n * 0.352778 : m[2] === 'px' ? n * 0.264583 : n;
};
// Cạnh trên của khai báo padding (shorthand 1–4 giá trị) hoặc padding-top.
function paddingTopMm(d: Record<string, string>): number | null {
  if (d['padding-top']) return mm(d['padding-top']);
  if (d.padding) return mm(d.padding.split(' ')[0]!);
  return null;
}

describe('L1 — chỉ tờ hợp đồng khi in (.hdin-dlg)', () => {
  const P = (sel: string) => cascade(PAPER_RULES, sel, 'print');
  it('ẩn HẲN (display: none) mọi phần tử khác trong body; trang không cắt chiều cao', () => {
    expect(P('body:has(.hdin-dlg) > :not(.ui-overlay:has(.hdin-dlg))')).toMatchObject({ display: 'none' });
    expect(P('html:has(.hdin-dlg), body:has(.hdin-dlg)'.split(', ')[0]!)).toMatchObject({ height: 'auto', overflow: 'visible' });
    expect(P('body:has(.hdin-dlg)')).toMatchObject({ height: 'auto', overflow: 'visible' });
  });
  it('lớp phủ và hộp thoại về dòng chảy thường: static, không giới hạn chiều cao, không cuộn trong', () => {
    expect(P('.ui-overlay:has(.hdin-dlg)')).toMatchObject({ position: 'static', display: 'block' });
    expect(P('.ui-dialog.hdin-dlg')).toMatchObject({ 'max-height': 'none', overflow: 'visible', height: 'auto' });
    expect(P('.hdin-dlg .ui-dialog__body')).toMatchObject({ overflow: 'visible' });
  });
  it('đầu, chân hộp thoại, cột lựa chọn và dòng "Khoảng N trang" ẩn khi in', () => {
    for (const s of ['.hdin-dlg .ui-dialog__head', '.hdin-dlg .ui-dialog__foot', '.hdin-dlg .hdin-aside', '.hdin-dlg .hdin-prev-cap']) {
      expect(P(s), s).toMatchObject({ display: 'none' });
    }
  });
  it('khung xem trước về dòng chảy thường khi in (không cuộn, không thu phóng)', () => {
    for (const s of ['.hdin-frame', '.hdin-frame__paper', '.hdin-prev', '.hdin-zoom']) {
      expect(P(s), s).toMatchObject({ overflow: 'visible', 'max-height': 'none', zoom: '1' });
    }
  });
  it('mọi luật trong @media print của paper.css chỉ áp khi trang có .hdin-dlg hoặc bên trong tờ .hdin-giay (không ảnh hưởng nơi in khác)', () => {
    const printRules = PAPER_RULES.filter((r) => r.media !== null && /\bprint\b/.test(r.media));
    expect(printRules.length).toBeGreaterThan(10);
    for (const r of printRules) {
      for (const s of r.selectors) expect(s, `bộ chọn in "${s}" quá rộng`).toMatch(/\.hdin-/);
    }
  });
});

describe('L2 — không ngắt giữa dòng bảng, điều khoản, chỗ ký, khung tổng, khối hai bên, khối chuyển khoản', () => {
  const sels = ['tr', 'li', '.hdin-ky', '.hdin-ben', '.hdin-khoi-tong', '.hdin-bang-tong', '.hdin-ck', 'dl'].map((s) => `.hdin-giay ${s}`);
  it('mỗi phần tử trong danh sách có break-inside: avoid khi in', () => {
    for (const s of sels) expect(cascade(PAPER_RULES, s, 'print'), s).toMatchObject({ 'break-inside': 'avoid' });
  });
  it('mẫu 2: khối hai cột (tiến độ + đã thu) không bị cắt đôi; chữ ký dính đoạn trước (break-before: avoid)', () => {
    expect(cascade(LAYOUT_RULES[2], '.hdin-g2 .hdin-hai-cot')).toMatchObject({ 'break-inside': 'avoid' });
    expect(cascade(PAPER_RULES, '.hdin-giay .hdin-ky', 'print')).toMatchObject({ 'break-before': 'avoid' });
  });
});

describe('L3 — dấu tiếng Việt không rơi: mọi tiêu đề mục có padding-top ≥ 0,8 mm', () => {
  const HEADS: Record<PrintLayout, string[]> = {
    1: ['.hdin-g1 .hdin-dieu', '.hdin-g1 .hdin-tieu'],
    2: ['.hdin-g2 .hdin-h'],
    3: ['.hdin-g3 .hdin-h'],
    4: ['.hdin-g4 .hdin-h'],
    5: ['.hdin-g5 .hdin-h'],
  };
  for (const n of PRINT_LAYOUTS) {
    it(`layout-${n}.css: ${HEADS[n].join(', ')} có padding-top ≥ 0,8 mm`, () => {
      for (const s of HEADS[n]) {
        const top = paddingTopMm(cascade(LAYOUT_RULES[n], s));
        expect(top, `${s} thiếu padding-top`).not.toBeNull();
        expect(top!, `${s}: ${top} mm < 0,8 mm`).toBeGreaterThanOrEqual(0.8);
      }
    });
  }
  it('mọi luật trong layout-N.css mà bộ chọn kết thúc bằng tiêu đề mục (.hdin-dieu / .hdin-h) nếu có đặt padding thì không giảm dưới 0,8 mm', () => {
    for (const n of PRINT_LAYOUTS) {
      for (const r of LAYOUT_RULES[n]) {
        for (const s of r.selectors) {
          if (!/\.hdin-(dieu|h)$/.test(s)) continue;
          const top = paddingTopMm(r.decls);
          if (top !== null) expect(top, `${s}`).toBeGreaterThanOrEqual(0.8);
        }
      }
    }
  });
});

describe('L4 — dòng tổng không lặp ở mỗi trang; đầu bảng lặp (chủ đích)', () => {
  it('tfoot { display: table-row-group }, thead { display: table-header-group } khi in', () => {
    expect(cascade(PAPER_RULES, '.hdin-giay tfoot', 'print')).toMatchObject({ display: 'table-row-group' });
    expect(cascade(PAPER_RULES, '.hdin-giay thead', 'print')).toMatchObject({ display: 'table-header-group' });
  });
});

describe('L5 — tiêu đề mồ côi cuối trang', () => {
  it('h2::after kéo dài 14 mm vô hình (margin âm trả lại chỗ)', () => {
    expect(cascade(PAPER_RULES, '.hdin-giay h2::after', 'print')).toMatchObject({ content: '""', display: 'block', height: '14mm', 'margin-bottom': '-14mm' });
  });
  it('h1, h2, h3: break-after: avoid + break-inside: avoid', () => {
    for (const h of ['h1', 'h2', 'h3']) {
      expect(cascade(PAPER_RULES, `.hdin-giay ${h}`, 'print'), h).toMatchObject({ 'break-after': 'avoid', 'break-inside': 'avoid' });
    }
  });
});

describe('L6 — khung viền mẫu 5: phần tử fixed duy nhất là .hdin-khung-trang', () => {
  it('không luật nào đặt position: fixed / sticky cho phần tử khác .hdin-khung-trang', () => {
    for (const r of ALL_RULES) {
      const pos = r.decls.position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      for (const s of r.selectors) expect(s, `"${s}" đặt position: ${pos}`).toBe('.hdin-g5 .hdin-khung-trang');
    }
  });
  it('khung chỉ display: block khi in (ngoài in là none); fixed, rỗng về nội dung CSS', () => {
    expect(cascade(LAYOUT_RULES[5], '.hdin-g5 .hdin-khung-trang')).toMatchObject({ display: 'none' });
    expect(cascade(LAYOUT_RULES[5], '.hdin-g5 .hdin-khung-trang', 'print')).toMatchObject({ display: 'block', position: 'fixed' });
    for (const r of LAYOUT_RULES[5]) {
      if (r.selectors.some((s) => s.endsWith('.hdin-khung-trang'))) expect(r.decls.content, 'khung không được có content').toBeUndefined();
    }
  });
});

describe('L7 — mỗi bố cục có @page hdin-N A4 + lề, tờ dùng đúng trang đó; PAGE_CONTENT_MM khớp lề', () => {
  for (const n of PRINT_LAYOUTS) {
    it(`bố cục ${n}: @page hdin-${n} { size: A4; margin } + .hdin-g${n} { page: hdin-${n} }`, () => {
      const page = cascade(LAYOUT_RULES[n], `@page hdin-${n}`);
      expect(page.size).toBe('A4');
      const m = page.margin!.split(' ').map(mm);
      // margin CSS: 1 giá trị = cả bốn; 2 = (trên/dưới, trái/phải); 3 = (trên, trái/phải, dưới); 4 = (trên, phải, dưới, trái)
      const [top, right, bottom, left] =
        m.length === 1 ? [m[0]!, m[0]!, m[0]!, m[0]!] : m.length === 2 ? [m[0]!, m[1]!, m[0]!, m[1]!] : m.length === 3 ? [m[0]!, m[1]!, m[2]!, m[1]!] : [m[0]!, m[1]!, m[2]!, m[3]!];
      expect(top, 'lề trên').toBe(PAGE_MM[n].top);
      expect(bottom, 'lề dưới').toBe(PAGE_MM[n].bottom);
      expect(left, 'lề trái').toBe(PAGE_MM[n].left);
      expect(right, 'lề phải').toBe(PAGE_MM[n].right);
      expect(cascade(LAYOUT_RULES[n], `.hdin-g${n}`).page).toBe(`hdin-${n}`);
      const pad = paddingTopMm(cascade(LAYOUT_RULES[n], `.hdin-g${n}`, 'print')) ?? 0;
      expect(pad, 'lề trong tờ khi in').toBe(PAGE_MM[n].pad);
      expect(PAGE_CONTENT_MM[n]).toBe(A4_HEIGHT_MM - top - bottom - 2 * pad);
    });
    it(`bố cục ${n}: có đủ ba hộp lề chân trang có phông (trái, giữa, phải) để số trang / ký nháy không ra phông mặc định`, () => {
      for (const box of ['@bottom-left', '@bottom-center', '@bottom-right']) {
        const d = cascade(LAYOUT_RULES[n], `@page hdin-${n} ${box}`);
        expect(d.font, `${box}`).toBeTruthy();
      }
    });
  }
  it('mỗi layout-N.css chỉ khai @page của chính nó', () => {
    for (const n of PRINT_LAYOUTS) {
      const pages = [...LAYOUT[n].matchAll(/@page\s+([\w-]+)/g)].map((m) => m[1]);
      expect(new Set(pages)).toEqual(new Set([`hdin-${n}`]));
    }
  });
});

describe('L8 — print-color-adjust: exact; zoom xem trước chỉ trong @media screen', () => {
  it('tờ giấy và mọi phần tử con in đúng màu nền', () => {
    expect(cascade(PAPER_RULES, '.hdin-giay')).toMatchObject({ 'print-color-adjust': 'exact', '-webkit-print-color-adjust': 'exact' });
  });
  it('mọi khai báo zoom nằm trong @media screen; ngoài đó (khi in) chỉ được là zoom: 1', () => {
    let seen = 0;
    for (const r of ALL_RULES) {
      const z = r.decls.zoom;
      if (z === undefined) continue;
      seen += 1;
      const screenOnly = r.media !== null && /\bscreen\b/.test(r.media);
      if (!screenOnly) expect(z, `zoom ngoài @media screen: ${r.selectors.join(', ')}`).toBe('1');
    }
    expect(seen).toBeGreaterThan(1);
    expect(cascade(PAPER_RULES, '.hdin-zoom', 'screen').zoom).toBe('var(--hdin-zoom, 1)');
  });
  it('trên màn tờ có padding = lề trang; khi in padding về 0 (hoặc lề trong của mẫu 5)', () => {
    for (const n of PRINT_LAYOUTS) {
      const screen = paddingTopMm(cascade(LAYOUT_RULES[n], `.hdin-g${n}`))!;
      expect(screen, `bố cục ${n}`).toBeGreaterThan(5);
      const print = cascade(LAYOUT_RULES[n], `.hdin-g${n}`, 'print');
      expect(paddingTopMm(print), `bố cục ${n} khi in`).toBe(PAGE_MM[n].pad);
    }
  });
});

describe('Lớp CSS có tiền tố hdin-; phông dùng lại tệp đã có', () => {
  it('mọi lớp trong paper.css / layout-N.css bắt đầu bằng hdin- (hoặc ui- của hộp thoại): không đụng lớp của màn khác', () => {
    for (const r of ALL_RULES) {
      for (const s of r.selectors) {
        for (const c of s.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
          expect(c[1], `lớp ".${c[1]}" trong "${s}" thiếu tiền tố hdin-`).toMatch(/^(hdin-|ui-)/);
        }
      }
    }
  });

  it('fonts.css: mọi url() trỏ tới tệp có thật trong public/ (BẮT: đổi đường dẫn thì đỏ)', () => {
    const urls = [...FONTS.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]!);
    expect(urls.length).toBe(4);
    for (const u of urls) expect(existsSync(join(WEB, 'public', u)), `thiếu tệp ${u}`).toBe(true);
  });

  it('Lora dùng lại bản có sẵn ở public/mau/phong/ss-album/lora (họ SSA Lora); KHÔNG tạo public/fonts/lora (bản vẽ G đính chính 25/10 mục 3)', () => {
    expect(FONTS).toContain("font-family: 'SSA Lora'");
    expect(FONTS).toContain('/mau/phong/ss-album/lora/Lora-VF.woff2');
    expect(FONTS).toContain('/mau/phong/ss-album/lora/Lora-Italic-VF.woff2');
    expect(existsSync(join(WEB, 'public/fonts/lora')), 'public/fonts/lora không được tồn tại').toBe(false);
    expect(readdirSync(join(WEB, 'public/fonts')).sort()).toEqual(['be-vietnam-pro']);
    for (const n of [1, 5] as const) {
      expect(LAYOUT[n]).toContain("'SSA Lora'");
      expect(LAYOUT[n]).not.toContain('MP Lora');
    }
    // họ SSA Lora có ở ss-album.css (nguồn gốc) với đúng hai tệp này
    const ssa = readFileSync(join(WEB, 'public/mau/phong/ss-album/ss-album.css'), 'utf8');
    expect(ssa).toContain("font-family:'SSA Lora'");
  });

  it('font-display: block ở mọi @font-face (L9: in trước khi phông tải xong ra chữ trống — hộp In chờ usePaperReady)', () => {
    const faces = parse(FONTS).filter((r) => r.at === '@font-face');
    expect(faces).toHaveLength(4);
    for (const f of faces) expect(f.decls['font-display']).toBe('block');
  });

  it('mẫu 5 dùng Cormorant (tiêu đề) của app: họ MP Cormorant có khai báo', () => {
    expect(FONTS).toContain("font-family: 'MP Cormorant'");
    expect(LAYOUT[5]).toContain("'MP Cormorant'");
  });
});
