// Bản vẽ H mục 4.4 — 10 mẫu chào mừng mới cm-01..10 vào app + khối MÃ SỐ trên cả 21 mẫu chào mừng.
// Đọc thẳng tệp tĩnh public/mau/** (đúng tệp app nạp vào iframe xem trước / xuất PNG). Phần đo bằng Chromium ở ma-so-tep-ve.test.ts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { listDesignTemplates } from '@makeup/shared';
import { describe, expect, it } from 'vitest';
import { thumbnailUrl } from './model';

const PUBLIC = new URL('../../../public/', import.meta.url);
const fileOf = (p: string) => new URL(p.replace(/^\//, ''), PUBLIC);
const read = (p: string) => readFileSync(fileOf(p), 'utf8');
const html = (code: string) => read(`/mau/${code}.html`);
const CM = Array.from({ length: 10 }, (_, i) => `cm-${String(i + 1).padStart(2, '0')}`);
const WELCOME = listDesignTemplates({ kind: 'WELCOME' });
const CHUNG = ['cm.css', 'cm.js', 've.js', 've-moi.js'].map((f) => [f, read(`/mau/chung/${f}`)] as const);
const CM_CSS = read('/mau/chung/cm.css');
const MAU_JS = read('/mau/chung/mau.js');
const noComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

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

function walk(dir: URL): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const u = new URL(n, dir);
    if (statSync(u).isDirectory()) out.push(...walk(new URL(`${n}/`, dir)).map((x) => `${n}/${x}`));
    else out.push(n);
  }
  return out;
}

describe('10 mẫu cm trong app — phông, phần chung, không tham chiếu tài liệu R&D', () => {
  it('BẮT: mỗi mẫu cm nạp phong/phong.css + phong/ss-album/ss-album.css CỦA APP bằng <link> (trước cm.css), không nạp bản phông R&D', () => {
    for (const c of CM) {
      const src = html(c);
      const links = [...src.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
      expect(links, c).toEqual(['phong/phong.css', 'phong/ss-album/ss-album.css', 'chung/mau.css', 'chung/cm.css']);
      expect(src, c).not.toContain('chung/phong.css');
      expect(noComments(src), c).not.toMatch(/@import/);
    }
  });

  it('BẮT: không có @font-face riêng (mẫu cm và chung/cm.css) — không chép thêm bản phông; MonteCarlo/Ephesis chỉ có MỘT bản trong app (ss-album)', () => {
    for (const c of CM) expect(noComments(html(c)), c).not.toMatch(/@font-face/i);
    for (const [f, src] of CHUNG) expect(noComments(src), f).not.toMatch(/@font-face/i);
    const fonts = walk(fileOf('/mau/')).filter((f) => /montecarlo|ephesis/i.test(f) && /\.(ttf|otf|woff2?)$/i.test(f));
    expect(fonts.sort()).toEqual(['phong/ss-album/ephesis/Ephesis-Regular.woff2', 'phong/ss-album/montecarlo/MonteCarlo-Regular.woff2']);
  });

  it('BẮT: chữ ký R&D-10 nối vào phông có sẵn: --f-tay-1 = MP Chữ ký 5 (MonteCarlo), --f-tay-2 = MP Chữ ký 6 (Ephesis); không có WindSong', () => {
    expect(noComments(CM_CSS)).toContain(':root{--f-tay-1:var(--f-ky-5);--tay-co-1:var(--ky-co-5);--f-tay-2:var(--f-ky-6);--tay-co-2:var(--ky-co-6)}');
    const ss = read('/mau/phong/ss-album/ss-album.css');
    expect(ss).toContain("@font-face{font-family:'MP Chữ ký 5';src:url(montecarlo/MonteCarlo-Regular.woff2)");
    expect(ss).toContain("@font-face{font-family:'MP Chữ ký 6';src:url(ephesis/Ephesis-Regular.woff2)");
    for (const c of CM) {
      const src = noComments(html(c));
      expect(src, c).not.toMatch(/windsong|MP Viết tay/i);
      // Mẫu Ephesis (cm-02, 05, 08) trỏ biến 1 sang biến 2; danh mục khai đúng phông.
      const ephesis = /--f-tay-1:var\(--f-tay-2\)/.test(src);
      expect(WELCOME.find((t) => t.code === c)?.fonts[0], c).toBe(ephesis ? 'MP Chữ ký 6' : 'MP Chữ ký 5');
    }
    expect(CM.filter((c) => /--f-tay-1:var\(--f-tay-2\)/.test(html(c)))).toEqual(['cm-02', 'cm-05', 'cm-08']);
  });

  it('BẮT: không tham chiếu docs/ hay thư mục cha (../) ở mẫu cm và phần chung cm.css, cm.js, ve.js, ve-moi.js', () => {
    for (const c of CM) expect(html(c), c).not.toMatch(/docs\/|\.\.\//);
    for (const [f, src] of CHUNG) expect(src, f).not.toMatch(/docs\/|\.\.\//);
  });

  it('BẮT: thứ tự script ve.js → ve-moi.js → mau.js → cm.js → html-to-image.js → xuat.js (cm.js nối vào MAU_SAN_SANG của mau.js)', () => {
    for (const c of CM) {
      const src = html(c);
      const pos = ['chung/ve.js', 'chung/ve-moi.js', 'chung/mau.js', 'chung/cm.js', 'chung/html-to-image.js', 'chung/xuat.js'].map((s) => src.indexOf(`<script src="${s}">`));
      expect(pos.every((p) => p > 0), c).toBe(true);
      expect([...pos].sort((a, b) => a - b), c).toEqual(pos);
    }
    const cmJs = read('/mau/chung/cm.js');
    expect(cmJs).toContain('const goc=window.MAU_SAN_SANG||Promise.resolve();');
    expect(cmJs).toContain('window.MAU_SAN_SANG=goc.then(');
  });

  it('BẮT: khung ảnh cm TRÒN — cm.css .av bo 50%; không mẫu cm nào có .av khác tròn (cm-02 hết viên thuốc)', () => {
    expect(noComments(CM_CSS)).toMatch(/\.av\{flex:none;overflow:hidden;border-radius:50%\}/);
    for (const c of CM) {
      const src = noComments(html(c));
      expect(src, c).not.toMatch(/border-radius:999px/);
      for (const m of src.matchAll(/\.av\{([^}]*)\}/g)) {
        const rule = m[1] ?? '';
        expect(rule, c).not.toMatch(/border-radius/);
        const w = /width:(\d+)px/.exec(rule)?.[1], h = /height:(\d+)px/.exec(rule)?.[1];
        if (w || h) expect(w, `${c} ${rule}`).toBe(h);
      }
    }
  });
});

describe('khối mã số trên 21 mẫu chào mừng', () => {
  it('BẮT: mỗi mẫu chào mừng có đúng 1 ô data-f="ma" nằm trong đúng 1 khối class="seat"; không còn data-seat của R&D', () => {
    expect(WELCOME).toHaveLength(21);
    for (const t of WELCOME) {
      const src = noComments(html(t.code));
      expect([...src.matchAll(/data-f="ma"/g)], t.code).toHaveLength(1);
      expect([...src.matchAll(/class="seat"/g)], t.code).toHaveLength(1);
      const at = src.indexOf('class="seat"');
      expect(src.indexOf('data-f="ma"'), t.code).toBeGreaterThan(at);
      expect(src.slice(at, src.indexOf('data-f="ma"')), t.code).not.toMatch(/<\/(div|span)>[\s\S]*<\/(div|span)>[\s\S]*<\/(div|span)>/);
      expect(src, t.code).not.toMatch(/data-seat/);
      expect(t.slots, t.code).toContain('ma');
    }
  });

  it('BẮT: mau.js nhận khoá ma (mặc định "07" ngoài dữ liệu thật) và ẩn hẳn khối .seat khi trống', () => {
    expect(MAU_JS).toContain("ma:G('ma','07')");
    expect(MAU_JS).toContain(`if(!D.ma){document.body.classList.add('khong-ma');document.querySelectorAll('[data-f="ma"]').forEach(el=>{(el.closest('.seat')||el).style.display='none';});}`);
    // Chạy SAU khi điền ô (ô ma đã có chữ) và trước lời hứa sẵn sàng.
    expect(MAU_JS.indexOf("classList.add('khong-ma')")).toBeGreaterThan(MAU_JS.indexOf("document.querySelectorAll('[data-f]').forEach"));
  });

  it('BẮT: ảnh nhỏ của 21 mẫu chào mừng có đủ, JPEG đúng 216×270', () => {
    for (const t of WELCOME) {
      const p = thumbnailUrl(t, 'COURSE');
      expect(p, t.code).toBe(`/mau/anh-nho/${t.code}.jpg`);
      expect(existsSync(fileOf(p)), p).toBe(true);
      const buf = readFileSync(fileOf(p));
      expect(buf.subarray(0, 2).toString('hex'), t.code).toBe('ffd8');
      expect(jpegSize(buf), t.code).toEqual({ w: 216, h: 270 });
    }
  });
});

// Tương phản chữ nhỏ "SỐ" của khối mã ≥ 4,5:1 (WCAG AA) trên nền ngay dưới (nền trơn của khối; nền chuyển màu: lấy màu TỐI/SÁNG
// bất lợi nhất của dải). Màu chữ đọc thật từ tệp vẽ (kể cả biến --nhan trong :root của mẫu).
const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const SEAT_LABEL: [code: string, rule: string, bg: string][] = [
  ['cm-01', '.seat-l', '#FBF7EC'], ['cm-02', '.seat-l', '#FBF7EC'], ['cm-03', '.seat-l', '#FBF7EC'], ['cm-04', '.seat-l', '#4A3A24'],
  ['cm-05', '.seat-l', '#FFFDF8'], ['cm-06', '.seat-l', '#FBF6EA'], ['cm-07', '.seat-l', '#22407A'], ['cm-08', '.seat-l', '#EBB945'],
  ['cm-09', '.seat-l', '#D2AE6F'], ['cm-10', '.seat-l', '#B58630'],
  ['shd-01', '.seat-l', '#FBF7EE'], ['shd-02', '.seat-l', '#131212'], ['shd-03', '.seat-l', '#FBF8F4'], ['shd-04', '.seat-l', '#FFFFFF'],
  ['shd-05', '.seat-l', '#FFFDF9'], ['shd-06', '.seat-l', '#1F3A33'], ['shd-07', '.st .l', '#5A1E2E'], ['shd-08', '.seat-l', '#FBFAF7'],
  ['shd-09', '.seat-l', '#FBF3EE'], ['shd-10', '.seat-l', '#1C2333'], ['shd-11', '.seat-l', '#ECE7E1'],
];

describe('tương phản nhãn "SỐ" của khối mã', () => {
  it('BẮT: nhãn chữ nhỏ của khối mã đạt ≥ 4,5:1 trên nền ngay dưới — cả 21 mẫu', () => {
    expect(SEAT_LABEL.map(([c]) => c).sort()).toEqual(WELCOME.map((t) => t.code).sort());
    for (const [code, rule, bg] of SEAT_LABEL) {
      const src = html(code);
      const esc = rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = new RegExp(`(?:^|[}\\n])${esc}\\{([^}]*)\\}`).exec(src);
      expect(m, `${code} ${rule}`).not.toBeNull();
      let color = /color:([^;}]+)/.exec(m![1] ?? '')?.[1]?.trim() ?? '';
      const v = /^var\((--[\w-]+)\)$/.exec(color);
      if (v) color = new RegExp(`${v[1]}:(#[0-9A-Fa-f]{6})`).exec(src)?.[1] ?? '';
      expect(color, `${code} ${rule}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(contrast(color, bg), `${code} ${rule} ${color} trên ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
