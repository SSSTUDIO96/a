// Cửa vào màn Hôm nay (bản vẽ D mục 3.1). routes.tsx chỉ nhập từ tệp này. Đường: /:orgSlug/hom-nay
// Một lần gọi GET /today; từng thẻ theo quyền do MÁY CHỦ quyết (trường null = thiếu quyền → web không vẽ thẻ, không tải gì thêm).
import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { errorKind, userMessage } from '../../api/errors';
import { useSession } from '../../app/session';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { usePermissions } from '../../layout/usePermissions';
import { Button, Card, EmptyState, ListRowSkeleton, StatGrid, StatTile } from '../../ui';
import { IconRefresh } from './icons';
import { DueSoonCard } from './DueSoonCard';
import { staffNaming } from '../../ui/staffName';
import { hhmm, pageTitle, todayRoster, type TodayAccess } from './model';
import { MyDayCards } from './MyDayCards';
import { NeedsActionCard } from './NeedsActionCard';
import { NewCard } from './NewCard';
import { TodayTiles } from './TodayTiles';
import { TomorrowCard } from './TomorrowCard';
import { useStaffRoster } from './useStaffRoster';
import { useToday } from './useToday';
import './today.css';

export function TodayPage() {
  const { orgSlug } = useParams();
  const { organizations } = useSession();
  const has = usePermissions();
  const org = organizations.find((o) => o.slug === orgSlug);
  const access = useMemo<TodayAccess>(() => ({ paymentsWrite: has('payments.write'), scheduleWrite: has('schedule.write'), staffRead: has('staff.read') }), [has]);
  if (!org) return null;
  return <TodayScreen orgId={org.id} orgSlug={org.slug} access={access} />;
}

export function TodayScreen({ orgId, orgSlug, access }: { orgId: string; orgSlug: string; access: TodayAccess }) {
  const { state, refreshing, refreshError, reload, retry } = useToday(orgId);
  const view = state.status === 'ready' ? state.view : null;
  // Sổ thợ chung (tên ngắn xử lý trùng + màu ảnh) — cùng hàm với Lịch và Hợp đồng.
  const roster = useStaffRoster(orgId, access.staffRead);
  const naming = useMemo(() => staffNaming([...roster, ...(view ? todayRoster(view) : [])]), [roster, view]);
  const title = view ? pageTitle(view.today) : 'Hôm nay';

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const refresh = (
    <>
      {view && <span className="td-stamp">Cập nhật {hhmm(view.generatedAt, view.timezone)}</span>}
      <Button size="sm" icon={<IconRefresh />} loading={refreshing} onClick={reload} title="Tải lại số liệu mới nhất" disabled={state.status !== 'ready'}>
        Làm mới
      </Button>
    </>
  );
  const phoneAction = useMemo(
    () => (
      <Button size="sm" variant="ghost" aria-label="Làm mới" title="Tải lại số liệu mới nhất" icon={<IconRefresh />} onClick={reload} disabled={state.status !== 'ready'} />
    ),
    [reload, state.status],
  );

  let body;
  if (state.status === 'loading') body = <TodaySkeleton />;
  else if (state.status === 'error') {
    body =
      errorKind(state.error) === 'forbidden' ? (
        <ForbiddenBanner>{userMessage(state.error)}</ForbiddenBanner>
      ) : (
        <Card>
          <EmptyState message={`Không tải được trang Hôm nay. ${userMessage(state.error)}`} action={<Button onClick={retry}>Thử lại</Button>} />
        </Card>
      );
  } else if (state.view.scheduleScope === 'OWN') {
    body = <MyDayCards view={state.view} orgSlug={orgSlug} />;
  } else {
    const v = state.view;
    body = (
      <>
        <TodayTiles view={v} orgSlug={orgSlug} naming={naming} onJump={jump} />
        <div className="td-grid">
          <div className="td-col">
            <NeedsActionCard view={v} orgSlug={orgSlug} access={access} />
            <DueSoonCard view={v} orgSlug={orgSlug} />
          </div>
          <div className="td-col">
            <TomorrowCard view={v} orgSlug={orgSlug} naming={naming} />
            <NewCard view={v} orgSlug={orgSlug} />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="td">
      <PageHeader title={title} actions={refresh} phoneAction={phoneAction} />
      {refreshError !== null && (
        <div className="sh-banner sh-banner--warn" role="status">
          Không làm mới được: {userMessage(refreshError)} Đang hiện số liệu của lần tải trước.
        </div>
      )}
      {body}
    </div>
  );
}

// Khối chờ đúng hình trang: 4 ô số + 2 thẻ danh sách.
function TodaySkeleton() {
  return (
    <div role="status" aria-label="Đang tải trang Hôm nay">
      <StatGrid label="Đang tải số liệu" className="td-tiles">
        {['Ca hôm nay', 'Ca ngày mai', 'Đợt thu quá hạn', 'Đến hạn 7 ngày tới'].map((l) => (
          <StatTile key={l} label={l} value="" loading />
        ))}
      </StatGrid>
      <div className="td-grid">
        <div className="td-col">
          <Card title="Cần làm ngay" flush>
            <ListRowSkeleton rows={3} avatar amount label="Đang tải việc cần làm" />
          </Card>
        </div>
        <div className="td-col">
          <Card title="Ngày mai" flush>
            <ListRowSkeleton rows={3} avatar label="Đang tải ca ngày mai" />
          </Card>
        </div>
      </div>
    </div>
  );
}
