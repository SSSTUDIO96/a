// Nhận biết nền tảng để chọn cách hướng dẫn cài app. Chỉ đọc môi trường trình duyệt, không gọi mạng.

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

/** iPhone / iPad (iPadOS 13+ tự xưng là Macintosh nhưng có màn cảm ứng nhiều điểm). */
export function isIOS(): boolean {
  if (/iPhone|iPad|iPod/i.test(ua())) return true;
  return typeof navigator !== 'undefined' && /Macintosh/i.test(ua()) && navigator.maxTouchPoints > 1;
}

/** Đang chạy như app đã cài lên màn hình chính (không còn thanh địa chỉ). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const viaMedia = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  const viaIOS = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return viaMedia || viaIOS;
}

/** Đang mở trong trình duyệt tích hợp của Zalo: không cài được, phải mở bằng Safari/Chrome. */
export function isZaloInApp(): boolean {
  return /Zalo/i.test(ua());
}

/** Safari thật trên iOS (không phải Chrome/Firefox/Edge iOS, không phải khung trong Zalo/Facebook...). */
export function isIOSSafari(): boolean {
  if (!isIOS()) return false;
  const s = ua();
  if (/CriOS|FxiOS|EdgiOS|OPiOS|Zalo|FBAN|FBAV|Instagram|Line\//i.test(s)) return false;
  return /Safari/i.test(s);
}
