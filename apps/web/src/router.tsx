import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { GuestOnly, HomeRedirect, RequireAuth } from './components/guards';
import { SessionProvider } from './lib/session';
import { CreateOrgPage } from './pages/CreateOrgPage';
import { LoginPage } from './pages/LoginPage';
import { NotFound, OrgShell, Placeholder, SECTIONS } from './pages/OrgShell';
import { RegisterPage } from './pages/RegisterPage';

function Root() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dang-nhap', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: 'dang-ky', element: <GuestOnly><RegisterPage /></GuestOnly> },
      { path: 'tao-to-chuc', element: <RequireAuth><CreateOrgPage /></RequireAuth> },
      {
        path: ':orgSlug',
        element: <RequireAuth><OrgShell /></RequireAuth>,
        children: [
          { index: true, element: <Navigate to="lich" replace /> },
          ...SECTIONS.map((s) => ({ path: s.path, element: <Placeholder /> })),
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
