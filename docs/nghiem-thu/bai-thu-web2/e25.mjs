// Đối chiếu số tiền trên màn với số máy chủ, mọi hợp đồng, 3 khổ.
import { open, org, shot, close, overflow } from './h.mjs';
import { api, vnd } from './api.mjs';
const all = (await api('GET', '/contracts?pageSize=50')).body.items;
let ok = 0, tot = 0; const sai = [];
for (const vp of ['d', 't', 'm']) {
  const { page, context } = await open('owner', vp);
  for (const c of all) {
    const s = (await api('GET', '/contracts/' + c.id)).body;
    await page.goto(org('/hop-dong/' + c.id));
    await page.waitForTimeout(2200);
    const ui = await page.evaluate(() => {
      const t = (el) => (el?.innerText ?? '').trim();
      const lines = [...document.querySelectorAll('section.ct-ln[data-dong]')].map((x) => t(x.querySelector('.ct-ln__ft b')));
      const card = t(document.querySelector('[aria-label="Tổng hợp đồng"]'));
      const pick = (lbl) => { const m = card.split('\n'); const i = m.indexOf(lbl); return i >= 0 ? m.slice(i + 1).find((v) => /₫|—/.test(v)) : null; };
      const body = document.body.innerText;
      const bar = body.match(/Tổng\s*([\d.]+ ₫)\s*\n?\s*Cọc\s*([\d.]+ ₫)/);
      return { lines, sub: pick('Tạm tính'), total: pick('Tổng'), barTotal: bar?.[1], barDep: bar?.[2], depInput: document.querySelector('input[aria-label="Cọc cần thu"]')?.value ?? null };
    });
    const pk = s.lines.filter((l) => l.kind === 'PACKAGE' || l.kind === 'SERVICE');
    const exp = pk.map((l) => vnd(l.voidedAt ? 0 : l.lineTotal + (l.addons ?? []).filter((a) => !a.voidedAt).reduce((x, a) => x + a.lineTotal, 0) + (l.travel && !l.travel.voidedAt ? l.travel.lineTotal : 0)));
    const checks = [
      ...exp.map((e, i) => ['dòng ' + (i + 1), e, ui.lines[i]]),
      ['tạm tính', vnd(s.subtotal), ui.sub], ['tổng', vnd(s.total), ui.total], ['thanh tổng', vnd(s.total), ui.barTotal], ['thanh cọc', vnd(s.depositRequired), ui.barDep],
    ];
    for (const [k, e, u] of checks) { tot++; if (e === u) ok++; else sai.push(`${vp} ${s.code} ${s.status} ${k}: máy chủ ${e} ≠ màn ${u}`); }
    const o = await overflow(page);
    if (o.scrollWidth > o.innerWidth) sai.push(`${vp} ${s.code} TRÀN NGANG ${o.scrollWidth}/${o.innerWidth}`);
    if (vp !== 'd' && c.code === 'HD-000001') await shot(page, `hd1-${vp === 't' ? 1024 : 390}`, false);
    if (vp === 'm' && c.code === 'HD-000005') await shot(page, 'hd5-390', true);
  }
  await context.close();
}
console.log(`KHỚP ${ok}/${tot}`); console.log(sai.join('\n'));
await close();
