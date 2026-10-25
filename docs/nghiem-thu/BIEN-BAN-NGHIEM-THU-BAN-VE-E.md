# Biên bản nghiệm thu bản vẽ E: Cổng học viên + web cài lên màn hình chính (bản `70543b7`)

- **Ngày chấm:** 25/10/2026 (giờ máy khoảng 13:35–18:40 UTC).
  - Giữa chừng phiên bị dừng vì giới hạn phiên. Bản tách, nhật ký và database còn nguyên.
  - Máy chủ và preview bị mất khi dừng. Tôi bật lại với PID mới (mục 6) rồi làm tiếp.
- **Người chấm:** thợ chấm độc lập N1 (AI, Opus), không phải người làm. Tôi chỉ đo, phá thử trên bản sao và chụp ảnh.
  - Tôi **không** sửa mã sản phẩm.
  - Tôi **không** chạy lệnh git ghi, chỉ `git worktree add/remove`.
  - Tôi **không** đụng `makeup_dev`, **không** chạy `migrate reset`, **không** tắt tiến trình theo tên.
- **Bản được chấm:** commit `70543b7` ("E5 xong"), trong bản tách `scratchpad/cham-e/wt`.
  - Commit này còn phần **dở** của bản vẽ F (giấy chứng nhận, gói W2). Bài đỏ thuộc phần đó ghi riêng ở mục 1.2 và **không** tính cho E.
  - Migration cổng có tên đúng `20261019200000_cong_hoc_vien` (ký duyệt E dòng 19, nhật ký quyết định dòng 100), kèm `20261019215000_the_hien_tren_cong` (cột ẩn/hiện thẻ, nhật ký dòng 101).
- **Database thử.** Database nào cũng bật `btree_gist` và áp migration bằng `pnpm --filter api db:deploy-to`. Lần nào cũng báo "kiểm lại: khớp".
  - `makeup_test_cham_e`: bài thử máy chủ, cửa gác, đột biến. **Đã xoá.**
  - `makeup_test_cham_e_khop`: bài "khớp hai đầu" của web. **Đã xoá.**
  - `makeup_test_cham_e_w2`: e2e cổng. **Đã xoá.**
  - `makeup_test_cham_e_dung`: app thật, phá thử mức HTTP. **Còn giữ** để tái hiện (mục 5).
- **Biến môi trường:** mọi lệnh chạy bài thử hay máy chủ đều đặt rõ `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL` (hoặc `E2E_DATABASE_URL`, `KHOP_HOP_DONG_DATABASE_URL`) trỏ vào database thử. Bản tách không có tệp `.env`.
- **Ảnh:**
  - 54 ảnh ở `docs/nghiem-thu/bai-thu-ban-ve-e/`. Tên bắt đầu `tt-` là màn trung tâm, `hv-` là màn học viên (tôi tự chụp), `e2e-` là ảnh do bài e2e chụp.
  - Ảnh nào cũng là **ảnh khung nhìn** (`fullPage: false`, sổ lỗi 27). Tôi đã mở xem từng ảnh.
  - Chìa hiện trong ảnh `tt-chia-vua-tao-*` đều **đã chết**: đường dẫn đã bị thay rồi bị thu hồi, và chỉ trỏ `localhost`.
- **Nhật ký và mã đo:** `scratchpad/cham-e/log/`, `scratchpad/cham-e/pw/` (`seed.mjs`, `pha.mjs` + `pha-main.mjs`, `ui.mjs`, `do-tran.mjs`), `scratchpad/cham-e/mutate.sh`, `scratchpad/cham-e/e2e.config.ts`.

---

## 0. Kết luận ngắn cho anh Chiến

**ĐẠT có điều kiện.**
- **An toàn:** tôi thử **18 cách phá** ngoài các bài thử có sẵn, **không cách nào thành công**:
  - không xem được dữ liệu học viên khác;
  - không dùng phiên học viên vào được màn quản trị;
  - không dò được đường dẫn có thật qua lời báo hay thời gian trả lời;
  - không lộ chìa, thẻ hay 4 số trong database, nhật ký hoặc log.
- **Tiền** trên cổng khớp database từng đồng.
- **Luồng thật chạy trọn:** tạo đường dẫn → sai rồi đúng 4 số → xem trang → chuyển sang app bằng mã → chặn máy → thu hồi → học viên bị đẩy ra.
- **Điều kiện:** vá **T1**. Đây là lỗi giao diện, sửa vài dòng CSS.
  - Ở khổ 390, dòng "Nội dung chuyển khoản" bị **cắt mất chữ** khi tên học viên dài. Ví dụ "HDKH-000001 Ton Nu Phuong T…".
  - Nút "Chép" vẫn chép đủ, nhưng học viên nhìn màn sẽ thấy thiếu.
  - Không bài thử nào bắt được lỗi này.
- **T2** là rủi ro khi đưa lên mạng (đã có trong việc tồn 18), phải đo khi có máy thật.

| Mục (bản vẽ) | ĐÚNG | ĐẠT | ĐẸP |
|---|---|---|---|
| 2. Mô hình bảo mật: tường chắn hai chiều, một lời chung, sàn 300 ms, chỉ lưu bản băm | Có | Có (18 cách phá, 0 lọt) | — |
| 3. Dữ liệu: 4 bảng, CHECK, trigger, đua máy thứ 3 | Có | Có (đua 5 yêu cầu → đúng 2 thành công) | — |
| 4.2 Đường học viên (mở, nhận mã, mã chuyển, thoát, `/me`) | Có | Có | — |
| 4.3–4.4 Đường trung tâm + cài đặt cổng | Có | Có | — |
| 5.1 Cổng `/hv` (390 chính, 1440 cột neo) | Có | Có | **Chưa** (T1, L4) |
| 5.2 Thẻ "Cổng học viên", Cài đặt → Cổng học viên | Có | Có | Có (L1, L2, L3) |
| 5.3 PWA: manifest, service worker không đệm `/api`, bundle riêng | Có | Có | — |

**Bài thử tự động** (số tôi tự đo):
- Bài thử máy chủ của E: **115/115**.
- Cửa gác 14 phép: **1420/1420**, đúng mốc ký duyệt.
- Đột biến 18–22 của thợ: **5/5 đỏ**.
- E2E cổng: **5/5**.
- Bài web của E: **125/125**.
- Ngân sách cổng: JS **76,0/90 KB**, CSS **8,1/15 KB** gzip.

**Đột biến tôi tự cài: 16, bài thử bắt được 16/16.**

**Đo trên app thật:**
- Tràn ngang cả trang: **0/39** lần đo.
- Lỗi JavaScript: **0**.
- Nút chết: **0/19** nút.

---

## 1. Bảng số đo

### 1.1 Bài thử tự động

| # | Lệnh (trong bản tách `70543b7`) | Kết quả |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | Xanh, 3,7 giây. `prisma generate` chạy từ schema của bản tách (bộ đọc database riêng, sổ lỗi 17) |
| 2 | Typecheck `apps/api` | **0 lỗi** (11 giây) |
| 3 | Typecheck `packages/shared` | **0 lỗi** |
| 4 | Typecheck `apps/web` | `tsconfig.json`: **0 lỗi**. `tsconfig.node.json`: **4 lỗi**, cả 4 ở `src/features/certificates/` (F, mục 1.2). **0 lỗi ở phần E** |
| 5 | `apps/api`: `vitest run` trên `makeup_test_cham_e` | **995/996**. 73 tệp: 72 xanh. 825 giây. Bài đỏ duy nhất là `hom-nay.test.ts` "không N+1" (bản vẽ D), **không phải E**, xem 1.2 |
| 5a | 5 tệp bài thử của E | `database` **28/28** · `khung` **41/41** · `trung-tam` **15/15** · `vao` **22/22** · `du-lieu` **9/9**. Cộng **115/115** |
| 6 | Cửa gác (`tenant-isolation.test.ts` **18/18**) | scope **122/122** · outsider **122/122** · noPerms **122/122** · unauth **135/135** · crossId **62/62** · leak **49/49** · refBase **57/57** · crossRef **155/155** · keep **122/122** · platform **40/40** · **portalScope 5/5 · portalWall 411/411 · portalLeak 3/3 · portalProbe 15/15**. Cộng **1420/1420** = mốc ký duyệt (nhật ký quyết định dòng 107) |
| 6a | Cửa gác sửa một phần (`sua-mot-phan.test.ts` 4/4) | partialStatic **23/23** · partialKeep **23/23** · chạy thật đủ hai bước **23/23** |
| 6b | Đột biến trong kho (`gate-mutants.test.ts` **27/27**) | Cả 22 đột biến đỏ. Riêng E: **18** portalScope 1/5 · **19** portalLeak 1/3 (A1 thấy "Lớp riêng A2") · **20** portalWall 1/41 + portalScope 1/6 · **21** portalProbe 7/15 · **22** portalLeak 3/3. Vế GIỮ "11 đường cổng chưa cài lỗi: 14 phép xanh trọn": xanh |
| 7 | `apps/web`: `vitest run` (`KHOP_HOP_DONG_DATABASE_URL=…_khop`) | **1442/1472** qua · 20 đỏ · 10 bỏ qua. 94 tệp: 92 xanh. 260 giây. **Mọi bài đỏ thuộc F** (1.2) |
| 7a | 10 tệp web của E | `PortalCard` 31/31 · `PortalApp` 20/20 · `PortalPage` 19/19 · `PortalSettingsPage` 9/9 · `PortalSettingsReadOnly` 1/1 · `InstallGuide` 6/6 · `sw` 25/25 · `registerSW` 5/5 · `platform` 4/4 · `time` 5/5. Cộng **125/125** |
| 7b | Bài web liên quan | `scripts/check-portal-bundle.test.ts` **15/15** (có vế GIỮ bản build thật) · `khop-hop-dong` 16/16 · `khop-kieu` 8/8 |
| 8 | `apps/web`: `pnpm build` | **Xanh** (vite 3,4 giây). Cửa gác bí mật: "đã quét **298/298** tệp · 0 vi phạm". **check-portal-bundle: `hv.html` kéo 5 tệp JS (76,0 KB gzip / 90,0 KB) và 3 tệp CSS (8,1 KB gzip / 15,0 KB) · 0 vi phạm**. `vercel-config --check`: xanh |
| 9 | E2E `apps/web/e2e/cong-hoc-vien.spec.ts`, máy chủ thật trên `makeup_test_cham_e_w2` | **5/5** (42 giây): luồng 390 · luồng 1440 · mã chuyển sang app · chìa bịa một lời chung · `/hv` không chìa không tràn ở 390. Có 18 ảnh |

**Cách chạy e2e (việc tồn 75).**
- Lý do: `playwright.config.ts` của kho cố định cổng 4000/5173 và **không** đặt `PORTAL_RATE_LIMIT_PER_MINUTE`.
- Tôi dùng **cấu hình tạm ngoài kho**: `scratchpad/cham-e/e2e-run/playwright.config.ts`, chép từ `scratchpad/cham-e/e2e.config.ts`.
  - `testDir` và `cwd` trỏ tuyệt đối vào bản tách.
  - Máy chủ e2e đặt `PORTAL_RATE_LIMIT_PER_MINUTE=1000` và `AUTH_RATE_LIMIT_PER_MINUTE=1000`.
  - Database: `makeup_test_cham_e_w2`.
  - Thư mục chạy có `node_modules` là liên kết sang `wt/apps/web/node_modules`.
- Lệnh: `E2E_DATABASE_URL=… PORTAL_RATE_LIMIT_PER_MINUTE=1000 E2E_ANH_DIR=… playwright test cong-hoc-vien.spec.ts`.
- Kho không bị sửa.

Nhật ký: `log/tsc-*.txt`, `log/api-vitest.txt`, `log/web-vitest.txt`, `log/web-build.txt`, `log/e2e.txt`.

### 1.2 Bài đỏ không thuộc E

| Bài đỏ | Của gói | Vì sao |
|---|---|---|
| Typecheck web, 4 lỗi: `features/certificates/PrintSheet.pdf.test.ts:145,146`, `features/certificates/frame.test.ts:39` (×2) | **F** (W2 giấy chứng nhận, dở) | Lỗi kiểu trong tệp bài thử của F. Hệ quả: `pnpm -r typecheck` của commit này **đỏ**. Commit này chưa đạt luật "bản chấm phải qua typecheck" (sổ lỗi 19), nhưng phần đỏ không thuộc E |
| `features/certificates/PrintSheet.pdf.test.ts` (20 bài) | **F** | Hàm `window.gcn.lam` của trang in thử không chạy (`PrintSheet.pdf.test.ts:94`) |
| `src/api/khop-chung-nhan.test.ts` (tệp đỏ, 10 bỏ qua) | **F** | Đòi biến database riêng của bài khớp giấy chứng nhận (`khop-chung-nhan.test.ts:41`). Tôi không đặt biến này vì không chấm F |
| `apps/api/test/hom-nay.test.ts` › "5 hợp đồng và 50 hợp đồng → cùng số câu" | **D** | Khi chạy cả bộ song song: 23 câu ≠ 24 câu. Chạy riêng tệp 2 lần: **30/30** cả hai, "5 hợp đồng: 24 câu; 50 hợp đồng: 24 câu". Đây là **bài chập chờn khi chạy song song** (bộ đếm câu bị nhiễu), không phải lỗi mã, không thuộc E. Nên giao thợ D xem cách đếm |

### 1.3 Đột biến tôi tự cài

**Cách làm:**
- Danh sách là của riêng tôi. Tôi **không** dùng danh sách đột biến 18–22 và danh sách "phá tay" ở bản vẽ 6.3.
- Mỗi lần: cài một lỗi bằng thay chuỗi đúng một chỗ → chạy bài thử → chép trả tệp gốc, rồi so từng byte với `HEAD` (cả 16 lần đều "khớp HEAD").
- Đột biến máy chủ chạy 5 tệp bài thử cổng (115 bài, trước khi phá đều xanh).
- Mã cài lỗi: `scratchpad/cham-e/mutate.sh`. Kết quả: `log/n1-mutants*.txt`, `log/n1-mut-N*.txt`.

| # | Đột biến (vùng phủ) | Tệp | Kết quả |
|---|---|---|---|
| N1 | Phiên **hết hạn** vẫn được nhận (bỏ kiểm `expiresAt`) | portal/auth.ts:48 | **Đỏ** 2 bài |
| N2 | Phiên **đã thu hồi** vẫn được nhận | portal/auth.ts:48 | **Đỏ** 3 bài |
| N3 | Mở được **máy thứ 3** (`>=` → `>`), chỉ còn trigger database chặn | portal/redeem.ts:126 | **Đỏ** 4 bài |
| N4 | `/me` liệt kê cả ghi danh **đã huỷ** | portal/me.ts:80 | **Đỏ** 3 bài |
| N5 | `/me` hiện cả thẻ ảnh trung tâm **đã ẩn** (ký duyệt E câu 2) | portal/me.ts:141 | **Đỏ** 1 bài |
| N6 | Mở lại cùng trình duyệt **không** thu hồi phiên cũ (một trình duyệt nhiều phiên) | portal/redeem.ts:168 | **Đỏ** 1 bài |
| N7 | Hạn 7 ngày áp cả cho đường dẫn **đã mở** (trái ký duyệt E câu 1) | portal/redeem.ts:124 | **Đỏ** 1 bài |
| N8 | Tổ chức bị khoá vẫn xem được cổng | portal/auth.ts:52 | **Đỏ** 2 bài |
| N9 | Mã chuyển máy sống **100 phút** thay vì 10 | portal/handoff.ts:21 | **Đỏ** 1 bài |
| N10 | Mỗi máy giữ được **4 phiên** sống thay vì 3 | portal/redeem.ts:212 | **Đỏ** 1 bài |
| N11 | Hạn phiên **không trượt** (chỉ cập nhật `lastUsedAt`) | portal/auth.ts:58 | **Đỏ** 2 bài |
| N12 | Thẻ trung tâm báo "Đang mở" khi đã đủ 2 máy | portal/center.ts:84 | **Đỏ** 1 bài |
| N13 | Tạo đường dẫn **không** đòi `payments.read` (bản vẽ H7) | portal/center.ts:38 | **Đỏ** 1 bài |
| N14 | Cookie cổng path `/api/v1` (trình duyệt gửi sang cả đường nhân viên) | portal/cookie.ts:8 | **Đỏ** 4 bài |
| W1 | Máy khách cổng **bỏ** `X-Client: portal` | web portal/api.ts:26 | **Đỏ** 1 bài (`src/portal`, 44 bài) |
| W2 | Thẻ cổng ghi chìa vào **localStorage** | web PortalCard.tsx:141 | **Đỏ** 1 bài (`PortalCard.test.tsx`) |

**Kết luận: bài thử bắt được 16/16 lần phá.**

Lỗi T1 (chữ bị cắt) là lỗi **bố cục**. jsdom không đo bố cục. Bài e2e chỉ đo tràn ngang cả trang ở màn `/hv` trống. Vì vậy không bài nào bắt được T1 (xem cách chặn ở T1).

### 1.4 Đo trên app thật

**App thật:**
- Máy chủ: cổng 4600, PORTAL_RATE_LIMIT_PER_MINUTE = 10000 để đo thời gian đủ mẫu số. Giới hạn mặc định 10/phút tôi đo riêng ở mục 2, B16.
- Web: bản build (`vite preview`) cổng 5600.
- Dữ liệu: `makeup_test_cham_e_dung`.

| Hạng mục | Kết quả |
|---|---|
| **Tràn ngang cả trang** | **0/39** lần đo. Gồm 36 ảnh của luồng (trung tâm 1440/390, học viên 390/1440) và 3 lần đo trang cổng ở 320/360/390 |
| **Chữ tràn trong thẻ** (đo `scrollWidth > clientWidth`) | 390: **1 chỗ**, nội dung chuyển khoản (T1). 360: 2 chỗ (thêm "13/10/2026 – 24/11/2026"). 320: thêm 3 ô số tiền ở Học phí (L4) |
| **Nút chết** | **0/19** nút. 16 nút bấm trong luồng, tất cả đổi đúng trạng thái: Đăng nhập, Tạo đường dẫn, Tạo (×2), Sao chép tin nhắn (×2), Tạo đường dẫn mới, Mở trang của tôi, Lấy mã chuyển sang app, Tôi có mã chuyển sang app, Nhận trang trên app, Chặn máy này, Chặn máy, Thu hồi đường dẫn và chặn mọi máy, Thu hồi, Thoát khỏi máy này (×2). Quét tự động thêm 3 nút trên trang học viên 390: 3/3 có phản hồi |
| **Lỗi trang** | 0 lỗi JavaScript, 0 lỗi console. Chỉ có 401 đúng thiết kế khi chưa có phiên |
| **Service worker** | Đã đăng ký. Bộ đệm `assets-mp-sw-1` chỉ có `/offline.html` và 8 tệp `/assets/…`. **Không có `/api/…` nào** (đo sau khi đã gọi `/portal/me`) |

---

## 2. Tự tìm cách phá (việc chính): 18 cách, 0 lọt

**Cách chạy:**
- Mã phá: `scratchpad/cham-e/pw/pha.mjs`. Kết quả: `log/pha.txt`. Lệnh: `API_URL=http://localhost:4600 SEED_DATABASE_URL=<_dung> node pha.mjs`, sau khi chạy `seed.mjs`.
- Dữ liệu:
  - Học viên A "Tôn Nữ Phương Thảo" và bạn **cùng lớp** B "Lê Thị Bạn Cùng Lớp" (HĐKH-000002, phiếu 1.234.000, chuỗi bí mật `BI-MAT-B-…`).
  - Chuỗi bí mật `BI-MAT-<uuid>` đặt ở ghi chú khách, ghi chú hợp đồng, ghi chú phiếu, snapshot thẻ, email trung tâm.
  - SĐT giảng viên 0911222333.

| # | Cách phá | Tái hiện (đều qua HTTP thật) | Kết quả |
|---|---|---|---|
| B1 | Phiên cổng gọi **đường nhân viên** bằng nhiều cách cầm | `GET /auth/me` và `GET /orgs/:id/customers` với (a) cookie `mp_portal` + `X-Client: portal`; (b) `Bearer mpp_AAAA…`; (c) `Bearer <thẻ cổng thật>` | **4/4 → 401**. Không lọt |
| B2 | Cookie cổng gửi thẳng tới path nhân viên | `curl /api/v1/auth/me -H 'cookie: mp_portal=<thẻ>'` | **401** |
| B3 | Đường cổng thiếu hoặc thừa điều kiện | `/portal/me`: cookie đúng **thiếu** X-Client; cookie đúng **kèm** `Authorization: Bearer abc`; không cookie; cookie nhân viên `mp_refresh` | **4/4 → 401**. Vế GIỮ: cookie đúng + X-Client → 200 |
| B4 | **Đua mở máy thứ 3** | 5 lần `POST /portal/session` **đồng thời**, đúng 4 số, cùng một đường dẫn mới | **Đúng 2 lần 201**, 3 lần 401 (lời chung) |
| B5 | Thu hồi đường dẫn mà **phiên cũ còn sống** | Mở phiên → `/me` 200 → `POST …/portal/revoke` → `/me` | **401 ngay yêu cầu kế** |
| B6 | Học viên A đọc `/me` | Quét thân trả về | Không có `BI-MAT`, **0 UUID** (ngoài trường `…Url`), không có SĐT giảng viên |
| B6b | A thấy gì của **B cùng lớp**? | Quét `/me` của A | Tên B, mã HĐ B, bí mật B, tiền phiếu B: **0/4**. GIỮ: có HĐKH-000001 của A |
| B11 | **Nhét mã học viên B** vào yêu cầu cổng | `GET /portal/me?customerId=<B>`, `?code=HĐKH-000002`, `/api/v1/Portal/me` (chữ hoa), `/portal/me/` (gạch cuối), `POST /portal/session/handoff` thân `{customerId:B}` | Mọi lần đều trả **dữ liệu của A** hoặc mã chuyển của máy A. **0 lần ra dữ liệu B**. Query và thân thừa bị bỏ qua vì học viên lấy từ phiên |
| B12 | A **bị huỷ ghi danh** (ghi thẳng database) khi phiên còn sống | `UPDATE enrollments SET status='CANCELLED'`, rồi `/me` | 200: **0 lớp**, vẫn 1 hợp đồng của A (đúng ký duyệt E câu 4). Không lộ `cancelReason`, không lộ gì của B. Đã trả ghi danh về ACTIVE |
| B3b | **Mã chuyển máy** dùng lại hoặc đoán | Tạo mã → claim lần 1 → claim lần 2 → claim `ABCD-EFGH` | **201 → 401 → 401**. Không gian mã 31⁸ ≈ 8,5×10¹¹, bị giới hạn 10 lần/phút/IP (B16): dò hết cần khoảng 160.000 năm cho mỗi IP |
| B7 | **Thời gian trả lời** theo lý do hỏng (n = 32 mỗi loại) | Đo ms ở máy khách | Xem bảng dưới: **p50 lệch nhau ≤ 0,9 ms**, mọi lần ≥ 302 ms (sàn 300) |
| B7b | **Thân phản hồi** theo lý do | So thân (bỏ `requestId`) của 6 lý do | **6/6 giống hệt**: 401 `UNAUTHENTICATED` + đúng câu `PORTAL_DENIED_MESSAGE` |
| B8 | Lộ qua **tiêu đề / OpenAPI** | Header `/me`; tải `/api/v1/openapi.json` | `Cache-Control: no-store`. Cookie `Path=/api/v1/portal`. OpenAPI không có `keyHash`/`tokenHash`/`handoffHash`/`BYPASS`/`SUPER_ADMIN`. Có chữ `bankAccountNo`, nhưng đó chỉ là **tên trường** trong khuôn của đường cài đặt, không có giá trị: **không lộ** |
| B9 | **Trang công khai** lộ số tài khoản | Xuất bản trang (`POST …/profile/publish`), rồi `GET /public/sites/<slug>` | Không có "0123456789", không có "Vietcombank", không có "bankAccount" |
| B13 | **Trang lạ giả yêu cầu** (CORS) | `OPTIONS /portal/me` với `Origin: https://trang-la.example`, xin header `x-client` | 204 nhưng **không** có `Access-Control-Allow-Origin` → trình duyệt chặn. Cookie còn có SameSite=Strict |
| B14 | Lộ qua **log máy chủ** | Quét 290 dòng log của máy chủ 4600 sau toàn bộ luồng phá | Không có chìa, không có thẻ `mpp_…`, không có `"last4"`. "3321" chỉ xuất hiện **bên trong một UUID** (0 lần đứng riêng) |
| B15 | **Database** có bản rõ? | SQL chỉ đọc: hash sai dạng ở `portal_links` / `portal_sessions` / `portal_devices.handoff_hash`; thẻ `mpp_` trong `audit_logs`; chìa trong `idempotency_keys.response_body` | **0 / 0 / 0 / 0 / 0**. 146 dòng audit `portal.*`, không dòng nào có chìa, thẻ, mã hay 4 số |
| B16 | **Giới hạn lượt mặc định** + giả IP | Máy chủ thứ hai (cổng 4601, cấu hình mặc định): 12 lần mở, mỗi lần đổi `X-Forwarded-For` | Lần 1–10: 401, **lần 11–12: 429**. Đổi IP giả **không** lách được (`TRUST_PROXY_HOPS=0`). `claim` cùng bộ đếm: 429. Đăng nhập nhân viên vẫn 200 (bộ đếm riêng) |
| B18 | Service worker **đệm `/api`** | `sw.js:37` (`/api/` → bỏ qua); đo bộ đệm thật trên app (1.4) | Không có `/api` trong bộ đệm |

**B7, thời gian trả lời (ms, đo ở máy khách, cùng máy):**

| Lý do | n | min | p50 | max | trung bình |
|---|---|---|---|---|---|
| Chìa không có thật | 32 | 302,9 | 304,1 | 311,5 | 304,7 |
| Sai 4 số (chìa thật; lần 5 khoá, lần 6–32 "đã khoá") | 32 | 302,5 | 304,1 | 306,6 | 304,2 |
| Đường dẫn đã bị thay/thu hồi | 32 | 302,4 | 304,4 | 425,8 (1 lần lẻ) | 308,8 |
| Đủ 2 máy | 32 | 302,2 | 303,9 | 308,9 | 304,1 |
| Thiếu `X-Client` | 32 | 302,5 | 303,5 | 304,1 | 303,5 |
| Nhận bằng mã bịa | 32 | 302,5 | 303,8 | 306,5 | 303,9 |
| **Thành công** (mỗi lần một đường dẫn mới) | 8 | 302,2 | 303,7 | 306,6 | 303,8 |

Lý do "hết hạn" tôi không đo thời gian ở đây (đường dẫn hết hạn bị thay ngay trong dàn dựng). Lý do này đã có ở phép `portalProbe` 15/15 và bài `vao` mục 2.

**Kết luận phần phá:** không cách nào lọt. Tường chắn hai chiều, một lời chung, sàn 300 ms, khoá máy thứ 3, thu hồi tức thì, và "học viên chỉ lấy từ phiên" đều đứng vững trên app thật.

---

## 3. Luồng app thật: đối chiếu màn hình với database (SQL chỉ đọc)

**Mã chạy:** `pw/ui.mjs`. Kết quả: `log/ui.txt`, `log/ui.json`. Học viên C là "Trần Minh Châu", SĐT `0912 000 777`, HĐKH-000005.

1. **Trung tâm 1440** (ảnh `tt-the-cong-chua-gui-1440`):
   - Thẻ "Cổng học viên" ghi "Chưa gửi" → bấm "Tạo đường dẫn".
   - Hộp xác nhận: nút "Tạo" **bị khoá** khi chưa tick "Tôi đã đối chiếu số điện thoại đuôi **0777**" (`tt-hop-xac-nhan-tao-1440`).
   - Tick → Tạo. Hiện tin nhắn "Chào Châu, đây là trang học viên của em tại Chiến Makeup Academy…" có `…/hv#k=…`, kèm dải vàng "chỉ hiện một lần" (`tt-chia-vua-tao-1440`).
   - "Sao chép tin nhắn": clipboard **đúng bằng** tin nhắn.
   - Chìa **không** vào địa chỉ trang, **không** vào localStorage.
2. **Trung tâm 390:**
   - Thẻ hiện "Đang mở · hết hạn 02/11 01:24 nếu chưa mở" (`tt-the-cong-dang-mo-390`).
   - "Tạo đường dẫn mới" hỏi lại "Đường dẫn cũ thôi nhận máy mới. Máy đã mở vẫn dùng được" (`tt-hop-xac-nhan-tao-390`) → tạo chìa 2.
3. **Học viên iPhone 390** (User-Agent iPhone Safari):
   - Mở bằng **chìa 1 (đã bị thay)** + đúng 4 số → lời chung, không vào được.
   - Mở chìa 2: nút "Mở trang của tôi" **khoá** khi chưa đủ 4 số (`hv-nhap-4-so-390`).
   - Nhập sai `1234` → dải đỏ đúng câu chung, **không** có "còn N lần" (`hv-sai-4-so-390`).
   - Nhập đúng `0777` → vào trang. `#k=` đã bị xoá khỏi thanh địa chỉ. Tiêu đề trang = "Chiến Makeup Academy" (`hv-trang-dau-390`).
4. **Tiền trên màn và database** (SQL trong `BEGIN READ ONLY`, kết thúc bằng `ROLLBACK`):

| Ô | Màn (390 và 1440 giống nhau) | Database |
|---|---|---|
| Tổng phải đóng | 14.000.000 ₫ | `contracts.total = 14000000` (subtotal 14000000, giảm 0) |
| Đã đóng | 4.500.000 ₫ | PT-000008 3.000.000 (chuyển khoản) + PT-000009 1.500.000 (tiền mặt), chưa huỷ = 4.500.000 |
| Còn lại | 9.500.000 ₫ | 14.000.000 − 4.500.000 = 9.500.000 |
| Đặt cọc | 3.000.000, "đã đủ", hạn 11/10/2026 | 3.000.000, hạn 2026-10-10 18:xx UTC = **11/10 giờ Việt Nam** ✓ |
| Đợt 1 | "còn thiếu 4.500.000 ₫ — hạn 23/10, đã qua 3 ngày" | 6.000.000 − (4.500.000 − 3.000.000) = 4.500.000. Hạn 22/10 18:xx UTC = **23/10 giờ Việt Nam** ✓ |
| Đợt 2 | 5.000.000 ₫, hạn 15/11 | 5.000.000, hạn 14/11 18:xx UTC = 15/11 ✓ |

**Khớp từng đồng.** Ngày hạn hiện theo múi giờ của trung tâm, đúng bản vẽ 5.1.

5. **Chuyển sang app** (một kho cookie khác, giả app đã cài):
   - Trên iPhone bấm "Lấy mã chuyển sang app" → hiện mã `XXXX-XXXX`.
   - App mở `/hv` → "Chưa mở trang" (`hv-chua-mo-trang-390`) → "Tôi có mã chuyển sang app" → nhập mã (`hv-nhap-ma-chuyen-390`) → vào được trang.
   - `devicesUsed` vẫn = **1** (không tốn suất).
6. **Máy thứ hai:** học viên mở trên máy tính 1440, sai một lần (`hv-sai-4-so-1440`) rồi đúng (`hv-trang-dau-1440`).
   - Thẻ trung tâm thành **"Đủ 2 máy"**, liệt kê "Máy tính · Chrome" và "iPhone · Safari". Tên máy do máy chủ đọc từ User-Agent (`tt-danh-sach-may-1440/390`).
   - Máy thứ 3 → lời chung.
7. **Chặn iPhone** (hộp có lý do điền sẵn "Học viên báo mất máy", `tt-hop-chan-may-1440`):
   - `/me` của iPhone **401**. `/me` của app đã cài **401** (cùng máy). `/me` của máy tính vẫn **200**.
   - iPhone tải lại → "Chưa mở trang" (`hv-bi-day-ra-390`).
   - Thẻ trung tâm ghi "Đã chặn hôm nay 01:25 · Người thử chu" (`tt-sau-chan-may-1440`).
8. **Thu hồi** ("Đường dẫn bị lộ", `tt-hop-thu-hoi-1440`):
   - `/me` máy tính **401**. Tải lại → bị đẩy ra (`hv-bi-day-ra-1440`).
   - Admin view: link `REVOKED`, máy `[LINK_REVOKED, BLOCKED]` (`tt-sau-thu-hoi-1440/390`).
9. **Thoát khỏi máy này** (đường dẫn mới, máy mới): hỏi lại → "Đã thoát khỏi máy này." ✓
10. **Cài đặt → Cổng học viên** (`tt-cai-dat-cong-1440/390`):
    - 3 ô đã điền. Khung xem trước "Cách đóng tiền" nhóm số tài khoản "0123 4567 89".
    - Nút Lưu khoá khi chưa đổi gì.

---

## 4. Lỗi (xếp theo mức)

**Nặng: không có.** Không có cách phá nào thành công.

### Trung bình

**T1. Cổng học viên 390: "Nội dung chuyển khoản" bị cắt khi tên dài. Không bài thử nào bắt được.**
- **Triệu chứng:** học viên "Tôn Nữ Phương Thảo" (chính ví dụ trong bản vẽ 3.4) thấy "HDKH-000001 Ton Nu Phuong T…". Chữ "Thao" bị mép thẻ cắt mất.
  - Ảnh: `hv-cach-dong-ten-dai-390.png`, `hv-cach-dong-ten-dai-320.png`.
  - Đo: `strong.num` rộng 249 px trong ô 200 px ở 390; 249 trong 170 ở 360.
  - Nút "Chép" vẫn chép đủ chữ, nhưng học viên nào **gõ tay** theo màn sẽ chuyển khoản thiếu nội dung, và trung tâm khó đối soát.
- **Gốc:**
  - `apps/web/src/portal/sections.tsx:252` gắn lớp `num` cho nội dung chuyển khoản.
  - `.num { white-space: nowrap }` ở `apps/web/src/styles/base.css:126-128` thắng `overflow-wrap: anywhere` ở `apps/web/src/portal/portal.css:144`.
  - `.pt-card { overflow: hidden }` ở `portal.css:27` cắt phần thừa.
- **Tái hiện:** chạy app thật như mục 5, mở cổng của học viên "Tôn Nữ Phương Thảo" ở khổ 390, cuộn tới "Cách đóng tiền". Hoặc chạy `node pw/do-tran.mjs`.
- **Cách chặn:**
  - Bỏ `num` ở dòng đó, hoặc thêm `white-space: normal` cho `.pt-kv__copy strong`.
  - Thêm vào e2e một phép đo "không phần tử nào trong `.pt-card` có `scrollWidth > clientWidth`" ở 390 với tên dài.

**T2. Lên mạng: bộ đếm 10 lần/phút của cổng tính theo IP. Đứng sau Vercel thì có thể cả lớp chung một IP.** (rủi ro, chưa đo được; nối với việc tồn 18)
- **Hiện nay:** `TRUST_PROXY_HOPS` mặc định 0 (`apps/api/src/env.ts:31`, `app.ts:60`). Ở máy thử: giả `X-Forwarded-For` **không** lách được (B16, đúng).
- **Rủi ro:** trên Vercel → Railway, nếu mọi yêu cầu cổng đến từ IP của Vercel, thì khi trung tâm gửi đường dẫn cho cả lớp 20 người cùng lúc, người thứ 11 trở đi trong cùng phút sẽ nhận "Thử quá nhiều lần".
- Cổng làm rủi ro này rõ hơn so với đăng nhập nhân viên, vì đường dẫn thường gửi **hàng loạt**.
- **Cách chặn:** đo số tầng proxy thật khi có tên miền (`docs/DUA-LEN-MANG.md:145`, `DEPLOYMENT.md:132`) rồi đặt `TRUST_PROXY_HOPS`. Thử lại B16 trên máy thật với 2 IP khác nhau.

### Nhẹ

- **L1. Tiêu đề danh sách máy ghi "(tối đa 2)".** Bản vẽ 5.2 ghi "Máy đã mở `(n/2)`". Hiện không thấy ngay đã dùng mấy suất, phải nhìn nhãn "Đủ 2 máy" ở góc thẻ. `apps/web/src/features/customers/PortalCard.tsx:224`.
- **L2. Dòng xám "Đường dẫn chưa mở hết hạn sau 7 ngày…" nằm ngoài thẻ, thành một khối riêng** dưới thẻ Cổng học viên. Bản vẽ 5.2 đặt nó ở "Chân thẻ". `PortalCard.tsx:253-255`, ảnh `tt-the-cong-chua-gui-1440`.
- **L3. Trung tâm 390, ngay sau khi tạo:** tin nhắn dài đẩy dải vàng "Tin này chỉ hiện **một lần**" và nút "Sao chép tin nhắn" xuống dưới mép màn. Người dùng phải cuộn mới thấy cảnh báo (`tt-chia-vua-tao-390`).
- **L4. Khổ 320–360** (máy nhỏ):
  - 3 ô tiền ở Học phí rộng 96 px trong cột 79 px (320). Đo được tràn, chưa thấy đè chữ trong ảnh.
  - Ở 360, "13/10/2026 – 24/11/2026" (`dd.num`) tràn 6 px.
  - Cùng gốc với T1 (`.num` nowrap).
- **L5. Tên bài thử lỗi thời:** `apps/web/scripts/check-portal-bundle.test.ts:125` còn ghi "hv.html chỉ kéo React + **trang tạm**". Trang tạm của W1 đã được W2 thay.
- **L6 (không thuộc E, ghi để chuyển):**
  - `hom-nay.test.ts` (D) chập chờn khi chạy cả bộ (mục 1.2).
  - Typecheck web đỏ vì tệp bài thử của F (mục 1.2).
  - Lớp K12 dữ liệu thử có 13 buổi trong khi khoá ghi 12 buổi ("Buổi 13" hiện ở lịch). Đây là dữ liệu sinh buổi của K2, cổng chỉ hiển thị đúng dữ liệu.

---

## 5. Anh Chiến dùng thật được chưa

**Phần trung tâm: dùng được ngay** trên máy anh (chạy theo `docs/CHAY-THU-TREN-MAY.md`).
- Vào hồ sơ học viên → thẻ "Cổng học viên" → tick đối chiếu 4 số → "Tạo đường dẫn" → "Sao chép tin nhắn".
- Xem máy đã mở, chặn máy, thu hồi, và điền số tài khoản ở Cài đặt → Cổng học viên. Tất cả chạy đúng.

**Gửi cho học viên thật: CHƯA được.** Lý do là **chưa có tên miền** (việc tồn 1).
- Đường dẫn trong tin nhắn lấy địa chỉ của chính trang anh đang mở. Chạy trên máy anh thì đó là `http://localhost:…`, điện thoại học viên **không mở được**.
- Phải đưa lên mạng (Vercel + Railway, `docs/DUA-LEN-MANG.md`) trước, rồi mới gửi.
- Trước khi gửi hàng loạt, cần làm T2: đo proxy và đặt `TRUST_PROXY_HOPS`.

**Việc phải làm trên iPhone thật khi có tên miền** (bản vẽ mục 8, 9 câu 5):
- Cài lên màn hình chính.
- Xem app đã cài có dùng chung cookie với Safari không. Nếu có thì mã chuyển sang app là thừa nhưng vô hại.
- Kiểm tai thỏ (việc tồn 56).
- Xem biểu tượng (việc tồn 57: biểu tượng đang lệch chữ "M"/"HV" của bản vẽ).

**Trước khi gửi học viên, thợ cần vá T1** (khoảng 1 giờ: CSS + một phép đo trong e2e).

---

## 6. Còn giữ để tái hiện

**Database `makeup_test_cham_e_dung`:**
- Tổ chức ACADEMY "Chiến Makeup Academy", slug `chien-academy-1792952131612`, trang công khai đã xuất bản.
- Chủ tài khoản `cham-e-chu-1792952131612@thu.local`, giảng viên `cham-e-gv-…`. Mật khẩu thử ghi trong `scratchpad/cham-e/pw/seed.json`.
- Học viên:
  - A "Tôn Nữ Phương Thảo" (4 số 3321, HĐKH-000001, đã đóng 8.000.000).
  - B "Lê Thị Bạn Cùng Lớp" (HĐKH-000002; 4 số 4444; đường dẫn đã **khoá** vì bị dò sai trong B7).
  - C "Trần Minh Châu" (0777, HĐKH-000005, đã đóng 4.500.000; link đã thu hồi). Có thêm 2 bản "Trần Minh Châu" do 2 lần chạy hỏng giữa chừng của `ui.mjs`, kèm HĐKH-000003/000004.
- Cài đặt cổng: Vietcombank 0123456789.

**Chạy lại app thật** (từ một bản tách của `70543b7`):
```
DATABASE_URL=… DIRECT_URL=… NODE_ENV=development JWT_ACCESS_SECRET=<≥32 ký tự> PORT=4600 MAIL_DRIVER=console \
  WEB_APP_URL=http://localhost:5600 CORS_ORIGINS=http://localhost:5600 PORTAL_RATE_LIMIT_PER_MINUTE=10000 npx tsx src/server.ts
API_DEV_TARGET=http://localhost:4600 ./node_modules/.bin/vite preview --port 5600 --strictPort     # sau pnpm build
```
Đặt `PORTAL_RATE_LIMIT_PER_MINUTE=10000` chỉ để đo thời gian. Muốn thử giới hạn thật thì bỏ dòng này.

**Mã đo ở `scratchpad/cham-e/`:**
- `pw/seed.mjs`: gieo dữ liệu.
- `pw/pha.mjs` + `pw/pha-main.mjs`: 18 cách phá.
- `pw/ui.mjs`: luồng và ảnh.
- `pw/do-tran.mjs`: đo chữ tràn.
- `mutate.sh`: đột biến.
- `e2e.config.ts`: cấu hình e2e tạm.

## 7. Dọn

**Tắt theo PID của tôi:**
- API 4600: 1609, 1625, 1626, 1642.
- API 4601: 7074, 7097. Lệnh `kill` tiến trình cha `npx` không tắt tiến trình con, nên tôi tìm tiến trình con theo biến môi trường `PORT=4601` của chính nó rồi tắt theo PID.
- Web 5600: 7858, 7860.
- Máy chủ e2e (4000/5173) do Playwright tự tắt.
- Sau khi tắt: 4000, 4123, 4600, 4601, 5173, 5600 không còn tiến trình nghe.

**Bản tách:**
- Gỡ bằng `git worktree remove --force`.
- Trước khi gỡ, `git status` chỉ còn 5 tệp `.bat` lệch kiểu xuống dòng (như biên bản D).
- 16 lần cài đột biến đều đã chép trả và so khớp `HEAD`.

**Database:** đã xoá `makeup_test_cham_e`, `makeup_test_cham_e_khop`, `makeup_test_cham_e_w2`. Giữ `makeup_test_cham_e_dung`.
