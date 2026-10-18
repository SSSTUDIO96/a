import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'e2e/anh';
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

test('đăng ký → tạo tổ chức → khung → tải lại còn phiên → đăng xuất → tải lại về đăng nhập', async ({ page, context }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@makeup.test`;
  const password = 'mat-khau-e2e-du-dai';
  const orgName = `Studio Hoa Đào ${stamp}`;
  const slug = `studio-hoa-dao-${stamp}`;

  // Chưa đăng nhập: vào gốc thì về trang đăng nhập.
  await page.goto('/');
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await shot(page, '01-dang-nhap-khi-chua-co-phien');

  // Đăng ký: gửi rỗng thì báo lỗi dưới ô, không gọi máy chủ.
  await page.getByRole('link', { name: 'Đăng ký' }).click();
  await expect(page).toHaveURL(/\/dang-ky$/);
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await expect(page.getByText('Vui lòng nhập họ tên')).toBeVisible();
  await expect(page.getByText('Mật khẩu tối thiểu 10 ký tự')).toBeVisible();
  await shot(page, '02-dang-ky-loi-kiem-du-lieu');

  await page.getByLabel('Họ tên').fill('Nguyễn Thị Hoa');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/Mật khẩu/).fill(password);
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await expect(page).toHaveURL(/\/tao-to-chuc$/);
  await expect(page.getByText('Bạn chưa thuộc tổ chức nào')).toBeVisible();
  await shot(page, '03-tao-to-chuc-sau-dang-ky');

  // Tạo tổ chức: đường dẫn tự gợi ý từ tên (bỏ dấu).
  await page.getByLabel('Tên tổ chức').fill(orgName);
  await expect(page.getByLabel(/Đường dẫn/)).toHaveValue(slug);
  const createReq = page.waitForRequest((r) => r.url().endsWith('/api/v1/orgs') && r.method() === 'POST');
  await page.getByLabel('Đội / studio').check();
  await page.getByRole('button', { name: 'Tạo tổ chức' }).click();
  const req = await createReq;
  expect(req.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  expect(req.headers()['x-client']).toBe('web');
  await expect(page).toHaveURL(new RegExp(`/${slug}/lich$`));
  await expect(page.getByText('Đang dựng')).toBeVisible();
  await expect(page.getByText(orgName)).toBeVisible();
  await shot(page, '04-khung-to-chuc-lich');

  // Thẻ dài hạn chỉ nằm trong cookie httpOnly; trình duyệt không lưu token ở kho JS.
  const cookies = await context.cookies();
  const refresh = cookies.find((c) => c.name === 'mp_refresh');
  expect(refresh?.httpOnly).toBe(true);
  expect(refresh?.sameSite).toBe('Strict');
  expect(refresh?.path).toBe('/api/v1/auth');
  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]),
    session: Object.keys(sessionStorage),
  }));
  expect(stored.session).toEqual([]);
  expect(stored.local.map(([k]) => k)).toEqual(['makeup-pro.to-chuc-dang-chon']);

  // Tải lại trang: phiên khôi phục nhờ cookie, chỉ MỘT lần refresh.
  const refreshCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/v1/auth/refresh')) refreshCalls.push(r.method());
  });
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/${slug}/lich$`));
  await expect(page.getByText('Đang dựng')).toBeVisible();
  await expect(page.getByText(orgName)).toBeVisible();
  expect(refreshCalls).toEqual(['POST']);
  await page.getByRole('link', { name: 'Hợp đồng' }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/hop-dong$`));
  await shot(page, '05-tai-lai-van-con-phien-hop-dong');

  // Đăng xuất: máy chủ thu hồi phiên, xoá cookie.
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/dang-nhap$/);
  expect((await context.cookies()).find((c) => c.name === 'mp_refresh')).toBeUndefined();
  await shot(page, '06-sau-dang-xuat');

  // Tải lại / vào thẳng trang trong tổ chức: vẫn ở đăng nhập.
  await page.reload();
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await page.goto(`/${slug}/lich`);
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await shot(page, '07-tai-lai-sau-dang-xuat-ve-dang-nhap');

  // Sai mật khẩu: hiện đúng lời máy chủ, không vào được.
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill('sai-mat-khau-roi');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Email hoặc mật khẩu không đúng')).toBeVisible();
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await shot(page, '08-dang-nhap-sai-mat-khau');

  // Đăng nhập đúng: quay lại trang định vào trước đó.
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/lich$`));
  await expect(page.getByText('Đang dựng')).toBeVisible();
  await shot(page, '09-dang-nhap-lai-vao-khung');
});
