# Biên bản nghiệm thu lần 5 — Makeup Pro (bản `51fedce`, đợt 19/10)

- **Ngày chấm:** 19/10/2026, giờ máy khoảng 10:25–11:20 UTC (chiều tối 19/10 giờ Việt Nam).
- **Người chấm:** thợ chấm độc lập (AI, Opus). Tôi chỉ đọc, đo và chụp ảnh. Tôi **không** sửa mã, **không** lưu (commit) hay đẩy gì lên kho, **không** đụng database `makeup_dev`, **không** chạy `migrate reset` hay `db push`, **không** dùng `pkill -f`.
- **Bản được chấm:** commit `51fedce`. Phạm vi gồm các commit `8f6ac89..51fedce`: F1, K1, K6, K2, K3, K7, K8 và M2 (bản vẽ D). Trang duyệt mẫu không thuộc kho nên tôi bỏ qua.
- **Cách chấm:**
  - Làm trên bản tách riêng (worktree) `scratchpad/cham-5/kho`. Bản tách không có tệp `.env`.
  - Mọi lệnh chạy máy chủ đều đặt `DATABASE_URL` và `DIRECT_URL` trỏ database thử ngay trong lệnh.
  - Chấm xong tôi đã gỡ bản tách bằng `git worktree remove --force`.
- **Database thử.** Database nào cũng bật `btree_gist` và áp migration bằng `pnpm --filter api db:deploy-to <url>`. Lần nào cũng báo "kiểm lại: khớp".
  - `makeup_test_cham5`: bài thử máy chủ và đột biến máy chủ. **Đã xoá.**
  - `makeup_test_cham5_khop`: bài "khớp hai đầu" của web. **Đã xoá.**
  - `makeup_test_cham5_dung`: chép từ `makeup_test_cham4_dung`, rồi áp thêm 3 migration mới (`20261019110000_dat_lai_mat_khau`, `20261019120000_buoi_hoc_len_lich`, `20261019160000_moc_doi_mat_khau`). Dùng cho app thật. **Còn giữ** để tái hiện lỗi.
- **Máy chủ đã tắt theo PID:**
  - API cổng 4400: 19472, 19554, 19555, 19598.
  - Web bản build (`vite preview`) cổng 5470: 19473, 19542, 19543.
  - Sau khi tắt, cả hai cổng không còn trả lời.
- **Ảnh:**
  - 155 ảnh ở `scratchpad/cham-5/anh/`. Ảnh nào cũng là **ảnh khung màn hình** (`fullPage: false`, theo sổ lỗi mục 27).
  - Ảnh có chữ `mo-phong-34` là ảnh **mô phỏng** iPhone có thanh Home (xem K7).
  - Nhật ký ở `scratchpad/cham-5/log/`. Mã chụp và đo ở `scratchpad/cham-5/pw/`.
- **Mật khẩu tài khoản chủ:** trong lúc thử K1 tôi đổi mật khẩu 2 lần, rồi đặt về đúng `MatKhau@2026x` qua chính luồng quên mật khẩu. Đã đăng nhập lại thử: được.

---

## 0. Kết luận ngắn cho anh Chiến

**Mọi việc của đợt 19/10 đều chạy đúng trên app thật.** Chỉ có **K7 (chừa vùng an toàn iPhone) chưa trọn**: còn sót 1 màn.

| Việc | Kết quả |
|---|---|
| F1 | **ĐẠT** |
| K1 + K6 | **ĐẠT** |
| K2 | **ĐẠT** |
| K3 | **ĐẠT** |
| K8 | **ĐẠT** |
| M2 | **ĐẠT** (chỉ đọc mã và chạy bài thử, đúng phạm vi) |
| K7 | **ĐẠT MỘT PHẦN** |

**Bài thử tự động đều xanh, số tôi tự đo:**
- Máy chủ: **685/685**.
- Cửa gác: **793/793**, đúng bằng mốc trong bản ký duyệt D.
- Web: **1003/1003**, chạy 2 lần liền đều xanh.
- Gói dùng chung: **183/183**.
- Build xanh. Cửa gác bí mật: **0/172** tệp dính.

**Tôi tự cài 16 lỗi vào mã. Bài thử bắt được 14/16.** Hai lỗi lọt:
- **D4:** bỏ mức sàn 300 ms của đường quên mật khẩu, bài thử vẫn xanh.
- **D14:** nút tải ảnh ở màn Mẫu thiết kế, chính là chỗ K7 còn sót.

**Hồi quy** (sửa chỗ này mà làm hỏng chỗ khác): không thấy.
- Lập hợp đồng dịch vụ → xác nhận → Lịch → thu tiền → báo cáo: chạy đúng.
- Khoá & lớp → hợp đồng khoá học → In: chạy đúng.
- Tràn ngang (trang rộng hơn màn hình, phải kéo ngang): **0/83** lần.
- Nút chết: **0/127** nút.
- Tiền khớp giữa các màn và database.

**Lỗi mới thấy: không có lỗi nặng.** Có 2 lỗi trung bình (chi tiết ở mục 3):
1. **T1. Trên iPhone có thanh Home, nút "Tải ảnh PNG" ở màn Mẫu thiết kế bị thanh dưới che khoảng 2/3.** Đây là chỗ K7 còn sót.
2. **T2. Lỗi N1 cũ vẫn để lại dấu vết trong dữ liệu.** Những dòng hợp đồng đã huỷ **trước** bản sửa F1 vẫn còn ca "Đã xác nhận" trên Lịch. Bản sửa chỉ đúng cho những lần huỷ dòng **từ nay về sau**, không dọn dữ liệu cũ.

Ngoài ra có 6 lỗi nhẹ.

---

## 1. Bảng số đo (tôi tự chạy, in tử số / mẫu số)

### 1.1 Bài thử tự động

| # | Lệnh (trong bản tách `51fedce`) | Kết quả |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | Xanh, 15,9 giây |
| 2 | `apps/api`: `npx tsc --noEmit` | **0 lỗi** (16,9 giây) |
| 3 | `apps/api`: `npx vitest run` trên database mới `makeup_test_cham5` | **685/685** bài, **57/57** tệp (10 phút 20 giây). Lần 4 là 612. Bài mới gồm `buoi-hoc-len-lich` 19/19, `dat-lai-mat-khau` 21/21, `moc-doi-mat-khau` 16/16, `huy-dong-huy-lich` 9/9, `ten-dat-truoc` 4/4, `env-mau` 4/4. |
| 3a | Cửa gác, 10 phép | scope **100/100** · outsider **100/100** · noPerms **100/100** · unauth **110/110** · crossId **51/51** · leak **40/40** · refBase **45/45** · crossRef **107/107** · keep **100/100** · platform **40/40**. Cộng **793/793**. |
| 3b | Cửa gác "sửa một phần" | partialStatic **21/21** · partialKeep **21/21** · chạy thật đủ hai bước **21/21** đường PATCH |
| 3c | Đột biến có sẵn trong kho (`gate-mutants.test.ts`) | **14/14** xanh: cài lỗi nào thì cửa gác đỏ đúng phép đó |
| 4 | `packages/shared`: `tsc` + `vitest` | **0 lỗi** · **183/183** bài, 9/9 tệp. Gồm `surcharges` 66/66 (M2), `occasions` 6/6, `design-templates` 16/16. |
| 5 | `apps/web`: `pnpm typecheck` (cả `tsconfig.json` và `tsconfig.node.json`) | **0 lỗi** (36,4 giây) |
| 6 | `apps/web`: `npx vitest run`, `KHOP_HOP_DONG_DATABASE_URL=…/makeup_test_cham5_khop`, `KHOP_PORT=4427`, **2 lần liền** | Lần 1: **1003/1003** (67/67 tệp, 164 giây). Lần 2: **1003/1003** (156 giây). 0 bài chập chờn (lúc qua lúc không), 0 bài bỏ qua. |
| 6a | Bài khớp hai đầu (web và máy chủ thật nói cùng một kiểu dữ liệu) | `khop-hop-dong` **14/14** · `khop-kieu` **6/6**, cả 2 lần |
| 6b | Cửa gác bí mật trong vitest | **44/44**, cả 2 lần |
| 7 | `apps/web`: `pnpm build` | **Xanh** (38,3 giây). Tệp chính `index-*.js` 368,35 KB (nén còn 117,76 KB); `man-contracts` 128,75 KB; `man-schedule` 42,64 KB. Cửa gác bí mật: **"đã quét 172/172 tệp · 0 vi phạm · 0/172 tệp dính"**. `vercel.json` kiểm khớp. |

Nhật ký: `log/api-tsc.txt`, `log/api-vitest.txt`, `log/shared.txt`, `log/web-tsc.txt`, `log/web-vitest-{1,2}.txt`, `log/web-build.txt`.

### 1.2 Đột biến tôi tự cài

Mỗi dòng: cài một lỗi → chạy bài thử liên quan → trả mã về nguyên (`git checkout`).
- Đột biến máy chủ: chạy 6 tệp bài thử (140 bài) trên `makeup_test_cham5`.
- Đột biến web: chạy các thư mục `schedule`, `contracts`, `ui`, `layout`, `designs`, `courses` (492 bài).
- Nhật ký: `log/dot-bien.txt`. Mã cài lỗi: `pw/dotbien.py`.
- Sau cùng, `git status` của bản tách chỉ còn 5 tệp `.bat` (xem lỗi nhẹ L6), không còn tệp mã nào bị đổi.

| Đột biến | Mục | Kết quả |
|---|---|---|
| D1. Huỷ dòng mà không huỷ ca của dòng | F1 | **Đỏ** 7 bài |
| D2. Thẻ truy cập cũ vẫn được nhận sau khi đổi mật khẩu | K6 | **Đỏ** 5 bài |
| D3. Email không có tài khoản trả mã 200, khác mã 202 của email có tài khoản (lộ tài khoản) | K1 | **Đỏ** 4 bài |
| D4. Bỏ mức sàn 300 ms của đường quên mật khẩu | K1 | **Xanh: lọt** (xem lỗi nhẹ L1) |
| D5. Dùng lại đường dẫn đã dùng vẫn đặt được mật khẩu | K1 | **Đỏ** 4 bài |
| D6. Đường dẫn quá 30 phút vẫn dùng được | K1 | **Đỏ** 1 bài |
| D7. Đặt lại mật khẩu mà không thu hồi phiên đăng nhập | K1 | **Đỏ** 3 bài |
| D8. Bấm lại "Đưa lên Lịch" sinh thêm buổi cho ngày đã có | K2 | **Đỏ** 4 bài |
| D9. Buổi đã huỷ tay (nghỉ lễ) bị sinh lại | K2 | **Đỏ** 2 bài |
| D10. Buổi học tạo ở Nháp (không giữ giờ giảng viên) | K2 | **Đỏ** 5 bài |
| D11. Lịch đếm cả ca đã huỷ | K8 | **Đỏ** 9 bài |
| D12. Ngăn kéo chọn thợ lại nằm dưới hộp (tầng 40) | F1/N2 | **Đỏ** 2 bài |
| D13. Bỏ vùng an toàn khỏi chiều cao thanh dưới | K7 | **Đỏ** 2 bài |
| D14. Nút "Tải ảnh" (Mẫu thiết kế) đổi khoảng chừa đáy | K7 | **Xanh: lọt** (xem lỗi trung bình T1) |
| D15. Nhân vật tự thêm đầu tiên lấy trùng màu Cô dâu | K3 | **Đỏ** 1 bài |
| D16. Mẫu shd-11 mất khung viên thuốc | K3 | **Đỏ** 1 bài |

**Kết luận: bài thử bắt được 14/16 lần phá.** Mọi chốt quan trọng anh dặn đều có bài canh:
- huỷ dòng thì huỷ ca;
- thẻ truy cập cũ bị từ chối;
- chống dò bằng mã trả về và thân trả lời;
- buổi học không sinh trùng;
- Lịch không đếm ca huỷ.

Hai chỗ lọt:
- **D4:** mức sàn thời gian hiện đang chạy đúng (đo thật mục 2, K1). Chỉ là bài thử đặt ngưỡng quá rộng nên không canh được.
- **D14:** bài thử K7 (`safeArea.test.ts`) chỉ đọc `layout.css`, nên không thấy chỗ còn viết cứng `72px` ở `designs.css`.

### 1.3 Đo trên app thật

App thật gồm máy chủ cổng 4400 và bản build cổng 5470, trên bản sao dữ liệu `makeup_test_cham5_dung`.

| Hạng mục | Kết quả |
|---|---|
| **Tràn ngang** | **0/83** lần tràn. Đo 19 màn × 3 khổ (1440, 1024, 390), Lịch đủ 3 chế độ ở cả hai tổ chức, cộng 4 màn chưa đăng nhập × 2 khổ (Đăng nhập, Quên mật khẩu, Đặt mật khẩu mới có và không có mã). Bảng đo: `log/tran-ngang.tsv`. |
| **Nút chết** | Bấm **127** nút trên 8 màn: Lịch Học viện C/B/A, Lịch Studio B, Khoá & lớp, HD-000001, HĐKH-000003, Thương hiệu. 16 nút "không thấy đổi", đều có lý do: nút đã chọn sẵn (chế độ, ngày, bộ lọc "Tất cả", loại hợp đồng) và 3 nút tải ảnh (mở hộp chọn tệp của máy). **0 nút chết thật** (`log/nut.txt`). |
| **Lỗi trang** | Không có lỗi JavaScript trên mọi màn đã đi. Chỉ có 401 lúc mở trang khi chưa đăng nhập, đúng thiết kế. |
| **Một người một màu, một chữ tắt** | Gom mọi ảnh đại diện trên 11 màn ở 1440 và 390: Lịch C/B/A, hợp đồng (kể cả ô chọn thợ trong hộp phát sinh), danh sách hợp đồng, Thợ makeup, Tiền công, Thu tiền, Doanh thu, Bảng giá, Mẫu thiết kế. **Mỗi người đúng 1 kiểu (màu + chữ tắt) trên mọi màn.** Hai người cùng chữ tắt LT (Linh Trần, Lê Minh Tú) khác màu: nâu cam và nâu xám (`log/mau-nguoi-*.txt`). |

**Tiền khớp giữa các màn và database** (sau khi lập thêm HD-000007 và thu cọc 1.000.000 ₫):

| Hợp đồng | Báo cáo doanh thu (tổng / cọc / đã thu / còn) | Database (tổng / cọc / đã thu) |
|---|---|---|
| HD-000001 | 5.194.000 / 1.500.000 / 1.500.000 / 3.694.000 | 5.194.000 / 1.500.000 / 1.500.000 |
| HD-000002 | 3.300.000 / 1.300.000 / 1.300.000 / 2.000.000 | 3.300.000 / 1.300.000 / 1.300.000 |
| HD-000003 | 400.000 / 100.000 / 0 / 400.000 | 400.000 / 100.000 / 0 |
| HD-000006 | 2.500.000 / 1.000.000 / 1.000.000 / 1.500.000 | 2.500.000 / 1.000.000 / 1.000.000 |
| **HD-000007 (mới)** | 2.500.000 / 1.000.000 / 1.000.000 / 1.500.000 | 2.500.000 / 1.000.000 / 1.000.000 |
| **Cộng** | **13.894.000** · cọc 4.900.000 · đã thu 4.800.000 · còn 9.094.000. Sổ thu 4.800.000, 4 phiếu. Như nhau ở 1440 và 390. | khớp |

HD-000001 có thêm rồi huỷ một dòng phát sinh 400.000 ₫ khi tôi thử F1. Tổng đi 5.194.000 → 5.594.000 → 5.194.000, đúng.

---

## 2. Từng mục: ĐÚNG / ĐẠT / ĐẸP

**Cách đọc ba cột:**
- **ĐÚNG:** làm đúng việc được giao.
- **ĐẠT:** chạy được trên app thật.
- **ĐẸP:** giao diện gọn, dễ đọc ở cả 1440 và 390.

| Mục | ĐÚNG | ĐẠT | ĐẸP | Ảnh chính (trong `anh/`) |
|---|---|---|---|---|
| F1a Huỷ dòng → huỷ ca của dòng | Có | Có | Có | `F1-N1-*` |
| F1b Ô chọn thợ trong hộp phát sinh nằm trên (390) | Có | Có | Có | `F1-N2-o-chon-tho-tren-hop-390`, `F1-N2-hop-phat-sinh-co-tho-390`, `F1-N2-sau-khi-luu-phat-sinh-390` |
| F1c Gói của nhân vật ẩn có ghi chú ở Thương hiệu | Có | Có | Có | `F1-goi-nhan-vat-an-thuong-hieu-{1440,390}` |
| F1d Một người một màu, một chữ tắt ở mọi màn | Có | Có | Có | `F1-mau-*-{1440,390}` |
| K1 Quên / đặt lại mật khẩu qua email | Có | Có (thư in ra nhật ký máy chủ, chưa gửi thư thật) | Có | `K1-*` |
| K6 Thẻ truy cập cũ bị từ chối; tên đặt trước; `.env.example` | Có | Có | — | `K6-may-khac-bi-dang-xuat-1440` |
| K2 Buổi học lên Lịch | Có | Có | Có (3 điểm nhẹ L2–L4) | `K2-*`, `K8-buoi-toi-*` |
| K3 27 mẫu có ảnh, khung tròn, shd-11 viên thuốc, 12 màu, tương phản | Có | Có | Có | `K3-*` (27 ảnh) |
| K7 Thanh dưới chừa vùng an toàn iPhone | **Một phần** | **Một phần** | — | `K7-*` |
| K8 Lịch không đếm ca huỷ; trục giờ Ngày mở rộng | Có | Có | Có (L2) | `K8-*`, `F1-N1-lich-*` |
| M2 Hàm phụ phí trong `packages/shared` | Có | Chưa nối vào máy chủ (đúng phạm vi) | — | (đọc mã + chạy thử) |

### F1: kiểm chi tiết

**N1 (huỷ dòng thì huỷ ca):**
1. Ở khổ 390, tôi thêm phát sinh "Phù dâu 17:00, thợ Giang" vào HD-000001. Máy sinh ca LH-000010 "Đã xác nhận", chiếm giờ của Giang.
2. Ở khổ 1440, tôi bấm "Huỷ dòng" trên dòng đó và ghi lý do. App báo: **"Đã huỷ 1 lịch của dòng này trên Lịch (LH-000010)."**
3. Database: LH-000010 = **CANCELLED** (không bị xoá), lý do huỷ đúng như tôi ghi, có lịch sử trạng thái, thợ không còn bị chiếm giờ.
4. Lịch ngày 22/11 đếm **8 ca → 7 ca**. Hàng Giang **1 → 0 ca**. Ô 17:00 vẫn hiện nhưng vẽ mờ.

**N2 (ô chọn thợ bị che ở 390):**
- Hộp phát sinh và ngăn kéo chọn thợ nay cùng tầng 50. Cái mở sau nằm trên.
- Tôi đo ở cả 5 dòng thợ: điểm giữa mỗi dòng đều bấm trúng ô chọn thợ (5/5), không còn bị hộp phát sinh che.
- Chọn thợ được, lưu phát sinh được.

**Gói của nhân vật ẩn:**
- Ở Thương hiệu → "Gói hiện trên trang", gói "Mẹ cô dâu" có dòng ghi chú **"Nhân vật đang ẩn, gói không hiện"** kèm dấu ? giải thích.
- Ở màn lập hợp đồng cũng có dòng "1 gói của nhân vật đang ẩn (Mẹ cô dâu) không hiện ở đây".

### K1 + K6: chạy đúng luồng anh dặn

Nhật ký chạy: `log/k1.txt`, `log/k1-timing.txt`.

1. Lấy trước một **thẻ truy cập** và một phiên đăng nhập bằng mật khẩu cũ. Gọi `/auth/me` bằng thẻ đó: **200**.
2. Mở một trình duyệt thứ hai, đăng nhập sẵn (giả làm "máy khác").
3. Màn Đăng nhập có link **"Quên mật khẩu?"**. Bấm vào thì email đã gõ được điền sẵn ở màn Quên mật khẩu.
4. Bấm "Gửi đường dẫn đặt lại". App hiện **"Kiểm tra hộp thư"** với cùng một câu, dù email có tài khoản hay không.
5. Đường dẫn được in ra **nhật ký máy chủ** (chế độ console), dạng `…/dat-lai-mat-khau#the=…`.
6. Mở đường dẫn:
   - Mã đặt lại biến khỏi thanh địa chỉ (còn `/dat-lai-mat-khau`).
   - Gõ hai lần khác nhau thì báo "Hai lần nhập chưa khớp nhau".
   - Gõ khớp thì báo **"Đã đặt mật khẩu mới. Mọi thiết bị đang đăng nhập đã được đăng xuất."**
7. **K6, thẻ cũ:**
   - `/auth/me` bằng thẻ truy cập lấy ở bước 1: **401 "Mật khẩu tài khoản vừa được đổi, vui lòng đăng nhập lại"**.
   - Gọi API của studio bằng thẻ đó: **401**.
   - Phiên cũ (refresh): **401**.
   - Đăng nhập bằng mật khẩu cũ: **401**. Bằng mật khẩu mới: **200**.
8. Máy thứ hai bấm sang màn khác thì bị đưa về **Đăng nhập** (`K6-may-khac-bi-dang-xuat-1440`).
9. Dùng lại đường dẫn đã dùng: báo **"Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn"** kèm link "Gửi đường dẫn mới".
10. **Chống dò tài khoản:**
    - Mã trả về luôn **202**, thân trả lời giống hệt.
    - Thời gian trả lời (trung vị, 15 lần mỗi loại): **có tài khoản 305 ms · không có 309 ms · có tài khoản nhưng đã quá 3 thư/giờ 304 ms**. Không phân biệt được.
    - Email viết hoa và có khoảng trắng vẫn nhận đúng.
11. **Đường dẫn chỉ dùng được 30 phút.** Database lưu mã đã băm (64 ký tự), hạn đúng 30 phút. Nhật ký máy chủ không chứa mật khẩu. Mã thật chỉ có trong dòng "thư chạy thử", đúng thiết kế.
12. **Tên đặt trước:** tạo tổ chức với đường dẫn `quen-mat-khau` hoặc `dat-lai-mat-khau` thì bị từ chối: "Đường dẫn này trùng tên trang của hệ thống".
13. **`.env.example`** ghi đủ các biến gửi thư (`MAIL_DRIVER`, `MAIL_FROM`, `MAIL_HTTP_URL`, `MAIL_HTTP_API_KEY`, `WEB_APP_URL`, `PASSWORD_RESET_TTL_MINUTES`) và nhắc không ghi khoá API vào tệp.

### K2: buổi học lên Lịch

Làm trên tổ chức "Học viện Chiến Makeup".

1. **Lớp K1** (T2, T4, 9:00–12:00, giảng viên Hoàng Mai Anh). Bấm **"Đưa lên Lịch"**:
   - Hộp xem trước ghi "Thêm 9 buổi học (02/11 → 30/11)".
   - Bấm đồng ý thì thêm **9 buổi**, trạng thái **Đã xác nhận**, đều giữ giờ giảng viên.
   - Thẻ lớp đổi sang "Đã lên Lịch · 9 buổi sắp tới", nút đổi thành "Cập nhật Lịch".
2. **Bấm lại "Cập nhật Lịch":** hộp ghi "9 buổi đã khớp lịch lớp — giữ nguyên". **Không sinh trùng**: database vẫn 9 buổi.
3. **Trùng giờ giảng viên:** mở lớp "K3 tối" cùng giảng viên, T2/T4 10:00–11:00.
   - Hộp xem trước liệt kê lịch trùng (LH-000002… "… và 4 lịch trùng khác") và ghi "chưa đưa buổi nào lên Lịch".
   - Gọi thẳng API: **409**, 9 chỗ trùng.
   - Database: 0 buổi được tạo.
4. **Đổi lớp K3 sang T6, 18:30–20:30:** đưa lên Lịch được 4 buổi.
   - Huỷ tay buổi 13/11 với lý do "Nghỉ lễ".
   - Đổi giờ lớp sang 19:00–21:00: 3 buổi còn lại đổi theo, buổi 13/11 không bị sinh lại.
   - Bấm lại thì hộp ghi "1 buổi đã huỷ tay (13/11) — không thêm lại".
5. **Đổi thứ học sang T5:** 3 buổi T6 bị máy huỷ (lý do "Lịch học của lớp đã đổi…"), 4 buổi T5 được thêm.
6. **Huỷ lớp K3** qua giao diện (hộp nói rõ "Buổi học chưa diễn ra trên Lịch huỷ theo"): cả 4 buổi T5 sang Đã huỷ, lý do "Huỷ lớp: …".
7. **Lớp chưa có giảng viên** ("Makeup cá nhân cơ bản", 18:00–21:00):
   - Đưa lên Lịch được 8 buổi.
   - Trên Lịch hiện ở mục "Chưa có thợ", **không có nút "Phân thợ"**. Đúng thiết kế: gán giảng viên ở lớp, không gán từng buổi.
8. Buổi học trên Lịch:
   - Có nhãn "Buổi học", nền sọc, tên lớp ở dòng tên.
   - Chi tiết ghi "Đã xác nhận · Lớp K3 tối · Makeup chuyên nghiệp · Mở khoá học".
9. Phần không thử được trên app: **huỷ lớp khi có buổi đang diễn ra → 409**. Muốn thử phải có buổi đang diễn ra, mà các buổi đều ở tương lai. Phần này có bài thử máy chủ canh (19/19 xanh, đột biến D10 đỏ đúng bài đó).

### K3: 27 mẫu

Đo trên từng tệp mẫu (`log/k3.tsv`):
- **27/27 mẫu có ảnh.** Lần đo máy đầu đếm sót lc-04 vì mẫu này đặt tên ô ảnh `a1`, `a2`. Xem ảnh thì lc-04 có đủ 2 ảnh tròn.
- **Khung tròn ở cả 26 mẫu còn lại.** shd-11 là **viên thuốc** 384×576.
- **Tương phản chữ:** 0 dòng dưới ngưỡng, trừ dấu ngoặc kép trang trí cỡ 140 px ở fb-02 (2,31:1). Đó là hoạ tiết, không phải chữ cần đọc.
- shd-11 đẹp, đúng ý "chữ ký nét mảnh" (`K3-shd-11.png`).
- 12 màu nhân vật: bài thử đo độ khác màu và tương phản xanh; đột biến D15 làm trùng màu thì bài đỏ.

### K7: chừa vùng an toàn iPhone

- Phần làm đúng:
  - Thẻ `viewport-fit=cover` có trong `index.html`.
  - Thanh dưới = 64 px + vùng an toàn.
  - Thanh tổng tiền dính đáy của hợp đồng và thanh lưu của Thương hiệu dùng chung biến chiều cao.
- **Cách đo:** máy Chromium không có thanh Home. Tôi gán vùng an toàn 34 px (đúng giá trị iPhone sẽ báo) rồi đo 5 màn:
  - Lịch, Hợp đồng, Thương hiệu, Khách: không chồng lấn.
  - **Mẫu thiết kế: nút "Tải ảnh PNG" bị thanh dưới che.** Xem T1.

### K8: Lịch

- **Không đếm ca huỷ:**
  - Ngày 13/11 chỉ có một buổi đã huỷ. Lịch ghi **0 ca** ở dải ngày, chip "Tất cả 0" và "Tổng trong ngày 0 ca".
  - Ngày 22/11 sau khi huỷ dòng: 8 → 7 ca, chế độ C và A cũng giảm theo.
- **Trục giờ chế độ Ngày:**
  - Ngày 06/11 có buổi 18:30: khung "Thợ trong ngày" nới thành **04:00 – 21:00**, mốc chia 4h, 8h, 12h, 16h, 21h. Thanh 18:30–20:30 nằm đúng vị trí.
  - Ngày không có ca muộn giữ 04:00 – 18:00.

### M2: hàm phụ phí trong `packages/shared`

- Đọc mã và chạy bài thử: 66/66 bài xanh.
- Tôi tự chạy thử thêm:
  - Giờ Việt Nam 18:00 → 11:00 UTC, đúng.
  - Múi giờ có đổi giờ mùa hè (New York, 08/03) cũng đúng.
  - Khung qua đêm 22:00–05:00: 23:00 và 04:59 khớp; 05:00 và 21:59 không khớp.
  - Hai luật cùng dịch vụ: luật xếp trên thắng. Luật người lập đã bỏ ở dòng thì không che luật khác.
- Chưa nối vào máy chủ, đúng như phạm vi đã giao. Chú thích đầu tệp đã nhắc tới `autoSurcharge.ts`, tệp này **chưa có**: đó là việc của gói sau.

---

## 3. Lỗi mới (xếp theo mức nặng)

**Nặng: không có.**

### Trung bình

**T1. Trên iPhone có thanh Home, nút "Tải ảnh PNG" ở màn Mẫu thiết kế bị thanh dưới che khoảng 2/3.** Đây là chỗ K7 còn sót.
- **Triệu chứng:** ở điện thoại, cuộn giữa trang Mẫu thiết kế. Nút tải dính đáy, nhưng chỉ còn một mẩu trên cùng lộ ra trên thanh dưới. Phải cuộn tới cuối trang mới thấy cả nút.
- **Tái hiện:**
  1. Mở màn Mẫu thiết kế ở khổ 390×844.
  2. Gán vùng an toàn đáy 34 px như iPhone.
  3. Cuộn xuống 400 px.
  4. Đo: đáy nút ở y = 764, đỉnh thanh dưới ở y = 746. Bấm vào nửa dưới nút thì trúng **thanh dưới**.
  5. Khi không có vùng an toàn (máy Android, máy tính) thì không bị.
- **Gốc:** `apps/web/src/features/designs/designs.css:140`: `.mtk-export { position: sticky; bottom: 72px; … }`. Chỗ này vẫn viết cứng 72 px (= 64 + 8), không dùng `var(--h-bottomnav)` như chú thích ở `layout.css:7-12` yêu cầu.
- **Vì sao bài thử không bắt:** bài `apps/web/src/layout/safeArea.test.ts:8` chỉ đọc `layout.css`. Đột biến D14 lọt.
- **Ảnh:** `K7-mo-phong-34-mau-thiet-ke-cuon400-390.png` (bị che), `K7-that-mau-thiet-ke-cuon400-390.png` (bình thường).

**T2. Lỗi N1 cũ vẫn để lại dấu vết trong dữ liệu: ca của những dòng đã huỷ trước bản sửa vẫn còn trên Lịch.**
- **Triệu chứng:**
  - Trên bản sao dữ liệu, HD-000001 có 2 dòng "Phù dâu 15:00" đã huỷ từ lần chấm 4. Ca của chúng (LH-000008, LH-000009) vẫn **"Đã xác nhận"**.
  - Lịch ngày 22/11 vẫn hiện 2 thẻ vàng "Chưa có thợ · 15:00 · Phù dâu" kèm nút **"Phân thợ"**, và vẫn đếm vào "N ca".
  - Đúng triệu chứng N1 cũ, chỉ khác là với dữ liệu cũ.
- **Gốc:** bản sửa (`apps/api/src/modules/contracts/lineAppointments.ts:14-47`, gọi ở `contracts/routes.ts`) chỉ chạy khi huỷ dòng **từ nay về sau**. Không có migration hay lệnh nào dọn các ca đã sót từ trước.
- **Tái hiện:** mở `makeup_test_cham5_dung`, vào Lịch 22/11. LH-000009 vẫn còn. LH-000008 tôi đã huỷ tay để thử cách gỡ.
- **Cách gỡ tạm:** mở ca trên Lịch → "Huỷ lịch" kèm lý do. Tôi đã thử trên LH-000008: được (200).
- **Ảnh:** `F1-N1-lich-22-11-B-huy-1440.png` (2 thẻ "Chưa có thợ 15:00" ở đầu trang).
- **Việc cần làm trước khi anh dùng dữ liệu thật:** điều phối chạy câu đếm chỉ-đọc dưới đây trên database thật. Có dòng nào thì huỷ tay các ca đó, hoặc giao thợ viết một lệnh dọn một lần.

  ```sql
  SELECT c.code AS hop_dong, a.code AS ca, a.status
  FROM appointments a
  JOIN contract_lines l ON l.id = a.contract_line_id
  JOIN contracts c ON c.id = a.contract_id
  WHERE l.voided_at IS NOT NULL
    AND a.status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED');
  ```

### Nhẹ

- **L1. Bài thử chống dò bằng thời gian không canh được mức sàn 300 ms.**
  - Bỏ hẳn mức sàn (`password-reset.ts:182-183`) thì bài thử vẫn xanh (đột biến D4).
  - Lý do: bài `apps/api/test/dat-lai-mat-khau.test.ts:100-120` cho phép chênh tới 100 ms.
  - Mã hiện chạy đúng: đo thật 305 ms so với 309 ms.
- **L2. Buổi học buổi tối (18:00, 18:30) được xếp vào nhóm "BUỔI CHIỀU".**
  - Gốc: `apps/web/src/features/schedule/model.ts:463-470` chỉ có 3 nhóm: sáng sớm, buổi sáng, buổi chiều.
  - Ảnh: `K8-buoi-toi-B-1440.png`, `K8-khong-gv-B-1440.png`.
- **L3. Hộp "Đưa lên Lịch" của lớp chưa có giảng viên vẫn ghi "giữ giờ của giảng viên".**
  - Gốc: `apps/web/src/features/courses/SessionSyncDialog.tsx:128`.
  - Ảnh: `K2-b7-khong-gv-hop-ca-nhan-co-ban-390.png`.
- **L4. Hộp báo trùng giờ chỉ ghi mã lịch** ("LH-000002 · Hoàng Mai Anh · 02/11 09:00–12:00"), không nói đó là buổi học của lớp K1. Chủ phải tự tra mới biết trùng với gì.
  - Ảnh: `K2-b3-trung-hop-K3-toi-390.png`.
- **L5. Chi tiết buổi học ở khổ 390:**
  - Chữ "2 giờ" bị tách, chữ "giờ" rơi xuống dòng riêng (`K8-buoi-toi-chi-tiet-buoi-390.png`).
  - Nút "Khách không đến" dùng cho buổi học: đã có trong việc tồn 52.
- **L6. Năm tệp `scripts/windows/*.bat` hiện "đã sửa" ngay sau khi lấy mã.**
  - Lý do: kho lưu sẵn kiểu xuống dòng Windows (CRLF), trong khi `.gitattributes` đòi git tự chuẩn hoá.
  - Nội dung không khác (so bỏ qua CRLF: 0 dòng khác). Chỉ làm `git status` không sạch, dễ khiến thợ sau tưởng có người sửa dở.

---

## 4. Anh Chiến vào thao tác thật được chưa

**Được, anh vào thao tác thật được**, với ba lưu ý:

1. **Quên mật khẩu qua email chưa gửi thư thật.**
   - Bản chạy thử chỉ in đường dẫn ra nhật ký máy chủ.
   - Trên bản đưa lên mạng (production), nút "Quên mật khẩu" sẽ báo "Máy chủ chưa cấu hình gửi thư" cho tới khi anh chọn dịch vụ gửi thư (có thể tốn phí).
   - Trong lúc chờ: anh **ghi nhớ mật khẩu**. Nếu quên thì nhờ người quản trị đặt lại.
2. **Trước khi dùng dữ liệu thật, cần kiểm lỗi T2.** Điều phối chạy câu đếm ở mục 3 trên database của anh.
   - Có dòng nào thì huỷ tay các ca sót đó trên Lịch ("Huỷ lịch").
   - Nếu không, Lịch sẽ còn nhắc "Phân thợ" cho những ca khách đã bỏ.
3. **Trên iPhone, ở màn Mẫu thiết kế:** nếu nút "Tải ảnh PNG" bị thanh dưới che, anh cuộn xuống cuối trang là thấy đủ nút. Lỗi T1 đã ghi để thợ sửa: một dòng CSS và một bài thử.

Mọi luồng chính anh dùng hằng ngày đều chạy đúng và tiền khớp:
- lập hợp đồng → xác nhận → Lịch → thu tiền → báo cáo;
- khoá học → ghi danh → hợp đồng khoá học → In;
- huỷ dòng / huỷ ca;
- đưa buổi học lên Lịch;
- đổi mật khẩu.

---

## 5. Còn giữ để tái hiện

- **Database `makeup_test_cham5_dung`:**
  - Tài khoản `chien.chu@studio-thu.vn` / `MatKhau@2026x`.
  - LH-000009 (lỗi T2) còn trên Lịch Studio ngày 22/11.
  - Lớp "K3 tối" đã huỷ, cùng 8 buổi đã huỷ.
  - HD-000007 và HĐKH-000003 là hai hợp đồng lập trong lúc chấm.
- **Chạy lại app thật** (từ một bản tách của `51fedce`):

  ```
  DATABASE_URL=… DIRECT_URL=… JWT_ACCESS_SECRET=<≥32 ký tự> PORT=4400 MAIL_DRIVER=console WEB_APP_URL=http://localhost:5470 npx tsx src/server.ts
  API_DEV_TARGET=http://localhost:4400 npx vite preview --port 5470
  ```
- **Mã đo và chụp:** `scratchpad/cham-5/pw/`.
  - `k1.mjs`, `k1b.mjs`, `timing.mjs`: K1/K6.
  - `f1a.mjs`, `f1b.mjs`, `f1c.mjs`, `mau-nguoi.mjs`: F1.
  - `k2*.mjs`: K2. `k3.mjs`: K3. `k7*.mjs`: K7. `k8.mjs`: K8.
  - `tran.mjs`, `nut.mjs`: tràn ngang và nút chết.
  - `hq*.mjs`: hồi quy.
  - `dotbien.py`: đột biến.
- **Lưu ý:** nhật ký máy chủ `log/api-4400.log` có in đường dẫn đặt lại mật khẩu (chế độ console). Mọi đường dẫn trong đó đều đã dùng hoặc đã bị thu hồi. Đừng đưa tệp này ra ngoài.
