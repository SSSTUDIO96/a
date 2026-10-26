// Chụp ảnh khung nhìn (fullPage: false) các màn bản mẫu R&D 11.
// Chạy: (cd /home/user/a && python3 -m http.server 8711 --bind 127.0.0.1) rồi
//   node docs/rnd/v11-ma-so/do-kiem/chup.js <tệp.html> <#màn> <1440|390> <ảnh-ra.png> [cuộn-px]
const { chromium } = require('/home/user/a/node_modules/.pnpm/playwright@1.56.1/node_modules/playwright');
const [, , trang, man, rong, ra, cuon] = process.argv;
(async () => {
  const b = await chromium.launch();
  const w = +rong;
  const p = await b.newPage({ viewport: { width: w, height: w > 600 ? 900 : 844 }, deviceScaleFactor: w > 600 ? 1 : 2 });
  const loi = [];
  p.on('pageerror', (e) => loi.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') loi.push(m.text()); });
  await p.goto(`http://127.0.0.1:8711/docs/rnd/v11-ma-so/${trang}?chup=1${man}`);
  await p.waitForLoadState('networkidle');
  // Chờ mọi tệp vẽ mẫu trong iframe vẽ xong (cm.js đặt body.dataset.cmXong = '1').
  for (const f of p.frames()) {
    if (f === p.mainFrame()) continue;
    if (!/v10-chao-mung/.test(f.url())) continue;
    await f.waitForFunction(() => document.body && document.body.dataset.cmXong === '1', null, { timeout: 30000 });
  }
  await p.evaluate(() => window.V11 && window.V11.coXem());
  if (cuon) await p.evaluate((y) => { const d = document.querySelector('.man.on .db'); (d && d.scrollHeight > d.clientHeight ? d : document.scrollingElement).scrollTop = y; }, +cuon);
  await p.waitForTimeout(400);
  // Không có thanh cuộn ngang trang.
  const tran = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await p.screenshot({ path: ra, fullPage: false });
  console.log(ra, 'tràn ngang', tran, 'px', loi.length ? 'LỖI: ' + loi.join(' | ') : '');
  await b.close();
})();
