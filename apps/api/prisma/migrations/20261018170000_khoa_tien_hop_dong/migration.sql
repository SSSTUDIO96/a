-- Chốt chặn tiền hợp đồng ở database (biên bản nghiệm thu lát 1, lỗi N3):
-- trước đây chỉ bảng dòng bị khoá; tổng tiền và trạng thái hợp đồng vẫn sửa thẳng được.

-- 1. Hợp đồng đã rời trạng thái nháp: không lùi về nháp; trạng thái cuối không đổi gì nữa;
--    khách, ngày, điều khoản không đổi; giảm giá và cọc chỉ được HẠ (do huỷ dòng).
CREATE FUNCTION contracts_lock_after_confirm() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'DRAFT' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Hợp đồng đã kết thúc: không được thay đổi';
  END IF;
  IF NEW.status = 'DRAFT' THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: không được đưa về nháp';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.terms IS DISTINCT FROM OLD.terms
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: không được đổi khách, ngày, điều khoản';
  END IF;
  IF NEW.discount > OLD.discount OR NEW.deposit_required > OLD.deposit_required THEN
    RAISE EXCEPTION 'Hợp đồng đã xác nhận: giảm giá và tiền cọc chỉ được hạ';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contracts_locked BEFORE UPDATE ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION contracts_lock_after_confirm();

-- 2. Tổng tiền luôn khớp các dòng: kiểm LÚC LƯU (trì hoãn tới cuối transaction), nên máy chủ được thêm dòng
--    rồi mới cập nhật tổng trong cùng transaction; ai sửa một bên mà quên bên kia → cả transaction bị từ chối.
CREATE FUNCTION contract_totals_consistent() RETURNS trigger AS $$
DECLARE cid uuid; sub bigint; lines_sum bigint;
BEGIN
  IF TG_TABLE_NAME = 'contracts' THEN
    cid := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    cid := OLD.contract_id;
  ELSE
    cid := NEW.contract_id;
  END IF;
  SELECT subtotal INTO sub FROM contracts WHERE id = cid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(SUM(line_total), 0) INTO lines_sum FROM contract_lines WHERE contract_id = cid AND voided_at IS NULL;
  IF sub <> lines_sum THEN
    RAISE EXCEPTION 'Tổng tiền hợp đồng (%) không khớp tổng các dòng (%)', sub, lines_sum;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER contracts_totals_check AFTER INSERT OR UPDATE ON "contracts"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION contract_totals_consistent();
CREATE CONSTRAINT TRIGGER contract_lines_totals_check AFTER INSERT OR UPDATE OR DELETE ON "contract_lines"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION contract_totals_consistent();
