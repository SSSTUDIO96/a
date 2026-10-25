// Cài mẫu in mặc định cho MỘT tổ chức (bản vẽ G mục 3.2; gói G-M3). Gọi trong CÙNG transaction tạo tổ chức
// (modules/orgs/routes.ts, cạnh seedDefaultGreetingPhrases). Dùng được để chạy bù cho tổ chức cũ.
//
// CÙNG LOGIC với đoạn SEED của migration 20261019220000_mau_in_hop_dong (giữa "-- SEED BEGIN" / "-- SEED END"): hai câu
// INSERT … SELECT y hệt, chỉ thêm điều kiện o."id" = tổ chức này. Loại tổ chức đọc từ dòng organizations trong chính câu
// SQL (như migration), không nhận từ người gọi — một nguồn duy nhất.
//   - Dịch vụ: mọi tổ chức → "Hiện đại", bố cục 2, mặc định dịch vụ.
//   - Khoá học: chỉ ACADEMY → "Cổ điển có quốc hiệu", bố cục 1, mặc định khoá học.
// Chạy lại không nhân đôi (NOT EXISTS mẫu mặc định của loại đó). Bài test/mau-in-mau.test.ts chạy đoạn SEED của migration
// và hàm này trên hai tổ chức cùng loại rồi so từng cột.
import type { Prisma } from '@prisma/client';
import { lockPrintDefaults } from './templates';

// Trả số mẫu đã cài (INDIVIDUAL/TEAM: 1, ACADEMY: 2 với tổ chức chưa có mẫu mặc định nào; 0 nếu đã có).
export async function seedDefaultPrintTemplates(tx: Prisma.TransactionClient, orgId: string): Promise<number> {
  // Khoá dòng tổ chức (hai lần chạy bù cùng lúc không cài hai bộ — giống designs/seed.ts), rồi khoá "mặc định mẫu in"
  // (xếp hàng với lệnh tạo / sửa mẫu đang đặt mặc định).
  const org = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM organizations WHERE id = ${orgId}::uuid FOR UPDATE`;
  if (org.length !== 1) throw new Error(`seedDefaultPrintTemplates: không có tổ chức ${orgId}`);
  await lockPrintDefaults(tx, orgId);
  const service = await tx.$executeRaw`
    INSERT INTO "print_templates" ("id", "organization_id", "name", "layout", "for_service", "for_course",
      "default_service", "default_course", "blocks", "version", "is_active", "updated_by_id", "created_at", "updated_at")
    SELECT gen_random_uuid(), o."id", 'Hiện đại', 2, true, false, true, false, '{}'::jsonb, 1, true, NULL, now(), now()
    FROM "organizations" o
    WHERE o."id" = ${orgId}::uuid
      AND NOT EXISTS (SELECT 1 FROM "print_templates" p WHERE p."organization_id" = o."id" AND p."default_service")`;
  const course = await tx.$executeRaw`
    INSERT INTO "print_templates" ("id", "organization_id", "name", "layout", "for_service", "for_course",
      "default_service", "default_course", "blocks", "version", "is_active", "updated_by_id", "created_at", "updated_at")
    SELECT gen_random_uuid(), o."id", 'Cổ điển có quốc hiệu', 1, false, true, false, true, '{}'::jsonb, 1, true, NULL, now(), now()
    FROM "organizations" o
    WHERE o."id" = ${orgId}::uuid
      AND o."kind" = 'ACADEMY'
      AND NOT EXISTS (SELECT 1 FROM "print_templates" p WHERE p."organization_id" = o."id" AND p."default_course")`;
  return service + course;
}
