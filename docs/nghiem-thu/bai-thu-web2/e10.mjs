import { open, org, shot, close } from './h.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/bang-gia/di-chuyen'));
await page.waitForTimeout(1200);
const m = page.locator('main');
const km = m.getByLabel('Bán kính miễn phí');
for (const v of ['12,5', '2.500', '2.5', '12,345', '100000', '3']) {
  await km.fill('');
  await km.pressSequentially(v, { delay: 20 });
  await m.getByLabel('Phí tối thiểu').click();
  const around = await km.evaluate((el) => el.closest('.ui-setting, .pr-row, li, div')?.parentElement?.innerText ?? '');
  console.log(`GÕ "${v}" → ô "${await km.inputValue()}" | ${around.replace(/\n/g, ' ⏎ ').slice(0, 120)}`);
}
await m.getByRole('radio', { name: 'Theo km' }).click();
await m.getByLabel('Mức cố định mỗi lần đi').fill('200000');
await m.getByLabel('Đơn giá mỗi km').fill('10000');
await m.getByLabel('Phí tối thiểu').fill('50000');
await m.getByRole('switch', { name: 'Tính cả chiều về' }).click();
await page.waitForTimeout(300);
await shot(page, 'di-chuyen-dang-sua');
console.log(await page.locator('body').innerText().then(t=>t.slice(-400)));
console.log(await page.locator('button').allInnerTexts());
await close();
