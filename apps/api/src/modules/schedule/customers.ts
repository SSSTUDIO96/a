import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { normalizeVnPhone } from '@makeup/shared';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';

// Số điện thoại Việt Nam chuẩn hoá về 0xxxxxxxxx; sai định dạng → 400.
export const Phone = z
  .string()
  .trim()
  .max(32)
  .transform((raw, ctx) => {
    const phone = normalizeVnPhone(raw);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ (ví dụ đúng: 0912 345 678 hoặc +84 912 345 678)' });
      return z.NEVER;
    }
    return phone;
  });

const Paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const OrgParams = z.object({ orgId: z.uuid() });
const CustomerParams = OrgParams.extend({ customerId: z.uuid() });
const FullName = z.string().trim().min(1).max(120);
const Email = z.string().trim().toLowerCase().pipe(z.email());
const Note = z.string().trim().max(2000);

const customerSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

// Phần số trong ô tìm kiếm, đổi đầu +84/84 về 0 để khớp số đã chuẩn hoá trong database.
function phoneFragment(q: string): string | null {
  let digits = q.replace(/\D/g, '');
  if (q.trim().startsWith('+84') || (digits.startsWith('84') && digits.length >= 11)) digits = `0${digits.slice(2)}`;
  return digits.length >= 3 ? digits : null;
}

export const customerRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/customers',
    scope: 'org',
    permission: 'customers.read',
    tag: 'Khách hàng',
    summary: 'Danh sách khách hàng, tìm theo tên hoặc số điện thoại',
    query: Paging.extend({ q: z.string().trim().min(1).max(100).optional() }),
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const where: Prisma.CustomerWhereInput = { organizationId: o.id };
      if (query.q) {
        const digits = phoneFragment(query.q);
        where.OR = [
          { fullName: { contains: query.q, mode: 'insensitive' } },
          ...(digits ? [{ phone: { contains: digits } }] : []),
        ];
      }
      const [total, items] = await deps.db.$transaction([
        deps.db.customer.count({ where }),
        deps.db.customer.findMany({
          where,
          select: customerSelect,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      return { body: { items, page: query.page, pageSize: query.pageSize, total } };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/customers',
    scope: 'org',
    permission: 'customers.write',
    tag: 'Khách hàng',
    summary: 'Thêm khách hàng',
    body: z.object({
      fullName: FullName,
      phone: Phone.nullable().optional(),
      email: Email.nullable().optional(),
      note: Note.nullable().optional(),
    }),
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const customer = await deps.db.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            organizationId: o.id,
            fullName: body.fullName,
            phone: body.phone ?? null,
            email: body.email ?? null,
            note: body.note ?? null,
          },
          select: customerSelect,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'customer.created',
          entityType: 'customer',
          entityId: created.id,
          data: { fullName: created.fullName, phone: created.phone, email: created.email },
          requestId,
        });
        return created;
      });
      return { status: 201, body: customer };
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/customers/:customerId',
    scope: 'org',
    permission: 'customers.read',
    tag: 'Khách hàng',
    summary: 'Xem một khách hàng',
    params: CustomerParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const customer = await deps.db.customer.findFirst({
        where: { id: params.customerId, organizationId: o.id },
        select: customerSelect,
      });
      if (!customer) throw new AppError('NOT_FOUND', 'Không tìm thấy khách hàng');
      return { body: customer };
    },
  }),

  defineRoute({
    method: 'patch',
    path: '/orgs/:orgId/customers/:customerId',
    scope: 'org',
    permission: 'customers.write',
    tag: 'Khách hàng',
    summary: 'Sửa thông tin khách hàng',
    params: CustomerParams,
    body: z
      .object({
        fullName: FullName.optional(),
        phone: Phone.nullable().optional(),
        email: Email.nullable().optional(),
        note: Note.nullable().optional(),
      })
      .refine((b) => Object.keys(b).length > 0, 'Không có gì để sửa'),
    handler: async ({ deps, org, params, body, userId, requestId }) => {
      const o = mustOrg(org);
      const customer = await deps.db.$transaction(async (tx) => {
        const before = await tx.customer.findFirst({
          where: { id: params.customerId, organizationId: o.id },
          select: customerSelect,
        });
        if (!before) throw new AppError('NOT_FOUND', 'Không tìm thấy khách hàng');
        const after = await tx.customer.update({ where: { id: before.id }, data: body, select: customerSelect });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'customer.updated',
          entityType: 'customer',
          entityId: before.id,
          data: {
            before: { fullName: before.fullName, phone: before.phone, email: before.email, note: before.note },
            after: body,
          },
          requestId,
        });
        return after;
      });
      return { body: customer };
    },
  }),
];
