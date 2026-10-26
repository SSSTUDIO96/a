import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// BÀI IN THẬT qua HỘP In, trên MÁY CHỦ THẬT (bản vẽ G mục 4.4 + 5.2, gói G-W3):
//   - máy chủ API thật (apps/api, tsx src/server.ts) nối database thử makeup_test_g_w3, Vite dev proxy /api sang đó;
//   - trang in thử dialog/__in-thu__ dựng PrintButton + PrintDialog THẬT, Chromium thật bấm nút như người dùng;
//   - window.print() của trang được thay bằng hàm ghi sổ (headless không mở hộp in), nên "In / Lưu PDF" kết thúc bằng
//     page.pdf({ preferCSSPageSize, printBackground }) — đúng luật in @media print của hộp;
//   - kiểm: thứ tự "POST nhật ký 201 → rồi mới print()", dòng nhật ký trong database, nội dung PDF (pdftotext), không tràn ngang 390.
// Database: HDIN_DIALOG_DB (mặc định makeup_test_g_w3 trên localhost, giống playwright.config.ts) — tên phải bắt đầu makeup_test.
// Ảnh khung nhìn (fullPage: false) và PDF ghi vào HDIN_DIALOG_OUT (mặc định thư mục tạm).
// Cần Chromium của Playwright và poppler (pdfinfo / pdftotext / pdftoppm): thiếu thì báo ĐỎ, không tự bỏ qua.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const API_DIR = join(WEB, '..', 'api');
const HARNESS = '/src/features/contract-print/dialog/__in-thu__/index.html';
const DB_URL = process.env.HDIN_DIALOG_DB ?? 'postgresql://makeup:makeup_local@localhost:5432/makeup_test_g_w3';
const OUT = process.env.HDIN_DIALOG_OUT ?? join(tmpdir(), 'hdin-dialog');
const PASSWORD = 'mat-khau-thu-123';

let apiProc: ChildProcess | null = null;
let apiPort = 0;
let vite: ViteDevServer;
let browser: Browser;
let base = '';
let apiLog = '';

// ---------- máy chủ, Vite ----------

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createNetServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => res(p));
    });
  });
}

async function waitFor(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* chưa lên */
    }
    if (Date.now() > end) throw new Error(`Máy chủ API không lên sau ${ms} ms tại ${url}. Nhật ký:\n${apiLog.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ---------- gọi API thật ----------

interface Who {
  token: string;
  id: string;
  email: string;
}
let apiBase = '';

async function http<T = any>(method: string, path: string, token: string | null, body?: unknown, want = 200, raw?: Buffer): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (method === 'POST') headers['idempotency-key'] = randomUUID();
  let payload: BodyInit | undefined;
  if (raw) {
    headers['content-type'] = 'application/octet-stream';
    payload = new Uint8Array(raw);
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${apiBase}/api/v1${path}`, { method, headers, body: payload });
  const text = await res.text();
  if (res.status !== want) throw new Error(`${method} ${path}: mong ${want}, nhận ${res.status} ${text.slice(0, 600)}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function register(label: string): Promise<Who> {
  const email = `${label}-${randomUUID().slice(0, 8)}@thu.local`;
  const r = await http<{ accessToken: string; user: { id: string } }>('POST', '/auth/register', null, { email, password: PASSWORD, fullName: `Người thử ${label}` }, 201);
  return { token: r.accessToken, id: r.user.id, email };
}

// ---------- thế giới thử ----------

interface World {
  org: string;
  owner: Who;
  viewer: Who; // chỉ contracts.read
  customerPhone: string;
  draftService: string; // hợp đồng dịch vụ NHÁP
  confirmedService: string; // dịch vụ đã xác nhận, có phiếu thu
  course: string; // khoá học đã xác nhận, có nội quy
  templateModern: string;
  db: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
let w: World;

async function renderLogo(b: Browser): Promise<Buffer> {
  const ctx = await b.newContext({ viewport: { width: 240, height: 240 } });
  const page = await ctx.newPage();
  await page.setContent(
    `<body style="margin:0;width:240px;height:240px;display:grid;place-items:center;background:#fff">
       <div style="width:200px;height:200px;border-radius:50%;background:linear-gradient(145deg,#d9648c,#a63d62);color:#fff;display:grid;place-items:center;font:700 72px Georgia,serif">CM</div></body>`,
  );
  const png = await page.screenshot({ type: 'png' });
  await ctx.close();
  return png;
}

async function seedWorld(): Promise<World> {
  const apiRequire = createRequire(join(API_DIR, 'package.json'));
  const { PrismaClient } = apiRequire('@prisma/client') as { PrismaClient: new (o: unknown) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const db = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const owner = await register('g-w3-chu');
  const org = (await http<{ id: string }>('POST', '/orgs', owner.token, { name: 'Chiến Makeup Studio (thử G-W3)', slug: `gw3-${randomUUID().slice(0, 8)}`, kind: 'ACADEMY' }, 201)).id;
  const plan = await db.subscriptionPlan.create({ data: { code: `gw3_${randomUUID().slice(0, 8)}`, name: 'Gói thử không giới hạn', priceMonthly: 0n, features: [] } });
  await db.organizationSubscription.create({ data: { organizationId: org, planId: plan.id, startsAt: new Date(Date.now() - 86_400_000), endsAt: null, status: 'ACTIVE' } });
  const P = (path: string) => `/orgs/${org}${path}`;
  const post = <T = any>(path: string, body: unknown, want = 201) => http<T>('POST', P(path), owner.token, body, want); // eslint-disable-line @typescript-eslint/no-explicit-any
  const put = <T = any>(path: string, body: unknown) => http<T>('PUT', P(path), owner.token, body, 200); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Hồ sơ thương hiệu + logo thật + người đại diện + ngân hàng.
  const logo = await http<{ id: string }>('POST', P('/files?purpose=ORG_LOGO&name=logo.png'), owner.token, undefined, 201, await renderLogo(browser));
  await put('/profile', {
    brandName: 'Chiến Makeup Studio',
    tagline: 'Trang điểm cô dâu · Đào tạo makeup chuyên nghiệp',
    address: '25 Thái Hà, phường Trung Liệt, Đống Đa, Hà Nội',
    phone: '0988123456',
    email: 'lienhe@chienmakeup.vn',
    website: 'https://chienmakeup.vn',
    logoFileId: logo.id,
  });
  await put('/profile/contract-info', {
    representativeName: 'Nguyễn Trọng Chiến',
    representativeTitle: 'Chủ studio',
    bankName: 'Vietcombank',
    bankAccountNumber: '0123456789',
    bankAccountName: 'NGUYEN TRONG CHIEN',
  });

  // Danh mục dịch vụ.
  const tag = randomUUID().slice(0, 6);
  const price = (ref: object, listPrice: bigint) => db.priceVersion.create({ data: { organizationId: org, ...ref, listPrice, effectiveFrom: new Date(Date.now() - 60_000), createdById: owner.id } });
  const svc = async (code: string, name: string, kind: 'MAIN' | 'ADDON' | 'SURCHARGE', p: bigint) => {
    const s = await db.service.create({ data: { organizationId: org, code: `${code}-${tag}`, name, kind, durationMinutes: 60 } });
    await price({ serviceId: s.id }, p);
    return s.id as string;
  };
  const subjects = await db.makeupSubject.findMany({ where: { organizationId: org } });
  const subject = (n: string) => subjects.find((s: { name: string }) => s.name === n).id as string;
  const pkg = await db.servicePackage.create({ data: { organizationId: org, code: `GOI-${tag}`, name: 'Gói cô dâu trọn gói', durationMinutes: 120, subjectId: subject('Cô dâu') } });
  await price({ packageId: pkg.id }, 3_000_000n);
  const main = await svc('MK', 'Makeup tiệc', 'MAIN', 800_000n);
  const addon = await svc('MI', 'Dán mi', 'ADDON', 100_000n);
  const location = (await post('/studio-locations', { name: 'Studio Phố Huế', address: 'Số 9 Phố Huế, Hà Nội' })).id as string;
  const customerPhone = '0912345678';
  const customer = (await post('/customers', { fullName: 'Nguyễn Thị Hoa', phone: customerPhone, email: 'hoa@thu.local' })).id as string;
  const staff = async (label: string, display: string, role: string) => {
    const u = await register(label);
    const m = await post<{ id: string }>('/members', { email: u.email, roleKeys: [role] });
    await http('PATCH', P(`/staff/${m.id}`), owner.token, { displayName: display }, 200);
    return m.id;
  };
  const primary = await staff('g-w3-tho1', 'Thợ Lan', 'artist');
  const assist = await staff('g-w3-tho2', 'Thợ Mai', 'artist');
  const instructor = await staff('g-w3-gv', 'Cô Hằng', 'instructor');

  // Vai trò chỉ xem hợp đồng: không thấy SĐT khách, không thấy thu tiền.
  await post('/roles', { key: 'chi_xem_hd', name: 'Chỉ xem hợp đồng', permissions: ['contracts.read'] });
  const viewer = await register('g-w3-xem');
  await post('/members', { email: viewer.email, roleKeys: ['chi_xem_hd'] });

  // Điều khoản (mẫu mặc định cho cả hai loại) và nội quy khoá học.
  await post('/contract-texts', {
    kind: 'TERMS',
    appliesTo: ['SERVICE', 'COURSE'],
    name: 'Điều khoản chung',
    isDefault: true,
    body: [
      'Bên B đặt cọc theo tiến độ thanh toán để Bên A giữ lịch và thợ trang điểm.',
      'Bên B được đổi ngày một lần, báo trước ít nhất 15 ngày và còn lịch trống.',
      'Bên A có mặt đúng giờ đã ghi trong hợp đồng; Bên B chuẩn bị chỗ ngồi đủ ánh sáng.',
      'Phí di chuyển tính theo quãng đường thực tế từ studio đến địa điểm.',
      'Thanh toán phần còn lại trước khi bắt đầu trang điểm, bằng tiền mặt hoặc chuyển khoản.',
      'Mọi tranh chấp được hai bên thương lượng; không thương lượng được thì đưa ra toà án có thẩm quyền.',
    ].join('\n'),
  });
  const rules = await post('/contract-texts', { kind: 'RULES', appliesTo: ['COURSE'], name: 'Nội quy lớp', isDefault: true, body: 'Đi học đúng giờ, có mặt trước 10 phút.\nMang đủ dụng cụ cá nhân.\nKhông quay phim khi chưa được giảng viên đồng ý.' });

  // Hợp đồng dịch vụ: gói + dịch vụ phụ + thợ + dịch vụ ngoài studio có phí di chuyển; giảm 100.000.
  const serviceBody = {
    customerId: customer,
    discount: 100_000,
    notes: 'Khách đến sớm 15 phút, cần chỗ để váy cưới.',
    lines: [
      {
        kind: 'PACKAGE',
        packageId: pkg.id,
        quantity: 1,
        subjectId: subject('Cô dâu'),
        locationType: 'STUDIO',
        studioLocationId: location,
        scheduledStart: '2026-11-10T07:00:00+07:00',
        scheduledEnd: '2026-11-10T09:00:00+07:00',
        addons: [{ serviceId: addon, quantity: 1 }],
        staff: [
          { membershipId: primary, role: 'PRIMARY' },
          { membershipId: assist, role: 'ASSIST' },
        ],
      },
      {
        kind: 'SERVICE',
        serviceId: main,
        quantity: 2,
        subjectId: subject('Phù dâu'),
        locationType: 'CUSTOMER_HOME',
        address: 'Số 1 Tràng Tiền, Hà Nội',
        scheduledStart: '2026-11-10T09:30:00+07:00',
        scheduledEnd: '2026-11-10T10:30:00+07:00',
        travel: { mode: 'MANUAL', distanceKm: 12.5, amount: 150_000 },
      },
    ],
  };
  const mkService = async () => (await post('/contracts', serviceBody)).id as string;
  const installments = async (id: string, total: number) =>
    put(`/contracts/${id}/installments`, {
      installments: [
        { name: 'Đặt cọc', dueDate: '2026-11-01T00:00:00.000Z', amount: 1_000_000, isDeposit: true },
        { name: 'Còn lại', dueDate: '2026-11-10T00:00:00.000Z', amount: total - 1_000_000, isDeposit: false },
      ],
    });
  const draftService = await mkService();
  const confirmedService = await mkService();
  const totalOf = async (id: string) => (await http('GET', P(`/contracts/${id}/print-data`), owner.token)).data.money.total as number;
  await installments(draftService, await totalOf(draftService));
  await installments(confirmedService, await totalOf(confirmedService));
  await post(`/contracts/${confirmedService}/status`, { to: 'CONFIRMED' }, 200);
  await post(`/contracts/${confirmedService}/payments`, { method: 'BANK_TRANSFER', amount: 1_000_000 });

  // Hợp đồng khoá học: lớp 12 buổi, nội quy, 3 đợt, đã cọc.
  const created = await post('/courses', {
    name: 'Makeup cá nhân',
    mode: 'MULTI_CLASS',
    tuitionFee: 14_000_000,
    defaultCapacity: 20,
    sessionCount: 12,
    firstClass: { name: 'K15', startDate: '2027-02-01', endDate: '2027-04-30', weekdays: [2, 4], startTime: '18:00', endTime: '21:00', instructorMembershipId: instructor, studioLocationId: location },
  });
  const course = (await post('/contracts', { kind: 'COURSE', customerId: customer, rulesTemplateId: rules.id, lines: [{ kind: 'COURSE', courseClassId: created.classes[0].id }] })).id as string;
  await put(`/contracts/${course}/installments`, {
    installments: [
      { name: 'Đặt cọc', dueDate: '2026-12-01T00:00:00.000Z', amount: 3_000_000, isDeposit: true },
      { name: 'Đợt 1', dueDate: '2027-01-15T00:00:00.000Z', amount: 6_000_000, isDeposit: false },
      { name: 'Đợt 2', dueDate: '2027-03-01T00:00:00.000Z', amount: 5_000_000, isDeposit: false },
    ],
  });
  await post(`/contracts/${course}/status`, { to: 'CONFIRMED' }, 200);
  await post(`/contracts/${course}/payments`, { method: 'CASH', amount: 3_000_000 });

  const tpls = await http('GET', P('/print-templates?appliesTo=SERVICE'), owner.token);
  return { org, owner, viewer, customerPhone, draftService, confirmedService, course, templateModern: tpls.items[0].id, db };
}

// ---------- trình duyệt ----------

const INIT_SCRIPT = (token: string) => `
  window.__HDIN__ = { token: ${JSON.stringify(token)} };
  window.__order = [];
  window.print = () => { window.__order.push('print'); };
  const f = window.fetch.bind(window);
  window.fetch = async (...a) => {
    const r = await f(...a);
    const u = String(a[0] && a[0].url ? a[0].url : a[0]).split('?')[0];
    const m = (a[1] && a[1].method) || (a[0] && a[0].method) || 'GET';
    if (m === 'POST' && /\\/prints$/.test(u)) window.__order.push('post-' + r.status);
    return r;
  };
`;

async function newPage(who: Who, vp: { width: number; height: number }, phone: boolean): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const ctx = await browser.newContext(phone ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: vp });
  await ctx.addInitScript(INIT_SCRIPT(who.token));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}

async function openHarness(page: Page, contractId: string, extra: Record<string, string> = {}): Promise<void> {
  const q = new URLSearchParams({ org: w.org, hd: contractId, ...extra });
  await page.goto(`${base}${HARNESS}?${q.toString()}`);
}

async function done(ctx: BrowserContext, errors: string[]): Promise<void> {
  await ctx.close();
  expect(errors, 'Trang báo lỗi JavaScript').toEqual([]);
}

const PRINT_BTN = /^In \/ (Lưu )?PDF$|^In \/ PDF$/;

async function openDialog(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByText('Chọn mẫu in').waitFor({ timeout: 20_000 });
  const btn = page.getByRole('button', { name: PRINT_BTN });
  await btn.waitFor({ timeout: 20_000 }); // tên nút đổi "Đang chuẩn bị bản in…" → "In / Lưu PDF" khi phông + logo xong
  await expect.poll(() => btn.isEnabled(), { timeout: 20_000 }).toBe(true);
}

const order = (page: Page) => page.evaluate(() => (window as unknown as { __order: string[] }).__order);

async function shot(page: Page, name: string): Promise<string> {
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function pdfOf(page: Page, name: string): Promise<{ file: string; pages: number; size: string; text: string; raw: string }> {
  const file = join(OUT, `${name}.pdf`);
  writeFileSync(file, await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  const size = /Page size:\s+(.+)/.exec(info)?.[1] ?? '';
  const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
  const raw = execFileSync('pdftotext', ['-raw', file, '-'], { encoding: 'utf8' });
  execFileSync('pdftoppm', ['-png', '-r', '70', file, join(OUT, name)]);
  return { file, pages, size, text, raw };
}

const flat = (s: string) => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

async function overflow(page: Page): Promise<{ page: number; innerWidth: number; offenders: string[] }> {
  return page.evaluate(() => {
    const iw = window.innerWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.ui-dialog__head *, .hdin-aside *, .ui-dialog__foot *, .hdin-prev-cap'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > iw + 0.5 || r.left < -0.5)) offenders.push(`${el.tagName}.${el.className} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    return { page: document.documentElement.scrollWidth, innerWidth: iw, offenders: offenders.slice(0, 8) };
  });
}

async function printRows(contract: string) {
  return w.db.contractPrint.findMany({ where: { contractId: contract }, orderBy: { printNo: 'asc' }, select: { printNo: true, source: true, basedOnPrintId: true, templateVersion: true, config: true, dataHash: true, contractStatus: true } });
}

// ---------- khởi động / dọn ----------

beforeAll(async () => {
  const dbName = new URL(DB_URL).pathname.replace(/^\//, '');
  if (!/^makeup_test/.test(dbName)) throw new Error(`Từ chối: "${dbName}" không phải database thử (makeup_test…).`);
  const exe = chromium.executablePath();
  if (!existsSync(exe)) throw new Error(`Không thấy Chromium của Playwright (${exe}). Cài bằng "pnpm --filter @makeup/web exec playwright install chromium" — bài in thật không tự bỏ qua.`);
  for (const tool of ['pdfinfo', 'pdftotext', 'pdftoppm']) {
    try {
      execFileSync(tool, ['-v'], { stdio: 'ignore' });
    } catch {
      throw new Error(`Thiếu "${tool}" (poppler-utils). Cài bằng "apt-get install poppler-utils" — bài in thật không tự bỏ qua.`);
    }
  }
  mkdirSync(OUT, { recursive: true });
  apiPort = await freePort();
  apiBase = `http://127.0.0.1:${apiPort}`;
  apiProc = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: API_DIR,
    detached: true, // nhóm tiến trình riêng: dọn đúng PID của mình, không kill theo tên
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      DATABASE_URL: DB_URL,
      DIRECT_URL: DB_URL,
      JWT_ACCESS_SECRET: 'g-w3-chi-dung-cho-bai-thu-0123456789abcdef0123',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  apiProc.stdout?.on('data', (d: Buffer) => (apiLog += d.toString()));
  apiProc.stderr?.on('data', (d: Buffer) => (apiLog += d.toString()));
  await waitFor(`${apiBase}/health`, 90_000);
  vite = await createServer({
    root: WEB,
    configFile: join(WEB, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 0, strictPort: false, host: '127.0.0.1', hmr: false, proxy: { '/api': { target: apiBase, changeOrigin: false } } },
  });
  await vite.listen();
  const url = vite.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite không trả địa chỉ');
  base = url.replace(/\/$/, '');
  browser = await chromium.launch();
  w = await seedWorld();
}, 240_000);

// Dọn đúng nhóm tiến trình do bài này tạo (theo PID, không kill theo tên). Chạy cả khi đóng trình duyệt / Vite lỗi hoặc treo.
function stopApi(): void {
  if (apiProc?.pid) {
    try {
      process.kill(-apiProc.pid, 'SIGTERM');
    } catch {
      /* đã thoát */
    }
    apiProc = null;
  }
}
process.once('exit', stopApi);

afterAll(async () => {
  try {
    await browser?.close();
    await vite?.close();
    await w?.db?.$disconnect();
  } finally {
    stopApi();
  }
}, 60_000);

// ---------- các ca ----------

describe('hộp In trên máy chủ thật — hợp đồng DỊCH VỤ nháp', () => {
  it('1440: mở hộp, xem trước đúng dữ liệu thật; bấm In → POST 201 rồi mới print(); PDF đúng tờ, có BẢN NHÁP + dấu lần in; dòng nhật ký có trong database', async () => {
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    await openHarness(page, w.draftService, { 'quyen-mau': '1' });
    await openDialog(page, 'In hợp đồng');
    expect(await page.locator('article.hdin-giay').count()).toBe(1);
    expect(await page.evaluate(() => (document.querySelector('.hdin-giay img') as HTMLImageElement | null)?.naturalWidth ?? 0)).toBeGreaterThan(0); // logo thật tải được qua URL ký
    expect(await page.getByRole('radio').count()).toBeGreaterThanOrEqual(1);
    expect(await page.getByText('Mặc định').count()).toBeGreaterThanOrEqual(1);
    await shot(page, 'hop-in-dich-vu-nhap-1440');
    const inPaper = flat(await page.locator('article.hdin-giay').innerText());
    expect(inPaper).toContain('BẢN NHÁP');
    expect(inPaper).toContain('Nguyễn Thị Hoa');
    expect(inPaper).toContain('0912345678');

    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText('Đã ghi lần in thứ 1').waitFor();
    expect(await order(page)).toEqual(['post-201', 'print']);
    const rows = await printRows(w.draftService);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ printNo: 1, source: 'TEMPLATE', contractStatus: 'DRAFT' });
    expect(rows[0].config.layout).toBe(2);
    await shot(page, 'hop-in-dich-vu-nhap-da-ghi-1440');

    const est = Number(await page.locator('.hdin-pages').getAttribute('data-pages'));
    const pdf = await pdfOf(page, 'dich-vu-nhap');
    console.log(`[PDF dịch vụ nháp] ${pdf.pages} trang thật, hộp ước ${est} trang, ${pdf.size}`);
    expect(await page.locator('.hdin-pages').innerText()).toBe(`Khoảng ${est} trang A4`);
    expect(Math.abs(est - pdf.pages), `ước ${est} trang, PDF thật ${pdf.pages} trang`).toBeLessThanOrEqual(1);
    expect(pdf.size, 'khổ giấy phải là A4').toMatch(/^59[45](\.\d+)? x 84[12](\.\d+)? pts \(A4\)/);
    const t = flat(pdf.text);
    for (const must of ['Hợp đồng dịch vụ trang điểm', 'Chiến Makeup Studio', 'Nguyễn Thị Hoa', 'BẢN NHÁP', 'In lần 1', 'Vietcombank', 'Nguyễn Trọng Chiến', 'Thợ Lan', 'Dán mi', 'Phí di chuyển', 'Điều khoản']) {
      expect(t, `PDF thiếu "${must}"`).toContain(must);
    }
    for (const mustNot of ['Chọn mẫu in', 'Màn hợp đồng giả', 'Đóng', 'In / Lưu PDF', 'Giữ mẫu đã in']) expect(t, `PDF lọt giao diện "${mustNot}"`).not.toContain(mustNot);
    const data = await http('GET', `/orgs/${w.org}/contracts/${w.draftService}/print-data`, w.owner.token);
    expect(t).toContain(data.data.money.totalInWords);
    expect(data.printCount).toBe(1);
    expect(data.lastPrint.printNo).toBe(1);
    await done(ctx, errors);
  }, 120_000);

  it('390 (điện thoại): hộp toàn màn, nút "In / PDF", không tràn ngang; ảnh khung nhìn phần xem trước và phần lựa chọn', async () => {
    const { ctx, page, errors } = await newPage(w.owner, { width: 390, height: 844 }, true);
    await openHarness(page, w.draftService, { 'dien-thoai': '1' });
    await openDialog(page, 'In');
    expect(await page.getByRole('button', { name: 'In / PDF', exact: true }).count()).toBe(1);
    await shot(page, 'hop-in-dich-vu-nhap-390');
    const o1 = await overflow(page);
    expect(o1.page, `tràn ngang ở trang: ${JSON.stringify(o1)}`).toBeLessThanOrEqual(o1.innerWidth);
    expect(o1.offenders, JSON.stringify(o1.offenders)).toEqual([]);
    await page.evaluate(() => document.querySelector('.ui-dialog__body')!.scrollTo(0, 100000));
    await shot(page, 'hop-in-dich-vu-nhap-390-lua-chon');
    const o2 = await overflow(page);
    expect(o2.page).toBeLessThanOrEqual(o2.innerWidth);
    expect(o2.offenders).toEqual([]);
    // Nút In nằm trong khung nhìn (chân hộp dính đáy) kể cả khi cuộn tới cuối.
    const box = await page.getByRole('button', { name: 'In / PDF', exact: true }).boundingBox();
    expect(box && box.y + box.height <= 844 && box.x >= 0 && box.x + box.width <= 390).toBe(true);
    await done(ctx, errors);
  }, 120_000);
});

describe('hộp In trên máy chủ thật — hợp đồng KHOÁ HỌC', () => {
  it('1440: mẫu mặc định khoá học (bố cục 1, quốc hiệu); PDF có nội quy, 3 đợt; không BẢN NHÁP; nhật ký ghi', async () => {
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    await openHarness(page, w.course, { 'trang-thai': 'CONFIRMED' });
    await openDialog(page, 'In hợp đồng');
    expect(await page.locator('article.hdin-g1').count()).toBe(1);
    await shot(page, 'hop-in-khoa-hoc-1440');
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText('Đã ghi lần in thứ 1').waitFor();
    expect(await order(page)).toEqual(['post-201', 'print']);
    const rows = await printRows(w.course);
    expect(rows[0]).toMatchObject({ printNo: 1, source: 'TEMPLATE', contractStatus: 'CONFIRMED' });
    const est = Number(await page.locator('.hdin-pages').getAttribute('data-pages'));
    const pdf = await pdfOf(page, 'khoa-hoc');
    console.log(`[PDF khoá học] ${pdf.pages} trang thật, hộp ước ${est} trang, ${pdf.size}`);
    expect(Math.abs(est - pdf.pages), `ước ${est} trang, PDF thật ${pdf.pages} trang`).toBeLessThanOrEqual(1);
    const t = flat(pdf.text);
    for (const must of ['CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'HỢP ĐỒNG ĐÀO TẠO', 'Makeup cá nhân', 'K15', 'Cô Hằng', 'Đặt cọc', 'Đợt 2', 'Nội quy', 'Đi học đúng giờ', 'In lần 1']) {
      expect(t, `PDF khoá học thiếu "${must}"`).toContain(must);
    }
    expect(t).not.toContain('BẢN NHÁP');
    for (const mustNot of ['Chọn mẫu in', 'Màn hợp đồng giả', 'In / Lưu PDF']) expect(t).not.toContain(mustNot);
    await done(ctx, errors);
  }, 120_000);

  it('390: hộp khoá học không tràn ngang', async () => {
    const { ctx, page, errors } = await newPage(w.owner, { width: 390, height: 844 }, true);
    await openHarness(page, w.course, { 'trang-thai': 'CONFIRMED', 'dien-thoai': '1' });
    await openDialog(page, 'In');
    await shot(page, 'hop-in-khoa-hoc-390');
    const o = await overflow(page);
    expect(o.page, JSON.stringify(o)).toBeLessThanOrEqual(o.innerWidth);
    expect(o.offenders).toEqual([]);
    await done(ctx, errors);
  }, 120_000);
});

describe('hộp In trên máy chủ thật — dữ liệu đổi, giữ mẫu đã in, in lại y hệt, hợp đồng huỷ', () => {
  let thirdBody = '';

  it('hợp đồng đã xác nhận in lần 1 theo mẫu mặc định → nhật ký 1; PDF lần 1 không BẢN NHÁP', async () => {
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    await openHarness(page, w.confirmedService, { 'trang-thai': 'CONFIRMED' });
    await openDialog(page, 'In hợp đồng');
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText('Đã ghi lần in thứ 1').waitFor();
    const pdf = await pdfOf(page, 'dich-vu-xac-nhan-lan-1');
    expect(flat(pdf.text)).not.toContain('Ký nháy'); // mẫu hiện đại tắt sẵn ký nháy
    expect(flat(pdf.text)).not.toContain('BẢN NHÁP');
    const rows = await printRows(w.confirmedService);
    expect(rows.map((r: { printNo: number; source: string }) => [r.printNo, r.source])).toEqual([[1, 'TEMPLATE']]);
    await done(ctx, errors);
  }, 120_000);

  it('409 DATA_CHANGED thật: chọn mẫu + bật ký nháy, dữ liệu đổi khi hộp đang mở → bấm In không in, hiện lời + thay đổi; công tắc vẫn giữ; bấm lại thì ghi và in', async () => {
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    await openHarness(page, w.confirmedService, { 'trang-thai': 'CONFIRMED' });
    await openDialog(page, 'In hợp đồng');
    // Mở hộp sau lần 1, dữ liệu không đổi → chọn sẵn "in lại y hệt". Chuyển sang in theo MẪU để dùng dữ liệu hiện tại.
    expect(await page.getByRole('radio', { name: /Giữ mẫu đã in/ }).isChecked()).toBe(true);
    await page.getByRole('radio', { name: /^Hiện đại · bản v1/ }).check();
    await page.getByRole('switch', { name: 'Ô ký nháy cuối mỗi trang' }).click();
    // Giữa lúc hộp mở, người khác thu thêm 2.000.000 ₫.
    await http('POST', `/orgs/${w.org}/contracts/${w.confirmedService}/payments`, w.owner.token, { method: 'CASH', amount: 2_000_000 }, 201);
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText(/Hợp đồng vừa thay đổi — đã tải dữ liệu mới/).waitFor();
    expect(await order(page)).toEqual(['post-409']);
    expect(await page.getByText('Đã thu thêm 2.000.000 ₫').count()).toBeGreaterThan(0);
    expect(await page.getByText(/Bản xem trước đã được làm mới/).count()).toBe(1);
    expect((await printRows(w.confirmedService)).length).toBe(1); // 409: KHÔNG ghi gì
    expect(await page.getByRole('switch', { name: 'Ô ký nháy cuối mỗi trang' }).getAttribute('aria-checked')).toBe('true');
    await shot(page, 'hop-in-409-du-lieu-doi-1440');
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText(/Đã ghi lần in thứ 2/).waitFor();
    expect(await order(page)).toEqual(['post-409', 'post-201', 'print']);
    const rows = await printRows(w.confirmedService);
    expect(rows.length).toBe(2);
    expect(rows[1]).toMatchObject({ printNo: 2, source: 'TEMPLATE' });
    expect(rows[1].config.blocks['ky-nhay']).toBe(true);
    await done(ctx, errors);
  }, 120_000);

  it('đổi mẫu sau lần in (bố cục 2 → 4, v2) rồi mở lại: chọn sẵn "Giữ mẫu đã in" (PRIOR_CONFIG), nhắc "Đã sửa từ v1 lên v2"; in theo cấu hình CŨ (bố cục 2)', async () => {
    await http('PATCH', `/orgs/${w.org}/print-templates/${w.templateModern}`, w.owner.token, { layout: 4 }, 200);
    // Dữ liệu cũng đổi so với lần in gần nhất (lần 2 đã gồm khoản thu 2.000.000 ₫): thu thêm để dữ liệu KHÁC lần gần nhất.
    await http('POST', `/orgs/${w.org}/contracts/${w.confirmedService}/payments`, w.owner.token, { method: 'CASH', amount: 500_000 }, 201);
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    await openHarness(page, w.confirmedService, { 'trang-thai': 'CONFIRMED' });
    await openDialog(page, 'In hợp đồng');
    expect(await page.getByRole('radio', { name: /Giữ mẫu đã in/ }).isChecked()).toBe(true);
    expect(await page.getByText('Đã sửa từ v1 lên v2 sau lần in trước').count()).toBe(1);
    expect(await page.getByText('Đã thu thêm 500.000 ₫').count()).toBeGreaterThan(0);
    expect(await page.locator('article.hdin-g2').count()).toBe(1); // cấu hình cũ (bố cục 2) dù mẫu nay là bố cục 4
    expect(await page.getByRole('switch', { name: 'In lại y hệt bản đã in' }).getAttribute('aria-checked')).toBe('false');
    await shot(page, 'hop-in-giu-mau-da-in-1440');
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText('Đã ghi lần in thứ 3').waitFor();
    const rows = await printRows(w.confirmedService);
    expect(rows[2]).toMatchObject({ printNo: 3, source: 'PRIOR_CONFIG', templateVersion: 1 });
    expect(rows[2].config.layout).toBe(2);
    const pdf = await pdfOf(page, 'dich-vu-xac-nhan-lan-3-giu-cau-hinh');
    thirdBody = bodyText(pdf.text);
    expect(flat(pdf.text)).toContain('Ký nháy'); // cấu hình lần 1 đã bật ký nháy — giữ nguyên
    await done(ctx, errors);
  }, 120_000);

  it('"In lại y hệt bản đã in": REPRINT ghi lần 4, PDF có dữ liệu CŨ (thân giống hệt lần 3), khác bản in theo dữ liệu mới ở số đã thu', async () => {
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    // Hộp mở sau lần 3: dữ liệu KHÔNG đổi so với lần 3 → chọn sẵn REPRINT. Muốn thấy công tắc phải đổi dữ liệu trước.
    await http('POST', `/orgs/${w.org}/contracts/${w.confirmedService}/payments`, w.owner.token, { method: 'CASH', amount: 100_000 }, 201);
    await openHarness(page, w.confirmedService, { 'trang-thai': 'CONFIRMED' });
    await openDialog(page, 'In hợp đồng');
    const toggle = page.getByRole('switch', { name: 'In lại y hệt bản đã in' });
    await toggle.click();
    expect(await toggle.getAttribute('aria-checked')).toBe('true');
    expect(await page.getByText('Chỉ cho lần in này').count()).toBe(0); // REPRINT: ẩn công tắc nhanh
    await shot(page, 'hop-in-lai-y-het-1440');
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText('Đã ghi lần in thứ 4').waitFor();
    const rows = await printRows(w.confirmedService);
    expect(rows[3]).toMatchObject({ printNo: 4, source: 'REPRINT' });
    expect(rows[3].dataHash).toBe(rows[2].dataHash); // dữ liệu chụp y hệt lần gốc
    const pdf = await pdfOf(page, 'dich-vu-xac-nhan-lan-4-in-lai');
    expect(flat(pdf.text)).toContain('In lại bản lần 3');
    // Số liệu trên PDF in lại = dữ liệu lúc in lần 3 (thu 3.500.000 ₫), không có khoản 100.000 ₫ mới thu.
    const cur = await http('GET', `/orgs/${w.org}/contracts/${w.confirmedService}/print-data`, w.owner.token);
    expect(cur.data.payments.paid).toBe(3_600_000);
    expect(flat(pdf.text)).toContain('3.500.000');
    expect(flat(pdf.text)).not.toContain('3.600.000');
    // "Y hệt": thân bản in lại (bỏ dòng chân trang) giống bản in lần 3, dù dữ liệu hiện tại đã khác.
    expect(thirdBody.length).toBeGreaterThan(200);
    expect(bodyText(pdf.text)).toBe(thirdBody);
    await done(ctx, errors);
  }, 120_000);

  it('409 CONTRACT_CANCELLED thật: hợp đồng bị huỷ khi hộp đang mở → lời tiếng Việt, không in, nút tắt', async () => {
    const id = (await http('POST', `/orgs/${w.org}/contracts`, w.owner.token, { customerId: (await http('GET', `/orgs/${w.org}/contracts/${w.draftService}`, w.owner.token)).customer.id, lines: [{ kind: 'CUSTOM', name: 'Dịch vụ thử huỷ', unitPrice: 100_000, quantity: 1 }] }, 201)).id as string;
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    await openHarness(page, id);
    await openDialog(page, 'In hợp đồng');
    await http('POST', `/orgs/${w.org}/contracts/${id}/status`, w.owner.token, { to: 'CANCELLED', reason: 'Khách huỷ lịch (bài thử)' }, 200);
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText(/Hợp đồng đã huỷ nên không có bản in/).waitFor();
    expect(await order(page)).toEqual(['post-409']);
    expect(await page.getByRole('button', { name: PRINT_BTN }).isDisabled()).toBe(true);
    expect((await printRows(id)).length).toBe(0);
    await shot(page, 'hop-in-409-da-huy-1440');
    await done(ctx, errors);
  }, 120_000);

  it('hợp đồng đã huỷ từ đầu: nút In ở màn tắt + chú thích', async () => {
    const id = (await http('POST', `/orgs/${w.org}/contracts`, w.owner.token, { customerId: (await http('GET', `/orgs/${w.org}/contracts/${w.draftService}`, w.owner.token)).customer.id, lines: [{ kind: 'CUSTOM', name: 'Dịch vụ đã huỷ', unitPrice: 100_000, quantity: 1 }] }, 201)).id as string;
    await http('POST', `/orgs/${w.org}/contracts/${id}/status`, w.owner.token, { to: 'CANCELLED', reason: 'Khách huỷ lịch (bài thử)' }, 200);
    const { ctx, page, errors } = await newPage(w.owner, { width: 1440, height: 900 }, false);
    await openHarness(page, id, { 'trang-thai': 'CANCELLED' });
    const b = page.getByRole('button', { name: 'In hợp đồng', exact: true });
    await b.waitFor();
    expect(await b.isDisabled()).toBe(true);
    expect(await page.getByText('Hợp đồng đã huỷ — không in').count()).toBeGreaterThan(0);
    await done(ctx, errors);
  }, 60_000);
});

describe('hộp In trên máy chủ thật — người chỉ có quyền xem hợp đồng (máy chủ che)', () => {
  it('tờ in "……" thay SĐT, không tiến độ / phiếu thu; PDF không chứa SĐT khách; cảnh báo hiện ra', async () => {
    const { ctx, page, errors } = await newPage(w.viewer, { width: 1440, height: 900 }, false);
    await openHarness(page, w.confirmedService, { 'trang-thai': 'CONFIRMED' });
    await openDialog(page, 'In hợp đồng');
    const paper = flat(await page.locator('article.hdin-giay').innerText());
    expect(paper).toContain('……');
    expect(paper).not.toContain(w.customerPhone);
    expect(paper).not.toContain('Tiến độ thanh toán');
    expect(await page.getByText(/không có quyền xem SĐT và email khách/).count()).toBeGreaterThan(0);
    expect(await page.getByText(/không có quyền xem thu tiền/).count()).toBeGreaterThan(0);
    await shot(page, 'hop-in-nguoi-chi-xem-1440');
    await page.getByRole('button', { name: PRINT_BTN }).click();
    await page.getByText(/Đã ghi lần in thứ/).waitFor();
    const pdf = await pdfOf(page, 'dich-vu-nguoi-chi-xem');
    const t = flat(pdf.text);
    expect(t).not.toContain(w.customerPhone);
    expect(t).not.toContain('Tiến độ thanh toán');
    expect(t).not.toContain('hoa@thu.local');
    expect(t).toContain('Nguyễn Thị Hoa');
    // Nhật ký lưu bản đã che theo người in.
    const last = await w.db.contractPrint.findFirst({ where: { contractId: w.confirmedService }, orderBy: { printNo: 'desc' }, select: { data: true, printedById: true } });
    expect(last.printedById).toBe(w.viewer.id);
    expect(JSON.stringify(last.data)).not.toContain(w.customerPhone);
    await done(ctx, errors);
  }, 120_000);
});

// Thân bản in = chữ PDF bỏ các dòng chân trang (số trang, dấu lần in, ký nháy).
function bodyText(s: string): string {
  return flat(
    s
      .split('\n')
      .filter((ln) => !/Trang \d+\s*\/\s*\d+|Ký nháy|In lần|In lại|HĐ/.test(ln))
      .join('\n'),
  );
}
