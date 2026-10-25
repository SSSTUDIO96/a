import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Sửa sau nghiệm thu bản vẽ D (L1–L4): jsdom không dàn trang nên không đo được khung nhìn; bài này khoá các quy tắc CSS làm
// nên số đo đã chụp trên bản build thật (ảnh L1–L4 trước/sau). Số đo thật ở báo cáo sửa; ở đây chỉ canh quy tắc không bị gỡ.
const here = dirname(fileURLToPath(import.meta.url));
const css = (rel: string) => readFileSync(join(here, rel), 'utf8');
// Thân khối `selector { ... }` đầu tiên khớp đúng selector (không lẫn selector dài hơn).
function body(source: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\>:]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`).exec(source);
  expect(m, `thiếu quy tắc ${selector}`).not.toBeNull();
  return m?.[1] ?? '';
}

// Phần CSS từ khối @media điện thoại (≤640px) gần nhất đứng trước quy tắc `needle` — để quy tắc phải nằm TRONG khối điện thoại.
function phoneRule(source: string, needle: RegExp): string {
  const m = needle.exec(source);
  expect(m, `thiếu quy tắc ${needle}`).not.toBeNull();
  const at = m?.index ?? 0;
  const media = source.lastIndexOf('@media', at);
  expect(source.slice(media, at), 'quy tắc không nằm trong khối điện thoại').toMatch(/^@media \(max-width: 640px\)/);
  return m?.[0] ?? '';
}

describe('L1: thẻ Loại sự kiện / Luật phụ phí rộng tối đa 760px (bản vẽ 3.2), thẻ khác giữ 820px', () => {
  const pricing = css('pricing/pricing.css');
  it('.pr-occcard (cả hai thẻ dùng) 760px; .pr-narrow dùng chung vẫn 820px', () => {
    expect(body(pricing, '.pr-occcard')).toMatch(/max-width:\s*760px/);
    expect(body(pricing, '.pr-narrow')).toMatch(/max-width:\s*820px/);
  });
  it('hai trang đặt .pr-occcard lên thẻ', () => {
    expect(readFileSync(join(here, 'pricing/OccasionsPage.tsx'), 'utf8')).toContain('pr-narrow pr-occcard');
    expect(readFileSync(join(here, 'pricing/SurchargeRulesPage.tsx'), 'utf8')).toContain('pr-narrow pr-occcard pr-rulecard');
  });
});

describe('L2: đệm đáy danh sách ở 390 chừa chỗ cho nút tròn "+" (52px + khe 16px)', () => {
  it('.pr-occcard ở khổ điện thoại có margin-bottom ≥ 52 + 16 + 28', () => {
    const rule = phoneRule(css('pricing/pricing.css'), /\.pr-occcard\s*\{\s*margin-bottom:\s*\d+px/);
    expect(Number(/(\d+)px/.exec(rule)?.[1])).toBeGreaterThanOrEqual(96);
  });
});

describe('L3: Hôm nay của thợ ở máy tính: Hôm nay → Ngày mai → Sau đó theo cả hàng lẫn cột', () => {
  const today = css('today/today.css');
  it('hai cột của lưới thợ được trải phẳng (display: contents) và "Sau đó" chiếm cả hàng 2', () => {
    expect(body(today, '.td-grid--own > .td-col')).toMatch(/display:\s*contents/);
    expect(body(today, '.td-grid--own > .td-col #td-later')).toMatch(/grid-column:\s*1\s*\/\s*-1/);
  });
  it('thứ tự trong mã vẫn là Hôm nay, Ngày mai, Sau đó', () => {
    const tsx = readFileSync(join(here, 'today/MyDayCards.tsx'), 'utf8');
    const at = (id: string) => tsx.indexOf(`id="${id}"`);
    expect(at('td-today')).toBeGreaterThan(0);
    expect(at('td-today')).toBeLessThan(at('td-tomorrow'));
    expect(at('td-tomorrow')).toBeLessThan(at('td-later'));
  });
});

describe('L4: thông báo "Đã tự thêm…" ở 390 không che khối vừa thêm', () => {
  const contracts = css('contracts/contracts.css');
  it('trình duyệt được báo vùng đáy bị thanh tổng + thông báo che (scroll-padding-bottom) theo số thông báo 1 / 2 / 3', () => {
    const pad = (sel: string) => {
      const re = new RegExp(`${sel.replace(/[.+:()]/g, '\\$&')}\\s*\\{\\s*scroll-padding-bottom:\\s*calc\\(var\\(--h-bottomnav\\)\\s*\\+\\s*100px\\s*\\+\\s*\\d+px`);
      return Number(/\+\s*(\d+)px$/.exec(phoneRule(contracts, re))?.[1]);
    };
    const one = pad(':root:has(.ct-toast)');
    const two = pad(':root:has(.ct-toast + .ct-toast)');
    const three = pad(':root:has(.ct-toast + .ct-toast + .ct-toast)');
    expect(one).toBeGreaterThanOrEqual(49);
    expect(two).toBeGreaterThanOrEqual(2 * 49);
    expect(three).toBeGreaterThanOrEqual(3 * 49);
  });
  it('đệm đáy trang khi có thông báo vẫn còn', () => {
    phoneRule(contracts, /\.ct-page:has\(\.ct-toast\)\s*\{\s*padding-bottom:/);
  });
});
