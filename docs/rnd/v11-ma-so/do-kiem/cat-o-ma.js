// Cắt ô mã số trên 10 mẫu chào mừng mới với các mã thử: node cat-o-ma.js <thư-mục-ra> "07,123,B3,A12,M12,A-07" (máy chủ tĩnh ở gốc kho, cổng 8711).
const { chromium } = require('/home/user/a/node_modules/.pnpm/playwright@1.56.1/node_modules/playwright');
(async()=>{const b=await chromium.launch();
for(let i=1;i<=10;i++){const m='cm-'+String(i).padStart(2,'0');
 for(const ma of (process.argv[3]||'07,123,A-07').split(',')){
  const p=await b.newPage({viewport:{width:1080,height:1350}});
  await p.goto(`http://127.0.0.1:8711/docs/rnd/v10-chao-mung/${m}.html?ma=${encodeURIComponent(ma)}`);
  await p.waitForFunction(()=>document.body.dataset.cmXong==='1',null,{timeout:30000});
  const bb=await p.evaluate(()=>{const s=document.querySelector('[data-seat]').closest('.seat');const r=s.getBoundingClientRect();return {x:r.left-30,y:r.top-30,width:r.width+60,height:r.height+60};});
  await p.screenshot({path:`${process.argv[2]}/${m}-${ma}.png`,clip:bb});await p.close();}}
await b.close();})();
