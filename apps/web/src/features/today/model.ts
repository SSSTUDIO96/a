// Logic thuần của màn Hôm nay (không React): nhãn ngày, giờ, gom ca theo thợ / theo ngày, chọn ca kế tiếp, đếm việc gấp.
// Mọi ngày giờ tính theo MÚI GIỜ TỔ CHỨC do máy chủ báo trong TodayView.timezone — không theo đồng hồ hay múi giờ của máy.
// Tiền: web không cộng, không trừ; số nào cũng lấy nguyên từ máy chủ (counts.*, outstanding, total).
import { localDateAndMinute, type OccasionColor } from '@makeup/shared';
import type { TodayAppointment, TodayInstallment, TodayView } from '../../api/types';

// Chỉ số 1..7 = Thứ Hai … Chủ nhật (cùng quy ước localDateAndMinute ở @makeup/shared).
const WEEKDAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

function mustDate(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Ngày không hợp lệ (cần YYYY-MM-DD): ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** "YYYY-MM-DD" → "Thứ Bảy". */
export function weekdayName(date: string): string {
  const [y, m, d] = mustDate(date);
  const iso = ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
  return WEEKDAY_NAMES[iso - 1] as string;
}

/** "YYYY-MM-DD" → "21/11". */
export function dayMonth(date: string): string {
  const [, m, d] = mustDate(date);
  return `${pad(d)}/${pad(m)}`;
}

/** "YYYY-MM-DD" → "Thứ Bảy 21/11". */
export function dayLabel(date: string): string {
  return `${weekdayName(date)} ${dayMonth(date)}`;
}

/** Tiêu đề trang: "Hôm nay · Thứ Bảy 21/11" theo ngày của máy chủ. */
export function pageTitle(today: string): string {
  return `Hôm nay · ${dayLabel(today)}`;
}

function need(timezone: string): string {
  if (!timezone) throw new Error('Thiếu múi giờ tổ chức (TodayView.timezone)');
  return timezone;
}

/** Ngày "YYYY-MM-DD" của một thời điểm, theo múi giờ tổ chức. */
export function localDateOf(iso: string, timezone: string): string {
  return localDateAndMinute(new Date(iso), need(timezone)).date;
}

/** "HH:MM" của một thời điểm, theo múi giờ tổ chức. */
export function hhmm(iso: string, timezone: string): string {
  const { minute } = localDateAndMinute(new Date(iso), need(timezone));
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** Ca kế tiếp trong ngày hôm nay: ca bắt đầu sớm nhất từ lúc máy chủ tạo số liệu trở đi; hết ca thì null. */
export function nextAppointment(view: TodayView): TodayAppointment | null {
  if (!view.appointments) return null;
  const now = Date.parse(view.generatedAt);
  const upcoming = view.appointments.today.filter((a) => Date.parse(a.startsAt) >= now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return upcoming[0] ?? null;
}

/** Tên thợ đứng đầu của ca (thợ chính trước); ca chưa có thợ → null (không bịa tên). */
export function leadStaffName(a: TodayAppointment): string | null {
  const lead = a.staff.find((s) => s.role === 'PRIMARY') ?? a.staff[0];
  return lead ? lead.displayName : null;
}

export interface StaffGroup {
  /** membershipId, hoặc null cho nhóm "Chưa có thợ". */
  membershipId: string | null;
  name: string;
  appointments: TodayAppointment[];
}

export const NO_STAFF_LABEL = 'Chưa có thợ';

/** Gom ca theo thợ: nhóm có ca sớm nhất lên trước; ca chưa có thợ gom vào "Chưa có thợ" ở CUỐI. Ca nhiều thợ có mặt ở mỗi thợ. */
export function groupByStaff(list: readonly TodayAppointment[]): StaffGroup[] {
  const sorted = [...list].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const byStaff = new Map<string, StaffGroup>();
  const none: TodayAppointment[] = [];
  for (const a of sorted) {
    if (a.staff.length === 0) {
      none.push(a);
      continue;
    }
    for (const s of a.staff) {
      const g = byStaff.get(s.membershipId) ?? { membershipId: s.membershipId, name: s.displayName, appointments: [] };
      g.appointments.push(a);
      byStaff.set(s.membershipId, g);
    }
  }
  const groups = [...byStaff.values()];
  if (none.length > 0) groups.push({ membershipId: null, name: NO_STAFF_LABEL, appointments: none });
  return groups;
}

export interface DayGroup {
  date: string;
  appointments: TodayAppointment[];
}

/** Gom ca theo ngày (theo múi giờ tổ chức), ngày sớm trước, trong ngày theo giờ bắt đầu. */
export function groupByDay(list: readonly TodayAppointment[], timezone: string): DayGroup[] {
  const sorted = [...list].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const out: DayGroup[] = [];
  for (const a of sorted) {
    const date = localDateOf(a.startsAt, timezone);
    const last = out[out.length - 1];
    if (last && last.date === date) last.appointments.push(a);
    else out.push({ date, appointments: [a] });
  }
  return out;
}

/** "Hạn 18/11 (quá 3 ngày)" cho đợt quá hạn; "Hạn Thứ Ba 24/11" cho đợt chưa quá hạn. */
export function dueLabel(i: TodayInstallment, timezone: string): string {
  const date = localDateOf(i.dueDate, timezone);
  if (i.status === 'OVERDUE') return `Hạn ${dayMonth(date)} (quá ${i.overdueDays} ngày)`;
  return `Hạn ${dayLabel(date)}`;
}

/** Đợt hạn đúng ngày sự kiện của hợp đồng (để ghi "(ngày sự kiện)"). */
export function dueOnEventDay(i: TodayInstallment, timezone: string): boolean {
  return i.contract.eventDate !== null && localDateOf(i.contract.eventDate, timezone) === localDateOf(i.dueDate, timezone);
}

/** "20:14 hôm qua" / "09:05 hôm nay" / "20:14 18/11" — theo ngày của máy chủ (today). */
export function sinceLabel(iso: string, view: Pick<TodayView, 'timezone' | 'today'>): string {
  const date = localDateOf(iso, view.timezone);
  const time = hhmm(iso, view.timezone);
  if (date === view.today) return `${time} hôm nay`;
  const [y, m, d] = mustDate(view.today);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  const yKey = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;
  if (date === yKey) return `${time} hôm qua`;
  return `${time} ${dayMonth(date)}`;
}

export const LOCATION_LABELS = { STUDIO: 'Tại studio', CUSTOMER_HOME: 'Tại nhà khách', OTHER: 'Nơi khác' } as const;

/** "Tại nhà khách – 25 Nguyễn Văn Cừ · đi trước 30 phút"; thiếu nơi làm thì bỏ phần đó. */
export function locationLine(a: TodayAppointment): string {
  const parts: string[] = [];
  if (a.locationType) parts.push(a.address ? `${LOCATION_LABELS[a.locationType]} – ${a.address}` : LOCATION_LABELS[a.locationType]);
  else if (a.address) parts.push(a.address);
  if (a.travelBeforeMin > 0) parts.push(`đi trước ${a.travelBeforeMin} phút`);
  return parts.join(' · ');
}

/** Dòng trên của ca ở giao diện thợ: "{sự kiện} · {nhân vật}"; thiếu bên nào bỏ bên đó. Không có cả hai → tiêu đề ca. */
export function eventLine(a: TodayAppointment): string {
  const parts = [a.occasion?.name, a.subjectName].filter((s): s is string => Boolean(s));
  if (parts.length > 0) return parts.join(' · ');
  return a.title ?? '';
}

/** Màu ca: màu loại sự kiện; ca chưa có sự kiện → 'other' (trung tính). */
export function swatchOf(a: TodayAppointment): OccasionColor | 'other' {
  return a.occasion ? a.occasion.color : 'other';
}

/** Đường tới ca trên Lịch (mở đúng tuần và đúng ca). `date` là ngày của ca theo múi giờ tổ chức. */
export function scheduleLink(orgSlug: string, date: string, appointmentId: string): string {
  return `/${orgSlug}/lich?ngay=${date}&ca=${appointmentId}`;
}

/** Số việc ở thẻ "Cần làm ngay": đếm trên TOÀN BỘ máy chủ báo (không đếm riêng phần được vẽ khi bị cắt bớt). */
export function needsCounts(view: TodayView): { overdue: number; unassigned: number; classes: number; total: number } | null {
  const overdue = view.installments ? (view.counts.overdue ? view.counts.overdue.count : view.installments.overdue.length) : null;
  const unassigned = view.unassigned ? (view.counts.unassignedSoon ?? view.unassigned.length) : null;
  const classes = view.almostFullClasses ? view.almostFullClasses.length : null;
  // Cả ba thẻ vắng quyền → không có thẻ "Cần làm ngay".
  if (overdue === null && unassigned === null && classes === null) return null;
  const o = overdue ?? 0;
  const u = unassigned ?? 0;
  const c = classes ?? 0;
  return { overdue: o, unassigned: u, classes: c, total: o + u + c };
}

/** Quyền của người xem dùng để chọn nút trong dòng (ẩn nút, không ẩn dữ liệu — dữ liệu do máy chủ quyết theo quyền). */
export interface TodayAccess {
  /** payments.write: có nút "Mở Thu tiền"; không có thì bấm cả dòng để xem. */
  paymentsWrite: boolean;
  /** schedule.write: có nút "Phân thợ"; không có thì bấm cả dòng để xem ca trên Lịch. */
  scheduleWrite: boolean;
}
