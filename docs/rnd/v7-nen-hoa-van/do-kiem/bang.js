const { chromium } = require('/home/user/a/node_modules/.pnpm/playwright@1.56.1/node_modules/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1400}});
for(const [ph,ten] of [['a','v2-bang-xem-nhanh-chao-mung'],['b','v2-bang-xem-nhanh-chung-nhan']]){
await p.goto('http://127.0.0.1:8707/v7-nen-hoa-van/bang-xem-nhanh-v2.html?phan='+ph);await p.waitForFunction(()=>document.body.dataset.ready==='1');
await p.locator('#c').screenshot({path:`goc/${ten}.png`});console.log(ten);}await b.close();})();
