import { useEffect, useState } from 'react';
import { listStaff } from '../../api/staff';
import type { StaffRosterEntry } from '../../ui/staffName';

// Sổ thợ của tổ chức (GET /staff, cần staff.read) để một người ra MỘT tên ngắn và MỘT màu ảnh ở mọi màn (ui/staffName.ts).
// Không có quyền hoặc tải lỗi → rỗng: màn vẫn vẽ, chỉ xét trùng tên / màu trên những người đang hiện.
export function useStaffRoster(orgId: string, enabled: boolean): StaffRosterEntry[] {
  const [roster, setRoster] = useState<StaffRosterEntry[]>([]);
  useEffect(() => {
    if (!enabled) {
      setRoster([]);
      return undefined;
    }
    const controller = new AbortController();
    listStaff(orgId, undefined, controller.signal)
      .then((res) => setRoster(res.items.map((m) => ({ membershipId: m.membershipId, displayName: m.displayName, fullName: m.fullName, initials: m.initials }))))
      .catch(() => {
        if (!controller.signal.aborted) setRoster([]);
      });
    return () => controller.abort();
  }, [orgId, enabled]);
  return roster;
}
