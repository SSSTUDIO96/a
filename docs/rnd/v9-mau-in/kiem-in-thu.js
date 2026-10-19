// R&D 09 — BÀI IN THỬ 5 mẫu × 2 loại × 2 bản bằng Chromium (page.pdf A4, giống "In / Lưu PDF") rồi kiểm:
// khổ A4; bản ngắn đúng 1 trang; tiêu đề xuất hiện đúng 1 lần; mỗi điều khoản/nội quy có mặt đúng 1 lần (không thiếu, không lặp);
// tổng tiền có trong PDF; window.__kiem (cộng lại tiền, số km, số buổi) không lỗi; không khối fixed chứa chữ, không khối bị cắt;
// không trang gần như trống; không mẩu chữ lẻ (dấu tiếng Việt của tiêu đề "rơi" sang cuối trang trước).
// Cần: Chromium của Playwright (PLAYWRIGHT_BROWSERS_PATH) + pdfinfo/pdftotext (poppler).
// Chạy từ gốc kho: node docs/rnd/v9-mau-in/kiem-in-thu.js [mau] [thư-mục-ra-PDF] — mặc định ra thư mục tạm của máy.
const path = require('node:path');
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.join(__dirname, '../../../apps/web')] }));
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const ROOT = path.join(__dirname, 'in.html');
const OUT = process.argv[3] || path.join(require('node:os').tmpdir(), 'rnd09-in-thu');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3, 4, 5];
const norm = (s) => s.replace(/ /g, ' ').replace(/[ \t\r\n\f]+/g, ' ');
const count = (hay, needle) => hay.split(needle).length - 1;

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const mau of only) for (const loai of ['dich-vu', 'khoa-hoc']) for (const ban of ['ngan', 'dai']) {
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', (r) => errors.push('Tải hỏng: ' + r.url()));
    await page.goto(`file://${ROOT}?mau=${mau}&loai=${loai}&ban=${ban}&chup`);
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    const dom = await page.evaluate(() => {
      const fixed = [], clip = [];
      for (const el of document.querySelectorAll('.giay *')) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' && !el.classList.contains('khung-trang')) fixed.push(el.className || el.tagName);
        if (el.closest('.khung-trang')) continue;
        if (['hidden', 'clip', 'scroll', 'auto'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) clip.push(el.className || el.tagName);
      }
      const fontsOk = [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family);
      return { kiem: window.__kiem, title: document.querySelector('.td')?.textContent.trim() ?? '', fixed, clip, fontsErr: fontsOk, toolbar: getComputedStyle(document.querySelector('.thanh')).display };
    });
    const file = path.join(OUT, `m${mau}-${loai}-${ban}.pdf`);
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    await page.close();
    const info = execFileSync('pdfinfo', [file]).toString();
    const pages = Number(info.match(/Pages:\s+(\d+)/)[1]);
    const size = info.match(/Page size:\s+([^\n]+)/)[1];
    const per = [];
    for (let p = 1; p <= pages; p++) per.push(norm(execFileSync('pdftotext', ['-raw', '-f', String(p), '-l', String(p), file, '-']).toString()));
    const all = per.join(' ');
    const k = dom.kiem;
    const issues = [...k.loi, ...errors];
    if (dom.fixed.length) issues.push('Khối fixed chứa nội dung: ' + dom.fixed.join(','));
    if (dom.clip.length) issues.push('Khối bị cắt: ' + dom.clip.join(','));
    if (dom.fontsErr.length) issues.push('Phông lỗi: ' + dom.fontsErr.join(','));
    if (dom.toolbar !== 'none') issues.push('Thanh công cụ hiện khi in');
    if (!/59[45]\.\d+ x 841\.\d+/.test(size)) issues.push('Khổ giấy không phải A4: ' + size);
    if (ban === 'ngan' && pages !== 1) issues.push(`Bản ngắn ra ${pages} trang (phải 1)`);
    const tcount = count(all, norm(dom.title));
    if (tcount !== 1) issues.push(`Tiêu đề "${dom.title}" xuất hiện ${tcount} lần`);
    // Mỗi điều khoản: lấy 28 ký tự đầu, phải xuất hiện đúng 1 lần.
    const data = await (async () => k)();
    const terms = await getTerms(browser, mau, loai, ban);
    let missing = 0, dup = 0;
    for (const t of terms) { const c = count(all, norm(t).slice(0, 70)); if (c === 0) missing++; if (c > 1) dup++; }
    if (missing) issues.push(`Thiếu ${missing} điều khoản/nội quy trong PDF`);
    if (dup) issues.push(`Lặp ${dup} điều khoản/nội quy`);
    const tot = norm(k.total);
    if (!all.includes(tot)) issues.push('Không thấy tổng ' + tot);
    const codeOnPages = per.filter((x) => x.includes(k.code)).length;
    const blank = per.findIndex((x) => x.replace(/HĐ(DV|KH)-\d+|Trang \d+ \/ \d+|Ký nháy|A:|B:|_|BẢN NHÁP|·/g, '').trim().length < 20);
    if (blank >= 0) issues.push(`Trang ${blank + 1} gần như trống`);
    // Dấu tiếng Việt "rơi" sang cuối trang trước (mẩu chữ 1–2 ký tự đứng riêng một dòng).
    for (let p = 1; p <= pages; p++) {
      const lines = execFileSync('pdftotext', ['-layout', '-f', String(p), '-l', String(p), file, '-']).toString().split('\n');
      for (const ln of lines) { const t = ln.trim(); if (t.length > 0 && t.length <= 2 && t !== "QR" && t === t.toUpperCase() && !/^\d+[.)]?$/.test(t)) issues.push(`Trang ${p}: mẩu chữ lẻ "${t}"`); }
    }
    results.push({ mau, loai, ban, pages, size, title: dom.title, titleCount: tcount, terms: terms.length, codeOnPages, total: tot, issues });
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
})();

async function getTerms(browser, mau, loai, ban) {
  const p = await browser.newPage();
  await p.goto(`file://${ROOT}?mau=${mau}&loai=${loai}&ban=${ban}&chup`);
  const t = await p.evaluate(() => [...document.querySelectorAll('.giay ol.dk li, .giay table.dkb td:nth-child(2)')].map((x) => x.textContent.trim()));
  await p.close();
  return t;
}
