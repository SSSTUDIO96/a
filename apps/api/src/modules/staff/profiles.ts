import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { lockOrgAndRecheck } from '../../http/middleware';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { fileRef, resolveAvatarUrls } from '../files/service';
import { assertCanTouchMember } from '../orgs/guards';
import { Phone } from '../schedule/customers';
import { presentStaff, staffMemberSelect } from './common';

const OrgParams = z.object({ orgId: z.uuid() });
const StaffParams = OrgParams.extend({ membershipId: z.uuid() });

export const profileRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/staff',
    scope: 'org',
    permission: 'staff.read',
    tag: 'Nhân sự',
    summary: 'Danh sách thợ đang hoạt động kèm hồ sơ; số điện thoại thợ chỉ hiện cho người có staff.write',
    query: z.object({ tierId: z.uuid().optional(), q: z.string().trim().min(1).max(100).optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const showPhone = o.permissions.has('staff.write');
      const where: Prisma.MembershipWhereInput = {
        organizationId: o.id,
        status: 'ACTIVE',
        ...(query.tierId ? { staffProfile: { is: { tierId: query.tierId } } } : {}),
      };
      if (query.q) {
        const digits = query.q.replace(/\D/g, '');
        where.OR = [
          { user: { fullName: { contains: query.q, mode: 'insensitive' } } },
          { staffProfile: { is: { displayName: { contains: query.q, mode: 'insensitive' } } } },
          // Không cho dò số điện thoại qua ô tìm kiếm khi không được xem số.
          ...(showPhone && digits.length >= 3 ? [{ staffProfile: { is: { phone: { contains: digits } } } }] : []),
        ];
      }
      const rows = await deps.db.membership.findMany({ where, select: staffMemberSelect, orderBy: { createdAt: 'asc' } });
      const avatarOf = await resolveAvatarUrls(
        deps.db,
        o.id,
        rows.map((m) => m.staffProfile?.avatarUrl),
      );
      return { body: { items: rows.map((m) => presentStaff(m, { showPhone, avatarOf })) } };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/staff/:membershipId',
    scope: 'org',
    permission: 'staff.write',
    tag: 'Nhân sự',
    summary: 'Sửa hồ sơ thợ: tên hiển thị, ảnh đại diện (avatarFileId của tệp STAFF_AVATAR đã tải), số điện thoại, bậc lương (null = bỏ bậc), có nhận lịch không',
    params: StaffParams,
    body: z
      .object({
        displayName: z.string().trim().min(1).max(80).nullable().optional(),
        // Ảnh đại diện = tệp đã tải lên (POST /files, purpose STAFF_AVATAR). null = bỏ ảnh.
        avatarFileId: z.uuid().nullable().optional(),
        // Không còn nhận đường dẫn ảnh nhập tay (URL công khai vĩnh viễn) — báo rõ thay vì lặng lẽ bỏ qua.
        avatarUrl: z.never({ error: 'Không nhận avatarUrl: tải ảnh lên (POST /files) rồi gửi avatarFileId' }).optional(),
        phone: Phone.nullable().optional(),
        tierId: z.uuid().nullable().optional(),
        isBookable: z.boolean().optional(),
      })
      .refine((b) => Object.keys(b).length > 0, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const member = await deps.db.$transaction(async (tx) => {
        // Tra lại quyền sau khi khoá tổ chức: người vừa bị hạ quyền không lọt qua bằng quyền cũ.
        const actor = await lockOrgAndRecheck(tx, o, 'staff.write');
        const target = await tx.membership.findFirst({
          where: { id: params.membershipId, organizationId: o.id, status: { not: 'REMOVED' } },
          select: staffMemberSelect,
        });
        if (!target) throw new AppError('NOT_FOUND', 'Không tìm thấy nhân sự');
        // Luật thứ bậc như đổi vai trò: không sửa hồ sơ người đang giữ quyền mà mình không có.
        assertCanTouchMember(
          actor,
          target.roles.map((r) => r.role),
        );
        const currentTierId = target.staffProfile?.tier?.id ?? null;
        if (body.tierId !== undefined && body.tierId !== currentTierId) {
          // Bậc quyết định tiền công: đổi bậc cần thêm quyền đặt tiền công, và không ai tự đổi bậc của mình trừ chủ.
          if (!actor.permissions.has('payroll.write')) {
            throw new AppError('FORBIDDEN', 'Đổi bậc lương cần quyền đặt tiền công', { required: 'payroll.write' });
          }
          if (target.id === actor.membershipId && !actor.roleKeys.includes('owner')) {
            throw new AppError('FORBIDDEN', 'Không tự đổi bậc lương của chính mình được');
          }
          if (body.tierId) {
            const tier = await tx.staffTier.findFirst({
              where: { id: body.tierId, organizationId: o.id },
              select: { isActive: true },
            });
            if (!tier) throw new AppError('VALIDATION_FAILED', 'Bậc lương không thuộc tổ chức', { tierId: body.tierId });
            if (!tier.isActive) {
              throw new AppError('VALIDATION_FAILED', 'Bậc lương này đang ẩn, không gán được', { tierId: body.tierId });
            }
          }
        }
        const { avatarFileId, avatarUrl: _ignored, ...fields } = body;
        if (avatarFileId) {
          const file = await tx.storedFile.findFirst({
            where: { id: avatarFileId, organizationId: o.id, purpose: 'STAFF_AVATAR', status: 'READY' },
            select: { id: true },
          });
          // Tệp của tổ chức khác và mã bịa nhận cùng một lời báo.
          if (!file) {
            throw new AppError('VALIDATION_FAILED', 'Ảnh đại diện không hợp lệ: cần tệp ảnh đại diện thợ đã tải xong của tổ chức', {
              avatarFileId,
            });
          }
        }
        const data = {
          ...fields,
          ...(avatarFileId === undefined ? {} : { avatarUrl: avatarFileId === null ? null : fileRef(avatarFileId) }),
        };
        await tx.staffProfile.upsert({
          where: { membershipId: target.id },
          create: { membershipId: target.id, organizationId: o.id, ...data },
          update: data,
        });
        const before = target.staffProfile;
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'staff_profile.updated',
          entityType: 'membership',
          entityId: target.id,
          data: {
            before: before
              ? {
                  displayName: before.displayName,
                  avatarUrl: before.avatarUrl,
                  phone: before.phone,
                  tierId: before.tier?.id ?? null,
                  isBookable: before.isBookable,
                }
              : null,
            after: body,
          },
          requestId,
        });
        return tx.membership.findUniqueOrThrow({ where: { id: target.id }, select: staffMemberSelect });
      });
      const avatarOf = await resolveAvatarUrls(deps.db, o.id, [member.staffProfile?.avatarUrl]);
      return { body: presentStaff(member, { showPhone: o.permissions.has('staff.write'), avatarOf }) };
    },
  }),
];
