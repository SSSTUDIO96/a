-- Bản vẽ D (docs/rnd/BAN-VE-D-HOM-NAY-SU-KIEN-PHU-PHI.md): loại sự kiện, luật phụ phí, sự kiện + phụ phí tự động ở dòng hợp đồng,
-- chỉ mục cho trang "Hôm nay". KHÔNG đổi dữ liệu cũ: chỉ thêm bảng, cột NULL / mảng rỗng, chỉ mục.
-- Mọi CHECK có cột cho phép NULL viết rõ IS NOT NULL ở vế còn lại (sổ lỗi 24).

-- ---------- 1. Loại sự kiện ----------
CREATE TABLE "occasions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "occasions_organization_id_name_key" ON "occasions"("organization_id", "name");
CREATE UNIQUE INDEX "occasions_id_organization_id_key" ON "occasions"("id", "organization_id");
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_name" CHECK (char_length("name") BETWEEN 1 AND 60 AND "name" = btrim("name"));
-- Đúng 12 tên màu của Lịch (OCCASION_COLORS ở packages/shared/src/occasions.ts = SWATCHES ở apps/web/src/features/schedule/model.ts).
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_color" CHECK ("color" IN
  ('rose','violet','amber','green','blue','taupe','brick','petrol','olive','plum','forest','brown'));
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_sort_order" CHECK ("sort_order" >= 0);

-- ---------- 2. Luật phụ phí ----------
CREATE TABLE "surcharge_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "service_id" UUID NOT NULL,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "per_quantity" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "surcharge_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "surcharge_rules_organization_id_name_key" ON "surcharge_rules"("organization_id", "name");
CREATE UNIQUE INDEX "surcharge_rules_id_organization_id_key" ON "surcharge_rules"("id", "organization_id");
CREATE INDEX "surcharge_rules_organization_id_is_active_sort_order_idx" ON "surcharge_rules"("organization_id", "is_active", "sort_order");
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Khoá ngoại kép: luật chỉ trỏ được dịch vụ của CHÍNH tổ chức.
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_service_id_organization_id_fkey"
  FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_name" CHECK (char_length("name") BETWEEN 1 AND 120 AND "name" = btrim("name"));
-- Khung giờ: không có cả hai, hoặc có cả hai và hợp lệ. start > end = qua nửa đêm. 1440 chỉ dùng cho giờ kết thúc.
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_window" CHECK (
  ("start_minute" IS NULL AND "end_minute" IS NULL)
  OR ("start_minute" IS NOT NULL AND "end_minute" IS NOT NULL
      AND "start_minute" BETWEEN 0 AND 1439
      AND "end_minute" BETWEEN 1 AND 1440
      AND "start_minute" <> "end_minute")
);
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_weekdays" CHECK (
  cardinality("weekdays") <= 7
  AND array_position("weekdays", NULL) IS NULL
  AND "weekdays" <@ ARRAY[1,2,3,4,5,6,7]
);
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_note" CHECK ("note" IS NULL OR ("note" IS NOT NULL AND char_length("note") <= 500));
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_sort_order" CHECK ("sort_order" >= 0);
-- Database KHÔNG chặn được "dịch vụ phải là SURCHARGE" (CHECK không đọc bảng khác; loại dịch vụ còn đổi được về sau):
-- máy chủ chặn lúc lưu luật và BỎ QUA luật lúc tính nếu dịch vụ đã đổi loại / ngừng (mục 2.4 bước 4).
-- "Luật có ít nhất một điều kiện giờ / ngày / sự kiện" cũng do máy chủ chặn (điều kiện nằm ở hai bảng con).

CREATE TABLE "surcharge_rule_targets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "occasion_id" UUID,
    "package_id" UUID,
    "subject_id" UUID,
    CONSTRAINT "surcharge_rule_targets_pkey" PRIMARY KEY ("id")
);
-- num_nonnulls trả số nguyên, không bao giờ NULL → không dính bẫy sổ lỗi 24.
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_one"
  CHECK (num_nonnulls("occasion_id", "package_id", "subject_id") = 1);
CREATE UNIQUE INDEX "surcharge_rule_targets_rule_id_occasion_id_key" ON "surcharge_rule_targets"("rule_id", "occasion_id");
CREATE UNIQUE INDEX "surcharge_rule_targets_rule_id_package_id_key" ON "surcharge_rule_targets"("rule_id", "package_id");
CREATE UNIQUE INDEX "surcharge_rule_targets_rule_id_subject_id_key" ON "surcharge_rule_targets"("rule_id", "subject_id");
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_rule_id_organization_id_fkey"
  FOREIGN KEY ("rule_id", "organization_id") REFERENCES "surcharge_rules"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_occasion_id_organization_id_fkey"
  FOREIGN KEY ("occasion_id", "organization_id") REFERENCES "occasions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_package_id_organization_id_fkey"
  FOREIGN KEY ("package_id", "organization_id") REFERENCES "service_packages"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_targets" ADD CONSTRAINT "surcharge_rule_targets_subject_id_organization_id_fkey"
  FOREIGN KEY ("subject_id", "organization_id") REFERENCES "makeup_subjects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "surcharge_rule_dates" (
    "organization_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    CONSTRAINT "surcharge_rule_dates_pkey" PRIMARY KEY ("rule_id", "day")
);
ALTER TABLE "surcharge_rule_dates" ADD CONSTRAINT "surcharge_rule_dates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surcharge_rule_dates" ADD CONSTRAINT "surcharge_rule_dates_rule_id_organization_id_fkey"
  FOREIGN KEY ("rule_id", "organization_id") REFERENCES "surcharge_rules"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- 3. Dòng hợp đồng ----------
ALTER TABLE "contract_lines"
  ADD COLUMN "occasion_id" UUID,
  ADD COLUMN "occasion_name" TEXT,
  ADD COLUMN "surcharge_rule_id" UUID,
  ADD COLUMN "surcharge_rule_name" TEXT,
  ADD COLUMN "dismissed_surcharge_rule_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_occasion_id_organization_id_fkey"
  FOREIGN KEY ("occasion_id", "organization_id") REFERENCES "occasions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_surcharge_rule_id_organization_id_fkey"
  FOREIGN KEY ("surcharge_rule_id", "organization_id") REFERENCES "surcharge_rules"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sự kiện: có mã thì có tên chụp (và ngược lại); chỉ dòng đặt chỗ mới có sự kiện.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_occasion" CHECK (
  ("occasion_id" IS NULL AND "occasion_name" IS NULL)
  OR ("occasion_id" IS NOT NULL AND "occasion_name" IS NOT NULL AND "kind" IN ('PACKAGE', 'SERVICE'))
);
-- Dòng tự thêm: có mã luật thì có tên luật, là dòng SURCHARGE và là dòng con.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_auto_surcharge" CHECK (
  ("surcharge_rule_id" IS NULL AND "surcharge_rule_name" IS NULL)
  OR ("surcharge_rule_id" IS NOT NULL AND "surcharge_rule_name" IS NOT NULL
      AND "kind" = 'SURCHARGE' AND "parent_line_id" IS NOT NULL)
);
-- Luật đã bỏ: tối đa 50, không phần tử NULL, chỉ dòng đặt chỗ mới có.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_dismissed_rules" CHECK (
  cardinality("dismissed_surcharge_rule_ids") <= 50
  AND array_position("dismissed_surcharge_rule_ids", NULL) IS NULL
  AND (cardinality("dismissed_surcharge_rule_ids") = 0 OR "kind" IN ('PACKAGE', 'SERVICE'))
);
-- Mỗi dòng đặt chỗ tối đa MỘT dòng tự thêm chưa huỷ cho mỗi luật. Chỉ mục có điều kiện — Prisma không ghi được
-- (ghi chú ở model ContractLine, giống appointments_class_session_live_key).
CREATE UNIQUE INDEX "contract_lines_one_auto_per_rule"
  ON "contract_lines"("parent_line_id", "surcharge_rule_id")
  WHERE "surcharge_rule_id" IS NOT NULL AND "voided_at" IS NULL;
CREATE INDEX "contract_lines_occasion_id_idx" ON "contract_lines"("occasion_id");
CREATE INDEX "contract_lines_surcharge_rule_id_idx" ON "contract_lines"("surcharge_rule_id");
-- Khoá dòng sau xác nhận (contract_lines_lock_after_confirm, migration 20261018160000) so to_jsonb(NEW) với to_jsonb(OLD):
-- 5 cột mới tự nằm trong diện "không được sửa sau xác nhận" — không sửa trigger.

-- ---------- 4. Chỉ mục cho trang "Hôm nay" ----------
CREATE INDEX "payment_installments_organization_id_due_date_idx" ON "payment_installments"("organization_id", "due_date");
CREATE INDEX "contracts_organization_id_confirmed_at_idx" ON "contracts"("organization_id", "confirmed_at");
CREATE INDEX "enrollments_organization_id_enrolled_at_idx" ON "enrollments"("organization_id", "enrolled_at");
