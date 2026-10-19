-- Cổng học viên (bản vẽ E: docs/rnd/BAN-VE-E-CONG-HOC-VIEN-PWA.md). Chìa, thẻ phiên, mã chuyển máy CHỈ lưu sha256.
-- Mọi CHECK có cột cho phép NULL đã viết rõ IS NULL / IS NOT NULL ở từng vế (sổ lỗi mục 24).

CREATE TYPE "PortalLinkRevokeReason" AS ENUM ('REPLACED', 'REVOKED');
CREATE TYPE "PortalDeviceEndReason" AS ENUM ('SIGNED_OUT', 'BLOCKED', 'LINK_REVOKED');

-- ===== Đường dẫn =====
CREATE TABLE "portal_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Hạn cho đường dẫn CHƯA mở máy nào (created_at + 7 ngày). Đã mở thì cột này không còn xét.
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "first_opened_at" TIMESTAMPTZ(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" "PortalLinkRevokeReason",
    "revoked_by_id" UUID,

    CONSTRAINT "portal_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "portal_links_key_hash_sha256" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "portal_links_expires_after_created" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "portal_links_opened_after_created" CHECK ("first_opened_at" IS NULL OR "first_opened_at" >= "created_at"),
    CONSTRAINT "portal_links_failed_range" CHECK ("failed_attempts" >= 0 AND "failed_attempts" <= 5),
    -- Khoá khi và chỉ khi đã sai đủ 5 lần (mọi toán hạng NOT NULL hoặc là IS [NOT] NULL — không có vế ra NULL).
    CONSTRAINT "portal_links_lock_pair" CHECK (
        ("locked_at" IS NULL AND "failed_attempts" < 5) OR ("locked_at" IS NOT NULL AND "failed_attempts" = 5)
    ),
    CONSTRAINT "portal_links_revoke_pair" CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL)),
    CONSTRAINT "portal_links_revoked_by_needs_revoked" CHECK ("revoked_by_id" IS NULL OR "revoked_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "portal_links_key_hash_key" ON "portal_links"("key_hash");
CREATE UNIQUE INDEX "portal_links_id_organization_id_key" ON "portal_links"("id", "organization_id");
CREATE UNIQUE INDEX "portal_links_id_customer_id_key" ON "portal_links"("id", "customer_id");
CREATE INDEX "portal_links_organization_id_customer_id_created_at_idx" ON "portal_links"("organization_id", "customer_id", "created_at");
-- Mỗi học viên tối đa MỘT đường dẫn chưa thu hồi. Chỉ mục có điều kiện: Prisma không ghi được (chú thích ở model).
CREATE UNIQUE INDEX "portal_links_one_live_per_customer" ON "portal_links"("customer_id") WHERE "revoked_at" IS NULL;

ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_customer_id_organization_id_fkey"
    FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_revoked_by_id_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Không đổi chủ / chìa, không gỡ thu hồi, không gỡ khoá.
CREATE FUNCTION portal_links_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" <> OLD."organization_id" OR NEW."customer_id" <> OLD."customer_id" OR NEW."key_hash" <> OLD."key_hash" THEN
    RAISE EXCEPTION 'Không đổi được học viên hoặc chìa của đường dẫn cổng' USING ERRCODE = '23514';
  END IF;
  IF OLD."revoked_at" IS NOT NULL AND NEW."revoked_at" IS NULL THEN
    RAISE EXCEPTION 'Đường dẫn đã thu hồi không mở lại được' USING ERRCODE = '23514';
  END IF;
  IF OLD."locked_at" IS NOT NULL AND NEW."locked_at" IS NULL THEN
    RAISE EXCEPTION 'Đường dẫn đã khoá không mở khoá được' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_links_guard BEFORE UPDATE ON "portal_links" FOR EACH ROW EXECUTE FUNCTION portal_links_guard();

-- ===== Máy đã mở =====
CREATE TABLE "portal_devices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    -- Tên máy do MÁY CHỦ đọc từ User-Agent ("iPhone · Safari"), không nhận từ máy khách.
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" "PortalDeviceEndReason",
    "ended_by_id" UUID,
    "end_note" TEXT,
    "handoff_hash" TEXT,
    "handoff_expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "portal_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "portal_devices_label_len" CHECK (char_length("label") BETWEEN 1 AND 80),
    CONSTRAINT "portal_devices_end_pair" CHECK (("ended_at" IS NULL) = ("end_reason" IS NULL)),
    -- Chặn / thu hồi phải có người làm; tự thoát thì không có.
    CONSTRAINT "portal_devices_staff_end_has_actor" CHECK (
        "end_reason" IS NULL OR "end_reason" = 'SIGNED_OUT' OR "ended_by_id" IS NOT NULL
    ),
    -- Bẫy sổ lỗi 24: "ended_by_id IS NULL OR end_reason <> 'SIGNED_OUT'" sẽ cho qua khi end_reason NULL → viết rõ IS NOT NULL.
    CONSTRAINT "portal_devices_actor_only_staff_end" CHECK (
        "ended_by_id" IS NULL OR ("end_reason" IS NOT NULL AND "end_reason" <> 'SIGNED_OUT')
    ),
    CONSTRAINT "portal_devices_note_only_ended" CHECK (
        "end_note" IS NULL OR ("ended_at" IS NOT NULL AND char_length("end_note") <= 200)
    ),
    CONSTRAINT "portal_devices_handoff_pair" CHECK (("handoff_hash" IS NULL) = ("handoff_expires_at" IS NULL)),
    CONSTRAINT "portal_devices_handoff_sha256" CHECK ("handoff_hash" IS NULL OR "handoff_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "portal_devices_handoff_only_live" CHECK ("handoff_hash" IS NULL OR "ended_at" IS NULL)
);

CREATE UNIQUE INDEX "portal_devices_id_organization_id_key" ON "portal_devices"("id", "organization_id");
CREATE UNIQUE INDEX "portal_devices_id_customer_id_key" ON "portal_devices"("id", "customer_id");
CREATE INDEX "portal_devices_link_id_idx" ON "portal_devices"("link_id");
CREATE INDEX "portal_devices_organization_id_customer_id_created_at_idx" ON "portal_devices"("organization_id", "customer_id", "created_at");

ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_customer_id_organization_id_fkey"
    FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_link_id_organization_id_fkey"
    FOREIGN KEY ("link_id", "organization_id") REFERENCES "portal_links"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Máy phải thuộc ĐÚNG học viên của đường dẫn (database tự chặn).
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_link_id_customer_id_fkey"
    FOREIGN KEY ("link_id", "customer_id") REFERENCES "portal_links"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_devices" ADD CONSTRAINT "portal_devices_ended_by_id_fkey"
    FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lưới cuối: tối đa 2 máy mỗi đường dẫn. Khoá dòng đường dẫn trước khi đếm để hai lần mở đồng thời xếp hàng.
CREATE FUNCTION portal_devices_max_per_link() RETURNS trigger AS $$
DECLARE n INTEGER;
BEGIN
  PERFORM 1 FROM "portal_links" WHERE "id" = NEW."link_id" FOR UPDATE;
  SELECT count(*) INTO n FROM "portal_devices" WHERE "link_id" = NEW."link_id";
  IF n >= 2 THEN
    RAISE EXCEPTION 'Mỗi đường dẫn cổng học viên mở tối đa 2 máy' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_devices_max_per_link BEFORE INSERT ON "portal_devices" FOR EACH ROW EXECUTE FUNCTION portal_devices_max_per_link();

-- Không đổi chủ / đường dẫn; máy đã kết thúc không sống lại.
CREATE FUNCTION portal_devices_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" <> OLD."organization_id" OR NEW."customer_id" <> OLD."customer_id" OR NEW."link_id" <> OLD."link_id" THEN
    RAISE EXCEPTION 'Không đổi được học viên hoặc đường dẫn của máy' USING ERRCODE = '23514';
  END IF;
  IF OLD."ended_at" IS NOT NULL AND NEW."ended_at" IS NULL THEN
    RAISE EXCEPTION 'Máy đã chặn / đã thoát không mở lại được' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_devices_guard BEFORE UPDATE ON "portal_devices" FOR EACH ROW EXECUTE FUNCTION portal_devices_guard();

-- ===== Phiên =====
CREATE TABLE "portal_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "portal_sessions_token_hash_sha256" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "portal_sessions_expires_after_created" CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX "portal_sessions_token_hash_key" ON "portal_sessions"("token_hash");
CREATE INDEX "portal_sessions_device_id_idx" ON "portal_sessions"("device_id");

ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_customer_id_organization_id_fkey"
    FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_device_id_organization_id_fkey"
    FOREIGN KEY ("device_id", "organization_id") REFERENCES "portal_devices"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_device_id_customer_id_fkey"
    FOREIGN KEY ("device_id", "customer_id") REFERENCES "portal_devices"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Không tạo phiên cho máy đã kết thúc; phiên đã thu hồi không sống lại; không đổi chủ / máy / thẻ.
CREATE FUNCTION portal_sessions_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "portal_devices" WHERE "id" = NEW."device_id" AND "ended_at" IS NOT NULL) THEN
      RAISE EXCEPTION 'Máy đã chặn / đã thoát' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."device_id" <> OLD."device_id" OR NEW."customer_id" <> OLD."customer_id"
     OR NEW."organization_id" <> OLD."organization_id" OR NEW."token_hash" <> OLD."token_hash" THEN
    RAISE EXCEPTION 'Không đổi được chủ của phiên cổng' USING ERRCODE = '23514';
  END IF;
  IF OLD."revoked_at" IS NOT NULL AND NEW."revoked_at" IS NULL THEN
    RAISE EXCEPTION 'Phiên đã thu hồi không mở lại được' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER portal_sessions_guard BEFORE INSERT OR UPDATE ON "portal_sessions" FOR EACH ROW EXECUTE FUNCTION portal_sessions_guard();

-- ===== Cài đặt cổng (số tài khoản) — bảng RIÊNG, không nằm trong hồ sơ thương hiệu công khai =====
CREATE TABLE "portal_settings" (
    "organization_id" UUID NOT NULL,
    "bank_name" TEXT,
    -- Chỉ chữ số (web hiện cách nhóm 4 số).
    "bank_account_no" TEXT,
    "bank_account_name" TEXT,
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "portal_settings_pkey" PRIMARY KEY ("organization_id"),
    CONSTRAINT "portal_settings_bank_all_or_none" CHECK (
        ("bank_name" IS NULL) = ("bank_account_no" IS NULL) AND ("bank_account_no" IS NULL) = ("bank_account_name" IS NULL)
    ),
    CONSTRAINT "portal_settings_account_no_digits" CHECK ("bank_account_no" IS NULL OR "bank_account_no" ~ '^[0-9]{6,20}$'),
    CONSTRAINT "portal_settings_bank_name_len" CHECK ("bank_name" IS NULL OR char_length("bank_name") BETWEEN 2 AND 80),
    CONSTRAINT "portal_settings_account_name_len" CHECK ("bank_account_name" IS NULL OR char_length("bank_account_name") BETWEEN 2 AND 80)
);

ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
