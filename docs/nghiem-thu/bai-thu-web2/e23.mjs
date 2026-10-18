import { open, org, shot, close } from './h.mjs';
import { api } from './api.mjs';
const id = (await api('GET', '/contracts?pageSize=50')).body.items.find((c) => c.code === 'HD-000005').id;
const before = (await api('GET', '/contracts/' + id)).body;
console.log('TRƯỚC: discount', before.discount, 'notes', before.notes, 'lines', before.lines.length);
const t1 = await open('owner', 'd');
const ctx = t1.context; const p1 = t1.page;
const p2 = await ctx.newPage();
for (const p of [p1, p2]) { await p.goto(org('/hop-dong/' + id)); }
await p1.waitForTimeout(2500);
// tab 1: giảm giá 150.000, lưu
await p1.locator('main').getByLabel('Giảm giá').fill('150000');
await p1.waitForTimeout(800);
await p1.getByRole('button', { name: 'Lưu nháp' }).click();
await p1.waitForTimeout(1500);
console.log('SAU TAB 1:', (await api('GET', '/contracts/' + id)).body.discount);
// tab 2 (vẫn mở bản cũ): bỏ dòng dự tiệc + ghi chú, lưu
await p2.locator('main').getByLabel('Ghi chú hợp đồng').fill('Sửa ở tab 2');
await p2.waitForTimeout(800);
await p2.getByRole('button', { name: 'Lưu nháp' }).click();
await p2.waitForTimeout(1500);
const after = (await api('GET', '/contracts/' + id)).body;
console.log('SAU TAB 2: discount', after.discount, 'notes', after.notes, 'total', after.total);
console.log('TAB 2 có báo gì không:', (await p2.locator('main').innerText()).match(/[^\n]*(người khác|đã đổi|cũ|xung đột|tải lại)[^\n]*/gi));
await shot(p2, 'hai-tab-tab2-sau-luu');
// mất mạng giữa lưu
await ctx.setOffline(true);
await p2.waitForTimeout(500);
await p2.locator('main').getByLabel('Ghi chú hợp đồng').fill('Sửa lúc mất mạng');
await p2.waitForTimeout(500);
const save = p2.getByRole('button', { name: 'Lưu nháp' });
console.log('Mất mạng: nút Lưu nháp khoá?', await save.isDisabled());
await save.click({ timeout: 2000 }).catch(() => console.log('không bấm được Lưu (khoá)'));
await p2.waitForTimeout(1500);
console.log('Dải báo mất mạng:', (await p2.locator('body').innerText()).match(/[^\n]*(mạng|kết nối)[^\n]*/gi));
await shot(p2, 'mat-mang-khi-luu');
await ctx.setOffline(false);
await p2.waitForTimeout(1500);
console.log('Có mạng lại: còn chữ đã gõ?', await p2.locator('main').getByLabel('Ghi chú hợp đồng').inputValue());
await close();
