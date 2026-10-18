import { open, org, shot, close } from './h.mjs';
import { khach, ngay, dong } from './hd.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/hop-dong/moi')); await page.waitForTimeout(1500);
await khach(page, { new: true, name: 'Khách thử khối khách', phone: '0955555555' });
await ngay(page, '25/11/2026');
await page.locator('main').getByRole('button', { name: 'Thêm Mẹ cô dâu', exact: true }).click();
const c = page.locator('main section.ct-ln[data-dong]').first();
await dong(page, c, { start: '15:00', end: '16:00', loc: 'Studio', staff: [['Phạm Thanh Tú', 'Chính']] });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Lưu nháp' }).click(); await page.waitForTimeout(2000);
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
await shot(page, 'hd-sau-luu-khoi-khach');
const head = page.locator('main section.ct-head');
console.log('SAU LƯU NHÁP:', (await head.innerText()).replace(/\n/g, ' | '), '| ô họ tên còn mở:', await page.getByLabel('Họ tên khách').isEditable().catch(() => 'không có ô'));
// sửa tên khách rồi lưu lại → có tạo khách thứ hai không?
if (await page.getByLabel('Họ tên khách').count()) {
  await page.getByLabel('Họ tên khách').fill('Khách thử khối khách (sửa tên)');
  await page.getByRole('button', { name: 'Lưu nháp' }).click(); await page.waitForTimeout(2000);
}
await page.reload(); await page.waitForTimeout(2500);
console.log('SAU TẢI LẠI:', (await head.innerText()).replace(/\n/g, ' | '));
await close();
