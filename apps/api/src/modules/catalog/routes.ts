import type { AnyRoute } from '../../http/route';
import { categoryRoutes } from './categories';
import { locationRoutes } from './locations';
import { packageRoutes } from './packages';
import { serviceRoutes } from './services';

// Bảng giá: danh mục, nhân vật makeup, dịch vụ (chính/phụ/phụ phí), gói, phiên bản giá, studio, phí di chuyển.
export const catalogRoutes: AnyRoute[] = [...categoryRoutes, ...serviceRoutes, ...packageRoutes, ...locationRoutes];
