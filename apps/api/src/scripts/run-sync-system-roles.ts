import { createPrisma } from '../lib/prisma';
import { syncSystemRoles } from './sync-system-roles';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Thiếu DATABASE_URL');
const db = createPrisma(url);
syncSystemRoles(db)
  .then((r) => {
    console.log(
      `Đồng bộ vai trò hệ thống: ${r.organizations} tổ chức, tạo ${r.rolesCreated}, cập nhật ${r.rolesUpdated} vai trò`,
    );
  })
  .finally(() => db.$disconnect());
