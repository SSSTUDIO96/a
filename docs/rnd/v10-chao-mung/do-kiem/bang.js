// Chụp hai trang bảng (bang-xem-nhanh.html, truoc-sau.html) ra PNG thô; xuat-anh.py không dùng cho hai ảnh này — nén bằng lệnh Pillow ở cuối.
const { chromium } = require('/home/user/a/node_modules/.pnpm/playwright@1.56.1/node_modules/playwright');
const [,, WD, PORT]=process.argv;
(async()=>{const b=await chromium.launch();
for(const [t,w,ten] of [['bang-xem-nhanh',2140,'bang-xem-nhanh-10-mau-chao-mung'],['truoc-sau',1560,'truoc-sau']]){
 const p=await b.newPage({viewport:{width:w,height:300}});
 await p.goto(`http://127.0.0.1:${PORT}/v10-chao-mung/${t}.html`);await p.evaluate(()=>document.fonts.ready);
 await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await p.waitForTimeout(400);
 await p.screenshot({path:`${WD}/${ten}.png`,fullPage:true});console.log(ten);await p.close();}
await b.close();})();
