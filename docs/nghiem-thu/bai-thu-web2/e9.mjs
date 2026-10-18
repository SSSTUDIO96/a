import { open, org, shot, close } from './h.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/bang-gia/di-chuyen'));
await page.waitForTimeout(1200);
await shot(page, 'kham-di-chuyen-trong');
console.log(await page.locator('main').innerText());
console.log(await page.locator('main').evaluate((d) => [...d.querySelectorAll('input,select,textarea,button,[role=radio]')].map((e) => `${e.tagName}:${e.getAttribute('role')??''}:${e.getAttribute('aria-label') ?? ''}:${(e.labels?.[0]?.innerText ?? '')}:${e.innerText ?? ''}`).join('\n')));
await close();
