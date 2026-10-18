import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import type { RoleView } from '../../api/org';
import type { PayRateRow, Service, ServicePackage, MakeupSubject, StaffMember, StaffTier, StaffUpdateInput, Vnd } from '../../api/types';

// Logic thuần của màn Thợ makeup (C2 mục 1) — tách khỏi giao diện để thử bằng vitest.

// ---------------- Quyền (C2 mục 1.6) ----------------
export interface StaffPerms {
  read: boolean;
  write: boolean;
  // Đổi bậc lương: staff.write VÀ payroll.write (máy chủ kiểm cả hai).
  changeTier: boolean;
  files: boolean;
  invite: boolean;
  rolesRead: boolean;
  payrollRead: boolean;
  payrollWrite: boolean;
  catalogRead: boolean;
}

export function staffPerms(has: (p: Permission) => boolean): StaffPerms {
  return {
    read: has('staff.read'),
    write: has('staff.write'),
    changeTier: has('staff.write') && has('payroll.write'),
    files: has('files.write'),
    invite: has('members.invite'),
    rolesRead: has('roles.read'),
    payrollRead: has('payroll.read'),
    payrollWrite: has('payroll.write'),
    catalogRead: has('catalog.read'),
  };
}

// Dòng của chính mình: không tự đổi bậc (trừ chủ tài khoản — vai trò owner). Trả lý do khoá, hoặc null.
export function tierLockReason(perms: StaffPerms, row: StaffMember, me: { membershipId: string; roleKeys: readonly string[] }): string | null {
  if (!perms.changeTier) return 'Đổi bậc lương cần quyền đặt tiền công';
  if (row.membershipId === me.membershipId && !me.roleKeys.includes('owner')) return 'Không tự đổi bậc của mình';
  return null;
}

// ---------------- Nhóm thợ theo bậc ----------------
export const ALL_GROUP = 'tat-ca';
export const UNASSIGNED_GROUP = 'chua-gan';

export function groupStaff(staff: readonly StaffMember[], group: string): StaffMember[] {
  if (group === ALL_GROUP) return [...staff];
  if (group === UNASSIGNED_GROUP) return staff.filter((s) => s.tier === null);
  return staff.filter((s) => s.tier?.id === group);
}

export function groupTitle(group: string, tiers: readonly StaffTier[]): string | null {
  if (group === ALL_GROUP) return 'Tất cả thợ';
  if (group === UNASSIGNED_GROUP) return 'Chưa gán bậc';
  return tiers.find((t) => t.id === group)?.name ?? null;
}

export function sortTiers(tiers: readonly StaffTier[]): StaffTier[] {
  return [...tiers].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'));
}

// Ô chọn bậc: "Không có bậc" + các bậc đang dùng. Thợ đang ở bậc đã ẩn thì thêm đúng bậc đó (khoá) để ô không nói sai.
export function tierOptions(tiers: readonly StaffTier[], current: StaffMember['tier']) {
  const opts = [{ value: '', label: 'Không có bậc', disabled: false }];
  for (const t of sortTiers(tiers)) if (t.isActive) opts.push({ value: t.id, label: t.name, disabled: false });
  if (current && !current.isActive) opts.push({ value: current.id, label: `${current.name} · đang ẩn`, disabled: true });
  return opts;
}

// ---------------- Vai trò ----------------
// Tên vai trò: từ GET /roles nếu có quyền roles.read, không thì tên vai trò hệ thống; vai trò tự đặt mà không có
// roles.read thì hiện mã (đề xuất C2 1.8-3: GET /staff trả kèm tên vai trò).
export function roleName(key: string, roles: readonly RoleView[] | null): string {
  const r = roles?.find((x) => x.key === key);
  if (r) return r.name;
  return (SYSTEM_ROLES as Record<string, { name: string } | undefined>)[key]?.name ?? key;
}

export function roleNames(keys: readonly string[], roles: readonly RoleView[] | null): string {
  return keys.map((k) => roleName(k, roles)).join(', ');
}

// ---------------- Hồ sơ thợ: chỉ gửi trường đã đổi ----------------
export interface ProfileDraft {
  displayName: string;
  phone: string;
  tierId: string;
  isBookable: boolean;
  // undefined = không đổi ảnh; null = bỏ ảnh; chuỗi = mã tệp vừa tải lên.
  avatarFileId: string | null | undefined;
}

export function profileDraftOf(s: StaffMember): ProfileDraft {
  return {
    // displayName của máy chủ đã thay bằng tên tài khoản khi trống → ô hiện đúng tên đang dùng.
    displayName: s.displayName,
    phone: s.phone ?? '',
    tierId: s.tier?.id ?? '',
    isBookable: s.isBookable,
    avatarFileId: undefined,
  };
}

export function profilePatch(s: StaffMember, d: ProfileDraft, opts: { canWritePhone: boolean; canChangeTier: boolean }): StaffUpdateInput {
  const out: StaffUpdateInput = {};
  const name = d.displayName.trim();
  if (name !== s.displayName) out.displayName = name === '' || name === s.fullName ? null : name;
  if (opts.canWritePhone) {
    const phone = d.phone.trim();
    if (phone !== (s.phone ?? '')) out.phone = phone === '' ? null : phone;
  }
  if (opts.canChangeTier && d.tierId !== (s.tier?.id ?? '')) out.tierId = d.tierId === '' ? null : d.tierId;
  if (d.isBookable !== s.isBookable) out.isBookable = d.isBookable;
  if (d.avatarFileId !== undefined) out.avatarFileId = d.avatarFileId;
  return out;
}

// ---------------- Bậc lương: chỉ gửi bậc đã đổi ----------------
export interface TierDraft {
  id: string;
  name: string;
  isActive: boolean;
}

// draft: thứ tự trên màn = thứ tự mới (sortOrder = vị trí). Trả mỗi bậc đã đổi một thân PATCH.
export function tierPatches(before: readonly StaffTier[], draft: readonly TierDraft[]) {
  const byId = new Map(before.map((t) => [t.id, t]));
  const sorted = sortTiers(before);
  const out: { tierId: string; input: { name?: string; sortOrder?: number; isActive?: boolean } }[] = [];
  // Chỉ đánh số lại khi thứ tự thật sự đổi, để đổi tên một bậc không kéo theo PATCH mọi bậc.
  const orderChanged = draft.some((x, j) => sorted[j]?.id !== x.id);
  draft.forEach((d, i) => {
    const t = byId.get(d.id);
    if (!t) return;
    const input: { name?: string; sortOrder?: number; isActive?: boolean } = {};
    const name = d.name.trim();
    if (name !== t.name) input.name = name;
    if (orderChanged && t.sortOrder !== i) input.sortOrder = i;
    if (d.isActive !== t.isActive) input.isActive = d.isActive;
    if (Object.keys(input).length > 0) out.push({ tierId: d.id, input });
  });
  return out;
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it as T);
  return next;
}

// ---------------- Tiền công theo gói ----------------
export type OwnerKind = 'goi' | 'dich-vu';

export interface PayOwner {
  kind: OwnerKind;
  id: string;
  name: string;
  price: Vnd | null;
  // Dòng phụ trên đầu thẻ: "Gói · Cô dâu" / "Gói · Mọi nhân vật" / "Dịch vụ phụ".
  groupLabel: string;
}

export interface PayOwnerGroup {
  key: string;
  label: string;
  owners: PayOwner[];
}

// Nhóm cột trái: "Gói · {nhân vật}" theo sortOrder của nhân vật; gói không có nhân vật → "Gói · Mọi nhân vật" (cuối nhóm
// gói); "Dịch vụ phụ" cuối cùng. Trong nhóm giữ thứ tự máy chủ trả.
export function groupOwners(packages: readonly ServicePackage[], subjects: readonly MakeupSubject[], addons: readonly Service[]): PayOwnerGroup[] {
  const groups: PayOwnerGroup[] = [];
  const subjectsSorted = [...subjects].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'));
  const known = new Set(subjectsSorted.map((s) => s.id));
  for (const s of subjectsSorted) {
    const owners = packages
      .filter((p) => p.subjectId === s.id)
      .map((p) => ({ kind: 'goi' as const, id: p.id, name: p.name, price: p.currentPrice?.unitPrice ?? null, groupLabel: `Gói · ${s.name}` }));
    if (owners.length > 0) groups.push({ key: `nv-${s.id}`, label: `Gói · ${s.name}`, owners });
  }
  // Gói có nhân vật không còn trong danh sách nhân vật (đã ẩn) vẫn phải hiện: dùng tên nhân vật đi kèm gói.
  const orphanSubjects = new Map<string, string>();
  for (const p of packages) if (p.subjectId && !known.has(p.subjectId)) orphanSubjects.set(p.subjectId, p.subject?.name ?? 'Nhân vật đã ẩn');
  for (const [id, name] of orphanSubjects) {
    const owners = packages
      .filter((p) => p.subjectId === id)
      .map((p) => ({ kind: 'goi' as const, id: p.id, name: p.name, price: p.currentPrice?.unitPrice ?? null, groupLabel: `Gói · ${name}` }));
    groups.push({ key: `nv-${id}`, label: `Gói · ${name}`, owners });
  }
  const any = packages.filter((p) => p.subjectId === null);
  if (any.length > 0) {
    groups.push({
      key: 'nv-moi',
      label: 'Gói · Mọi nhân vật',
      owners: any.map((p) => ({ kind: 'goi', id: p.id, name: p.name, price: p.currentPrice?.unitPrice ?? null, groupLabel: 'Gói · Mọi nhân vật' })),
    });
  }
  if (addons.length > 0) {
    groups.push({
      key: 'dvp',
      label: 'Dịch vụ phụ',
      owners: addons.map((s) => ({ kind: 'dich-vu', id: s.id, name: s.name, price: s.currentPrice?.unitPrice ?? null, groupLabel: 'Dịch vụ phụ' })),
    });
  }
  return groups;
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi');
}

// Lọc phía máy (C2 1.3): không phân biệt hoa thường, không dấu.
export function filterOwnerGroups(groups: readonly PayOwnerGroup[], q: string): PayOwnerGroup[] {
  const k = fold(q.trim());
  if (!k) return [...groups];
  return groups
    .map((g) => ({ ...g, owners: g.owners.filter((o) => fold(o.name).includes(k)) }))
    .filter((g) => g.owners.length > 0);
}

export type RateDraft = Record<string, Vnd | null>;

export function rateDraftOf(items: readonly PayRateRow[]): RateDraft {
  return Object.fromEntries(items.map((r) => [r.tier.id, r.amount]));
}

// PUT chỉ các bậc đã đổi (C2 1.3).
export function changedRates(items: readonly PayRateRow[], draft: RateDraft): { tierId: string; amount: Vnd | null }[] {
  const out: { tierId: string; amount: Vnd | null }[] = [];
  for (const r of items) {
    const v = draft[r.tier.id];
    if (v === undefined) continue;
    if (v !== r.amount) out.push({ tierId: r.tier.id, amount: v });
  }
  return out;
}

// 400 khi lưu tiền công: details.tierIds = các bậc lỗi.
export function errorTierIds(details: unknown): string[] {
  const ids = (details as { tierIds?: unknown } | undefined)?.tierIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

// ---------------- Ngày giờ theo múi giờ tổ chức ----------------
export function formatDateIn(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
