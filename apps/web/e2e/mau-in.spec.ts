// E2E Mẫu in hợp đồng (bản vẽ G mục 5.2, gói G-W6) với MÁY CHỦ THẬT, theo kiểu e2e/khung.spec.ts: gieo dữ liệu qua đường API thật
// (đăng ký, tổ chức ACADEMY — có sẵn 5 mẫu in mặc định, hồ sơ thương hiệu, thông tin hợp đồng, khách, hợp đồng dịch vụ, khoá học,
// lớp, hợp đồng khoá học), đăng nhập bằng giao diện, rồi:
//   1. Ảnh khung nhìn (fullPage: false) 3 khổ 1440 / 1024 / 390 của: danh sách mẫu in, màn sửa mẫu, hộp In ở hợp đồng dịch vụ,
//      hộp In ở hợp đồng khoá học. Mỗi ảnh kèm khẳng định không tràn ngang (scrollWidth ≤ innerWidth).
//   2. Bấm In: window.print được thay bằng hàm đếm. Hàm đếm đọc NGAY LÚC ĐƯỢC GỌI số dòng nhật ký in ở máy chủ (XHR đồng bộ qua
//      /print-data) → chứng minh nhật ký đã ghi TRƯỚC khi hộp in của trình duyệt mở. Sau đó đọc lại nhật ký qua API (đúng 1 dòng
//      mới), đếm số POST /prints (đúng 1), đóng rồi mở lại hộp: lần in hiện trên hộp.
//
// Chạy (database thử riêng; ảnh ghi vào e2e/anh khi có E2E_ANH_DIR):
//   E2E_DATABASE_URL=postgresql://…/makeup_test_g_w6 E2E_ANH_DIR=e2e/anh pnpm exec playwright test e2e/mau-in.spec.ts
// Không dùng tệp dữ liệu mồi riêng: dữ liệu gieo bằng API thật trong beforeAll (riêng gói dịch vụ gán bằng Prisma, như cong-hoc-vien.spec.ts).
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { expect, request as pwRequest, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SHOTS } from './anh';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://makeup:makeup_local@localhost:5432/makeup_test_web';

// Prisma của máy chủ (apps/api) — web không phụ thuộc @prisma/client. Chỉ để gán gói dịch vụ (chưa có đường API), như cong-hoc-vien.spec.ts.
const apiRequire = createRequire(new URL('../../api/package.json', import.meta.url));
const { PrismaClient } = apiRequire('@prisma/client') as { PrismaClient: new (o: unknown) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ datasources: { db: { url: DB } } });
const PASSWORD = 'mat-khau-e2e-du-dai';
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
] as const;
type Vp = (typeof VIEWPORTS)[number];

interface Seed {
  token: string;
  email: string;
  orgId: string;
  slug: string;
  serviceContractId: string;
  serviceCode: string;
  courseContractId: string;
  courseCode: string;
  draftServiceId: string;
  draftServiceCode: string;
  draftCourseId: string;
  draftCourseCode: string;
  api: APIRequestContext;
}
let seed: Seed;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ok<T = any>(res: Awaited<ReturnType<APIRequestContext['post']>>, status: number, what: string): Promise<T> {
  if (res.status() !== status) throw new Error(`${what}: mong ${status}, nhận ${res.status()} ${await res.text()}`);
  return (res.status() === 204 ? null : await res.json()) as T;
}

const dayOffset = (n: number) => new Date(Date.now() + n * 86_400_000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const api = await pwRequest.newContext({ baseURL: API });
  const stamp = Date.now();
  const email = `mau-in-${stamp}@makeup.test`;
  const slug = `mau-in-${stamp}`;
  const reg = await ok<{ accessToken: string }>(
    await api.post('/api/v1/auth/register', { data: { email, password: PASSWORD, fullName: 'Nguyễn Trọng Chiến' } }),
    201,
    'đăng ký',
  );
  const token = reg.accessToken;
  const auth = { authorization: `Bearer ${token}` };
  const post = async <T = unknown>(url: string, data: unknown, status = 201): Promise<T> =>
    ok<T>(await api.post(url, { headers: { ...auth, 'idempotency-key': randomUUID() }, data: data as object }), status, url);
  const put = async <T = unknown>(url: string, data: unknown): Promise<T> => ok<T>(await api.put(url, { headers: auth, data: data as object }), 200, url);

  // Trung tâm đào tạo (ACADEMY): có cả hợp đồng dịch vụ lẫn khoá học, tạo tổ chức là có sẵn các mẫu in mặc định.
  const org = await post<{ id: string }>('/api/v1/orgs', { name: 'Học viện Makeup Hoa Đào', slug, kind: 'ACADEMY' });
  const o = `/api/v1/orgs/${org.id}`;
  // Gói không giới hạn để tạo được khoá học / lớp (database thử mới chưa có gói mặc định).
  const plan = await db.subscriptionPlan.create({ data: { code: `mau_in_${stamp}`, name: 'Gói thử không giới hạn', priceMonthly: 0n, features: [] } });
  await db.organizationSubscription.create({ data: { organizationId: org.id, planId: plan.id, startsAt: dayOffset(-1), endsAt: null, status: 'ACTIVE' } });
  await put(`${o}/profile`, { brandName: 'Học viện Makeup Hoa Đào', phone: '02812345678', address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', email: 'lienhe@hoadao.test' });
  await put(`${o}/profile/contract-info`, {
    representativeName: 'Nguyễn Trọng Chiến',
    representativeTitle: 'Giám đốc',
    bankName: 'Vietcombank',
    bankAccountNumber: '0123456789',
    bankAccountName: 'CONG TY MAKEUP HOA DAO',
  });

  const customer = await post<{ id: string }>(`${o}/customers`, { fullName: 'Tôn Nữ Phương Thảo', phone: '0912333321' });

  // Hợp đồng dịch vụ (dòng tự nhập) → xác nhận.
  const service = await post<{ id: string; code: string }>(`${o}/contracts`, {
    kind: 'SERVICE',
    customerId: customer.id,
    notes: 'Cô dâu trang điểm tại nhà, có mặt trước 5 giờ sáng.',
    lines: [
      { kind: 'CUSTOM', name: 'Trang điểm cô dâu ngày cưới', unitPrice: 2_500_000, quantity: 1 },
      { kind: 'CUSTOM', name: 'Trang điểm mẹ cô dâu', unitPrice: 900_000, quantity: 2 },
    ],
  });
  await post(`${o}/contracts/${service.id}/status`, { to: 'CONFIRMED' }, 200);

  // Khoá học + lớp + hợp đồng khoá học → xác nhận.
  const course = await post<{ course: { id: string } }>(`${o}/courses`, {
    name: 'Makeup chuyên nghiệp',
    mode: 'MULTI_CLASS',
    tuitionFee: 14_000_000,
    depositAmount: 3_000_000,
    defaultCapacity: 20,
    sessionCount: 12,
  });
  const today = new Date();
  const wd = (n: number) => ((today.getUTCDay() + 6 + n) % 7) + 1;
  const klass = await post<{ id: string }>(`${o}/courses/${course.course.id}/classes`, {
    name: 'Lớp K12',
    startDate: ymd(dayOffset(7)),
    endDate: ymd(dayOffset(60)),
    weekdays: [...new Set([wd(0), wd(2), wd(4)])].sort((a, b) => a - b),
    startTime: '18:00',
    endTime: '22:00',
  });
  const courseContract = await post<{ id: string; code: string }>(`${o}/contracts`, {
    kind: 'COURSE',
    customerId: customer.id,
    lines: [{ kind: 'COURSE', courseClassId: klass.id }],
  });
  await post(`${o}/contracts/${courseContract.id}/status`, { to: 'CONFIRMED' }, 200);

  // Hai hợp đồng NHÁP (màn nháp có thanh nút riêng — nút In phải có ở cả hai trạng thái).
  const customer2 = await post<{ id: string }>(`${o}/customers`, { fullName: 'Lê Hoàng Yến', phone: '0987654321' });
  const draftService = await post<{ id: string; code: string }>(`${o}/contracts`, {
    kind: 'SERVICE',
    customerId: customer2.id,
    lines: [{ kind: 'CUSTOM', name: 'Trang điểm dự tiệc', unitPrice: 700_000, quantity: 1 }],
  });
  const draftCourse = await post<{ id: string; code: string }>(`${o}/contracts`, {
    kind: 'COURSE',
    customerId: customer2.id,
    lines: [{ kind: 'COURSE', courseClassId: klass.id }],
  });

  seed = {
    token,
    email,
    orgId: org.id,
    slug,
    serviceContractId: service.id,
    serviceCode: service.code,
    courseContractId: courseContract.id,
    courseCode: courseContract.code,
    draftServiceId: draftService.id,
    draftServiceCode: draftService.code,
    draftCourseId: draftCourse.id,
    draftCourseCode: draftCourse.code,
    api,
  };
});

test.afterAll(async () => {
  await db.$disconnect();
  await seed?.api.dispose();
});

// ---------- tiện ích ----------
async function login(page: Page) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email').fill(seed.email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/lich$/);
}

async function openAs(browser: Browser, vp: Vp): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await login(page);
  return { context, page };
}

async function noHorizontalOverflow(page: Page, label: string) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth, `${label}: tràn ngang (scrollWidth ${scrollWidth} > innerWidth ${innerWidth})`).toBeLessThanOrEqual(innerWidth);
}

// Hộp In là lớp phủ cố định: nội dung trong hộp rộng quá thì tạo thanh cuộn BÊN TRONG hộp, document.scrollWidth không đổi.
// Nên ở hộp In kiểm thêm: hộp nằm gọn trong khung nhìn, và không phần tử nào trong hộp (trừ tờ giấy xem trước, được co theo
// khổ) vượt mép phải khung nhìn hay có nội dung rộng hơn chính nó.
async function noOverflowInDialog(page: Page, label: string) {
  const bad = await dialogOf(page).evaluate((dlg) => {
    const vw = window.innerWidth;
    const out: string[] = [];
    const box = dlg.getBoundingClientRect();
    if (box.left < -0.5 || box.right > vw + 0.5) out.push(`hộp ${Math.round(box.left)}…${Math.round(box.right)} ngoài khung ${vw}`);
    for (const el of [dlg, ...Array.from(dlg.querySelectorAll<HTMLElement>('*'))]) {
      if (el.closest('.hdin-frame__paper')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const name = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] ?? ''}`;
      if (r.right > vw + 1) out.push(`${name} right ${Math.round(r.right)} > ${vw}`);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') out.push(`${name} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    }
    return out.slice(0, 5);
  });
  expect(bad, `${label}: tràn ngang trong hộp In`).toEqual([]);
}

// Ảnh khung nhìn thật, không fullPage. Chờ yên mạng + phông xong để ảnh không chụp giữa lúc tải.
async function shot(page: Page, name: string, vp: Vp) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/mau-in-${name}-${vp.name}.png`, fullPage: false });
}

const apiGet = async <T = unknown>(path: string): Promise<T> =>
  ok<T>(await seed.api.get(`/api/v1/orgs/${seed.orgId}${path}`, { headers: { authorization: `Bearer ${seed.token}` } }), 200, path);

interface PrintDataView {
  printCount: number;
  lastPrint: { printNo: number; sameData: boolean; source: string } | null;
}
const printData = (contractId: string) => apiGet<PrintDataView>(`/contracts/${contractId}/print-data`);

// Thay window.print bằng hàm đếm. Mỗi lần được gọi, đọc NGAY (XHR đồng bộ, cùng nguồn qua proxy Vite) số dòng nhật ký in của hợp đồng
// ở máy chủ → countAtCall là số dòng ĐÃ có lúc hộp in được mở. Cài trước khi trang nào chạy (addInitScript), nên dùng được cho cả
// trang gọi window.print() lẫn nút "Hộp in không hiện? Mở lại".
async function stubPrint(page: Page, contractId: string) {
  await page.addInitScript(
    ({ url, token }) => {
      const w = window as unknown as { __printCalls: { countAtCall: number | null }[] };
      w.__printCalls = [];
      window.print = () => {
        let countAtCall: number | null = null;
        try {
          const x = new XMLHttpRequest();
          x.open('GET', url, false);
          x.setRequestHeader('Authorization', `Bearer ${token}`);
          x.send();
          countAtCall = x.status === 200 ? (JSON.parse(x.responseText) as { printCount: number }).printCount : -x.status;
        } catch {
          countAtCall = null;
        }
        w.__printCalls.push({ countAtCall });
      };
    },
    { url: `/api/v1/orgs/${seed.orgId}/contracts/${contractId}/print-data`, token: seed.token },
  );
}

const printCalls = (page: Page) => page.evaluate(() => (window as unknown as { __printCalls: { countAtCall: number | null }[] }).__printCalls);

// Tiêu đề trang: h1 ở máy tính / máy tính bảng, thanh trên ở điện thoại.
const pageTitle = (page: Page, vp: Vp) => page.locator(vp.width <= 640 ? '.sh-top__title' : 'h1');
const dialogOf = (page: Page) => page.getByRole('dialog', { name: /In hợp đồng/ });
const openPrintButton = (page: Page, vp: Vp) => page.getByRole('button', { name: vp.width <= 640 ? 'In' : 'In hợp đồng', exact: true });
const doPrintButton = (page: Page, vp: Vp) => dialogOf(page).getByRole('button', { name: vp.width <= 640 ? 'In / PDF' : 'In / Lưu PDF', exact: true });

async function openDialog(page: Page, vp: Vp, contractId: string, code: string) {
  await page.goto(`/${seed.slug}/hop-dong/${contractId}`);
  await expect(page.getByText(code).first()).toBeVisible();
  await openPrintButton(page, vp).click();
  const dlg = dialogOf(page);
  await expect(dlg).toBeVisible();
  // Sẵn sàng: đã tải dữ liệu in, tờ giấy dựng xong (đếm được số trang), nút In bấm được.
  await expect(dlg.locator('.hdin-pages')).toBeVisible();
  await expect(doPrintButton(page, vp)).toBeEnabled();
  return dlg;
}

// ---------- 1. Ảnh 3 khổ + không tràn ngang ----------
for (const vp of VIEWPORTS) {
  test(`danh sách mẫu in và màn sửa mẫu ở ${vp.name}`, async ({ browser }) => {
    const { context, page } = await openAs(browser, vp);
    await page.goto(`/${seed.slug}/cai-dat/mau-in`);
    await expect(pageTitle(page, vp)).toHaveText('Mẫu in hợp đồng');
    // Tổ chức ACADEMY: hai nhóm; mẫu mặc định mỗi loại; 5 bố cục có sẵn.
    await expect(page.getByRole('region', { name: 'Hợp đồng dịch vụ' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Hợp đồng khoá học' })).toBeVisible();
    const serviceDefault = page.getByRole('link', { name: /Hiện đại \(mặc định\)/ });
    const courseDefault = page.getByRole('link', { name: /Cổ điển có quốc hiệu \(mặc định\)/ });
    await expect(serviceDefault).toBeVisible();
    await expect(courseDefault).toBeVisible();
    await expect(page.getByRole('region', { name: '5 bố cục có sẵn' })).toBeVisible();
    await noHorizontalOverflow(page, `danh sách mẫu ${vp.name}`);
    await shot(page, 'danh-sach', vp);

    await serviceDefault.click();
    await expect(page).toHaveURL(new RegExp(`/${seed.slug}/cai-dat/mau-in/[0-9a-f-]{36}$`));
    // Chờ tải xong bằng chính nội dung: ô tên mẫu có giá trị của mẫu đã bấm (đừng chờ "hết khung xương" — chưa kịp hiện thì đếm 0 ngay).
    await expect(page.getByLabel(/Tên mẫu/).first()).toHaveValue('Hiện đại');
    await expect(page.getByRole('status', { name: 'Đang tải mẫu in' })).toHaveCount(0);
    await noHorizontalOverflow(page, `màn sửa mẫu ${vp.name}`);
    await shot(page, 'sua-mau', vp);
    await context.close();
  });
}

for (const [label, key] of [
  ['dịch vụ', 'dich-vu'],
  ['khoá học', 'khoa-hoc'],
] as const) {
  for (const vp of VIEWPORTS) {
    test(`hộp In hợp đồng ${label} ở ${vp.name}`, async ({ browser }) => {
      const { context, page } = await openAs(browser, vp);
      const contractId = key === 'dich-vu' ? seed.serviceContractId : seed.courseContractId;
      const code = key === 'dich-vu' ? seed.serviceCode : seed.courseCode;
      const dlg = await openDialog(page, vp, contractId, code);
      await expect(dlg.getByText('Chọn mẫu in')).toBeVisible();
      // Mẫu mặc định theo loại: dịch vụ → Hiện đại (bố cục 2), khoá học → Cổ điển có quốc hiệu (bố cục 1).
      await expect(dlg.getByRole('radio', { checked: true })).toHaveCount(1);
      await expect(dlg.locator('label.is-on')).toContainText(key === 'dich-vu' ? 'Hiện đại' : 'Cổ điển có quốc hiệu');
      await noHorizontalOverflow(page, `hộp In ${label} ${vp.name}`);
      await noOverflowInDialog(page, `hộp In ${label} ${vp.name}`);
      await shot(page, `hop-in-${key}`, vp);
      // Chưa bấm In thì chưa có dòng nhật ký nào.
      expect((await printData(contractId)).printCount).toBe(0);
      await context.close();
    });
  }
}

// Màn hợp đồng NHÁP có thanh nút riêng: nút In có ở cả hai loại, ở máy tính lẫn điện thoại, và mở được hộp In (chưa ghi dòng nào).
for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  for (const [label, pick] of [
    ['dịch vụ', () => [seed.draftServiceId, seed.draftServiceCode]],
    ['khoá học', () => [seed.draftCourseId, seed.draftCourseCode]],
  ] as const) {
    test(`nút In có ở hợp đồng ${label} nháp ở ${vp.name}`, async ({ browser }) => {
      const { context, page } = await openAs(browser, vp);
      const [id, code] = pick();
      const dlg = await openDialog(page, vp, id, code);
      await expect(dlg.getByText(`${code} · Nháp`)).toBeVisible();
      await noHorizontalOverflow(page, `hộp In nháp ${label} ${vp.name}`);
      await noOverflowInDialog(page, `hộp In nháp ${label} ${vp.name}`);
      expect((await printData(id)).printCount).toBe(0);
      await context.close();
    });
  }
}

// ---------- 2. Bấm In ----------
async function printOnce(browser: Browser, vp: Vp, contractId: string, code: string) {
  const { context, page } = await openAs(browser, vp);
  await stubPrint(page, contractId);
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/contracts\/[^/]+\/prints$/.test(new URL(r.url()).pathname)) posts.push(r.url());
  });
  const before = (await printData(contractId)).printCount;
  expect(before).toBe(0);
  // Cài hàm đếm SAU khi tải trang đầu của phiên: vào lại đường hợp đồng bằng goto (đã có addInitScript cho mọi lần tải).
  const dlg = await openDialog(page, vp, contractId, code);
  expect(await printCalls(page), 'chưa bấm In mà window.print đã được gọi').toHaveLength(0);

  await doPrintButton(page, vp).click();
  await expect(dlg.getByText('Đã ghi lần in thứ 1')).toBeVisible();
  // window.print đúng 1 lần, và lúc gọi máy chủ ĐÃ có đúng 1 dòng nhật ký (ghi trước, in sau).
  await expect.poll(async () => (await printCalls(page)).length, { message: 'window.print phải được gọi' }).toBe(1);
  const calls = await printCalls(page);
  expect(calls, 'window.print gọi đúng 1 lần').toHaveLength(1);
  expect(calls[0]?.countAtCall, 'lúc window.print được gọi, máy chủ đã ghi đúng 1 dòng nhật ký').toBe(1);
  expect(posts, 'đúng 1 yêu cầu POST /prints').toHaveLength(1);
  // Đọc lại qua API: đúng 1 dòng mới, theo mẫu mặc định.
  const after = await printData(contractId);
  expect(after.printCount - before, 'số dòng nhật ký in mới').toBe(1);
  expect(after.lastPrint).toMatchObject({ printNo: 1, source: 'TEMPLATE' });
  await noHorizontalOverflow(page, `sau khi in ${vp.name}`);
  await noOverflowInDialog(page, `sau khi in ${vp.name}`);

  // Đóng rồi mở lại: lần in hiện trên hộp, in lại y hệt (cùng dữ liệu), chưa gọi thêm window.print và chưa ghi thêm dòng.
  await dlg.locator('.hdin-foot__btns').getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await openPrintButton(page, vp).click();
  const again = dialogOf(page);
  await expect(again.getByText(/Giữ mẫu đã in — .* · bản v\d+/)).toBeVisible();
  await expect(again.getByText(/Lần in 1: .+/)).toBeVisible();
  await expect(again.getByText('Dữ liệu hợp đồng không đổi kể từ lần in này.')).toBeVisible();
  await expect(doPrintButton(page, vp)).toBeEnabled();
  expect(await printCalls(page)).toHaveLength(1);
  expect((await printData(contractId)).printCount).toBe(1);
  return { context, page, again };
}

test('bấm In hợp đồng dịch vụ ở 1440: ghi nhật ký rồi mới in, in lại y hệt ghi dòng thứ hai', async ({ browser }) => {
  test.setTimeout(120_000);
  const vp = VIEWPORTS[0];
  const { context, page, again } = await printOnce(browser, vp, seed.serviceContractId, seed.serviceCode);
  // Lần in thứ hai (REPRINT): thêm đúng 1 dòng, window.print lần thứ hai, lúc gọi đã có 2 dòng.
  await doPrintButton(page, vp).click();
  await expect(again.getByText('Đã ghi lần in thứ 2')).toBeVisible();
  await expect.poll(async () => (await printCalls(page)).length).toBe(2);
  expect((await printCalls(page)).map((c) => c.countAtCall)).toEqual([1, 2]);
  const after = await printData(seed.serviceContractId);
  expect(after.printCount).toBe(2);
  expect(after.lastPrint).toMatchObject({ printNo: 2, source: 'REPRINT', sameData: true });
  await context.close();
});

test('bấm In hợp đồng khoá học ở 390: ghi nhật ký rồi mới in, lần in hiện khi mở lại', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, page } = await printOnce(browser, VIEWPORTS[2], seed.courseContractId, seed.courseCode);
  await noHorizontalOverflow(page, 'mở lại hộp In khoá học 390');
  await context.close();
});
