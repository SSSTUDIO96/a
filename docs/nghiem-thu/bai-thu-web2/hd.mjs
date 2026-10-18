// Lập hợp đồng bằng giao diện (màn /hop-dong/moi).
export async function khach(page, c) {
  const m = page.locator('main');
  if (c.new) {
    await m.getByRole('button', { name: 'Khách mới' }).click();
    await m.getByLabel('Họ tên khách').fill(c.name);
    await m.getByLabel('Số điện thoại khách').fill(c.phone);
  } else {
    await m.getByLabel('Tìm khách theo tên hoặc số điện thoại').fill(c.q);
    await page.waitForTimeout(800);
    await m.getByRole('listbox', { name: 'Khách tìm được' }).getByRole('option').first().click();
  }
}
export async function ngay(page, d) {
  await page.locator('main').getByRole('textbox', { name: 'Ngày sự kiện' }).fill(d);
  await page.locator('main').getByLabel('Ghi chú hợp đồng').click();
}
export async function themGoi(page, name, phone = false) {
  const m = page.locator('main');
  if (phone) {
    await m.getByRole('button', { name: 'Thêm từ bảng giá' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Thêm ' + name, exact: true }).click();
  } else await m.getByRole('button', { name: 'Thêm ' + name, exact: true }).click();
  await page.waitForTimeout(300);
  const n = await m.locator('section.ct-ln[data-dong]').count();
  return m.locator('section.ct-ln[data-dong]').nth(n - 1);
}
export async function dong(page, card, o) {
  if (o.qty) for (let k = 1; k < o.qty; k++) await card.getByRole('button', { name: 'Tăng số người' }).click();
  if (o.start) { await card.getByRole('textbox', { name: 'Giờ bắt đầu' }).fill(o.start); }
  if (o.end) { await card.getByRole('textbox', { name: 'Giờ kết thúc' }).fill(o.end); await card.getByRole('textbox', { name: 'Giờ bắt đầu' }).click(); }
  for (const a of o.addons ?? []) await card.getByRole('checkbox', { name: new RegExp('^' + a) }).check();
  if (o.loc) await card.getByRole('radio', { name: o.loc, exact: true }).click();
  if (o.address) await card.getByLabel('Địa chỉ').fill(o.address);
  if (o.travel) await card.getByRole('radio', { name: o.travel, exact: true }).click();
  if (o.km != null) { await card.getByLabel('Số km một chiều').fill(String(o.km)); }
  if (o.manual != null) { await card.getByLabel('Phí di chuyển nhập tay').fill(String(o.manual)); }
  if (o.staff) await chonTho(page, card, o.staff);
}
export async function chonTho(page, card, staff) {
  await card.getByRole('button', { name: /^(Chọn thợ|Đổi)/ }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Chọn thợ phụ trách' });
  await dlg.waitFor();
  await page.waitForTimeout(700);
  for (const cb of await dlg.getByRole('checkbox').all()) if (await cb.isChecked()) await cb.uncheck();
  for (const [name, role] of staff) {
    await dlg.getByRole('checkbox', { name }).check();
    if (role === 'Phụ') await dlg.getByRole('radio', { name: 'Phụ' }).last().click().catch(() => {});
  }
  await dlg.getByRole('button', { name: 'Chọn', exact: true }).click();
  await page.waitForTimeout(600);
}
export async function tong(page, o) {
  const m = page.locator('main');
  if (o.discount != null) await m.getByLabel('Giảm giá').fill(String(o.discount));
  if (o.deposit != null) await m.getByLabel('Cọc cần thu').fill(String(o.deposit));
  if (o.notes) await m.getByLabel('Ghi chú hợp đồng').fill(o.notes);
  await page.waitForTimeout(900);
}
// Đọc số đang hiện trên màn (thẻ dòng, thẻ tổng, thanh đáy).
export async function docSo(page) {
  return page.locator('main').evaluate(() => {
    const t = (el) => (el?.innerText ?? '').trim();
    const lines = [...document.querySelectorAll('section.ct-ln[data-dong]')].map((s) => ({ ten: s.getAttribute('aria-label'), cong: t(s.querySelector('.ct-ln__ft b')), donGia: t(s.querySelector('.ct-pend')), diChuyen: t(s.querySelector('.ct-tr__amt, [class*=travel] b, .ct-tv b')) }));
    const card = document.querySelector('[aria-label="Tổng hợp đồng"]');
    const bar = document.querySelector('.ui-totalbar, [class*=totalbar], [class*=TotalBar]');
    return { lines, tongCard: t(card), bar: t(bar) };
  });
}
