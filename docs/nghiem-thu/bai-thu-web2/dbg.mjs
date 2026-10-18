import { open, org, close } from './h.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/hop-dong/moi'));
await page.waitForTimeout(1500);
await page.locator('main').getByRole('button', { name: 'Thêm Cô dâu – Ngày cưới', exact: true }).click();
await page.waitForTimeout(500);
console.log(await page.locator('main').evaluate(() => [...document.querySelectorAll('section')].map((s) => s.className + ' | ' + s.getAttribute('aria-label')).join('\n')));
await close();
