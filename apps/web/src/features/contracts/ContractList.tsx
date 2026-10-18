import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES, type ContractStatus } from '@makeup/shared';
import { listContracts } from '../../api/contracts';
import { errorKind, userMessage } from '../../api/errors';
import type { ContractSummary, Page } from '../../api/types';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { Button, Card, Chip, ContractStatusTag, EmptyState, IconPlus, SkeletonText, TextInput, formatVnd } from '../../ui';
import { displayDate } from './model';
import './contracts.css';

// Danh sách hợp đồng (bản vẽ 4.3, mục con): mã · khách · ngày sự kiện · tổng · trạng thái. Dựng theo danh sách gọn 4.2a.
export interface ContractListProps {
  orgId: string;
  slug: string;
  tz: string;
  canCreate: boolean;
}

const PAGE_SIZE = 20;

export function ContractList({ orgId, slug, tz, canCreate }: ContractListProps) {
  const [status, setStatus] = useState<ContractStatus | null>(null);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: Page<ContractSummary> }>({
    status: 'loading',
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    listContracts(orgId, { page, pageSize: PAGE_SIZE, ...(status ? { status } : {}), ...(term ? { q: term } : {}) }, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, page, status, term, attempt]);

  const newLink = (
    <Link to={`/${slug}/hop-dong/moi`} className="ui-btn ui-btn--primary" style={{ textDecoration: 'none' }}>
      <IconPlus />
      <span className="ui-btn__text">Lập hợp đồng</span>
    </Link>
  );

  const phoneLink = (
    <Link to={`/${slug}/hop-dong/moi`} className="ui-btn ui-btn--primary ui-btn--sm" style={{ textDecoration: 'none' }} aria-label="Lập hợp đồng">
      <IconPlus />
      <span className="ui-btn__text">Lập</span>
    </Link>
  );

  const pages = state.status === 'ready' ? Math.max(1, Math.ceil(state.data.total / PAGE_SIZE)) : 1;
  return (
    <div>
      <PageHeader title="Hợp đồng" actions={canCreate ? newLink : undefined} phoneAction={canCreate ? phoneLink : undefined} />
      {state.status === 'error' && errorKind(state.error) === 'forbidden' ? (
        <ForbiddenBanner>{userMessage(state.error)}</ForbiddenBanner>
      ) : (
        <Card flush>
          <div className="ct-list__bar">
            <TextInput
              className="ct-list__search"
              placeholder="Tìm theo mã, tên hoặc số điện thoại khách"
              aria-label="Tìm hợp đồng"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="ct-cat__chips" role="group" aria-label="Lọc theo trạng thái">
              <Chip
                selected={status === null}
                onClick={() => {
                  setStatus(null);
                  setPage(1);
                }}
              >
                Tất cả
              </Chip>
              {CONTRACT_STATUSES.map((s) => (
                <Chip
                  key={s}
                  selected={status === s}
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                >
                  {CONTRACT_STATUS_LABELS[s]}
                </Chip>
              ))}
            </div>
          </div>
          {state.status === 'loading' && (
            <div style={{ padding: '12px 16px' }}>
              <SkeletonText lines={4} widths={['70%', '55%', '65%', '50%']} label="Đang tải danh sách hợp đồng" />
            </div>
          )}
          {state.status === 'error' && (
            <EmptyState message={userMessage(state.error)} action={<Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>} />
          )}
          {state.status === 'ready' && state.data.items.length === 0 && (
            <EmptyState
              message={term || status ? 'Không có hợp đồng phù hợp.' : 'Chưa có hợp đồng nào.'}
              action={canCreate && !term && !status ? newLink : undefined}
            />
          )}
          {state.status === 'ready' && state.data.items.length > 0 && (
            <div role="list" aria-label="Danh sách hợp đồng">
              {state.data.items.map((c) => (
                <Link key={c.id} role="listitem" className="ct-gl" to={`/${slug}/hop-dong/${c.id}`}>
                  <span className="ct-gl__n">
                    {c.customer.fullName}
                    <span className="ct-gl__code" style={{ display: 'block' }}>
                      {c.code}
                    </span>
                  </span>
                  <span className="ct-gl__d">{c.eventDate ? displayDate(c.eventDate, tz) : 'Chưa có ngày'}</span>
                  <span className="ct-gl__p ct-num">{formatVnd(c.total)}</span>
                  <ContractStatusTag status={c.status} />
                </Link>
              ))}
            </div>
          )}
          {state.status === 'ready' && pages > 1 && (
            <div className="ct-pager">
              <span>
                Trang {page}/{pages}
              </span>
              <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước">
                ‹
              </Button>
              <Button size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau">
                ›
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
