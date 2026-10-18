// Cửa vào màn quản trị nền tảng (bản vẽ C2 mục 5). routes.tsx trỏ /quan-tri/* tới PlatformApp
// (trong đăng nhập, ngoài /:orgSlug). Không có liên kết nào từ app studio tới đây.
import { Route, Routes } from 'react-router';
import { NotFoundView } from '../../layout/ErrorStates';
import { HomePage } from './HomePage';
import { OrganizationsPage } from './OrganizationsPage';
import { PlansPage } from './PlansPage';
import { PlatformGate } from './PlatformGate';
import { PlatformShell } from './PlatformShell';

export function PlatformApp() {
  return (
    <PlatformGate>
      <PlatformShell>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="to-chuc" element={<OrganizationsPage />} />
          <Route path="to-chuc/:organizationId" element={<OrganizationsPage />} />
          <Route path="goi-cuoc" element={<PlansPage />} />
          <Route path="*" element={<NotFoundView message="Không có trang này." backTo="/quan-tri" />} />
        </Routes>
      </PlatformShell>
    </PlatformGate>
  );
}
