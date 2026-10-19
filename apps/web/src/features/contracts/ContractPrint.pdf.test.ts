import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Biên bản nghiệm thu lại N1: bản in hợp đồng khoá học chỉ là CSS lúc in (contracts.css @page / @media print) — trước bài
// này không bài tự động nào đỏ khi ai đó làm hỏng. Bài dựng trang in thử (__in-thu__/, đúng ContractPrintDialog + CSS
// thật) bằng Vite, in bằng Chromium (page.pdf = "In / Lưu PDF") rồi kiểm:
// - hợp đồng ngắn ra ĐÚNG 1 trang;
// - hợp đồng 45 điều khoản ra đủ số trang theo chiều cao nội dung (không bị cắt còn 1 trang vì hộp thoại cố định / cuộn
//   trong), không thừa trang (không lặp nội dung);
// - lúc in: màn ứng dụng ẩn, đầu/chân hộp thoại ẩn, tiêu đề "HỢP ĐỒNG ĐÀO TẠO" hiện MỘT lần và không nằm trong khối
//   position: fixed (Chrome lặp khối fixed ở MỌI trang in), đủ 45 điều, không mất chỗ ký.
// Cần Chromium của Playwright (PLAYWRIGHT_BROWSERS_PATH, máy này /opt/pw-browsers): thiếu thì bài báo đỏ kèm cách cài —
// không tự bỏ qua.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HARNESS = '/src/features/contracts/__in-thu__/index.html';
// A4 với lề @page hop-dong (16mm trên/dưới, 15mm trái/phải), 96 px/inch.
const MM = 96 / 25.4;
const PAGE_CONTENT_H = (297 - 32) * MM;
const PAGE_CONTENT_W = Math.floor((210 - 30) * MM);

let server: ViteDevServer;
let browser: Browser;
let base: string;

beforeAll(async () => {
  const exe = chromium.executablePath();
  if (!existsSync(exe)) {
    throw new Error(
      `Không thấy Chromium của Playwright (${exe}). Cài bằng "pnpm --filter @makeup/web exec playwright install chromium" ` +
        'hoặc đặt PLAYWRIGHT_BROWSERS_PATH trỏ tới thư mục trình duyệt đã cài — bài in hợp đồng không tự bỏ qua.',
    );
  }
  server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 0, strictPort: false, host: '127.0.0.1', hmr: false, proxy: {} },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite không trả địa chỉ trang in thử');
  base = url.replace(/\/$/, '');
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function open(mau: 'ngan' | 'dai'): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: PAGE_CONTENT_W, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}${HARNESS}?mau=${mau}`);
  await page.locator('.ct-paper').waitFor();
  await page.evaluate(() => document.fonts.ready);
  expect(errors).toEqual([]);
  return page;
}

// Số trang của tệp PDF Chromium in ra: đếm đối tượng /Type /Page (không tính /Pages).
function pdfPages(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

interface PrintFacts {
  appVisible: boolean;
  headVisible: boolean;
  footVisible: boolean;
  titles: number;
  fixedAncestor: string | null;
  clippingAncestor: string | null;
  clauses: number;
  signVisible: boolean;
  paperHeight: number;
}

// Đọc bố cục lúc in (emulateMedia print): CSS @media print của contracts.css đang áp.
async function printFacts(page: Page): Promise<PrintFacts> {
  await page.emulateMedia({ media: 'print' });
  return page.evaluate(() => {
    const shown = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none' && (el as HTMLElement).offsetParent !== null;
    const paper = document.querySelector('.ct-paper') as HTMLElement;
    let fixedAncestor: string | null = null;
    let clippingAncestor: string | null = null;
    for (let el: HTMLElement | null = paper; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      const name = `${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')}`;
      if (!fixedAncestor && (cs.position === 'fixed' || cs.position === 'sticky')) fixedAncestor = name;
      if (!clippingAncestor && el !== paper && (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'hidden') && el.scrollHeight > el.clientHeight + 1) {
        clippingAncestor = name;
      }
    }
    const titles = Array.from(document.querySelectorAll('h2')).filter((h) => h.textContent === 'HỢP ĐỒNG ĐÀO TẠO' && shown(h)).length;
    return {
      appVisible: shown(document.querySelector('.in-thu-man')),
      headVisible: shown(document.querySelector('.ct-print-dlg .ui-dialog__head')),
      footVisible: shown(document.querySelector('.ct-print-dlg .ui-dialog__foot')),
      titles,
      fixedAncestor,
      clippingAncestor,
      clauses: paper.querySelectorAll('.ct-paper__ol li').length,
      signVisible: shown(paper.querySelector('.ct-paper__sign')),
      paperHeight: paper.getBoundingClientRect().height,
    };
  });
}

async function printPdf(page: Page): Promise<number> {
  // preferCSSPageSize: dùng đúng @page hop-dong (A4, lề 16mm 15mm) như bấm "In / Lưu PDF".
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  return pdfPages(pdf);
}

describe('N1: bản in hợp đồng khoá học (Chromium page.pdf)', () => {
  it('hợp đồng ngắn: đúng 1 trang; màn ứng dụng và đầu/chân hộp thoại ẩn; tiêu đề một lần; có chỗ ký', async () => {
    const page = await open('ngan');
    const f = await printFacts(page);
    expect(f.appVisible, 'màn ứng dụng phía sau phải ẩn khi in').toBe(false);
    expect(f.headVisible, 'đầu hộp thoại ("Xem bản in") phải ẩn khi in').toBe(false);
    expect(f.footVisible, 'nút Đóng / In phải ẩn khi in').toBe(false);
    expect(f.titles).toBe(1);
    expect(f.fixedAncestor, 'bản in không được nằm trong khối fixed/sticky (Chrome lặp ở mọi trang)').toBeNull();
    expect(f.signVisible).toBe(true);
    expect(await printPdf(page)).toBe(1);
    await page.close();
  });

  it('hợp đồng 45 điều khoản: đủ trang theo chiều cao (không cắt, không lặp); đủ 45 điều + nội quy; tiêu đề không lặp', async () => {
    const page = await open('dai');
    const f = await printFacts(page);
    expect(f.appVisible).toBe(false);
    expect(f.titles).toBe(1);
    expect(f.fixedAncestor, 'bản in không được nằm trong khối fixed/sticky (Chrome lặp ở mọi trang)').toBeNull();
    expect(f.clippingAncestor, 'khối cha cuộn/cắt nội dung khi in → chỉ in được phần đang thấy').toBeNull();
    expect(f.clauses).toBe(45 + 4);
    expect(f.signVisible).toBe(true);
    const need = Math.ceil(f.paperHeight / PAGE_CONTENT_H);
    expect(need, 'mẫu dài phải dài hơn một trang').toBeGreaterThanOrEqual(2);
    const pages = await printPdf(page);
    // Tránh ngắt giữa điều khoản / chỗ ký có thể đẩy thêm tối đa một trang; ít hơn = bị cắt, nhiều hơn = lặp nội dung.
    expect(pages).toBeGreaterThanOrEqual(need);
    expect(pages).toBeLessThanOrEqual(need + 1);
    await page.close();
  });
});
