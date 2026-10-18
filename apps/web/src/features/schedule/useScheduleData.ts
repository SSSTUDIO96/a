import { useCallback, useEffect, useState } from 'react';
import type { WorkStatus } from '@makeup/shared';
import { listMakeupSubjects } from '../../api/catalog';
import { listAppointments } from '../../api/schedule';
import { listStaff } from '../../api/staff';
import type { Appointment, StaffMember } from '../../api/types';
import { weekRange, type DayKey } from './time';

export interface ScheduleFilter {
  // Chỉ người có schedule.read_all mới lọc theo thợ (máy chủ từ chối thợ khác với read_own).
  membershipId?: string;
  status?: WorkStatus;
}

export type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; items: Appointment[] };

// Ca của tuần chứa `day` (GET /appointments?from&to[&membershipId&status]). Đổi tuần, đổi bộ lọc, gọi reload → tải lại.
// Lần tải lại giữ dữ liệu cũ trên màn (không nháy khung chờ), chỉ lần đầu mới hiện khung chờ.
export function useWeekAppointments(orgId: string, day: DayKey, filter: ScheduleFilter, readAll: boolean) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const { from, to } = weekRange(day);
  const membershipId = readAll ? filter.membershipId : undefined;
  const status = filter.status;

  useEffect(() => {
    const controller = new AbortController();
    listAppointments(orgId, { from, to, membershipId, status }, controller.signal)
      .then((res) => setState({ status: 'ready', items: res.items }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, from, to, membershipId, status, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { state, reload };
}

// Danh sách thợ (GET /staff) — chỉ gọi khi có staff.read; lỗi thì để null (hàng thợ lấy tên từ chính các ca).
export function useStaffList(orgId: string, enabled: boolean): StaffMember[] | null {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  useEffect(() => {
    if (!enabled) {
      setStaff(null);
      return undefined;
    }
    const controller = new AbortController();
    listStaff(orgId, undefined, controller.signal)
      .then((res) => setStaff(res.items))
      .catch(() => {
        if (!controller.signal.aborted) setStaff(null);
      });
    return () => controller.abort();
  }, [orgId, enabled]);
  return staff;
}

// Tên nhân vật của tổ chức theo thứ tự cố định (sortOrder, rồi tên) — để nhân vật tự thêm có màu ổn định.
// Chỉ gọi khi có catalog.read; không có hoặc lỗi thì màu nhân vật lạ theo băm tên (model.ts swatchOf).
export function useOrgSubjects(orgId: string, enabled: boolean): readonly string[] {
  const [names, setNames] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!enabled) {
      setNames([]);
      return undefined;
    }
    const controller = new AbortController();
    listMakeupSubjects(orgId, undefined, controller.signal)
      .then((res) =>
        setNames(
          [...res.items]
            .sort((x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name, 'vi'))
            .map((x) => x.name),
        ),
      )
      .catch(() => {
        if (!controller.signal.aborted) setNames([]);
      });
    return () => controller.abort();
  }, [orgId, enabled]);
  return names;
}
