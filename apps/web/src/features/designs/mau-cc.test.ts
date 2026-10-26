// 16 mẫu giấy chứng nhận cc-01..cc-16 vào app (gói T1 bản vẽ F + đính chính 19/10/2026 tối).
// Phần 1 đọc thẳng tệp tĩnh public/mau/** (đúng tệp app nạp vào iframe xem trước / xuất ảnh).
// Phần 2 mở Chromium thật (Playwright) qua Vite: dữ liệu thật ?that=1, tên dài/ngắn không tràn, xuất PNG 1754×1240 bằng
// chính window.MAU_XUAT_PNG (hàm app gọi qua renderTemplatePng). Thiếu Chromium thì ĐỎ (không tự bỏ qua).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';
import { CERTIFICATE_IMAGE, CERTIFICATE_TEMPLATE_CODES, DESIGN_TEMPLATES, listDesignTemplates, type SlotKey } from '@makeup/shared';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { thumbnailUrl } from './model';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PUBLIC = new URL('../../../public/', import.meta.url);
const fileOf = (p: string) => new URL(p.replace(/^\//, ''), PUBLIC);
const read = (p: string) => readFileSync(fileOf(p), 'utf8');
const CODES = [...CERTIFICATE_TEMPLATE_CODES];
const html = (code: string) => read(`/mau/${code}.html`);
const CC_CSS = read('/mau/chung/cc.css');
const CC_JS = read('/mau/chung/cc.js');
const CC_XUAT = read('/mau/chung/cc-xuat.js');
// Bỏ chú thích để kiểm "không dùng X" mà không vướng câu chú thích nhắc tới X.
const noComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// Khoá tệp vẽ suy ra → ô trong danh mục (cc.js: ngayChu/nam → ncap; dong → khoa+lop; laiDong…).
const DERIVED: Record<string, SlotKey[]> = {
  ngayChu: ['ncap'], nam: ['ncap'], dong: ['khoa', 'lop'], khoaLop: ['khoa', 'lop'], lopNam: ['lop', 'ncap'],
};
function slotsOnFile(code: string): SlotKey[] {
  const keys = new Set<SlotKey>();
  for (const m of html(code).matchAll(/data-f="([^"]+)"/g)) {
    const k = m[1] ?? '';
    for (const s of DERIVED[k] ?? [k as SlotKey]) keys.add(s);
  }
  return [...keys].sort();
}

// Kích thước ảnh JPEG từ đoạn SOF.
function jpegSize(buf: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error('JPEG hỏng');
    const marker = buf[i + 1] ?? 0;
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('Không thấy SOF');
}

describe('danh mục ↔ tệp vẽ cc-01..cc-16', () => {
  it('BẮT (T1-5): đủ 16 mã khớp CERTIFICATE_TEMPLATES; mỗi mã có tệp vẽ + ảnh nhỏ; danh mục đúng khổ/khung tròn', () => {
    expect(CODES).toEqual(Array.from({ length: 16 }, (_, i) => `cc-${String(i + 1).padStart(2, '0')}`));
    const certs = listDesignTemplates({ kind: 'CERTIFICATE' });
    expect(certs.map((t) => t.code)).toEqual(CODES);
    for (const t of certs) {
      expect(existsSync(fileOf(`/mau/${t.code}.html`)), `${t.code}.html`).toBe(true);
      expect(t.sizes, t.code).toEqual(['1754x1240']);
      expect(t.frameShape, t.code).toBe('circle');
      expect(existsSync(fileOf(thumbnailUrl(t, 'COURSE'))), thumbnailUrl(t, 'COURSE')).toBe(true);
    }
    expect(DESIGN_TEMPLATES.filter((t) => t.kind === 'CERTIFICATE')).toHaveLength(16);
  });

  it('BẮT: ảnh nhỏ danh sách chọn mẫu 480×339, JPEG, ≤ 60 KB', () => {
    for (const c of CODES) {
      const p = `/mau/anh-nho/${c}.jpg`;
      const buf = readFileSync(fileOf(p));
      expect(buf.subarray(0, 2).toString('hex'), c).toBe('ffd8');
      expect(jpegSize(buf), c).toEqual({ w: 480, h: 339 });
      expect(statSync(fileOf(p)).size, c).toBeLessThanOrEqual(60 * 1024);
    }
  });

  it('BẮT (T1-1): tệp vẽ của mỗi mẫu có đủ data-f của 12 ô khai trong danh mục', () => {
    for (const t of listDesignTemplates({ kind: 'CERTIFICATE' })) expect(slotsOnFile(t.code), t.code).toEqual([...t.slots].sort());
  });

  it('BẮT: mỗi mẫu có ĐÚNG MỘT ô ảnh học viên khung tròn (.anh border-radius:50%) và danh mục khai photoFrames = 1', () => {
    expect(noComments(CC_CSS)).toMatch(/\.anh\{border-radius:50%;/);
    for (const c of CODES) {
      const src = html(c);
      expect([...src.matchAll(/<img[^>]*data-f="anh"/g)], c).toHaveLength(1);
      expect(src, c).toMatch(/<div class="anh"><img data-f="anh" alt=""><\/div>/);
      // Mẫu không được ép khung ảnh về hình khác tròn.
      const anhRule = new RegExp(`\\.c\\d+ \\.anh\\{[^}]*\\}`, 'g');
      for (const m of src.matchAll(anhRule)) expect(m[0], `${c} ${m[0]}`).not.toMatch(/border-radius:\s*(?!50%)[\d.]+(px|%)/);
    }
  });

  it('BẮT: chưa có ảnh thì in chữ cái đầu (.chua-anh + data-chu), ô trống khi cũng chưa có tên — không in "?"', () => {
    expect(CC_CSS).toMatch(/\.anh\.chua-anh::after\{content:attr\(data-chu\)/);
    expect(CC_JS).toMatch(/w\.classList\.add\('chua-anh'\); w\.dataset\.chu = chuDau\(D\.ten\)/);
    expect(CC_JS).not.toContain("'?'");
  });
});

describe('phông, chữ vàng SVG, chữ cố định', () => {
  it('BẮT: phông nối bằng thẻ <link> trong từng mẫu (phong.css, ss-album.css, cc.css) — KHÔNG @import (html-to-image không nhúng được)', () => {
    for (const c of CODES) {
      const src = html(c);
      expect(src, c).toContain('<link rel="stylesheet" href="phong/phong.css">');
      expect(src, c).toContain('<link rel="stylesheet" href="phong/ss-album/ss-album.css">');
      expect(src, c).toContain('<link rel="stylesheet" href="chung/cc.css">');
      expect(noComments(src), c).not.toMatch(/@import/);
    }
    expect(noComments(CC_CSS)).not.toMatch(/@import/);
  });

  it('BẮT: không dùng background-clip:text (vỡ khi xuất ảnh / PDF) ở mẫu, CSS và JS', () => {
    for (const c of CODES) expect(noComments(html(c)), c).not.toMatch(/background-clip|-webkit-text-fill-color/i);
    expect(noComments(CC_CSS)).not.toMatch(/background-clip|-webkit-text-fill-color/i);
    expect(noComments(CC_JS)).not.toMatch(/background-clip|-webkit-text-fill-color/i);
  });

  it('BẮT: tiêu đề phông Prata, mẫu viết tay (chỉ cc-04) Great Vibes — đều là phông có sẵn trong app (ss-album.css), không chép TTF mới', () => {
    expect(CC_CSS).toContain("--f-tt:'SSA Prata',serif");
    expect(CC_CSS).toContain(".tt.viet{font-family:'SSA Great Vibes'");
    const ss = read('/mau/phong/ss-album/ss-album.css');
    expect(ss).toContain("font-family:'SSA Prata'");
    expect(ss).toContain("font-family:'SSA Great Vibes'");
    for (const f of ['prata/Prata-Regular.woff2', 'great-vibes/GreatVibes-Regular.woff2', 'prata/OFL.txt', 'great-vibes/OFL.txt']) {
      expect(existsSync(fileOf(`/mau/phong/ss-album/${f}`)), f).toBe(true);
    }
    expect(CC_CSS).toMatch(/\.cc\{--ky-co-2:1\.12;/);
    for (const c of CODES) {
      const viet = /class="tt viet sv/.test(html(c));
      expect(viet, c).toBe(c === 'cc-04');
      expect(listDesignTemplates({ kind: 'CERTIFICATE' }).find((t) => t.code === c)?.fonts[1], c).toBe(viet ? 'SSA Great Vibes' : 'SSA Prata');
    }
  });

  it('BẮT: phông của danh mục khớp phông tên học viên trên tệp vẽ (--f-ten mặc định: chữ ký 1 nếu mẫu không đặt)', () => {
    for (const t of listDesignTemplates({ kind: 'CERTIFICATE' })) {
      const m = /--f-ten:var\(--f-ky-(\d)\)/.exec(html(t.code));
      expect(t.fonts[0], t.code).toBe(`MP Chữ ký ${m ? m[1] : '1'}`);
    }
  });

  it('BẮT (T1-2): không còn chữ "chứng chỉ" (không phân biệt hoa thường) ở mẫu, CSS, JS; tiêu đề "Giấy chứng nhận", dòng phụ "Hoàn thành khoá học"', () => {
    for (const [name, src] of [...CODES.map((c) => [c, html(c)] as const), ['cc.css', CC_CSS], ['cc.js', CC_JS], ['cc-xuat.js', CC_XUAT]] as const) {
      expect(src, name).not.toMatch(/ch(ứ|ư)ng ch(ỉ|i)\b/i);
    }
    for (const c of CODES) {
      const src = html(c);
      expect(src, c).toMatch(/<div class="tt[^"]*sv t1"[^>]*>Giấy chứng nhận<\/div>/);
      expect(src.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), c).toContain('hoàn thành khoá học');
      expect(src, c).not.toMatch(/data-td/);
    }
    expect(CC_JS).toContain("'★ GIẤY CHỨNG NHẬN ★'");
    expect(CC_JS).toContain("'HOÀN THÀNH'");
  });

  it('BẮT: thứ tự nạp script html-to-image → cc.js → cc-xuat.js; cc.js không còn tham số td/ph/nhieu, có that=1', () => {
    for (const c of CODES) {
      const src = html(c);
      const a = src.indexOf('chung/html-to-image.js'), b = src.indexOf('chung/cc.js'), x = src.indexOf('chung/cc-xuat.js');
      expect(a, c).toBeGreaterThan(-1);
      expect(b, c).toBeGreaterThan(a);
      expect(x, c).toBeGreaterThan(b);
    }
    expect(CC_JS).toContain("P.get('that') === '1'");
    for (const gone of ["P.get('td')", "P.get('ph')", "'nhieu'", "P.get('kieu')", "P.get('mot')"]) expect(CC_JS, gone).not.toContain(gone);
    expect(CC_XUAT).toContain('window.MAU_XUAT_PNG');
    expect(CC_XUAT).toContain('1754');
    expect(noComments(CC_XUAT)).not.toMatch(/backgroundColor/);
  });
});

// ---------------------------------------------------------------- Chromium thật
let server: ViteDevServer;
let browser: Browser;
let base: string;

beforeAll(async () => {
  const exe = chromium.executablePath();
  if (!existsSync(exe)) {
    throw new Error(
      `Không thấy Chromium của Playwright (${exe}). Cài bằng "pnpm --filter @makeup/web exec playwright install chromium" ` +
        'hoặc đặt PLAYWRIGHT_BROWSERS_PATH trỏ tới thư mục trình duyệt đã cài — bài vẽ mẫu giấy chứng nhận không tự bỏ qua.',
    );
  }
  server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 0, strictPort: false, host: '127.0.0.1', hmr: false, proxy: {} },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite không trả địa chỉ');
  base = url.replace(/\/$/, '');
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const LONG = 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo';
const SHORT = 'Đặng Quỳnh Như';
const dataOf = (extra: Record<string, string> = {}): Record<string, string> => ({
  that: '1', xuat: '1', th: 'Chiến Makeup Academy', logo: `${base}/mau/chung/logo-mau.svg`, ten: LONG,
  anh: `${base}/mau/chung/anh-hoc-vien.svg`, khoa: 'Makeup chuyên nghiệp', lop: 'K12', ncap: '20/12/2026', so: 'CC-2026-0007',
  gv: 'Nguyễn Thu Hà', gd: 'Nguyễn Trọng Chiến', ...extra,
});

interface Facts {
  ttInk: { l: number; r: number; lines: number } | null;
  tenInk: { l: number; r: number; lines: number } | null;
  ttBox: { l: number; r: number };
  tenBox: { l: number; r: number };
  anhChu: string | null;
  anhChua: boolean;
  logoHidden: boolean;
  khongLogo: boolean;
  dong: string;
  so: string;
  nhAn: boolean | null;
  ngayChu: string;
  gdcv: string;
  ngoai: string[];
  loi: string | undefined;
  tenText: string;
}

// Mở mẫu ở khổ 1123×794 (khung vẽ thật), lấy số đo: mực chữ SVG (đo bằng canvas, không phải hộp dòng) so với hộp ô.
async function facts(code: string, params: Record<string, string>): Promise<Facts> {
  const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${base}/mau/${code}.html?${new URLSearchParams(params)}`);
    await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30_000 });
    const r = await page.evaluate(() => {
      const cc = document.querySelector('.cc') as HTMLElement;
      const C = cc.getBoundingClientRect();
      const cv = document.createElement('canvas').getContext('2d')!;
      const ink = (box: Element) => {
        const ts = Array.from(box.querySelectorAll('text.face'));
        if (!ts.length) return null;
        const bb = box.getBoundingClientRect();
        const rs = ts.map((t) => {
          cv.font = `${t.getAttribute('font-style')} ${t.getAttribute('font-weight')} ${t.getAttribute('font-size')}px ${t.getAttribute('font-family')}`;
          (cv as unknown as { letterSpacing: string }).letterSpacing = `${t.getAttribute('letter-spacing')}px`;
          const m = cv.measureText(t.textContent ?? '');
          const x = Number(t.getAttribute('x'));
          return { l: bb.left + x - m.actualBoundingBoxLeft, r: bb.left + x + m.actualBoundingBoxRight };
        });
        return { l: Math.min(...rs.map((x) => x.l)), r: Math.max(...rs.map((x) => x.r)), lines: ts.length };
      };
      const tt = cc.querySelector('.tt.sv')!, ten = cc.querySelector('.ten.sv')!;
      const tb = tt.getBoundingClientRect(), nb = ten.getBoundingClientRect();
      const anh = cc.querySelector('.anh');
      const nh = cc.querySelector('.nh');
      const ngoai = Array.from(cc.querySelectorAll('*'))
        .filter((e) => !e.closest('svg') && e.children.length === 0 && (e.textContent ?? '').trim() && getComputedStyle(e).display !== 'none')
        .filter((e) => { const x = e.getBoundingClientRect(); return x.right > C.right + 1 || x.left < C.left - 1 || x.bottom > C.bottom + 1; })
        .map((e) => (e.textContent ?? '').trim().slice(0, 30));
      return {
        ttInk: ink(tt), tenInk: ink(ten), ttBox: { l: tb.left, r: tb.right }, tenBox: { l: nb.left, r: nb.right },
        anhChu: anh ? getComputedStyle(anh, '::after').content : null,
        anhChua: !!anh?.classList.contains('chua-anh'),
        logoHidden: Array.from(cc.querySelectorAll('.o-logo')).every((e) => getComputedStyle(e).display === 'none'),
        khongLogo: cc.classList.contains('khong-logo'),
        dong: cc.querySelector('[data-f="dong"]')?.textContent ?? '',
        so: (nh?.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        nhAn: nh ? getComputedStyle(nh).display === 'none' : null,
        ngayChu: cc.querySelector('[data-f="ngayChu"]')?.textContent ?? '',
        gdcv: cc.querySelector('[data-f="gdcv"]')?.textContent ?? '',
        ngoai, loi: document.body.dataset.loi, tenText: (ten as HTMLElement).dataset.goc ?? '',
      };
    });
    expect(errors, `${code} lỗi JS`).toEqual([]);
    expect(r.loi, `${code} lỗi vẽ`).toBeUndefined();
    return r as Facts;
  } finally {
    await page.close();
  }
}

const tran = (ink: { l: number; r: number } | null, box: { l: number; r: number }) => (ink ? Math.max(box.l - ink.l, ink.r - box.r) : 0);

describe('16 mẫu vẽ thật trong Chromium (?that=1)', () => {
  it('BẮT (T1-2, T1-3): tên dài "Tôn Nữ Hoàng Bảo Ngọc Phương Thảo" và tên ngắn "Đặng Quỳnh Như" — mực chữ tên và tiêu đề tràn ≤ 1 px; tiêu đề một dòng', async () => {
    for (const code of CODES) {
      for (const ten of [LONG, SHORT]) {
        const f = await facts(code, dataOf({ ten }));
        expect(f.ttInk?.lines, `${code} tiêu đề`).toBe(1);
        expect(tran(f.ttInk, f.ttBox), `${code} tiêu đề ${ten}`).toBeLessThanOrEqual(1);
        expect(f.tenText, code).toBe(ten);
        expect(tran(f.tenInk, f.tenBox), `${code} tên ${ten}`).toBeLessThanOrEqual(1);
      }
    }
  }, 240_000);

  it('BẮT (T1-3): không ảnh → chữ cái đầu "ĐN"; không ảnh cũng không tên → khung trống; không logo → ẩn mọi ô logo; lop trùng khoa → không "· Lớp"', async () => {
    for (const code of CODES) {
      const a = await facts(code, dataOf({ ten: SHORT, anh: '' }));
      expect(a.anhChua, code).toBe(true);
      expect(a.anhChu, code).toBe('"ĐN"');
      const b = await facts(code, dataOf({ ten: '', anh: '' }));
      expect(b.anhChu, code).toBe('""');
      expect(b.tenText, code).toBe('');
      const c = await facts(code, dataOf({ logo: '' }));
      expect(c.logoHidden, code).toBe(true);
      expect(c.khongLogo, code).toBe(true);
      const d = await facts(code, dataOf({ lop: 'Makeup chuyên nghiệp' }));
      if (d.dong) expect(d.dong, code).toBe('Đã hoàn thành khoá Makeup chuyên nghiệp');
    }
  }, 240_000);

  it('BẮT: that=1 để trống ô thiếu (không lấy chữ mẫu R&D): không tên, không số, không ngày, không khoá; chức danh người ký 2 giữ nhãn in sẵn', async () => {
    for (const code of CODES) {
      const f = await facts(code, { that: '1', xuat: '1' });
      expect(f.tenText, code).toBe('');
      expect(f.dong, code).toBe('');
      expect(f.ngayChu, code).toBe('');
      expect(f.nhAn, code).toBe(true);
      expect(f.gdcv, code).toBe('Giám đốc trung tâm');
      expect(f.ttInk?.lines, code).toBe(1);
    }
  }, 240_000);

  it('BẮT: bản cấp lại — dòng số thành "Số … · Bản cấp lại dd/mm/yyyy"; bản gốc không có; chức danh người ký tuỳ chỉnh thay nhãn', async () => {
    for (const code of CODES) {
      const g = await facts(code, dataOf({ ten: SHORT }));
      expect(g.so.toLowerCase(), code).not.toContain('cấp lại');
      expect(g.so, code).toContain('CC-2026-0007');
      const l = await facts(code, dataOf({ ten: SHORT, lai: '05/01/2027', gdcv: 'Tổng giám đốc' }));
      expect(l.so.replace(/\s+/g, ' '), code).toMatch(/CC-2026-0007 · Bản cấp lại 05\/01\/2027/i);
      expect(l.gdcv, code).toBe('Tổng giám đốc');
    }
  }, 240_000);

  // Nghiệm thu F, T2: luật `.c8 .day i{background:#6B5A3A}` (viết cho vạch ngăn) trúng luôn <i class="lai"> → chữ cấp lại in trên dải nâu.
  // Đo THẬT: ẩn mực chữ (color:transparent, giữ nền của chính phần tử), chụp đúng vùng chữ để lấy điểm ảnh nền ngay sau chữ,
  // rồi tính tương phản WCAG giữa màu chữ (đã tính độ mờ của cha) và từng điểm ảnh nền. Lấy phân vị 25 (chịu được vài điểm viền / hoa văn).
  it('BẮT (T2): với tham số lai, chữ "· Bản cấp lại dd/mm/yyyy" ở cả 16 mẫu có tương phản ≥ 4,5:1 với nền ngay sau nó', async () => {
    const MIN = 4.5;
    const got: Record<string, number> = {};
    for (const code of CODES) {
      const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
      try {
        await page.goto(`${base}/mau/${code}.html?${new URLSearchParams(dataOf({ ten: SHORT, lai: '05/01/2027' }))}`);
        await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30_000 });
        const info = await page.evaluate(() => {
          const el = document.querySelector('.cc .lai') as HTMLElement;
          const r = el.getBoundingClientRect();
          let alpha = 1;
          for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
          const color = getComputedStyle(el).color;
          el.style.color = 'transparent';
          el.style.textShadow = 'none';
          return { text: el.textContent ?? '', color, rect: { x: r.left, y: r.top, w: r.width, h: r.height }, alpha };
        });
        expect(info.text, `${code} chữ cấp lại`).toMatch(/Bản cấp lại 05\/01\/2027/);
        expect(info.rect.w * info.rect.h, `${code} vùng chữ cấp lại có kích thước`).toBeGreaterThan(0);
        const clip = { x: Math.floor(info.rect.x), y: Math.floor(info.rect.y), width: Math.ceil(info.rect.w) + 1, height: Math.ceil(info.rect.h) + 1 };
        const shot = (await page.screenshot({ clip })).toString('base64');
        const p25 = await page.evaluate(
          async ({ b64, color, alpha }) => {
            const im = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
            const c = document.createElement('canvas');
            c.width = im.width;
            c.height = im.height;
            const x = c.getContext('2d')!;
            x.drawImage(im, 0, 0);
            const d = x.getImageData(0, 0, im.width, im.height).data;
            const [fr, fg, fb] = (color.match(/[\d.]+/g) ?? []).map(Number) as [number, number, number];
            const lin = (v: number) => { const u = v / 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
            const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
            const ratios: number[] = [];
            for (let k = 0; k < d.length; k += 4) {
              const bg: [number, number, number] = [d[k]!, d[k + 1]!, d[k + 2]!];
              const l1 = lum(alpha * fr + (1 - alpha) * bg[0], alpha * fg + (1 - alpha) * bg[1], alpha * fb + (1 - alpha) * bg[2]);
              const l2 = lum(...bg);
              ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
            }
            ratios.sort((a, b) => a - b);
            return ratios[Math.floor(ratios.length * 0.25)]!;
          },
          { b64: shot, color: info.color, alpha: info.alpha },
        );
        got[code] = Math.round(p25 * 100) / 100;
      } finally {
        await page.close();
      }
    }
    for (const code of CODES) expect(got[code], `${code} tương phản chữ cấp lại ${got[code]}:1 (cần ≥ ${MIN}:1) — cả bảng ${JSON.stringify(got)}`).toBeGreaterThanOrEqual(MIN);
  }, 240_000);

  it('BẮT: tên khoá / trung tâm / người ký quá dài không tràn ra ngoài khung giấy (chữ thu nhỏ hoặc cắt "…")', async () => {
    for (const code of CODES) {
      const f = await facts(code, dataOf({
        khoa: 'Makeup cô dâu chuyên nghiệp nâng cao kèm kỹ thuật trang điểm sự kiện', lop: 'K12 tối thứ Ba thứ Năm',
        th: 'Học viện Makeup & Nghệ thuật Làm đẹp Quốc tế Hoàng Gia Sài Gòn', gv: 'Nguyễn Thị Hồng Nhung Ngọc Lan Anh', gd: 'Trần Nguyễn Hoàng Thiên Phúc Bảo An',
      }));
      expect(f.ngoai, code).toEqual([]);
    }
  }, 240_000);

  it('BẮT (T1-4): MAU_XUAT_PNG ra đúng 1754×1240 (PNG thật) và sai khác trung bình so với ảnh chụp Playwright deviceScaleFactor = 1754/1123 ≤ 8/255 — cả 16 mẫu', async () => {
    expect(CERTIFICATE_IMAGE).toEqual({ width: 1754, height: 1240 });
    for (const code of CODES) {
      const ctx = await browser.newContext({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1754 / 1123 });
      const page = await ctx.newPage();
      try {
        await page.goto(`${base}/mau/${code}.html?${new URLSearchParams(dataOf({ ten: SHORT }))}`);
        await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30_000 });
        const shot = (await page.locator('.cc').screenshot()).toString('base64');
        const r = await page.evaluate(async (shotB64) => {
          const w = window as unknown as { MAU_XUAT_PNG: () => Promise<{ blob: Blob; width: number; height: number }> };
          const o = await w.MAU_XUAT_PNG();
          const head = new Uint8Array(await o.blob.slice(0, 24).arrayBuffer());
          const dv = new DataView(head.buffer);
          const load = (src: string) => new Promise<HTMLImageElement>((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; });
          const A = await load(URL.createObjectURL(o.blob));
          const B = await load(`data:image/png;base64,${shotB64}`);
          const px = (im: HTMLImageElement) => { const c = document.createElement('canvas'); c.width = 1754; c.height = 1240; const x = c.getContext('2d')!; x.drawImage(im, 0, 0, 1754, 1240); return x.getImageData(0, 0, 1754, 1240).data; };
          const a = px(A), s = px(B);
          let sum = 0;
          for (let k = 0; k < a.length; k += 4) sum += (Math.abs(a[k]! - s[k]!) + Math.abs(a[k + 1]! - s[k + 1]!) + Math.abs(a[k + 2]! - s[k + 2]!)) / 3;
          return { sig: Array.from(head.slice(0, 8)), w: dv.getUint32(16), h: dv.getUint32(20), khaiW: o.width, khaiH: o.height, mean: sum / (a.length / 4) };
        }, shot);
        expect(r.sig, code).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        expect([r.w, r.h, r.khaiW, r.khaiH], code).toEqual([1754, 1240, 1754, 1240]);
        expect(r.mean, `${code} sai khác TB ${r.mean.toFixed(2)}`).toBeLessThanOrEqual(8);
      } finally {
        await ctx.close();
      }
    }
  }, 300_000);

  it('BẮT: ảnh xuất GIỮ NỀN riêng của mẫu (cc-01 cột trái xanh đêm, không bị html-to-image tô trắng)', async () => {
    const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
    try {
      await page.goto(`${base}/mau/cc-01.html?${new URLSearchParams(dataOf())}`);
      await page.waitForFunction(() => document.body.dataset.ready === '1');
      const px = await page.evaluate(async () => {
        const w = window as unknown as { MAU_XUAT_PNG: () => Promise<{ blob: Blob }> };
        const o = await w.MAU_XUAT_PNG();
        const bmp = await createImageBitmap(o.blob);
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const x = c.getContext('2d')!; x.drawImage(bmp, 0, 0);
        return Array.from(x.getImageData(40, 700, 1, 1).data);
      });
      // #0E2535 ± sai số nén: tối, không phải trắng.
      expect(px[0]!).toBeLessThan(60);
      expect(px[2]!).toBeLessThan(90);
    } finally {
      await page.close();
    }
  }, 60_000);
});
