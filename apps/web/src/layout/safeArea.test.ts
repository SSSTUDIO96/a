import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vùng an toàn đáy (thanh Home iPhone). Chromium không giả lập được env(safe-area-inset-bottom),
// nên bài thử đọc thẳng mã CSS/HTML và khẳng định cách nối. CHƯA THỬ TRÊN IPHONE THẬT.
const root = resolve(__dirname, '../..');
const css = readFileSync(resolve(root, 'src/layout/layout.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

/** Gộp thân mọi khối đúng bộ chọn `selector { ... }` (bộ chọn có thể xuất hiện ở ngoài và trong @media). */
function block(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...css.matchAll(new RegExp(`(?:^|[\\s}])${esc}\\s*\\{([^}]*)\\}`, 'gm'))].map((m) => m[1] ?? '');
  if (all.length === 0) throw new Error(`Không thấy khối ${selector}`);
  return all.join('\n');
}

describe('thanh dưới điện thoại chừa vùng an toàn đáy', () => {
  it('index.html có viewport-fit=cover (không có thì env() luôn 0 trên iOS)', () => {
    const meta = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(html);
    expect(meta?.[1]).toContain('viewport-fit=cover');
    expect(meta?.[1]).toContain('width=device-width');
  });

  it('một biến --h-bottomnav = 64px + env(safe-area-inset-bottom)', () => {
    const decl = /--h-bottomnav:\s*calc\(\s*64px\s*\+\s*env\(\s*safe-area-inset-bottom\s*,\s*0px\s*\)\s*\)/.exec(css);
    expect(decl).not.toBeNull();
  });

  it('.sh-bnav: chiều cao dùng biến, đệm đáy dùng env(safe-area-inset-bottom)', () => {
    const b = block('.sh-bnav');
    expect(b).toMatch(/height:\s*var\(--h-bottomnav\)/);
    expect(b).toMatch(/padding-bottom:\s*env\(\s*safe-area-inset-bottom\s*,\s*0px\s*\)/);
    expect(b).toMatch(/position:\s*fixed/);
    expect(b).toMatch(/bottom:\s*0/);
  });

  it('.sh chừa chỗ đáy bằng biến, không còn 64px cứng', () => {
    expect(css).toMatch(/\.sh\s*\{[^}]*padding-bottom:\s*var\(--h-bottomnav\)/);
  });

  it('layout.css không còn số 64px cứng nào ngoài dòng khai biến', () => {
    const left = css.replace(/--h-bottomnav:\s*calc\([^;]*\);/, '');
    expect(left).not.toMatch(/\b64px\b/);
  });
});

// ---- Các tệp ngoài layout.css cũng chừa chỗ cho thanh dưới: phải dùng var(--h-bottomnav), không số cứng ----
const src = (rel: string): string => readFileSync(resolve(root, 'src', rel), 'utf8');
const noComment = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '');

const BAR_FILES = [
  'features/schedule/schedule.css',
  'features/designs/designs.css',
  'features/brand/brand.css',
  'features/contracts/contracts.css',
  'ui/ui.css',
  'layout/layout.css',
];

describe('không còn số cứng chiều cao thanh dưới ngoài layout.css', () => {
  it('schedule.css: .ws-a trừ thanh dưới bằng biến', () => {
    expect(noComment(src('features/schedule/schedule.css'))).toMatch(
      /\.ws-a\s*\{[^}]*max-height:\s*calc\(100vh - 54px - var\(--h-bottomnav\) - 120px\)/,
    );
  });

  it('designs.css: .mtk-export dính đáy = thanh dưới + 8px', () => {
    expect(noComment(src('features/designs/designs.css'))).toMatch(
      /\.mtk-export\s*\{[^}]*bottom:\s*calc\(var\(--h-bottomnav\) \+ 8px\)/,
    );
  });

  it('brand.css: .br-page đệm đáy = thanh dưới + 8px', () => {
    expect(noComment(src('features/brand/brand.css'))).toMatch(
      /\.br-page\s*\{\s*padding-bottom:\s*calc\(var\(--h-bottomnav\) \+ 8px\)/,
    );
  });

  it('contracts.css: .ct-page đệm đáy = thanh dưới + 20px; hai ghi chú liền = thanh dưới + 124px', () => {
    const c = noComment(src('features/contracts/contracts.css'));
    expect(c).toMatch(/\.ct-page\s*\{\s*padding-bottom:\s*calc\(var\(--h-bottomnav\) \+ 20px\)/);
    expect(c).toMatch(
      /\.ct-page:has\(\.ct-totbar__note \+ \.ct-totbar__note\)\s*\{\s*padding-bottom:\s*calc\(var\(--h-bottomnav\) \+ 124px\)/,
    );
  });

  it.each(BAR_FILES)('%s: không có bottom / padding-bottom ≥ 48px viết cứng (không ngoại lệ)', (rel) => {
    const text = noComment(src(rel));
    const bad: string[] = [];
    for (const m of text.matchAll(/(?<![-\w])(bottom|padding-bottom)\s*:\s*([^;}]+)/g)) {
      const value = (m[2] ?? '').trim();
      if (value.includes('var(--h-bottomnav')) continue;
      for (const px of value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
        if (Number(px[1]) >= 48) bad.push(`${m[1]}: ${value}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it.each(BAR_FILES)('%s: không có max-height 100vh/100dvh trừ 64/72/84px cứng', (rel) => {
    const text = noComment(src(rel));
    expect(text).not.toMatch(/max-height:\s*calc\(\s*100d?vh[^;]*\b(64|72|84)px/);
  });

  it('StickyTotalBar.tsx: chú thích ghi tên biến, không ghi 64px', () => {
    const t = src('ui/StickyTotalBar.tsx');
    expect(t).toContain('bottom: var(--h-bottomnav)');
    expect(t).not.toMatch(/bottom:\s*64px/);
  });
});
