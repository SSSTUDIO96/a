// THỢ CHẤM ĐỢT SỬA 1 — trình duyệt thật. Viết theo hành vi ĐÚNG: đỏ = lỗi.
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = '/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-sua1-bien-ban/anh';
const WEB = { 'X-Client': 'web' };

async function count429(page: Page, retryAfter: string | null) {
  const calls: number[] = [];
  const t0 = Date.now();
  await page.route('**/api/v1/auth/refresh', async (route) => {
    calls.push(Date.now() - t0);
    await route.fulfill({
      status: 429,
      headers: { 'content-type': 'application/json', ...(retryAfter === null ? {} : { 'Retry-After': retryAfter }) },
      body: JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Thử quá nhiều lần, vui lòng đợi một phút', requestId: 'x' } }),
    });
  });
  return calls;
}

test.describe('M — 429 lúc khôi phục phiên', () => {
  test('Retry-After: 1 → tự thử lại đúng MỘT lần rồi hiện nút; không quay về trang đăng nhập; bấm nút → thêm 1 chuỗi', async ({ page }) => {
    const calls = await count429(page, '1');
    await page.goto('/tao-to-chuc');
    await page.waitForTimeout(6000);
    const url = page.url();
    const text = await page.locator('body').innerText();
    console.log(`[429 Retry-After=1] 6 giây: ${calls.length} lần refresh tại ${calls.join(', ')} ms; url=${url}; chữ: ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
    await page.screenshot({ path: `${SHOTS}/429-khoi-phuc-phien.png` });
    expect(calls.length).toBe(2);
    expect(url).toContain('/tao-to-chuc');
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await page.waitForTimeout(4000);
    console.log(`[429 Retry-After=1] sau khi bấm "Thử lại" + 4 giây: ${calls.length} lần`);
    expect(calls.length).toBe(4);
  });

  for (const [ra, expectWait] of [[null, 60], ['0', 1], ['999999', 300], ['-1', 60], ['abc', 60], ['Wed, 21 Oct 2015 07:28:00 GMT', 1]] as const) {
    test(`Retry-After=${ra === null ? '(không có)' : JSON.stringify(ra)} → chờ ${expectWait} giây, không vòng lặp`, async ({ page }) => {
      const calls = await count429(page, ra);
      await page.goto('/tao-to-chuc');
      await page.waitForTimeout(4000);
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const m = /sau (\d+) giây/.exec(text);
      console.log(`[429 Retry-After=${ra}] 4 giây: ${calls.length} lần refresh (${calls.join(', ')} ms); thông báo: "${m?.[0] ?? text.slice(0, 80)}"`);
      expect(calls.length).toBeLessThanOrEqual(2);
      if (expectWait > 4) {
        expect(calls.length).toBe(1);
        expect(Number(m?.[1])).toBeGreaterThan(expectWait - 6);
        expect(Number(m?.[1])).toBeLessThanOrEqual(expectWait);
      }
    });
  }
});

test.describe('M — giữ khoá chống gửi trùng khi mất mạng sau khi máy chủ đã nhận', () => {
  test('tạo tổ chức: lần 1 máy chủ tạo xong nhưng trình duyệt mất trả lời → bấm lại → vào đúng tổ chức đó, chỉ 1 tổ chức', async ({ page, request }) => {
    const email = `cham-m-${randomUUID().slice(0, 8)}@makeup.test`;
    await page.goto('/dang-ky');
    await page.getByLabel('Họ tên').fill('Thợ chấm M');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill('mat-khau-tho-cham-1');
    await page.getByRole('button', { name: /Đăng ký/ }).click();
    await page.waitForURL(/tao-to-chuc/);
    const keys: string[] = [];
    let dropped = false;
    await page.route('**/api/v1/orgs', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      keys.push(route.request().headers()['idempotency-key'] ?? '(không có)');
      if (!dropped) {
        dropped = true;
        await route.fetch(); // máy chủ nhận và tạo tổ chức
        return route.abort('connectionreset'); // nhưng trình duyệt không nhận được trả lời
      }
      return route.continue();
    });
    const slug = `cham-m-${randomUUID().slice(0, 8)}`;
    await page.getByLabel('Tên tổ chức').fill('Studio mất mạng');
    await page.getByLabel(/Đường dẫn/).fill(slug);
    await page.getByLabel('Đội / studio').check();
    await page.getByRole('button', { name: /Tạo tổ chức/ }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /Tạo tổ chức/ }).click();
    await page.waitForURL(new RegExp(`/${slug}/`), { timeout: 15000 });
    const login = await request.post('/api/v1/auth/login', { headers: WEB, data: { email, password: 'mat-khau-tho-cham-1' } });
    const me = await request.get('/api/v1/auth/me', { headers: { ...WEB, authorization: `Bearer ${(await login.json()).accessToken}` } });
    const orgs = (await me.json()).organizations as { slug: string }[];
    console.log(`[giữ khoá] khoá 2 lần gửi: ${keys.join(' / ')}; giống nhau=${keys[0] === keys[1]}; số tổ chức của người dùng: ${orgs.length}; url=${page.url()}`);
    expect(keys.length).toBe(2);
    expect(keys[0]).toBe(keys[1]);
    expect(orgs.length).toBe(1);
  });
});

test.describe('J — N1: bấm nền mờ rồi Esc', () => {
  test('hộp thoại đóng, tiêu điểm về nút mở', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/xem-thu.html');
    const opener = page.getByRole('button', { name: 'Mở hộp thoại' }).first();
    await opener.click();
    const dlg = page.getByRole('dialog').first();
    await expect(dlg).toBeVisible();
    await page.mouse.click(5, 5);
    const focusTag = await page.evaluate(() => document.activeElement?.tagName);
    await page.keyboard.press('Escape');
    const open = await dlg.isVisible();
    console.log(`[N1] sau bấm nền: tiêu điểm ở <${focusTag}>; sau Esc hộp còn mở = ${open}`);
    expect(open).toBe(false);
  });
});
