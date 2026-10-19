import type { AnyRoute } from '../../http/route';
import { centerPortalRoutes } from './center-routes';
import { studentPortalRoutes } from './student-routes';

// Cổng học viên (bản vẽ E): đăng ký một lần ở app.ts; gói E3 điền student-routes.ts, gói E4 điền center-routes.ts.
export const portalRoutes: AnyRoute[] = [...studentPortalRoutes, ...centerPortalRoutes];
