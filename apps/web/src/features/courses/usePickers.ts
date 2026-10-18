import { useEffect, useState } from 'react';
import { listStudioLocations } from '../../api/catalog';
import { listStaff } from '../../api/staff';
import type { StaffMember, StudioLocation } from '../../api/types';

// Danh sách cho ô "Giảng viên" (thợ đang hoạt động — staff.read) và "Ở đâu" (cơ sở đang mở — catalog.read).
// Chỉ tải khi một hộp thoại cần (enabled) và chỉ tải một lần cho cả màn. Thiếu quyền → không tải, ô bị ẩn.
export interface Pickers {
  staff: StaffMember[] | null;
  locations: StudioLocation[] | null;
  // Lỗi tải (mạng, 403) — ô hiện lời lỗi thay cho danh sách.
  staffError: unknown;
  locationsError: unknown;
}

export function usePickers(orgId: string, enabled: boolean, can: { staff: boolean; locations: boolean }): Pickers {
  const [state, setState] = useState<Pickers>({ staff: null, locations: null, staffError: null, locationsError: null });
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!enabled || started) return;
    setStarted(true);
    if (can.staff) {
      listStaff(orgId)
        .then((r) => setState((s) => ({ ...s, staff: r.items.filter((m) => m.status === 'ACTIVE') })))
        .catch((e: unknown) => setState((s) => ({ ...s, staffError: e })));
    }
    if (can.locations) {
      listStudioLocations(orgId, { isActive: true })
        .then((r) => setState((s) => ({ ...s, locations: r.items })))
        .catch((e: unknown) => setState((s) => ({ ...s, locationsError: e })));
    }
  }, [enabled, started, orgId, can.staff, can.locations]);
  return state;
}
