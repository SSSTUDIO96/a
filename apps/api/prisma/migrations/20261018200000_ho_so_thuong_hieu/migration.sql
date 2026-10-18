-- CreateTable
CREATE TABLE "organization_profiles" (
    "organization_id" UUID NOT NULL,
    "brand_name" TEXT NOT NULL,
    "tagline" TEXT,
    "bio" TEXT,
    "experience" TEXT,
    "styles" TEXT[],
    "service_area" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "zalo" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "website" TEXT,
    "logo_file_id" UUID,
    "avatar_file_id" UUID,
    "cover_file_id" UUID,
    "working_hours" JSONB NOT NULL DEFAULT '[]',
    "booking_policy" TEXT,
    "cancellation_policy" TEXT,
    "deposit_policy" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("organization_id")
);

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_logo_file_id_organization_id_fkey" FOREIGN KEY ("logo_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_avatar_file_id_organization_id_fkey" FOREIGN KEY ("avatar_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_cover_file_id_organization_id_fkey" FOREIGN KEY ("cover_file_id", "organization_id") REFERENCES "stored_files"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

