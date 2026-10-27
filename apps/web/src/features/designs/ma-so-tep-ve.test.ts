// Bản vẽ H mục 4.4 / 5.2 — ô MÃ SỐ trên 21 tệp vẽ chào mừng (cm-01..10 + shd-01..11), đo bằng Chromium thật (Playwright).
// Mở đúng tệp app nạp vào iframe (public/mau/<mã>.html qua Vite) với dữ liệu thật ?that=1 + tên dài có dấu, ở khổ dọc 1080×1350
// và vuông 1080×1080, mã "07", "123", "999":
//  - khối mã (.seat) hiện, chữ số (đo MỰC chữ bằng canvas, không phải hộp dòng) nằm trong lòng khung mã, cách viền ≥ 3px
//    (khung tròn/viên thuốc: trong hình tròn/viên thuốc trừ viền + vòng trong; hình thoi cm-05: trong hình thoi; hình chữ nhật: trong hộp
//    trừ viền + vòng trong; mép răng cưa/xé (clip-path) trừ thêm 8px);
//  - khối mã không giao chữ nào khác (hộp dòng thu về 1,05 em), không giao khung ảnh, logo, mã QR; nằm trong thẻ, cách mép ≥ 8px;
//  - nhãn "SỐ" không chạm chữ số; tên dài "Tôn Nữ Hoàng Bảo Ngọc Phương Thảo" không tràn ngang, không quá số dòng cho phép;
//  - khung ảnh học viên TRÒN (rộng = cao, bo ≥ nửa cạnh), riêng shd-11 viên thuốc (cao > rộng).
// ?that=1 không có ?ma → khối mã display:none (không in số bịa).
// Phần tử xoay nhẹ (cm-08 tờ giấy −1,4°, mẩu washi 7°, thẻ treo cm-09 6°) được đo ở bố cục chưa xoay (bỏ phép xoay lúc đo).
// Thiếu Chromium → ĐỎ kèm cách cài (không tự bỏ qua).
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { listDesignTemplates } from '@makeup/shared';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CODES = listDesignTemplates({ kind: 'WELCOME' }).map((t) => t.code);
const LONG = 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo';
const MA = ['07', '123', '999'] as const;
const SIZES = [
  { kho: 'doc', w: 1080, h: 1350 },
  { kho: 'vuong', w: 1080, h: 1080 },
] as const;
const GAP_VIEN = 3; // chữ số cách viền khung mã tối thiểu (px)
const GAP_KHAC = 2; // khối mã cách chữ / ảnh khác tối thiểu (px)
const MEP = 8; // khối mã cách mép thẻ tối thiểu (px)

let server: ViteDevServer;
let browser: Browser;
let base: string;

beforeAll(async () => {
  const exe = chromium.executablePath();
  if (!existsSync(exe)) {
    throw new Error(
      `Không thấy Chromium của Playwright (${exe}). Cài bằng "pnpm --filter @makeup/web exec playwright install chromium" ` +
        'hoặc đặt PLAYWRIGHT_BROWSERS_PATH trỏ tới thư mục trình duyệt đã cài (/opt/pw-browsers) — bài đo ô mã số không tự bỏ qua.',
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
  if (!url) throw new Error('Vite không trả địa chỉ');
  base = url.replace(/\/$/, '');
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const dataOf = (extra: Record<string, string>): Record<string, string> => ({
  that: '1', th: 'Chiến Makeup Academy', logo: `${base}/mau/chung/logo-mau.svg`, anh: `${base}/mau/chung/anh-hoc-vien.svg`,
  ten: LONG, khoa: 'Makeup chuyên nghiệp', lop: 'K12', ngay: '02/11/2026', lich: 'T3 · T5 · T7, 18:00–22:00', gv: 'Nguyễn Thu Hà',
  diachi: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', sdt: '0912 345 678', web: 'chienmakeup.vn', ...extra,
});

interface Measure {
  seats: number;
  hidden: boolean;
  seatText: string;
  inner: { shape: string; gap: number } | null; // gap: khoảng cách nhỏ nhất từ mực chữ số tới viền trong (âm = tràn)
  labelGap: number | null; // nhãn "SỐ" ↔ chữ số (âm = chồng)
  edge: number; // khối mã ↔ mép thẻ
  hits: { what: string; gap: number }[]; // khối mã ↔ chữ/ảnh khác (chỉ ghi khi gap < GAP_KHAC), kèm gần nhất
  nearest: { what: string; gap: number } | null;
  ten: { overflow: number; lines: number; maxLines: number; outside: number };
  frame: { w: number; h: number; r: number } | null;
  errors: string[];
}

// Đo trong trang. Viết dạng chuỗi để chạy y nguyên trong trình duyệt (không qua bộ biến đổi mã của bài thử).
const MEASURE = String.raw`(() => {
  const c = document.getElementById('c');
  // Bỏ phép xoay (để đo ở bố cục chưa xoay); giữ phép dời (shd-11 căn giữa bằng translate).
  for (const el of c.querySelectorAll('*')) {
    const t = getComputedStyle(el).transform;
    if (t && t !== 'none') { const m = new DOMMatrix(t); if (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6) el.style.transform = 'translate(' + m.e + 'px,' + m.f + 'px)'; }
  }
  const C = c.getBoundingClientRect();
  const seats = [...c.querySelectorAll('.seat')];
  const ma = c.querySelector('[data-f="ma"]');
  const seat = ma && ma.closest('.seat');
  const px = (v, ref) => (String(v).trim().endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v) || 0);
  const insetOf = (cs) => {
    let max = 0;
    for (const part of cs.boxShadow.split(/,(?![^(]*\))/)) {
      if (!/inset/.test(part)) continue;
      const nums = [...part.replace(/rgba?\([^)]*\)/g, '').matchAll(/(-?[\d.]+)px/g)].map((m) => +m[1]);
      if (nums.length >= 4) max = Math.max(max, nums[3]);
    }
    return max;
  };
  const cv = document.createElement('canvas').getContext('2d');
  // Mực chữ của một phần tử chữ một dòng (hộp quanh nét chữ thật).
  const ink = (el) => {
    const cs = getComputedStyle(el);
    const r = document.createRange(); r.selectNodeContents(el);
    const rs = [...r.getClientRects()].filter((q) => q.width > 0);
    if (!rs.length) return null;
    if (rs.length > 1) {
      // nhãn nhiều dòng (cm-02 "Mã / số"): hợp các hộp dòng, thu về 1,05 em mỗi dòng
      const fs = parseFloat(cs.fontSize);
      const bs = rs.map((q) => { const hh = Math.min(q.height, fs * 1.05); return { l: q.left, r: q.right, t: q.top + (q.height - hh) / 2, b: q.top + (q.height + hh) / 2 }; });
      return { l: Math.min(...bs.map((x) => x.l)), r: Math.max(...bs.map((x) => x.r)), t: Math.min(...bs.map((x) => x.t)), b: Math.max(...bs.map((x) => x.b)) };
    }
    cv.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    cv.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const txt = cs.textTransform === 'uppercase' ? el.textContent.toLocaleUpperCase('vi') : el.textContent;
    const m = cv.measureText(txt);
    const q = rs[0];
    const baseY = q.top + m.fontBoundingBoxAscent;
    return { l: q.left - m.actualBoundingBoxLeft, r: q.left + m.actualBoundingBoxRight - (parseFloat(cv.letterSpacing) || 0),
      t: baseY - m.actualBoundingBoxAscent, b: baseY + m.actualBoundingBoxDescent };
  };
  const corners = (b) => [[b.l, b.t], [b.r, b.t], [b.l, b.b], [b.r, b.b]];
  // Khoảng cách có dấu từ điểm tới viền trong của hình (dương = ở trong).
  const capsuleIn = (x, y, cx, cy, w, h, inset) => {
    const r = Math.min(w, h) / 2;
    const hx = Math.max(0, w / 2 - r), hy = Math.max(0, h / 2 - r);
    const dx = Math.max(0, Math.abs(x - cx) - hx), dy = Math.max(0, Math.abs(y - cy) - hy);
    return r - inset - Math.hypot(dx, dy);
  };
  const out = { seats: seats.length, hidden: false, seatText: '', inner: null, labelGap: null, edge: 0, hits: [], nearest: null, ten: null, frame: null, errors: [] };
  // Khung ảnh học viên
  const anh = c.querySelector('img[data-f="anh"]');
  let photo = null;
  if (anh) {
    let k = anh.parentElement;
    while (k && k !== c && getComputedStyle(k).overflow === 'visible') k = k.parentElement;
    const kr = k.getBoundingClientRect(), kc = getComputedStyle(k);
    out.frame = { w: Math.round(kr.width), h: Math.round(kr.height), r: px(kc.borderTopLeftRadius, kr.width) };
    photo = { rect: kr, round: out.frame.r >= Math.min(kr.width, kr.height) / 2 - 0.5 };
  }
  // Tên học viên
  const ten = c.querySelector('[data-f="ten"]');
  {
    const r = document.createRange(); r.selectNodeContents(ten);
    const rs = [...r.getClientRects()].filter((q) => q.width > 1);
    const tops = [...new Set(rs.map((q) => Math.round(q.top / 4)))];
    const fs = parseFloat(getComputedStyle(ten).fontSize);
    let outside = 0;
    for (const q of rs) outside = Math.max(outside, C.left + 8 - q.left, q.right - (C.right - 8));
    out.ten = { overflow: ten.scrollWidth - ten.clientWidth, lines: tops.length, maxLines: +(ten.dataset.fit || 1), outside, fs };
  }
  if (!seat) return out;
  const scs = getComputedStyle(seat);
  out.hidden = scs.display === 'none' || seat.getClientRects().length === 0;
  if (out.hidden) return out;
  out.seatText = ma.textContent;
  const S0 = seat.getBoundingClientRect();
  const dg0 = ink(ma);
  // Hộp chiếm chỗ của khối mã = hộp khối ∪ mực chữ số (nét số có thể thò ra ngoài hộp dòng).
  const S = new DOMRect(Math.min(S0.left, dg0.l), Math.min(S0.top, dg0.t), Math.max(S0.right, dg0.r) - Math.min(S0.left, dg0.l), Math.max(S0.bottom, dg0.b) - Math.min(S0.top, dg0.t));
  out.edge = Math.min(S.left - C.left, C.right - S.right, S.top - C.top, C.bottom - S.bottom);
  const dg = dg0;
  // Hình viền trong của khung mã
  const bw = parseFloat(scs.borderTopWidth) || 0, ins = insetOf(scs);
  const bef = getComputedStyle(seat, '::before');
  const clip = scs.clipPath !== 'none' || (bef.content !== 'none' && bef.clipPath !== 'none');
  let shape, gap;
  const cx = S0.left + S0.width / 2, cy = S0.top + S0.height / 2;
  const noFrame = bw === 0 && ins === 0 && bef.content === 'none' && scs.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(scs.backgroundColor);
  if (noFrame) {
    // khối mã không có khung (shd-07 ô cuống vé, shd-11 dòng chân): không có viền để chạm; mực chữ số tính vào hộp khối mã khi đo va chạm.
    shape = 'không khung';
    gap = Infinity;
  } else if (bef.content !== 'none' && /matrix\(0\.7071/.test(bef.transform)) {
    // hình thoi: ô vuông ::before xoay 45°
    const w = parseFloat(bef.width), L = parseFloat(bef.left), T = parseFloat(bef.top);
    const dcx = S0.left + L + w / 2, dcy = S0.top + T + w / 2;
    const half = (w / Math.SQRT2) - ((parseFloat(bef.borderTopWidth) || 0) + insetOf(bef)) * Math.SQRT2;
    shape = 'thoi';
    gap = Math.min(...corners(dg).map(([x, y]) => (half - Math.abs(x - dcx) - Math.abs(y - dcy)) / Math.SQRT2));
  } else if (px(scs.borderTopLeftRadius, S0.width) >= Math.min(S0.width, S0.height) / 2 - 0.5) {
    shape = Math.abs(S0.width - S0.height) < 0.5 ? 'tròn' : 'viên thuốc';
    gap = Math.min(...corners(dg).map(([x, y]) => capsuleIn(x, y, cx, cy, S0.width, S0.height, bw + ins)));
  } else {
    shape = clip ? 'chữ nhật mép cắt' : 'chữ nhật';
    const e = bw + ins + (clip ? 8 : 0);
    gap = Math.min(dg.l - (S0.left + e), S0.right - e - dg.r, dg.t - (S0.top + e), S0.bottom - e - dg.b);
  }
  out.inner = { shape, gap: gap === Infinity ? 999 : Math.round(gap * 10) / 10 };
  // Nhãn "SỐ"
  const lab = [...seat.querySelectorAll('*')].find((e) => e !== ma && !e.contains(ma) && e.textContent.trim());
  if (lab) {
    const L = ink(lab);
    if (L) out.labelGap = Math.round(Math.max(L.l - dg.r, dg.l - L.r, L.t - dg.b, dg.t - L.b) * 10) / 10;
  }
  // Khối mã ↔ phần tử khác
  const seatRound = shape === 'tròn';
  const rectGap = (a) => {
    if (seatRound) {
      const r = S0.width / 2;
      const dx = Math.max(a.left - cx, 0, cx - a.right), dy = Math.max(a.top - cy, 0, cy - a.bottom);
      return Math.hypot(dx, dy) - r;
    }
    return Math.max(a.left - S.right, S.left - a.right, a.top - S.bottom, S.top - a.bottom);
  };
  const things = [];
  const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!n.textContent.trim() || seat.contains(p) || p.closest('script,style')) continue;
    if (p.closest('svg')) {
      const t = p.closest('text');
      if (t) things.push({ what: 'chữ SVG "' + t.textContent.trim().slice(0, 24) + '"', rect: t.getBoundingClientRect() });
      continue;
    }
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const fs = parseFloat(cs.fontSize);
    const r = document.createRange(); r.selectNodeContents(n);
    for (const q of r.getClientRects()) {
      if (q.width < 1) continue;
      const hh = Math.min(q.height, fs * 1.05);
      things.push({ what: 'chữ "' + n.textContent.trim().slice(0, 24) + '"', rect: new DOMRect(q.left, q.top + (q.height - hh) / 2, q.width, hh) });
    }
  }
  const logo = c.querySelector('img[data-f="logo"]');
  if (logo && logo.getClientRects().length && getComputedStyle(logo).display !== 'none') things.push({ what: 'logo', rect: logo.getBoundingClientRect() });
  const qr = c.querySelector('[data-qr]');
  if (qr && qr.getClientRects().length) things.push({ what: 'mã QR', rect: qr.getBoundingClientRect() });
  for (const t of things) {
    const g = rectGap(t.rect);
    if (!out.nearest || g < out.nearest.gap) out.nearest = { what: t.what, gap: Math.round(g * 10) / 10 };
    if (g < ${GAP_KHAC}) out.hits.push({ what: t.what, gap: Math.round(g * 10) / 10 });
  }
  if (photo) {
    let g;
    const P = photo.rect;
    if (photo.round && Math.abs(P.width - P.height) < 0.5 && seatRound) g = Math.hypot(cx - (P.left + P.width / 2), cy - (P.top + P.height / 2)) - S0.width / 2 - P.width / 2;
    else if (photo.round && Math.abs(P.width - P.height) < 0.5) {
      const pcx = P.left + P.width / 2, pcy = P.top + P.height / 2;
      const dx = Math.max(S.left - pcx, 0, pcx - S.right), dy = Math.max(S.top - pcy, 0, pcy - S.bottom);
      g = Math.hypot(dx, dy) - P.width / 2;
    } else g = rectGap(P);
    const item = { what: 'khung ảnh', gap: Math.round(g * 10) / 10 };
    if (!out.nearest || g < out.nearest.gap) out.nearest = item;
    if (g < ${GAP_KHAC}) out.hits.push(item);
  }
  return out;
})()`;

async function open(page: Page, code: string, params: Record<string, string>): Promise<Measure> {
  const errors: string[] = [];
  const onErr = (e: Error) => errors.push(e.message);
  page.on('pageerror', onErr);
  try {
    await page.goto(`${base}/mau/${code}.html?${new URLSearchParams(params)}`);
    await page.waitForFunction(
      () => document.body.dataset.ready === '1' && (!document.querySelector('script[src="chung/cm.js"]') || document.body.dataset.cmXong === '1'),
      null,
      { timeout: 30_000 },
    );
    const m = (await page.evaluate(MEASURE)) as Measure;
    m.errors = errors;
    return m;
  } finally {
    page.off('pageerror', onErr);
  }
}

// Số đo nhỏ nhất của từng mẫu (in ra cuối bài để nộp báo cáo).
const SO_DO: Record<string, { vien: number; khac: number; gan: string; nhan: number; mep: number }> = {};

describe('ô mã số trên 21 tệp vẽ chào mừng — Chromium thật', () => {
  it('danh mục có đúng 21 mẫu chào mừng (10 cm + 11 shd)', () => {
    expect(CODES).toHaveLength(21);
  });

  for (const code of CODES) {
    it(`BẮT: ${code} — mã 07/123/999 vừa khung mã, không chạm chữ/ảnh khác, tên dài không tràn; không có mã thì ẩn khối; khung ảnh đúng hình (2 khổ)`, async () => {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
      const bad: string[] = [];
      try {
        for (const s of SIZES) {
          await page.setViewportSize({ width: s.w, height: s.h });
          const kho: Record<string, string> = s.kho === 'vuong' ? { kho: 'vuong' } : {};
          for (const ma of MA) {
            const m = await open(page, code, dataOf({ ...kho, ma }));
            const at = `${code} ${s.kho} ma=${ma}`;
            if (m.errors.length) bad.push(`${at}: lỗi trang ${m.errors.join('; ')}`);
            if (m.seats !== 1) bad.push(`${at}: có ${m.seats} khối .seat (phải đúng 1)`);
            if (m.hidden || !m.inner) { bad.push(`${at}: khối mã không hiện`); continue; }
            if (m.seatText !== ma) bad.push(`${at}: ô mã in "${m.seatText}"`);
            if (m.inner.gap < GAP_VIEN) bad.push(`${at}: chữ số chạm/tràn viền khung mã (${m.inner.shape}, cách ${m.inner.gap}px < ${GAP_VIEN})`);
            if (m.labelGap !== null && m.labelGap < 1) bad.push(`${at}: nhãn "SỐ" chạm chữ số (${m.labelGap}px)`);
            if (m.edge < MEP) bad.push(`${at}: khối mã sát/ra ngoài mép thẻ (${m.edge.toFixed(1)}px)`);
            for (const h of m.hits) bad.push(`${at}: khối mã chạm ${h.what} (cách ${h.gap}px)`);
            if (m.ten.overflow > 1) bad.push(`${at}: tên tràn ngang ${m.ten.overflow}px`);
            if (m.ten.lines > m.ten.maxLines) bad.push(`${at}: tên ${m.ten.lines} dòng > ${m.ten.maxLines}`);
            if (m.ten.outside > 0) bad.push(`${at}: tên ra ngoài thẻ ${m.ten.outside}px`);
            const f = m.frame;
            if (!f) bad.push(`${at}: không có khung ảnh học viên`);
            else if (code === 'shd-11') {
              if (!(f.h > f.w && f.r >= f.w / 2 - 0.5)) bad.push(`${at}: shd-11 phải khung viên thuốc (đo ${f.w}×${f.h}, bo ${f.r})`);
            } else if (!(Math.abs(f.w - f.h) <= 1 && f.r >= f.w / 2 - 0.5)) bad.push(`${at}: khung ảnh không tròn (đo ${f.w}×${f.h}, bo ${f.r})`);
            const cur = SO_DO[code];
            const near = m.nearest ?? { what: '—', gap: Infinity };
            if (!cur || m.inner.gap < cur.vien) SO_DO[code] = { ...(cur ?? { khac: Infinity, gan: '', nhan: Infinity, mep: Infinity }), vien: m.inner.gap };
            const c2 = SO_DO[code]!;
            if (near.gap < c2.khac) { c2.khac = near.gap; c2.gan = `${near.what} (${s.kho}, ${ma})`; }
            if (m.labelGap !== null) c2.nhan = Math.min(c2.nhan, m.labelGap);
            c2.mep = Math.min(c2.mep, Math.round(m.edge));
          }
          const none = await open(page, code, dataOf({ ...kho }));
          if (!none.hidden) bad.push(`${code} ${s.kho}: ?that=1 không có ?ma mà khối mã vẫn hiện`);
        }
      } finally {
        await page.close();
      }
      if (bad.length) console.log(`[ma-so-tep-ve] ${code}:\n${bad.join('\n')}`);
      expect(bad).toEqual([]);
    }, 180_000);
  }

  it('in bảng số đo (nhỏ nhất qua 2 khổ × 3 mã)', () => {
    const rows = CODES.map((c) => {
      const d = SO_DO[c];
      return d ? `${c}: số↔viền ${d.vien}px · khối mã↔gần nhất ${d.khac}px [${d.gan}] · nhãn↔số ${d.nhan}px · mép thẻ ${d.mep}px` : `${c}: (không đo được)`;
    });
    console.log(`[ma-so-tep-ve] số đo ô mã:\n${rows.join('\n')}`);
    expect(Object.keys(SO_DO).sort()).toEqual([...CODES].sort());
  });
});
