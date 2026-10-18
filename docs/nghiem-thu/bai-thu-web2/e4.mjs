import { open, org, shot, close } from './h.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/bang-gia/dich-vu'));
await page.waitForTimeout(1000);
for (const [name, price, code] of [['Phụ phí sáng sớm (trước 5h)', '200000', 'PP-SOM'], ['Phụ phí ngày lễ', '300000', 'PP-LE']]) {
  await page.locator('main button[aria-label="Thêm phụ phí"]').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Tên', { exact: true }).fill(name);
  await dlg.getByLabel('Mã', { exact: true }).fill(code);
  await dlg.getByLabel('Thời lượng').fill('1');
  await dlg.getByLabel('Giá niêm yết').fill(price);
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForTimeout(900);
  await shot(page, 'dv-sau-tao-' + code);
  await dlg.getByRole('button', { name: 'Huỷ' }).click().catch(() => {});
  await page.waitForTimeout(300);
}
await shot(page, 'bang-gia-dich-vu-1440');
console.log(await page.locator('main').innerText());
await close();
