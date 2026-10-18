import { open, org, shot, close } from './h.mjs';
for (const vp of ['d', 't', 'm']) {
  const { page, context } = await open('owner', vp);
  await page.goto(org('/bang-gia/goi')); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Cô dâu – Ngày cưới/ }).click(); await page.waitForTimeout(1500);
  const dlg = page.getByRole('dialog');
  const info = await dlg.evaluate((d) => {
    const heads = [...d.querySelectorAll('h3, h4, .pr-grp__t, [class*=group] > [class*=title]')].map((h) => h.innerText.trim()).filter(Boolean);
    const rows = [...d.querySelectorAll('input, select, [role=switch]')].length;
    return { heads, rows };
  });
  console.log(vp, 'NHÓM:', info.heads.join(' / '), '| SỐ ĐIỀU KHIỂN:', info.rows);
  if (vp === 'm') {
    const body = dlg.locator('.ui-dialog__body, [class*=body]').first();
    await body.evaluate((b) => { b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(300);
    await shot(page, 'hop-goi-390-cuoi');
  }
  await context.close();
}
await close();
