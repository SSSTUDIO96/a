import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router';
import type { Permission } from '@makeup/shared';
import { errorKind, userMessage } from '../api/errors';
import { useSession } from '../app/session';
import { Button, EmptyState } from '../ui';
import { BottomNav } from './BottomNav';
import { ForbiddenBanner, NotFoundView, OfflineBanner, PageSkeleton } from './ErrorStates';
import { activeNavItem, homeNavItem, NAV_ITEMS, visibleNav } from './nav';
import { ShellHeaderContext, type ShellHeader } from './PageHeader';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PermissionsProvider, usePermissions, usePermissionsContext } from './usePermissions';
import './layout.css';

// Khung đã đăng nhập của một tổ chức (/:orgSlug/...) — bản vẽ C mục 2, 5, 6.
export function AppShell() {
  const { orgSlug } = useParams();
  const { user, organizations, currentOrg, selectOrg } = useSession();
  const org = organizations.find((o) => o.slug === orgSlug);

  useEffect(() => {
    if (org && currentOrg?.id !== org.id) selectOrg(org.id);
  }, [org, currentOrg, selectOrg]);

  if (organizations.length === 0) return <Navigate to="/tao-to-chuc" replace />;
  if (!org || !user) {
    return (
      <main className="sh-alone">
        <NotFoundView message="Không tìm thấy tổ chức này, hoặc bạn không còn là thành viên." backTo="/" />
      </main>
    );
  }
  return (
    <PermissionsProvider orgId={org.id}>
      <ShellFrame />
    </PermissionsProvider>
  );
}

function ShellFrame() {
  const { orgSlug } = useParams();
  const { user, organizations } = useSession();
  const perms = usePermissionsContext();
  const location = useLocation();
  const [header, setHeader] = useState<ShellHeader | null>(null);
  const org = organizations.find((o) => o.slug === orgSlug);
  if (!org || !user) return null;

  const pathAfterOrg = location.pathname.slice(`/${org.slug}`.length).replace(/^\/+/, '');
  const items = visibleNav(perms.has);
  const active = activeNavItem(pathAfterOrg);
  const activeChild = active?.children?.find((c) => c.path === pathAfterOrg);
  // Màn con (vd /hop-dong/:id): thanh trên có nút quay về mục cha.
  const isChild = active !== undefined && pathAfterOrg !== active.path && activeChild === undefined;
  const title = header?.title ?? activeChild?.label ?? active?.label ?? org.name;
  const backTo = header?.backTo ?? (isChild && active ? `/${org.slug}/${active.path}` : undefined);

  let body: ReactNode;
  if (perms.state.status === 'loading') body = <PageSkeleton />;
  else if (perms.state.status === 'error') body = <PermissionsError error={perms.state.error} retry={perms.reload} />;
  else body = <Outlet />;

  return (
    <ShellHeaderContext.Provider value={setHeader}>
      <div className="sh">
        <Sidebar user={user} org={org} organizations={organizations} items={items} active={active} loading={perms.state.status === 'loading'} />
        <div className="sh-body">
          <TopBar title={title} backTo={backTo} action={header?.phoneAction} />
          <OfflineBanner />
          <main className="sh-main">{body}</main>
        </div>
        <BottomNav user={user} org={org} organizations={organizations} items={items} active={active} />
      </div>
    </ShellHeaderContext.Provider>
  );
}

function PermissionsError({ error, retry }: { error: unknown; retry: () => void }) {
  const kind = errorKind(error);
  if (kind === 'not_found') return <NotFoundView message="Không tìm thấy tổ chức này, hoặc bạn không còn là thành viên." backTo="/" />;
  if (kind === 'forbidden') return <ForbiddenBanner>{userMessage(error)}</ForbiddenBanner>;
  return (
    <EmptyState
      message={`Không tải được quyền của bạn trong tổ chức. ${userMessage(error)}`}
      action={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}

// Chặn đường theo quyền của mục điều hướng: vào thẳng đường dẫn không có quyền → dải 403, không hiện màn.
export function RequireNavPermission({ navKey, children }: { navKey: string; children: ReactNode }) {
  const has = usePermissions();
  const item = NAV_ITEMS.find((i) => i.key === navKey);
  if (!item) throw new Error(`Không có mục điều hướng "${navKey}" trong nav.ts`);
  if (!has(item.permission)) return <ForbiddenBanner>Bạn không có quyền xem {item.label.toLocaleLowerCase('vi')}.</ForbiddenBanner>;
  return children;
}

// /:orgSlug → mục đầu tiên người dùng được xem.
export function OrgHome() {
  const has = usePermissions();
  const home = homeNavItem(has);
  if (!home) return <EmptyState message="Tài khoản của bạn chưa được cấp quyền xem mục nào trong tổ chức này. Hãy nhờ chủ tổ chức cấp quyền." />;
  return <Navigate to={home.path} replace />;
}

export function usePermission(p: Permission): boolean {
  return usePermissions()(p);
}
