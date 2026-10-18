// "Sắp hết hạn · 30 ngày tới" (bản vẽ C2 mục 5.3): GET /platform/organizations?expiringWithinDays=30&pageSize=5.
import { Link } from 'react-router';
import { userMessage } from '../../api/errors';
import { listPlatformOrganizations, type OrgListItem } from '../../api/platform';
import { Button, Card, ListRowSkeleton, StatusTag } from '../../ui';
import { fmtDate, SUBSCRIPTION_LABELS, SUBSCRIPTION_TONES } from './labels';
import { platformHref } from './PlatformNav';
import { TaskRow } from './TaskRow';
import type { Loaded } from './useLoad';
import type { Page } from '../../api/types';

export function loadExpiring(signal: AbortSignal) {
  return listPlatformOrganizations({ expiringWithinDays: 30, pageSize: 5 }, signal);
}

export function ExpiringCard({ data, onRenew }: { data: Loaded<Page<OrgListItem>>; onRenew: (o: OrgListItem) => void }) {
  const page = data.data;
  return (
    <Card
      className="pf-tasks"
      title="Sắp hết hạn"
      subtitle="30 ngày tới"
      actions={
        <Link className="ui-btn ui-btn--ghost ui-btn--sm" to={`${platformHref('to-chuc')}?loc=sap-het-han`}>
          Xem tất cả
        </Link>
      }
      flush
    >
      {page === null ? (
        data.error ? (
          <div className="pf-pad">
            <p className="pf-err" role="alert">
              Không tải được. {userMessage(data.error)}
            </p>
            <Button size="sm" onClick={data.reload}>
              Thử lại
            </Button>
          </div>
        ) : (
          <ListRowSkeleton rows={3} amount label="Đang tải tổ chức sắp hết hạn" />
        )
      ) : page.items.length === 0 ? (
        <p className="pf-muted pf-pad">Không có tổ chức nào hết hạn trong 30 ngày tới.</p>
      ) : (
        <>
          {page.items.map((o) => (
            <TaskRow
              key={o.id}
              id={o.id}
              name={o.name}
              sub={
                <>
                  {o.subscription?.plan.name ?? '—'} ·{' '}
                  <StatusTag tone={SUBSCRIPTION_TONES[o.subscriptionStatus]}>{SUBSCRIPTION_LABELS[o.subscriptionStatus]}</StatusTag>
                </>
              }
              right={<b className="num">{fmtDate(o.subscription?.endsAt)}</b>}
              onRenew={() => onRenew(o)}
            />
          ))}
          {page.total > page.items.length ? (
            <p className="pf-muted pf-pad pf-small">
              Còn {page.total - page.items.length} tổ chức nữa — bấm "Xem tất cả".
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
