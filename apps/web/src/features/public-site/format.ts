// Chữ hiển thị của trang giới thiệu công khai — hàm thuần, không gọi API (dùng chung cho trang thật và khung xem trước).
import type { LocationType, PublicPackage, WorkingShift } from '../../api/types';

export const WEEKDAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'] as const;

export const LOCATION_LABELS: Record<LocationType, string> = {
  STUDIO: 'Studio',
  CUSTOMER_HOME: 'Tại nhà',
  OTHER: 'Nơi khác',
};

const LOCATION_ORDER: LocationType[] = ['STUDIO', 'CUSTOMER_HOME', 'OTHER'];

// Số đã chuẩn hoá của máy chủ (0xxxxxxxxx di động, 02xxxxxxxxx cố định) → nhóm chữ số cho dễ đọc. Dạng khác: giữ nguyên.
export function formatPhone(phone: string): string {
  const d = phone.replace(/\s+/g, '');
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^02\d{9}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return phone;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

// Zalo: liên kết https có sẵn thì dùng nguyên; số điện thoại thì https://zalo.me/{số}.
export function zaloHref(zalo: string): string {
  const v = zalo.trim();
  if (v.startsWith('https://')) return v;
  return `https://zalo.me/${v.replace(/\D/g, '')}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} giờ ${m} phút`;
  if (h) return `${h} giờ`;
  return `${m} phút`;
}

// Rỗng = gói không giới hạn nơi làm → không ghi nơi làm.
export function formatLocations(types: readonly LocationType[]): string {
  return LOCATION_ORDER.filter((t) => types.includes(t))
    .map((t) => LOCATION_LABELS[t])
    .join(' · ');
}

// "Miễn phí di chuyển …" chỉ có nghĩa khi gói cho làm ngoài studio (rỗng = không giới hạn, tính là có).
export function travelsOut(types: readonly LocationType[]): boolean {
  return types.length === 0 || types.includes('CUSTOMER_HOME') || types.includes('OTHER');
}

export function formatKmVi(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export interface PackageGroup<P> {
  key: string;
  title: string;
  packages: P[];
}

// Nhóm gói theo nhân vật, theo thứ tự subjects[] (chỉ nhân vật đang dùng); gói KHÔNG gắn nhân vật vào "Gói khác" cuối.
// Gói gắn nhân vật không có trong subjects[] (nhân vật đã ẩn) thì BỎ, không đẩy sang "Gói khác" (R1, biên bản nghiệm
// thu lần 3): studio không lập hợp đồng cho gói đó được nên khách không được thấy giá. Máy chủ đã lọc sẵn; chốt này giữ
// cho khung "Xem trước" (dựng từ GET /packages, có cả gói của nhân vật đã ẩn) cùng luật với trang thật.
export function groupPackages<P extends Pick<PublicPackage, 'subject'>>(packages: readonly P[], subjects: readonly { id: string; name: string }[]): PackageGroup<P>[] {
  const groups: PackageGroup<P>[] = [];
  for (const s of subjects) {
    const list = packages.filter((p) => p.subject?.id === s.id);
    if (list.length) groups.push({ key: s.id, title: s.name, packages: list });
  }
  const others = packages.filter((p) => !p.subject);
  if (others.length) groups.push({ key: 'goi-khac', title: 'Gói khác', packages: others });
  return groups;
}

export interface DayHours {
  weekday: number;
  label: string;
  text: string | null;
}

// 7 dòng Thứ Hai → Chủ nhật; thứ không có ca → text null (hiện "Nghỉ").
export function hoursByDay(shifts: readonly WorkingShift[]): DayHours[] {
  return WEEKDAY_LABELS.map((label, i) => {
    const day = shifts.filter((s) => s.weekday === i + 1).sort((a, b) => a.open.localeCompare(b.open));
    return { weekday: i + 1, label, text: day.length ? day.map((s) => `${s.open}–${s.close}`).join(', ') : null };
  });
}

// Mô tả trang (thẻ meta description): câu giới thiệu ngắn, không có thì đoạn đầu phần giới thiệu.
export function siteDescription(profile: { tagline: string | null; bio: string | null }): string | null {
  const t = profile.tagline?.trim();
  if (t) return t;
  const b = profile.bio?.trim().replace(/\s+/g, ' ');
  if (!b) return null;
  return b.length > 160 ? `${b.slice(0, 157).trimEnd()}…` : b;
}
