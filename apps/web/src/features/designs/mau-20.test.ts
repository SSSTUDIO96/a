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

  it('BẮT: ô trên tệp vẽ của các mẫu chào mừng khớp ô khai trong danh mục (shd-11 gồm cả gv, lịch, địa chỉ)', () => {
    for (const t of DESIGN_TEMPLATES.filter((x) => x.kind === 'WELCOME')) {
      expect(slotsOnFile(t.code), t.code).toEqual([...t.slots].sort());
    }
    expect(slotsOnFile('shd-11')).toEqual(['anh', 'diachi', 'gv', 'khoa', 'lich', 'logo', 'lop', 'ngay', 'ten', 'th']);
  });
});

describe('mẫu chào mừng thứ 20 — shd-11 "Chữ ký mảnh nền đá"', () => {
  it('BẮT: có trên lưới thẻ chào mừng của hợp đồng khoá học — đủ 11 mẫu trong app (+ 9 mẫu đợt 1 của R&D = 20)', () => {
    const codes = templateChoices('WELCOME', 'COURSE', 'fit').map((c) => c.template.code);
    expect(codes).toHaveLength(11);
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
