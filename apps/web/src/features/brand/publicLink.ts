// Đường dẫn trang giới thiệu hiện trên thanh xuất bản. Tên miền lấy từ cấu hình web (biến Vite VITE_PUBLIC_SITE_ORIGIN,
// ví dụ "https://makeuppro.vn") — KHÔNG viết cứng. Thiếu hoặc sai cấu hình → hiện đường dẫn tương đối "/trang/{slug}".

export function parseSiteOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export const SITE_ORIGIN: string | null = parseSiteOrigin(import.meta.env.VITE_PUBLIC_SITE_ORIGIN);

export function sitePath(slug: string): string {
  return `/trang/${encodeURIComponent(slug)}`;
}

export interface SiteLink {
  // Phần đứng trước slug khi hiện: "makeuppro.vn/trang/" hoặc "/trang/".
  prefix: string;
  slug: string;
  // Mở trang (thẻ <a>): tuyệt đối khi có cấu hình, tương đối khi không.
  href: string;
}

export function siteLink(slug: string, origin: string | null = SITE_ORIGIN): SiteLink {
  const path = sitePath(slug);
  if (!origin) return { prefix: '/trang/', slug, href: path };
  const host = origin.replace(/^https?:\/\//, '');
  return { prefix: `${host}/trang/`, slug, href: `${origin}${path}` };
}

// Liên kết sao chép phải mở được ở máy khác nên luôn tuyệt đối: có cấu hình thì theo cấu hình, không thì theo đúng
// địa chỉ web đang chạy (nơi đường /trang/:slug thật sự có) — không đoán tên miền nào khác.
export function shareUrl(slug: string, origin: string | null = SITE_ORIGIN, here: string = window.location.origin): string {
  return `${origin ?? here}${sitePath(slug)}`;
}
