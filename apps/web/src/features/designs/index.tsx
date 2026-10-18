// Cửa vào màn Mẫu thiết kế (bản vẽ C3 mục 2.6). Thợ màn Mẫu thiết kế giữ toàn bộ thư mục này; routes.tsx chỉ nhập từ tệp này.
// Đường: /:orgSlug/mau-thiet-ke/<thẻ> — the-chao · feedback · loi-chuc (tạo thẻ) · da-tao (thẻ đã tạo) · cau-chuc (câu chúc soạn sẵn).
import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useSession } from '../../app/session';
import { NotFoundView } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { usePermissions, usePermissionsContext } from '../../layout/usePermissions';
import { useOrgInfo } from '../staff/useOrgInfo';
import { CardList } from './CardList';
import { DesignStudio } from './DesignStudio';
import { designPerms, kindTabsFor, type DesignsTab } from './model';
import { PhraseManager } from './PhraseManager';
import '../staff/staff.css';
import './designs.css';

export function DesignsPage() {
  const params = useParams();
  const tab = (params['*'] ?? '').split('/')[0] ?? '';
  const org = useOrgInfo();
  const ctx = usePermissionsContext();
  const has = usePermissions();
  const perms = useMemo(() => designPerms(has), [has]);
  const { user } = useSession();
  const phone = useBreakpoint() === 'phone';
  const orgKind = ctx.state.status === 'ready' ? ctx.state.org.kind : undefined;

  // Không có designs.write: chỉ xem thẻ đã tạo và câu chúc (C3 2.6 "Quyền").
  const kindTabs = perms.write ? kindTabsFor(orgKind) : [];
  const tabs: { path: DesignsTab; label: string }[] = [
    ...kindTabs.map((t) => ({ path: t.path, label: t.label })),
    { path: 'da-tao', label: 'Thẻ đã tạo' },
    { path: 'cau-chuc', label: 'Câu chúc soạn sẵn' },
  ];
  const base = `/${org.slug}/mau-thiet-ke`;
  if (!tab) return <Navigate to={`${base}/${tabs[0]?.path ?? 'da-tao'}`} replace />;
  const current = tabs.find((t) => t.path === tab);
  const kindTab = kindTabs.find((t) => t.path === tab);

  return (
    <>
      <PageHeader title="Mẫu thiết kế" />
      <nav className="mtk-tabs" aria-label="Mẫu thiết kế">
        {tabs.map((t) => (
          <Link key={t.path} to={`${base}/${t.path}`} className="mtk-tabs__a" aria-current={t.path === tab ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {!current ? (
        <NotFoundView message="Không có mục này trong Mẫu thiết kế." backTo={base} />
      ) : kindTab ? (
        <DesignStudio
          key={kindTab.kind}
          kind={kindTab.kind}
          orgId={org.orgId}
          orgKind={orgKind}
          timezone={org.timezone}
          perms={perms}
          userName={user?.fullName ?? null}
        />
      ) : tab === 'da-tao' ? (
        <CardList orgId={org.orgId} orgKind={orgKind} timezone={org.timezone} perms={perms} />
      ) : (
        <PhraseManager orgId={org.orgId} phone={phone} perms={perms} />
      )}
    </>
  );
}
