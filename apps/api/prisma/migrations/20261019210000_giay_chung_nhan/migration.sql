-- Giấy chứng nhận (docs/rnd/BAN-VE-F-GIAY-CHUNG-NHAN.md mục 2).
-- Mốc 20261019210000 theo KY-DUYET-F câu 6 + đính chính 19/10 tối (bản vẽ gốc ghi 150000). Gói S1a.
-- Bảng mới + 2 cột hồ sơ cho phép NULL, không DEFAULT: không viết lại bảng cũ, không dòng cũ nào vi phạm chốt (đã đếm = 0).

-- ---------- Phần Prisma tả được ----------

CREATE TYPE "CertificateStatus" AS ENUM ('ISSUED', 'REVOKED');

ALTER TABLE "organization_profiles" ADD COLUMN "cert_signer_name" TEXT,
ADD COLUMN "cert_signer_title" TEXT;

CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "course_class_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "reissue_no" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL,
    "issued_on" DATE NOT NULL,
    "reissued_on" DATE,
    "template_code" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "font_override" TEXT,
    "background_style" TEXT,
    "background_file_id" UUID,
    "frame_style" TEXT,
    "student_name" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "instructor_name" TEXT,
    "signer_name" TEXT,
    "signer_title" TEXT,
    "brand_name" TEXT NOT NULL,
    "photo_file_id" UUID,
    "logo_file_id" UUID,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ISSUED',
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" TEXT,
    "revoked_by_id" UUID,
    "replaces_id" UUID,
    "issued_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificates_id_org_key" ON "certificates"("id", "organization_id");
CREATE UNIQUE INDEX "certificates_reissue_target_key" ON "certificates"("id", "organization_id", "enrollment_id", "year", "seq");
CREATE UNIQUE INDEX "certificates_number_key" ON "certificates"("organization_id", "year", "seq", "reissue_no");
CREATE INDEX "certificates_org_class_idx" ON "certificates"("organization_id", "course_class_id");
CREATE INDEX "certificates_org_customer_idx" ON "certificates"("organization_id", "customer_id");
CREATE INDEX "certificates_org_number_idx" ON "certificates"("organization_id", "year", "seq");

CREATE UNIQUE INDEX "enrollments_cert_target_key" ON "enrollments"("id", "organization_id", "course_class_id", "customer_id");

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_fkey" FOREIGN KEY ("enrollment_id", "organization_id", "course_class_id", "customer_id") REFERENCES "enrollments"("id", "organization_id", "course_class_id", "customer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_class_fkey" FOREIGN KEY ("course_class_id", "organization_id") REFERENCES "course_classes"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_customer_fkey" FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_photo_fkey" FOREIGN KEY ("photo_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_logo_fkey" FOREIGN KEY ("logo_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_background_fkey" FOREIGN KEY ("background_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_replaces_fkey" FOREIGN KEY ("replaces_id", "organization_id", "enrollment_id", "year", "seq") REFERENCES "certificates"("id", "organization_id", "enrollment_id", "year", "seq") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_by_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Phần viết tay: chốt chặn (Prisma không tả được) ----------
-- Luật sổ lỗi 24: CHECK có cột cho phép NULL phải viết rõ IS NULL / IS NOT NULL ở từng vế — Postgres coi CHECK ra NULL là ĐẠT.

-- Số: năm hợp lý, khớp năm ngày cấp; mã khớp năm + số (4 chữ số, từ 10000 in đủ, không cắt).
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_number" CHECK (
  "year" BETWEEN 2000 AND 2999
  AND "seq" BETWEEN 1 AND 999999
  AND "reissue_no" BETWEEN 0 AND 999
  AND "year" = EXTRACT(YEAR FROM "issued_on")::int
  AND "code" = 'CC-' || "year"::text || '-' || CASE WHEN "seq" < 10000 THEN lpad("seq"::text, 4, '0') ELSE "seq"::text END
);

-- Trạng thái: đã cấp thì không có dấu vết thu hồi; đã thu hồi thì đủ lúc nào, lý do (không rỗng, ≤ 500), ai thu hồi.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_status" CHECK (
  ("status" = 'ISSUED' AND "revoked_at" IS NULL AND "revoke_reason" IS NULL AND "revoked_by_id" IS NULL)
  OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND "revoke_reason" IS NOT NULL
      AND char_length(btrim("revoke_reason")) BETWEEN 1 AND 500 AND "revoked_by_id" IS NOT NULL)
);

-- Cấp lại: bản gốc không trỏ ai, không có ngày cấp lại; bản cấp lại phải trỏ bản cũ và có ngày cấp lại ≥ ngày cấp.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_reissue" CHECK (
  ("reissue_no" = 0 AND "replaces_id" IS NULL AND "reissued_on" IS NULL)
  OR ("reissue_no" >= 1 AND "replaces_id" IS NOT NULL AND "reissued_on" IS NOT NULL AND "reissued_on" >= "issued_on")
);

-- Mẫu: chỉ mẫu giấy chứng nhận cc-NN; phông chỉ ky-1..ky-4 hoặc null.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_template" CHECK (
  "template_code" ~ '^cc-[0-9]{2}$'
  AND "template_version" >= 1
  AND ("font_override" IS NULL OR "font_override" IN ('ky-1', 'ky-2', 'ky-3', 'ky-4'))
);

-- Chỗ chừa cho bộ nền (CHỜ BẢN VẼ NỀN): khoá dạng chữ thường/số/:/-, ≤ 64 ký tự; có ảnh nền thì phải có kiểu nền.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_background" CHECK (
  ("background_style" IS NULL OR "background_style" ~ '^[a-z0-9][a-z0-9:-]{0,63}$')
  AND ("frame_style" IS NULL OR "frame_style" ~ '^[a-z0-9][a-z0-9:-]{0,63}$')
  AND ("background_file_id" IS NULL OR "background_style" IS NOT NULL)
);

-- Chữ chụp lúc cấp: không rỗng, độ dài có trần.
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_texts" CHECK (
  char_length(btrim("student_name")) BETWEEN 1 AND 200
  AND char_length(btrim("course_name")) BETWEEN 1 AND 200
  AND char_length(btrim("class_name")) BETWEEN 1 AND 200
  AND char_length(btrim("brand_name")) BETWEEN 1 AND 200
  AND ("instructor_name" IS NULL OR char_length(btrim("instructor_name")) BETWEEN 1 AND 200)
  AND ("signer_name" IS NULL OR char_length(btrim("signer_name")) BETWEEN 1 AND 120)
  AND ("signer_title" IS NULL OR char_length(btrim("signer_title")) BETWEEN 1 AND 120)
);

ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_cert_signer" CHECK (
  ("cert_signer_name" IS NULL OR char_length(btrim("cert_signer_name")) BETWEEN 1 AND 120)
  AND ("cert_signer_title" IS NULL OR char_length(btrim("cert_signer_title")) BETWEEN 1 AND 120)
);

-- Một ghi danh tối đa một bản còn hiệu lực.
CREATE UNIQUE INDEX "certificates_one_issued_per_enrollment" ON "certificates" ("enrollment_id") WHERE "status" = 'ISSUED';
-- Một số tối đa một bản còn hiệu lực.
CREATE UNIQUE INDEX "certificates_code_issued" ON "certificates" ("organization_id", "year", "seq") WHERE "status" = 'ISSUED';
-- Mỗi bản bị cấp lại tối đa một lần (không rẽ nhánh).
CREATE UNIQUE INDEX "certificates_replaced_once" ON "certificates" ("replaces_id") WHERE "replaces_id" IS NOT NULL;

-- Thêm mới: lớp chưa huỷ và đã kết thúc trước/đúng ngày cấp; ngày cấp (và ngày cấp lại) không sau hôm nay theo múi giờ
-- tổ chức; ghi danh còn hiệu lực; cấp lại thì bản cũ đã thu hồi và số lần cấp lại tăng đúng 1.
-- Dùng IS DISTINCT FROM / IS NULL để giá trị NULL (dòng không tìm thấy) cũng bị chặn, không lọt như CHECK.
CREATE FUNCTION certificates_insert_guard() RETURNS trigger AS $$
DECLARE
  k_end date;
  k_status "CourseClassStatus";
  e_status "EnrollmentStatus";
  tz text;
  today date;
  p_status "CertificateStatus";
  p_reissue integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'ISSUED' THEN
    RAISE EXCEPTION 'Giấy chứng nhận mới phải ở trạng thái đã cấp'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  SELECT end_date, status INTO k_end, k_status FROM course_classes
    WHERE id = NEW.course_class_id AND organization_id = NEW.organization_id;
  IF k_end IS NULL OR (k_status IS DISTINCT FROM 'OPEN' AND k_status IS DISTINCT FROM 'CLOSED') THEN
    RAISE EXCEPTION 'Lớp không tồn tại hoặc đã huỷ'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  IF NEW.issued_on < k_end THEN
    RAISE EXCEPTION 'Ngày cấp phải từ ngày kết thúc lớp (%) trở đi', k_end
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  SELECT timezone INTO tz FROM organizations WHERE id = NEW.organization_id;
  today := (now() AT TIME ZONE COALESCE(tz, 'Asia/Ho_Chi_Minh'))::date;
  IF NEW.issued_on > today OR (NEW.reissued_on IS NOT NULL AND NEW.reissued_on > today) THEN
    RAISE EXCEPTION 'Ngày cấp không được sau hôm nay'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  SELECT status INTO e_status FROM enrollments
    WHERE id = NEW.enrollment_id AND organization_id = NEW.organization_id;
  IF e_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Ghi danh không còn hiệu lực'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
  END IF;
  IF NEW.replaces_id IS NOT NULL THEN
    SELECT status, reissue_no INTO p_status, p_reissue FROM certificates
      WHERE id = NEW.replaces_id AND organization_id = NEW.organization_id
      FOR UPDATE;
    IF p_status IS DISTINCT FROM 'REVOKED' OR p_reissue IS NULL OR NEW.reissue_no <> p_reissue + 1 THEN
      RAISE EXCEPTION 'Cấp lại phải từ bản đã thu hồi và số lần cấp lại tăng đúng 1'
        USING ERRCODE = '23514', CONSTRAINT = 'certificates_insert_guard';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER certificates_insert_guard BEFORE INSERT ON "certificates"
  FOR EACH ROW EXECUTE FUNCTION certificates_insert_guard();

-- Sửa: chỉ được ISSUED → REVOKED (kèm revoked_at, revoke_reason, revoked_by_id). Mọi cột khác đóng băng; bản đã thu hồi
-- đóng băng hoàn toàn. So bằng jsonb trừ 4 cột được đổi — cột thêm sau này tự vào diện đóng băng.
CREATE FUNCTION certificates_update_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'REVOKED' THEN
    RAISE EXCEPTION 'Giấy chứng nhận đã thu hồi: không được thay đổi'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_update_guard';
  END IF;
  IF NEW.status IS DISTINCT FROM 'REVOKED' THEN
    RAISE EXCEPTION 'Giấy chứng nhận đã cấp: chỉ được thu hồi, không sửa'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_update_guard';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'revoked_at', 'revoke_reason', 'revoked_by_id'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'revoked_at', 'revoke_reason', 'revoked_by_id']) THEN
    RAISE EXCEPTION 'Giấy chứng nhận đã cấp: số, tên, mẫu, ngày cấp không sửa được — dùng Cấp lại'
      USING ERRCODE = '23514', CONSTRAINT = 'certificates_update_guard';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER certificates_update_guard BEFORE UPDATE ON "certificates"
  FOR EACH ROW EXECUTE FUNCTION certificates_update_guard();

-- Sổ chỉ ghi thêm: không xoá.
CREATE FUNCTION certificates_no_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Sổ giấy chứng nhận chỉ ghi thêm, không xoá — dùng Thu hồi'
    USING ERRCODE = '23514', CONSTRAINT = 'certificates_no_delete';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER certificates_no_delete BEFORE DELETE ON "certificates"
  FOR EACH ROW EXECUTE FUNCTION certificates_no_delete();
