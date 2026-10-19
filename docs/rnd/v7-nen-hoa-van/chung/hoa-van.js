/* Makeup Pro · R&D 07 · THƯ VIỆN HỌA TIẾT CHÌM + KHUNG TRANG TRÍ
   Toàn bộ họa tiết do R&D tự vẽ bằng mã SVG trong tệp này (không lấy ảnh mạng) → studio dùng thương mại thoải mái.
   - HOA_VAN[id] = { ten, w, h, ve(mau) }  : một ô lặp (tile) w×h px, vẽ bằng màu `mau`. Lớp nền tự lặp ô ra cả thẻ.
   - KHUNG[id]   = { ten, ve(W,H,mau) }    : khung trang trí vẽ theo đúng khổ thẻ (1080×1350 hay 1080×1080 đều khít,
                                             giống kiểu "9 lát" — góc giữ nguyên, cạnh tự dài ra).
   Độ đậm do lớp ngoài quyết định (tham số ?dam=), ở đây vẽ màu đặc. */
(function(){
const f=(n)=>Math.round(n*100)/100;
// Điểm và góc tiếp tuyến trên đường cong bậc ba (dùng để rải lá dọc cành).
function bez(p,t){const u=1-t;
  const x=u*u*u*p[0]+3*u*u*t*p[2]+3*u*t*t*p[4]+t*t*t*p[6], y=u*u*u*p[1]+3*u*u*t*p[3]+3*u*t*t*p[5]+t*t*t*p[7];
  const dx=3*u*u*(p[2]-p[0])+6*u*t*(p[4]-p[2])+3*t*t*(p[6]-p[4]), dy=3*u*u*(p[3]-p[1])+6*u*t*(p[5]-p[3])+3*t*t*(p[7]-p[5]);
  return {x,y,a:Math.atan2(dy,dx)*180/Math.PI};}
const LA='M0,0 C7,-9 20,-11 30,-6 C21,1 9,4 0,0 Z'; // một chiếc lá hình hạt hạnh nhân, dài 30
function la(x,y,a,s,mau,dac){return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(a)}) scale(${f(s)})"><path d="${LA}" ${dac?`fill="${mau}"`:`fill="none" stroke="${mau}" stroke-width="${f(1.3/s)}"`}/><path d="M2,-1 C10,-4 18,-5 26,-5" fill="none" stroke="${dac?'#fff':mau}" stroke-opacity="${dac?.55:1}" stroke-width="${f(.9/s)}"/></g>`;}
// Cành lá nét mảnh: thân cong + lá so le + quả nhỏ.
function canh(p,mau,o={}){const n=o.n||6,dac=o.dac;let s=`<path d="M${p[0]},${p[1]} C${p[2]},${p[3]} ${p[4]},${p[5]} ${p[6]},${p[7]}" fill="none" stroke="${mau}" stroke-width="${o.sw||1.4}" stroke-linecap="round"/>`;
  for(let i=0;i<n;i++){const t=.14+i*(.8/n);const b=bez(p,t);const ben=i%2?1:-1;const sc=(o.s||1)*(1-t*.45);
    s+=la(b.x,b.y,b.a+ben*48,sc,mau,dac);}
  const e=bez(p,1);s+=la(e.x,e.y,e.a,(o.s||1)*.5,mau,dac);
  if(o.qua){const b=bez(p,.55);s+=`<path d="M${f(b.x)},${f(b.y)} q8,10 18,10" fill="none" stroke="${mau}" stroke-width="1.1"/><circle cx="${f(b.x+19)}" cy="${f(b.y+10)}" r="3" fill="${mau}"/><circle cx="${f(b.x+12)}" cy="${f(b.y+16)}" r="2.4" fill="${mau}"/>`;}
  return s;}

/* ---------- 1. Damask cổ điển (đối xứng, lặp so le) ---------- */
function damaskNua(c){return `
<path d="M0,-118 C10,-104 15,-88 0,-70 Z" fill="${c}"/>
<path d="M0,-62 C22,-74 48,-66 52,-40 C56,-14 30,-6 24,-22 C20,-33 34,-38 38,-28" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M52,-40 C70,-52 80,-74 72,-98 C60,-84 52,-64 52,-40 Z" fill="${c}"/>
<path d="M0,-50 C10,-30 10,-10 0,8 Z" fill="${c}"/>
<path d="M0,16 C18,12 40,20 50,40 C54,50 50,60 42,62 C46,52 40,42 30,40 C20,38 10,40 0,42 Z" fill="${c}"/>
<path d="M52,68 C62,82 58,98 46,106 C40,110 34,104 38,98" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M0,48 C9,64 9,84 0,102 Z" fill="${c}"/>
<path d="M0,108 C14,110 20,120 14,130" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M30,-6 C42,8 58,14 70,6" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="28" cy="-94" r="3.4" fill="${c}"/><circle cx="74" cy="4" r="3" fill="${c}"/><circle cx="24" cy="86" r="3" fill="${c}"/>`;}
function damask(c){const m=`<g transform="scale(.82)">${damaskNua(c)}<g transform="scale(-1,1)">${damaskNua(c)}</g></g>`;
  return [[120,155],[0,0],[240,0],[0,310],[240,310]].map(([x,y])=>`<g transform="translate(${x},${y})">${m}</g>`).join('');}

/* ---------- 2. Ren lưới hoa (lưới mắt cáo + bông ren sáu cánh) ---------- */
function bong(x,y,r,c){let s='';for(let i=0;i<6;i++)s+=`<ellipse cx="0" cy="${-r}" rx="${f(r*.42)}" ry="${f(r*.72)}" transform="rotate(${i*60})" fill="${c}"/>`;
  return `<g transform="translate(${x},${y})">${s}<circle r="${f(r*.42)}" fill="#F5EFE4" stroke="${c}" stroke-width="1.2"/><circle r="${f(r*.14)}" fill="${c}"/></g>`;}
function ren(c){let s=`<g fill="none" stroke="${c}" stroke-width="1" stroke-opacity=".7">`;
  for(const [ox,oy] of [[0,0],[48,0],[0,42],[48,42]])s+=`<path d="M${ox},${oy+21} L${ox+24},${oy} L${ox+48},${oy+21} L${ox+24},${oy+42} Z"/>`;
  s+='</g>';for(const [x,y] of [[48,42],[0,0],[96,0],[0,84],[96,84]])s+=bong(x,y,9,c);
  for(const [x,y] of [[48,0],[0,42],[96,42],[48,84]])s+=`<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/>`;
  return s;}

/* ---------- 3. Lá cành nét mảnh (rải chéo) ---------- */
function laCanh(c){return `<g transform="translate(40,150) rotate(-38)">${canh([0,0,30,-30,60,-70,66,-120],c,{n:6,qua:1})}</g>
<g transform="translate(250,150) rotate(150)">${canh([0,0,30,-30,60,-70,66,-120],c,{n:6,qua:1})}</g>
<g transform="translate(176,62) rotate(70)">${canh([0,0,12,-14,22,-30,24,-52],c,{n:3,s:.7})}</g>
<g transform="translate(116,250) rotate(-120)">${canh([0,0,12,-14,22,-30,24,-52],c,{n:3,s:.7})}</g>
<circle cx="214" cy="232" r="2.4" fill="${c}"/><circle cx="34" cy="40" r="2.4" fill="${c}"/><circle cx="150" cy="168" r="2" fill="${c}"/>`;}

/* ---------- 4. Sóng nước (hoa văn vảy sóng Á Đông) ---------- */
function songNuoc(c){const R=34;let s='';
  for(let j=-1;j<=2;j++)for(let i=-1;i<=2;i++){const x=i*2*R+(Math.abs(j)%2)*R,y=j*R/2;
    s+=`<g transform="translate(${x},${y})"><circle r="${R}" fill="#F5EFE4" stroke="${c}" stroke-width="1.3"/>`+
       [0.74,0.5,0.27].map(k=>`<circle r="${f(R*k)}" fill="none" stroke="${c}" stroke-width="1.1"/>`).join('')+'</g>';}
  return s;}
// Ô lặp sóng nước dùng màu nền (#F5EFE4) để che vảy hàng trên — lớp nền tự thay màu này bằng màu nền thật của mẫu.

/* ---------- 5. Mây lành (mây cuộn như ý) ---------- */
function may(c){const m=`<path d="M0,0 C-10,-26 20,-40 34,-22 C44,-46 82,-42 84,-14 C104,-22 118,4 100,16 L-6,16 C-26,16 -24,-6 0,0 Z" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M18,-4 C14,-18 32,-20 30,-8 C29,-2 22,-3 23,-8" fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/>
<path d="M56,-8 C54,-26 78,-28 76,-12 C75,-4 66,-5 67,-11" fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/>
<path d="M100,16 C124,22 136,6 128,-4 C123,-10 114,-5 118,1" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>
<path d="M-6,16 C-30,24 -46,14 -44,4" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`;
  return `<g transform="translate(62,70)">${m}</g><g transform="translate(250,170) scale(-1,1)">${m}</g>`;}

/* ---------- 6. Hồi văn (vuông móc nối, viền đình chùa) ---------- */
function hoiVan(c){return `<path d="M0,52 H60 M8,52 V8 H52 V44 H20 V20 H40 V32 H30" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="miter"/>`;}

window.HOA_VAN={
  damask:{ten:'Damask cổ điển',w:240,h:310,ve:damask},
  ren:{ten:'Ren lưới hoa',w:96,h:84,ve:ren},
  'la-canh':{ten:'Lá cành nét mảnh',w:290,h:290,ve:laCanh},
  'song-nuoc':{ten:'Sóng nước Á Đông',w:68,h:34,ve:songNuoc,che:true},
  may:{ten:'Mây lành',w:300,h:200,ve:may},
  'hoi-van':{ten:'Hồi văn',w:60,h:60,ve:hoiVan},
};

/* ================= KHUNG TRANG TRÍ (phương án 3) ================= */
// Bông hoa hồng nhìn từ trên: cánh ngoài, cánh trong, nhụy xoắn.
function hong(x,y,r,mau,to){let s=`<g transform="translate(${x},${y})">`;
  for(let i=0;i<5;i++)s+=`<path d="M0,0 C${f(-r*.7)},${f(-r*.5)} ${f(-r*.55)},${f(-r*1.1)} 0,${f(-r*1.08)} C${f(r*.55)},${f(-r*1.1)} ${f(r*.7)},${f(-r*.5)} 0,0 Z" transform="rotate(${i*72+18})" fill="${to}" stroke="${mau}" stroke-width="1.3"/>`;
  for(let i=0;i<5;i++)s+=`<path d="M0,0 C${f(-r*.4)},${f(-r*.3)} ${f(-r*.3)},${f(-r*.66)} 0,${f(-r*.64)} C${f(r*.3)},${f(-r*.66)} ${f(r*.4)},${f(-r*.3)} 0,0 Z" transform="rotate(${i*72+54})" fill="${to}" stroke="${mau}" stroke-width="1.1"/>`;
  return s+`<path d="M${f(-r*.18)},0 a${f(r*.18)},${f(r*.18)} 0 1 1 ${f(r*.3)},${f(r*.1)} a${f(r*.1)},${f(r*.1)} 0 1 1 ${f(-r*.12)},${f(-r*.14)}" fill="none" stroke="${mau}" stroke-width="1.2"/></g>`;}
function nu(x,y,a,r,mau,to){return `<g transform="translate(${x},${y}) rotate(${a})"><path d="M0,0 C${-r},${-r*.6} ${-r*.5},${-r*1.6} 0,${-r*1.8} C${r*.5},${-r*1.6} ${r},${-r*.6} 0,0 Z" fill="${to}" stroke="${mau}" stroke-width="1.2"/><path d="M0,0 C-4,4 -4,10 0,14" fill="none" stroke="${mau}" stroke-width="1.2"/></g>`;}
function gocHoa(mau){const to='#F1DCD0';
  return canh([10,250,6,140,50,46,232,10],mau,{n:9,s:1.25,sw:1.6,dac:false})+
    canh([40,40,80,70,120,96,170,100],mau,{n:4,s:.9})+canh([40,40,70,80,96,120,100,170],mau,{n:4,s:.9})+
    hong(58,58,30,mau,to)+nu(140,26,64,9,mau,to)+nu(26,140,-154,9,mau,to)+hong(196,40,13,mau,to)+hong(40,196,13,mau,to)+
    `<circle cx="104" cy="58" r="3" fill="${mau}"/><circle cx="58" cy="104" r="3" fill="${mau}"/><circle cx="250" cy="16" r="2.6" fill="${mau}"/><circle cx="16" cy="250" r="2.6" fill="${mau}"/>`;}
function bonGoc(W,H,ve,lech){const g=ve();const d=lech;
  return `<g transform="translate(${d},${d})">${g}</g><g transform="translate(${W-d},${d}) scale(-1,1)">${g}</g>`+
    `<g transform="translate(${d},${H-d}) scale(1,-1)">${g}</g><g transform="translate(${W-d},${H-d}) scale(-1,-1)">${g}</g>`;}
// Viền ren răng cưa: dải ren chạy quanh thẻ, mỗi "răng" một vòm có lỗ xâu, góc là bông ren.
function renCanh(x1,y1,len,doc,mau){const n=Math.max(6,Math.round(len/44)),b=len/n;let s='';
  for(let i=0;i<n;i++){const a=i*b;
    if(!doc)s+=`<path d="M${f(x1+a)},${y1} a${f(b/2)},${f(b*.48)} 0 0 0 ${f(b)},0" fill="#EFE3CF" stroke="${mau}" stroke-width="1.3"/><circle cx="${f(x1+a+b/2)}" cy="${f(y1+b*.2)}" r="3.6" fill="#F5EFE4" stroke="${mau}" stroke-width="1.1"/><circle cx="${f(x1+a+b)}" cy="${f(y1+b*.5)}" r="1.8" fill="${mau}"/>`;
    else s+=`<path d="M${x1},${f(y1+a)} a${f(b*.48)},${f(b/2)} 0 0 1 0,${f(b)}" fill="#EFE3CF" stroke="${mau}" stroke-width="1.3"/><circle cx="${f(x1+b*.2)}" cy="${f(y1+a+b/2)}" r="3.6" fill="#F5EFE4" stroke="${mau}" stroke-width="1.1"/><circle cx="${f(x1+b*.5)}" cy="${f(y1+a+b)}" r="1.8" fill="${mau}"/>`;}
  return s;}
function khungRen(W,H,mau){const d=40,L=W-2*d,Hh=H-2*d;
  const tren=renCanh(d,d,L,0,mau);
  const s=`<rect x="${d-10}" y="${d-10}" width="${L+20}" height="${Hh+20}" fill="none" stroke="${mau}" stroke-width="1.6"/>`+
    `<rect x="${d}" y="${d}" width="${L}" height="${Hh}" fill="none" stroke="${mau}" stroke-width=".8"/>`+
    `<g>${tren}</g><g transform="translate(${W},${H}) rotate(180)">${tren}</g>`+
    `<g>${renCanh(d,d,Hh,1,mau)}</g><g transform="translate(${W},${H}) rotate(180)">${renCanh(d,d,Hh,1,mau)}</g>`;
  const goc=(x,y)=>bong(x,y,13,mau);
  return s+goc(d,d)+goc(W-d,d)+goc(d,H-d)+goc(W-d,H-d);}
// Dải hồi văn chạy quanh thẻ (kiểu khung tranh Á Đông).
function khungHoiVan(W,H,mau){const d=34,t=34;
  const tile=`<path d="M0,30 H34 M5,30 V4 H30 V26 H12 V12 H24 V20 H18" fill="none" stroke="${mau}" stroke-width="1.8"/>`;
  // Dải dọc theo trục x, dài len: chia đều số ô vuông móc, giãn nhẹ cho khít (cạnh nào cũng tròn ô, không bị cắt dở).
  const dai=(len)=>{const n=Math.max(1,Math.round(len/34)),b=len/n;let s='';for(let i=0;i<n;i++)s+=`<g transform="translate(${f(i*b)},0) scale(${f(b/34)},1)">${tile}</g>`;return s;};
  const LW=W-2*d-2*t,LH=H-2*d-2*t;
  return `<g transform="translate(${d+t},${d})">${dai(LW)}</g><g transform="translate(${W-d-t},${H-d}) rotate(180)">${dai(LW)}</g>`+
    `<g transform="translate(${d},${H-d-t}) rotate(-90)">${dai(LH)}</g><g transform="translate(${W-d},${d+t}) rotate(90)">${dai(LH)}</g>`+
    `<rect x="${d-6}" y="${d-6}" width="${W-2*d+12}" height="${H-2*d+12}" fill="none" stroke="${mau}" stroke-width="1.4"/>`+
    `<rect x="${d+t+6}" y="${d+t+6}" width="${LW-12}" height="${LH-12}" fill="none" stroke="${mau}" stroke-width=".8"/>`+
  [[d,d],[W-d-t,d],[d,H-d-t],[W-d-t,H-d-t]].map(([x,y])=>`<rect x="${x+3}" y="${y+3}" width="${t-6}" height="${t-6}" fill="none" stroke="${mau}" stroke-width="1.6"/><rect x="${x+11}" y="${y+11}" width="${t-22}" height="${t-22}" fill="${mau}"/>`).join('');}

window.KHUNG={
  'goc-hoa':{ten:'Góc hoa hồng',ve:(W,H,m)=>bonGoc(W,H,()=>gocHoa(m),26)+`<rect x="58" y="58" width="${W-116}" height="${H-116}" fill="none" stroke="${m}" stroke-width=".9"/>`},
  'khung-ren':{ten:'Khung ren răng cưa',ve:khungRen},
  'hoi-van':{ten:'Khung hồi văn',ve:khungHoiVan},
};
})();
