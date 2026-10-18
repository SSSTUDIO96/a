/*
  Warnings:

  - You are about to drop the column `deposit_required` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `travel_fee` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the `appointment_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('MAIN', 'ADDON', 'SURCHARGE');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('STUDIO', 'CUSTOMER_HOME', 'OTHER');

-- CreateEnum
CREATE TYPE "TravelFeeMode" AS ENUM ('FIXED', 'PER_KM', 'MANUAL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractLineKind" AS ENUM ('PACKAGE', 'SERVICE', 'ADDON', 'SURCHARGE', 'TRAVEL', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "appointment_items" DROP CONSTRAINT "appointment_items_appointment_id_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "appointment_items" DROP CONSTRAINT "appointment_items_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "appointment_items" DROP CONSTRAINT "appointment_items_package_id_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "appointment_items" DROP CONSTRAINT "appointment_items_service_id_organization_id_fkey";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "deposit_required",
DROP COLUMN "discount",
DROP COLUMN "subtotal",
DROP COLUMN "total",
DROP COLUMN "travel_fee",
ADD COLUMN     "contract_id" UUID,
ADD COLUMN     "contract_line_id" UUID,
ADD COLUMN     "location_type" "LocationType";

-- AlterTable
ALTER TABLE "service_packages" ADD COLUMN     "location_types" "LocationType"[],
ADD COLUMN     "subject_id" UUID;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "kind" "ServiceKind" NOT NULL DEFAULT 'MAIN';

-- DropTable
DROP TABLE "appointment_items";

-- CreateTable
CREATE TABLE "makeup_subjects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "makeup_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "studio_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_fee_policies" (
    "organization_id" UUID NOT NULL,
    "default_mode" "TravelFeeMode" NOT NULL DEFAULT 'MANUAL',
    "fixed_amount" BIGINT NOT NULL DEFAULT 0,
    "per_km_amount" BIGINT NOT NULL DEFAULT 0,
    "free_km" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "minimum_amount" BIGINT NOT NULL DEFAULT 0,
    "round_trip" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "travel_fee_policies_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "event_date" TIMESTAMPTZ(3),
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "deposit_required" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "cancel_reason" TEXT,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "parent_line_id" UUID,
    "kind" "ContractLineKind" NOT NULL,
    "service_id" UUID,
    "package_id" UUID,
    "price_version_id" UUID,
    "subject_id" UUID,
    "subject_name" TEXT,
    "name" TEXT NOT NULL,
    "location_type" "LocationType",
    "studio_location_id" UUID,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "scheduled_start" TIMESTAMPTZ(3),
    "scheduled_end" TIMESTAMPTZ(3),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL,
    "line_discount" BIGINT NOT NULL DEFAULT 0,
    "line_total" BIGINT NOT NULL,
    "travel_mode" "TravelFeeMode",
    "distance_km" DECIMAL(7,2),
    "per_km_amount" BIGINT,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "added_after_confirm" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "makeup_subjects_organization_id_name_key" ON "makeup_subjects"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "makeup_subjects_id_organization_id_key" ON "makeup_subjects"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "studio_locations_id_organization_id_key" ON "studio_locations"("id", "organization_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_event_date_idx" ON "contracts"("organization_id", "event_date");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organization_id_code_key" ON "contracts"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_id_organization_id_key" ON "contracts"("id", "organization_id");

-- CreateIndex
CREATE INDEX "contract_lines_contract_id_idx" ON "contract_lines"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_lines_id_organization_id_key" ON "contract_lines"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_subject_id_organization_id_fkey" FOREIGN KEY ("subject_id", "organization_id") REFERENCES "makeup_subjects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contract_line_id_organization_id_fkey" FOREIGN KEY ("contract_line_id", "organization_id") REFERENCES "contract_lines"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "makeup_subjects" ADD CONSTRAINT "makeup_subjects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_locations" ADD CONSTRAINT "studio_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_fee_policies" ADD CONSTRAINT "travel_fee_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_organization_id_fkey" FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_contract_id_organization_id_fkey" FOREIGN KEY ("contract_id", "organization_id") REFERENCES "contracts"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_parent_line_id_organization_id_fkey" FOREIGN KEY ("parent_line_id", "organization_id") REFERENCES "contract_lines"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_service_id_organization_id_fkey" FOREIGN KEY ("service_id", "organization_id") REFERENCES "services"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_package_id_organization_id_fkey" FOREIGN KEY ("package_id", "organization_id") REFERENCES "service_packages"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_subject_id_organization_id_fkey" FOREIGN KEY ("subject_id", "organization_id") REFERENCES "makeup_subjects"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_studio_location_id_organization_id_fkey" FOREIGN KEY ("studio_location_id", "organization_id") REFERENCES "studio_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Chốt chặn viết tay =====

ALTER TABLE "travel_fee_policies" ADD CONSTRAINT "travel_policy_amounts"
  CHECK ("fixed_amount" >= 0 AND "per_km_amount" >= 0 AND "minimum_amount" >= 0 AND "free_km" >= 0);

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_money"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "deposit_required" >= 0
         AND "total" = "subtotal" - "discount" AND "deposit_required" <= "total");
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_cancel_reason"
  CHECK ("status" <> 'CANCELLED' OR "cancel_reason" IS NOT NULL);

ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_money"
  CHECK ("quantity" >= 1 AND "unit_price" >= 0 AND "line_discount" >= 0
         AND "line_total" = "unit_price" * "quantity" - "line_discount" AND "line_total" >= 0);
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_one_ref"
  CHECK (NOT ("service_id" IS NOT NULL AND "package_id" IS NOT NULL));
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_kind_ref" CHECK (
  ("kind" = 'PACKAGE' AND "package_id" IS NOT NULL)
  OR ("kind" IN ('SERVICE', 'ADDON', 'SURCHARGE') AND "package_id" IS NULL)
  OR ("kind" IN ('TRAVEL', 'CUSTOM') AND "service_id" IS NULL AND "package_id" IS NULL)
);
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_travel_fields"
  CHECK ("kind" = 'TRAVEL' OR ("travel_mode" IS NULL AND "distance_km" IS NULL AND "per_km_amount" IS NULL));
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_void_reason"
  CHECK ("voided_at" IS NULL OR "void_reason" IS NOT NULL);
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_schedule_order"
  CHECK ("scheduled_start" IS NULL OR "scheduled_end" IS NULL OR "scheduled_end" > "scheduled_start");

-- Mỗi tổ chức tối đa một studio mặc định.
CREATE UNIQUE INDEX "studio_locations_one_default" ON "studio_locations" ("organization_id") WHERE "is_default";
