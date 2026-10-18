import { open, org, shot, close } from './h.mjs';
import { api } from './api.mjs';
const all = (await api('GET', '/contracts?pageSize=50')).body.items;
const idOf = (c) => all.find((x) => x.code === c).id;
const { page } = await open('owner', 'd');
// Huỷ dòng phụ phí ở HD-000001
await page.goto(org('/hop-dong/' + idOf('HD-000001')));
await page.waitForTimeout(2000);
const m = page.locator('main');
await m.getByRole('button', { name: 'Huỷ dòng' }).last().click();
let dlg = page.getByRole('dialog');
console.log('HỘP HUỶ DÒNG:', (await dlg.innerText()).replace(/\n/g, ' | '));
await dlg.getByRole('button', { name: /Huỷ dòng|Xác nhận|Đồng ý/ }).last().click();
await page.waitForTimeout(500);
console.log('bấm khi chưa ghi lý do →', (await dlg.innerText()).replace(/\n/g, ' | ').slice(0, 200));
await dlg.getByRole('textbox').fill('Khách đổi giờ, không còn ca sớm');
await dlg.getByRole('button', { name: /Huỷ dòng|Xác nhận|Đồng ý/ }).last().click();
await page.waitForTimeout(1500);
// Thêm phát sinh: phụ phí ngày lễ
await m.getByRole('button', { name: 'Thêm Phụ phí ngày lễ' }).click();
await page.waitForTimeout(500);
dlg = page.getByRole('dialog');
console.log('HỘP PHÁT SINH:', (await dlg.innerText()).replace(/\n/g, ' | '));
await dlg.getByRole('button', { name: /Thêm|Lưu/ }).last().click();
await page.waitForTimeout(1500);
await shot(page, 'hd1-huy-dong-phat-sinh', true);
console.log('HD1:', (await m.innerText()).split('Phụ phí & khoản khác')[1]?.slice(0, 500).replace(/\n/g, ' | '));
const s = (await api('GET', '/contracts/' + idOf('HD-000001'))).body;
console.log('MÁY CHỦ HD1: sub', s.subtotal, 'disc', s.discount, 'total', s.total, s.lines.map((l) => `${l.kind}:${l.name}:${l.lineTotal}:${l.voidedAt ? 'HUỶ' : ''}:${l.addedAfterConfirm ? 'PS' : ''}`).join(' ; '));
// Huỷ hợp đồng nháp HD-000004
await page.goto(org('/hop-dong/' + idOf('HD-000004')));
await page.waitForTimeout(2000);
await m.getByRole('button', { name: 'Huỷ hợp đồng' }).click().catch((e) => console.log('không có nút Huỷ hợp đồng ở nháp'));
dlg = page.getByRole('dialog');
if (await dlg.isVisible().catch(() => false)) {
  await dlg.getByRole('textbox').fill('Khách chọn studio khác');
  await dlg.getByRole('button', { name: /Huỷ hợp đồng|Xác nhận/ }).last().click();
  await page.waitForTimeout(1500);
}
await shot(page, 'hd4-da-huy');
console.log('HD4:', (await m.innerText()).slice(0, 300).replace(/\n/g, ' | '));
await close();
