// Cài đặt cổng học viên (bản vẽ E 4.4, gói E4): số tài khoản ngân hàng hiện ở thẻ "Cách đóng tiền" của cổng.
// - Bảng RIÊNG portal_settings (không nằm trong hồ sơ thương hiệu) → không bao giờ lên trang công khai /public/sites/:slug.
// - Đổi số tài khoản là đụng tiền: chỉ quyền org.update (vai trò mẫu: Chủ, Quản trị — ký duyệt E câu 3). Audit trước/sau.
// - Đủ cả 3 trường hoặc trống cả 3 (database có CHECK portal_settings_bank_all_or_none làm lưới cuối).
import { z } from 'zod';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { writeAudit } from '../../lib/audit';
import { assertAcademy } from '../courses/service';

const OrgParams = z.object({ orgId: z.uuid() });

export const PORTAL_BANK_ALL_OR_NONE_MESSAGE = 'Điền đủ ngân hàng, số tài khoản, chủ tài khoản — hoặc để trống cả ba';

// Bỏ dấu tiếng Việt (NFD + bỏ dấu kết hợp, đ/Đ → d/D).
function foldVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const BankName = z.string().trim().min(2, 'Tên ngân hàng từ 2 đến 80 ký tự').max(80, 'Tên ngân hàng từ 2 đến 80 ký tự');
// Số tài khoản: bỏ khoảng trắng, dấu chấm, gạch; còn lại phải là 6–20 chữ số.
const AccountNo = z
  .string()
  .max(60)
  .transform((s) => s.replace(/[\s.-]/g, ''))
  .pipe(z.string().regex(/^\d{6,20}$/, 'Số tài khoản chỉ gồm 6 đến 20 chữ số'));
// Chủ tài khoản: chữ hoa, bỏ dấu, gộp khoảng trắng (đúng cách ngân hàng in tên).
const AccountName = z
  .string()
  .max(120)
  .transform((s) => foldVietnamese(s).toUpperCase().replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(2, 'Tên chủ tài khoản từ 2 đến 80 ký tự').max(80, 'Tên chủ tài khoản từ 2 đến 80 ký tự'));

// Bắt buộc gửi đủ 3 khoá (null = để trống): thiếu khoá → 400, không đoán.
const SettingsBody = z
  .object({
    bankName: BankName.nullable(),
    bankAccountNo: AccountNo.nullable(),
    bankAccountName: AccountName.nullable(),
  })
  .refine(
    (b) => (b.bankName === null) === (b.bankAccountNo === null) && (b.bankAccountNo === null) === (b.bankAccountName === null),
    { message: PORTAL_BANK_ALL_OR_NONE_MESSAGE },
  );

interface SettingsView {
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  updatedAt: string | null;
}

const settingsSelect = { bankName: true, bankAccountNo: true, bankAccountName: true, updatedAt: true } as const;

function present(row: { bankName: string | null; bankAccountNo: string | null; bankAccountName: string | null; updatedAt: Date } | null): SettingsView {
  return {
    bankName: row?.bankName ?? null,
    bankAccountNo: row?.bankAccountNo ?? null,
    bankAccountName: row?.bankAccountName ?? null,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

export const portalSettingsRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/portal-settings',
    scope: 'org',
    permission: 'org.read',
    tag: 'Cổng học viên',
    summary: 'Cài đặt cổng học viên: số tài khoản ngân hàng (chưa có → mọi trường null)',
    params: OrgParams,
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      await assertAcademy(deps.db, o.id);
      const row = await deps.db.portalSettings.findUnique({ where: { organizationId: o.id }, select: settingsSelect });
      return { body: present(row) };
    },
  }),

  defineRoute({
    method: 'put',
    path: '/orgs/:orgId/portal-settings',
    scope: 'org',
    permission: 'org.update',
    tag: 'Cổng học viên',
    summary: 'Sửa số tài khoản ngân hàng của cổng học viên (đủ 3 trường hoặc null cả 3; chỉ Chủ, Quản trị)',
    params: OrgParams,
    body: SettingsBody,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const actorId = mustUser(userId);
      await assertAcademy(deps.db, o.id);
      const row = await deps.db.$transaction(async (tx) => {
        // Khoá dòng tổ chức: hai lần lưu đồng thời không ghi "trước" sai vào nhật ký.
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${o.id}::uuid FOR UPDATE`;
        const before = await tx.portalSettings.findUnique({ where: { organizationId: o.id }, select: settingsSelect });
        const data = { bankName: body.bankName, bankAccountNo: body.bankAccountNo, bankAccountName: body.bankAccountName, updatedById: actorId };
        const after = await tx.portalSettings.upsert({
          where: { organizationId: o.id },
          create: { organizationId: o.id, ...data },
          update: data,
          select: settingsSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: actorId,
          action: 'portal.settings_updated',
          entityType: 'portal_settings',
          entityId: o.id,
          data: {
            before: {
              bankName: before?.bankName ?? null,
              bankAccountNo: before?.bankAccountNo ?? null,
              bankAccountName: before?.bankAccountName ?? null,
            },
            after: { bankName: after.bankName, bankAccountNo: after.bankAccountNo, bankAccountName: after.bankAccountName },
          },
          requestId,
        });
        return after;
      });
      return { body: present(row) };
    },
  }),
];
