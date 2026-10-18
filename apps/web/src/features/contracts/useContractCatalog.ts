import { useCallback, useEffect, useState } from 'react';
import { getTravelFeePolicy, listMakeupSubjects, listPackages, listServices, listStudioLocations } from '../../api/catalog';
import type { MakeupSubject, Page, Service, ServicePackage, StudioLocation, TravelFeePolicy } from '../../api/types';

// Dữ liệu bảng giá cho màn hợp đồng: tự đọc src/api/catalog.ts (bản vẽ mục 7: không nhập tệp của gói Bảng giá).
export interface ContractCatalog {
  packages: ServicePackage[];
  surcharges: Service[];
  subjects: MakeupSubject[];
  studios: StudioLocation[];
  policy: TravelFeePolicy;
}

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: ContractCatalog };

// Máy chủ trả tối đa 100 dòng mỗi trang: đọc hết các trang, không cắt im lặng.
async function allPages<T>(load: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page += 1) {
    const p = await load(page);
    out.push(...p.items);
    if (p.items.length === 0 || out.length >= p.total) return out;
  }
}

export async function loadContractCatalog(orgId: string, signal?: AbortSignal): Promise<ContractCatalog> {
  const [packages, surcharges, subjects, studios, policy] = await Promise.all([
    allPages((page) => listPackages(orgId, { isActive: true, page, pageSize: 100 }, signal)),
    allPages((page) => listServices(orgId, { kind: 'SURCHARGE', isActive: true, page, pageSize: 100 }, signal)),
    listMakeupSubjects(orgId, undefined, signal).then((r) => r.items),
    listStudioLocations(orgId, { isActive: true }, signal).then((r) => r.items),
    getTravelFeePolicy(orgId, signal),
  ]);
  return { packages, surcharges, subjects, studios, policy };
}

export function useContractCatalog(orgId: string, enabled: boolean): CatalogState & { reload: () => void } {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading' });
    loadContractCatalog(orgId, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, enabled, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
