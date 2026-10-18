import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router';
import { CreateOrgPage } from '../features/auth/CreateOrgPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { GuestOnly, HomeRedirect, RequireAuth } from './guards';
import { NotFound, OrgShell, Placeholder } from './OrgShell';
import { SessionProvider } from './session';

function Root() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}

// Đường trong một tổ chức (/:orgSlug/...). Các gói W4–W6 thay Placeholder bằng màn thật.
const orgChildren: RouteObject[] = [
  { index: true, element: <Navigate to="lich" replace /> },
  { path: 'lich', element: <Placeholder /> },
  { path: 'bang-gia', element: <Placeholder /> },
  { path: 'bang-gia/:nhom', element: <Placeholder /> },
  { path: 'hop-dong', element: <Placeholder /> },
  { path: 'hop-dong/:id', element: <Placeholder /> },
  { path: 'khach-hang', element: <Placeholder /> },
  { path: 'nhan-su', element: <Placeholder /> },
  { path: 'cai-dat', element: <Placeholder /> },
  { path: '*', element: <NotFound /> },
];

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dang-nhap', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: 'dang-ky', element: <GuestOnly><RegisterPage /></GuestOnly> },
      { path: 'tao-to-chuc', element: <RequireAuth><CreateOrgPage /></RequireAuth> },
      { path: ':orgSlug', element: <RequireAuth><OrgShell /></RequireAuth>, children: orgChildren },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
