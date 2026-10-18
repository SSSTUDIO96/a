-- CreateEnum
CREATE TYPE "RevokeReason" AS ENUM ('ROTATED', 'LOGOUT', 'REUSE_DETECTED');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "revoke_reason" "RevokeReason";

-- CreateTable
CREATE TABLE "staff_tiers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "membership_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "phone" TEXT,
    "tier_id" UUID,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "staff_pay_rates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_id" UUID,
    "service_id" UUID,
    "tier_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pay_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_tiers_organization_id_name_key" ON "staff_tiers"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_tiers_id_organization_id_key" ON "staff_tiers"("id", "organization_id");

-- CreateIndex
CREATE INDEX "staff_profiles_organization_id_tier_id_idx" ON "staff_profiles"("organization_id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_membership_id_organization_id_key" ON "staff_profiles"("membership_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pay_rates_package_id_tier_id_key" ON "staff_pay_rates"("package_id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pay_rates_service_id_tier_id_key" ON "staff_pay_rates"("service_id", "tier_id");

-- AddForeignKey
ALTER TABLE "staff_tiers" ADD CONSTRAINT "staff_tiers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_membership_id_organization_id_fkey" FOREIGN KEY ("membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_tier_id_organization_id_fkey" FOREIGN KEY ("tier_id", "organization_id") REFERENCES "staff_tiers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_package_id_organization_id_fkey" FOREIGN KEY ("package_id", "organization_id") REFERENCES "service_packages"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_service_id_organization_id_fkey" FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_tier_id_organization_id_fkey" FOREIGN KEY ("tier_id", "organization_id") REFERENCES "staff_tiers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Chốt chặn viết tay =====
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_one_owner"
  CHECK (("package_id" IS NULL) <> ("service_id" IS NULL));
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_amount" CHECK ("amount" >= 0);
-- Bản ghi cũ: thẻ đã có thẻ thay thế = thu hồi do xoay vòng; còn lại = do đăng xuất / thu hồi cả họ.
UPDATE "refresh_tokens" SET "revoke_reason" = 'ROTATED' WHERE "revoked_at" IS NOT NULL AND "replaced_by_id" IS NOT NULL;
UPDATE "refresh_tokens" SET "revoke_reason" = 'LOGOUT' WHERE "revoked_at" IS NOT NULL AND "revoke_reason" IS NULL;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_reason_when_revoked"
  CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL));
