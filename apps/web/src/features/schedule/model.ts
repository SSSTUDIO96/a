// Logic thuần của màn Lịch (không React): chế độ xem, hàng thợ, xếp ca vào ô, xếp làn cho ca chồng giờ, trùng lịch 409.
import { isBlockingStatus, STATUS_TRANSITIONS, type Permission, type WorkStatus } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { Appointment, AppointmentConflict, StaffMember } from '../../api/types';
import { staffShortNames, type StaffRosterEntry } from '../../ui/staffName';
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

// ---------------- Màu ca theo NHÂN VẬT ----------------
// Quyết định của điều phối (thay anh Chiến): tô màu theo subjectName (nhân vật trên dòng hợp đồng gắn với ca),
// KHÔNG đoán theo chữ trong tên ca. Ca không có nhân vật → "Khác". Bảng nhân vật → màu chỉ nằm ở đây (tên màu) và
// schedule.css khối ".ws-sw-*" (giá trị màu); mọi chỗ tô màu theo nhân vật trên màn Lịch đi qua swatchOf.
// 12 màu (việc tồn 3): 6 màu đầu GIỮ NGUYÊN (người dùng đã quen), 6 màu thêm cho nhân vật tổ chức tự thêm — đã đo
// ΔE2000 từng cặp ≥ 14 và độ tương phản chữ ≥ 4,5 trên nền nhạt của chính màu và trên nền trắng (subjectColors.test.ts).
export const SWATCHES = ['rose', 'violet', 'amber', 'green', 'blue', 'taupe', 'brick', 'petrol', 'olive', 'plum', 'forest', 'brown'] as const;
export type Swatch = (typeof SWATCHES)[number] | 'other';
export const OTHER_SUBJECT_LABEL = 'Khác';

// Nhân vật cài sẵn (DEFAULT_MAKEUP_SUBJECTS ở packages/shared) có màu cố định.
const FIXED_SWATCH: Record<string, Swatch> = {
  'cô dâu': 'rose',
  'mẹ cô dâu': 'violet',
  'phù dâu': 'amber',
  'mẹ chú rể': 'green',
  'chú rể': 'blue',
  'khách mời': 'taupe',
};

// Thứ tự cấp màu cho nhân vật tổ chức tự thêm: 6 màu mới trước (xen nóng/lạnh để hai nhân vật liền nhau khác hẳn),
// rồi tới màu cài sẵn mà tổ chức không dùng (đã xoá / đổi tên nhân vật cài sẵn).
const CUSTOM_ORDER: readonly Swatch[] = ['brick', 'petrol', 'olive', 'plum', 'forest', 'brown', 'rose', 'violet', 'amber', 'green', 'blue', 'taupe'];

const norm = (s: string) => s.trim().toLocaleLowerCase('vi');

function hashIndex(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h % SWATCHES.length;
}

// Bảng nhân vật → màu của một tổ chức (nhớ theo chính mảng danh sách — màn giữ một mảng cho tới khi tải lại).
const orgSwatchCache = new WeakMap<readonly string[], ReadonlyMap<string, Swatch>>();

/**
 * Bảng màu theo danh sách nhân vật của tổ chức (thứ tự cố định): 12 nhân vật ĐẦU TIÊN luôn khác màu nhau.
 * - Nhân vật cài sẵn giữ màu cố định ở bất kỳ vị trí nào.
 * - Nhân vật tự thêm trong 12 nhân vật đầu: lần lượt lấy màu còn trống theo CUSTOM_ORDER (bỏ màu của nhân vật cài sẵn
 *   có trong 12 nhân vật đầu) — đủ màu vì 12 nhân vật dùng đúng 12 màu.
 * - Từ nhân vật thứ 13: xoay vòng 12 màu theo vị trí.
 */
export function subjectSwatches(orgSubjects: readonly string[]): ReadonlyMap<string, Swatch> {
  const hit = orgSwatchCache.get(orgSubjects);
  if (hit) return hit;
  const keys = [...new Set(orgSubjects.map(norm).filter(Boolean))];
  const head = keys.slice(0, SWATCHES.length);
  const map = new Map<string, Swatch>();
  const used = new Set<Swatch>();
  for (const k of head) {
    const fixed = FIXED_SWATCH[k];
    if (fixed) {
      map.set(k, fixed);
      used.add(fixed);
    }
  }
  const free = CUSTOM_ORDER.filter((c) => !used.has(c));
  let next = 0;
  for (const k of head) if (!map.has(k)) map.set(k, free[next++] ?? 'other');
  keys.slice(head.length).forEach((k, i) => {
    if (!map.has(k)) map.set(k, FIXED_SWATCH[k] ?? SWATCHES[(head.length + i) % SWATCHES.length] ?? 'other');
  });
  orgSwatchCache.set(orgSubjects, map);
  return map;
}

/**
 * Màu của một nhân vật. `orgSubjects`: tên nhân vật của tổ chức theo thứ tự cố định (sortOrder, GET /makeup-subjects).
 * - null / rỗng → 'other' ("Khác").
 * - Nhân vật cài sẵn → màu cố định ở FIXED_SWATCH.
 * - Nhân vật tổ chức tự thêm → theo bảng subjectSwatches (12 nhân vật đầu khác màu nhau).
 * - Không có trong danh sách (không có quyền xem danh sách, hoặc nhân vật đã bị xoá) → theo băm tên, luôn ra cùng một màu.
 */
export function swatchOf(subjectName: string | null | undefined, orgSubjects: readonly string[] = []): Swatch {
  if (!subjectName || !subjectName.trim()) return 'other';
  const key = norm(subjectName);
  const fixed = FIXED_SWATCH[key];
  if (fixed) return fixed;
  return subjectSwatches(orgSubjects).get(key) ?? SWATCHES[hashIndex(key)] ?? 'other';
}

// Chú thích màu: các nhân vật thật có trong tuần (theo thứ tự danh sách của tổ chức, rồi theo tên), cuối cùng là "Khác".
// Buổi học (sinh từ lớp) có màu riêng "Buổi học" — không tính vào nhân vật / "Khác".
export function legendSubjects(appointments: readonly Pick<Appointment, 'subjectName' | 'kind'>[], orgSubjects: readonly string[] = []): { name: string | null; label: string }[] {
  const names = new Map<string, string>();
  let hasOther = false;
  for (const a of appointments) {
    if (isCourseSession(a)) continue;
    if (a.subjectName && a.subjectName.trim()) names.set(norm(a.subjectName), a.subjectName.trim());
    else hasOther = true;
  }
  const order = (n: string) => {
    const i = orgSubjects.findIndex((x) => norm(x) === norm(n));
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const list = [...names.values()].sort((x, y) => order(x) - order(y) || x.localeCompare(y, 'vi'));
  return [...list.map((n) => ({ name: n, label: n })), ...(hasOther ? [{ name: null, label: OTHER_SUBJECT_LABEL }] : [])];
}

export const KIND_LABELS: Record<Appointment['kind'], string> = {
  MAKEUP: 'Makeup',
  COURSE_SESSION: 'Buổi học',
  INTERNAL: 'Việc nội bộ',
  PERSONAL_BLOCK: 'Bận việc riêng',
  OTHER: 'Việc khác',
};

// Chữ "loại" trên ô ca: tên ca nếu có, không thì loại sự kiện; dòng hợp đồng nhiều người (phù dâu 2 người) thêm "× 2".
// Dùng chung cho mọi chế độ lịch (C lưới tuần qua chipKind, C điện thoại, B ngày, A cột thợ, tooltip, hộp chi tiết).
// quantity null (ca không gắn dòng hợp đồng) hoặc 1 → không ghi gì.
export function kindText(a: Pick<Appointment, 'title' | 'kind' | 'quantity'>): string {
  const qty = quantityText(a);
  return qty ? `${kindLabel(a)} ${qty}` : kindLabel(a);
}

// Tên loại ca (không kèm số lượng): tên ca nếu có, không thì loại sự kiện.
export function kindLabel(a: Pick<Appointment, 'title' | 'kind'>): string {
  return a.title?.trim() || KIND_LABELS[a.kind];
}

// "× n" khi dòng hợp đồng gắn với ca có số lượng > 1; còn lại null. Ô ca hẹp (lưới C) vẽ phần này thành thẻ riêng KHÔNG
// bị cắt, chỉ tên loại ca được rút gọn "…".
export function quantityText(a: Pick<Appointment, 'quantity'>): string | null {
  return a.quantity !== null && a.quantity !== undefined && a.quantity > 1 ? `× ${a.quantity}` : null;
}

// ---------------- Buổi học (việc tồn 6) ----------------
// Buổi học sinh từ lớp (nút "Đưa buổi học lên Lịch" ở Khoá & lớp): màu và nhãn riêng "Buổi học", dòng tên là tên lớp.
export const COURSE_SESSION_LABEL = KIND_LABELS.COURSE_SESSION;

export function isCourseSession(a: Pick<Appointment, 'kind'>): boolean {
  return a.kind === 'COURSE_SESSION';
}

// Dòng "ai" trên ô ca: tên khách; buổi học thì tên lớp. Không có → null.
export function whoText(a: Pick<Appointment, 'customer' | 'courseClass'>): string | null {
  return a.customer?.fullName ?? a.courseClass?.name ?? null;
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
  catalogRead: boolean;
}

export function accessFrom(has: (p: Permission) => boolean): ScheduleAccess {
  return {
    readAll: has('schedule.read_all'),
    write: has('schedule.write'),
    staffRead: has('staff.read'),
    customersRead: has('customers.read'),
    customersWrite: has('customers.write'),
    contractsRead: has('contracts.read'),
    catalogRead: has('catalog.read'),
  };
}

// ---------------- Hàng / cột thợ ----------------
export const UNASSIGNED = 'chua-co-tho';

export interface StaffLane {
  membershipId: string;
  // Tên hiển thị (studio đặt, chưa đặt thì là họ tên) — tên đầy đủ ở title / tên đọc / chip chế độ B.
  name: string;
  // Họ tên tài khoản để rút tên ngắn (ui/staffName.ts). undefined = không biết (hàng tự dựng từ tên tài khoản) → không đoán.
  fullName?: string | null;
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
    fullName: m.fullName,
    initials: m.initials,
    avatarUrl: m.avatarUrl,
    tierName: m.tier?.name ?? null,
  });
  // Thợ đang có ca: tên hiển thị, họ tên và ảnh lấy thẳng từ ca (máy chủ gửi displayName, fullName, avatarUrl).
  const fromAppointments = new Map<string, { name: string; fullName: string; avatarUrl: string | null }>();
  for (const a of appointments) {
    for (const s of a.staff) {
      if (!fromAppointments.has(s.membershipId)) {
        fromAppointments.set(s.membershipId, { name: s.displayName, fullName: s.fullName, avatarUrl: s.avatarUrl });
      }
    }
  }

  if (!readAll) {
    const me = staff?.find((m) => m.membershipId === self.membershipId);
    if (me) return [fromStaff(me)];
    const mine = fromAppointments.get(self.membershipId);
    // Không có danh sách thợ lẫn ca: chỉ biết tên tài khoản, không biết studio có đặt tên hiển thị không → không mang fullName.
    if (mine) return [{ membershipId: self.membershipId, name: mine.name, fullName: mine.fullName, avatarUrl: mine.avatarUrl, tierName: null }];
    return [{ membershipId: self.membershipId, name: self.name, avatarUrl: null, tierName: null }];
  }

  const lanes: StaffLane[] = [];
  const seen = new Set<string>();
  for (const m of staff ?? []) {
    if ((m.isBookable && isMakeupStaff(m)) || fromAppointments.has(m.membershipId)) {
      lanes.push(fromStaff(m));
      seen.add(m.membershipId);
    }
  }
  for (const [membershipId, p] of fromAppointments) {
    if (!seen.has(membershipId)) lanes.push({ membershipId, name: p.name, fullName: p.fullName, avatarUrl: p.avatarUrl, tierName: null });
  }
  return lanes;
}

/**
 * N3 + M3 + R2: tên ngắn trên đầu hàng / đầu cột thợ — MỘT luật cho lưới C (1440 và 390), cột thợ A và Hợp đồng:
 * hàm chung ui/staffName.ts staffShortNames (staffShortName + hai người trùng tên ngắn thì giữ tên hiển thị đầy đủ).
 * Màn Lịch xét trùng trên SỔ THỢ (danh sách thợ của tổ chức ∪ thợ của các ca — lanesRoster), không chỉ những hàng đang
 * hiện, để bộ lọc thợ hay tuần đang xem không đổi tên một người. Hàm này là bản dự phòng khi chỉ có các hàng.
 */
export function laneShortNames(lanes: readonly Pick<StaffLane, 'membershipId' | 'name' | 'fullName'>[]): Map<string, string> {
  return staffShortNames(lanes.map((l) => ({ membershipId: l.membershipId, displayName: l.name, fullName: l.fullName })));
}

// Sổ thợ của màn Lịch (R2/R4): danh sách thợ của tổ chức (GET /staff, khi có staff.read) ∪ mọi hàng (gồm thợ của các ca).
export function lanesRoster(staff: readonly StaffMember[] | null, lanes: readonly StaffLane[]): StaffRosterEntry[] {
  return [
    ...(staff ?? []).map((m) => ({ membershipId: m.membershipId, displayName: m.displayName, fullName: m.fullName, initials: m.initials })),
    ...lanes.map((l) => ({ membershipId: l.membershipId, displayName: l.name, fullName: l.fullName, initials: l.initials })),
  ];
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
  bars: { id: string; startMin: number; endMin: number; subjectName: string | null; blocking: boolean; course: boolean }[];
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
    bars.push({ id: a.id, startMin: start, endMin: end, subjectName: a.subjectName, blocking: s ? s.isBlocking : isBlocking(a), course: isCourseSession(a) });
  }
  return { count: mine.length, minutes, bars };
}
