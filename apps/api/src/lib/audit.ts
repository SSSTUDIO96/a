import type { Prisma } from '@prisma/client';

export interface AuditEntry {
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  data?: Prisma.InputJsonValue;
  requestId?: string;
}

// Nhận transaction client để nhật ký ghi cùng lúc với thay đổi: thay đổi thất bại thì nhật ký cũng không có.
export async function writeAudit(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({ data: entry });
}
