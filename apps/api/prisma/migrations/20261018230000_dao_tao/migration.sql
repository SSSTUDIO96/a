-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('SERVICE', 'COURSE');

-- CreateEnum
CREATE TYPE "CourseMode" AS ENUM ('SINGLE_CLASS', 'MULTI_CLASS');

-- CreateEnum
CREATE TYPE "CourseClassStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractTextKind" AS ENUM ('TERMS', 'RULES');

-- CreateEnum
CREATE TYPE "DesignCardKind" AS ENUM ('WELCOME', 'FEEDBACK', 'GREETING');

-- AlterEnum
ALTER TYPE "ContractLineKind" ADD VALUE 'COURSE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FilePurpose" ADD VALUE 'DESIGN_PHOTO';
ALTER TYPE "FilePurpose" ADD VALUE 'DESIGN_CARD';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "avatar_file_id" UUID;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "kind" "ContractKind" NOT NULL DEFAULT 'SERVICE',
ADD COLUMN     "owner_membership_id" UUID,
ADD COLUMN     "rules" TEXT,
ADD COLUMN     "rules_template_id" UUID,
ADD COLUMN     "rules_template_version" INTEGER,
ADD COLUMN     "terms_template_id" UUID,
ADD COLUMN     "terms_template_version" INTEGER;

-- AlterTable
ALTER TABLE "contract_lines" ADD COLUMN     "course_class_id" UUID;

-- CreateTable
CREATE TABLE "course_groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "CourseMode" NOT NULL,
    "tuition_fee" BIGINT NOT NULL,
    "deposit_amount" BIGINT NOT NULL DEFAULT 0,
    "default_capacity" INTEGER NOT NULL,
    "session_count" INTEGER,
    "session_minutes" INTEGER,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_classes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "weekdays" INTEGER[],
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "capacity" INTEGER NOT NULL,
    "enrolled_count" INTEGER NOT NULL DEFAULT 0,
    "status" "CourseClassStatus" NOT NULL DEFAULT 'OPEN',
    "instructor_membership_id" UUID,
    "studio_location_id" UUID,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "course_class_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "contract_line_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_texts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "ContractTextKind" NOT NULL,
    "applies_to" "ContractKind"[],
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "greeting_phrases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "applies_to" "ContractKind"[],
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "greeting_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_cards" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "DesignCardKind" NOT NULL,
    "template_code" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "contract_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "course_class_id" UUID,
    "title" TEXT,
    "body" TEXT,
    "rating" INTEGER,
    "received_at" DATE,
    "font_override" TEXT,
    "size" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "output_file_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "design_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_card_photos" (
    "card_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "design_card_photos_pkey" PRIMARY KEY ("card_id","sort_order")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_groups_organization_id_name_key" ON "course_groups"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "course_groups_id_organization_id_key" ON "course_groups"("id", "organization_id");

-- CreateIndex
CREATE INDEX "courses_organization_id_group_id_idx" ON "courses"("organization_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_organization_id_code_key" ON "courses"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_id_organization_id_key" ON "courses"("id", "organization_id");

-- CreateIndex
CREATE INDEX "course_classes_organization_id_start_date_idx" ON "course_classes"("organization_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "course_classes_id_organization_id_key" ON "course_classes"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_classes_course_id_name_key" ON "course_classes"("course_id", "name");

-- CreateIndex
CREATE INDEX "enrollments_course_class_id_status_idx" ON "enrollments"("course_class_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_organization_id_status_customer_id_idx" ON "enrollments"("organization_id", "status", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_contract_line_id_key" ON "enrollments"("contract_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_id_organization_id_key" ON "enrollments"("id", "organization_id");

-- CreateIndex
CREATE INDEX "contract_texts_organization_id_kind_idx" ON "contract_texts"("organization_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "contract_texts_id_organization_id_key" ON "contract_texts"("id", "organization_id");

-- CreateIndex
CREATE INDEX "greeting_phrases_organization_id_sort_order_idx" ON "greeting_phrases"("organization_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "greeting_phrases_id_organization_id_key" ON "greeting_phrases"("id", "organization_id");

-- CreateIndex
CREATE INDEX "design_cards_organization_id_kind_created_at_idx" ON "design_cards"("organization_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "design_cards_contract_id_idx" ON "design_cards"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "design_cards_id_organization_id_key" ON "design_cards"("id", "organization_id");

-- CreateIndex
CREATE INDEX "design_card_photos_file_id_idx" ON "design_card_photos"("file_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_kind_idx" ON "contracts"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "contract_lines_course_class_id_idx" ON "contract_lines"("course_class_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_avatar_file_id_organization_id_fkey" FOREIGN KEY ("avatar_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_owner_membership_id_organization_id_fkey" FOREIGN KEY ("owner_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_terms_template_id_organization_id_fkey" FOREIGN KEY ("terms_template_id", "organization_id") REFERENCES "contract_texts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_rules_template_id_organization_id_fkey" FOREIGN KEY ("rules_template_id", "organization_id") REFERENCES "contract_texts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_course_class_id_organization_id_fkey" FOREIGN KEY ("course_class_id", "organization_id") REFERENCES "course_classes"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_group_id_organization_id_fkey" FOREIGN KEY ("group_id", "organization_id") REFERENCES "course_groups"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_course_id_organization_id_fkey" FOREIGN KEY ("course_id", "organization_id") REFERENCES "courses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_instructor_membership_id_organization_id_fkey" FOREIGN KEY ("instructor_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_studio_location_id_organization_id_fkey" FOREIGN KEY ("studio_location_id", "organization_id") REFERENCES "studio_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_class_id_organization_id_fkey" FOREIGN KEY ("course_class_id", "organization_id") REFERENCES "course_classes"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_contract_line_id_organization_id_fkey" FOREIGN KEY ("contract_line_id", "organization_id") REFERENCES "contract_lines"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_contract_line_id_contract_id_fkey" FOREIGN KEY ("contract_line_id", "contract_id") REFERENCES "contract_lines"("id", "contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_customer_id_organization_id_fkey" FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_texts" ADD CONSTRAINT "contract_texts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_texts" ADD CONSTRAINT "contract_texts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greeting_phrases" ADD CONSTRAINT "greeting_phrases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_customer_id_organization_id_fkey" FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_course_class_id_organization_id_fkey" FOREIGN KEY ("course_class_id", "organization_id") REFERENCES "course_classes"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_output_file_id_organization_id_fkey" FOREIGN KEY ("output_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_card_photos" ADD CONSTRAINT "design_card_photos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_card_photos" ADD CONSTRAINT "design_card_photos_card_id_organization_id_fkey" FOREIGN KEY ("card_id", "organization_id") REFERENCES "design_cards"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_card_photos" ADD CONSTRAINT "design_card_photos_file_id_organization_id_fkey" FOREIGN KEY ("file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ===== Chốt chặn viết tay — Trung tâm đào tạo (BAN-VE-C3-DAO-TAO mục 1.1, 1.2) =====
-- Lưu ý: giá trị 'COURSE' vừa thêm vào enum "ContractLineKind" bằng ALTER TYPE … ADD VALUE chưa dùng được trong
-- cùng transaction với migration này, nên các chốt của dòng hợp đồng so "kind"::text thay vì ép chữ 'COURSE' sang enum.
-- Hợp đồng cũ: cột "kind" thêm với DEFAULT 'SERVICE' nên mọi hợp đồng có từ trước đều là hợp đồng dịch vụ.

-- ---------- Khoá học ----------
ALTER TABLE "courses" ADD CONSTRAINT "courses_tuition_fee" CHECK ("tuition_fee" >= 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_deposit"
  CHECK ("deposit_amount" >= 0 AND "deposit_amount" <= "tuition_fee");
ALTER TABLE "courses" ADD CONSTRAINT "courses_default_capacity" CHECK ("default_capacity" BETWEEN 1 AND 500);
ALTER TABLE "courses" ADD CONSTRAINT "courses_session_count"
  CHECK ("session_count" IS NULL OR "session_count" BETWEEN 1 AND 365);
ALTER TABLE "courses" ADD CONSTRAINT "courses_session_minutes"
  CHECK ("session_minutes" IS NULL OR "session_minutes" BETWEEN 15 AND 720);

-- ---------- Lớp ----------
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_capacity" CHECK ("capacity" BETWEEN 1 AND 500);
-- Chốt cuối chặn vượt số tối đa (và chặn hạ số tối đa xuống dưới số đã ghi danh).
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_enrolled_le_capacity"
  CHECK ("enrolled_count" >= 0 AND "enrolled_count" <= "capacity");
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_dates" CHECK ("end_date" >= "start_date");

-- Mảng số nguyên không có phần tử trùng (CHECK không viết được truy vấn con, nên gói vào hàm IMMUTABLE).
CREATE FUNCTION int_array_no_duplicates(a integer[]) RETURNS boolean AS $$
  SELECT count(DISTINCT x) = count(*) FROM unnest(a) AS t(x);
$$ LANGUAGE sql IMMUTABLE;

-- Thứ trong tuần: 1 = Thứ Hai … 7 = Chủ nhật, ít nhất 1 ngày, không trùng. Prisma tạo cột mảng không NOT NULL,
-- nên chặn NULL ngay trong CHECK (thêm NOT NULL thì Prisma thấy lệch bản vẽ).
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_weekdays" CHECK (
  "weekdays" IS NOT NULL
  AND cardinality("weekdays") BETWEEN 1 AND 7
  AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
  AND int_array_no_duplicates("weekdays")
);
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_time_pair"
  CHECK (("start_minute" IS NULL) = ("end_minute" IS NULL));
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_time_range"
  CHECK ("start_minute" IS NULL OR ("start_minute" BETWEEN 0 AND 1439 AND "end_minute" > "start_minute" AND "end_minute" <= 1440));
-- Huỷ lớp còn học viên: phải huỷ / chuyển ghi danh trước (máy chủ báo 409 trước khi tới đây).
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_cancel_empty"
  CHECK ("status" <> 'CANCELLED' OR "enrolled_count" = 0);

-- Khoá Một lớp chỉ có đúng 1 lớp chưa huỷ. Khoá dòng khoá học trước khi đếm: hai lệnh mở lớp đồng thời cho cùng
-- khoá phải xếp hàng, lệnh sau thấy lớp của lệnh trước (READ COMMITTED: mỗi câu trong hàm lấy ảnh dữ liệu mới).
CREATE FUNCTION course_classes_single_guard() RETURNS trigger AS $$
DECLARE m "CourseMode";
BEGIN
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;
  SELECT mode INTO m FROM courses
    WHERE id = NEW.course_id AND organization_id = NEW.organization_id
    FOR NO KEY UPDATE;
  IF m = 'SINGLE_CLASS' AND EXISTS (
    SELECT 1 FROM course_classes
     WHERE course_id = NEW.course_id AND id <> NEW.id AND status <> 'CANCELLED'
  ) THEN
    RAISE EXCEPTION 'Khoá một lớp chỉ có một lớp — chuyển sang Nhiều lớp để mở thêm'
      USING ERRCODE = '23514', CONSTRAINT = 'course_classes_single_guard';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER course_classes_single_guard BEFORE INSERT OR UPDATE OF course_id, status ON "course_classes"
  FOR EACH ROW EXECUTE FUNCTION course_classes_single_guard();

-- Chiều ngược lại: chuyển Nhiều lớp → Một lớp khi còn hơn 1 lớp chưa huỷ (máy chủ kiểm trước; đây là lưới cuối).
CREATE FUNCTION courses_single_mode_guard() RETURNS trigger AS $$
DECLARE n integer;
BEGIN
  IF NEW.mode = 'SINGLE_CLASS' AND OLD.mode IS DISTINCT FROM NEW.mode THEN
    SELECT count(*) INTO n FROM course_classes WHERE course_id = NEW.id AND status <> 'CANCELLED';
    IF n > 1 THEN
      RAISE EXCEPTION 'Khoá đang có % lớp — chỉ chuyển về Một lớp khi còn 1 lớp', n
        USING ERRCODE = '23514', CONSTRAINT = 'courses_single_mode_guard';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER courses_single_mode_guard BEFORE UPDATE OF mode ON "courses"
  FOR EACH ROW EXECUTE FUNCTION courses_single_mode_guard();

-- ---------- Ghi danh ----------
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cancelled_at"
  CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
-- Một học viên không ghi danh hai lần vào cùng một lớp (chỉ tính ghi danh còn hiệu lực).
CREATE UNIQUE INDEX "enrollments_one_active" ON "enrollments" ("course_class_id", "customer_id") WHERE "status" = 'ACTIVE';

-- ---------- Hợp đồng ----------
-- Nội quy chỉ có ở hợp đồng khoá học.
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_rules_only_course" CHECK ("kind" = 'COURSE' OR "rules" IS NULL);
-- Mẫu đã chụp đi kèm phiên bản lúc chụp.
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_terms_template_pair"
  CHECK (("terms_template_id" IS NULL) = ("terms_template_version" IS NULL));
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_rules_template_pair"
  CHECK (("rules_template_id" IS NULL) = ("rules_template_version" IS NULL));

-- Loại hợp đồng đặt lúc tạo, không đổi được (kể cả lúc còn nháp): đổi loại sẽ làm dòng COURSE nằm trong hợp đồng dịch vụ.
CREATE FUNCTION contracts_kind_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'Loại hợp đồng (dịch vụ / khoá học) đặt lúc tạo, không đổi được';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contracts_kind_locked BEFORE UPDATE OF kind ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION contracts_kind_immutable();

-- Khoá hợp đồng sau xác nhận (migration 20261018170000): giữ nguyên mọi luật cũ, thêm bản chụp nội quy và mẫu đã chụp
-- vào nhóm "không đổi sau xác nhận" như điều khoản.
CREATE OR REPLACE FUNCTION contracts_lock_after_confirm() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'DRAFT' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Hợp đồng đã kết thúc: không được thay đổi';
  END IF;
  IF NEW.status = 'DRAFT' THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: không được đưa về nháp';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.terms IS DISTINCT FROM OLD.terms
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: không được đổi khách, ngày, điều khoản';
  END IF;
  IF NEW.rules IS DISTINCT FROM OLD.rules
     OR NEW.terms_template_id IS DISTINCT FROM OLD.terms_template_id
     OR NEW.terms_template_version IS DISTINCT FROM OLD.terms_template_version
     OR NEW.rules_template_id IS DISTINCT FROM OLD.rules_template_id
     OR NEW.rules_template_version IS DISTINCT FROM OLD.rules_template_version THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: không được đổi nội quy, mẫu điều khoản đã chụp';
  END IF;
  IF NEW.discount > OLD.discount OR NEW.deposit_required > OLD.deposit_required THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: giảm giá và tiền cọc chỉ được hạ';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- Dòng hợp đồng ----------
-- Chốt "loại dòng ↔ tham chiếu" cũ không có nhánh COURSE (dòng COURSE sẽ bị chặn): thay bằng bản có thêm nhánh COURSE,
-- giữ nguyên ba nhánh cũ.
ALTER TABLE "contract_lines" DROP CONSTRAINT "contract_lines_kind_ref";
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_kind_ref" CHECK (
  ("kind" = 'PACKAGE' AND "package_id" IS NOT NULL)
  OR ("kind" IN ('SERVICE', 'ADDON', 'SURCHARGE') AND "package_id" IS NULL)
  OR ("kind" IN ('TRAVEL', 'CUSTOM') AND "service_id" IS NULL AND "package_id" IS NULL)
  OR ("kind"::text = 'COURSE' AND "service_id" IS NULL AND "package_id" IS NULL)
);
-- Dòng COURSE ⇔ có lớp.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_course_class"
  CHECK (("kind"::text = 'COURSE') = ("course_class_id" IS NOT NULL));
-- Dòng COURSE: số lượng 1, không giá theo bảng giá, không nhân vật, không giờ hẹn (bản vẽ C3 mục 1.1).
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_course_fields" CHECK (
  "kind"::text <> 'COURSE'
  OR ("quantity" = 1 AND "price_version_id" IS NULL AND "subject_id" IS NULL AND "subject_name" IS NULL
      AND "scheduled_start" IS NULL AND "scheduled_end" IS NULL)
);

-- ---------- Mẫu điều khoản / nội quy ----------
-- Mỗi (tổ chức, loại) tối đa một mẫu mặc định.
CREATE UNIQUE INDEX "contract_texts_one_default" ON "contract_texts" ("organization_id", "kind") WHERE "is_default";
ALTER TABLE "contract_texts" ADD CONSTRAINT "contract_texts_version" CHECK ("version" >= 1);

-- ---------- Thẻ thiết kế ----------
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_feedback_body" CHECK ("kind" <> 'FEEDBACK' OR "body" IS NOT NULL);
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_greeting_body" CHECK ("kind" <> 'GREETING' OR "body" IS NOT NULL);
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_rating"
  CHECK ("rating" IS NULL OR ("kind" = 'FEEDBACK' AND "rating" BETWEEN 1 AND 5));
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_received_at" CHECK ("received_at" IS NULL OR "kind" = 'FEEDBACK');
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_size" CHECK ("size" IN ('1080x1350', '1080x1080'));
ALTER TABLE "design_cards" ADD CONSTRAINT "design_cards_template_version" CHECK ("template_version" >= 1);
-- Tối đa 3 ảnh mỗi thẻ (khoá chính (card_id, sort_order) + sort_order 0..2).
ALTER TABLE "design_card_photos" ADD CONSTRAINT "design_card_photos_sort_order" CHECK ("sort_order" BETWEEN 0 AND 2);
