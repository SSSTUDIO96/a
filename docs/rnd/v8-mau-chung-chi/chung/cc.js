/* Điền dữ liệu + vẽ chữ SVG + vẽ huy hiệu cho 15 mẫu giấy chứng nhận (R&D 08, bản 2).
   Mỗi ô mang data-f="<khoá>"; khoá ↔ trường dữ liệu ghi ở docs/rnd/BAO-CAO-RND-08-CHUNG-CHI.md. Cùng kiểu tham số với public/mau/chung/mau.js.

   Tham số đường dẫn (bỏ trống thì lấy chữ mẫu của R&D):
     th=Tên trung tâm · logo=<url> (logo=0: không logo) · ten=Tên học viên · anh=<url> (anh=0: chưa có ảnh → chữ cái đầu; anh=an: ẩn hẳn ô ảnh)
     khoa=Tên khoá · lop=K12 · ngay=20/12/2026 (ngày cấp) · so=CC-2026-0007 · gv=Tên giảng viên · gd=Tên giám đốc
     td=Tiêu đề (đè tiêu đề mặc định) · ky=1..4 (phông chữ ký của tên) · ph=1..5 (phông tiêu đề: 1 Prata, 2 Abril Fatface, 3 Noto Serif Display, 4 Cormorant đậm, 5 Playfair cũ)
     kieu=bong|noi|dap|hong|dam (đè kiểu chữ vàng của tiêu đề) · vien=bac (mẫu 05: viền bạc)
     nhieu=1 → in 5 học viên mẫu (5 trang). Khổ: A4 ngang. Mỗi <section class="cc"> là một trang khi in. */
(function () {
  const P = new URLSearchParams(location.search);
  const ROOT = document.currentScript.src.replace(/cc\.js.*$/, '');
  const MAC = {
    th: 'Chiến Makeup Academy', logo: ROOT + 'logo-mau.svg', ten: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo',
    anh: ROOT + 'anh-hoc-vien.svg', khoa: 'Makeup chuyên nghiệp', lop: 'K12', ngay: '20/12/2026',
    so: 'CC-2026-0007', gv: 'Nguyễn Thu Hà', gd: 'Nguyễn Trọng Chiến',
  };
  const NHIEU = [
    { ten: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', anh: ROOT + 'anh-hoc-vien.svg', so: 'CC-2026-0007' },
    { ten: 'Đặng Quỳnh Như', anh: ROOT + 'anh-hv-2.svg', so: 'CC-2026-0008' },
    { ten: 'Nguyễn Ngọc Ánh Dương', anh: ROOT + 'anh-hv-3.svg', so: 'CC-2026-0009' },
    { ten: 'Phạm Quỳnh Hương', anh: '', so: 'CC-2026-0010' },
    { ten: 'Lê Thị Mai', anh: ROOT + 'anh-hv-5.svg', so: 'CC-2026-0011' },
  ];
  const g = (k) => (P.has(k) ? P.get(k) : MAC[k]);
  const chung = {};
  for (const k of Object.keys(MAC)) chung[k] = g(k);
  if (chung.logo === '0') chung.logo = '';
  const anhAn = chung.anh === 'an';
  if (chung.anh === '0' || anhAn) chung.anh = '';
  const lopTxt = chung.lop ? (/^lớp\b/i.test(chung.lop) ? chung.lop : 'Lớp ' + chung.lop) : '';
  chung.dong = 'Đã hoàn thành khoá ' + [chung.khoa, lopTxt].filter(Boolean).join(' · ');
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(chung.ngay || '');
  chung.ngayChu = m ? `Ngày ${+m[1]} tháng ${+m[2]} năm ${m[3]}` : '';
  chung.nam = m ? m[3] : '';
  chung.ngaySo = chung.ngay;

  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  const E = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  // ===== Huy hiệu tự vẽ (SVG) — không dùng ảnh tham khảo =====
  const KIM = {
    vang: [['0', '#8A6420'], ['.22', '#E9CF86'], ['.45', '#B88A35'], ['.7', '#F3DE9C'], ['1', '#9C7428']],
    bac: [['0', '#6E7B89'], ['.22', '#E6EBF0'], ['.45', '#9AA6B3'], ['.7', '#F4F6F8'], ['1', '#7D8996']],
    hong: [['0', '#9A5B45'], ['.22', '#F2CDB8'], ['.45', '#C98E73'], ['.7', '#F7DCCB'], ['1', '#A8674F']],
  };
  const grad = (id, stops, x1 = '0', y1 = '0', x2 = '1', y2 = '1') =>
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  function nguyetQue(cx, cy, r, mau, a0, a1, so = 8, co = 1) {
    let s = '';
    for (let i = 0; i < so; i++) {
      const t = i / (so - 1), a = a0 + (a1 - a0) * t, rad = (a * Math.PI) / 180;
      const tiep = a + (a1 > a0 ? 90 : -90);
      const L = (9 - t * 3) * co, W = (3.8 - t * 1.2) * co;
      for (const [dr, lech] of [[-5 * co, -40], [5 * co, 40]]) {
        const x = cx + (r + dr) * Math.cos(rad), y = cy + (r + dr) * Math.sin(rad);
        const rot = tiep + 90 + (a1 > a0 ? lech : -lech);
        s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${W.toFixed(1)}" ry="${L.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${mau}"/>`;
      }
    }
    const p0 = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(1)).join(' ');
    s += `<path d="M${p0(a0)} A${r} ${r} 0 0 ${a1 > a0 ? 1 : 0} ${p0(a1)}" fill="none" stroke="${mau}" stroke-width="${1.2 * co}"/>`;
    return s;
  }
  const sao = (cx, cy, r) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  };
  function vienRang(cx, cy, r1, r2, n) {
    let d = '';
    for (let i = 0; i <= n * 2; i++) {
      const a = (i * Math.PI) / n, r = i % 2 ? r2 : r1;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2);
    }
    return d + 'Z';
  }
  // kieu: 'rang' (viền răng cưa) · 'tron' (vòng tròn hai viền) · 'hoa' (viền hoa 16 cánh)
  // nen: màu lòng huy hiệu · chu: màu chữ · duoi=1: thêm hai đuôi ruy băng · ruy: màu ruy băng, hoặc "vang" = ruy băng vàng kim
  // dong1, dong2: chữ ở giữa (mặc định HOÀN THÀNH / năm cấp) · vong: chữ chạy vòng trên
  function huyHieu(el) {
    const d = el.dataset, id = 'hh' + ++uid;
    const CHU_KIM = { vang: '#E6CB80', bac: '#E6EBF0', hong: '#F2CDB8' };
    const kim = d.kim || 'vang';
    const nen = d.nen || '#1C2433', chu = d.chu || CHU_KIM[kim], kieu = d.kieu || 'rang';
    const duoi = d.duoi === '1';
    const dong1 = d.dong1 || 'HOÀN THÀNH', dong2 = d.dong2 || chung.nam || '';
    const ruy = d.ruy || '#8E1D24';
    const lq = d.chu || `url(#${id}g)`;
    let vien = '';
    if (kieu === 'rang') vien = `<path d="${vienRang(100, 100, 94, 85, 40)}" fill="url(#${id}g)"/>`;
    else if (kieu === 'hoa') {
      for (let i = 0; i < 16; i++) vien += `<circle cx="${(100 + 83 * Math.cos((i * Math.PI) / 8)).toFixed(1)}" cy="${(100 + 83 * Math.sin((i * Math.PI) / 8)).toFixed(1)}" r="13" fill="url(#${id}g)"/>`;
      vien += `<circle cx="100" cy="100" r="85" fill="url(#${id}g)"/>`;
    } else vien = `<circle cx="100" cy="100" r="93" fill="url(#${id}g)"/><circle cx="100" cy="100" r="88" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1"/>`;
    const tl = 'M62 150 L40 232 L60 220 L74 240 L92 160Z', tp = 'M138 150 L160 232 L140 220 L126 240 L108 160Z';
    const tails = duoi
      ? (ruy === 'vang'
        ? `<g><path d="${tl}" fill="url(#${id}g)"/><path d="${tp}" fill="url(#${id}h)"/><path d="${tl}" fill="none" stroke="#000" stroke-opacity=".25"/><path d="${tp}" fill="none" stroke="#000" stroke-opacity=".25"/></g>`
        : `<g><path d="${tl}" fill="${ruy}"/><path d="${tp}" fill="${ruy}"/><path d="${tl}" fill="url(#${id}g)" opacity=".16"/><path d="${tp}" fill="url(#${id}g)" opacity=".16"/></g>`)
      : '';
    el.innerHTML = `<svg viewBox="0 0 200 ${duoi ? 245 : 200}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${grad(id + 'g', KIM[kim])}${grad(id + 'h', KIM[kim], '1', '1', '0', '0')}
        <path id="${id}a" d="M100 100 m-54 0 a54 54 0 1 1 108 0"/></defs>
      <circle cx="104" cy="105" r="93" fill="#000" opacity=".2"/>
      ${tails}${vien}
      <circle cx="100" cy="100" r="78" fill="url(#${id}h)"/>
      <circle cx="100" cy="100" r="74" fill="${nen}"/>
      <circle cx="100" cy="100" r="69.5" fill="none" stroke="url(#${id}g)" stroke-width="1.5"/>
      <ellipse cx="100" cy="56" rx="46" ry="20" fill="#fff" opacity=".035"/>
      <g>${nguyetQue(100, 100, 49, lq, 166, 102, 7, 0.78)}${nguyetQue(100, 100, 49, lq, 14, 78, 7, 0.78)}</g>
      <text font-family="MP Chữ không chân" font-weight="700" font-size="9.4" letter-spacing="2" fill="${chu}"><textPath href="#${id}a" startOffset="50%" text-anchor="middle">${d.vong || '★ GIẤY CHỨNG NHẬN ★'}</textPath></text>
      <text x="100" y="95" text-anchor="middle" font-family="MP Chữ không chân" font-weight="700" font-size="11" letter-spacing="1.1" fill="${chu}">${dong1}</text>
      <text x="100" y="124" text-anchor="middle" font-family="MP Chữ đậm có chân" font-weight="700" font-size="28" fill="${chu}">${dong2}</text>
      <g fill="${chu}"><path d="${sao(88, 144, 4.2)}"/><path d="${sao(100, 146, 4.8)}"/><path d="${sao(112, 144, 4.2)}"/></g>
    </svg>`;
  }

  // ===== Chữ SVG: tiêu đề và tên — chữ phẳng hoặc vàng kim (bong/noi/dap/hong/dam) =====
  // Vẽ bằng <text> + linearGradient + lớp bóng/viền/khối. Không dùng background-clip:text (html-to-image và vài trình đọc PDF vẽ sai).
  const VANG = {
    bong: { face: [[0, '#FFF3C0'], [.3, '#EBC65A'], [.48, '#A87B2A'], [.56, '#D4A640'], [.82, '#F6DE94'], [1, '#B88A35']], rim: '#6B4812', rimK: 0.014, sh: 0.4, depth: 0.012, ext: ['#9C7428', '#5A3C0C'] },
    noi: { face: [[0, '#FFF3C0'], [.3, '#EBC65A'], [.48, '#B08430'], [.56, '#D9AB43'], [.82, '#F6DE94'], [1, '#C79A3C']], rim: '#6B4812', rimK: 0.012, sh: 0.5, depth: 0.065, ext: ['#B8892E', '#5A3A0A'] },
    dap: { face: [[0, '#F6E0A0'], [.5, '#CDA64F'], [1, '#EBD18A']], rim: null, hi: ['#FFF1BC', 0.6], dsh: ['#000', 0.85] },
    hong: { face: [[0, '#FFE8DA'], [.3, '#EDBBA3'], [.48, '#B97A62'], [.56, '#D9A38B'], [.82, '#F8D7C5'], [1, '#C48A70']], rim: '#7A4636', rimK: 0.012, sh: 0.4, depth: 0.05, ext: ['#C98E73', '#7A4636'] },
    dam: { face: [[0, '#8A6420'], [.35, '#B5882F'], [.55, '#7A5418'], [.8, '#A57A2A'], [1, '#6E4A12']], rim: '#34230A', rimK: 0.02, sh: 0.22, depth: 0.04, ext: ['#5A3C0C', '#34230A'] },
  };
  const VANG_DUONG = [[0, '#8A6420'], [.22, '#E9CF86'], [.45, '#B88A35'], [.7, '#F3DE9C'], [1, '#9C7428']];
  const cv = document.createElement('canvas').getContext('2d');
  function mauTrung(a, b, t) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function do100(text, fam, wt, st, ls, tf) {
    if (tf === 'uppercase') text = text.toUpperCase();
    cv.font = `${st} ${wt} 100px ${fam}`;
    cv.letterSpacing = ls * 100 + 'px';
    const m = cv.measureText(text);
    return { t: text, l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent };
  }
  // Tính cỡ chữ vừa khung cho một bộ dòng
  function boCuc(lines, o, W, H) {
    const ms = lines.map((t) => do100(t, o.fam, o.wt, o.st, o.ls, o.tf));
    const asc = Math.max(...ms.map((m) => m.a)), desc = Math.max(...ms.map((m) => m.d));
    const inkW = Math.max(...ms.map((m) => m.l + m.r));
    const n = lines.length, lh = o.lh || 1.12;
    const hasLine = !!o.line, lineH = hasLine ? o.line.h || 2 : 0;
    const v = VANG[o.gold];
    const dK = v && v.depth ? v.depth : 0;
    const gH100 = asc + (n - 1) * lh * 100 + (hasLine ? 24 : desc);
    const pad = 3;
    let S = o.max;
    S = Math.min(S, ((W - 2 * pad) / (inkW + dK * 100)) * 100);
    S = Math.min(S, ((H - 2 * pad - lineH) / (gH100 + dK * 100)) * 100);
    return { ms, asc, desc, S, n, lh, hasLine, lineH, dK, gH100 };
  }
  function veChu(box, lines, o) {
    const W = box.clientWidth, H = box.clientHeight;
    const b = boCuc(lines, o, W, H);
    const S = b.S, v = VANG[o.gold], d = b.dK * S;
    const svg = E('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', class: 'chu-svg' });
    const id = 'cv' + ++uid;
    const defs = E('defs', {}, svg);
    const stopsFace = v ? v.face : null;
    if (v) {
      const lg = E('linearGradient', { id: id + 'f', x1: 0, y1: 0, x2: 0.18, y2: 1 }, defs);
      for (const [off, c] of v.face) E('stop', { offset: off, 'stop-color': c }, lg);
    }
    // vị trí
    const gH = (b.asc + (b.n - 1) * b.lh * 100 + (b.hasLine ? 24 : b.desc)) * S / 100 + b.lineH;
    const top = (H - gH - d) / 2;
    const base1 = top + (b.asc * S) / 100;
    const nhom = E('g', {}, svg);
    const xs = b.ms.map((m) => {
      const w = ((m.l + m.r) * S) / 100;
      const x0 = o.al === 'left' ? 3 : o.al === 'right' ? W - 3 - w - d : (W - w - d) / 2;
      return x0 + (m.l * S) / 100;
    });
    const T = (i, dx, dy, attrs) => {
      const t = E('text', Object.assign({ x: xs[i] + dx, y: base1 + i * b.lh * S + dy, 'font-size': S.toFixed(2), 'font-family': o.fam, 'font-weight': o.wt, 'font-style': o.st, 'letter-spacing': (o.ls * S).toFixed(2), 'stroke-linejoin': 'round' }, attrs), nhom);
      t.textContent = b.ms[i].t;
      return t;
    };
    for (let i = 0; i < lines.length; i++) {
      if (!v) { T(i, 0, 0, { fill: o.color, class: 'face' }); continue; }
      if (v.ext) {
        const n = Math.max(2, Math.round(d / 0.8));
        // bóng đổ mềm phía xa
        if (v.sh) for (let k = 3; k >= 1; k--) T(i, d * 0.9 + k * d * 0.35, d * 1.1 + k * d * 0.45, { fill: '#000', stroke: '#000', 'stroke-width': k * 0.8, opacity: (v.sh * 0.22).toFixed(3), class: 'ex' });
        for (let k = n; k >= 1; k--) {
          const c = mauTrung(v.ext[0], v.ext[1], k / n);
          T(i, (k / n) * d * 0.62, (k / n) * d * 0.92, { fill: c, stroke: c, 'stroke-width': 0.9, class: 'ex' });
        }
      } else if (v.sh) {
        T(i, S * 0.012 + 0.6, S * 0.02 + 0.8, { fill: '#000', opacity: v.sh, class: 'ex' });
      }
      if (v.dsh) {
        const k = Math.max(1, S * 0.022);
        T(i, k, k * 1.15, { fill: v.dsh[0], opacity: v.dsh[1], class: 'ex' });
        T(i, -k * 0.8, -k * 0.8, { fill: v.hi[0], opacity: v.hi[1], class: 'ex' });
      }
      const at = { fill: `url(#${id}f)`, class: 'face' };
      if (v.rim) { at.stroke = v.rim; at['stroke-width'] = Math.max(0.7, S * v.rimK); at['paint-order'] = 'stroke'; }
      T(i, 0, 0, at);
    }
    // gạch dưới tên
    if (b.hasLine) {
      const ly = base1 + (b.n - 1) * b.lh * S + 0.24 * S;
      const ins = o.line.inset || 0;
      const lgl = E('linearGradient', { id: id + 'l', gradientUnits: 'userSpaceOnUse', x1: ins, y1: 0, x2: W - ins, y2: 0 }, defs);
      const st = o.line.stops || VANG_DUONG;
      for (const [off, c] of st) E('stop', { offset: off, 'stop-color': c }, lgl);
      E('rect', { x: ins, y: ly, width: W - 2 * ins, height: o.line.h || 2, fill: `url(#${id}l)`, class: 'gach-ten' }, svg);
    }
    box.textContent = '';
    box.appendChild(svg);
    box.dataset.cs = JSON.stringify(v ? v.face.map((s) => s[1]) : [o.color]);
    box.dataset.cspx = S.toFixed(1);
    return S;
  }
  function chiaHai(text, o, W, H) {
    const w = text.split(' ');
    let best = null;
    for (let i = 1; i < w.length; i++) {
      const L = [w.slice(0, i).join(' '), w.slice(i).join(' ')];
      const ms = L.map((t) => do100(t, o.fam, o.wt, o.st, o.ls, o.tf));
      const mx = Math.max(...ms.map((m) => m.l + m.r));
      if (!best || mx < best.mx) best = { L, mx };
    }
    return best ? best.L : [text];
  }
  function veO(box) {
    const cs = getComputedStyle(box);
    const goc = box.dataset.goc != null ? box.dataset.goc : (box.dataset.goc = box.textContent.trim().replace(/\s+/g, ' '));
    const ten = box.classList.contains('ten');
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize);
    const gold = (P.get('kieu') && !ten && VANG[P.get('kieu')]) ? P.get('kieu') : box.dataset.gold;
    const o = {
      fam: cs.fontFamily, wt: cs.fontWeight, st: cs.fontStyle, ls, tf: cs.textTransform, color: cs.color,
      al: box.dataset.al || 'left', gold: VANG[gold] ? gold : null,
      max: ten ? parseFloat(cs.fontSize) : parseFloat(box.dataset.max) || 400, lh: ten ? 1.04 : 1.1,
    };
    if (box.dataset.line) {
      const ins = parseFloat(box.dataset.lineInset) || 0;
      o.line = { h: parseFloat(box.dataset.lineH) || 2, inset: ins };
      if (box.dataset.lineColor) o.line.stops = [[0, box.dataset.lineColor], [1, box.dataset.lineColor]];
    }
    const W = box.clientWidth, H = box.clientHeight;
    let lines = [goc];
    if (ten) {
      const minS = 54; // dưới 54 px (≈ 40 pt khi in) mới chuyển sang 2 dòng cân
      const b1 = boCuc([goc], o, W, H);
      if (b1.S < minS && goc.includes(' ')) {
        const L2 = chiaHai(goc, o, W, H);
        const b2 = boCuc(L2, o, W, H);
        if (b2.S > b1.S) lines = L2;
      }
    }
    veChu(box, lines, o);
  }

  // ===== Điền dữ liệu =====
  const TRONG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const chuDau = (t) => {
    const w = (t || '').trim().split(/\s+/);
    return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
  };
  function dien(root, D) {
    if (P.get('td')) root.querySelectorAll('[data-td]').forEach((el) => (el.textContent = P.get('td')));
    root.querySelectorAll('[data-f]').forEach((el) => {
      const k = el.dataset.f, v = D[k];
      if (el.tagName === 'IMG') {
        if (v) el.src = v;
        else {
          el.src = TRONG;
          if (k === 'logo') {
            el.style.display = 'none';
            const w = el.closest('.o-logo');
            if (w) w.style.display = 'none';
            root.classList.add('khong-logo');
          }
          if (k === 'anh') {
            const w = el.closest('.anh');
            if (w) { w.classList.add('chua-anh'); w.dataset.chu = chuDau(D.ten); }
          }
        }
      } else el.textContent = v == null ? '' : v;
    });
    if (anhAn) root.classList.add('khong-anh');
    if (P.get('vien') === 'bac') root.classList.add('vien-bac');
    root.querySelectorAll('[data-huy-hieu]').forEach(huyHieu);
  }
  if (P.get('xuat') === '1') { document.body.classList.remove('xem'); document.body.classList.add('xuat'); }
  const PH = { 1: ["'MP Tiêu đề 1',serif", 400, '.07em'], 2: ["'MP Tiêu đề 2',serif", 400, '.05em'], 3: ["'MP Tiêu đề 3',serif", 800, '.05em'], 4: ["'MP Chữ có chân',serif", 700, '.08em'], 5: ["'MP Chữ đậm có chân',serif", 800, '.05em'] };
  if (PH[P.get('ph')]) {
    const [f, w, l] = PH[P.get('ph')];
    document.documentElement.style.setProperty('--f-tt', f);
    document.documentElement.style.setProperty('--w-tt', w);
    document.documentElement.style.setProperty('--ls-tt', l);
  }
  const mau = document.querySelector('.cc');
  const ds = P.get('nhieu') === '1' ? NHIEU : null;
  if (ds) {
    ds.forEach((hv, i) => {
      const el = i === 0 ? mau : mau.cloneNode(true);
      if (i) mau.parentNode.appendChild(el);
      dien(el, Object.assign({}, chung, hv));
    });
  } else dien(mau, chung);
  if (/^[1-4]$/.test(P.get('ky') || '')) {
    const n = P.get('ky');
    document.querySelectorAll('.cc').forEach((el) => {
      el.style.setProperty('--f-ten', `var(--f-ky-${n})`);
      el.style.setProperty('--ten-co', `var(--ky-co-${n})`);
    });
  }

  function fit() {
    document.querySelectorAll('.sv').forEach(veO);
    document.body.dataset.ready = '1';
  }
  const imgs = [...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
  const FONTS = ['MP Chữ ký 1', 'MP Chữ ký 2', 'MP Chữ ký 3', 'MP Chữ ký 4', 'MP Chữ có chân', 'MP Chữ đậm có chân', 'MP Chữ không chân', 'MP Tiêu đề 1', 'MP Tiêu đề 2', 'MP Tiêu đề 3', 'MP Tiêu đề viết tay', 'MP Tiêu đề viết tay 2']
    .map((f) => document.fonts.load(`700 40px "${f}"`, 'Ấỳ').catch(() => 0));
  Promise.all([...FONTS, document.fonts.ready, ...imgs]).then(() => requestAnimationFrame(fit));
})();
