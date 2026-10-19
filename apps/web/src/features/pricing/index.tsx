// Cửa vào gói W4 Bảng giá (bản vẽ C mục 4.2). Thợ W4 giữ toàn bộ thư mục này; routes.tsx chỉ nhập từ tệp này.
import { Navigate, useParams } from 'react-router';
import { NotFoundView } from '../../layout/ErrorStates';
import { resolveGroup } from './logic';
import { OccasionsPage } from './OccasionsPage';
import { PackagesPage } from './PackagesPage';
import { ServicesPage } from './ServicesPage';
import { SubjectsPage } from './SubjectsPage';
import { SurchargeRulesPage } from './SurchargeRulesPage';
import { TravelPage } from './TravelPage';
import './pricing.css';

// /:orgSlug/bang-gia → nhóm đầu (Gói theo nhân vật); /:orgSlug/bang-gia/:nhom → đúng nhóm; nhóm lạ → 404 trong khung.
export function PricingPage() {
  const { nhom } = useParams();
  const group = resolveGroup(nhom);
  if (group === null) return <Navigate to="goi" replace />;
  switch (group) {
    case 'goi':
      return <PackagesPage />;
    case 'dich-vu':
      return <ServicesPage />;
    case 'di-chuyen':
      return <TravelPage />;
    case 'nhan-vat':
      return <SubjectsPage />;
    case 'su-kien':
      return <OccasionsPage />;
    case 'luat-phu-phi':
      return <SurchargeRulesPage />;
    default:
      return <NotFoundView message="Không có mục bảng giá này." />;
  }
}
