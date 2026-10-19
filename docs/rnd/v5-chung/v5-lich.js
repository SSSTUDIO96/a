/*
 * Dựng màn Lịch makeup 3 chế độ (C lưới tuần, B danh sách ngày, A cột thợ) bằng ĐÚNG lớp ws-* của
 * apps/web/src/features/schedule (WeekGridC, WeekGridCMobile, DayListB, StaffColumnsA).
 * Dữ liệu mẫu tuần 16–22/11/2026. Tô màu theo một trong các cách:
 *   'nv' = nhân vật (như sản phẩm hôm nay, model.ts swatchOf), 'A' | 'B' | 'C' = loại sự kiện theo phương án.
 * Dùng: <div class="v5-lich" data-mode="C|B|A" data-color="nv|A|B|C" data-day="2026-11-22"></div>
 */
(function () {
  const ico = (n, c) => window.v5ico(n, c);
  const av = (i, c, s) => window.v5av(i, c, s);

  const STAFF = [
    { id: 'linh', name: 'Linh Trần', short: 'Linh Trần', ini: 'LT', c: 3, tier: 'Thợ chính' },
    { id: 'tu', name: 'Lê Minh Tú', short: 'Minh Tú', ini: 'LT', c: 4, tier: 'Thợ phụ trách' },
    { id: 'ha', name: 'Phạm Thu Hà', short: 'Thu Hà', ini: 'PH', c: 0, tier: 'Thợ mới' },
    { id: 'giang', name: 'Giang', short: 'Giang', ini: 'G', c: 5, tier: 'Thợ mới' },
  ];
  const DAYS = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
  const WD = ['THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY', 'CHỦ NHẬT'];
  const WDS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const WDL = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

  // Loại sự kiện theo phương án. sw = tên màu của sản phẩm (ws-sw-*).
  const EV = {
    A: { 'an-hoi': ['Ăn hỏi', 'amber'], cuoi: ['Cưới', 'rose'], ahc: ['Ăn hỏi + cưới', 'taupe'], tiec: ['Tiệc', 'violet'], ngoai: ['Ngoại cảnh', 'green'], kyyeu: ['Kỷ yếu', 'blue'] },
    B: { 'an-hoi': ['Ăn hỏi', 'amber'], cuoi: ['Cưới', 'rose'], tiec: ['Tiệc', 'violet'], ngoai: ['Ngoại cảnh', 'green'], kyyeu: ['Kỷ yếu', 'blue'], khac: ['Khác', 'taupe'] },
    C: { vuquy: ['Lễ vu quy', 'taupe'], cuoi: ['Lễ cưới', 'rose'], 'an-hoi': ['Ăn hỏi', 'amber'], tiec: ['Tiệc', 'violet'], pre: ['Pre-wedding', 'green'], kyyeu: ['Kỷ yếu', 'blue'] },
  };
  window.V5EV = EV;
  const SUBJ = { 'cô dâu': 'rose', 'mẹ cô dâu': 'violet', 'phù dâu': 'amber', 'mẹ chú rể': 'green', 'chú rể': 'blue', 'khách mời': 'taupe' };

  // a: A = loại ở hợp đồng; B = ở dòng; C = danh sách studio (ở dòng). null = chưa có.
  const AP = [
    { id: 1, d: '2026-11-17', s: '08:00', e: '10:00', st: ['linh'], pkg: 'Cô dâu cao cấp', subj: 'Cô dâu', q: 1, kh: 'Trần Bảo Ngọc', nc: 'Nơi khác – Hồ Tây, Tây Hồ', hd: 'HD-000003', A: 'ngoai', B: 'ngoai', C: 'pre' },
    { id: 2, d: '2026-11-18', s: '06:30', e: '08:30', st: ['giang'], pkg: 'Makeup kỷ yếu', subj: 'Khách mời', q: 4, kh: 'Nguyễn Hải Yến', nc: 'Nơi khác – THPT Chu Văn An', hd: 'HD-000005', A: 'kyyeu', B: 'kyyeu', C: 'kyyeu' },
    { id: 3, d: '2026-11-19', s: '05:30', e: '07:30', st: ['linh'], pkg: 'Cô dâu cao cấp', subj: 'Cô dâu', q: 1, kh: 'Vũ Thị Hồng Nhung', nc: 'Tại nhà khách – 25 Nguyễn Văn Cừ', hd: 'HD-000001', A: 'an-hoi', B: 'an-hoi', C: 'an-hoi' },
    { id: 4, d: '2026-11-19', s: '06:30', e: '07:30', st: ['tu'], pkg: 'Mẹ cô dâu', subj: 'Mẹ cô dâu', q: 1, kh: 'Vũ Thị Hồng Nhung', nc: 'Tại nhà khách – 25 Nguyễn Văn Cừ', hd: 'HD-000001', A: 'an-hoi', B: 'an-hoi', C: 'an-hoi' },
    { id: 5, d: '2026-11-20', s: '16:00', e: '17:30', st: ['ha'], pkg: 'Makeup tiệc', subj: 'Khách mời', q: 2, kh: 'Đỗ Thanh Mai', nc: 'Tại studio', hd: 'HD-000004', A: 'tiec', B: 'tiec', C: 'tiec' },
    { id: 6, d: '2026-11-21', s: '15:00', e: '16:00', st: ['ha'], pkg: null, subj: null, title: 'Makeup đi tiệc', q: 1, kh: 'Lê Phương Anh', nc: 'Tại studio', hd: null, A: null, B: 'tiec', C: 'tiec' },
    { id: 7, d: '2026-11-22', s: '05:00', e: '07:00', st: ['linh'], pkg: 'Cô dâu cao cấp', subj: 'Cô dâu', q: 1, kh: 'Vũ Thị Hồng Nhung', nc: 'Tại nhà khách – 25 Nguyễn Văn Cừ', hd: 'HD-000008', A: 'cuoi', B: 'cuoi', C: 'vuquy' },
    { id: 8, d: '2026-11-22', s: '06:00', e: '06:45', st: ['ha'], pkg: 'Phù dâu', subj: 'Phù dâu', q: 2, kh: 'Vũ Thị Hồng Nhung', nc: 'Tại studio', hd: 'HD-000008', A: 'cuoi', B: 'cuoi', C: 'vuquy' },
    { id: 9, d: '2026-11-22', s: '07:00', e: '08:00', st: ['tu'], pkg: 'Mẹ cô dâu', subj: 'Mẹ cô dâu', q: 1, kh: 'Vũ Thị Hồng Nhung', nc: 'Tại nhà khách – 25 Nguyễn Văn Cừ', hd: 'HD-000008', A: 'cuoi', B: 'cuoi', C: 'vuquy' },
    { id: 10, d: '2026-11-22', s: '08:30', e: '10:00', st: ['giang'], pkg: 'Cô dâu', subj: 'Cô dâu', q: 1, kh: 'Ngô Thảo Vy', nc: 'Tại nhà khách – 12 Kim Mã', hd: 'HD-000007', A: 'an-hoi', B: 'an-hoi', C: 'an-hoi' },
    { id: 11, d: '2026-11-22', s: '09:00', e: '10:00', st: ['tu'], pkg: 'Mẹ cô dâu', subj: 'Mẹ cô dâu', q: 1, kh: 'Hoàng Minh Thư', nc: 'Tại studio', hd: 'HD-000002', A: 'cuoi', B: 'cuoi', C: 'cuoi' },
    { id: 12, d: '2026-11-22', s: '13:00', e: '15:00', st: ['linh'], pkg: 'Cô dâu cao cấp', subj: 'Cô dâu', q: 1, kh: 'Hoàng Minh Thư', nc: 'Tại studio', hd: 'HD-000002', A: 'cuoi', B: 'cuoi', C: 'cuoi' },
    { id: 13, d: '2026-11-22', s: '15:00', e: '15:45', st: [], pkg: 'Phù dâu', subj: 'Phù dâu', q: 1, kh: 'Hoàng Minh Thư', nc: 'Tại studio', hd: 'HD-000002', A: 'cuoi', B: 'cuoi', C: 'cuoi' },
    { id: 15, d: '2026-11-22', s: '17:30', e: '18:30', st: ['linh'], pkg: 'Dặm makeup', subj: 'Cô dâu', q: 1, kh: 'Vũ Thị Hồng Nhung', nc: 'Nơi khác – Nhà hàng Riverside', hd: 'HD-000008', A: 'cuoi', B: 'tiec', C: 'tiec' },
    { id: 14, d: '2026-11-22', s: '17:00', e: '18:00', st: ['giang'], pkg: 'Makeup tiệc', subj: 'Khách mời', q: 1, kh: 'Phạm Quỳnh Anh', nc: 'Tại studio', hd: 'HD-000006', A: 'tiec', B: 'tiec', C: 'tiec' },
  ];

  const min = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  function sw(a, color) {
    if (color === 'nv') return a.subj ? SUBJ[a.subj.toLowerCase()] || 'other' : 'other';
    const k = a[color];
    return k && EV[color][k] ? EV[color][k][1] : 'other';
  }
  function evName(a, color) { const k = a[color]; return k && EV[color][k] ? EV[color][k][0] : null; }
  function kind(a, color) {
    const base = a.pkg ? `${a.pkg} — ${a.subj}` : a.title;
    if (color === 'nv') return base;
    const ev = evName(a, color);
    const who = a.subj || a.title;
    return ev ? `${ev} · ${who}` : `Chưa chọn sự kiện · ${who}`;
  }
  const qty = (a) => (a.q > 1 ? ` × ${a.q}` : '');
  const cls = (a, color) => `ws-sw-${sw(a, color)}${a.st.length ? '' : ' is-na'}`;
  const staffOf = (id) => STAFF.find((s) => s.id === id);
  const fld = (color) => (color === 'nv' ? 'ContractLine.subjectName' : color === 'A' ? 'Contract.occasion' : color === 'B' ? 'ContractLine.occasion' : 'ContractLine.occasionId → Occasion.color');
  const moiAttr = (color) => (color === 'nv' ? `data-f="${fld(color)} (màu)"` : `data-moi="${fld(color)} (màu)"`);

  function legend(color, list) {
    let items;
    if (color === 'nv') {
      const seen = [];
      list.forEach((a) => { if (a.subj && !seen.includes(a.subj)) seen.push(a.subj); });
      const order = ['Cô dâu', 'Chú rể', 'Mẹ cô dâu', 'Mẹ chú rể', 'Phù dâu', 'Khách mời'];
      seen.sort((x, y) => order.indexOf(x) - order.indexOf(y));
      items = seen.map((n) => `<span class="ws-legend__i ws-sw-${SUBJ[n.toLowerCase()]}"><i></i>${n}</span>`);
      if (list.some((a) => !a.subj)) items.push(`<span class="ws-legend__i ws-sw-other"><i></i>Khác</span>`);
    } else {
      const keys = Object.keys(EV[color]).filter((k) => list.some((a) => a[color] === k));
      items = keys.map((k) => `<span class="ws-legend__i ws-sw-${EV[color][k][1]}"><i></i>${EV[color][k][0]}</span>`);
      if (list.some((a) => !a[color])) items.push(`<span class="ws-legend__i ws-sw-other"><i></i>Chưa chọn sự kiện</span>`);
    }
    items.push(`<span class="ws-legend__i ws-legend__i--na"><i></i>Chưa có thợ</span>`);
    items.push(`<span class="ws-legend__i ws-legend__i--off"><i></i>Không chặn lịch</span>`);
    const tag = color === 'nv' ? `data-f="ContractLine.subjectName"` : `class="ws-legend moi" ${moiAttr(color)}`;
    return color === 'nv' ? `<div class="ws-legend" ${tag}>${items.join('')}</div>` : `<div ${tag}>${items.join('')}</div>`;
  }

  function toolbar(mode, phone, opts) {
    const label = mode === 'C' ? '16 – 22/11/2026' : 'Chủ nhật, 22/11/2026';
    const nav = `<div class="ws-pill"><button type="button" class="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon">${ico('left')}</button><span class="ws-pill__lbl num">${phone && mode !== 'C' ? '22/11' : label}</span><button type="button" class="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon">${ico('right')}</button><button type="button" class="ws-pill__today">Hôm nay</button></div>`;
    const seg = (on) => `<div class="ui-seg ${phone ? 'ui-seg--block' : 'ui-seg--sm'} ws-modes" role="radiogroup">${[['C', 'Thợ × ngày', 'Tuần'], ['B', 'Ngày', 'Ngày'], ['A', 'Cột thợ', 'Cột thợ']].map(([v, l, s]) => `<button type="button" class="ui-seg__opt" aria-checked="${v === on}">${phone ? s : l}</button>`).join('')}</div>`;
    const colorBy = opts.colorBy ? `<span class="v5-colorby">Tô màu<div class="ui-seg ui-seg--sm">${['Sự kiện', 'Nhân vật'].map((l, i) => `<button type="button" class="ui-seg__opt" aria-checked="${(opts.colorBy === 'ev') === (i === 0)}">${l}</button>`).join('')}</div></span>` : '';
    const filter = `<button type="button" class="ui-btn${phone ? ' ui-btn--sm' : ''}">${ico('filter')}${phone ? '' : 'Bộ lọc'}</button>`;
    if (phone) return `<div class="ws-tools ws-tools--phone">${seg(mode)}<div class="ws-tools__row">${nav}<span class="ws-sp"></span>${colorBy}${filter}</div></div>`;
    return `<div class="ws-tools">${nav}<button type="button" class="ui-btn ui-btn--primary">${ico('plus')}Thêm lịch</button><span class="ws-sp"></span>${colorBy}${seg(mode)}${filter}</div>`;
  }

  // ---------- C máy tính ----------
  function gridC(color) {
    let h = `<div class="ws-c"><div class="ws-c__grid"><div class="ws-c__row"><div class="ws-c__corner">Thợ</div>`;
    DAYS.forEach((d, i) => {
      const n = AP.filter((a) => a.d === d).length;
      h += `<div class="ws-c__dh${i >= 5 ? ' is-we' : ''}"><span class="ws-c__wd">${WD[i]}</span><span class="ws-c__dm num">${d.slice(8)}/11</span><span class="ws-c__cnt">${n} ca</span></div>`;
    });
    h += `</div>`;
    const lanes = [...STAFF, null];
    lanes.forEach((s) => {
      const mine = AP.filter((a) => (s ? a.st.includes(s.id) : a.st.length === 0));
      h += `<div class="ws-c__row"><div class="ws-c__rh${s ? '' : ' is-na'}">${s ? av(s.ini, s.c) : '<span class="ws-av-na">?</span>'}<div class="ws-c__who"><span class="ws-c__nm">${s ? s.name : 'Chưa có thợ'}</span>${s ? `<span class="ws-c__meta">${s.tier}</span>` : ''}<span class="ws-c__meta">${mine.length} ca/tuần</span></div></div>`;
      DAYS.forEach((d, i) => {
        const list = mine.filter((a) => a.d === d).sort((x, y) => min(x.s) - min(y.s));
        h += `<div class="ws-c__cell${i >= 5 ? ' is-we' : ''}">${list.map((a, j) => `<div class="ws-chip-wrap"><button type="button" class="ws-chip ${cls(a, color)}" ${j === 0 && i === 6 && s && s.id === 'linh' ? `data-f="Appointment.startsAt · ${color === 'nv' ? 'ContractLine.subjectName' : 'sự kiện + subjectName'}"` : ''}><span class="ws-chip__top"><b class="num">${a.s}</b><span class="ws-chip__kind">${kind(a, color)}</span>${a.q > 1 ? `<span class="ws-chip__qty">× ${a.q}</span>` : ''}</span><span class="ws-chip__who">${a.kh}</span></button></div>`).join('')}</div>`;
      });
      h += `</div>`;
    });
    return h + `</div></div>`;
  }

  // ---------- C điện thoại ----------
  function gridCm(color, day) {
    const cols = [...STAFF, null];
    let h = `<div class="ws-cm" style="--ws-cols:${cols.length}"><div class="ws-cm__row"><div class="ws-cm__corner"></div>`;
    cols.forEach((s) => (h += `<div class="ws-cm__sh${s ? '' : ' is-na'}">${s ? av(s.ini, s.c, 'xs') : '<span class="ws-av-na ws-av-na--xs">?</span>'}<span class="ws-cm__tn">${s ? s.short : 'Chưa có thợ'}</span></div>`));
    h += `</div>`;
    DAYS.forEach((d, i) => {
      const n = AP.filter((a) => a.d === d).length;
      h += `<div class="ws-cm__row"><button type="button" class="ws-cm__dh${i >= 5 ? ' is-we' : ''}${d === day ? ' is-sel' : ''}"><b>${WDS[i]}</b><span class="num">${+d.slice(8)}</span><i>${n} ca</i></button>`;
      cols.forEach((s) => {
        const list = AP.filter((a) => a.d === d && (s ? a.st.includes(s.id) : a.st.length === 0)).sort((x, y) => min(x.s) - min(y.s));
        h += `<div class="ws-cm__cell${d === day ? ' is-sel' : ''}">${list.slice(0, 3).map((a) => `<button type="button" class="ws-pt ${cls(a, color)}"><span class="num">${a.s}</span></button>`).join('')}${list.length > 3 ? `<button type="button" class="ws-pt-more">+${list.length - 3}</button>` : ''}</div>`;
      });
      h += `</div>`;
    });
    h += `</div>`;
    const di = DAYS.indexOf(day);
    const dl = AP.filter((a) => a.d === day).sort((x, y) => min(x.s) - min(y.s));
    h += `<div class="ws-cm-day"><div class="ws-cm-day__h"><b>${WDL[di]} ${+day.slice(8)}/11</b><span>${dl.length} ca · ${dl.filter((a) => !a.st.length).length} chưa có thợ</span></div><div class="ws-cm-day__list">`;
    dl.slice(0, 4).forEach((a) => {
      const s = a.st[0] && staffOf(a.st[0]);
      h += `<button type="button" class="ws-ag ${cls(a, color)}"><span class="ws-ag__tm num">${a.s}<small>${a.e}</small></span><span class="ws-ag__main"><span class="ws-ag__kind">${kind(a, color)}${qty(a)}</span><span class="ws-ag__kh">${a.kh}</span></span><span class="ws-ag__who">${s ? av(s.ini, s.c, 'sm') : '<span class="ws-av-na ws-av-na--sm">?</span>'}</span></button>`;
    });
    h += `<button type="button" class="ws-cm-day__all">Xem cả ngày (${dl.length} ca)</button></div></div>`;
    return h;
  }

  // ---------- B ----------
  function listB(color, day, phone) {
    const dl = AP.filter((a) => a.d === day).sort((x, y) => min(x.s) - min(y.s));
    let h = `<div class="ws-b${phone ? '' : ' has-panel'}"><div class="ws-b__main"><div class="ws-days">`;
    DAYS.forEach((d, i) => (h += `<button type="button" class="ws-day${i >= 5 ? ' is-we' : ''}${d === day ? ' is-on' : ''}"><span class="ws-day__w">${WDS[i]}</span><span class="ws-day__n num">${+d.slice(8)}</span><span class="ws-day__c">${AP.filter((a) => a.d === d).length} ca</span></button>`));
    h += `</div><div class="ws-filters"><button type="button" class="ui-chip" aria-pressed="true">Tất cả <span class="ui-chip__count">${dl.length}</span></button>`;
    STAFF.forEach((s) => (h += `<button type="button" class="ui-chip">${av(s.ini, s.c, 'xs')} ${s.name} <span class="ui-chip__count">${dl.filter((a) => a.st.includes(s.id)).length}</span></button>`));
    h += `<button type="button" class="ui-chip"><span class="ws-av-na ws-av-na--xs">?</span> Chưa có thợ <span class="ui-chip__count">${dl.filter((a) => !a.st.length).length}</span></button></div>`;
    const na = dl.filter((a) => !a.st.length);
    if (na.length) h += `<section class="ws-b__sec"><h3 class="ws-caps">Cần xử lý</h3><div class="ws-todo">${na.map((a) => `<div class="ws-task">${ico('person')}<button type="button" class="ws-task__t"><b>Chưa có thợ</b><span>${a.s} · ${kind(a, color)} · ${a.kh}</span></button><button type="button" class="ui-btn ui-btn--sm">Phân thợ</button></div>`).join('')}</div></section>`;
    const parts = [['SÁNG SỚM', 0, 420], ['BUỔI SÁNG', 420, 720], ['BUỔI CHIỀU', 720, 1080], ['BUỔI TỐI', 1080, 1440]];
    parts.forEach(([p, f, t]) => {
      const L = dl.filter((a) => min(a.s) >= f && min(a.s) < t);
      if (!L.length) return;
      h += `<section class="ws-b__sec"><h3 class="ws-caps">${p} · ${L.length} CA</h3><div class="ws-agenda">`;
      L.forEach((a, j) => {
        const s = a.st[0] && staffOf(a.st[0]);
        const evt = color !== 'nv' ? '' : '';
        h += `<button type="button" class="ws-item ${cls(a, color)}"><span class="ws-item__tm num">${a.s}<small>${a.e}</small></span><span class="ws-item__main"><span class="ws-item__sv" ${j === 0 && p === 'SÁNG SỚM' ? (color === 'nv' ? 'data-f="ServicePackage.name — ContractLine.subjectName"' : `data-moi="${fld(color)} · tên sự kiện"`) : ''}>${kind(a, color)}${qty(a)} <span class="ui-tag ui-tag--ok">Đã xác nhận</span>${evt}</span><span class="ws-item__kh">${a.kh}</span><span class="ws-item__nc">${a.nc}</span></span><span class="ws-item__who">${s ? av(s.ini, s.c, 'sm') + `<span class="ws-item__wn">${s.name}</span>` : '<span class="ws-av-na ws-av-na--sm">?</span><span class="ws-item__wn">Chưa có thợ</span>'}</span></button>`;
      });
      h += `</div></section>`;
    });
    h += `</div>`;
    if (!phone) {
      h += `<aside class="ws-load"><h3>Thợ trong ngày</h3><p class="ws-load__sub">${WDL[DAYS.indexOf(day)]} ${+day.slice(8)}/11 · 04:00 – 19:00</p>`;
      STAFF.forEach((s) => {
        const L = dl.filter((a) => a.st.includes(s.id));
        const hrs = L.reduce((t, a) => t + (min(a.e) - min(a.s)) / 60, 0);
        h += `<div class="ws-load__row">${av(s.ini, s.c)}<div class="ws-load__body"><div class="ws-load__nm">${s.name}<span>${L.length} ca · ${String(Math.round(hrs * 100) / 100).replace('.', ',')} giờ</span></div><div class="ws-track">${L.map((a) => `<i class="ws-sw-${sw(a, color)}" style="left:${((min(a.s) - 240) / 900) * 100}%;width:${((min(a.e) - min(a.s)) / 900) * 100}%"></i>`).join('')}</div></div></div>`;
      });
      h += `<div class="ws-scale"><span style="left:0">4h</span><span style="left:26.6%">8h</span><span style="left:53.3%">12h</span><span style="left:80%">16h</span><span style="left:100%">19h</span></div><div class="ws-load__sum"><span>Tổng trong ngày</span><b>${dl.length} ca · ${dl.filter((a) => !a.st.length).length} ca chưa có thợ</b></div></aside>`;
    }
    return h + `</div>`;
  }

  // ---------- A ----------
  function colsA(color, day, phone) {
    const hourPx = phone ? 60 : 64;
    const from = 4, to = 19;
    const dl = AP.filter((a) => a.d === day);
    const cols = [...STAFF, null];
    const tmpl = `var(--ws-axis) ${STAFF.map(() => 'minmax(160px, 1fr)').join(' ')} minmax(150px, .8fr)`;
    let h = `<div class="ws-a"><div class="ws-a__in" style="--ws-hour:${hourPx}px;grid-template-columns:${tmpl}"><div class="ws-a__corner"></div>`;
    cols.forEach((s) => {
      const L = dl.filter((a) => (s ? a.st.includes(s.id) : !a.st.length));
      const hrs = L.reduce((t, a) => t + (min(a.e) - min(a.s)) / 60, 0);
      h += `<div class="ws-a__colh">${s ? av(s.ini, s.c) : '<span class="ws-av-na">?</span>'}<div class="ws-a__who"><span class="ws-a__nm">${s ? s.short : 'Chưa có thợ'}</span><span class="ws-a__meta">${L.length} ca${s ? ' · ' + String(Math.round(hrs * 100) / 100).replace('.', ',') + ' giờ' : ''}</span></div></div>`;
    });
    const H = (to - from) * hourPx;
    h += `<div class="ws-a__axis" style="height:${H}px">${Array.from({ length: to - from }, (_, i) => `<div>${String(from + i).padStart(2, '0')}:00</div>`).join('')}</div>`;
    cols.forEach((s) => {
      const L = dl.filter((a) => (s ? a.st.includes(s.id) : !a.st.length));
      h += `<div class="ws-a__col${s ? '' : ' is-na'}" style="height:${H}px">`;
      L.forEach((a) => {
        const top = ((min(a.s) - from * 60) / 60) * hourPx;
        const ht = Math.max(((min(a.e) - min(a.s)) / 60) * hourPx - 2, 34);
        h += `<button type="button" class="ws-ev ${cls(a, color)}" style="top:${top}px;height:${ht}px;left:4px;right:4px"><span class="ws-ev__body"><span class="ws-ev__tm num">${a.s}–${a.e}</span><span class="ws-ev__sv"><span class="ws-ev__kind">${kind(a, color)}</span>${a.q > 1 ? `<span class="ws-ev__qty">× ${a.q}</span>` : ''}</span><span class="ws-ev__kh">${a.kh}</span><span class="ws-ev__nc">${a.nc}</span></span></button>`;
      });
      h += `</div>`;
    });
    return h + `</div></div>`;
  }

  window.v5lich = function (el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const phone = window.innerWidth <= 640;
    const mode = el.dataset.mode || 'C';
    const color = el.dataset.color || 'nv';
    const day = el.dataset.day || '2026-11-22';
    const opts = { colorBy: el.dataset.colorby };
    let body;
    let list = AP;
    if (mode === 'C') body = phone ? gridCm(color, day) : gridC(color);
    else { list = AP.filter((a) => a.d === day); body = mode === 'B' ? listB(color, day, phone) : colsA(color, day, phone); }
    el.innerHTML = `<div class="ws-panel">${toolbar(mode, phone, opts)}${body}${phone && mode !== 'A' ? '' : legend(color, list)}</div>${phone && mode !== 'A' ? `<div class="ws-panel" style="margin-top:10px">${legend(color, list)}</div>` : ''}`;
  };
  window.v5render = function (sec) { sec.querySelectorAll('.v5-lich').forEach(window.v5lich); };
})();
