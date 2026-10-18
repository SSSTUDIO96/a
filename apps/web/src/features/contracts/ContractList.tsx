import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES, type ContractStatus } from '@makeup/shared';
import { listContracts } from '../../api/contracts';
import { errorKind, userMessage } from '../../api/errors';
import { getCustomer } from '../../api/schedule';
import type { ContractSummary, Page } from '../../api/types';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { Button, Card, Chip, ContractStatusTag, EmptyState, IconPlus, SkeletonText, TextInput, formatVnd } from '../../ui';
import { displayDate } from './model';
import './contracts.css';

// Danh sách hợp đồng (bản vẽ 4.3, mục con): mã · khách · ngày sự kiện · tổng · trạng thái. Dựng theo danh sách gọn 4.2a.
// ?customerId=<id> (màn Khách hàng dẫn sang, "Xem tất cả n hợp đồng"): lọc theo khách đó, có dải "Đang lọc … · Bỏ lọc".
// Mã lạ / không thuộc tổ chức: bỏ lọc, báo một dòng — không đoán.

type CustomerFilter =
  | { status: 'none' }
  | { status: 'checking'; id: string }
  // name null = không có quyền xem khách (403) — vẫn lọc theo mã, không hiện tên.
  | { status: 'ok'; id: string; name: string | null };
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
  const [searchParams, setSearchParams] = useSearchParams();
  const customerParam = searchParams.get('customerId');
  const [filter, setFilter] = useState<CustomerFilter>(customerParam ? { status: 'checking', id: customerParam } : { status: 'none' });
  const [filterNote, setFilterNote] = useState<string | null>(null);

  useEffect(() => {
    if (!customerParam) {
      setFilter({ status: 'none' });
      return undefined;
    }
    const controller = new AbortController();
    setFilter({ status: 'checking', id: customerParam });
    setPage(1);
    getCustomer(orgId, customerParam, controller.signal)
      .then((c) => {
        setFilter({ status: 'ok', id: c.id, name: c.fullName });
        setFilterNote(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const kind = errorKind(err);
        if (kind === 'forbidden') {
          setFilter({ status: 'ok', id: customerParam, name: null });
          return;
        }
        // 404 (khách của tổ chức khác / đã xoá) hoặc 400 (không phải mã hợp lệ): bỏ lọc, báo một dòng.
        setFilter({ status: 'none' });
        setFilterNote(
          kind === 'not_found' || kind === 'validation'
            ? 'Không tìm thấy khách này trong tổ chức — đang hiện tất cả hợp đồng.'
            : `${userMessage(err)} — đang hiện tất cả hợp đồng.`,
        );
        setSearchParams(
          (sp) => {
            const next = new URLSearchParams(sp);
            next.delete('customerId');
            return next;
          },
          { replace: true },
        );
      });
    return () => controller.abort();
  }, [orgId, customerParam, setSearchParams]);

  const clearFilter = () => {
    setFilterNote(null);
    setPage(1);
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete('customerId');
      return next;
    });
  };
  const customerId = filter.status === 'ok' ? filter.id : null;
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
    // Đang kiểm mã khách: chưa gọi danh sách (không gửi mã lạ lên máy chủ, không hiện nhầm danh sách chưa lọc).
    if (filter.status === 'checking') return undefined;
    const controller = new AbortController();
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    listContracts(
      orgId,
      { page, pageSize: PAGE_SIZE, ...(status ? { status } : {}), ...(term ? { q: term } : {}), ...(customerId ? { customerId } : {}) },
      controller.signal,
    )
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, page, status, term, attempt, customerId, filter.status]);

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
            {filter.status === 'ok' && (
              <div className="ct-filter" role="status" data-o="loc-khach">
                <span>
                  Đang lọc theo khách {filter.name ? <b>{filter.name}</b> : 'đã chọn'}
                </span>
                <span aria-hidden="true">·</span>
                <Button size="sm" variant="ghost" onClick={clearFilter}>
                  Bỏ lọc
                </Button>
              </div>
            )}
            {filterNote && (
              <div className="ct-fx" role="status" data-o="loc-khach-la">
                {filterNote}
              </div>
            )}
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
              message={customerId ? 'Khách này chưa có hợp đồng phù hợp.' : term || status ? 'Không có hợp đồng phù hợp.' : 'Chưa có hợp đồng nào.'}
              action={canCreate && !term && !status && !customerId ? newLink : undefined}
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
