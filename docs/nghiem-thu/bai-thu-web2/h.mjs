// Tiện ích chung của thợ chấm.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
export const BASE = 'http://localhost:5190';
export const SHOT_DIR = '/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-web2-bien-ban/anh';
export const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
export const VP = { d: { width: 1440, height: 900 }, t: { width: 1024, height: 768 }, m: { width: 390, height: 844 } };
let browser;
export async function open(user = 'owner', vp = 'd', opts = {}) {
  browser ??= await chromium.launch();
  const context = await browser.newContext({ viewport: VP[vp] ?? vp, locale: opts.locale ?? 'vi-VN', timezoneId: opts.tz ?? 'Asia/Ho_Chi_Minh', ...(vp === 'm' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
  await page.goto(BASE + '/dang-nhap');
  await page.getByLabel('Email').fill(seed.users[user].email);
  await page.getByLabel('Mật khẩu').fill(seed.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.includes('dang-nhap'));
  return { context, page };
}
export const org = (p = '') => `${BASE}/${seed.org.slug}${p}`;
export async function shot(page, name, full = false) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: full });
  return `${SHOT_DIR}/${name}.png`;
}
export async function overflow(page) {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
}
// Chữ tiếng Anh / không dấu lọt ra màn: tìm vài từ hay gặp.
export async function englishWords(page) {
  const txt = await page.evaluate(() => document.body.innerText);
  const bad = txt.match(/\b(Loading|Error|Save|Cancel|Submit|Delete|Edit|undefined|null|NaN|Invalid|Required|true|false|Select|Search|Close|Untitled)\b/g);
  return bad ? [...new Set(bad)] : [];
}
export async function close() { await browser?.close(); }
