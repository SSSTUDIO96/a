/* Bản mẫu R&D vòng 4 — khung C dùng chung (thanh trái / thanh trên / thanh dưới) + chuyển màn theo #.
   Mỗi màn là <section class="man" id="..."> với các thuộc tính:
   data-shell="org|nentang|none", data-nav (mục menu), data-kid (mục con, đúng chữ), data-title (tiêu đề thanh trên điện thoại),
   data-back (# màn quay lại trên điện thoại), data-act (chữ nút bên phải thanh trên), data-mobile="list|detail". */
(function () {
  const P = {
    lich: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    hd: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    gia: '<path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    khach: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
    tho: '<path d="M14 3l7 7-9 9H5v-7z"/><path d="M11 6l7 7"/>',
    'cai-dat': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    'tong-quan': '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
    'bao-cao': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    tien: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    up: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    org: '<path d="M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M8 8h3M8 12h3M8 16h3M2 21h20"/>',
    goi: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z"/>',
    drag: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  };
  const icon = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

  // Ảnh đại diện minh hoạ (vẽ bằng SVG, không phải ảnh người thật).
  const SKIN = ['#E9C3A6', '#F1D2B8', '#D9A982', '#EFC9AE'];
  const HAIR = ['#2B1D18', '#4A2F25', '#1E1A1A', '#6B4130'];
  const BG = ['#F3E3E9', '#E8E2F4', '#E2F0EC', '#F6EBDD', '#E6ECF4'];
  function photo(seed) {
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const s = SKIN[h % 4], hr = HAIR[(h >> 3) % 4], bg = BG[(h >> 5) % 5];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/><path d="M14 64c2-13 9-19 18-19s16 6 18 19z" fill="${hr === '#1E1A1A' ? '#A63D62' : '#7A6A62'}" opacity=".85"/><ellipse cx="32" cy="29" rx="15" ry="17" fill="${hr}"/><ellipse cx="32" cy="31" rx="10.5" ry="12.5" fill="${s}"/><path d="M21 27c3-9 19-10 22 0-6-4-16-4-22 0z" fill="${hr}"/></svg>`;
    return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
  }
  const PAL = ['#A63D62', '#5B45A0', '#2F7D72', '#9A5B0F', '#7A6A62', '#3D6A9A'];
  function ini(name) {
    const w = name.trim().split(/\s+/);
    return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
  }
  // av('Lương Hà My', true) → ảnh; av('...', false) → chữ viết tắt trên màu theo tên
  function av(name, hasPhoto, cls) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    if (hasPhoto) return `<span class="av${cls ? ' ' + cls : ''}" style="background-image:${photo(name)}" title="${name}"></span>`;
    return `<span class="av${cls ? ' ' + cls : ''}" style="background:${PAL[h % 6]}" title="${name}">${ini(name)}</span>`;
  }
  const vnd = (x) => Number(x).toLocaleString('vi-VN').replace(/,/g, '.') + ' ₫';
  const tip = (t) => `<i class="tip" tabindex="0" data-tip="${t}">?</i>`;

  const ORG_NAV = [
    { k: 'tong-quan', t: 'Tổng quan', i: 'tong-quan' },
    { k: 'lich', t: 'Lịch makeup', i: 'lich' },
    { k: 'hd', t: 'Hợp đồng', i: 'hd', kids: ['Lập hợp đồng', 'Danh sách hợp đồng', 'Thu tiền'] },
    { k: 'gia', t: 'Bảng giá', i: 'gia' },
    { k: 'khach', t: 'Khách hàng', i: 'khach' },
    { k: 'tho', t: 'Thợ makeup', i: 'tho', kids: ['Thợ & bậc lương', 'Tiền công theo gói'] },
    { k: 'bao-cao', t: 'Báo cáo', i: 'bao-cao', kids: ['Doanh thu', 'Sổ thu'] },
    { k: 'cai-dat', t: 'Cài đặt', i: 'cai-dat', kids: ['Hồ sơ thương hiệu'] },
  ];
  const ORG_BNAV = [
    { k: 'lich', t: 'Lịch', i: 'lich' },
    { k: 'hd', t: 'Hợp đồng', i: 'hd' },
    { k: 'gia', t: 'Bảng giá', i: 'gia' },
    { k: 'khach', t: 'Khách', i: 'khach' },
    { k: 'them', t: 'Thêm', i: 'more' },
  ];
  const PF_NAV = [
    { k: 'pf-home', t: 'Trang chủ', i: 'tong-quan' },
    { k: 'pf-org', t: 'Tổ chức', i: 'org' },
    { k: 'pf-plan', t: 'Gói cước', i: 'goi' },
  ];

  function sidebar(shell, nav, kid, kidsOverride) {
    const items = shell === 'nentang' ? PF_NAV : ORG_NAV;
    const brand = shell === 'nentang' ? 'Quản trị nền tảng' : 'Makeup Pro';
    const user = shell === 'nentang'
      ? `${av('Nguyễn Trọng Chiến', false)}<div>Nguyễn Trọng Chiến<small>Quản trị nền tảng</small></div>`
      : `${av('Nguyễn Trọng Chiến', false)}<div>Nguyễn Trọng Chiến<small>Chủ studio · Studio Chiến</small></div>`;
    const menu = items.map((m) => {
      const on = m.k === nav;
      let kids = '';
      const kl = on ? (kidsOverride || m.kids) : null;
      if (kl) kids = `<div class="kids">${kl.map((x) => `<a href="#" class="${x === kid ? 'on' : ''}">${x}</a>`).join('')}</div>`;
      return `<a href="#" class="${on ? 'on' : ''}" title="${m.t}">${icon(m.i)}<span>${m.t}</span></a>${kids}`;
    }).join('');
    return `<div class="side"><div class="brand">${icon('tho')}<span>${brand}</span></div><div class="user">${user}</div><nav class="menu">${menu}</nav></div>`;
  }
  function bnav(shell, nav) {
    if (shell === 'nentang') {
      return `<nav class="bnav" style="grid-template-columns:repeat(3,1fr)">${PF_NAV.map((m) => `<a href="#" class="${m.k === nav ? 'on' : ''}">${icon(m.i)}${m.t}</a>`).join('')}</nav>`;
    }
    const map = { tho: 'them', 'bao-cao': 'them', 'cai-dat': 'them', 'tong-quan': 'them' };
    const k = map[nav] || nav;
    return `<nav class="bnav">${ORG_BNAV.map((m) => `<a href="#" class="${m.k === k ? 'on' : ''}">${icon(m.i)}${m.t}</a>`).join('')}</nav>`;
  }

  function route() {
    const id = (location.hash || '#muc-luc').slice(1);
    const sec = document.getElementById('man-' + id) || document.getElementById('man-muc-luc');
    document.querySelectorAll('.man').forEach((s) => s.classList.toggle('on', s === sec));
    const d = sec.dataset;
    const shell = d.shell || 'org';
    const app = document.getElementById('app');
    const side = document.getElementById('sidecol');
    const top = document.getElementById('topbar');
    const bn = document.getElementById('bnavwrap');
    const main = document.getElementById('main');
    document.body.classList.toggle('m-list', d.mobile !== 'detail');
    document.body.classList.toggle('m-detail', d.mobile === 'detail');
    if (shell === 'none') {
      app.style.display = 'block';
      side.style.display = 'none';
      top.innerHTML = '';
      top.style.display = 'none';
      bn.innerHTML = '';
      main.className = 'nomain';
      document.body.style.paddingBottom = '0';
    } else {
      app.style.display = '';
      side.style.display = '';
      top.style.display = '';
      main.className = 'main';
      document.body.style.paddingBottom = '';
      side.innerHTML = sidebar(shell, d.nav, d.kid, d.kids ? d.kids.split('|') : null);
      const back = d.back ? `<a class="btn icon ghost back" href="${d.back}" aria-label="Quay lại">${icon('back')}</a>` : '';
      const act = d.act ? `<button class="btn sm pri">${d.act === '+' ? icon('plus', 's') : d.act}</button>` : '';
      top.innerHTML = `${back}<div class="tt">${d.title || ''}</div>${d.topExtra || ''}${act}`;
      bn.innerHTML = bnav(shell, d.nav);
    }
    document.title = (d.title || 'Mục lục') + ' — ' + (document.querySelector('meta[name=ten]')?.content || 'R&D v4');
    window.scrollTo(0, 0);
  }

  function boot() {
    const holder = document.getElementById('mans');
    const app = document.createElement('div');
    app.className = 'app';
    app.id = 'app';
    app.innerHTML = '<aside class="sidecol" id="sidecol"></aside><div class="body"><header class="topbar" id="topbar"></header><main class="main" id="main"></main></div>';
    document.body.prepend(app);
    const main = app.querySelector('#main');
    main.append(...holder.children);
    holder.remove();
    const bw = document.createElement('div');
    bw.id = 'bnavwrap';
    document.body.append(bw);
    const bar = document.createElement('div');
    bar.className = 'rnd-bar';
    bar.innerHTML = '<button type="button" id="tg-f">Hiện trường dữ liệu</button><a href="#muc-luc"><button type="button">Mục lục</button></a>';
    document.body.append(bar);
    bar.querySelector('#tg-f').onclick = () => document.body.classList.toggle('show-f');
    if (/[?&]chup/.test(location.search)) document.body.classList.add('chup');
    if (/[?&]truong/.test(location.search)) document.body.classList.add('show-f');
    window.addEventListener('hashchange', route);
    route();
  }

  // Thêm một màn: V4.man('c-tien-cong', {shell:'org', nav:'tho', kid:'Tiền công theo gói', title:'Tiền công'}, html)
  function man(id, meta, html) {
    let holder = document.getElementById('mans');
    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'mans';
      document.body.append(holder);
    }
    const s = document.createElement('section');
    s.className = 'man';
    s.id = 'man-' + id; // tiền tố để trình duyệt không tự cuộn tới khi mở #id
    for (const [k, v] of Object.entries(meta || {})) if (v !== undefined && v !== null) s.dataset[k] = v;
    s.innerHTML = html;
    holder.append(s);
  }
  // Mục lục: danh sách [id, tên, mô tả]
  function mucLuc(ten, moTa, nhom) {
    const html = `<div class="idx"><h1>${ten}</h1><p class="muted">${moTa}</p>${nhom.map(([h, ds]) => `<div class="card"><div class="ch2"><h2>${h}</h2></div><ul>${ds.map(([id, t, m]) => `<li><a href="#${id}"><b>${t}</b></a><code>#${id}</code><span class="muted small">${m || ''}</span></li>`).join('')}</ul></div>`).join('')}</div>`;
    man('muc-luc', { shell: 'none', title: 'Mục lục' }, html);
  }
  window.V4 = { icon, av, photo, vnd, tip, boot, man, mucLuc, ini };
})();
