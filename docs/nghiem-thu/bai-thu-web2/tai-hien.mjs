// Bài tái hiện các lỗi chính của biên bản Web 2. Chạy: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tai-hien.mjs
// Cần: máy chủ API cổng 4120 + vite preview cổng 5190 + seed.json (seed-nguoi.mjs) + bảng giá đã dựng (gói G-PD, G-MCD).
// Mỗi mục in "LỖI CÒN" nếu lỗi còn tái hiện được, "ĐÃ HẾT" nếu không.
import { open, org, close, seed } from './h.mjs';
import { api } from './api.mjs';
const pk = (await api('GET', '/packages?pageSize=50')).body.items;
const PD = pk.find((p) => p.code === 'G-PD').id;
const tag = Date.now() % 100000;
const day = '2026-12-0' + (1 + (tag % 8));
const line = (s, e, who) => ({ kind: 'PACKAGE', packageId: PD, quantity: 1, locationType: 'STUDIO', scheduledStart: `${day}T${s}:00+07:00`, scheduledEnd: `${day}T${e}:00+07:00`, staff: who ? [{ membershipId: seed.users[who].membershipId, role: 'PRIMARY' }] : [] });
const body = (l, name) => ({ newCustomer: { fullName: `${name} ${tag}` }, eventDate: `${day}T00:00:00+07:00`, lines: [l] });
const kq = [];

// T1 — hai hợp đồng NHÁP cùng thợ cùng giờ: màn khoá nút Xác nhận (đỏ) dù máy chủ cho xác nhận
{
  const a = (await api('POST', '/contracts', body(line('06:00', '07:00', 'my'), 'Nháp A'))).body;
  await api('POST', '/contracts', body(line('06:30', '07:30', 'my'), 'Nháp B'));
  const { page, context } = await open('owner', 'd');
  await page.goto(org('/hop-dong/' + a.id)); await page.waitForTimeout(2500);
  const locked = await page.getByRole('button', { name: 'Xác nhận hợp đồng' }).isDisabled();
  const red = (await page.locator('main').innerText()).includes('hợp đồng sẽ không xác nhận được');
  const server = await api('POST', `/contracts/${a.id}/status`, { to: 'CONFIRMED' });
  kq.push(`T1 giữ chỗ nháp chặn nhầm: màn khoá=${locked}, dải đỏ=${red}, máy chủ xác nhận → ${server.status} ⇒ ${locked && server.status === 200 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
  await context.close();
}
// N0 — xác nhận hợp đồng không có thợ: không có ca nào trên Lịch
{
  const c = (await api('POST', '/contracts', body(line('15:00', '16:00', null), 'Không thợ'))).body;
  const s = await api('POST', `/contracts/${c.id}/status`, { to: 'CONFIRMED' });
  const ap = await api('GET', `/appointments?from=${day}T00:00:00%2B07:00&to=${day}T23:59:00%2B07:00&contractId=${c.id}`);
  kq.push(`NGHIÊM TRỌNG xác nhận không thợ: xác nhận → ${s.status}, số ca trên lịch = ${ap.body.items.length} ⇒ ${s.status === 200 && ap.body.items.length === 0 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
}
// T2 — hai thẻ trình duyệt cùng sửa một nháp: thẻ sau ghi đè im lặng giảm giá của thẻ trước
{
  const c = (await api('POST', '/contracts', body(line('10:00', '11:00', 'tu'), 'Hai tab'))).body;
  const { page: p1, context } = await open('owner', 'd');
  const p2 = await context.newPage();
  await p1.goto(org('/hop-dong/' + c.id)); await p2.goto(org('/hop-dong/' + c.id)); await p1.waitForTimeout(2500);
  await p1.locator('main').getByLabel('Giảm giá').fill('100000'); await p1.waitForTimeout(800);
  await p1.getByRole('button', { name: 'Lưu nháp' }).click(); await p1.waitForTimeout(1500);
  const mid = (await api('GET', '/contracts/' + c.id)).body.discount;
  await p2.locator('main').getByLabel('Ghi chú hợp đồng').fill('tab 2'); await p2.waitForTimeout(800);
  await p2.getByRole('button', { name: 'Lưu nháp' }).click(); await p2.waitForTimeout(1500);
  const end = (await api('GET', '/contracts/' + c.id)).body.discount;
  kq.push(`T2 hai thẻ ghi đè: giảm giá sau thẻ 1 = ${mid}, sau thẻ 2 = ${end} ⇒ ${mid === 100000 && end === 0 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
  await context.close();
}
// T3 — Lịch: gõ giờ kết thúc trước giờ bắt đầu → lưu thành ca qua đêm ~23 giờ
{
  const a = (await api('POST', '/appointments', { startsAt: `${day}T13:00:00+07:00`, endsAt: `${day}T14:00:00+07:00`, title: 'Thử giờ ngược', newCustomer: { fullName: 'Giờ ngược ' + tag }, locationType: 'STUDIO', staff: [{ membershipId: seed.users.linh.membershipId, role: 'PRIMARY' }], status: 'CONFIRMED' })).body;
  const { page, context } = await open('owner', 'd');
  await page.goto(org('/lich?ca=' + a.id)); await page.waitForTimeout(2500);
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Sửa' }).click(); await page.waitForTimeout(500);
  await dlg.getByRole('textbox', { name: 'Giờ bắt đầu' }).fill('14:00');
  await dlg.getByRole('textbox', { name: 'Giờ kết thúc' }).fill('13:30');
  await dlg.getByLabel('Tên ca').click();
  await dlg.getByRole('button', { name: 'Lưu' }).click(); await page.waitForTimeout(1500);
  const g = (await api('GET', '/appointments/' + a.id)).body;
  const hours = (new Date(g.endsAt) - new Date(g.startsAt)) / 3.6e6;
  kq.push(`T3 giờ ngược ở Lịch: ca lưu dài ${hours} giờ ⇒ ${hours > 12 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
  await context.close();
}
// T4 — lễ tân không huỷ được MỘT dòng đã chốt nhưng huỷ được CẢ hợp đồng đã chốt
{
  const c = (await api('POST', '/contracts', body(line('18:00', '19:00', 'ha'), 'Lễ tân huỷ'))).body;
  await api('POST', `/contracts/${c.id}/status`, { to: 'CONFIRMED' });
  const d = (await api('GET', '/contracts/' + c.id)).body;
  const v = await api('POST', `/contracts/${c.id}/lines/${d.lines[0].id}/void`, { reason: 'thử' }, 'letan');
  const x = await api('POST', `/contracts/${c.id}/status`, { to: 'CANCELLED', reason: 'thử' }, 'letan');
  kq.push(`T4 lễ tân: huỷ một dòng → ${v.status}, huỷ cả hợp đồng đã chốt → ${x.status} ⇒ ${v.status === 403 && x.status === 200 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
}
// T5 — bảng giá nhận giá 900 nghìn tỷ không hỏi lại (thử qua API như hộp gói gửi)
{
  const p = pk.find((x) => x.code === 'G-MCD');
  const r = await api('POST', `/packages/${p.id}/prices`, { listPrice: 900000000000000, salePrice: null });
  if (r.status === 201) await api('POST', `/packages/${p.id}/prices`, { listPrice: p.currentPrice.listPrice, salePrice: p.currentPrice.salePrice, note: 'trả lại sau thử' });
  kq.push(`T5 giá 900 nghìn tỷ → ${r.status} ⇒ ${r.status === 201 ? 'LỖI CÒN' : 'ĐÃ HẾT'}`);
}
console.log(kq.join('\n'));
await close();
