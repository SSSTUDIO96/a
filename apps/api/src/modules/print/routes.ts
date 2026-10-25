// Module mẫu in hợp đồng (bản vẽ G mục 3.2). Gói G-M3: đường mẫu in (templates.ts). Gói G-M4 nối thêm đường dữ liệu in +
// nhật ký in (prints.ts) vào mảng này.
import type { AnyRoute } from '../../http/route';
import { templateRoutes } from './templates';

export const printModuleRoutes: AnyRoute[] = [...templateRoutes];
