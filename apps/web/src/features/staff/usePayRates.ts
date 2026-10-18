import { listMakeupSubjects, listPackages, listServices } from '../../api/catalog';
import { getPackagePayRates, getServicePayRates, putPackagePayRates, putServicePayRates } from '../../api/staff';
import type { Page, PayRateSheet, PayRatesInput } from '../../api/types';
import { groupOwners, type OwnerKind, type PayOwnerGroup } from './logic';
import { useLoad } from './useOrgInfo';

const PAGE = 100;

// Đọc hết các trang (máy chủ tối đa 100 dòng mỗi trang).
async function allPages<T>(fetchPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page += 1) {
    const r = await fetchPage(page);
    out.push(...r.items);
    if (r.items.length === 0 || out.length >= r.total) return out;
  }
}

// Cột trái màn Tiền công: gói đang bán (theo nhân vật) + dịch vụ phụ đang bán (C2 1.3). Không có catalog.read → không gọi.
export function usePayOwners(orgId: string, catalogRead: boolean) {
  return useLoad<PayOwnerGroup[]>(
    catalogRead
      ? async (signal) => {
          const [packages, subjects, addons] = await Promise.all([
            allPages((page) => listPackages(orgId, { isActive: true, page, pageSize: PAGE }, signal)),
            listMakeupSubjects(orgId, undefined, signal),
            allPages((page) => listServices(orgId, { kind: 'ADDON', isActive: true, page, pageSize: PAGE }, signal)),
          ]);
          return groupOwners(packages, subjects.items, addons);
        }
      : null,
    [orgId, catalogRead],
  );
}

export function getPayRates(orgId: string, kind: OwnerKind, id: string, signal?: AbortSignal): Promise<PayRateSheet> {
  return kind === 'goi' ? getPackagePayRates(orgId, id, signal) : getServicePayRates(orgId, id, signal);
}

export function putPayRates(orgId: string, kind: OwnerKind, id: string, input: PayRatesInput): Promise<PayRateSheet> {
  return kind === 'goi' ? putPackagePayRates(orgId, id, input) : putServicePayRates(orgId, id, input);
}
