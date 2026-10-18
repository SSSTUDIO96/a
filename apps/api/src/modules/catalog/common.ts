import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { vndFromBigInt, type Vnd } from '@makeup/shared';
import type { OrgContext } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import {
  assertSaleNotAboveList,
  presentPrice,
  resolveCurrentPrice,
  resolveCurrentPrices,
  type PriceOwner,
  type PriceRef,
} from './prices';

export type { PriceOwner } from './prices';

export const Paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Tham số query là chuỗi: "false" phải ra false (z.coerce.boolean sẽ ra true).
export const BoolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

// Ô tìm kiếm rỗng nghĩa là không lọc.
export const SearchQuery = z.string().trim().max(100).optional();

export const Money = z
  .number({ error: 'Số tiền phải là số' })
  .int('Số tiền phải là số nguyên đồng, không có phần lẻ')
  .nonnegative('Số tiền không được âm')
  .max(Number.MAX_SAFE_INTEGER, 'Số tiền vượt ngưỡng cho phép');

export const Code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_-]{0,31}$/, 'Mã chỉ gồm chữ không dấu, số, gạch ngang, gạch dưới; tối đa 32 ký tự');
export const Name = z.string().trim().min(1, 'Tên không được để trống').max(120);
export const Description = z.string().trim().max(2000).nullable();
export const Duration = z.number().int('Thời lượng phải là số phút nguyên').min(1).max(1440);
export const SortOrder = z.number().int().min(0).max(1_000_000);

export const OrgParams = z.object({ orgId: z.uuid() });

// Khoá dòng tổ chức trong transaction (cùng cách làm ở orgs/routes.ts): các thay đổi cần xếp hàng theo tổ chức.
export async function lockOrg(tx: Prisma.TransactionClient, orgId: string) {
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId}::uuid FOR UPDATE`;
}

// Số thập phân nhận dạng number nhưng kiểm số chữ số lẻ trên chuỗi, rồi đưa vào database dạng chuỗi để không lệch số thực.
export function decimalNumber(opts: { min: number; max: number; scale: number; label: string }) {
  const re = new RegExp(`^-?\\d+(\\.\\d{1,${opts.scale}})?$`);
  return z
    .number({ error: `${opts.label} phải là số` })
    .min(opts.min, `${opts.label} không được nhỏ hơn ${opts.min}`)
    .max(opts.max, `${opts.label} không được lớn hơn ${opts.max}`)
    .refine((v) => re.test(String(v)), `${opts.label} có tối đa ${opts.scale} chữ số sau dấu phẩy`);
}

// Số km nhận số hoặc chuỗi, tối đa 2 chữ số lẻ; trả chuỗi chuẩn để lưu Decimal không lệch số thực.
const KM_RE = /^\d{1,5}(\.\d{1,2})?$/;
export const Km = z
  .union([z.number(), z.string().trim()], { error: 'Số km phải là số' })
  .transform((v) => String(v))
  .superRefine((s, ctx) => {
    if (s.startsWith('-')) ctx.addIssue({ code: 'custom', message: 'Số km không được âm' });
    else if (!KM_RE.test(s)) ctx.addIssue({ code: 'custom', message: 'Số km tối đa 99999.99, có tối đa 2 chữ số sau dấu phẩy' });
  });

// Đổi chuỗi km đã kiểm sang số nguyên phần trăm km để so sánh chính xác.
export function kmCents(s: string): number {
  const [int = '0', frac = ''] = s.split('.');
  return Number(int) * 100 + Number(frac.padEnd(2, '0'));
}

export function decimalToNumber(d: Prisma.Decimal | null): number | null {
  return d === null ? null : d.toNumber();
}

// Không âm thầm bỏ trường lạ: gửi nhầm (ví dụ gửi giá vào PATCH) thì báo rõ.
export function strictBody<S extends z.ZodRawShape>(shape: S, hint?: string) {
  return z.strictObject(shape, {
    error: (iss) =>
      iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')}${hint ? ` — ${hint}` : ''}` : undefined,
  });
}

export function nonEmpty(b: object): boolean {
  return Object.values(b).some((v) => v !== undefined);
}

// Đổi lỗi trùng khoá duy nhất thành 409 có lời rõ ràng; lỗi khác ném nguyên.
export async function withUniqueMessage<T>(work: Promise<T>, message: string): Promise<T> {
  try {
    return await work;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CONFLICT', message, { fields: err.meta?.target });
    }
    throw err;
  }
}

// Tạo dịch vụ/gói kèm giá là đặt giá: ngoài quyền của đường còn phải có quyền đổi giá.
export function assertCanSetPrice(o: OrgContext): void {
  if (!o.permissions.has('prices.write')) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền đặt giá', { required: 'prices.write' });
  }
}

const OWNER_LABEL: Record<PriceOwner, string> = { service: 'dịch vụ', package: 'gói dịch vụ' };

export function notFound(owner: PriceOwner): AppError {
  return new AppError('NOT_FOUND', `Không tìm thấy ${OWNER_LABEL[owner]}`);
}

function refOf(owner: PriceOwner, id: string): PriceRef {
  return owner === 'service' ? { serviceId: id } : { packageId: id };
}

// Khoá dòng dịch vụ/gói (và kiểm nó thuộc tổ chức): các lần đổi giá cùng một mục xếp hàng,
// nên "giá cũ" ghi vào nhật ký luôn đúng là giá bị thay.
async function lockOwner(tx: Prisma.TransactionClient, owner: PriceOwner, organizationId: string, id: string) {
  const rows =
    owner === 'service'
      ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM services WHERE id = ${id}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM service_packages WHERE id = ${id}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound(owner);
}

export const PriceInput = {
  listPrice: Money,
  salePrice: Money.nullable().optional(),
};

// Giá hẹn được đặt cho tương lai; lùi quá khứ quá 5 phút (lệch đồng hồ máy khách) thì từ chối — không sửa lịch sử giá.
const PAST_TOLERANCE_MS = 5 * 60_000;

export interface NewPrice {
  listPrice: Vnd;
  salePrice?: Vnd | null;
  effectiveFrom?: string;
  note?: string;
}

type PriceVersionRow = {
  id: string;
  listPrice: bigint;
  salePrice: bigint | null;
  effectiveFrom: Date;
  note: string | null;
  createdById: string;
  createdAt: Date;
};

export type PriceStatus = 'CURRENT' | 'SCHEDULED' | 'PAST';

function priceStatus(row: PriceVersionRow, currentId: string | undefined, now: Date): PriceStatus {
  if (row.id === currentId) return 'CURRENT';
  return row.effectiveFrom > now ? 'SCHEDULED' : 'PAST';
}

export function presentVersion(row: PriceVersionRow, status: PriceStatus, createdByName: string | null) {
  const listPrice = vndFromBigInt(row.listPrice, 'giá niêm yết');
  const salePrice = row.salePrice === null ? null : vndFromBigInt(row.salePrice, 'giá khuyến mại');
  return {
    id: row.id,
    listPrice,
    salePrice,
    unitPrice: salePrice ?? listPrice,
    effectiveFrom: row.effectiveFrom,
    note: row.note,
    status,
    createdBy: { id: row.createdById, fullName: createdByName },
    createdAt: row.createdAt,
  };
}

function auditPrice(p: { priceVersionId: string; listPrice: bigint; salePrice: bigint | null }) {
  return {
    priceVersionId: p.priceVersionId,
    listPrice: vndFromBigInt(p.listPrice, 'giá niêm yết'),
    salePrice: p.salePrice === null ? null : vndFromBigInt(p.salePrice, 'giá khuyến mại'),
  };
}

// Thêm một phiên bản giá (không bao giờ sửa dòng cũ) và ghi nhật ký giá cũ → giá mới trong cùng transaction.
export async function addPriceVersion(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: string;
    owner: PriceOwner;
    ownerId: string;
    price: NewPrice;
    actorUserId: string;
    requestId: string;
    // Mục vừa tạo trong cùng transaction thì đã chắc thuộc tổ chức, không cần khoá lại.
    skipLock?: boolean;
  },
) {
  const { organizationId, owner, ownerId, price, actorUserId, requestId } = args;
  assertSaleNotAboveList(price.listPrice, price.salePrice);
  const now = new Date();
  const effectiveFrom = price.effectiveFrom ? new Date(price.effectiveFrom) : now;
  if (effectiveFrom.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
    throw new AppError('VALIDATION_FAILED', 'Không được đặt giá có hiệu lực trong quá khứ; chỉ đặt từ bây giờ hoặc hẹn tương lai');
  }
  if (!args.skipLock) await lockOwner(tx, owner, organizationId, ownerId);
  const ref = refOf(owner, ownerId);
  const before = await resolveCurrentPrice(tx, organizationId, ref, effectiveFrom);
  const created = await tx.priceVersion.create({
    data: {
      organizationId,
      ...ref,
      listPrice: BigInt(price.listPrice),
      salePrice: price.salePrice === null || price.salePrice === undefined ? null : BigInt(price.salePrice),
      effectiveFrom,
      note: price.note ?? null,
      createdById: actorUserId,
    },
  });
  await writeAudit(tx, {
    organizationId,
    actorUserId,
    action: 'price.created',
    entityType: owner,
    entityId: ownerId,
    data: {
      effectiveFrom: effectiveFrom.toISOString(),
      note: price.note ?? null,
      before: before ? auditPrice(before) : null,
      after: auditPrice({ priceVersionId: created.id, listPrice: created.listPrice, salePrice: created.salePrice }),
    },
    requestId,
  });
  const current = await resolveCurrentPrice(tx, organizationId, ref, now);
  return { created, status: priceStatus(created, current?.priceVersionId, now) };
}

// Đường "đổi giá" trả về phiên bản vừa thêm, cùng dạng với một dòng lịch sử giá.
export async function addPriceVersionPresented(tx: Prisma.TransactionClient, args: Parameters<typeof addPriceVersion>[1]) {
  const r = await addPriceVersion(tx, args);
  const user = await tx.user.findUniqueOrThrow({ where: { id: args.actorUserId }, select: { fullName: true } });
  return presentVersion(r.created, r.status, user.fullName);
}

export async function listPriceHistory(
  db: Prisma.TransactionClient,
  organizationId: string,
  owner: PriceOwner,
  ownerId: string,
  paging: { page: number; pageSize: number },
) {
  const exists =
    owner === 'service'
      ? await db.service.findFirst({ where: { id: ownerId, organizationId }, select: { id: true } })
      : await db.servicePackage.findFirst({ where: { id: ownerId, organizationId }, select: { id: true } });
  if (!exists) throw notFound(owner);
  const where: Prisma.PriceVersionWhereInput = { organizationId, ...refOf(owner, ownerId) };
  const now = new Date();
  const [total, rows, current] = await Promise.all([
    db.priceVersion.count({ where }),
    db.priceVersion.findMany({
      where,
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    }),
    resolveCurrentPrice(db, organizationId, refOf(owner, ownerId), now),
  ]);
  const userIds = [...new Set(rows.map((r) => r.createdById))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } });
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  return {
    items: rows.map((r) => presentVersion(r, priceStatus(r, current?.priceVersionId, now), names.get(r.createdById) ?? null)),
    page: paging.page,
    pageSize: paging.pageSize,
    total,
  };
}

// Giá hiện hành cho cả một trang: một truy vấn cho mọi mục, không tra từng dòng.
export async function currentPricesFor(db: Prisma.TransactionClient, organizationId: string, owner: PriceOwner, ids: string[]) {
  const map = await resolveCurrentPrices(db, organizationId, owner, ids);
  return (id: string) => presentPrice(map.get(id) ?? null);
}
