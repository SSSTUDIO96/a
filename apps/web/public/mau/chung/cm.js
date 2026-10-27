/* Makeup Pro · phần chung của 10 mẫu chào mừng cm-01..10 (R&D-10, vào app theo bản vẽ H). Nạp SAU chung/mau.js.
   - Ô MÃ SỐ: phần tử số mang data-f="ma" — mau.js điền (?ma=07; ?that=1 không có ?ma thì ẩn hẳn khối .seat).
   - chữ vàng gradient: phần tử class "vang" + data-vang="màu1,màu2,…" được thay bằng <svg><text fill="url(#gradient)"> (không dùng
     background-clip:text vì html-to-image vẽ sai).
   - window.CM_SAU: việc mẫu cần làm sau khi mau.js co chữ xong và chữ vàng đã dựng (ví dụ đặt hoa văn theo vị trí ảnh).
   - window.MAU_SAN_SANG nối tiếp lời hứa của mau.js: bộ xuất ảnh (chung/xuat.js) chờ cả chữ vàng + hình vẽ theo vị trí.
   - window.CM_DO(): danh sách mọi dòng chữ cần đo tương phản (bộ đo R&D dùng). */
(function(){
const NS='http://www.w3.org/2000/svg';
const cv=document.createElement('canvas').getContext('2d');
let uid=0;
function chuVang(el){
  const cs=getComputedStyle(el);const stops=(el.dataset.vang||'#8A5A14,#B88A2E,#8A5A14').split(',');
  const raw=el.dataset.goc||el.textContent.trim();el.dataset.goc=raw;
  const txt=cs.textTransform==='uppercase'?raw.toLocaleUpperCase('vi'):raw;
  const ff=cs.fontFamily.replace(/"/g,"'");const fs=parseFloat(cs.fontSize),ls=parseFloat(cs.letterSpacing)||0,lh=parseFloat(cs.lineHeight)||fs*1.2;
  const W=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  cv.font=`${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;cv.letterSpacing=ls+'px';
  const words=txt.split(/\s+/);const lines=[];let cur='';
  for(const w of words){const t=cur?cur+' '+w:w;if(cur&&cv.measureText(t).width>W){lines.push(cur);cur=w;}else cur=t;}
  lines.push(cur);
  const al=cs.textAlign==='left'||cs.textAlign==='start'?'start':cs.textAlign==='right'||cs.textAlign==='end'?'end':'middle';
  const id='gv'+(++uid);
  const maxW=Math.max(...lines.map(l=>cv.measureText(l).width));
  const gw=Math.min(W,maxW)||W;
  let s=`<svg xmlns="${NS}" width="${W}" height="${f1(lines.length*lh)}" viewBox="0 0 ${W} ${f1(lines.length*lh)}"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${al==='middle'?(W-gw)/2:al==='start'?0:W-gw}" y1="0" x2="${al==='middle'?(W+gw)/2:al==='start'?gw:W}" y2="${f1(lines.length*lh*.8)}">`+
    stops.map((c,i)=>`<stop offset="${f1(i/(stops.length-1)*100)}%" stop-color="${c}"/>`).join('')+`</linearGradient></defs>`;
  lines.forEach((l,i)=>{const x=al==='middle'?W/2+ls/2:al==='start'?0:W;
    s+=`<text x="${f1(x)}" y="${f1(i*lh+lh/2)}" dominant-baseline="central" text-anchor="${al}" fill="url(#${id})" style="font:${cs.fontStyle} ${cs.fontWeight} ${fs}px ${ff};letter-spacing:${ls}px">${l.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`;});
  el.innerHTML=s+'</svg>';el.setAttribute('aria-label',raw);el.style.color='transparent';
}
const f1=(n)=>Math.round(n*10)/10;
window.CM_DO=function(){
  const c=document.getElementById('c');const cr=c.getBoundingClientRect();const out=[];
  document.querySelectorAll('#c [data-do]').forEach(el=>{
    if(!el.getClientRects().length||el.offsetParent===null&&getComputedStyle(el).position!=='fixed')return;
    const vang=el.classList.contains('vang');let rects;
    if(vang)rects=[...el.querySelectorAll('svg text')].map(t=>t.getBoundingClientRect());
    else{const r=document.createRange();r.selectNodeContents(el);rects=[...r.getClientRects()];}
    const cs=getComputedStyle(el);const fs=parseFloat(cs.fontSize);
    // hộp dòng chữ của phông có chân cao hơn thân chữ → thu về khung 1,05 em quanh tâm dòng (vẫn gồm cả nét lên và nét xuống)
    rects=rects.filter(q=>q.width>2&&q.height>2).map(q=>{const hh=vang?q.height:Math.min(q.height,fs*1.05);return {x:q.left-cr.left,y:q.top+(q.height-hh)/2-cr.top,w:q.width,h:hh};});
    out.push({lop:el.className.split(' ')[0],chu:(el.dataset.goc||el.textContent).trim().slice(0,48),mau:vang?el.dataset.vang:cs.color,vang:vang,co:fs,dam:parseInt(cs.fontWeight),hop:rects});});
  return out;};
window.VE_MOUNT=function(inner,tren){const c=document.getElementById('c');const s=document.createElementNS(NS,'svg');const W=c.offsetWidth,H=c.offsetHeight;
  s.setAttribute('width',W);s.setAttribute('height',H);s.setAttribute('viewBox',`0 0 ${W} ${H}`);s.style.cssText='position:absolute;left:0;top:0;pointer-events:none';s.innerHTML=inner;c.insertBefore(s,tren?c.querySelector('.w'):c.firstChild);return s;};
const goc=window.MAU_SAN_SANG||Promise.resolve();
window.CM_SAU=[];
window.MAU_SAN_SANG=goc.then(()=>{document.querySelectorAll('.vang').forEach(chuVang);window.CM_SAU.forEach(fn=>fn());document.body.dataset.cmXong='1';});
})();
