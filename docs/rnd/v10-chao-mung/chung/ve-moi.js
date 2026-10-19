/* Makeup Pro · R&D 10 · HÌNH VẼ MỚI (tự vẽ bằng SVG): giấy xé mép + băng dính washi, thiệp gập đôi + ruy băng, khung gương oval,
   dải vàng, cọ lá. Nạp SAU chung/ve.js. Dùng VE.W / VE.H của khổ hiện tại. */
(function(){
const V=window.VE,f=V.f;
function rng(seed){let s=seed%2147483647;if(s<=0)s+=2147483646;return()=>{s=s*16807%2147483647;return (s-1)/2147483646;};}

/* ---- Nền hoa lá khắc thêm màu (kèm 3 màu cũ của ve.js) ---- */
Object.assign(V.NEN_MAU,{'toi-lam':['#4B6AA3','#13213B'],'hong':['#9C4A63','#F7E7E3'],'ruou':['#C9A27A','#3A1620'],'xam-xanh':['#4D6A7A','#EEF1EF']});

/* ---- Vàng kim loại ---- */
V.DEF_VANG=`<defs><linearGradient id="vang1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F9E7A8"/><stop offset=".28" stop-color="#D9AC52"/><stop offset=".5" stop-color="#F3D88C"/><stop offset=".74" stop-color="#B58630"/><stop offset="1" stop-color="#8A5F22"/></linearGradient>
<linearGradient id="vang2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6DE9A"/><stop offset=".5" stop-color="#C99A3F"/><stop offset="1" stop-color="#8A5F22"/></linearGradient></defs>`;

/* ---- Giấy xé mép ---- */
// Đường khép kín quanh hình chữ nhật b, mép nào có trong chuỗi `canh` (t=trên, p=phải, d=dưới, l=trái) thì xé lởm chởm.
V.duongXe=function(b,amp,step,seed,canh='tpdl'){const r=rng(seed);const pts=[];
  const canhDi=(x0,y0,x1,y1,nx,ny,xe,ph)=>{const L=Math.hypot(x1-x0,y1-y0);let t=0;const ux=(x1-x0)/L,uy=(y1-y0)/L;
    while(t<L){const o=xe?((r()-.5)*2*amp+Math.sin(t/37+ph)*amp*.7):0;pts.push([x0+ux*t+nx*o,y0+uy*t+ny*o]);t+=xe?step*(.55+r()*.9):L;}};
  canhDi(b.x,b.y,b.x+b.w,b.y,0,-1,canh.includes('t'),1);canhDi(b.x+b.w,b.y,b.x+b.w,b.y+b.h,1,0,canh.includes('p'),2);
  canhDi(b.x+b.w,b.y+b.h,b.x,b.y+b.h,0,1,canh.includes('d'),3);canhDi(b.x,b.y+b.h,b.x,b.y,-1,0,canh.includes('l'),4);
  return 'M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';};
V.giayXe=function(b,seed,canh,rot){const sx=seed||5;
  const sợi=V.duongXe({x:b.x-9,y:b.y-9,w:b.w+18,h:b.h+18},8,11,sx,canh),tam=V.duongXe(b,4,9,sx+31,canh);
  return `<g ${rot?`transform="rotate(${rot} ${f(b.x+b.w/2)} ${f(b.y+b.h/2)})"`:''}><g filter="url(#bong)"><path d="${sợi}" fill="#FDFBF4"/></g><path d="${sợi}" fill="#EFE7D6" filter="url(#van2)"/>`+
    `<path d="${tam}" fill="${V.GIAY_MAU}"/><path d="${tam}" fill="#fff" filter="url(#van2)"/><path d="${tam}" fill="#fff" filter="url(#van)"/></g>`;};

/* ---- Băng dính washi ---- */
let wid=0;
V.washi=function(cx,cy,w,h,rot,kieu,c1,c2){const id='wp'+(++wid);let pat;
  if(kieu==='soc')pat=`<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="26" height="26" fill="${c1}"/><rect width="9" height="26" fill="${c2}"/></pattern>`;
  else if(kieu==='cham')pat=`<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="${c1}"/><circle cx="9" cy="9" r="3.4" fill="${c2}"/></pattern>`;
  else if(kieu==='hoa')pat=`<pattern id="${id}" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="${c1}"/><g fill="${c2}" transform="translate(17,17)">${[0,72,144,216,288].map(a=>`<ellipse rx="3.6" ry="7.4" cy="-6" transform="rotate(${a})"/>`).join('')}<circle r="2.6" fill="${c1}"/></g></pattern>`;
  else pat=`<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${c1}"/><path d="M0,0H20M0,0V20" stroke="${c2}" stroke-width="2"/></pattern>`;
  const z=7,n=Math.round(h/10);let d=`M${-w/2},${-h/2}`;
  d+=`L${w/2},${-h/2}`;for(let i=0;i<=n;i++)d+=`L${w/2-(i%2?0:z)},${f(-h/2+i*h/n)}`;
  d+=`L${-w/2},${h/2}`;for(let i=n;i>=0;i--)d+=`L${-w/2+(i%2?0:z)},${f(-h/2+i*h/n)}`;d+='Z';
  return `<g transform="translate(${cx},${cy}) rotate(${rot})"><defs>${pat}</defs><g filter="url(#bongnho)"><path d="${d}" fill="url(#${id})" opacity=".94"/></g>`+
    `<path d="${d}" fill="#fff" opacity=".16"/><path d="M${-w/2+10},${-h/2+3}H${w/2-10}" stroke="#fff" stroke-opacity=".45" stroke-width="2"/></g>`;};

/* ---- Ruy băng satin + nơ ---- */
V.DEF_RUY=(a,b,c)=>`<defs><linearGradient id="ruyH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset=".22" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset=".78" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient>
<linearGradient id="ruyN" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b}"/><stop offset=".55" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>`;
V.dai=function(x0,x1,y,h,vien){return `<g filter="url(#bongnho)"><rect x="${x0}" y="${y-h/2}" width="${x1-x0}" height="${h}" fill="url(#ruyH)"/></g><path d="M${x0},${y-h/2+7}H${x1}M${x0},${y+h/2-7}H${x1}" stroke="${vien}" stroke-width="1.6" stroke-dasharray="7 5" opacity=".9"/>`;};
V.no=function(cx,cy,s,vien){const loop=`<path d="M0,0 C-40,-70 -170,-95 -185,-12 C-192,58 -70,68 0,0Z" fill="url(#ruyN)"/><path d="M-10,-4 C-52,-48 -130,-60 -150,-20" fill="none" stroke="${vien}" stroke-opacity=".55" stroke-width="2.2"/><path d="M-12,6 C-60,38 -120,40 -150,10" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="3"/>`;
  const tail=`<path d="M-6,10 L-78,196 L-48,184 L-36,214 L10,28Z" fill="url(#ruyN)"/><path d="M-4,22 L-56,170" stroke="${vien}" stroke-opacity=".5" stroke-width="1.8" fill="none"/>`;
  return `<g transform="translate(${cx},${cy}) scale(${s})"><g filter="url(#bongnho)">${loop}<g transform="scale(-1,1)">${loop}</g>${tail}<g transform="scale(-1,1)">${tail}</g></g>`+
    `<rect x="-24" y="-30" width="48" height="62" rx="14" fill="url(#ruyN)"/><path d="M-14,-24 Q-4,0 -14,26M0,-27 Q10,0 0,29M12,-24 Q22,0 12,26" stroke="#000" stroke-opacity=".28" stroke-width="2" fill="none"/><rect x="-24" y="-30" width="48" height="62" rx="14" fill="none" stroke="${vien}" stroke-opacity=".7" stroke-width="1.6"/></g>`;};

/* ---- Thiệp gập đôi: tờ giấy có nếp gập ngang + viền nổi ---- */
V.thiepGap=function(b,yGap,vien){const d=V.hinhChuNhat(b);
  return `<defs><linearGradient id="nep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B4630" stop-opacity="0"/><stop offset=".42" stop-color="#5B4630" stop-opacity=".16"/><stop offset=".5" stop-color="#3a2a18" stop-opacity=".34"/><stop offset=".53" stop-color="#fff" stop-opacity=".5"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`+
   V.giayVan(d)+`<rect x="${b.x}" y="${yGap-34}" width="${b.w}" height="68" fill="url(#nep)"/>`+
   `<rect x="${b.x+20}" y="${b.y+20}" width="${b.w-40}" height="${b.h-40}" fill="none" stroke="${vien}" stroke-width="1.4"/><rect x="${b.x+28}" y="${b.y+28}" width="${b.w-56}" height="${b.h-56}" fill="none" stroke="${vien}" stroke-width=".7"/>`;};

/* ---- Khung gương oval cổ điển ---- */
function elip(cx,cy,rx,ry){return `M${cx-rx},${cy}a${rx},${ry} 0 1,0 ${2*rx},0a${rx},${ry} 0 1,0 ${-2*rx},0Z`;}
V.palmette=function(n,R,xoay){let s=`<g transform="rotate(${xoay||0})">`;
  for(let i=0;i<n;i++){const a=(i-(n-1)/2)*(150/(n-1)),L=R*(1-Math.abs(i-(n-1)/2)/n*.45);
    s+=`<path d="M0,0 C${f(-L*.22)},${f(-L*.35)} ${f(-L*.2)},${f(-L*.85)} 0,${f(-L)} C${f(L*.2)},${f(-L*.85)} ${f(L*.22)},${f(-L*.35)} 0,0Z" transform="rotate(${f(a)})" fill="url(#vang1)" stroke="#6B4618" stroke-width="1.6"/><path d="M0,${f(-L*.18)}V${f(-L*.8)}" transform="rotate(${f(a)})" stroke="#6B4618" stroke-width="1.3" opacity=".7"/>`;}
  return s+`<circle r="${f(R*.18)}" fill="url(#vang1)" stroke="#6B4618" stroke-width="1.6"/></g>`;};
V.cuon=function(tay,s){return `<g transform="scale(${tay},1) scale(${s})"><path d="M0,0 C30,-4 56,-22 54,-52 C52,-80 18,-84 10,-62 C4,-44 22,-34 34,-44" fill="none" stroke="url(#vang2)" stroke-width="11" stroke-linecap="round"/><path d="M0,0 C30,-4 56,-22 54,-52 C52,-80 18,-84 10,-62 C4,-44 22,-34 34,-44" fill="none" stroke="#6B4618" stroke-width="1.6" stroke-linecap="round" opacity=".6"/><circle cx="34" cy="-44" r="7" fill="url(#vang1)" stroke="#6B4618" stroke-width="1.4"/></g>`;};
// Gương: tâm (cx,cy), nửa trục ngoài rx, ry; trả về {svg, kinh:{rx,ry}} (kính trong = rx-56, ry-56)
V.guong=function(cx,cy,rx,ry,kinh){const B=54,ri=rx-B,rj=ry-B;
  let s=V.DEF_VANG+`<defs><clipPath id="kinhC"><path d="${elip(cx,cy,ri,rj)}"/></clipPath><filter id="mo"><feGaussianBlur stdDeviation="7"/></filter></defs>`;
  s+=`<g filter="url(#bong)"><path d="${elip(cx,cy,rx,ry)}" fill="#8A5F22"/></g>`;
  s+=`<path d="${elip(cx,cy,rx,ry)}${elip(cx,cy,ri,rj)}" fill="url(#vang1)" fill-rule="evenodd" stroke="#6B4618" stroke-width="2.4"/>`;
  s+=`<path d="${elip(cx,cy,rx-8,ry-8)}" fill="none" stroke="#6B4618" stroke-width="1.6" opacity=".8"/><path d="${elip(cx,cy,ri+7,rj+7)}" fill="none" stroke="#6B4618" stroke-width="1.6" opacity=".8"/>`;
  s+=`<path d="${elip(cx+1.2,cy+1.6,rx-28,ry-28)}" fill="none" stroke="#5E3F12" stroke-width="12" stroke-dasharray="0.1 15.5" stroke-linecap="round" opacity=".75"/><path d="${elip(cx,cy,rx-28,ry-28)}" fill="none" stroke="#FFF1BD" stroke-width="10" stroke-dasharray="0.1 15.5" stroke-linecap="round"/>`;
  s+=`<path d="${elip(cx,cy,ri,rj)}" fill="${kinh}"/>`;
  s+=`<g clip-path="url(#kinhC)"><path d="${elip(cx,cy,ri+4,rj+4)}" fill="none" stroke="#3a2a10" stroke-opacity=".34" stroke-width="22" filter="url(#mo)"/>`+
     `<path d="M${cx-ri*.9},${cy+rj*.5}L${cx-ri*.1},${cy-rj*1.1}L${cx+ri*.02},${cy-rj*1.1}L${cx-ri*.78},${cy+rj*.62}Z" fill="#fff" opacity=".22"/><path d="M${cx-ri*.55},${cy+rj*.8}L${cx+ri*.22},${cy-rj*1.1}L${cx+ri*.3},${cy-rj*1.1}L${cx-ri*.46},${cy+rj*.86}Z" fill="#fff" opacity=".14"/></g>`;
  const ty=cy-ry;
  s+=`<g transform="translate(${cx},${ty+10})">${V.palmette(9,92,0)}</g>`+`<g transform="translate(${cx-92},${ty+16})">${V.cuon(-1,.8)}</g><g transform="translate(${cx+92},${ty+16})">${V.cuon(1,.8)}</g>`;
  for(const sg of [-1,1]){const x=cx+sg*rx;s+=`<g transform="translate(${x},${cy})"><circle r="26" fill="url(#vang1)" stroke="#6B4618" stroke-width="2"/>${[0,45,90,135].map(a=>`<ellipse rx="3.4" ry="19" transform="rotate(${a})" fill="none" stroke="#6B4618" stroke-width="1.4"/>`).join('')}<circle r="8" fill="#F9E7A8" stroke="#6B4618" stroke-width="1.6"/></g>`;}
  return s;};
})();
