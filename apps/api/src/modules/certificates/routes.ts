// Giấy chứng nhận (BAN-VE-F mục 4.1, đường 1–6; đường 7–8 người ký nằm ở profile/routes.ts). Gói S1b.
// Mọi đường: scope org, tổ chức phải là ACADEMY (403 "Tổ chức chưa bật đào tạo") — kiểm ĐẦU TIÊN, trước mọi tra cứu.
// Không có đường "in" riêng: dữ liệu in là CertificateView (đã kèm URL ảnh ký có hạn); máy chủ không vẽ, không lưu PDF/PNG.
import { defineRoute, mustOrg, mustUser, type AnyRoute, type HandlerCtx } from '../../http/route';
import { assertAcademy, type Actor } from '../courses/service';
import {
  CertificateParams,
  ClassParams,
  IssueBody,
  OrgParams,
  RegisterQuery,
  ReissueBody,
  RevokeBody,
  RosterQuery,
} from './schemas';
import {
  classRoster,
  getCertificate,
  issueCertificates,
  listRegister,
  raceGuard,
  reissueCertificate,
  revokeCertificate,
} from './service';

const TAG = 'Giấy chứng nhận';
// Cấp cả lớp (tới 500 học viên, mỗi người một lần lấy số + một dòng nhật ký) — rộng giờ hơn mặc định 5 giây.
const TX_OPTS = { timeout: 30_000 };

async function academy(ctx: Pick<HandlerCtx<unknown, unknown, unknown>, 'deps' | 'org' | 'userId' | 'requestId'>) {
  const o = mustOrg(ctx.org);
  const { timezone } = await assertAcademy(ctx.deps.db, o.id);
  const actor: Actor = { orgId: o.id, userId: mustUser(ctx.userId), requestId: ctx.requestId };
  return { o, actor, timezone };
}

export const certificateRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/classes/:classId/certificates',
    scope: 'org',
    permission: 'certificates.read',
    tag: TAG,
    summary: 'Danh sách cấp giấy chứng nhận của lớp (học viên đang ghi danh, bản đã cấp, số dự kiến; tiền cần contracts.read hoặc payments.read)',
    params: ClassParams,
    query: RosterQuery,
    handler: async (ctx) => {
      const { o, timezone } = await academy(ctx);
      return { body: await classRoster(ctx.deps.db, o.id, ctx.params.classId, o, timezone, ctx.query.issuedOn) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/classes/:classId/certificates',
    idempotent: true,
    scope: 'org',
    permission: 'certificates.issue',
    tag: TAG,
    summary: 'Cấp giấy chứng nhận hàng loạt cho học viên của lớp đã kết thúc (còn nợ học phí: cảnh báo, không chặn)',
    params: ClassParams,
    body: IssueBody,
    handler: async (ctx) => {
      const { o, actor, timezone } = await academy(ctx);
      const body = await raceGuard(() =>
        ctx.deps.db.$transaction((tx) => issueCertificates(tx, actor, o, ctx.params.classId, ctx.body, timezone), TX_OPTS),
      );
      return { status: 201, body };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/certificates',
    scope: 'org',
    permission: 'certificates.read',
    tag: TAG,
    summary: 'Sổ giấy chứng nhận: lọc theo năm, từ khoá (số / tên), lớp, học viên, trạng thái, danh sách mã; phân trang',
    params: OrgParams,
    query: RegisterQuery,
    handler: async (ctx) => {
      const { o } = await academy(ctx);
      return { body: await listRegister(ctx.deps.db, o.id, ctx.query) };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/certificates/:certificateId',
    scope: 'org',
    permission: 'certificates.read',
    tag: TAG,
    summary: 'Một giấy chứng nhận (chữ chụp lúc cấp, URL ảnh ký có hạn để in lại)',
    params: CertificateParams,
    handler: async (ctx) => {
      const { o } = await academy(ctx);
      return { body: await getCertificate(ctx.deps.db, o.id, ctx.params.certificateId) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/certificates/:certificateId/reissue',
    idempotent: true,
    scope: 'org',
    permission: 'certificates.issue',
    tag: TAG,
    summary: 'Cấp lại giữ số (bản cũ thu hồi kèm lý do; bản mới ghi "bản cấp lại", chụp lại dữ liệu hiện hành)',
    params: CertificateParams,
    body: ReissueBody,
    handler: async (ctx) => {
      const { actor, timezone } = await academy(ctx);
      const body = await raceGuard(() =>
        ctx.deps.db.$transaction((tx) => reissueCertificate(tx, actor, ctx.params.certificateId, ctx.body, timezone), TX_OPTS),
      );
      return { status: 201, body };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/certificates/:certificateId/revoke',
    scope: 'org',
    permission: 'certificates.issue',
    tag: TAG,
    summary: 'Thu hồi giấy chứng nhận (bắt buộc lý do; thu hồi lần hai → 409)',
    params: CertificateParams,
    body: RevokeBody,
    handler: async (ctx) => {
      const { actor } = await academy(ctx);
      const body = await ctx.deps.db.$transaction((tx) => revokeCertificate(tx, actor, ctx.params.certificateId, ctx.body), TX_OPTS);
      return { body };
    },
  }),
];
