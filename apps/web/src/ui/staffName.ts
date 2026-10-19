import { avatarColorIndex, initialsOf } from './avatarColor';

// Tên ngắn của thợ (biên bản nghiệm thu lại M3) — MỘT hàm cho mọi chỗ rút tên ngắn trên web.
//
// Máy chủ trả `displayName` = tên hiển thị studio đặt cho thợ, chưa đặt thì là họ tên (staff/common.ts presentStaff,
// schedule/service.ts presentAppointment), kèm `fullName` = họ tên tài khoản ở những chỗ có gửi.
// Luật:
// - Studio đã đặt tên hiển thị (khác họ tên) → dùng NGUYÊN tên hiển thị: "Linh Trần", "Hà Makeup", "Giang".
// - Chưa đặt (tên hiển thị trùng họ tên) → rút gọn họ tên thành tiếng cuối: "Nguyễn Thu Hà" → "Hà".
// - Không biết họ tên (chỗ máy chủ không gửi fullName) → không đoán: dùng nguyên tên hiển thị.
export interface StaffNameSource {
  displayName: string;
  // undefined / null = máy chủ không gửi họ tên ở chỗ này.
  fullName?: string | null;
}

const squash = (s: string) => s.trim().replace(/\s+/g, ' ');

export function staffShortName({ displayName, fullName }: StaffNameSource): string {
  const shown = squash(displayName);
  const full = fullName == null ? '' : squash(fullName);
  if (full === '') return shown;
  if (shown !== '' && shown !== full) return shown;
  const words = full.split(' ');
  return words[words.length - 1] ?? full;
}

// ---------------------------------------------------------------------------------------------------------------------
// R2 + R4 (biên bản nghiệm thu lần 3): MỘT chỗ xử lý trùng tên ngắn và trùng màu ảnh đại diện, Lịch và Hợp đồng cùng dùng.
//
// TẬP ĐỂ XÉT TRÙNG ("sổ thợ" — roster) = mọi thợ của tổ chức mà màn đang biết:
//   danh sách thợ của tổ chức (GET /staff: mọi thành viên ĐANG HOẠT ĐỘNG, khi người xem có staff.read)
//   ∪ những người đang hiện trên màn (thợ của các ca trong tuần ở Lịch; thợ của các dòng + ô chọn thợ ở Hợp đồng).
// Vì sao chọn tập này, không chọn "những hàng đang hiện":
//   - Có staff.read thì hai màn cùng có trọn danh sách thợ → cùng một tập → một người ra một tên, một màu ở mọi màn,
//     không đổi theo bộ lọc thợ, theo tuần đang xem, hay theo số thợ trên một dòng hợp đồng.
//   - Người đã rời tổ chức (không còn trong GET /staff) nhưng còn trên ca/hợp đồng cũ vẫn được tính, vì màn đang hiện họ.
// Giới hạn: không có staff.read thì màn chỉ biết những người đang hiện — hai màn có thể biết khác nhau nên tên/màu của
// người trùng có thể khác giữa hai màn. Người xem như vậy chỉ thấy lịch của mình nên hiếm khi gặp.

export interface StaffRosterEntry extends StaffNameSource {
  membershipId: string;
  // Chữ tắt máy chủ gửi; thiếu thì tính bằng initialsOf(displayName) — đúng chữ Avatar sẽ vẽ.
  initials?: string | null;
}

// Gộp các nguồn theo membershipId: giữ bản đầu, bổ sung họ tên / chữ tắt nếu bản đầu thiếu.
function mergeRoster(roster: Iterable<StaffRosterEntry>): StaffRosterEntry[] {
  const byId = new Map<string, StaffRosterEntry>();
  for (const e of roster) {
    const had = byId.get(e.membershipId);
    if (!had) byId.set(e.membershipId, { membershipId: e.membershipId, displayName: e.displayName, fullName: e.fullName, initials: e.initials });
    else {
      if (had.fullName == null && e.fullName != null) had.fullName = e.fullName;
      if (had.initials == null && e.initials != null) had.initials = e.initials;
    }
  }
  return [...byId.values()];
}

/**
 * Tên ngắn của từng người trong sổ: staffShortName; hai người KHÁC NHAU ra cùng tên ngắn thì cả hai giữ tên hiển thị
 * đầy đủ (không đoán). "Phạm Thu Hà" + "Nguyễn Thu Hà" (chưa đặt tên hiển thị) → hai tên đầy đủ, ở Lịch lẫn Hợp đồng.
 */
export function staffShortNames(roster: Iterable<StaffRosterEntry>): Map<string, string> {
  const list = mergeRoster(roster);
  const shortOf = new Map(list.map((e) => [e.membershipId, staffShortName(e)]));
  const count = new Map<string, number>();
  for (const s of shortOf.values()) count.set(s, (count.get(s) ?? 0) + 1);
  return new Map(list.map((e) => {
    const s = shortOf.get(e.membershipId) ?? '';
    return [e.membershipId, (count.get(s) ?? 0) > 1 ? squash(e.displayName) : s];
  }));
}

// Số màu ảnh đại diện: --av-0 … --av-5 (ui/Avatar.tsx avatarColorIndex lấy dư 6).
export const AVATAR_TONES = 6;
// Khoá màu cho từng chỉ số: chuỗi mà chính avatarColorIndex băm ra đúng chỉ số đó (tìm một lần, không chép luật băm).
const TONE_KEYS: string[] = Array.from({ length: AVATAR_TONES }, (_, i) => {
  for (let n = 0; n < 10_000; n += 1) if (avatarColorIndex(`tone-${n}`) === i) return `tone-${n}`;
  throw new Error(`Không tìm được khoá màu cho --av-${i}`);
});

/**
 * Màu ảnh đại diện (R4) → khoá màu (colorKey) cho <Avatar>.
 * Cách chọn:
 *   1. Màu gốc = màu băm từ mã thành viên như trước (avatarColorIndex(membershipId)) — ai không đụng hàng thì giữ màu cũ.
 *   2. Gom sổ theo CHỮ TẮT đang vẽ (initials ?? initialsOf(displayName)). Trong mỗi nhóm, xếp theo mã thành viên
 *      (thứ tự cố định, không phụ thuộc thứ tự API trả hay bộ lọc), lần lượt lấy màu gốc; màu đó đã có người cùng chữ
 *      tắt lấy rồi thì lấy màu kế tiếp còn trống (vòng tròn 0…5).
 * Bảo đảm: hai người khác nhau trong sổ có cùng chữ tắt thì khác màu, miễn nhóm cùng chữ tắt có ≤ 6 người.
 * Không chọn "màu theo thứ tự trong danh sách thợ" (người thứ i → màu i mod 6) vì: tổ chức > 6 thợ vẫn có thể trùng
 * (người 1 và 7 cùng chữ tắt), và thêm/bớt một thợ làm đổi màu của mọi người xếp sau.
 * Giới hạn: > 6 người cùng chữ tắt thì từ người thứ 7 lặp màu; người khác chữ tắt vẫn có thể trùng màu (đã phân biệt bằng chữ).
 */
export function staffAvatarColorKeys(roster: Iterable<StaffRosterEntry>): Map<string, string> {
  const list = mergeRoster(roster).sort((a, b) => (a.membershipId < b.membershipId ? -1 : a.membershipId > b.membershipId ? 1 : 0));
  const taken = new Map<string, Set<number>>();
  const out = new Map<string, string>();
  for (const e of list) {
    const ini = (e.initials ?? '').trim() || initialsOf(e.displayName);
    const used = taken.get(ini) ?? new Set<number>();
    taken.set(ini, used);
    const base = avatarColorIndex(e.membershipId);
    let pick = base;
    for (let step = 0; step < AVATAR_TONES; step += 1) {
      const i = (base + step) % AVATAR_TONES;
      if (!used.has(i)) {
        pick = i;
        break;
      }
    }
    used.add(pick);
    out.set(e.membershipId, TONE_KEYS[pick] ?? e.membershipId);
  }
  return out;
}

export interface StaffNaming {
  // Tên ngắn đã xử lý trùng; người ngoài sổ → staffShortName của chính họ.
  shortName(p: StaffNameSource & { membershipId: string }): string;
  // Khoá màu cho <Avatar colorKey>; người ngoài sổ → mã thành viên (màu băm như cũ).
  colorKey(membershipId: string): string;
}

export function staffNaming(roster: Iterable<StaffRosterEntry>): StaffNaming {
  const list = mergeRoster(roster);
  const names = staffShortNames(list);
  const colors = staffAvatarColorKeys(list);
  return {
    shortName: (p) => names.get(p.membershipId) ?? staffShortName(p),
    colorKey: (id) => colors.get(id) ?? id,
  };
}
