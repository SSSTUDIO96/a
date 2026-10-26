// Hiểu biết về môi trường in của trình duyệt — hàm thuần để thử được (hộp In truyền navigator vào).

export interface NavLike {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}

/**
 * Trình duyệt dùng động cơ WebKit của Apple: Safari trên Mac, và MỌI trình duyệt trên iPhone / iPad (Chrome iOS cũng là WebKit).
 * Các trình duyệt này không in hộp lề của @page (số trang, ô ký nháy ở chân trang) — bản vẽ G mục 4.4.
 */
export function isWebKitPrint(nav: NavLike): boolean {
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ tự xưng là Mac: phân biệt bằng màn cảm ứng.
  if (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1) return true;
  return /Safari\//.test(ua) && /Version\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua);
}

/** App đã thêm ra màn hình chính của iPhone (chạy độc lập): hộp in của trình duyệt có thể không mở được. */
export function isStandaloneApp(nav: NavLike): boolean {
  return nav.standalone === true;
}

export const SAFARI_FOOTER_WARNING = 'Safari không in số trang và ô ký nháy ở chân trang';

const pad = (n: number | string) => String(n).padStart(2, '0');

function partsIn(iso: string, tz: string): Record<string, string> {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Thời điểm không hợp lệ: ${iso}`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** "25/10/2026 14:30" theo múi giờ của tổ chức. */
export function formatDateTimeIn(iso: string, tz: string): string {
  const p = partsIn(iso, tz);
  return `${pad(p.day!)}/${pad(p.month!)}/${p.year} ${pad(p.hour!)}:${pad(p.minute!)}`;
}

/** 'YYYY-MM-DD' theo múi giờ của tổ chức. */
export function localDateIn(iso: string, tz: string): string {
  const p = partsIn(iso, tz);
  return `${p.year}-${pad(p.month!)}-${pad(p.day!)}`;
}
