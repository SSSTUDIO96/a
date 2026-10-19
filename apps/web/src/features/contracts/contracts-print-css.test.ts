import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Biên bản nghiệm thu lại N1: cửa gác nhanh (không cần trình duyệt) cho các luật in cốt lõi của hợp đồng khoá học trong
// contracts.css. Bài in thật bằng Chromium: ContractPrint.pdf.test.ts. Luật nào mất ở đây là bản in hỏng:
// - @page hop-dong: khổ A4 + lề;
// - @media print: ẩn màn ứng dụng phía sau hộp thoại; hộp thoại/lớp phủ hết fixed + hết cuộn trong (nếu không Chrome chỉ
//   in phần đang thấy, hoặc lặp khối fixed ở mọi trang); ẩn đầu/chân hộp thoại; giấy dùng trang hop-dong; không ngắt giữa
//   dòng bảng / điều khoản / chỗ ký, không để tiêu đề mục mồ côi cuối trang.
const css = readFileSync(new URL('./contracts.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Nội dung khối { … } ngay sau vị trí `from` (đếm ngoặc lồng nhau).
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

function printBlock(): string {
  const at = css.search(/@media\s+print\b/);
  return at < 0 ? '' : blockAfter(css, at);
}

// Khai báo của luật có bộ chọn đúng `selector` (so sau khi gộp khoảng trắng) trong `src`.
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

describe('N1: luật in hợp đồng khoá học trong contracts.css', () => {
  it('@page hop-dong: A4 kèm lề', () => {
    const at = css.search(/@page\s+hop-dong\b/);
    expect(at, 'thiếu @page hop-dong').toBeGreaterThanOrEqual(0);
    const body = blockAfter(css, at);
    expect(body).toMatch(/size:\s*A4/);
    expect(body).toMatch(/margin:\s*\d/);
  });

  it('@media print có mặt và chỉ áp khi trang có hộp thoại in', () => {
    expect(printBlock(), 'thiếu @media print').not.toBe('');
    expect(printBlock()).toContain('.ct-print-dlg');
  });

  it('ẩn màn ứng dụng phía sau hộp thoại; trang không cắt chiều cao', () => {
    const p = printBlock();
    expect(rule(p, 'body:has(.ct-print-dlg) > :not(.ui-overlay:has(.ct-print-dlg))')).toMatchObject({ display: 'none' });
    expect(rule(p, 'html:has(.ct-print-dlg), body:has(.ct-print-dlg)')).toMatchObject({ height: 'auto', overflow: 'visible' });
  });

  it('lớp phủ và hộp thoại hết fixed / hết cuộn trong; đầu và chân hộp thoại ẩn', () => {
    const p = printBlock();
    expect(rule(p, '.ui-overlay:has(.ct-print-dlg)')).toMatchObject({ position: 'static', display: 'block' });
    expect(rule(p, '.ui-dialog.ct-print-dlg')).toMatchObject({ 'max-height': 'none', overflow: 'visible', height: 'auto' });
    expect(rule(p, '.ct-print-dlg .ui-dialog__body')).toMatchObject({ overflow: 'visible' });
    expect(rule(p, '.ct-print-dlg .ui-dialog__head, .ct-print-dlg .ui-dialog__foot')).toMatchObject({ display: 'none' });
  });

  it('giấy dùng trang hop-dong; không ngắt giữa dòng bảng / điều khoản / chỗ ký; tiêu đề mục không mồ côi', () => {
    const p = printBlock();
    expect(rule(p, '.ct-paper')).toMatchObject({ page: 'hop-dong' });
    expect(rule(p, '.ct-paper__tbl tr, .ct-paper__ol li')).toMatchObject({ 'break-inside': 'avoid' });
    expect(rule(p, '.ct-paper__sign')).toMatchObject({ 'break-inside': 'avoid' });
    expect(rule(p, '.ct-paper__sec h3')).toMatchObject({ 'break-after': 'avoid' });
  });
});
