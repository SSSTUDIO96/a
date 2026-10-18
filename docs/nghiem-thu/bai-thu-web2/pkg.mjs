// Tạo một gói qua hộp thoại "Thêm gói" của màn Bảng giá.
export async function taoGoi(page, g) {
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Mã gói').fill(g.code);
  await dlg.getByLabel('Tên gói').fill(g.name);
  if (g.subject) await dlg.getByLabel('Nhân vật').selectOption({ label: g.subject });
  await dlg.getByLabel('Thời lượng').fill(String(g.dur));
  if (g.staff) await dlg.getByLabel('Số thợ').fill(String(g.staff));
  await dlg.getByLabel('Giá niêm yết').fill(String(g.list));
  if (g.sale) await dlg.getByLabel('Giá bán').fill(String(g.sale));
  if (g.deposit != null) await dlg.getByLabel('Cọc mặc định').fill(String(g.deposit));
  for (const [lbl, on] of [['Tại studio / cửa hàng', g.loc.includes('S')], ['Tại nhà khách', g.loc.includes('H')], ['Địa điểm khác', g.loc.includes('O')]]) {
    const cb = dlg.getByLabel(lbl);
    if ((await cb.isChecked()) !== on) await cb.click();
  }
  if (g.radius != null) await dlg.getByLabel('Bán kính miễn phí').fill(String(g.radius));
  for (const inc of g.included ?? []) { if (!(await dlg.locator('select[aria-label="Thêm dịch vụ"], select').filter({ hasText: 'Chọn dịch vụ' }).count())) await dlg.getByRole('button', { name: 'Thêm dịch vụ' }).click(); await dlg.getByLabel('Thêm dịch vụ').selectOption({ label: inc }); await page.waitForTimeout(150); }
  for (const a of g.addons ?? []) await dlg.getByRole('checkbox', { name: new RegExp('^' + a) }).check();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForTimeout(1200);
}
