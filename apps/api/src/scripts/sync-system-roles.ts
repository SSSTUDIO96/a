import type { PrismaClient } from '@prisma/client';
import { DEFAULT_MAKEUP_SUBJECTS, SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from '@makeup/shared';

export interface SyncReport {
  organizations: number;
  rolesCreated: number;
  rolesUpdated: number;
  travelPoliciesCreated: number;
  subjectSetsSeeded: number;
}

// Đồng bộ dữ liệu mặc định của mọi tổ chức theo mã nguồn hiện hành.
// Vai trò hệ thống được chép vào từng tổ chức lúc tạo. Khi danh mục quyền thêm quyền mới,
// tổ chức cũ KHÔNG tự có — phải chạy lệnh này sau mỗi lần triển khai (idempotent: chạy lại không đổi gì).
export async function syncSystemRoles(db: PrismaClient): Promise<SyncReport> {
  const report: SyncReport = {
    organizations: 0,
    rolesCreated: 0,
    rolesUpdated: 0,
    travelPoliciesCreated: 0,
    subjectSetsSeeded: 0,
  };
  const orgs = await db.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    report.organizations++;
    await db.$transaction(async (tx) => {
      const existing = await tx.role.findMany({ where: { organizationId: org.id, key: { in: SYSTEM_ROLE_KEYS } } });
      const changes: string[] = [];
      for (const key of SYSTEM_ROLE_KEYS) {
        const tpl = SYSTEM_ROLES[key];
        const want = [...tpl.permissions].sort();
        const row = existing.find((r) => r.key === key);
        if (!row) {
          await tx.role.create({
            data: { organizationId: org.id, key, name: tpl.name, isSystem: true, permissions: want },
          });
          report.rolesCreated++;
          changes.push(`+${key}`);
        } else if (!row.isSystem) {
          throw new Error(`Tổ chức ${org.id} có vai trò tuỳ chỉnh trùng mã hệ thống "${key}" — cần xử lý tay`);
        } else if (row.name !== tpl.name || [...row.permissions].sort().join(',') !== want.join(',')) {
          await tx.role.update({ where: { id: row.id }, data: { name: tpl.name, permissions: want } });
          report.rolesUpdated++;
          changes.push(`~${key}`);
        }
      }
      // Tổ chức tạo trước khi có hợp đồng: bổ sung cách tính phí di chuyển mặc định và bộ nhân vật mẫu
      // (chỉ khi tổ chức chưa có nhân vật nào — không thêm lại nhân vật chủ đã tự xoá).
      const policy = await tx.travelFeePolicy.findUnique({ where: { organizationId: org.id } });
      if (!policy) {
        await tx.travelFeePolicy.create({ data: { organizationId: org.id } });
        report.travelPoliciesCreated++;
        changes.push('+travel_fee_policy');
      }
      if ((await tx.makeupSubject.count({ where: { organizationId: org.id } })) === 0) {
        await tx.makeupSubject.createMany({
          data: DEFAULT_MAKEUP_SUBJECTS.map((name, i) => ({ organizationId: org.id, name, sortOrder: i })),
        });
        report.subjectSetsSeeded++;
        changes.push('+makeup_subjects');
      }
      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            organizationId: org.id,
            actorUserId: null,
            action: 'role.system_synced',
            entityType: 'organization',
            entityId: org.id,
            data: { changes },
          },
        });
      }
    });
  }
  return report;
}
