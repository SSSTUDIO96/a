/* Makeup Pro · R&D 07 · LỚP NỀN / VIỀN THAY THẾ cho mẫu thẻ.
   Nạp SAU chung/mau.js, TRƯỚC chung/xuat.js. Chạy sau khi mau.js co chữ xong (MAU_SAN_SANG), rồi mới cho xuất ảnh.
   Tham số đường dẫn:
     ?nen=<mã họa tiết>&dam=0.14&maunen=%23B8975A   Phương án 1: họa tiết dựng sẵn (chung/hoa-van.js), độ đậm 0..1
     ?anhnen=<đường dẫn ảnh>&chim=0.24               Phương án 2: ảnh studio tải lên → app tự làm chìm (canvas)
     ?khung=<mã khung>                               Phương án 3: khung trang trí thay hai đường viền vàng
     ?khunganh=tron|vien-thuoc                       Khung ảnh học viên (mặc định tròn)
     ?vien=0|1|2                                     Số đường viền vàng giữ lại (mặc định 2; có ?khung thì 0)
   VÙNG AN TOÀN: phần tử mang data-an-toan="<px>" (ảnh, tên chữ ký) được khoét sạch họa tiết, mép mờ dần,
   nên họa tiết không bao giờ đè lên ảnh và chữ ký. Phương án 2 còn tự hạ độ đậm tới khi mọi dòng chữ đạt ngưỡng
   tương phản (chữ nhỏ ≥ 4,5:1, chữ lớn ≥ 3:1 — chuẩn WCAG AA). */
(function(){
const P=new URLSearchParams(location.search);
const NS='http://www.w3.org/2000/svg';
const c=document.getElementById('c');
const MAU_NEN=getComputedStyle(c).backgroundColor; // màu nền thật của mẫu
document.body.classList.add('anh-'+(P.get('khunganh')||'tron'));
const vien=P.has('vien')?+P.get('vien'):(P.get('khung')?0:2);
if(vien<2)document.querySelectorAll('.b1').forEach(e=>e.remove());
if(vien<1)document.querySelectorAll('.b2').forEach(e=>e.remove());

function rgb(s){const m=s.match(/[\d.]+/g).map(Number);return m.slice(0,3);}
function hex(a){return '#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
const NEN=rgb(MAU_NEN);
// Hình chữ nhật (toạ độ trong #c) bao từng dòng chữ thật — dùng Range để bám sát nét chữ, không lấy cả ô rộng.
function hopDong(el){const cr=c.getBoundingClientRect();const r=document.createRange();r.selectNodeContents(el);
  return [...r.getClientRects()].filter(q=>q.width>1&&q.height>1).map(q=>({x:q.left-cr.left,y:q.top-cr.top,w:q.width,h:q.height}));}
function hopPhanTu(el){const cr=c.getBoundingClientRect(),q=el.getBoundingClientRect();return {x:q.left-cr.left,y:q.top-cr.top,w:q.width,h:q.height};}
// Danh sách vùng an toàn: {x,y,w,h,r(bo góc),pad}
function vungAnToan(){const out=[];
  document.querySelectorAll('[data-an-toan]').forEach(el=>{const pad=+el.dataset.anToan||30;
    if(el.tagName==='IMG'||el.classList.contains('anh')){const b=hopPhanTu(el);out.push({...b,r:Math.min(b.w,b.h)/2,pad});}
    else hopDong(el).forEach(b=>out.push({...b,r:b.h/2,pad}));});
  return out;}
function lopSvg(){const s=document.createElementNS(NS,'svg');const W=c.offsetWidth,H=c.offsetHeight;
  s.setAttribute('width',W);s.setAttribute('height',H);s.setAttribute('viewBox',`0 0 ${W} ${H}`);
  s.setAttribute('class','lop-nen');s.style.cssText='position:absolute;left:0;top:0;pointer-events:none';
  c.insertBefore(s,c.firstChild);return s;}
function matNa(vung,W,H){
  return `<filter id="mo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<mask id="kho" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><g filter="url(#mo)">`+
  vung.map(v=>`<rect x="${v.x-v.pad}" y="${v.y-v.pad}" width="${v.w+2*v.pad}" height="${v.h+2*v.pad}" rx="${v.r+v.pad}" fill="#000"/>`).join('')+`</g></mask>`;}

/* ---------- Phương án 1: họa tiết dựng sẵn ---------- */
function veHoaVan(){const id=P.get('nen');const hv=window.HOA_VAN[id];if(!hv)return;
  const mau=P.get('maunen')||'#B8975A',dam=P.has('dam')?+P.get('dam'):.14,co=+(P.get('co')||1);
  const W=c.offsetWidth,H=c.offsetHeight;const s=lopSvg();
  let tile=hv.ve(mau);if(hv.che)tile=tile.split('#F5EFE4').join(hex(NEN));
  s.innerHTML=`<defs><pattern id="hv" width="${hv.w}" height="${hv.h}" patternUnits="userSpaceOnUse" patternTransform="translate(${W/2},${H/2}) scale(${co})">${tile}</pattern>${matNa(vungAnToan(),W,H)}</defs>
<rect width="${W}" height="${H}" fill="url(#hv)" opacity="${dam}" mask="url(#kho)"/>`;
  document.body.dataset.nen=id;document.body.dataset.dam=dam;}

/* ---------- Phương án 3: khung trang trí ---------- */
function veKhung(){const id=P.get('khung');const k=window.KHUNG[id];if(!k)return;
  const W=c.offsetWidth,H=c.offsetHeight;const s=lopSvg();s.style.zIndex='0';
  s.innerHTML=k.ve(W,H,P.get('maukhung')||'#B8975A');document.body.dataset.khung=id;}

/* ---------- Phương án 2: ảnh studio tải lên → làm chìm ----------
   Các bước app làm MỘT LẦN lúc studio tải ảnh lên (ở đây làm ngay trong trang để xem trước):
   1) phủ kín khổ thẻ (cắt giữa), làm mềm 1,5 px cho hết sạn ảnh chụp;
   2) bỏ màu → độ sáng, tự cân sáng (2%–98%), tự đảo chiều nếu phần "đậm" chiếm quá nửa (ví dụ ren trắng trên vải tối);
   3) tô lại bằng HAI màu của mẫu: nền kem → nâu vàng, chỉ đi tối đa `chim` (mặc định 24%) quãng đường giữa hai màu;
   4) khoét vùng an toàn quanh ảnh và chữ ký;
   5) đo tương phản dưới từng dòng chữ; dòng nào chưa đạt thì hạ độ đậm 15% và làm lại (tối đa 12 lần). */
function lum(r,g,b){const t=[r,g,b].map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*t[0]+.7152*t[1]+.0722*t[2];}
function taiAnh(src){return new Promise((ok,loi)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=loi;i.src=src;});}
async function veAnhNen(){const src=P.get('anhnen');if(!src)return;
  const W=c.offsetWidth,H=c.offsetHeight;const img=await taiAnh(src);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d',{willReadFrequently:true});
  const k=Math.max(W/img.width,H/img.height);x.filter='blur(1.5px)';
  x.drawImage(img,(W-img.width*k)/2,(H-img.height*k)/2,img.width*k,img.height*k);x.filter='none';
  const d=x.getImageData(0,0,W,H).data;const Y=new Float32Array(W*H);const his=new Uint32Array(256);
  for(let i=0,j=0;i<d.length;i+=4,j++){const y=(.299*d[i]+.587*d[i+1]+.114*d[i+2]);Y[j]=y;his[y|0]++;}
  const pc=(p)=>{let s=0;for(let v=0;v<256;v++){s+=his[v];if(s>=p*W*H)return v;}return 255;};
  const lo=pc(.02),hi=Math.max(lo+1,pc(.98));let tb=0;
  const muc=new Float32Array(W*H);for(let j=0;j<Y.length;j++){const t=Math.min(1,Math.max(0,(Y[j]-lo)/(hi-lo)));muc[j]=1-t;tb+=1-t;}
  const dao=tb/(W*H)>.5;if(dao)for(let j=0;j<muc.length;j++)muc[j]=1-muc[j];
  // mặt nạ vùng an toàn (0 = khoét sạch)
  const mk=document.createElement('canvas');mk.width=W;mk.height=H;const m=mk.getContext('2d',{willReadFrequently:true});
  m.fillStyle='#fff';m.fillRect(0,0,W,H);m.filter='blur(14px)';m.fillStyle='#000';
  vungAnToan().forEach(v=>{m.beginPath();m.roundRect(v.x-v.pad,v.y-v.pad,v.w+2*v.pad,v.h+2*v.pad,v.r+v.pad);m.fill();});
  const md=m.getImageData(0,0,W,H).data;
  const DAM=rgb(P.get('mauchim')||'rgb(150,118,72)');
  // các dòng chữ cần đo
  const chu=[...c.querySelectorAll('.w [data-do]')].map(el=>{const cs=getComputedStyle(el);const fc=rgb(cs.color);
    const co=parseFloat(cs.fontSize),dam=parseInt(cs.fontWeight)>=700;return {el,hop:hopDong(el),L:lum(...fc),nguong:(co>=24||(co>=18.66&&dam))?3:4.5};});
  let chim=P.has('chim')?+P.get('chim'):.24;const out=x.createImageData(W,H);const o=out.data;let lan=0,thap=99;
  for(;lan<12;lan++){
    for(let j=0,i=0;j<muc.length;j++,i+=4){const a=muc[j]*chim*(md[i]/255);
      o[i]=NEN[0]+(DAM[0]-NEN[0])*a;o[i+1]=NEN[1]+(DAM[1]-NEN[1])*a;o[i+2]=NEN[2]+(DAM[2]-NEN[2])*a;o[i+3]=255;}
    thap=99;let dat=true;
    for(const t of chu){const ls=[];for(const b of t.hop){for(let yy=Math.max(0,b.y|0);yy<Math.min(H,b.y+b.h);yy+=2)for(let xx=Math.max(0,b.x|0);xx<Math.min(W,b.x+b.w);xx+=2){const i=(yy*W+xx)*4;ls.push(lum(o[i],o[i+1],o[i+2]));}}
      if(!ls.length)continue;ls.sort((a,b)=>a-b);const xau=ls[Math.floor(ls.length*.01)];
      const cr=t.L<xau?(xau+.05)/(t.L+.05):(t.L+.05)/(xau+.05);thap=Math.min(thap,cr/t.nguong);if(cr<t.nguong)dat=false;}
    if(dat)break;chim*=.85;}
  x.putImageData(out,0,0);
  const im=document.createElement('img');im.src=cv.toDataURL('image/png');im.className='lop-nen';
  im.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%';await im.decode();c.insertBefore(im,c.firstChild);
  Object.assign(document.body.dataset,{chim:chim.toFixed(3),chimLan:lan,dao:dao?'1':'0'});}

window.VUNG_AN_TOAN=vungAnToan;window.HOP_DONG=hopDong;
const goc=window.MAU_SAN_SANG||Promise.resolve();
window.MAU_SAN_SANG=goc.then(async()=>{veHoaVan();veKhung();await veAnhNen();document.body.dataset.nenXong='1';});
})();
