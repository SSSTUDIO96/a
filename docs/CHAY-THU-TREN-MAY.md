# Chạy thử Makeup Pro trên máy tính của anh

Cập nhật: 19/10/2026. Viết theo nhánh `claude/nen-mong-makeup` của kho `SSSTUDIO96/a`, đúng **từ commit `0802ee0` trở đi**. Từ bản này các lệnh trần (`pnpm dev`, `pnpm platform:…`) tự đọc tệp `apps/api/.env`; bản cũ hơn (ví dụ `d417acf`) sẽ báo `Thiếu DATABASE_URL`.

Tài liệu này dẫn anh từ một máy Windows chưa cài gì tới lúc: đăng nhập được, có một học viện dùng gói Academy, và tạo được một khoá học. Mỗi bước có nhãn:

- **[Đã chạy trên Linux 18/10/2026]**: thợ đã gõ đúng lệnh này trên một máy Linux sạch và thấy kết quả ghi bên cạnh.
- **[CHƯA thử trên Windows]**: bước riêng của Windows. Thợ không có máy Windows để thử. Anh làm theo trang chính thức được ghi tên. Tài liệu không đoán chi tiết của các bước này.

Các lệnh của dự án (bắt đầu bằng `pnpm`, `git`, `pg_dump`…) giống nhau trên Windows và Linux. Chúng đã chạy trên Linux, nhưng **chưa chạy trên Windows lần nào**.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### 1. Trên máy anh sẽ có ba thứ chạy cùng lúc
| Thứ | Ví như | Việc |
|---|---|---|
| Database | Sổ cái của studio | Giữ mọi dữ liệu: tài khoản, khách, hợp đồng, khoá học |
| Máy chủ API | Người quản lý ngồi giữa | Nhận yêu cầu từ trang web, kiểm quyền, đọc và ghi sổ cái |
| Trang web | Quầy lễ tân | Cái anh nhìn thấy trong trình duyệt |

Cả ba chỉ chạy trên máy anh. Người khác không mở được, trừ khi được cài thêm (mục cuối).

### 2. Vài từ phải biết
| Từ | Nghĩa bằng lời thường |
|---|---|
| Terminal (cửa sổ lệnh) | Cửa sổ chữ để gõ lệnh cho máy. Trên Windows là **PowerShell** hoặc **Windows Terminal**. Gõ lệnh xong bấm Enter |
| Thư mục hiện tại | Terminal luôn "đứng" trong một thư mục. Lệnh `cd <thư mục>` để đi vào thư mục đó |
| Database | Phần mềm giữ dữ liệu có trật tự. Dự án dùng **PostgreSQL 16** |
| Extension | Phần mở rộng của PostgreSQL. Dự án cần `btree_gist` để chặn trùng lịch của thợ |
| Migration | Bản hướng dẫn dựng các bảng trong database. Áp migration = dựng hoặc nâng cấp bảng, không xoá dữ liệu |
| Biến môi trường | Thông số đặt cho máy chủ lúc chạy: địa chỉ database, khoá bí mật… Ở đây ghi trong tệp `.env` |
| Cổng (port) | Số "cửa" trên máy. Máy chủ API mở cửa 4000, trang web mở cửa 5173 |
| `localhost` | Tên gọi "chính máy này" |
| Node.js, pnpm | Node.js chạy mã của dự án. pnpm tải các thư viện dự án cần |
| Git, nhánh | Git tải mã về và theo dõi phiên bản. Nhánh là một dòng phiên bản; dự án đang ở nhánh `claude/nen-mong-makeup` |
| Sao lưu (backup) | Chép toàn bộ database ra một tệp để khôi phục khi cần |

### 3. Luật khi chạy thử trên máy mình
| # | Luật | Vì sao |
|---|---|---|
| 1 | Tệp `.env` không gửi cho ai, không đưa lên kho | Trong đó có mật khẩu database và khoá ký đăng nhập |
| 2 | Tắt máy chủ bằng `Ctrl + C` trong cửa sổ của nó | Máy chủ đóng kết nối database êm, không bỏ dở việc ghi |
| 3 | Sao lưu database trước khi cập nhật mã mới, và đều đặn mỗi tuần | Có đường lui nếu bản mới hỏng |
| 4 | Không gõ lệnh xoá trắng database (`prisma migrate reset`, `prisma db push`) | Mất hết dữ liệu, không hỏi lại |
| 5 | Dữ liệu thật của khách và dữ liệu thử để ở hai database khác nhau | Thử bừa không làm bẩn sổ thật |
| 6 | Sao lưu phải có cả **thư mục ảnh**, không chỉ database | Database chỉ ghi tên tệp; ảnh nằm ở thư mục riêng |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

Thứ tự: cài phần mềm → lấy mã → cài thư viện → tạo database → tệp `.env` → áp migration → nạp gói → chạy máy chủ → chạy web → đăng ký → cấp quyền quản trị → cấp gói Academy → tạo khoá học.

Ở dưới, chữ trong `<…>` là chỗ anh tự điền. Ví dụ `<mật khẩu của anh>`.

### Bước 0. Cài phần mềm (một lần)

| Phần mềm | Bản cần | Nhãn |
|---|---|---|
| Git | bản mới | **[CHƯA thử trên Windows]** — làm theo trang chính thức *git-scm.com → Downloads → Windows* |
| Node.js | 22 (dự án đòi `>=22`, `package.json` gốc) | **[CHƯA thử trên Windows]** — làm theo trang chính thức *nodejs.org → Download*, chọn bản 22 LTS |
| pnpm | 10.28.0 (dự án ghi `packageManager: pnpm@10.28.0`) | **[CHƯA thử trên Windows]** — làm theo trang chính thức *pnpm.io → Installation* |
| PostgreSQL | 16 | **[CHƯA thử trên Windows]** — làm theo trang chính thức *postgresql.org → Download → Windows* (bộ cài của EDB). Bộ cài hỏi mật khẩu cho tài khoản `postgres`: **ghi lại mật khẩu này**. Giữ cổng 5432 |

Kiểm lại sau khi cài. Mở PowerShell mới, gõ từng dòng:

```
node -v
pnpm -v
psql --version
```

Trên máy thử Linux ba dòng này in `v22.22.0`, `10.28.0`, `psql (PostgreSQL) 16.15` **[Đã chạy trên Linux 18/10/2026]**. Trên Windows, nếu `psql` báo "không nhận ra lệnh", đó là do thư mục `bin` của PostgreSQL chưa nằm trong đường dẫn tìm lệnh của Windows **[CHƯA thử trên Windows — xem trang hướng dẫn cài của PostgreSQL/EDB]**. Anh vẫn đi tiếp được bằng ứng dụng **SQL Shell (psql)** mà bộ cài đặt sẵn trong menu Start.

### Bước 1. Lấy mã về

Chọn một thư mục, ví dụ `C:\MakeupPro`. Trong PowerShell:

```
cd C:\MakeupPro
git clone --branch claude/nen-mong-makeup https://github.com/SSSTUDIO96/a.git makeup-pro
cd makeup-pro
```

**[Đã chạy trên Linux 18/10/2026]**: lệnh `git clone --branch …` tải về **bản mới nhất của nhánh** tại lúc anh chạy, nên số commit anh thấy sẽ mới hơn `0802ee0` (lần nghiệm thu 3 ra `6df580a`). Như vậy là đúng; anh không cần lấy một commit cụ thể nào. Kho có thể là kho riêng tư. Khi đó Git sẽ hỏi đăng nhập GitHub; tài khoản của anh phải có quyền đọc kho. Thư mục `C:\MakeupPro` là ví dụ **[CHƯA thử trên Windows]**.

Từ đây trở đi, "**gốc kho**" là thư mục `makeup-pro` vừa tải.

### Bước 2. Cài thư viện

Ở gốc kho:

```
pnpm install --frozen-lockfile
```

**[Đã chạy trên Linux 18/10/2026]**: 360 gói, xong trong 4 giây (máy đã có sẵn bộ đệm; máy mới tải lần đầu sẽ lâu hơn). Cuối lệnh có dòng `Generated Prisma Client`: đó là bước tự động, không cần làm gì thêm.

### Bước 3. Tạo database và bật `btree_gist`

Mở **SQL Shell (psql)** (hoặc gõ `psql -U postgres` trong PowerShell). Đăng nhập bằng tài khoản `postgres` và mật khẩu đã ghi ở bước 0. Dán từng dòng:

```sql
CREATE ROLE makeup LOGIN PASSWORD '<mật khẩu database của anh>' CREATEDB;
CREATE DATABASE makeup_studio OWNER makeup;
\c makeup_studio
CREATE EXTENSION btree_gist;
\dx
```

Dòng cuối `\dx` phải liệt kê `btree_gist` và `plpgsql`.

- `makeup` là tài khoản riêng cho ứng dụng, không dùng tài khoản `postgres` (tài khoản quản trị).
- `makeup_studio` là tên database của anh. Anh đặt tên khác được; nhớ sửa theo ở bước 4 và 5.
- Mật khẩu: tránh ký tự `@ : / ? #` vì chúng làm hỏng địa chỉ kết nối ở bước 4.

**[Đã chạy trên Linux 18/10/2026]**: năm câu trên chạy được bằng `psql -f` dưới tài khoản `postgres` (thử với tên vai trò và database tạm rồi xoá). Database dùng cho buổi thử này tên `makeup_thu_z`, tạo bằng `createdb -O makeup makeup_thu_z` rồi `create extension btree_gist`. Cách mở SQL Shell trên Windows **[CHƯA thử trên Windows]**.

### Bước 4. Tạo tệp `.env` cho máy chủ

Tạo tệp `apps\api\.env` (tên tệp đúng là `.env`, không có đuôi). Dán bảy dòng:

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://makeup:<mật khẩu database của anh>@localhost:5432/makeup_studio
DIRECT_URL=postgresql://makeup:<mật khẩu database của anh>@localhost:5432/makeup_studio
JWT_ACCESS_SECRET=<chuỗi ngẫu nhiên 64 ký tự, cách tạo ở dưới>
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=<thư mục giữ ảnh tải lên, ví dụ C:/MakeupPro/anh-tai-len>
```

Tạo chuỗi ngẫu nhiên cho `JWT_ACCESS_SECRET` (khoá ký thẻ đăng nhập; lộ khoá này thì người khác giả được đăng nhập):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Chép 64 ký tự in ra, dán vào sau dấu `=`.

Ý nghĩa từng dòng:
| Dòng | Nghĩa |
|---|---|
| `NODE_ENV=development` | Chế độ chạy thử trên máy |
| `PORT=4000` | Cổng của máy chủ API. Trang web mặc định tìm máy chủ ở cổng 4000 (`apps/web/vite.config.ts`) |
| `DATABASE_URL`, `DIRECT_URL` | Địa chỉ database. Trên máy anh hai dòng giống nhau |
| `STORAGE_LOCAL_DIR` | Nơi lưu ảnh (logo, ảnh đại diện…). **Nên đặt**; bỏ trống thì ảnh nằm trong thư mục tạm của Windows (xem mục cuối) |

**[Đã chạy trên Linux 18/10/2026]**: tệp `.env` đúng bảy dòng này (cổng 4240, database `makeup_thu_z`, thư mục ảnh trong máy thử). Lệnh tạo chuỗi ngẫu nhiên in 64 ký tự. Tệp `.env` nằm trong danh sách Git bỏ qua (`.gitignore`), nên không bị đưa lên kho. Hai việc **[CHƯA thử trên Windows]**: Notepad hay tự thêm đuôi `.txt` khi lưu (khi lưu chọn "All files"); đường dẫn Windows trong `STORAGE_LOCAL_DIR` (ví dụ dùng `/` thay cho `\`) chưa thử.

### Bước 5. Áp migration (dựng các bảng)

Trong PowerShell, từ gốc kho:

```
cd apps\api
pnpm db:deploy-to postgresql://makeup:<mật khẩu>@localhost:5432/makeup_studio --khong-phai-database-thu
```

Kết quả đúng có hai dòng cuối:

```
All migrations have been successfully applied.
Đã áp migration vào đúng database "makeup_studio" và kiểm lại: khớp.
```

**Vì sao phải có cờ `--khong-phai-database-thu`.** Lệnh `db:deploy-to` (tệp `apps/api/scripts/deploy-to.mjs`) được làm cho thợ lập trình áp migration vào database thử. Nó chỉ tự chạy với tên bắt đầu bằng `makeup_test` (dòng 14). Tên khác bị từ chối với câu: `Từ chối: "…" không phải database thử (makeup_test…). Database khác phải ghi rõ cờ --khong-phai-database-thu.` Đây là chốt an toàn: muốn đụng database không phải database thử thì phải nói rõ bằng cờ. Lệnh này còn tự đếm lại trên chính database đích để chắc đã áp đúng chỗ (sổ lỗi `docs/SO-LOI-DA-DO.md` mục 16 ghi lần migration đi nhầm database).

**[Đã chạy trên Linux 18/10/2026]**: không có cờ → bị từ chối, mã thoát 1. Có cờ → áp đủ 15 migration vào `makeup_thu_z`, kiểm lại khớp.

Cách khác cũng chạy được: `pnpm db:deploy` (đọc địa chỉ từ tệp `.env` ở bước 4). **[Đã chạy trên Linux 18/10/2026]**: in `15 migrations found … No pending migrations to apply.` (vì đã áp ở trên).

### Bước 6. Nạp gói cước mẫu

Vẫn trong `apps\api`:

```
pnpm platform:seed-plans -- --with-trial
```

Kết quả đúng:

```
Gói mẫu: tạo mới [trial, individual, pro, team, academy, academy_pro], giữ nguyên []. Giá để 0 — chủ tự đặt giá.
```

- Tạo 6 gói: Dùng thử (ngừng bán), Individual, Pro, Team, Academy, Academy Pro. Giá đều 0; anh tự đặt giá ở trang quản trị.
- **Phải có `--with-trial`.** Gói "Dùng thử" là gói mặc định cho tổ chức chưa được cấp gói. Thiếu nó, tổ chức chưa có gói sẽ báo lỗi cấu hình khi kiểm giới hạn (`src/scripts/seed-plans.ts`).
- Chạy lại không sao: gói đã có được giữ nguyên, kể cả giá anh đã đặt.

Lệnh này tự đọc tệp `apps\api\.env` ở bước 4 (cũng như lệnh ở bước 7 và bước 10). Phần `--` trước `--with-trial` là để pnpm chuyển cờ cho lệnh.

**[Đã chạy trên Linux 18/10/2026]** đúng lệnh trần trên, trong một bản lấy mã mới, `.env` bảy dòng, database `makeup_thu_z2`: tạo đủ 6 gói; chạy lại → `giữ nguyên [trial, individual, pro, team, academy, academy_pro]`. Trước bản sửa (sổ lỗi `docs/SO-LOI-DA-DO.md` mục 25) lệnh này báo `Thiếu DATABASE_URL`.

### Bước 7. Chạy máy chủ API — cửa sổ lệnh số 1

Mở một PowerShell, đi vào `apps\api` của gốc kho:

```
pnpm dev
```

Đúng thì có dòng chứa `"msg":"Makeup Pro API đã chạy"`. **Để nguyên cửa sổ này.** Đóng nó là tắt máy chủ. Lệnh này tự khởi động lại máy chủ khi có tệp mã thay đổi; anh không sửa mã thì không cần để ý. Cửa sổ sẽ in thêm nhiều dòng chữ dài mỗi khi trang web gọi máy chủ; đó là nhật ký, bình thường.

Kiểm: mở trình duyệt, vào `http://localhost:4000/health`. Phải thấy `{"ok":true}`.

**[Đã chạy trên Linux 18/10/2026]** đúng lệnh `pnpm dev` (và `pnpm --filter @makeup/api dev` từ gốc kho) với `PORT=4250` trong `.env`: in `Makeup Pro API đã chạy`, `/health` trả `{"ok":true}`. Không có tệp `.env` (hoặc đứng sai thư mục) thì in `.env not found. Continuing without it.` rồi `Cấu hình môi trường không hợp lệ — NODE_ENV: …; DATABASE_URL: …; JWT_ACCESS_SECRET: …`, máy chủ không chạy (đã thấy trên Linux).

### Bước 8. Chạy trang web — cửa sổ lệnh số 2

Mở PowerShell thứ hai, đi vào `apps\web` của gốc kho:

```
pnpm exec vite
```

Đúng thì có dòng `Local: http://localhost:5173/`. **Để nguyên cửa sổ này.**

Mở trình duyệt vào `http://localhost:5173`. Trang tự chuyển tới màn đăng nhập.

**[Đã chạy trên Linux 18/10/2026]** với `pnpm exec vite --port 5310` và biến `API_DEV_TARGET=http://localhost:4240` (máy thử bận các cổng khác nên phải đổi cổng). Trên máy anh dùng cổng mặc định 4000/5173 nên không cần hai phần này. Trang web gọi máy chủ qua chính địa chỉ `localhost:5173` (Vite chuyển tiếp `/api` sang cổng 4000, `vite.config.ts`).

### Bước 9. Đăng ký tài khoản và tạo học viện

1. Màn đăng nhập → bấm **Đăng ký** ở dưới.
2. Điền **Họ tên**, **Email**, **Mật khẩu** → bấm **Đăng ký**.
3. Màn **Tạo tổ chức** hiện ra. Điền **Tên tổ chức**, ví dụ `Học viện Hoa Hồng`. Ô **Đường dẫn** tự điền `hoc-vien-hoa-hong`.
4. **Loại tổ chức** chọn **Trung tâm đào tạo** → bấm **Tạo tổ chức**.
5. Trang chuyển vào lịch makeup của học viện, địa chỉ `http://localhost:5173/hoc-vien-hoa-hong/lich`. Thanh trái có: Lịch makeup, Hợp đồng, Bảng giá, Khách hàng, Thợ makeup, Báo cáo, Đào tạo, Mẫu thiết kế, Cài đặt.

**[Đã chạy trên Linux 18/10/2026]** bằng trình duyệt tự động (Playwright, Chromium): đúng các màn trên. Lúc này học viện đang ở gói Dùng thử. Vào **Đào tạo → Thêm khoá**, điền đủ rồi **Lưu** thì bị chặn với dòng đỏ: *"Gói Dùng thử của tổ chức chưa có khoá học — liên hệ để nâng gói."* Đúng như thiết kế: phải cấp gói Academy trước (bước 11).

### Bước 10. Cấp quyền quản trị nền tảng cho tài khoản của anh — cửa sổ lệnh số 3

"Quản trị nền tảng" là người cấp gói cho các tổ chức. Quyền này chỉ cấp được bằng lệnh trên máy chủ, không có nút nào trong web (`src/scripts/grant-platform-admin.ts`). Tài khoản phải **đăng ký xong ở bước 9** rồi mới cấp được.

Mở PowerShell thứ ba, đi vào `apps\api`:

```
pnpm platform:grant-admin -- --email <email anh đã đăng ký>
```

Kết quả đúng: `Cấp quyền quản trị nền tảng: <email> (<mã>) — đã ghi nhật ký`. Chạy lại lần nữa thì in `không đổi gì (đã có quyền)`.

Thu lại quyền: thêm `--revoke` vào cuối lệnh. **[Đã chạy trên Linux 18/10/2026]**: in `Thu quyền quản trị nền tảng: … — đã ghi nhật ký`; cấp lại ngay sau đó được.

**[Đã chạy trên Linux 18/10/2026]** đúng lệnh trần trên (bản lấy mã mới, database `makeup_thu_z2`): lần đầu → `Cấp quyền quản trị nền tảng: … — đã ghi nhật ký`; lần hai → `không đổi gì (đã có quyền)`; thêm `--revoke` → `Thu quyền …`, cấp lại được. Tài khoản đó vào trang quản trị thấy đủ 6 gói. Trước bản sửa lệnh này báo `Thiếu DATABASE_URL`.

### Bước 11. Vào trang quản trị, cấp gói Academy cho học viện

1. Trên trình duyệt, gõ địa chỉ `http://localhost:5173/quan-tri`. Trong web **không có nút nào dẫn tới đây**; phải gõ địa chỉ. Chưa cấp quyền ở bước 10 thì trang báo *"Không có trang này."*
2. Trang **Trang chủ quản trị** hiện số tổ chức. Thanh trái có **Trang chủ**, **Tổ chức**, **Gói cước**.
3. (Tuỳ ý) **Gói cước**: xem 6 gói, bấm **Sửa** để đặt giá.
4. Bấm **Tổ chức** → bấm vào **Học viện Hoa Hồng**.
5. Bấm **Đổi gói / gia hạn**.
6. **Gói cước** chọn `Academy · 0 ₫/tháng`. **Trạng thái** để **Đang dùng**. **Thời hạn** chọn **12 tháng**.
7. Bấm **Lưu thuê bao**.
8. Thẻ của học viện đổi sang **Đang dùng**, mục **Thuê bao hiện hành** ghi `Academy`, mục **Mức dùng so với gói** ghi `Thành viên 1 / 10`.
9. Quay về học viện: gõ địa chỉ `http://localhost:5173/hoc-vien-hoa-hong`. Trang quản trị cũng không có nút quay về.

**[Đã chạy trên Linux 18/10/2026]**: đủ các bước trên. Lưu thuê bao trả 201 (tạo thành công). Gói Academy cho tối đa 10 khoá học, 200 học viên.

### Bước 12. Tạo khoá học

1. Vào **Đào tạo** ở thanh trái → bấm **Thêm khoá**.
2. Điền các ô có dấu `*`:
   - **Tên khoá**: ví dụ `Makeup cô dâu cơ bản`
   - **Học phí**: ví dụ `5000000` (tự hiện `5.000.000 ₫`)
   - **Thời gian**: ngày bắt đầu và ngày kết thúc, dạng `dd/mm/yyyy`
   - **Lịch học**: bấm chọn ít nhất một ngày (T2…CN)
   - **Số học viên tối đa**: ví dụ `12`
   - Không bắt buộc: Giờ học, Giảng viên, Nhóm khoá, Cọc mặc định, Mô tả.
3. Bấm **Lưu**.
4. Khoá hiện trong danh sách bên trái, mã `KH-0001`. Bên phải có thẻ lớp với nút **Ghi danh** để thêm học viên.

**[Đã chạy trên Linux 18/10/2026]**: tạo được khoá `Makeup cô dâu cơ bản`, mã `KH-0001`, 02/11–30/11/2026, T2 · T4 18:00–21:00, tối đa 12 học viên. Thiếu ngày hoặc lịch học thì hộp báo đỏ ngay dưới ô: *"Nhập ngày bắt đầu và ngày kết thúc"*, *"Chọn ít nhất một ngày trong tuần"*.

---

### Tắt máy

1. Cửa sổ số 2 (web): bấm `Ctrl + C`.
2. Cửa sổ số 1 (máy chủ): bấm `Ctrl + C`. Máy chủ in `Đang tắt máy chủ` rồi dừng.
3. Đóng các cửa sổ.

Database PostgreSQL vẫn chạy ngầm sau khi tắt; không cần tắt nó. Bộ cài Windows thường cho PostgreSQL tự chạy khi bật máy **[CHƯA thử trên Windows]**.

**[Đã chạy trên Linux 18/10/2026]**: gửi tín hiệu `Ctrl + C` (SIGINT) cho máy chủ → nhật ký ghi `Đang tắt máy chủ`, cổng đóng; web cũng tắt. Thử lại với `pnpm dev`: gửi `Ctrl + C` cho cả nhóm tiến trình → `Đang tắt máy chủ`, không còn tiến trình nào, cổng đóng.

### Chạy lại lần sau

Không phải làm lại bước 0–6, 9–11. Chỉ cần:

1. Cửa sổ 1: vào `apps\api`, gõ `pnpm dev`.
2. Cửa sổ 2: vào `apps\web`, gõ `pnpm exec vite`.
3. Mở `http://localhost:5173`, đăng nhập bằng email và mật khẩu đã đăng ký.

**[Đã chạy trên Linux 18/10/2026]**: tắt hẳn, chạy lại hai lệnh, mở trình duyệt mới (chưa từng đăng nhập) → màn đăng nhập → đăng nhập → vào thẳng học viện. Khoá `Makeup cô dâu cơ bản` vẫn còn.

Khi có bản mã mới: sao lưu trước (mục dưới), rồi ở gốc kho chạy `git pull`, `pnpm install --frozen-lockfile`, rồi làm lại bước 5. Thứ tự này **chưa diễn tập** với một bản mã mới thật.

### Sao lưu và khôi phục database

**Sao lưu** (một tệp chứa toàn bộ database):

```
pg_dump -Fc -h localhost -U makeup -d makeup_studio -f <thư mục sao lưu>/makeup_<ngày>.dump
```

Lệnh hỏi mật khẩu của tài khoản `makeup`. `-Fc` là dạng nén, dùng được cho `pg_restore`.

**Sao lưu ảnh**: chép nguyên thư mục `STORAGE_LOCAL_DIR` (bước 4) sang cùng chỗ với tệp `.dump`. `pg_dump` không chép ảnh.

**Khôi phục** vào một database **mới** (không đè lên database đang dùng):

```
createdb -h localhost -U makeup makeup_studio_khoiphuc
pg_restore -h localhost -U makeup -d makeup_studio_khoiphuc --no-owner <thư mục sao lưu>/makeup_<ngày>.dump
```

Sau đó sửa hai dòng `DATABASE_URL`, `DIRECT_URL` trong `.env` sang `makeup_studio_khoiphuc`, rồi chạy lại máy chủ.

**[Đã chạy trên Linux 18/10/2026]**: `pg_dump -Fc` ra tệp 191 KB. Khôi phục vào database mới bằng tài khoản `makeup` (không phải tài khoản quản trị): chạy được, `btree_gist` được dựng lại. Đếm lại hai bên khớp: 1 tài khoản, 1 khoá học, 1 thuê bao, 1 tệp, 15 migration. Bật máy chủ trên bản khôi phục và đăng nhập được bằng tài khoản cũ. Trên Linux lúc thử, mật khẩu đưa qua biến `PGPASSWORD` thay cho gõ tay. Trên Windows, `pg_dump`, `pg_restore`, `createdb` nằm trong thư mục `bin` của PostgreSQL **[CHƯA thử trên Windows — xem trang chính thức *postgresql.org/docs/16/app-pgdump.html* và *app-pgrestore.html*]**. Lịch tự sao lưu hằng ngày (Task Scheduler của Windows) chưa làm.

### Khi gặp lỗi

| Thấy gì | Vì sao | Làm gì |
|---|---|---|
| `.env not found. Continuing without it.` rồi `Cấu hình môi trường không hợp lệ — … DATABASE_URL … JWT_ACCESS_SECRET …` | Không thấy tệp `.env` | Đứng đúng thư mục `apps\api` (hoặc dùng `pnpm --filter @makeup/api …` từ gốc kho); tệp tên đúng `.env`, không phải `.env.txt` |
| `JWT_ACCESS_SECRET phải dài ít nhất 32 ký tự` | Khoá quá ngắn | Tạo lại bằng lệnh ở bước 4 |
| `Thiếu DATABASE_URL` | Như dòng trên: lệnh không thấy tệp `.env`, hoặc trong `.env` thiếu dòng `DATABASE_URL` | Như dòng trên; mở `.env` kiểm đủ bảy dòng ở bước 4 |
| Lệnh chạy nhưng vào nhầm database | Cửa sổ lệnh đã đặt sẵn biến `DATABASE_URL` (ví dụ từ lần thử trước). Biến đặt sẵn **thắng** dòng trong `.env` | Mở cửa sổ lệnh mới rồi chạy lại |
| `Từ chối: "…" không phải database thử` | Thiếu cờ | Thêm `--khong-phai-database-thu` (bước 5) |
| `Chưa có tài khoản với email … — người đó phải tự đăng ký trước` | Cấp quyền trước khi đăng ký | Đăng ký ở web trước (bước 9) |
| `/quan-tri` báo "Không có trang này." | Tài khoản chưa có quyền quản trị | Làm bước 10, tải lại trang |
| "Gói Dùng thử của tổ chức chưa có khoá học — liên hệ để nâng gói." | Học viện chưa có gói Academy | Làm bước 11 |
| Đăng nhập sai nhiều lần rồi bị chặn | Mỗi máy chỉ được 10 lần đăng ký/đăng nhập mỗi phút (`AUTH_RATE_LIMIT_PER_MINUTE`) | Chờ một phút |
| Trang web trắng hoặc báo lỗi mạng | Cửa sổ 1 (máy chủ) đã tắt | Mở lại máy chủ (bước 7) |
| Vite báo cổng 5173 đang bận | Một chương trình khác giữ cổng; cấu hình web bắt buộc đúng cổng 5173 | Tắt chương trình kia. **Chưa gặp khi thử** |

---

## Những gì CHƯA làm được trên máy anh

| Điểm | Chi tiết (đọc từ mã) |
|---|---|
| **Quên mật khẩu, đặt lại qua email** | Chưa có. Máy chủ chỉ có 5 đường đăng nhập: đăng ký, đăng nhập, đổi thẻ, đăng xuất, xem mình (`apps/api/src/modules/auth/routes.ts`). Không có đường đổi mật khẩu, không có phần gửi email nào trong mã. Quên mật khẩu thì hiện chưa có cách nào trong ứng dụng |
| **Ảnh tải lên lưu ở đâu** | Không có kho S3 thì ảnh lưu trên ổ đĩa máy anh, ở thư mục `STORAGE_LOCAL_DIR` (bước 4). Đã thử trên Linux: tải logo ở **Cài đặt → Hồ sơ thương hiệu**, tệp nằm ở `<STORAGE_LOCAL_DIR>/org/<mã tổ chức>/org-logo/<mã>.png`. Nếu bỏ trống `STORAGE_LOCAL_DIR`, ở chế độ chạy thử ảnh vào thư mục tạm của máy, tên `makeup-files-development` (`apps/api/src/lib/storage/config.ts:55`). Windows có thể dọn thư mục tạm, nên **phải đặt** `STORAGE_LOCAL_DIR` |
| Sao lưu tự động | Chưa có. Phải tự chạy `pg_dump` và tự chép thư mục ảnh |
| Mở từ điện thoại hoặc máy khác | Chưa thử. Web và máy chủ chỉ nghe trên chính máy anh (`localhost`) |
| Chạy bản build chính thức | Tài liệu này chạy ở chế độ phát triển (`NODE_ENV=development`, `tsx`, `vite`). Bản build và các biến bắt buộc của bản thật nằm ở `docs/DEPLOYMENT.md` |
| Nút qua lại giữa học viện và trang quản trị | Chưa có. Phải gõ địa chỉ `/quan-tri` hoặc `/<đường dẫn học viện>` |
| Giá gói | Gói mẫu đều 0 ₫. Chưa có cổng thanh toán; cấp gói là ghi tay ở trang quản trị |
| Mọi bước riêng của Windows | Cài Git, Node 22, pnpm, PostgreSQL 16 bản Windows; bật `btree_gist` qua SQL Shell; gõ lệnh trong PowerShell; đường dẫn Windows trong `.env`; `pg_dump` trên Windows — **chưa thử lần nào** |

## Chỗ lệch với tài liệu khác (cho người giữ tài liệu)
Các chỗ lệch ghi lúc viết tài liệu này đã sửa ngày 18/10/2026 (sổ lỗi `docs/SO-LOI-DA-DO.md` mục 25):
- Các lệnh `dev`, `platform:grant-admin`, `platform:seed-plans`, `db:sync-roles` nay tự đọc `apps/api/.env` (`apps/api/package.json`). Tài liệu này đã bỏ cách né `pnpm exec tsx --env-file=.env …`, dùng lệnh trần.
- `docs/BAN-GIAO-PHIEN.md` bước 4 và `docs/DEPLOYMENT.md` mục "Quản trị nền tảng": đã sửa theo.
- `docs/DEPLOYMENT.md` mục 1 (kho tệp khai trong `env.ts`, bản thật thiếu biến thì không khởi động), mục 2 (15 migration, cờ `--with-trial`), mục 4 (sao lưu đã diễn tập trên PostgreSQL 16 Linux, chưa trên Supabase): đã sửa.
