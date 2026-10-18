-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('MAKEUP', 'COURSE_SESSION', 'INTERNAL', 'PERSONAL_BLOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('PRIMARY', 'ASSIST');

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "staff_count" INTEGER NOT NULL DEFAULT 1,
    "deposit_amount" BIGINT NOT NULL DEFAULT 0,
    "terms" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_items" (
    "organization_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "package_items_pkey" PRIMARY KEY ("package_id","service_id")
);

-- CreateTable
CREATE TABLE "price_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "service_id" UUID,
    "package_id" UUID,
    "list_price" BIGINT NOT NULL,
    "sale_price" BIGINT,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL DEFAULT 'MAKEUP',
    "title" TEXT,
    "customer_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "travel_before_min" INTEGER NOT NULL DEFAULT 0,
    "travel_after_min" INTEGER NOT NULL DEFAULT 0,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "WorkStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "travel_fee" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "deposit_required" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancel_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "service_id" UUID,
    "package_id" UUID,
    "price_version_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "line_total" BIGINT NOT NULL,

    CONSTRAINT "appointment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_staff" (
    "organization_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'PRIMARY',
    "block_start" TIMESTAMPTZ(3) NOT NULL,
    "block_end" TIMESTAMPTZ(3) NOT NULL,
    "is_blocking" BOOLEAN NOT NULL,

    CONSTRAINT "appointment_staff_pkey" PRIMARY KEY ("appointment_id","membership_id")
);

-- CreateTable
CREATE TABLE "appointment_status_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "from_status" "WorkStatus",
    "to_status" "WorkStatus" NOT NULL,
    "reason" TEXT,
    "changed_by_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_counters" (
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "org_counters_pkey" PRIMARY KEY ("organization_id","key")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "route_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("organization_id","user_id","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_organization_id_name_key" ON "service_categories"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_id_organization_id_key" ON "service_categories"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_organization_id_code_key" ON "services"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "services_id_organization_id_key" ON "services"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_packages_organization_id_code_key" ON "service_packages"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "service_packages_id_organization_id_key" ON "service_packages"("id", "organization_id");

-- CreateIndex
CREATE INDEX "price_versions_service_id_effective_from_idx" ON "price_versions"("service_id", "effective_from");

-- CreateIndex
CREATE INDEX "price_versions_package_id_effective_from_idx" ON "price_versions"("package_id", "effective_from");

-- CreateIndex
CREATE INDEX "customers_organization_id_phone_idx" ON "customers"("organization_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_id_organization_id_key" ON "customers"("id", "organization_id");

-- CreateIndex
CREATE INDEX "appointments_organization_id_starts_at_idx" ON "appointments"("organization_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_organization_id_code_key" ON "appointments"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_id_organization_id_key" ON "appointments"("id", "organization_id");

-- CreateIndex
CREATE INDEX "appointment_items_appointment_id_idx" ON "appointment_items"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_staff_membership_id_block_start_idx" ON "appointment_staff"("membership_id", "block_start");

-- CreateIndex
CREATE INDEX "appointment_status_history_appointment_id_changed_at_idx" ON "appointment_status_history"("appointment_id", "changed_at");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_organization_id_fkey" FOREIGN KEY ("category_id", "organization_id") REFERENCES "service_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_package_id_organization_id_fkey" FOREIGN KEY ("package_id", "organization_id") REFERENCES "service_packages"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_service_id_organization_id_fkey" FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_service_id_organization_id_fkey" FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_package_id_organization_id_fkey" FOREIGN KEY ("package_id", "organization_id") REFERENCES "service_packages"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_organization_id_fkey" FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_appointment_id_organization_id_fkey" FOREIGN KEY ("appointment_id", "organization_id") REFERENCES "appointments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_service_id_organization_id_fkey" FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_package_id_organization_id_fkey" FOREIGN KEY ("package_id", "organization_id") REFERENCES "service_packages"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_staff" ADD CONSTRAINT "appointment_staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_staff" ADD CONSTRAINT "appointment_staff_appointment_id_organization_id_fkey" FOREIGN KEY ("appointment_id", "organization_id") REFERENCES "appointments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_staff" ADD CONSTRAINT "appointment_staff_membership_id_organization_id_fkey" FOREIGN KEY ("membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_organization_id_fkey" FOREIGN KEY ("appointment_id", "organization_id") REFERENCES "appointments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_counters" ADD CONSTRAINT "org_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Chốt chặn viết tay =====

ALTER TABLE "services" ADD CONSTRAINT "services_duration_positive" CHECK ("duration_minutes" > 0 AND "duration_minutes" <= 1440);
ALTER TABLE "service_packages" ADD CONSTRAINT "packages_duration_positive" CHECK ("duration_minutes" > 0 AND "duration_minutes" <= 1440);
ALTER TABLE "service_packages" ADD CONSTRAINT "packages_staff_count_positive" CHECK ("staff_count" >= 1);
ALTER TABLE "service_packages" ADD CONSTRAINT "packages_deposit_non_negative" CHECK ("deposit_amount" >= 0);
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_quantity_positive" CHECK ("quantity" >= 1);

-- Giá: đúng một chủ (dịch vụ hoặc gói), không âm, giá khuyến mại không vượt giá niêm yết.
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_one_owner"
  CHECK (("service_id" IS NULL) <> ("package_id" IS NULL));
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_amounts"
  CHECK ("list_price" >= 0 AND ("sale_price" IS NULL OR ("sale_price" >= 0 AND "sale_price" <= "list_price")));

-- Lịch sử giá chỉ ghi thêm.
CREATE FUNCTION price_versions_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'price_versions chỉ được ghi thêm, không được %', TG_OP;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER price_versions_append_only BEFORE UPDATE OR DELETE ON "price_versions"
  FOR EACH ROW EXECUTE FUNCTION price_versions_block_mutation();

-- Lịch: kết thúc sau bắt đầu, tiền không âm, tổng khớp công thức.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_order" CHECK ("ends_at" > "starts_at");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_travel_range"
  CHECK ("travel_before_min" BETWEEN 0 AND 600 AND "travel_after_min" BETWEEN 0 AND 600);
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_money_non_negative"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "travel_fee" >= 0 AND "total" >= 0 AND "deposit_required" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_total_formula"
  CHECK ("total" = "subtotal" - "discount" + "travel_fee");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_deposit_le_total" CHECK ("deposit_required" <= "total");
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_amounts"
  CHECK ("quantity" >= 1 AND "unit_price" >= 0 AND "line_total" = "unit_price" * "quantity");
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_one_ref"
  CHECK (NOT ("service_id" IS NOT NULL AND "package_id" IS NOT NULL));
ALTER TABLE "appointment_staff" ADD CONSTRAINT "appointment_staff_block_order" CHECK ("block_end" > "block_start");

-- CHẶN TRÙNG LỊCH Ở DATABASE: một thợ không thể có hai khoảng bận chồng nhau.
-- Hai người bấm lưu cùng một giây cũng chỉ một lịch lọt; database tự từ chối lịch còn lại.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "appointment_staff" ADD CONSTRAINT "appointment_staff_no_overlap"
  EXCLUDE USING gist ("membership_id" WITH =, tstzrange("block_start", "block_end", '[)') WITH &&)
  WHERE ("is_blocking");
