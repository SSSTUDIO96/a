# Biên bản nghiệm thu máy chủ Lát 2: tệp, thu tiền, quản trị nền tảng + hạn mức, hồ sơ thương hiệu

- **Ngày chấm:** 18/10/2026, khoảng 17:10–18:00 UTC
- **Người chấm:** thợ chấm độc lập (AI, không tham gia viết mã)
- **Bản được chấm:** commit `cd7f891` ("Cửa gác đủ đường mới… máy chủ 316/316"). Bản sao riêng là một worktree trong thư mục nháp, đã gỡ sau khi chấm.
- **Database:** `makeup_test_cham2`, tạo riêng cho lần chấm này và đã xoá khi xong.
- **Cam kết:** không sửa mã sản phẩm, không commit.
  - Khi "phá chốt", tôi sửa tạm từng chỗ trong bản sao, chạy bài thử, rồi chép lại tệp gốc.
  - `git status` sau cùng chỉ còn thư mục bài thử của tôi và liên kết `node_modules`, không còn tệp mã nào bị đổi.
- **Bài tái hiện:** nằm cạnh biên bản này, trong thư mục `bai-thu/`:
  - `tep-tan-cong.test.ts`
  - `thu-tien-tan-cong.test.ts`
  - `nen-tang-tan-cong.test.ts`
  - `ho-so-tan-cong.test.ts`
  - `pha-chot.py`
- **Nhật ký chạy thật:** thư mục `log/`.

**Quy ước tên bài thử** (giống các biên bản trước):

| Tên bài | Bài xanh nghĩa là |
|---|---|
| "LỖI:" | lỗi có thật |
| "CHẶN:" | đòn tấn công bị chặn |
| "GHI NHẬN:" | hành vi có thật, cần chủ quyết |

**Hai từ dùng nhiều trong biên bản:**
- **Đột biến (phá chốt):** cố ý sửa sai đúng một chỗ trong mã. Nếu bài thử của thợ vẫn xanh thì bài thử đó "mù" với kiểu lỗi ấy.
- **Chống gửi trùng (Idempotency-Key):** mỗi lần bấm "Lưu", ứng dụng gửi kèm một mã. Nhờ mã này máy chủ nhận ra "đây là bấm lại" và không tạo bản ghi thứ hai.

---

## 0. Kết luận ngắn cho chủ studio

| Module | Thợ | Kết luận |
|---|---|---|
| 1. Lưu trữ tệp | B | **ĐẠT CÓ ĐIỀU KIỆN** |
| 2. Thu tiền | G | **ĐẠT CÓ ĐIỀU KIỆN** |
| 3. Quản trị nền tảng + hạn mức gói | H | **KHÔNG ĐẠT** |
| 4. Hồ sơ thương hiệu + trang công khai | A | **ĐẠT CÓ ĐIỀU KIỆN** |

**1 lỗi nghiêm trọng (S1, module 3).** Người quản trị nền tảng chỉ sửa **giá** của một gói thuê bao. Máy chủ lặng lẽ đổi cả 9 thông số khác của gói đó:
- Mọi giới hạn bị xoá thành "không giới hạn": số nhân sự, số lịch/tháng, dung lượng, học viên, khoá học.
- Gói đã ngừng bán được bật bán lại.
- Tính năng, tên miền riêng và thứ tự hiển thị về mặc định.

Đã đo: một tổ chức đang bị chặn ở mức 2 nhân sự, sau khi sửa giá gói thì được thêm người không giới hạn. Hôm nay hạn mức chưa gắn vào module nào nên chưa mất tiền thật. Gắn hạn mức vào là mất tiền ngay.

**3 lỗi trung bình:**
- **M1 (tệp).** Dùng lại một mã chống gửi trùng cho **tệp khác** thì máy chủ báo "đã tải lên" (201) nhưng không lưu tệp mới, mà trả về tệp cũ. Cùng kiểu với lỗi T1 của lát 1. Đo: 5/5 lần.
- **M2 (nền tảng).** Người **chưa đăng nhập** vẫn biết trang quản trị nền tảng có những đường nào, theo hai cách:
  - Đường thật trả 401, đường bịa trả 404. Phân biệt được 8/8 đường.
  - Tài liệu API công khai liệt kê đủ 8/8 đường.

  Lời hứa "404 y hệt đường bịa" chỉ đúng với người đã đăng nhập.
- **M3 (thu tiền).** Một phiếu thu cực lớn, kiểu gõ thừa số 0 kèm "cho thu vượt", làm **báo cáo doanh thu và sổ thu của cả tổ chức báo lỗi 500**. Sổ thu là công cụ để tìm ra phiếu sai, nhưng chính nó cũng chết theo.

**Phần đứng vững** (đo bằng bài của tôi, chi tiết ở mục 2):
- **Cách ly tổ chức ở cả 4 module**, gồm cả mã trong thân yêu cầu, tham số lọc và lời báo lỗi.
- **Tiền:**
  - Số âm, số lẻ, số quá lớn bị chặn 12/12.
  - Thu vượt, hoàn vượt, huỷ hai lần đều bị chặn.
  - 20 phiếu gửi song song: đúng 10 phiếu qua, tổng không vượt, mã PT không trùng.
  - Báo cáo không tính phiếu đã huỷ; tháng tính theo giờ Việt Nam.
- **Vé đọc tệp:** sửa từng ký tự ở mọi vị trí của vé, 0/366 lần mở được tệp.
- **Trang công khai:** 0/14 loại dữ liệu nội bộ lộ ra.

**Bài thử của thợ còn mù nhiều chỗ** (mục 4). Tôi tự phá 26 chốt mà thợ không nhắc tới, bài thử của thợ chỉ đỏ ở 10. Đáng lo nhất:
- Bỏ khoá chống đua khi ghi phiếu thu: bài thử của thợ vẫn xanh 17/17. Bài của tôi thì đo được thu lọt 1,8 triệu trên hợp đồng 1 triệu.
- Ba chốt đếm hạn mức (nhân sự, dung lượng, lịch theo tháng): bài thử của thợ không bắt được chốt nào.

---

## 1. Lệnh đã chạy và kết quả thật

| # | Lệnh | Kết quả thật |
|---|---|---|
| 1 | `git -C /home/user/a worktree add …/cham-lat2 cd7f891` | Bản sao đúng commit `cd7f891` |
| 2 | Liên kết `node_modules` từ `/home/user/a` (ln -s, chép liên kết) | Xong. **Nhưng xem dòng 5–6** |
| 3 | `su postgres -c "createdb -O makeup makeup_test_cham2"` + `create extension btree_gist` | Xong |
| 4 | `packages/shared`: `tsc --noEmit`, `vitest run` | tsc 0 lỗi; **78/78** (5 tệp) |
| 5 | `apps/api`: `tsc --noEmit`, rồi `vitest run` (lần 1, dùng chung bộ Prisma đã sinh mã của `/home/user/a`) | tsc 0 lỗi; **315/316**. Phép cửa gác `refBase` 21/23: `PATCH /staff/:membershipId` → 500, lý do "cột `staff_profiles.avatar_file_id` không có trong database" (bằng chứng: `log/tenant-rerun.txt`; `log/api-test.txt` đã bị lần chạy 2 ghi đè) |
| 6 | Tra nguyên nhân dòng 5 | Bộ Prisma dùng chung đã **bị một thợ khác sinh lại lúc 17:15:32 UTC**, đúng lúc tôi đang chạy, từ sơ đồ dữ liệu mới hơn có cột `avatar_file_id`. Đây là lỗi môi trường, không phải lỗi mã `cd7f891` (mục 5) |
| 7 | Tách bộ Prisma riêng cho bản chấm: chép `@prisma/client` vào `apps/api/node_modules`, `prisma generate` từ sơ đồ của `cd7f891` | Sơ đồ sinh ra khớp từng dòng với `cd7f891`. Bộ dùng chung giữ nguyên dấu thời gian 17:15:32, tôi không ghi đè |
| 8 | `apps/api`: `tsc --noEmit` + `vitest run test` (lần 2) | **316/316** (22 tệp). Cửa gác: scope 73/73, người ngoài 73/73, thiếu quyền 73/73, chưa đăng nhập 83/83, id chéo 36/36, lộ dữ liệu 30/30, refBase 23/23, mã chéo 54/54, giữ đúng nghĩa 73/73, platform 24/24. Đột biến cửa gác 1, 3–9 đều đỏ. **Khớp số 316/316 thợ khai** |
| 9 | Bài tấn công của tôi: `vitest run test-cham2` (4 tệp) | **47/47** (bản chạy cuối, `log/bai-cham-cuoi.txt`, số đo ở `log/so-do-cuoi.txt`) |
| 10 | `python3 bai-thu/pha-chot.py <bản chấm>`: 26 đột biến mới + 4 đối chứng, chạy trên **bài thử của thợ** | Đối chứng đỏ 4/4: bộ phá chốt hoạt động đúng. Đột biến mới đỏ **10/26**. Chi tiết mục 4 (`log/pha-chot.txt`, `log/pha-chot.json`) |
| 11 | Chạy 16 đột biến mà bài thử của thợ không bắt được, trên **bài của tôi** (`TESTS=test-cham2/… pha-chot.py`) | Bài của tôi bắt được **7/16** (`log/pha-chot-bai-cham.txt`) |
| 12 | Chạy cả hai bộ trên mã sạch: `vitest run test` | 26 tệp, 363/363 (= 316 của thợ + 47 của tôi; bộ lọc "test" khớp cả `test-cham2`). Cửa gác như dòng 8 |
| 13 | `git -C <bản chấm> status --porcelain` sau mọi lần phá | Chỉ còn `?? apps/api/test-cham2/` và `?? node_modules`. Mã nguyên vẹn |

Muốn chạy lại bài của tôi:
1. Dựng worktree ở `cd7f891`.
2. Tách bộ Prisma riêng như dòng 7.
3. Chép `bai-thu/*.test.ts` vào `apps/api/test-cham2/`.
4. Chạy `TEST_DATABASE_URL=… npx vitest run test-cham2`.

---

## 2. Từng đòn tấn công và số đo

### 2.1 Module 1: Lưu trữ tệp (`tep-tan-cong.test.ts`, 13 bài)
Đường đọc tệp `/api/v1/files/raw/:token` chưa gắn vào app.ts. Tôi gắn ngoài, đúng như bài thử của thợ.

| Đòn | Kết quả | Số đo |
|---|---|---|
| Tệp giả dạng ảnh: HTML, SVG có mã chạy, GIF, EXE, ZIP đổi đuôi | CHẶN | 5/5 bị từ chối 400, không lưu |
| PNG thật + trang HTML phía sau (tệp hai mặt) | GHI NHẬN | Được nhận. Khi phát ra có `nosniff` + CSP `sandbox`, nên trình duyệt không chạy mã |
| Ảnh khai 20000×20000 điểm ảnh | GHI NHẬN | 201. 20001 → 400 |
| 30 MB gửi kiểu chunked cho logo (giới hạn 2 MB) | CHẶN | 3/3 không lưu. Máy chủ cắt kết nối sau ~3,8 MB, máy khách nhận **lỗi mạng ECONNRESET chứ không nhận lời báo 400** (N1) |
| Sửa từng ký tự của vé, mọi vị trí, 2 kiểu sửa mỗi vị trí | CHẶN | **0/366** mở được tệp, cả 366 lần đều 403 |
| Vé hết hạn / ký bằng khoá khác / ký đúng cho khoá bịa | CHẶN | 403 "hết hạn" / 403 / 404 |
| Tệp đã xoá: vé cũ và xem thông tin | CHẶN | 404 / 404 |
| Đường dẫn đĩa lộ trong phản hồi (tải lên, xem, lỗi, raw) | CHẶN | **0/27** phản hồi chứa đường dẫn đĩa. Tên `../../etc/passwd` được lưu thành `.._.._etc_passwd` |
| Nội dung vé | GHI NHẬN | Vé chỉ là base64 của `org/<mã tổ chức>/<mục đích>/<uuid>.png\|hạn`. Ai cầm vé cũng đọc được mã tổ chức (N3) |
| **Cùng mã chống gửi trùng, khác tệp** | **LỖI (M1)** | **5/5** trả 201 kèm tệp lần đầu, tệp sau không được lưu |
| **Cùng mã, khác mục đích** (`?purpose=`) | **LỖI (M1)** | Xin STAFF_AVATAR, nhận về bản ghi ORG_LOGO |
| Tổ chức bị khoá | GHI NHẬN | Vé đã cấp vẫn phát tệp (200) tới hết hạn 10 phút; API xem tệp → 403 (N2) |
| Đường raw trong app thật | LỖI đã biết | URL ký trả ra từ app thật → 404 "Không có đường API này". Mọi ảnh của sản phẩm chưa hiện được cho tới khi gắn đường raw |

### 2.2 Module 2: Thu tiền (`thu-tien-tan-cong.test.ts`, 16 bài)

| Đòn | Kết quả | Số đo |
|---|---|---|
| Số tiền: −1, 0, 1,5, 0,1, "1000", "NaN", 1e20, MAX_SAFE+1, "1e3", null, true, [1000] | CHẶN | **12/12** → 400, 0 phiếu ghi |
| Tiến độ: đợt âm, đợt 0, đợt lẻ, tổng lệch 1 đồng | CHẶN | 4/4 → 400 |
| **2 phiếu 5 triệu tỷ** (cho thu vượt + ghi chú) ở 2 hợp đồng | **LỖI (M3)** | Ghi được 201/201. **Báo cáo doanh thu → 500, sổ thu → 500.** Huỷ một phiếu thì báo cáo sống lại |
| Thu vượt 1 đồng / hoàn vượt 1 đồng / huỷ phiếu lần 2 | CHẶN | 409 / 409 / 200 rồi 409 |
| Hợp đồng nháp thu đủ 1 tr rồi sửa nháp xuống 200 nghìn | GHI NHẬN | Sửa được (200). Máy chủ ghi khách "trả thừa" 800 nghìn mà không cần cờ "cho thu vượt" và ghi chú |
| **20 phiếu thu 100 nghìn song song vào hợp đồng 1 tr** | CHẶN | **10/20 qua**, tổng đúng 1.000.000, 10 mã PT khác nhau, 10 phiếu còn lại 409 |
| 20 phiếu hoàn song song khi đã thu 1 tr | CHẶN | 10/20 qua, số đã thu sau cùng = 0 |
| 15 lệnh huỷ cùng một phiếu song song | CHẶN | 1/15 qua, 1 dòng nhật ký |
| Đua trộn: huỷ phiếu thu + huỷ phiếu hoàn + thêm hoàn (10 vòng) | CHẶN | 0/10 vòng có số đã thu âm |
| 20 phiếu song song rải trên 5 hợp đồng | CHẶN | 20/20 qua; mã PT-000001…PT-000020 liên tục, không trùng, không hở |
| Báo cáo: phiếu lúc 31/8 17:30 UTC (= 1/9 00:30 giờ VN) | CHẶN | Vào tháng 2026-09; tháng 8 = 0 |
| Báo cáo: phiếu đã huỷ | CHẶN | Không tính (111 nghìn đã huỷ không có trong tổng). Sổ thu vẫn liệt kê phiếu huỷ để đối soát (3 dòng) |
| Báo cáo: hợp đồng nháp | GHI NHẬN | Không vào doanh số; tiền thu của nó **có** vào "đã thu thực tế", đúng như dòng giải thích cách tính trong báo cáo |
| Hợp đồng xác nhận rồi huỷ | CHẶN | Ra khỏi doanh số; tiền đã thu vẫn trong "đã thu"; dòng hợp đồng có remaining = null |
| Ngày thu lùi về 1990 / lùi 40 ngày | GHI NHẬN | 201 / 201. Số "đã thu" của các kỳ đã qua thay đổi theo (N6) |
| Chủ B dùng mã hợp đồng/phiếu của A ở 5 đường (đường, thân, tham số lọc) | CHẶN | **5/5 cặp** phản hồi giống hệt mã bịa (404); phiếu của A không bị huỷ |
| Vai trò tự tạo chỉ có quyền xem thu tiền (không có quyền xem khách) | GHI NHẬN | Danh sách khách → 403, nhưng tiến độ thu tiền trả **tên + số điện thoại khách** (N5) |
| Nhật ký trước → sau: ghi phiếu, hoàn, huỷ, thay tiến độ | CHẶN | 4/4 đủ |

### 2.3 Module 3: Quản trị nền tảng + hạn mức (`nen-tang-tan-cong.test.ts`, 12 bài)

| Đòn | Kết quả | Số đo |
|---|---|---|
| Người đã đăng nhập (không có quyền) dò 8 đường `/platform/` | CHẶN | 8/8 → 404 giống hệt đường bịa |
| **Người chưa đăng nhập / thẻ rác** dò 8 đường | **LỖI (M2)** | **8/8 phân biệt được**: đường thật 401, đường bịa 404. Thẻ rác: 8/8 |
| **`/api/v1/openapi.json`, không cần đăng nhập** | **LỖI (M2)** | 200; liệt kê **8/8** thao tác `/platform/` kèm khuôn thân yêu cầu |
| **PATCH gói chỉ gửi `priceMonthly`** | **LỖI (S1)** | 200; **9/9 trường không gửi bị đổi**: maxStaff 2→null, maxAppointmentsPerMonth 30→null, maxStorageMb 500→null, maxStudents 0→null, maxCourses 0→null, customDomain true→false, features ["web"]→[], isActive false→true, sortOrder 7→0 |
| Hệ quả lên hạn mức | **LỖI (S1)** | Tổ chức ở giới hạn 2 nhân sự. Trước khi sửa giá: thêm người thứ 3 bị chặn "Đã đạt giới hạn gói…". Sau khi sửa giá: **qua** |
| Thuê bao 1 năm đã trả + một dòng dùng thử ngắn chồng lên (cả hai bắt đầu trong quá khứ) | GHI NHẬN (N8) | Cả hai 201; dòng ngắn thành thuê bao hiện hành; **7 ngày sau tổ chức bị chỉ đọc** dù năm đã trả còn ~347 ngày |
| Đã đặt lịch gia hạn bắt đầu ở tương lai, rồi muốn đổi gói ngay hôm nay | GHI NHẬN | 409 "Ngày bắt đầu không được trước…". Không có cách đổi gói trước ngày đã hẹn |
| Mốc ân hạn: còn 1 giây / đúng 7 ngày / EXPIRED ghi tay | CHẶN | Được ghi / chỉ đọc / chỉ đọc |
| Thuê bao sai: ngày hết hạn ≤ ngày bắt đầu, gửi cả months lẫn ngày hết hạn, gói bịa, tổ chức bịa, months 0, months 1,5 | CHẶN | 400, 400, 404, 404, 400, 400; 0 dòng ghi |
| Tạm khoá tổ chức | CHẶN | Nhật ký có trước → sau + lý do |
| Doanh thu thuê bao dự kiến khi tổ chức bị khoá | GHI NHẬN (N9) | Trước khoá 2.071.607, sau khoá 2.071.607: vẫn cộng tổ chức đang bị khoá |
| Chưa có gói "trial" + tổ chức chưa có thuê bao → gọi hàm kiểm hạn mức | GHI NHẬN (N10) | 500, kèm lời "…Người vận hành tạo gói này (`pnpm --filter @makeup/api platform:seed-plans -- --with-trial`)…". Khi gắn vào đường thật, người dùng studio sẽ đọc thấy lệnh vận hành |

### 2.4 Module 4: Hồ sơ thương hiệu + trang công khai (`ho-so-tan-cong.test.ts`, 6 bài)

| Đòn | Kết quả | Số đo |
|---|---|---|
| Quét JSON công khai của một studio có đủ dữ liệu nội bộ | CHẶN | **0/14** loại bí mật lộ dạng chữ: email chủ, email thợ, SĐT thợ, SĐT khách, tên khách, cọc nội bộ của gói, tiền công, tổng/cọc hợp đồng, giá dịch vụ không công khai, mã thành viên, mã bậc, mã hợp đồng, mã tổ chức |
| …nhưng trong vé ảnh logo | GHI NHẬN (N3) | Giải base64 ra `org/<mã tổ chức>/org-logo/<uuid>.png`. Bài thử của thợ coi mã tổ chức là thứ không được lộ, nhưng chỉ dò dạng chữ thường nên không thấy |
| Tên dịch vụ **không công khai** nằm trong mục "gồm trong gói" | GHI NHẬN | Có hiện, không kèm giá. Bài thử của thợ cố ý cho phép (N12) |
| Chưa xuất bản / đã gỡ / tổ chức bị khoá / slug thừa ký tự, so với slug bịa | CHẶN | 4/4 → 404 giống hệt |
| Slug viết hoa khi đã xuất bản | — | 200 (máy chủ đổi về chữ thường) |
| Thuê bao CANCELLED từ 30 ngày trước | GHI NHẬN (N11) | Trang công khai vẫn 200 |
| Chủ B gắn logo, ảnh đại diện, ảnh bìa bằng mã tệp của A | CHẶN | **3/3** giống hệt mã bịa (400); hồ sơ của B không được tạo |
| Thợ / lễ tân sửa hồ sơ, xuất bản | CHẶN | 403 ×4 |
| Nhật ký: tạo, sửa, xuất bản 2 lần, gỡ | CHẶN | Đúng 4 hành động, xuất bản lần 2 không ghi trùng. Bản "sửa" có cả giá trị cũ "Tên cũ/0901111222" lẫn giá trị mới "Tên mới/null" |

---

## 3. Từng lỗi: triệu chứng, gốc bệnh, số đo, bài tái hiện

### S1. NGHIÊM TRỌNG: Sửa giá gói làm mất mọi giới hạn và bật bán lại gói đã ngừng (module 3)
- **Triệu chứng:** `PATCH /api/v1/platform/plans/:planId` với thân `{ "priceMonthly": 129000 }` trả 200. Gói bị đổi 9/9 trường không gửi (bảng 2.3). Nhật ký cũng ghi "sau" là các giá trị mặc định đó, nên nhìn nhật ký tưởng người quản trị chủ ý đặt "không giới hạn".
- **Gốc bệnh:**
  - `apps/api/src/modules/platform/routes.ts:463-465`: `PlanBody.omit({ code: true }).partial()`.
  - `PlanBody` (`routes.ts:137-150`) có `.default(null)` / `.default(false)` / `.default([])` / `.default(true)` / `.default(0)`.
  - Với zod 4, trường có mặc định nằm trong `.partial()` **vẫn được điền mặc định khi bị bỏ trống**. Tôi tự thí nghiệm: `parse({priceMonthly:5})` → `{"priceMonthly":5,"maxStaff":null,"customDomain":false,"features":[],"isActive":true,"sortOrder":0}`.
  - Thân đã điền mặc định đi thẳng vào `update` (`routes.ts:471-475`).
- **Vì sao bài thử của thợ không thấy:** bài "sửa giá" (`test/platform.test.ts:214-219`) gửi kèm `maxStaff: null` và chỉ kiểm hai trường vừa gửi.
- **Số đo:** 9/9 trường bị đổi. Hạn mức nhân sự: trước khi sửa giá thì bị chặn, sau thì qua.
- **Tái hiện:** `nen-tang-tan-cong.test.ts` → "PL-2", 2 bài.
- **Vì sao nghiêm trọng:**
  - Một thao tác thường ngày ("đổi giá") âm thầm xoá cấu hình tính tiền của mọi tổ chức dùng gói đó.
  - Tổ chức trả tiền gói rẻ sẽ được dùng không giới hạn ngay khi hạn mức được gắn vào module.
  - Gói đã ngừng bán lập tức bán lại được (`isActive` → true).

### M1. TRUNG BÌNH: Chống gửi trùng không phân biệt nội dung tệp nhị phân (module 1)
- **Triệu chứng:** dùng lại cùng mã chống gửi trùng cho tệp khác → 201 kèm bản ghi của tệp lần đầu. Tệp thứ hai không nằm trong database. Đổi `?purpose=` cũng bị trả bản ghi cũ.
- **Gốc bệnh:**
  - `apps/api/src/app.ts:142`: dấu vân tay của yêu cầu là `sha256(JSON.stringify(req.body ?? null))`. Với tệp nhị phân, `req.body` là `undefined`, nên **mọi lần tải lên có cùng một dấu vân tay "null"**.
  - `routeKey` (`app.ts:141`) không gồm tham số `?purpose=&name=`.
  - Đường tải tệp bật chống gửi trùng ở `modules/files/routes.ts:28`.
- **Vì sao bài thử của thợ không thấy:** chỉ thử "cùng khoá + **cùng** tệp" (`test/files.test.ts:255`).
- **Số đo:** 5/5 cặp báo thành công giả; 1/1 khác mục đích.
- **Tái hiện:** `tep-tan-cong.test.ts` → "T-4", 2 bài.
- **Điều kiện xảy ra:** máy khách dùng lại khoá, ví dụ tải nhiều ảnh trong một lần bấm mà sinh khoá theo form. Hậu quả: mất ảnh mà vẫn báo thành công.

### M2. TRUNG BÌNH: Người chưa đăng nhập biết đủ các đường quản trị nền tảng (module 3)
- **Triệu chứng:**
  - Không có thẻ (hoặc thẻ rác): đường `/platform/…` thật → 401, đường bịa → 404.
  - `GET /api/v1/openapi.json` (công khai) liệt kê đủ 8 thao tác `/platform/` kèm khuôn thân yêu cầu.
- **Gốc bệnh:**
  - `apps/api/src/app.ts:71`: hệ thống xác thực người dùng **trước**, rồi mới kiểm danh sách quản trị (`app.ts:73`).
  - `apps/api/src/http/openapi.ts:7`: tài liệu dựng từ mọi đường, không lọc đường quản trị.
  - Chính cửa gác cũng **đòi** 401 cho đường quản trị: `apps/api/test/gate.ts:295`, phép `unauth` gồm cả `/platform/`. Vì vậy cửa gác ép đúng hành vi làm lộ.
- **Số đo:** 8/8 phân biệt được (không thẻ), 8/8 (thẻ rác), 8/8 thao tác có trong OpenAPI.
- **Tái hiện:** `nen-tang-tan-cong.test.ts` → "PL-1", bài 2 và 3.
- **Vì sao trung bình:** không lộ dữ liệu. Nhưng nó vô hiệu lời hứa an ninh ở `docs/SECURITY.md` mục 1 dòng 27 và chú thích ở `app.ts:72`. Kẻ tấn công biết chính xác đường nào để dò mật khẩu quản trị nền tảng (hiện chưa có xác thực hai lớp).

### M3. TRUNG BÌNH: Một phiếu thu cực lớn làm sập báo cáo và sổ thu của cả tổ chức (module 2)
- **Triệu chứng:** 2 phiếu 5.000.000.000.000.000 đ (có `allowOverpay` + ghi chú) ở 2 hợp đồng.
  - `GET /reports/revenue` → 500.
  - `GET /payments` (sổ thu) → 500.
  - Huỷ một phiếu thì báo cáo sống lại.
- **Gốc bệnh:**
  - Mức trần số tiền mỗi phiếu là `Number.MAX_SAFE_INTEGER` (`modules/payments/schemas.ts:15`), khoảng 9 triệu tỷ đồng.
  - Database cộng các phiếu ra số vượt ngưỡng; `vnd()` ném `RangeError`, và lỗi này không được đổi thành lời báo có nghĩa:
    - `modules/payments/reports.ts:162,164` (`presentBucket`);
    - `modules/payments/routes.ts:286` (tổng sổ thu).
  - Chỉ trong một hợp đồng thì có `safeAdd` chặn; tổng toàn tổ chức thì không.
- **Số đo:** báo cáo 500, sổ thu 500 (1/1 lần dựng).
- **Tái hiện:** `thu-tien-tan-cong.test.ts` → "P-1 … LỖI".
- **Vì sao trung bình:** không mất số liệu, nhưng mất công cụ đối soát. Sổ thu là nơi để tìm ra phiếu gõ nhầm, mà chính sổ thu cũng sập. Nên đặt trần hợp lý cho một phiếu (ví dụ ≤ 10 lần tổng hợp đồng, hoặc ≤ 100 tỷ).

### Lỗi NHẸ và GHI NHẬN (đã tái hiện)

| # | Module | Việc | Gốc | Số đo / bài |
|---|---|---|---|---|
| N1 | tệp | Tệp quá cỡ gửi chunked: máy khách nhận lỗi mạng chứ không nhận lời "Tệp vượt giới hạn 2 MB", dù chú thích nói "rút cạn để máy khách nhận được lời báo lỗi" | `modules/files/service.ts:42-44` (`req.destroy()` khi quá 1 MB thừa) | 3/3 ECONNRESET sau ~3,8 MB; T-2 |
| N2 | tệp | Tổ chức bị khoá vẫn phát tệp qua vé đã cấp (≤ 10 phút) | `modules/files/raw.ts:25-29` không kiểm trạng thái tổ chức | raw 200, API 403; T-6 |
| N3 | tệp + hồ sơ | Vé đọc tệp chứa khoá lưu trữ ở dạng base64 nên đọc ra được mã tổ chức. Trang công khai có ảnh thì ai cũng lấy được mã tổ chức | `lib/storage/signing.ts:13` | T-3 "nội dung vé"; H-1 |
| N4 | tệp | Ảnh khai 20000×20000 điểm ảnh được nhận: máy khách giải mã có thể treo | `modules/files/service.ts:24,75` | 201; T-1 |
| N5 | thu tiền | Người chỉ có quyền xem thu tiền đọc được SĐT khách (không có quyền xem khách) | `modules/payments/common.ts:83` | danh sách khách 403, tiến độ có SĐT; P-5 |
| N6 | thu tiền | Ngày thu lùi tuỳ ý (1990, trước cả khi lập hợp đồng) → số "đã thu" của kỳ đã chốt có thể đổi | `modules/payments/routes.ts:117-120` chỉ chặn tương lai | 201/201; P-4 |
| N7 | thu tiền (nằm ở module hợp đồng) | Thu đủ rồi sửa nháp hạ tổng → "trả thừa" mà không qua luật "cho thu vượt phải có ghi chú" | `modules/contracts/routes.ts` (PATCH nháp không xét số đã thu) | overpaid 800.000; P-2 |
| N8 | nền tảng | Thuê bao chồng thời gian: dòng ngắn thêm sau thắng, tổ chức bị chỉ đọc dù kỳ đã trả còn dài. Đã hẹn gia hạn tương lai thì không đổi gói hôm nay được | `modules/platform/routes.ts:334-345` chỉ kiểm ngày bắt đầu; `lib/quota.ts:81-93` | 201/201 rồi chỉ đọc; 409; PL-3 |
| N9 | nền tảng | "Doanh thu dự kiến" cộng cả tổ chức đang bị khoá | `modules/platform/routes.ts:505-509` | không chênh trước/sau khoá; PL-4 |
| N10 | nền tảng | Thiếu gói "trial" → lỗi 500 kèm lệnh vận hành trong lời báo cho người dùng | `lib/quota.ts:111-115` | PL-5 |
| N11 | hồ sơ | Thuê bao huỷ/hết hạn quá ân hạn → trang công khai vẫn hiện | `modules/profile/public.ts:40` không xét thuê bao | 200; H-2. Chủ quyết |
| N12 | hồ sơ | Tên dịch vụ không công khai hiện trong "gồm trong gói" (không giá) | `modules/profile/public.ts:155-157` | H-1. Thợ cố ý, chủ quyết |
| — | tệp | (Đã biết) đường raw chưa gắn vào app.ts: ảnh trong app thật đều 404 | `app.ts` | T-7 |

### Nghi ngờ, CHƯA tái hiện (chưa thử thì ghi là chưa thử)
- **Driver S3:** tệp xoá mềm vẫn đọc được qua URL ký S3 tới 10 phút, vì S3 không biết trạng thái trong database (`lib/storage/s3.ts:80-82`). **Chưa thử với dịch vụ thật.**
- **Đường raw gắn trên Express trần** (cách bài thử đang làm) không có bộ bắt lỗi riêng. Nếu database lỗi, trang lỗi mặc định của Express ở chế độ phát triển in cả vết lỗi kèm đường dẫn mã. **Chưa thử.** Khi gắn vào app.ts thì bộ bắt lỗi chung sẽ lo.
- **`/public/sites/:slug` không giới hạn tốc độ.** Mỗi lần gọi chạy khoảng 6 truy vấn và ký URL ảnh. **Chưa đo tải.**
- **`storage.put` lỗi giữa chừng** để lại tệp `.tmp` trên đĩa (`lib/storage/local.ts:32-34`). **Chưa thử.**
- **Ngày đầu tháng tính theo múi giờ tổ chức cho hạn mức lịch** (`lib/quota.ts:183`): tôi chỉ kiểm bằng cách đọc mã và qua đột biến Q3 (bài thử của thợ mù). **Chưa có bài tái hiện riêng ở mốc giao tháng.**

---

## 4. Đánh giá việc thợ tự chấm (tự phá chốt)

Thợ khai đã phá: B (tệp) 8 chốt, G (thu tiền) 17, H (nền tảng) 11, A (hồ sơ) 14. **Danh sách các chốt đó không có trong kho**, nên tôi không đối chiếu từng cái được. Tôi chọn những chốt mà **tên các bài thử của thợ không nhắc tới**, sửa đúng một chỗ, rồi chạy bài thử của thợ (`pha-chot.py`).

Mỗi module có thêm một đột biến đối chứng mà bài của thợ chắc chắn bắt: phát tệp đã xoá, bỏ chặn ngày thu ở tương lai, bỏ khoá tư vấn khi kiểm hạn mức, lộ priceVersionId. Cả **4/4 đối chứng đỏ**, chứng tỏ bộ phá chốt chạy đúng.

| Mã | Module | Chốt bị phá | Bài thử của thợ | Bài của tôi |
|---|---|---|---|---|
| F1 | tệp | Bỏ CSP `sandbox` khi phát tệp | **xanh 18/18 (mù)** | ĐỎ (T-1) |
| F2 | tệp | Bỏ chặn ảnh > 20000 điểm ảnh | **xanh (mù)** | ĐỎ (T-1) |
| F3 | tệp | Xoá tệp không ghi nhật ký | **xanh (mù)** | xanh (mù) |
| F4 | tệp | Bỏ làm sạch tên tệp (giữ `/`, `\`, ký tự điều khiển) | **xanh (mù)** | ĐỎ (T-5) |
| F5 | tệp | Phát mọi tệp dạng `text/html` | ĐỎ 1/18 | — |
| F6 | tệp | Xem tệp quên lọc tổ chức | ĐỎ 2 (files + cửa gác) | — |
| P1 | thu tiền | **Bỏ khoá dòng hợp đồng khi ghi/huỷ phiếu** | **xanh 17/17 (mù)** | ĐỎ. Đo với mã đã phá: **18/20 phiếu song song qua, tổng thu 1.800.000 trên hợp đồng 1.000.000**; 1/10 vòng đua có số đã thu âm |
| P2 | thu tiền | Báo cáo tháng cộng phiếu đã huỷ | ĐỎ | — |
| P3 | thu tiền | Tháng báo cáo theo UTC thay vì giờ VN | **xanh (mù)** | ĐỎ (P-4) |
| P4 | thu tiền | Tổng sổ thu cộng phiếu đã huỷ | ĐỎ | — |
| P5 | thu tiền | Cho thu vượt 1 đồng không cần cờ | **xanh (mù)** | ĐỎ (P-2) |
| P6 | thu tiền | Nhật ký ghi phiếu mất trước → sau | **xanh (mù)** | ĐỎ (P-6) |
| P7 | thu tiền | Doanh số tính cả hợp đồng đã huỷ | ĐỎ | — |
| P8 | thu tiền | Tiến độ tra hợp đồng quên lọc tổ chức | ĐỎ (payments + cửa gác) | — |
| Q1 | nền tảng | Đếm nhân sự gồm cả người đã rời | **xanh 23/23 (mù)** | xanh (mù) |
| Q2 | nền tảng | Đếm dung lượng gồm cả tệp đã xoá | **xanh (mù)** | xanh (mù) |
| Q3 | nền tảng | Đầu tháng (hạn mức lịch) theo UTC | **xanh (mù)** | xanh (mù) |
| Q4 | nền tảng | Tạm khoá không ghi nhật ký | ĐỎ | — |
| Q5 | nền tảng | Tìm kiếm không thoát `%` `_` | **xanh (mù)** | xanh (mù) |
| Q6 | nền tảng | Nhật ký sửa gói mất giá trị cũ | **xanh (mù)** | xanh (mù) |
| A1 | hồ sơ | **Trang công khai vẫn hiện ảnh đã xoá** | **xanh 11/11 (mù)** | xanh (mù) |
| A2 | hồ sơ | Gỡ trang không ghi nhật ký | ĐỎ | — |
| A3 | hồ sơ | Nhật ký sửa hồ sơ mất giá trị cũ | ĐỎ | — |
| A4 | hồ sơ | Gói công khai hiện cả dịch vụ đã ngừng trong mục "gồm" | **xanh (mù)** | xanh (mù) |
| A5 | hồ sơ | Ảnh hồ sơ kiểm tệp quên lọc tổ chức | ĐỎ (profile + cửa gác) | — |
| A6 | hồ sơ | Nhân vật đã ẩn vẫn hiện trên trang | **xanh (mù)** | xanh (mù) |

**Tổng: bài thử của thợ bắt được 10/26 chốt mới.**

| Module | Bắt được | Mù với |
|---|---|---|
| Tệp | 2/6 | F1–F4 |
| Thu tiền | 4/8 | P1, P3, P5, P6 |
| Nền tảng | 1/6 | Q1, Q2, Q3, Q5, Q6 |
| Hồ sơ | 3/6 | A1, A4, A6 |

**Điểm mạnh:** cả 3 đột biến **cách ly tổ chức** (F6, P8, A5) đều bị bắt. Cửa gác 10 phép đứng vững thêm một vòng.

**Điểm đáng lo:**
1. **P1.** Chốt quan trọng nhất của thu tiền là khoá chống đua, và bài thử của thợ không giữ nó. Bài "mã PT không trùng khi gửi đồng thời" chỉ kiểm **mã**, không kiểm **tổng tiền**. Bỏ khoá thì mã vẫn không trùng (bộ đếm riêng), nhưng thu lọt 80%.
2. **Q1–Q3.** Cả ba cách đếm "đang dùng bao nhiêu" của hạn mức đều không có bài thử giữ nghĩa. Bài thử chỉ thử trường hợp đơn giản: không có người đã rời, không có tệp đã xoá, không có lịch sát mốc giao tháng.
3. **A1.** Chủ xoá ảnh vì không muốn khách thấy nữa, nhưng không bài nào giữ việc ảnh đó biến khỏi trang công khai.
4. Ngoài các đột biến trên, **S1 và M1 là hai lỗi thật mà bài thử của thợ để lọt.** Cả hai cùng một kiểu: bài thử chỉ dùng **đúng một dạng đầu vào** (sửa giá kèm `maxStaff`; gửi lại **cùng** tệp).

Bài của tôi bắt thêm 7/16 chốt mà bài của thợ mù (F1, F2, F4, P1, P3, P5, P6). 9 chốt còn lại (F3, Q1, Q2, Q3, Q5, Q6, A1, A4, A6) tôi cũng chưa có bài giữ. Các bài đó nên giao cho thợ viết.

---

## 5. Bài học môi trường (đề nghị ghi vào sổ lỗi)

**Bài thử đỏ giả vì `node_modules` dùng chung giữa các thợ.**
- **Triệu chứng:** lần chạy đầu ra 315/316. Cửa gác báo `PATCH /staff/:membershipId` → 500.
- **Gốc:** bộ Prisma đã sinh mã nằm trong kho thư viện dùng chung (`node_modules/.pnpm/@prisma+client…/node_modules/.prisma/client`). Một thợ khác chạy `prisma generate` từ sơ đồ dữ liệu mới hơn lúc 17:15:32 UTC, đúng giữa lần chạy của tôi. Bản `cd7f891` liền đọc phải cột không có.
- **Số đo:** 1/316 đỏ giả (2 vi phạm refBase). Tách bộ Prisma riêng thì 316/316.
- **Cách chặn:** mỗi worktree hoặc mỗi thợ phải có bộ Prisma riêng (chép `@prisma/client` vào `node_modules` của gói rồi `prisma generate`), hoặc cài riêng.
- **Bài học:** một con số "N/M" đo trên thư mục chung có thể đang đo mã của người khác.

---

## 6. Kết luận từng module

### Module 1: Lưu trữ tệp → **ĐẠT CÓ ĐIỀU KIỆN**
**Đứng vững:**
- Kiểm chữ ký đầu tệp: 5/5 tệp giả bị chặn.
- Giới hạn dung lượng: chặn được cả khi gửi chunked.
- Vé đọc tệp: 0/366 lần sửa vé mở được tệp.
- Vé hết hạn và tệp đã xoá bị chặn.
- Không lộ đường dẫn đĩa: 0/27.
- Cách ly tổ chức giữ được.

**Điều kiện:**
1. Sửa M1: chống gửi trùng phải tính cả nội dung tệp (sha256 của thân) và tham số `purpose`/`name`.
2. Gắn đường raw vào app.ts. Việc này đã biết; chưa gắn thì mọi ảnh của sản phẩm thật đều 404.
3. Thêm bài thử giữ: CSP sandbox, nhật ký xoá tệp, làm sạch tên tệp.

N1–N4 do chủ quyết.

### Module 2: Thu tiền → **ĐẠT CÓ ĐIỀU KIỆN**
**Đứng vững:**
- Tiền đúng từng đồng dưới mọi đòn tôi thử: số sai 12/12 bị chặn.
- Đua thu, hoàn, huỷ: 10/20, 10/20, 1/15; 0/10 vòng âm.
- Mã PT không trùng, không hở.
- Báo cáo bỏ phiếu huỷ; tháng theo giờ VN.
- Cách ly 5/5.
- Nhật ký trước → sau 4/4.

**Điều kiện:**
1. Sửa M3: trần hợp lý cho một phiếu, và tổng vượt ngưỡng không được thành lỗi 500.
2. Thêm bài thử giữ **tổng tiền** khi gửi song song (P1 hiện mù), mốc giờ VN của báo cáo (P3), mốc thu vượt 1 đồng (P5), nhật ký trước → sau của phiếu (P6).

N5–N7 do chủ quyết. Riêng N6 (ghi lùi ngày tuỳ ý) nên có luật khoá kỳ trước khi dùng thật.

### Module 3: Quản trị nền tảng + hạn mức → **KHÔNG ĐẠT**
**Lý do:**
- **S1 (nghiêm trọng):** sửa giá gói xoá mọi giới hạn và bật bán lại gói đã ngừng.
- **M2:** đường quản trị lộ với người chưa đăng nhập và trong tài liệu API công khai.
- Bài thử mù 5/6 chốt tôi phá, gồm cả ba cách đếm hạn mức.

**Đứng vững:**
- Người đã đăng nhập không phân biệt được đường quản trị: 8/8.
- Luật ân hạn đúng mốc.
- Dữ liệu thuê bao sai bị chặn 6/6.
- Tạm khoá có nhật ký đủ.
- Đua hạn mức được khoá (đối chứng Q0 đỏ).

**Để đạt:**
1. Sửa S1: PATCH chỉ đổi đúng trường được gửi. Thêm bài thử: sửa một trường thì các trường còn lại giữ nguyên.
2. Sửa M2:
   - Kiểm danh sách quản trị **trước** khi trả 401, hoặc trả 404 cho mọi yêu cầu chưa đăng nhập vào `/platform/`.
   - Bỏ đường `/platform/` khỏi OpenAPI công khai.
   - Sửa luôn phép `unauth` của cửa gác cho khớp.
3. Thêm bài thử cho cách đếm nhân sự, dung lượng, lịch theo tháng ở mốc giao tháng.

N8–N10 do chủ quyết. N8 nên có cảnh báo hoặc cấm thuê bao chồng thời gian.

### Module 4: Hồ sơ thương hiệu + trang công khai → **ĐẠT CÓ ĐIỀU KIỆN**
**Đứng vững:**
- 0/14 loại dữ liệu nội bộ lộ dạng chữ.
- Chưa xuất bản, đã gỡ, tổ chức bị khoá, slug lạ đều 404 giống hệt (4/4).
- Gắn ảnh chéo tổ chức giống hệt mã bịa (3/3).
- Quyền 4/4.
- Nhật ký đủ trước → sau.

**Điều kiện:**
1. Thêm bài thử giữ: ảnh đã xoá biến khỏi trang công khai (A1), dịch vụ đã ngừng và nhân vật đã ẩn không hiện (A4, A6).
2. Chủ quyết N11 (thuê bao hết hạn thì trang công khai còn hiện không) và N12.
3. Không lộ mã tổ chức qua vé ảnh (N3): đi chung với module 1.
