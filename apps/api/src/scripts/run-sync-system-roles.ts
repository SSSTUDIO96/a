import { createPrisma } from '../lib/prisma';
import { syncSystemRoles } from './sync-system-roles';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Thiếu DATABASE_URL');
const db = createPrisma(url);
syncSystemRoles(db)
  .then((r) => {
    console.log(
      `Đồng bộ: ${r.organizations} tổ chức; vai trò tạo ${r.rolesCreated}, cập nhật ${r.rolesUpdated}; ` +
        `phí di chuyển tạo ${r.travelPoliciesCreated}; bộ nhân vật mẫu ${r.subjectSetsSeeded}`,
    );
  })
  .finally(() => db.$disconnect());
