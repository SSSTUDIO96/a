import { open, org, shot, close, overflow, englishWords } from './h.mjs';
const screens = [['bang-gia-goi', '/bang-gia/goi'], ['bang-gia-dich-vu', '/bang-gia/dich-vu'], ['bang-gia-di-chuyen', '/bang-gia/di-chuyen'], ['bang-gia-nhan-vat', '/bang-gia/nhan-vat'], ['hop-dong-ds', '/hop-dong'], ['hop-dong-moi', '/hop-dong/moi'], ['lich', '/lich?ngay=2026-11-21']];
const out = [];
for (const [vp, w] of [['d', 1440], ['t', 1024], ['m', 390]]) {
  const { page, context } = await open('owner', vp);
  for (const [n, p] of screens) {
    await page.goto(org(p)); await page.waitForTimeout(2000);
    const o = await overflow(page); const en = await englishWords(page);
    out.push(`${w} ${n}: rộng ${o.scrollWidth}/${o.innerWidth}${o.scrollWidth > o.innerWidth ? ' TRÀN' : ''} | chữ lạ: ${en.join(',') || '0'}`);
    await shot(page, `${n}-${w}`);
  }
  // hộp chi tiết gói
  await page.goto(org('/bang-gia/goi')); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Cô dâu – Ngày cưới/ }).click(); await page.waitForTimeout(1200);
  const o = await overflow(page);
  out.push(`${w} hop-goi: rộng ${o.scrollWidth}/${o.innerWidth}`);
  await shot(page, `hop-goi-${w}`);
  if (vp === 'm') await shot(page, `hop-goi-${w}-full`, true);
  await context.close();
}
console.log(out.join('\n'));
await close();
