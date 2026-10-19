import { z } from 'zod';
import { defineRoute, mustPortal, type AnyRoute } from '../../http/route';
import { portalDeniedError } from './auth';
import { CLEAR_PORTAL_COOKIE, portalCookie, readPortalCookie } from './cookie';
import { createHandoff, signOutDevice } from './handoff';
import { loadPortalMe } from './me';
import { claimHandoff, redeemLink, withResponseFloor } from './redeem';

// Đường của học viên (bản vẽ E 4.2, gói E3). Học viên lấy TỪ PHIÊN: không đường nào có :tham số, query hay trường …Id
// (defineRoute từ chối lúc khởi động). Hai đường public mở phiên dùng bộ đếm 'portal' và MỘT lời chung cho mọi lần hỏng.
// Mọi phản hồi: Cache-Control: no-store (đặt ngay đầu handler để bộ header của lần hỏng và lần được giống nhau).

const TAG = 'Cổng học viên';

function noStore(req: { res?: { setHeader(name: string, value: string): unknown } }): void {
  req.res?.setHeader('Cache-Control', 'no-store');
}

export const studentPortalRoutes: AnyRoute[] = [
  defineRoute({
    method: 'post',
    path: '/portal/session',
    scope: 'public',
    rateLimit: 'portal',
    tag: TAG,
    summary: 'Mở trang học viên bằng đường dẫn (chìa sau #k=) + 4 số cuối số điện thoại. Hỏng vì bất cứ lý do gì: một lời chung',
    // Chìa 1–200 ký tự (không kiểm độ dài 43: chìa sai độ dài cũng rơi vào lời chung). 4 số sai dạng → 400, không phụ
    // thuộc chìa có thật hay không nên không lộ gì (bản vẽ E 2.5).
    body: z.object({ key: z.string().min(1).max(200), last4: z.string().regex(/^\d{4}$/, 'Nhập đúng 4 chữ số') }),
    handler: async ({ req, deps, body, requestId }) => {
      const start = Date.now();
      noStore(req);
      const result = await withResponseFloor(start, () => redeemLink(deps, req, body, requestId));
      if (!result.ok) throw portalDeniedError();
      // Không trả tên học viên, tên trung tâm hay gì khác: chỉ { ok: true } + cookie.
      return { status: 201, body: { ok: true }, cookies: [portalCookie(result.token)] };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/portal/session/claim',
    scope: 'public',
    rateLimit: 'portal',
    tag: TAG,
    summary: 'Nhận phiên trên app vừa cài bằng mã chuyển máy (8 ký tự, 10 phút, dùng một lần). Hỏng: một lời chung',
    body: z.object({ code: z.string().min(1).max(20) }),
    handler: async ({ req, deps, body, requestId }) => {
      const start = Date.now();
      noStore(req);
      const result = await withResponseFloor(start, () => claimHandoff(deps, req, body, requestId));
      if (!result.ok) throw portalDeniedError();
      return { status: 201, body: { ok: true }, cookies: [portalCookie(result.token)] };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/portal/session/handoff',
    scope: 'portal',
    tag: TAG,
    summary: 'Tạo mã chuyển sang app đã cài lên màn hình chính (ghi đè mã cũ; không tốn suất máy)',
    handler: async ({ req, deps, portal, requestId }) => {
      noStore(req);
      return { status: 201, body: await createHandoff(deps, mustPortal(portal), requestId) };
    },
  }),

  defineRoute({
    method: 'delete',
    path: '/portal/session',
    scope: 'portal',
    tag: TAG,
    summary: 'Thoát khỏi máy này: máy kết thúc, mọi phiên của máy bị thu hồi (suất máy vẫn tính)',
    handler: async ({ req, deps, portal, requestId }) => {
      noStore(req);
      await signOutDevice(deps, mustPortal(portal), requestId);
      return { status: 204, cookies: [CLEAR_PORTAL_COOKIE] };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/portal/me',
    scope: 'portal',
    tag: TAG,
    summary: 'Toàn bộ dữ liệu trang học viên của phiên: lớp, lịch học, hợp đồng, học phí, ảnh, cách liên hệ',
    handler: async ({ req, deps, portal }) => {
      noStore(req);
      const body = await loadPortalMe(deps.db, mustPortal(portal));
      // Trượt hạn cookie cùng hạn phiên. Thẻ lấy lại từ cookie mà authenticatePortal VỪA kiểm (PortalContext không mang
      // thẻ bản rõ — xem phiếu báo cáo E3); không in ra log.
      const token = readPortalCookie(req);
      return { body, cookies: token ? [portalCookie(token)] : [] };
    },
  }),
];
