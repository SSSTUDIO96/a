import { Link } from 'react-router';
import { EmptyState, formatVnd, ListGroupHeader, ListRow, ListRowSkeleton } from '../../ui';
import { filterOwnerGroups, type PayOwnerGroup } from './logic';
import { LoadErrorStrip, SearchBox } from './parts';
import type { Loadable } from './useOrgInfo';

// Cột trái màn Tiền công (C2 1.3): ô tìm (lọc phía máy) · nhóm "Gói · {nhân vật}" … "Dịch vụ phụ".
// Mỗi dòng: tên · giá bán. Không thêm gì khác.
export interface PayRateOwnerListProps {
  slug: string;
  state: Loadable<PayOwnerGroup[]> | null;
  catalogRead: boolean;
  q: string;
  onQ: (q: string) => void;
  selected: { kind: string; id: string } | null;
  retry: () => void;
}

export function ownerHref(slug: string, o: { kind: string; id: string }) {
  return `/${slug}/nhan-su/tien-cong/${o.kind}/${o.id}`;
}

export function PayRateOwnerList({ slug, state, catalogRead, q, onQ, selected, retry }: PayRateOwnerListProps) {
  let body;
  if (!catalogRead) body = <EmptyState message="Bạn không có quyền xem Bảng giá." />;
  else if (!state || state.status === 'loading') body = <ListRowSkeleton rows={6} amount label="Đang tải gói và dịch vụ phụ" />;
  else if (state.status === 'error') body = <LoadErrorStrip error={state.error} retry={retry} />;
  else if (state.data.length === 0)
    body = (
      <EmptyState
        message="Chưa có gói nào trong Bảng giá."
        action={
          <Link className="ui-btn ui-btn--sm" to={`/${slug}/bang-gia/goi`}>
            Mở Bảng giá
          </Link>
        }
      />
    );
  else {
    const groups = filterOwnerGroups(state.data, q);
    body =
      groups.length === 0 ? (
        <EmptyState message={`Không có gói hay dịch vụ phụ nào khớp "${q.trim()}".`} />
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <ListGroupHeader>{g.label}</ListGroupHeader>
            {g.owners.map((o) => (
              <ListRow
                key={`${o.kind}-${o.id}`}
                as={Link}
                linkProps={{ to: ownerHref(slug, o) }}
                title={o.name}
                amount={o.price === null ? '—' : formatVnd(o.price)}
                selected={selected?.kind === o.kind && selected.id === o.id}
              />
            ))}
          </section>
        ))
      );
  }
  return (
    <div className="ui-card st-owners">
      {catalogRead && (
        <div className="st-owners__search">
          <SearchBox value={q} onChange={onQ} placeholder="Tìm gói, dịch vụ phụ" label="Tìm gói, dịch vụ phụ" />
        </div>
      )}
      <div className="ui-ld__scroll">{body}</div>
    </div>
  );
}
