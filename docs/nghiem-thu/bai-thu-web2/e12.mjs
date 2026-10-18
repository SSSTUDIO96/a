import { open, org, shot, close } from './h.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/bang-gia/di-chuyen'));
await page.waitForTimeout(1200);
const m = page.locator('main');
for (const [n, a] of [['Studio Hoàn Kiếm', '12 Hàng Bài, Hoàn Kiếm, Hà Nội'], ['Cửa hàng Cầu Giấy', '88 Trần Thái Tông, Cầu Giấy, Hà Nội']]) {
  await m.getByRole('button', { name: 'Thêm studio / cửa hàng' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Tên').fill(n);
  await dlg.getByLabel('Địa chỉ').fill(a);
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForTimeout(900);
  if (await dlg.isVisible()) console.log('VẪN MỞ', await dlg.innerText());
}
await page.waitForTimeout(500);
await shot(page, 'bang-gia-di-chuyen-1440', true);
console.log(await m.innerText());
await close();
