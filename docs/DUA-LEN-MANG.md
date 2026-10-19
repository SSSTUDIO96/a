# Đưa Makeup Pro lên mạng — việc anh Chiến làm, việc em làm

Cập nhật: 19/10/2026. Người đọc: anh Chiến (chủ studio). Phần kỹ thuật chi tiết nằm ở `docs/DEPLOYMENT.md`.

Ba dịch vụ dùng cho Makeup Pro. Cả ba đều phải là **tài khoản hoặc dự án MỚI, riêng cho Makeup Pro**:

| Dịch vụ | Ví như | Giữ gì |
|---|---|---|
| **Supabase** | Kho sổ sách + kho ảnh thuê ngoài | Database PostgreSQL (mọi dữ liệu) và kho ảnh |
| **Railway** | Thuê người quản lý ngồi trực 24/24 | Máy chủ API |
| **Vercel** | Thuê mặt tiền cửa hàng | Trang web khách và nhân viên mở trong trình duyệt |

> **CẤM đụng:** "App Studio Pro (ssaas)", dự án Supabase đang chạy và dự án Railway đang chạy của anh. Em sẽ không mở, không sửa, không đọc chúng. Nếu anh dùng chung một tài khoản đăng nhập cho cả hai, xem mục "Tách riêng" ở dưới.

Nhãn trong tài liệu:
- **[Theo trang chính thức — chưa kiểm]**: em không mở được trang đó từ máy làm việc ngày 19/10/2026 (mạng của máy chặn `supabase.com`, `railway.com`, `vercel.com`). Tên nút, tên menu có thể khác; anh làm theo trang thật.
- **[Đã chạy trên máy thử]**: em đã chạy thật trên máy Linux, chưa trên dịch vụ thật.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### Luật giữ bí mật khi nhờ người khác đưa lên mạng
| # | Luật | Vì sao |
|---|---|---|
| 1 | **Không dán mật khẩu, khoá, chuỗi kết nối database vào bất kỳ cuộc trò chuyện nào** (chat với em, Zalo, Messenger, email) | Lịch sử chat được lưu, có thể bị đọc lại, chép đi. Ai có chuỗi kết nối database là đọc và xoá được toàn bộ dữ liệu khách |
| 2 | Cách tốt nhất: **mời người làm vào dự án** với quyền vừa đủ | Người đó tự đọc giá trị trong trang quản trị của dịch vụ; anh rút quyền lúc nào cũng được, không phải đổi mật khẩu |
| 3 | Nếu dịch vụ không cho mời thành viên: anh tạo **mã truy cập (token)** rồi tự dán vào ô bí mật của môi trường làm việc của em (mục "Gửi giá trị cho em") — không qua chat | Mã nằm trong kho bí mật, không hiện trong lịch sử trò chuyện |
| 4 | Mỗi dịch vụ một mật khẩu riêng, bật **xác thực hai lớp (2FA)** | Lộ một chỗ không kéo theo chỗ khác |
| 5 | Xong việc, **rút quyền / xoá mã truy cập** của người làm | Không để cửa mở |
| 6 | Không chụp màn hình trang có khoá bí mật để gửi | Ảnh cũng là chat |

### Tách riêng với hệ thống đang chạy
| Cách | Mức an toàn | Ghi chú |
|---|---|---|
| Mỗi dịch vụ một **tài khoản mới**, đăng ký bằng email mới (ví dụ một hộp thư Gmail mới chỉ cho Makeup Pro) | Cao nhất | Người được mời vào tài khoản mới không thấy gì của App Studio Pro |
| Cùng tài khoản cũ, **tổ chức/nhóm mới** (Supabase: Organization; Railway, Vercel: Workspace/Team) rồi mời em vào **chỉ tổ chức mới** | Khá | Phải chắc là mời vào đúng tổ chức mới. **[Theo trang chính thức — chưa kiểm]** gói miễn phí có cho mời thành viên không |
| Dùng chung dự án cũ | **Không làm** | Anh đã quyết: dự án mới, riêng |

Em khuyên **cách 1**.

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### A. Việc anh tự làm (em không làm thay được — cần tài khoản, thẻ thanh toán, xác minh của anh)

Làm theo thứ tự. Mỗi dòng ghi "xong khi" để anh biết đã đủ chưa.

#### A1. Chuẩn bị
| # | Việc | Xong khi |
|---|---|---|
| 1 | Tạo một email mới chỉ dùng cho Makeup Pro (khuyên dùng) | Đăng nhập được hộp thư mới |
| 2 | Chuẩn bị trình quản lý mật khẩu (ví dụ cái có sẵn trong Chrome/Edge, hoặc Bitwarden) để lưu mật khẩu ba dịch vụ | Lưu được một mật khẩu thử |

#### A2. Supabase **[Theo trang chính thức — chưa kiểm]**: https://supabase.com/dashboard
| # | Việc | Xong khi |
|---|---|---|
| 1 | Đăng ký tài khoản bằng email Makeup Pro. Bật 2FA | Vào được trang quản trị |
| 2 | Tạo **Organization** mới, tên ví dụ `Makeup Pro` | Thấy tổ chức mới, trống |
| 3 | Trong tổ chức đó, tạo **Project** mới, tên `makeup-pro`. **Region** chọn gần Việt Nam nhất có trong danh sách (ví dụ Singapore). **Database password**: bấm nút tạo mật khẩu ngẫu nhiên, lưu vào trình quản lý mật khẩu, **không gửi cho ai** | Dự án hiện "healthy"/sẵn sàng |
| 4 | Mời em: Organization → Team/Members → Invite, quyền **Developer** (đủ để làm database, kho ảnh; không xoá được tổ chức). Email mời: **anh hỏi em email trước khi mời** | Em xác nhận đã vào được |
| 5 | Nếu gói hiện tại không cho mời thành viên: tạo **Access Token** (Account → Access Tokens), đặt tên `cho-em-trien-khai`, rồi làm mục C | Token nằm trong ô bí mật của môi trường em, không ở chat |

Em **không** cần anh tự bật `btree_gist`, tạo bucket hay lấy chuỗi kết nối: em làm ở phần B khi đã có quyền.

#### A3. Railway **[Theo trang chính thức — chưa kiểm]**: https://railway.com
| # | Việc | Xong khi |
|---|---|---|
| 1 | Đăng ký bằng email Makeup Pro (Railway thường cho đăng nhập bằng GitHub; nếu dùng GitHub, dùng tài khoản GitHub có quyền đọc kho `SSSTUDIO96/a`) | Vào được trang quản trị |
| 2 | Chọn gói. Máy chủ API phải chạy liên tục nên cần gói trả phí; xem giá ở mục D | Đã nhập thẻ và chọn gói |
| 3 | Tạo **Project** mới, tên `makeup-pro`. **Chưa cần** tạo service — em làm | Thấy dự án trống |
| 4 | Mời em vào dự án (Project → Settings → Members) nếu gói cho phép. Nếu không: tạo **Project Token** cho riêng dự án `makeup-pro` (Project → Settings → Tokens), rồi làm mục C. **Không** tạo token cấp tài khoản (token đó mở được cả dự án cũ của anh) | Em xác nhận đã vào được dự án `makeup-pro` và **chỉ** dự án đó |
| 5 | Cho Railway quyền đọc kho GitHub `SSSTUDIO96/a` (Railway sẽ hỏi khi tạo service từ GitHub; anh bấm cho phép) | Railway thấy kho |

#### A4. Vercel **[Theo trang chính thức — chưa kiểm]**: https://vercel.com
| # | Việc | Xong khi |
|---|---|---|
| 1 | Đăng ký bằng email Makeup Pro (hoặc GitHub như trên) | Vào được trang quản trị |
| 2 | Chọn gói. **Đọc điều khoản gói miễn phí (Hobby)**: theo hiểu biết của em gói này chỉ cho dùng cá nhân, không thương mại — Makeup Pro là phần mềm bán cho studio nên có thể phải dùng gói trả phí. **Em chưa kiểm được trang điều khoản**, anh xem ở mục D | Đã chọn gói |
| 3 | Cho Vercel quyền đọc kho GitHub `SSSTUDIO96/a` | Vercel thấy kho |
| 4 | Mời em vào nhóm (Team → Members) nếu gói cho phép. Nếu không: tạo **Token** (Account Settings → Tokens), phạm vi chỉ nhóm Makeup Pro, có hạn (ví dụ 30 ngày), rồi làm mục C | Em xác nhận đã vào được |

#### A5. Tên miền (làm sau, không bắt buộc cho lần đầu)
Lần đầu dùng địa chỉ có sẵn của Vercel (dạng `makeup-pro-….vercel.app`). Khi muốn tên riêng (ví dụ `app.<tên studio>.vn`): anh mua tên miền ở nhà đăng ký anh tin, rồi báo em để em chỉ cần thêm bản ghi DNS nào. Chưa kiểm giá tên miền.

### B. Những giá trị cần đến, và ai lấy

| Giá trị | Dùng cho | Ai lấy | Gửi thế nào |
|---|---|---|---|
| Email để mời em | A2–A4 | Em báo anh | Chat bình thường được (không phải bí mật) |
| Tên tổ chức/dự án Supabase, Railway, Vercel | Để em vào đúng chỗ | Anh | Chat bình thường được |
| Mật khẩu database Supabase | `DATABASE_URL`, `DIRECT_URL` | **Em tự đọc** trong Supabase khi đã là thành viên. Nếu em không là thành viên được: anh đặt lại mật khẩu database trong Supabase **sau khi em xong**, để mật khẩu em từng thấy hết tác dụng | **Không qua chat.** Không gửi được thì dùng mục C |
| Khoá S3 của kho ảnh Supabase | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Em tạo trong Supabase → Storage → S3 | Em dán thẳng vào Railway, không đi qua chat |
| `JWT_ACCESS_SECRET` (khoá ký đăng nhập) | Railway | Em tạo ngẫu nhiên 64 ký tự | Em dán thẳng vào Railway. Không ai cần biết giá trị này |
| Địa chỉ Railway, địa chỉ Vercel | `API_ORIGIN`, `WEB_APP_URL` | Em đọc sau khi tạo | Không phải bí mật |
| Token Supabase / Railway / Vercel (chỉ khi không mời thành viên được) | Để em gọi dịch vụ | Anh tạo | Mục C |

### C. Gửi giá trị bí mật cho em (chỉ khi không mời thành viên được)

Em làm việc trong một "môi trường đám mây" của Claude Code. Môi trường có ô **bí mật** riêng; giá trị để ở đó em dùng được mà không hiện trong cuộc trò chuyện.

1. Ở cửa sổ phiên làm việc với em, bấm menu **môi trường đám mây** trên thanh tiêu đề → **Edit**.
2. Tìm mục **Network secrets** (bản ứng dụng cũ ghi **API credentials**). Nếu không có mục đó: thêm thành **biến môi trường** (environment variable).
3. Đặt đúng tên em sẽ đọc:

| Tên | Giá trị |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token Supabase (A2 bước 5) |
| `RAILWAY_TOKEN` | Project Token của dự án `makeup-pro` (A3 bước 4) |
| `VERCEL_TOKEN` | Token Vercel (A4 bước 4) |

4. Cùng trang đó, mục **Network access**: thêm các tên miền `supabase.com`, `api.supabase.com`, `railway.com`, `backboard.railway.com`, `vercel.com`, `api.vercel.com` vào danh sách được phép (để giữ ô "Allow package managers"). Ngày 19/10/2026 máy của em bị chặn cả ba trang này. Tên miền API chính xác em sẽ báo lại khi kiểm được — **chưa kiểm**.
5. Mở **phiên mới** với em (phiên đang mở không thấy giá trị mới).
6. Nhắn em: "đã đặt token". **Không** dán token vào tin nhắn.

Hướng dẫn chính thức của bước 1–4: https://code.claude.com/docs/en/cloud-environments#network-access

### D. Chi phí ước tính

**Chưa kiểm được giá.** Ngày 19/10/2026 máy của em không mở được trang giá của cả ba dịch vụ (mạng chặn). Em không ghi số nào để tránh sai. Anh xem trực tiếp:

| Dịch vụ | Trang giá chính thức | Điều cần xem |
|---|---|---|
| Supabase | https://supabase.com/pricing | Gói miễn phí có **tạm dừng dự án khi không ai dùng** không (không hợp cho máy thật); dung lượng database, kho ảnh; **sao lưu tự động giữ mấy ngày**; giá gói trả phí theo tháng và tiền máy (compute) mỗi dự án |
| Railway | https://railway.com/pricing | Giá gói theo tháng, phần dùng đã gồm trong gói, giá theo RAM/CPU/mạng ra; máy chủ API của Makeup Pro chạy 1 bản, nhỏ |
| Vercel | https://vercel.com/pricing | **Điều khoản gói Hobby có cho dùng thương mại không**; giá gói Pro theo người/tháng |

Khi anh cho mở mạng (mục C bước 4), em sẽ đọc lại ba trang này và ghi số kèm ngày đọc vào đây.

### E. Em làm gì sau khi có quyền

Thứ tự theo `docs/DEPLOYMENT.md` mục 2. Mỗi bước em ghi lại kết quả thật vào `docs/DEPLOYMENT.md` (cột "Đã thử").

| # | Việc | Ở đâu |
|---|---|---|
| 1 | Kiểm em chỉ thấy dự án Makeup Pro, không thấy App Studio Pro. Thấy dự án cũ → dừng, báo anh | Cả ba |
| 2 | Bật `btree_gist`; lấy chuỗi kết nối qua pooler (`DATABASE_URL`) và chuỗi cho migration (`DIRECT_URL`); kiểm chuỗi nào Railway gọi được | Supabase |
| 3 | Áp migration bằng `pnpm --filter @makeup/api db:deploy`, đếm lại trên đúng database | Từ máy em, vào Supabase |
| 4 | Tạo bucket ảnh riêng tư và khoá S3 | Supabase → Storage |
| 5 | Tạo service API từ kho GitHub, đặt đủ biến (`docs/DEPLOYMENT.md` mục 1, bảng "bộ biến tối thiểu"), build, start, kiểm `/health` | Railway |
| 6 | Đồng bộ vai trò mẫu (`db:sync-roles:prod`), nạp gói (`platform:seed-plans:prod -- --with-trial`) | Railway |
| 7 | Ghi địa chỉ Railway vào `apps/web/vercel.json` (`vercel-config.mjs --write`), đưa lên nhánh | Kho mã |
| 8 | Tạo dự án Vercel (Root Directory `apps/web`), đặt `API_ORIGIN`, build | Vercel |
| 9 | Đo số tầng proxy thật, đặt `TRUST_PROXY_HOPS`; đặt `WEB_APP_URL` | Railway |
| 10 | Thử thật: đăng ký, đăng nhập, tải lại trang (giữ phiên), tải logo (vào kho ảnh), đăng xuất | Trình duyệt |
| 11 | Báo anh địa chỉ web. Anh đăng ký tài khoản của anh; em chạy `platform:grant-admin:prod -- --email <email anh>` | Railway |
| 12 | Diễn tập sao lưu và khôi phục trên Supabase vào một database thử | Supabase |
| 13 | Báo anh: rút quyền / xoá token của em nếu anh muốn (mục "Luật" số 5) | Anh |

Em **không** làm: mua gói, nhập thẻ, đổi gói, mua tên miền, xoá dự án, mời người khác, đụng dự án App Studio Pro.

### F. Những gì CHƯA biết (sẽ kiểm khi có quyền)
| Điểm | Vì sao quan trọng |
|---|---|
| Giá cả ba dịch vụ | Mục D |
| Gói miễn phí có cho mời thành viên không | Quyết định dùng mời hay dùng token |
| Gói miễn phí của Supabase có tạm dừng dự án không | Máy thật không được tự dừng |
| Railway gọi được chuỗi kết nối Supabase nào (IPv4/IPv6) | Chọn `DIRECT_URL` |
| Vercel cài được cả kho (pnpm workspace) khi Root Directory là `apps/web` | Web dùng gói `@makeup/shared` ngoài thư mục `apps/web` |
| Cookie đăng nhập đi qua chuyển tiếp của Vercel | `docs/DEPLOYMENT.md` mục 4 |
| Dịch vụ gửi thư cho "quên mật khẩu" | Chưa chọn dịch vụ; chưa có thì máy thật trả "chưa cấu hình" cho tính năng này |
