import type { AnyRoute } from '../../http/route';
import { categoryRoutes } from './categories';
import { locationRoutes } from './locations';
import { occasionRoutes } from './occasions';
import { packageRoutes } from './packages';
import { serviceRoutes } from './services';
import { surchargeRuleRoutes } from './surcharge-rules';

// Bảng giá: danh mục, nhân vật makeup, dịch vụ (chính/phụ/phụ phí), gói, phiên bản giá, studio, phí di chuyển,
// loại sự kiện, luật phụ phí (bản vẽ D mục 2.2–2.3).
export const catalogRoutes: AnyRoute[] = [
  ...categoryRoutes,
  ...serviceRoutes,
  ...packageRoutes,
  ...locationRoutes,
  ...occasionRoutes,
  ...surchargeRuleRoutes,
];
