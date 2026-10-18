import { describe, expect, it } from 'vitest';
import { CONTRACT_STATUSES, INITIAL_STATUSES, TRAVEL_FEE_MODES, WORK_STATUSES } from '@makeup/shared';
import type { ContractStatus, InitialWorkStatus, TravelFeeMode, WorkStatus } from './types';

// Bảng đủ mọi giá trị của từng kiểu: thiếu hay thừa một giá trị là lỗi biên dịch.
const work = { DRAFT: 1, PENDING_CONFIRMATION: 1, CONFIRMED: 1, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 1, NO_SHOW: 1 } satisfies Record<WorkStatus, 1>;
const initial = { DRAFT: 1, PENDING_CONFIRMATION: 1, CONFIRMED: 1 } satisfies Record<InitialWorkStatus, 1>;
const contract = { DRAFT: 1, CONFIRMED: 1, COMPLETED: 1, CANCELLED: 1 } satisfies Record<ContractStatus, 1>;
const travel = { FIXED: 1, PER_KM: 1, MANUAL: 1 } satisfies Record<TravelFeeMode, 1>;

const sorted = (a: readonly string[]) => [...a].sort();

describe('giá trị liệt kê trong types.ts khớp packages/shared', () => {
  it('trạng thái lịch, trạng thái ban đầu, trạng thái hợp đồng, cách tính phí di chuyển', () => {
    expect(sorted(Object.keys(work))).toEqual(sorted(WORK_STATUSES));
    expect(sorted(Object.keys(initial))).toEqual(sorted(INITIAL_STATUSES));
    expect(sorted(Object.keys(contract))).toEqual(sorted(CONTRACT_STATUSES));
    expect(sorted(Object.keys(travel))).toEqual(sorted(TRAVEL_FEE_MODES));
  });
});
