// E2E cổng học viên /hv với MÁY CHỦ THẬT (bản vẽ E mục 6.4, gói W2): gieo dữ liệu bằng đường API thật của trung tâm
// (khoá học, lớp, đưa buổi học lên Lịch, hợp đồng, nội quy, phiếu thu, tạo đường dẫn bằng đường E4
// POST …/customers/:id/portal/links) + vài dòng Prisma cho thứ chưa có đường API (hồ sơ trung tâm, toạ độ, thẻ ảnh).
//
// Chạy (database thử riêng, nâng trần lượt mở cổng vì bài mở cổng nhiều lần từ cùng một IP):
//   E2E_DATABASE_URL=postgresql://…/makeup_test_e_w2 PORTAL_RATE_LIMIT_PER_MINUTE=1000 E2E_ANH_DIR=e2e/anh \
//     pnpm exec playwright test e2e/cong-hoc-vien.spec.ts
// Ảnh: <E2E_ANH_DIR>/cong-hoc-vien-<màn>-<390|1440>.png, chụp khung nhìn (fullPage: false).
import { createRequire } from 'node:module';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, request as pwRequest, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PORTAL_DENIED_MESSAGE } from '@makeup/shared';
import { SHOTS } from './anh';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://makeup:makeup_local@localhost:5432/makeup_test_web';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// Prisma của máy chủ (apps/api) — web không phụ thuộc @prisma/client.
const apiRequire = createRequire(new URL('../../api/package.json', import.meta.url));
const { PrismaClient } = apiRequire('@prisma/client') as { PrismaClient: new (o: unknown) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ datasources: { db: { url: DB } } });

const iso = (d: Date) => d.toISOString();
const dayOffset = (n: number) => new Date(Date.now() + n * 86_400_000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

interface Seed {
  orgId: string;
  customerId: string;
  last4: string;
  wrong4: string;
  ownerToken: string;
  secret: string;
  hiddenTitle: string;
  api: APIRequestContext;
}
let seed: Seed;

async function ok<T = any>(res: Awaited<ReturnType<APIRequestContext['post']>>, status: number, what: string): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (res.status() !== status) throw new Error(`${what}: mong ${status}, nhận ${res.status()} ${await res.text()}`);
  return (res.status() === 204 ? null : await res.json()) as T;
}

async function newLink(): Promise<string> {
  const res = await seed.api.post(`/api/v1/orgs/${seed.orgId}/customers/${seed.customerId}/portal/links`, {
    headers: { authorization: `Bearer ${seed.ownerToken}` },
    data: { phoneConfirmed: true },
  });
  const body = await ok<{ key: string }>(res, 201, 'tạo đường dẫn cổng (E4)');
  return body.key;
}

// Ảnh thẻ thật (PNG) dựng bằng Chromium rồi ghi vào kho tệp của máy chủ dev (os.tmpdir()/makeup-files-development).
async function renderCardPng(browser: Browser, file: string, title: string, subtitle: string, hue: number): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(
    `<body style="margin:0;width:540px;height:675px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
      background:linear-gradient(160deg,hsl(${hue} 70% 94%),hsl(${hue} 60% 82%));font-family:'Be Vietnam Pro',Arial,sans-serif;color:hsl(${hue} 50% 24%);text-align:center">
      <div style="font-size:15px;letter-spacing:4px">CHIẾN MAKEUP ACADEMY</div>
      <div style="font-size:44px;font-weight:700;padding:0 40px;line-height:1.15">${title}</div>
      <div style="font-size:20px">${subtitle}</div></body>`,
  );
  mkdirSync(path.dirname(file), { recursive: true });
  const png = await page.screenshot({ type: 'png' }); // buffer, ghi vào kho tệp của máy chủ (không phải ảnh tài liệu)
  writeFileSync(file, png);
  await ctx.close();
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  const api = await pwRequest.newContext({ baseURL: API });
  const stamp = Date.now();
  const secret = `BI-MAT-${randomUUID()}`;
  const register = async (label: string) => {
    const email = `cong-${label}-${stamp}@thu.local`;
    const res = await api.post('/api/v1/auth/register', { data: { email, password: 'mat-khau-thu-123', fullName: `Người thử ${label}` } });
    const body = await ok<{ accessToken: string; user: { id: string } }>(res, 201, 'đăng ký');
    return { email, token: body.accessToken, id: body.user.id };
  };
  const owner = await register('chu');
  const teacher = await register('gv');
  const auth = { authorization: `Bearer ${owner.token}` };
  const post = async <T = any>(url: string, data: unknown, status = 201): Promise<T> => ok<T>(await api.post(url, { headers: { ...auth, 'idempotency-key': randomUUID() }, data: data as object }), status, url); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Trung tâm đào tạo (ACADEMY) + gói không giới hạn + hồ sơ thương hiệu.
  const org = await ok<{ id: string }>(
    await api.post('/api/v1/orgs', { headers: auth, data: { name: `Chiến Makeup Academy ${stamp}`, slug: `chien-academy-${stamp}`, kind: 'ACADEMY' } }),
    201,
    'tạo tổ chức',
  );
  const orgId = org.id;
  const plan = await db.subscriptionPlan.create({ data: { code: `cgv_${stamp}`, name: 'Gói thử không giới hạn', priceMonthly: 0n, features: [] } });
  await db.organizationSubscription.create({ data: { organizationId: orgId, planId: plan.id, startsAt: dayOffset(-1), endsAt: null, status: 'ACTIVE' } });
  await db.organizationProfile.create({
    data: { organizationId: orgId, brandName: 'Chiến Makeup Academy', phone: '0281234567', zalo: '0909000111', address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', email: `${secret}@noi-bo.local` },
  });
  const api2 = `/api/v1/orgs/${orgId}`;

  // Giảng viên (SĐT riêng, học viên không được thấy) + địa điểm có toạ độ.
  const memberRes = await post<{ id: string }>(`${api2}/members`, { email: teacher.email, roleKeys: ['instructor'] });
  await db.staffProfile.upsert({
    where: { membershipId: memberRes.id },
    create: { membershipId: memberRes.id, organizationId: orgId, displayName: 'Nguyễn Thu Hà', phone: '0911222333' },
    update: { displayName: 'Nguyễn Thu Hà', phone: '0911222333' },
  });
  const loc = await post<{ id: string }>(`${api2}/studio-locations`, { name: 'Cơ sở Cầu Giấy', address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội' });
  await db.studioLocation.update({ where: { id: loc.id }, data: { latitude: 21.046, longitude: 105.797 } });

  // Khoá 12 buổi, học phí 14 triệu; lớp học 3 buổi/tuần quanh hôm nay (để có buổi đã qua và buổi sắp tới).
  const course = await post<{ course: { id: string } }>(`${api2}/courses`, {
    name: 'Makeup chuyên nghiệp',
    mode: 'MULTI_CLASS',
    tuitionFee: 14_000_000,
    depositAmount: 3_000_000,
    defaultCapacity: 20,
    sessionCount: 12,
  });
  const today = new Date();
  const wd = (n: number) => ((today.getUTCDay() + 6 + n) % 7) + 1; // thứ ISO của hôm nay + n ngày
  const klass = await post<{ id: string }>(`${api2}/courses/${course.course.id}/classes`, {
    name: 'Lớp K12',
    startDate: ymd(dayOffset(-12)),
    endDate: ymd(dayOffset(30)),
    weekdays: [...new Set([wd(0), wd(2), wd(4)])].sort((a, b) => a - b),
    startTime: '18:00',
    endTime: '22:00',
    instructorMembershipId: memberRes.id,
    studioLocationId: loc.id,
  });
  await post(`${api2}/classes/${klass.id}/sessions/sync`, { dryRun: false }, 200);

  // Nội quy mẫu (hợp đồng chụp bản lúc xác nhận) + số tài khoản của cổng.
  await post(`${api2}/contract-texts`, {
    kind: 'RULES',
    appliesTo: ['COURSE'],
    name: 'Nội quy lớp',
    body: 'Đi học đúng giờ, có mặt trước 10 phút.\nMang đủ dụng cụ cá nhân theo danh mục.\nKhông quay phim, chụp ảnh khi chưa được giảng viên đồng ý.',
    isDefault: true,
  });
  await ok(
    await api.put(`${api2}/portal-settings`, { headers: auth, data: { bankName: 'Vietcombank', bankAccountNo: '0123456789', bankAccountName: 'CONG TY MAKEUP ACADEMY' } }),
    200,
    'cài đặt cổng',
  );

  // Học viên (SĐT có 4 số cuối 3321) → hợp đồng khoá học xác nhận → tiến độ 3 đợt → 2 phiếu thu (8 triệu).
  const last4 = '3321';
  const cust = await db.customer.create({ data: { organizationId: orgId, fullName: 'Tôn Nữ Phương Thảo', phone: `091233${last4}`, note: `${secret}-ghi-chu-khach` } });
  const contract = await post<{ id: string }>(`${api2}/contracts`, { kind: 'COURSE', customerId: cust.id, lines: [{ kind: 'COURSE', courseClassId: klass.id }], notes: `${secret}-ghi-chu-hd` });
  await post(`${api2}/contracts/${contract.id}/status`, { to: 'CONFIRMED' }, 200);
  await ok(
    await api.put(`${api2}/contracts/${contract.id}/installments`, {
      headers: auth,
      data: {
        installments: [
          { name: 'Đặt cọc', dueDate: iso(dayOffset(-20)), amount: 3_000_000, isDeposit: true },
          { name: 'Đợt 1', dueDate: iso(dayOffset(-7)), amount: 6_000_000, isDeposit: false },
          { name: 'Đợt 2', dueDate: iso(dayOffset(14)), amount: 5_000_000, isDeposit: false },
        ],
      },
    }),
    200,
    'tiến độ đóng tiền',
  );
  await post(`${api2}/contracts/${contract.id}/payments`, { method: 'BANK_TRANSFER', amount: 3_000_000, note: `${secret}-phieu-1` });
  await post(`${api2}/contracts/${contract.id}/payments`, { method: 'CASH', amount: 5_000_000, note: `${secret}-phieu-2` });

  // Hai thẻ ảnh thật: Chào mừng (hiện) + Feedback bị trung tâm ẩn (portalVisible = false → học viên không thấy).
  const storeRoot = path.join(os.tmpdir(), 'makeup-files-development');
  const hiddenTitle = 'ẢNH-FEEDBACK-BỊ-ẨN';
  for (const c of [
    { kind: 'WELCOME', visible: true, title: 'Chào mừng Phương Thảo', sub: 'đến với lớp Makeup chuyên nghiệp K12', hue: 340 },
    { kind: 'FEEDBACK', visible: false, title: hiddenTitle, sub: 'thẻ này trung tâm đã ẩn', hue: 170 },
  ] as const) {
    const key = `org/${orgId}/design-card/${randomUUID()}.png`;
    await renderCardPng(browser, path.join(storeRoot, key), c.title, c.sub, c.hue);
    const file = await db.storedFile.create({
      data: { organizationId: orgId, purpose: 'DESIGN_CARD', storageKey: key, originalName: `${c.kind}.png`, mimeType: 'image/png', sizeBytes: BigInt(statSync(path.join(storeRoot, key)).size), width: 1080, height: 1350, status: 'READY', createdById: owner.id },
    });
    await db.designCard.create({
      data: {
        organizationId: orgId, kind: c.kind, templateCode: 'shd-01', templateVersion: 1, contractId: contract.id, customerId: cust.id, courseClassId: klass.id,
        title: c.title, body: c.kind === 'FEEDBACK' ? `${c.sub}` : null, size: '1080x1350', snapshot: { secret: `${secret}-snapshot` }, outputFileId: file.id, createdById: owner.id, portalVisible: c.visible,
      },
    });
  }

  seed = { orgId, customerId: cust.id, last4, wrong4: '5678', ownerToken: owner.token, secret, hiddenTitle, api };
});

test.afterAll(async () => {
  await db.$disconnect();
  await seed?.api.dispose();
});

// ---------- tiện ích trang ----------
const shot = (page: Page, name: string, vp: number) => page.screenshot({ path: `${SHOTS}/cong-hoc-vien-${name}-${vp}.png`, fullPage: false });

async function newMobile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_SAFARI, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
}
async function newDesktop(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: 1440, height: 900 } });
}

async function typeLast4(page: Page, digits: string) {
  await page.getByLabel('Số thứ 1 trong 4 số cuối').click();
  await page.keyboard.type(digits);
}

async function noHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
  expect(o.sw, `tràn ngang: scrollWidth ${o.sw} > clientWidth ${o.cw}`).toBeLessThanOrEqual(o.cw);
  expect(o.bw).toBeLessThanOrEqual(o.cw);
}

async function scrollToSection(page: Page, id: string) {
  await page.evaluate((i) => {
    const el = document.getElementById(i);
    if (!el) throw new Error(`không có mục #${i}`);
    el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
  }, id);
  await page.waitForTimeout(150);
}

for (const vp of [390, 1440] as const) {
  test(`luồng cổng ${vp}: nhập 4 số → sai (một lời chung) → mở → trang chính → hướng dẫn cài → thoát khỏi máy này`, async ({ browser }) => {
    test.setTimeout(120_000);
    const key = await newLink();
    const ctx = vp === 390 ? await newMobile(browser) : await newDesktop(browser);
    const page = await ctx.newPage();

    // Mọi yêu cầu API của cổng: X-Client: portal, không có Authorization, không đụng đường nhân viên.
    const apiCalls: { url: string; method: string; headers: Record<string, string> }[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/api/')) apiCalls.push({ url: u.pathname, method: r.method(), headers: r.headers() });
    });

    await page.goto(`/hv#k=${key}`);
    await expect(page.getByRole('heading', { name: 'Mở trang học viên' })).toBeVisible();
    await expect(page.getByText('Nhập sai nhiều lần, đường dẫn sẽ bị khoá.')).toBeVisible();
    await expect(page.getByText(/Nhớ máy này/)).toHaveCount(0);
    await noHorizontalOverflow(page);
    await shot(page, 'nhap-4-so', vp);

    // Sai 4 số: ĐÚNG MỘT lời chung, 4 ô được xoá, không "còn N lần", không màn khoá riêng.
    await typeLast4(page, seed.wrong4);
    await page.getByRole('button', { name: 'Mở trang của tôi' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText(PORTAL_DENIED_MESSAGE);
    await expect(page.getByText(PORTAL_DENIED_MESSAGE)).toHaveCount(1);
    expect(await page.locator('body').innerText()).not.toMatch(/còn\s+\d+\s+lần/i);
    await expect(page.getByLabel('Số thứ 1 trong 4 số cuối')).toHaveValue('');
    expect(page.url()).toContain('#k='); // chưa mở được thì giữ chìa
    await noHorizontalOverflow(page);
    await shot(page, 'sai-4-so', vp);

    // Đúng 4 số → trang chính; chìa biến khỏi địa chỉ.
    await typeLast4(page, seed.last4);
    await page.getByRole('button', { name: 'Mở trang của tôi' }).click();
    await expect(page.getByRole('heading', { name: 'Chào Thảo' })).toBeVisible();
    expect(page.url()).not.toContain('#k=');
    expect(page.url()).not.toContain(key);
    await expect(page).toHaveTitle('Chiến Makeup Academy');
    expect(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content')).toBe('Chiến Makeup Academy');
    await expect(page.getByText('Chiến Makeup Academy').first()).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, 'mo-cong-thanh-cong', vp);

    // Trang chính: lịch học, tiền, thẻ — dữ liệu từ máy chủ thật.
    const body = page.locator('main');
    await expect(page.getByRole('heading', { name: 'Buổi học tới' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Buổi học tới' })).toContainText('Giảng viên Nguyễn Thu Hà');
    await expect(page.getByRole('region', { name: 'Buổi học tới' })).toContainText('Cơ sở Cầu Giấy');
    await expect(page.getByRole('region', { name: 'Buổi học tới' }).getByRole('link', { name: /Chỉ đường/ })).toHaveAttribute('href', /destination=21\.046,105\.797/);
    const fee = page.getByRole('region', { name: /^Học phí/ });
    await expect(fee).toContainText('14.000.000 ₫');
    await expect(fee).toContainText('8.000.000 ₫');
    await expect(fee).toContainText('6.000.000 ₫');
    await expect(fee.getByRole('note')).toContainText('Đợt 1 còn thiếu 1.000.000 ₫');
    await expect(page.getByRole('region', { name: 'Tiến độ đóng tiền' })).toContainText('Đặt cọc');
    await expect(page.getByRole('region', { name: 'Đã đóng' })).toContainText('5.000.000 ₫');
    const bank = page.getByRole('region', { name: 'Cách đóng tiền' });
    await expect(bank).toContainText('Vietcombank');
    await expect(bank).toContainText('0123456789');
    await expect(bank).toContainText('HDKH-');
    await expect(page.getByRole('region', { name: 'Nội quy' })).toContainText('Đi học đúng giờ');
    const photos = page.getByRole('region', { name: 'Ảnh của tôi' });
    await expect(photos.getByRole('img')).toHaveCount(1); // thẻ bị ẩn (portalVisible=false) không hiện
    await expect(photos.getByRole('img')).toHaveAttribute('alt', 'Thẻ chào mừng');
    expect(await body.innerText()).not.toContain(seed.hiddenTitle);
    // Ảnh thật tải được (kho tệp ký URL): có kích thước tự nhiên > 0.
    await expect.poll(async () => photos.getByRole('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    // Không lộ: SĐT giảng viên, ghi chú nội bộ, UUID.
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('0911222333');
    expect(text).not.toContain(seed.secret);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    await noHorizontalOverflow(page);
    await shot(page, 'trang-chinh', vp);
    await scrollToSection(page, 'hoc-phi');
    await noHorizontalOverflow(page);
    await shot(page, 'hoc-phi', vp);
    await scrollToSection(page, 'lich-hoc');
    await expect(page.getByRole('list', { name: 'Từng buổi học' })).toBeVisible();
    await noHorizontalOverflow(page);
    await shot(page, 'lich-hoc', vp);
    await scrollToSection(page, 'anh');
    await shot(page, 'anh-cua-toi', vp);

    // Thẻ cookie: HttpOnly, chỉ ở /api/v1/portal; kho trình duyệt trống.
    const cookie = (await ctx.cookies()).find((c) => c.name === 'mp_portal');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
    expect(cookie?.path).toBe('/api/v1/portal');
    expect(await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length }))).toEqual({ l: 0, s: 0 });
    expect(await page.evaluate(() => document.cookie)).not.toContain('mp_portal');

    // Hướng dẫn cài lên màn hình chính (iPhone: các bước Safari; có nút lấy mã chuyển sang app).
    await scrollToSection(page, 'cai-app');
    const guide = page.getByRole('region', { name: 'Cài lên màn hình chính' });
    await expect(guide.getByText('Mở trang bằng Safari')).toBeVisible();
    await expect(guide.getByRole('button', { name: 'Lấy mã chuyển sang app' })).toBeVisible();
    if (vp === 390) {
      await guide.getByRole('button', { name: 'Lấy mã chuyển sang app' }).click();
      await expect(guide.getByRole('status')).toContainText(/[A-Z2-9]{4}-[A-Z2-9]{4}/);
    }
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(150);
    await noHorizontalOverflow(page);
    await shot(page, 'huong-dan-cai', vp);

    // Tải lại: còn phiên nhờ cookie, KHÔNG gọi POST /portal/session lần nữa.
    const before = apiCalls.filter((c) => c.method === 'POST' && c.url === '/api/v1/portal/session').length;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Chào Thảo' })).toBeVisible();
    expect(apiCalls.filter((c) => c.method === 'POST' && c.url === '/api/v1/portal/session').length).toBe(before);

    // Thoát khỏi máy này: hỏi lại → đã thoát → tải lại vẫn chưa có phiên.
    await page.getByRole('button', { name: 'Thoát khỏi máy này' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Thoát khỏi máy này' }).click();
    await expect(page.getByTestId('notice')).toHaveText('Đã thoát khỏi máy này.');
    await expect(page.getByText('Mở trang học viên bằng đường dẫn trung tâm gửi qua Zalo.')).toBeVisible();
    await noHorizontalOverflow(page);
    await shot(page, 'da-thoat', vp);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Chưa mở trang' })).toBeVisible();
    await expect(page.getByTestId('notice')).toHaveCount(0);
    expect((await ctx.cookies()).find((c) => c.name === 'mp_portal')).toBeUndefined();
    // Cùng phiên cũ sau khi thoát: máy chủ từ chối (thẻ đã thu hồi).
    expect((await page.request.get('/api/v1/portal/me', { headers: { 'x-client': 'portal' } })).status()).toBe(401);

    // Mọi yêu cầu API của trang: đường cổng, X-Client: portal, không Authorization.
    expect(apiCalls.length).toBeGreaterThan(4);
    for (const c of apiCalls.filter((x) => !x.url.startsWith('/api/v1/files/'))) {
      expect(c.url.startsWith('/api/v1/portal/'), c.url).toBe(true);
      expect(c.headers['x-client']).toBe('portal');
      expect(Object.keys(c.headers)).not.toContain('authorization');
    }
    await ctx.close();
  });
}

test('mã chuyển sang app: máy mới nhận phiên bằng mã (không tốn suất), vào đúng trang của học viên', async ({ browser }) => {
  const key = await newLink();
  const a = await newMobile(browser);
  const pa = await a.newPage();
  await pa.goto(`/hv#k=${key}`);
  await typeLast4(pa, seed.last4);
  await pa.getByRole('button', { name: 'Mở trang của tôi' }).click();
  await expect(pa.getByRole('heading', { name: 'Chào Thảo' })).toBeVisible();
  await pa.getByRole('button', { name: 'Lấy mã chuyển sang app' }).click();
  const code = (await pa.getByRole('status').filter({ hasText: /[A-Z2-9]{4}-[A-Z2-9]{4}/ }).locator('strong').innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // "App vừa cài" = trình duyệt mới, chưa có cookie: nhập mã.
  const b = await newMobile(browser);
  const pb = await b.newPage();
  await pb.goto('/hv');
  await expect(pb.getByRole('heading', { name: 'Chưa mở trang' })).toBeVisible();
  await pb.getByRole('button', { name: 'Tôi có mã chuyển sang app' }).click();
  await pb.getByLabel(/Mã chuyển sang app/).fill('SAISAI99');
  await pb.getByRole('button', { name: 'Nhận trang trên app' }).click();
  await expect(pb.getByRole('alert')).toHaveText(PORTAL_DENIED_MESSAGE); // mã sai: cùng một lời chung
  await pb.getByLabel(/Mã chuyển sang app/).fill(code.toLowerCase());
  await pb.getByRole('button', { name: 'Nhận trang trên app' }).click();
  await expect(pb.getByRole('heading', { name: 'Chào Thảo' })).toBeVisible();
  // Mã dùng một lần: máy thứ ba dùng lại mã → bị từ chối.
  const c = await newMobile(browser);
  const pc = await c.newPage();
  await pc.goto('/hv');
  await pc.getByRole('button', { name: 'Tôi có mã chuyển sang app' }).click();
  await pc.getByLabel(/Mã chuyển sang app/).fill(code);
  await pc.getByRole('button', { name: 'Nhận trang trên app' }).click();
  await expect(pc.getByRole('alert')).toHaveText(PORTAL_DENIED_MESSAGE);
  await a.close();
  await b.close();
  await c.close();
});

test('chìa không có thật: cũng chỉ một lời chung (không phân biệt lý do)', async ({ browser }) => {
  const ctx = await newMobile(browser);
  const page = await ctx.newPage();
  await page.goto('/hv#k=chia-khong-ton-tai-0123456789012345678901234567');
  await typeLast4(page, '0000');
  await page.getByRole('button', { name: 'Mở trang của tôi' }).click();
  await expect(page.getByRole('alert')).toHaveText(PORTAL_DENIED_MESSAGE);
  await ctx.close();
});

test('vào /hv không chìa, không phiên: "Chưa mở trang", không tràn ngang ở 390', async ({ browser }) => {
  const ctx = await newMobile(browser);
  const page = await ctx.newPage();
  await page.goto('/hv');
  await expect(page.getByRole('heading', { name: 'Chưa mở trang' })).toBeVisible();
  await noHorizontalOverflow(page);
  await ctx.close();
});
