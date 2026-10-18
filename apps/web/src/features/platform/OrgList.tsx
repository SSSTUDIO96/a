// Cột trái trang Tổ chức (bản vẽ C2 mục 5.4): ô tìm (đợi 300 ms), hàng chip lọc (số đếm lấy từ GET /platform/stats,
// không gọi thêm), chọn gói, danh sách 20 dòng/lần + "Xem thêm".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { userMessage } from '../../api/errors';
import {
  listPlatformOrganizations,
  type OrgListItem,
  type OrgListQuery,
  type PlanView,
  type PlatformStats,
} from '../../api/platform';
import { Button, Chip, EmptyState, ListRow, ListRowSkeleton, Select, StatusTag } from '../../ui';
import { PlatformIcon } from './icons';
import { fmtDate, SUBSCRIPTION_LABELS, SUBSCRIPTION_TONES } from './labels';

export const PAGE_SIZE = 20;

export type FilterKey = 'tat-ca' | 'sap-het-han' | 'het-han' | 'cham' | 'dung-thu' | 'dang-khoa';

export const FILTERS: readonly { key: FilterKey; label: string; query: OrgListQuery; count: (s: PlatformStats) => number }[] = [
  { key: 'tat-ca', label: 'Tất cả', query: {}, count: (s) => s.organizations.total },
  { key: 'sap-het-han', label: 'Sắp hết hạn', query: { expiringWithinDays: 30 }, count: (s) => s.expiringIn30Days },
  { key: 'het-han', label: 'Hết hạn', query: { subscriptionStatus: 'EXPIRED' }, count: (s) => s.organizations.bySubscriptionStatus.EXPIRED },
  { key: 'cham', label: 'Chậm thanh toán', query: { subscriptionStatus: 'PAST_DUE' }, count: (s) => s.organizations.bySubscriptionStatus.PAST_DUE },
  { key: 'dung-thu', label: 'Dùng thử', query: { subscriptionStatus: 'TRIAL' }, count: (s) => s.organizations.bySubscriptionStatus.TRIAL },
  { key: 'dang-khoa', label: 'Đang khoá', query: { status: 'SUSPENDED' }, count: (s) => s.organizations.byStatus.SUSPENDED },
];

export function filterOf(key: string | null): (typeof FILTERS)[number] {
  return FILTERS.find((f) => f.key === key) ?? FILTERS[0]!;
}

/** Chữ hạn bên phải dòng: "đến dd/mm/yyyy" · "hết dd/mm/yyyy" (đã hết hạn) · "không thời hạn". */
export function endsText(o: OrgListItem): string | null {
  const s = o.subscription;
  if (!s) return null;
  if (!s.endsAt) return 'không thời hạn';
  return `${o.subscriptionStatus === 'EXPIRED' ? 'hết' : 'đến'} ${fmtDate(s.endsAt)}`;
}

interface PagesState {
  items: OrgListItem[];
  total: number;
  loading: boolean;
  error: unknown;
}

/** Danh sách theo bộ lọc, cộng dồn từng trang 20. reload(): tải lại đúng số dòng đang hiện (tối đa 100 một lần). */
export function useOrgPages(query: OrgListQuery) {
  const key = JSON.stringify(query);
  const [state, setState] = useState<PagesState>({ items: [], total: 0, loading: true, error: null });
  const ctlRef = useRef<AbortController | null>(null);
  const shown = useRef(PAGE_SIZE);
  const count = useRef(0);

  const fetchPage = useCallback(
    (page: number, pageSize: number, append: boolean) => {
      ctlRef.current?.abort();
      const ctl = new AbortController();
      ctlRef.current = ctl;
      setState((s) => ({ ...s, loading: true, error: null }));
      listPlatformOrganizations({ ...(JSON.parse(key) as OrgListQuery), page, pageSize }, ctl.signal).then(
        (r) =>
          setState((s) => {
            const items = append ? [...s.items, ...r.items.filter((i) => !s.items.some((x) => x.id === i.id))] : r.items;
            shown.current = Math.max(PAGE_SIZE, items.length);
            count.current = items.length;
            return { items, total: r.total, loading: false, error: null };
          }),
        (err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState((s) => ({ ...s, loading: false, error: err }));
        },
      );
    },
    [key],
  );

  useEffect(() => {
    shown.current = PAGE_SIZE;
    count.current = 0;
    setState({ items: [], total: 0, loading: true, error: null });
    fetchPage(1, PAGE_SIZE, false);
    return () => ctlRef.current?.abort();
  }, [fetchPage]);

  // Trang kế theo số dòng đã có (luôn là bội của 20 trừ trang cuối).
  const more = useCallback(() => fetchPage(Math.floor(count.current / PAGE_SIZE) + 1, PAGE_SIZE, true), [fetchPage]);
  const reload = useCallback(() => fetchPage(1, Math.min(100, shown.current), false), [fetchPage]);
  return { ...state, more, reload };
}

export interface OrgListProps {
  stats: PlatformStats;
  plans: PlanView[];
  filter: FilterKey;
  planCode: string;
  q: string;
  onFilter: (f: FilterKey) => void;
  onPlan: (code: string) => void;
  onSearch: (q: string) => void;
  pages: ReturnType<typeof useOrgPages>;
  selectedId: string | null;
  rowHref: (id: string) => string;
}

export function OrgList({ stats, plans, filter, planCode, q, onFilter, onPlan, onSearch, pages, selectedId, rowHref }: OrgListProps) {
  const [text, setText] = useState(q);
  const lastSent = useRef(q);
  // Ô tìm: đợi 300 ms sau phím cuối mới gọi.
  useEffect(() => {
    if (text.trim() === lastSent.current) return undefined;
    const t = setTimeout(() => {
      lastSent.current = text.trim();
      onSearch(text.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [text, onSearch]);
  useEffect(() => {
    if (q !== lastSent.current) {
      lastSent.current = q;
      setText(q);
    }
  }, [q]);

  const remaining = pages.total - pages.items.length;

  return (
    <div className="ui-card pf-list">
      <div className="pf-list__filters">
        <label className="pf-search">
          <PlatformIcon name="search" />
          <input
            className="ui-input"
            type="search"
            value={text}
            placeholder="Tên, đường dẫn hoặc email chủ"
            aria-label="Tìm tổ chức"
            maxLength={100}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="pf-chips" role="group" aria-label="Lọc tổ chức">
          {FILTERS.map((f) => (
            <Chip key={f.key} selected={filter === f.key} count={f.count(stats)} onClick={() => onFilter(f.key)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <Select
          size="sm"
          aria-label="Gói cước"
          value={planCode}
          options={[{ value: '', label: 'Mọi gói cước' }, ...plans.map((p) => ({ value: p.code, label: p.name }))]}
          onChange={(e) => onPlan(e.target.value)}
        />
      </div>
      <div className="pf-list__body ui-ld__scroll">
        {pages.items.length === 0 && pages.loading ? (
          <ListRowSkeleton rows={6} label="Đang tải danh sách tổ chức" />
        ) : pages.items.length === 0 && pages.error ? (
          <EmptyState message={`Không tải được danh sách. ${userMessage(pages.error)}`} action={<Button onClick={pages.reload}>Thử lại</Button>} />
        ) : pages.items.length === 0 ? (
          <EmptyState message="Không có tổ chức nào khớp bộ lọc." />
        ) : (
          <>
            {pages.items.map((o) => (
              <ListRow
                key={o.id}
                as={Link}
                linkProps={{ to: rowHref(o.id) }}
                selected={o.id === selectedId}
                title={
                  <>
                    {o.name}
                    {o.status === 'SUSPENDED' ? (
                      <>
                        {' '}
                        <StatusTag tone="danger">Đang khoá</StatusTag>
                      </>
                    ) : null}
                  </>
                }
                subtitle={`${o.slug} · ${o.owner?.email ?? 'chưa có chủ'}`}
                amount={<StatusTag tone={SUBSCRIPTION_TONES[o.subscriptionStatus]}>{SUBSCRIPTION_LABELS[o.subscriptionStatus]}</StatusTag>}
                trailing={endsText(o) ?? undefined}
              />
            ))}
            {pages.error ? (
              <p className="pf-err pf-pad" role="alert">
                {userMessage(pages.error)}
              </p>
            ) : null}
            {remaining > 0 ? (
              <div className="pf-more">
                <Button block loading={pages.loading} onClick={pages.more}>
                  Xem thêm {Math.min(PAGE_SIZE, remaining)} tổ chức
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
