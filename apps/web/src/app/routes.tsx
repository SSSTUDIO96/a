import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useParams, type RouteObject } from 'react-router';
import { CreateOrgPage } from '../features/auth/CreateOrgPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { AppShell, NavSectionHome, OrgHome, RequireNavPermission } from '../layout/AppShell';
import { NotFoundView, PageSkeleton } from '../layout/ErrorStates';
import { GuestOnly, HomeRedirect, Loading, RequireAuth } from './guards';
import { SessionProvider } from './session';

// Tách bản web theo màn (biên bản cuối L8): mỗi gói màn là một tệp JS riêng, chỉ tải khi mở màn đó.
// Ở lại tệp vào: phiên, khung (AppShell, thanh trái/dưới, quyền), bộ ui dùng chung và 3 màn đăng nhập/đăng ký/tạo tổ chức
// (màn đầu tiên của người chưa đăng nhập — tách ra thì phải chờ thêm một lượt tải sau khi khôi phục phiên).
// Cửa vào của mỗi gói vẫn là src/features/<gói>/index.tsx — gói không phải đổi gì.
function screen<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return lazy(() => load().then((m) => ({ default: pick(m) })));
}

const BrandPage = screen(() => import('../features/brand'), (m) => m.BrandPage);
const CertificateRegisterPage = screen(() => import('../features/certificates'), (m) => m.CertificateRegisterPage);
const ContractListPage = screen(() => import('../features/contracts'), (m) => m.ContractListPage);
const CoursesPage = screen(() => import('../features/courses'), (m) => m.CoursesPage);
const CustomersPage = screen(() => import('../features/customers'), (m) => m.CustomersPage);
const DesignsPage = screen(() => import('../features/designs'), (m) => m.DesignsPage);
const PaymentsPage = screen(() => import('../features/payments'), (m) => m.PaymentsPage);
const PlatformApp = screen(() => import('../features/platform'), (m) => m.PlatformApp);
const PortalSettingsPage = screen(() => import('../features/portal-settings'), (m) => m.PortalSettingsPage);
const InstallAppPage = screen(() => import('../features/portal-settings'), (m) => m.InstallAppPage);
const PricingPage = screen(() => import('../features/pricing'), (m) => m.PricingPage);
const PublicSitePage = screen(() => import('../features/public-site'), (m) => m.PublicSitePage);
const RevenuePage = screen(() => import('../features/reports'), (m) => m.RevenuePage);
const CashbookPage = screen(() => import('../features/reports'), (m) => m.CashbookPage);
const SchedulePage = screen(() => import('../features/schedule'), (m) => m.SchedulePage);
const StaffPage = screen(() => import('../features/staff'), (m) => m.StaffPage);
const TodayPage = screen(() => import('../features/today'), (m) => m.TodayPage);

// /hop-dong/moi cần contracts.write (mục con "Lập hợp đồng"); /hop-dong/:id cần contracts.read. Cùng một phần tử
// ContractEditorPage ở cùng chỗ → đổi "moi" → id sau lần lưu đầu KHÔNG dựng lại màn (giữ dữ liệu đang nhập).
// Hằng NEW_CONTRACT_SEGMENT nằm trong gói hợp đồng: nhập tĩnh thì cả gói dính vào tệp vào, nên cả đường này tải chậm.
const ContractEditorRoute = screen(
  () => import('../features/contracts'),
  ({ ContractEditorPage, NEW_CONTRACT_SEGMENT }) =>
    function ContractEditorRoute() {
      const { id } = useParams();
      return guarded(id === NEW_CONTRACT_SEGMENT ? 'hop-dong-moi' : 'hop-dong-ds', <ContractEditorPage />);
    },
);

// Đang tải tệp của màn trong khung: khối chờ đúng bố cục ở vùng nội dung, thanh trái/dưới giữ nguyên.
function inShell(element: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;
}

// Ngoài khung (trang công khai, quản trị nền tảng): vòng xoay nhỏ giữa màn.
function alone(element: ReactNode) {
  return <Suspense fallback={<Loading />}>{element}</Suspense>;
}

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
// Kiểm quyền TRƯỚC khi tải tệp màn: không có quyền thì hiện dải 403 ngay, không tải mã của màn.
function guarded(navKey: string, element: ReactNode) {
  return <RequireNavPermission navKey={navKey}>{inShell(element)}</RequireNavPermission>;
}

const orgChildren: RouteObject[] = [
  { index: true, element: <OrgHome /> },
  { path: 'hom-nay', element: guarded('hom-nay', <TodayPage />) },
  { path: 'lich', element: guarded('lich', <SchedulePage />) },
  { path: 'bang-gia', element: guarded('bang-gia', <PricingPage />) },
  { path: 'bang-gia/:nhom', element: guarded('bang-gia', <PricingPage />) },
  { path: 'hop-dong', element: guarded('hop-dong-ds', <ContractListPage />) },
  { path: 'hop-dong/:id', element: inShell(<ContractEditorRoute />) },
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
  { path: 'giay-chung-nhan', element: guarded('giay-chung-nhan', <CertificateRegisterPage />) },
  { path: 'mau-thiet-ke', element: guarded('mau-thiet-ke', <DesignsPage />) },
  { path: 'mau-thiet-ke/*', element: guarded('mau-thiet-ke', <DesignsPage />) },
  { path: 'cai-dat', element: guarded('cai-dat', <Navigate to="thuong-hieu" replace />) },
  { path: 'cai-dat/thuong-hieu', element: guarded('thuong-hieu', <BrandPage />) },
  { path: 'cai-dat/cong-hoc-vien', element: guarded('cong-hoc-vien', <PortalSettingsPage />) },
  { path: 'cai-dat/cai-app', element: guarded('cai-app', <InstallAppPage />) },
  { path: '*', element: <NotFoundView /> },
];

export const routes: RouteObject[] = [
  // Trang giới thiệu công khai: không đăng nhập, không khung, không khôi phục phiên (không gửi thẻ đăng nhập — C2 mục 4.3).
  // Đặt trước :orgSlug ("trang" là đoạn tĩnh nên luôn thắng :orgSlug).
  { path: 'trang/:slug', element: alone(<PublicSitePage />) },
  {
    element: <Root />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dang-nhap', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: 'dang-ky', element: <GuestOnly><RegisterPage /></GuestOnly> },
      { path: 'quen-mat-khau', element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
      // Mở từ thư: KHÔNG chặn người đang đăng nhập (mở thư trên máy đang dùng app); đặt xong máy chủ thu hồi mọi phiên.
      { path: 'dat-lai-mat-khau', element: <ResetPasswordPage /> },
      { path: 'tao-to-chuc', element: <RequireAuth><CreateOrgPage /></RequireAuth> },
      // Quản trị nền tảng: trong đăng nhập, ngoài :orgSlug, khung riêng (PlatformShell) do gói quản trị làm — C2 mục 5.
      { path: 'quan-tri/*', element: <RequireAuth>{alone(<PlatformApp />)}</RequireAuth> },
      { path: ':orgSlug', element: <RequireAuth><AppShell /></RequireAuth>, children: orgChildren },
      { path: '*', element: <main className="sh-alone"><NotFoundView message="Không có trang này." backTo="/" /></main> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
