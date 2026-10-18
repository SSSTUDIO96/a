import type { Prisma } from '@prisma/client';

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

export async function resolveCurrentPrice(
  tx: Prisma.TransactionClient,
  organizationId: string,
  ref: PriceRef,
  at: Date = new Date(),
): Promise<ResolvedPrice | null> {
  const row = await tx.priceVersion.findFirst({
    where: {
      organizationId,
      ...(ref.serviceId ? { serviceId: ref.serviceId } : { packageId: ref.packageId }),
      effectiveFrom: { lte: at },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
  // Chưa có giá hiệu lực thì trả null — người gọi phải báo lỗi rõ, không tự lấy giá 0.
  if (!row) return null;
  return {
    priceVersionId: row.id,
    listPrice: row.listPrice,
    salePrice: row.salePrice,
    unitPrice: row.salePrice ?? row.listPrice,
  };
}
