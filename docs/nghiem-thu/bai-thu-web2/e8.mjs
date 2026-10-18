import { open, org, shot, close } from './h.mjs';
import { taoGoi } from './pkg.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/bang-gia/goi'));
await page.waitForTimeout(1000);
let dlg;
const goi = [
  ['Thêm gói cho mẹ cô dâu', { code: 'G-MCD', name: 'Mẹ cô dâu', dur: 45, list: 1000000, sale: 900000, deposit: 0, loc: 'SH', included: ['Makeup khách'], addons: ['Làm tóc'] }],
  ['Thêm gói cho phù dâu', { code: 'G-PD', name: 'Phù dâu', dur: 45, list: 500000, deposit: 0, loc: 'SHO', included: ['Makeup khách'], addons: ['Kẹp mi', 'Làm tóc'] }],
  ['Thêm gói cho mọi nhân vật', { code: 'G-TIEC', name: 'Makeup dự tiệc (rất dài để thử cắt chữ trên thẻ và trong hợp đồng của studio)', dur: 60, list: 450000, deposit: 100000, loc: 'S', included: ['Makeup khách'] }],
];
for (const [btn, g] of goi) {
  await page.getByRole('button', { name: btn }).first().click().catch(async (e) => { console.log('không thấy nút', btn); await page.getByRole('button', { name: 'Thêm gói', exact: true }).click(); });
  await taoGoi(page, g);
  dlg = page.getByRole('dialog');
  if (await dlg.isVisible()) {
    const t = await dlg.innerText();
    if (t.includes('Tiền công thợ theo bậc') && !t.includes('Gói mới')) {
      await dlg.getByLabel('Thợ chính bậc 1').fill('300000').catch(() => {});
      await dlg.getByRole('button', { name: 'Lưu' }).click();
      await page.waitForTimeout(1000);
    } else console.log('LỖI tạo', g.name, t.slice(0, 400));
  }
  if (await dlg.isVisible()) { console.log('vẫn mở', g.name); await dlg.getByRole('button', { name: 'Huỷ' }).click(); }
}
await page.waitForTimeout(800);
await shot(page, 'bang-gia-goi-1440');
console.log(await page.locator('main').innerText());
await close();
