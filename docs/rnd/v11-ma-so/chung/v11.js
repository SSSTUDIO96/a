/* Bản mẫu R&D 11 — mã số học viên trong lớp. Dựa trên khung ../v8-chung/v8.js (V4.man, V4.mucLuc, V4.boot, V4.icon, V4.av).
   Mọi ô trên màn chỉ ra trường dữ liệu (data-f). Trường MỚI (chưa có trong database) ghi "đề xuất: Enrollment.seatCode". */
(function () {
  const { icon, av, vnd, tip } = window.V4;

  // Học viên lớp K12 theo THỨ TỰ GHI DANH (Enrollment.enrolledAt). Ánh Dương huỷ ghi danh 12/10 (đổi sang lớp K13).
  const HV = [
    { ten: 'Đặng Quỳnh Như', ghi: '05/10', hd: 'HĐ-0131', sdt: '0912 111 201', thu: 12000000, tong: 12000000 },
    { ten: 'Lê Thị Mai', ghi: '06/10', hd: 'HĐ-0133', sdt: '0903 228 415', thu: 6000000, tong: 12000000 },
    { ten: 'Nguyễn Ngọc Ánh Dương', ghi: '06/10', hd: 'HĐ-0134', sdt: '0977 450 118', thu: 3000000, tong: 12000000, huy: '12/10', lydo: 'Đổi sang lớp K13' },
    { ten: 'Phạm Quỳnh Hương', ghi: '08/10', hd: 'HĐ-0137', sdt: '0935 662 090', thu: 12000000, tong: 12000000 },
    { ten: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', ghi: '09/10', hd: 'HĐ-0138', sdt: '0918 307 552', thu: 6000000, tong: 12000000 },
    { ten: 'Hoàng Minh Anh', ghi: '11/10', hd: 'HĐ-0140', sdt: '0987 115 364', thu: 12000000, tong: 12000000 },
    { ten: 'Vũ Thu Trang', ghi: '14/10', hd: 'HĐ-0142', sdt: '0904 873 221', thu: 6000000, tong: 12000000 },
    { ten: 'Bùi Khánh Linh', ghi: '15/10', hd: 'HĐ-0143', sdt: '0946 220 718', thu: 3000000, tong: 12000000 },
    { ten: 'Trần Bảo Ngọc', ghi: '17/10', hd: 'HĐ-0145', sdt: '0961 504 337', thu: 12000000, tong: 12000000 },
    { ten: 'Đỗ Hải Yến', ghi: '19/10', hd: 'HĐ-0148', sdt: '0909 336 845', thu: 3000000, tong: 12000000 },
  ];
  const HV_SAU_CHOT = { ten: 'Lý Thanh Hà', ghi: '22/10', hd: 'HĐ-0151', sdt: '0913 640 207', thu: 3000000, tong: 12000000 };

  const maBox = (t, cls) => `<span class="ma${cls ? ' ' + cls : ''}" data-f="Enrollment.seatNo (trường mới)">${t}</span>`;
  const tien = (h) => `<span class="money">Đã thu ${vnd(h.thu)} / ${vnd(h.tong)}</span>`;
  const tagHd = (h) => (h.huy ? '<span class="tag huy">Huỷ ghi danh</span>' : '<span class="tag ok">Đã xác nhận</span>');

  // Một dòng học viên giống EnrollmentRow: ô mã · tên + (sđt · hợp đồng) · tiền + trạng thái.
  function dong(h, o) {
    o = o || {};
    const sub = o.sub || `${h.sdt} · ${h.hd} · ghi danh ${h.ghi}${h.huy ? ` · huỷ ${h.huy} · ${h.lydo}` : ''}`;
    const trai = o.trai || maBox(o.ma, o.maCls);
    return `<div class="enr-row${o.cls ? ' ' + o.cls : ''}">
      ${trai}
      <div class="who"><b data-f="Customer.fullName">${h.ten}</b><span class="sub" data-f="Customer.phone · Contract.code · Enrollment.enrolledAt">${sub}</span></div>
      <div class="rt">${tien(h)}${o.tag || tagHd(h)}</div>
      ${o.loi ? `<div class="err-line">${o.loi}</div>` : ''}
    </div>`;
  }

  // Trang khoá học phía sau hộp thoại (CourseDetail + ClassCard).
  function trangKhoa(si) {
    return `<div class="kc-head"><h1>Makeup chuyên nghiệp</h1><span class="tag">KH-0004</span><span class="sub">Nhiều lớp · 12.000.000 ₫ · 24 buổi</span></div>
    <div class="card"><div class="ch2"><h2>Học viên &amp; lịch học</h2></div><div class="cb" style="padding-top:14px">
    <div class="kc-class"><div class="t"><b>Lớp K12</b><span class="tag ok">Còn ${12 - si} chỗ</span></div>
      <div class="kc-who"><span>${icon('lich', 's')}02/11/2026 → 28/12/2026</span><span>${icon('clock', 's')}T3 · T5 · T7, 18:00–21:00</span><span>${av('Nguyễn Thu Hà', false, 'xs')}Nguyễn Thu Hà</span><span>${icon('pin', 's')}Cơ sở Cầu Giấy</span></div>
      <div class="bar"><i style="width:${(si / 12) * 100}%"></i></div>
      <div class="kc-act"><span class="c"><b class="num">${si}</b> đã ghi danh / tối đa <b class="num">12</b></span><button class="btn sm ghost">${icon('khach', 's')}Học viên</button><button class="btn sm">Sửa</button><button class="btn sm pri">Ghi danh</button></div>
    </div></div></div>`;
  }

  // Hộp thoại "Học viên lớp K12". Trên điện thoại: toàn màn hình (như courses.css .ui-dialog--sm.kc-dlg).
  function hopThoai(si, giua, chan) {
    return `${trangKhoa(si)}
    <div class="dlg-bg full"><div class="dlg hv560" role="dialog" aria-label="Học viên lớp K12">
      <div class="dh"><div style="flex:1;min-width:0"><span class="eyebrow">02/11/2026 → 28/12/2026 · ${si}/12 học viên</span><h2>Học viên lớp K12</h2></div><button class="btn icon ghost" aria-label="Đóng">${icon('x')}</button></div>
      <div class="db">${giua}</div>
      <footer>${chan || '<button class="btn">Đóng</button>'}</footer>
    </div></div>`;
  }

  // Thumbnail ô chọn mẫu: 10 mẫu mới (ảnh xuất thật R&D-10) + 11 mẫu cũ (ảnh nhỏ trong app public/mau/anh-nho).
  const MOI = ['Giấy dấu sáp', 'Panel viên thuốc', 'Tem răng cưa', 'Thư giấy vân', 'Bằng khen cổ điển', 'Tờ tiền xanh', 'Thảm Ba Tư', 'Giấy xé + washi', 'Thiệp gập ruy băng', 'Gương oval cổ điển'];
  const CU = ['Thư mời kem', 'Đen vàng khung tròn', 'Ngày khai giảng lớn', 'Ruy băng tên', 'Tạp chí tối giản', 'Xanh rêu khung lệch', 'Vé vào lớp', 'Chữ ký trên nền trắng', 'Thiệp vàng hồng khung tròn', 'Thư tay của giảng viên', 'Chữ ký mảnh nền đá'];
  const p2 = (i) => String(i).padStart(2, '0');
  const DS_MAU = [
    ...MOI.map((t, i) => ({ code: 'cm-' + p2(i + 1), ten: t, moi: true, img: `../anh-rnd10/cm-${p2(i + 1)}-doc.png` })),
    ...CU.map((t, i) => ({ code: 'shd-' + p2(i + 1), ten: t, moi: false, img: `../../../apps/web/public/mau/anh-nho/shd-${p2(i + 1)}.jpg` })),
  ];
  function luoiMau(on, chiMoi) {
    const ds = chiMoi ? DS_MAU : DS_MAU;
    return `<section class="card mgrid" aria-label="Chọn mẫu"><div class="scope"><button class="on">Hợp với hợp đồng này <span class="num">${ds.length}</span></button><button>Tất cả mẫu <span class="num">${ds.length}</span></button></div>
      <ul>${ds.map((m) => `<li><a class="thumb${m.code === on ? ' on' : ''}" href="#" title="${m.code} · ${m.ten}"><img src="${m.img}" alt="" loading="eager"><span class="code">${m.code}</span>${m.moi ? '<span class="moi">Mới</span>' : ''}</a></li>`).join('')}</ul></section>`;
  }

  // Màn Mẫu thiết kế → Chào mừng: lưới mẫu · xem trước (tệp vẽ thật ../v10-chao-mung/cm-NN.html?ma=…) · ô Nội dung.
  function studio(o) {
    const q = new URLSearchParams({ ten: o.ten, ma: o.ma, khoa: 'Makeup chuyên nghiệp', lop: 'K12', ngay: '02/11/2026' }).toString();
    const ten = DS_MAU.find((m) => m.code === o.mau).ten;
    return `<nav class="mtk-tabs" aria-label="Mẫu thiết kế"><a class="on" href="#">Chào mừng</a><a href="#">Feedback</a><a href="#">Lời chúc</a><a href="#">Thẻ đã tạo</a><a href="#">Câu chúc soạn sẵn</a></nav>
    <div class="studio">
      <div class="gcol">${luoiMau(o.mau)}</div>
      <div class="pcol"><section class="card prev" aria-label="Xem trước"><div class="mau-xem"><iframe src="../v10-chao-mung/${o.mau}.html?${q}" tabindex="-1" title="Xem trước mẫu ${o.mau}"></iframe></div>
        <div class="prev-bar"><span class="cap">${o.mau} · ${ten}</span><div class="seg sm"><button>Vuông</button><button class="on">Dọc 4:5</button></div></div></section></div>
      <div class="fcol"><section class="card"><div class="ch2"><h2>Nội dung</h2></div><div class="cb" style="padding-top:12px;display:flex;flex-direction:column;gap:10px">
        <div><div class="sb small" style="margin-bottom:4px">Loại hợp đồng</div><div class="seg sm"><button class="on">Khoá học</button><button class="dis" disabled>Dịch vụ</button></div></div>
        <div><div class="sb small" style="margin-bottom:4px">Hợp đồng</div><select class="ctl" data-f="Contract (COURSE)"><option>${o.hd} · ${o.ten}</option></select></div>
        <div class="auto" aria-label="Giá trị tự lấy từ hợp đồng">
          <div class="it ma-it"><span>Mã số trong lớp${o.ghiChuMa ? tip(o.ghiChuMa) : ''}</span><b class="num" data-f="Enrollment.seatNo (trường mới)">${o.maHien}</b></div>
          <div class="it"><span>Tên học viên</span><b data-f="Customer.fullName">${o.ten}</b></div>
          <div class="it"><span>Tên khoá</span><b data-f="CourseClass.course.name">Makeup chuyên nghiệp</b></div>
          <div class="it"><span>Tên lớp</span><b data-f="CourseClass.name">K12</b></div>
          <div class="it"><span>Ngày khai giảng</span><b data-f="CourseClass.startDate">02/11/2026</b></div>
          <div class="it"><span>Tên thương hiệu</span><b data-f="OrganizationProfile.brandName">Chiến Makeup Academy</b></div>
        </div>
        <button class="btn pri" style="width:100%">Tải ảnh PNG</button>
      </div></section></div>
    </div>`;
  }

  // Thu nhỏ iframe mẫu 1080×1350 vừa khung.
  function coXem() {
    document.querySelectorAll('.mau-xem').forEach((b) => { const w = b.clientWidth; if (w) b.style.setProperty('--k', w / 1080); });
  }
  window.addEventListener('resize', coXem);
  window.addEventListener('hashchange', () => setTimeout(coXem, 0));
  window.addEventListener('load', coXem);

  window.V11 = { HV, HV_SAU_CHOT, maBox, dong, hopThoai, studio, luoiMau, coXem, DS_MAU };
})();
