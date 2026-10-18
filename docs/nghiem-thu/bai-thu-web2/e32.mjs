import { open, org, shot, close } from './h.mjs';
import { api } from './api.mjs';
const all = (await api('GET', '/contracts?pageSize=50')).body.items;
const hd1 = all.find((c) => c.code === 'HD-000001').id, hd5 = all.find((c) => c.code === 'HD-000005').id;
for (const u of ['letan', 'ketoan', 'ha']) {
  const { page, context } = await open(u, 'd');
  const res = [];
  for (const [n, p] of [['bang-gia', '/bang-gia/goi'], ['di-chuyen', '/bang-gia/di-chuyen'], ['hd-moi', '/hop-dong/moi'], ['hd-ds', '/hop-dong'], ['hd1', '/hop-dong/' + hd1], ['hd5-nhap', '/hop-dong/' + hd5], ['lich', '/lich?ngay=2026-11-21']]) {
    await page.goto(org(p)); await page.waitForTimeout(1800);
    const t = await page.locator('main').innerText().catch(() => '');
    const btns = (await page.locator('main button:visible').allInnerTexts()).map((x) => x.trim()).filter((x) => /Lưu|Xác nhận|Thêm|Huỷ|Phát sinh|Sửa/.test(x));
    const inputsEnabled = await page.locator('main input:enabled:visible, main textarea:enabled:visible').count();
    res.push(`${n}: ${t.replace(/\n/g, ' ').slice(0, 90)} | NÚT: ${[...new Set(btns)].join(',')} | ô nhập mở: ${inputsEnabled}`);
    await shot(page, `quyen-${u}-${n}`);
  }
  // thử mở hộp gói và bấm Lưu
  await page.goto(org('/bang-gia/goi')); await page.waitForTimeout(1500);
  const row = page.getByRole('button', { name: /Cô dâu – Ngày cưới/ });
  if (await row.count()) { await row.click(); await page.waitForTimeout(1000); const d = page.getByRole('dialog'); res.push('HỘP GÓI: nút ' + (await d.locator('button').allInnerTexts()).filter(Boolean).join(',') + ' | ô mở ' + (await d.locator('input:enabled').count()) + ' | tiền công hiện? ' + (await d.innerText()).includes('Tiền công')); }
  console.log('=== ' + u + '\n' + res.join('\n'));
  await context.close();
}
await close();
