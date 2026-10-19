// Trang "Hôm nay" (bản vẽ D mục 2.6): GET /orgs/:orgId/today — vào bằng org.read, TỪNG THẺ theo quyền riêng
// (thiếu quyền → trường null). Chỉ đọc: không ghi nhật ký, không idempotent.
import { defineRoute, mustOrg, type AnyRoute } from '../../http/route';
import { AppError } from '../../lib/errors';
import { collectToday } from './collect';

export const todayRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/today',
    scope: 'org',
    permission: 'org.read',
    tag: 'Hôm nay',
    summary:
      'Trang Hôm nay: ca hôm nay / ngày mai / 7 ngày tới, ca chưa có thợ, đợt thu quá hạn và sắp tới hạn, hợp đồng và ghi danh mới 24 giờ qua, lớp sắp đầy — từng thẻ theo quyền người xem, ngày theo múi giờ tổ chức',
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      const row = await deps.db.organization.findUnique({ where: { id: o.id }, select: { timezone: true, kind: true } });
      if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy tổ chức');
      // Một mốc `now` cho cả yêu cầu.
      const body = await collectToday(deps.db, { org: o, timezone: row.timezone, orgKind: row.kind, now: new Date() });
      return { body };
    },
  }),
];
