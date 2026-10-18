import type { Prisma } from '@prisma/client';
import { vndFromBigInt, type Vnd } from '@makeup/shared';
import { AppError } from '../../lib/errors';

// Giá hiện hành của một dịch vụ hoặc gói tại thời điểm `at`.
// Đây là CÔNG THỨC DUY NHẤT tra giá — lịch, website, báo cáo đều gọi hàm này, cấm viết bản sao.
export type PriceRef = { serviceId: string; packageId?: never } | { packageId: string; serviceId?: never };

export interface ResolvedPrice {
  priceVersionId: string;
  listPrice: bigint;
  salePrice: bigint | null;
  // Giá áp dụng = giá khuyến mại nếu có, không thì giá niêm yết.
  unitPrice: bigint;
}

export interface CurrentPrice extends ResolvedPrice {
  effectiveFrom: Date;
}

export type PriceOwner = 'service' | 'package';

// Luật chọn giá (lọc + thứ tự) dùng chung cho tra một và tra cả trang — sửa luật thì sửa ở đây.
function currentPriceWhere(organizationId: string, owner: PriceOwner, ids: string[], at: Date): Prisma.PriceVersionWhereInput {
  return {
    organizationId,
    ...(owner === 'service' ? { serviceId: { in: ids } } : { packageId: { in: ids } }),
    effectiveFrom: { lte: at },
  };
}

// id đứng cuối để hai phiên bản trùng cả effectiveFrom lẫn createdAt vẫn luôn ra cùng một kết quả.
const CURRENT_PRICE_ORDER: Prisma.PriceVersionOrderByWithRelationInput[] = [
  { effectiveFrom: 'desc' },
  { createdAt: 'desc' },
  { id: 'desc' },
];

function toCurrentPrice(row: {
  id: string;
  listPrice: bigint;
  salePrice: bigint | null;
  effectiveFrom: Date;
}): CurrentPrice {
  return {
    priceVersionId: row.id,
    listPrice: row.listPrice,
    salePrice: row.salePrice,
    unitPrice: row.salePrice ?? row.listPrice,
    effectiveFrom: row.effectiveFrom,
  };
}

export async function resolveCurrentPrice(
  tx: Prisma.TransactionClient,
  organizationId: string,
  ref: PriceRef,
  at: Date = new Date(),
): Promise<ResolvedPrice | null> {
  const [owner, id]: [PriceOwner, string] =
    ref.serviceId !== undefined ? ['service', ref.serviceId] : ['package', ref.packageId];
  const row = await tx.priceVersion.findFirst({
    where: currentPriceWhere(organizationId, owner, [id], at),
    orderBy: CURRENT_PRICE_ORDER,
  });
  // Chưa có giá hiệu lực thì trả null — người gọi phải báo lỗi rõ, không tự lấy giá 0.
  if (!row) return null;
  return toCurrentPrice(row);
}

// Tra giá hiện hành cho nhiều dịch vụ (hoặc nhiều gói) bằng MỘT truy vấn, cùng luật với resolveCurrentPrice.
// Khoá không có giá hiệu lực thì không có trong Map — người gọi tự hiển thị null, không đoán giá.
export async function resolveCurrentPrices(
  tx: Prisma.TransactionClient,
  organizationId: string,
  owner: PriceOwner,
  ids: string[],
  at: Date = new Date(),
): Promise<Map<string, CurrentPrice>> {
  const result = new Map<string, CurrentPrice>();
  if (ids.length === 0) return result;
  const rows = await tx.priceVersion.findMany({
    where: currentPriceWhere(organizationId, owner, ids, at),
    orderBy: CURRENT_PRICE_ORDER,
    select: { id: true, serviceId: true, packageId: true, listPrice: true, salePrice: true, effectiveFrom: true },
  });
  for (const row of rows) {
    const key = owner === 'service' ? row.serviceId : row.packageId;
    // Dòng đã sắp mới nhất trước, nên dòng gặp đầu tiên của mỗi khoá là giá hiện hành.
    if (key && !result.has(key)) result.set(key, toCurrentPrice(row));
  }
  return result;
}

export interface PriceJson {
  priceVersionId: string;
  listPrice: Vnd;
  salePrice: Vnd | null;
  unitPrice: Vnd;
  effectiveFrom: Date;
}

// Đổi BigInt sang số trước khi trả ra JSON; vượt ngưỡng an toàn thì ném lỗi, không làm tròn.
export function presentPrice(p: CurrentPrice | null): PriceJson | null {
  if (!p) return null;
  return {
    priceVersionId: p.priceVersionId,
    listPrice: vndFromBigInt(p.listPrice, 'giá niêm yết'),
    salePrice: p.salePrice === null ? null : vndFromBigInt(p.salePrice, 'giá khuyến mại'),
    unitPrice: vndFromBigInt(p.unitPrice, 'giá áp dụng'),
    effectiveFrom: p.effectiveFrom,
  };
}

export function assertSaleNotAboveList(listPrice: Vnd, salePrice: Vnd | null | undefined): void {
  if (salePrice !== null && salePrice !== undefined && salePrice > listPrice) {
    throw new AppError('VALIDATION_FAILED', 'Giá khuyến mại không được lớn hơn giá niêm yết', { listPrice, salePrice });
  }
}
