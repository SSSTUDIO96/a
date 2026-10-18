import { open, org, shot, close } from './h.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/bang-gia/dich-vu'));
await page.waitForTimeout(1000);
const plus = page.locator('main .ui-card button, main button').filter({ hasText: '' });
console.log(await page.locator('main button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') + '|' + b.title)));
const items = [
  [0, 'Làm tóc', '60', '300000', 'TOC'],
  [0, 'Làm nail', '45', '200.000', 'NAIL'],
  [0, 'Lens', '10', '100000', 'LENS'],
  [0, 'Kẹp mi', '20', '150000', 'KEPMI'],
  [1, 'Phụ phí sáng sớm (trước 5h)', '0', '200000', 'PP-SOM'],
  [1, 'Phụ phí ngày lễ', '0', '300000', 'PP-LE'],
  [2, 'Makeup cô dâu', '90', '2000000', 'MK-CD'],
  [2, 'Makeup khách', '45', '500000', 'MK-KH'],
];
for (const [sec, name, dur, price, code] of items) {
  const addBtns = page.locator('main button[aria-label^="Thêm"]');
  await addBtns.nth(sec).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Tên', { exact: true }).fill(name);
  await dlg.getByLabel('Mã', { exact: true }).fill(code);
  if (dur) await dlg.getByLabel('Thời lượng').fill(dur);
  await dlg.getByLabel('Giá niêm yết').fill(price);
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForTimeout(900);
  const still = await dlg.isVisible().catch(() => false);
  if (still) { console.log('VẪN MỞ sau Lưu:', name, await dlg.innerText()); await shot(page, 'loi-luu-dv-' + name.replace(/\W+/g,'-')); await dlg.getByRole('button', { name: 'Huỷ' }).click().catch(()=>{}); }
}
await page.waitForTimeout(800);
await shot(page, 'bang-gia-dich-vu-1440');
console.log(await page.locator('main').innerText());
await close();
