/* Bản mẫu R&D vòng 9 — phần dùng chung của 3 phương án "Mẫu in tùy chỉnh lưu lại".
   Xem trước = trang in THẬT ở ../v9-mau-in/in.html (cùng bộ dựng 5 mẫu), nhúng vào khung và thu nhỏ. */
(function () {
  const I = V4.icon;
  const MAU = {
    1: ['Cổ điển trang trọng', 'Quốc hiệu, chữ có chân, Điều 1–5'],
    2: ['Hiện đại tối giản', 'Chữ của app, màu nhấn'],
    3: ['Bảng kẻ đầy đủ', 'Mọi phần trong bảng'],
    4: ['Gọn một trang', 'Chữ nhỏ, điều khoản 2 cột'],
    5: ['Sang trọng viền & logo lớn', 'Khung viền kép, logo to'],
  };
  const anh = (n, loai = 'dich-vu', trang = 1) => `anh-rnd09/mau${n}-${loai}-dai-trang-${trang}.png`;
  const thumb = (n, loai) => `<img class="a4" src="${anh(n, loai)}" alt="Bố cục ${n} — ${MAU[n][0]}">`;

  // Lưới chọn 1 trong 5 bố cục (nguồn: MỚI PrintTemplate.layout 1..5)
  function boCuc(chon, loai = 'dich-vu') {
    return `<div class="bo-cuc" data-f="MỚI: PrintTemplate.layout (1..5)">${[1, 2, 3, 4, 5].map((n) => `<label class="${n === chon ? 'on' : ''}"><input type="radio" name="bc" ${n === chon ? 'checked' : ''}>${thumb(n, loai)}<span>${n}. ${MAU[n][0]}<small>${MAU[n][1]}</small></span></label>`).join('')}</div>`;
  }

  // Khung xem trước: nhúng in.html, thu nhỏ theo bề ngang khung. h = chiều cao nội dung (px ở tỉ lệ 1).
  function xt(q, cao = 560, h = 2300) {
    return `<div class="xt" style="height:${cao}px" data-q="${q}" data-h="${h}"><div class="in"><iframe title="Xem trước bản in" data-src="v9-mau-in/in.html?${q}&chup"></iframe></div></div>`;
  }
  function coXt() {
    document.querySelectorAll('.xt').forEach((box) => {
      const w = box.clientWidth - 2;
      if (!w) return;
      const W = 860, H = Number(box.dataset.h);
      const k = Math.min(1, w / W);
      const inner = box.querySelector('.in');
      const fr = box.querySelector('iframe');
      fr.style.width = W + 'px'; fr.style.height = H + 'px'; fr.style.transform = `scale(${k})`;
      inner.style.width = W * k + 'px'; inner.style.height = H * k + 'px';
    });
  }
  window.addEventListener('resize', coXt);
  window.addEventListener('hashchange', () => setTimeout(coXt, 0));
  // Gắn src SAU khi khung C dời các màn vào chỗ (dời iframe trong DOM làm nó tải lại và huỷ lần tải đầu).
  window.addEventListener('load', () => { document.querySelectorAll('.xt iframe[data-src]').forEach((f) => { f.src = f.dataset.src; }); coXt(); });

  // Nền: chi tiết hợp đồng dịch vụ HĐDV-000128 (rút gọn) — để hộp thoại In có ngữ cảnh.
  function nenHopDong() {
    const v = V4.vnd;
    return `<div class="ph"><h1>HĐDV-000128</h1><span class="tag ok">Đã xác nhận</span><span class="sub">Nguyễn Thu Trang · Thứ Bảy 12/12/2026</span><span class="sp"></span>
      <button class="btn">${I('hd', 's')}In hợp đồng</button><button class="btn pri">Thu tiền</button></div>
      <div class="mini-hd"><div class="card"><div class="ch2"><h2>Dịch vụ</h2></div><div class="cb">
        <div class="lr noav"><div class="tx"><span class="n">Cô dâu — Gói makeup cô dâu cao cấp</span><span class="d">05:00–07:30 · Tại nhà khách · Chiến, Lan</span></div><span class="p">${v(4952000)}</span></div>
        <div class="lr noav"><div class="tx"><span class="n">Phù dâu — Makeup tiệc × 2</span><span class="d">06:00–07:30 · Hà</span></div><span class="p">${v(2400000)}</span></div>
        <div class="lr noav"><div class="tx"><span class="n">Phụ phí ca sớm</span></div><span class="p">${v(300000)}</span></div></div></div>
        <div class="card"><div class="ch2"><h2>Tiền</h2></div><div class="cb"><p class="row"><span>Tổng</span><span class="sp"></span><b>${v(7152000)}</b></p><p class="row"><span>Đã thu</span><span class="sp"></span>${v(2000000)}</p></div></div></div>`;
  }

  // Hộp thoại In tại hợp đồng (dùng chung 3 phương án; khác ở danh sách mẫu và dòng ghi chú).
  function dlgIn({ mau = 2, ten = 'Hiện đại — Chiến Makeup', ds = [], canhBao = '', ghiChu = '' }) {
    const trang = [1, 2].map((t) => `<figure><img class="a4" src="${anh(mau, 'dich-vu', t)}" alt="Trang ${t}"><figcaption>Trang ${t}/2</figcaption></figure>`).join('');
    return `<div class="dlg-bg"><div class="dlg w" role="dialog" aria-label="In hợp đồng">
      <div class="dh"><div style="flex:1;min-width:0"><div class="fx">HĐDV-000128 · Nguyễn Thu Trang</div><h2>In hợp đồng</h2></div><button class="btn icon ghost" aria-label="Đóng">${I('x')}</button></div>
      <div class="db"><div class="in-lay">
        <div><div class="in-trang" data-f="TÍNH: dựng từ Contract + mẫu in đã chọn">${trang}</div></div>
        <div class="vstack" style="gap:12px">
          <div><div class="sb" style="margin-bottom:6px">Mẫu in</div><div class="lua">${ds.map((x) => `<label class="${x.on ? 'on' : ''}"><input type="radio" name="mi" ${x.on ? 'checked' : ''}><span><b>${x.t}</b><small>${x.d}</small></span></label>`).join('')}</div></div>
          ${canhBao}
          <div class="row"><span>Kèm phiếu thu đã nhận</span><span class="sp"></span><span class="sw on" data-f="Payment (RECEIPT chưa huỷ)"></span></div>
          <div class="row"><span>Ô ký nháy cuối mỗi trang</span><span class="sp"></span><span class="sw"></span></div>
          ${ghiChu}
        </div>
      </div></div>
      <footer><button class="btn m-hide">Đóng</button><button class="btn">${I('up', 's')}<span class="m-hide">Tải PDF</span><span class="p-only">PDF / Chia sẻ</span></button><button class="btn pri">${I('hd', 's')}In</button></footer>
    </div></div>`;
  }

  window.V9 = { MAU, anh, thumb, boCuc, xt, coXt, nenHopDong, dlgIn };
})();
