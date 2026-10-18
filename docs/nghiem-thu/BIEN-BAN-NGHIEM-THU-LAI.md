# Biên bản nghiệm thu lại — Makeup Pro (bản `d417acf`)

- **Ngày chấm:** đêm 18 sang 19/10/2026 (giờ máy UTC khoảng 23:00–00:30, giờ Việt Nam là sáng 19/10).
- **Người chấm:** thợ chấm độc lập (AI). Tôi không sửa mã sản phẩm, không lưu (commit) và không đẩy gì lên kho.
- **Bản được chấm:** commit `d417acf`. Bản này là vòng sửa các lỗi trong biên bản nghiệm thu cuối (bản `74fda02`).
- **Cách chấm:** tôi làm trên một *bản tách riêng* (worktree), tức là một bản sao của kho, để không đụng vào thư mục các thợ đang làm. Chấm xong tôi đã gỡ bản tách.
- **Môi trường riêng:**
  - Ba database thử mới, đều bật `btree_gist`. Migration áp bằng `pnpm --filter api db:deploy-to`, lệnh tự kiểm và báo "khớp" cả ba lần.
    - `makeup_test_cham_lai`: bài thử máy chủ. Đã xoá.
    - `makeup_test_cham_lai_khop`: bài khớp hai đầu. Đã xoá.
    - `makeup_test_cham_lai_dung`: phần thao tác thật. **Còn giữ** để tái hiện lỗi. Xoá bằng `su postgres -c "dropdb makeup_test_cham_lai_dung"`.
  - Máy chủ API thật ở cổng 4230. Web là **bản build** chạy bằng `vite preview` ở cổng 5300. Trình duyệt là Chromium (Playwright).
  - Đã tắt máy chủ theo PID: 4277, 4279, 4326, 4327, 4343 (API) và 4278, 4281, 4313, 4314, 4350 (web). Không dùng `pkill -f`. Không đụng `makeup_dev`.
- **Ảnh:** 52 ảnh/PDF được nêu trong biên bản đã chép vào `docs/nghiem-thu/bai-thu-lai/`; đủ 244 tệp còn ở thư mục nháp của phiên chấm (không đưa lên kho vì nặng).

**Ba điều tôi phải tự khai (do tôi gây ra, không phải lỗi sản phẩm):**
1. Bài bấm thử mọi nút đã bấm phải công tắc ở màn **Bảng giá → Nhân vật**, làm ẩn 4 nhân vật của Studio Chiến. Tôi đã bật lại cả 4 qua giao diện và kiểm trong database: cả 6 nhân vật đang dùng. Nhờ sự cố này tôi thấy lỗi M1 ở mục 3.
2. Hợp đồng HĐKH-000001 có **3 phiếu thu, mỗi phiếu 5.000.000 ₫**, vì tôi chạy lại bài thu tiền 3 lần. Đây là dữ liệu thử của tôi. Tiền vẫn khớp giữa các màn (mục 1.3).
3. Một bài cũ tôi dùng lại còn trỏ đường dẫn tới thư mục của lần chấm trước. Nó **ghi đè 2 tệp nháp** trong `scratchpad/cham-cuoi/anh/`: `94-ban-in-hd-khoa-hoc-1440.png` và `94-ban-in-hd-khoa-hoc.pdf`. Bản đã đưa vào kho (`docs/nghiem-thu/bai-thu-cuoi/`) không bị đụng.

---

## 0. Kết luận ngắn cho anh Chiến

**Mọi lỗi nặng và trung bình của lần chấm trước đã hết**, trừ T3 là lỗi anh quyết không sửa đợt này. Tôi kiểm trên app thật và có ảnh cho từng lỗi:

- **In hợp đồng khoá học đã đúng.** Hợp đồng ngắn in ra 1 trang. Hợp đồng có 45 điều khoản in ra 3 trang, chữ chảy liền từ điều 1 đến điều 45, sang nội quy rồi chỗ ký. Không còn chồng chữ, không còn bản lặp.
- **Không còn xác nhận được hợp đồng khi có dòng chưa giờ.** Nút "Xác nhận hợp đồng" bị khoá. Dải đỏ kể đúng từng dòng thiếu giờ, bấm tên dòng thì màn cuộn tới dòng đó. Tôi gọi thẳng máy chủ để lách giao diện, máy chủ vẫn chặn (lỗi 409). Thêm phát sinh không giờ vào hợp đồng đã chốt cũng bị chặn. Nhập đủ giờ thì xác nhận được, và mọi ca hiện trên Lịch.
- **Gợi ý tiến độ không còn đặt hạn sau ngày cưới.** Với hợp đồng khoá học, không đợt nào hạn sau ngày kết thúc lớp.
- **Học viện mới chưa có gói thì được báo rõ.** Máy chủ không còn lỗi 500. Gói Dùng thử báo "Gói Dùng thử của tổ chức chưa có khoá học — liên hệ để nâng gói."
- **Màn đăng ký, đăng nhập, tạo tổ chức đã có giao diện đẹp**, ở cả máy tính và điện thoại.
- Các lỗi nhẹ L1, L2, L3, L6, L8, L9 đã hết. **L7 còn một chỗ:** trên điện thoại, chế độ "Cột thợ" vẫn cắt mất "× 2".

**Bài thử tự động** (chương trình tự kiểm, chạy hàng trăm thao tác rồi so kết quả) đều xanh, tức là qua hết:
- Máy chủ 597/597.
- Web 850/850, chạy 3 lần đều xanh, **không còn bài chập chờn** (bài lúc qua lúc không).
- Tôi tự cài lại 8 lỗi cũ vào mã. Bài thử bắt được cả 8.

**Hồi quy:** tôi không thấy lỗi nào do vòng sửa này gây ra. "Hồi quy" là sửa chỗ này mà làm hỏng chỗ khác.
- Tràn ngang: 0 trên 90 lần đo. Tràn ngang là trang rộng hơn màn hình, phải kéo ngang mới xem hết.
- Không có nút chết.
- Tiền khớp giữa màn và database.

Tôi gặp thêm vài lỗi nhẹ, **có từ trước, không do vòng sửa** (mục 3). Đáng để ý nhất là M1: tắt một nhân vật thì gói của nhân vật đó vẫn hiện trong bảng giá lúc lập hợp đồng, nhưng thêm vào thì không lưu được.

---

## 1. Bảng số đo

### 1.1 Bài thử tự động (tử số / mẫu số, tôi tự chạy)

| # | Lệnh (trong bản tách `d417acf`) | Kết quả thật |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile --offline` | Xanh, 3,8 giây |
| 2 | `apps/api: npx tsc --noEmit` | **0 lỗi** |
| 3 | `apps/api: npx vitest run`, `TEST_DATABASE_URL=…/makeup_test_cham_lai` (database mới) | **597/597** bài, **48/48** tệp, 376,9 giây |
| 3a | Cửa gác 10 phép (bộ kiểm chặn studio này xem hoặc sửa dữ liệu studio khác) | scope **99/99** · outsider **99/99** · noPerms **99/99** · unauth **109/109** · crossId **50/50** · leak **40/40** · refBase **45/45** · crossRef **107/107** · keep **99/99** · platform **40/40** |
| 3b | Cửa gác "sửa một phần" | partialStatic **21/21** · partialKeep **21/21** · chạy thật đủ hai bước **21/21** đường PATCH |
| 3c | Đột biến có sẵn trong kho (`gate-mutants.test.ts`) | **14/14** xanh: mỗi lỗi cài vào đều làm cửa gác đỏ đúng phép |
| 3d | **Đột biến tôi tự cài** (cài lại lỗi cũ, xem bài thử có bắt không; xong trả mã về nguyên) | **8/8 bị bắt**, xem bảng 1.2 |
| 4 | `packages/shared`: `tsc` | **0 lỗi** |
| 5 | `packages/shared`: `vitest` | **108/108**, 7/7 tệp |
| 6 | `apps/web: pnpm typecheck` (2 cấu hình) | **0 lỗi** |
| 7 | `apps/web: npx vitest run`, `KHOP_HOP_DONG_DATABASE_URL=…/makeup_test_cham_lai_khop`, `KHOP_PORT=4237`, **3 lần liền** | Lần 1: **850/850** (52/52 tệp, 58,2 s). Lần 2: **850/850** (54,6 s). Lần 3: **850/850** (53,1 s). **0 bài chập chờn trong 3 lần.** Ba lần này chạy song song với trình duyệt thao tác thật, tức máy đang bận, mà vẫn xanh. |
| 7a | Bài khớp hai đầu (web và máy chủ thật nói cùng một kiểu) | `khop-hop-dong` **14/14** · `khop-kieu` **6/6**, cả 3 lần |
| 7b | Cửa gác bí mật trong vitest | **44/44**, cả 3 lần |
| 8 | `apps/web: pnpm build` | **Xanh.** Tệp chính `index-*.js` **359,86 KB** (nén còn 115,42 KB), lần trước là 859,69 KB. **Không còn cảnh báo tệp lớn hơn 500 KB.** Mỗi màn có tệp riêng, ví dụ `man-contracts` 123,95 KB, `man-schedule` 41,84 KB. Cửa gác bí mật: **"đã quét 170/170 tệp · 0 vi phạm"**. `vercel.json` kiểm khớp. |

### 1.2 Đột biến tôi tự cài

Mỗi dòng: cài lỗi → chạy bài thử liên quan → trả mã về nguyên (`git checkout`). Sau cùng bản tách sạch.

| Đột biến | Bài thử | Kết quả |
|---|---|---|
| M1. Máy chủ bỏ chốt "dòng chưa có giờ" (N2) | `xac-nhan-thieu-gio` + `contracts` | **Đỏ** 6/73 bài |
| M2. Chỉ chặn khi xác nhận, bỏ chặn ở "thêm phát sinh" | `xac-nhan-thieu-gio` | **Đỏ** 1/8 |
| M3. Chỉ chặn dòng gói, quên dòng dịch vụ | `xac-nhan-thieu-gio` | **Đỏ** 3/8 |
| M4. Web không khoá nút "Xác nhận" khi thiếu giờ | `ContractEditor.test` | **Đỏ** 1/39 |
| M5. Chữ tắt ảnh đại diện lấy 2 tiếng cuối (lỗi L2 cũ) | `Avatar.test` + lịch | **Đỏ** 7/52 |
| M6. Gợi ý tiến độ luôn 30 ngày một đợt (lỗi T1 cũ) | thu tiền | **Đỏ** 14/48 |
| M7. Bỏ thẻ "× n" ở ô lịch C | lịch | **Đỏ** 1/41 |
| M8. Máy chủ không gửi số lượng của ca | `so-luong-ca-moc-lop` | **Đỏ** 2/8 |

**Chỗ không có bài thử tự động che:** phần in (N1) chỉ là CSS lúc in. Trong kho không có bài nào kiểm bản in (tìm `ct-print-dlg`, `@media print`, `page.pdf` trong các tệp thử: 0 kết quả). Nếu ai đó sửa CSS làm hỏng in lại thì sẽ không có bài nào đỏ. Hiện tại tôi kiểm bằng tay (mục 2).

### 1.3 Đo trên app thật

| Hạng mục | Kết quả |
|---|---|
| **Tràn ngang** | 30 màn × 3 khổ: **0/60** ở 1440 và 390 (`do-tran-ngang-1440-390.tsv`), **0/30** ở 1024 (`do-tran-ngang-1024.tsv`). Mọi ảnh khác chụp trong buổi chấm cũng 0 lần tràn. |
| **Nút chết** | Bấm **111** nút trên 13 màn. 25 nút "không thấy đổi" đều có lý do: nút đã chọn sẵn ("Tất cả", "Tháng", "Đã xác nhận"), cột biểu đồ tháng có số 0, nút tải ảnh (mở hộp chọn tệp của máy), tay kéo đổi thứ tự. **0 nút chết thật.** |
| **Điều hướng** | Bấm lần lượt 8 mục thanh bên ở 1440: màn nào cũng mở đúng tiêu đề, không trắng, không lỗi. Menu "Thêm" ở 390 đủ mục (`R-menu-them-390.png`). |
| **Lượng tải lần đầu** (L8) | Mở màn đăng nhập tải **391 KB**: 1 tệp JS 351 KB và 1 tệp CSS 40 KB, chưa nén. Đăng nhập vào Lịch tải thêm **84 KB**. |
| **Tiền giữa các màn** | Bảng ngay dưới. **Khớp 100%.** |

| Hợp đồng | Màn lập HĐ / danh sách | Thu tiền | Báo cáo doanh thu | Database (tổng / cọc / đã thu) |
|---|---|---|---|---|
| HD-000001 (cô dâu + mẹ + phù dâu × 2 + phụ phí, giảm 100.000) | 5.194.000 | 5.194.000 · cọc 1.500.000 · đã thu 1.500.000 · còn 3.694.000 | 5.194.000 / 1.500.000 / 1.500.000 / còn 3.694.000 | 5.194.000 / 1.500.000 / 1.500.000 |
| HD-000002 | 3.300.000 | đã thu 1.300.000 | 3.300.000 / 1.300.000 / 1.300.000 | 3.300.000 / 1.300.000 / 1.300.000 |
| HD-000003 (bài N2, có 1 phát sinh) | 4.000.000 → 4.400.000 sau phát sinh | — | 4.400.000 / 1.400.000 / 0 | 4.400.000 / 1.400.000 / 0 |
| **Cộng studio** | | | **12.894.000** · cọc 4.200.000 · đã thu 2.800.000 · còn 10.094.000 | khớp |
| HĐKH-000001 | 15.700.000 · cọc 5.000.000 | 15.700.000 · đã thu 15.000.000 · còn 700.000 | 15.700.000 / thực thu 15.000.000 | 15.700.000 / 5.000.000 / 15.000.000 |
| HĐKH-000002 (nháp, 45 điều khoản) | 6.000.000 · cọc 2.000.000 | — | — | 6.000.000 / 2.000.000 |

Số ca trên Lịch khớp database: HD-000001 có 3 ca, HD-000002 có 2 ca, HD-000003 có 4 ca (3 dòng gốc + 1 phát sinh).

---

## 2. Kiểm lại từng lỗi cũ trên app thật

**Cách đọc cột Trạng thái:**
- **ĐÃ HẾT:** lỗi không còn.
- **CÒN:** lỗi vẫn còn.
- **MỚI PHÁT SINH:** lỗi mới do vòng sửa gây ra.

| Lỗi cũ | Trạng thái | Đã kiểm thế nào | Ảnh |
|---|---|---|---|
| **N1** In hợp đồng khoá học | **ĐÃ HẾT** | In bằng chế độ in của Chrome (`page.pdf`, giống bấm "In / Lưu PDF"). Hợp đồng ngắn HĐKH-000001 ra **1 trang**, đủ bảng tiền, điều khoản, nội quy, chỗ ký. Hợp đồng dài HĐKH-000002 (45 điều khoản) ra **3 trang**: trang 1 là điều 1–15, trang 2 là điều 16–39, trang 3 là điều 40–45 + nội quy + chỗ ký. Tôi đọc chữ trong PDF: đủ 45 điều, không trùng, không chồng chữ. In từ điện thoại (390) cũng ra 3 trang đúng như vậy. | `N1-ngan-trang-1.png`, `N1-dai-3-trang.png`, `N1-dai-390-3-trang.png`, `N1-ngan.pdf`, `N1-dai.pdf`; bản xem trên màn: `N1-ban-in-man-hinh-dai-1440.png`, `N1-ban-in-man-hinh-dai-390.png` |
| **N2** Xác nhận khi dòng chưa có giờ | **ĐÃ HẾT** | Xem chi tiết ngay dưới bảng | `N2-01` … `N2-08` (1440), `N2-390-thanh-tong-cuon3.png`, `L-lich-12-06-0-Thợngày-1440.png` |
| **T1** Gợi ý "Cọc + 2/3 đợt" | **ĐÃ HẾT** | HD-000001 (cưới 22/11), hôm nay 19/10. "Cọc + 2 đợt": cọc 19/10, đợt 1 05/11, **đợt 2 22/11**. "Cọc + 3 đợt": 19/10, 30/10, 11/11, **22/11**. HĐKH-000001 (lớp K1 kết thúc 30/11): "+2 đợt" có hạn cuối **30/11**, "+3 đợt" là 02/11, 16/11, **30/11**. Không đợt nào sau ngày cưới hay ngày kết thúc lớp. Hộp có dòng giải thích "Các đợt chia đều từ hôm nay tới ngày kết thúc lớp 30/11/2026…". Ở 390 ra cùng ngày. Tổng các đợt bằng tổng hợp đồng. | `T1-HD-000001-Cọc-2-đợt-1440.png`, `T1-HĐKH-000001-Cọc-2-đợt-1440.png`, `T1-HĐKH-000001-Cọc-3-đợt-390.png` |
| **T2** Học viện chưa có gói / gói Dùng thử | **ĐÃ HẾT** (đúng quyết định 01:40: giữ số gói, chỉ sửa lời báo và mã lỗi) | Database mới, chưa nạp gói: lưu khoá học → máy chủ trả **503** (trước là 500). Hộp báo "Tổ chức chưa được gán gói dịch vụ nên tạm thời chưa thêm mới được. Sự cố đã được ghi lại cho bộ phận vận hành — vui lòng liên hệ hỗ trợ." Nhật ký máy chủ có `NOT_CONFIGURED`, `PlanNotConfiguredError` và lệnh sửa cho người vận hành. Nạp gói `--with-trial` xong → **409**, hộp báo "Gói Dùng thử của tổ chức chưa có khoá học — liên hệ để nâng gói." Cấp gói Academy ở /quan-tri xong thì tạo khoá được. **Chưa chấm ở 390** vì sau khi cấp gói thì không còn tái hiện được trạng thái này. | `T2-01-chua-nap-goi-1440.png`, `T2-02-goi-dung-thu-1440.png` |
| **T3** Giới hạn gói chưa áp | **CÒN, theo quyết định** (01:40: không áp đợt này) | Không chấm lại | — |
| **T4** Màn đăng ký / đăng nhập / tạo tổ chức | **ĐÃ HẾT** | Có logo, thẻ căn giữa, ô nhập đầy chiều rộng, nút màu thương hiệu, liên kết "Đã có tài khoản? Đăng nhập". Lỗi hiện trong dải đỏ: sai mật khẩu, email trùng ("Email này đã được đăng ký"), mật khẩu ngắn báo ngay dưới ô. Chưa đăng nhập mà mở link sâu `/studio-chien/thu-tien` thì sang đăng nhập, đăng nhập xong quay lại đúng link. Đăng xuất đưa về màn đăng nhập. | `01-dang-ky-1440.png`, `01-dang-ky-390.png`, `01-dang-nhap-1440.png`, `01-dang-nhap-390.png`, `02-tao-to-chuc-1440.png`, `t-tao-to-chuc-390.png`, `R-dang-nhap-sai-390.png`, `R-dang-ky-mk-ngan-1440.png`, `R-dang-ky-trung-1440.png` |
| **L1** Giờ kết thúc không tự điền | **ĐÃ HẾT** | Gói 120 phút, gõ 05:00 rồi Tab: ô kết thúc tự thành **07:00**. Mẹ cô dâu (60 phút) 07:00 → 08:00. Phù dâu (45 phút) 06:00 → 06:45. Hộp thêm phát sinh: 10:00 → 10:45. | `40-L1-tu-dien-gio-ket-thuc-1440.png`, `N2-07-phat-sinh-co-gio-1440.png` |
| **L2** Chữ tắt ảnh đại diện không thống nhất | **ĐÃ HẾT** | Tôi cố ý đặt **tên hiển thị khác họ tên**: "Trần Khánh Linh" có tên hiển thị "Linh Trần", "Đỗ Hương Giang" có tên hiển thị "Giang". Chữ tắt ra giống nhau ở mọi chỗ: danh sách thợ (**LT**, **G**), đầu hàng lịch C ở 1440 và 1024, đầu cột lịch 390, thẻ ca ở chế độ "Ngày", ô chọn thợ trong hợp đồng. Lê Minh Tú cũng ra **LT**, đúng luật "chữ đầu tiếng đầu + chữ đầu tiếng cuối", phân biệt nhau bằng màu. Xem thêm lỗi nhẹ M3 về **tên ngắn** (không phải chữ tắt). | `10-tho-ten-hien-thi-1440.png`, `L-lich-11-22-0-Thợngày-1440.png`, `L-lich-11-22-1-Ngày-1440.png`, `L-lich-11-22-0-Tuần-390.png`, `42-hd2-chon-tho-trung-gio-1440.png` |
| **L3** Lịch C xuống dòng xấu | **ĐÃ HẾT** | Ở 1440 và 1024, dưới tên thợ là 2 dòng riêng: "Thợ chính" và "2 ca/tuần", không còn bẻ giữa "2 ca/tuần". Ở 390, đầu cột ghi đủ "Chưa có thợ" trên 2 dòng. Ở 1024, hàng "Chưa có thợ" xuống 2 dòng gọn. | `L-lich-11-22-0-Thợngày-1440.png`, `L-lich-11-22-0-Thợngày-1024.png`, `L-lich-11-22-0-Tuần-390.png` |
| **L4** Studio đầu tiên không tự thành mặc định | **CÒN** (không nằm trong đợt sửa) | Màn Phí di chuyển: chấm tròn của studio duy nhất vẫn trống. Trong hợp đồng thì studio này vẫn được chọn sẵn. | `21-phi-di-chuyen-1440.png` |
| **L5** Gói mặc định tắt hiện trên trang công khai | **Giữ nguyên, theo quyết định** | Trang công khai `/trang/studio-chien` đã xuất bản, chưa có mục bảng giá | `81-trang-cong-khai-1440.png` |
| **L6** Thẻ thiết kế khi chưa có logo | **ĐÃ HẾT** | Học viện chưa có logo. Xuất PNG thật 1080×1350 cho Chào mừng, Feedback, Lời chúc: **không còn ô vuông trống hay vòng tròn trống**, tên học viện vẫn in. Màn báo riêng "Chưa có logo: ảnh bỏ ô logo". | `L6-ghep-3-the.png`, `L6-chao-mung-khoa-hoc-xuat.png`, `L6-feedback-khoa-hoc-xuat.png`, `L6-loi-chuc-khoa-hoc-xuat.png`, `L6-chao-mung-khoa-hoc-1440.png` |
| **L7** Thiếu "× 2" trên Lịch | **CÒN MỘT CHỖ** | Phù dâu 2 người (HD-000001, 22/11), xem từng ô dưới bảng. Hộp chi tiết ca ở 390 ghi đủ "Phù dâu — Phù dâu × 2". | xem ngay dưới bảng |
| **L8** Bản web một tệp 860 KB | **ĐÃ HẾT** | Tệp chính còn 360 KB (nén 115 KB), mỗi màn tải riêng, build không còn cảnh báo. Số đo tải thật ở mục 1.3. | `log-web-build.txt` |
| **L9** Chữ bị cắt ở 390 | **ĐÃ HẾT** | Ô tìm khách ghi "Tên, SĐT", vừa ô, không cắt. Liên kết "Mở hợp đồng" ở Thu tiền nằm trên 1 dòng (đo được 1 dòng, cao 15 px). | `t-hop-dong-moi-390.png`, `L9-thu-tien-chi-tiet-390.png` |
| **L10** Bài thử chập chờn | **Không thấy nữa** | 3 lần chạy toàn bộ web: 850/850 cả 3 lần | `log-web-vitest-1.txt`, `-2`, `-3` |

### N2: kiểm chi tiết

1. **Lập hợp đồng có 3 dòng:** cô dâu có giờ 05:00–07:00; mẹ cô dâu không giờ; phù dâu chỉ có giờ bắt đầu (tôi xoá giờ kết thúc). Thêm cả một phụ phí.
   - Nút "Xác nhận hợp đồng" **bị khoá**.
   - Dải đỏ: "2 dòng chưa có giờ — nhập giờ mới xác nhận được: **Dòng 2 · Mẹ cô dâu, Dòng 3 · Phù dâu**". Đúng 2 dòng thiếu giờ. Không kể dòng cô dâu, không kể phụ phí.
   - Bấm tên dòng thì màn cuộn tới dòng đó, ô giờ viền đỏ.
   - Ảnh: `N2-01-chan-xac-nhan-1440.png`, `N2-02-bam-ten-dong-cuon-toi-1440.png`.
2. **Nhập giờ kết thúc cho phù dâu:** dải còn 1 dòng (Mẹ cô dâu), nút vẫn khoá.
3. **Lách giao diện:** tôi gọi thẳng `POST /contracts/:id/status {"to":"CONFIRMED"}`. Máy chủ trả **409** `LINES_MISSING_TIME`, lời: "Dòng "Mẹ cô dâu — Mẹ cô dâu" chưa có giờ bắt đầu và giờ kết thúc — nhập giờ cho mọi dòng trước khi xác nhận hợp đồng". Hợp đồng vẫn là Nháp (`n2-api-lach.txt`).
4. **Nhập giờ mẹ 07:00:** dải đỏ mất, bấm xác nhận được. Kết quả: "Đã xác nhận hợp đồng · đã tạo 3 lịch (3 lịch chưa có thợ — ở hàng Chưa có thợ)" (`N2-04-xac-nhan-sau-du-gio-1440.png`).
5. **Thêm phát sinh không giờ** vào hợp đồng đã chốt: bấm "Thêm phát sinh" thì hộp báo "Dòng phát sinh phải có giờ bắt đầu và giờ kết thúc để lên lịch", không thêm (`N2-06-phat-sinh-khong-gio-bam-them-1440.png`). Gọi thẳng máy chủ `POST /lines` không giờ: **409**, số dòng vẫn 5, không có gì được ghi (`n2-api-phat-sinh.txt`).
6. **Thêm phát sinh có giờ** 10:00 (tự điền 10:45): thêm được. Lịch 06/12 có **4 ca** ở hàng "Chưa có thợ": 05:00, 07:00, 08:00, 10:00 (`L-lich-12-06-0-Thợngày-1440.png`).
7. **Ở 390:** dải đỏ và thanh tổng dính đáy không che nội dung. Cuộn tới cuối thì **0 ô bị che** (`N2-390-thanh-tong-cuon3.png`).

### L7: từng chế độ, từng khổ

| Chế độ | 1440 | 1024 | 390 |
|---|---|---|---|
| C "Thợ × ngày" (lưới tuần) | Có, thẻ "× 2" riêng, không bị cắt (`L-lich-11-22-0-Thợngày-1440.png`) | Có: "06:00 × 2" (`…-1024.png`) | Ô lưới chỉ ghi giờ cho mọi ca (kiểu thiết kế của lưới điện thoại). Danh sách ca bên dưới ghi "Phù dâu — Phù dâu × 2" (`L-lich-11-22-0-Tuần-390.png`) |
| B "Ngày" | Có (`L-lich-11-22-1-Ngày-1440.png`) | Có | Có (`L-lich-11-22-1-Ngày-390.png`) |
| A "Cột thợ" | Có: "Phù dâu — Phù dâu × 2" | Có, vừa ô (`L-lich-11-22-2-Cộtthợ-1024.png`) | **BỊ CẮT:** ô ghi "Phù dâu — Phù dâu …", mất "× 2" (đo: chữ rộng 133 px, ô 131 px, cắt bằng dấu "…") (`L7-cot-tho-390-cot-ha.png`) |

Chỗ gây lỗi: `apps/web/src/features/schedule/StaffColumnsA.tsx:110` ghi `kindText(a)` cả cụm vào một ô, mà ô này có `white-space: nowrap; text-overflow: ellipsis` (`schedule.css:286`). Lưới C đã tách "× n" thành thẻ riêng; chế độ A thì chưa.

---

## 3. Lỗi mới thấy (xếp theo mức nặng)

**Không có lỗi nặng mới. Không có lỗi nào do vòng sửa gây ra (hồi quy).**

Tôi đã đi lại luồng chính:
- Studio: đăng ký → tạo 2 tổ chức → bậc lương, thợ → dịch vụ, phụ phí, phí đi lại, gói → khách → 3 hợp đồng dịch vụ → lịch → tiến độ và phiếu thu → báo cáo, sổ thu → thương hiệu, trang công khai → thẻ Lời chúc xuất PNG.
- Học viện: khoá 1 lớp, khoá nhiều lớp K1/K2 → hợp đồng khoá học (học viên mới, khoản khác, giảm giá, mẫu điều khoản, nội quy) → xác nhận → bản in → thu tiền → báo cáo → 3 thẻ thiết kế.
- Thêm: đổi khách trên hợp đồng nháp đã lưu (ở 390): "Đã đổi sang Vũ Thị Hồng Nhung — đã lưu vào hợp đồng", tải lại trang vẫn đúng (`R-doi-khach-xong-390.png`).

Các lỗi dưới đây **có từ trước**. Vòng sửa không đụng vào các tệp này.

### TRUNG BÌNH

**M1. Tắt một nhân vật thì gói của nhân vật đó vẫn bày trong bảng giá lúc lập hợp đồng; thêm vào thì không lưu được, tiền thành "—"**
- **Triệu chứng:** Bảng giá → Nhân vật → gạt tắt "Mẹ cô dâu". Vào Lập hợp đồng, cột Bảng giá vẫn có gói "Mẹ cô dâu 800.000 ₫" và nút thêm. Thêm vào thì Tạm tính và Tổng hiện "—". Bấm Lưu nháp thì báo "Nhân vật "Mẹ cô dâu" đang ẩn" và hợp đồng không được tạo.
- **Vì sao đáng để ý:** công tắc chỉ cần **một chạm**, không hỏi lại. Trên công tắc đang tắt, chữ nổi khi rê chuột vẫn là "Đang dùng". Chủ studio lỡ chạm thì sẽ gặp đúng cảnh này khi lập hợp đồng mà không hiểu vì sao.
- **Tái hiện:** Bảng giá → Nhân vật → gạt tắt một nhân vật đang có gói → Hợp đồng → Lập hợp đồng → thêm gói của nhân vật đó → Lưu nháp.
- **Ảnh:** `R-nhan-vat-bi-an-1440.png`, `R-hd-goi-nhan-vat-an-luu-1440.png`.
- **Chỗ trong mã:**
  - Danh sách gói không lọc nhân vật đang ẩn: `apps/web/src/features/contracts/CatalogPicker.tsx:40-42`.
  - Máy chủ chặn đúng: `apps/api/src/modules/contracts/sheet.ts:172`.
  - Chữ của công tắc cố định "đang dùng" dù đang tắt: `apps/web/src/features/pricing/SubjectsPage.tsx:161-162`, `aria-label` và `title`. Thuộc tính `aria-checked` thì vẫn đúng.

### NHẸ

- **M2. L7 còn ở 390, chế độ "Cột thợ".** Xem bảng L7 ở trên. Chỗ trong mã: `StaffColumnsA.tsx:110`, `schedule.css:286`.
- **M3. Tên ngắn trên lịch lấy tiếng cuối của tên hiển thị.**
  - Thợ có tên hiển thị "Linh Trần" thì đầu cột lịch 390 ghi "**Trần**", và cảnh báo trong hợp đồng ghi "**Trần** có lịch trong ngày · 1 ca".
  - Nếu thợ đặt tên kiểu "Hà Makeup" thì sẽ ra "Makeup".
  - Chữ tắt ảnh đại diện vẫn đúng. Lỗi chỉ ở chữ tên.
  - Ảnh: `L-lich-11-22-0-Tuần-390.png`.
  - Mã: `apps/web/src/features/schedule/WeekGridCMobile.tsx:15-18`; `apps/web/src/features/contracts/model.ts:725-731` (`shortName`, `lastName`).
  - Có từ trước. Lỗi chỉ lộ ra khi tên hiển thị không theo thứ tự họ trước, tên sau.
- **M4. Ở 1024, chế độ "Cột thợ", đầu cột "Chưa có thợ" bị cắt thành "Chưa có t…".** Lưới C và 390 thì đã sửa (L3), chế độ này chưa. Ảnh: `L-lich-11-22-2-Cộtthợ-1024.png`. Mã: `StaffColumnsA.tsx:53`.
- **M5. Dòng chỉ có giờ bắt đầu thì toàn bộ tiền thành "—".**
  - Khi một dòng có giờ bắt đầu mà ô giờ kết thúc bị xoá trống, Tạm tính, Tổng và "Cộng …" của **mọi dòng** đều hiện "—" cho tới khi nhập đủ.
  - Bấm Lưu thì ô thiếu được tô đỏ "Nhập đủ giờ bắt đầu và kết thúc", nên không mất dữ liệu.
  - Giờ L1 đã tự điền giờ kết thúc nên rất khó gặp.
  - Ảnh: `N2-01-chan-xac-nhan-1440.png` (Tổng "—"), `N2-03-luu-nhap-1440.png`.
  - **Chưa chấm được** lỗi này có từ bản trước hay không, vì tôi không dựng lại bản `74fda02`.

---

## 4. Anh Chiến vào thao tác thật được chưa — còn chặn gì

**Studio dịch vụ makeup: ĐƯỢC.**
- Hai điều phải nhớ ở lần trước đã được sửa: không còn xác nhận nhầm hợp đồng thiếu giờ; gợi ý chia đợt không còn đặt hạn sau ngày cưới.
- Tiền khớp ở mọi màn. Ca hiện đủ trên Lịch.
- Chỉ cần nhớ một điều: **đừng gạt tắt nhân vật ở Bảng giá → Nhân vật** nếu nhân vật đó còn gói đang bán (M1). Nếu lỡ tắt, gạt bật lại là hợp đồng lưu được ngay.

**Học viện (đào tạo): ĐƯỢC, với một điều kiện vận hành.**
- In hợp đồng khoá học đã đúng, cả hợp đồng dài (N1).
- Học viện mới vẫn **phải được cấp gói có khoá học** thì mới mở được khoá. Đây là việc thương mại anh đã quyết giữ (T2). Nay màn đã báo rõ "liên hệ để nâng gói", không còn lỗi 500.
- Người vận hành cấp gói bằng 2 lệnh `platform:seed-plans -- --with-trial` và `platform:grant-admin`, rồi màn /quan-tri → "Đổi gói / gia hạn". Tôi đã làm lại trọn trình tự này trong buổi chấm và chạy đúng.

**Không còn gì chặn việc vào thao tác thật.** Nên sửa khi tiện:
1. M1: ẩn gói của nhân vật đang tắt khỏi bảng giá khi lập hợp đồng, sửa chữ của công tắc.
2. M2 và M4: hai chỗ cắt chữ ở chế độ "Cột thợ".
3. Thêm một bài thử tự động cho bản in. Hiện không có bài nào che N1 (mục 1.2).
4. Anh quyết khi nào áp giới hạn gói (T3) và có muốn studio đầu tiên tự thành mặc định không (L4).

---

## 5. Chưa chấm được

- **T2 ở khổ 390:** chưa chấm được, vì sau khi cấp gói Academy thì không còn tái hiện được trạng thái "chưa có gói". Ở 1440 đã chấm cả hai trường hợp.
- **M5 có từ bản trước hay không:** chưa chấm được, vì không dựng lại bản `74fda02`.
- **Quyền theo vai trò** (thợ, lễ tân, kế toán, giảng viên đăng nhập thấy gì): chưa chấm được, vì lần này chỉ dùng tài khoản chủ.
- **Điện thoại thật, Safari iPhone, máy in thật:** chưa chấm được. Tôi dùng Chromium giả lập 390 và lệnh in `page.pdf`.
- **Chạy trên máy chủ thật (Vercel, Railway, S3):** chưa chấm được.
- **T3:** không chấm lại, theo quyết định không áp đợt này.

---

## 6. Phụ lục

- **Thư mục chấm:** `/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-lai/`
  - `anh/`: 244 ảnh và PDF.
    - `N1-*`: bản in. Tệp `*-trang-*.png` là từng trang PDF.
    - `N2-*`, `T1-*`, `T2-*`, `L*-*`: từng lỗi cũ.
    - `R-*`: kiểm hồi quy.
    - `t-*`: vòng đi 30 màn × 1440, 1024, 390.
  - Nhật ký lệnh:
    - Máy chủ: `log-api-tsc.txt`, `log-api-vitest.txt`, `log-api-server.txt`.
    - Shared: `log-shared.txt`.
    - Web: `log-web-tsc.txt`, `log-web-vitest-1.txt`, `log-web-vitest-2.txt`, `log-web-vitest-3.txt`, `log-web-build.txt`.
    - Đột biến: `log-dot-bien.txt`.
    - Tràn ngang: `do-tran-ngang-1440-390.tsv`, `do-tran-ngang-1024.tsv`.
    - Gọi thẳng máy chủ: `n2-api-lach.txt`, `n2-api-phat-sinh.txt`.
  - `pw/`: các bài thao tác Playwright.
    - Dựng dữ liệu: `a*`, `b*`, `g*`, `e1`, `f1-f2`, `k6`.
    - Kiểm lỗi: `n1-in`, `n2-*`, `t1-tiendo`, `l-lich`, `l7-390`, `l8`, `l9`.
    - Đi màn, nút, tiền: `t1-tour*`, `t2-nut`, `t3*`.
    - Hồi quy: `r-*`.
    - Liên kết `pw/node_modules` trỏ vào bản tách đã gỡ. Muốn chạy lại thì phải dựng lại bản tách.
- **Database còn giữ:** `makeup_test_cham_lai_dung`. Tài khoản chủ là `chien.chu@studio-thu.vn`, mật khẩu `MatKhau@2026x` (chỉ dùng trên máy thử).
