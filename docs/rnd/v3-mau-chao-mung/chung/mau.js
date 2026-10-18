/* Điền dữ liệu vào mẫu thẻ. Mỗi ô trên mẫu mang data-f="<khoá>" — khoá nào lấy từ trường nào ghi ở BAO-CAO-RND-03.md.
   Thay dữ liệu bằng tham số đường dẫn, ví dụ ?ten=Quỳnh%20Như&khoa=...&kho=vuong (mặc định khổ 1080×1350). */
(function(){
const P=new URLSearchParams(location.search);
const ROOT=document.currentScript.src.replace(/mau\.js.*$/,'');
const M=window.MAC_DINH||{};
const G=(k,d)=>P.get(k)||M[k]||d;
const D={
  th:G('th','Chiến Makeup Academy'), logo:G('logo',ROOT+'logo-mau.svg'),
  ten:G('ten','Tôn Nữ Hoàng Bảo Ngọc Phương Thảo'), anh:G('anh',ROOT+'anh-hoc-vien.svg'),
  khoa:G('khoa','Makeup chuyên nghiệp'), lop:G('lop','K12'), ngay:G('ngay','02/11/2026'),
  lich:G('lich','T3 · T5 · T7, 18:00–22:00'), gv:G('gv','Nguyễn Thu Hà'),
  diachi:G('diachi','25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội'), sdt:G('sdt','0912 345 678'), web:G('web','chienmakeup.vn'),
  loai:G('loai','khoa'),
  nv:G('nv','Cô dâu'), goi:G('goi','Ngày cưới trọn gói'), nsk:G('nsk','24/10/2026'), noi:G('noi','Tại nhà · Long Biên, Hà Nội'),
  nfb:G('nfb','12/10/2026'), sao:+G('sao','5'), cc:G('cc',''), td:G('td',''), nkt:G('nkt','20/12/2026')
};

const DV=D.loai==='dv';
Object.assign(D,{
  kh:G('kh',DV?'Phạm Thu Trang':'Nguyễn Hoa'),
  nd:G('nd',DV?'Cảm ơn team đã giúp mình có một ngày cưới thật xinh. Lớp nền nhẹ mà giữ đến tối, ảnh chụp lên rất tự nhiên. Chắc chắn mình sẽ giới thiệu bạn bè!'
    :'Em cảm ơn chị Hà nhiều lắm! Học xong khoá em đã tự tin nhận khách cô dâu đầu tiên, khách khen lớp nền mỏng mà giữ cả ngày. Lớp học vui, chị chỉ kỹ từng bước ạ.'),
  a1:G('a1',ROOT+(DV?'anh-co-dau.svg':'anh-fb-1.svg')), a2:G('a2',ROOT+(DV?'anh-co-dau-2.svg':'anh-fb-2.svg')), a3:G('a3',ROOT+'anh-fb-3.svg'),
  camNhan:DV?'Cảm nhận của khách hàng':'Cảm nhận của học viên', nhanFb:DV?'Khách nhắn cho studio':'Học viên nhắn cho lớp',
  nvThuong:D.nv.toLowerCase()});
D.dv=G('dv',DV?`${D.nv} · ${D.goi} · ${D.nsk.split('/').join('.')}`:'Makeup chuyên nghiệp · Lớp K10');
const [d,m,y]=D.ngay.split('/');
const THU=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
Object.assign(D,{ngayD:d,thangSo:'Tháng '+(+m),nam:y,ngayCham:`${d}.${m}.${y}`,thangNam:`Tháng ${+m} · ${y}`,
  thu:THU[new Date(+y,+m-1,+d).getDay()],gio:(D.lich.split(',')[1]||'').trim(),
  nfbCham:D.nfb.split('/').join('.'),nskCham:D.nsk.split('/').join('.'),cauDau:(D.nd.match(/^[^.!?]+[.!?]?/)||[D.nd])[0].trim()});
{const [a,b,c]=D.nsk.split('/');const t=new Date(+c,+b-1,+a).getDay();D.nskChu=`${THU[t]}, ${+a} tháng ${+b} năm ${c}`;D.nskThangNam=`Tháng ${+b} · ${c}`;}
D.nktCham=D.nkt.split('/').join('.');
D.conLai=D.nd.slice(D.nd.indexOf(D.cauDau)+D.cauDau.length).trim();
document.body.classList.add(P.get('kho')==='vuong'?'vuong':'k45');
if(P.get('ky')){const n=P.get('ky');const r=document.documentElement.style;for(let i=1;i<=4;i++){r.setProperty('--f-tay-'+i,`var(--f-ky-${n})`);r.setProperty('--tay-co-'+i,`var(--ky-co-${n})`);}}
document.querySelectorAll('[data-f]').forEach(el=>{const v=D[el.dataset.f];if(el.tagName==='IMG')el.src=v;else el.textContent=v;});
document.querySelectorAll('[data-chat]').forEach(el=>{const parts=D.nd.match(/[^.!?]+[.!?]*/g)||[D.nd];
  const n=+el.dataset.chat||3;const g=[];parts.forEach((s,i)=>{const k=Math.min(n-1,Math.floor(i*n/parts.length));g[k]=(g[k]||'')+s;});
  el.innerHTML=g.filter(Boolean).map(t=>`<div class="bb">${t.trim().replace(/</g,'&lt;')}</div>`).join('');});
const STAR='<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor"/></svg>';
document.querySelectorAll('[data-sao]').forEach(el=>{el.innerHTML=STAR.repeat(Math.max(0,Math.min(5,D.sao)));});
document.querySelectorAll('[data-qr]').forEach(el=>{try{const q=qrcode(0,'M');q.addData('https://'+D[el.dataset.qr].replace(/^https?:\/\//,''));q.make();
  el.innerHTML=q.createSvgTag({cellSize:4,margin:0,scalable:true});el.querySelectorAll('path,rect').forEach(p=>{if(p.getAttribute('fill')==='black'||p.getAttribute('fill')==='#000000')p.setAttribute('fill','currentColor')});}catch(e){el.textContent=''}});
function fit(){
  document.querySelectorAll('[data-fit]').forEach(el=>{el.style.fontSize='';const max=+el.dataset.fit;let s=parseFloat(getComputedStyle(el).fontSize);
    for(let i=0;i<90;i++){const cs=getComputedStyle(el);const lh=parseFloat(cs.lineHeight)||s*1.2;const pad=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
      if(el.offsetHeight-pad<=lh*max+4&&el.scrollWidth<=el.clientWidth+1)break;s-=1.5;el.style.fontSize=s+'px';}});
  document.querySelectorAll('[data-fitw]').forEach(el=>{el.style.fontSize='';let s=parseFloat(getComputedStyle(el).fontSize);for(let i=0;i<90&&el.scrollWidth>el.clientWidth+1;i++){s-=1.5;el.style.fontSize=s+'px';}});
  document.querySelectorAll('[data-fitc]').forEach(el=>{el.style.fontSize=el.dataset.fitc?(+el.dataset.fitc*(document.body.classList.contains('vuong')?.86:1))+'px':'';let s=parseFloat(getComputedStyle(el).fontSize);for(let i=0;i<90&&el.scrollHeight>el.clientHeight+1;i++){s-=1;el.style.fontSize=s+'px';}});
  document.body.dataset.ready='1';}
const imgs=[...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}));
const FONTS=['MP Viết tay 1','MP Viết tay 2','MP Viết tay 3','MP Viết tay 4','MP Chữ ký 1','MP Chữ ký 2','MP Chữ ký 3','MP Chữ ký 4','MP Chữ có chân','MP Chữ đậm có chân','MP Chữ không chân'].map(f=>document.fonts.load(`40px "${f}"`,'Ấỳ').catch(()=>0));
Promise.all([...FONTS,document.fonts.ready,...imgs]).then(()=>requestAnimationFrame(fit));
window.MAU_DU_LIEU=D;
})();
