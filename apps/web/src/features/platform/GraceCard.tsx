// "Hết hạn, còn ân hạn" + "Tổ chức mới 7 ngày qua" (bản vẽ C2 mục 5.3).
// - Ân hạn: GET /platform/organizations?subscriptionStatus=EXPIRED&pageSize=20, lọc phía máy subscription.inGrace.
// - Mới: GET /platform/organizations?pageSize=5 (máy chủ xếp mới tạo trước), lọc createdAt trong 7 ngày.
import { userMessage } from '../../api/errors';
import { listPlatformOrganizations, type OrgListItem } from '../../api/platform';
import type { Page } from '../../api/types';
import { Button, Card, ListGroupHeader, ListRowSkeleton, StatusTag } from '../../ui';
import { fmtShort, SUBSCRIPTION_LABELS, SUBSCRIPTION_TONES } from './labels';
import { TaskRow } from './TaskRow';
import type { Loaded } from './useLoad';

export const GRACE_PAGE = 20;
export const NEW_PAGE = 5;
const WEEK_MS = 7 * 24 * 3600_000;

export function loadExpired(signal: AbortSignal) {
  return listPlatformOrganizations({ subscriptionStatus: 'EXPIRED', pageSize: GRACE_PAGE }, signal);
}
export function loadNewest(signal: AbortSignal) {
  return listPlatformOrganizations({ pageSize: NEW_PAGE }, signal);
}

export function inGrace(items: OrgListItem[]): OrgListItem[] {
  return items.filter((o) => o.subscription?.inGrace === true);
}

export function newThisWeek(items: OrgListItem[], now = Date.now()): OrgListItem[] {
  return items.filter((o) => now - new Date(o.createdAt).getTime() <= WEEK_MS);
}

function LoadError({ data }: { data: Loaded<unknown> }) {
  return (
    <div className="pf-pad">
      <p className="pf-err" role="alert">
        Không tải được. {userMessage(data.error)}
      </p>
      <Button size="sm" onClick={data.reload}>
        Thử lại
      </Button>
    </div>
  );
}

export function GraceCard({
  expired,
  newest,
  onRenew,
}: {
  expired: Loaded<Page<OrgListItem>>;
  newest: Loaded<Page<OrgListItem>>;
  onRenew: (o: OrgListItem) => void;
}) {
  const grace = expired.data ? inGrace(expired.data.items) : [];
  const fresh = newest.data ? newThisWeek(newest.data.items) : [];
  return (
    <Card className="pf-tasks" title="Hết hạn, còn ân hạn" subtitle="còn ghi được tới hết ân hạn" flush>
      {expired.data === null ? (
        expired.error ? (
          <LoadError data={expired} />
        ) : (
          <ListRowSkeleton rows={2} amount label="Đang tải tổ chức trong ân hạn" />
        )
      ) : grace.length === 0 ? (
        <p className="pf-muted pf-pad">Không có tổ chức nào đang trong ân hạn.</p>
      ) : (
        grace.map((o) => (
          <TaskRow
            key={o.id}
            id={o.id}
            name={o.name}
            sub={
              <>
                Hết {fmtShort(o.subscription?.endsAt)} ·{' '}
                <StatusTag tone={SUBSCRIPTION_TONES[o.subscriptionStatus]}>{SUBSCRIPTION_LABELS[o.subscriptionStatus]}</StatusTag>
              </>
            }
            right={
              <span className="pf-fx">
                ân hạn đến <b>{fmtShort(o.subscription?.graceEndsAt)}</b>
              </span>
            }
            onRenew={() => onRenew(o)}
          />
        ))
      )}
      {expired.data && expired.data.total > expired.data.items.length ? (
        <p className="pf-muted pf-pad pf-small">
          Chỉ xét {expired.data.items.length} tổ chức hết hạn mới tạo nhất (có {expired.data.total}) — xem đủ ở Tổ chức › Hết hạn.
        </p>
      ) : null}
      <ListGroupHeader>Tổ chức mới 7 ngày qua</ListGroupHeader>
      {newest.data === null ? (
        newest.error ? (
          <LoadError data={newest} />
        ) : (
          <ListRowSkeleton rows={2} label="Đang tải tổ chức mới" />
        )
      ) : fresh.length === 0 ? (
        <p className="pf-muted pf-pad">Không có tổ chức mới trong 7 ngày qua.</p>
      ) : (
        <>
          {fresh.map((o) => (
            <TaskRow
              key={o.id}
              id={o.id}
              name={o.name}
              sub={o.subscription?.plan.name ?? SUBSCRIPTION_LABELS.NONE}
              right={<span className="pf-fx num">{fmtShort(o.createdAt)}</span>}
            />
          ))}
          {fresh.length === NEW_PAGE && newest.data.total > NEW_PAGE ? (
            <p className="pf-muted pf-pad pf-small">Chỉ hiện {NEW_PAGE} tổ chức mới nhất — có thể còn nữa ở trang Tổ chức.</p>
          ) : null}
        </>
      )}
    </Card>
  );
}
