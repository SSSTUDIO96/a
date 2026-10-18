# An ninh — Makeup Pro

Ngày viết: 18/10/2026. Mọi số đo trong tệp này lấy từ lần chạy bài thử trên máy đám mây ngày 18/10/2026 (database thử, không phải máy thật).

> **Mốc dẫn chứng:** mọi `tệp:dòng` trong tài liệu này đúng với commit `f7b0805` (15:29 UTC ngày 18/10/2026). Lúc viết, các thợ khác đang sửa nhiều tệp lõi (chưa lưu vào kho, kể cả sửa theo biên bản nghiệm thu mốc 2); khi các sửa đó được lưu, số dòng có thể lệch và điều phối cần dò lại.

> Bài thử qua hết **không** có nghĩa là an toàn. Nó chỉ chứng minh những gì bài thử có kiểm. Mục 4 liệt kê những gì chưa ai kiểm.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. Mô hình đe doạ — ai có thể làm hại, làm hại kiểu gì
| # | Kẻ gây hại | Muốn làm gì | Lớp chặn cần có |
|---|---|---|---|
| 1 | Studio khác dùng chung phần mềm | Xem/sửa khách, giá, lịch của studio mình | Cách ly tổ chức ở cả máy chủ và database |
| 2 | Nhân viên trong studio | Tự nâng quyền, xem giá vốn/doanh thu không được phép | Phân quyền, luật "không trao quyền mình không có" |
| 3 | Nhân viên đã nghỉ | Vẫn vào xem lịch, lấy danh sách khách | Mất quyền ngay ở yêu cầu kế tiếp |
| 4 | Kẻ trộm thẻ đăng nhập | Dùng thẻ của người khác | Thẻ ngắn hạn, phát hiện thẻ bị dùng lại |
| 5 | Kẻ đoán mật khẩu | Thử hàng nghìn mật khẩu | Giới hạn tốc độ, mật khẩu đủ dài |
| 6 | Kẻ lấy được bản sao database | Đọc mật khẩu, thẻ | Chỉ lưu bản băm (không đảo ngược được) |
| 7 | Người muốn che dấu | Sửa giá cũ, xoá nhật ký | Sổ chỉ ghi thêm, chặn ở database |
| 8 | Mã chính mình viết sai | Quên kiểm quyền ở một đường mới | Cửa gác tự động, khai thiếu quyền thì không khởi động |

### 2. Luật đo cửa gác
- Cửa gác phải **in ra tử số / mẫu số** (ví dụ "10/10 đường"), không chỉ in "đạt".
- Mẫu số phải lấy tự động từ danh sách đường thật. Thêm đường mới là tự vào diện kiểm.
- Phải có vế **GIỮ** (người có quyền vẫn đi qua). Cửa chặn tất cả mọi người cũng "đạt" vế BẮT.
- **Cửa gác chưa từng chuyển đỏ thì chưa được tin.** Phải cố ý phá mã và thấy nó báo đỏ.

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Các lớp chặn đã có và bài thử chứng minh
Đường dẫn mã tính từ `apps/api/src/`. Bài thử nằm ở `apps/api/test/` (trừ dòng ghi `shared`).

| # | Lớp chặn | Mã | Bài thử (tệp → tên ca) |
|---|---|---|---|
| 1 | Người tổ chức khác gọi vào → 404, không lộ tổ chức có tồn tại | `http/middleware.ts:44-56` | `tenant-isolation.test.ts` → "BẮT: người của tổ chức B gọi vào tổ chức A → 404, không lộ tổ chức có tồn tại" |
| 2 | Thành viên thiếu quyền → 403 | `http/middleware.ts:60-68` | `tenant-isolation.test.ts` → "BẮT: thành viên A không có quyền → 403 ở mọi đường" |
| 3 | Không có thẻ → 401 | `http/middleware.ts:18-22` | `tenant-isolation.test.ts` → "BẮT: không có thẻ đăng nhập → 401 ở mọi đường cần đăng nhập" |
| 4 | Thẻ giả, ký bằng khoá khác → 401; chỉ nhận HS256 | `lib/tokens.ts:13-24` | `tenant-isolation.test.ts` → "BẮT: thẻ giả ký bằng khoá khác → 401" |
| 5 | Khai đường thuộc tổ chức mà thiếu quyền / sai địa chỉ → máy chủ không khởi động | `http/route.ts:67-81` | `guards.test.ts` → 3 ca "đường thuộc tổ chức mà không khai quyền → ném lỗi", "đường thuộc tổ chức không nằm dưới /orgs/:orgId → ném lỗi", "đường công khai mà khai quyền → ném lỗi" |
| 6 | Không trao được quyền mình không có | `modules/orgs/guards.ts:11-23` | `escalation.test.ts` → "quản lý không tự nâng mình lên quản trị", "quản lý không trao vai trò quản trị cho người khác"; vế GIỮ: "quản lý vẫn đổi được vai trò trong phạm vi quyền mình (vế GIỮ)" |
| 7 | Chỉ chủ trao được vai trò chủ, đụng được vào chủ | `modules/orgs/guards.ts:14-16`, `27-31` | `escalation.test.ts` → "quản trị không trao được vai trò chủ", "quản trị (không phải chủ) không đụng được vào chủ" |
| 8 | Tổ chức luôn còn ít nhất một chủ; khoá dòng tổ chức để hai thao tác đồng thời xếp hàng | `modules/orgs/guards.ts:34-38`, `modules/orgs/routes.ts:31-35` | `escalation.test.ts` → "chủ cuối cùng không tự rời hay tự hạ quyền được" (phần đồng thời **chưa có** bài thử) |
| 9 | Khoá quyền lạ bị từ chối | `modules/orgs/routes.ts:446-452`; bỏ qua khi tra: `http/middleware.ts:62-64` | `escalation.test.ts` → "vai trò tuỳ chỉnh có quyền lạ bị từ chối"; `shared/permissions.test.ts` → "khoá lạ không được coi là quyền" |
| 10 | Vai trò hệ thống không bị chiếm mã, không sửa được | `modules/orgs/routes.ts:349-351`, `391` | `escalation.test.ts` → "không lấy được mã vai trò hệ thống làm vai trò tuỳ chỉnh", "vai trò hệ thống không sửa được" |
| 11 | Nhân sự bị tạm khoá mất quyền ngay | `http/middleware.ts:54-56` (tra lại mỗi yêu cầu) | `escalation.test.ts` → "nhân sự bị tạm khoá mất quyền ngay ở yêu cầu kế tiếp" |
| 12 | Tài khoản bị khoá: thẻ đang cầm hết tác dụng ngay | `http/middleware.ts:24-27`, `modules/auth/service.ts:56-59` | `auth.test.ts` → "tài khoản bị khoá thì thẻ đang cầm cũng hết tác dụng ngay" |
| 13 | Mật khẩu ≥ 10 ký tự, băm bcrypt 12 vòng | `modules/auth/routes.ts:13`, `lib/password.ts:3-7` | `auth.test.ts` → "mật khẩu ngắn bị từ chối với lỗi rõ ràng" |
| 14 | Đăng nhập không lộ email nào đã đăng ký (cùng lời, cùng thời gian băm) | `lib/password.ts:13-14`, `modules/auth/routes.ts:56-60` | `auth.test.ts` → "sai mật khẩu và email không tồn tại trả cùng một lời" |
| 15 | Giới hạn tốc độ đăng nhập | `app.ts:31-37` | `auth.test.ts` → "quá số lần đăng nhập trong một phút → 429" |
| 16 | Refresh token xoay vòng; dùng lại thẻ cũ → thu hồi cả họ, ghi nhật ký | `modules/auth/service.ts:29-52` | `auth.test.ts` → "đổi thẻ: thẻ cũ hết dùng được, thẻ mới dùng được", "dùng lại thẻ cũ = bị đánh cắp → thu hồi cả họ thẻ, kể cả thẻ mới nhất" |
| 17 | Hai yêu cầu đổi cùng một thẻ đồng thời chỉ một cái thắng | `modules/auth/service.ts:60-67` | `auth.test.ts` → "hai yêu cầu đổi cùng một thẻ đồng thời: đúng một cái thành công" |
| 18 | Đăng xuất thu hồi phiên | `modules/auth/service.ts:77-84` | `auth.test.ts` → "đăng xuất thu hồi phiên" |
| 19 | Database chỉ giữ bản băm của refresh token | `lib/tokens.ts:26-34` | Không có bài thử riêng |
| 20 | Email luôn chữ thường (API + database) | `modules/auth/routes.ts:8-12`; migration `nen_mong:172` | `auth.test.ts` → "email trùng khác chữ hoa/thường bị từ chối"; `escalation.test.ts` → "email viết hoa bị database từ chối" |
| 21 | Database chặn gán vai trò khác tổ chức (khoá ngoại kép) | `prisma/schema.prisma:152-153` | `escalation.test.ts` → "không gán được vai trò của tổ chức khác, kể cả ghi thẳng vào database" |
| 22 | Nhật ký chỉ ghi thêm; mọi thay đổi đều ghi | trigger ở migration `nen_mong:179-186`; `lib/audit.ts:13-16` | `escalation.test.ts` → "nhật ký không sửa, không xoá được", "mọi thay đổi trên đều để lại nhật ký" |
| 23 | Không xoá dây chuyền | `prisma/schema.prisma:3` | `escalation.test.ts` → "không xoá được tổ chức còn dữ liệu (không có xoá dây chuyền)" |
| 24 | `/auth/me` không trả mật khẩu | `modules/auth/routes.ts:103-117` | `auth.test.ts` → "đăng nhập đúng rồi xem /me" |
| 25 | Vai trò mẫu của tổ chức cũ được bổ sung quyền mới | `scripts/sync-system-roles.ts` | `system-roles.test.ts` → "tổ chức tạo trước khi thêm quyền mới được bổ sung quyền; chạy lại không đổi gì" (in "khớp mẫu 9/9 vai trò") |
| 26 | Log che header đăng nhập, cookie, mật khẩu, thẻ | `lib/logger.ts:7-17` | Không có bài thử |
| 27 | Thiếu biến môi trường / khoá ký thẻ < 32 ký tự → không khởi động | `env.ts:4-24` | Không có bài thử |
| 28 | Header an toàn (helmet), CORS theo danh sách, thân ≤ 100KB | `app.ts:26-29` | Không có bài thử |
| 29 | Database từ chối trùng lịch → máy chủ nhận ra và trả 409, không để lọt 500 | `http/middleware.ts:87-88`, `105-117` | `exclusion-error.test.ts` → "BẮT: ghi qua Prisma create bị database từ chối → nhận ra được", "BẮT: ghi qua câu lệnh SQL thô bị từ chối → nhận ra được", "GIỮ: lỗi trùng khoá thường (P2002) không bị nhận nhầm là trùng lịch" |
| 30 | Lịch sử giá chỉ ghi thêm, các CHECK tiền của hợp đồng | migration `bang_gia_lich`, `hop_dong_nhan_vat` | **Chưa có bài thử tự động.** Ngày 18/10/2026 đã thử tay trên database thử: sai công thức tiền, sửa lịch sử giá đều bị database từ chối |

### 2. Cửa gác cách ly tổ chức (`apps/api/test/tenant-isolation.test.ts`)

> Mục này mô tả bản cửa gác **đã lưu trong kho** (commit `f7b0805`). Lúc viết (≈15:35 UTC ngày 18/10/2026), thợ khác đang viết lại cửa gác thành `test/gate.ts` + `tenant-isolation.test.ts` mới để phủ cả đường bảng giá và lịch; bản mới chưa lưu vào kho. Số dòng dẫn chứng bên dưới là của bản đã lưu. Điều phối cập nhật mục này sau khi bản mới được nghiệm thu.

**Nó làm gì.** Lấy **toàn bộ** đường API từ bảng đường của app (`tenant-isolation.test.ts:17-18`), nên đường mới thêm vào là tự vào diện kiểm. Dựng hai tổ chức A và B, thêm vào A một thành viên có vai trò rỗng (không quyền nào). Rồi gọi từng đường thuộc tổ chức A bằng bốn kiểu người:

| Kiểu người | Phải bị | Dòng in ra | Lần chạy 18/10/2026 15:18 UTC |
|---|---|---|---|
| Chủ tổ chức B (người ngoài) | 404 | `[cửa gác] người ngoài bị chặn: N/10 đường` | 10/10 |
| Thành viên A không có quyền | 403 | `[cửa gác] thiếu quyền bị chặn: N/10 đường` | 10/10 |
| Không có thẻ | 401 | `[cửa gác] chưa đăng nhập bị chặn: N/12 đường` (10 đường tổ chức + 2 đường cần đăng nhập) | 12/12 |
| Chủ tổ chức A (vế GIỮ) | không bị 401/403/404-tổ chức | `[cửa gác] chủ đi qua: N/10 đường` | 10/10 |

Thêm hai ca: mẫu số phải khác 0 (có đường để kiểm), và thẻ giả bị 401.

**Đã thử phá hai lần — cửa gác chuyển đỏ cả hai lần.**
Điều phối phá lần đầu (ghi ở `docs/SO-LOI-DA-DO.md`, mục 2). Thợ tài liệu làm lại ngày 18/10/2026 trên **bản sao** của kho trong thư mục nháp (không sửa kho), kết quả:

| Lần phá | Sửa gì trong bản sao | Kết quả in ra |
|---|---|---|
| 1. Bỏ kiểm quyền | `http/middleware.ts:66` đổi thành `if (false && !permissions.has(required))` | **thiếu quyền bị chặn 0/10**; các dòng khác giữ 10/10, 12/12, 10/10 → 1 ca đỏ |
| 2. Tra thành viên không theo tổ chức | `http/middleware.ts:44-45` đổi thành tìm tư cách thành viên chỉ theo người dùng (`findFirst({ where: { userId } })`) | **người ngoài bị chặn 0/10**; thiếu quyền cũng 0/10 → 2 ca đỏ |

Vì sao lần 2 kéo luôn dòng "thiếu quyền" về 0/10: ở ca trước, người của tổ chức B lọt cửa và gọi được cả đường "cho nhân sự rời tổ chức" của tổ chức A, nên thành viên thiếu quyền đã bị cho rời; đến ca sau người này nhận 404 thay vì 403. Đây đúng là thiệt hại sẽ xảy ra trên máy thật nếu lỗi này lọt: **studio khác xoá được nhân sự của mình.**

**Giới hạn của cửa gác (nó KHÔNG kiểm):**
- Chỉ kiểm cửa vào tổ chức qua `:orgId`. Trường hợp đứng trong tổ chức A nhưng đưa mã bản ghi của tổ chức B (ví dụ `membershipId` của B) thì do từng hàm xử lý tự lọc theo tổ chức (ví dụ `modules/orgs/routes.ts:247-250`). **Chưa có bài thử tự động** cho kiểu này.
- Gửi thân rỗng `{}`. Vế GIỮ chỉ chứng minh chủ **qua được cửa**, không chứng minh thao tác thành công (nhiều đường trả 400 vì thiếu dữ liệu).
- Ca GIỮ chạy cuối và gọi cả đường "cho rời"; đổi thứ tự các ca có thể làm kết quả sai.

### 3. Phát hiện khi đọc mã (cần quyết, chưa sửa)
| # | Phát hiện | Ở đâu | Hậu quả |
|---|---|---|---|
| 1 | Đăng ký báo "Email này đã được đăng ký", trong khi đăng nhập cố ý không lộ email | `modules/auth/routes.ts:26` | Kẻ xấu dò được email nào là khách của hệ thống (bị giới hạn 10 lần/phút/IP) |
| 2 | Thêm nhân sự bằng email: người được thêm **không cần đồng ý**; người có quyền mời dò được email nào đã đăng ký | `modules/orgs/routes.ts:198-201` | Một người có thể bị gắn vào tổ chức lạ; tổ chức đó thấy họ tên, email |
| 3 | Vi phạm CHECK (sai công thức tiền…) và trigger chỉ ghi thêm thành lỗi 500 (trùng khoá và trùng lịch đã được đổi sang 409) | `http/middleware.ts:85-93` | Không lộ dữ liệu, nhưng người dùng không biết vì sao bị từ chối; log đầy "lỗi không lường trước" |
| 4 | Đăng nhập, đăng nhập sai, đăng xuất **không** ghi nhật ký | `modules/auth/routes.ts:47-94` | Không truy được ai đăng nhập lúc nào khi có sự cố |
| 5 | Đếm giới hạn tốc độ lưu trong bộ nhớ máy chủ | `app.ts:31-37` | Chạy nhiều máy chủ hoặc khởi động lại thì bộ đếm tách/mất |
| 6 | Đổi refresh token gồm nhiều bước không chung một giao dịch | `modules/auth/service.ts:61-73` | Máy chủ sập giữa chừng thì người dùng phải đăng nhập lại (không lộ gì) |
| 7 | Khoá chống gửi trùng không bao giờ bị dọn | bảng `idempotency_keys` | Bảng lớn dần theo thời gian |

### 4. Những gì CHƯA có
| Chưa có | Khi nào cần |
|---|---|
| Refresh token trong cookie httpOnly (Secure, SameSite) + chống CSRF | **Trước khi** web quản trị dùng thật. Hiện thẻ gửi trong thân JSON, CORS `credentials: false` (`app.ts:28`) |
| RLS (luật lọc theo tổ chức đặt trong PostgreSQL) | Xem `docs/ARCHITECTURE.md`, quyết định 8 |
| Xác thực hai lớp (2FA) | Ít nhất cho chủ tài khoản, trước khi bán cho studio khác |
| Quên mật khẩu, đổi mật khẩu, xác minh email | Trước khi có người dùng ngoài nhóm thử |
| Xuất / xoá dữ liệu cá nhân theo yêu cầu khách | Cần người hiểu luật Việt Nam về bảo vệ dữ liệu cá nhân xác nhận phạm vi. Lưu ý: nhật ký chặn xoá ở database, phải thiết kế cách ẩn danh hoá |
| Quét bí mật trong bản đóng gói web | Khi có web (chưa có web) |
| Quét bí mật trong kho mã, quét thư viện có lỗ hổng (`pnpm audit`) | Chưa chạy lần nào |
| Thu hồi thẻ truy cập ngay khi đăng xuất | Hiện còn dùng được tối đa 15 phút sau đăng xuất |
| Bài thử ghi chéo tổ chức cho bảng giá, hợp đồng, lịch | Khi hai module đó xong |
| Kiểm thử xâm nhập độc lập | Trước khi bán |
| Sao lưu và diễn tập khôi phục | Trước khi có dữ liệu thật |
| Giám sát, cảnh báo khi có lỗi 500 hoặc phát hiện thẻ bị dùng lại | Khi lên máy thật |
| Giới hạn số tổ chức một người được tạo | Trước khi mở đăng ký công khai |
