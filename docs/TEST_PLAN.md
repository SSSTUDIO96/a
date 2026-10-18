# Kế hoạch kiểm thử — Makeup Pro

Ngày viết: 18/10/2026. Số ca đếm thật từ tệp bài thử. Kho đang có nhiều thợ viết song song, nên tài liệu tách hai mốc: **đã lưu vào kho** (commit `f7b0805`, 15:29 UTC) và **đang viết** (tệp chưa lưu, số ca còn đổi).

> Bài thử qua hết chỉ chứng minh những gì bài thử có kiểm. Không suy ra "an toàn" hay "xong" từ chuyện bài thử qua. Mục 5 liệt kê những gì chưa ai kiểm.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. Các tầng kiểm thử
| Tầng | Kiểm gì | Ví dụ | Tốc độ |
|---|---|---|---|
| 1. Hàm thuần | Một công thức, không cần database | Tính tiền, đổi trạng thái được không | Vài mili giây |
| 2. API + database thật | Gọi đường API như máy khách thật, database thật | Người ngoài gọi vào tổ chức mình → bị chặn | Vài giây |
| 3. Chốt chặn database | Ghi thẳng vào database, **bỏ qua** máy chủ, xem database có tự chặn không | Gán vai trò khác tổ chức → database từ chối | Vài giây |
| 4. Bản build chạy thật | Đóng gói, khởi động bản đóng gói, gọi thử | `/health` trả lời | Vài chục giây |
| 5. Đầu-cuối (E2E) | Đi trọn một luồng nghiệp vụ trên giao diện như người dùng thật | Lập hợp đồng → đặt lịch → hoàn thành | Vài phút |
| 6. Giao diện nhiều khổ màn hình | Chụp và so màn hình ở máy tính, máy tính bảng, điện thoại | Bảng giá không vỡ trên điện thoại | Vài phút |

### 2. Luật làm bài thử
| # | Luật | Vì sao |
|---|---|---|
| 1 | Mỗi chốt chặn có ca **BẮT** (kẻ xấu bị chặn) và ca **GIỮ** (người đúng vẫn qua) | Chặn tất cả mọi người cũng "qua" ca BẮT |
| 2 | Cửa gác in tử số/mẫu số, mẫu số lấy tự động từ danh sách thật | Thêm đường mới là tự vào diện kiểm |
| 3 | Cố ý phá mã để thấy bài thử đỏ ít nhất một lần | Bài thử chưa từng đỏ có thể đang mù |
| 4 | Database thử tách riêng, có chốt chặn tên | Chạy nhầm vào database thật là mất dữ liệu khách |
| 5 | Mỗi bài thử tự tạo dữ liệu mã ngẫu nhiên | Không phụ thuộc thứ tự, không cần xoá database |
| 6 | "Xong" gồm cả build và bật bản build lên | Bài thử chạy trên mã nguồn không chạm tới bước đóng gói (`docs/SO-LOI-DA-DO.md` lỗi 1) |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Lệnh chạy
Chạy ở thư mục gốc kho `/home/user/a`.

| Việc | Lệnh |
|---|---|
| Cài thư viện | `pnpm install` |
| Chạy mọi bài thử của mọi gói | `pnpm test` |
| Chỉ máy chủ | `pnpm --filter @makeup/api test` |
| Chỉ mã dùng chung | `pnpm --filter @makeup/shared test` |
| Một tệp | `pnpm --filter @makeup/api exec vitest run test/tenant-isolation.test.ts` |
| Kiểm kiểu TypeScript | `pnpm typecheck` |
| Đóng gói | `pnpm build` |

### 2. Database thử
| Mục | Cách làm | Dẫn chứng |
|---|---|---|
| Ở đâu | PostgreSQL trong máy, database `makeup_test`. Đổi bằng biến `TEST_DATABASE_URL` | `apps/api/vitest.config.ts:3` |
| Chốt chặn tên | Địa chỉ database **phải chứa** chữ `makeup_test`, không thì từ chối chạy | `apps/api/test/global-setup.ts:6-9` |
| Chuẩn bị | Chỉ chạy `prisma migrate deploy` (áp migration còn thiếu), **không xoá database** | `global-setup.ts:10-13` |
| Vì sao không xoá | Prisma chặn AI chạy lệnh xoá trắng `migrate reset`; không lách bằng lời đồng ý giả. Mỗi bài thử tự tạo tài khoản, tổ chức mã ngẫu nhiên nên dữ liệu cũ không làm sai kết quả | `docs/SO-LOI-DA-DO.md` lỗi 4 |
| Cấu hình chạy | Các tệp chạy lần lượt (không song song); khoá ký thẻ riêng cho thử; giới hạn tốc độ nâng lên 1000/phút; log tắt | `vitest.config.ts:8-18` |
| Điểm yếu | Chốt chặn tên chỉ tìm chữ `makeup_test` ở **bất kỳ đâu** trong địa chỉ (kể cả tên đăng nhập, mật khẩu), không kiểm riêng tên database | `global-setup.ts:7` |

### 3. Ca đang có — đã lưu vào kho (commit `f7b0805`)
Tổng: **48 ca** = 40 ca máy chủ (7 tệp) + 8 ca mã dùng chung (2 tệp).

| Tệp | Tầng | Số ca | Các ca |
|---|---|---|---|
| `apps/api/test/auth.test.ts` | 2 | 10 | email trùng khác chữ hoa/thường bị từ chối · mật khẩu ngắn bị từ chối với lỗi rõ ràng · sai mật khẩu và email không tồn tại trả cùng một lời · đăng nhập đúng rồi xem /me · đổi thẻ: thẻ cũ hết dùng được, thẻ mới dùng được · dùng lại thẻ cũ = bị đánh cắp → thu hồi cả họ thẻ · hai yêu cầu đổi cùng một thẻ đồng thời: đúng một cái thành công · đăng xuất thu hồi phiên · tài khoản bị khoá thì thẻ đang cầm cũng hết tác dụng ngay · quá số lần đăng nhập trong một phút → 429 |
| `apps/api/test/escalation.test.ts` | 2 + 3 | 15 | 11 ca chống tự nâng quyền (quản lý không tự nâng mình; không trao vai trò quản trị; vế GIỮ đổi vai trò trong phạm vi; quản trị không đụng chủ; quản trị không trao vai trò chủ; chủ cuối cùng không rời/hạ quyền được; quyền lạ bị từ chối; không chiếm mã vai trò hệ thống; vai trò hệ thống không sửa được; tạm khoá mất quyền ngay; mọi thay đổi để lại nhật ký) + 4 ca chốt chặn database (không gán vai trò khác tổ chức; nhật ký không sửa/xoá được; email viết hoa bị từ chối; không xoá được tổ chức còn dữ liệu) |
| `apps/api/test/tenant-isolation.test.ts` | 2 | 6 | Cửa gác cách ly tổ chức: mẫu số khác 0 · người ngoài → 404 · thiếu quyền → 403 · không thẻ → 401 · thẻ giả → 401 · chủ đi qua (vế GIỮ). Chi tiết ở `docs/SECURITY.md` mục 2 |
| `apps/api/test/exclusion-error.test.ts` | 3 | 3 | Trùng lịch qua Prisma được nhận ra · trùng lịch qua SQL thô được nhận ra · lỗi trùng khoá thường không bị nhận nhầm (vế GIỮ) |
| `apps/api/test/system-roles.test.ts` | 2 + 3 | 2 | Tổ chức cũ được bổ sung quyền mới, chạy lại không đổi gì (in "khớp mẫu N/9") · bổ sung cách tính phí di chuyển và bộ nhân vật mẫu, không thêm lại khi đã có |
| `apps/api/test/guards.test.ts` | 1 | 3 | Khai đường thuộc tổ chức thiếu quyền / sai địa chỉ / đường công khai mà khai quyền → ném lỗi |
| `apps/api/test/openapi.test.ts` | 2 | 1 | Mọi đường đều có trong tài liệu OpenAPI kèm đúng quyền (in "N/N đường") |
| `packages/shared/src/money.test.ts` | 1 | 5 | Nhận số nguyên đồng · từ chối số lẻ · từ chối chuỗi · BigInt vượt ngưỡng ném lỗi · định dạng kiểu Việt Nam |
| `packages/shared/src/permissions.test.ts` | 1 | 3 | Mọi quyền trong vai trò mẫu có trong danh mục · khoá lạ không phải quyền · chủ giữ đủ quyền |

Lần chạy trên máy đám mây ngày 18/10/2026 lúc 15:18 UTC (khi đó kho có 36 ca máy chủ): 36/36 và 8/8 qua; cửa gác in 10/10, 10/10, 12/12, 10/10; OpenAPI 16/16.

### 4. Ca đang viết — chưa lưu vào kho (đếm lúc ≈15:35 UTC, còn đổi)
| Tệp | Số ca (đếm chữ `it(`) | Ai viết | Ghi chú |
|---|---|---|---|
| `apps/api/test/catalog.test.ts` | 31 | Thợ bảng giá | — |
| `apps/api/test/schedule.test.ts` | 28 | Thợ lịch | Lần chạy lúc viết: 28/28 qua |
| `apps/api/test/tenant-isolation.test.ts` + `test/gate.ts` | (sinh ca theo từng thước đo) | Đang viết lại | Cửa gác mới phủ cả đường bảng giá/lịch. Lần chạy lúc viết **đỏ 4 ca** vì chưa có dữ liệu mẫu cho tham số `:categoryId` — cửa gác dừng lại thay vì bỏ qua đường đó. OpenAPI lúc đó in 48/48 đường |
| `packages/shared/src/contract.test.ts` | 31 | Thợ bảng giá/hợp đồng | Tính tiền hợp đồng, phí di chuyển |
| `packages/shared/src/schedule.test.ts` | 9 | Thợ lịch | Chuyển trạng thái, khoảng bận |

Điều phối cập nhật mục 3–4 sau khi các tệp này được nghiệm thu và lưu vào kho.

### 5. Ca còn thiếu
**Theo bản yêu cầu:**
| Thiếu | Tầng | Ghi chú |
|---|---|---|
| E2E luồng makeup: tạo bảng giá → lập hợp đồng (gói + dịch vụ phụ + phí di chuyển) → sinh lịch → phân thợ → xác nhận → đang làm → hoàn thành | 5 | Chưa có giao diện |
| E2E luồng đào tạo: khoá học → buổi học → học viên | 5 | Module đào tạo chưa bắt đầu |
| Giao diện 3 khổ màn hình: máy tính 1440×900, máy tính bảng 1024×768, điện thoại 390×844 | 6 | R&D đã chụp ảnh bản mẫu ở 3 khổ này (`docs/rnd/anh/`), nhưng chưa có bài thử tự động trên giao diện thật |

**Phát hiện khi đọc mã (đề xuất thêm):**
| Thiếu | Tầng | Vì sao |
|---|---|---|
| Ghi chéo tổ chức vào bảng giá, hợp đồng, lịch bằng cách ghi thẳng database | 3 | Hiện chỉ chứng minh cho `membership_roles` |
| Đứng trong tổ chức A, đưa mã bản ghi của tổ chức B qua tham số/thân | 2 | Cửa gác chỉ kiểm `:orgId` |
| Lịch sử giá không sửa/xoá được; các CHECK tiền của hợp đồng | 3 | Mới thử tay ngày 18/10/2026 |
| Hai chủ đồng thời hạ quyền nhau → tổ chức vẫn còn chủ | 2 | Khoá dòng tổ chức đã có (`modules/orgs/routes.ts:31-35`) nhưng chưa thử đồng thời |
| Chống gửi trùng (`Idempotency-Key`): gửi lại, gửi đồng thời, khác nội dung | 2 | Chưa đường nào dùng lúc lưu kho; module lịch sẽ dùng |
| Build + bật bản build + gọi `/health` tự động | 4 | Hiện làm tay |
| `prisma migrate deploy` trên database giống Supabase (extension ở schema riêng, qua pooler) | 4 | Chưa có Supabase |
| Log không chứa mật khẩu/thẻ; thiếu biến môi trường thì không khởi động | 1–2 | Chưa có bài thử |
| Sao lưu và khôi phục | — | Chưa có môi trường thật |
