# Biên bản nghiệm thu lần 3 — Makeup Pro (bản `6df580a`)

- **Ngày chấm:** 19/10/2026, giờ máy khoảng 00:45–01:40 UTC (sáng 19/10 giờ Việt Nam).
- **Người chấm:** thợ chấm độc lập (AI). Tôi chỉ đọc, đo và chụp. Tôi không sửa mã, không lưu (commit), không đẩy gì lên kho, không đụng database `makeup_dev`.
- **Bản được chấm:** commit `6df580a`. Bản này sửa các lỗi còn lại trong biên bản nghiệm thu lại (bản `d417acf`): W2 (L7/M2 ở 390, M4), W1 (M1, M5, N1 bài thử bản in), W3 (M3 tên ngắn), Z2 (lệnh chạy thử tự đọc `.env`). Luật tên ngắn theo dòng 09:30 của `docs/NHAT-KY-QUYET-DINH-THAY.md`.
- **Cách chấm:** làm trên một **bản tách riêng** (worktree) ở `scratchpad/cham-3/kho`. Bản tách không có tệp `.env`, và mọi lệnh chạy máy chủ đều đặt `DATABASE_URL`/`DIRECT_URL` trỏ database thử ngay trong lệnh. Chấm xong tôi đã gỡ bản tách bằng `git worktree remove --force`.
- **Database thử:**
  - `makeup_test_cham3`: bài thử máy chủ. Đã xoá.
  - `makeup_test_cham3_khop`: bài "khớp hai đầu" của web. Đã xoá.
  - `makeup_thu_cham3`: kiểm tài liệu chạy thử trên bản clone sạch. Đã xoá.
  - `makeup_test_cham3_dung`: thao tác thật trên app. **Còn giữ** để tái hiện lỗi (xem mục 6).
  - Cả bốn database được tạo mới, bật `btree_gist`, áp migration bằng `pnpm --filter api db:deploy-to <url>`. Lần nào lệnh cũng báo "kiểm lại: khớp".
- **Máy chủ đã tắt theo PID** (không dùng `pkill -f`):
  - API cổng 4290: 28974, 28977, 29013, 29019, 29037, 29055.
  - Web bản build (`vite preview`) cổng 5350: 28975, 28978, 29006, 29007, 29044.
  - Lần thử tài liệu (API 4291, web 5351): tắt bằng Ctrl+C (gửi SIGINT cho đúng nhóm tiến trình tôi mở, 13896 và 13948). Sau đó không còn tiến trình nào, cả hai cổng đã đóng.
- **Ảnh:** 267 ảnh/PDF ở `scratchpad/cham-3/anh/`. Nhật ký lệnh ở `scratchpad/cham-3/log/`.

---

## 0. Kết luận ngắn cho anh Chiến

**Cả 7 mục cần sửa của lần trước đều ĐÃ HẾT: M1, M2 (L7), M3, M4, M5 và N1.** Tôi kiểm từng mục trên app thật ở 3 khổ màn 1440, 1024 và 390, và có ảnh.

- **M1. Tắt nhân vật thì gói của nhân vật đó không còn bày khi lập hợp đồng.** Đúng ở cả 3 chỗ chọn gói. Nếu hợp đồng nháp cũ đã có dòng của nhân vật đó, màn báo rõ dòng nào và vì sao. Công tắc cũng ghi đúng "đang ẩn".
- **M2 (L7). Chế độ "Cột thợ" ở điện thoại không còn mất "× 2".**
- **M3. Tên ngắn của thợ theo đúng luật anh duyệt.** Thợ có tên hiển thị thì ghi nguyên tên đó ("Linh Trần", "Hà Makeup"). Thợ chưa có tên hiển thị thì ghi tiếng cuối ("Tú", "Hà").
- **M4. Ở 1024, đầu cột "Chưa có thợ" xuống 2 dòng, không còn bị cắt.**
- **M5. Một dòng thiếu giờ kết thúc không còn làm mất tiền của cả hợp đồng.**
- **N1. Đã có bài thử tự động cho bản in.** Tôi tự phá 8 luật in khác nhau. Lần nào bài thử cũng đỏ, tức là bắt được.

**Bài thử tự động đều xanh, số tôi tự đo:**
- Máy chủ: 607/607.
- Cửa gác (bộ kiểm chặn studio này xem hoặc sửa dữ liệu studio khác): 787/787.
- Web: 889/889, chạy 3 lần liền đều xanh.
- Tôi tự cài lại 16 lỗi cũ vào mã. Bài thử bắt được cả 16.

**Hồi quy** (sửa chỗ này mà làm hỏng chỗ khác): **không thấy lỗi nào do vòng sửa gây ra.**
- Tràn ngang (trang rộng hơn màn hình, phải kéo ngang): 0 trên 93 lần đo.
- Nút chết: 0.
- Tiền khớp 100% giữa các màn và database.

**Tài liệu chạy thử trên máy** (`docs/CHAY-THU-TREN-MAY.md`): mọi lệnh trần đều chạy được trên một bản lấy mã mới từ GitHub. Chỉ có một chỗ ghi cũ: tài liệu ghi bản `d417acf`, trong khi lệnh trần chỉ chạy được từ bản có Z2 trở đi.

**Lỗi mới thấy: không có lỗi nặng.** Có 1 lỗi trung bình và 4 lỗi nhẹ, đều có từ trước, không do vòng sửa này gây ra. Đáng để ý nhất là **R1**:
- Nhân vật đã tắt mà gói của nó đang bật "hiện trên trang công khai" thì gói **vẫn hiện trên trang giới thiệu công khai**, ở mục "Gói khác".
- Khách xem thấy giá, nhưng studio không lập được hợp đồng cho gói đó.

---

## 1. Bảng số đo (tôi tự chạy, in tử số / mẫu số)

### 1.1 Bài thử tự động

| # | Lệnh (trong bản tách `6df580a`) | Kết quả |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | Xanh, 3,9 giây |
| 2 | `apps/api`: `npx tsc --noEmit` | **0 lỗi** |
| 3 | `apps/api`: `npx vitest run`, chạy trên database mới `makeup_test_cham3` | **607/607** bài, **50/50** tệp, 390,7 giây |
| 3a | Cửa gác, 10 phép | scope **99/99** · outsider **99/99** · noPerms **99/99** · unauth **109/109** · crossId **50/50** · leak **40/40** · refBase **45/45** · crossRef **107/107** · keep **99/99** · platform **40/40**. Cộng **787/787**, khớp số thợ báo. |
| 3b | Cửa gác "sửa một phần" | partialStatic **21/21** · partialKeep **21/21** · chạy thật đủ hai bước **21/21** đường PATCH |
| 3c | Đột biến có sẵn trong kho (`gate-mutants.test.ts`) | **14/14** xanh: cài lỗi nào thì cửa gác đỏ đúng phép đó |
| 4 | `packages/shared`: `tsc` + `vitest` | **0 lỗi** · **108/108** bài, 7/7 tệp |
| 5 | `apps/web`: `pnpm typecheck` (2 cấu hình) | **0 lỗi** |
| 6 | `apps/web`: `npx vitest run`, `KHOP_HOP_DONG_DATABASE_URL=…/makeup_test_cham3_khop`, `KHOP_PORT=4297`, **3 lần liền** | Lần 1: **889/889** (57/57 tệp, 58,8 s). Lần 2: **889/889** (56,8 s). Lần 3: **889/889** (59,0 s). **0 bài chập chờn** (bài lúc qua lúc không). Lúc chạy, máy đang bận chạy song song bài máy chủ và trình duyệt. |
| 6a | Bài khớp hai đầu (web và máy chủ thật nói cùng một kiểu dữ liệu) | `khop-hop-dong` **14/14** · `khop-kieu` **6/6**, cả 3 lần. Trường mới `fullName` cũng đã được so. |
| 6b | Bài in mới (N1) | `ContractPrint.pdf.test.ts` **2/2** (in PDF thật bằng Chromium ở `/opt/pw-browsers`) · `contracts-print-css.test.ts` **5/5**, cả 3 lần |
| 6c | Bài tên ngắn mới (M3) | `staffName.test.ts` **9/9** · `staffName.lich.test.tsx` **4/4** · `StaffPicker.tenNgan.test.tsx` **1/1** |
| 6d | Cửa gác bí mật trong vitest | **44/44**, cả 3 lần |
| 7 | `apps/web`: `pnpm build` | **Xanh.** Tệp chính `index-*.js` **359,86 KB** (nén còn 115,42 KB); `man-contracts` 127,69 KB; `man-schedule` 41,97 KB. Cửa gác bí mật: **"đã quét 170/170 tệp · 0 vi phạm"**. `vercel.json` kiểm khớp. Trang in thử `__in-thu__` **không lọt vào bản build** (đã tìm trong `dist`, không có). |

### 1.2 Đột biến tôi tự cài

Mỗi dòng: cài lại một lỗi cũ → chạy bài thử liên quan → trả mã về nguyên (`git checkout`). Sau cùng bản tách sạch.

**a) Các lỗi M1–M5 (`log/dot-bien.txt`):**

| Đột biến | Kết quả |
|---|---|
| D1. M1: bảng giá lúc lập hợp đồng bày lại mọi gói | **Đỏ**: `ContractEditor.test` "M1: nhân vật đang ẩn → cột Bảng giá KHÔNG bày gói…" |
| D2. M1: công tắc nhân vật luôn ghi "đang dùng" | **Đỏ**: `PricingPage.test` "M1: công tắc nhân vật đang tắt → tên đọc 'đang ẩn'…" |
| D3. M2/L7: chế độ "Cột thợ" gộp "× n" vào ô rút gọn như cũ | **Đỏ**: `SchedulePage.test` "BẮT (M2): chế độ Cột thợ — '× 2' là thẻ riêng" |
| D4. M4: bỏ luật xuống dòng của "Chưa có thợ" | **Đỏ**: `SchedulePage.test` "M4 … BẮT (CSS)" |
| D5. M3: tên ngắn luôn lấy tiếng cuối của tên hiển thị (lỗi cũ) | **Đỏ** 11 bài (`staffName.lich`, `ContractEditor` "Linh Trần"…) |
| D6. M3: lưới điện thoại tự rút tên riêng, bỏ hàm chung | **Đỏ** 2 bài (`staffName.lich`) |
| D7. M5: lỗi chỉ về giờ lại chặn cả bảng tính | **Đỏ** 3 bài (`ContractEditor.test` M5, `model.test` M5) |
| D8. M3 phía máy chủ: không gửi họ tên của thợ trong hợp đồng | **Đỏ** 2 bài (`apps/api/test/ten-ngan-tho.test.ts`) |

**b) N1: tôi tự phá luật in trong `contracts.css` (`log/n1-dot-bien.txt`):**

| Đột biến | Bài in PDF thật | Bài đọc CSS |
|---|---|---|
| P1. Lớp phủ vẫn `fixed` (bỏ `position: static`) | **Đỏ** cả 2 bài: "bản in không được nằm trong khối fixed" | **Đỏ** |
| P2. Không ẩn màn ứng dụng phía sau | **Đỏ** cả 2 bài | **Đỏ** |
| P3. Thân hộp thoại vẫn cuộn bên trong (`overflow: auto`) | xanh | **Đỏ** |
| P4. Hộp thoại giữ `max-height` | xanh | **Đỏ** |
| P5. Thêm một luật ghi đè ở cuối khối in, làm thân hộp cuộn và cao tối đa 70vh | **Đỏ**: "khối cha cuộn/cắt nội dung khi in" | xanh (bài đọc CSS chỉ đọc luật đầu tiên) |
| P6. Bỏ luật ẩn đầu và chân hộp thoại | **Đỏ** cả 2 bài (in ra 5 trang thay vì tối đa 4) | **Đỏ** |
| P7. Bỏ khổ A4 ở `@page` | xanh | **Đỏ** |
| P8. Bỏ cả khối `@media print` | **Đỏ** cả 2 bài | **Đỏ** 4/5 |

**Kết luận: 8/8 lần phá đều bị bắt.** Hai bài bù cho nhau: bài đọc CSS bắt P3, P4, P7; bài PDF bắt P5. Sau cùng `contracts.css` trùng md5 với bản gốc và `git status` sạch.

Bài in PDF chạy trên một **trang in thử** (`__in-thu__`). Trang này dựng đúng hộp in và CSS như màn thật, nhưng không phải chính màn Hợp đồng. Vì vậy tôi in thêm từ app thật (mục 2, N1).

**Thợ ghi "16/16 đột biến".** Tôi không chạy lại bộ đột biến của thợ. Tôi tự cài 16 đột biến của riêng tôi (8 ở bảng a, 8 ở bảng b) và bài thử bắt được cả 16.

### 1.3 Đo trên app thật

| Hạng mục | Kết quả |
|---|---|
| **Tràn ngang** | 31 màn × 3 khổ (1440, 1024, 390): **0/93** lần tràn (`do-tran-ngang.tsv`, `log/tour.txt`). Các ảnh khác chụp trong buổi chấm cũng 0 lần tràn. |
| **Nút chết** | Bấm **120** nút trên 15 màn (`log/nut.txt`). 21 nút "không thấy đổi" đều có lý do: nút đã chọn sẵn ("Thợ × ngày", "Tất cả", "Tháng", "Đã xác nhận", "Thu"); cột biểu đồ tháng có số 0; ô "Làm ở đâu" và ô "Loại hợp đồng" của hợp đồng đã chốt đang khoá đúng (`aria-disabled`); chip "Chưa xếp nhóm" khi mọi khoá đã cùng một nhóm. **0 nút chết thật.** |
| **Lỗi trang** | Không có lỗi JavaScript. Lỗi mạng duy nhất là 404 khi mở trang công khai lúc chưa xuất bản, đúng như thiết kế. |
| **Tài khoản thợ** | Đăng nhập bằng thợ "Linh Trần" (Trần Khánh Linh). Lịch 3 chế độ ở 1440 và 390 chỉ thấy ca của mình (2 ca), đầu hàng ghi "Linh Trần" (`R-tho-linh-lich-*`). |

**Tiền giữa các màn** (đối chiếu với database):

| Hợp đồng | Danh sách HĐ | Báo cáo doanh thu (tổng / cọc / đã thu / còn) | Database (tổng / cọc / đã thu) |
|---|---|---|---|
| Studio HD-000001 (cô dâu + mẹ + phù dâu × 2 + phụ phí, giảm 100.000) | 5.194.000 | 5.194.000 / 1.500.000 / 1.500.000 / 3.694.000 | 5.194.000 / 1.500.000 / 1.500.000 |
| Studio HD-000002 | 3.300.000 | 3.300.000 / 1.300.000 / 1.300.000 / 2.000.000 | 3.300.000 / 1.300.000 / 1.300.000 |
| Studio HD-000003 (xác nhận ở 390, chưa có thợ) | 400.000 | 400.000 / 100.000 / 0 / 400.000 | 400.000 / 100.000 / 0 |
| **Cộng studio** | | **8.894.000** · cọc 2.900.000 · đã thu 2.800.000 · còn 6.094.000. Sổ thu: 2.800.000, 2 phiếu. | khớp |
| Học viện HĐKH-000001 (16.200.000 − giảm 500.000) | 15.700.000 | 15.700.000 / 5.000.000 / 5.000.000 / 10.700.000 | 15.700.000 / 5.000.000 / 5.000.000 |
| Học viện HD-000001 (dịch vụ makeup) | 600.000 | 600.000 / 200.000 / 0 / 600.000 | 600.000 / 200.000 / 0 |
| **Cộng học viện** ("Tất cả") | | **16.300.000** · cọc 5.200.000 · đã thu 5.000.000 · còn 11.300.000 | khớp |

Ca trên Lịch khớp database:
- HD-000001 có 3 ca, ngày 22/11.
- HD-000002 có 2 ca, ngày 22/11.
- HD-000003 có 1 ca không thợ, ngày 29/11, ở hàng "Chưa có thợ".

---

## 2. Trạng thái từng mục

**Cách đọc cột Trạng thái:**
- **ĐÃ HẾT:** lỗi không còn.
- **CÒN:** lỗi vẫn còn.

| Mục | Trạng thái | Đã kiểm thế nào | Ảnh (trong `anh/`) |
|---|---|---|---|
| **M1** Nhân vật ẩn vẫn bày gói | **ĐÃ HẾT** | Xem chi tiết M1 ngay dưới bảng. | `M1-cong-tac-tat-1440`, `M1-hd-moi-bang-gia-{1440,1024,390}`, `M1-hd-da-chot-cot-trai-{1440,1024}`, `M1-them-phat-sinh-390`, `M1-hd-nhap-dong-an-{1440,1024,390}`, `M1-hd-nhap-dong-an-cuon-*`, `M1-hd-nhap-dong-an-luu-1440`, `M1-hd-nhap-bo-dong-an-1440` |
| **M2 / L7** "× 2" bị cắt ở 390, chế độ "Cột thợ" | **ĐÃ HẾT** | Ca phù dâu 2 người, 22/11, cột của Phạm Thu Hà. Ở 390, ô ghi "Phù dâu — Phù d… **× 2**": tên loại ca rút gọn bằng "…", còn "× 2" là thẻ riêng, nằm trọn trong thẻ ca. Ở 1440 và 1024: "Phù dâu — Phù dâu × 2" đủ chữ. Ở lưới C, "× 2" là thẻ riêng. Ở chế độ Ngày: "Phù dâu — Phù dâu × 2". Ở lưới tuần 390: danh sách dưới lưới có "× 2". Hộp chi tiết ca ghi "Phù dâu — Phù dâu × 2". | `M2-cot-tho-390-cot-ha`, `M2-chi-tiet-ca-390`, `M1-lich-11-22-{Cộtthợ,Thợngày,Ngày}-{1440,1024}`, `M1-lich-11-22-{Tuần,Ngày}-390`; số đo: `log/m-lich-1.txt` |
| **M3** Tên ngắn của thợ | **ĐÃ HẾT** (đúng luật dòng 09:30) | Xem chi tiết M3 ngay dưới bảng. | `M1-lich-11-22-*` (5 thợ), `M3a-lich-*` (hai Hà trùng tên), `M3b-lich-*` ("Hà Makeup"), `M3-hd-hai-ha-1440`, `M3-hd-ha-makeup-1440`, `M3-o-chon-tho-hai-ha-1440` |
| **M4** "Chưa có thợ" bị cắt ở 1024, chế độ "Cột thợ" | **ĐÃ HẾT** | Ngày 29/11 có một ca chưa có thợ. Ở 1024, đầu cột ghi đủ "Chưa có / thợ" trên 2 dòng (cao 35 px), không có "…". Ở 1440, đủ chữ. Lưới C ở 1024 cũng xuống 2 dòng, như L3 trước. | `M1-lich-11-29-Cộtthợ-1024`, `M1-lich-11-29-Cộtthợ-1440`, `M1-lich-11-29-Thợngày-1024` |
| **M5** Dòng thiếu giờ kết thúc làm mất tiền | **ĐÃ HẾT** | Xem chi tiết M5 ngay dưới bảng. | `M5-dong-thieu-gio-ket-thuc-{1440,1024,390}`, `M5-sau-luu-{1440,1024,390}`, `M5-hop-phat-sinh-thieu-gio-390`; `log/m5.txt` |
| **L7** (gốc của M2) | **ĐÃ HẾT** ở mọi chế độ và mọi khổ | Như dòng M2 | như trên |
| **N1** Bản in hợp đồng khoá học và bài thử bảo vệ bản in | **ĐÃ HẾT** | Xem chi tiết N1 ngay dưới bảng. | `N1-ngan.pdf`, `N1-ngan-trang-1`, `N1-dai.pdf`, `N1-dai-3-trang`, `N1-dai-tu-390.pdf`, `N1-ban-in-man-hinh-{ngan,dai}-1440`, `N1-ban-in-man-hinh-dai-390` |

**M1: kiểm chi tiết**
1. **Công tắc:** ở Bảng giá → Nhân vật, tôi gạt tắt "Mẹ cô dâu".
   - Tên đọc của công tắc đổi từ "Mẹ cô dâu: đang dùng" sang "Mẹ cô dâu: **đang ẩn**".
   - Chữ nổi khi rê chuột: "Đang ẩn — gói của nhân vật này không hiện khi lập hợp đồng. Bật để dùng lại".
   - Tải lại trang vẫn đúng.
2. **Ba chỗ chọn gói đều không còn bày gói "Mẹ cô dâu", và không còn chip lọc "Mẹ cô dâu".** Mỗi chỗ đều có dòng "1 gói của nhân vật đang ẩn (Mẹ cô dâu) không hiện ở đây. ?". Ba chỗ là:
   - cột Bảng giá khi lập hợp đồng mới (1440, 1024);
   - ngăn kéo "Thêm từ bảng giá" trên điện thoại (390);
   - "Thêm phát sinh" của hợp đồng đã chốt HD-000001: cột trái ở 1440 và 1024, hộp phát sinh ở 390.
3. **Hợp đồng nháp lập trước khi tắt** (HD-000005, có dòng cô dâu và dòng mẹ):
   - Dòng mẹ báo: "Nhân vật "Mẹ cô dâu" đang ẩn ở Bảng giá → Nhân vật nên dòng này chưa tính được tiền…".
   - Thanh tổng báo "Chưa tính được tổng — 1 dòng dùng nhân vật đang ẩn: **Dòng 2 · Mẹ cô dâu**". Tổng và Cọc hiện "—".
   - Dòng cô dâu vẫn hiện "Cộng cô dâu 2.500.000 ₫".
   - Nút "Xác nhận hợp đồng" bị khoá.
   - Bỏ dòng mẹ đi thì Tổng hiện lại 2.500.000 ₫.
   - Đúng như vậy ở cả 3 khổ.

**M3: kiểm chi tiết** (5 thợ, 3 chế độ lịch, 3 khổ)
1. **Đầu hàng và đầu cột lịch:**
   - "Trần Khánh Linh" có tên hiển thị "Linh Trần": ghi "**Linh Trần**". Lần trước ghi sai thành "Trần".
   - "Lê Minh Tú": ghi "Tú".
   - "Phạm Thu Hà": ghi "Hà".
   - "Đỗ Hương Giang" có tên hiển thị "Giang": ghi "Giang".
2. **Thêm thợ "Nguyễn Thu Hà"** (trùng tiếng cuối với Phạm Thu Hà): ở cả 3 chế độ, Lịch ghi tên đầy đủ cho cả hai người, "Phạm Thu Hà" và "Nguyễn Thu Hà".
3. **Đặt tên hiển thị "Hà Makeup" cho Nguyễn Thu Hà:** Lịch ghi "**Hà Makeup**" (không còn ra "Makeup") và "Hà".
4. **Chế độ B (Ngày)** ghi tên đầy đủ, đúng quyết định.
5. **Trong hợp đồng:**
   - Dải cảnh báo ghi "Linh Trần có lịch trong ngày · 1 ca".
   - Hàng thợ ghi "Hà (chính), Hà Makeup".
   - Xem thêm lỗi nhẹ R2 ở mục 3, về trường hợp hai người trùng tên trong hợp đồng.

**M5: kiểm chi tiết** (hợp đồng mới: cô dâu 06:00–08:00, phù dâu 08:00–08:45; tôi xoá giờ kết thúc của dòng phù dâu)
1. **Tiền vẫn hiện đủ:**
   - "Cộng cô dâu 2.500.000 ₫".
   - "Cộng phù dâu 400.000 ₫".
   - Tạm tính 2.900.000 ₫, Tổng 2.900.000 ₫, Cọc 1.100.000 ₫.
2. **Báo lỗi đúng chỗ:**
   - Ô giờ thiếu viền đỏ, kèm dòng "Nhập đủ giờ bắt đầu và kết thúc".
   - Dải đỏ ghi "1 dòng chưa có giờ … Dòng 2 · Phù dâu".
   - Nút Xác nhận bị khoá.
   - Bấm Lưu thì không lưu, dữ liệu trên màn còn nguyên.
3. **Hộp "Thêm phát sinh"** chỉ có giờ bắt đầu: vẫn hiện "1 × 400.000 ₫" và "Cộng phù dâu 400.000 ₫".
4. Đúng như vậy ở 1440, 1024 và 390.

**N1: kiểm chi tiết**
1. **In từ app thật** (Chromium `page.pdf` theo khổ `@page`, giống bấm "In / Lưu PDF"):
   - Hợp đồng ngắn HĐKH-000001: **1 trang**.
   - Hợp đồng dài HĐKH-000002 (45 điều khoản): **3 trang**. Đọc chữ trong PDF: đủ 45 "Điều khoản số", tiêu đề "HỢP ĐỒNG ĐÀO TẠO" chỉ 1 lần, có nội quy và chỗ ký.
   - In từ khổ 390: cũng 3 trang, 45 điều.
2. **Bài thử mới thật sự đỏ khi luật in bị phá:** 8/8 lần, xem mục 1.2 b.

**Các mục khác trong biên bản trước:**
- **T3** (giới hạn gói) và **L5** (gói mặc định tắt hiện công khai): giữ nguyên theo quyết định, không chấm lại.
- **L4** (studio đầu tiên không tự thành mặc định): không nằm trong đợt sửa, không chấm lại.

---

## 3. Lỗi mới thấy (xếp theo mức nặng)

**Không có lỗi nặng. Không có lỗi nào do vòng sửa này gây ra (hồi quy).** Các lỗi dưới đây có từ trước. Riêng R2 là chỗ vòng sửa M3 chưa phủ tới.

### TRUNG BÌNH

**R1. Nhân vật đã tắt, nhưng gói của nó vẫn hiện trên trang giới thiệu công khai, ở mục "GÓI KHÁC"**
- **Triệu chứng:**
  - Bảng giá → Nhân vật: tắt "Mẹ cô dâu". Gói "Mẹ cô dâu 800.000 ₫" lại đang bật "hiện trên trang công khai".
  - Trang `/trang/studio-chien` vẫn bày gói này, kèm giá, dưới tiêu đề "GÓI KHÁC". Đúng như vậy ở 1440 và 390.
  - Trong khi đó, lập hợp đồng thì không chọn được gói này (đúng theo M1).
- **Vì sao đáng để ý:**
  - Khách thấy giá một gói mà studio không còn bán.
  - Chữ nổi của công tắc chỉ nói gói "không hiện khi lập hợp đồng", không nhắc tới trang công khai. Chủ studio sẽ tưởng đã ẩn hết.
- **Tái hiện:**
  1. Bảng giá → Gói → bật "hiện trên trang công khai" cho một gói.
  2. Cài đặt → Thương hiệu → xuất bản trang.
  3. Bảng giá → Nhân vật → tắt nhân vật của gói đó.
  4. Mở `/trang/<đường dẫn>`.
  - Database còn giữ (`makeup_test_cham3_dung`) đang ở đúng trạng thái này.
- **Ảnh:** `R-trang-cong-khai-goi-nv-an-1440.png`, `R-trang-cong-khai-goi-nv-an-390.png`.
- **Chỗ trong mã:**
  - Máy chủ lọc gói công khai chỉ theo `isActive` và `isPublic` của gói, không xét nhân vật: `apps/api/src/modules/profile/public.ts:62-63`.
  - Danh sách nhân vật thì có lọc `isActive`: `apps/api/src/modules/profile/public.ts:87`.
  - Web nhét gói có nhân vật "lạ" vào nhóm "Gói khác": `apps/web/src/features/public-site/format.ts:71-72`.
  - Chữ nổi của công tắc: `apps/web/src/features/pricing/SubjectsPage.tsx:161-167`.

### NHẸ

**R2. Hai thợ trùng tiếng cuối: Lịch ghi tên đầy đủ, nhưng Hợp đồng ghi "Hà (chính), Hà"**
- **Triệu chứng:** Phạm Thu Hà và Nguyễn Thu Hà cùng chưa có tên hiển thị, cùng được chọn vào một dòng.
  - Hàng thợ ghi "**Hà (chính), Hà**".
  - Dải cảnh báo ghi "**Hà** có lịch trong ngày · 1 ca", không rõ là Hà nào.
  - Trên Lịch, hai người này lại ghi đầy đủ "Phạm Thu Hà" và "Nguyễn Thu Hà".
  - Như vậy cùng một người mang hai tên ở hai màn. Điều này trái câu "Một người một tên trên mọi khổ màn" ở dòng 09:30.
- **Mức ảnh hưởng:** chữ tắt ảnh đại diện (PH, NH) và tên đọc vẫn phân biệt được hai người. Đặt tên hiển thị khác nhau (ví dụ "Hà Makeup") thì hết.
- **Tái hiện:**
  1. Thêm thợ "Nguyễn Thu Hà", để trống tên hiển thị.
  2. Lập hợp đồng ngày 22/11, thêm dòng Phù dâu 15:00.
  3. Chọn thợ: tick cả Phạm Thu Hà và Nguyễn Thu Hà.
  - Ví dụ có sẵn: HD-000004 trong database còn giữ.
- **Ảnh:** `M3-hd-hai-ha-1440.png`; so với `M3a-lich-11-22-Thợngày-1440.png`.
- **Chỗ trong mã:**
  - Hợp đồng gọi `staffShortName` từng người, không xử lý trùng: `apps/web/src/features/contracts/StaffRow.tsx:30`, `apps/web/src/features/contracts/StaffWarningBanner.tsx:18`.
  - Lịch có xử lý trùng trong `laneShortNames`: `apps/web/src/features/schedule/model.ts:212-216`.

**R3. Khi hai thợ trùng tiếng cuối, tên đầy đủ trên Lịch lại bị cắt ở 390 và 1024**
- **Triệu chứng:**
  - Ở 390, lưới tuần ghi "Phạm Th…" và "Nguyễn T…".
  - Ở 1024, lưới C ghi "Phạm Thu …" và "Nguyễn Thu …".
  - Lỗi cắt chữ cũ (N3) quay lại, nhưng chỉ trong trường hợp trùng tên.
- **Mức ảnh hưởng:** vẫn phân biệt được nhờ chữ đầu và ảnh đại diện. Đặt tên hiển thị là hết.
- **Ảnh:** `M3a-lich-11-22-Tuần-390.png`, `M3a-lich-11-22-Thợngày-1024.png`.
- **Chỗ trong mã:** `apps/web/src/features/schedule/model.ts:216` (trùng thì trả tên đầy đủ).

**R4. Hai thợ có cùng chữ tắt thì có thể cùng màu ảnh đại diện**
- **Triệu chứng:**
  - "Linh Trần" và "Lê Minh Tú" cùng chữ tắt **LT**, và cùng màu nâu.
  - Ở đầu cột lịch 390 và chế độ "Cột thợ", hai ảnh đại diện giống hệt nhau. Chỉ còn tên bên cạnh để phân biệt.
  - Biên bản trước ghi hai người "phân biệt nhau bằng màu". Với dữ liệu lần này thì không.
- **Ảnh:** `M1-lich-11-22-Cộtthợ-390.png`, `M1-lich-11-22-Ngày-1440.png` (thanh "Thợ trong ngày").
- **Chỗ trong mã:** màu ảnh đại diện lấy theo mã thành viên (`colorKey={lane.membershipId}`, `apps/web/src/features/schedule/parts.tsx:93`). Hai mã khác nhau vẫn có thể ra cùng một màu.

**R5. `docs/CHAY-THU-TREN-MAY.md` ghi số bản cũ**
- Tài liệu ghi "Viết theo … commit `d417acf`" (dòng 3). Bước 1 cũng ghi `git clone --branch …` sẽ tải về `d417acf`.
- Thực tế:
  - Hôm nay lệnh đó tải về `6df580a`.
  - Các lệnh trần (`pnpm dev`, `platform:*`) chỉ tự đọc `.env` từ bản Z2 (`0802ee0`) trở đi.
  - Ai lấy đúng bản `d417acf` theo chữ trong tài liệu thì sẽ gặp lại lỗi `Thiếu DATABASE_URL`.
- Mọi lệnh khác trong tài liệu đều đúng (mục 4).

---

## 4. Kiểm tài liệu `docs/CHAY-THU-TREN-MAY.md`

Tôi làm trên **một bản lấy mã mới từ GitHub**: `git clone --branch claude/nen-mong-makeup https://github.com/SSSTUDIO96/a.git`, ra đúng `6df580a`.
- Tệp `.env` có đúng 7 dòng như bước 4. Tôi đổi `PORT=4291` để tránh cổng của người khác, như thợ viết tài liệu đã làm.
- Database mới là `makeup_thu_cham3`.
- Mọi lệnh gõ **trần**, đúng chữ trong tài liệu, và không đặt sẵn biến nào trong cửa sổ lệnh.

Nhật ký ở `log/doc/`.

| Bước | Lệnh trong tài liệu | Kết quả thật | Đúng tài liệu? |
|---|---|---|---|
| 0 | `node -v`, `pnpm -v`, `psql --version` | `v22.22.0`, `10.28.0`, `psql (PostgreSQL) 16.15` | Đúng |
| 1 | `git clone --branch claude/nen-mong-makeup …` | Tải về được. Ra `6df580a`, **không phải `d417acf`** như tài liệu ghi (R5) | Lệnh đúng, chữ ghi bản cũ |
| 2 | `pnpm install --frozen-lockfile` | Xanh, 4 giây, có `Generated Prisma Client` | Đúng |
| 3 | 5 câu SQL (`CREATE ROLE … CREATEDB`, `CREATE DATABASE`, `\c`, `CREATE EXTENSION btree_gist`, `\dx`) | Chạy được với vai trò và database tạm (đã xoá). `\dx` liệt kê `btree_gist` và `plpgsql` | Đúng |
| 4 | `.env` 7 dòng + `node -e "…randomBytes(32)…"` | Khoá dài 64 ký tự. `.env` bị Git bỏ qua (`.gitignore:3`) | Đúng |
| 5 | `pnpm db:deploy-to <url>` không có cờ | `Từ chối: "makeup_thu_cham3" không phải database thử…`, mã thoát 1 | Đúng |
| 5 | `… --khong-phai-database-thu` | `All migrations have been successfully applied.` và `… kiểm lại: khớp.` | Đúng |
| 5 | `pnpm db:deploy` | `15 migrations found … No pending migrations to apply.` | Đúng |
| 6 | `pnpm platform:seed-plans -- --with-trial` (2 lần) | Lần 1: `tạo mới [trial, individual, pro, team, academy, academy_pro]`. Lần 2: `giữ nguyên […]` | Đúng |
| 7 | `pnpm dev` | In `"msg":"Makeup Pro API đã chạy"`. `/health` trả `{"ok":true}` | Đúng |
| 8 | `pnpm exec vite` (thêm `--port 5351` và `API_DEV_TARGET`, như tài liệu cho phép khi đổi cổng) | `Local: http://localhost:5351/`. Mở gốc thì tự sang `/dang-nhap` | Đúng |
| 9 | Đăng ký → Tạo tổ chức "Học viện Hoa Hồng" | Ô Đường dẫn tự điền `hoc-vien-hoa-hong`. Chuyển vào `/hoc-vien-hoa-hong/lich`. Thanh trái đủ 9 mục như tài liệu. Thêm khoá thì bị chặn: "Gói Dùng thử của tổ chức chưa có khoá học — liên hệ để nâng gói." `/quan-tri` lúc chưa cấp quyền: "Không có trang này." | Đúng |
| 10 | `pnpm platform:grant-admin -- --email …` | Email chưa đăng ký: `Chưa có tài khoản với email … — người đó phải tự đăng ký trước`. Lần 1: `Cấp quyền … — đã ghi nhật ký`. Lần 2: `không đổi gì (đã có quyền)`. Thêm `--revoke`: `Thu quyền …`. Cấp lại được | Đúng |
| 11 | `/quan-tri` → Tổ chức → Đổi gói / gia hạn → Academy, Đang dùng, 12 tháng → Lưu thuê bao | Thẻ học viện "Đang dùng, đến 19/10/2027", "Academy · 0 ₫/tháng" | Đúng |
| 12 | Đào tạo → Thêm khoá | Tạo được `KH-0001` "Makeup cô dâu cơ bản", 02/11–30/11, T2 · T4 18:00–21:00, tối đa 12 | Đúng |
| Tắt máy | Ctrl+C | Nhật ký ghi `Đang tắt máy chủ`. Không còn tiến trình nào, cổng đóng. Dòng này in **2 lần** (vô hại) | Đúng |

**Kết luận mục 4:** các lệnh trần `dev`, `platform:seed-plans -- --with-trial` và `platform:grant-admin` **chạy được** trên bản lấy mã mới. Không có lệnh nào trong tài liệu sai. Chỉ có chữ ghi số bản cũ (R5). Tôi **không** chạy lại phần sao lưu và khôi phục, và không thử trên Windows.

---

## 5. Hồi quy: các luồng chính tôi đã đi lại

Dữ liệu dựng mới hoàn toàn qua giao diện, trên database `makeup_test_cham3_dung`.

**Studio:**
1. Đăng ký, tạo 2 tổ chức.
2. Thêm 3 bậc lương và 5 thợ (2 thợ có tên hiển thị).
3. Thêm dịch vụ, phụ phí, phí đi lại theo bậc, 3 gói.
4. Thêm khách.
5. Lập 3 hợp đồng có thợ và giờ:
   - HD-000001 có cảnh báo trùng giờ.
   - HD-000002 đổi giờ để hết trùng rồi xác nhận.
   - HD-000003 xác nhận ở 390, chưa có thợ.
6. Xem Lịch 3 chế độ ở 3 khổ.
7. Thu tiền: lập tiến độ, ghi phiếu thu.
8. Báo cáo doanh thu, sổ thu.
9. Mẫu thiết kế: thẻ Feedback fb-04, 3 ảnh, xuất PNG 1080×1350 (`101-xuat-feedback-dich-vu-fb04.png`).

**Học viện:**
1. Cấp gói Academy ở `/quan-tri`.
2. Thêm giảng viên.
3. Tạo khoá một lớp và khoá nhiều lớp (K1, K2).
4. Ghi danh, lập hợp đồng khoá học (học viên mới, khoản khác, giảm giá, mẫu điều khoản, nội quy), xác nhận.
5. Xem bản in và in PDF, cả bản ngắn và bản 45 điều.
6. Thu 5.000.000.
7. Báo cáo theo loại.
8. Xuất PNG 3 thẻ: Chào mừng, Feedback, Lời chúc (`L6-*-xuat.png`).

**Kết quả:** mọi bước chạy được, không có lỗi JavaScript. Tiền khớp (mục 1.3). Tràn ngang 0/93. Không có nút chết.

---

## 6. Anh Chiến vào thao tác thật được chưa

**Studio dịch vụ makeup: ĐƯỢC.**
- Lỗi đáng ngại của lần trước (M1) đã hết. Lỡ tắt một nhân vật thì màn hợp đồng không còn bày gói đó, và hợp đồng nháp cũ báo rõ dòng nào cần bỏ.
- Ca nhiều người hiện đủ "× 2" ở mọi chế độ lịch. Tên thợ theo đúng luật anh duyệt. Tiền khớp ở mọi màn.
- **Hai điều nên nhớ khi dùng:**
  1. **Nếu tắt một nhân vật mà gói của nó đang bật "hiện trên trang công khai", hãy tắt cả công tắc công khai của gói đó** (R1). Nếu không, khách vẫn thấy giá gói trên trang giới thiệu.
  2. **Thợ trùng tên gọi** (hai chị "… Thu Hà"): nên đặt **tên hiển thị** riêng cho mỗi người (R2, R3). Như vậy lịch và hợp đồng đều ghi rõ là ai.

**Học viện (đào tạo): ĐƯỢC**, với điều kiện vận hành như cũ:
- Học viện mới phải được cấp gói có khoá học. Cấp bằng 2 lệnh `platform:seed-plans -- --with-trial` và `platform:grant-admin`, rồi vào `/quan-tri` → "Đổi gói / gia hạn".
- Tôi đã làm lại trọn trình tự này theo đúng tài liệu, trên bản lấy mã mới. Chạy đúng.
- In hợp đồng khoá học đã đúng. Nay có bài thử tự động canh, sửa CSS làm hỏng bản in thì bài đỏ ngay.

**Không còn gì chặn việc vào thao tác thật.** Nên sửa khi tiện:
1. **R1:** trang công khai bỏ gói của nhân vật đang ẩn. Chữ nổi của công tắc nhắc thêm "và trên trang công khai".
2. **R2:** hợp đồng dùng chung luật xử lý trùng tên như Lịch.
3. **R5:** sửa số bản trong `docs/CHAY-THU-TREN-MAY.md`.
4. **R3, R4:** chỉ là thẩm mỹ, có cách né.

---

## 7. Chưa chấm được

- **Bước riêng của Windows trong tài liệu chạy thử** (cài phần mềm, PowerShell, đường dẫn Windows trong `.env`): máy chấm là Linux.
- **Phần sao lưu và khôi phục trong tài liệu:** đề bài chỉ yêu cầu kiểm các lệnh `dev`, `platform:*`. Tôi không chạy lại `pg_dump`/`pg_restore`.
- **Điện thoại thật, Safari iPhone, máy in thật:** tôi dùng Chromium giả lập 390 và lệnh in `page.pdf`.
- **Quyền theo vai trò:** đã thử tài khoản chủ và một tài khoản thợ (chỉ phần Lịch). Chưa thử lễ tân, kế toán, giảng viên.
- **Bộ "16/16 đột biến" của thợ:** chưa chạy lại từng cái. Thay vào đó tôi tự cài 16 đột biến của riêng tôi, bài thử bắt được 16/16 (mục 1.2).
- **T3** (giới hạn gói), **L4**, **L5:** không chấm lại, theo quyết định hoặc vì không nằm trong đợt sửa.

## 8. Phụ lục

- **Thư mục chấm:** `/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-3/`
  - `anh/`: 267 ảnh và PDF.
    - `M1-*`, `M2-*`, `M3*-*`, `M5-*`, `N1-*`: các mục cần chấm.
    - `R-*`: hồi quy và lỗi mới.
    - `t-*`: vòng đi 31 màn × 3 khổ.
    - `DOC-*`: kiểm tài liệu.
  - `log/`: nhật ký lệnh.
    - Máy chủ: `api-tsc.txt`, `api-vitest.txt`.
    - Shared: `shared.txt`.
    - Web: `web-tsc.txt`, `web-vitest-{1,2,3}.txt`, `web-build.txt`.
    - Đột biến: `dot-bien.txt`, `n1-dot-bien.txt`.
    - Đo lịch: `m-lich-1.txt`, `m3-lich-trung.txt`, `m3-lich-hamakeup.txt`.
    - Kiểm từng mục: `m1-kiem.txt`, `m5.txt`.
    - Đi màn và bấm nút: `tour.txt`, `nut.txt`.
    - Kiểm tài liệu: `doc/`.
  - `do-tran-ngang.tsv`: số đo tràn ngang 93 dòng.
  - `pw/`: các bài thao tác Playwright.
    - Dựng dữ liệu: `a*`, `b*`, `e1`, `g*`, `h3`, `k2`, `k6`.
    - Kiểm từng mục: `m-lich.mjs`, `m1.mjs`, `m1b.mjs`, `m3.mjs`, `m5.mjs`, `l7-390.mjs`, `n1-in.mjs`.
    - Hồi quy: `t1-tour.mjs`, `t2-nut.mjs`, `t3-khop.mjs`, `t3b.mjs`, `pub.mjs`, `tho.mjs`.
    - Kiểm tài liệu: `doc.mjs`.
    - Liên kết `pw/node_modules` trỏ vào bản tách đã gỡ. Muốn chạy lại thì phải dựng lại bản tách.
  - `dotbien.py`: chương trình cài đột biến.
- **Database còn giữ:** `makeup_test_cham3_dung`. Tài khoản chủ `chien.chu@studio-thu.vn`, mật khẩu `MatKhau@2026x` (chỉ dùng trên máy thử).
  - Trạng thái để tái hiện:
    - Nhân vật "Mẹ cô dâu" **đang tắt**.
    - Gói "Mẹ cô dâu" và "Cô dâu cao cấp" đang bật công khai. Trang `/trang/studio-chien` đã xuất bản (R1).
    - HD-000004 là hợp đồng nháp có hai thợ "Hà" (R2).
    - HD-000005 là hợp đồng nháp có dòng của nhân vật ẩn (M1).
  - Xoá bằng `su postgres -c "dropdb makeup_test_cham3_dung"`.
