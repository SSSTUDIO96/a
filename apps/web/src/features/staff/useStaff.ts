import { useCallback } from 'react';
import { listRoles, type RoleView } from '../../api/org';
import { listStaff, listStaffTiers } from '../../api/staff';
import type { StaffMember, StaffTier } from '../../api/types';
import { useLoad } from './useOrgInfo';

// Dữ liệu màn "Thợ & bậc lương": bậc (cả bậc ẩn), thợ đang làm, vai trò (khi có roles.read).
export interface StaffData {
  tiers: StaffTier[];
  staff: StaffMember[];
  // null = không có roles.read hoặc tải vai trò lỗi → dùng tên vai trò hệ thống.
  roles: RoleView[] | null;
}

export function useStaffData(orgId: string, rolesRead: boolean) {
  const { state, reload, set } = useLoad<StaffData>(
    async (signal) => {
      const [tiers, staff, roles] = await Promise.all([
        listStaffTiers(orgId, signal),
        listStaff(orgId, undefined, signal),
        // Vai trò chỉ để đọc tên — lỗi ở đây không chặn cả màn.
        rolesRead ? listRoles(orgId, signal).then((r) => r.items).catch(() => null) : Promise.resolve(null),
      ]);
      return { tiers: tiers.items, staff: staff.items, roles };
    },
    [orgId, rolesRead],
  );

  // Thay một thợ bằng bản máy chủ vừa trả (PATCH /staff/:id).
  const replaceStaff = useCallback(
    (row: StaffMember) => set((d) => ({ ...d, staff: d.staff.map((s) => (s.membershipId === row.membershipId ? row : s)) })),
    [set],
  );
  // Số thợ mỗi bậc do máy chủ đếm → đổi bậc xong tải lại danh sách bậc (nhẹ, không nháy màn).
  const refreshTiers = useCallback(
    async (signal?: AbortSignal) => {
      const tiers = await listStaffTiers(orgId, signal);
      set((d) => ({ ...d, tiers: tiers.items }));
    },
    [orgId, set],
  );
  return { state, reload, set, replaceStaff, refreshTiers };
}
