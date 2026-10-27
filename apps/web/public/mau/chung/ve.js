/* Makeup Pro · THƯ VIỆN HÌNH VẼ (bản vẽ H: chép nguyên từ bản R&D-10, không đổi hình) cho 10 mẫu chào mừng (19/10/2026).
   Mọi hình do R&D tự vẽ bằng SVG (không lấy ảnh mạng). Phần "Nền hoa lá khắc / giấy / dấu sáp / khung cổ điển / tiền giấy / thảm Ba Tư"
   chép lại từ bộ vẽ giấy hoa văn của R&D-07 vòng 2 (v7-nen-hoa-van); phần "giấy xé + washi, thiệp gập + ruy băng, khung gương oval,
   chữ vàng gradient SVG" là mới của R&D-10.
   API: VE.kho(W,H) · VE.ve(c, svgString) · VE.chuVang(sel) · các hàm vẽ trả về chuỗi SVG. */
(function(){
const P=new URLSearchParams(location.search);
let W=1080,H=P.get('kho')==='vuong'?1080:1350;
const f=(n)=>Math.round(n*10)/10;
const NS='http://www.w3.org/2000/svg';
function laDai(L){return `M0,0 C${f(L*.28)},${f(-L*.13)} ${f(L*.7)},${f(-L*.11)} ${L},0 C${f(L*.7)},${f(L*.09)} ${f(L*.28)},${f(L*.11)} 0,0Z`;}
function duongCong(p,t){const u=1-t;return {x:u*u*u*p[0]+3*u*u*t*p[2]+3*u*t*t*p[4]+t*t*t*p[6],y:u*u*u*p[1]+3*u*u*t*p[3]+3*u*t*t*p[5]+t*t*t*p[7],
  a:Math.atan2(3*u*u*(p[3]-p[1])+6*u*t*(p[5]-p[3])+3*t*t*(p[7]-p[5]),3*u*u*(p[2]-p[0])+6*u*t*(p[4]-p[2])+3*t*t*(p[6]-p[4]))*180/Math.PI};}
function duongXi(x,y,a,len,m){const p=[0,0,len*.33,-len*.07,len*.66,-len*.1,len,-len*.04];let s=`<g transform="translate(${f(x)},${f(y)}) rotate(${a})"><path d="M0,0 C${p.slice(2).join(' ')}" fill="none" stroke="${m}" stroke-width="2.4"/>`;
  const n=22;for(let i=1;i<n;i++){const t=i/n,b=duongCong(p,t),L=len*.24*(1-t*.75);
    for(const sg of [-1,1])s+=`<path d="${laDai(L)}" transform="translate(${f(b.x)},${f(b.y)}) rotate(${f(b.a+sg*62)})" fill="url(#gach)" stroke="${m}" stroke-width="1.2"/>`;}
  return s+'</g>';}
function laTo(x,y,a,L,m){return `<g transform="translate(${x},${y}) rotate(${a})"><path d="M0,0 C${L*.3},${-L*.28} ${L*.75},${-L*.26} ${L},0 C${L*.75},${L*.24} ${L*.3},${L*.26} 0,0Z" fill="url(#gach)" stroke="${m}" stroke-width="1.6"/>`+
  `<path d="M0,0 C${L*.3},${-L*.28} ${L*.75},${-L*.26} ${L},0 L0,0Z" fill="url(#gach2)" opacity=".8"/><path d="M0,0 L${L},0" stroke="${m}" stroke-width="1.6"/>`+
  [.2,.4,.6,.8].map(k=>`<path d="M${L*k},0 q${L*.08},${-L*.1} ${L*.16},${-L*.17} M${L*k},0 q${L*.08},${L*.1} ${L*.16},${L*.16}" fill="none" stroke="${m}" stroke-width="1.1"/>`).join('')+'</g>';}
function hoaKhac(x,y,R,m,nen){let s=`<g transform="translate(${x},${y})">`;
  [[1,9,'url(#gach)'],[.72,8,nen],[.48,7,'url(#gach2)']].forEach(([k,n,fill],j)=>{for(let i=0;i<n;i++){const r=R*k,a=i*360/n+j*14;
    s+=`<path d="M0,0 C${f(-r*.55)},${f(-r*.4)} ${f(-r*.6)},${f(-r*1.02)} 0,${f(-r)} C${f(r*.6)},${f(-r*1.02)} ${f(r*.55)},${f(-r*.4)} 0,0Z" transform="rotate(${f(a)})" fill="${fill}" stroke="${m}" stroke-width="1.5"/>`;}});
  for(let i=0;i<14;i++){const a=i*2*Math.PI/14;s+=`<circle cx="${f(Math.cos(a)*R*.18)}" cy="${f(Math.sin(a)*R*.18)}" r="${f(R*.045)}" fill="${m}"/>`;}
  return s+'</g>';}
function chumQua(x,y,m,nen){let s=`<g transform="translate(${x},${y})">`;for(let r=0;r<6;r++)for(let i=0;i<=r;i++)s+=`<circle cx="${f((i-r/2)*17)}" cy="${f(r*15)}" r="9" fill="${(i+r)%2?'url(#gach)':nen}" stroke="${m}" stroke-width="1.3"/>`;return s+'</g>';}
function veKhac(m,nen){const k=W/1080,h=H/1350;
  return `<defs><pattern id="gach" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="5" stroke="${m}" stroke-width="1.3"/></pattern>
<pattern id="gach2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-55)"><line x1="0" y1="0" x2="0" y2="4" stroke="${m}" stroke-width="1.2"/></pattern></defs>
<rect width="${W}" height="${H}" fill="${nen}"/>`+
  duongXi(40,H+30,-62,700*h,m)+duongXi(W-30,-30,118,640*h,m)+duongXi(-30,H*.42,-8,430*k,m)+duongXi(W+30,H*.6,186,430*k,m)+duongXi(W*.3,-40,75,300,m)+duongXi(W*.75,H+40,-100,320,m)+
  laTo(160,H-60,-40,220,m)+laTo(W-200,90,140,200,m)+laTo(40,260,20,190,m)+laTo(W-40,H-330,200,200,m)+
  hoaKhac(120*k,150*h,125,m,nen)+hoaKhac(W-130*k,H-170*h,145,m,nen)+hoaKhac(W-40,H*.33,85,m,nen)+hoaKhac(60,H*.78,70,m,nen)+
  chumQua(W-150,H*.47,m,nen)+chumQua(70,H*.55,m,nen);}
const NEN_MAU={'khac-lam':['#2F4F86','#F7F5EF'],'khac-reu':['#3D5A40','#F3F1E7'],'toi-reu':['#D9CFAE','#1F3328']};
function hinhChuNhat(b){return `M${b.x},${b.y}h${b.w}v${b.h}h${-b.w}Z`;}
// Panel bo góc lõm + vòm trên/dưới (học từ ảnh 8 anh gửi).
function hinhPanel(b,r,a,s){const x0=b.x,y0=b.y,x1=b.x+b.w,y1=b.y+b.h,rx=(b.w-2*r-2*s)/2;
  return `M${x0},${y0+a+r} A${r},${r} 0 0 0 ${x0+r},${y0+a} H${x0+r+s} A${f(rx)},${a} 0 0 1 ${x1-r-s},${y0+a} H${x1-r} A${r},${r} 0 0 0 ${x1},${y0+a+r}`+
    ` V${y1-a-r} A${r},${r} 0 0 0 ${x1-r},${y1-a} H${x1-r-s} A${f(rx)},${a} 0 0 1 ${x0+r+s},${y1-a} H${x0+r} A${r},${r} 0 0 0 ${x0},${y1-a-r} Z`;}
function loTem(b,rr,buoc){let s='';const n=Math.round(b.w/buoc),m=Math.round(b.h/buoc);
  for(let i=0;i<n;i++){const x=b.x+(i+.5)*b.w/n;s+=`<circle cx="${f(x)}" cy="${b.y}" r="${rr}"/><circle cx="${f(x)}" cy="${b.y+b.h}" r="${rr}"/>`;}
  for(let i=0;i<m;i++){const y=b.y+(i+.5)*b.h/m;s+=`<circle cx="${b.x}" cy="${f(y)}" r="${rr}"/><circle cx="${b.x+b.w}" cy="${f(y)}" r="${rr}"/>`;}
  return s;}
const GIAY_MAU='#F5EFE3';
// Vân giấy: nhiễu sợi dọc-chéo (feTurbulence), chỉ lấy đốm sẫm thưa → giống giấy mỹ thuật; cắt đúng theo hình tấm giấy.
const LOC=`<filter id="van" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".55 .85" numOctaves="4" seed="11" result="n"/>
<feColorMatrix in="n" values="0 0 0 0 .55  0 0 0 0 .47  0 0 0 0 .36  1.9 0 0 0 -1.12" result="d"/><feComposite in="d" in2="SourceGraphic" operator="in"/></filter>
<filter id="van2" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="4" result="n"/>
<feColorMatrix in="n" values="0 0 0 0 .62  0 0 0 0 .55  0 0 0 0 .44  0 0 0 .22 -.07" result="d"/><feComposite in="d" in2="SourceGraphic" operator="in"/></filter>
<filter id="bong" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity=".32"/></filter>
<filter id="bongnho" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="2" dy="5" stdDeviation="5" flood-color="#2a1a00" flood-opacity=".45"/></filter>`;
function giayVan(d,extra=''){return `<g filter="url(#bong)"><path d="${d}" fill="${GIAY_MAU}" ${extra}/></g><path d="${d}" fill="#fff" filter="url(#van2)" ${extra}/><path d="${d}" fill="#fff" filter="url(#van)" ${extra}/>`;}
// Dấu sáp: mép nhoè không đều, gradient vàng (hoặc đỏ rượu), vòng ép, chữ lồng nổi.
function dauSap(cx,cy,r,chu,mau){const G=mau==='do'?['#E07A6E','#B23B32','#86241F','#5E1714','#4A0F0D','#F4B3A8']:['#F6DE9A','#D4A64F','#A8792E','#7C5520','#6B4618','#F7E3A8'];
  let d='';const n=44;for(let i=0;i<=n;i++){const t=i/n*2*Math.PI,rr=r*(1+.055*Math.sin(5*t+1)+.035*Math.sin(11*t+2)+.02*Math.sin(17*t));const x=cx+Math.cos(t)*rr,y=cy+Math.sin(t)*rr;d+=(i?'L':'M')+f(x)+','+f(y);}
  return `<defs><radialGradient id="dg" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="${G[0]}"/><stop offset=".45" stop-color="${G[1]}"/><stop offset=".8" stop-color="${G[2]}"/><stop offset="1" stop-color="${G[3]}"/></radialGradient>
<radialGradient id="dg2" cx=".6" cy=".65" r=".75"><stop offset="0" stop-color="${G[0]}"/><stop offset=".6" stop-color="${G[1]}"/><stop offset="1" stop-color="${G[2]}"/></radialGradient></defs>
<g filter="url(#bongnho)"><path d="${d}Z" fill="url(#dg)"/></g>
<circle cx="${cx}" cy="${cy}" r="${f(r*.72)}" fill="url(#dg2)" stroke="${G[4]}" stroke-width="3"/><circle cx="${cx-1.5}" cy="${cy-1.5}" r="${f(r*.72+2)}" fill="none" stroke="${G[5]}" stroke-width="1.4" opacity=".75"/>
<text x="${cx-2}" y="${f(cy+r*.3-2)}" font-family="MP Viết tay 1" font-size="${f(r*1.05)}" text-anchor="middle" fill="${G[5]}" opacity=".85">${chu}</text>
<text x="${cx}" y="${f(cy+r*.3)}" font-family="MP Viết tay 1" font-size="${f(r*1.05)}" text-anchor="middle" fill="${G[4]}">${chu}</text>`;}
function xoanC(m,sw){return `<path d="M0,0 C26,0 44,-14 44,-30 C44,-42 32,-46 25,-40 C19,-35 22,-26 29,-27" fill="none" stroke="${m}" stroke-width="${sw}" stroke-linecap="round"/>`;}
// Fleur-de-lis: cánh giữa nhọn, hai cánh bên vươn ra rồi cuộn xuống, đai ngang, hai đuôi nhỏ. Vẽ hướng lên (−y).
function fleur(m){const ben=`<path d="M3,-6 C14,-18 30,-30 42,-22 C52,-15 46,-2 36,-4 C42,-8 41,-16 34,-17 C24,-18 14,-10 8,0 Z" fill="${m}"/><path d="M5,6 C10,12 18,16 26,14 C22,20 12,20 4,12 Z" fill="${m}"/>`;
  return `<path d="M0,-4 C9,-20 12,-44 0,-72 C-12,-44 -9,-20 0,-4 Z" fill="${m}"/>${ben}<g transform="scale(-1,1)">${ben}</g><rect x="-14" y="-4" width="28" height="7" rx="3" fill="${m}"/><path d="M0,3 L4,12 L0,20 L-4,12Z" fill="${m}"/>`;}
function gocCoDien(m){const xo=`<g transform="scale(1,-1)">${xoanC(m,2)}</g><path d="M0,0 H90" stroke="${m}" stroke-width="1.3"/><circle cx="96" cy="0" r="3" fill="${m}"/>`;
  return `<g transform="translate(40,40) rotate(-45) scale(.85)">${fleur(m)}</g>`+
  `<g transform="translate(96,10)">${xo}</g><g transform="translate(10,96) matrix(0,1,1,0,0,0)">${xo}</g>`;}
function cumGiua(m){return `<path d="M0,-7 L7,0 L0,7 L-7,0Z" fill="${m}"/>`+[1,-1].map(sg=>`<g transform="scale(${sg},1) translate(12,0)"><path d="M0,0 C14,-14 34,-12 36,0 C38,10 26,14 22,6 C20,1 26,-2 29,1" fill="none" stroke="${m}" stroke-width="1.8" stroke-linecap="round"/><path d="M0,0 C14,14 34,12 36,0" fill="none" stroke="${m}" stroke-width="1.3"/></g>`).join('');}
function khungCoDien(m,nen){const o=36,i=50;let s=`<rect width="${W}" height="${H}" fill="${nen}"/><rect x="${o}" y="${o}" width="${W-2*o}" height="${H-2*o}" fill="none" stroke="${m}" stroke-width="2.6"/><rect x="${i}" y="${i}" width="${W-2*i}" height="${H-2*i}" fill="none" stroke="${m}" stroke-width="1"/>`;
  const g=gocCoDien(m),d=i+8;
  s+=`<g transform="translate(${d},${d})">${g}</g><g transform="translate(${W-d},${d}) scale(-1,1)">${g}</g><g transform="translate(${d},${H-d}) scale(1,-1)">${g}</g><g transform="translate(${W-d},${H-d}) scale(-1,-1)">${g}</g>`;
  const L=W*.2;for(const y of [i+26,H-i-26])s+=`<path d="M${W/2-L},${y} H${W/2-58} M${W/2+58},${y} H${W/2+L}" stroke="${m}" stroke-width="1.2"/><g transform="translate(${W/2},${y})">${cumGiua(m)}</g>`;
  const V=H*.14;for(const x of [i+26,W-i-26])s+=`<path d="M${x},${H/2-V} V${H/2-58} M${x},${H/2+58} V${H/2+V}" stroke="${m}" stroke-width="1.2"/><circle cx="${x}" cy="${H/2-V}" r="3.5" fill="${m}"/><circle cx="${x}" cy="${H/2+V}" r="3.5" fill="${m}"/><g transform="translate(${x},${H/2}) rotate(90)">${cumGiua(m)}</g>`;
  return s;}

/* ---------------- (f) Khung tiền giấy / chứng khoán ---------------- */
function hoaThi(cx,cy,R,m){let s=`<g transform="translate(${cx},${cy})" fill="none" stroke="${m}" stroke-width=".7">`;
  for(let i=0;i<36;i++)s+=`<ellipse rx="${R}" ry="${f(R*.32)}" transform="rotate(${i*5})"/>`;
  for(let i=0;i<24;i++)s+=`<ellipse rx="${f(R*.55)}" ry="${f(R*.2)}" transform="rotate(${i*7.5})"/>`;
  return s+`<circle r="${f(R*.12)}" fill="${m}"/></g>`;}
function luoiSong(x,y,w,h,m,doc){let s='';const n=doc?h:w,k=doc?w:h;for(let j=0;j<6;j++){let d1='',d2='';for(let t=0;t<=n;t+=6){const a=Math.sin(t/14+j*1.05)*k*.38+k/2,b=Math.sin(t/14+j*1.05+Math.PI)*k*.38+k/2;
    d1+=(t?'L':'M')+(doc?`${f(x+a)},${f(y+t)}`:`${f(x+t)},${f(y+a)}`);d2+=(t?'L':'M')+(doc?`${f(x+b)},${f(y+t)}`:`${f(x+t)},${f(y+b)}`);}
    s+=`<path d="${d1}" fill="none" stroke="${m}" stroke-width=".7"/><path d="${d2}" fill="none" stroke="${m}" stroke-width=".7"/>`;}return s;}
function acanthus(m,kem){return `<path d="M0,26 C4,10 18,2 34,6 C30,10 26,12 24,14 C32,12 42,16 44,26 C38,24 32,24 28,26 C34,28 38,34 36,40 C28,36 22,32 18,30 C14,36 6,38 0,36Z" fill="${kem}" stroke="${m}" stroke-width="1.1"/><path d="M4,30 C12,22 22,16 32,10" fill="none" stroke="${m}" stroke-width=".9"/>`;}
function dai(len,tile,step){const n=Math.max(1,Math.round(len/step)),b=len/n;let s='';for(let i=0;i<n;i++)s+=`<g transform="translate(${f(i*b)},0) scale(${f(b/step)},1)">${tile}</g>`;return s;}
function khungTienGiay(m){const o=24,B=96,kem='#FBF6EA',xn='#DCE7F3';
  let s=`<rect width="${W}" height="${H}" fill="#F6F1E3"/>`;
  for(let y=0;y<H;y+=14){let d='';for(let x=0;x<=W;x+=12)d+=(x?'L':'M')+x+','+f(y+Math.sin(x/60+y/90)*5);s+=`<path d="${d}" fill="none" stroke="${m}" stroke-opacity=".05" stroke-width="1"/>`;}
  s+=`<path d="M${o},${o}h${W-2*o}v${H-2*o}h${-(W-2*o)}Z M${o+B},${o+B}v${H-2*o-2*B}h${W-2*o-2*B}v${-(H-2*o-2*B)}Z" fill="${xn}" fill-rule="evenodd"/>`;
  // dải lưới sóng đan chéo ở nửa ngoài, dải lá acanthus kem ở nửa trong
  const L1=W-2*o-2*B,L2=H-2*o-2*B,g=40;
  s+=`<g>${luoiSong(o+B,o+6,L1,g,m)}${luoiSong(o+B,H-o-6-g,L1,g,m)}${luoiSong(o+6,o+B,g,L2,m,1)}${luoiSong(W-o-6-g,o+B,g,L2,m,1)}</g>`;
  const t=acanthus(m,kem);
  s+=`<g transform="translate(${o+B},${o+B-44})">${dai(L1,t,48)}</g><g transform="translate(${W-o-B},${H-o-B+44}) rotate(180)">${dai(L1,t,48)}</g>`+
     `<g transform="translate(${o+B-44},${H-o-B}) rotate(-90)">${dai(L2,t,48)}</g><g transform="translate(${W-o-B+44},${o+B}) rotate(90)">${dai(L2,t,48)}</g>`;
  s+=`<rect x="${o}" y="${o}" width="${W-2*o}" height="${H-2*o}" fill="none" stroke="${m}" stroke-width="3"/><rect x="${o+5}" y="${o+5}" width="${W-2*o-10}" height="${H-2*o-10}" fill="none" stroke="${m}" stroke-width="1"/>`+
     `<rect x="${o+B}" y="${o+B}" width="${L1}" height="${L2}" fill="none" stroke="${m}" stroke-width="2"/><rect x="${o+B+7}" y="${o+B+7}" width="${L1-14}" height="${L2-14}" fill="none" stroke="${m}" stroke-width=".8"/>`;
  for(const [x,y] of [[o,o],[W-o-B,o],[o,H-o-B],[W-o-B,H-o-B]])s+=`<rect x="${x}" y="${y}" width="${B}" height="${B}" fill="${xn}" stroke="${m}" stroke-width="1.6"/>${hoaThi(x+B/2,y+B/2,B*.42,m)}`;
  return s;}

/* ---------------- (g) Thảm Ba Tư ---------------- */
function traiTim(m,kem){return `<rect width="64" height="64" fill="${m}"/><path d="M32,48 C14,36 10,22 20,16 C26,12 31,16 32,22 C33,16 38,12 44,16 C54,22 50,36 32,48Z" fill="${kem}"/><path d="M32,40 C24,34 22,26 26,23 C29,21 31,24 32,27 C33,24 35,21 38,23 C42,26 40,34 32,40Z" fill="${m}"/>`+
  `<path d="M2,32 C8,24 14,24 16,32 C14,40 8,40 2,32Z M62,32 C56,24 50,24 48,32 C50,40 56,40 62,32Z" fill="${kem}"/><circle cx="32" cy="7" r="2.6" fill="${kem}"/><circle cx="32" cy="57" r="2.6" fill="${kem}"/>`;}
function chuoiDa(m,kem,len){return dai(len,traiTim(m,kem),64);}
function medallion(cx,cy,rx,ry,n,fill,st){let d='';const N=n*12;for(let i=0;i<=N;i++){const t=i/N*2*Math.PI,k=1+.06*Math.cos(n*t);d+=(i?'L':'M')+f(cx+Math.cos(t)*rx*k)+','+f(cy+Math.sin(t)*ry*k);}
  return `<path d="${d}Z" fill="${fill}" stroke="${st}" stroke-width="2"/>`;}
function khungBaTu(m){const kem='#F3E9D6',o=28,B=64;let s=`<rect width="${W}" height="${H}" fill="${kem}"/>`;
  s+=`<rect x="${o}" y="${o}" width="${W-2*o}" height="${H-2*o}" fill="${m}"/>`;
  const L1=W-2*o-2*B,L2=H-2*o-2*B;
  s+=`<g transform="translate(${o+B},${o})">${chuoiDa(m,kem,L1)}</g><g transform="translate(${W-o-B},${H-o}) rotate(180)">${chuoiDa(m,kem,L1)}</g>`+
     `<g transform="translate(${o},${H-o-B}) rotate(-90)">${chuoiDa(m,kem,L2)}</g><g transform="translate(${W-o},${o+B}) rotate(90)">${chuoiDa(m,kem,L2)}</g>`;
  for(const [x,y] of [[o,o],[W-o-B,o],[o,H-o-B],[W-o-B,H-o-B]])s+=`<rect x="${x+6}" y="${y+6}" width="${B-12}" height="${B-12}" fill="none" stroke="${kem}" stroke-width="2"/><circle cx="${x+B/2}" cy="${y+B/2}" r="12" fill="${kem}"/><circle cx="${x+B/2}" cy="${y+B/2}" r="5" fill="${m}"/>`;
  s+=`<rect x="${o+B}" y="${o+B}" width="${L1}" height="${L2}" fill="${kem}"/>`;
  for(const k of [6,12,18])s+=`<rect x="${o+B+k}" y="${o+B+k}" width="${L1-2*k}" height="${L2-2*k}" fill="none" stroke="${m}" stroke-width="${k===12?1.6:.8}"/>`;
  // Medallion kem trên kem, nổi nhẹ: một đường sáng lệch lên trên-trái, một đường sẫm lệch xuống dưới-phải.
  const cx=W/2,cy=H/2,rx=W*.33,ry=H*.35;
  s+=medallion(cx+2,cy+3,rx,ry,12,'none','#D9C7A4')+medallion(cx-1.5,cy-2,rx,ry,12,'none','#FFFBF1')+medallion(cx,cy,rx,ry,12,'#EFE3CB','#DCCBA9');
  s+=medallion(cx,cy,rx*.84,ry*.84,12,'none','#E3D5B8');
  for(const sg of [-1,1]){const y=cy+sg*(ry*1.06+20);s+=`<path d="M${cx},${cy+sg*ry*1.02} V${y}" stroke="#DCCBA9" stroke-width="2"/><circle cx="${cx}" cy="${y+sg*10}" r="14" fill="#EFE3CB" stroke="#DCCBA9" stroke-width="2"/><circle cx="${cx}" cy="${y+sg*10}" r="5" fill="#E3D5B8"/>`;}
  const q=(x,y,sx,sy)=>`<g transform="translate(${x},${y}) scale(${sx},${sy})"><path d="M0,0 H120 C112,30 92,44 66,52 C40,60 18,82 0,120Z" fill="#EFE3CB" stroke="#DCCBA9" stroke-width="2"/><path d="M0,0 H70 C62,30 30,54 0,70Z" fill="none" stroke="#E3D5B8" stroke-width="1.5"/></g>`;
  const a=o+B+20;s+=q(a,a,1,1)+q(W-a,a,-1,1)+q(a,H-a,1,-1)+q(W-a,H-a,-1,-1);
  return s;}
window.VE={kho(w,h){W=w;H=h;},get W(){return W;},get H(){return H;},f,NS,
  veKhac,NEN_MAU,hinhChuNhat,hinhPanel,loTem,GIAY_MAU,LOC,giayVan,dauSap,khungCoDien,khungTienGiay,khungBaTu,medallion,hoaThi,dai,traiTim,chuoiDa,cumGiua,fleur,gocCoDien,acanthus,luoiSong,xoanC};
})();
