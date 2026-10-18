-- Chụp số liệu phí di chuyển vào dòng TRAVEL lúc lưu (phiếu vướng của thợ D và thợ màn Hợp đồng W5):
-- hợp đồng đã lưu / đã xác nhận dựng lại được dòng công thức km mà không phải tính lại theo cài đặt hiện hành
-- (cài đặt phí di chuyển, bán kính của gói có thể đã đổi sau đó).
-- Dữ liệu cũ: dòng TRAVEL có từ trước để NULL — không đoán lại (cài đặt lúc đó không còn). Số tiền của dòng cũ đã lưu
-- sẵn (line_total, per_km_amount, distance_km) nên KHÔNG phải nhập lại; chỉ thiếu dòng công thức (travelBreakdown = null).

-- AlterTable
ALTER TABLE "contract_lines" ADD COLUMN     "charged_km" DECIMAL(8,2),
ADD COLUMN     "excess_km" DECIMAL(7,2),
ADD COLUMN     "included_from" TEXT,
ADD COLUMN     "included_km" DECIMAL(7,2),
ADD COLUMN     "round_trip" BOOLEAN,
ADD COLUMN     "tier_amount" BIGINT,
ADD COLUMN     "tier_from_km" DECIMAL(7,2),
ADD COLUMN     "tier_to_km" DECIMAL(7,2);

-- ===== Chốt chặn viết tay =====
-- Chỉ dòng TRAVEL mới có số liệu phí di chuyển đã chụp.
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_travel_snapshot_only_travel" CHECK (
  "kind" = 'TRAVEL'
  OR ("included_km" IS NULL AND "included_from" IS NULL AND "excess_km" IS NULL AND "charged_km" IS NULL
      AND "round_trip" IS NULL AND "tier_from_km" IS NULL AND "tier_to_km" IS NULL AND "tier_amount" IS NULL)
);
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_travel_snapshot_values" CHECK (
  ("included_km" IS NULL OR "included_km" >= 0)
  AND ("excess_km" IS NULL OR "excess_km" >= 0)
  AND ("charged_km" IS NULL OR "charged_km" >= 0)
  AND ("included_from" IS NULL OR ("included_from" IN ('PACKAGE', 'ORGANIZATION') AND "included_km" IS NOT NULL))
  -- Bậc đã áp: có km bắt đầu thì có số tiền (và ngược lại); km kết thúc trống = bậc mở ("từ X km trở lên").
  AND (("tier_from_km" IS NULL) = ("tier_amount" IS NULL))
  AND ("tier_to_km" IS NULL OR ("tier_from_km" IS NOT NULL AND "tier_to_km" > "tier_from_km"))
  AND ("tier_from_km" IS NULL OR "tier_from_km" >= 0)
  AND ("tier_amount" IS NULL OR "tier_amount" >= 0)
);
-- Khoá dòng sau xác nhận (contract_lines_lock_after_confirm, migration 20261018160000) so to_jsonb(NEW) với to_jsonb(OLD)
-- trừ voided_at / void_reason, nên các cột mới tự nằm trong diện "không được sửa sau xác nhận" — không phải sửa trigger.
