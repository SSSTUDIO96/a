import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Cửa gác nhanh luật in của giấy chứng nhận (không cần trình duyệt; bài in thật: PrintSheet.pdf.test.ts).
// Luật nào mất ở đây là bản in hỏng: sai khổ / hướng, in thừa trang trắng, Chrome lặp khối fixed ở mọi trang, màn app lọt vào bản in.
const css = readFileSync(new URL('./certificates.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function blockAfter(src: string, from: number): string {
  const open = src.indexOf('{', from);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return '';
}

const printBlock = (): string => {
  const at = css.search(/@media\s+print\b/);
  return at < 0 ? '' : blockAfter(css, at);
};

function rule(src: string, selector: string): Record<string, string> | null {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (norm(m[1] ?? '') !== norm(selector)) continue;
    const out: Record<string, string> = {};
    for (const decl of (m[2] ?? '').split(';')) {
      const k = decl.indexOf(':');
      if (k > 0) out[decl.slice(0, k).trim()] = norm(decl.slice(k + 1)).replace(/\s*!important$/, '');
    }
    return out;
  }
  return null;
}

describe('certificates.css: luật in giấy chứng nhận', () => {
  it('@page gcn: A4 ngang, lề 0', () => {
    const at = css.search(/@page\s+gcn\b/);
    expect(at, 'thiếu @page gcn').toBeGreaterThanOrEqual(0);
    const body = blockAfter(css, at);
    expect(body).toMatch(/size:\s*A4\s+landscape/);
    expect(body).toMatch(/margin:\s*0\s*;?/);
  });

  it('vùng in ẩn trên màn hình, hiện khi in', () => {
    expect(rule(css, '.gcn-print-root')?.display).toBe('none');
    expect(rule(printBlock(), '.gcn-print-root')?.display).toBe('block');
  });

  it('khi in, ẩn mọi con khác của body (màn app, hộp thoại)', () => {
    expect(printBlock()).toMatch(/body:has\(\.gcn-print-root\)\s*>\s*:not\(\.gcn-print-root\)\s*\{[^}]*display:\s*none/);
  });

  it('mỗi giấy một trang: break-after: page, không ngắt giữa ảnh, trang cuối không đẻ trang trắng', () => {
    const page = rule(printBlock(), '.gcn-print-page');
    expect(page?.['break-after']).toBe('page');
    expect(page?.['break-inside']).toBe('avoid');
    expect(page?.page).toBe('gcn');
    expect(rule(printBlock(), '.gcn-print-page:last-child')?.['break-after']).toBe('auto');
  });

  it('kích thước trang 297 × 209,5 mm (209,5 để Chrome không đẻ trang trắng do làm tròn)', () => {
    const page = rule(printBlock(), '.gcn-print-page');
    expect(page?.width).toBe('297mm');
    expect(page?.height).toBe('209.5mm');
    const img = rule(printBlock(), '.gcn-print-page img');
    expect(img?.width).toBe('297mm');
    expect(img?.height).toBe('209.5mm');
  });

  it('khối in KHÔNG có position: fixed (Chrome lặp khối fixed ở mọi trang)', () => {
    expect(printBlock()).not.toMatch(/position:\s*fixed/);
    expect(rule(printBlock(), '.gcn-print-root')?.position).toBe('static');
  });
});
