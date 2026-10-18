import { open, org, shot, close } from './h.mjs';
const { page } = await open('owner', 'd');
await page.goto(org('/bang-gia/goi'));
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Thêm gói cho cô dâu' }).click();
const dlg = page.getByRole('dialog');
await dlg.getByRole('button', { name: 'Thêm dịch vụ' }).click();
await page.waitForTimeout(300);
await shot(page, 'kham-goi-them-dv');
console.log(await dlg.evaluate((d) => [...d.querySelectorAll('input,select,textarea,button')].map((e) => `${e.tagName}:${e.getAttribute('aria-label') ?? ''}:${(e.labels?.[0]?.innerText ?? '')}:${e.tagName==='SELECT'?[...e.options].map(o=>o.text).join('/'):''}`).join('\n')));
// tấn công ô tiền: dán các kiểu
const gny = dlg.getByLabel('Giá niêm yết');
for (const v of ['1,5tr', '2.500.000đ', '2.500.000 ₫', '-500000', '99999999999999999999', '3000000']) {
  await gny.fill('');
  await gny.focus();
  await page.evaluate((t) => navigator.clipboard?.writeText?.(t), v).catch(() => {});
  // dán bằng sự kiện paste
  await gny.evaluate((el, t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, v);
  await page.waitForTimeout(100);
  await dlg.getByLabel('Tên gói').click();
  const shown = await gny.inputValue();
  const err = await gny.evaluate((el) => el.closest('.ui-field, .ui-setting, div')?.parentElement?.innerText ?? '');
  console.log(`DÁN "${v}" → ô hiện "${shown}" | quanh ô: ${err.replace(/\n/g, ' ⏎ ').slice(0, 160)}`);
}
await close();
