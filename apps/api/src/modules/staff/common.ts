import type { Prisma } from '@prisma/client';

// Chữ viết tắt hiện thay ảnh đại diện khi chưa có ảnh: chữ đầu của từ đầu và từ cuối ("Nguyễn Thị Hoa" → "NH").
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return `${[...first][0] ?? ''}${last ? ([...last][0] ?? '') : ''}`.toLocaleUpperCase('vi-VN');
}

export const staffMemberSelect = {
  id: true,
  status: true,
  user: { select: { id: true, fullName: true } },
  roles: { select: { role: { select: { key: true } } } },
  staffProfile: {
    select: {
      displayName: true,
      avatarUrl: true,
      phone: true,
      isBookable: true,
      tier: { select: { id: true, name: true, isActive: true } },
    },
  },
} satisfies Prisma.MembershipSelect;

export type StaffMemberRow = Prisma.MembershipGetPayload<{ select: typeof staffMemberSelect }>;

// Thành viên chưa có hồ sơ thợ vẫn hiện: tên lấy từ tài khoản, chưa có bậc, mặc định nhận lịch (khớp mặc định database).
export function presentStaff(m: StaffMemberRow) {
  const p = m.staffProfile;
  const displayName = p?.displayName ?? m.user.fullName;
  return {
    membershipId: m.id,
    userId: m.user.id,
    fullName: m.user.fullName,
    displayName,
    initials: initialsOf(displayName),
    avatarUrl: p?.avatarUrl ?? null,
    phone: p?.phone ?? null,
    tier: p?.tier ?? null,
    isBookable: p?.isBookable ?? true,
    hasProfile: p !== null,
    status: m.status,
    roleKeys: m.roles.map((r) => r.role.key),
  };
}
