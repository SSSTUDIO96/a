import { open, org, shot, close, overflow, englishWords } from './h.mjs';
const out = [];
for (const [vp, w] of [['d', 1440], ['t', 1024], ['m', 390]]) {
  const { page, context } = await open('owner', vp);
  await page.goto(org('/lich?ngay=2026-11-28'));
  await page.waitForTimeout(2500);
  const modes = vp === 'm' ? [['C', 'Tuần'], ['B', 'Ngày'], ['A', 'Cột thợ']] : [['C', 'Thợ × ngày'], ['B', 'Ngày'], ['A', 'Cột thợ']];
  for (const [mode, label] of modes) {
    await page.getByRole('radio', { name: label, exact: true }).click().catch(async () => await page.getByRole('button', { name: label, exact: true }).click());
    await page.waitForTimeout(1500);
    const o = await overflow(page);
    const chips = await page.locator('[data-appt]').count();
    const inner = await page.evaluate(() => { const b = document.querySelector('.ws-body'); return b ? `${b.scrollWidth}/${b.clientWidth}` : '?'; });
    out.push(`${w} ${mode}: trang ${o.scrollWidth}/${o.innerWidth} | thân lịch ${inner} | số ô ca ${chips} | chữ lạ ${(await englishWords(page)).join(',') || 0}`);
    await shot(page, `lich-dày-${mode}-${w}`);
  }
  await context.close();
}
console.log(out.join('\n'));
await close();
