import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router';
import type { Permission } from '@makeup/shared';
import { errorKind, userMessage } from '../api/errors';
import { useSession } from '../app/session';
import { Button, EmptyState } from '../ui';
import { BottomNav } from './BottomNav';
import { ForbiddenBanner, NotFoundView, OfflineBanner, PageSkeleton } from './ErrorStates';
import { activeNavChild, activeNavItem, findNavEntry, homeNavItem, navEntryAllowed, visibleNav } from './nav';
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

  const pathAfterOrg = location.pathname.slice(`/${org.slug}`.length).replace(/^\/+|\/+$/g, '');
  const items = visibleNav(perms.has, org.kind);
  const active = activeNavItem(pathAfterOrg);
  const activeChild = activeNavChild(active, pathAfterOrg);
  // Đường gốc của chỗ đang đứng: mục con khớp (dài nhất) hoặc mục. Sâu hơn nữa (vd /hop-dong/:id, /thu-tien/:id) là
  // màn con: thanh trên có nút quay về đường gốc.
  const basePath = activeChild?.path ?? active?.path;
  const isChild = basePath !== undefined && pathAfterOrg !== basePath;
  // Mục con trùng đường mặc định của mục (vd "Danh sách hợp đồng" = /hop-dong) → tiêu đề là tên mục.
  const sectionTitle = activeChild && activeChild.path !== active?.path ? activeChild.label : active?.label;
  const title = header?.title ?? sectionTitle ?? org.name;
  const backTo = header?.backTo ?? (isChild ? `/${org.slug}/${basePath}` : undefined);

  let body: ReactNode;
  if (perms.state.status === 'loading') body = <PageSkeleton />;
  else if (perms.state.status === 'error') body = <PermissionsError error={perms.state.error} retry={perms.reload} />;
  else body = <Outlet />;

  return (
    <ShellHeaderContext.Provider value={setHeader}>
      <div className="sh">
        <Sidebar user={user} org={org} organizations={organizations} items={items} active={active} activeChild={activeChild} loading={perms.state.status === 'loading'} />
        <div className="sh-body">
          <TopBar title={title} backTo={backTo} action={header?.phoneAction} />
          <OfflineBanner />
          <main className="sh-main">{body}</main>
        </div>
        <BottomNav user={user} org={org} organizations={organizations} items={items} active={active} activeChild={activeChild} />
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

// Loại tổ chức đang mở (INDIVIDUAL / TEAM / ACADEMY) — lấy từ phiên (GET /auth/me → organizations[].kind).
function useOrgKind() {
  const { orgSlug } = useParams();
  const { organizations } = useSession();
  return organizations.find((o) => o.slug === orgSlug)?.kind;
}

// Chặn đường theo quyền của mục / mục con điều hướng (khoá trong nav.ts): vào thẳng đường không có quyền → dải 403,
// không hiện màn.
export function RequireNavPermission({ navKey, children }: { navKey: string; children: ReactNode }) {
  const has = usePermissions();
  const kind = useOrgKind();
  const entry = findNavEntry(navKey);
  if (!entry) throw new Error(`Không có mục điều hướng "${navKey}" trong nav.ts`);
  if (!navEntryAllowed(navKey, has, kind)) {
    const text = entry.child
      ? (entry.child.forbidden ?? `Bạn không có quyền xem ${entry.child.label.toLocaleLowerCase('vi')}.`)
      : `Bạn không có quyền xem ${entry.item.label.toLocaleLowerCase('vi')}.`;
    return <ForbiddenBanner>{text}</ForbiddenBanner>;
  }
  return children;
}

// Đường gốc của một mục chỉ có mục con (vd /bao-cao) → mục con đầu tiên được xem; không có → dải 403.
export function NavSectionHome({ navKey }: { navKey: string }) {
  const has = usePermissions();
  const kind = useOrgKind();
  const { orgSlug } = useParams();
  const item = visibleNav(has, kind).find((i) => i.key === navKey);
  const label = findNavEntry(navKey)?.item.label ?? navKey;
  if (!item) return <ForbiddenBanner>Bạn không có quyền xem {label.toLocaleLowerCase('vi')}.</ForbiddenBanner>;
  return <Navigate to={`/${orgSlug ?? ''}/${item.href}`} replace />;
}

// /:orgSlug → mục đầu tiên người dùng được xem.
export function OrgHome() {
  const has = usePermissions();
  const kind = useOrgKind();
  const home = homeNavItem(has, kind);
  if (!home) return <EmptyState message="Tài khoản của bạn chưa được cấp quyền xem mục nào trong tổ chức này. Hãy nhờ chủ tổ chức cấp quyền." />;
  return <Navigate to={home.href} replace />;
}

export function usePermission(p: Permission): boolean {
  return usePermissions()(p);
}
