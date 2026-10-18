import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import type { PayRateRow, StaffMember, StaffTier } from '../../api/types';
import {
  changedRates,
  errorTierIds,
  filterOwnerGroups,
  formatDateIn,
  groupOwners,
  groupStaff,
  moveItem,
  profileDraftOf,
  profilePatch,
  roleName,
  staffPerms,
  tierLockReason,
  tierOptions,
  tierPatches,
} from './logic';

const T = '2026-10-18T00:00:00.000Z';
const tier = (id: string, name: string, sortOrder: number, isActive = true, staffCount = 0): StaffTier => ({ id, name, sortOrder, isActive, staffCount, createdAt: T, updatedAt: T });
const member = (id: string, name: string, t: StaffMember['tier'] = null, extra: Partial<StaffMember> = {}): StaffMember => ({
  membershipId: id,
  userId: `u-${id}`,
  fullName: name,
  displayName: name,
  initials: 'XX',
  avatarUrl: null,
  phone: null,
  tier: t,
  isBookable: true,
  hasProfile: true,
  status: 'ACTIVE',
  roleKeys: ['artist'],
  ...extra,
});
const perms = (role: keyof typeof SYSTEM_ROLES) => staffPerms((p: Permission) => SYSTEM_ROLES[role].permissions.includes(p));

describe('quyền theo vai trò mẫu (C2 1.6)', () => {
  it('chủ: đủ; quản lý: sửa thợ nhưng không đổi bậc, không xem tiền công; kế toán: xem tiền công; thợ: chỉ xem', () => {
    expect(perms('owner')).toMatchObject({ write: true, changeTier: true, payrollRead: true, payrollWrite: true, invite: true });
    expect(perms('manager')).toMatchObject({ write: true, changeTier: false, payrollRead: false, invite: true });
    expect(perms('accountant')).toMatchObject({ write: false, changeTier: false, payrollRead: true, payrollWrite: false });
    expect(perms('artist')).toMatchObject({ read: true, write: false, changeTier: false, payrollRead: false, invite: false, files: false });
  });

  it('dòng của chính mình khoá đổi bậc, trừ chủ tài khoản', () => {
    const p = perms('admin');
    const row = member('m-1', 'Hà');
    expect(tierLockReason(p, row, { membershipId: 'm-1', roleKeys: ['admin'] })).toBe('Không tự đổi bậc của mình');
    expect(tierLockReason(p, row, { membershipId: 'm-1', roleKeys: ['owner'] })).toBeNull();
    expect(tierLockReason(p, row, { membershipId: 'm-2', roleKeys: ['admin'] })).toBeNull();
    expect(tierLockReason(perms('manager'), row, { membershipId: 'm-2', roleKeys: ['manager'] })).toBe('Đổi bậc lương cần quyền đặt tiền công');
  });
});

describe('nhóm thợ, ô chọn bậc', () => {
  const tiers = [tier('t2', 'Thợ phụ', 1), tier('t1', 'Thợ chính', 0), tier('t3', 'CTV', 2, false)];
  const staff = [member('a', 'A', { id: 't1', name: 'Thợ chính', isActive: true }), member('b', 'B'), member('c', 'C', { id: 't3', name: 'CTV', isActive: false })];

  it('tất cả / chưa gán bậc / một bậc', () => {
    expect(groupStaff(staff, 'tat-ca').map((s) => s.membershipId)).toEqual(['a', 'b', 'c']);
    expect(groupStaff(staff, 'chua-gan').map((s) => s.membershipId)).toEqual(['b']);
    expect(groupStaff(staff, 't1').map((s) => s.membershipId)).toEqual(['a']);
  });

  it('ô chọn: "Không có bậc" + bậc đang dùng theo thứ tự; thợ ở bậc đã ẩn thì có thêm bậc đó (khoá)', () => {
    expect(tierOptions(tiers, null).map((o) => o.label)).toEqual(['Không có bậc', 'Thợ chính', 'Thợ phụ']);
    const withHidden = tierOptions(tiers, { id: 't3', name: 'CTV', isActive: false });
    expect(withHidden.at(-1)).toEqual({ value: 't3', label: 'CTV · đang ẩn', disabled: true });
  });

  it('tên vai trò: GET /roles trước, rồi vai trò hệ thống, rồi mã', () => {
    expect(roleName('artist', null)).toBe('Thợ makeup');
    expect(roleName('tho-ca', null)).toBe('tho-ca');
    expect(roleName('tho-ca', [{ id: 'r', organizationId: 'o', key: 'tho-ca', name: 'Thợ theo ca', isSystem: false, permissions: [], createdAt: T, updatedAt: T }])).toBe('Thợ theo ca');
  });
});

describe('Hồ sơ thợ: chỉ gửi trường đã đổi', () => {
  const s = member('a', 'Nguyễn Thị Thu Hà', { id: 't1', name: 'Thợ chính', isActive: true }, { displayName: 'Thu Hà', phone: '0912445667' });
  const opts = { canWritePhone: true, canChangeTier: true };

  it('không đổi gì → thân rỗng', () => {
    expect(profilePatch(s, profileDraftOf(s), opts)).toEqual({});
  });

  it('xoá trắng tên hiển thị / số điện thoại → null; bỏ bậc → tierId null; ảnh mới → avatarFileId', () => {
    const d = { ...profileDraftOf(s), displayName: '  ', phone: '', tierId: '', avatarFileId: 'f1' };
    expect(profilePatch(s, d, opts)).toEqual({ displayName: null, phone: null, tierId: null, avatarFileId: 'f1' });
  });

  it('không được đổi bậc → không gửi tierId dù ô đổi; bỏ ảnh → avatarFileId null; không bao giờ gửi avatarUrl', () => {
    const d = { ...profileDraftOf(s), tierId: '', avatarFileId: null, isBookable: false };
    const out = profilePatch(s, d, { canWritePhone: true, canChangeTier: false });
    expect(out).toEqual({ avatarFileId: null, isBookable: false });
    expect('avatarUrl' in out).toBe(false);
  });
});

describe('Bậc lương: PATCH chỉ bậc đã đổi', () => {
  const base = [tier('t1', 'Thợ chính', 0), tier('t2', 'Thợ phụ', 1), tier('t3', 'Học việc', 2)];
  const draft = () => base.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive }));

  it('đổi tên một bậc → một PATCH {name}', () => {
    const d = draft();
    d[1] = { ...d[1]!, name: 'Thợ phụ bậc 1' };
    expect(tierPatches(base, d)).toEqual([{ tierId: 't2', input: { name: 'Thợ phụ bậc 1' } }]);
  });

  it('kéo bậc cuối lên đầu → đánh số lại các bậc lệch vị trí', () => {
    const d = moveItem(draft(), 2, 0);
    expect(tierPatches(base, d)).toEqual([
      { tierId: 't3', input: { sortOrder: 0 } },
      { tierId: 't1', input: { sortOrder: 1 } },
      { tierId: 't2', input: { sortOrder: 2 } },
    ]);
  });

  it('tắt "Đang dùng" → {isActive:false}', () => {
    const d = draft();
    d[0] = { ...d[0]!, isActive: false };
    expect(tierPatches(base, d)).toEqual([{ tierId: 't1', input: { isActive: false } }]);
  });
});

describe('Tiền công theo gói', () => {
  const price = (unitPrice: number) => ({ priceVersionId: 'v', listPrice: unitPrice, salePrice: null, unitPrice, effectiveFrom: T });
  const pkg = (id: string, name: string, subjectId: string | null, p: number) =>
    ({ id, name, subjectId, subject: subjectId ? { id: subjectId, name: subjectId === 's1' ? 'Cô dâu' : 'Mẹ', isActive: true } : null, currentPrice: price(p) }) as never;
  const subjects = [
    { id: 's2', organizationId: 'o', name: 'Mẹ cô dâu', sortOrder: 1, isActive: true, createdAt: T, updatedAt: T },
    { id: 's1', organizationId: 'o', name: 'Cô dâu', sortOrder: 0, isActive: true, createdAt: T, updatedAt: T },
  ];

  it('nhóm theo nhân vật (sortOrder), "Mọi nhân vật" cuối nhóm gói, "Dịch vụ phụ" cuối cùng; nhân vật không có gói thì không có nhóm', () => {
    const groups = groupOwners(
      [pkg('p3', 'Khách dự tiệc', null, 450_000), pkg('p1', 'Cô dâu – Ngày cưới', 's1', 2_700_000)],
      subjects,
      [{ id: 'a1', name: 'Làm tóc', currentPrice: price(300_000) } as never],
    );
    expect(groups.map((g) => g.label)).toEqual(['Gói · Cô dâu', 'Gói · Mọi nhân vật', 'Dịch vụ phụ']);
    expect(groups[0]?.owners[0]).toEqual({ kind: 'goi', id: 'p1', name: 'Cô dâu – Ngày cưới', price: 2_700_000, groupLabel: 'Gói · Cô dâu' });
    expect(groups[2]?.owners[0]?.kind).toBe('dich-vu');
  });

  it('lọc phía máy không phân biệt dấu, hoa thường; bỏ nhóm rỗng', () => {
    const groups = groupOwners([pkg('p1', 'Cô dâu – Ngày cưới', 's1', 1), pkg('p2', 'Mẹ – Trang điểm', 's2', 1)], subjects, []);
    expect(filterOwnerGroups(groups, 'TRANG DIEM').map((g) => g.label)).toEqual(['Gói · Mẹ cô dâu']);
    expect(filterOwnerGroups(groups, '  ')).toHaveLength(2);
  });

  it('PUT chỉ bậc đã đổi; xoá trắng = null', () => {
    const items: PayRateRow[] = [
      { tier: { id: 't1', name: 'A', sortOrder: 0 }, amount: 700_000, updatedAt: T, staff: [] },
      { tier: { id: 't2', name: 'B', sortOrder: 1 }, amount: null, updatedAt: null, staff: [] },
      { tier: { id: 't3', name: 'C', sortOrder: 2 }, amount: 300_000, updatedAt: T, staff: [] },
    ];
    expect(changedRates(items, { t1: 700_000, t2: 250_000, t3: null })).toEqual([
      { tierId: 't2', amount: 250_000 },
      { tierId: 't3', amount: null },
    ]);
    expect(changedRates(items, { t1: 700_000, t2: null, t3: 300_000 })).toEqual([]);
  });

  it('400 khi lưu: đọc details.tierIds', () => {
    expect(errorTierIds({ tierIds: ['t1', 2, 't3'] })).toEqual(['t1', 't3']);
    expect(errorTierIds(undefined)).toEqual([]);
  });

  it('ngày theo múi giờ tổ chức (23:30 UTC = sáng hôm sau ở Việt Nam)', () => {
    expect(formatDateIn('2026-10-11T23:30:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('12/10/2026');
    expect(formatDateIn(null, 'Asia/Ho_Chi_Minh')).toBe('');
  });
});
