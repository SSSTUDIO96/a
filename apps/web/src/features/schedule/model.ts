// Logic thuần của màn Lịch (không React): chế độ xem, hàng thợ, xếp ca vào ô, xếp làn cho ca chồng giờ, trùng lịch 409.
import { isBlockingStatus, STATUS_TRANSITIONS, type Permission, type WorkStatus } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { Appointment, AppointmentConflict, StaffMember } from '../../api/types';
import { dayKeyOf, dayStartMs, minutesFromDayStart, type DayKey } from './time';

// ---------------- Chế độ xem ----------------
// Bản vẽ C 4.1 + lời anh Chiến: "Cho phép hiển thị cả 3 chế độ và mặc định hiển thị là chế độ C".
// Quyết định đã ghi: KHÔNG nhớ lựa chọn lần trước — mỗi lần mở màn đều là C (không đọc/ghi localStorage).
export type ScheduleMode = 'C' | 'B' | 'A';
export const DEFAULT_MODE: ScheduleMode = 'C';

export const MODE_OPTIONS: readonly { value: ScheduleMode; label: string; short: string; tip: string }[] = [
  { value: 'C', label: 'Thợ × ngày', short: 'Tuần', tip: 'Lưới tuần: mỗi hàng một thợ, mỗi cột một ngày.' },
  { value: 'B', label: 'Ngày', short: 'Ngày', tip: 'Danh sách ca của một ngày, chia theo buổi.' },
  { value: 'A', label: 'Cột thợ', short: 'Cột thợ', tip: 'Một ngày, mỗi thợ một cột theo trục giờ.' },
];

// ---------------- Màu loại ca ----------------
// Máy chủ chưa trả nhân vật/loại dịch vụ của ca (phiếu vướng P2). Lịch sinh từ hợp đồng có title "{tên gói} — {nhân vật}",
// nên màu tạm suy từ chữ trong tên ca. Luật này ghi rõ trong tooltip "?" của chú thích màu, không đoán ngầm.
export type Tone = 'bride' | 'engagement' | 'event' | 'other';

export const TONE_LABELS: Record<Tone, string> = {
  bride: 'Cô dâu',
  engagement: 'Ăn hỏi',
  event: 'Tiệc & sự kiện',
  other: 'Khác',
};

export const TONE_RULE_TIP =
  'Màu theo chữ trong tên ca: có "ăn hỏi" → Ăn hỏi; có "tiệc", "sự kiện" hoặc "kỷ yếu" → Tiệc & sự kiện; có "cô dâu" hoặc "cưới" → Cô dâu; còn lại → Khác.';

export function toneOf(title: string | null | undefined): Tone {
  const t = (title ?? '').toLocaleLowerCase('vi');
  if (t.includes('ăn hỏi')) return 'engagement';
  if (t.includes('tiệc') || t.includes('sự kiện') || t.includes('kỷ yếu')) return 'event';
  if (t.includes('cô dâu') || t.includes('cưới')) return 'bride';
  return 'other';
}

export const KIND_LABELS: Record<Appointment['kind'], string> = {
  MAKEUP: 'Makeup',
  COURSE_SESSION: 'Buổi học',
  INTERNAL: 'Việc nội bộ',
  PERSONAL_BLOCK: 'Bận việc riêng',
  OTHER: 'Việc khác',
};

// Chữ "loại" trên ô ca: tên ca nếu có, không thì loại sự kiện.
export function kindText(a: Pick<Appointment, 'title' | 'kind'>): string {
  return a.title?.trim() || KIND_LABELS[a.kind];
}

// Ca không chặn lịch (nháp, đã huỷ, khách không đến) vẽ mờ, không báo đỏ (bản vẽ 4.1).
export function isBlocking(a: Pick<Appointment, 'status'>): boolean {
  return isBlockingStatus(a.status);
}

// ---------------- Quyền ----------------
export interface ScheduleAccess {
  readAll: boolean;
  write: boolean;
  staffRead: boolean;
  customersRead: boolean;
  customersWrite: boolean;
  contractsRead: boolean;
}

export function accessFrom(has: (p: Permission) => boolean): ScheduleAccess {
  return {
    readAll: has('schedule.read_all'),
    write: has('schedule.write'),
    staffRead: has('staff.read'),
    customersRead: has('customers.read'),
    customersWrite: has('customers.write'),
    contractsRead: has('contracts.read'),
  };
}

// ---------------- Hàng / cột thợ ----------------
export const UNASSIGNED = 'chua-co-tho';

export interface StaffLane {
  membershipId: string;
  name: string;
  initials?: string;
  avatarUrl: string | null;
  tierName: string | null;
}

const MAKEUP_ROLE_KEYS = new Set(['artist', 'assistant']);

// Có hồ sơ thợ, hoặc mang vai trò Thợ makeup / Thợ phụ.
export function isMakeupStaff(m: Pick<StaffMember, 'hasProfile' | 'roleKeys'>): boolean {
  return m.hasProfile || m.roleKeys.some((k) => MAKEUP_ROLE_KEYS.has(k));
}

/**
 * Hàng thợ của lưới (C), cột thợ (A), chip lọc (B).
 * - Chỉ có schedule.read_own: đúng một hàng là chính mình (máy chủ cũng chỉ trả ca của mình).
 * - Có schedule.read_all: thợ đang nhận lịch có hồ sơ thợ hoặc vai trò Thợ makeup / Thợ phụ, cộng mọi người đang có ca
 *   trong khoảng xem (kể cả đã tắt nhận lịch). Thiếu staff.read thì lấy tên từ chính ca.
 */
export function buildStaffLanes(input: {
  staff: readonly StaffMember[] | null;
  appointments: readonly Appointment[];
  readAll: boolean;
  self: { membershipId: string; name: string };
}): StaffLane[] {
  const { staff, appointments, readAll, self } = input;
  const fromStaff = (m: StaffMember): StaffLane => ({
    membershipId: m.membershipId,
    name: m.displayName,
    initials: m.initials,
    avatarUrl: m.avatarUrl,
    tierName: m.tier?.name ?? null,
  });
  const fromAppointments = new Map<string, string>();
  for (const a of appointments) for (const s of a.staff) if (!fromAppointments.has(s.membershipId)) fromAppointments.set(s.membershipId, s.fullName);

  if (!readAll) {
    const me = staff?.find((m) => m.membershipId === self.membershipId);
    if (me) return [fromStaff(me)];
    return [{ membershipId: self.membershipId, name: fromAppointments.get(self.membershipId) ?? self.name, avatarUrl: null, tierName: null }];
  }

  const lanes: StaffLane[] = [];
  const seen = new Set<string>();
  for (const m of staff ?? []) {
    if ((m.isBookable && isMakeupStaff(m)) || fromAppointments.has(m.membershipId)) {
      lanes.push(fromStaff(m));
      seen.add(m.membershipId);
    }
  }
  for (const [membershipId, name] of fromAppointments) {
    if (!seen.has(membershipId)) lanes.push({ membershipId, name, avatarUrl: null, tierName: null });
  }
  return lanes;
}

// ---------------- Ca theo ngày ----------------
// Các ngày (giờ Việt Nam) mà ca [startsAt, endsAt) chạm vào. Ca kết thúc đúng 00:00 không tính sang ngày sau.
export function daysOf(a: Pick<Appointment, 'startsAt' | 'endsAt'>): DayKey[] {
  const first = dayKeyOf(a.startsAt);
  const endMs = Date.parse(a.endsAt);
  const out: DayKey[] = [first];
  let k = first;
  for (let i = 0; i < 3; i += 1) {
    const next = dayKeyOf(dayStartMs(k) + 36 * 3600_000);
    if (dayStartMs(next) >= endMs) break;
    out.push(next);
    k = next;
  }
  return out;
}

export function cellKey(laneId: string, day: DayKey): string {
  return `${laneId}|${day}`;
}

export function laneIdsOf(a: Pick<Appointment, 'staff'>): string[] {
  return a.staff.length === 0 ? [UNASSIGNED] : a.staff.map((s) => s.membershipId);
}

const byStart = (x: Appointment, y: Appointment) =>
  Date.parse(x.startsAt) - Date.parse(y.startsAt) || Date.parse(x.endsAt) - Date.parse(y.endsAt) || x.code.localeCompare(y.code);

// Ô (thợ × ngày) → ca trong ô, xếp theo giờ bắt đầu. Ca có 2 thợ nằm ở cả 2 hàng; ca chưa có thợ nằm ở hàng "Chưa có thợ".
export function indexByCell(appointments: readonly Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  for (const a of appointments) {
    for (const day of daysOf(a)) {
      for (const lane of laneIdsOf(a)) {
        const k = cellKey(lane, day);
        const list = map.get(k);
        if (list) list.push(a);
        else map.set(k, [a]);
      }
    }
  }
  for (const list of map.values()) list.sort(byStart);
  return map;
}

// Ca của một ngày (không lặp), xếp theo giờ.
export function appointmentsOfDay(appointments: readonly Appointment[], day: DayKey): Appointment[] {
  return appointments.filter((a) => daysOf(a).includes(day)).sort(byStart);
}

export function countByDay(appointments: readonly Appointment[], days: readonly DayKey[]): Record<DayKey, number> {
  const out: Record<DayKey, number> = {};
  for (const d of days) out[d] = 0;
  for (const a of appointments) for (const d of daysOf(a)) if (d in out) out[d] = (out[d] ?? 0) + 1;
  return out;
}

export function countByLane(appointments: readonly Appointment[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of appointments) for (const lane of laneIdsOf(a)) out.set(lane, (out.get(lane) ?? 0) + 1);
  return out;
}

// ---------------- Khoảng bận và xếp làn ----------------
export interface Span {
  id: string;
  start: number; // ms
  end: number; // ms
}

// Khoảng bận đã gồm thời gian di chuyển (blockStart–blockEnd, cùng công thức computeBlock của máy chủ).
export function blockSpan(a: Pick<Appointment, 'id' | 'startsAt' | 'endsAt' | 'travelBeforeMin' | 'travelAfterMin'>): Span {
  return {
    id: a.id,
    start: Date.parse(a.startsAt) - a.travelBeforeMin * 60_000,
    end: Date.parse(a.endsAt) + a.travelAfterMin * 60_000,
  };
}

/**
 * Xếp làn cho các ca chồng giờ trong cùng một cột (chế độ A): nhóm các ca chồng nhau (bắc cầu) thành cụm,
 * trong cụm mỗi ca lấy làn trống đầu tiên; mọi ca trong cụm chia đều bề ngang theo số làn của cụm.
 * Khoảng nửa mở [start, end): ca này kết thúc đúng lúc ca kia bắt đầu thì không chồng.
 */
export function layoutLanes(spans: readonly Span[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...spans].sort((x, y) => x.start - y.start || y.end - x.end || x.id.localeCompare(y.id));
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };
  for (const s of sorted) {
    if (s.start >= clusterEnd && cluster.length > 0) flush();
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(s.end);
    } else {
      laneEnds[lane] = s.end;
    }
    cluster.push({ id: s.id, lane });
    clusterEnd = cluster.length === 1 ? s.end : Math.max(clusterEnd, s.end);
  }
  if (cluster.length > 0) flush();
  return out;
}

// Trục giờ chế độ A: mặc định 04:00–18:00 (bản vẽ); có ca ngoài khung thì nới ra cho đủ (làm tròn giờ), trong 00–24.
export function axisHours(spans: readonly Span[], day: DayKey, base: [number, number] = [4, 18]): [number, number] {
  let [from, to] = base;
  for (const s of spans) {
    const a = Math.max(0, minutesFromDayStart(s.start, day));
    const b = Math.min(24 * 60, minutesFromDayStart(s.end, day));
    if (b <= 0 || a >= 24 * 60) continue;
    from = Math.min(from, Math.floor(a / 60));
    to = Math.max(to, Math.ceil(b / 60));
  }
  return [from, to];
}

// ---------------- Buổi trong ngày (chế độ B) ----------------
// Bản vẽ ghi 3 nhóm "Sáng sớm / Buổi sáng / Buổi chiều"; mốc chia lấy theo bản mẫu B: 04:30–06:00 là sáng sớm, 07:00 là buổi sáng.
// Sáng sớm < 07:00 ≤ Buổi sáng < 12:00 ≤ Buổi chiều (gồm cả buổi tối, bản vẽ không có nhóm thứ tư).
export type DayPart = 'early' | 'morning' | 'afternoon';
export const DAY_PART_LABELS: Record<DayPart, string> = { early: 'Sáng sớm', morning: 'Buổi sáng', afternoon: 'Buổi chiều' };

export function dayPartOf(a: Pick<Appointment, 'startsAt'>, day: DayKey): DayPart {
  const m = minutesFromDayStart(a.startsAt, day);
  if (m < 7 * 60) return 'early';
  if (m < 12 * 60) return 'morning';
  return 'afternoon';
}

// ---------------- Trùng lịch (409) ----------------
// Máy chủ: 409 CONFLICT luôn kèm details.conflicts (schedule/service.ts overlapError). Lỗi 409 khác (sai bảng chuyển
// trạng thái, lịch đã kết thúc không sửa được) không có conflicts → trả null để hiện lời máy chủ như lỗi thường.
export function conflictsOf(err: unknown): AppointmentConflict[] | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const list = (err.details as { conflicts?: unknown } | undefined)?.conflicts;
  if (!Array.isArray(list)) return null;
  return list.filter(
    (c): c is AppointmentConflict =>
      typeof c === 'object' && c !== null && typeof (c as AppointmentConflict).appointmentId === 'string' && typeof (c as AppointmentConflict).membershipId === 'string',
  );
}

export interface ConflictMarks {
  appointmentIds: Set<string>;
  // Ô (thợ × ngày) cần viền đỏ, kèm giờ bận để ghi lên cờ "Trùng 06:00–06:30".
  cells: Map<string, AppointmentConflict[]>;
  count: number;
}

export function conflictMarks(conflicts: readonly AppointmentConflict[] | null): ConflictMarks {
  const appointmentIds = new Set<string>();
  const cells = new Map<string, AppointmentConflict[]>();
  for (const c of conflicts ?? []) {
    appointmentIds.add(c.appointmentId);
    for (const day of daysOf({ startsAt: c.startsAt, endsAt: c.endsAt })) {
      const k = cellKey(c.membershipId, day);
      cells.set(k, [...(cells.get(k) ?? []), c]);
    }
  }
  return { appointmentIds, cells, count: appointmentIds.size };
}

// ---------------- Trạng thái ----------------
export function nextStatuses(status: WorkStatus): readonly WorkStatus[] {
  return STATUS_TRANSITIONS[status];
}

// Chữ trên nút chuyển (động từ); nhãn trạng thái vẫn lấy WORK_STATUS_LABELS.
export const TRANSITION_LABELS: Record<WorkStatus, string> = {
  DRAFT: 'Về nháp',
  PENDING_CONFIRMATION: 'Chuyển chờ xác nhận',
  CONFIRMED: 'Xác nhận',
  IN_PROGRESS: 'Bắt đầu làm',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Huỷ lịch',
  NO_SHOW: 'Khách không đến',
};

// ---------------- Tải của thợ trong ngày (chế độ B, khung "Thợ trong ngày") ----------------
export interface DayLoad {
  count: number;
  minutes: number;
  bars: { id: string; startMin: number; endMin: number; tone: Tone; blocking: boolean }[];
}

export function dayLoad(appointments: readonly Appointment[], laneId: string, day: DayKey): DayLoad {
  const mine = appointmentsOfDay(appointments, day).filter((a) => laneIdsOf(a).includes(laneId));
  let minutes = 0;
  const bars: DayLoad['bars'] = [];
  for (const a of mine) {
    const s = a.staff.find((x) => x.membershipId === laneId);
    const start = Math.max(0, minutesFromDayStart(s?.blockStart ?? a.startsAt, day));
    const end = Math.min(24 * 60, minutesFromDayStart(s?.blockEnd ?? a.endsAt, day));
    const workStart = Math.max(0, minutesFromDayStart(a.startsAt, day));
    const workEnd = Math.min(24 * 60, minutesFromDayStart(a.endsAt, day));
    minutes += Math.max(0, workEnd - workStart);
    bars.push({ id: a.id, startMin: start, endMin: end, tone: toneOf(a.title), blocking: s ? s.isBlocking : isBlocking(a) });
  }
  return { count: mine.length, minutes, bars };
}
