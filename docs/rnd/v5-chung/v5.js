/*
 * Khung bản mẫu R&D 05: dựng thanh trái / thanh trên / thanh dưới ĐÚNG lớp sh-* của sản phẩm (apps/web/src/layout),
 * chọn màn theo #tên, và bật nhãn "trường dữ liệu" bằng #tên+f.
 * Mỗi màn là <section class="v5-man" data-man="tên" data-active="lich" data-title="…" …> chứa phần thân.
 */
(function () {
  const P = {
    lich: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    hd: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    gia: '<path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    khach: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
    tho: '<path d="M14 3l7 7-9 9H5v-7z"/><path d="M11 6l7 7"/>',
    'thu-tien': '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
    'bao-cao': '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    'khoa-hoc': '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5M22 9v6"/>',
    mau: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8" r="1.5"/>',
    'cai-dat': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 1v-7.5z"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.9-3.6 3.6-5.6 7-5.6s6.1 2 7 5.6"/>',
    warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    seat: '<path d="M6 20v-5h12v5M7 15V6a2 2 0 012-2h6a2 2 0 012 2v9"/>',
    tag: '<path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  };
  const ico = (n, cls) => `<svg viewBox="0 0 24 24" class="ui-ico${cls ? ' ' + cls : ''}" aria-hidden="true">${P[n] || ''}</svg>`;
  window.v5ico = ico;

  // Ảnh đại diện chữ tắt — màu --av-0…5 (sản phẩm băm theo membershipId; bản mẫu ghi thẳng chỉ số).
  window.v5av = (initials, c, size) => `<span class="ui-av${size ? ' ui-av--' + size : ''}" style="background:var(--av-${c})" aria-hidden="true">${initials}</span>`;

  const OWNER_MENU = [
    { k: 'hom-nay', label: 'Hôm nay', short: 'Hôm nay', icon: 'home', homeOnly: true },
    { k: 'lich', label: 'Lịch makeup', short: 'Lịch', icon: 'lich' },
    { k: 'hop-dong', label: 'Hợp đồng', short: 'Hợp đồng', icon: 'hd', kids: [['hop-dong-moi', 'Lập hợp đồng'], ['hop-dong-ds', 'Danh sách hợp đồng'], ['thu-tien', 'Thu tiền']] },
    { k: 'bang-gia', label: 'Bảng giá', short: 'Bảng giá', icon: 'gia' },
    { k: 'khach-hang', label: 'Khách hàng', short: 'Khách', icon: 'khach' },
    { k: 'nhan-su', label: 'Thợ makeup', short: 'Thợ', icon: 'tho' },
    { k: 'dao-tao', label: 'Đào tạo', short: 'Khoá học', icon: 'khoa-hoc' },
    { k: 'bao-cao', label: 'Báo cáo', short: 'Báo cáo', icon: 'bao-cao' },
    { k: 'mau', label: 'Mẫu thiết kế', short: 'Mẫu', icon: 'mau' },
    { k: 'cai-dat', label: 'Cài đặt', short: 'Cài đặt', icon: 'cai-dat', kids: [['cai-dat-tb', 'Thông báo'], ['cai-dat-sk', 'Loại sự kiện'], ['cai-dat-th', 'Thương hiệu']] },
  ];
  const STAFF_MENU = [
    { k: 'hom-nay', label: 'Hôm nay', short: 'Hôm nay', icon: 'home', homeOnly: true },
    { k: 'lich', label: 'Lịch makeup', short: 'Lịch', icon: 'lich' },
    { k: 'cai-dat', label: 'Cài đặt', short: 'Cài đặt', icon: 'cai-dat' },
  ];

  function bellBtn(n, moi) {
    if (n === undefined || n === null || n === '') return '';
    const badge = n !== '0' ? `<span class="v5-badge" ${moi ? 'data-moi="Notification.readAt (đếm chưa đọc)"' : ''}>${n}</span>` : '';
    return `<button type="button" class="ui-btn ui-btn--ghost ui-btn--icon v5-bell${moi ? ' moi' : ''}" aria-label="Thông báo">${ico('bell')}${badge}</button>`;
  }

  function sidebar(s) {
    const staff = s.dataset.role === 'tho';
    const menu = (staff ? STAFF_MENU : OWNER_MENU).filter((m) => !m.homeOnly || s.dataset.home === '1');
    const active = s.dataset.active;
    const child = s.dataset.child;
    const user = staff ? ['Linh Trần', 'Thợ makeup', 'LT', 3] : ['Nguyễn Văn Chiến', 'Chủ tài khoản', 'NC', 3];
    const items = menu
      .map((m) => {
        const on = m.k === active;
        let html = `<a class="sh-menu__a${on ? ' on' : ''}" href="#">${ico(m.icon)}<span class="sh-hide-t">${m.label}</span></a>`;
        if (on && m.kids && child) {
          html += `<div class="sh-kids sh-hide-t">${m.kids.map(([k, l]) => `<a class="sh-kids__a${k === child ? ' on' : ''}" href="#">${l}</a>`).join('')}</div>`;
        }
        return html;
      })
      .join('');
    return `<div class="sh-sidecol"><aside class="sh-side">
      <div class="sh-brand">${ico('tho')}<span class="sh-hide-t">Makeup Pro</span>${bellBtn(s.dataset.bell, s.dataset.bellmoi === '1')}</div>
      <div class="sh-user"><span class="ui-av" style="background:var(--av-${user[3]})">${user[2]}</span><span class="sh-user__txt sh-hide-t"><span class="sh-user__name">${user[0]}</span><small>${user[1]}</small></span></div>
      <div class="sh-org"><button type="button" class="sh-org__btn"><span class="sh-org__badge">S</span><span class="sh-org__name sh-hide-t">Studio Chiến Makeup &amp; Academy</span>${ico('down', 'sh-hide-t')}</button></div>
      <nav class="sh-menu">${items}</nav>
      <div class="sh-foot"><button type="button" class="sh-menu__a">${ico('logout')}<span class="sh-hide-t">Đăng xuất</span></button></div>
    </aside></div>`;
  }

  function topbar(s) {
    const back = s.dataset.back === '1' ? `<a class="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon sh-top__back" href="#">${ico('back')}</a>` : '';
    const right = s.dataset.topright || '';
    return `<header class="sh-top">${back}<span class="sh-top__title">${s.dataset.title || ''}</span>${right}${bellBtn(s.dataset.bell, s.dataset.bellmoi === '1')}</header>`;
  }

  function bottomnav(s) {
    const staff = s.dataset.role === 'tho';
    const home = s.dataset.home === '1';
    let keys = staff ? ['lich'] : ['lich', 'hop-dong', 'bang-gia', 'khach-hang'];
    if (home) keys = staff ? ['hom-nay', 'lich'] : ['hom-nay', 'lich', 'hop-dong', 'khach-hang'];
    const menu = staff ? STAFF_MENU : OWNER_MENU;
    const cells = keys.map((k) => {
      const m = menu.find((x) => x.k === k);
      return `<a class="sh-bnav__a${k === s.dataset.active ? ' on' : ''}" href="#">${ico(m.icon)}${m.short}</a>`;
    });
    cells.push(`<button type="button" class="sh-bnav__a">${ico('more')}Thêm</button>`);
    return `<nav class="sh-bnav" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.join('')}</nav>`;
  }

  function build(s) {
    const body = s.innerHTML;
    const h1 = s.dataset.h1 !== undefined ? s.dataset.h1 : s.dataset.title;
    const phRight = s.dataset.phright || '';
    const note = s.dataset.note ? `<div class="v5-note"><span><b>Bản mẫu R&amp;D 05 · ${s.dataset.note}</b></span><span><i></i>viền nâu nét đứt = cần dữ liệu MỚI, máy chủ chưa có (xem mục "Đề xuất trường mới" trong báo cáo)</span></div>` : '';
    const ph = h1 ? `<div class="sh-ph"><h1>${h1}</h1><span class="sh-ph__sp"></span>${phRight}</div>` : '';
    s.innerHTML = `<div class="sh">${sidebar(s)}<div class="sh-body">${topbar(s)}<main class="sh-main">${note}${ph}${body}</main></div>${bottomnav(s)}</div>`;
  }

  function overlay() {
    document.body.classList.add('v5-f-on');
    const els = document.querySelectorAll('.v5-man.on [data-f], .v5-man.on [data-moi]');
    const placed = [];
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const moi = el.hasAttribute('data-moi');
      const t = document.createElement('span');
      t.className = 'v5-f' + (moi ? ' v5-f--moi' : '');
      t.textContent = (moi ? 'MỚI · ' : '') + (el.getAttribute(moi ? 'data-moi' : 'data-f'));
      let x = r.left + window.scrollX;
      let y = r.top + window.scrollY - 13;
      // tránh chồng nhãn: dời xuống nếu trùng chỗ
      for (const p of placed) if (Math.abs(p[0] - x) < 120 && Math.abs(p[1] - y) < 12) y = p[1] + 13;
      placed.push([x, y]);
      t.style.left = Math.max(0, x) + 'px';
      t.style.top = Math.max(0, y) + 'px';
      document.body.appendChild(t);
      const maxX = document.documentElement.clientWidth - t.offsetWidth - 2;
      if (x > maxX) t.style.left = Math.max(0, maxX) + 'px';
    });
  }

  function route() {
    const [name, flag] = (location.hash.slice(1) || '').split('+');
    const mans = [...document.querySelectorAll('.v5-man')];
    document.querySelectorAll('.v5-f').forEach((e) => e.remove());
    document.body.classList.remove('v5-f-on');
    const target = mans.find((m) => m.dataset.man === name);
    const idx = document.getElementById('v5-idx');
    mans.forEach((m) => m.classList.toggle('on', m === target));
    mans.forEach((m) => (m.style.display = m === target ? '' : 'none'));
    if (idx) idx.style.display = target ? 'none' : '';
    if (target && window.v5render) window.v5render(target);
    if (target && flag === 'f') requestAnimationFrame(() => requestAnimationFrame(overlay));
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mans = [...document.querySelectorAll('.v5-man')];
    mans.forEach(build);
    const idx = document.createElement('div');
    idx.id = 'v5-idx';
    idx.className = 'v5-idx';
    idx.innerHTML = `<h1>${document.title}</h1><p>Mở từng màn bằng #tên. Thêm "+f" để hiện nhãn trường dữ liệu (tím = trường đã có, nâu = trường mới đề xuất).</p>` +
      mans.map((m) => `<a href="#${m.dataset.man}"><b>#${m.dataset.man}</b>${m.dataset.desc || m.dataset.title || ''}</a>`).join('');
    document.body.prepend(idx);
    route();
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if (location.hash.includes('+f')) route(); });
})();
