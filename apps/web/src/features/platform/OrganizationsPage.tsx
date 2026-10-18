// Trang Tổ chức (bản vẽ C2 mục 5.4, bản mẫu #b-ds, #b-ct): ListDetail 380 | 1fr.
// /quan-tri/to-chuc → danh sách + chi tiết tổ chức đầu danh sách (máy tính, máy tính bảng);
// /quan-tri/to-chuc/:organizationId → chi tiết (điện thoại: màn con, nút ‹ quay lại danh sách).
// Bộ lọc nằm trên đường dẫn (?loc=&goi=&q=) để quay lại / tải lại vẫn đúng.
import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { listPlans, type OrgDetail } from '../../api/platform';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { EmptyState, ListDetail } from '../../ui';
import { usePlatformStats } from './context';
import { OrgDetailPanel } from './OrgDetail';
import { filterOf, OrgList, useOrgPages, type FilterKey } from './OrgList';
import { PlatformHeader } from './PlatformShell';
import { platformHref } from './PlatformNav';
import { useLoad } from './useLoad';

export function OrganizationsPage() {
  const { organizationId } = useParams();
  const [params, setParams] = useSearchParams();
  const { stats, reloadStats } = usePlatformStats();
  const bp = useBreakpoint();
  const filter = filterOf(params.get('loc'));
  const planCode = params.get('goi') ?? '';
  const q = params.get('q') ?? '';
  const plans = useLoad('plans', (signal) => listPlans(signal));
  const pages = useOrgPages({ ...filter.query, ...(planCode ? { planCode } : {}), ...(q ? { q } : {}) });
  const [detailName, setDetailName] = useState<{ id: string; name: string } | null>(null);

  const search = params.toString();
  const listHref = `${platformHref('to-chuc')}${search ? `?${search}` : ''}`;
  const rowHref = useCallback((id: string) => `${platformHref(`to-chuc/${encodeURIComponent(id)}`)}${search ? `?${search}` : ''}`, [search]);

  const setParam = useCallback(
    (k: string, v: string) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v) n.set(k, v);
          else n.delete(k);
          return n;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const onFilter = useCallback((f: FilterKey) => setParam('loc', f === 'tat-ca' ? '' : f), [setParam]);
  const onPlan = useCallback((c: string) => setParam('goi', c), [setParam]);
  const onSearch = useCallback((v: string) => setParam('q', v), [setParam]);

  // Máy tính / máy tính bảng: chưa chọn thì mở tổ chức đầu danh sách. Điện thoại: chưa chọn = màn danh sách.
  const selectedId = organizationId ?? (bp === 'phone' ? null : (pages.items[0]?.id ?? null));
  const onChanged = useCallback(() => {
    pages.reload();
    reloadStats();
  }, [pages, reloadStats]);
  const onLoaded = useCallback((d: OrgDetail) => setDetailName({ id: d.id, name: d.name }), []);

  return (
    <>
      <PlatformHeader
        title="Tổ chức"
        phoneTitle={organizationId ? (detailName?.id === organizationId ? detailName.name : 'Tổ chức') : 'Tổ chức'}
        backTo={organizationId ? listHref : undefined}
      />
      <ListDetail
        listLabel="Danh sách tổ chức"
        detailLabel="Chi tiết tổ chức"
        mobileView={organizationId ? 'detail' : 'list'}
        list={
          <OrgList
            stats={stats}
            plans={plans.data?.items ?? []}
            filter={filter.key}
            planCode={planCode}
            q={q}
            onFilter={onFilter}
            onPlan={onPlan}
            onSearch={onSearch}
            pages={pages}
            selectedId={selectedId}
            rowHref={rowHref}
          />
        }
        detail={
          selectedId ? (
            <OrgDetailPanel key={selectedId} organizationId={selectedId} onChanged={onChanged} onLoaded={onLoaded} />
          ) : pages.loading ? null : bp === 'phone' ? null : (
            <EmptyState message="Không có tổ chức nào khớp bộ lọc." />
          )
        }
      />
    </>
  );
}
