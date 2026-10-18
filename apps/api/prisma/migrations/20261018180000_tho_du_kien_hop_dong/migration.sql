-- CreateTable
CREATE TABLE "contract_line_staff" (
    "organization_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'PRIMARY',

    CONSTRAINT "contract_line_staff_pkey" PRIMARY KEY ("line_id","membership_id")
);

-- CreateIndex
CREATE INDEX "contract_line_staff_membership_id_idx" ON "contract_line_staff"("membership_id");

-- AddForeignKey
ALTER TABLE "contract_line_staff" ADD CONSTRAINT "contract_line_staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_line_staff" ADD CONSTRAINT "contract_line_staff_line_id_organization_id_fkey" FOREIGN KEY ("line_id", "organization_id") REFERENCES "contract_lines"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_line_staff" ADD CONSTRAINT "contract_line_staff_membership_id_organization_id_fkey" FOREIGN KEY ("membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== Chốt chặn viết tay =====
-- Tối đa một thợ chính mỗi dòng.
CREATE UNIQUE INDEX "contract_line_staff_one_primary" ON "contract_line_staff" ("line_id") WHERE "role" = 'PRIMARY';

-- Hợp đồng đã xác nhận: thợ dự kiến không sửa nữa (đổi thợ làm trên lịch).
-- Ngoại lệ: dòng phát sinh sau xác nhận được gán thợ lúc thêm dòng.
CREATE FUNCTION contract_line_staff_lock() RETURNS trigger AS $$
DECLARE st "ContractStatus"; after_confirm boolean;
BEGIN
  SELECT c.status, l.added_after_confirm INTO st, after_confirm
    FROM contract_lines l JOIN contracts c ON c.id = l.contract_id
    WHERE l.id = COALESCE(NEW.line_id, OLD.line_id);
  IF st IS NULL OR st = 'DRAFT' OR (TG_OP = 'INSERT' AND after_confirm) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Hợp đồng đã xác nhận: đổi thợ ở màn Lịch, không sửa thợ dự kiến của dòng';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contract_line_staff_locked BEFORE INSERT OR UPDATE OR DELETE ON "contract_line_staff"
  FOR EACH ROW EXECUTE FUNCTION contract_line_staff_lock();
