# Biên bản nghiệm thu cuối — Makeup Pro (bản `74fda02`)

- **Ngày chấm:** 18–19/10/2026 (giờ máy UTC 21:08–22:20; giờ Việt Nam đã sang ngày 19/10).
- **Người chấm:** thợ chấm độc lập (AI). Tôi không viết mã, không sửa mã sản phẩm và không lưu (commit) gì vào kho.
- **Bản được chấm:** commit `74fda02`. Tôi chấm trên một bản tách riêng (gọi là *worktree*: một bản sao của kho, để thợ khác sửa tệp cùng lúc không ảnh hưởng). Chấm xong đã gỡ bản tách.
- **Môi trường riêng:**
  - Ba database thử mới, đều bật `btree_gist`. Migration áp bằng `pnpm --filter api db:deploy-to`, lệnh tự kiểm lại và báo "khớp".
    - `makeup_test_cham_cuoi` cho bài thử máy chủ (đã xoá sau khi chấm).
    - `makeup_test_cham_cuoi_khop` cho bài khớp hai đầu (đã xoá).
    - `makeup_test_cham_cuoi_dung` cho phần thao tác thật. **Database này còn giữ** để tái hiện lỗi, xoá được bất cứ lúc nào.
  - Máy chủ API thật chạy cổng 4180, đặt cả `DATABASE_URL` và `DIRECT_URL`. Web là **bản build** chạy bằng `vite preview` ở cổng 5250. Trình duyệt là Chromium. Tôi đã tắt cả hai máy chủ theo PID (1043, 1045, 1077, 1078, 1094, 1054, 1056, 1100, 1101, 1115) và không dùng `pkill -f`.
  - Bộ đọc database (Prisma) được dựng riêng trong bản tách, không dùng chung với thư mục của thợ đang làm (theo sổ lỗi 17). Kiểm tra: tệp của bản tách có số inode khác, liên kết 1.

---

## 0. Kết luận ngắn cho anh Chiến

**Phần studio dịch vụ: anh vào thao tác thật được**, chỉ cần nhớ 2 điều ở mục 4. **Phần học viện: chưa tự làm một mình được.** Có hai lý do: học viện mới phải nhờ người vận hành cấp gói thì mới mở được khoá học, và **nút "In / Lưu PDF" hợp đồng khoá học in hỏng khi hợp đồng dài quá một trang**.

**Đã chắc chắn (đo được):**
- Mọi bài thử tự động của máy chủ đều xanh: **576/576**. Cửa gác 10 phép xanh hết. "Cửa gác" là bộ kiểm tự động, chặn không cho studio này nhìn hoặc sửa dữ liệu của studio khác.
- Web build được. Cửa gác bí mật xanh: **118/118 tệp, 0 vi phạm**. Bài khớp hai đầu: **13/13 và 6/6**.
- **Số tiền khớp ở mọi màn**: lập hợp đồng, danh sách hợp đồng, hồ sơ khách, thu tiền, sổ thu, báo cáo, bản in và cả database. Ví dụ HD-000001: 5.094.000 − giảm 100.000 = **4.994.000 ₫**. Con số này giống nhau ở 6 chỗ. Phí đi lại tính đúng công thức: 12,35 km, miễn 5 km, tính 2 chiều → 14,7 km × 10.000 = **147.000 ₫**.
- **Lỗi nặng của lần chấm trước đã được sửa:** hợp đồng xác nhận khi chưa có thợ thì ca **vẫn hiện trên Lịch** ở hàng "Chưa có thợ" (ảnh `51-lich-C-chua-co-tho-29-11-1440.png`).
- **Không màn nào tràn ngang** (trang rộng hơn màn, phải kéo ngang mới xem hết): **0/56 lần đo** ở vòng đi qua 28 màn × 2 khổ, cộng mọi ảnh chụp khác trong lúc thao tác.
- Không có chữ tiếng Anh hay chữ mất dấu trên màn.
- Thanh tổng dính đáy (dải "Tổng · Cọc · Lưu · Xác nhận" luôn nằm ở đáy màn) **không che mất nội dung**: cuộn tới cuối thì mọi ô đều lộ ra, ở cả khổ máy tính và điện thoại.
- Xuất ảnh PNG thật: 5 tệp 1080×1350, đủ dấu tiếng Việt, đổi được phông chữ ký.
- Sĩ số tối đa của từng lớp được chặn đúng: lớp K1 đủ 3/3 thì ô K1 bị khoá, không chọn được nữa.

**Phải sửa trước khi mở cho khách thật:**
1. **(Nặng) In hợp đồng khoá học dài hơn 1 trang thì trang 2 bị chồng chữ, không đọc được.** Hợp đồng ngắn thì in ra 2 trang giống hệt nhau.
2. **(Nặng) Hợp đồng dịch vụ xác nhận được khi dòng chưa có giờ.** Khi đó **không có ca nào trên Lịch**, và ô giờ bị khoá luôn, không điền lại được.
3. **(Trung bình)** Nút gợi ý "Cọc + 2 đợt / 3 đợt" đặt hạn đóng tiền **sau ngày cưới** (hoặc sau khi khoá học đã kết thúc).
4. **(Trung bình)** Học viện mới không tự mở được khoá học. Nếu hệ thống chưa nạp gói cước thì máy chủ báo lỗi 500. Nếu đã nạp gói mặc định "Dùng thử" thì gói đó không có khoá học, vẫn phải chờ người vận hành cấp gói Academy.
5. **(Trung bình)** Giới hạn của gói cước về số thành viên, số lịch mỗi tháng và dung lượng **không được áp**, chỉ khoá học và học viên bị đếm.
6. **(Trung bình)** Màn **Đăng ký / Đăng nhập / Tạo tổ chức chưa có giao diện**: chữ trần, ô nhập dính mép trái. Đây lại là màn đầu tiên khách mới nhìn thấy.

---

## 1. Bảng số đo (tử số / mẫu số, lệnh đã chạy)

Từ ngữ dùng trong bảng: **bài thử** là chương trình tự kiểm, chạy hàng trăm thao tác và so kết quả; **xanh** là qua; **đỏ** là hỏng. **Đột biến** là cố tình cài lại một lỗi đã biết vào mã, rồi xem cửa gác có bắt được không.

| # | Lệnh (chạy trong bản tách `74fda02`) | Kết quả thật |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile --offline` | Xanh (3,8 giây) |
| 2 | `apps/api: npx tsc --noEmit` | **0 lỗi** |
| 3 | `apps/api: npx vitest run` với `TEST_DATABASE_URL=…/makeup_test_cham_cuoi` (database mới) | **576/576** bài xanh, **45/45** tệp, chạy 380 giây |
| 3a | — cửa gác 10 phép (`test/gate.ts`, trong `tenant-isolation.test.ts`) | scope **99/99** · outsider **99/99** · noPerms **99/99** · unauth **109/109** · crossId **50/50** · leak **40/40** · refBase **45/45** · crossRef **107/107** · keep **99/99** · platform **40/40** |
| 3b | — cửa gác "sửa một phần" (`test/gate-partial.ts`) | partialStatic **21/21** · partialKeep **21/21** · chạy thật đủ hai bước **21/21** đường sửa |
| 3c | — đột biến (`gate-mutants.test.ts`) | **14/14** bài xanh: mỗi lỗi cài vào đều làm cửa gác đỏ đúng phép (ví dụ đột biến 12 làm 10 trường của gói cước bị đổi, cửa gác bắt được) |
| 4 | `packages/shared: npx tsc --noEmit` | **0 lỗi** |
| 5 | `packages/shared: npx vitest run` | **108/108**, 7/7 tệp |
| 6 | `apps/web: pnpm typecheck` (2 cấu hình) | **0 lỗi** |
| 7 | `apps/web: npx vitest run` với `KHOP_HOP_DONG_DATABASE_URL=…/makeup_test_cham_cuoi_khop`, `KHOP_PORT=4187` | Lần 1: **780/781** (49/50 tệp), đỏ 1 bài, xem dòng 7a. Lần 3 và lần 4: **781/781** (50/50 tệp) |
| 7a | — bài đỏ ở lần 1 | `PublicSitePage.test.tsx:199`, nguyên lời: `AssertionError: expected '' to be 'Không tìm thấy trang giới thiệu' // Object.is equality`. Chạy riêng tệp này 3 lần: 3/3 xanh. Chạy toàn bộ 3 lần hợp lệ: đỏ 1 lần. **Lỗi do bài thử, không do sản phẩm.** Bài đọc tiêu đề tab trình duyệt ngay khi chữ "Không tìm thấy…" vừa hiện, trong khi mã đổi tiêu đề chạy sau đó một nhịp. Trên trình duyệt thật tiêu đề vẫn đúng. Bài thử vẫn cần sửa, vì nó chập chờn (sổ lỗi 18). |
| 7b | — lần 2 (không tính) | Tôi chạy nhầm từ thư mục gốc kho (`--root apps/web`). Hai bài khớp đỏ vì không tìm thấy `vite/client`. Lỗi này do cách tôi chạy, không do sản phẩm. Ghi lại để minh bạch. |
| 8 | `apps/web: pnpm build` | **Xanh.** `index-*.js` 859,69 KB (nén còn 264,84 KB), có cảnh báo tệp lớn hơn 500 KB. Cửa gác bí mật: **"đã quét 118/118 tệp · 0 vi phạm"**. `vercel.json` kiểm khớp. |
| 9 | Cửa gác bí mật trong vitest (`check-bundle-secrets.test.ts`) | **44/44** |
| 10 | Bài khớp hai đầu (`khop-hop-dong.test.ts`, `khop-kieu.test.ts`) trên database riêng | **13/13** và **6/6** |
| 11 | Thao tác thật bằng trình duyệt (Playwright), 2 tổ chức, 1440 và 390 | Mục 2 và 3. 241 ảnh trong `anh/` |
| 12 | Tràn ngang | **0/56** lần đo ở vòng đi màn (`do-tran-ngang.tsv`), cộng mọi ảnh chụp khác: 0 lần tràn |
| 13 | Nút bày ra mà bấm không làm gì | Bấm thử **111** nút trên 13 màn. 27 nút "không thấy đổi" đều có lý do: nút đã được chọn sẵn, cột biểu đồ, nút tải ảnh (mở hộp chọn tệp của máy), tay kéo đổi thứ tự, nút "Hết chỗ" cố ý tắt. **0 nút chết thật.** |
| 14 | Thanh tổng dính đáy | 7 lần đo × 4 vị trí cuộn = **28 khung màn hình**. Ở vị trí cuộn cuối: **0 ô bị che (7/7)** |
| 15 | Số tiền giữa các màn | 10 hợp đồng (4 của studio, 6 của học viện): **khớp 100%** giữa màn, báo cáo và database (bảng ở mục 2.3) |

---

## 2. Thao tác thật như chủ studio

### 2.1 Đã làm gì

- **Tài khoản:** đăng ký "Nguyễn Văn Chiến" (chien.chu@studio-thu.vn) qua giao diện. Ba thợ và một giảng viên đăng ký bằng lệnh đăng ký thật của máy chủ (`POST /auth/register`), sau đó chủ thêm họ vào studio qua giao diện.
- **Tổ chức 1, "Studio Chiến Makeup"** (loại Đội / studio):
  - 3 bậc lương. 3 thợ: Trần Khánh Linh (Thợ chính), Lê Minh Tú (Thợ phụ trách), Phạm Thu Hà (Thợ mới).
  - 2 dịch vụ phụ, 2 phụ phí (**để trống thời lượng**, đúng thay đổi mới của commit này), 2 dịch vụ trong gói.
  - 3 gói, có tiền công theo bậc. Phí di chuyển tính theo km, kèm 2 bậc khoảng cách và 1 studio.
  - 3 khách. 4 hợp đồng: nhiều dòng; có thợ trùng giờ (đỏ); có thợ có lịch trong ngày (vàng); một hợp đồng không thợ; một hợp đồng không giờ.
  - Tiến độ thanh toán, 2 phiếu thu. Hồ sơ thương hiệu đã xuất bản. 2 thẻ thiết kế đã xuất PNG.
- **Tổ chức 2, "Học viện Chiến Makeup"** (loại Trung tâm đào tạo):
  - **Cấp gói cước làm đúng cách vận hành thật**, không ghi thẳng database như `grantUnlimitedPlan` của bài thử. Trình tự:
    1. `pnpm --filter @makeup/api platform:seed-plans -- --with-trial` (lệnh có sẵn) → tạo 6 gói.
    2. `pnpm --filter @makeup/api platform:grant-admin -- --email chien.chu@studio-thu.vn` → cấp quyền quản trị nền tảng.
    3. Vào màn **/quan-tri → Tổ chức → Học viện → "Đổi gói / gia hạn"**, chọn **Academy**, trạng thái "Đang dùng", thời hạn 12 tháng (ảnh `95-quan-tri-to-chuc-hv-sau-1440.png`).
  - Khoá một lớp "Makeup cá nhân cơ bản" (tối đa 2). Khoá nhiều lớp "Makeup chuyên nghiệp": K1 tối đa 3, K2 tối đa 6.
  - 5 hợp đồng khoá học: K1 ghi danh đủ 3/3, rồi một hợp đồng sang K2; 1 bản nháp có điều khoản dài 45 mục. Thêm 1 hợp đồng dịch vụ để thử bộ lọc.
  - Mẫu điều khoản và nội quy, bản in, tiến độ, phiếu thu, báo cáo lọc Dịch vụ / Khoá học. 3 thẻ (Chào mừng, Feedback, Lời chúc) đã xuất PNG.

### 2.2 Chấm ĐÚNG / ĐẠT / ĐẸP từng màn

- **ĐÚNG:** làm đúng việc đã hứa.
- **ĐẠT:** đủ các nhóm và ô như bản mẫu.
- **ĐẸP:** gọn, không vỡ, không tràn, không phá thứ khác.

| Màn | ĐÚNG | ĐẠT | ĐẸP | Ảnh chính |
|---|---|---|---|---|
| **Đăng ký / Đăng nhập / Tạo tổ chức** | ✔ Đăng ký xong chuyển thẳng sang Tạo tổ chức, tạo xong vào Lịch. Tạo được tổ chức thứ 2 qua ô đổi tổ chức | ✔ Đủ ô | ✘ **Không có giao diện**: chữ trần, ô nhỏ dính mép trái, nút kiểu mặc định của trình duyệt (L-T4) | `01-dang-ky-1440.png`, `01-dang-ky-390.png`, `02-tao-to-chuc-1440.png` |
| **Bảng giá: Gói** | ✔ Lưu gói, giá và tiền công theo bậc theo đúng thứ tự | ✔ Hộp gói đủ 5 nhóm: Thông tin & giá, Địa điểm, Đã gồm, Dịch vụ phụ cho tick, Tiền công | ✔ | `22-goi-hop-1440-tien-cong.png`, `22-goi-ds-1440.png`, `t-bang-gia-goi-390.png` |
| **Bảng giá: Dịch vụ phụ & phụ phí** | ✔ Phụ phí để trống thời lượng, danh sách không còn ghi "· 1 phút". Dịch vụ phụ lưu xong thì mở luôn ô tiền công | ✔ | ✔ | `20-phu-phi-hop-1440.png`, `20-dich-vu-phu-phi-1440.png` |
| **Bảng giá: Phí di chuyển & studio** | ✔ Đọc lại đúng 5 ô và 2 bậc | ✔ | ~ Studio đầu tiên không tự thành mặc định, chấm tròn để trống (L4) | `21-phi-di-chuyen-1440.png` |
| **Bảng giá: Nhân vật** | ✔ Có sẵn 6 nhân vật | ✔ | ✔ | `t-bang-gia-nv-1440.png` |
| **Khách hàng** | ✔ Thêm khách, xem hồ sơ, hồ sơ liệt kê hợp đồng và lịch của khách | ✔ | ✔ | `30-khach-hang-chi-tiet-1440.png`, `110-khach-nhung-hop-dong-1440.png` |
| **Thợ & bậc lương / Tiền công theo gói** | ✔ Thêm thợ bằng email (thợ phải tự đăng ký trước), gán bậc, tiền công theo bậc | ✔ | ✔ | `10-tho-bac-1440.png`, `t-tien-cong-1440.png` |
| **Lập hợp đồng dịch vụ** | ✔ Tiền đúng từng dòng. Đỏ "Trùng giờ 05:00–07:00 — hợp đồng sẽ không xác nhận được", nút Xác nhận khoá. Vàng "Tú có lịch trong ngày · 1 ca", vẫn xác nhận được. Đổi giờ thì hết đỏ, xác nhận được. ✘ Xác nhận được khi dòng chưa có giờ, và khi đó không có ca (N2) | ✔ Thẻ dòng: Giờ, Thợ phụ trách, Dịch vụ phụ, Làm ở đâu, Di chuyển, Cộng. Thẻ tổng. Thanh tổng. Ngăn kéo "Thêm từ bảng giá" trên điện thoại | ✔ Thanh tổng không che, mục 2.4. ~ Giờ kết thúc không tự điền theo thời lượng gói (L1) | `42-hd2-canh-bao-do-vang-1440.png`, `42-hd2-chon-tho-trung-gio-1440.png`, `43-hd-dong-chua-tho-390.png`, `45-hd-xn-khong-gio-1440.png` |
| **Lịch** | ✔ Mở ra luôn là chế độ C "Thợ × ngày". Đủ 3 chế độ. Thấy 5 ca ngày 22/11 đúng thợ, đúng giờ. Ca chưa có thợ nằm ở hàng "Chưa có thợ" | ✔ | ~ Chữ viết tắt trên ảnh đại diện không thống nhất: TL và KL cho cùng một người (L2). Dòng phụ "2 / ca/tuần" xuống dòng xấu, cột "Chưa có thợ" trên điện thoại bị cắt còn "Chưa có" (L3) | `50-lich-C-tuan-22-11-1440.png`, `50-lich-C-tuan-22-11-390.png`, `50-lich-1-Ngày-1440.png`, `50-lich-2-Cộtthợ-390.png`, `51-lich-C-chua-co-tho-29-11-1440.png` |
| **Thu tiền** | ✔ Tổng, cọc, đã thu, còn lại đúng. Đợt cọc báo "Đã thu đủ". ✘ Gợi ý "Cọc + 2/3 đợt" đặt hạn sau ngày cưới (T1) | ✔ | ✔ | `60-thu-tien-sau-coc-1440.png`, `60-tien-do-hop-1440.png`, `60-thu-tien-chi-tiet-390.png` |
| **Báo cáo doanh thu + Sổ thu** | ✔ Studio: doanh số 9.094.000, cọc 3.000.000, đã thu 2.800.000, còn lại 6.294.000, khớp từng hợp đồng. Học viện: lọc Tất cả / Dịch vụ / Khoá học ra đúng 16.300.000 / 600.000 / 15.700.000. Sau khi thêm 3 hợp đồng: 61.300.000 | ✔ Có "Nhóm theo Hợp đồng / Nhóm khoá / Khoá" | ✔ | `70-bao-cao-doanh-thu-studio-1440.png`, `99-bao-cao-hv-Tất-cả-1440.png`, `99-bao-cao-hv-Khoá-học-390.png`, `110-so-thu-1440.png` |
| **Thương hiệu + trang công khai /trang/studio-chien** | ✔ Lưu, xuất bản, tải logo và ảnh bìa, khung xem trước. Trang công khai có nút Gọi, Zalo, Bảng giá, Giới thiệu, Chính sách, Liên hệ | ✔ | ~ Mặc định không gói nào hiện trên trang, nên vừa xuất bản xong trang chưa có bảng giá (L5) | `80-thuong-hieu-1440.png`, `81-trang-cong-khai-1440.png`, `81-trang-cong-khai-bang-gia-390.png` |
| **Đào tạo: Khoá & lớp** | ✔ Khoá một lớp. Khoá nhiều lớp K1/K2, mỗi lớp có sĩ số riêng. K1 đủ 3/3 thì hiện "Hết chỗ" và ô K1 bị khoá. ✘ Học viện mới không tự mở khoá được (T2) | ✔ | ✔ | `90-khoa-sau-luu-1440.png`, `91-khoa-nhieu-lop-K1-K2-1440.png`, `91c-k1-het-cho-1440.png`, `90-khoa-loi-1440.png`, `t-hv-dao-tao-390.png` |
| **Ghi danh + Hợp đồng khoá học** | ✔ Nút Ghi danh mở hợp đồng chọn sẵn lớp. Thêm học viên mới ngay trong hợp đồng. Khoản khác, giảm giá, cọc, mẫu điều khoản và nội quy được chụp vào hợp đồng lúc xác nhận | ✔ | ✔ Thanh tổng không che | `92-hd-khoa-hoc-sau-luu-1440.png`, `94-hd-khoa-hoc-da-xn-1440.png`, `94-thanh-tong-hd-khoa-hoc-nhap-390-cuon3.png` |
| **Bản in hợp đồng khoá học** | ✔ Xem trên màn: đủ khoá, lớp, lịch học, tiền, tiến độ, điều khoản, nội quy, chỗ ký. ✘ In / Lưu PDF hỏng (N1) | ✔ | ✘ Khi in | `94-ban-in-hd-khoa-hoc-1440.png`, `94-ban-in-390.png`, `96-ban-in-dai-2.png` |
| **Mẫu thiết kế** | ✔ Feedback và Lời chúc cho cả hợp đồng dịch vụ lẫn khoá học. Thẻ Chào mừng chỉ có ở học viện. Xuất PNG thật, mở ra xem được. Đổi được "Chữ ký 1–4". Thiếu ảnh mà bấm Tải thì báo rõ "Mẫu này cần đúng 3 ảnh (đang có 1)" | ✔ | ~ Học viện chưa có logo thì ô logo in ra thành khoảng trống hoặc vòng tròn trống. Có báo trước "Ô trống trên ảnh: Logo" (L6) | `101-xuat-feedback-dich-vu-fb04.png`, `103-xuat-loi-chuc-dich-vu.png`, `104-chao-mung-khoa-hoc-xuat.png`, `105-feedback-khoa-hoc-xuat.png`, `106-loi-chuc-khoa-hoc-xuat.png`, `102-feedback-thieu-anh-bam-tai-1440.png` |
| **Quản trị nền tảng /quan-tri** | ✔ Trang chủ, Tổ chức, Gói cước. Đổi gói và gia hạn có lịch sử. ✘ Giới hạn gói không được áp (T3) | ✔ | ✔ | `95-quan-tri-to-chuc-hv-sau-1440.png`, `95-quan-tri-quan-tri-390.png` |

### 2.3 Số tiền giữa các màn

Database được đọc trực tiếp bằng câu hỏi chỉ đọc trên `makeup_test_cham_cuoi_dung`.

| Hợp đồng | Màn lập HĐ | Danh sách HĐ | Thu tiền | Báo cáo | Bản in | Database (tổng / cọc / đã thu) |
|---|---|---|---|---|---|---|
| Studio HD-000001 | 4.994.000 · cọc 1.500.000 | 4.994.000 | 4.994.000 · đã thu 1.500.000 · còn 3.494.000 | 4.994.000 / 1.500.000 / 1.500.000 | — (hợp đồng dịch vụ không có bản in) | 4.994.000 / 1.500.000 / 1.500.000 |
| Studio HD-000002 | 3.300.000 · cọc 1.300.000 | 3.300.000 | 3.300.000 · đã thu 1.300.000 | 3.300.000 / 1.300.000 / 1.300.000 | — | 3.300.000 / 1.300.000 / 1.300.000 |
| Studio HD-000003, HD-000004 | 400.000 · cọc 100.000 | 400.000 | 400.000 | 400.000 / 100.000 / 0 | — | khớp |
| Học viện HĐKH-000001 | 15.700.000 · cọc 5.000.000 | — | 15.700.000 · đã thu 5.000.000 | 15.700.000 / 5.000.000 / 5.000.000 | 15.700.000 · cọc 5.000.000 | 15.700.000 / 5.000.000 / 5.000.000 |
| Học viện HD-000001 (dịch vụ) | 600.000 · cọc 200.000 | — | đã thu 600.000 · còn 0 | 600.000 / 200.000 / 600.000 | — | khớp |

Thêm một ghi nhận: hợp đồng dịch vụ **không có bản in**. Chỉ hợp đồng khoá học có nút "Xem bản in".

### 2.4 Thanh tổng dính đáy (kiểm riêng)

Tôi đo ở 4 vị trí cuộn cho mỗi hợp đồng, mỗi vị trí chụp một khung màn hình. Tên ảnh có dạng `…-cuon0` đến `…-cuon3`.

| Hợp đồng | Khổ | Lúc đang cuộn | Cuộn tới cuối |
|---|---|---|---|
| Dịch vụ, đã xác nhận (HD-000002) | 1440 | Thanh đặc, nội dung trôi phía sau, không lộ chữ qua thanh | 0 ô bị che. Thanh nhích lên, chừa 40px ở đáy |
| Dịch vụ, nháp 3 dòng | 1440 | Có dải vàng "3 dòng chưa có giờ…" nằm ngay trên thanh, như thiết kế | 0 ô bị che |
| Dịch vụ, đã xác nhận | 390 | Thanh nằm cố định trên thanh điều hướng dưới | 0 ô bị che (trang có chừa khoảng trống ở đáy) |
| Dịch vụ, nháp 3 dòng | 390 | như trên | 0 ô bị che (`44-thanh-tong-hd-nhap-390-cuon3.png`) |
| Khoá học, nháp | 1440 | như trên | 0 ô bị che |
| Khoá học, nháp (điều khoản dài) | 390 | như trên | 0 ô bị che (`94-thanh-tong-hd-khoa-hoc-nhap-390-cuon3.png`) |
| Khoá học, đã xác nhận | 390 | như trên | 0 ô bị che |

**Kết luận: thanh tổng không đè lên nội dung.** Mọi ô đều cuộn ra được phía trên thanh.

---

## 3. Danh sách lỗi (xếp theo mức nặng)

### NẶNG

**N1. "In / Lưu PDF" hợp đồng khoá học: hợp đồng dài hơn một trang thì trang 2 chồng chữ, hợp đồng ngắn thì in ra 2 bản giống nhau**
- **Triệu chứng:**
  - Hợp đồng HĐKH-000002 có 45 điều khoản. In ra PDF được 2 trang. Trang 2 in đè phần còn lại của hợp đồng (điều 43–45, nội quy, chỗ ký) **lên chính một bản sao của trang 1**, chữ chồng chữ, không đọc được.
  - Hợp đồng ngắn HĐKH-000001 (vừa 1 trang) thì in ra **2 trang giống hệt nhau**.
  - Xem trên màn thì vẫn đẹp. Chỉ khi in hoặc lưu PDF mới hỏng.
- **Tái hiện:** Đào tạo → hợp đồng khoá học có mẫu điều khoản dài → "Xem bản in" → "In / Lưu PDF". Tôi dùng chế độ in của Chrome (`page.pdf`), y như khi bấm in.
- **Ảnh:** `96-ban-in-dai-1.png`, `96-ban-in-dai-2.png` (trang 2 chồng chữ); `94-ban-in-pdf-1.png`, `94-ban-in-pdf-2.png` (2 trang giống nhau); tệp `96-ban-in-dai.pdf`.
- **Gốc:** `apps/web/src/features/contracts/contracts.css:244-248`. Khi in, mọi thứ bị ẩn trừ tờ giấy `.ct-paper` (đặt `position: absolute`). Nhưng tờ giấy nằm trong lớp phủ của hộp thoại `.ui-overlay` (`apps/web/src/ui/ui.css:510-512`, `position: fixed`). Chrome lặp phần "cố định" này ở mọi trang, và không cho nó chảy sang trang sau. Trang phía dưới vẫn chiếm 2 trang giấy (chỉ bị làm vô hình).
- **Vì sao nặng:** hợp đồng đào tạo là giấy tờ để ký. Học viện nào có điều khoản dài (rất thường gặp) sẽ không in được.

**N2. Hợp đồng dịch vụ xác nhận được khi dòng chưa có giờ; sau đó không có ca trên Lịch và không điền giờ lại được**
- **Triệu chứng:**
  - HD-000004 (Hoàng Minh Thư, 06/12/2026, 1 dòng Phù dâu): không nhập giờ, không chọn thợ, nút "Xác nhận hợp đồng" vẫn bấm được. Kết quả: "Đã xác nhận hợp đồng. **Không có lịch nào được tạo** (chưa dòng nào có giờ)".
  - Lịch tuần 06/12: **0 ca**, không có ở hàng "Chưa có thợ".
  - Trong hợp đồng, ô giờ chuyển xám và bị khoá (dòng đã chốt). Không có cách nào thêm giờ cho dòng này. Chỉ còn cách huỷ dòng rồi thêm phát sinh.
  - Trước khi bấm có dải vàng "1 dòng chưa có giờ — chưa lên lịch được", nhưng chỉ để nhắc, không chặn.
- **Tái hiện:** Lập hợp đồng → chọn khách, ngày → thêm 1 gói → bấm ngay "Xác nhận hợp đồng".
- **Ảnh:** `45-hd-xn-khong-gio-1440.png`. Dải nhắc vàng: `44-thanh-tong-hd-nhap-1440-cuon1.png`.
- **Gốc:**
  - Máy chủ: `apps/api/src/modules/contracts/routes.ts:211-218`. Hàm sinh ca chỉ lấy dòng có giờ hoặc có thợ. Dòng không có cả hai bị bỏ qua, không báo lỗi.
  - Web: `ContractEditor.tsx:919` ("nhắc, KHÔNG chặn xác nhận"), `model.ts:499, 506`.
- **Vì sao nặng:** cùng hậu quả với lỗi S1 của biên bản Web 2: khách đã chốt, có thể đã cọc, mà lịch trống. Điều này trái với quyết định 22:10 trong nhật ký quyết định: "hợp đồng đã chốt không được vắng mặt trên lịch". Lối thoát "không thợ" đã được bịt, còn lối "không giờ" vẫn mở.
- **Hướng sửa (anh chọn):** hoặc bắt buộc mọi dòng có giờ trước khi xác nhận; hoặc vẫn cho xác nhận nhưng mở khoá ô giờ của dòng đã chốt mà chưa có ca.

### TRUNG BÌNH

**T1. Gợi ý "Cọc + 2 đợt / 3 đợt" đặt hạn đóng tiền sau ngày cưới, sau khi khoá học kết thúc**
- **Triệu chứng:**
  - HD-000001: cưới ngày 22/11/2026. Bấm "Cọc + 2 đợt" ra Đợt 1 hạn 18/11 và **Đợt 2 hạn 18/12/2026, gần 1 tháng sau đám cưới**.
  - HĐKH-000001: lớp K1 kết thúc 30/11. Đợt 2 vẫn hạn 18/12.
  - Không có cảnh báo nào. Hạn này còn được in vào bản in hợp đồng khoá học.
- **Tái hiện:** Thu tiền → chọn hợp đồng → "Lập tiến độ" → "Cọc + 2 đợt".
- **Ảnh:** `60-tien-do-hop-1440.png`, `98-hv-tien-do-khoa-hoc-1440.png`, `94-ban-in-390.png`.
- **Gốc:** `apps/web/src/features/payments/InstallmentsDialog.tsx:30` (`SUGGEST_INTERVAL_DAYS = 30`) và `:158-163`. Các đợt cách nhau cố định 30 ngày, không xét ngày sự kiện hay ngày kết thúc lớp. Nút "Cọc + còn lại vào ngày sự kiện" thì đúng.

**T2. Học viện mới không tự mở được khoá học**
- **Triệu chứng:**
  - Database mới, chưa nạp gói cước: tạo học viện, bấm Lưu khoá học → máy chủ trả **lỗi 500**. Màn hiện "Hệ thống chưa cấu hình gói dịch vụ cho tổ chức này. Vui lòng liên hệ bộ phận hỗ trợ."
  - Nạp gói theo DEPLOYMENT.md (`--with-trial`): gói "Dùng thử" có 0 khoá học và 0 học viên, nên học viện vẫn không mở được khoá.
  - Phải có người vận hành vào /quan-tri cấp gói Academy thì mới chạy.
- **Tái hiện:** đăng ký → Tạo tổ chức "Trung tâm đào tạo" → Đào tạo → Thêm khoá → Lưu.
- **Ảnh:** `90-khoa-loi-1440.png`.
- **Gốc:** `apps/api/src/lib/quota.ts:135-147`; gói `trial` trong `apps/api/src/scripts/seed-plans.ts` có `maxCourses: 0`.
- **Ý nghĩa với anh:** học viên của anh tự đăng ký làm học viện riêng sẽ bị kẹt ở bước đầu tiên, cho tới khi anh hoặc người vận hành cấp gói. Lời báo cũng không nói rõ "gói của bạn chưa có khoá học, liên hệ để nâng gói". Ngoài ra lỗi cấu hình không nên trả mã 500.

**T3. Giới hạn của gói cước (số thành viên, lịch mỗi tháng, dung lượng) không được áp**
- **Triệu chứng:**
  - Studio Chiến chưa có thuê bao, nên theo luật phải áp gói "Dùng thử" (tối đa **1 thành viên**, 60 lịch mỗi tháng).
  - Sau khi đã nạp gói "Dùng thử", tôi vẫn thêm được **thành viên thứ 5** (Đỗ Mai Anh), không bị chặn.
  - Màn quản trị lại hiện "Thành viên 2 / 10" như thể có giới hạn.
- **Tái hiện:** studio chưa có thuê bao → Thợ makeup → Thêm thợ.
- **Ảnh:** `112-studio-them-tho-sau-goi-dung-thu-1440.png`, `95-quan-tri-to-chuc-hv-sau-1440.png`.
- **Gốc:** hàm kiểm giới hạn `assertQuota` (`apps/api/src/lib/quota.ts:246`) biết đếm cả thành viên, lịch và dung lượng, nhưng chỉ được gọi ở `courses/service.ts:420` (khoá học) và `contracts/enroll.ts:146` (học viên). Đường thêm thành viên `orgs/routes.ts:211` không gọi.
- **Ý nghĩa:** không chặn anh dùng studio. Nhưng nếu anh bán gói theo số thợ thì hiện tại không thu tiền theo gói được.

**T4. Màn Đăng ký / Đăng nhập / Tạo tổ chức chưa có giao diện**
- **Triệu chứng:**
  - Chữ đen trên nền xám, ô nhập nhỏ dính mép trái, nút kiểu mặc định của trình duyệt.
  - Trên điện thoại cũng vậy, không căn giữa, không có logo.
  - Mọi màn bên trong thì đã đẹp, nên sự tương phản này rất lộ.
- **Ảnh:** `01-dang-nhap-1440.png`, `01-dang-ky-1440.png`, `01-dang-ky-390.png`, `02-tao-to-chuc-1440.png`.
- **Gốc:** `apps/web/src/features/auth/LoginPage.tsx`, `RegisterPage.tsx`, `CreateOrgPage.tsx:83-` chỉ dùng thẻ HTML trần, không gắn lớp giao diện nào.

### NHẸ

- **L1. Giờ kết thúc không tự điền.** Gói 120 phút, gõ 05:00 rồi bấm Tab thì ô kết thúc vẫn trống. Dòng nào cũng phải gõ tay giờ kết thúc. Mã: `PackageLineCard.tsx:136-152`.
- **L2. Chữ viết tắt trên ảnh đại diện thợ không thống nhất ngay trên cùng màn Lịch "Ngày".** Đầu hàng ghi "TL" (Trần Khánh Linh), trong thẻ ca ghi "KL". Tương tự "LT"/"MT" và "PH"/"TH". Lý do: web tự lấy 2 tiếng cuối của tên (`apps/web/src/ui/Avatar.tsx:14-23`), máy chủ lấy tiếng đầu và tiếng cuối; thẻ ca không dùng chữ của máy chủ (`schedule/parts.tsx:123-126`). Ảnh: `50-lich-1-Ngày-1440.png`.
- **L3. Lịch C xuống dòng xấu.** Ở 1440, dòng phụ dưới tên thợ "Thợ chính · 2 / ca/tuần" xuống dòng giữa cụm "2 ca/tuần". Ở 390, đầu cột "Chưa có thợ" chỉ còn "Chưa có". Ảnh: `50-lich-C-tuan-22-11-1440.png`, `50-lich-C-tuan-22-11-390.png`.
- **L4. Studio đầu tiên không tự thành mặc định.** Phải bấm chấm tròn thì mới thành mặc định. Ảnh: `21-phi-di-chuyen-1440.png`.
- **L5. Gói mặc định tắt hiện trên trang công khai.** Vừa xuất bản xong, trang chưa có mục Bảng giá, phải bật từng gói. Có thể là chủ ý; anh quyết. Ảnh: `81-trang-cong-khai-1440.png`, so với `81-trang-cong-khai-bang-gia-390.png`.
- **L6. Thẻ thiết kế khi chưa có logo:** in ra ô vuông trống, vòng tròn kem trống, hoặc tiêu đề bị đẩy lệch. Màn có báo trước "Ô trống trên ảnh: Logo". Ảnh: `105-feedback-khoa-hoc-xuat.png`, `106-loi-chuc-khoa-hoc-xuat.png`.
- **L7. Phù dâu 2 người, Lịch chỉ ghi "Phù dâu — Phù dâu 06:00–06:45".** Không có "× 2", nên thợ không biết phải làm 2 người. Ảnh: `50-lich-1-Ngày-1440.png`.
- **L8. Bản web là một tệp 860 KB** (có cảnh báo lúc build), tải lần đầu sẽ chậm trên 4G.
- **L9. Chữ bị cắt hoặc xuống dòng ở 390.** Gợi ý trong ô tìm khách bị cắt thành "Tìm theo tên h…" (`43-hd-moi-390.png`). Liên kết "Mở hợp / đồng" bị bẻ dòng ở Thu tiền (`60-thu-tien-chi-tiet-390.png`).
- **L10. Bài thử chập chờn** `PublicSitePage.test.tsx:199`: 1 lần đỏ trong 3 lần chạy toàn bộ (mục 1, dòng 7a). Sản phẩm không lỗi, nhưng theo sổ lỗi 18 không nên để bài thử "lúc được lúc không".

### Đã hết so với biên bản Web 2 (tôi đã kiểm lại)

- **S1 (xác nhận khi chưa có thợ thì mất lịch):** đã sửa. Ca hiện ở hàng "Chưa có thợ"; trước khi xác nhận có dải vàng nhắc (`43-hd-dong-chua-tho-390.png`, `51-lich-C-chua-co-tho-29-11-1440.png`).
- **S2 (bản lưu không build được):** bản lưu này build được và kiểm kiểu xanh.
- **N5 (phụ phí ghi "· 1 phút"):** đã hết.
- **T7 cũ (màu ca đoán theo chữ):** màu ca giờ theo nhân vật (Cô dâu, Mẹ cô dâu, Phù dâu), có chú thích màu ở chân lịch.

Các lỗi T1–T6 và T8 của biên bản Web 2: **chưa chấm lại được**, vì lần này tôi tập trung vào luồng chủ studio và phần đào tạo.

---

## 4. Anh Chiến có vào thao tác thật được chưa — còn chặn gì

**Studio dịch vụ makeup: ĐƯỢC.** Bảng giá, khách, thợ, tiền công, hợp đồng nhiều dòng, cảnh báo trùng giờ, lịch, thu cọc, báo cáo, trang giới thiệu và thẻ thiết kế đều chạy đúng; tiền khớp ở mọi màn. Trong lúc chờ sửa, anh nhớ 2 điều:
1. **Luôn nhập giờ cho mọi dòng trước khi bấm "Xác nhận hợp đồng"** (N2). Thấy dải vàng "… chưa có giờ" thì đừng xác nhận.
2. **Đừng dùng nút "Cọc + 2 đợt / 3 đợt" cho hợp đồng cưới** (T1). Dùng "Cọc + còn lại vào ngày sự kiện", hoặc sửa tay hạn từng đợt.

**Học viện (đào tạo): CHƯA tự vận hành một mình được.** Còn chặn:
1. **In hợp đồng khoá học** (N1). Hợp đồng dài hơn 1 trang thì không in được. Hợp đồng ngắn vẫn in được, nhưng phải chọn in riêng trang 1.
2. **Mở khoá học cho học viện mới** (T2). Người vận hành phải cấp gói Academy ở /quan-tri trước. Trong buổi chấm tôi đã làm bằng hai lệnh có sẵn (`platform:seed-plans`, `platform:grant-admin`) cộng màn "Đổi gói / gia hạn". Hai lệnh này hiện chỉ chạy được bằng `tsx` trên máy có cài thư viện phát triển (DEPLOYMENT.md:82). Trên máy chủ thật tôi **chưa chấm được**.

**Trước khi mời khách khác dùng thử:** sửa N1, N2, T2. Làm giao diện cho màn đăng nhập và đăng ký (T4). Quyết định có áp giới hạn gói cước hay không (T3).

---

## 5. Chưa chấm được

- **Quyền theo vai trò** (thợ, lễ tân, kế toán, giảng viên đăng nhập vào xem gì): **chưa chấm được**, vì lần này chỉ thao tác bằng tài khoản chủ.
- **Điện thoại thật / Safari trên iPhone:** **chưa chấm được**. Tôi chỉ dùng Chromium giả lập khổ 390.
- **Chạy trên máy thật (Vercel, Railway, kho ảnh S3):** **chưa chấm được**. Ảnh lưu ở đĩa máy thử.
- **Hai thẻ trình duyệt cùng sửa, mất mạng, bấm đúp:** không làm lại lần này.
- **Các lỗi T1–T6 và T8 của biên bản Web 2:** chưa kiểm lại từng cái.
- **Bản in khi bấm nút "In" của trình duyệt trên máy thật:** tôi dùng lệnh in của Chrome không giao diện (`page.pdf`, chế độ "print"), cho kết quả tương đương nhưng không phải bấm tay.

---

## 6. Phụ lục

- **Ảnh:** 61 ảnh được nêu trong biên bản đã chép vào `docs/nghiem-thu/bai-thu-cuoi/`; đủ 241 ảnh còn ở thư mục nháp của phiên chấm (không đưa lên kho vì 30 MB).
  - Ảnh `t-*` là vòng đi màn: 28 màn × 1440 và 390.
  - Ảnh `x-*` là ảnh dò đường lúc thao tác.
  - Ảnh số `01`–`112` theo thứ tự luồng ở mục 2.
  - Các tệp `*-xuat.png` là ảnh PNG do sản phẩm xuất ra thật.
- **Bài thao tác (Playwright):** `/tmp/claude-0/-home-user/98e5e0bd-eea6-5414-8a17-284075c2db75/scratchpad/cham-cuoi/pw/`. Gồm `a1`–`a6` (dựng dữ liệu), `b1`–`b4` (hợp đồng dịch vụ), `c1`–`c2` (thanh tổng, không giờ), `d1` (lịch), `e1` (thu tiền), `f1`–`f4` (thương hiệu), `g1`–`g12` (đào tạo, bản in, sĩ số), `h1`–`h3` (quản trị), `k1`–`k6` (thẻ thiết kế), `t1`–`t5` (đi màn, nút chết, khớp tiền). Liên kết `pw/node_modules` trỏ vào bản tách đã gỡ, nên muốn chạy lại phải dựng lại bản tách.
- **Nhật ký lệnh:** `log-api-tsc.txt`, `log-api-vitest.txt`, `log-web-vitest.txt` (lần 1), `log-web-vitest-3.txt`, `log-web-vitest-4.txt`, `log-web-build.txt`, `do-tran-ngang.tsv`. Tất cả cùng thư mục `cham-cuoi/`.
- **Database còn giữ:** `makeup_test_cham_cuoi_dung` (dữ liệu của mục 2), xoá bằng `su postgres -c "dropdb makeup_test_cham_cuoi_dung"`.
