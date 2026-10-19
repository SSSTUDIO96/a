// Chụp mẫu chào mừng R&D-10: node chup.js <thư-mục-làm-việc> <cổng> cm-01 cm-02 … [--bien=doc,vuong,dai,vuongdai,khonglogo]
// Xuất PNG bằng window.MAU_XUAT_PNG (html-to-image, đúng đường app dùng), rồi xuất lần 2 với chữ trong suốt để đo nền dưới chữ.
const { chromium } = require('/home/user/a/node_modules/.pnpm/playwright@1.56.1/node_modules/playwright');
const fs=require('fs');
const [,, WD, PORT, ...rest]=process.argv;
const bienArg=(rest.find(a=>a.startsWith('--bien='))||'--bien=doc,vuong,dai,vuongdai').slice(7).split(',');
const mau=rest.filter(a=>!a.startsWith('--'));
const DAI='ten='+encodeURIComponent('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo');
const BIEN={doc:['doc',''],vuong:['vuong','kho=vuong'],dai:['dai',DAI],vuongdai:['vuongdai','kho=vuong&'+DAI],
  khonglogo:['khonglogo','that=1&th=Chi%E1%BA%BFn%20Makeup%20Academy&ten=%C4%90%E1%BA%B7ng%20Qu%E1%BB%B3nh%20Nh%C6%B0&khoa=Makeup%20chuy%C3%AAn%20nghi%E1%BB%87p&lop=K12&ngay=02/11/2026&anh=chung/anh-hoc-vien.svg&diachi=25%20Ho%C3%A0ng%20Qu%E1%BB%91c%20Vi%E1%BB%87t,%20C%E1%BA%A7u%20Gi%E1%BA%A5y,%20H%C3%A0%20N%E1%BB%99i&ma=07']};
(async()=>{const b=await chromium.launch();
for(const m of mau)for(const bn of bienArg){const [ten,q]=BIEN[bn];const vuong=q.includes('kho=vuong');
  const p=await b.newPage({viewport:{width:1080,height:vuong?1080:1350}});
  p.on('console',x=>{if(x.type()==='error'||x.type()==='warning')console.log(m,bn,'console:',x.text())});
  p.on('pageerror',e=>console.log(m,bn,'LOI:',e.message));
  await p.goto(`http://127.0.0.1:${PORT}/v10-chao-mung/${m}.html?${q}`);
  await p.waitForFunction(()=>document.body.dataset.cmXong==='1',null,{timeout:30000});
  await p.waitForTimeout(300);
  async function xuat(f){const b64=await p.evaluate(async()=>{const r=await window.MAU_XUAT_PNG();const buf=new Uint8Array(await r.blob.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=32768)s+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));return btoa(s);});fs.writeFileSync(f,Buffer.from(b64,'base64'));}
  await xuat(`${WD}/goc/${m}-${ten}.png`);
  const info=await p.evaluate(()=>{const c=document.getElementById('c');const w=document.querySelector('.w');
    const loi=[];
    // chữ tràn khỏi hộp của nó / khỏi thẻ
    document.querySelectorAll('#c [data-do]').forEach(el=>{if(el.scrollWidth>el.clientWidth+2&&!el.classList.contains('vang'))loi.push('tran-ngang:'+el.className+':'+el.textContent.trim().slice(0,20));});
    const cr=c.getBoundingClientRect();
    document.querySelectorAll('#c [data-do]').forEach(el=>{const r=el.getBoundingClientRect();if(r.width&&(r.left<cr.left+8||r.right>cr.right-8||r.top<cr.top+8||r.bottom>cr.bottom-8))loi.push('sat-mep:'+el.className);});
    return {do:window.CM_DO(),W:c.offsetWidth,H:c.offsetHeight,ds:{...document.body.dataset},loi,
      ten:(document.querySelector('.ten')||{}).style?.fontSize||getComputedStyle(document.querySelector('.ten')).fontSize,
      anh:(()=>{const a=document.querySelector('.av');if(!a)return null;const r=a.getBoundingClientRect();return {x:r.left-cr.left,y:r.top-cr.top,w:r.width,h:r.height};})()};});
  await p.addStyleTag({content:'#c [data-do]{color:transparent!important}#c svg text{fill:transparent!important}#c [data-do] svg text{fill:transparent!important}'});
  await p.evaluate(()=>document.querySelectorAll('#c svg text').forEach(t=>{t.setAttribute('fill','none');t.style.fill='none';}));
  await xuat(`${WD}/nen/${m}-${ten}.png`);
  fs.writeFileSync(`${WD}/nen/${m}-${ten}.json`,JSON.stringify({q,...info},null,1));
  console.log(m,ten,'ok','ten',info.ten,info.loi.length?('CANH-BAO '+info.loi.join(' | ')):'');await p.close();}
await b.close();})();
