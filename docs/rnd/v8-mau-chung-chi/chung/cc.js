/* Điền dữ liệu cho 10 mẫu chứng nhận tốt nghiệp (R&D 08). Mỗi ô mang data-f="<khoá>"; khoá ↔ trường dữ liệu ghi ở
   docs/rnd/BAO-CAO-RND-08-CHUNG-CHI.md mục 4. Cùng kiểu với public/mau/chung/mau.js của bộ thẻ chào mừng.

   Tham số đường dẫn (bỏ trống thì lấy chữ mẫu của R&D):
     th=Tên trung tâm · logo=<url> (logo=0: không logo) · ten=Tên học viên · anh=<url> (anh=0: chưa có ảnh → chữ cái đầu)
     khoa=Tên khoá · lop=K12 · ngay=20/12/2026 (ngày cấp) · so=CC-2026-0007 · gv=Tên giảng viên · gd=Tên giám đốc
     td=Tiêu đề (đè tiêu đề mặc định của mẫu) · ky=1..4 (đổi phông chữ ký của tên)
     nhieu=1 → in 5 học viên mẫu (5 trang), dùng để thử in nhiều trang.
   Khổ: A4 ngang 297×210 mm. Mỗi <section class="cc"> là một trang khi in. */
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
    { ten: 'Lê Thị Mai', anh: ROOT + 'anh-hv-2.svg', so: 'CC-2026-0008' },
    { ten: 'Nguyễn Ngọc Ánh Dương', anh: ROOT + 'anh-hv-3.svg', so: 'CC-2026-0009' },
    { ten: 'Phạm Quỳnh Hương', anh: '', so: 'CC-2026-0010' },
    { ten: 'Đặng Thuỳ Trâm', anh: ROOT + 'anh-hv-5.svg', so: 'CC-2026-0011' },
  ];
  const g = (k) => (P.has(k) ? P.get(k) : MAC[k]);
  const chung = {};
  for (const k of Object.keys(MAC)) chung[k] = g(k);
  if (chung.logo === '0') chung.logo = '';
  if (chung.anh === '0') chung.anh = '';
  const lopTxt = chung.lop ? (/^lớp\b/i.test(chung.lop) ? chung.lop : 'Lớp ' + chung.lop) : '';
  chung.dong = 'Đã hoàn thành khoá ' + [chung.khoa, lopTxt].filter(Boolean).join(' · ');
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(chung.ngay || '');
  chung.ngayChu = m ? `Ngày ${+m[1]} tháng ${+m[2]} năm ${m[3]}` : '';
  chung.nam = m ? m[3] : '';
  chung.ngaySo = chung.ngay;
  if (P.get('ky')) {
    const n = P.get('ky');
    document.documentElement.style.setProperty('--f-ten', `var(--f-ky-${n})`);
    document.documentElement.style.setProperty('--ten-co', `var(--ky-co-${n})`);
  }

  // ===== Huy hiệu tự vẽ (SVG) — không dùng ảnh tham khảo =====
  let uid = 0;
  const KIM = {
    vang: [['0', '#8A6420'], ['.22', '#E9CF86'], ['.45', '#B88A35'], ['.7', '#F3DE9C'], ['1', '#9C7428']],
    bac: [['0', '#6E7B89'], ['.22', '#E6EBF0'], ['.45', '#9AA6B3'], ['.7', '#F4F6F8'], ['1', '#7D8996']],
    hong: [['0', '#9A5B45'], ['.22', '#F2CDB8'], ['.45', '#C98E73'], ['.7', '#F7DCCB'], ['1', '#A8674F']],
  };
  const grad = (id, stops, x2 = '1', y2 = '1') =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  function nguyetQue(cx, cy, r, mau, a0, a1, so = 8, co = 1) {
    // Một nhành nguyệt quế đi từ góc a0 tới góc a1 (độ, SVG: 90 = dưới), lá xen trong/ngoài.
    let s = '';
    for (let i = 0; i < so; i++) {
      const t = i / (so - 1), a = a0 + (a1 - a0) * t, rad = (a * Math.PI) / 180;
      const tiep = a + (a1 > a0 ? 90 : -90); // hướng đi của nhành
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
  function vienRang(cx, cy, r1, r2, n) {
    // Viền răng cưa / hoa thị của dấu niêm.
    let d = '';
    for (let i = 0; i <= n * 2; i++) {
      const a = (i * Math.PI) / n;
      const r = i % 2 ? r2 : r1;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2);
    }
    return d + 'Z';
  }
  // kieu: 'rang' (viền răng cưa) · 'tron' (vòng tròn hai viền) · 'hoa' (viền hoa 16 cánh)
  // nen: màu lòng huy hiệu · chu: màu chữ trong lòng · duoi=1: thêm hai đuôi ruy băng
  function huyHieu(el) {
    const d = el.dataset;
    const id = 'hh' + ++uid;
    const nen = d.nen || '#1C2433', chu = d.chu || 'url(#' + id + 'g)', kieu = d.kieu || 'rang';
    const duoi = d.duoi === '1';
    const dong1 = d.dong1 || 'TỐT NGHIỆP', dong2 = d.dong2 || chung.nam || '';
    const ruy = d.ruy || '#8E1D24';
    const lq = d.chu || `url(#${id}g)`;
    let vien = '';
    if (kieu === 'rang') vien = `<path d="${vienRang(100, 100, 92, 84, 36)}" fill="url(#${id}g)"/>`;
    else if (kieu === 'hoa') {
      for (let i = 0; i < 16; i++) vien += `<circle cx="${(100 + 82 * Math.cos((i * Math.PI) / 8)).toFixed(1)}" cy="${(100 + 82 * Math.sin((i * Math.PI) / 8)).toFixed(1)}" r="13" fill="url(#${id}g)"/>`;
      vien += `<circle cx="100" cy="100" r="84" fill="url(#${id}g)"/>`;
    } else vien = `<circle cx="100" cy="100" r="92" fill="url(#${id}g)"/>`;
    const tails = duoi
      ? `<g><path d="M62 150 L40 232 L60 220 L74 240 L92 160Z" fill="${ruy}"/><path d="M138 150 L160 232 L140 220 L126 240 L108 160Z" fill="${ruy}"/>
         <path d="M62 150 L40 232 L60 220 L74 240 L92 160Z" fill="url(#${id}g)" opacity=".18"/><path d="M138 150 L160 232 L140 220 L126 240 L108 160Z" fill="url(#${id}g)" opacity=".18"/></g>`
      : '';
    el.innerHTML = `<svg viewBox="0 0 200 ${duoi ? 245 : 200}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${grad(id + 'g', KIM[d.kim || 'vang'])}
        <path id="${id}a" d="M100 100 m-56 0 a56 56 0 1 1 112 0"/>
        <path id="${id}b" d="M100 100 m-61 0 a61 61 0 1 0 122 0"/></defs>
      ${tails}${vien}
      <circle cx="100" cy="100" r="76" fill="${nen}"/>
      <circle cx="100" cy="100" r="70" fill="none" stroke="url(#${id}g)" stroke-width="1.6"/>
      <g>${nguyetQue(100, 100, 52, lq, 168, 100, 7, 0.85)}${nguyetQue(100, 100, 52, lq, 12, 80, 7, 0.85)}</g>
      <text font-family="MP Chữ không chân" font-weight="700" font-size="10.5" letter-spacing="2.4" fill="${chu}"><textPath href="#${id}a" startOffset="50%" text-anchor="middle">${d.vong || '★ CHỨNG NHẬN ★'}</textPath></text>
      <text x="100" y="98" text-anchor="middle" font-family="MP Chữ không chân" font-weight="700" font-size="12.5" letter-spacing="1" fill="${chu}">${dong1}</text>
      <text x="100" y="128" text-anchor="middle" font-family="MP Chữ đậm có chân" font-weight="700" font-size="27" fill="${chu}">${dong2}</text>
    </svg>`;
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
    root.querySelectorAll('[data-huy-hieu]').forEach(huyHieu);
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

  // ===== Co chữ cho vừa: tên dài tự nhỏ lại (một dòng), câu dài tự nhỏ lại =====
  function fit() {
    document.querySelectorAll('[data-fitw]').forEach((el) => {
      el.style.fontSize = '';
      let s = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 120 && el.scrollWidth > el.clientWidth + 1; i++) { s -= 1; el.style.fontSize = s + 'px'; }
    });
    document.body.dataset.ready = '1';
  }
  const imgs = [...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
  const FONTS = ['MP Chữ ký 1', 'MP Chữ ký 2', 'MP Chữ ký 3', 'MP Chữ ký 4', 'MP Chữ có chân', 'MP Chữ đậm có chân', 'MP Chữ không chân']
    .map((f) => document.fonts.load(`40px "${f}"`, 'Ấỳ').catch(() => 0));
  Promise.all([...FONTS, document.fonts.ready, ...imgs]).then(() => requestAnimationFrame(fit));
})();
