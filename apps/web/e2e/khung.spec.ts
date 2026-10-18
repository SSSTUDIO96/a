import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { SHOTS } from './anh';

// Khung điều hướng (gói W3) ở 3 khổ 1440 / 1024 / 390 với các tài khoản tạo qua API thật:
// chủ tổ chức INDIVIDUAL, chủ tổ chức ACADEMY, lễ tân, thợ (vai trò hệ thống "Thợ makeup"), và người chỉ có quyền xem
// lịch (vai trò tuỳ chỉnh). Chỉ kiểm KHUNG (mục điều hướng, quyền, mục đang chọn, đường) — không phụ thuộc nội dung màn.

const PASSWORD = 'mat-khau-e2e-du-dai';
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
] as const;

interface Account {
  email: string;
  fullName: string;
}

async function apiJson<T>(res: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
  if (!res.ok()) throw new Error(`API ${res.url()} → ${res.status()}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function register(request: APIRequestContext, a: Account): Promise<string> {
  const body = await apiJson<{ accessToken: string }>(
    await request.post('/api/v1/auth/register', { data: { email: a.email, password: PASSWORD, fullName: a.fullName } }),
  );
  return body.accessToken;
}

async function login(page: Page, a: Account) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email').fill(a.email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/lich$/);
}

async function noHorizontalOverflow(page: Page, label: string) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth, `${label}: tràn ngang`).toBe(innerWidth);
}

async function openAs(browser: Browser, a: Account, vp: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await login(page, a);
  return { context, page };
}

const sideNav = (page: Page) => page.getByRole('navigation', { name: 'Mục chính', exact: true });
const phoneNav = (page: Page) => page.getByRole('navigation', { name: 'Mục chính (điện thoại)' });

// Mục điều hướng đang hiện: thanh trái (máy tính, máy tính bảng) hoặc thanh dưới (điện thoại).
async function visibleMenu(page: Page, phone: boolean): Promise<string[]> {
  if (phone) {
    await expect(phoneNav(page)).toBeVisible();
    return (await phoneNav(page).locator('a,button').allInnerTexts()).map((t) => t.trim());
  }
  const links = sideNav(page).locator('a.sh-menu__a');
  await expect(links.first()).toBeVisible();
  return links.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''));
}

// Mục (và mục con) đang chọn ở thanh trái / ô đang chọn ở thanh dưới — khẳng định tự chờ (sau khi bấm chuyển đường).
async function expectActive(page: Page, phone: boolean, names: string[]) {
  const loc = phone ? phoneNav(page).locator('.on') : sideNav(page).locator('a.on');
  await expect(loc).toHaveText(names);
}

async function expectSubMenu(page: Page, names: string[]) {
  await expect(sideNav(page).locator('.sh-kids__a')).toHaveText(names);
}

async function shot(page: Page, name: string) {
  // Chờ màn yên (không còn yêu cầu mạng) để ảnh khung không chụp giữa lúc tải; không kiểm nội dung màn.
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test('khung điều hướng theo quyền và loại tổ chức ở 1440 / 1024 / 390', async ({ browser, request }) => {
  test.setTimeout(300_000);
  const stamp = Date.now();
  const owner: Account = { email: `chu-${stamp}@makeup.test`, fullName: 'Nguyễn Trọng Chiến' };
  const academyOwner: Account = { email: `chu-dt-${stamp}@makeup.test`, fullName: 'Lê Minh Thư' };
  const receptionist: Account = { email: `le-tan-${stamp}@makeup.test`, fullName: 'Trần Ngọc Ánh' };
  const artist: Account = { email: `tho-${stamp}@makeup.test`, fullName: 'Nguyễn Thu Hà' };
  const viewer: Account = { email: `lich-${stamp}@makeup.test`, fullName: 'Phạm Bảo Vy' };
  const slug = `khung-${stamp}`;
  const academySlug = `dao-tao-${stamp}`;

  // ---- Dữ liệu qua API thật ----
  const ownerToken = await register(request, owner);
  const academyToken = await register(request, academyOwner);
  await register(request, receptionist);
  await register(request, artist);
  await register(request, viewer);
  const auth = { Authorization: `Bearer ${ownerToken}` };
  const org = await apiJson<{ id: string }>(
    await request.post('/api/v1/orgs', { headers: auth, data: { name: 'Studio Hoa Đào', slug, kind: 'INDIVIDUAL' } }),
  );
  await apiJson(
    await request.post('/api/v1/orgs', {
      headers: { Authorization: `Bearer ${academyToken}` },
      data: { name: 'Học viện Makeup Thư Lê', slug: academySlug, kind: 'ACADEMY' },
    }),
  );
  await apiJson(
    await request.post(`/api/v1/orgs/${org.id}/roles`, {
      headers: auth,
      data: { key: 'chi_xem_lich', name: 'Chỉ xem lịch', permissions: ['org.read', 'schedule.read_own'] },
    }),
  );
  for (const [a, role] of [
    [receptionist, 'receptionist'],
    [artist, 'artist'],
    [viewer, 'chi_xem_lich'],
  ] as const) {
    await apiJson(await request.post(`/api/v1/orgs/${org.id}/members`, { headers: auth, data: { email: a.email, roleKeys: [role] } }));
  }

  const expected: Record<string, { desktop: string[]; phone: string[] }> = {
    chu: {
      desktop: ['Lịch makeup', 'Hợp đồng', 'Bảng giá', 'Khách hàng', 'Thợ makeup', 'Báo cáo', 'Cài đặt'],
      phone: ['Lịch', 'Hợp đồng', 'Bảng giá', 'Khách', 'Thêm'],
    },
    'chu-dao-tao': {
      desktop: ['Lịch makeup', 'Hợp đồng', 'Bảng giá', 'Khách hàng', 'Thợ makeup', 'Báo cáo', 'Cài đặt'],
      // Khoá học chưa có màn → chưa có ô (bày ra được thì phải dùng được).
      phone: ['Lịch', 'Hợp đồng', 'Thu tiền', 'Thêm'],
    },
    'le-tan': {
      desktop: ['Lịch makeup', 'Hợp đồng', 'Bảng giá', 'Khách hàng', 'Thợ makeup', 'Báo cáo'],
      phone: ['Lịch', 'Hợp đồng', 'Bảng giá', 'Khách', 'Thêm'],
    },
    tho: { desktop: ['Lịch makeup', 'Bảng giá', 'Thợ makeup'], phone: ['Lịch', 'Bảng giá', 'Thêm'] },
    'chi-lich': { desktop: ['Lịch makeup'], phone: ['Lịch', 'Thêm'] },
  };
  const accounts: [string, Account][] = [
    ['chu', owner],
    ['chu-dao-tao', academyOwner],
    ['le-tan', receptionist],
    ['tho', artist],
    ['chi-lich', viewer],
  ];

  for (const [key, account] of accounts) {
    for (const vp of VIEWPORTS) {
      const { context, page } = await openAs(browser, account, vp);
      const phone = vp.width <= 640;
      const base = key === 'chu-dao-tao' ? academySlug : slug;
      expect(await visibleMenu(page, phone), `${key} @${vp.name}`).toEqual(phone ? expected[key]?.phone : expected[key]?.desktop);
      await expectActive(page, phone, [phone ? 'Lịch' : 'Lịch makeup']);
      await noHorizontalOverflow(page, `${key} @${vp.name}`);
      await shot(page, `w3-khung-${key}-${vp.name}`);

      if (key === 'chu' && vp.name === '1440') {
        // Menu con của Bảng giá + danh sách đổi tổ chức.
        await sideNav(page).getByRole('link', { name: 'Bảng giá' }).click();
        await page.getByRole('link', { name: 'Gói theo nhân vật' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/bang-gia/goi$`));
        await page.getByRole('button', { name: /Đổi tổ chức/ }).click();
        await expect(page.getByText('Tổ chức của bạn')).toBeVisible();
        await noHorizontalOverflow(page, 'chủ bảng giá 1440');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-1440-bang-gia-doi-to-chuc.png` });
        await page.keyboard.press('Escape');
        // Hợp đồng có menu con; ở /thu-tien (đường không bắt đầu bằng hop-dong) mục "Hợp đồng" + "Thu tiền" đang chọn.
        await sideNav(page).getByRole('link', { name: 'Hợp đồng' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/hop-dong$`));
        await expectSubMenu(page, ['Lập hợp đồng', 'Danh sách hợp đồng', 'Thu tiền']);
        await sideNav(page).getByRole('link', { name: 'Thu tiền' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/thu-tien$`));
        await expectActive(page, false, ['Hợp đồng', 'Thu tiền']);
        await shot(page, 'w3-khung-chu-1440-thu-tien');
        // Thợ makeup: hai mục con.
        await sideNav(page).getByRole('link', { name: 'Thợ makeup' }).click();
        await expectSubMenu(page, ['Thợ & bậc lương', 'Tiền công theo gói']);
        await sideNav(page).getByRole('link', { name: 'Tiền công theo gói' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/nhan-su/tien-cong$`));
        await expectActive(page, false, ['Thợ makeup', 'Tiền công theo gói']);
        await shot(page, 'w3-khung-chu-1440-tien-cong');
        // Báo cáo (chủ có cả hai quyền) + Cài đặt → Hồ sơ thương hiệu.
        await sideNav(page).getByRole('link', { name: 'Báo cáo' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/bao-cao/doanh-thu$`));
        await expectSubMenu(page, ['Doanh thu', 'Sổ thu']);
        await sideNav(page).getByRole('link', { name: 'Cài đặt' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/cai-dat/thuong-hieu$`));
        await expectActive(page, false, ['Cài đặt', 'Hồ sơ thương hiệu']);
        await shot(page, 'w3-khung-chu-1440-thuong-hieu');
        // Mất mạng → dải cảnh báo.
        await context.setOffline(true);
        await expect(page.getByText(/Mất kết nối mạng/)).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-1440-mat-mang.png` });
        await context.setOffline(false);
        await expect(page.getByText(/Mất kết nối mạng/)).toBeHidden();
        // Đường không có → 404 trong khung.
        await page.goto(`/${slug}/khong-co-trang-nay`);
        await expect(page.getByText('Không tìm thấy trang này.')).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-1440-404.png` });
      }
      if (key === 'chu' && vp.name === '1024') {
        // Máy tính bảng: chỉ biểu tượng, tên mục hiện ở tooltip khi rê chuột.
        await sideNav(page).getByRole('link', { name: 'Hợp đồng' }).hover();
        await expect(page.getByRole('tooltip')).toHaveText('Hợp đồng');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-1024-tooltip.png` });
      }
      if (key === 'chu' && vp.name === '390') {
        // Ngăn "Thêm": Thợ makeup, Báo cáo, Cài đặt, tổ chức, đăng xuất.
        await phoneNav(page).getByRole('button', { name: 'Thêm' }).click();
        const sheet = page.getByRole('dialog', { name: 'Thêm' });
        await expect(sheet.getByRole('link', { name: 'Thợ makeup' })).toBeVisible();
        await expect(sheet.getByRole('link', { name: 'Báo cáo' })).toBeVisible();
        await expect(sheet.getByRole('link', { name: 'Cài đặt' })).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
        await noHorizontalOverflow(page, 'chủ ngăn Thêm 390');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-390-them.png` });
        await sheet.getByRole('link', { name: 'Thợ makeup' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/nhan-su$`));
        await expect(page.locator('.sh-top__title')).toHaveText('Thợ makeup');
        await expectActive(page, true, ['Thêm']);
        // INDIVIDUAL: /thu-tien thuộc ô "Hợp đồng".
        await page.goto(`/${slug}/thu-tien`);
        await expect(phoneNav(page).locator('.on')).toHaveText('Hợp đồng');
      }
      if (key === 'chu-dao-tao' && vp.name === '390') {
        // ACADEMY: ô "Thu tiền" riêng, đang chọn ở /thu-tien; "Bảng giá", "Khách hàng" vào ngăn "Thêm".
        await phoneNav(page).getByRole('link', { name: 'Thu tiền' }).click();
        await expect(page).toHaveURL(new RegExp(`/${academySlug}/thu-tien$`));
        await expectActive(page, true, ['Thu tiền']);
        await shot(page, 'w3-khung-chu-dao-tao-390-thu-tien');
        await phoneNav(page).getByRole('button', { name: 'Thêm' }).click();
        const sheet = page.getByRole('dialog', { name: 'Thêm' });
        expect((await sheet.locator('.sh-more__list').first().locator('a').allInnerTexts()).map((t) => t.trim())).toEqual([
          'Bảng giá',
          'Khách hàng',
          'Thợ makeup',
          'Báo cáo',
          'Cài đặt',
        ]);
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-dao-tao-390-them.png` });
      }
      if (key === 'le-tan' && vp.name === '1440') {
        // Lễ tân có payments.read mà không reports.read: "Báo cáo" chỉ có Sổ thu; Doanh thu → 403.
        await sideNav(page).getByRole('link', { name: 'Báo cáo' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/bao-cao/so-thu$`));
        await expectSubMenu(page, ['Sổ thu']);
        await expectActive(page, false, ['Báo cáo', 'Sổ thu']);
        await shot(page, 'w3-khung-le-tan-1440-so-thu');
        await page.goto(`/${slug}/bao-cao/doanh-thu`);
        await expect(page.getByRole('alert')).toHaveText('Bạn không có quyền xem doanh thu.');
        await page.screenshot({ path: `${SHOTS}/w3-khung-le-tan-1440-doanh-thu-403.png` });
        // Không có payroll.read: Thợ makeup chỉ có "Thợ & bậc lương".
        await sideNav(page).getByRole('link', { name: 'Thợ makeup' }).click();
        await expectSubMenu(page, ['Thợ & bậc lương']);
      }
      if (key === 'chi-lich' && (vp.name === '1440' || vp.name === '390')) {
        // Vào thẳng đường không có quyền → dải 403.
        await page.goto(`/${base}/hop-dong`);
        await expect(page.getByRole('alert')).toHaveText('Bạn không có quyền xem hợp đồng.');
        await noHorizontalOverflow(page, `chỉ lịch 403 ${vp.name}`);
        await page.screenshot({ path: `${SHOTS}/w3-khung-chi-lich-${vp.name}-403.png` });
      }
      await context.close();
    }
  }
});

test('đường ngoài khung: /trang/:slug mở khi chưa đăng nhập; /quan-tri chưa đăng nhập → đăng nhập', async ({ page }) => {
  await page.goto('/trang/khong-ton-tai');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/trang\/khong-ton-tai$/);
  await expect(page.getByRole('navigation', { name: 'Mục chính', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/w3-khung-trang-cong-khai-chua-dang-nhap.png` });

  await page.goto('/quan-tri/to-chuc');
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});
