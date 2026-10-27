// Mẫu chào mừng thứ 20 (shd-11, việc tồn 7) và luật chung "mẫu trong danh mục phải có tệp vẽ + ảnh nhỏ".
// Đọc thẳng tệp vẽ public/mau/*.html (tệp tĩnh, không qua bundler) — đúng tệp app nạp vào iframe khi xem trước / xuất PNG.
import { existsSync, readFileSync } from 'node:fs';
import { DESIGN_TEMPLATES, findDesignTemplate, PHOTO_SLOTS, type DesignTemplate, type SlotKey } from '@makeup/shared';
import { describe, expect, it } from 'vitest';
import { templateChoices, templateUsesHandwriting, thumbnailUrl } from './model';

const PUBLIC = new URL('../../../public/', import.meta.url);
const fileOf = (p: string) => new URL(p.replace(/^\//, ''), PUBLIC);
const html = (code: string) => readFileSync(fileOf(`/mau/${code}.html`), 'utf8');

const T = (code: string): DesignTemplate => {
  const t = findDesignTemplate(code);
  if (!t) throw new Error(code);
  return t;
};

// Khoá tệp vẽ suy ra từ ô dữ liệu (chung/mau.js) → ô trong danh mục.
const DERIVED: Record<string, SlotKey> = {
  thu: 'ngay', ngayCham: 'ngay', ngayD: 'ngay', thangSo: 'ngay', nam: 'ngay', thangNam: 'ngay',
  gio: 'lich', kh: 'ten', nskCham: 'nsk', nskChu: 'nsk', nskThangNam: 'nsk', nktCham: 'nkt', nfbCham: 'nfb',
};
function slotsOnFile(code: string): SlotKey[] {
  const src = html(code);
  const keys = new Set<SlotKey>();
  for (const m of src.matchAll(/data-f="([^"]+)"/g)) {
    const k = m[1] ?? '';
    keys.add((DERIVED[k] ?? k) as SlotKey);
  }
  if (/data-qr="web"/.test(src)) keys.add('web');
  return [...keys].sort();
}

describe('danh mục ↔ tệp vẽ', () => {
  it('BẮT: mọi mẫu trong danh mục có tệp vẽ public/mau/<mã>.html và ảnh nhỏ cho lưới (mỗi loại hợp đồng)', () => {
    for (const t of DESIGN_TEMPLATES) {
      expect(existsSync(fileOf(`/mau/${t.code}.html`)), `${t.code}.html`).toBe(true);
      for (const k of t.contractKinds) expect(existsSync(fileOf(thumbnailUrl(t, k))), thumbnailUrl(t, k)).toBe(true);
    }
  });

  it('BẮT: ô trên tệp vẽ của các mẫu chào mừng khớp ô khai trong danh mục (shd-11 gồm cả gv, lịch, địa chỉ, mã số)', () => {
    for (const t of DESIGN_TEMPLATES.filter((x) => x.kind === 'WELCOME')) {
      expect(slotsOnFile(t.code), t.code).toEqual([...t.slots].sort());
    }
    expect(slotsOnFile('shd-11')).toEqual(['anh', 'diachi', 'gv', 'khoa', 'lich', 'logo', 'lop', 'ma', 'ngay', 'ten', 'th']);
  });
});

describe('khung ảnh (anh Chiến 19/10/2026: mẫu nào cũng có ảnh, khung mặc định tròn, 1 mẫu viên thuốc)', () => {
  it('BẮT: tệp vẽ của mọi mẫu có đúng số khung ảnh khai trong danh mục (photoFrames ≥ 1)', () => {
    for (const t of DESIGN_TEMPLATES) {
      const imgs = [...html(t.code).matchAll(/<img[^>]*data-f="(anh|a1|a2|a3)"/g)].map((m) => m[1]);
      expect(imgs.length, t.code).toBe(t.photoFrames);
      expect(t.photoFrames, t.code).toBeGreaterThanOrEqual(1);
    }
  });

  it('BẮT: không còn khung vòm (bo hai góc trên) hay bầu dục; chỉ shd-11 dùng khung viên thuốc', () => {
    for (const t of DESIGN_TEMPLATES) {
      const src = html(t.code);
      expect(src, t.code).not.toMatch(/border-radius:\s*\d+px \d+px 0 0/);
    }
    expect(DESIGN_TEMPLATES.filter((t) => t.frameShape === 'pill').map((t) => t.code)).toEqual(['shd-11']);
    expect(html('shd-11')).toMatch(/\.cap\{width:384px;height:576px;border-radius:192px;/);
  });

  it('BẮT: ô ảnh trống (dữ liệu thật) hiện gợi ý "Thêm ảnh …" thay vì ẩn khung', () => {
    const js = readFileSync(fileOf('/mau/chung/mau.js'), 'utf8');
    expect(js).toMatch(/const NHAN_ANH=\{anh:'ảnh học viên',a1:'ảnh 1',a2:'ảnh 2',a3:'ảnh 3'\}/);
    expect(js).toMatch(/else if\(NHAN_ANH\[el\.dataset\.f\]\)\{el\.src=goiYAnh\(el\.dataset\.f\);el\.classList\.add\('goi-y-anh'\)/);
    expect(js).toContain("Thêm '+NHAN_ANH[k]");
  });
});

// Chữ nhỏ (< 24px) trên nền phẳng phải đạt 4,5:1 (WCAG AA). Các dòng đã đo dưới chuẩn ngày 19/10/2026 và đã sửa màu
// (shd-01 .k1 #8C7A5B 3,63 → #7A6340 4,98). Bài thử đọc màu chữ thật trong tệp vẽ; nền là nền phẳng ngay dưới dòng chữ.
const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const SMALL_TEXT: [code: string, rule: string, bg: string][] = [
  ['shd-01', '.k1', '#F5EFE4'], ['shd-03', '.dt .l', '#FBF8F4'], ['shd-05', '.gr .l', '#FFFDF9'], ['shd-08', '.k1', '#FBFAF7'],
  ['shd-08', '.dt', '#FBFAF7'], ['shd-09', '.th', '#F7ECE6'], ['shd-09', '.ft', '#F7ECE6'], ['fb-01', '.k1', '#F7E8E4'],
  ['fb-02', '.ft i', '#EFE9E3'], ['fb-07', '.hd span', '#FFFFFF'], ['fb-09', '.pr span', '#F6F1EC'], ['lc-03', '.ft', '#FFFDF9'],
  ['lc-06', '.th', '#F7ECE6'], ['lc-06', '.ft', '#F7ECE6'],
];

describe('tương phản chữ nhỏ trên mẫu', () => {
  it('BẮT: các dòng chữ nhỏ đã sửa đạt ≥ 4,5:1 (shd-01 "Chào mừng đến với lớp" #7A6340 = 4,98:1)', () => {
    for (const [code, rule, bg] of SMALL_TEXT) {
      const esc = rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = new RegExp(`(?:^|[}\\n])${esc}\\{([^}]*)\\}`).exec(html(code));
      expect(m, `${code} ${rule}`).not.toBeNull();
      const color = /color:(#[0-9A-Fa-f]{6})/.exec(m![1] ?? '')?.[1] ?? '';
      expect(color, `${code} ${rule}`).not.toBe('');
      expect(contrast(color, bg), `${code} ${rule} ${color} trên ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast('#7A6340', '#F5EFE4')).toBeCloseTo(4.98, 1);
  });
});

describe('mẫu chào mừng thứ 20 — shd-11 "Chữ ký mảnh nền đá"', () => {
  it('BẮT: có trên lưới thẻ chào mừng của hợp đồng khoá học — 21 mẫu trong app (10 cm mới đứng trước + 11 shd; bản vẽ H)', () => {
    const codes = templateChoices('WELCOME', 'COURSE', 'fit').map((c) => c.template.code);
    expect(codes).toHaveLength(21);
    expect(codes.slice(0, 10)).toEqual(Array.from({ length: 10 }, (_, i) => `cm-${String(i + 1).padStart(2, '0')}`));
    expect(codes.at(-1)).toBe('shd-11');
    expect(thumbnailUrl(T('shd-11'), 'COURSE')).toBe('/mau/anh-nho/shd-11.jpg');
    expect(T('shd-11').slots.filter((s) => (PHOTO_SLOTS as readonly string[]).includes(s))).toEqual([]);
  });

  it('BẮT: tên học viên viết bằng chữ ký nét mảnh (mặc định chữ ký 1) qua biến --f-tay-1 nên ?ky=N vẫn đổi được', () => {
    const src = html('shd-11');
    expect(src).toMatch(/:root\{--f-tay-1:var\(--f-ky-1\);--tay-co-1:var\(--ky-co-1\)\}/);
    expect(src).toMatch(/\.ten\{font-family:var\(--f-tay-1\);font-size:calc\(\d+px\*var\(--tay-co-1\)\)/);
    expect(src).toMatch(/<div class="ten" data-f="ten" data-fit="2"><\/div>/);
    // Ô chọn chữ ký trên màn tạo thẻ bật cho mẫu này.
    expect(templateUsesHandwriting(T('shd-11'))).toBe(true);
    expect(templateUsesHandwriting(T('fb-02'))).toBe(false);
  });

  it('BẮT: ô logo nằm trong vòng .ld — không có logo thì mau.js ẩn cả vòng (cách L6)', () => {
    const src = html('shd-11');
    expect(src).toMatch(/<span class="ld"><img data-f="logo" alt=""><\/span>/);
    expect(src).toContain('<script src="chung/mau.js"></script>');
  });

  it('BẮT: dòng thông tin trống tự ẩn (khai giảng, lịch học, giảng viên, địa điểm, lớp)', () => {
    const src = html('shd-11');
    for (const f of ['lop', 'thu', 'lich', 'gv', 'diachi']) {
      expect(src, f).toMatch(new RegExp(`<div class="[a-z]+" data-hang>[^\\n]*data-f="${f}"`));
    }
    expect(src).toMatch(/querySelectorAll\('\[data-hang\]'\)[\s\S]*r\.style\.display='none'/);
    // Đoạn ẩn dòng chạy SAU mau.js (đã điền chữ).
    expect(src.indexOf("querySelectorAll('[data-hang]')")).toBeGreaterThan(src.indexOf('chung/mau.js'));
  });

  it('BẮT: có khổ vuông 1080×1080 (luật .vuong) bên cạnh khổ dọc', () => {
    const src = html('shd-11');
    expect(src).toMatch(/\.vuong \.cap\{/);
    expect(src).toMatch(/\.vuong \.ten\{/);
    expect(T('shd-11').sizes).toEqual(['1080x1350', '1080x1080']);
  });

  it('GIỮ: chữ cố định trên mẫu là tiếng Việt có dấu', () => {
    const src = html('shd-11');
    for (const s of ['Thư chào mừng', 'Chào mừng em đến với khoá', 'Khai giảng', 'Lịch học', 'Giảng viên', 'Địa điểm', 'Học viên mới', 'Hẹn gặp em ở lớp']) {
      expect(src, s).toContain(s);
    }
    expect(src).not.toMatch(/Chao mung|Giang vien|Hoc vien|Hen gap/);
  });
});
