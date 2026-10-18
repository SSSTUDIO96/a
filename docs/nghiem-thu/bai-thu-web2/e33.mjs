import { open, org, shot, close, englishWords } from './h.mjs';
import { api } from './api.mjs';
const { page } = await open('owner', 'd', { locale: 'en-US', tz: 'America/Los_Angeles' });
const act = () => page.evaluate(() => { const a = document.activeElement; return `${a.tagName} ${a.getAttribute('aria-label') ?? ''} ${(a.innerText ?? '').slice(0, 30).replace(/\n/g, ' ')}`; });
await page.goto(org('/bang-gia/goi')); await page.waitForTimeout(1500);
let found = false;
for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if ((await act()).includes('Cô dâu – Ngày cưới')) { found = true; break; } }
console.log('Tab tới dòng gói:', found, await act());
await page.keyboard.press('Enter'); await page.waitForTimeout(1000);
console.log('Enter mở hộp:', await page.getByRole('dialog').isVisible(), '| tiêu điểm:', await act());
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
console.log('Esc đóng:', !(await page.getByRole('dialog').isVisible().catch(() => false)), '| tiêu điểm trả về:', await act());
// hợp đồng bằng bàn phím
await page.goto(org('/hop-dong/moi')); await page.waitForTimeout(1500);
found = false;
for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if ((await act()).includes('Thêm Phù dâu')) { found = true; break; } }
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
console.log('Enter thêm dòng:', await page.locator('section.ct-ln[data-dong]').count());
// en-US + múi giờ Mỹ: xem HD1 và lịch
const id = (await api('GET', '/contracts?pageSize=50')).body.items.find((c) => c.code === 'HD-000001').id;
await page.goto(org('/hop-dong/' + id)); await page.waitForTimeout(2000);
const t = await page.locator('main').innerText();
console.log('en-US HD1:', t.match(/Đã xác nhận[^\n]*/)?.[0], '| ngày ô:', await page.getByRole('textbox', { name: 'Ngày sự kiện' }).inputValue(), '| giờ:', await page.getByRole('textbox', { name: 'Giờ bắt đầu' }).first().inputValue(), '| tổng:', t.match(/Tổng\n?([\d.,]+ ₫)/)?.[1], '| chữ lạ:', (await englishWords(page)).join(','));
await shot(page, 'en-US-hd1');
await page.goto(org('/lich?ngay=2026-11-21')); await page.waitForTimeout(2000);
console.log('en-US lịch:', (await page.locator('main').innerText()).replace(/\n/g, ' ').slice(0, 300));
await shot(page, 'en-US-lich');
await close();
