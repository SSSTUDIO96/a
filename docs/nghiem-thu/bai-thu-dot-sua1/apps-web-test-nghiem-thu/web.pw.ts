// THỢ CHẤM — bài thử trên trình duyệt thật (Chromium) cho web W0–W2. Không thuộc sản phẩm.
// "LỖI:" qua = lỗi có thật; "CHẶN:" qua = hành vi đúng; "GHI NHẬN:" qua = hành vi có thật, cần chủ quyết.
import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const SHOTS = '/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-sua1-bien-ban/anh';
const WEB = { 'X-Client': 'web' };

async function registerWeb(req: APIRequestContext, label: string) {
  const email = `nt-${label}-${randomUUID().slice(0, 8)}@makeup.test`;
  const password = 'mat-khau-tho-cham-1';
  const r = await req.post('/api/v1/auth/register', { headers: WEB, data: { email, password, fullName: `Thợ chấm ${label}` } });
  expect(r.status()).toBe(201);
  const body = await r.json();
  return { email, password, token: body.accessToken as string, id: body.user.id as string };
}

async function createOrg(req: APIRequestContext, token: string) {
  const slug = `nt-web-${randomUUID().slice(0, 8)}`;
  const r = await req.post('/api/v1/orgs', { headers: { ...WEB, authorization: `Bearer ${token}` }, data: { name: `Studio ${slug}`, slug, kind: 'TEAM' } });
  expect(r.status()).toBe(201);
  const b = await r.json();
  return { id: b.id as string, slug };
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const bad: string[] = [];
    for (const e of Array.from(document.querySelectorAll('body *'))) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1 && bad.length < 6) {
        bad.push(`${e.tagName.toLowerCase()}.${String((e as HTMLElement).className || '').slice(0, 30)} → ${Math.round(r.right)}px "${(e.textContent || '').trim().slice(0, 30)}"`);
      }
    }
    return { vw, sw, bad };
  });
}

// Gọi hàm của web (đúng module app đang dùng — Vite dev phục vụ cùng một URL module).
async function inApp<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ({ fn, args }) => {
      const auth = '/src/api/auth.ts';
      const catalog = '/src/api/catalog.ts';
      const staff = '/src/api/staff.ts';
      const errors = '/src/api/errors.ts';
      const mods: Record<string, Record<string, (...a: unknown[]) => unknown>> = {
        auth: await import(/* @vite-ignore */ auth),
        catalog: await import(/* @vite-ignore */ catalog),
        staff: await import(/* @vite-ignore */ staff),
      };
      const err = await import(/* @vite-ignore */ errors);
      const [m, f] = fn.split('.');
      try {
        const v = await mods[m!]![f!]!(...args);
        return { ok: true, value: v } as unknown;
      } catch (e) {
        return { ok: false, kind: err.errorKind(e), status: (e as { status?: number }).status, message: (e as Error).message, fields: err.fieldErrors(e) } as unknown;
      }
    },
    { fn, args },
  ) as Promise<T>;
}

type R = { ok: boolean; value?: unknown; kind?: string; status?: number; message?: string; fields?: Record<string, string> };

test.describe('1. Tràn ngang ở 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('trang xem thử, hộp thoại, ngăn kéo; trang đăng nhập, đăng ký, tạo tổ chức, khung tổ chức', async ({ page, request }) => {
    const out: Record<string, { sw: number; vw: number; bad: string[] }> = {};
    await page.goto('/xem-thu.html');
    await page.waitForLoadState('networkidle');
    out['xem-thu'] = await overflow(page);
    await page.screenshot({ path: `${SHOTS}/390-xem-thu.png`, fullPage: true });
    await page.getByRole('button', { name: 'Mở hộp thoại' }).click();
    out['xem-thu + hộp thoại'] = await overflow(page);
    await page.screenshot({ path: `${SHOTS}/390-hop-thoai.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Mở ngăn kéo đáy' }).click();
    out['xem-thu + ngăn kéo'] = await overflow(page);
    await page.keyboard.press('Escape');
    for (const p of ['/dang-nhap', '/dang-ky']) {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
      out[p] = await overflow(page);
    }
    const u = await registerWeb(page.request, 'tran');
    await page.goto('/tao-to-chuc');
    await page.waitForLoadState('networkidle');
    out['/tao-to-chuc'] = await overflow(page);
    const org = await createOrg(request, u.token);
    await page.goto(`/${org.slug}/lich`);
    await page.waitForLoadState('networkidle');
    out['khung tổ chức'] = await overflow(page);
    await page.screenshot({ path: `${SHOTS}/390-khung.png`, fullPage: true });
    console.log('[thợ chấm] tràn ngang 390px:', JSON.stringify(out, null, 1));
    for (const [k, v] of Object.entries(out)) expect(v.sw, `${k}: ${v.bad.join(' | ')}`).toBeLessThanOrEqual(v.vw);
  });
});

test.describe('2. Bàn phím: Dialog, Tooltip, Segmented (trang xem thử, 1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('CHẶN: Tab/Shift+Tab không rời hộp; Esc đóng và trả tiêu điểm; hộp chồng chỉ đóng hộp trên cùng; Esc trên "?" chỉ đóng tooltip', async ({ page }) => {
    await page.goto('/xem-thu.html');
    const opener = page.getByRole('button', { name: 'Mở hộp thoại' });
    await opener.click();
    const dlg = page.getByRole('dialog', { name: 'Cô dâu – Ngày cưới' });
    await expect(dlg).toBeVisible();
    const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    expect(await inside()).toBe(true);
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      expect(await inside(), `Tab lần ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inside(), `Shift+Tab lần ${i + 1}`).toBe(true);
    }
    // Tooltip "?" trong hộp: tiêu điểm vào → hiện; Esc → tắt tooltip, hộp còn mở
    await dlg.getByRole('button', { name: 'Giải thích' }).first().focus();
    const tip = page.getByRole('tooltip', { name: 'Để Mọi nhân vật nếu gói dùng cho ai cũng được.' });
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await expect(dlg).toBeVisible();
    // Hộp chồng: trang xem thử ở commit 9b1db79 không còn nút mở hộp chồng (thợ chấm đợt sửa 1 bỏ đoạn này;
    // ca hộp chồng do src/ui/Dialog.test.tsx "hai hộp chồng, tiêu điểm ở <body>…" phủ).
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    expect(await opener.evaluate((el) => el === document.activeElement)).toBe(true);
  });

  test('LỖI: bấm chuột ra nền mờ (ngoài hộp) rồi bấm Esc — hộp KHÔNG đóng (tiêu điểm rơi ra body, Esc không tới hộp)', async ({ page }) => {
    await page.goto('/xem-thu.html');
    await page.getByRole('button', { name: 'Mở hộp thoại' }).click();
    const dlg = page.getByRole('dialog', { name: 'Cô dâu – Ngày cưới' });
    await expect(dlg).toBeVisible();
    await page.mouse.click(40, 860); // nền mờ, ngoài khung hộp
    const active = await page.evaluate(() => document.activeElement?.tagName);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    console.log(`[thợ chấm] sau khi bấm nền: tiêu điểm ở <${active}>, hộp còn mở = ${await dlg.isVisible()}`);
    expect(active).toBe('BODY');
    await expect(dlg).toBeVisible();
  });

  test('GHI NHẬN: Segmented — mũi tên chỉ dời tiêu điểm, không chọn (khác mẫu radiogroup của WAI-ARIA); Space chọn; ô khoá có lý do đọc được', async ({ page }) => {
    await page.goto('/xem-thu.html');
    const group = page.getByRole('radiogroup', { name: 'Làm ở đâu' }).first();
    const studio = group.getByRole('radio', { name: 'Studio' });
    await studio.click();
    await expect(studio).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    const home = group.getByRole('radio', { name: 'Tại nhà' });
    await expect(home).toBeFocused();
    await expect(home).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Space');
    await expect(home).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    const other = group.getByRole('radio', { name: 'Nơi khác' });
    await expect(other).toBeFocused();
    await expect(page.getByRole('tooltip', { name: 'Gói này không làm nơi khác' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(other).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('3. Phiên đăng nhập trên trình duyệt thật (thẻ ngắn hạn 4 giây)', () => {
  test('CHẶN: token không nằm trong kho JS/cookie đọc được; thiếu X-Client thì cookie không đổi được thẻ', async ({ page }) => {
    await registerWeb(page.request, 'phien1');
    await page.goto('/');
    await expect(page).toHaveURL(/\/tao-to-chuc$/);
    const seen = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
    }));
    expect(seen.cookie).not.toContain('mp_refresh');
    expect(seen.local + seen.session).not.toMatch(/eyJ|refresh/i);
    const noHeader = await page.evaluate(async () => (await fetch('/api/v1/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
    expect(noHeader).toBe(401);
  });

  test('CHẶN: 6 yêu cầu cùng gặp thẻ hết hạn → đúng 1 lần refresh; hai thẻ trình duyệt cùng refresh không đá nhau ra', async ({ page, context }) => {
    await registerWeb(page.request, 'phien2');
    await page.goto('/');
    await expect(page).toHaveURL(/\/tao-to-chuc$/);
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2).toHaveURL(/\/tao-to-chuc$/);
    let refreshes = 0;
    const statuses: number[] = [];
    context.on('response', (r) => {
      if (r.url().endsWith('/api/v1/auth/refresh')) {
        refreshes++;
        statuses.push(r.status());
      }
    });
    await page.waitForTimeout(5_000); // thẻ ngắn hạn hết hạn
    const many = await page.evaluate(async () => {
      const p = '/src/api/auth.ts';
      const auth = await import(/* @vite-ignore */ p);
      const rs = await Promise.allSettled(Array.from({ length: 6 }, () => auth.getMe()));
      return rs.map((r) => r.status);
    });
    expect(many).toEqual(Array(6).fill('fulfilled'));
    expect(refreshes).toBe(1);
    await page.waitForTimeout(5_000);
    refreshes = 0;
    // Cả hai thẻ cùng tải lại một lúc
    await Promise.all([page.reload(), page2.reload()]);
    await page.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tao-to-chuc$/);
    await expect(page2).toHaveURL(/\/tao-to-chuc$/);
    console.log(`[thợ chấm] hai thẻ tải lại cùng lúc: ${refreshes} lần refresh, mã ${statuses.join(',')}`);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  test('GHI NHẬN: đăng xuất ở thẻ A, thẻ B vẫn gọi API được tới khi thẻ ngắn hạn hết hạn, rồi mới về trang đăng nhập', async ({ page, context, request }) => {
    const u = await registerWeb(page.request, 'phien3');
    const org = await createOrg(request, u.token);
    await page.goto(`/${org.slug}/lich`);
    await expect(page.getByText(`Studio ${org.slug}`)).toBeVisible();
    const pageB = await context.newPage();
    await pageB.goto(`/${org.slug}/lich`);
    await expect(pageB.getByText(`Studio ${org.slug}`)).toBeVisible();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);
    const right = await inApp<R>(pageB, 'auth.getMe');
    expect(right.ok).toBe(true); // B vẫn còn dùng được
    await pageB.waitForTimeout(5_000);
    const after = await inApp<R>(pageB, 'auth.getMe');
    expect(after.ok).toBe(false);
    await expect(pageB).toHaveURL(/\/dang-nhap$/);
  });
});

test.describe('4. Ánh xạ lỗi với máy chủ thật', () => {
  test('CHẶN: 400 có lỗi theo ô; 404; 409; 403; mất mạng; 502 trả HTML', async ({ page, browser, request }) => {
    const u = await registerWeb(page.request, 'loi');
    const org = await createOrg(request, u.token);
    await page.goto(`/${org.slug}/lich`);
    await expect(page.getByText(`Studio ${org.slug}`)).toBeVisible();
    const v400 = await inApp<R>(page, 'catalog.createServiceCategory', org.id, { name: '' }, randomUUID());
    expect(v400.kind).toBe('validation');
    expect(v400.fields?.name).toBeTruthy();
    const v404 = await inApp<R>(page, 'catalog.getService', org.id, randomUUID());
    expect(v404.kind).toBe('not_found');
    const name = `Bậc ${randomUUID().slice(0, 4)}`;
    await inApp<R>(page, 'staff.createStaffTier', org.id, { name }, randomUUID());
    const v409 = await inApp<R>(page, 'staff.createStaffTier', org.id, { name }, randomUUID());
    expect(v409.kind).toBe('conflict');
    // 403: thợ makeup tạo dịch vụ
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    const a = await registerWeb(p2.request, 'tho');
    const add = await request.post(`/api/v1/orgs/${org.id}/members`, {
      headers: { ...WEB, authorization: `Bearer ${u.token}` },
      data: { email: a.email, roleKeys: ['artist'] },
    });
    expect(add.status()).toBe(201);
    await p2.goto(`/${org.slug}/lich`);
    await p2.waitForLoadState('networkidle');
    const v403 = await inApp<R>(p2, 'catalog.createService', org.id, { code: 'X', name: 'X', durationMinutes: 30, listPrice: 1 }, randomUUID());
    expect(v403.kind).toBe('forbidden');
    await ctx2.close();
    // Mất mạng và 502 dạng HTML
    await page.route('**/api/v1/orgs/*/service-categories', (r) => r.abort('internetdisconnected'));
    const vNet = await inApp<R>(page, 'catalog.listServiceCategories', org.id);
    expect(vNet.kind).toBe('network');
    await page.unroute('**/api/v1/orgs/*/service-categories');
    await page.route('**/api/v1/orgs/*/service-categories', (r) => r.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' }));
    const v502 = await inApp<R>(page, 'catalog.listServiceCategories', org.id);
    expect(v502.kind).toBe('server');
    expect(v502.message).toContain('502');
  });
});

test.describe('5. Chữ tiếng Việt', () => {
  test('CHẶN: phông Be Vietnam Pro nạp được và có đủ dấu (ệ, ỗ, ữ, đ, ₫)', async ({ page }) => {
    await page.goto('/xem-thu.html');
    await page.waitForLoadState('networkidle');
    const r = await page.evaluate(async () => {
      await document.fonts.ready;
      const fam = getComputedStyle(document.body).fontFamily;
      const ok = document.fonts.check('16px "Be Vietnam Pro"', 'Nguyễn Thị Hoa đã đặt 1.500.000 ₫ — Phù dâu, Mẹ chú rể, Lễ tân, Bỏ dòng');
      const loaded = Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`);
      return { fam, ok, loaded };
    });
    expect(r.fam).toContain('Be Vietnam Pro');
    expect(r.ok).toBe(true);
  });
});
