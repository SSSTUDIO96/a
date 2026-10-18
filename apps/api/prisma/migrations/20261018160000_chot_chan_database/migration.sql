-- DropForeignKey
ALTER TABLE "appointment_staff" DROP CONSTRAINT "appointment_staff_appointment_id_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "appointment_status_history" DROP CONSTRAINT "appointment_status_history_appointment_id_organization_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "contract_lines_id_contract_id_key" ON "contract_lines"("id", "contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_versions_id_organization_id_key" ON "price_versions"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contract_line_id_contract_id_fkey" FOREIGN KEY ("contract_line_id", "contract_id") REFERENCES "contract_lines"("id", "contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_staff" ADD CONSTRAINT "appointment_staff_appointment_id_organization_id_fkey" FOREIGN KEY ("appointment_id", "organization_id") REFERENCES "appointments"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_organization_id_fkey" FOREIGN KEY ("appointment_id", "organization_id") REFERENCES "appointments"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_price_version_id_organization_id_fkey" FOREIGN KEY ("price_version_id", "organization_id") REFERENCES "price_versions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== Chốt chặn viết tay (phát hiện của thợ tài liệu, 18/10/2026) =====

-- Khoá ngoại kép (contract_line_id, contract_id) không kiểm khi contract_id rỗng → bắt buộc có hợp đồng khi có dòng.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_line_needs_contract"
  CHECK ("contract_line_id" IS NULL OR "contract_id" IS NOT NULL);

-- KHOẢNG BẬN DO DATABASE TỰ TÍNH (trước đây máy chủ tính rồi chép vào — đường sửa nào quên tính lại là lọt trùng).
-- Luật "trạng thái nào chiếm giờ" phải khớp isBlockingStatus() ở packages/shared/src/schedule.ts
-- (bài thử test/db-guards.test.ts so khớp từng trạng thái).
CREATE FUNCTION appointment_is_blocking(s "WorkStatus") RETURNS boolean AS $$
  SELECT s NOT IN ('DRAFT', 'CANCELLED', 'NO_SHOW');
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION appointment_staff_fill_block() RETURNS trigger AS $$
DECLARE a RECORD;
BEGIN
  SELECT starts_at, ends_at, travel_before_min, travel_after_min, status INTO a
    FROM appointments WHERE id = NEW.appointment_id AND organization_id = NEW.organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy lịch % để phân thợ', NEW.appointment_id;
  END IF;
  NEW.block_start := a.starts_at - make_interval(mins => a.travel_before_min);
  NEW.block_end := a.ends_at + make_interval(mins => a.travel_after_min);
  NEW.is_blocking := appointment_is_blocking(a.status);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_staff_block BEFORE INSERT OR UPDATE ON "appointment_staff"
  FOR EACH ROW EXECUTE FUNCTION appointment_staff_fill_block();

CREATE FUNCTION appointments_sync_staff_block() RETURNS trigger AS $$
BEGIN
  -- Cập nhật giả để trigger appointment_staff_block tính lại từ dòng lịch mới.
  UPDATE appointment_staff SET block_start = block_start WHERE appointment_id = NEW.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_staff_block_sync
  AFTER UPDATE OF starts_at, ends_at, travel_before_min, travel_after_min, status ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION appointments_sync_staff_block();

-- Lịch sử trạng thái lịch chỉ ghi thêm.
CREATE FUNCTION status_history_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'appointment_status_history chỉ được ghi thêm, không được %', TG_OP;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER appointment_status_history_append_only BEFORE UPDATE OR DELETE ON "appointment_status_history"
  FOR EACH ROW EXECUTE FUNCTION status_history_block_mutation();

-- DÒNG HỢP ĐỒNG ĐÃ XÁC NHẬN: không xoá; chỉ được đổi hai cột huỷ dòng (voided_at, void_reason), và chỉ từ chưa huỷ → đã huỷ.
CREATE FUNCTION contract_lines_lock_after_confirm() RETURNS trigger AS $$
DECLARE st "ContractStatus";
BEGIN
  SELECT status INTO st FROM contracts WHERE id = OLD.contract_id;
  IF st = 'DRAFT' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: không được xoá dòng (chỉ huỷ dòng có lý do)';
  END IF;
  IF OLD.voided_at IS NOT NULL
     OR (to_jsonb(NEW) - 'voided_at' - 'void_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'voided_at' - 'void_reason') THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: dòng đã chốt không được sửa (chỉ huỷ dòng có lý do hoặc thêm dòng phát sinh)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contract_lines_locked BEFORE UPDATE OR DELETE ON "contract_lines"
  FOR EACH ROW EXECUTE FUNCTION contract_lines_lock_after_confirm();
