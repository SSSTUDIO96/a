// Module mẫu in hợp đồng (bản vẽ G mục 3.2). Gói G-M3: đường mẫu in (templates.ts). Gói G-M4: đường dữ liệu in + nhật ký
// in (prints.ts).
import type { AnyRoute } from '../../http/route';
import { printRoutes } from './prints';
import { templateRoutes } from './templates';

export const printModuleRoutes: AnyRoute[] = [...templateRoutes, ...printRoutes];
