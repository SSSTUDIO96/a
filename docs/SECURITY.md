# An ninh — Makeup Pro

Cập nhật: 18/10/2026. **Đã đối chiếu với commit `634d6a3`** (17:00 UTC; mã giống hệt `bc9633a`, hai commit sau chỉ thêm sổ ghi). Số đo lấy từ các lần chạy bài thử trên máy đám mây ngày 18/10/2026 (database thử, không phải máy thật); mỗi số ghi rõ lần chạy nào.

> Bài thử qua hết **không** có nghĩa là an toàn. Nó chỉ chứng minh những gì bài thử có kiểm. Mục 5 liệt kê những gì chưa ai kiểm.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. Mô hình đe doạ
| # | Kẻ gây hại | Muốn làm gì | Lớp chặn cần có |
|---|---|---|---|
| 1 | Studio khác dùng chung phần mềm | Xem/sửa khách, giá, hợp đồng, tiền của mình — kể cả nhét mã bản ghi của mình vào yêu cầu của họ | Cách ly tổ chức ở cửa vào, trong thân yêu cầu, và trong database |
| 2 | Nhân viên trong studio | Tự nâng quyền, hạ quyền cấp trên, tự nâng bậc lương, giảm giá hợp đồng đã chốt | Phân quyền, luật thứ bậc, quyền điều chỉnh riêng |
| 3 | Nhân viên đã nghỉ | Vẫn vào xem lịch, lấy danh sách khách | Mất quyền ngay ở yêu cầu kế tiếp |
| 4 | Kẻ trộm thẻ | Dùng thẻ của người khác; mã độc trên trang web đọc thẻ | Thẻ ngắn hạn, phát hiện dùng lại, thẻ dài hạn của web nằm trong cookie httpOnly |
| 5 | Trang web lạ | Giả yêu cầu từ trình duyệt của người đang đăng nhập | Cookie SameSite=Strict + header bắt buộc |
| 6 | Kẻ đoán mật khẩu | Thử hàng nghìn lần, tự đổi IP trong header | Giới hạn tốc độ, chỉ tin đúng số tầng proxy |
| 7 | Kẻ lấy được bản sao database | Đọc mật khẩu, thẻ | Chỉ lưu bản băm |
| 8 | Người muốn che dấu | Sửa giá cũ, sửa hợp đồng đã ký, xoá phiếu thu, xoá nhật ký | Sổ chỉ ghi thêm, khoá ở database |
| 9 | Người tải tệp độc | Tải tệp giả đuôi ảnh | Kiểm chữ ký đầu tệp, giới hạn dung lượng |
| 10 | Mã chính mình viết sai | Quên kiểm quyền ở đường mới; lộ bí mật vào bản web | Cửa gác tự động; quét bí mật trong bản build |

### 2. Luật đo cửa gác
- In **tử số / mẫu số**, không chỉ in "đạt". Mẫu số lấy tự động từ danh sách đường thật.
- Có vế **GIỮ**: người có quyền vẫn qua.
- Gặp đường chưa có dữ liệu mẫu thì **dừng và báo đỏ**, không bỏ qua.
- **Cửa gác chưa từng chuyển đỏ trước lỗi cài sẵn thì chưa được tin.** "Phá thử 2 lần đều đỏ" vẫn có thể mù với kiểu lỗi chưa nghĩ tới (`docs/SO-LOI-DA-DO.md` mục 7).

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Các lớp chặn và bài thử chứng minh
Mã ở `apps/api/src/`, bài thử ở `apps/api/test/` (trừ khi ghi khác).

| # | Lớp chặn | Mã | Bài thử (tệp → ca) |
|---|---|---|---|
| 1 | Cách ly tổ chức: người ngoài 404, thiếu quyền 403, không thẻ 401, nhét mã của tổ chức khác vào đường/thân/tham số lọc | `http/middleware.ts:35-77` + lọc theo tổ chức trong từng hàm | `tenant-isolation.test.ts` (mục 2) |
| 2 | Khai đường sai → máy chủ không khởi động | `http/route.ts:73-109` | `guards.test.ts` → 4 ca, gồm "đường dưới /platform/ phải khai scope "platform"…" |
| 3 | Thẻ giả / sai thuật toán → 401 | `lib/tokens.ts:13-24` | `tenant-isolation.test.ts` (phép unauth) |
| 4 | Không trao quyền mình không có | `modules/orgs/guards.ts:20-29` | `escalation.test.ts` → "quản lý không tự nâng mình lên quản trị", "quản lý không trao vai trò quản trị cho người khác" |
| 5 | **Luật thứ bậc**: không đụng người giữ quyền mình không có | `modules/orgs/guards.ts:31-41` | `nghiem-thu-moc2.test.ts` → "quản lý không hạ được quản trị xuống thợ", "quản lý không tạm khoá được quản trị", "vai trò "Nhân sự" không cho quản trị rời tổ chức được" |
| 6 | Sửa vai trò phải có đủ quyền cũ lẫn mới | `modules/orgs/guards.ts:43-48` | `nghiem-thu-moc2.test.ts` → ""Nhân sự" không bỏ được quyền xem nhật ký khỏi "Kế toán trưởng"" |
| 7 | Khoá tổ chức rồi **tra quyền lại** trong giao dịch | `http/middleware.ts:174-181` | `nghiem-thu-moc2.test.ts` → "người bị hạ quyền giữa chừng không trao quyền được nữa (đua 15 lượt)" |
| 8 | Luôn còn ít nhất một chủ đang hoạt động (tài khoản bị khoá không tính) | `modules/orgs/guards.ts:49-54` | `escalation.test.ts` → "chủ cuối cùng không tự rời hay tự hạ quyền được"; `nghiem-thu-moc2.test.ts` → "chủ có tài khoản bị khoá không được tính là chủ đang hoạt động" |
| 9 | Tạm khoá nhân sự / khoá tài khoản mất quyền ngay | `http/middleware.ts:24-27`, `:54-57` | `escalation.test.ts` → "nhân sự bị tạm khoá mất quyền ngay ở yêu cầu kế tiếp"; `auth.test.ts` → "tài khoản bị khoá thì thẻ đang cầm cũng hết tác dụng ngay" |
| 10 | Thứ bậc khi sửa hồ sơ thợ; đổi bậc lương cần quyền tiền công (lỗi T2) | `modules/staff/profiles.ts` | `staff.test.ts` → nhóm "T2: thứ bậc khi sửa hồ sơ thợ, đổi bậc lương cần payroll.write" |
| 11 | Số điện thoại thợ chỉ hiện cho người có quyền sửa nhân sự (G5) | `modules/staff/common.ts:32` | `staff.test.ts` → nhóm "G5: số điện thoại thợ chỉ hiện cho người có staff.write"; `schedule.test.ts` → nhóm "G5" |
| 12 | Giảm tiền hợp đồng đã xác nhận cần quyền `contracts.adjust` (G2) | `modules/contracts/routes.ts:86-93` | `contracts.test.ts` → nhóm "quyền" |
| 13 | Mật khẩu 10 ký tự – 72 byte, băm bcrypt 12 vòng | `modules/auth/routes.ts:14-18`, `lib/password.ts` | `auth.test.ts` → "mật khẩu ngắn bị từ chối…"; `nghiem-thu-moc2.test.ts` → "L9: mật khẩu quá 72 byte bị từ chối khi đăng ký" |
| 14 | Đăng nhập không lộ email nào có thật (cùng lời, cùng thời gian băm) | `lib/password.ts:13-14`, `modules/auth/routes.ts:60-61` | `auth.test.ts` → "sai mật khẩu và email không tồn tại trả cùng một lời" |
| 15 | Giới hạn tốc độ; IP thật chỉ lấy qua `TRUST_PROXY_HOPS` tầng proxy (mặc định 0) | `app.ts:31`, `:49-55`, `env.ts:13-15` | `auth.test.ts` → "quá số lần đăng nhập trong một phút → 429" |
| 16 | Thẻ dài hạn xoay vòng; chỉ thẻ thu hồi **do xoay vòng** mà dùng lại mới thu hồi cả họ | `modules/auth/service.ts:31-79` | `auth.test.ts` → "dùng lại thẻ cũ = bị đánh cắp → thu hồi cả họ thẻ…"; `nghiem-thu-moc2.test.ts` → "L10: dùng lại thẻ đã đăng xuất không bị ghi là "phát hiện đánh cắp"" |
| 17 | Đổi thẻ đồng thời chỉ một cái thắng | `modules/auth/service.ts:65-71` | `auth.test.ts` → "hai yêu cầu đổi cùng một thẻ đồng thời: đúng một cái thành công" |
| 18 | **Web: thẻ dài hạn chỉ trong cookie httpOnly, SameSite=Strict, đường `/api/v1/auth`; cookie chỉ được đọc khi có `X-Client: web`** | `modules/auth/transport.ts:11-49`, `app.ts:96-105` | `auth-cookie.test.ts` → 3 ca: thân không có refreshToken; thiếu header thì cookie bị bỏ qua; GIỮ: app vẫn nhận trong thân |
| 19 | Web giữ thẻ truy cập trong bộ nhớ, không localStorage | `apps/web/src/api/client.ts:9` | `apps/web/src/api/client.test.ts` (16 ca) |
| 20 | Nhật ký đăng nhập đúng/sai, đăng xuất, phát hiện dùng lại thẻ | `modules/auth/routes.ts:61-89`, `modules/auth/service.ts:44-52`, `:89-97` | `nghiem-thu-moc2.test.ts` → "L11: đăng nhập đúng và sai đều có nhật ký" |
| 21 | Thân ≤ 100KB, ký tự `\u0000` → 400 chứ không 500 | `app.ts:37-47`, `http/middleware.ts:109-121` | `nghiem-thu-moc2.test.ts` → hai ca "L6" |
| 22 | Lỗi database đã biết → 400/409, không 500 | `http/middleware.ts:153-169` | `db-guards.test.ts` → "vi phạm CHECK trả 400 chứ không 500"; `exclusion-error.test.ts` → 3 ca |
| 23 | Chống gửi trùng so đường dẫn thật (T1) | `app.ts:121-178` | `idempotency.test.ts` → 3 ca |
| 24 | Khoá ngoại kép chặn gắn chéo tổ chức trong database | migration, xem `docs/DATABASE_SCHEMA.md` 3.1 | `escalation.test.ts` → "không gán được vai trò của tổ chức khác, kể cả ghi thẳng vào database" |
| 25 | Sổ chỉ ghi thêm; khoá hợp đồng đã xác nhận; khoảng bận do database tính | migration 5, 7, 8 | `db-guards.test.ts` → 8 ca, ví dụ "dòng hợp đồng đã xác nhận: sửa giá / xoá bị chặn (409)…", "N3 — hợp đồng đã xác nhận: không về nháp, không tăng giảm giá, tổng tiền phải khớp các dòng"; `escalation.test.ts` → "nhật ký không sửa, không xoá được" |
| 26 | Không xoá dây chuyền | `prisma/schema.prisma:3` | `escalation.test.ts` → "không xoá được tổ chức còn dữ liệu (không có xoá dây chuyền)" |
| 27 | Đường quản trị nền tảng: người không có tên trong `platform_admins` nhận 404 | `app.ts:71-74` | Không có ở `634d6a3`. Commit `125e587` (17:03 UTC, chỉ đổi bài thử) thêm `platform.test.ts` (10 bài) và phép cửa gác `platform` |
| 28 | Tải tệp: kiểm chữ ký đầu tệp, giới hạn dung lượng theo mục đích; đường đọc có hạn 10 phút | `modules/files/routes.ts` | **Chưa có bài thử trong kho ở `bc9633a`** (`files.test.ts` đang viết) |
| 29 | Cửa gác bí mật cho bản web: quét `dist/` tìm tên/giá trị biến bí mật máy chủ, `postgresql://`, biến `VITE_*` lạ; có vi phạm thì build dừng | `apps/web/scripts/check-bundle-secrets.mjs` | `apps/web/scripts/check-bundle-secrets.test.ts` → 8 ca, gồm vế GIỮ "bản build thật của web sạch → exit 0" |
| 30 | Log che header đăng nhập, cookie, mật khẩu, thẻ | `lib/logger.ts:7-17` | Không có bài thử |
| 31 | **Quên mật khẩu không lộ tài khoản**: luôn 202 cùng thân, cùng bộ header (cả email lạ, tài khoản bị khoá, khác chữ hoa); thư gửi nền + mức sàn 300 ms nên thời gian không chênh dù dịch vụ thư chậm; lỗi cấu hình (503) kiểm TRƯỚC khi tra email | `modules/auth/password-reset.ts:61-73`, `:144-171` | `dat-lai-mat-khau.test.ts` → nhóm "chống dò tài khoản" (2 ca) |
| 32 | **Thẻ đặt lại**: 32 byte ngẫu nhiên, database chỉ giữ sha256 (CHECK `^[0-9a-f]{64}$` ở migration `20261019110000_dat_lai_mat_khau`), hết hạn `PASSWORD_RESET_TTL_MINUTES` (30 phút), dùng một lần (giành thẻ có điều kiện trong transaction), thư mới vô hiệu thư cũ; thẻ sai/hết hạn/đã dùng → cùng một lời 400 `RESET_TOKEN_INVALID` | `modules/auth/password-reset.ts:31-38`, `:118-139`, `:174-228` | `dat-lai-mat-khau.test.ts` → nhóm "thẻ đặt lại" (7 ca: đúng thẻ, hết hạn, dùng lại, đồng thời, thẻ sai, thẻ của người khác, mật khẩu mới không hợp lệ) |
| 33 | **Đặt lại xong thu hồi MỌI phiên** (refresh token, lý do `PASSWORD_RESET`) và mọi thẻ đặt lại còn lại; xoá cookie refresh | `modules/auth/password-reset.ts:42-56` (`revokeCredentialsAfterPasswordChange` — dùng lại cho "đổi mật khẩu" sau này) | `dat-lai-mat-khau.test.ts` → nhóm "thu hồi phiên và thẻ cũ" (2 ca) |
| 34 | Giới hạn lượt quên mật khẩu: bộ đếm `auth` theo IP (chung với đăng nhập) ở cả hai đường; tối đa 3 thư/giờ/email, lần vượt vẫn trả 202 giống hệt và ghi audit `auth.password_reset_throttled` | `modules/auth/password-reset.ts:111-117`, `:151`, `:181`; `app.ts:71-77`, `:120` | `dat-lai-mat-khau.test.ts` → nhóm "giới hạn lượt" (2 ca) |
| 35 | Thẻ đặt lại, bản băm, mật khẩu mới không vào nhật ký (mức trace), phản hồi (kể cả thẻ SAI gửi lên), audit; lời lỗi của dịch vụ thư bị che thẻ. Ngoại lệ có chủ đích: người gửi thư `console` (chỉ dev/test) in nguyên thư, dòng đánh dấu `[THƯ CHẠY THỬ — KHÔNG GỬI THẬT]` | `modules/auth/password-reset.ts:157-166`; `lib/mailer/console.ts`; `lib/mailer/index.ts:19-53` | `dat-lai-mat-khau.test.ts` → nhóm "không lộ thẻ" (3 ca) |
| 36 | Production chưa cấu hình gửi thư / dùng `console` / thiếu `WEB_APP_URL` → 503 `NOT_CONFIGURED` có tên (`MAIL_NOT_CONFIGURED`, `MAIL_CONSOLE_IN_PRODUCTION`, `WEB_APP_URL_NOT_CONFIGURED`), không im lặng giả vờ "đã gửi"; `MAIL_DRIVER=http` thiếu biến → không khởi động; khoá API thư phải đi `https` ở production | `lib/mailer/index.ts:19-53`, `env.ts:43-54`, `:64-69` | `dat-lai-mat-khau.test.ts` → nhóm "cấu hình người gửi thư" (5 ca) |

Đột biến của các chốt 31–36 (phá → đỏ → khôi phục, thợ K1 ngày 19/10/2026): máy chủ 26/26, web 11/11 (kịch bản đột biến nằm ngoài kho, liệt kê trong báo cáo của thợ K1).

### 2. Cửa gác cách ly tổ chức (`apps/api/test/tenant-isolation.test.ts` + `test/gate.ts`)
**Nó làm gì.** Lấy toàn bộ đường từ bảng đường của máy chủ. Dựng hai tổ chức A, B có đủ mọi loại tài nguyên. Chạy 9 phép:

| Phép | Kiểm gì | Lần chạy ≈16:45 UTC (bản trên máy, trước khi có đường tệp) |
|---|---|---|
| scope | Mọi đường có `:orgId` phải khai phạm vi tổ chức | 60/60 |
| outsider | Người của B gọi vào đường của A → 404 | 60/60 |
| noPerms | Thành viên A không quyền → 403 | 60/60 |
| unauth | Không đăng nhập → 401 | 62/62 |
| crossId | Chủ B, trên đường của B, nhét mã tài nguyên của A vào đường → 404, dữ liệu A không đổi | 30/30 |
| leak | Mọi đường xem của B không chứa giá trị nào của A | 25/25 |
| refBase | Thân/tham số mẫu (toàn mã của B) phải chạy được | 20/20 |
| crossRef | Thay **từng** trường mã trong thân/tham số lọc bằng mã của A và bằng mã bịa → hai phản hồi phải giống hệt (không lộ "A có bản ghi này") | **45/49 — ĐỎ**: 4 trường `staff[].membershipId` của hợp đồng chưa có mẫu tham chiếu chéo |
| keep | Chủ A dùng thật: xem 200, thân rỗng 400, xoá 2xx | 60/60 |

**Ở commit `bc9633a` cửa gác không chạy được**: ba đường tệp đã lưu vào kho nhưng chưa có dữ liệu mẫu cho `:fileId`, cửa gác dừng với lời "Cửa gác chưa có giá trị cho :fileId…" (lần chạy 16:54 UTC trên bản sao đúng commit). Nghĩa là **sự cách ly của mọi đường chưa được đo lại kể từ khi thêm đường tệp.** Cửa gác dừng chứ không bỏ qua là đúng luật; việc còn thiếu là dữ liệu mẫu.

**Bằng chứng cửa gác không mù** (`apps/api/test/gate-mutants.test.ts`): cài 8 kiểu lỗi vào bảng đường, cửa gác phải đỏ đúng phép. Lần chạy ≈16:45 UTC bắt cả 8, ví dụ:

| Đột biến | Phép đỏ | Số vi phạm in ra |
|---|---|---|
| 1. Tra vai trò chỉ theo id, quên lọc tổ chức | crossId | 1/30 |
| 2. Đường dưới `/orgs/:orgId` khai phạm vi "auth" | máy chủ từ chối khởi động | — |
| 3. Xử lý luôn trả 404 | keep | 1/60 |
| 4. Danh sách quên lọc tổ chức | leak | 1/25 |
| 5. Ném lỗi 500 khi thân rỗng | keep | — |
| 6. Xem trước hợp đồng tra khách chỉ theo id | crossRef | 10/49 |
| 7. Lọc hợp đồng theo khách mà quên điều kiện tổ chức | crossRef | 5/49 |
| 8. Báo "thuộc tổ chức khác" khác với "không tồn tại" | crossRef | 5/49 |

Ở `bc9633a`, 7 bài đột biến cũng đỏ vì cùng lý do thiếu mẫu `:fileId`, không phải vì cửa gác mù.

**Lịch sử:** bản cửa gác đầu (4 phép, 10 đường) được phá thử 2 lần đều đỏ, nhưng thợ chấm độc lập vẫn tìm ra 3 kiểu lỗi nó không thấy (mã tổ chức khác trong thân và tham số lọc — lỗi T3). Từ đó có phép crossId, leak, refBase, crossRef và bài đột biến 6–8.

**Phép thứ 10 — `platform`** (commit `125e587`, 17:03 UTC, sau mốc đối chiếu): người không có tên trong `platform_admins` gọi mọi đường `/platform/...` phải nhận 404 **giống hệt** một đường bịa; lọc đường theo địa chỉ chứ không theo phạm vi khai báo, kèm đột biến 9. Theo ghi chú của commit: trên bản sạch tách riêng, phép này 24/24 và đột biến 9 bắt 3/24; trên thư mục chung cửa gác vẫn đỏ vì `:fileId`. **Thợ tài liệu chưa tự chạy lại phép này.**

**Cửa gác chưa kiểm:** đường `/public/...` (đang viết); nội dung tệp tải lên.

### 3. Rủi ro đã biết, chưa sửa
| # | Rủi ro | Ở đâu | Trạng thái |
|---|---|---|---|
| 1 | Đăng ký báo "Email này đã được đăng ký" → dò được email có thật | `modules/auth/routes.ts:31` | Chủ chấp nhận rủi ro (biên bản mốc 2, L8), giới hạn 10 lần/phút/IP |
| 2 | Đổi thẻ thành công không ghi nhật ký | `modules/auth/routes.ts:94-104` | Còn lại từ L11 |
| 3 | Đăng xuất / **đặt lại mật khẩu** không huỷ được thẻ truy cập đang cầm (chỉ thu hồi refresh token) | thiết kế; `http/middleware.ts` `authenticate` chỉ kiểm trạng thái tài khoản | Tối đa `ACCESS_TOKEN_TTL_SECONDS` (15 phút). Muốn huỷ ngay: thêm mốc "đổi mật khẩu lúc" vào users và so với `iat` của thẻ trong `authenticate` |
| 4 | Bộ đếm giới hạn tốc độ nằm trong bộ nhớ từng máy chủ | `app.ts:49-55` | Nhiều máy chủ thì bộ đếm tách |
| 5 | Lời của trigger database trả thẳng cho người dùng (có thể lộ số tổng tiền nội bộ) | `http/middleware.ts:157-158` | Chấp nhận được trong một tổ chức; cần xem lại khi có đường công khai |
| 6 | Máy chủ chết sau khi ghi và trước khi lưu kết quả chống gửi trùng → gửi lại tạo bản thứ hai | `app.ts:155-156` | Đã ghi trong mã |
| 7 | Cấu hình kho tệp đọc riêng ngoài `env.ts`: chạy thật mà thiếu cấu hình thì máy chủ **vẫn khởi động**, chỉ lỗi khi có người tải tệp đầu tiên | `lib/storage/config.ts:9-10`, `:61-66` | Trái luật "thiếu biến thì không khởi động" |
| 8 | Thêm nhân sự bằng email không cần người được thêm đồng ý | `modules/orgs/routes.ts` (đường POST members) | Chưa quyết |

### 4. Những gì CHƯA có
| Chưa có | Khi nào cần |
|---|---|
| RLS (luật lọc theo tổ chức trong PostgreSQL) | Xem `docs/ARCHITECTURE.md` quyết định 9 |
| Xác thực hai lớp | Ít nhất cho chủ tài khoản và quản trị nền tảng, trước khi bán |
| Đổi mật khẩu khi đã đăng nhập, xác minh email (quên mật khẩu qua email đã có — chốt 31–36; chưa gửi được thư thật cho tới khi có dịch vụ gửi thư) | Trước khi có người dùng ngoài nhóm thử |
| Xuất / xoá dữ liệu cá nhân theo yêu cầu | Cần người hiểu luật Việt Nam về dữ liệu cá nhân xác nhận phạm vi; nhật ký và sổ tiền chặn xoá ở database, phải thiết kế ẩn danh hoá |
| Quét thư viện có lỗ hổng (`pnpm audit`) và quét bí mật trong lịch sử git | Chưa thấy trong kho |
| Kiểm thử xâm nhập độc lập trên máy thật | Trước khi bán |
| Sao lưu và diễn tập khôi phục | Trước khi có dữ liệu thật |
| Giám sát, cảnh báo khi có lỗi 500 hay phát hiện dùng lại thẻ | Khi lên máy thật |
| Bài thử cho tệp, thu tiền, hồ sơ thương hiệu | Đang viết, chưa lưu kho (quản trị nền tảng và hạn mức đã lưu ở `125e587`) |
