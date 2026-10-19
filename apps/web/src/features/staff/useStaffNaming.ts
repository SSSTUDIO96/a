import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { listStaff } from '../../api/staff';
import type { StaffMember } from '../../api/types';
import { usePermissionsContext } from '../../layout/usePermissions';
import { initialsOf } from '../../ui/avatarColor';
import { staffNaming, type StaffNaming, type StaffRosterEntry } from '../../ui/staffName';

// L2/L3 + việc tồn 48 (biên bản nghiệm thu lần 4): MỌI chỗ vẽ ảnh đại diện thợ lấy màu + chữ tắt qua hàm chung
// ui/staffName.ts staffNaming(...) trên CÙNG một sổ thợ như Lịch và Hợp đồng:
//   sổ thợ = danh sách thợ của tổ chức (GET /staff, khi người xem có staff.read) ∪ những người màn đang hiện.
// Lịch (features/schedule/index.tsx) và Hợp đồng (ContractEditor) tự tải GET /staff; các màn còn lại (Thợ makeup,
// Tiền công, Bảng giá → Tiền công, Khoá học, thanh trái / ngăn "Thêm" của khung) dùng móc dưới đây. Danh sách được
// giữ chung theo tổ chức trong bộ nhớ (một yêu cầu cho cả khung, không mỗi thẻ một yêu cầu), làm mới sau 60 giây.
// Màn Thợ makeup đã có trọn danh sách → đẩy vào đây (primeStaffRoster) để thanh trái đổi màu theo ngay khi sửa thợ.

const FRESH_MS = 60_000;

interface RosterSlot {
  items: StaffMember[] | null;
  loading: boolean;
  at: number;
}

const slots = new Map<string, RosterSlot>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Màn đã tải trọn GET /staff (không lọc) → dùng luôn cho mọi chỗ khác của tổ chức đó. */
export function primeStaffRoster(orgId: string, items: StaffMember[]): void {
  const had = slots.get(orgId);
  if (had?.items === items) return;
  slots.set(orgId, { items, loading: false, at: Date.now() });
  emit();
}

function ensureRoster(orgId: string): void {
  const had = slots.get(orgId);
  if (had?.loading) return;
  if (had && Date.now() - had.at < FRESH_MS) return;
  slots.set(orgId, { items: had?.items ?? null, loading: true, at: had?.at ?? 0 });
  listStaff(orgId)
    .then((r) => primeStaffRoster(orgId, r.items))
    .catch(() => {
      // Lỗi (mạng, 403): giữ bản cũ nếu có; chưa có thì màu theo những người màn đang hiện. Không thử lại liền tay.
      slots.set(orgId, { items: slots.get(orgId)?.items ?? null, loading: false, at: Date.now() });
    });
}

/** Danh sách thợ của tổ chức (dùng chung). enabled = người xem có staff.read; không thì null. */
export function useOrgStaffRoster(orgId: string | null, enabled: boolean): StaffMember[] | null {
  const items = useSyncExternalStore(subscribe, () => (orgId && enabled ? (slots.get(orgId)?.items ?? null) : null));
  useEffect(() => {
    if (orgId && enabled) ensureRoster(orgId);
  }, [orgId, enabled]);
  return items;
}

export function rosterEntryOf(m: { membershipId: string; displayName: string; fullName?: string | null; initials?: string | null }): StaffRosterEntry {
  return { membershipId: m.membershipId, displayName: m.displayName, fullName: m.fullName, initials: m.initials };
}

/** Sổ thợ = GET /staff ∪ `shown` (những người màn đang hiện) → staffNaming (tên ngắn + khoá màu). */
export function useStaffNaming(orgId: string | null, enabled: boolean, shown?: readonly StaffRosterEntry[]): StaffNaming {
  const staff = useOrgStaffRoster(orgId, enabled);
  return useMemo(() => staffNaming([...(staff ?? []).map(rosterEntryOf), ...(shown ?? [])]), [staff, shown]);
}

/** Như useStaffNaming, lấy tổ chức đang mở + quyền staff.read từ khung (PermissionsProvider). */
export function useCurrentOrgStaffNaming(shown?: readonly StaffRosterEntry[]): StaffNaming & { roster: StaffMember[] | null } {
  const perms = usePermissionsContext();
  const orgId = perms.state.status === 'ready' ? perms.state.org.id : null;
  const enabled = perms.has('staff.read');
  const naming = useStaffNaming(orgId, enabled, shown);
  const roster = useOrgStaffRoster(orgId, enabled);
  return useMemo(() => ({ ...naming, roster }), [naming, roster]);
}

/**
 * Chữ tắt của một thợ — đúng chữ Lịch vẽ: chữ máy chủ gửi (tính từ TÊN HIỂN THỊ), thiếu thì initialsOf(tên hiển thị).
 * Không bao giờ rút từ chuỗi đã ghép thêm chữ ("Phạm Thu Hà · thợ chính" → "PC" là lỗi L3).
 */
export function staffInitials(p: { displayName: string; initials?: string | null }): string {
  return (p.initials ?? '').trim() || initialsOf(p.displayName);
}

/**
 * Ảnh của chính người đang đăng nhập (thanh trái, ngăn "Thêm" trên điện thoại): cùng màu + chữ tắt như dòng của họ ở
 * Thợ makeup / Lịch. Chưa có sổ thợ (thiếu staff.read, đang tải) → màu băm theo mã thành viên, chữ tắt theo họ tên.
 */
export function useSelfStaffAvatar(membershipId: string): { naming: StaffNaming; selfInitials: string | undefined } {
  const naming = useCurrentOrgStaffNaming();
  const self = naming.roster?.find((m) => m.membershipId === membershipId);
  return { naming, selfInitials: self ? staffInitials(self) : undefined };
}
