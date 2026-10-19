/* R&D 09 — BỘ DỰNG BẢN IN HỢP ĐỒNG (5 mẫu × 2 loại hợp đồng). Chỉ là bản mẫu R&D, không phải mã sản phẩm.
   Mở: in.html?mau=1..5&loai=dich-vu|khoa-hoc&ban=dai|ngan
   Tuỳ chỉnh (giống những gì "Mẫu in của studio" sẽ lưu):
     tat=khoi1,khoi2   tắt khối (xem KHOI bên dưới)
     tieude=...        đổi tiêu đề      dau=... / cuoi=...  đổi chữ mở đầu / kết thúc (có biến {Tên khách}…)
     tudo=1            chế độ văn bản tự do (phương án 3) — dùng VAN_BAN_TU_DO, có biến và thẻ khối [[Bảng dịch vụ]]…
     truong            hiện nhãn nguồn dữ liệu trên từng ô (tím = trường có sẵn, xanh TÍNH, nâu MỚI)
     chup              ẩn thanh công cụ (để chụp ảnh / in)
   Kiểm tự động: window.__kiem = { loi: [...], soDieu, ... } — tổng tiền cộng lại khớp, đủ điều khoản, không trùng. */
(function () {
  const Q = new URLSearchParams(location.search);
  const MAU = Math.min(5, Math.max(1, Number(Q.get('mau') || 1)));
  const LOAI = Q.get('loai') === 'khoa-hoc' ? 'khoa-hoc' : 'dich-vu';
  const BAN = Q.get('ban') === 'ngan' ? 'ngan' : 'dai';
  const TAT = new Set((Q.get('tat') || '').split(',').map((s) => s.trim()).filter(Boolean));
  const TUDO = Q.get('tudo') === '1';
  const S = window.MP_DATA.STUDIO;
  const C = window.MP_DATA.HOP_DONG[LOAI][BAN];
  const SV = C.kind === 'SERVICE';

  // Danh mục khối dùng chung cho cả 5 mẫu (phương án 1/2 bật–tắt, đổi thứ tự trên đúng danh sách này).
  const KHOI = {
    'quoc-hieu': 'Quốc hiệu – tiêu ngữ',
    'dau-trang': 'Đầu trang (logo, tên, liên hệ)',
    'tieu-de': 'Tiêu đề + số hợp đồng',
    'hai-ben': 'Thông tin hai bên',
    'giay-to': 'CCCD + địa chỉ khách',
    'chu-dau': 'Chữ mở đầu',
    'dich-vu': SV ? 'Bảng dịch vụ' : 'Bảng khoá học',
    'chi-tiet': SV ? 'Giờ, địa điểm' : 'Lịch học, giảng viên',
    'tho': 'Tên thợ',
    'tien': 'Tổng tiền',
    'bang-chu': 'Số tiền bằng chữ',
    'tien-do': 'Tiến độ thanh toán',
    'da-thu': 'Phiếu thu đã nhận',
    'chuyen-khoan': 'Tài khoản chuyển khoản',
    'dieu-khoan': 'Điều khoản',
    'noi-quy': 'Nội quy',
    'ghi-chu': 'Ghi chú',
    'chu-cuoi': 'Chữ kết thúc',
    'chu-ky': 'Chỗ ký',
    'ky-nhay': 'Ô ký nháy cuối trang',
    'so-trang': 'Số trang cuối trang',
  };
  // Mặc định mỗi mẫu tắt sẵn vài khối cho đúng tính cách mẫu.
  const MAC_DINH_TAT = { 1: [], 2: ['quoc-hieu', 'ky-nhay'], 3: ['quoc-hieu'], 4: ['quoc-hieu', 'ky-nhay', 'giay-to'], 5: ['quoc-hieu', 'ky-nhay'] };
  const BAT = Q.get('bat') ? new Set(Q.get('bat').split(',')) : new Set();
  const on = (k) => !TAT.has(k) && (BAT.has(k) || !MAC_DINH_TAT[MAU].includes(k));
  if (!S.bank) TAT.add('chuyen-khoan');

  // ---------- định dạng ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const vnd = (n) => `${Number(n).toLocaleString('vi-VN')} ₫`;
  const num = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const d2 = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const hm = (iso) => iso.slice(11, 16);
  const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const thu = (iso) => THU[new Date(iso.slice(0, 10) + 'T12:00:00').getDay()];
  const ngayDai = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `ngày ${d} tháng ${m} năm ${y}`; };
  const phut = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const ISO_THU = { 1: '2', 2: '3', 3: '4', 4: '5', 5: '6', 6: '7', 7: 'CN' };
  const thuHoc = (ws) => 'Thứ ' + ws.filter((w) => w < 7).map((w) => ISO_THU[w]).join(', ') + (ws.includes(7) ? ', CN' : '');
  const PTTT = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', CARD: 'Thẻ', OTHER: 'Khác' };
  const NOI = { STUDIO: 'Tại studio', CUSTOMER_HOME: 'Tại nhà khách', OTHER: 'Địa điểm khác' };

  // Đọc số tiền thành chữ (hợp đồng Việt Nam thường ghi "Bằng chữ: …"). Hàm MỚI — sản phẩm chưa có.
  function bangChu(n) {
    const so = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const ba = (x, full) => {
      const t = Math.floor(x / 100), c = Math.floor((x % 100) / 10), d = x % 10, out = [];
      if (full || t > 0) out.push(so[t], 'trăm');
      if (c === 0 && d > 0 && (full || t > 0)) out.push('linh');
      if (c === 1) out.push('mười');
      else if (c > 1) out.push(so[c], 'mươi');
      if (d > 0) out.push(d === 1 && c > 1 ? 'mốt' : d === 5 && c > 0 ? 'lăm' : d === 4 && c > 1 ? 'tư' : so[d]);
      return out.join(' ');
    };
    if (n === 0) return 'Không đồng';
    const units = ['', ' nghìn', ' triệu', ' tỷ'];
    const groups = [];
    let x = n;
    while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
    const parts = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i] === 0) continue;
      parts.push(ba(groups[i], i < groups.length - 1) + units[i]);
    }
    const s = parts.join(' ') + ' đồng';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // f(nguồn, nội dung) — gắn nhãn nguồn dữ liệu (hiện khi mở kèm ?truong).
  const f = (src, html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} data-f="${esc(src)}">${html}</${tag}>`;

  // ---------- số liệu tính ----------
  const roots = C.lines;
  const all = roots.flatMap((l) => [l, ...(l.addons || []), ...(l.travel ? [l.travel] : [])]);
  const subtotal = all.reduce((s, l) => s + l.lineTotal, 0);
  const daThu = C.payments.reduce((s, p) => s + p.amount, 0);
  const conLai = C.total - daThu;
  // Trạng thái từng đợt: phân bổ tiền đã thu theo thứ tự đợt (TÍNH — phiếu thu chưa gắn với đợt).
  let pool = daThu;
  const dot = C.installments.map((i) => { const paid = Math.min(pool, i.amount); pool -= paid; return { ...i, paid }; });
  const ngayLap = C.confirmedAt || C.createdAt;
  const tenLoai = SV ? 'dịch vụ trang điểm' : 'đào tạo';
  const course = !SV ? roots.find((l) => l.kind === 'COURSE') : null;

  const VARS = {
    'Tên studio': S.brandName, 'Địa chỉ studio': S.address, 'SĐT studio': S.phone, 'Người đại diện': S.representative,
    'Tên khách': C.customer.fullName, 'SĐT khách': C.customer.phone, 'Mã hợp đồng': C.code, 'Ngày lập': d2(ngayLap),
    'Ngày sự kiện': C.eventDate ? `${thu(C.eventDate)} ${d2(C.eventDate)}` : '—', 'Tổng tiền': vnd(C.total),
    'Tổng tiền bằng chữ': bangChu(C.total), 'Tiền cọc': vnd(C.depositRequired), 'Đã thu': vnd(daThu), 'Còn lại': vnd(conLai),
    'Tên khoá': course ? course.name : '—', 'Tên lớp': course ? course.klass.name : '—',
    'Ngày khai giảng': course ? d2(course.klass.startDate) : '—',
  };
  const thayBien = (s) => esc(s).replace(/\{([^{}]+)\}/g, (m, k) => (k in VARS ? f(`BIẾN {${k}}`, esc(VARS[k]), 'span', 'bien') : m));

  const TIEU_DE = Q.get('tieude') || (SV ? 'HỢP ĐỒNG DỊCH VỤ TRANG ĐIỂM' : 'HỢP ĐỒNG ĐÀO TẠO');
  const CHU_DAU = Q.get('dau') || (SV
    ? 'Hai bên thoả thuận ký hợp đồng dịch vụ trang điểm cho sự kiện ngày {Ngày sự kiện} với các nội dung sau:'
    : 'Hai bên thoả thuận ký hợp đồng đào tạo khoá {Tên khoá}, lớp {Tên lớp}, khai giảng ngày {Ngày khai giảng} với các nội dung sau:');
  const CHU_CUOI = Q.get('cuoi') || 'Hợp đồng có hiệu lực từ ngày ký, lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.';

  // ---------- mảnh dữ liệu dùng chung ----------
  const logo = (cls) => f('OrganizationProfile.logoFileId', `<img class="${cls}" src="${S.logo}" alt="Logo ${esc(S.brandName)}">`);
  const brand = f('OrganizationProfile.brandName', esc(S.brandName));
  const lienHe = [
    f('OrganizationProfile.address', esc(S.address)),
    f('OrganizationProfile.phone', 'ĐT: ' + esc(S.phone)),
    f('OrganizationProfile.email', esc(S.email)),
    f('OrganizationProfile.website', esc(S.website)),
  ];
  const soHd = f('Contract.code', esc(C.code));
  const nhap = C.status === 'DRAFT' ? ' <span class="nhap" data-f="Contract.status = DRAFT">BẢN NHÁP</span>' : '';
  const ngayLapTxt = f(C.confirmedAt ? 'Contract.confirmedAt' : 'Contract.createdAt (chưa xác nhận)', 'Ngày ' + ngayDai(ngayLap).slice(5));

  function benA() {
    return [
      ['Tên', brand],
      ['Địa chỉ', lienHe[0]],
      ['Điện thoại', f('OrganizationProfile.phone', esc(S.phone))],
      ['Đại diện', f('MỚI: OrganizationProfile.representative + representativeTitle', `${esc(S.representative)} — ${esc(S.representativeTitle)}`)],
    ];
  }
  function benB() {
    const c = C.customer;
    const rows = [
      [SV ? 'Khách hàng' : 'Học viên', f('Customer.fullName', esc(c.fullName))],
      ['Điện thoại', f('Customer.phone', esc(c.phone))],
    ];
    if (c.email) rows.push(['Email', f('Customer.email', esc(c.email))]);
    if (on('giay-to')) {
      rows.push(['Địa chỉ', f('MỚI: Customer.address', c.address ? esc(c.address) : '<span class="cho-dien">………………………………</span>')]);
      rows.push(['CCCD', f('MỚI: Customer.idNumber', c.idNumber ? esc(c.idNumber) : '<span class="cho-dien">………………………</span>')]);
    }
    return rows;
  }

  // Dòng hợp đồng → các hàng in (dùng chung cho mọi mẫu). Mỗi hàng: {cap, ten, chiTiet[], sl, dg, giam, tt, nguon}
  function hangDichVu() {
    const out = [];
    let stt = 0;
    for (const l of roots) {
      stt += 1;
      const ct = [];
      if (l.klass && on('chi-tiet')) {
        const k = l.klass;
        ct.push(f('CourseClass.name', `Lớp ${esc(k.name)}`) + ' · ' + f('CourseClass.startDate/endDate', `${d2(k.startDate)} – ${d2(k.endDate)}`));
        ct.push(f('CourseClass.weekdays + startMinute/endMinute', `${thuHoc(k.weekdays)} · ${phut(k.startMinute)}–${phut(k.endMinute)}`) + ' · ' + f('Course.sessionCount', `${k.sessionCount} buổi`));
        ct.push(f('CourseClass.instructorMembershipId → StaffProfile.displayName', 'Giảng viên: ' + esc(k.instructor)) + ' · ' + f('CourseClass.studioLocationId → StudioLocation.address', 'Tại ' + esc(k.location)));
      }
      if (l.start && on('chi-tiet')) {
        ct.push(f('ContractLine.scheduledStart/scheduledEnd', `${hm(l.start)}–${hm(l.end)} · ${thu(l.start)} ${d2(l.start)}`));
        ct.push(f('ContractLine.locationType + address', `${NOI[l.locationType]}: ${esc(l.address)}`));
      }
      if (l.staff.length && on('tho')) {
        const chinh = l.staff.filter((s) => s.role === 'PRIMARY').map((s) => s.name).join(', ');
        const phu = l.staff.filter((s) => s.role === 'ASSIST').map((s) => s.name).join(', ');
        ct.push(f('ContractLineStaff.role + StaffProfile.displayName', `Thợ chính: ${esc(chinh)}${phu ? ` · Thợ phụ: ${esc(phu)}` : ''}`));
      }
      if (l.note) ct.push(f('ContractLine.note', esc(l.note)));
      const ten = l.subjectName
        ? f('ContractLine.subjectName', esc(l.subjectName)) + ' — ' + f('ContractLine.name', esc(l.name))
        : f('ContractLine.name', esc(l.name));
      out.push({ cap: 0, stt, ten, chiTiet: ct, sl: l.quantity, dg: l.unitPrice, giam: l.lineDiscount, tt: l.lineTotal });
      for (const a of l.addons || []) {
        out.push({ cap: 1, stt: '', ten: '+ ' + f('ContractLine.name (ADDON)', esc(a.name)), chiTiet: [], sl: a.quantity, dg: a.unitPrice, giam: a.lineDiscount, tt: a.lineTotal });
      }
      if (l.travel) {
        const t = l.travel, b = t.travelBreakdown;
        const cong = `${num(t.distanceKm)} km một chiều, gói miễn ${num(b.includedKm)} km → vượt ${num(b.excessKm)} km${b.roundTrip ? ' × 2 chiều' : ''} = ${num(b.chargedKm)} km × ${vnd(t.perKmAmount)}`;
        out.push({ cap: 1, stt: '', ten: '+ ' + f('ContractLine.name (TRAVEL)', esc(t.name)), chiTiet: on('chi-tiet') ? [f('travelBreakdown (present.ts) + distanceKm + perKmAmount', cong)] : [], sl: 1, dg: t.unitPrice, giam: 0, tt: t.lineTotal });
      }
    }
    return out;
  }
  const HANG = hangDichVu();

  const tongRows = () => {
    const r = [['Tạm tính', f('Contract.subtotal', vnd(C.subtotal))]];
    if (C.discount > 0) r.push(['Giảm giá', f('Contract.discount', '− ' + vnd(C.discount))]);
    r.push(['Tổng cộng', f('Contract.total', vnd(C.total)), 'tong']);
    return r;
  };
  const chu = on('bang-chu') ? f('TÍNH: đọc Contract.total thành chữ (hàm mới)', esc(bangChu(C.total)), 'span', 'bang-chu') : '';
  const coc = f('Contract.depositRequired', vnd(C.depositRequired));

  const dotTrangThai = (i) => (i.paid >= i.amount ? 'Đã thu' : i.paid > 0 ? `Đã thu ${vnd(i.paid)}` : 'Chưa thu');
  const nguonDot = 'TÍNH: Σ Payment (RECEIPT chưa huỷ) phân theo thứ tự đợt';

  const danhSach = (items, cls = 'dk') => `<ol class="${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  const nguonDk = C.status === 'DRAFT' ? 'ContractText.body (mẫu đang chọn — chưa chụp)' : 'Contract.terms (bản chụp lúc xác nhận)';
  const nguonNq = C.status === 'DRAFT' ? 'ContractText.body (RULES, chưa chụp)' : 'Contract.rules (bản chụp lúc xác nhận)';
  const dkNguon = () => f('Contract.termsTemplateId + termsTemplateVersion → ContractText.name', `${esc(C.terms.name)} · bản v${C.terms.version}`, 'span', 'nguon-mau');
  const nqNguon = () => f('Contract.rulesTemplateId + rulesTemplateVersion', `${esc(C.rules.name)} · bản v${C.rules.version}`, 'span', 'nguon-mau');

  const nganHang = () => {
    const b = S.bank;
    return {
      ten: f('MỚI: OrganizationProfile.bankName', esc(b.bankName)),
      so: f('MỚI: OrganizationProfile.bankAccountNumber', esc(b.accountNumber)),
      chu: f('MỚI: OrganizationProfile.bankAccountName', esc(b.accountName)),
      nd: f('TÍNH: Contract.code + Customer.fullName', `${esc(C.code)} ${esc(C.customer.fullName)}`),
      qr: f('TÍNH: mã VietQR sinh từ số TK + số tiền + nội dung', '<span class="qr" aria-label="Chỗ mã QR chuyển khoản"><i></i><b>QR</b></span>'),
    };
  };

  const kyTen = () => ({
    a: f('MỚI: OrganizationProfile.representative', esc(S.representative)),
    b: f('Customer.fullName', esc(C.customer.fullName)),
    nhanA: SV ? 'BÊN A — STUDIO' : 'BÊN A — TRUNG TÂM',
    nhanB: SV ? 'BÊN B — KHÁCH HÀNG' : 'BÊN B — HỌC VIÊN',
  });

  // ---------- 5 MẪU ----------
  const sec = (k, html) => (on(k) ? html : '');
  const tblDot = (cls) => `<table class="${cls}"><thead><tr><th>Đợt</th><th>Hạn</th><th class="r">Số tiền</th><th>Tình trạng</th></tr></thead><tbody>${dot.map((i, n) => `<tr><td>${n + 1}. ${f('PaymentInstallment.name', esc(i.name))}${i.isDeposit ? ' <small>(cọc)</small>' : ''}</td><td>${f('PaymentInstallment.dueDate', d2(i.dueDate))}</td><td class="r">${f('PaymentInstallment.amount', vnd(i.amount))}</td><td>${f(nguonDot, dotTrangThai(i))}</td></tr>`).join('')}</tbody></table>`;
  const tblThu = (cls) => (C.payments.length
    ? `<table class="${cls}"><thead><tr><th>Phiếu thu</th><th>Ngày</th><th>Hình thức</th><th class="r">Số tiền</th></tr></thead><tbody>${C.payments.map((p) => `<tr><td>${f('Payment.code', esc(p.code))}</td><td>${f('Payment.receivedAt', d2(p.receivedAt))}</td><td>${f('Payment.method', PTTT[p.method])}</td><td class="r">${f('Payment.amount', vnd(p.amount))}</td></tr>`).join('')}</tbody></table>`
    : `<p class="mo">${f('Payment (chưa có phiếu thu)', 'Chưa nhận khoản thanh toán nào.')}</p>`);
  const daThuDong = () => `<div class="dong-tien"><span>Đã thu</span>${f('TÍNH: Σ Payment.amount (RECEIPT chưa huỷ)', vnd(daThu))}</div><div class="dong-tien dam"><span>Còn phải thanh toán</span>${f('TÍNH: Contract.total − đã thu', vnd(conLai))}</div>`;

  // Mẫu 1 — CỔ ĐIỂN TRANG TRỌNG: quốc hiệu, chữ có chân, "Điều 1, 2…", ký nháy cuối trang.
  function mau1() {
    let dieu = 0;
    const D = (t) => `<h2 class="dieu">Điều ${++dieu}. ${t}</h2>`;
    const k = kyTen();
    const nh = on('chuyen-khoan') ? nganHang() : null;
    const svc = `<table class="bang"><thead><tr><th class="c">STT</th><th>${SV ? 'Dịch vụ' : 'Khoá học / hạng mục'}</th><th class="c">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead><tbody>${HANG.map((h) => `<tr class="cap${h.cap}"><td class="c">${h.stt}</td><td>${h.ten}${h.chiTiet.length ? `<div class="ct">${h.chiTiet.join('<br>')}</div>` : ''}</td><td class="c">${h.sl}</td><td class="r">${vnd(h.dg)}</td><td class="r">${f('ContractLine.lineTotal', vnd(h.tt))}</td></tr>`).join('')}</tbody></table>`;
    return `
      ${sec('quoc-hieu', `<div class="qh"><b>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><span>Độc lập – Tự do – Hạnh phúc</span><i></i></div>`)}
      ${sec('dau-trang', `<div class="dt">${logo('lg')}<div><b>${brand}</b><small>${lienHe.slice(0, 2).join(' · ')}</small></div></div>`)}
      ${sec('tieu-de', `<h1 class="td">${esc(TIEU_DE)}</h1><p class="so">Số: ${soHd}${nhap}</p>`)}
      <p class="mo">Hôm nay, ${ngayLapTxt.replace('Ngày ', '')}, tại ${f('OrganizationProfile.address', esc(S.address))}, chúng tôi gồm:</p>
      ${sec('hai-ben', `<div class="ben"><h3>BÊN A (Bên ${SV ? 'cung cấp dịch vụ' : 'đào tạo'}): ${brand}</h3><dl>${benA().slice(1).map(([a, b]) => `<dt>${a}:</dt><dd>${b}</dd>`).join('')}</dl></div>
        <div class="ben"><h3>BÊN B (${SV ? 'Khách hàng' : 'Học viên'}): ${f('Customer.fullName', esc(C.customer.fullName).toUpperCase())}</h3><dl>${benB().slice(1).map(([a, b]) => `<dt>${a}:</dt><dd>${b}</dd>`).join('')}</dl></div>`)}
      ${sec('chu-dau', `<p class="mo">${thayBien(CHU_DAU)}</p>`)}
      ${sec('dich-vu', D(SV ? 'Nội dung dịch vụ' : 'Nội dung đào tạo') + svc)}
      ${sec('tien', D('Giá trị hợp đồng và thanh toán') + `<table class="tong">${tongRows().map(([a, b, c]) => `<tr class="${c || ''}"><td>${a}</td><td class="r">${b}</td></tr>`).join('')}</table>${chu ? `<p class="bc">Bằng chữ: ${chu}.</p>` : ''}<p>Tiền cọc phải thu: ${coc}.</p>`)}
      ${sec('tien-do', `<h3 class="tieu">Tiến độ thanh toán</h3>` + tblDot('bang nho'))}
      ${sec('da-thu', `<h3 class="tieu">Các khoản đã thanh toán</h3>` + tblThu('bang nho') + daThuDong())}
      ${nh ? `<p class="ck">Chuyển khoản: ${nh.ten} · Số TK ${nh.so} · Chủ TK ${nh.chu} · Nội dung: ${nh.nd}</p>` : ''}
      ${sec('dieu-khoan', D('Điều khoản') + `<p class="nguon">${dkNguon()}</p>` + f(nguonDk, danhSach(C.terms.items), 'div'))}
      ${C.rules ? sec('noi-quy', D('Nội quy lớp học') + `<p class="nguon">${nqNguon()}</p>` + f(nguonNq, danhSach(C.rules.items), 'div')) : ''}
      ${C.notes ? sec('ghi-chu', D('Thoả thuận khác') + `<p>${f('Contract.notes', esc(C.notes))}</p>`) : ''}
      ${sec('chu-cuoi', D('Hiệu lực hợp đồng') + `<p>${thayBien(CHU_CUOI)}</p>`)}
      ${sec('chu-ky', `<div class="ky"><div><b>ĐẠI DIỆN BÊN A</b><i>(Ký, ghi rõ họ tên)</i><span>${k.a}</span></div><div><b>BÊN B</b><i>(Ký, ghi rõ họ tên)</i><span>${k.b}</span></div></div>`)}`;
  }

  // Mẫu 2 — HIỆN ĐẠI TỐI GIẢN: chữ không chân, nhiều khoảng trắng, danh sách thay cho bảng kẻ, khung tổng bên phải.
  function mau2() {
    const k = kyTen();
    const nh = on('chuyen-khoan') ? nganHang() : null;
    const meta = [['Số hợp đồng', soHd + nhap], ['Ngày lập', ngayLapTxt.replace('Ngày ', '').replace(/ tháng /, '/').replace(/ năm /, '/')]];
    if (C.eventDate) meta.push(['Ngày sự kiện', f('Contract.eventDate', `${thu(C.eventDate)}, ${d2(C.eventDate)}`)]);
    if (course) meta.push(['Khai giảng', f('CourseClass.startDate', d2(course.klass.startDate))]);
    return `
      ${sec('dau-trang', `<header class="dt">${logo('lg')}<div class="ten"><b>${brand}</b><small>${f('OrganizationProfile.tagline', esc(S.tagline))}</small></div><div class="lh">${lienHe.join('<br>')}</div></header>`)}
      ${sec('tieu-de', `<p class="eb">${brand}</p><h1 class="td">${esc(TIEU_DE.charAt(0) + TIEU_DE.slice(1).toLowerCase())}</h1><dl class="meta">${meta.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`)}
      ${sec('hai-ben', `<div class="ben2"><section><h3>${SV ? 'Studio (Bên A)' : 'Trung tâm (Bên A)'}</h3>${benA().map(([a, b]) => `<p><span>${a}</span>${b}</p>`).join('')}</section><section><h3>${SV ? 'Khách hàng (Bên B)' : 'Học viên (Bên B)'}</h3>${benB().map(([a, b]) => `<p><span>${a}</span>${b}</p>`).join('')}</section></div>`)}
      ${sec('chu-dau', `<p class="mo">${thayBien(CHU_DAU)}</p>`)}
      ${sec('dich-vu', `<h2 class="h">${SV ? 'Dịch vụ' : 'Khoá học'}</h2><ul class="ds">${HANG.map((h) => `<li class="cap${h.cap}"><div class="t"><b>${h.ten}</b>${h.chiTiet.length ? `<small>${h.chiTiet.join('<br>')}</small>` : ''}</div><div class="sl">${h.sl > 1 || h.cap === 0 ? `${h.sl} × ${vnd(h.dg)}` : ''}</div><div class="r">${f('ContractLine.lineTotal', vnd(h.tt))}</div></li>`).join('')}</ul>`)}
      ${sec('tien', `<div class="tong"><div class="bc">${chu ? `<span>Bằng chữ</span>${chu}` : ''}</div><table>${tongRows().map(([a, b, c]) => `<tr class="${c || ''}"><td>${a}</td><td class="r">${b}</td></tr>`).join('')}<tr><td>Cọc phải thu</td><td class="r">${coc}</td></tr></table></div>`)}
      <div class="hai-cot">
        ${sec('tien-do', `<section><h2 class="h">Tiến độ thanh toán</h2><ol class="moc">${dot.map((i) => `<li class="${i.paid >= i.amount ? 'xong' : ''}"><b>${f('PaymentInstallment.name', esc(i.name))}</b><span>${f('PaymentInstallment.dueDate', 'Hạn ' + d2(i.dueDate))} · ${f(nguonDot, dotTrangThai(i))}</span><em>${f('PaymentInstallment.amount', vnd(i.amount))}</em></li>`).join('')}</ol></section>`)}
        ${sec('da-thu', `<section><h2 class="h">Đã thanh toán</h2>${C.payments.length ? `<ul class="thu">${C.payments.map((p) => `<li><span>${f('Payment.code', esc(p.code))} · ${f('Payment.receivedAt', d2(p.receivedAt))} · ${f('Payment.method', PTTT[p.method])}</span><b>${f('Payment.amount', vnd(p.amount))}</b></li>`).join('')}</ul>` : `<p class="mo">Chưa nhận khoản thanh toán nào.</p>`}${daThuDong()}</section>`)}
      </div>
      ${nh ? `<div class="ck">${nh.qr}<div><h2 class="h">Chuyển khoản</h2><p>${nh.ten}</p><p>Số tài khoản <b>${nh.so}</b> · ${nh.chu}</p><p>Nội dung: <b>${nh.nd}</b></p></div></div>` : ''}
      ${sec('dieu-khoan', `<h2 class="h">Điều khoản <small>${dkNguon()}</small></h2>` + f(nguonDk, danhSach(C.terms.items), 'div'))}
      ${C.rules ? sec('noi-quy', `<h2 class="h">Nội quy lớp học <small>${nqNguon()}</small></h2>` + f(nguonNq, danhSach(C.rules.items, 'dk nq'), 'div')) : ''}
      ${C.notes ? sec('ghi-chu', `<h2 class="h">Ghi chú</h2><p>${f('Contract.notes', esc(C.notes))}</p>`) : ''}
      ${sec('chu-cuoi', `<p class="cuoi">${thayBien(CHU_CUOI)}</p>`)}
      ${sec('chu-ky', `<div class="ky"><div><small>${k.nhanA}</small><span></span><b>${k.a}</b></div><div><small>${k.nhanB}</small><span></span><b>${k.b}</b></div></div>`)}`;
  }

  // Mẫu 3 — BẢNG KẺ ĐẦY ĐỦ: mọi thứ trong bảng có kẻ, nhiều cột, đầu bảng lặp lại khi sang trang.
  function mau3() {
    const k = kyTen();
    const nh = on('chuyen-khoan') ? nganHang() : null;
    const cotSv = SV
      ? `<th class="c">STT</th><th>Hạng mục</th><th>Thời gian · địa điểm · thợ</th><th class="c">SL</th><th class="r">Đơn giá</th><th class="r">Giảm</th><th class="r">Thành tiền</th>`
      : `<th class="c">STT</th><th>Hạng mục</th><th>Lớp · lịch học · giảng viên</th><th class="c">SL</th><th class="r">Đơn giá</th><th class="r">Giảm</th><th class="r">Thành tiền</th>`;
    const tong = tongRows();
    return `
      ${sec('dau-trang', `<table class="khung dt"><tr><td class="lo">${logo('lg')}</td><td><b>${brand}</b><br>${lienHe.join('<br>')}</td><td class="so-o"><small>SỐ HỢP ĐỒNG</small><b>${soHd}</b>${nhap}<small>${ngayLapTxt}</small></td></tr></table>`)}
      ${sec('quoc-hieu', `<div class="qh"><b>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><span>Độc lập – Tự do – Hạnh phúc</span></div>`)}
      ${sec('tieu-de', `<h1 class="td">${esc(TIEU_DE)}</h1>`)}
      ${sec('hai-ben', `<table class="khung ben"><thead><tr><th colspan="2">BÊN A — ${SV ? 'STUDIO' : 'TRUNG TÂM'}</th><th colspan="2">BÊN B — ${SV ? 'KHÁCH HÀNG' : 'HỌC VIÊN'}</th></tr></thead><tbody>${(() => { const a = benA(), b = benB(), n = Math.max(a.length, b.length); let h = ''; for (let i = 0; i < n; i++) h += `<tr><td class="nh">${a[i] ? a[i][0] : ''}</td><td>${a[i] ? a[i][1] : ''}</td><td class="nh">${b[i] ? b[i][0] : ''}</td><td>${b[i] ? b[i][1] : ''}</td></tr>`; return h; })()}</tbody></table>`)}
      ${sec('chu-dau', `<p class="mo">${thayBien(CHU_DAU)}</p>`)}
      ${sec('dich-vu', `<h2 class="h">I. ${SV ? 'BẢNG DỊCH VỤ' : 'BẢNG KHOÁ HỌC'}</h2><table class="khung sv"><thead><tr>${cotSv}</tr></thead><tbody>${HANG.map((h) => `<tr class="cap${h.cap}"><td class="c">${h.stt}</td><td>${h.ten}</td><td class="ct">${h.chiTiet.join('<br>') || '—'}</td><td class="c">${h.sl}</td><td class="r">${vnd(h.dg)}</td><td class="r">${h.giam ? vnd(h.giam) : '—'}</td><td class="r">${f('ContractLine.lineTotal', vnd(h.tt))}</td></tr>`).join('')}</tbody>
        ${on('tien') ? `<tfoot>${tong.map(([a, b, c]) => `<tr class="${c || ''}"><td colspan="6" class="r">${a}</td><td class="r">${b}</td></tr>`).join('')}${chu ? `<tr><td colspan="7" class="bc">Bằng chữ: ${chu}</td></tr>` : ''}<tr><td colspan="6" class="r">Tiền cọc phải thu</td><td class="r">${coc}</td></tr></tfoot>` : ''}</table>`)}
      ${sec('tien-do', `<h2 class="h">II. TIẾN ĐỘ THANH TOÁN</h2><table class="khung"><thead><tr><th class="c">STT</th><th>Đợt</th><th>Hạn thanh toán</th><th class="r">Số tiền</th><th class="r">Đã thu</th><th>Tình trạng</th></tr></thead><tbody>${dot.map((i, n) => `<tr><td class="c">${n + 1}</td><td>${f('PaymentInstallment.name', esc(i.name))}${i.isDeposit ? ' (cọc)' : ''}</td><td>${f('PaymentInstallment.dueDate', d2(i.dueDate))}</td><td class="r">${f('PaymentInstallment.amount', vnd(i.amount))}</td><td class="r">${f(nguonDot, i.paid ? vnd(i.paid) : '—')}</td><td>${f(nguonDot, dotTrangThai(i).replace(/^Đã thu .*/, 'Thu một phần'))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3" class="r">Cộng</td><td class="r">${f('TÍNH: Σ PaymentInstallment.amount', vnd(dot.reduce((s, i) => s + i.amount, 0)))}</td><td class="r">${f('TÍNH: Σ Payment.amount', vnd(daThu))}</td><td></td></tr></tfoot></table>`)}
      ${sec('da-thu', `<h2 class="h">III. PHIẾU THU ĐÃ NHẬN</h2>${C.payments.length ? `<table class="khung"><thead><tr><th>Số phiếu</th><th>Ngày thu</th><th>Hình thức</th><th class="r">Số tiền</th></tr></thead><tbody>${C.payments.map((p) => `<tr><td>${f('Payment.code', esc(p.code))}</td><td>${f('Payment.receivedAt', d2(p.receivedAt))}</td><td>${f('Payment.method', PTTT[p.method])}</td><td class="r">${f('Payment.amount', vnd(p.amount))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3" class="r">Còn phải thanh toán</td><td class="r">${f('TÍNH: Contract.total − đã thu', vnd(conLai))}</td></tr></tfoot></table>` : `<table class="khung"><tbody><tr><td>Chưa nhận khoản thanh toán nào. Còn phải thanh toán: <b>${f('TÍNH: Contract.total − đã thu', vnd(conLai))}</b></td></tr></tbody></table>`}`)}
      ${nh ? `<table class="khung ck"><tbody><tr><td class="nh">Ngân hàng</td><td>${nh.ten}</td><td rowspan="4" class="qr-o">${nh.qr}</td></tr><tr><td class="nh">Số tài khoản</td><td><b>${nh.so}</b></td></tr><tr><td class="nh">Chủ tài khoản</td><td>${nh.chu}</td></tr><tr><td class="nh">Nội dung CK</td><td>${nh.nd}</td></tr></tbody></table>` : ''}
      ${sec('dieu-khoan', `<h2 class="h">IV. ĐIỀU KHOẢN <small>(${dkNguon()})</small></h2>` + f(nguonDk, `<table class="khung dkb"><thead><tr><th class="c">Điều</th><th>Nội dung</th></tr></thead><tbody>${C.terms.items.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x)}</td></tr>`).join('')}</tbody></table>`, 'div'))}
      ${C.rules ? sec('noi-quy', `<h2 class="h">V. NỘI QUY LỚP HỌC <small>(${nqNguon()})</small></h2>` + f(nguonNq, `<table class="khung dkb"><thead><tr><th class="c">STT</th><th>Nội dung</th></tr></thead><tbody>${C.rules.items.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x)}</td></tr>`).join('')}</tbody></table>`, 'div')) : ''}
      ${C.notes ? sec('ghi-chu', `<table class="khung"><tbody><tr><td class="nh">Ghi chú</td><td>${f('Contract.notes', esc(C.notes))}</td></tr></tbody></table>`) : ''}
      ${sec('chu-cuoi', `<p class="cuoi">${thayBien(CHU_CUOI)}</p>`)}
      ${sec('chu-ky', `<table class="khung ky"><thead><tr><th>${k.nhanA}</th><th>${k.nhanB}</th></tr></thead><tbody><tr><td><i>(Ký, ghi rõ họ tên)</i><span></span>${k.a}</td><td><i>(Ký, ghi rõ họ tên)</i><span></span>${k.b}</td></tr></tbody></table>`)}`;
  }

  // Mẫu 4 — GỌN MỘT TRANG: chữ nhỏ, hai bên chung một hàng, điều khoản chia 2 cột.
  function mau4() {
    const k = kyTen();
    const nh = on('chuyen-khoan') ? nganHang() : null;
    const tong = tongRows();
    return `
      <header class="dt">${sec('dau-trang', `${logo('lg')}<div class="ten"><b>${brand}</b><small>${lienHe.slice(0, 2).join(' · ')}</small></div>`)}${sec('tieu-de', `<div class="tdo"><h1 class="td">${esc(TIEU_DE)}</h1><small>Số ${soHd}${nhap} · ${ngayLapTxt}</small></div>`)}</header>
      ${sec('hai-ben', `<div class="ben"><p><b>Bên A:</b> ${brand} — ${f('MỚI: OrganizationProfile.representative', esc(S.representative))} · ${f('OrganizationProfile.phone', esc(S.phone))}</p><p><b>Bên B:</b> ${benB().map(([a, b], i) => (i === 0 ? b : `${a.toLowerCase()} ${b}`)).join(' · ')}</p></div>`)}
      ${sec('chu-dau', `<p class="mo">${thayBien(CHU_DAU)}</p>`)}
      ${sec('dich-vu', `<table class="sv"><thead><tr><th>${SV ? 'Dịch vụ' : 'Khoá học'}</th><th class="c">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead><tbody>${HANG.map((h) => `<tr class="cap${h.cap}"><td>${h.ten}${h.chiTiet.length ? ` <span class="ct">— ${h.chiTiet.join(' · ')}</span>` : ''}</td><td class="c">${h.sl}</td><td class="r">${vnd(h.dg)}</td><td class="r">${f('ContractLine.lineTotal', vnd(h.tt))}</td></tr>`).join('')}</tbody></table>`)}
      <div class="hang-tien">
        ${sec('tien', `<div class="tong">${tong.map(([a, b, c]) => `<span class="${c || ''}">${a} <b>${b}</b></span>`).join('')}<span>Cọc <b>${coc}</b></span>${chu ? `<em>(${chu})</em>` : ''}</div>`)}
        ${sec('tien-do', `<div class="dot"><b>Tiến độ:</b> ${dot.map((i, n) => `${n + 1}) ${f('PaymentInstallment.name', esc(i.name))} ${f('PaymentInstallment.amount', vnd(i.amount))} hạn ${f('PaymentInstallment.dueDate', d2(i.dueDate))} — ${f(nguonDot, dotTrangThai(i).toLowerCase())}`).join('; ')}.</div>`)}
        ${sec('da-thu', `<div class="dot"><b>Đã thu:</b> ${C.payments.length ? C.payments.map((p) => `${f('Payment.code', esc(p.code))} ${f('Payment.receivedAt', d2(p.receivedAt))} ${f('Payment.method', PTTT[p.method].toLowerCase())} ${f('Payment.amount', vnd(p.amount))}`).join('; ') : 'chưa có'} · <b>Còn lại: ${f('TÍNH: Contract.total − đã thu', vnd(conLai))}</b>${nh ? ` · CK: ${nh.ten} — ${nh.so} — ${nh.chu} — ND: ${nh.nd}` : ''}</div>`)}
      </div>
      ${sec('dieu-khoan', `<h2 class="h">Điều khoản <small>${dkNguon()}</small></h2>` + f(nguonDk, danhSach(C.terms.items, 'dk cot'), 'div'))}
      ${C.rules ? sec('noi-quy', `<h2 class="h">Nội quy <small>${nqNguon()}</small></h2>` + f(nguonNq, danhSach(C.rules.items, 'dk cot'), 'div')) : ''}
      ${C.notes ? sec('ghi-chu', `<p class="gc"><b>Ghi chú:</b> ${f('Contract.notes', esc(C.notes))}</p>`) : ''}
      ${sec('chu-cuoi', `<p class="cuoi">${thayBien(CHU_CUOI)}</p>`)}
      ${sec('chu-ky', `<div class="ky"><div><b>${k.nhanA}</b><span></span>${k.a}</div><div><b>${k.nhanB}</b><span></span>${k.b}</div></div>`)}`;
  }

  // Mẫu 5 — SANG TRỌNG: khung viền kép mọi trang, logo lớn giữa, chữ có chân thanh mảnh, hoa văn ngăn mục.
  function mau5() {
    const k = kyTen();
    const nh = on('chuyen-khoan') ? nganHang() : null;
    const hv = '<div class="hv" aria-hidden="true"><i></i><b></b><i></i></div>';
    return `
      <div class="khung-trang" aria-hidden="true"></div>
      ${sec('dau-trang', `<header class="dt">${logo('lg')}<b class="ten">${brand}</b><small>${f('OrganizationProfile.tagline', esc(S.tagline))}</small><small class="lh">${lienHe.join(' · ')}</small></header>`)}
      ${sec('tieu-de', `${hv}<h1 class="td">${esc(TIEU_DE)}</h1><p class="so">Số ${soHd}${nhap} · ${ngayLapTxt}</p>`)}
      ${sec('hai-ben', `<div class="ben"><section><small>${k.nhanA}</small><b>${brand}</b>${benA().slice(1).map(([a, b]) => `<p>${a}: ${b}</p>`).join('')}</section><section><small>${k.nhanB}</small><b>${f('Customer.fullName', esc(C.customer.fullName))}</b>${benB().slice(1).map(([a, b]) => `<p>${a}: ${b}</p>`).join('')}</section></div>`)}
      ${sec('chu-dau', `<p class="mo">${thayBien(CHU_DAU)}</p>`)}
      ${sec('dich-vu', `${hv}<h2 class="h">${SV ? 'Dịch vụ' : 'Khoá học'}</h2><table class="sv"><tbody>${HANG.map((h) => `<tr class="cap${h.cap}"><td>${h.ten}${h.chiTiet.length ? `<small>${h.chiTiet.join('<br>')}</small>` : ''}</td><td class="c">${h.sl > 1 ? `${h.sl} × ${vnd(h.dg)}` : ''}</td><td class="r">${f('ContractLine.lineTotal', vnd(h.tt))}</td></tr>`).join('')}</tbody></table>`)}
      ${sec('tien', `<div class="tong">${tongRows().map(([a, b, c]) => `<p class="${c || ''}"><span>${a}</span>${b}</p>`).join('')}${chu ? `<p class="bc">${chu}</p>` : ''}<p><span>Tiền cọc</span>${coc}</p></div>`)}
      ${sec('tien-do', `<h2 class="h nho">Tiến độ thanh toán</h2><table class="sv dot"><tbody>${dot.map((i) => `<tr><td>${f('PaymentInstallment.name', esc(i.name))}<small>${f('PaymentInstallment.dueDate', 'Hạn ' + d2(i.dueDate))} · ${f(nguonDot, dotTrangThai(i))}</small></td><td class="r">${f('PaymentInstallment.amount', vnd(i.amount))}</td></tr>`).join('')}</tbody></table>`)}
      ${sec('da-thu', `<div class="thu">${C.payments.length ? C.payments.map((p) => `<p>Đã nhận ${f('Payment.amount', vnd(p.amount))} — phiếu ${f('Payment.code', esc(p.code))}, ${f('Payment.receivedAt', d2(p.receivedAt))}, ${f('Payment.method', PTTT[p.method].toLowerCase())}.</p>`).join('') : '<p>Chưa nhận khoản thanh toán nào.</p>'}<p>Còn phải thanh toán: <b>${f('TÍNH: Contract.total − đã thu', vnd(conLai))}</b></p></div>`)}
      ${nh ? `<p class="ck">Chuyển khoản · ${nh.ten} · ${nh.so} · ${nh.chu} · Nội dung “${nh.nd}”</p>` : ''}
      ${sec('dieu-khoan', `${hv}<h2 class="h">Điều khoản</h2><p class="nguon">${dkNguon()}</p>` + f(nguonDk, danhSach(C.terms.items), 'div'))}
      ${C.rules ? sec('noi-quy', `<h2 class="h nho">Nội quy lớp học</h2><p class="nguon">${nqNguon()}</p>` + f(nguonNq, danhSach(C.rules.items), 'div')) : ''}
      ${C.notes ? sec('ghi-chu', `<p class="gc"><i>Ghi chú:</i> ${f('Contract.notes', esc(C.notes))}</p>`) : ''}
      ${sec('chu-cuoi', `<p class="cuoi">${thayBien(CHU_CUOI)}</p>`)}
      ${sec('chu-ky', `<div class="ky"><div><small>${k.nhanA}</small><span></span><b>${k.a}</b></div><div><small>${k.nhanB}</small><span></span><b>${k.b}</b></div></div>`)}`;
  }

  // Phương án 3 — VĂN BẢN TỰ DO (kiểu mẫu Word): người dùng gõ cả văn bản, chèn biến {…} và thẻ khối [[…]].
  const VAN_BAN_TU_DO = Q.get('vanban') || [
    '# ' + TIEU_DE,
    'Số: {Mã hợp đồng} — lập ngày {Ngày lập}',
    'Bên A: {Tên studio}, địa chỉ {Địa chỉ studio}, điện thoại {SĐT studio}, đại diện {Người đại diện}.',
    'Bên B: {Tên khách}, điện thoại {SĐT khách}.',
    SV ? 'Bên A nhận trang điểm cho Bên B trong ngày {Ngày sự kiện} theo bảng dưới đây:' : 'Bên A nhận đào tạo Bên B khoá {Tên khoá}, lớp {Tên lớp}, khai giảng {Ngày khai giảng}:',
    '[[Bảng dịch vụ]]',
    'Tổng giá trị hợp đồng là {Tổng tiền} ({Tổng tiền bằng chữ}). Bên B đặt cọc {Tiền cọc}; đã thanh toán {Đã thu}, còn lại {Còn lại}.',
    '[[Tiến độ thanh toán]]',
    '## Điều khoản',
    '[[Điều khoản]]',
    ...(SV ? [] : ['## Nội quy', '[[Nội quy]]']),
    'Hợp đồng lập thành 02 bản, mỗi bên giữ 01 bản.',
    '[[Chỗ ký]]',
  ].join('\n');
  function tuDo() {
    const k = kyTen();
    const THE = {
      'Bảng dịch vụ': () => `<table class="bang"><thead><tr><th class="c">STT</th><th>Hạng mục</th><th class="c">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead><tbody>${HANG.map((h) => `<tr class="cap${h.cap}"><td class="c">${h.stt}</td><td>${h.ten}${h.chiTiet.length ? `<div class="ct">${h.chiTiet.join('<br>')}</div>` : ''}</td><td class="c">${h.sl}</td><td class="r">${vnd(h.dg)}</td><td class="r">${vnd(h.tt)}</td></tr>`).join('')}<tr class="tong"><td></td><td colspan="3">Tổng cộng</td><td class="r">${vnd(C.total)}</td></tr></tbody></table>`,
      'Tiến độ thanh toán': () => tblDot('bang nho'),
      'Điều khoản': () => f(nguonDk, danhSach(C.terms.items), 'div'),
      'Nội quy': () => (C.rules ? f(nguonNq, danhSach(C.rules.items), 'div') : ''),
      'Chỗ ký': () => `<div class="ky"><div><b>ĐẠI DIỆN BÊN A</b><i>(Ký, ghi rõ họ tên)</i><span>${k.a}</span></div><div><b>BÊN B</b><i>(Ký, ghi rõ họ tên)</i><span>${k.b}</span></div></div>`,
    };
    return VAN_BAN_TU_DO.split('\n').map((ln) => {
      const t = ln.trim();
      if (!t) return '';
      const m = t.match(/^\[\[(.+)\]\]$/);
      if (m) return THE[m[1]] ? f(`THẺ KHỐI [[${m[1]}]]`, THE[m[1]](), 'div', 'the') : `<p class="loi-the">Không hiểu thẻ [[${esc(m[1])}]]</p>`;
      if (t.startsWith('## ')) return `<h2 class="dieu">${thayBien(t.slice(3))}</h2>`;
      if (t.startsWith('# ')) return `<h1 class="td">${thayBien(t.slice(2))}</h1>`;
      return `<p class="mo">${thayBien(t)}</p>`;
    }).join('');
  }

  const TEN_MAU = { 1: 'Cổ điển trang trọng', 2: 'Hiện đại tối giản', 3: 'Bảng kẻ đầy đủ', 4: 'Gọn một trang', 5: 'Sang trọng viền & logo lớn' };
  const body = TUDO ? tuDo() : [null, mau1, mau2, mau3, mau4, mau5][MAU]();

  // Chân trang chạy (lề dưới mỗi trang): số hợp đồng · số trang · ô ký nháy — dùng hộp lề @page của Chrome.
  const chanTrai = `${C.code}${C.status === 'DRAFT' ? ' · BẢN NHÁP' : ''}`;
  const cssTrang = `@page m${TUDO ? 1 : MAU} {
    ${on('so-trang') ? `@bottom-left { content: "${chanTrai}"; } @bottom-center { content: "Trang " counter(page) " / " counter(pages); }` : ''}
    ${on('ky-nhay') ? '@bottom-right { content: "Ký nháy   A: ______   B: ______"; }' : ''}
  }`;
  const st = document.createElement('style');
  st.textContent = cssTrang;
  document.head.append(st);

  document.body.classList.add('mau-' + (TUDO ? 1 : MAU));
  if (TUDO) document.body.classList.add('tu-do');
  if (Q.has('truong')) document.body.classList.add('show-f');
  if (Q.has('chup')) document.body.classList.add('chup');
  document.title = `${TEN_MAU[MAU]} — ${SV ? 'Hợp đồng dịch vụ' : 'Hợp đồng khoá học'} (${BAN === 'dai' ? 'dài' : 'ngắn'})`;

  const thanh = `<nav class="thanh" aria-label="Chọn mẫu xem">
    <b>R&D 09 · Mẫu in</b>
    ${[1, 2, 3, 4, 5].map((m) => `<a class="${m === MAU && !TUDO ? 'on' : ''}" href="?mau=${m}&loai=${LOAI}&ban=${BAN}">${m}. ${TEN_MAU[m]}</a>`).join('')}
    <span class="sp"></span>
    <a class="${LOAI === 'dich-vu' ? 'on' : ''}" href="?mau=${MAU}&loai=dich-vu&ban=${BAN}">Dịch vụ</a>
    <a class="${LOAI === 'khoa-hoc' ? 'on' : ''}" href="?mau=${MAU}&loai=khoa-hoc&ban=${BAN}">Khoá học</a>
    <a class="${BAN === 'dai' ? 'on' : ''}" href="?mau=${MAU}&loai=${LOAI}&ban=dai">Bản dài</a>
    <a class="${BAN === 'ngan' ? 'on' : ''}" href="?mau=${MAU}&loai=${LOAI}&ban=ngan">Bản ngắn</a>
    <button type="button" onclick="document.body.classList.toggle('show-f')">Nguồn dữ liệu</button>
    <button type="button" onclick="window.print()">In / Lưu PDF</button>
  </nav>`;
  document.body.insertAdjacentHTML('afterbegin', thanh + `<main class="ban"><article class="giay g${TUDO ? 1 : MAU}" aria-label="Bản in hợp đồng">${body}</article></main>`);

  // ---------- tự kiểm (bài in Playwright đọc window.__kiem) ----------
  const loi = [];
  if (subtotal !== C.subtotal) loi.push(`Tạm tính cộng lại ${subtotal} ≠ ${C.subtotal}`);
  if (C.subtotal - C.discount !== C.total) loi.push(`Tạm tính − giảm ≠ tổng`);
  const sumDot = C.installments.reduce((s, i) => s + i.amount, 0);
  if (sumDot !== C.total) loi.push(`Σ đợt ${sumDot} ≠ tổng ${C.total}`);
  for (const l of all) if (l.unitPrice * l.quantity - l.lineDiscount !== l.lineTotal) loi.push(`Dòng ${l.name}: đơn giá × SL − giảm ≠ thành tiền`);
  for (const l of roots) if (l.travel) {
    const t = l.travel, b = t.travelBreakdown;
    if (Math.round(b.chargedKm * t.perKmAmount) !== t.lineTotal) loi.push('Phí di chuyển: km tính × đơn giá ≠ thành tiền');
    if (Math.abs((t.distanceKm - b.includedKm) - b.excessKm) > 1e-9 || Math.abs(b.excessKm * (b.roundTrip ? 2 : 1) - b.chargedKm) > 1e-9) loi.push('Phí di chuyển: số km không khớp');
  }
  if (course) {
    // Số buổi theo lịch lớp phải khớp sessionCount.
    const k = course.klass; let n = 0;
    for (let d = new Date(k.startDate + 'T12:00:00'); d <= new Date(k.endDate + 'T12:00:00'); d.setDate(d.getDate() + 1)) { const w = d.getDay() || 7; if (k.weekdays.includes(w)) n++; }
    if (n !== k.sessionCount) loi.push(`Lịch lớp ra ${n} buổi ≠ ${k.sessionCount}`);
  }
  window.__kiem = {
    loi, mau: TUDO ? 'tu-do' : MAU, loai: LOAI, ban: BAN, code: C.code, title: TIEU_DE,
    total: vnd(C.total), conLai: vnd(conLai), daThu: vnd(daThu),
    soDieu: C.terms.items.length, soNoiQuy: C.rules ? C.rules.items.length : 0,
    dieuDau: C.terms.items[0], dieuCuoi: C.terms.items[C.terms.items.length - 1],
    tat: [...TAT], khoi: KHOI, tenMau: TEN_MAU,
  };
})();
