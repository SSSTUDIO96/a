import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

// Khung điều hướng (gói W3) ở 3 khổ 1440 / 1024 / 390 với 3 loại tài khoản tạo qua API thật:
// chủ tổ chức, thợ (vai trò hệ thống "Thợ makeup"), và người chỉ có quyền xem lịch (vai trò tuỳ chỉnh).

const SHOTS = 'e2e/anh';
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

// Mục điều hướng đang hiện: thanh trái (máy tính, máy tính bảng) hoặc thanh dưới (điện thoại).
async function visibleMenu(page: Page, phone: boolean): Promise<string[]> {
  if (phone) {
    const nav = page.getByRole('navigation', { name: 'Mục chính (điện thoại)' });
    await expect(nav).toBeVisible();
    return (await nav.locator('a,button').allInnerTexts()).map((t) => t.trim());
  }
  const nav = page.getByRole('navigation', { name: 'Mục chính' });
  await expect(nav.getByRole('link').first()).toBeVisible();
  return nav.getByRole('link').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''));
}

test('khung điều hướng theo quyền ở 1440 / 1024 / 390', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const owner: Account = { email: `chu-${stamp}@makeup.test`, fullName: 'Nguyễn Trọng Chiến' };
  const artist: Account = { email: `tho-${stamp}@makeup.test`, fullName: 'Nguyễn Thu Hà' };
  const viewer: Account = { email: `lich-${stamp}@makeup.test`, fullName: 'Phạm Bảo Vy' };
  const slug = `khung-${stamp}`;

  // ---- Dữ liệu qua API thật ----
  const ownerToken = await register(request, owner);
  await register(request, artist);
  await register(request, viewer);
  const auth = { Authorization: `Bearer ${ownerToken}` };
  const org = await apiJson<{ id: string }>(
    await request.post('/api/v1/orgs', { headers: auth, data: { name: 'Studio Hoa Đào', slug, kind: 'TEAM' } }),
  );
  await apiJson(
    await request.post(`/api/v1/orgs/${org.id}/roles`, {
      headers: auth,
      data: { key: 'chi_xem_lich', name: 'Chỉ xem lịch', permissions: ['org.read', 'schedule.read_own'] },
    }),
  );
  await apiJson(await request.post(`/api/v1/orgs/${org.id}/members`, { headers: auth, data: { email: artist.email, roleKeys: ['artist'] } }));
  await apiJson(await request.post(`/api/v1/orgs/${org.id}/members`, { headers: auth, data: { email: viewer.email, roleKeys: ['chi_xem_lich'] } }));

  const expected: Record<string, { desktop: string[]; phone: string[] }> = {
    chu: {
      desktop: ['Lịch makeup', 'Hợp đồng', 'Bảng giá', 'Khách hàng', 'Thợ makeup', 'Cài đặt'],
      phone: ['Lịch', 'Hợp đồng', 'Bảng giá', 'Khách', 'Thêm'],
    },
    tho: { desktop: ['Lịch makeup', 'Bảng giá', 'Thợ makeup'], phone: ['Lịch', 'Bảng giá', 'Thêm'] },
    'chi-lich': { desktop: ['Lịch makeup'], phone: ['Lịch', 'Thêm'] },
  };
  const accounts: [string, Account][] = [
    ['chu', owner],
    ['tho', artist],
    ['chi-lich', viewer],
  ];

  for (const [key, account] of accounts) {
    for (const vp of VIEWPORTS) {
      const { context, page } = await openAs(browser, account, vp);
      const phone = vp.width <= 640;
      await expect(page.getByText('Đang dựng')).toBeVisible();
      expect(await visibleMenu(page, phone), `${key} @${vp.name}`).toEqual(phone ? expected[key]?.phone : expected[key]?.desktop);
      await noHorizontalOverflow(page, `${key} @${vp.name}`);
      await page.screenshot({ path: `${SHOTS}/w3-khung-${key}-${vp.name}.png`, fullPage: true });

      if (key === 'chu' && vp.name === '1440') {
        // Menu con của Bảng giá + danh sách đổi tổ chức.
        await page.getByRole('navigation', { name: 'Mục chính' }).getByRole('link', { name: 'Bảng giá' }).click();
        await page.getByRole('link', { name: 'Gói theo nhân vật' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/bang-gia/goi$`));
        await page.getByRole('button', { name: /Đổi tổ chức/ }).click();
        await expect(page.getByText('Tổ chức của bạn')).toBeVisible();
        await noHorizontalOverflow(page, 'chủ bảng giá 1440');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-1440-bang-gia-doi-to-chuc.png` });
        // Mất mạng → dải cảnh báo.
        await page.keyboard.press('Escape');
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
        await page.getByRole('link', { name: 'Hợp đồng' }).hover();
        await expect(page.getByRole('tooltip')).toHaveText('Hợp đồng');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-1024-tooltip.png` });
      }
      if (key === 'chu' && vp.name === '390') {
        // Ngăn "Thêm": Thợ makeup, Cài đặt, tổ chức, đăng xuất.
        await page.getByRole('button', { name: 'Thêm' }).click();
        const sheet = page.getByRole('dialog', { name: 'Thêm' });
        await expect(sheet.getByRole('link', { name: 'Thợ makeup' })).toBeVisible();
        await expect(sheet.getByRole('link', { name: 'Cài đặt' })).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
        await noHorizontalOverflow(page, 'chủ ngăn Thêm 390');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chu-390-them.png` });
        await sheet.getByRole('link', { name: 'Thợ makeup' }).click();
        await expect(page).toHaveURL(new RegExp(`/${slug}/nhan-su$`));
        await expect(page.locator('.sh-top__title')).toHaveText('Thợ makeup');
      }
      if (key === 'chi-lich' && vp.name === '1440') {
        // Vào thẳng đường không có quyền → dải 403.
        await page.goto(`/${slug}/hop-dong`);
        await expect(page.getByRole('alert')).toHaveText('Bạn không có quyền xem hợp đồng.');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chi-lich-1440-403.png` });
      }
      if (key === 'chi-lich' && vp.name === '390') {
        await page.goto(`/${slug}/hop-dong`);
        await expect(page.getByRole('alert')).toHaveText('Bạn không có quyền xem hợp đồng.');
        await noHorizontalOverflow(page, 'chỉ lịch 403 390');
        await page.screenshot({ path: `${SHOTS}/w3-khung-chi-lich-390-403.png` });
      }
      await context.close();
    }
  }
});
