/* Xuất giấy chứng nhận (.cc, khung 1123×794) thành PNG 1754×1240 = A4 ngang 150 dpi, ngay trong trang mẫu (cùng nguồn với app).
   Dùng html-to-image 1.11.13 (MIT, chung/html-to-image.js). App gọi window.MAU_XUAT_PNG() qua iframe cùng nguồn
   (designs/exportPng.ts → renderTemplatePng(src, '1754x1240')) và nhận { blob, width, height }.
   Phông nhúng: html-to-image chỉ nhúng phông mà .cc thật sự dùng; mẫu nối phông bằng thẻ <link> (không @import). */
(function () {
  const RONG = 1123, CAO = 794, RA_RONG = 1754, RA_CAO = 1240;
  const CHO_TOI_DA_MS = 20000;
  function choSanSang() {
    return new Promise((xong, loi) => {
      const t0 = Date.now();
      (function hoi() {
        if (document.body.dataset.ready === '1') return xong();
        if (Date.now() - t0 > CHO_TOI_DA_MS) return loi(new Error('Mẫu chưa vẽ xong sau 20 giây'));
        setTimeout(hoi, 50);
      })();
    });
  }
  window.MAU_XUAT_PNG = async function () {
    await choSanSang();
    if (document.body.dataset.loi) throw new Error('Mẫu vẽ lỗi: ' + document.body.dataset.loi);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const c = document.querySelector('.cc');
    if (!c) throw new Error('Không thấy khung giấy chứng nhận');
    if (!window.htmlToImage) throw new Error('Thiếu bộ vẽ ảnh html-to-image');
    const opt = { width: RONG, height: CAO, canvasWidth: RONG, canvasHeight: CAO, pixelRatio: RA_RONG / RONG, cacheBust: false, backgroundColor: '#ffffff' };
    await window.htmlToImage.toBlob(c, opt); // lần 1: để trình duyệt nạp phông đã nhúng vào ảnh SVG
    const blob = await window.htmlToImage.toBlob(c, opt);
    if (!blob) throw new Error('Không vẽ được ảnh');
    return { blob, width: RA_RONG, height: RA_CAO };
  };
})();
