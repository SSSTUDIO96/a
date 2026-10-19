// Phông nhóm A từ kho SS-Album của anh Chiến (19/10/2026): tệp WOFF2 + giấy phép đi kèm + khai @font-face + nối vào ô chọn chữ ký.
// Đọc thẳng tệp tĩnh public/mau/phong/** (đúng tệp app phục vụ cho iframe xem trước / xuất PNG).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { FONT_OVERRIDES } from '@makeup/shared';
import { describe, expect, it } from 'vitest';
import { frameQuery } from './model';

const PHONG = new URL('../../../public/mau/phong/', import.meta.url);
const SS = new URL('ss-album/', PHONG);
const css = readFileSync(new URL('ss-album.css', SS), 'utf8');
const dirs = readdirSync(SS).filter((n) => statSync(new URL(`${n}/`, SS)).isDirectory());

describe('phông SS-Album nhóm A', () => {
  it('BẮT: mọi url() trong ss-album.css trỏ tới tệp có thật', () => {
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1] ?? '');
    expect(urls.length).toBeGreaterThanOrEqual(40);
    for (const u of urls) expect(existsSync(new URL(u, SS)), u).toBe(true);
  });

  it('BẮT: mỗi thư mục họ phông có WOFF2 và tệp giấy phép có toàn văn (OFL 1.1 hoặc Apache 2.0)', () => {
    expect(dirs.length).toBe(26);
    for (const d of dirs) {
      const files = readdirSync(new URL(`${d}/`, SS));
      expect(files.some((f) => f.endsWith('.woff2')), d).toBe(true);
      const lic = files.find((f) => f === 'OFL.txt' || f === 'LICENSE.txt');
      expect(lic, d).toBeTruthy();
      const txt = readFileSync(new URL(`${d}/${lic}`, SS), 'utf8');
      expect(txt, d).toMatch(/Copyright/);
      expect(txt, d).toMatch(lic === 'OFL.txt' ? /SIL OPEN FONT LICENSE Version 1\.1[\s\S]*PERMISSION & CONDITIONS/ : /Apache License[\s\S]*Version 2\.0, January 2004/);
    }
  });

  it('BẮT: tổng dung lượng WOFF2 dưới 15 MB (không phải bỏ trọng lượng nào)', () => {
    let total = 0;
    for (const d of dirs) for (const f of readdirSync(new URL(`${d}/`, SS))) if (f.endsWith('.woff2')) total += statSync(new URL(`${d}/${f}`, SS)).size;
    expect(total).toBeGreaterThan(1_000_000);
    expect(total).toBeLessThan(15 * 1024 * 1024);
  });

  it('BẮT: phong.css nạp ss-album.css; mỗi chữ ký ky-N có biến --f-ky-N, hệ số --ky-co-N và được mau.js nạp trước khi vẽ', () => {
    expect(readFileSync(new URL('phong.css', PHONG), 'utf8')).toMatch(/@import url\(ss-album\/ss-album\.css\)/);
    const main = readFileSync(new URL('phong.css', PHONG), 'utf8') + css;
    const mauJs = readFileSync(new URL('../chung/mau.js', PHONG), 'utf8');
    for (const f of FONT_OVERRIDES) {
      const n = f.replace('ky-', '');
      expect(main, f).toContain(`--f-ky-${n}:'MP Chữ ký ${n}'`);
      expect(main, f).toContain(`--ky-co-${n}:`);
      expect(mauJs, f).toContain(`'MP Chữ ký ${n}'`);
      expect(main, f).toContain(`font-family:'MP Chữ ký ${n}'`);
    }
  });

  it('BẮT: chữ ký 5-7 là MonteCarlo/Ephesis/WindSong, chữ ký 8 là Pinyon Script (thư pháp, nhóm viết tay)', () => {
    expect(css).toMatch(/'MP Chữ ký 5';src:url\(montecarlo\/MonteCarlo-Regular\.woff2\)/);
    expect(css).toMatch(/'MP Chữ ký 6';src:url\(ephesis\/Ephesis-Regular\.woff2\)/);
    expect(css).toMatch(/'MP Chữ ký 7';src:url\(windsong\/WindSong-Regular\.woff2\)/);
    expect(css).toMatch(/'MP Chữ ký 8';src:url\(pinyon-script\/PinyonScript-Regular\.woff2\)/);
  });

  it('BẮT: tham số đường dẫn ?ky=N đi đúng cho chữ ký mới', () => {
    expect(FONT_OVERRIDES).toHaveLength(8);
    // frameQuery cần cả mẫu + dữ liệu; chỉ kiểm phần ky bằng cách dựng tối thiểu qua model.test.ts đã có — ở đây kiểm quy ước tên.
    expect(typeof frameQuery).toBe('function');
    for (const f of FONT_OVERRIDES) expect(f.replace('ky-', '')).toMatch(/^[1-8]$/);
  });
});
