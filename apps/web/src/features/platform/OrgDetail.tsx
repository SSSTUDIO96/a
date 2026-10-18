// Cột phải trang Tổ chức (bản vẽ C2 mục 5.4): 4 thẻ — đầu, thuê bao hiện hành, mức dùng, lịch sử.
import { useState } from 'react';
import { Link } from 'react-router';
import { errorKind, userMessage } from '../../api/errors';
import { getPlatformOrganization, type OrgDetail } from '../../api/platform';
import { Button, Card, EmptyState, formatVnd, IconWarn, Skeleton, StatusTag, Tooltip } from '../../ui';
import { fmtDate, KIND_LABELS, SUBSCRIPTION_LABELS, SUBSCRIPTION_TONES } from './labels';
import { platformHref } from './PlatformNav';
import { periodText, SubscriptionHistory } from './SubscriptionHistory';
import { renewTargetFromDetail, SubscriptionDialog, type RenewTarget } from './SubscriptionDialog';
import { SuspendDialog, type SuspendTarget } from './SuspendDialog';
import { UsageBars } from './UsageBars';
import { useLoad } from './useLoad';

export interface OrgDetailPanelProps {
  organizationId: string;
  /** Sau khi gia hạn / khoá / mở khoá: màn tải lại danh sách và số liệu. */
  onChanged: () => void;
  /** Đã tải xong tên (để đặt tiêu đề thanh trên điện thoại). */
  onLoaded?: (d: OrgDetail) => void;
}

export function OrgDetailPanel({ organizationId, onChanged, onLoaded }: OrgDetailPanelProps) {
  const detail = useLoad(organizationId, (signal) =>
    getPlatformOrganization(organizationId, signal).then((d) => {
      onLoaded?.(d);
      return d;
    }),
  );
  const [renew, setRenew] = useState<RenewTarget | null>(null);
  const [suspend, setSuspend] = useState<SuspendTarget | null>(null);
  const changed = () => {
    detail.reload();
    onChanged();
  };

  if (detail.data === null) {
    if (detail.error) {
      if (errorKind(detail.error) === 'not_found') {
        return (
          <EmptyState
            message="Không tìm thấy tổ chức"
            action={
              <Link className="ui-btn" to={platformHref('to-chuc')}>
                Về danh sách
              </Link>
            }
          />
        );
      }
      return <EmptyState message={`Không tải được tổ chức. ${userMessage(detail.error)}`} action={<Button onClick={detail.reload}>Thử lại</Button>} />;
    }
    return (
      <div className="pf-stack" role="status" aria-label="Đang tải tổ chức">
        <Card>
          <Skeleton width="45%" height={18} />
          <div style={{ height: 10 }} />
          <Skeleton width="70%" height={12} />
          <div style={{ height: 14 }} />
          <Skeleton height={60} />
        </Card>
        <Card>
          <Skeleton height={90} />
        </Card>
      </div>
    );
  }

  const d = detail.data;
  const sub = d.currentSubscription;
  const plan = d.effectivePlan;
  const now = Date.now();
  const scheduled = d.subscriptions.filter((s) => !s.isCurrent && new Date(s.startsAt).getTime() > now);
  const suspended = d.status === 'SUSPENDED';

  return (
    <div className="pf-stack">
      <section className="ui-card pf-head" aria-labelledby={`to-chuc-${d.id}`}>
        {d.configError ? (
          <div className="pf-band pf-band--red pf-band--top" role="alert">
            <IconWarn />
            <span>{d.configError}</span>
          </div>
        ) : null}
        <div className="pf-head__top">
          <div className="pf-head__t">
            <h2 id={`to-chuc-${d.id}`}>{d.name}</h2>
            <div className="pf-fx">
              /{d.slug} · {KIND_LABELS[d.kind]} · tạo {fmtDate(d.createdAt)}
            </div>
          </div>
          <StatusTag tone={SUBSCRIPTION_TONES[d.subscriptionStatus]}>{SUBSCRIPTION_LABELS[d.subscriptionStatus]}</StatusTag>
        </div>
        <dl className="pf-kv">
          <dt>Chủ tài khoản</dt>
          <dd>
            {d.owners.length === 0 ? (
              <span className="pf-faint">Chưa có chủ đang hoạt động</span>
            ) : (
              d.owners.map((o) => (
                <div key={o.id}>
                  {o.fullName} · {o.email}
                </div>
              ))
            )}
          </dd>
          <dt>Thành viên</dt>
          <dd>{d.memberCount} người đang hoạt động</dd>
          <dt>Trạng thái tổ chức</dt>
          <dd>{suspended ? <StatusTag tone="danger">Đang khoá</StatusTag> : 'Hoạt động'}</dd>
        </dl>
        <footer className="pf-head__foot">
          <Button variant="primary" onClick={() => setRenew(renewTargetFromDetail(d))}>
            Đổi gói / gia hạn
          </Button>
          {suspended ? (
            <Button onClick={() => setSuspend({ id: d.id, name: d.name, status: d.status })}>Mở khoá</Button>
          ) : (
            <Button className="pf-btn-danger-line" onClick={() => setSuspend({ id: d.id, name: d.name, status: d.status })}>
              Tạm khoá
            </Button>
          )}
        </footer>
      </section>

      <Card title="Thuê bao hiện hành">
        {sub === null ? <p className="pf-muted pf-mb">Chưa có thuê bao — đang áp gói mặc định</p> : null}
        <dl className="pf-kv pf-kv--flush">
          <dt>Gói</dt>
          <dd>
            {plan ? (
              <>
                <b>{plan.plan.name}</b> · <span className="num">{formatVnd(plan.plan.priceMonthly)}</span>/tháng
                {plan.source === 'default' ? ' (mặc định)' : ''}
              </>
            ) : (
              <span className="pf-faint">Chưa xác định (xem lỗi cấu hình ở trên)</span>
            )}
          </dd>
          {sub ? (
            <>
              <dt>Thời hạn</dt>
              <dd className="num">{periodText(sub.startsAt, sub.endsAt)}</dd>
              <dt className="pf-dt-tip">
                Ghi dữ liệu
                <Tooltip text={`Hết hạn thì còn ${d.graceDays} ngày ân hạn vẫn ghi được; sau đó tổ chức chỉ xem. Huỷ hoặc ghi hết hạn bằng tay thì chỉ xem ngay.`} />
              </dt>
              <dd data-testid="ghi-du-lieu">
                {sub.inGrace ? `Còn ân hạn đến ${fmtDate(sub.graceEndsAt)}` : sub.writable ? 'Được' : 'Chỉ xem'}
              </dd>
              <dt>Ghi chú</dt>
              <dd>{sub.note ?? <span className="pf-faint">—</span>}</dd>
            </>
          ) : null}
          {scheduled.length > 0 ? (
            <>
              <dt>Kỳ đã hẹn</dt>
              <dd data-testid="ky-da-hen">
                {scheduled
                  .slice()
                  .reverse()
                  .map((s) => (
                    <div key={s.id}>
                      <b>{s.plan.name}</b> · <span className="num">{periodText(s.startsAt, s.endsAt)}</span>
                    </div>
                  ))}
              </dd>
            </>
          ) : null}
        </dl>
      </Card>

      <UsageBars detail={d} />
      <SubscriptionHistory rows={d.subscriptions} />

      <SubscriptionDialog target={renew} onClose={() => setRenew(null)} onSaved={changed} />
      <SuspendDialog target={suspend} onClose={() => setSuspend(null)} onDone={changed} />
    </div>
  );
}
