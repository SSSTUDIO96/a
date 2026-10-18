import { useEffect, useState } from 'react';
import { getStaffAvailability, listStaff, listStaffTiers } from '../../api/staff';
import type { StaffAvailability, StaffMember, StaffTier } from '../../api/types';
import { isMakeupStaff } from '../schedule/model';

// Ô chọn thợ: tình trạng từng thợ cho khung giờ của dòng (GET /staff/availability) + thứ tự bậc (GET /staff-tiers).
export interface AvailabilityQueryArgs {
  startsAt: string;
  endsAt: string;
  // Hợp đồng đang sửa (đã lưu): bỏ giữ chỗ của chính nó.
  excludeContractId?: string;
}

export type AvailabilityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; items: StaffAvailability[]; tiers: StaffTier[]; members: StaffMember[] | null };

export function useStaffAvailability(orgId: string, args: AvailabilityQueryArgs | null): AvailabilityState {
  const [state, setState] = useState<AvailabilityState>({ status: 'idle' });
  const key = args ? `${args.startsAt}|${args.endsAt}|${args.excludeContractId ?? ''}` : null;
  useEffect(() => {
    if (!args || key === null) {
      setState({ status: 'idle' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    Promise.all([
      getStaffAvailability(
        orgId,
        { startsAt: args.startsAt, endsAt: args.endsAt, ...(args.excludeContractId ? { excludeContractId: args.excludeContractId } : {}) },
        controller.signal,
      ),
      listStaffTiers(orgId, controller.signal),
      // Hồ sơ thợ + vai trò để lọc đúng luật của Lịch (N9). Không đọc được thì không lọc (vẫn chọn được).
      Promise.resolve()
        .then(() => listStaff(orgId, undefined, controller.signal))
        .then(
          (r) => r.items,
          () => null,
        ),
    ])
      .then(([a, t, m]) => setState({ status: 'ready', items: a.items, tiers: t.items, members: m }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
    // args đọc qua key (so theo nội dung).
  }, [orgId, key]);
  return state;
}

/**
 * N9: ô chọn thợ của hợp đồng dùng CÙNG luật với lưới Lịch và hộp sửa ca (schedule/model buildStaffLanes,
 * StaffChecklist): người đang nhận lịch có hồ sơ thợ hoặc vai trò Thợ makeup / Thợ phụ. Tổ chức chưa có ai như vậy
 * (studio một người) thì cho chọn mọi người đang nhận lịch. Thợ đã gán sẵn cho dòng luôn còn trong danh sách.
 */
export function pickableStaff(items: StaffAvailability[], members: StaffMember[] | null, keepIds: ReadonlySet<string>): StaffAvailability[] {
  if (!members) return items;
  const bookable = members.filter((m) => m.isBookable);
  const makeup = bookable.filter((m) => isMakeupStaff(m));
  const ids = new Set((makeup.length > 0 ? makeup : bookable).map((m) => m.membershipId));
  return items.filter((s) => ids.has(s.membershipId) || keepIds.has(s.membershipId));
}

export interface TierGroup {
  id: string | null;
  name: string;
  items: StaffAvailability[];
}

// Nhóm thợ theo bậc, xếp theo tier.sortOrder; thợ chưa xếp bậc để cuối.
export function groupByTier(items: StaffAvailability[], tiers: StaffTier[]): TierGroup[] {
  const order = new Map(tiers.map((t) => [t.id, t.sortOrder]));
  const groups = new Map<string, TierGroup>();
  for (const s of items) {
    const id = s.tier?.id ?? '';
    const g = groups.get(id) ?? { id: s.tier?.id ?? null, name: s.tier?.name ?? 'Chưa xếp bậc', items: [] };
    g.items.push(s);
    groups.set(id, g);
  }
  const rank = (g: TierGroup) => (g.id === null ? Number.MAX_SAFE_INTEGER : (order.get(g.id) ?? Number.MAX_SAFE_INTEGER - 1));
  return [...groups.values()]
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'vi'))
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi')) }));
}
