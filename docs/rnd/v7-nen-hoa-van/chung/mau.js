/* Điền dữ liệu vào mẫu thẻ. Mỗi ô trên mẫu mang data-f="<khoá>" — khoá nào lấy từ trường nào ghi ở BAO-CAO-RND-03.md
   và packages/shared/src/design-templates.ts (SLOT_SOURCES).
   Bản chép từ docs/rnd/v3-mau-chao-mung/chung/mau.js, thêm chế độ DỮ LIỆU THẬT cho app (tham số ?that=1):
   - ô không có tham số thì để TRỐNG (không lấy chữ mẫu của R&D, không bịa); ảnh trống thì ẩn khung ảnh; logo trống thì
     bỏ hẳn ô logo (kể cả vòng bọc .ld), body thêm lớp khong-logo;
   - dòng phụ `dv` ghép từ đúng các ô có giá trị (khoá học: khoa · Lớp lop; dịch vụ: nv · goi · nsk);
   - ngày trống thì các ô ngày suy ra (thứ, tháng, năm…) cũng trống.
   Không có ?that=1 thì chạy y như bản R&D (chữ mẫu) — trang bày mẫu vẫn dùng được.
   Khổ: mặc định 1080×1350, ?kho=vuong ra 1080×1080. Phông chữ ký: ?ky=1..4. */
(function(){
const P=new URLSearchParams(location.search);
const THAT=P.get('that')==='1';
const ROOT=document.currentScript.src.replace(/mau\.js.*$/,'');
const M=THAT?{}:(window.MAC_DINH||{});
const G=THAT?((k)=>P.get(k)||''):((k,d)=>P.get(k)||M[k]||d);
const D={
  th:G('th','Chiến Makeup Academy'), logo:G('logo',ROOT+'logo-mau.svg'),
  ten:G('ten','Tôn Nữ Hoàng Bảo Ngọc Phương Thảo'), anh:G('anh',ROOT+'anh-hoc-vien.svg'),
  khoa:G('khoa','Makeup chuyên nghiệp'), lop:G('lop','K12'), ngay:G('ngay','02/11/2026'),
  lich:G('lich','T3 · T5 · T7, 18:00–22:00'), gv:G('gv','Nguyễn Thu Hà'),
  diachi:G('diachi','25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội'), sdt:G('sdt','0912 345 678'), web:G('web','chienmakeup.vn'),
  loai:(THAT?P.get('loai'):G('loai','khoa'))||'khoa',
  nv:G('nv','Cô dâu'), goi:G('goi','Ngày cưới trọn gói'), nsk:G('nsk','24/10/2026'), noi:G('noi','Tại nhà · Long Biên, Hà Nội'),
  nfb:G('nfb','12/10/2026'), sao:+(G('sao','5')||0), cc:G('cc',''), td:G('td',''), nkt:G('nkt','20/12/2026')
};

const DV=D.loai==='dv';
const cham=(s)=>s?s.split('/').join('.'):'';
Object.assign(D,{
  kh:G('kh',DV?'Phạm Thu Trang':'Nguyễn Hoa')||(THAT?D.ten:''),
  nd:G('nd',DV?'Cảm ơn team đã giúp mình có một ngày cưới thật xinh. Lớp nền nhẹ mà giữ đến tối, ảnh chụp lên rất tự nhiên. Chắc chắn mình sẽ giới thiệu bạn bè!'
    :'Em cảm ơn chị Hà nhiều lắm! Học xong khoá em đã tự tin nhận khách cô dâu đầu tiên, khách khen lớp nền mỏng mà giữ cả ngày. Lớp học vui, chị chỉ kỹ từng bước ạ.'),
  a1:G('a1',ROOT+(DV?'anh-co-dau.svg':'anh-fb-1.svg')), a2:G('a2',ROOT+(DV?'anh-co-dau-2.svg':'anh-fb-2.svg')), a3:G('a3',ROOT+'anh-fb-3.svg'),
  camNhan:DV?'Cảm nhận của khách hàng':'Cảm nhận của học viên', nhanFb:DV?'Khách nhắn cho studio':'Học viên nhắn cho lớp',
  nvThuong:D.nv.toLowerCase()});
if(THAT){
  const lopTxt=D.lop?(/^lớp\b/i.test(D.lop)?D.lop:'Lớp '+D.lop):'';
  D.dv=P.get('dv')||(DV?[D.nv,D.goi,cham(D.nsk)]:[D.khoa,lopTxt]).filter(Boolean).join(' · ');
}else{
  D.dv=G('dv',DV?`${D.nv} · ${D.goi} · ${cham(D.nsk)}`:'Makeup chuyên nghiệp · Lớp K10');
}
// Ảnh trong suốt 1×1 cho ô ảnh không có dữ liệu (khung ẩn đi; bộ xuất ảnh không phải tải gì).
const TRONG='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const THU=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
// Ngày dd/mm/yyyy → các phần; ngày trống hoặc sai dạng → null (các ô suy ra để trống).
const tach=(s)=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s||'');return m?{d:m[1],m:m[2],y:m[3],t:new Date(+m[3],+m[2]-1,+m[1]).getDay()}:null;};
const n0=tach(D.ngay);
Object.assign(D,{ngayD:n0?n0.d:'',thangSo:n0?'Tháng '+(+n0.m):'',nam:n0?n0.y:'',ngayCham:cham(D.ngay),thangNam:n0?`Tháng ${+n0.m} · ${n0.y}`:'',
  thu:n0?THU[n0.t]:'',gio:(D.lich.split(',')[1]||'').trim(),
  nfbCham:cham(D.nfb),nskCham:cham(D.nsk),cauDau:(D.nd.match(/^[^.!?]+[.!?]?/)||[D.nd])[0].trim()});
{const s=tach(D.nsk);D.nskChu=s?`${THU[s.t]}, ${+s.d} tháng ${+s.m} năm ${s.y}`:'';D.nskThangNam=s?`Tháng ${+s.m} · ${s.y}`:'';}
D.nktCham=cham(D.nkt);
D.conLai=D.nd.slice(D.nd.indexOf(D.cauDau)+D.cauDau.length).trim();
document.body.classList.add(P.get('kho')==='vuong'?'vuong':'k45');
if(P.get('ky')){const n=P.get('ky');const r=document.documentElement.style;for(let i=1;i<=4;i++){r.setProperty('--f-tay-'+i,`var(--f-ky-${n})`);r.setProperty('--tay-co-'+i,`var(--ky-co-${n})`);}}
// Logo trống (học viện chưa có logo): ẩn HẲN ô logo — cả vòng tròn bọc ngoài (.ld) — để không in ra ô vuông / vòng tròn
// trống và để chữ tên thương hiệu đứng giữa đúng chỗ; body có lớp khong-logo cho mẫu nào cần chỉnh thêm (biên bản L6).
const anLogo=(el)=>{el.style.display='none';const w=el.closest('.ld');if(w)w.style.display='none';document.body.classList.add('khong-logo');};
document.querySelectorAll('[data-f]').forEach(el=>{const v=D[el.dataset.f];
  if(el.tagName==='IMG'){if(v)el.src=v;else{el.src=TRONG;if(el.dataset.f==='logo')anLogo(el);else el.style.visibility='hidden';}}
  else el.textContent=v==null?'':v;});
document.querySelectorAll('[data-chat]').forEach(el=>{const parts=D.nd.match(/[^.!?]+[.!?]*/g)||[D.nd];
  const n=+el.dataset.chat||3;const g=[];parts.forEach((s,i)=>{const k=Math.min(n-1,Math.floor(i*n/parts.length));g[k]=(g[k]||'')+s;});
  el.innerHTML=g.filter(Boolean).map(t=>`<div class="bb">${t.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>`).join('');});
const STAR='<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor"/></svg>';
document.querySelectorAll('[data-sao]').forEach(el=>{el.innerHTML=STAR.repeat(Math.max(0,Math.min(5,D.sao||0)));});
document.querySelectorAll('[data-qr]').forEach(el=>{const v=D[el.dataset.qr];if(!v){el.innerHTML='';el.style.visibility='hidden';return;}
  try{const q=qrcode(0,'M');q.addData('https://'+v.replace(/^https?:\/\//,''));q.make();
  el.innerHTML=q.createSvgTag({cellSize:4,margin:0,scalable:true});el.querySelectorAll('path,rect').forEach(p=>{if(p.getAttribute('fill')==='black'||p.getAttribute('fill')==='#000000')p.setAttribute('fill','currentColor')});}catch(e){el.textContent=''}});
let xong;const sanSang=new Promise(r=>{xong=r;});
function fit(){
  document.querySelectorAll('[data-fit]').forEach(el=>{el.style.fontSize='';const max=+el.dataset.fit;let s=parseFloat(getComputedStyle(el).fontSize);
    for(let i=0;i<90;i++){const cs=getComputedStyle(el);const lh=parseFloat(cs.lineHeight)||s*1.2;const pad=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
      if(el.offsetHeight-pad<=lh*max+4&&el.scrollWidth<=el.clientWidth+1)break;s-=1.5;el.style.fontSize=s+'px';}});
  document.querySelectorAll('[data-fitw]').forEach(el=>{el.style.fontSize='';let s=parseFloat(getComputedStyle(el).fontSize);for(let i=0;i<90&&el.scrollWidth>el.clientWidth+1;i++){s-=1.5;el.style.fontSize=s+'px';}});
  document.querySelectorAll('[data-fitc]').forEach(el=>{el.style.fontSize=el.dataset.fitc?(+el.dataset.fitc*(document.body.classList.contains('vuong')?.86:1))+'px':'';let s=parseFloat(getComputedStyle(el).fontSize);for(let i=0;i<90&&el.scrollHeight>el.clientHeight+1;i++){s-=1;el.style.fontSize=s+'px';}});
  document.body.dataset.ready='1';xong();}
const imgs=[...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}));
const FONTS=['MP Viết tay 1','MP Viết tay 2','MP Viết tay 3','MP Viết tay 4','MP Chữ ký 1','MP Chữ ký 2','MP Chữ ký 3','MP Chữ ký 4','MP Chữ có chân','MP Chữ đậm có chân','MP Chữ không chân'].map(f=>document.fonts.load(`40px "${f}"`,'Ấỳ').catch(()=>0));
Promise.all([...FONTS,document.fonts.ready,...imgs]).then(()=>requestAnimationFrame(fit));
window.MAU_DU_LIEU=D;
// App chờ lời hứa này trước khi xuất ảnh (chung/xuat.js).
window.MAU_SAN_SANG=sanSang;
})();
