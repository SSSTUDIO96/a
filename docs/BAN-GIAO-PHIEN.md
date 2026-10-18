# Bàn giao phiên — đọc tệp này đầu tiên khi mở phiên mới

Cập nhật: 18/10/2026. Kho: `SSSTUDIO96/a`, nhánh `claude/nen-mong-makeup`.

## Câu mở đầu để dán vào phiên mới
> Đây là dự án Makeup Pro trong kho SSSTUDIO96/a, nhánh claude/nen-mong-makeup. Trước khi làm gì, đọc theo thứ tự: docs/BAN-GIAO-PHIEN.md, docs/SO-Y-MUON.md, docs/NHAT-KY-QUYET-DINH-THAY.md, docs/SO-LOI-DA-DO.md, docs/rnd/BAN-VE-C.md (mục 7 và 9), docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-LAT-1.md. Sau đó trả phiếu nhận việc cho bước tiếp theo ghi ở mục "Bước tiếp" của BAN-GIAO-PHIEN.md.

## Cách dựng lại môi trường trên máy đám mây mới
1. `pnpm install` ở gốc kho. Bước này tự chạy `prisma generate`.
2. PostgreSQL 16: `service postgresql start`. Tạo vai trò và database thử:
   - `su postgres -c "psql -c \"create role makeup login password 'makeup_local' createdb\""`
   - `su postgres -c "createdb -O makeup makeup_test"`
   - `su postgres -c "psql -d makeup_test -c 'create extension btree_gist'"`
3. `pnpm test` ở gốc kho. Lệnh này kiểm tra kiểu và chạy bài thử của packages/shared, apps/api, apps/web. Bài thử máy chủ tự áp migration, không xoá dữ liệu.
4. Muốn chạy máy chủ thử: chép `apps/api/.env.example` thành `apps/api/.env`, điền giá trị cho máy thử, rồi `pnpm --filter @makeup/api dev`.

## Đã xong và đã nghiệm thu (thợ chấm độc lập)
| Phần | Kết luận | Biên bản |
|---|---|---|
| Mốc 2: nền móng (đăng nhập, tổ chức, phân quyền, nhật ký) | Chấm lại: ĐẠT CÓ ĐIỀU KIỆN. Điều kiện: T3, N4. | `docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-MOC-2.md`, `docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-LAT-1.md` (phần 1) |
| Máy chủ lát 1: bảng giá v2, khách + lịch, hợp đồng, bậc lương | ĐẠT CÓ ĐIỀU KIỆN | `docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-LAT-1.md` (phần 2) |

## Lỗi sau nghiệm thu lát 1: tình trạng
| Mã | Việc | Ai | Tình trạng |
|---|---|---|---|
| T1 | Chống gửi trùng so đường dẫn thật | điều phối | Đã sửa, có bài thử, đã phá thử (đỏ 2 bài) |
| T2 | Quản lý tự nâng bậc lương | thợ B | Đã sửa, lưu kho db67ade |
| T3 | Cửa gác mù với mã tổ chức khác trong thân/tham số lọc | điều phối | Đã sửa: crossRef 42/42, 3 đột biến mới bị bắt (db67ade) |
| N1 | Dòng có địa chỉ mà không chọn loại địa điểm | thợ D | Đã sửa (db67ade) |
| N2 | Thợ tắt nhận lịch vẫn bị xếp | thợ B | Đã sửa |
| N3 | Khoá tiền hợp đồng ở database | điều phối | Đã sửa (migration `20261018170000_khoa_tien_hop_dong`) |
| N4 | Tài liệu chậm hơn mã | thợ C | Chưa giao. Giao sau cùng. |
| G1 | Huỷ hợp đồng thì huỷ lịch đã gắn | B + D | Đã sửa (db67ade) |
| G2 | Quyền `contracts.adjust` | thợ D | Đã sửa (db67ade) |
| G3 | Kế toán chỉ xem tiền công | điều phối | Đã sửa |
| G5 | Ẩn số điện thoại thợ | thợ B | Đã sửa |

## Web (apps/web) — phương án C, bản vẽ `docs/rnd/BAN-VE-C.md`
| Gói | Tình trạng |
|---|---|
| Móng + lõi W1 (thợ E) | Xong: 32/32 bài thử, E2E luồng phiên |
| W1 phần còn lại (types, catalog, contracts, schedule, staff, useQuote) | Xong (db67ade). Đang thêm api.put, lỗi theo đường dẫn lồng. |
| W2 (token, phông, component) | Thợ F đang làm |
| W3 khung → W4 Bảng giá, W5 Hợp đồng, W6 Lịch (3 chế độ, mặc định C) → W7 kiểm thử 3 khổ | Chưa bắt đầu |

## Việc đang chạy (cập nhật 18:05)
| Thợ | Việc | Tệp |
|---|---|---|
| A | Bán kính gói + bảng bậc phí di chuyển | modules/catalog |
| B | Lưu trữ tệp (StorageDriver, ký URL, ảnh đại diện thợ) | modules/files, lib/storage, modules/staff |
| D | Gán thợ cho dòng hợp đồng + cảnh báo + tạo lịch khi xác nhận; computeTravelFee theo bán kính/bậc | modules/contracts, packages/shared/src/contract.ts |
| E | W3 khung điều hướng web | apps/web/src/layout, src/app |
| G | Thu tiền: tiến độ, phiếu thu, báo cáo doanh thu | modules/payments, packages/shared/src/payments.ts |
| H | Máy chủ quản trị nền tảng + quota | modules/platform, lib/quota.ts |
| C | Cập nhật tài liệu (N4) | docs/*.md |
| Chấm | Chấm web móng/W1/W2 | worktree riêng |
| R&D | Vòng 3: trung tâm đào tạo + 3 hướng mẫu chào mừng | docs/rnd |
Migration mới nhất của điều phối: `20261018190000_tep_thu_tien_nen_tang` (lưu trữ tệp, thu tiền, quản trị nền tảng, bán kính gói, bậc phí). Chưa lưu kho chính thức vì tệp hợp đồng của D cần xử lý hình thức phí mới.

## Bước tiếp (theo thứ tự)
1. Nhận báo cáo F (W2), A và B (bật chống gửi trùng cho 7 đường tạo), E (api.put). Chạy `pnpm test` ở gốc kho, lưu bản đã kiểm.
2. Giao thợ C cập nhật tài liệu (N4). Cho thợ chấm chấm lại mốc 2 (T3, N4) và lát 1.
3. Giao W3, rồi W4, W5, W6 song song, rồi W7. Mỗi gói xuất ảnh 3 khổ và đặt cạnh ảnh bản mẫu C.
4. Mốc 6: trang quản trị nền tảng giống SS Pro. Qua R&D trước.
5. R&D đề xuất 6 trường mới, chờ anh Chiến quyết (mục 8 trong `docs/rnd/BAN-VE-C.md`).

## Lưu ý
- Lịch sử git có vài bản lưu "WIP": bản chụp việc thợ đang làm dở để không mất. Chưa nghiệm thu.
- Hồ sơ làm việc `H:\Code\HO-SO-LAM-VIEC-CHIEN.md` nằm trên máy anh Chiến, phiên đám mây không đọc được. Sổ ý muốn bản tạm nằm ở `docs/SO-Y-MUON.md`, cần chép sang Phần F.
