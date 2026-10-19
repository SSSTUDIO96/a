import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vùng an toàn đáy (thanh Home iPhone). Chromium không giả lập được env(safe-area-inset-bottom),
// nên bài thử đọc thẳng mã CSS/HTML và khẳng định cách nối. CHƯA THỬ TRÊN IPHONE THẬT.
const root = resolve(__dirname, '../..');
const css = readFileSync(resolve(root, 'src/layout/layout.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

/** Thân khối `selector { ... }` đầu tiên khớp đúng bộ chọn (kể cả trong @media). */
function block(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|[\\s}])${esc}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!m) throw new Error(`Không thấy khối ${selector}`);
  return m[1] ?? '';
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
    expect(block('.sh')).toMatch(/padding-bottom:\s*var\(--h-bottomnav\)/);
  });

  it('layout.css không còn số 64px cứng nào ngoài dòng khai biến', () => {
    const left = css.replace(/--h-bottomnav:\s*calc\([^;]*\);/, '');
    expect(left).not.toMatch(/\b64px\b/);
  });
});
