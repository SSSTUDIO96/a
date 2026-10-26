import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PRINT_LAYOUTS, TOGGLE_BLOCKS, formatVnd, type ContractPrintData, type PrintLayout, type ToggleBlockKey } from '@makeup/shared';
import { PAGE_CONTENT_MM, PAGE_MM, A4_WIDTH_MM } from './pageCss';
import { SAMPLE, sampleConfig } from './sampleData';

// BÀI IN THẬT bằng Chromium: trang in thử (__in-thu__) dựng PrintFrame + PrintPaper THẬT bằng Vite, in bằng page.pdf
// ({ preferCSSPageSize: true, printBackground: true } = "In / Lưu PDF") rồi kiểm theo docs/rnd/v9-mau-in/kiem-in-thu.js:
// 5 bố cục × 2 loại × 2 bản = 20 PDF, cộng bảng 40 dòng, hợp đồng nhiều ngày, và mỗi bố cục một bản TẮT HẾT khối bật/tắt được.
// Mỗi PDF: A4 dọc; bản ngắn ĐÚNG 1 trang; bản dài trong [cần, cần + 1]; tiêu đề đúng 1 lần; mỗi điều khoản / nội quy đúng 1 lần
// và không bị cắt đôi sang trang khác; có tổng tiền + tiền bằng chữ; không khối fixed chứa chữ; không khối bị cắt; không trang
// gần trống; không mẩu chữ lẻ (dấu tiếng Việt rơi); chữ cuối trang không phải tiêu đề mục; màn ứng dụng và đầu / chân hộp thoại ẩn;
// phông thật được nhúng; chân trang đủ (số trang, BẢN NHÁP, ký nháy); chữ ký cuối không mồ côi.
// Cần Chromium của Playwright (/opt/pw-browsers) và pdfinfo / pdftotext / pdffonts (poppler): thiếu thì báo ĐỎ kèm cách cài,
// KHÔNG tự bỏ qua. Đặt HDIN_PDF_DIR để giữ lại PDF (mặc định: thư mục tạm của máy).

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const HARNESS = '/src/features/contract-print/paper/__in-thu__/index.html';
const OUT = process.env.HDIN_PDF_DIR ?? join(tmpdir(), 'hdin-pdf');
const PX_PER_MM = 96 / 25.4;
const ALL_TOGGLES = Object.keys(TOGGLE_BLOCKS) as ToggleBlockKey[];

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
  for (const tool of ['pdfinfo', 'pdftotext', 'pdffonts', 'pdftoppm']) {
    try {
      execFileSync(tool, ['-v'], { stdio: 'ignore' });
    } catch {
      throw new Error(`Thiếu "${tool}" (poppler-utils). Cài bằng "apt-get install poppler-utils" — bài in hợp đồng không tự bỏ qua.`);
    }
  }
  mkdirSync(OUT, { recursive: true });
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

// ---------- dựng một bản in ----------

interface Job {
  layout: PrintLayout;
  kind: 'SERVICE' | 'COURSE';
  ban: 'long' | 'short' | 'longTable' | 'multiDay';
  tat?: ToggleBlockKey[];
  bat?: ToggleBlockKey[];
  nhap?: boolean;
  lech?: number;
  ten?: string;
  ma?: string;
  lanIn?: number;
  anTien?: boolean;
  anLienHe?: boolean;
  noBackground?: boolean;
  tag?: string;
}

const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ').replace(/[ \t\r\n\f]+/g, ' ').trim();
const count = (hay: string, needle: string) => (needle ? hay.split(needle).length - 1 : 0);

function query(j: Job): string {
  const q = new URLSearchParams({ 'bo-cuc': String(j.layout), loai: j.kind, ban: j.ban });
  if (j.tat?.length) q.set('tat', j.tat.join(','));
  if (j.bat?.length) q.set('bat', j.bat.join(','));
  if (j.nhap) q.set('nhap', '1');
  if (j.lech) q.set('lech', String(j.lech));
  if (j.ten) q.set('ten', j.ten);
  if (j.ma) q.set('ma', j.ma);
  if (j.lanIn) q.set('lan-in', String(j.lanIn));
  if (j.anTien) q.set('an-tien', '1');
  if (j.anLienHe) q.set('an-lien-he', '1');
  return q.toString();
}

function fileName(j: Job): string {
  const tag = j.tag ? `-${j.tag}` : j.lech ? `-lech${j.lech}` : '';
  return `bo-cuc-${j.layout}-${j.kind === 'SERVICE' ? 'dich-vu' : 'khoa-hoc'}-${j.ban}${tag}.pdf`;
}

interface Dom {
  title: string;
  appVisible: boolean;
  headVisible: boolean;
  footVisible: boolean;
  asideVisible: boolean;
  capVisible: boolean;
  fixedOffenders: string[];
  frame: { count: number; text: string; children: number; ariaHidden: string | null; display: string; position: string } | null;
  clipped: string[];
  fontsError: string[];
  zoomInPrint: string;
  headingPaddingsPx: number[];
  headings: string[];
  paperHeightPx: number;
  styleCount: number;
}

interface Printed {
  job: Job;
  file: string;
  dom: Dom;
  pages: number;
  size: string;
  perPage: string[]; // pdftotext -raw
  perPageLayout: string[]; // pdftotext -layout
  all: string;
  fonts: string;
  need: number;
}

const cache = new Map<string, Printed>();

async function print(j: Job): Promise<Printed> {
  const key = JSON.stringify(j);
  const hit = cache.get(key);
  if (hit) return hit;
  const m = PAGE_MM[j.layout];
  const page = await browser.newPage({ viewport: { width: Math.round((A4_WIDTH_MM - m.left - m.right) * PX_PER_MM), height: 1200 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (c) => {
    if (c.type() === 'error') errors.push(c.text());
  });
  page.on('requestfailed', (r) => errors.push(`Tải hỏng: ${r.url()}`));
  await page.goto(`${base}${HARNESS}?${query(j)}`);
  await page.locator('.hdin-giay').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    // ép tải mọi phông đã khai: tờ chỉ dùng một phần, phần còn lại ở trạng thái "unloaded"
  });
  expect(errors, `lỗi trình duyệt khi mở ${fileName(j)}`).toEqual([]);
  await page.emulateMedia({ media: 'print' });
  const dom = await page.evaluate((): Dom => {
    const shown = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
    const paper = document.querySelector('.hdin-giay') as HTMLElement;
    const fixedOffenders: string[] = [];
    const clipped: string[] = [];
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')}`;
    for (const el of Array.from(paper.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && !el.classList.contains('hdin-khung-trang')) fixedOffenders.push(name(el));
      if (el.closest('.hdin-khung-trang')) continue;
      if (['hidden', 'clip', 'scroll', 'auto'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) clipped.push(name(el));
    }
    for (let el: HTMLElement | null = paper; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') fixedOffenders.push(`tổ tiên ${name(el)}`);
      if (el !== paper && ['hidden', 'clip', 'scroll', 'auto'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) clipped.push(`tổ tiên ${name(el)}`);
    }
    const frames = paper.querySelectorAll('.hdin-khung-trang');
    const f = frames[0] as HTMLElement | undefined;
    const heads = Array.from(paper.querySelectorAll('h2'));
    const pad = getComputedStyle(paper);
    return {
      title: paper.querySelector('h1')?.textContent?.trim() ?? '',
      appVisible: shown(document.querySelector('.in-thu-man')),
      headVisible: shown(document.querySelector('.hdin-dlg .ui-dialog__head')),
      footVisible: shown(document.querySelector('.hdin-dlg .ui-dialog__foot')),
      asideVisible: shown(document.querySelector('.hdin-dlg .hdin-aside')),
      capVisible: shown(document.querySelector('.hdin-dlg .hdin-prev-cap')),
      fixedOffenders,
      frame: f ? { count: frames.length, text: f.textContent ?? '', children: f.children.length, ariaHidden: f.getAttribute('aria-hidden'), display: getComputedStyle(f).display, position: getComputedStyle(f).position } : null,
      clipped,
      fontsError: (() => {
        const bad: string[] = [];
        document.fonts.forEach((x) => {
          if (x.status === 'error') bad.push(x.family);
        });
        return bad;
      })(),
      zoomInPrint: getComputedStyle(document.querySelector('.hdin-zoom') as Element).zoom,
      headingPaddingsPx: heads.map((h) => parseFloat(getComputedStyle(h).paddingTop)),
      headings: Array.from(paper.querySelectorAll('h2, h3')).map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()),
      paperHeightPx: paper.getBoundingClientRect().height - parseFloat(pad.paddingTop) * 0 - 0,
      styleCount: document.querySelectorAll('style').length,
    };
  });
  const file = join(OUT, fileName(j));
  const pdf = await page.pdf({ path: file, preferCSSPageSize: true, printBackground: !j.noBackground });
  await page.close();
  writeFileSync(file, pdf);
  const info = execFileSync('pdfinfo', [file]).toString();
  const pages = Number(info.match(/Pages:\s+(\d+)/)![1]);
  const size = info.match(/Page size:\s+([^\n]+)/)![1]!;
  const perPage: string[] = [];
  const perPageLayout: string[] = [];
  for (let p = 1; p <= pages; p += 1) {
    perPage.push(norm(execFileSync('pdftotext', ['-raw', '-f', String(p), '-l', String(p), file, '-']).toString()));
    perPageLayout.push(execFileSync('pdftotext', ['-layout', '-f', String(p), '-l', String(p), file, '-']).toString());
  }
  const fonts = execFileSync('pdffonts', [file]).toString();
  const padMm = PAGE_MM[j.layout].pad * 2;
  const contentPx = dom.paperHeightPx - padMm * PX_PER_MM;
  const need = Math.max(1, Math.ceil(contentPx / (PAGE_CONTENT_MM[j.layout] * PX_PER_MM) - 1e-6));
  const out: Printed = { job: j, file, dom, pages, size, perPage, perPageLayout, all: perPage.join(' '), fonts, need };
  cache.set(key, out);
  return out;
}

function dataOf(j: Job): ContractPrintData {
  let d = SAMPLE[j.kind][j.ban as 'long' | 'short'] as ContractPrintData | undefined;
  if (j.kind === 'COURSE' && (j.ban === 'longTable' || j.ban === 'multiDay')) d = undefined;
  if (j.kind === 'SERVICE') d = SAMPLE.SERVICE[j.ban];
  if (!d) throw new Error(`Không có dữ liệu ${j.kind}/${j.ban}`);
  return j.nhap ? { ...d, contract: { ...d.contract, status: 'DRAFT' } } : d;
}

// Dòng chân trang của pdftotext -layout: số hợp đồng / "Trang x / y" / "Ký nháy" / BẢN NHÁP / dấu lần in.
const isFooterLine = (ln: string, code: string) => /Trang \d+\s*\/\s*\d+|Ký nháy|BẢN NHÁP|In lần|In lại/.test(ln) || ln.trim() === code;

// ---------- kiểm một PDF ----------

function check(p: Printed): string[] {
  const { job: j, dom } = p;
  const d = dataOf(j);
  const issues: string[] = [];
  const off = new Set(j.tat ?? []);
  const allOff = ALL_TOGGLES.every((k) => off.has(k));
  // Khối nào đang bật (mặc định bố cục + tat/bat) — lấy từ chính cấu hình mà trang in thử dùng.
  const overrides: Partial<Record<ToggleBlockKey, boolean>> = {};
  for (const k of j.tat ?? []) overrides[k] = false;
  for (const k of j.bat ?? []) overrides[k] = true;
  const cfg = sampleConfig(j.layout, j.kind, overrides);
  const on = (k: keyof typeof cfg.blocks) => cfg.blocks[k] === true;

  if (!/^59[45]\.\d+ x 84[12]\.\d+/.test(p.size)) issues.push(`Khổ giấy không phải A4 dọc: ${p.size}`);
  if (j.ban === 'short' && p.pages !== 1) issues.push(`Bản ngắn ra ${p.pages} trang (phải đúng 1)`);
  if (p.pages < p.need || p.pages > p.need + 1) issues.push(`Số trang ${p.pages} ngoài [${p.need}, ${p.need + 1}] (cần ${p.need})`);
  const tcount = count(p.all, norm(dom.title));
  if (tcount !== 1) issues.push(`Tiêu đề "${dom.title}" xuất hiện ${tcount} lần`);
  // mỗi điều khoản / nội quy đúng 1 lần, nguyên vẹn trong một trang
  const texts = [...(on('dieu-khoan') && d.terms ? d.terms.items : []), ...(on('noi-quy') && d.rules ? d.rules.items : [])];
  let missing = 0;
  let dup = 0;
  let split = 0;
  for (const t of texts) {
    const n = norm(t);
    const c = count(p.all, n.slice(0, 70));
    if (c === 0) missing += 1;
    if (c > 1) dup += 1;
    const first = p.perPage.findIndex((x) => x.includes(n.slice(0, 40)));
    const last = p.perPage.findIndex((x) => x.includes(n.slice(-30)));
    if (first < 0 || last < 0 || first !== last) split += 1;
  }
  if (missing) issues.push(`Thiếu ${missing} điều khoản / nội quy trong PDF`);
  if (dup) issues.push(`Lặp ${dup} điều khoản / nội quy`);
  if (split) issues.push(`${split} điều khoản / nội quy bị cắt đôi sang trang khác`);
  if (!p.all.includes(norm(formatVnd(d.money.total)))) issues.push(`Không thấy tổng ${formatVnd(d.money.total)}`);
  if (on('bang-chu') && !p.all.includes(norm(d.money.totalInWords))) issues.push('Không thấy tiền bằng chữ');
  if (on('bang-chu') === false && p.all.includes(norm(d.money.totalInWords))) issues.push('Tắt tiền bằng chữ mà vẫn in');
  if (dom.appVisible) issues.push('Màn ứng dụng phía sau vẫn hiện khi in');
  if (dom.headVisible || dom.footVisible) issues.push('Đầu / chân hộp thoại vẫn hiện khi in');
  if (dom.asideVisible || dom.capVisible) issues.push('Cột lựa chọn / dòng ước số trang vẫn hiện khi in');
  if (dom.fixedOffenders.length) issues.push(`Khối fixed / sticky: ${dom.fixedOffenders.join(', ')}`);
  if (dom.clipped.length) issues.push(`Khối bị cắt / cuộn trong: ${dom.clipped.join(', ')}`);
  if (dom.fontsError.length) issues.push(`Phông lỗi: ${dom.fontsError.join(', ')}`);
  if (dom.zoomInPrint !== '1') issues.push(`zoom khi in là ${dom.zoomInPrint} (phải 1)`);
  if (dom.styleCount < 1) issues.push('Thiếu thẻ <style> chân trang');
  for (const px of dom.headingPaddingsPx) if (px < 0.8 * PX_PER_MM - 0.01) issues.push(`Tiêu đề mục có padding-top ${px.toFixed(2)}px < 0,8mm`);
  if (j.layout === 5) {
    const f = dom.frame;
    if (!f) issues.push('Mẫu 5 thiếu .hdin-khung-trang');
    else {
      if (f.count !== 1 || f.text !== '' || f.children !== 0 || f.ariaHidden !== 'true') issues.push('Khung viền mẫu 5 phải rỗng, aria-hidden, duy nhất');
      if (f.display !== 'block' || f.position !== 'fixed') issues.push(`Khung viền khi in: display ${f.display}, position ${f.position}`);
    }
  } else if (dom.frame) issues.push('Chỉ mẫu 5 được có khung viền');
  // trang gần trống, mẩu chữ lẻ, chữ cuối trang là tiêu đề mục
  p.perPage.forEach((t, i) => {
    const body = t.replace(new RegExp(d.contract.code, 'g'), '').replace(/Trang \d+ \/ \d+|Ký nháy|A:|B:|_|BẢN NHÁP|·/g, '').trim();
    if (body.length < 20) issues.push(`Trang ${i + 1} gần như trống`);
  });
  p.perPageLayout.forEach((txt, i) => {
    const lines = txt.split('\n').map((x) => x.trim()).filter(Boolean);
    for (const t of lines) if (t.length <= 2 && t === t.toUpperCase() && !/^\d+[.)]?$/.test(t) && !/^[A-Z]:?$/.test(t)) issues.push(`Trang ${i + 1}: mẩu chữ lẻ "${t}"`);
    const body = lines.filter((x) => !isFooterLine(x, d.contract.code));
    const last = norm(body.at(-1) ?? '');
    if (last.length >= 4) for (const h of dom.headings) if (norm(h).endsWith(last)) issues.push(`Trang ${i + 1} kết thúc bằng tiêu đề mục "${h}"`);
  });
  // chân trang
  p.perPage.forEach((t, i) => {
    const hasNo = new RegExp(`Trang ${i + 1} / ${p.pages}`).test(t);
    if (on('so-trang') && !hasNo) issues.push(`Trang ${i + 1} thiếu "Trang ${i + 1} / ${p.pages}"`);
    if (!on('so-trang') && /Trang \d+ \/ \d+/.test(t)) issues.push(`Trang ${i + 1} còn số trang dù đã tắt`);
    if (on('so-trang') && !t.includes(d.contract.code)) issues.push(`Trang ${i + 1} thiếu số hợp đồng ở chân trang`);
    if (on('ky-nhay') && !t.includes('Ký nháy')) issues.push(`Trang ${i + 1} thiếu ô ký nháy`);
    if (!on('ky-nhay') && t.includes('Ký nháy')) issues.push(`Trang ${i + 1} còn ô ký nháy dù đã tắt`);
    const draft = d.contract.status === 'DRAFT';
    if (draft && !t.includes('BẢN NHÁP')) issues.push(`Trang ${i + 1} thiếu "BẢN NHÁP" ở chân trang`);
    if (!draft && t.includes('BẢN NHÁP')) issues.push(`Trang ${i + 1} có "BẢN NHÁP" dù hợp đồng đã xác nhận`);
  });
  if (d.contract.status === 'DRAFT' && !p.perPage[0]!.includes(`${d.contract.code}`.slice(0, 3))) issues.push('Trang 1 thiếu số hợp đồng');
  // chữ ký cuối: có trên trang cuối, không đứng một mình
  const last = p.perPage.at(-1)!;
  if (!last.includes(norm(d.customer.fullName))) issues.push('Trang cuối thiếu chỗ ký (tên khách)');
  if (on('chu-cuoi') && !last.includes(norm(cfg.closingText).slice(0, 40))) issues.push('Chữ ký mồ côi: trang cuối không có chữ kết thúc đi kèm');
  // phông thật được nhúng
  const want = j.layout === 1 ? [/Lora/i] : j.layout === 5 ? [/Lora/i, /Cormorant/i] : [/BeVietnam/i];
  for (const w of want) if (!w.test(p.fonts)) issues.push(`PDF không nhúng phông ${w.source} (bị thay phông dự phòng?)`);
  if (/\uFFFD/.test(p.all)) issues.push('Có ký tự lỗi �');
  if (!allOff) {
    // dòng dịch vụ: tên + tiền từng dòng (kể cả phụ phí, dịch vụ phụ, phí di chuyển) đều có
    for (const l of d.lines) {
      if (!p.all.includes(norm(l.name))) issues.push(`Thiếu dòng "${l.name}"`);
      for (const s of [...l.addons, ...l.surcharges, ...(l.travel ? [l.travel] : [])]) {
        if (!p.all.includes(norm(s.name))) issues.push(`Thiếu dòng con "${s.name}"`);
        if (!p.all.includes(norm(formatVnd(s.lineTotal)))) issues.push(`Thiếu tiền ${formatVnd(s.lineTotal)} của "${s.name}"`);
      }
    }
  }
  return issues;
}

const KINDS: { kind: 'SERVICE' | 'COURSE'; ban: 'long' | 'short' }[] = [
  { kind: 'SERVICE', ban: 'long' },
  { kind: 'SERVICE', ban: 'short' },
  { kind: 'COURSE', ban: 'long' },
  { kind: 'COURSE', ban: 'short' },
];

// Số trang R&D đã đo (BAO-CAO-RND-09): [mẫu 1..5]. Bản ngắn: 1 trang cả 5 mẫu.
const RND_PAGES = { 'SERVICE.long': [2, 2, 2, 1, 2], 'COURSE.long': [3, 2, 3, 2, 2] } as const;

describe('PDF Chromium: 5 bố cục × 2 loại × bản dài / ngắn (20 PDF) + bảng 40 dòng + nhiều ngày + tắt hết khối', () => {
  for (const layout of PRINT_LAYOUTS) {
    it(
      `bố cục ${layout}: 4 bản (dịch vụ / khoá học × dài / ngắn) đạt mọi kiểm tra; số trang bản dài đúng số đo R&D`,
      async () => {
        for (const { kind, ban } of KINDS) {
          const p = await print({ layout, kind, ban });
          expect(check(p), `${fileName(p.job)}`).toEqual([]);
          if (ban === 'long') expect(p.pages, `${fileName(p.job)}: số trang R&D`).toBe(RND_PAGES[`${kind}.long`][layout - 1]);
        }
      },
      300_000,
    );

    it(
      `bố cục ${layout}: bảng 40 dòng + hợp đồng nhiều ngày đạt mọi kiểm tra`,
      async () => {
        for (const ban of ['longTable', 'multiDay'] as const) {
          const p = await print({ layout, kind: 'SERVICE', ban });
          expect(check(p), fileName(p.job)).toEqual([]);
        }
      },
      300_000,
    );

    it(
      `bố cục ${layout}: TẮT HẾT 17 khối bật/tắt (dịch vụ và khoá học) — vẫn đủ 4 khối luôn có, không có chữ của khối đã tắt`,
      async () => {
        for (const kind of ['SERVICE', 'COURSE'] as const) {
          const p = await print({ layout, kind, ban: 'long', tat: ALL_TOGGLES, tag: 'tat-het' });
          expect(check(p), fileName(p.job)).toEqual([]);
          const d = dataOf(p.job);
          for (const s of ['Tiến độ', 'Điều khoản', 'Nội quy', 'Ký nháy', 'Trang 1 /', 'Độc lập – Tự do', 'CCCD', 'PT-0003']) expect(p.all, `${s} phải biến mất khi tắt hết`).not.toContain(s);
          expect(p.all).toContain(norm(formatVnd(d.money.total)));
          expect(p.all).toContain(norm(d.lines[0]!.name));
        }
      },
      300_000,
    );
  }

  it('mẫu 4 (gọn một trang): hợp đồng dịch vụ dài = ĐÚNG 1 trang (số đo R&D)', async () => {
    const p = await print({ layout: 4, kind: 'SERVICE', ban: 'long' });
    expect(p.pages).toBe(1);
  }, 120_000);
});

describe('PDF: phụ phí in tên + tiền; ngày riêng khi nhiều ngày', () => {
  for (const layout of PRINT_LAYOUTS) {
    it(`bố cục ${layout}: hợp đồng dài có phù dâu × 2 + hai phụ phí in đúng tên và tiền; một ngày thì không in dd/mm cạnh giờ`, async () => {
      const p = await print({ layout, kind: 'SERVICE', ban: 'long' });
      for (const s of ['Phụ phí ca sớm (bắt đầu trước 5:30)', '300.000 ₫', 'Phụ phí ca sớm — phù dâu', '100.000 ₫', 'Phù dâu — Makeup tiệc']) expect(p.all, s).toContain(s);
      expect(p.all).not.toMatch(/\d\d\/\d\d · \d\d:\d\d–/);
      expect(p.all).toMatch(/05:00–07:30 · Thứ Bảy 12\/12\/2026/);
    }, 120_000);

    it(`bố cục ${layout}: hợp đồng nhiều ngày — mỗi dòng có "dd/mm · HH:MM–HH:MM" riêng`, async () => {
      const p = await print({ layout, kind: 'SERVICE', ban: 'multiDay' });
      for (const s of ['11/12 · 06:30–08:30', '12/12 · 04:30–07:30', '13/12 · 08:00–09:30']) expect(p.all, s).toContain(s);
      expect(p.all).toContain('phát sinh 28/10');
    }, 120_000);
  }
});

describe('PDF: chân trang — BẢN NHÁP, số trang, ký nháy, dấu lần in', () => {
  it('bản nháp: MỌI trang ghi "BẢN NHÁP" ở chân trang và cạnh số hợp đồng; bản đã xác nhận không có', async () => {
    for (const layout of PRINT_LAYOUTS) {
      const nhap = await print({ layout, kind: 'SERVICE', ban: 'long', nhap: true });
      expect(nhap.pages).toBeGreaterThanOrEqual(1);
      nhap.perPage.forEach((t, i) => expect(t, `bố cục ${layout} trang ${i + 1}`).toContain('BẢN NHÁP'));
      expect(count(nhap.perPage[0]!, 'BẢN NHÁP'), `bố cục ${layout}: ở đầu trang + chân trang`).toBeGreaterThanOrEqual(2);
      const ok = await print({ layout, kind: 'SERVICE', ban: 'long' });
      expect(ok.all).not.toContain('BẢN NHÁP');
    }
  }, 300_000);

  it('khoá học nháp (HĐKH-000047) ghi BẢN NHÁP', async () => {
    const p = await print({ layout: 1, kind: 'COURSE', ban: 'short' });
    expect(p.perPage[0]).toContain('HĐKH-000047 · BẢN NHÁP');
  }, 60_000);

  it('ký nháy: mẫu 2 mặc định không có; bật thì MỌI trang có "Ký nháy A: ___ B: ___"; mẫu 1 mặc định có ở mọi trang', async () => {
    const off = await print({ layout: 2, kind: 'SERVICE', ban: 'long' });
    expect(off.all).not.toContain('Ký nháy');
    const on = await print({ layout: 2, kind: 'SERVICE', ban: 'long', bat: ['ky-nhay'] });
    on.perPage.forEach((t, i) => expect(t, `trang ${i + 1}`).toContain('Ký nháy'));
    const one = await print({ layout: 1, kind: 'COURSE', ban: 'long' });
    expect(one.pages).toBe(3);
    one.perPage.forEach((t, i) => expect(t, `trang ${i + 1}`).toContain('Ký nháy'));
  }, 120_000);

  it('số trang: "Trang i / n" đúng ở mọi trang (n = tổng số trang thật); tắt "so-trang" thì mất cả số hợp đồng ở chân trang', async () => {
    const p = await print({ layout: 3, kind: 'COURSE', ban: 'long' });
    p.perPage.forEach((t, i) => expect(t).toContain(`Trang ${i + 1} / ${p.pages}`));
    const off = await print({ layout: 3, kind: 'COURSE', ban: 'long', tat: ['so-trang'] });
    expect(off.all).not.toMatch(/Trang \d+ \/ \d+/);
  }, 120_000);

  it('dấu lần in (printMark) hiện ở chân trang mọi trang', async () => {
    const p = await print({ layout: 2, kind: 'SERVICE', ban: 'long', lanIn: 3 });
    p.perPage.forEach((t, i) => expect(t, `trang ${i + 1}`).toContain('In lần 3 · 25/10/2026'));
  }, 60_000);
});

describe('PDF: L3 dấu tiếng Việt không rơi; chữ tiếng Việt đủ dấu', () => {
  it('mọi tiêu đề h2 có padding-top ≥ 0,8 mm (đo trên DOM in) và PDF không có mẩu chữ lẻ — cả 5 bố cục, khoá học dài', async () => {
    for (const layout of PRINT_LAYOUTS) {
      const p = await print({ layout, kind: 'COURSE', ban: 'long' });
      expect(p.dom.headingPaddingsPx.length, `bố cục ${layout}: có tiêu đề mục`).toBeGreaterThanOrEqual(2);
      for (const px of p.dom.headingPaddingsPx) expect(px, `bố cục ${layout}`).toBeGreaterThanOrEqual(0.8 * PX_PER_MM - 0.01);
      expect(check(p).filter((x) => x.includes('mẩu chữ lẻ'))).toEqual([]);
    }
  }, 300_000);

  it('chữ có dấu đủ ở mọi bố cục: tiêu đề, tên, địa chỉ, tiền bằng chữ đúng nguyên văn trong PDF', async () => {
    for (const layout of PRINT_LAYOUTS) {
      const p = await print({ layout, kind: 'SERVICE', ban: 'long' });
      for (const s of ['Nguyễn Thu Trang', 'Nguyễn Trọng Chiến', 'phường Trung Liệt, Đống Đa, Hà Nội', 'Bảy triệu một trăm năm mươi hai nghìn đồng', 'Thợ chính: Chiến · Thợ phụ: Lan', 'Phù dâu — Makeup tiệc']) {
        expect(p.all, `bố cục ${layout}: ${s}`).toContain(s);
      }
      expect(p.all).toMatch(/H[ỢợOo]P ĐỒNG|Hợp đồng/);
    }
  }, 300_000);
});

describe('PDF: L4 dòng tổng không lặp; đầu bảng lặp', () => {
  it('mẫu 3, bảng 40 dòng: "Tổng cộng" đúng 1 lần dù bảng chạy qua nhiều trang; đầu bảng "Thành tiền" lặp ở mỗi trang bảng', async () => {
    const p = await print({ layout: 3, kind: 'SERVICE', ban: 'longTable' });
    expect(p.pages).toBeGreaterThanOrEqual(3);
    expect(count(p.all, 'Tổng cộng'), '"Tổng cộng" phải có đúng 1 lần').toBe(1);
    expect(count(p.all, 'Tiền cọc phải thu'), 'dòng cọc trong tfoot cũng đúng 1 lần').toBe(1);
    const headerPages = p.perPage.filter((t) => /THÀNH TIỀN|Thành tiền/i.test(t)).length;
    expect(headerPages, 'đầu bảng lặp lại khi bảng sang trang').toBeGreaterThanOrEqual(2);
    expect(check(p)).toEqual([]);
  }, 120_000);
});

describe('PDF: L6 khung viền mẫu 5 lặp ở mọi trang mà không chứa chữ', () => {
  it('mỗi trang của mẫu 5 (khoá học dài, 2 trang; bảng 40 dòng, 5 trang) có viền kép ở lề ngoài (kiểm trên ảnh trang)', async () => {
    const strip = (file: string, page: number, layout: PrintLayout): number => {
      // dải 6 px quanh lề trái của vùng in, ở độ phân giải 50 dpi: đếm điểm KHÔNG trắng trên cạnh viền dọc
      const png = join(OUT, `khung-${layout}-${page}`);
      execFileSync('pdftoppm', ['-r', '50', '-png', '-f', String(page), '-l', String(page), '-singlefile', file, png]);
      const x = Math.round((PAGE_MM[layout].left / 25.4) * 50) - 4;
      const out = execFileSync('convert', [`${png}.png`, '-crop', `9x400+${x}+200`, '-colorspace', 'Gray', '-threshold', '97%', '-format', '%[fx:(1-mean)*w*h]', 'info:']).toString();
      return Number(out);
    };
    for (const ban of ['long', 'longTable'] as const) {
      const kind = ban === 'long' ? 'COURSE' : 'SERVICE';
      const p = await print({ layout: 5, kind, ban });
      expect(p.pages).toBeGreaterThanOrEqual(2);
      for (let i = 1; i <= p.pages; i += 1) expect(strip(p.file, i, 5), `mẫu 5 ${ban} trang ${i} thiếu viền`).toBeGreaterThan(40);
    }
  }, 180_000);
});

describe('PDF: L8 print-color-adjust: exact giữ màu nền khi KHÔNG bật "in nền" của hộp in', () => {
  it('mẫu 3 in với printBackground=false vẫn có ô tiêu đề bảng xám (#ECE8E4) nhờ print-color-adjust: exact', async () => {
    const p = await print({ layout: 3, kind: 'SERVICE', ban: 'short', noBackground: true, tag: 'khong-nen' });
    const png = join(OUT, 'nen-3');
    execFileSync('pdftoppm', ['-r', '50', '-png', '-f', '1', '-l', '1', '-singlefile', p.file, png]);
    // đếm điểm có màu #ECE8E4 (236,232,228) ±2 trên trang
    const out = execFileSync('convert', [`${png}.png`, '-fuzz', '2%', '-fill', 'black', '-opaque', 'rgb(236,232,228)', '-fill', 'white', '+opaque', 'black', '-format', '%[fx:(1-mean)*w*h]', 'info:']).toString();
    expect(Number(out), 'không thấy màu nền ô tiêu đề').toBeGreaterThan(500);
  }, 120_000);
});

describe('PDF: L10 chuỗi lạ ra CHỮ, không phá chân trang', () => {
  it('tên khách "<b>x</b>" và mã hợp đồng có " và \\ in nguyên văn; chân trang vẫn đủ (không bị chuỗi CSS lạ phá)', async () => {
    const ten = '<b>x</b> & "y"';
    const ma = 'HD"}\\x';
    const p = await print({ layout: 2, kind: 'SERVICE', ban: 'long', ten, ma, tag: 'chuoi-la' });
    expect(p.all).toContain(ten);
    expect(p.all).toContain(`${ma} Trang`.slice(0, ma.length)); // mã trong tiêu đề và chân trang
    p.perPage.forEach((t, i) => {
      expect(t, `trang ${i + 1} mất chân trang`).toContain(`Trang ${i + 1} / ${p.pages}`);
      expect(t).toContain(ma);
    });
  }, 60_000);
});

describe('PDF: ẩn theo quyền', () => {
  it('che SĐT / email và không có quyền thu tiền: PDF không có số thật, không có tiến độ / phiếu thu, vẫn có tổng', async () => {
    for (const layout of PRINT_LAYOUTS) {
      const p = await print({ layout, kind: 'SERVICE', ban: 'long', anTien: true, anLienHe: true, tag: 'che' });
      for (const s of ['0903 456 789', 'thutrang.ng@gmail.com', 'Tiến độ', 'Đã thu', 'Đã thanh toán', 'PT-000341', 'Còn phải thanh toán', 'Còn lại']) expect(p.all, `bố cục ${layout}: ${s}`).not.toContain(s);
      expect(p.all).toContain('……');
      expect(p.all).toContain(norm(formatVnd(7_152_000)));
    }
  }, 300_000);
});

// ---------- dò chỗ ngắt trang: dịch tờ xuống 0, 4, 8, … mm để chỗ ngắt rơi vào mọi vị trí ----------

// 0 → 108 mm, bước 4 mm: khối tiền nằm giữa trang 1 nên cần dịch xa mới rơi vào chỗ ngắt.
const OFFSETS = Array.from({ length: 28 }, (_, i) => i * 4);

function pageOf(p: Printed, text: string, which: 'first' | 'last' = 'first'): number {
  const idx = p.perPage.map((t, i) => (t.includes(norm(text)) ? i : -1)).filter((i) => i >= 0);
  return idx.length ? (which === 'first' ? idx[0]! : idx.at(-1)!) : -1;
}

describe('PDF: dò chỗ ngắt trang (L2 không cắt đôi, L5 tiêu đề mồ côi, chữ ký cuối không mồ côi)', () => {
  it(
    'bảng 40 dòng ở mẫu 1, 3, 4, 5 và danh sách mẫu 2: mỗi dòng bảng (tên khách mời + mã ghế cuối ô) nằm trọn một trang ở mọi chỗ ngắt',
    async () => {
      const bad: string[] = [];
      for (const layout of [1, 2, 3, 4, 5] as const) {
        for (const lech of layout === 3 || layout === 2 ? OFFSETS.filter((_, i) => i % 2 === 0) : [0, 21, 44]) {
          const p = await print({ layout, kind: 'SERVICE', ban: 'longTable', lech });
          for (let i = 1; i <= 40; i += 1) {
            const n = String(i).padStart(2, '0');
            const a = pageOf(p, `Khách mời ${n}`);
            const b = pageOf(p, `Mã ghế ${n}`);
            if (a < 0 || b < 0) bad.push(`mẫu ${layout} lệch ${lech}: thiếu dòng ${n}`);
            else if (a !== b) bad.push(`mẫu ${layout} lệch ${lech}: dòng ${n} bị cắt đôi (trang ${a + 1} → ${b + 1})`);
          }
        }
      }
      expect(bad).toEqual([]);
    },
    600_000,
  );

  // Khung tổng nằm giữa trang 1 nên dò riêng: dịch tờ xuống 56 → 128 mm, bước 2 mm; dòng đầu và dòng cuối của khối phải cùng trang.
  for (const [layout, first, last] of [
    [1, 'Tạm tính', 'Tổng cộng'],
    [2, 'Tạm tính', 'Cọc phải thu'],
    [5, 'Tạm tính', 'Còn phải thanh toán'],
  ] as const) {
    it(
      `mẫu ${layout} dịch vụ dài: khung tổng ("${first}" → "${last}") không bị cắt đôi ở mọi chỗ ngắt từ 56 đến 128 mm`,
      async () => {
        const bad: string[] = [];
        for (let lech = 56; lech <= 128; lech += 2) {
          const p = await print({ layout, kind: 'SERVICE', ban: 'long', lech });
          const a = pageOf(p, first);
          const b = pageOf(p, last, 'last');
          if (a < 0 || b < 0) bad.push(`mẫu ${layout} lệch ${lech}: thiếu dòng của khung tổng`);
          else if (a !== b) bad.push(`mẫu ${layout} lệch ${lech}: khung tổng bị cắt (trang ${a + 1} → ${b + 1})`);
        }
        expect(bad).toEqual([]);
      },
      600_000,
    );
  }

  for (const [layout, kind, ban] of [
    [1, 'COURSE', 'long'],
    [2, 'SERVICE', 'long'],
    [3, 'COURSE', 'long'],
    [5, 'COURSE', 'long'],
  ] as const) {
    it(
      `mẫu ${layout} ${kind}.${ban}: ở ${OFFSETS.length} chỗ ngắt khác nhau — điều khoản không bị cắt, tiêu đề không mồ côi, khung tổng không bị cắt, chữ ký trọn vẹn và đi kèm chữ kết thúc`,
      async () => {
        const bad: string[] = [];
        for (const lech of OFFSETS) {
          const p = await print({ layout, kind, ban, lech });
          const d = dataOf(p.job);
          const tag = `mẫu ${layout} lệch ${lech}mm`;
          // điều khoản + nội quy: đầu và cuối cùng một trang, mỗi điều đúng 1 lần
          for (const t of [...(d.terms?.items ?? []), ...(d.rules?.items ?? [])]) {
            const n = norm(t);
            if (count(p.all, n.slice(0, 40)) !== 1) bad.push(`${tag}: điều "${n.slice(0, 30)}…" có ${count(p.all, n.slice(0, 40))} lần`);
            else if (pageOf(p, n.slice(0, 40)) !== pageOf(p, n.slice(-30))) bad.push(`${tag}: điều "${n.slice(0, 30)}…" bị cắt đôi`);
          }
          // tiêu đề mồ côi: chữ cuối trang không phải tiêu đề mục
          p.perPageLayout.forEach((txt, i) => {
            const lines = txt.split('\n').map((x) => x.trim()).filter((x) => x && !isFooterLine(x, d.contract.code));
            const last = norm(lines.at(-1) ?? '');
            if (last.length >= 4) for (const h of p.dom.headings) if (norm(h).endsWith(last)) bad.push(`${tag}: trang ${i + 1} kết thúc bằng tiêu đề "${h}"`);
          });
          // khung tổng không bị cắt (Tạm tính ↔ Tổng cộng cùng trang), bảng tiến độ trọn vẹn
          const a = pageOf(p, 'Tổng cộng');
          const b = d.money.discount > 0 ? pageOf(p, 'Giảm giá') : a;
          if (a < 0 || a !== b) bad.push(`${tag}: khung tổng bị cắt (Giảm giá trang ${b + 1}, Tổng cộng trang ${a + 1})`);
          // chỗ ký trọn vẹn: nhãn + tên cùng trang trang cuối; có chữ kết thúc đi kèm; không đứng một mình
          const last = p.perPage.length - 1;
          const signA = layout === 1 ? 'ĐẠIDIỆNBÊNA' : 'BÊNA—';
          const lastTxt = p.perPage[last]!;
          // mẫu 5 giãn chữ (letter-spacing) nên pdftotext chèn khoảng trắng giữa các chữ cái của nhãn — so không tính khoảng trắng
          if (!lastTxt.replace(/\s+/g, '').includes(signA) || !lastTxt.includes(norm(d.customer.fullName)) || !lastTxt.includes('Nguyễn Trọng Chiến')) bad.push(`${tag}: chỗ ký bị cắt hoặc không ở trang cuối`);
          if (!lastTxt.includes(norm(sampleConfig(layout, kind).closingText).slice(0, 40))) bad.push(`${tag}: chữ ký mồ côi (không có chữ kết thúc cùng trang)`);
        }
        expect(bad).toEqual([]);
      },
      600_000,
    );
  }
});
