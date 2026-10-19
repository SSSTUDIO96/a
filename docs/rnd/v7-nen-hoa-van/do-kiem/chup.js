// Chụp các biến thể: xuất PNG bằng window.MAU_XUAT_PNG (html-to-image 1.11.13 — đúng đường app dùng),
// rồi xuất lần 2 với chữ trong suốt (bố cục giữ nguyên) để đo màu nền dưới từng dòng chữ.
const { chromium } = require('/home/user/a/node_modules/.pnpm/playwright@1.56.1/node_modules/playwright');
const fs=require('fs');
const BASE='http://127.0.0.1:8707/v7-nen-hoa-van/shd-01-hv.html';
const CF=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{const b=await chromium.launch();
for(const [ten,q] of CF){const vuong=q.includes('kho=vuong');
  const p=await b.newPage({viewport:{width:1080,height:vuong?1080:1350}});
  p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(ten,'console:',m.text())});
  await p.goto(BASE+'?'+q);await p.waitForFunction(()=>document.body.dataset.ready==='1');
  async function xuat(f){const b64=await p.evaluate(async()=>{const r=await window.MAU_XUAT_PNG();const buf=new Uint8Array(await r.blob.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=32768)s+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));return btoa(s);});fs.writeFileSync(f,Buffer.from(b64,'base64'));}
  await xuat(`goc/${ten}.png`);
  const info=await p.evaluate(()=>{const c=document.getElementById('c');const cr=c.getBoundingClientRect();
    const chu=[...document.querySelectorAll('.w [data-do]')].map(el=>{const cs=getComputedStyle(el);return {lop:el.className.split(' ')[0],chu:el.textContent.trim(),mau:cs.color,co:parseFloat(cs.fontSize),dam:parseInt(cs.fontWeight),hop:window.HOP_DONG(el)};});
    const anh=document.querySelector('.anh').getBoundingClientRect();
    return {chu,anh:{x:anh.left-cr.left,y:anh.top-cr.top,w:anh.width,h:anh.height},nen:getComputedStyle(c).backgroundColor,ds:{...document.body.dataset},W:c.offsetWidth,H:c.offsetHeight,
      tran:[...document.querySelectorAll('.w > *')].some(e=>e.getBoundingClientRect().bottom>document.querySelector('.w').getBoundingClientRect().bottom-40)};});
  await p.addStyleTag({content:'.w *{color:transparent!important}'});
  await xuat(`nen/${ten}.png`);
  fs.writeFileSync(`nen/${ten}.json`,JSON.stringify({q,...info},null,1));
  console.log(ten,'ok',JSON.stringify(info.ds),info.tran?'TRAN-CHAN':'');await p.close();}
await b.close();})();
