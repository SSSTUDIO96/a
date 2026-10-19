import { z } from 'zod';
import { defineRoute, mustOrg, mustUser, type AnyRoute } from '../../http/route';
import { blockDevice, createLink, getAdminView, revokeAll } from './center';
import { portalSettingsRoutes } from './settings';

// Đường phía trung tâm (bản vẽ E 4.3, 4.4 — gói E4): xem trạng thái, tạo / thu hồi đường dẫn, chặn máy, cài đặt cổng.
// Mọi đường: scope "org", tổ chức ACADEMY (403 ACADEMY_REQUIRED), tag 'Cổng học viên'.
// Tạo đường dẫn KHÔNG khai idempotent (bản vẽ E 2.2 luật 5): kho chống gửi trùng cất nguyên phản hồi = cất chìa bản rõ.

const TAG = 'Cổng học viên';
const CustomerParams = z.object({ orgId: z.uuid(), customerId: z.uuid() });
const DeviceParams = z.object({ orgId: z.uuid(), deviceId: z.uuid() });
const Reason = z.string().trim().min(1).max(200);

export const centerPortalRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/customers/:customerId/portal',
    scope: 'org',
    permission: 'portal.manage',
    tag: TAG,
    summary: 'Trạng thái cổng học viên của một học viên: đường dẫn mới nhất, máy đã mở (không có chìa hay bản băm)',
    params: CustomerParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      return { body: await getAdminView(deps.db, o.id, params.customerId) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/customers/:customerId/portal/links',
    scope: 'org',
    permission: 'portal.manage',
    tag: TAG,
    summary:
      'Tạo đường dẫn cổng học viên (thu hồi đường dẫn cũ, máy đã mở giữ nguyên). Chìa chỉ trả MỘT lần. ' +
      'Cần thêm customers.read, contracts.read, payments.read',
    params: CustomerParams,
    body: z.object({ phoneConfirmed: z.literal(true) }),
    handler: async ({ req, deps, org, params, userId, requestId }) => {
      const o = mustOrg(org);
      const created = await createLink(deps.db, { org: o, userId: mustUser(userId), requestId }, params.customerId);
      // Chìa bản rõ trong thân: không cho trình duyệt / proxy giữ bản sao.
      req.res?.setHeader('Cache-Control', 'no-store');
      return { status: 201, body: created };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/customers/:customerId/portal/revoke',
    scope: 'org',
    permission: 'portal.manage',
    tag: TAG,
    summary: 'Thu hồi đường dẫn và chặn mọi máy của học viên (phiên đang mở bị chặn ngay ở lần gọi kế)',
    params: CustomerParams,
    body: z.object({ reason: Reason }),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      return { body: await revokeAll(deps.db, { org: o, userId: mustUser(userId), requestId }, params.customerId, body.reason) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/portal-devices/:deviceId/block',
    scope: 'org',
    permission: 'portal.manage',
    tag: TAG,
    summary: 'Chặn một máy đã mở cổng học viên (phiên của máy bị chặn ngay ở lần gọi kế)',
    params: DeviceParams,
    body: z.object({ reason: Reason }),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      return { body: await blockDevice(deps.db, { org: o, userId: mustUser(userId), requestId }, params.deviceId, body.reason) };
    },
  }),

  ...portalSettingsRoutes,
];
