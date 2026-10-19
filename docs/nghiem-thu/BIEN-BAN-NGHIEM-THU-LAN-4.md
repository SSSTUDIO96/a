# Biên bản nghiệm thu lần 4 — Makeup Pro (bản `8f6ac89`)

- **Ngày chấm:** 19/10/2026, giờ máy khoảng 02:05–02:55 UTC (sáng 19/10 giờ Việt Nam).
- **Người chấm:** thợ chấm độc lập (AI). Tôi chỉ đọc, đo và chụp. Tôi không sửa mã, không lưu (commit), không đẩy gì lên kho, không đụng database `makeup_dev`, không đụng database gốc `makeup_test_cham3_dung`.
- **Bản được chấm:** commit `8f6ac89`. Các commit sửa sau biên bản lần 3: `9e2cbb8`, `dae0d24`, `fe6e629` (thợ V1, V2) và `8f6ac89` (ghi việc tồn 48–50). Mục tiêu: sửa R1–R5 của biên bản lần 3.
- **Cách chấm:** làm trên một **bản tách riêng** (worktree) `scratchpad/cham-4/kho`. Bản tách không có tệp `.env`. Mọi lệnh chạy máy chủ đều đặt `DATABASE_URL`/`DIRECT_URL` trỏ database thử ngay trong lệnh. Chấm xong tôi đã gỡ bản tách bằng `git worktree remove --force`.
- **Database thử** (đều tạo mới, bật `btree_gist`, áp migration bằng `pnpm --filter api db:deploy-to <url>`, lần nào cũng báo "kiểm lại: khớp"):
  - `makeup_test_cham4`: bài thử máy chủ và đột biến máy chủ. **Đã xoá.**
  - `makeup_test_cham4_khop`: bài "khớp hai đầu" của web. **Đã xoá.**
  - `makeup_test_cham4_dung`: chép từ `makeup_test_cham3_dung` (`createdb -T`), dùng cho app thật. **Còn giữ** để tái hiện (xem mục 6).
- **Máy chủ đã tắt theo PID** (không dùng `pkill -f`):
  - API cổng 4320: 22105, 22108, 22168, 22169, 22197.
  - Web bản build (`vite preview`) cổng 5380: 22106, 22109, 22181, 22182.
  - Sau khi tắt: cả hai cổng không còn trả lời.
- **Ảnh:** 126 ảnh khung màn hình ở `scratchpad/cham-4/anh/`. Nhật ký lệnh ở `scratchpad/cham-4/log/`.

---

## 0. Kết luận ngắn cho anh Chiến

**Cả 5 mục cần sửa của lần trước đều ĐÃ HẾT: R1, R2, R3, R4, R5.** Tôi kiểm từng mục trên app thật ở 1440, 1024 và 390, và có ảnh.

- **R1.** Tắt một nhân vật thì gói của nhân vật đó **không còn hiện** trên trang giới thiệu công khai, và cũng không hiện ở khung "Xem trước" trong màn Thương hiệu. Bật lại thì gói hiện lại đúng nhóm. Chữ nổi của công tắc nay nói rõ "không hiện khi lập hợp đồng **và trên trang công khai**".
- **R2.** Hai chị "Phạm Thu Hà" và "Nguyễn Thu Hà" nay mang **cùng một tên ở Lịch và Hợp đồng**: hàng thợ ghi "Phạm Thu Hà (chính), Nguyễn Thu Hà", dải cảnh báo ghi "Phạm Thu Hà có lịch trong ngày · 1 ca".
- **R3.** Tên đầy đủ trên Lịch **không còn bị cắt** ở 390 và 1024. Tên dài xuống dòng.
- **R4.** "Linh Trần" và "Lê Minh Tú" (cùng chữ tắt LT) nay **khác màu** ở Lịch và Hợp đồng: một nâu cam, một nâu xám.
- **R5.** Tài liệu chạy thử ghi đúng: dùng được "từ commit `0802ee0` trở đi".

**Bài thử tự động đều xanh, số tôi tự đo:**
- Máy chủ: **612/612**.
- Cửa gác (bộ kiểm chặn studio này xem hoặc sửa dữ liệu studio khác): **787/787**.
- Web: **920/920**, chạy 2 lần liền đều xanh.
- Tôi tự cài 11 lỗi vào mã. Bài thử bắt được **9/11**. Hai lỗi lọt đều là chỗ hiện đang chạy đúng, chỉ là bài thử chưa canh (mục 1.2).

**Hồi quy** (sửa chỗ này mà làm hỏng chỗ khác): **không thấy lỗi nào do vòng sửa này gây ra.**
- Tràn ngang (trang rộng hơn màn hình, phải kéo ngang): 0 trên 57 lần đo.
- Nút chết: 0 trên 120 nút.
- Tiền khớp giữa các màn và database.

**Lỗi mới thấy: không có lỗi nặng.** Có **2 lỗi trung bình**, đều **có từ trước**, không do vòng sửa này:
1. **N1. Huỷ một dòng của hợp đồng đã xác nhận, ca của dòng đó vẫn nằm trên Lịch.** Ca vẫn ghi "Đã xác nhận", lại còn nhắc "Phân thợ".
2. **N2. Trên điện thoại (390), trong hộp "Thêm phát sinh", bấm "Chọn thợ" thì không thấy gì.** Ô chọn thợ bị hộp phát sinh che mất. Hệ quả: không gán thợ được cho phát sinh trên điện thoại.

Ngoài ra có 4 lỗi nhẹ (mục 3).

---

## 1. Bảng số đo (tôi tự chạy, in tử số / mẫu số)

### 1.1 Bài thử tự động

| # | Lệnh (trong bản tách `8f6ac89`) | Kết quả |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | Xanh, 8,6 giây |
| 2 | `apps/api`: `npx tsc --noEmit` | **0 lỗi** (14,5 giây) |
| 3 | `apps/api`: `npx vitest run`, chạy trên database mới `makeup_test_cham4` | **612/612** bài, **51/51** tệp, 477,9 giây. Lần 3 là 607; tăng 5 bài là tệp mới `goi-nhan-vat-an-cong-khai.test.ts` (5/5). |
| 3a | Cửa gác, 10 phép | scope **99/99** · outsider **99/99** · noPerms **99/99** · unauth **109/109** · crossId **50/50** · leak **40/40** · refBase **45/45** · crossRef **107/107** · keep **99/99** · platform **40/40**. Cộng **787/787**. |
| 3b | Cửa gác "sửa một phần" | partialStatic **21/21** · partialKeep **21/21** · chạy thật đủ hai bước **21/21** đường PATCH |
| 3c | Đột biến có sẵn trong kho (`gate-mutants.test.ts`) | **14/14** xanh: cài lỗi nào thì cửa gác đỏ đúng phép đó |
| 4 | `packages/shared`: `tsc` + `vitest` | **0 lỗi** · **108/108** bài, 7/7 tệp |
| 5 | `apps/web`: `pnpm typecheck` (2 cấu hình: `tsconfig.json` và `tsconfig.node.json`) | **0 lỗi** (18,7 giây) |
| 6 | `apps/web`: `npx vitest run`, `KHOP_HOP_DONG_DATABASE_URL=…/makeup_test_cham4_khop`, `KHOP_PORT=4327`, **2 lần liền** | Lần 1: **920/920** (59/59 tệp, 92,7 s). Lần 2: **920/920** (89,7 s). **0 bài chập chờn** (bài lúc qua lúc không), 0 bài bỏ qua. Lần 1 chạy song song với bài máy chủ. |
| 6a | Bài khớp hai đầu (web và máy chủ thật nói cùng một kiểu dữ liệu) | `khop-hop-dong` **14/14** · `khop-kieu` **6/6**, cả 2 lần |
| 6b | Bài mới của vòng này | `trungTen.R2R4.test.tsx` **6/6** · `goiNhanVatAn.test.tsx` **5/5** · `staffName.test.ts` **23/23** · `staffName.lich.test.tsx` **4/4** |
| 6c | Cửa gác bí mật trong vitest | **44/44**, cả 2 lần |
| 7 | `apps/web`: `pnpm build` | **Xanh** (29,3 giây). Tệp chính `index-*.js` **359,89 KB** (nén còn 115,43 KB); `man-contracts` 128,32 KB; `man-schedule` 41,75 KB. Cửa gác bí mật: **"đã quét 170/170 tệp · 0 vi phạm · 0/170 tệp dính"**. `vercel.json` kiểm khớp. Trang in thử `__in-thu__` không lọt vào bản build. |

Nhật ký: `log/api-tsc.txt`, `log/api-vitest.txt`, `log/shared.txt`, `log/web-tsc.txt`, `log/web-vitest-{1,2}.txt`, `log/web-build.txt`.

### 1.2 Đột biến tôi tự cài (R1, R2, R3, R4)

Mỗi dòng: cài một lỗi → chạy bài thử liên quan → trả mã về nguyên (`git checkout`). Sau cùng `git status` sạch.
- Đột biến web: chạy 30 tệp bài thử (433 bài) của `public-site`, `brand`, `contracts`, `schedule`, `pricing`, `ui`.
- Đột biến máy chủ: chạy `goi-nhan-vat-an-cong-khai.test.ts` và `profile.test.ts` (19 bài) trên `makeup_test_cham4`.
- Nhật ký: `log/dot-bien-web.txt`, `log/dot-bien-api.txt`.

| Đột biến | Mục | Kết quả |
|---|---|---|
| D1. Gói của nhân vật đã ẩn lại rơi vào "Gói khác" (`format.ts`, lỗi cũ R1) | R1 | **Đỏ** 5 bài (`goiNhanVatAn.test`) |
| D2. Màn Thương hiệu tải cả nhân vật đang ẩn cho khung xem trước (`useProfileDraft.ts:143` bỏ `isActive: true`) | R1 | **Xanh: lọt.** Khung xem trước sẽ bày lại gói của nhân vật ẩn dưới tên nhân vật đó, mà không bài nào đỏ. |
| D10. Máy chủ bỏ lọc nhân vật khi lấy gói công khai (lỗi cũ R1) | R1 | **Đỏ** 2 bài (`goi-nhan-vat-an-cong-khai`) |
| D11. Máy chủ lọc nhân vật nhưng quên gói không gắn nhân vật | R1 | **Đỏ** 5 bài (`goi-nhan-vat-an-cong-khai`, `profile`) |
| D3. Dải cảnh báo trong hợp đồng dùng lại tên ngắn từng người (lỗi cũ R2) | R2 | **Đỏ** 2 bài (`ContractEditor.test` R2/R4) |
| D4. Hợp đồng không lấy danh sách thợ của tổ chức để xét trùng tên | R2 | **Đỏ** 1 bài (`ContractEditor.test` "dòng chỉ có Phạm Thu Hà…") |
| D5. Lịch chỉ xét trùng trên những hàng đang hiện (sau bộ lọc) | R2 | **Đỏ** 1 bài (`trungTen.R2R4.test`) |
| D9. Đầu cột lưới tuần 390 lại cắt "…" | R3 | **Đỏ** 1 bài (`trungTen.R2R4.test` R3 CSS) |
| D6. Bỏ phần né màu: ai cũng lấy màu băm gốc (lỗi cũ R4) | R4 | **Đỏ** 6 bài (`staffName.test`, `trungTen.R2R4.test`, `ContractEditor.test`) |
| D7. Ảnh chồng trên thẻ ca băm thẳng mã thành viên | R4 | **Đỏ** 2 bài |
| D8. Ô chọn thợ trong hợp đồng băm thẳng mã thành viên (`StaffPicker.tsx:89`) | R4 | **Xanh: lọt.** Hai chị LT sẽ lại cùng màu trong ô chọn thợ, và khác màu với hàng thợ ngay bên dưới, mà không bài nào đỏ. |

**Kết luận: 9/11 lần phá bị bắt.**
- D2 và D8 lọt. Cả hai chỗ **hiện đang chạy đúng**: tôi đã kiểm trên app thật (mục 2).
- Chỉ là chưa có bài thử canh hai chỗ này. Sau này có ai sửa hỏng thì sẽ không ai biết.
- D8 lọt vì bài đọc mã (`staffName.test.ts:178`) chỉ đọc thẻ `<Avatar …>`. Ô chọn thợ truyền màu qua một thuộc tính trung gian `colorKey={…}` của `PickerRow`, nên bài không thấy.
- **Thợ ghi "19/19 đột biến".** Tôi không chạy lại bộ của thợ. Bộ của riêng tôi được 9/11.

### 1.3 Đo trên app thật

| Hạng mục | Kết quả |
|---|---|
| **Tràn ngang** | 19 màn × 3 khổ (1440, 1024, 390): **0/57** lần tràn. Gồm Lịch 3 chế độ ngày 22/11 và 29/11, hợp đồng mới, nháp HD-000004, nháp HD-000005, đã chốt HD-000001 và HD-000006, danh sách hợp đồng, thu tiền, Bảng giá (nhân vật, gói), Thương hiệu, trang công khai, Thợ makeup, Tiền công, Doanh thu, Sổ thu. Xem `do-tran-ngang.tsv` và ảnh `t-*`. |
| **Nút chết** | Bấm **120** nút trên 8 màn đã đụng: Lịch C/B/A, HD-000004, HD-000006, Bảng giá → Nhân vật, Thương hiệu, trang công khai (`log/nut.txt`). 16 nút "không thấy đổi", đều có lý do: <br>• nút đã chọn sẵn: "Thợ × ngày", "Ngày", "Cột thợ", "Tất cả", ngày 22/11 đang chọn; <br>• 6 tay nắm "Đổi thứ tự" (chỉ kéo được, không bấm); <br>• 3 nút "Tải ảnh/Đổi ảnh" (mở hộp chọn tệp của máy). <br>**0 nút chết thật** trên các màn này. Riêng nút "Chọn thợ" trong hộp phát sinh ở 390 là nút chết thật: xem N2. |
| **Lỗi trang** | Không có lỗi JavaScript. <br>• Có 401 lúc mở trang khi chưa đăng nhập, đúng thiết kế. <br>• Có 500 khi tải logo và ảnh album: tệp ảnh nằm ở `/tmp/makeup-files-development`, mà thư mục này mất khi máy khởi động lại. Đây là chuyện của môi trường chấm, không tính là lỗi. |
| **Tài khoản thợ** | Đăng nhập bằng thợ Phạm Thu Hà. Lịch ở 1440 và 390 chỉ thấy ca của mình. Đầu hàng ghi "Phạm Thu Hà", cùng tên với màn của chủ (`R2-tho-pham-ha-lich-*`). |

**Tiền giữa các màn** (đối chiếu với database), sau khi lập thêm HD-000006 và thu cọc:

| Hợp đồng | Danh sách HĐ | Báo cáo doanh thu (tổng / cọc / đã thu / còn) | Database (tổng / cọc / đã thu) |
|---|---|---|---|
| HD-000001 | 5.194.000 | 5.194.000 / 1.500.000 / 1.500.000 / 3.694.000 | 5.194.000 / 1.500.000 / 1.500.000 |
| HD-000002 | 3.300.000 | 3.300.000 / 1.300.000 / 1.300.000 / 2.000.000 | 3.300.000 / 1.300.000 / 1.300.000 |
| HD-000003 | 400.000 | 400.000 / 100.000 / 0 / 400.000 | 400.000 / 100.000 / 0 |
| **HD-000006 (mới, mục 5)** | 2.500.000 | 2.500.000 / 1.000.000 / 1.000.000 / 1.500.000 | 2.500.000 / 1.000.000 / 1.000.000 |
| **Cộng studio** | | **11.394.000** · cọc 3.900.000 · đã thu 3.800.000 · còn 7.594.000. Sổ thu 3.800.000, 3 phiếu. Như nhau ở 1440 và 390. | khớp |

---

## 2. Trạng thái từng mục

**Cách đọc cột Trạng thái:**
- **ĐÃ HẾT:** lỗi không còn.
- **CÒN:** lỗi vẫn còn.

| Mục | Trạng thái | Ảnh (trong `anh/`) |
|---|---|---|
| **R1** Gói của nhân vật ẩn hiện trên trang công khai | **ĐÃ HẾT** | `R1-trang-cong-khai-{1440,1024,390}`, `R1-trang-cong-khai-full-*`, `R1-xem-truoc-thuong-hieu-{1440,1024,390}`, `R1-tat-truoc-*`, `R1-bat-*`, `R1-tat-lai-*`, `R1-cong-tac-nhan-vat-1440` |
| **R2** Hai thợ trùng tiếng cuối ra cùng tên trong hợp đồng | **ĐÃ HẾT** | `R2-hd-000004-{1440,1024,390}`, `R2-o-chon-tho-{1440,1024,390}`, `R2-lich-11-22-{C,B,A}-{1440,1024,390}`, `R2-phat-sinh-hai-ha-1440`, `R2-tho-pham-ha-lich-*` |
| **R3** Tên đầy đủ bị cắt trên Lịch ở 390 và 1024 | **ĐÃ HẾT** | `R2-lich-11-22-C-390`, `R2-lich-11-22-{C,A}-1024`, `M4-chua-co-tho-*` |
| **R4** Hai thợ cùng chữ tắt cùng màu | **ĐÃ HẾT ở Lịch và Hợp đồng.** Các màn khác chưa làm, thợ đã ghi việc tồn 48 (xem L2). | `R2-lich-*`, `R2-hd-000004-*`, `R2-o-chon-tho-*`, `R4-lich-loc-le-minh-tu-1440`; so với `R4-nhan-su-1440`, `R4-tien-cong-1440` |
| **R5** Tài liệu chạy thử ghi sai bản | **ĐÃ HẾT** | (đọc tài liệu, mục R5 dưới đây) |

### R1: kiểm chi tiết

Dữ liệu: nhân vật "Mẹ cô dâu" đang tắt. Gói "Mẹ cô dâu" (800.000 ₫) đang bật "hiện trên trang công khai".

1. **Máy chủ:** lệnh `GET /api/v1/public/sites/studio-chien` chỉ trả gói "Cô dâu cao cấp". Danh sách nhân vật không có "Mẹ cô dâu".
2. **Trang thật `/trang/studio-chien`** (không đăng nhập), ở 1440, 1024 và 390:
   - Mục Bảng giá chỉ có nhóm "CÔ DÂU" với "Cô dâu cao cấp 2.500.000 ₫".
   - **Không còn** "Mẹ cô dâu 800.000 ₫", **không còn** nhóm "GÓI KHÁC".
   - Không tràn ngang.
3. **Xem trước ở Cài đặt → Thương hiệu**, ở 1440, 1024 và 390 (ở 390 phải bấm thẻ "Xem trước"): giống trang thật, không có gói "Mẹ cô dâu".
4. **Hai chiều:**
   - Bật lại "Mẹ cô dâu": trang thật và khung xem trước đều hiện lại gói, đúng nhóm "MẸ CÔ DÂU", không rơi vào "Gói khác".
   - Tắt lại: cả hai đều mất gói (`R1-tat-truoc-*`, `R1-bat-*`, `R1-tat-lai-*`).
   - Thợ đã ghi việc tồn 50: trình duyệt của khách có thể còn giữ bản cũ tối đa 60 giây. Tôi mở mỗi lần bằng trình duyệt mới nên không gặp.
5. **Chữ nổi của công tắc:** tên đọc "Mẹ cô dâu: đang ẩn". Chữ nổi: "Đang ẩn — gói của nhân vật này không hiện khi lập hợp đồng và trên trang công khai. Bật để dùng lại".
6. Xem thêm lỗi nhẹ L1 ở mục 3: danh sách "Gói hiện trên trang" trong màn Thương hiệu vẫn để công tắc gói "Mẹ cô dâu" ở trạng thái bật, mà không ghi chú gì.

### R2 và R3: kiểm chi tiết

**Chuẩn bị:** ở màn Thợ makeup, tôi xoá tên hiển thị "Hà Makeup" của Nguyễn Thu Hà (trên database chép, `R2-xoa-ten-hien-thi-1440`). Như vậy có hai thợ "Phạm Thu Hà" và "Nguyễn Thu Hà", cùng chưa có tên hiển thị.

1. **Lịch ngày 22/11, cả 3 chế độ, cả 3 khổ:**
   - Đầu hàng (lưới "Thợ × ngày" / lưới "Tuần" ở 390) và đầu cột ("Cột thợ") ghi đủ **"Phạm Thu Hà"** và **"Nguyễn Thu Hà"**.
   - Thợ khác giữ tên ngắn: "Linh Trần", "Tú", "Giang".
   - Chế độ Ngày ghi tên đầy đủ, như quyết định cũ.
   - Đo bằng máy (`log/R2.json`): **0 tên bị cắt** trong 36 ô tên.
   - Ở 390, lưới tuần xuống dòng: "Phạm Thu / Hà", "Nguyễn / Thu Hà". Không còn "Phạm Th…" như lần 3.
   - Ở 1024, lưới "Thợ × ngày" ghi đủ trên một dòng.
2. **Hợp đồng nháp HD-000004** (dòng Phù dâu 15:00, tick cả hai Hà), ở 1440, 1024 và 390:
   - Hàng thợ ghi **"Phạm Thu Hà (chính), Nguyễn Thu Hà"**. Lần 3 ghi "Hà (chính), Hà".
   - Dải cảnh báo ghi **"Phạm Thu Hà có lịch trong ngày · 1 ca"**. Lần 3 ghi "Hà có lịch…".
   - Ô chọn thợ ghi họ tên đầy đủ, ảnh đại diện PH và NH.
3. **Hợp đồng chỉ có một Hà:** HD-000006 mới lập chỉ có Nguyễn Thu Hà. Hàng thợ vẫn ghi "Nguyễn Thu Hà", vì tổ chức có hai người cùng tên ngắn. Lịch cũng ghi y như vậy. **Một người một tên ở mọi màn.**
4. **Hộp "Thêm phát sinh" của HD-000001 (1440):**
   - Hàng thợ ghi "Phạm Thu Hà (chính), Nguyễn Thu Hà".
   - Hai dải "Giữ chỗ nháp ở HD-000004" ghi họ tên đầy đủ.
   - Riêng ảnh đại diện ở đây ghi sai chữ tắt: "PC", "NP" (lỗi nhẹ L3, có từ trước).
   - Ở 390 tôi không kiểm được, vì ô chọn thợ bị che (N2).
5. **Bộ lọc thợ không đổi tên:** lọc riêng Lê Minh Tú thì đầu hàng vẫn ghi "Tú", màu vẫn giữ nguyên.
6. **"Chưa có thợ" (M4 cũ) vẫn đúng.** Ở 1024 và 1440, chữ xuống 2 dòng và không bị cắt (`M4-chua-co-tho-*`).

### R4: kiểm chi tiết

- **Ở Lịch** (cả 3 chế độ, 3 khổ, thanh "Thợ trong ngày", chip lọc) và **ở Hợp đồng** (hàng thợ, ô chọn thợ), hai người cùng chữ tắt LT:
  - Linh Trần màu **nâu cam** `rgb(154,91,15)`.
  - Lê Minh Tú màu **nâu xám** `rgb(122,106,98)`.
  - Độ khác màu ΔE ≈ 45: nhìn là thấy khác. Thợ đã ghi việc tồn 49 rằng hai màu này "gần nhau". Thực tế trên màn vẫn phân biệt được.
  - Ở mọi màn đã đo, một người giữ một màu.
- **Còn lại (thợ đã khai, việc tồn 48):** màn **Thợ makeup** và **Tiền công** chưa đi qua hàm màu chung.
  - Ở hai màn này, Linh Trần và Lê Minh Tú vẫn **cùng màu nâu cam**.
  - Như vậy Lê Minh Tú màu nâu xám ở Lịch nhưng nâu cam ở Thợ makeup (`R4-nhan-su-1440`, `R4-tien-cong-1440`). Xem lỗi nhẹ L2.

### R5: kiểm chi tiết

- `docs/CHAY-THU-TREN-MAY.md` dòng 3 nay ghi: "đúng **từ commit `0802ee0` trở đi** … bản cũ hơn (ví dụ `d417acf`) sẽ báo `Thiếu DATABASE_URL`".
- Tôi kiểm bằng lịch sử kho:
  - `0802ee0` chính là commit Z2.
  - Ở `0802ee0~1`, lệnh `dev` là `tsx watch src/server.ts`, không đọc `.env`. Từ `0802ee0`, lệnh là `tsx watch --env-file-if-exists=.env …`.
  - `0802ee0` là tổ tiên của `8f6ac89`.
  - Nhánh trên GitHub hiện ở `8f6ac89` (`git ls-remote`), nên `git clone --branch …` sẽ tải về bản mới hơn `0802ee0`, đúng như dòng 87 viết.
- Ngoài phạm vi R5 còn một chỗ cũ nhỏ: `docs/PROGRESS.md:35` vẫn ghi "Số đo lần chấm gần nhất … commit `d417acf`" (lỗi nhẹ L4).

---

## 3. Lỗi mới thấy (xếp theo mức nặng)

**Không có lỗi nặng. Không có lỗi nào do vòng sửa này gây ra (hồi quy).** N1, N2, L1, L3, L4 có từ trước. L2 là phần R4 thợ chưa làm hết và đã tự khai.

### TRUNG BÌNH

**N1. Huỷ một dòng của hợp đồng đã xác nhận, ca của dòng đó vẫn nằm trên Lịch, ghi "Đã xác nhận"**
- **Triệu chứng:** ở HD-000001 (đã xác nhận), tôi huỷ hai dòng phát sinh "Phù dâu 15:00" bằng nút "Huỷ dòng" kèm lý do.
  - Tổng hợp đồng giảm đúng về 5.194.000 ₫.
  - **Nhưng 2 ca LH-000008 và LH-000009 vẫn nằm trên Lịch ngày 22/11**, trạng thái "Đã xác nhận".
  - Dải vàng đầu màn Lịch còn nhắc "Chưa có thợ … **Phân thợ**" cho hai ca này.
  - Thanh "Thợ trong ngày" đếm "7 ca · 2 ca chưa có thợ".
  - Bấm vào ca thì hộp chi tiết vẫn dẫn về HD-000001, không nói gì việc dòng đã huỷ.
- **Vì sao đáng để ý:**
  - Lễ tân có thể phân thợ cho một việc đã huỷ.
  - Nếu ca đã có thợ, ca đó vẫn chiếm giờ của thợ (cảnh báo trùng giờ, giữ chỗ).
  - Khi chốt với khách bớt một người, đây là thao tác thường gặp.
- **Tái hiện:**
  1. Mở một hợp đồng đã xác nhận có dòng có giờ (hoặc thêm phát sinh có giờ).
  2. Bấm "Huỷ dòng" ở dòng đó, nhập lý do, xác nhận.
  3. Mở Lịch đúng ngày: ca của dòng vẫn còn.
  - Database còn giữ (`makeup_test_cham4_dung`) đang có đúng hai ca này ở ngày 22/11, 15:00.
- **Ảnh:** `MOI-ca-cua-dong-da-huy-1440.png`, `MOI-ca-cua-dong-da-huy-390.png`, `MOI-ca-cua-dong-da-huy-chi-tiet-1440.png`.
- **Chỗ trong mã:** đường huỷ dòng `apps/api/src/modules/contracts/routes.ts:718-790`.
  - Đánh dấu dòng đã huỷ (`:743`).
  - Trả chỗ khoá học (`releaseEnrollments`, `:748`).
  - Tính lại tiền.
  - **Không đụng tới bảng `appointments`** (ca gắn dòng qua `contract_line_id`).
- **Ghi chú:** hai dòng này do bài thử của tôi lỡ thêm (xem mục 5). Tôi huỷ chúng bằng chính nút "Huỷ dòng" của app thì gặp lỗi này.

**N2. Điện thoại (390): trong hộp "Thêm phát sinh", nút "Chọn thợ" mở ô chọn thợ nằm DƯỚI hộp phát sinh, người dùng không thấy gì**
- **Triệu chứng:** HD-000001 đã xác nhận → "Phát sinh" → "Thêm Phù dâu" → nhập giờ 15:00 → bấm "Chọn thợ".
  - Màn **không đổi gì**.
  - Ô chọn thợ (dạng tấm trượt từ đáy) có mở, nhưng nằm sau hộp phát sinh đang chiếm cả màn.
  - Lớp phủ của hộp phát sinh `z-index: 50`, lớp phủ của tấm trượt `z-index: 40`.
  - Bấm vào chỗ tên thợ thì trúng thân hộp phát sinh.
  - Ở 1024 và 1440 thì đúng: ô chọn thợ là hộp thoại nổi lên trên.
- **Hệ quả:** trên điện thoại không gán thợ được cho phát sinh. Người dùng dễ bấm luôn "Thêm phát sinh", ra ca "Chưa có thợ", rồi phải sang Lịch "Phân thợ".
- **Tái hiện:** như trên, ở khổ 390.
- **Ảnh:** `MOI-phat-sinh-o-chon-tho-bi-de-390.png`. So với `MOI-phat-sinh-o-chon-tho-bi-de-1440.png` và `-1024.png`, nơi ô chọn thợ nổi lên trên.
- **Chỗ trong mã:**
  - `apps/web/src/ui/ui.css:510-513` (`.ui-overlay` z-index 50).
  - `apps/web/src/ui/ui.css:554-557` (`.ui-sheet-overlay` z-index 40).
  - Điện thoại thì ô chọn thợ dùng `BottomSheet`: `apps/web/src/features/contracts/StaffPicker.tsx:110`.
  - Ô này mở từ trong `Dialog` của `apps/web/src/features/contracts/ExtraPackageDialog.tsx` (truyền `phone`, `:196`).

### NHẸ

**L1. Màn Thương hiệu: mục "Gói hiện trên trang" vẫn để công tắc "Mẹ cô dâu" bật, không ghi gì**
- **Triệu chứng:** nhân vật "Mẹ cô dâu" đang ẩn.
  - Trong Cài đặt → Thương hiệu → "Gói hiện trên trang", dòng "Mẹ cô dâu 800.000 ₫" vẫn có công tắc **bật**.
  - Không có chữ nào nói gói này đang không hiện vì nhân vật đã ẩn.
  - Ngay bên phải, khung xem trước không có gói này.
  - Chủ studio dễ nghĩ gói đang hiện. Hoặc ngược lại, bật công tắc mãi mà không thấy gói lên trang.
- **Ảnh:** `R1-thuong-hieu-cho-co-me-co-dau-1440.png`, `R1-xem-truoc-thuong-hieu-390.png`.
- **Chỗ trong mã:** `apps/web/src/features/brand/groups/PublicPackagesGroup.tsx:63-84`. Mỗi gói một công tắc `isPublic`, không xét nhân vật.

**L2. Màu ảnh đại diện mới chỉ đồng bộ ở Lịch và Hợp đồng (thợ đã khai, việc tồn 48)**
- **Triệu chứng:**
  - Ở màn Thợ makeup và Tiền công, Linh Trần và Lê Minh Tú vẫn cùng màu nâu cam.
  - Lê Minh Tú mang **hai màu** ở hai màn: nâu xám ở Lịch và Hợp đồng, nâu cam ở Thợ makeup.
  - Trước vòng này, một người luôn một màu ở mọi màn, dù có thể trùng màu với người khác.
- **Ảnh:** `R4-nhan-su-1440.png`, `R4-tien-cong-1440.png`; so với `R2-lich-11-22-C-1440.png`.
- **Chỗ trong mã:** `apps/web/src/features/staff/StaffRow.tsx:43` (`colorKey={row.membershipId}`).

**L3. Hộp "Thêm phát sinh": chữ tắt trên ảnh thợ sai ("PC", "NP" thay vì "PH", "NH")**
- **Triệu chứng:**
  - Chọn Phạm Thu Hà (chính) và Nguyễn Thu Hà trong hộp phát sinh. Ảnh đại diện ghi **"PC"** và **"NP"**.
  - Lý do: chữ tắt bị tính từ chuỗi "Phạm Thu Hà · thợ **c**hính" và "Nguyễn Thu Hà · thợ **p**hụ".
  - Chỉ chọn một thợ thì cũng sai: "… · thợ chính" ra chữ cuối "C".
  - Tên chữ bên cạnh vẫn đúng.
  - Ở màn lập hợp đồng thường thì đúng (PH, NH).
  - Có từ trước: ở `4143eb3`, dòng này đã như vậy.
- **Ảnh:** `R2-phat-sinh-hai-ha-1440.png`.
- **Chỗ trong mã:**
  - `apps/web/src/features/contracts/ExtraPackageDialog.tsx:175` dựng `people` mà không có `initials`. `personOf` ở `:56-58` chỉ trả tên.
  - `apps/web/src/features/contracts/StaffRow.tsx:47` đặt `name` của ảnh là "tên · thợ chính/phụ". Thiếu `initials` thì `Avatar` rút chữ tắt từ chuỗi đó.

**L4. `docs/PROGRESS.md:35` vẫn ghi lần chấm gần nhất là `d417acf`**
- Thực tế đã chấm lần 3 trên `6df580a`, và nay là lần 4 trên `8f6ac89`. Chỉ là chữ cũ.

**Hai chỗ bài thử chưa canh** (không phải lỗi của app; chi tiết ở mục 1.2):
- D2: khung xem trước lấy danh sách nhân vật đang dùng, ở `apps/web/src/features/brand/useProfileDraft.ts:143`.
- D8: màu ảnh trong ô chọn thợ, ở `apps/web/src/features/contracts/StaffPicker.tsx:89`.

**Quan sát cũ, không do vòng này:** khung xem trước ở màn Thương hiệu bày dịch vụ phụ "+ Làm tóc cô dâu 500.000 ₫", "+ Nối mi 200.000 ₫". Trang thật thì không bày, vì hai dịch vụ này không bật công khai.
- Ảnh: `R1-xem-truoc-thuong-hieu-390.png`; so với `R1-trang-cong-khai-390.png`.
- Chỗ trong mã: `apps/web/src/features/brand/draftToSite.ts:37` chỉ xét `isActive`. Máy chủ (`apps/api/src/modules/profile/public.ts:98`) xét thêm `isPublic`.
- Ảnh lần 3 cũng vậy.

---

## 4. Các luồng tôi đi lại (hồi quy)

Tôi làm trên `makeup_test_cham4_dung`, máy chủ 4320, web bản build 5380:

1. **Lập hợp đồng dịch vụ có thợ và giờ** (1440):
   - Khách Hoàng Minh Thư, ngày 06/12/2026.
   - Gói "Cô dâu cao cấp" 08:00–10:00, thợ Nguyễn Thu Hà.
   - Lưu nháp, ra HD-000006.
2. **Xác nhận:** báo "Đã xác nhận hợp đồng · đã tạo 1 lịch". Dòng khoá, có "Đổi ở Lịch".
3. **Lịch 06/12:** ca 08:00 của Hoàng Minh Thư hiện ở cả 3 chế độ, ở 1440 và 390. Database có đúng 1 ca 08:00–10:00 gán Nguyễn Thu Hà.
4. **Thu tiền:** ghi phiếu PT-000003, 1.000.000 ₫, chuyển khoản. Màn báo "Đã thu thực tế 1.000.000 ₫ · Còn lại 1.500.000 ₫".
5. **Báo cáo:**
   - Doanh thu tháng 10: 11.394.000 · cọc 3.900.000 · đã thu 3.800.000 · còn 7.594.000.
   - Sổ thu: 3 phiếu, 3.800.000.
   - Như nhau ở 1440 và 390, khớp database (mục 1.3).
6. **Mọi bước chạy được**, không có lỗi JavaScript, không tràn ngang.

**Việc tôi lỡ làm trên database thử** (ghi để anh khỏi thắc mắc khi mở lại):
- **Bài bấm nút** gạt nhầm 6 công tắc nhân vật và 3 công tắc "Gói hiện trên trang". Tôi đã gạt lại qua giao diện, đúng như trạng thái ban đầu và đã kiểm trong database. Nhờ vậy cũng thấy: khi nhân vật của mọi gói công khai đều tắt, trang công khai ẩn cả mục "Bảng giá", không để mục rỗng. Như vậy là đúng.
- **Bài thử hộp phát sinh ở 390** dùng lệnh bấm ép, nên lỡ thêm 2 dòng "Phù dâu 15:00" vào HD-000001. Tôi đã huỷ cả hai bằng nút "Huỷ dòng" của app. Tổng trở lại 5.194.000 ₫. Hai ca của hai dòng này còn trên Lịch: đó chính là lỗi N1.

---

## 5. Chưa chấm được

- **R2 trong hộp "Thêm phát sinh" ở 390:** ô chọn thợ bị che (N2) nên không chọn được thợ. Ở 1440 thì đã kiểm, đúng.
- **Điện thoại thật, Safari iPhone:** tôi dùng Chromium giả lập 390.
- **Quyền theo vai trò:** đã thử chủ và một thợ (Phạm Thu Hà, chỉ phần Lịch). Chưa thử lễ tân, kế toán, giảng viên.
- **Bộ "19/19 đột biến" của thợ:** chưa chạy lại từng cái. Tôi tự cài 11 đột biến của riêng tôi, bài thử bắt được 9/11 (mục 1.2).
- **Lưu đệm 60 giây của trang công khai** (việc tồn 50): không đo trong cùng một trình duyệt.
- **Tài liệu chạy thử** (R5): tôi đọc và đối chiếu lịch sử kho. Không chạy lại trọn tài liệu trên bản lấy mã mới, vì lần 3 đã làm và vòng này chỉ sửa 2 dòng chữ.

---

## 6. Anh Chiến vào thao tác thật được chưa

**Studio dịch vụ makeup: ĐƯỢC.**
- Năm mục sửa của lần trước đã xong và đã kiểm trên app thật.
- Trang giới thiệu không còn bày giá gói đã ngừng bán.
- Hai chị "… Thu Hà" có tên rõ ràng ở mọi màn.
- Hai thợ cùng chữ tắt khác màu ở Lịch và Hợp đồng.
- Bài thử tự động xanh hết. Tiền khớp ở mọi màn.

**Ba điều nên nhớ khi dùng, cho tới khi thợ sửa:**
1. **Huỷ một dòng của hợp đồng đã xác nhận thì sang Lịch "Huỷ lịch" luôn ca của dòng đó** (N1). Nếu không, ca vẫn nằm trên lịch và giữ giờ của thợ.
2. **Thêm phát sinh có thợ thì làm trên máy tính hoặc máy tính bảng** (N2). Trên điện thoại, nút "Chọn thợ" trong hộp phát sinh không mở được. Nếu đã lỡ thêm phát sinh không có thợ, vào Lịch bấm "Phân thợ".
3. **Tắt một nhân vật thì nên tắt luôn công tắc "Gói hiện trên trang" của gói đó** trong màn Thương hiệu (L1). Trang công khai đã tự ẩn gói, nhưng tắt luôn thì màn cài đặt khỏi gây hiểu lầm.

**Học viện (đào tạo):** vòng này không đụng tới phần đào tạo. Kết luận "ĐƯỢC" của lần 3 vẫn giữ.

**Nên sửa khi tiện, theo thứ tự:**
1. **N1:** huỷ dòng thì huỷ luôn ca gắn dòng đó.
2. **N2:** ô chọn thợ trên điện thoại phải nổi trên hộp phát sinh.
3. **L3:** chữ tắt ở hộp phát sinh.
4. **L1:** ghi chú "đang ẩn vì nhân vật tắt" ở mục "Gói hiện trên trang".
5. **L2:** cho màn Thợ makeup và Tiền công dùng chung hàm màu.
6. Thêm bài thử cho hai đột biến lọt D2 và D8. Sửa chữ cũ ở `PROGRESS.md` (L4).

**Database để tái hiện:** `makeup_test_cham4_dung`, tài khoản `chien.chu@studio-thu.vn` / `MatKhau@2026x`. Trạng thái hiện tại:
- "Mẹ cô dâu" đang tắt, gói "Mẹ cô dâu" bật công khai (R1).
- Nguyễn Thu Hà **đã xoá tên hiển thị**, nên có hai thợ "… Thu Hà" chưa có tên hiển thị (R2, R3). HD-000004 có cả hai.
- HD-000006 mới, đã thu cọc 1.000.000.
- HD-000001 có 2 dòng phát sinh đã huỷ, mà 2 ca 15:00 ngày 22/11 vẫn còn trên Lịch (N1).
- Database gốc `makeup_test_cham3_dung` tôi không sửa.

---

## 7. Phụ lục

- **Thư mục chấm:** `/tmp/claude-0/-home-user-a/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-4/`
  - `anh/`: 126 ảnh khung màn hình.
    - `R1-*`, `R2-*`, `R4-*`, `M4-*`: các mục cần chấm.
    - `MOI-*`: lỗi mới N1, N2.
    - `HQ-*`: luồng hồi quy.
    - `t-*`: vòng đi 19 màn × 3 khổ.
  - `log/`: nhật ký lệnh.
    - Bài thử: `api-*.txt`, `shared.txt`, `web-*.txt`.
    - Đột biến: `dot-bien-web.txt`, `dot-bien-api.txt`.
    - Kiểm R1: `r1.txt`. Ở dòng xem trước của `r1.txt`, chữ "Mẹ cô dâu 800.000" là của danh sách "Gói hiện trên trang" trong cột chỉnh sửa (L1), không phải của khung xem trước. Tôi kiểm lại riêng khung xem trước ở `R1-*-xem-truoc-*`.
    - Kiểm R2, R3, R4: `R2.json`, `r2-out.txt`.
    - Hồi quy: `hq1.txt`, `hq2*.txt`.
    - Đi màn và bấm nút: `tour.txt`, `nut.txt`.
  - `do-tran-ngang.tsv`: số đo tràn ngang, 57 dòng.
  - `pw/`: các bài thao tác Playwright. Liên kết `node_modules` đã gỡ cùng bản tách; muốn chạy lại thì phải dựng lại bản tách.
