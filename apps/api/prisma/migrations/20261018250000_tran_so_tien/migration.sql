-- Trần số tiền ở DATABASE (đề xuất của thợ O): mọi cột tiền <= 100.000.000.000 đ (100 tỷ) — cùng số với
-- MAX_MONEY_VND ở apps/api/src/lib/money.ts. Máy chủ đã chặn ở lớp kiểm dữ liệu của phần lớn đường ghi; chốt này chặn
-- mọi đường còn lại (đường chưa áp trần như số tiền dòng/tổng hợp đồng, ghi thẳng database, mã viết sau quên kiểm).
-- Đổi trần thì đổi CẢ hai nơi: money.ts và một migration mới (bài thử test/tran-tien-database.test.ts so hai số).
--
-- Phạm vi: TẤT CẢ cột BIGINT là tiền trong schema (22/22). Cột BIGINT duy nhất không chặn: stored_files.size_bytes
-- (số byte, không phải tiền). Bài thử liệt kê mọi cột BIGINT từ information_schema: thêm cột tiền mới mà quên chốt → đỏ.
-- Cột có thể trống (sale_price, per_km_amount, tier_amount của dòng hợp đồng): NULL qua CHECK như mọi CHECK của Postgres.
--
-- Cách thêm: ADD CONSTRAINT … NOT VALID rồi VALIDATE CONSTRAINT. Database thật chưa có dữ liệu vượt trần; nếu có,
-- VALIDATE báo đúng tên chốt + bảng bị vướng và cả migration huỷ (không áp dở) — dọn dữ liệu đó rồi áp lại.
-- Không đổi schema.prisma (Prisma không mô tả CHECK): `prisma migrate diff` giữa database và schema vẫn rỗng.


-- payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_cap" CHECK ("amount" <= 100000000000) NOT VALID;

-- payment_installments
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_amount_cap" CHECK ("amount" <= 100000000000) NOT VALID;

-- price_versions
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_list_price_cap" CHECK ("list_price" <= 100000000000) NOT VALID;
ALTER TABLE "price_versions" ADD CONSTRAINT "price_versions_sale_price_cap" CHECK ("sale_price" <= 100000000000) NOT VALID;

-- service_packages
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_deposit_amount_cap" CHECK ("deposit_amount" <= 100000000000) NOT VALID;

-- travel_fee_policies
ALTER TABLE "travel_fee_policies" ADD CONSTRAINT "travel_fee_policies_fixed_amount_cap" CHECK ("fixed_amount" <= 100000000000) NOT VALID;
ALTER TABLE "travel_fee_policies" ADD CONSTRAINT "travel_fee_policies_per_km_amount_cap" CHECK ("per_km_amount" <= 100000000000) NOT VALID;
ALTER TABLE "travel_fee_policies" ADD CONSTRAINT "travel_fee_policies_minimum_amount_cap" CHECK ("minimum_amount" <= 100000000000) NOT VALID;

-- travel_fee_tiers
ALTER TABLE "travel_fee_tiers" ADD CONSTRAINT "travel_fee_tiers_amount_cap" CHECK ("amount" <= 100000000000) NOT VALID;

-- staff_pay_rates
ALTER TABLE "staff_pay_rates" ADD CONSTRAINT "staff_pay_rates_amount_cap" CHECK ("amount" <= 100000000000) NOT VALID;

-- subscription_plans
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_price_monthly_cap" CHECK ("price_monthly" <= 100000000000) NOT VALID;

-- contracts
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_subtotal_cap" CHECK ("subtotal" <= 100000000000) NOT VALID;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_discount_cap" CHECK ("discount" <= 100000000000) NOT VALID;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_total_cap" CHECK ("total" <= 100000000000) NOT VALID;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_deposit_required_cap" CHECK ("deposit_required" <= 100000000000) NOT VALID;

-- contract_lines
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_unit_price_cap" CHECK ("unit_price" <= 100000000000) NOT VALID;
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_line_discount_cap" CHECK ("line_discount" <= 100000000000) NOT VALID;
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_line_total_cap" CHECK ("line_total" <= 100000000000) NOT VALID;
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_per_km_amount_cap" CHECK ("per_km_amount" <= 100000000000) NOT VALID;
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_tier_amount_cap" CHECK ("tier_amount" <= 100000000000) NOT VALID;

-- courses
ALTER TABLE "courses" ADD CONSTRAINT "courses_tuition_fee_cap" CHECK ("tuition_fee" <= 100000000000) NOT VALID;
ALTER TABLE "courses" ADD CONSTRAINT "courses_deposit_amount_cap" CHECK ("deposit_amount" <= 100000000000) NOT VALID;

-- Kiểm dữ liệu đã có (cùng transaction với phần thêm ở trên).
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_amount_cap";
ALTER TABLE "payment_installments" VALIDATE CONSTRAINT "payment_installments_amount_cap";
ALTER TABLE "price_versions" VALIDATE CONSTRAINT "price_versions_list_price_cap";
ALTER TABLE "price_versions" VALIDATE CONSTRAINT "price_versions_sale_price_cap";
ALTER TABLE "service_packages" VALIDATE CONSTRAINT "service_packages_deposit_amount_cap";
ALTER TABLE "travel_fee_policies" VALIDATE CONSTRAINT "travel_fee_policies_fixed_amount_cap";
ALTER TABLE "travel_fee_policies" VALIDATE CONSTRAINT "travel_fee_policies_per_km_amount_cap";
ALTER TABLE "travel_fee_policies" VALIDATE CONSTRAINT "travel_fee_policies_minimum_amount_cap";
ALTER TABLE "travel_fee_tiers" VALIDATE CONSTRAINT "travel_fee_tiers_amount_cap";
ALTER TABLE "staff_pay_rates" VALIDATE CONSTRAINT "staff_pay_rates_amount_cap";
ALTER TABLE "subscription_plans" VALIDATE CONSTRAINT "subscription_plans_price_monthly_cap";
ALTER TABLE "contracts" VALIDATE CONSTRAINT "contracts_subtotal_cap";
ALTER TABLE "contracts" VALIDATE CONSTRAINT "contracts_discount_cap";
ALTER TABLE "contracts" VALIDATE CONSTRAINT "contracts_total_cap";
ALTER TABLE "contracts" VALIDATE CONSTRAINT "contracts_deposit_required_cap";
ALTER TABLE "contract_lines" VALIDATE CONSTRAINT "contract_lines_unit_price_cap";
ALTER TABLE "contract_lines" VALIDATE CONSTRAINT "contract_lines_line_discount_cap";
ALTER TABLE "contract_lines" VALIDATE CONSTRAINT "contract_lines_line_total_cap";
ALTER TABLE "contract_lines" VALIDATE CONSTRAINT "contract_lines_per_km_amount_cap";
ALTER TABLE "contract_lines" VALIDATE CONSTRAINT "contract_lines_tier_amount_cap";
ALTER TABLE "courses" VALIDATE CONSTRAINT "courses_tuition_fee_cap";
ALTER TABLE "courses" VALIDATE CONSTRAINT "courses_deposit_amount_cap";
