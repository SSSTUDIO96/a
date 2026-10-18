import type { ReactNode } from 'react';
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router';
import { CreateOrgPage } from '../features/auth/CreateOrgPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { AppShell, OrgHome, RequireNavPermission } from '../layout/AppShell';
import { NotFoundView } from '../layout/ErrorStates';
import { GuestOnly, HomeRedirect, RequireAuth } from './guards';
import { SessionProvider } from './session';

function Root() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}

// Màn chưa dựng: đúng một dòng, không nút giả. Các gói W4–W6 thay bằng màn thật.
export function Placeholder() {
  return <p>Đang dựng</p>;
}

// Mỗi đường trong tổ chức gắn với một mục điều hướng (src/layout/nav.ts) để chặn theo quyền.
function guarded(navKey: string, element: ReactNode) {
  return <RequireNavPermission navKey={navKey}>{element}</RequireNavPermission>;
}

const orgChildren: RouteObject[] = [
  { index: true, element: <OrgHome /> },
  { path: 'lich', element: guarded('lich', <Placeholder />) },
  { path: 'bang-gia', element: guarded('bang-gia', <Placeholder />) },
  { path: 'bang-gia/:nhom', element: guarded('bang-gia', <Placeholder />) },
  { path: 'hop-dong', element: guarded('hop-dong', <Placeholder />) },
  { path: 'hop-dong/:id', element: guarded('hop-dong', <Placeholder />) },
  { path: 'khach-hang', element: guarded('khach-hang', <Placeholder />) },
  { path: 'nhan-su', element: guarded('nhan-su', <Placeholder />) },
  { path: 'cai-dat', element: guarded('cai-dat', <Placeholder />) },
  { path: '*', element: <NotFoundView /> },
];

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dang-nhap', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: 'dang-ky', element: <GuestOnly><RegisterPage /></GuestOnly> },
      { path: 'tao-to-chuc', element: <RequireAuth><CreateOrgPage /></RequireAuth> },
      { path: ':orgSlug', element: <RequireAuth><AppShell /></RequireAuth>, children: orgChildren },
      { path: '*', element: <main className="sh-alone"><NotFoundView message="Không có trang này." backTo="/" /></main> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
