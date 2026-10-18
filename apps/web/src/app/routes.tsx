import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useParams, type RouteObject } from 'react-router';
import { CreateOrgPage } from '../features/auth/CreateOrgPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { BrandPage } from '../features/brand';
import { ContractEditorPage, ContractListPage, NEW_CONTRACT_SEGMENT } from '../features/contracts';
import { CoursesPage } from '../features/courses';
import { CustomersPage } from '../features/customers';
import { DesignsPage } from '../features/designs';
import { PaymentsPage } from '../features/payments';
import { PlatformApp } from '../features/platform';
import { PricingPage } from '../features/pricing';
import { PublicSitePage } from '../features/public-site';
import { CashbookPage, RevenuePage } from '../features/reports';
import { SchedulePage } from '../features/schedule';
import { StaffPage } from '../features/staff';
import { AppShell, NavSectionHome, OrgHome, RequireNavPermission } from '../layout/AppShell';
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

// Màn chưa dựng: đúng một dòng, không nút giả. Thợ màn thay bằng màn thật (cửa vào src/features/<gói>/index.tsx).
export function Placeholder() {
  return <p>Đang dựng</p>;
}

// Mỗi đường trong tổ chức gắn với một mục hoặc mục con điều hướng (khoá trong src/layout/nav.ts) để chặn theo quyền.
function guarded(navKey: string, element: ReactNode) {
  return <RequireNavPermission navKey={navKey}>{element}</RequireNavPermission>;
}

// /hop-dong/moi cần contracts.write (mục con "Lập hợp đồng"); /hop-dong/:id cần contracts.read. Cùng một phần tử
// ContractEditorPage ở cùng chỗ → đổi "moi" → id sau lần lưu đầu KHÔNG dựng lại màn (giữ dữ liệu đang nhập).
function ContractEditorRoute() {
  const { id } = useParams();
  return guarded(id === NEW_CONTRACT_SEGMENT ? 'hop-dong-moi' : 'hop-dong-ds', <ContractEditorPage />);
}

const orgChildren: RouteObject[] = [
  { index: true, element: <OrgHome /> },
  { path: 'lich', element: guarded('lich', <SchedulePage />) },
  { path: 'bang-gia', element: guarded('bang-gia', <PricingPage />) },
  { path: 'bang-gia/:nhom', element: guarded('bang-gia', <PricingPage />) },
  { path: 'hop-dong', element: guarded('hop-dong-ds', <ContractListPage />) },
  { path: 'hop-dong/:id', element: <ContractEditorRoute /> },
  { path: 'thu-tien', element: guarded('thu-tien', <PaymentsPage />) },
  { path: 'thu-tien/:contractId', element: guarded('thu-tien', <PaymentsPage />) },
  { path: 'khach-hang', element: guarded('khach-hang', <CustomersPage />) },
  { path: 'khach-hang/:customerId', element: guarded('khach-hang', <CustomersPage />) },
  { path: 'nhan-su', element: guarded('tho-bac', <StaffPage />) },
  { path: 'nhan-su/bac/:tierId', element: guarded('tho-bac', <StaffPage />) },
  { path: 'nhan-su/tien-cong', element: guarded('tien-cong', <StaffPage />) },
  { path: 'nhan-su/tien-cong/:loai/:id', element: guarded('tien-cong', <StaffPage />) },
  { path: 'bao-cao', element: <NavSectionHome navKey="bao-cao" /> },
  { path: 'bao-cao/doanh-thu', element: guarded('doanh-thu', <RevenuePage />) },
  { path: 'bao-cao/so-thu', element: guarded('so-thu', <CashbookPage />) },
  { path: 'dao-tao', element: guarded('dao-tao', <CoursesPage />) },
  { path: 'dao-tao/*', element: guarded('dao-tao', <CoursesPage />) },
  { path: 'mau-thiet-ke', element: guarded('mau-thiet-ke', <DesignsPage />) },
  { path: 'mau-thiet-ke/*', element: guarded('mau-thiet-ke', <DesignsPage />) },
  { path: 'cai-dat', element: guarded('cai-dat', <Navigate to="thuong-hieu" replace />) },
  { path: 'cai-dat/thuong-hieu', element: guarded('thuong-hieu', <BrandPage />) },
  { path: '*', element: <NotFoundView /> },
];

export const routes: RouteObject[] = [
  // Trang giới thiệu công khai: không đăng nhập, không khung, không khôi phục phiên (không gửi thẻ đăng nhập — C2 mục 4.3).
  // Đặt trước :orgSlug ("trang" là đoạn tĩnh nên luôn thắng :orgSlug).
  { path: 'trang/:slug', element: <PublicSitePage /> },
  {
    element: <Root />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dang-nhap', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: 'dang-ky', element: <GuestOnly><RegisterPage /></GuestOnly> },
      { path: 'tao-to-chuc', element: <RequireAuth><CreateOrgPage /></RequireAuth> },
      // Quản trị nền tảng: trong đăng nhập, ngoài :orgSlug, khung riêng (PlatformShell) do gói quản trị làm — C2 mục 5.
      { path: 'quan-tri/*', element: <RequireAuth><PlatformApp /></RequireAuth> },
      { path: ':orgSlug', element: <RequireAuth><AppShell /></RequireAuth>, children: orgChildren },
      { path: '*', element: <main className="sh-alone"><NotFoundView message="Không có trang này." backTo="/" /></main> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
