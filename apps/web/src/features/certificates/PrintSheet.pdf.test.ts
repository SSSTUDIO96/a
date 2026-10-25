import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CERTIFICATE_PAGE_PT, CERTIFICATE_TEMPLATE_CODES } from '@makeup/shared';
import type { CertificateView } from '../../api/certificates';
import { fakeView } from './fixtures';

// Bản vẽ F mục 9.3 — bản in THẬT bằng Chromium (thiếu Chromium thì ĐỎ, không tự bỏ qua; như ContractPrint.pdf.test.ts).
// Trang thử __in-thu__/ dùng đúng mã thật: render.ts (tệp mẫu thật public/mau/cc-NN.html, Vite phục vụ) + pdf.ts + PrintArea.tsx
// + certificates.css. Kiểm:
// - 5 học viên (có tên rất dài, một người không ảnh) × MỖI mẫu cc-01 … cc-16: PDF đúng 5 trang, mỗi trang A4 NGANG;
// - "In ngay": page.pdf() của vùng in 5 ảnh ra ĐÚNG 5 trang A4 ngang, không trang trắng thừa, màn app ẩn;
// - <PrintSheet> thật: bấm "Tải PDF" tải đúng tệp, đúng số trang;
// - đo thời gian 8 và 30 người + cỡ tệp (in ra màn hình; GCN_OUT=<thư mục> thì ghi tệp PDF / số đo vào đó).

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HARNESS = '/src/features/certificates/__in-thu__/index.html';
const OUT = process.env.GCN_OUT ?? '';

let server: ViteDevServer;
let browser: Browser;
let base: string;
let page: Page;
const pageErrors: string[] = [];

beforeAll(async () => {
  const exe = chromium.executablePath();
  if (!existsSync(exe)) {
    throw new Error(
      `Không thấy Chromium của Playwright (${exe}). Cài bằng "pnpm --filter @makeup/web exec playwright install chromium" ` +
        'hoặc đặt PLAYWRIGHT_BROWSERS_PATH trỏ tới thư mục trình duyệt đã cài — bài in giấy chứng nhận không tự bỏ qua.',
    );
  }
  server = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 0, strictPort: false, host: '127.0.0.1', hmr: false, proxy: {} },
    // pdf-lib được tải ĐỘNG: nếu để Vite tự khám phá lúc chạy thì nó đóng gói lại giữa chừng và trang thử mất tệp (hash cũ).
    optimizeDeps: { include: ['pdf-lib'] },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite không trả địa chỉ trang in thử');
  base = url.replace(/\/$/, '');
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${base}${HARNESS}`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, { timeout: 60_000 });
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const NAMES = ['Lê Thị Mai', 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', 'Nguyễn Văn Đức', 'Đặng Thuỳ Linh', 'Phạm Quỳnh Như'];

// n giấy với mẫu `code`; người thứ 3 không ảnh, người thứ 4 tên khoá dài.
function views(code: string, n: number, seq0 = 1, names: string[] = NAMES): CertificateView[] {
  return Array.from({ length: n }, (_, i) => {
    const name = names[i % names.length] as string;
    const photo = i % 5 === 2 ? null : { url: '/mau/chung/anh-hoc-vien.svg', expiresAt: '2099-01-01T00:00:00.000Z', width: 800, height: 800 };
    return fakeView(seq0 + i, {
      templateCode: code,
      studentName: name,
      customer: { id: `30000000-0000-4000-8000-${String(seq0 + i).padStart(12, '0')}`, fullName: name },
      courseName: i % 5 === 3 ? 'Makeup chuyên nghiệp cô dâu và sự kiện nâng cao' : 'Makeup chuyên nghiệp',
      className: 'K12',
      photo,
      logo: { url: '/mau/chung/logo-mau.svg', expiresAt: '2099-01-01T00:00:00.000Z' },
    });
  });
}

interface Made {
  pdfBase64: string;
  pageCount: number;
  renderMs: number;
  pdfMs: number;
  pdfBytes: number;
  errors: string[];
  warnings: string[];
  jpegBytes: number[];
  pngBytes: number[];
}

async function lam(vs: CertificateView[]): Promise<Made> {
  return page.evaluate((list) => (window as unknown as { gcn: { lam: (v: unknown) => Promise<Made> } }).gcn.lam(list), vs);
}

async function loadPdf(base64: string) {
  return PDFDocument.load(Buffer.from(base64, 'base64'));
}

function save(name: string, data: Buffer | string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), data);
}

// tolPt: PDF do pdf-lib ghép khớp 0,05 pt; PDF do Chromium in (A4 = 297 × 210 mm làm tròn) lệch tới ~0,4 pt.
function expectLandscape(doc: PDFDocument, pages: number, tolPt = 0.05) {
  expect(doc.getPageCount()).toBe(pages);
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize();
    expect(Math.abs(width - CERTIFICATE_PAGE_PT.width)).toBeLessThanOrEqual(tolPt);
    expect(Math.abs(height - CERTIFICATE_PAGE_PT.height)).toBeLessThanOrEqual(tolPt);
    expect(width).toBeGreaterThan(height);
  }
}

describe('Bản in giấy chứng nhận bằng Chromium thật', () => {
  it.each(CERTIFICATE_TEMPLATE_CODES.map((c) => [c] as const))(
    'mẫu %s: 5 học viên (tên rất dài, một người không ảnh) → PDF đúng 5 trang A4 ngang, không lỗi vẽ',
    async (code) => {
      const made = await lam(views(code, 5));
      expect(made.errors).toEqual([]);
      expect(made.warnings).toEqual([]);
      expect(made.pageCount).toBe(5);
      // Không trang trắng: ảnh JPEG của mỗi trang đủ nặng (một trang trắng 1754×1240 chỉ vài KB).
      for (const b of made.jpegBytes) expect(b, `${code}: trang gần như trắng`).toBeGreaterThan(40_000);
      expectLandscape(await loadPdf(made.pdfBase64), 5);
    },
    120_000,
  );

  it('"In ngay": page.pdf() của vùng in 5 ảnh ra ĐÚNG 5 trang A4 ngang, màn app ẩn, không trang trắng thừa', async () => {
    const made = await lam(views('cc-01', 5));
    expect(made.pageCount).toBe(5);
    const shown = await page.evaluate(() => (window as unknown as { gcn: { hienVungIn: () => number } }).gcn.hienVungIn());
    expect(shown).toBe(5);
    // Trên màn hình thường vùng in ẩn.
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.gcn-print-root') as Element).display)).toBe('none');
    await page.emulateMedia({ media: 'print' });
    const facts = await page.evaluate(() => ({
      app: getComputedStyle(document.getElementById('root') as Element).display,
      root: getComputedStyle(document.querySelector('.gcn-print-root') as Element).display,
      pos: getComputedStyle(document.querySelector('.gcn-print-root') as Element).position,
      breakAfter: [...document.querySelectorAll('.gcn-print-page')].map((e) => getComputedStyle(e).breakAfter).join(','),
      imgs: [...document.querySelectorAll('.gcn-print-root img')].every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 1754),
    }));
    expect(facts).toEqual({ app: 'none', root: 'block', pos: 'static', breakAfter: 'page,page,page,page,auto', imgs: true });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    const doc = await PDFDocument.load(pdf);
    expectLandscape(doc, 5, 0.5);
    save('in-ngay-5-trang.pdf', pdf);
  }, 120_000);

  it('<PrintSheet> thật: vẽ xong → bấm "Tải PDF (3 trang)" tải đúng tệp PDF 3 trang A4 ngang', async () => {
    await page.evaluate((v) => (window as unknown as { gcn: { gan: (x: unknown) => void } }).gcn.gan(v), views('cc-02', 3));
    const btn = page.getByRole('button', { name: 'Tải PDF (3 trang)' });
    await btn.waitFor({ timeout: 90_000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), btn.click()]);
    expect(dl.suggestedFilename()).toBe('Giay-chung-nhan-in-thu.pdf');
    const path = await dl.path();
    expect(path).toBeTruthy();
    const { readFileSync } = await import('node:fs');
    expectLandscape(await PDFDocument.load(readFileSync(path as string)), 3);
    expect(await page.getByText(/Tệp PDF: 3 trang A4 ngang, mỗi học viên một trang/).count()).toBe(1);
  }, 120_000);

  it('đo thời gian và cỡ tệp: 8 người và 30 người (trộn mọi mẫu)', async () => {
    const mix = (n: number) =>
      Array.from({ length: n }, (_, i) => views(CERTIFICATE_TEMPLATE_CODES[i % CERTIFICATE_TEMPLATE_CODES.length] as string, 1, i + 1, [NAMES[i % NAMES.length] as string])[0] as CertificateView);
    const report: Record<string, unknown> = {};
    for (const n of [8, 30]) {
      const made = await lam(mix(n));
      expect(made.errors).toEqual([]);
      expect(made.pageCount).toBe(n);
      expectLandscape(await loadPdf(made.pdfBase64), n);
      report[`${n} người`] = {
        veMs: Math.round(made.renderMs),
        veMoiNguoiMs: Math.round(made.renderMs / n),
        ghepPdfMs: Math.round(made.pdfMs),
        pdfBytes: made.pdfBytes,
        pdfMB: +(made.pdfBytes / 1024 / 1024).toFixed(2),
        kbMoiTrang: Math.round(made.pdfBytes / 1024 / n),
      };
      save(`do-${n}-nguoi.pdf`, Buffer.from(made.pdfBase64, 'base64'));
    }
    console.log(`SO DO IN THU (Chromium headless, máy build): ${JSON.stringify(report, null, 1)}`);
    save('so-do.json', JSON.stringify(report, null, 2));
  }, 600_000);

  it('in thử: 3 học viên × 2 mẫu khác nhau (cc-01, cc-05) → hai PDF 3 trang', async () => {
    for (const code of ['cc-01', 'cc-05']) {
      const made = await lam(views(code, 3, 1, ['Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', 'Nguyễn Thị Thuỳ Linh', 'Đặng Quỳnh Như']));
      expect(made.errors).toEqual([]);
      expectLandscape(await loadPdf(made.pdfBase64), 3);
      save(`in-thu-${code}.pdf`, Buffer.from(made.pdfBase64, 'base64'));
    }
  }, 120_000);

  it('không có lỗi script trên trang in thử', () => {
    expect(pageErrors).toEqual([]);
  });
});
