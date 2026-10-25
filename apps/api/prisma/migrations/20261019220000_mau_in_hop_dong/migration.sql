-- Migration 20261019220000_mau_in_hop_dong (ký duyệt G; bản vẽ gốc ghi 20261019170000 — đính chính 25/10/2026 mục 1).
-- Mẫu in hợp đồng (bản vẽ G — R&D-09 PA1).
-- Gồm: bảng mẫu in, nhật ký in, 5 trường "thông tin trên hợp đồng" của hồ sơ thương hiệu, chốt viết tay, mẫu mặc định.
-- Dữ liệu cũ: hai bảng mới chưa có dòng nào; 5 cột mới ở dòng cũ đều NULL, nên mọi CHECK mới đều đạt (sổ lỗi 22: 0 dòng vi phạm).

-- CreateEnum
CREATE TYPE "PrintSource" AS ENUM ('TEMPLATE', 'PRIOR_CONFIG', 'REPRINT');

-- AlterTable
ALTER TABLE "organization_profiles"
  ADD COLUMN "representative_name" TEXT,
  ADD COLUMN "representative_title" TEXT,
  ADD COLUMN "bank_name" TEXT,
  ADD COLUMN "bank_account_number" TEXT,
  ADD COLUMN "bank_account_name" TEXT;

-- CreateTable
CREATE TABLE "print_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "layout" INTEGER NOT NULL,
    "for_service" BOOLEAN NOT NULL,
    "for_course" BOOLEAN NOT NULL,
    "default_service" BOOLEAN NOT NULL DEFAULT false,
    "default_course" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL DEFAULT '{}',
    "title" TEXT,
    "opening_text" TEXT,
    "closing_text" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "print_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_prints" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "print_no" INTEGER NOT NULL,
    "source" "PrintSource" NOT NULL,
    "based_on_print_id" UUID,
    "template_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "data_version" INTEGER NOT NULL DEFAULT 1,
    "data_hash" TEXT NOT NULL,
    "contract_status" "ContractStatus" NOT NULL,
    "printed_by_id" UUID NOT NULL,
    "printed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_prints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "print_templates_organization_id_idx" ON "print_templates"("organization_id");
CREATE UNIQUE INDEX "print_templates_id_organization_id_key" ON "print_templates"("id", "organization_id");
CREATE INDEX "contract_prints_organization_id_template_id_idx" ON "contract_prints"("organization_id", "template_id");
CREATE UNIQUE INDEX "contract_prints_id_organization_id_key" ON "contract_prints"("id", "organization_id");
CREATE UNIQUE INDEX "contract_prints_id_contract_id_key" ON "contract_prints"("id", "contract_id");
CREATE UNIQUE INDEX "contract_prints_contract_id_print_no_key" ON "contract_prints"("contract_id", "print_no");

-- AddForeignKey
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Khoá kép: database chặn ghi nhật ký in của hợp đồng tổ chức khác / mẫu của tổ chức khác.
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_template_id_organization_id_fkey" FOREIGN KEY ("template_id", "organization_id") REFERENCES "print_templates"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Khoá kép theo HỢP ĐỒNG: lần in làm gốc phải cùng hợp đồng.
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_based_on_print_id_contract_id_fkey" FOREIGN KEY ("based_on_print_id", "contract_id") REFERENCES "contract_prints"("id", "contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_printed_by_id_fkey" FOREIGN KEY ("printed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================================================
-- CHỐT VIẾT TAY (Prisma không sinh). Sổ lỗi 24: CHECK ra NULL được coi là ĐẠT.
-- Cột cho phép NULL: luôn mở đầu bằng "cột IS NULL OR …" hoặc viết rõ IS NOT NULL.
-- Biểu thức JSON (->>, jsonb_typeof) trả NULL khi thiếu khoá: luôn bọc COALESCE(…, '') rồi mới so.
-- =====================================================================================================

-- ---------- Hồ sơ thương hiệu: người đại diện, tài khoản ngân hàng ----------
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_representative_name_len"
  CHECK ("representative_name" IS NULL OR char_length(btrim("representative_name")) BETWEEN 1 AND 120);
-- Có chức vụ thì phải có tên người đại diện.
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_representative_title"
  CHECK ("representative_title" IS NULL
         OR ("representative_name" IS NOT NULL AND char_length(btrim("representative_title")) BETWEEN 1 AND 80));
-- Ba trường ngân hàng: đủ cả ba hoặc trống cả ba (IS NULL / IS NOT NULL không bao giờ ra NULL).
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_all_or_none"
  CHECK (("bank_name" IS NULL AND "bank_account_number" IS NULL AND "bank_account_name" IS NULL)
      OR ("bank_name" IS NOT NULL AND "bank_account_number" IS NOT NULL AND "bank_account_name" IS NOT NULL));
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_name_len"
  CHECK ("bank_name" IS NULL OR char_length(btrim("bank_name")) BETWEEN 2 AND 120);
-- Số tài khoản đã chuẩn hoá ở máy chủ: bỏ khoảng trắng, viết hoa.
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_account_number_format"
  CHECK ("bank_account_number" IS NULL OR "bank_account_number" ~ '^[0-9A-Z]{4,30}$');
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_bank_account_name_len"
  CHECK ("bank_account_name" IS NULL OR char_length(btrim("bank_account_name")) BETWEEN 2 AND 120);

-- ---------- Mẫu in ----------
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_layout" CHECK ("layout" BETWEEN 1 AND 5);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_applies" CHECK ("for_service" OR "for_course");
-- Mẫu mặc định của một loại phải dùng cho loại đó và đang dùng (các cột đều NOT NULL — không có bẫy NULL).
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_default_service"
  CHECK (NOT "default_service" OR ("for_service" AND "is_active"));
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_default_course"
  CHECK (NOT "default_course" OR ("for_course" AND "is_active"));
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_name_len"
  CHECK (char_length(btrim("name")) BETWEEN 1 AND 120);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_title_len"
  CHECK ("title" IS NULL OR char_length(btrim("title")) BETWEEN 1 AND 160);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_opening_len"
  CHECK ("opening_text" IS NULL OR char_length(btrim("opening_text")) BETWEEN 1 AND 2000);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_closing_len"
  CHECK ("closing_text" IS NULL OR char_length(btrim("closing_text")) BETWEEN 1 AND 2000);
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_version" CHECK ("version" >= 1);
-- blocks là object, mọi giá trị là true/false (null, chuỗi, số đều bị chặn). Khoá hợp lệ do máy chủ kiểm (danh mục ở shared).
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_blocks_shape"
  CHECK (jsonb_typeof("blocks") = 'object'
         AND NOT jsonb_path_exists("blocks", '$.* ? (@.type() != "boolean")'));
-- Mỗi tổ chức tối đa một mẫu mặc định cho mỗi loại hợp đồng.
CREATE UNIQUE INDEX "print_templates_one_default_service" ON "print_templates" ("organization_id") WHERE "default_service";
CREATE UNIQUE INDEX "print_templates_one_default_course" ON "print_templates" ("organization_id") WHERE "default_course";

-- Đổi nội dung in mà quên tăng phiên bản → bản in cũ "v3" không còn nghĩa là một thứ cố định. Database chặn.
CREATE FUNCTION print_templates_version_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" <> OLD."organization_id" THEN
    RAISE EXCEPTION 'Mẫu in không được đổi tổ chức';
  END IF;
  IF NEW."version" < OLD."version" THEN
    RAISE EXCEPTION 'Mẫu in không được giảm phiên bản';
  END IF;
  IF (NEW."layout", NEW."blocks", NEW."title", NEW."opening_text", NEW."closing_text")
       IS DISTINCT FROM (OLD."layout", OLD."blocks", OLD."title", OLD."opening_text", OLD."closing_text")
     AND NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'Mẫu in đổi nội dung in thì phiên bản phải tăng';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER print_templates_version_guard BEFORE UPDATE ON "print_templates"
  FOR EACH ROW EXECUTE FUNCTION print_templates_version_guard();

-- ---------- Nhật ký in ----------
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_print_no" CHECK ("print_no" >= 1);
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_template_version" CHECK ("template_version" >= 1);
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_data_version" CHECK ("data_version" >= 1);
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_data_hash" CHECK ("data_hash" ~ '^[0-9a-f]{64}$');
-- TEMPLATE không có gốc; PRIOR_CONFIG / REPRINT bắt buộc có gốc (vế nào cũng viết rõ IS NULL / IS NOT NULL).
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_source_base"
  CHECK (("source" = 'TEMPLATE' AND "based_on_print_id" IS NULL)
      OR ("source" IN ('PRIOR_CONFIG', 'REPRINT') AND "based_on_print_id" IS NOT NULL));
-- Không tự trỏ vào chính mình (khoá ngoại kiểm cuối câu lệnh nên tự trỏ sẽ lọt nếu không chặn).
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_not_self"
  CHECK ("based_on_print_id" IS NULL OR "based_on_print_id" <> "id");
-- Hình dạng tối thiểu của bản chụp. COALESCE: khoá vắng mặt → '' → trượt (không để NULL lọt).
ALTER TABLE "contract_prints" ADD CONSTRAINT "contract_prints_snapshot_shape"
  CHECK (jsonb_typeof("config") = 'object'
     AND jsonb_typeof("data") = 'object'
     AND COALESCE("config"->>'layout', '') IN ('1', '2', '3', '4', '5')
     AND COALESCE(jsonb_typeof("config"->'blocks'), '') = 'object'
     AND COALESCE("data"->>'kind', '') IN ('SERVICE', 'COURSE'));

CREATE FUNCTION contract_prints_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'contract_prints chỉ được ghi thêm, không được %', TG_OP;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contract_prints_append_only BEFORE UPDATE OR DELETE ON "contract_prints"
  FOR EACH ROW EXECUTE FUNCTION contract_prints_block_mutation();

-- ---------- Mẫu mặc định cho tổ chức đã có (chạy lại không nhân đôi) ----------
-- Dịch vụ: mọi tổ chức (tổ chức đào tạo cũng lập được hợp đồng dịch vụ). Khoá học: chỉ ACADEMY.
-- blocks '{}' và chữ NULL = theo mặc định của bố cục (mẫu 1 bật quốc hiệu; mẫu 2 tắt quốc hiệu + ký nháy).
-- SEED BEGIN
INSERT INTO "print_templates" ("id", "organization_id", "name", "layout", "for_service", "for_course",
  "default_service", "default_course", "blocks", "version", "is_active", "updated_by_id", "created_at", "updated_at")
SELECT gen_random_uuid(), o."id", 'Hiện đại', 2, true, false, true, false, '{}'::jsonb, 1, true, NULL, now(), now()
FROM "organizations" o
WHERE NOT EXISTS (SELECT 1 FROM "print_templates" p WHERE p."organization_id" = o."id" AND p."default_service");

INSERT INTO "print_templates" ("id", "organization_id", "name", "layout", "for_service", "for_course",
  "default_service", "default_course", "blocks", "version", "is_active", "updated_by_id", "created_at", "updated_at")
SELECT gen_random_uuid(), o."id", 'Cổ điển có quốc hiệu', 1, false, true, false, true, '{}'::jsonb, 1, true, NULL, now(), now()
FROM "organizations" o
WHERE o."kind" = 'ACADEMY'
  AND NOT EXISTS (SELECT 1 FROM "print_templates" p WHERE p."organization_id" = o."id" AND p."default_course");
-- SEED END
