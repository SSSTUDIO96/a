-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('STAFF_AVATAR', 'CUSTOMER_AVATAR', 'ORG_LOGO', 'ALBUM_IMAGE', 'COURSE_RESOURCE', 'SUBMISSION', 'WELCOME_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADING', 'READY', 'DELETED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('RECEIPT', 'REFUND');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TravelFeeMode" ADD VALUE 'TIERED';

-- AlterTable
ALTER TABLE "service_packages" ADD COLUMN     "included_km" DECIMAL(7,2);

-- CreateTable
CREATE TABLE "travel_fee_tiers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "from_km" DECIMAL(7,2) NOT NULL,
    "to_km" DECIMAL(7,2),
    "amount" BIGINT NOT NULL,

    CONSTRAINT "travel_fee_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADING',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_installments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "due_date" TIMESTAMPTZ(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "is_deposit" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL DEFAULT 'RECEIPT',
    "method" "PaymentMethod" NOT NULL,
    "amount" BIGINT NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" BIGINT NOT NULL,
    "max_staff" INTEGER,
    "max_appointments_per_month" INTEGER,
    "max_storage_mb" INTEGER,
    "max_students" INTEGER,
    "max_courses" INTEGER,
    "custom_domain" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "travel_fee_tiers_organization_id_from_km_key" ON "travel_fee_tiers"("organization_id", "from_km");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

-- CreateIndex
CREATE INDEX "stored_files_organization_id_purpose_idx" ON "stored_files"("organization_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_id_organization_id_key" ON "stored_files"("id", "organization_id");

-- CreateIndex
CREATE INDEX "payment_installments_contract_id_idx" ON "payment_installments"("contract_id");

-- CreateIndex
CREATE INDEX "payments_contract_id_idx" ON "payments"("contract_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_received_at_idx" ON "payments"("organization_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_code_key" ON "payments"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE INDEX "organization_subscriptions_organization_id_starts_at_idx" ON "organization_subscriptions"("organization_id", "starts_at");

-- AddForeignKey
ALTER TABLE "travel_fee_tiers" ADD CONSTRAINT "travel_fee_tiers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "travel_fee_policies"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== Chốt chặn viết tay =====
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_size" CHECK ("size_bytes" >= 0);
ALTER TABLE "service_packages" ADD CONSTRAINT "packages_included_km" CHECK ("included_km" IS NULL OR "included_km" >= 0);

ALTER TABLE "payment_installments" ADD CONSTRAINT "installments_amount" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_void_reason" CHECK ("voided_at" IS NULL OR "void_reason" IS NOT NULL);

-- Phiếu thu chỉ ghi thêm: không xoá; chỉ được huỷ MỘT lần (đặt voided_at + void_reason), không sửa gì khác.
CREATE FUNCTION payments_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Phiếu thu không được xoá (huỷ phiếu có lý do)';
  END IF;
  IF OLD.voided_at IS NOT NULL
     OR (to_jsonb(NEW) - 'voided_at' - 'void_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'voided_at' - 'void_reason') THEN
    RAISE EXCEPTION 'Phiếu thu đã ghi không được sửa (chỉ huỷ phiếu có lý do)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER payments_locked BEFORE UPDATE OR DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION payments_append_only();

ALTER TABLE "subscription_plans" ADD CONSTRAINT "plans_numbers" CHECK (
  "price_monthly" >= 0 AND COALESCE("max_staff", 0) >= 0 AND COALESCE("max_appointments_per_month", 0) >= 0
  AND COALESCE("max_storage_mb", 0) >= 0 AND COALESCE("max_students", 0) >= 0 AND COALESCE("max_courses", 0) >= 0);
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "subscriptions_period" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

-- Bậc phí di chuyển: số hợp lệ và KHÔNG chồng nhau trong cùng tổ chức.
ALTER TABLE "travel_fee_tiers" ADD CONSTRAINT "travel_tiers_numbers"
  CHECK ("from_km" >= 0 AND ("to_km" IS NULL OR "to_km" > "from_km") AND "amount" >= 0);
ALTER TABLE "travel_fee_tiers" ADD CONSTRAINT "travel_tiers_no_overlap"
  EXCLUDE USING gist ("organization_id" WITH =, numrange("from_km", "to_km", '[)') WITH &&);
