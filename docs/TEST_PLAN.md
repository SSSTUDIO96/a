# Kế hoạch kiểm thử — Makeup Pro

Cập nhật: 18/10/2026. **Đã đối chiếu với commit `634d6a3`** (17:00 UTC; mã máy chủ và web giống hệt `bc9633a`, hai commit sau chỉ thêm sổ ghi). Số bài lấy từ lần chạy thật, ghi rõ giờ.

> Bài thử qua hết chỉ chứng minh những gì bài thử có kiểm. Không suy ra "an toàn" hay "xong" từ chuyện bài thử qua. Mục 5 liệt kê những gì chưa ai kiểm.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. Các tầng kiểm thử
| Tầng | Kiểm gì | Ví dụ |
|---|---|---|
| 1. Hàm thuần | Một công thức, không cần database | Tính tiền hợp đồng, phí di chuyển, chuyển trạng thái |
| 2. API + database thật | Gọi đường API như máy khách thật | Lập hợp đồng nhiều dòng, xác nhận thì tự lên lịch |
| 3. Chốt chặn database | Ghi thẳng database, **bỏ qua** máy chủ, xem database có tự chặn không | Sửa dòng hợp đồng đã xác nhận → bị chặn |
| 4. Cửa gác tự động + đột biến | Quét **mọi** đường; cài lỗi để chứng minh cửa gác không mù | Người ngoài 60/60 bị chặn |
| 5. Khớp hai đầu | Kiểu dữ liệu giao diện khớp đúng dữ liệu máy chủ thật trả về | Web đọc đủ trường của hợp đồng |
| 6. Giao diện (component) | Từng ô nhập, hộp thoại, khung điều hướng trong trình duyệt giả lập | Ô tiền bỏ "₫" khi vào ô |
| 7. Bản build | Đóng gói, quét bí mật, bật bản build | Bản web không chứa `postgresql://` |
| 8. Đầu-cuối (E2E) | Đi trọn một luồng trên trình duyệt thật | Đăng ký → tạo tổ chức → tải lại → đăng xuất |
| 9. Nhiều khổ màn hình | Chụp và so ở máy tính, máy tính bảng, điện thoại | Không tràn ngang ở 390px |

### 2. Luật làm bài thử
| # | Luật | Vì sao |
|---|---|---|
| 1 | Mỗi chốt chặn có ca **BẮT** và ca **GIỮ** | Chặn tất cả mọi người cũng "qua" ca BẮT |
| 2 | Cửa gác in tử số/mẫu số, mẫu số lấy tự động | Thêm đường mới là tự vào diện kiểm |
| 3 | Cài lỗi để thấy bài thử đỏ | Bài thử chưa từng đỏ có thể đang mù |
| 4 | Database thử tách riêng, có chốt tên | Chạy nhầm vào database thật là mất dữ liệu |
| 5 | Mỗi bài thử tự tạo dữ liệu mã ngẫu nhiên | Không phụ thuộc thứ tự, không cần xoá database |
| 6 | Không lưu bản khi bài thử đang đỏ mà không ghi rõ | `docs/SO-LOI-DA-DO.md` mục 13 |
| 7 | Viết migration trọn một lần rồi mới đặt vào thư mục | Thợ khác có thể áp bản dở (`docs/SO-LOI-DA-DO.md` mục 14) |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### 1. Lệnh chạy (ở gốc kho)
| Việc | Lệnh |
|---|---|
| Cài thư viện (tự `prisma generate`) | `pnpm install` |
| **Mọi gói: kiểm kiểu + bài thử** | `pnpm test` (dừng ở gói đỏ đầu tiên; thêm `pnpm -r --no-bail test` để chạy hết) |
| Chỉ máy chủ | `pnpm --filter @makeup/api test` (= `tsc --noEmit && vitest run`) |
| Chỉ web | `pnpm --filter @makeup/web test` |
| Chỉ mã dùng chung | `pnpm --filter @makeup/shared test` |
| E2E web (không nằm trong `pnpm test`) | `pnpm --filter @makeup/web e2e` |
| Đóng gói (có cửa gác bí mật cho web) | `pnpm build` |

### 2. Database thử
| Database | Ai dùng | Chuẩn bị | Dẫn chứng |
|---|---|---|---|
| `makeup_test` | Bài thử máy chủ | **Tự động**: trước khi chạy, chỉ `prisma migrate deploy`, không xoá; từ chối nếu địa chỉ không chứa `makeup_test` | `apps/api/test/global-setup.ts`, `apps/api/vitest.config.ts` |
| `makeup_test_web` | Bài khớp hai đầu và E2E của web | **Làm tay**: `createdb`, `create extension btree_gist`, `migrate deploy` (`apps/web/README.md`) | `apps/web/src/api/khop-hop-dong.test.ts:55` |

Vì sao không xoá database: Prisma chặn AI chạy `migrate reset`; không lách bằng lời đồng ý giả (`docs/SO-LOI-DA-DO.md` mục 4). Điểm yếu: chốt tên chỉ tìm chữ `makeup_test` ở bất kỳ đâu trong địa chỉ. `makeup_test_web` không tự áp migration: lúc ≈16:45 database này thiếu migration `20261018190000` nên 5 bài khớp hai đầu báo lỗi 500.

Dựng lại môi trường thử trên máy mới: `docs/BAN-GIAO-PHIEN.md`, mục "Cách dựng lại môi trường".

### 3. Số bài — lần chạy trên bản sao đúng commit `bc9633a` (16:54 UTC, `pnpm -r --no-bail test`)
| Gói | Tệp | Bài | Qua | Đỏ | Bỏ qua |
|---|---|---|---|---|---|
| `packages/shared` | 5 | 78 | 78 | 0 | 0 |
| `apps/web` | 15 | 160 | 158 | 2 | 0 |
| `apps/api` | 17 | 243 | 226 | 7 | 10 |
| **Tổng** | 37 | **481** | **462** | **9** | **10** |

**Vì sao đỏ:**
| Đỏ | Lý do |
|---|---|
| `apps/api/test/tenant-isolation.test.ts` — cả tệp không chạy (10 bài bỏ qua) | Ba đường tệp đã lưu vào kho mà cửa gác chưa có mẫu cho `:fileId`; cửa gác dừng thay vì bỏ qua |
| `apps/api/test/gate-mutants.test.ts` — 7/8 đỏ | Cùng lý do trên; đột biến 2 (kiểm lúc lắp ráp) vẫn qua |
| `apps/web/src/api/khop-hop-dong.test.ts` — 2/8 đỏ | Máy chủ trả mỗi dòng hợp đồng 31 trường, `apps/web/src/api/types.ts` mới khai 28: kiểu dữ liệu web chậm hơn máy chủ |

**Lần chạy trên bản đang sửa** (17:00 UTC, commit `3d3e544` + việc chưa lưu): shared 78/78; web 158/160 (cùng 2 bài trên); máy chủ 22 tệp, 315 bài: 296 qua, 8 đỏ, 11 bỏ qua (cửa gác vẫn thiếu mẫu `:fileId`; thêm 1 bài `profile.test.ts` "giá hẹn tương lai…" đỏ). Có thêm 5 tệp bài thử đang viết: `files`, `payments`, `platform`, `profile`, `quota`.

**Sau mốc đối chiếu:** commit `125e587` (17:03 UTC) chỉ đổi bài thử: thêm `platform.test.ts` (10 bài), `quota.test.ts` (13 bài), phép cửa gác thứ 10 `platform` và đột biến 9. Thợ tài liệu chưa chạy lại sau commit này.

**Lần cửa gác chạy đủ gần nhất** (≈16:45 UTC, trước khi có đường tệp): 9 phép, `crossRef` 45/49 đỏ, các phép khác đủ; 8/8 đột biến bị bắt. Chi tiết: `docs/SECURITY.md` mục 2.

### 4. Ca đang có ở `bc9633a`, theo tệp
**Máy chủ** (`apps/api/test/`):
| Tệp | Bài | Kiểm gì |
|---|---|---|
| `auth.test.ts` | 10 | Đăng ký, đăng nhập, xoay thẻ, phát hiện dùng lại, đồng thời, đăng xuất, khoá tài khoản, giới hạn tốc độ |
| `auth-cookie.test.ts` | 3 | Cookie httpOnly cho web, header `X-Client: web`, app vẫn nhận thẻ trong thân |
| `escalation.test.ts` | 15 | Chống tự nâng quyền (11) + chốt chặn database (4) |
| `nghiem-thu-moc2.test.ts` | 13 | Hồi quy biên bản mốc 2: luật thứ bậc, tra quyền lại khi đua 15 lượt, L6, L9, L10, L11, chủ bị khoá không tính |
| `guards.test.ts` | 4 | Khai đường sai thì không khởi động |
| `catalog.test.ts` | 37 | Danh mục, dịch vụ, phiên bản giá, gói, nhân vật, studio, phí di chuyển, bậc km, quyền, cách ly |
| `contracts.test.ts` | 55 | Hợp đồng nhiều dòng, bán kính miễn phí, luật kiểm, vòng đời, huỷ kéo theo lịch, thợ phụ trách + cảnh báo, danh sách, chống gửi trùng, cách ly, quyền, chốt chặn database |
| `schedule.test.ts` | 35 | Khách, tạo/sửa lịch, chặn trùng, bảng chuyển trạng thái, quyền xem, cách ly, lịch gắn hợp đồng, N2, G5, G1 |
| `staff.test.ts` | 34 | Bậc lương, hồ sơ thợ, tiền công, cách ly, T2, G5, mức rảnh |
| `db-guards.test.ts` | 8 | Khoảng bận do database tính, lịch sử chỉ ghi thêm, khoá dòng và tiền hợp đồng (N3), CHECK trả 400 |
| `exclusion-error.test.ts` | 3 | Trùng lịch của database đổi thành 409 |
| `idempotency.test.ts` | 3 | T1, gửi lại, khoá kẹt quá 2 phút |
| `validation-messages.test.ts` | 2 | Đường dẫn lỗi lồng, lời tiếng Việt |
| `system-roles.test.ts` | 2 | Đồng bộ vai trò mẫu, bổ sung dữ liệu mẫu cho tổ chức cũ |
| `openapi.test.ts` | 1 | Mọi đường có trong tài liệu kèm đúng quyền (77/77) |
| `tenant-isolation.test.ts` | 10 | Cửa gác 9 phép (đang không chạy được, xem trên) |
| `gate-mutants.test.ts` | 8 | 8 đột biến |

**Mã dùng chung** (`packages/shared/src/`): `contract.test.ts` 38 (tiền hợp đồng, phí di chuyển, làm tròn), `payments.test.ts` 23 (thu tiền), `schedule.test.ts` 9, `money.test.ts` 5, `permissions.test.ts` 3.

**Web** (`apps/web/`): `src/api/duong-api.test.ts` 53 (mỗi hàm gọi đúng đường của máy chủ), `src/ui/format.test.ts` 19, `src/api/client.test.ts` 16 (thẻ trong bộ nhớ, refresh một lần cho nhiều yêu cầu), `src/ui/MoneyInput.test.tsx` 12, `src/layout/AppShell.test.tsx` 11 (ẩn mục theo quyền, 3 khổ), `src/api/khop-hop-dong.test.ts` 8, `scripts/check-bundle-secrets.test.ts` 8, `src/api/useQuote.test.ts` 7, `src/ui/UnitInput.test.tsx` 7, `src/ui/Dialog.test.tsx` 6, `src/api/errors.test.ts` 4, `src/ui/Tooltip.test.tsx` 3, `src/features/auth/validate.test.ts` 3, `src/api/auth.test.ts` 2, `src/api/types-shared.test.ts` 1. E2E: `e2e/luong-phien.spec.ts` (1 luồng).

### 5. Ca còn thiếu
**Theo bản yêu cầu:**
| Thiếu | Tầng | Ghi chú |
|---|---|---|
| E2E luồng makeup: bảng giá → lập hợp đồng (gói + dịch vụ phụ + phí di chuyển + thợ) → xác nhận → lịch → hoàn thành → thu tiền | 8 | Chưa có màn Bảng giá, Hợp đồng, Lịch (gói W4–W6) |
| E2E luồng đào tạo | 8 | Module đào tạo chưa có |
| Giao diện 3 khổ (1440, 1024, 390) cho mọi màn, không tràn ngang, số tiền khớp `quote` | 9 | Gói W7, chưa bắt đầu. Khung W3 đã có ảnh 3 khổ (`apps/web/e2e/anh/`) |

**Phát hiện khi đọc mã:**
| Thiếu | Vì sao |
|---|---|
| Mẫu `:fileId` cho cửa gác; mẫu tham chiếu chéo cho `staff[].membershipId` của hợp đồng | Cửa gác đang không chạy / còn 4 trường chưa phủ |
| Cửa gác cho đường `/public/...` | Phép `platform` đã thêm ở `125e587`; đường công khai chưa có phép riêng |
| Bài thử quản trị nền tảng, tệp, thu tiền, hồ sơ thương hiệu, hạn mức gói lưu vào kho | Đang viết, chưa lưu |
| `makeup_test_web` tự áp migration trước khi chạy | Đang làm tay, đã lệch một lần |
| Build + bật bản build + gọi `/health` tự động | Đang làm tay |
| `migrate deploy` trên database giống Supabase (extension ở schema riêng, qua pooler) | Chưa có Supabase |
| Log không chứa mật khẩu/thẻ; thiếu biến môi trường thì không khởi động; thiếu cấu hình kho tệp | Chưa có bài thử |
| Sao lưu và khôi phục | Chưa có môi trường thật |
