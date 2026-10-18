import { Button, EmptyState, ListGroupHeader, ListRowSkeleton } from '../../ui';
import { LoadErrorStrip, SearchBox } from '../staff/parts';
import { CustomerRow } from './CustomerRow';
import type { CustomerListState } from './useCustomerHistory';

// Cột trái màn Khách hàng (C2 2.2): ô tìm · "Mới thêm gần đây" / "Kết quả" · dòng khách · "Xem thêm".
export interface CustomerListProps {
  slug: string;
  q: string;
  onQ: (q: string) => void;
  state: CustomerListState;
  selectedId: string | null;
  canWrite: boolean;
  onRetry: () => void;
  onMore: () => void;
  onAdd: (prefill: string) => void;
}

const PAGE_SIZE = 20;

export function CustomerList({ slug, q, onQ, state, selectedId, canWrite, onRetry, onMore, onAdd }: CustomerListProps) {
  const searching = state.q !== '';
  const rest = state.total - state.items.length;
  let body;
  if (state.status === 'loading') body = <ListRowSkeleton rows={6} avatar label="Đang tải danh sách khách" />;
  else if (state.status === 'error' && state.items.length === 0) body = <LoadErrorStrip error={state.error} retry={onRetry} />;
  else if (state.items.length === 0 && !searching)
    body = (
      <EmptyState
        message="Chưa có khách nào. Khách cũng tự được thêm khi lập hợp đồng."
        action={
          canWrite ? (
            <Button variant="primary" size="sm" onClick={() => onAdd('')}>
              Thêm khách
            </Button>
          ) : undefined
        }
      />
    );
  else if (state.items.length === 0)
    body = (
      <EmptyState
        message={`Không có khách nào khớp "${state.q}". Kiểm tra lại số hoặc thêm khách mới.`}
        action={
          canWrite ? (
            <Button size="sm" onClick={() => onAdd(state.q)}>
              {`Thêm khách "${state.q.length > 12 ? `${state.q.slice(0, 12)}…` : state.q}"`}
            </Button>
          ) : undefined
        }
      />
    );
  else
    body = (
      <>
        {state.status === 'error' && <LoadErrorStrip error={state.error} retry={onRetry} />}
        <nav aria-label="Danh sách khách">
          {state.items.map((c) => (
            <CustomerRow key={c.id} slug={slug} c={c} q={state.q} selected={selectedId === c.id} />
          ))}
        </nav>
        {state.moreError !== null && <LoadErrorStrip error={state.moreError} retry={onMore} />}
        {rest > 0 && (
          <div className="kh-more">
            <Button block onClick={onMore} loading={state.loadingMore}>
              {`Xem thêm ${Math.min(PAGE_SIZE, rest)} khách`}
            </Button>
          </div>
        )}
      </>
    );
  return (
    <div className="ui-card kh-list">
      <div className="kh-list__search">
        <SearchBox value={q} onChange={onQ} placeholder="Tìm theo tên hoặc số điện thoại" label="Tìm khách theo tên hoặc số điện thoại" />
      </div>
      <div className="ui-ld__scroll">
        {state.status !== 'loading' && (state.items.length > 0 || (state.status === 'ready' && searching)) && (
          <ListGroupHeader aside={`${state.total} khách`}>{searching ? 'Kết quả' : 'Mới thêm gần đây'}</ListGroupHeader>
        )}
        {body}
      </div>
    </div>
  );
}

