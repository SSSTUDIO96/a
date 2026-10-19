// Bảng màu nhân vật (việc tồn 3): 12 nhân vật đầu khác màu nhau, màu phân biệt được (ΔE2000) và chữ đọc rõ trên nền sáng.
// Đọc THẬT giá trị màu từ schedule.css (khối .ws-sw-*) và tokens.css, không chép số vào bài thử.
// In bảng số: IN_BANG_MAU=1 pnpm exec vitest run src/features/schedule/subjectColors.test.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OCCASIONS, OCCASION_COLORS } from '@makeup/shared';
import { apptSwatch, occasionSwatch, SWATCHES, subjectSwatches, swatchOf, type Swatch } from './model';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = fileURLToPath(new URL('../../', import.meta.url));
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const scheduleCss = strip(readFileSync(join(HERE, 'schedule.css'), 'utf8'));
const tokensCss = strip(readFileSync(join(SRC, 'styles/tokens.css'), 'utf8'));

type Rgb = [number, number, number];
const TOKENS = new Map([...tokensCss.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1] ?? '', (m[2] ?? '').toUpperCase()]));
const hexRgb = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
const rgbHex = (c: Rgb) => `#${c.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

// Giá trị CSS → màu: #hex, var(--token), color-mix(in srgb, A p%, B).
function resolve(v: string): Rgb {
  const s = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return hexRgb(s);
  const tok = /^var\((--[\w-]+)\)$/.exec(s);
  if (tok) {
    const hex = TOKENS.get(tok[1] ?? '');
    if (!hex) throw new Error(`Không có token ${tok[1]}`);
    return hexRgb(hex);
  }
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/.exec(s);
  if (mix) {
    const a = resolve(mix[1] ?? ''), b = resolve(mix[3] ?? ''), p = Number(mix[2]) / 100;
    return a.map((x, i) => x * p + (b[i] ?? 0) * (1 - p)) as Rgb;
  }
  throw new Error(`Không đọc được màu "${v}"`);
}

function swatchRule(name: Swatch): { c: Rgb; b: Rgb } | null {
  const m = new RegExp(`(?:^|\\})\\s*\\.ws-sw-${name}\\s*\\{([^}]*)\\}`).exec(scheduleCss);
  if (!m) return null;
  const c = /--c:\s*([^;]+);/.exec(m[1] ?? ''), b = /--b:\s*([^;]+);/.exec(m[1] ?? '');
  if (!c || !b) return null;
  return { c: resolve(c[1] ?? ''), b: resolve(b[1] ?? '') };
}

// WCAG 2.x
const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (x: Rgb, y: Rgb) => {
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
// sRGB → CIELAB (D65) và CIEDE2000.
function lab([r, g, b]: Rgb): Rgb {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const rad = (d: number) => (d * Math.PI) / 180;
function de2000(p: Rgb, q: Rgb): number {
  const [L1, a1, b1] = lab(p), [L2, a2, b2] = lab(q);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const h1 = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360, h2 = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  let dh = h2 - h1;
  if (C1 * C2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin(rad(dh / 2));
  const Lb = (L1 + L2) / 2, Cbp = (C1 + C2) / 2;
  const hb = C1 * C2 === 0 ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
  const dth = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dth)) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

const WHITE: Rgb = [1, 1, 1];
const ORIGINAL6 = ['rose', 'violet', 'amber', 'green', 'blue', 'taupe'] as const;
const NEW6 = SWATCHES.filter((s) => !(ORIGINAL6 as readonly string[]).includes(s));
const DEFAULTS = ['Cô dâu', 'Chú rể', 'Mẹ cô dâu', 'Mẹ chú rể', 'Phù dâu', 'Khách mời'];
const CUSTOM = ['Bà nội', 'Bà ngoại', 'Em bé', 'Chị gái cô dâu', 'Bạn thân', 'Người mẫu ảnh', 'Cô giáo', 'Dì út'];
const distinct = (names: readonly string[], org: readonly string[]) => new Set(names.map((n) => swatchOf(n, org))).size;

describe('bảng màu nhân vật — giá trị trong schedule.css', () => {
  const rules = new Map(SWATCHES.map((s) => [s, swatchRule(s)] as const));

  it('BẮT: đủ 12 màu, mỗi màu có luật .ws-sw-<màu> với --c và --b đọc được; "Khác" vẫn có luật riêng', () => {
    expect(SWATCHES).toHaveLength(12);
    for (const s of SWATCHES) expect(rules.get(s), s).not.toBeNull();
    expect(swatchRule('other')).not.toBeNull();
  });

  it('GIỮ: 6 màu đầu không đổi (người dùng đã quen)', () => {
    const got = Object.fromEntries(ORIGINAL6.map((s) => [s, [rgbHex(rules.get(s)!.c), rgbHex(rules.get(s)!.b)]]));
    expect(got).toEqual({
      rose: ['#A63D62', '#FBEDF2'],
      violet: ['#5B45A0', '#F0ECFA'],
      amber: ['#9A5B0F', '#FDF2E2'],
      green: ['#2F7D72', '#E6F3F0'],
      blue: ['#3D6A9A', '#ECF0F5'],
      taupe: ['#7A6A62', '#F2F0EF'],
    });
  });

  it('BẮT: 12 màu phân biệt được — ΔE2000 mọi cặp (66 cặp) ≥ 14', () => {
    const pairs: { a: string; b: string; d: number }[] = [];
    SWATCHES.forEach((a, i) => SWATCHES.slice(i + 1).forEach((b) => pairs.push({ a, b, d: de2000(rules.get(a)!.c, rules.get(b)!.c) })));
    expect(pairs).toHaveLength(66);
    pairs.sort((x, y) => x.d - y.d);
    if (process.env.IN_BANG_MAU) {
      console.log('ΔE2000 (nhỏ → lớn):\n' + pairs.map((p) => `  ${p.a.padEnd(7)} ${p.b.padEnd(7)} ${p.d.toFixed(1)}`).join('\n'));
    }
    for (const p of pairs) expect(p.d, `${p.a} – ${p.b}`).toBeGreaterThanOrEqual(14);
  });

  it('BẮT: chữ màu mới đọc rõ — tương phản ≥ 4,5:1 trên nền pha của chính màu và trên nền trắng; màu cũ ≥ 4,5 trên nền trắng', () => {
    const rows = SWATCHES.map((s) => ({ s, hex: rgbHex(rules.get(s)!.c), bg: rgbHex(rules.get(s)!.b), onBg: contrast(rules.get(s)!.c, rules.get(s)!.b), onWhite: contrast(rules.get(s)!.c, WHITE) }));
    if (process.env.IN_BANG_MAU) {
      console.log('Tương phản chữ:\n' + rows.map((r) => `  ${r.s.padEnd(7)} ${r.hex} trên ${r.bg} ${r.onBg.toFixed(2)} · trên trắng ${r.onWhite.toFixed(2)}`).join('\n'));
    }
    for (const r of rows) {
      expect(r.onWhite, `${r.s} trên trắng`).toBeGreaterThanOrEqual(4.5);
      if ((NEW6 as readonly string[]).includes(r.s)) expect(r.onBg, `${r.s} trên nền pha`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('bảng màu nhân vật — cấp màu theo danh sách của tổ chức', () => {
  it('BẮT: 6 nhân vật cài sẵn + 6 tự thêm → 12 màu khác nhau ("Bà nội" không còn trùng "Cô dâu")', () => {
    const org = [...DEFAULTS, ...CUSTOM.slice(0, 6)];
    expect(distinct(org, org)).toBe(12);
    expect(swatchOf('Bà nội', org)).not.toBe(swatchOf('Cô dâu', org));
    expect(CUSTOM.slice(0, 6).map((n) => swatchOf(n, org))).toEqual(NEW6);
  });

  it('BẮT: nhân vật tự thêm đứng xen / đứng trước nhân vật cài sẵn — 12 nhân vật đầu vẫn khác màu', () => {
    const mixed = ['Bà nội', 'Cô dâu', 'Em bé', 'Chú rể', 'Bà ngoại', 'Mẹ cô dâu', 'Bạn thân', 'Phù dâu', 'Dì út', 'Khách mời', 'Cô giáo', 'Mẹ chú rể'];
    expect(distinct(mixed, mixed)).toBe(12);
    const customFirst = [...CUSTOM.slice(0, 6), ...DEFAULTS];
    expect(distinct(customFirst, customFirst)).toBe(12);
  });

  it('BẮT: tổ chức đã xoá bớt nhân vật cài sẵn — nhân vật tự thêm dùng cả màu cài sẵn còn trống, 12 nhân vật đầu khác màu', () => {
    const org = ['Cô dâu', 'Chú rể', ...CUSTOM, 'Phù dâu', 'Khách mời'];
    expect(org).toHaveLength(12);
    expect(distinct(org, org)).toBe(12);
    const allCustom = [...CUSTOM, 'Ông nội', 'Ông ngoại', 'Chị họ', 'Anh trai'];
    expect(distinct(allCustom, allCustom)).toBe(12);
  });

  it('GIỮ: nhân vật cài sẵn giữ màu ở mọi vị trí (cả sau vị trí 12) và khi không có danh sách', () => {
    const want = { 'Cô dâu': 'rose', 'Mẹ cô dâu': 'violet', 'Phù dâu': 'amber', 'Mẹ chú rể': 'green', 'Chú rể': 'blue', 'Khách mời': 'taupe' };
    const late = [...CUSTOM, 'Ông nội', 'Ông ngoại', 'Chị họ', 'Anh trai', ...DEFAULTS];
    for (const org of [[], DEFAULTS, late]) {
      for (const [n, c] of Object.entries(want)) expect(swatchOf(n, org), `${n} / ${org.length}`).toBe(c);
    }
  });

  it('GIỮ: thêm nhân vật vào cuối danh sách không đổi màu nhân vật đã có; từ nhân vật thứ 13 mới dùng lại màu', () => {
    const org = [...DEFAULTS, ...CUSTOM.slice(0, 4)];
    const before = org.map((n) => swatchOf(n, org));
    const more = [...org, CUSTOM[4]!, CUSTOM[5]!, CUSTOM[6]!];
    expect(org.map((n) => swatchOf(n, more))).toEqual(before);
    expect(distinct(more.slice(0, 12), more)).toBe(12);
    expect(SWATCHES).toContain(swatchOf(CUSTOM[6]!, more));
    // Bảng cấp màu có đủ mọi nhân vật trong danh sách, không trùng tên khác hoa thường.
    expect(subjectSwatches([...more, ' bà NỘI ']).size).toBe(more.length);
  });
});

describe('mọi chỗ tô màu theo nhân vật dùng chung một bảng', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return files(p);
      return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });
  }
  const code = files(SRC).map((p) => ({ p: p.slice(SRC.length), s: readFileSync(p, 'utf8') }));

  it('BẮT: lớp màu ws-sw-* chỉ dựng từ apptSwatch (qua useApptSwatch / apptClasses), swatchOf (chú thích nhân vật) hoặc occasionSwatch; không nơi nào khác giữ bảng tên nhân vật → màu', () => {
    const sites = code.flatMap(({ p, s }) => [...s.matchAll(/ws-sw-\$\{([^}]+)\}/g)].map((m) => ({ p, arg: (m[1] ?? '').trim() })));
    expect(sites.length).toBeGreaterThan(0);
    for (const x of sites) expect(x.arg, x.p).toMatch(/^(swatch|o\.swatch|swatchOfName\([^)]*\)|swatchOfAppt\([^)]*\)|occasionSwatch\([^)]*\)|noOccasion)$/);
    // Mỗi lời gọi apptClasses truyền màu lấy từ swatchOfAppt(...) (= useApptSwatch → apptSwatch theo công tắc "Tô màu").
    const calls = code.flatMap(({ p, s }) => [...s.matchAll(/(?<!function )apptClasses\(([^\n]*)/g)].map((m) => ({ p, a: m[1] ?? '' })));
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.a, c.p).toMatch(/swatchOfAppt\([^)]*\)\)/);
    const usesHook = code.filter(({ s }) => /swatchOfAppt\(/.test(s));
    for (const f of usesHook) expect(f.s, f.p).toMatch(/const swatchOfAppt = useApptSwatch\(\)/);
    // Bảng tên nhân vật cài sẵn → màu chỉ có ở model.ts của Lịch.
    const tables = code.filter(({ s }) => /'mẹ cô dâu':\s*'/.test(s)).map((f) => f.p);
    expect(tables).toEqual([join('features', 'schedule', 'model.ts')]);
    if (process.env.IN_BANG_MAU) console.log(`Chỗ tô màu theo nhân vật: ${sites.length} lớp ws-sw-\${…} + ${calls.length} lời gọi apptClasses, tất cả qua swatchOf`);
  });
});

// ---------------- Công tắc "Tô màu: Sự kiện" (bản vẽ D 3.5) ----------------
// Màu loại sự kiện = đúng 12 tên OCCASION_COLORS của shared, vẽ bằng cùng bảng .ws-sw-*. Riêng khi công tắc ở "Sự kiện",
// green được thay bằng xanh ngọc đậm hơn một nấc (khối .ws[data-color-by="occasion"]) để chữ đạt ≥ 4,5:1.
const occasionOverride = (name: Swatch): Rgb | null => {
  const m = new RegExp(`\\.ws\\[data-color-by="occasion"\\]\\s+\\.ws-sw-${name}\\s*\\{([^}]*)\\}`).exec(scheduleCss);
  const c = m ? /--c:\s*([^;]+);/.exec(m[1] ?? '') : null;
  return c ? resolve(c[1] ?? '') : null;
};

describe('tô màu theo sự kiện — màu từ hằng của shared, chữ đủ tương phản', () => {
  const base = new Map(SWATCHES.map((s) => [s, swatchRule(s)!] as const));
  // Bảng màu hiệu lực khi công tắc ở "Sự kiện": --c có thể bị khối override thay; --b giữ nguyên.
  const ev = new Map(SWATCHES.map((s) => [s, { c: occasionOverride(s) ?? base.get(s)!.c, b: base.get(s)!.b }] as const));

  it('GIỮ: SWATCHES chính là OCCASION_COLORS của shared (một nguồn, 12 tên đúng thứ tự); mọi màu cài sẵn của loại sự kiện có luật màu', () => {
    expect(SWATCHES).toBe(OCCASION_COLORS);
    expect([...SWATCHES]).toEqual(['rose', 'violet', 'amber', 'green', 'blue', 'taupe', 'brick', 'petrol', 'olive', 'plum', 'forest', 'brown']);
    for (const d of DEFAULT_OCCASIONS) expect(swatchRule(d.color), d.name).not.toBeNull();
    expect(readFileSync(join(HERE, 'model.ts'), 'utf8')).toMatch(/export const SWATCHES = OCCASION_COLORS;/);
  });

  it('BẮT: chỉ có đúng MỘT màu bị đổi khi tô theo Sự kiện (green), các màu khác y nguyên; công tắc "Nhân vật" vẫn dùng #2F7D72', () => {
    const changed = SWATCHES.filter((s) => occasionOverride(s) !== null);
    expect(changed).toEqual(['green']);
    expect(rgbHex(base.get('green')!.c)).toBe('#2F7D72');
    expect(rgbHex(ev.get('green')!.c)).toBe('#2C786A');
  });

  it('BẮT: chữ trên ô ca (--c trên --b của chính màu) ≥ 4,5:1 cho cả 12 màu và "Chưa chọn sự kiện" (other); nền trắng cũng ≥ 4,5', () => {
    const rows = [...SWATCHES, 'other' as const].map((s) => {
      const r = s === 'other' ? swatchRule('other')! : ev.get(s)!;
      return { s, hex: rgbHex(r.c), bg: rgbHex(r.b), onBg: contrast(r.c, r.b), onWhite: contrast(r.c, WHITE) };
    });
    if (process.env.IN_BANG_MAU) {
      console.log('Tô theo Sự kiện — tương phản chữ:\n' + rows.map((r) => `  ${r.s.padEnd(7)} ${r.hex} trên ${r.bg} ${r.onBg.toFixed(2)} · trên trắng ${r.onWhite.toFixed(2)}`).join('\n'));
    }
    for (const r of rows) {
      expect(r.onBg, `${r.s} trên nền của chính nó`).toBeGreaterThanOrEqual(4.5);
      expect(r.onWhite, `${r.s} trên trắng`).toBeGreaterThanOrEqual(4.5);
    }
    // Mốc phá thử: màu green hôm nay (#2F7D72) trên nền nhạt CHỈ 4,29 — vì vậy mới có khối override.
    expect(contrast(base.get('green')!.c, base.get('green')!.b)).toBeLessThan(4.5);
  });

  it('BẮT: 12 màu loại sự kiện vẫn phân biệt được khi green đổi — ΔE2000 mọi cặp ≥ 14', () => {
    const pairs: { a: string; b: string; d: number }[] = [];
    SWATCHES.forEach((a, i) => SWATCHES.slice(i + 1).forEach((b) => pairs.push({ a, b, d: de2000(ev.get(a)!.c, ev.get(b)!.c) })));
    pairs.sort((x, y) => x.d - y.d);
    if (process.env.IN_BANG_MAU) console.log('Tô theo Sự kiện — cặp gần nhất: ' + pairs.slice(0, 3).map((p) => `${p.a}–${p.b} ${p.d.toFixed(1)}`).join(', '));
    for (const p of pairs) expect(p.d, `${p.a} – ${p.b}`).toBeGreaterThanOrEqual(14);
  });

  it('BẮT: ca không có sự kiện → "other" (trắng viền, màu riêng), KHÔNG phải màu đầu danh sách hay màu nào trong 12', () => {
    const none = { occasion: null, subjectName: 'Cô dâu' };
    expect(occasionSwatch(none)).toBe('other');
    expect(occasionSwatch(none)).not.toBe(SWATCHES[0]);
    expect(apptSwatch(none, 'occasion')).toBe('other');
    expect(apptSwatch(none, 'subject')).toBe('rose'); // công tắc "Nhân vật": màu nhân vật như cũ
    const o = swatchRule('other')!;
    for (const s of SWATCHES) expect(rgbHex(o.b), s).not.toBe(rgbHex(base.get(s)!.b));
    expect(rgbHex(o.b)).toBe('#FFFFFF');
    // Màu lạ máy chủ gửi (ngoài 12 tên) cũng ra "other", không đoán.
    expect(occasionSwatch({ occasion: { id: 'x', name: 'Lạ', color: 'magenta' as never } })).toBe('other');
  });
});
