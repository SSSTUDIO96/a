import { useEffect, useState } from 'react';
import { getStaffAvailability, listStaffTiers } from '../../api/staff';
import type { StaffAvailability, StaffTier } from '../../api/types';

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
  | { status: 'ready'; items: StaffAvailability[]; tiers: StaffTier[] };

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
    ])
      .then(([a, t]) => setState({ status: 'ready', items: a.items, tiers: t.items }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
    // args đọc qua key (so theo nội dung).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, key]);
  return state;
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
