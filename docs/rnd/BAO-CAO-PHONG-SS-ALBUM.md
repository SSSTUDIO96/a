# Báo cáo kho phông của anh Chiến (SS-Album) — kiểm kê, giấy phép, chữ ký

Người lập: thợ PH (R&D) · Ngày 19/10/2026 · Nguồn: 291 tệp phông anh gửi (giải nén bằng unrar, đủ 291/291) · Chỉ đọc bằng thư viện fontTools; không chạy gì từ trong thư mục phông; **không chép tệp phông vào kho** (kho chỉ có ảnh mẫu, bảng kê và báo cáo này).

> Nguyên tắc của anh: thương mại là việc của anh — báo cáo này **không chặn hộ**, chỉ ghi rõ điều đọc được trong tệp để anh quyết (xem mục 'Cần anh quyết' ở cuối). Chỗ nào tệp không nói thì ghi **không rõ**; không đoán giấy phép.

## 0. Xem gì trước

**Mở ảnh này đầu tiên:** `docs/rnd/anh-phong-ss-album/01-top12-chu-ky.png` — 12 phông chữ ký đẹp nhất, xếp hạng, đủ dấu tiếng Việt.

| Ảnh | Nội dung |
|---|---|
| `01-top12-chu-ky.png` | **Top 12 chữ ký** (4 phông nhóm A, 8 phông nhóm B), ô lớn, có nhóm giấy phép dưới mỗi ô |
| `02-ung-vien-chu-ky-1.png` | 24 ứng viên chữ ký: 7 nhóm A + 17 nhóm B (để anh so thêm) |
| `03-ung-vien-chu-ky-2.png` | 16 ứng viên còn lại: 9 nhóm B + 7 nhóm C (phông 'chỉ dùng cá nhân' nhưng đẹp, để anh biết nếu muốn mua) |
| `04-tieu-de-serif.png` | 24 phông tiêu đề serif sang trọng đủ dấu |
| `05-tieu-de-sans.png` | 23 phông sans-serif đủ dấu |
| `kiem-ke-291-tep.csv` | Bảng kê đầy đủ từng mặt chữ (302 dòng): giấy phép/bản quyền chép nguyên văn từ tệp, mở bằng Excel |

Mỗi ô ảnh: ba dòng mẫu ("Tôn Nữ Hoàng Bảo Ngọc Phương Thảo", "Đặng Quỳnh Như", "Chúc mừng em tốt nghiệp"), tên phông, ô màu nhóm (xanh = A, vàng nâu = B, đỏ = C), N/M đủ dấu và cỡ chữ đã thu để vừa ô (cỡ nhỏ nghĩa là phông có chữ rất rộng).

## 1. Con số chính

- **Đọc được: 291/291 tệp**, 0 tệp lỗi. Có 302 mặt chữ vì `Avenir.ttc` chứa 12 mặt chữ (tệp .ttc).
- **Gộp trùng:** 8 cặp tệp giống hệt từng byte (cùng mã băm) và 12 tên phông xuất hiện ở nhiều tệp (bản biến thiên 'Variable' + bản tĩnh) → còn **289 phông riêng** (theo tên PostScript). Danh sách ở mục 6.
- **Họ phông (gộp theo tên họ):** 227 họ.
- **Đủ dấu tiếng Việt (186/186 ký tự):** **180/291 tệp** (180 mặt chữ), thuộc 126 họ phông. Còn lại 111 tệp thiếu dấu (thường chỉ có chữ Latin-1, thiếu ă ơ ư và chữ có dấu hỏi/ngã/nặng) — **không dùng được cho tên tiếng Việt** (dấu sẽ rơi hoặc hiện ô vuông).
- **Theo nhóm giấy phép (đếm tệp, tổng 291):** **A = 74** · **B = 71** · **C = 94** · D (không rõ, tệp không ghi gì) = 52. Đủ dấu trong từng nhóm: A 71/74 · B 69/71 · C 40/94 · D 0/52.
- Nhóm D là phần anh không yêu cầu nhưng cần có: phông tải lẻ trên mạng (kiểu dafont), tệp không ghi giấy phép và không phải họ phông phổ biến. Coi như **không rõ** cho đến khi anh biết nơi tải.
- **fsType (cờ nhúng) trong OS/2:** 167 tệp nhúng tự do · 64 tệp 'chỉ xem/in' (4) · 41 tệp 'nhúng để sửa' (8) · **3 tệp CẤM nhúng (2):** `1FTV-VIP-Boogo.ttf`, `Chaney-Extended Normal.ttf`, `Juliette.otf` · 12 tệp mã 6 (cờ lẫn cấm + xem/in; toàn bộ là phông UTM) · 4 tệp mã 12 (cờ lẫn; phông Adobe Caslon/Garamond) · (trong số 'nhúng tự do' có `#Beyovn05 PATEGLAMT-SCRIPT.ttf` mang thêm cờ 256: cấm cắt tập con). Lưu ý: fsType chỉ là cờ kỹ thuật, không thay cho giấy phép.

## 2. Cách kiểm đủ dấu tiếng Việt

Bộ ký tự kiểm **M = 186**: 52 chữ a–z, A–Z + **134 chữ Việt có dấu** (đủ chữ thường và chữ hoa):
- Chữ thường (67): `àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ`
- Chữ hoa (67): `ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ`
- Gồm: ă â đ ê ô ơ ư và năm thanh (huyền, sắc, hỏi, ngã, nặng) trên mọi nguyên âm (kể cả â ê ô ă ơ ư). Kiểm bằng bảng ký tự (cmap) của phông, dạng ký tự dựng sẵn (NFC) — cách mọi phần mềm thiết kế thông dụng và ảnh dựng của app dùng. Phông chỉ có dấu rời (ghép) mà không có ký tự dựng sẵn bị tính là thiếu.
- 'N/M' trong bảng = số ký tự có trên 186. **186/186 ✔ = đủ.** Dấu '–' (ví dụ 90–186) = các tệp của họ phông khác nhau.
- Ngoài đếm ký tự còn kiểm **bằng mắt** (ảnh kiểm nội bộ, không đưa vào kho): chữ hoa xếp chồng mũ + thanh (Ấ Ầ Ẩ Ẫ Ậ Ế Ể Ễ Ệ Ố Ổ Ỗ Ộ Ớ Ở Ỡ Ợ Ứ Ử Ữ Ự Ằ Ắ Ẳ Ẵ Ặ) cho 40 phông chữ ký. Kết quả theo từng phông ở mục 4.

## 3. Cách phân nhóm giấy phép

Chỉ dựa vào (1) chữ trong name table (ID0 bản quyền, ID8 nhà làm, ID9 nhà thiết kế, ID13 giấy phép, ID14 địa chỉ giấy phép), (2) tên tệp/tên phông có DEMO, TRIAL, PERSONAL USE, FREE VERSION, (3) nhận biết chắc chắn họ phông thương mại (Arial, Adobe, Gotham…). Cột 'Cơ sở' ghi **điều đọc được**; chỗ nào là nhận biết của tôi ghi rõ '(nhận biết)'.

| Nhóm | Nghĩa | Số tệp |
|---|---|---|
| **A** | Tệp tự ghi SIL Open Font License 1.1 hoặc Apache 2.0 (ID13/ID14): cho dùng thương mại, được đi kèm app | 74 |
| **B** | Phông Việt hoá (tên SVN-, UTM, 1FTV, DFVN, NVN, Fz, VanHung, MTD, HLT… hoặc ghi 'Việt hoá') mà tệp **không ghi giấy phép đủ** | 71 |
| **C** | Phông thương mại/của hệ điều hành (Microsoft, Adobe, Linotype, Gotham, Gilroy…) hoặc tệp tự ghi DEMO/TRIAL/PERSONAL USE/phi thương mại — kể cả bản Việt hoá của chúng | 94 |
| D | Không thuộc ba nhóm trên; tệp không ghi giấy phép | 52 |

Ghi chú nhóm C: những tệp **tự ghi** 'personal use only / demo / trial / non-commercial / không dùng thương mại' → *không được đóng gói đi bán nếu không mua giấy phép* (đúng chữ trong tệp). Phông hệ điều hành/Adobe/Linotype/H&FJ: tệp chỉ trỏ tới điều khoản của hãng (Microsoft: 'dùng để hiển thị và in nội dung theo điều khoản của sản phẩm') chứ không cho phát hành lại phông; đây là phông thương mại của hãng (nhận biết) nên cũng *không đóng gói đi bán nếu không có giấy phép*. Nhóm B đã chuyển sang C khi tệp có chữ 'personal use' (ví dụ MTD Madame Cosmetics, VanHung-High Spirited, Fz Fashion Signature, Fz Thu phap DT Fontzin).

Nhóm A cần nhớ khi đóng gói (SIL OFL/Apache — nội dung chung của giấy phép, không phải từ tệp): kèm bản văn giấy phép + dòng bản quyền gốc; không bán riêng tệp phông; không dùng tên phông dành riêng cho bản đã sửa. Roboto Slab là Apache 2.0 (kèm văn bản Apache); còn lại OFL.

## 4. Chữ ký nét mảnh đều — xếp hạng và kiểm mắt

Tiêu chí (theo Sổ ý muốn 19/10: kiểu **chữ ký nét mảnh đều**, không phải thư pháp đậm nhạt): (1) đủ 186/186 ký tự; (2) nét mảnh và đều; (3) dấu không lệch/rơi/đè; (4) ưu tiên nhóm A rồi B. Đã lọc 40 phông script có đủ dấu từ 126 họ phông đủ dấu.

### 4.1. Top 12

| Hạng | Phông | Nhóm | Giấy phép / bản quyền đọc được trong tệp | Đủ dấu | Nhúng | Nhận xét kiểm mắt |
|---|---|---|---|---|---|---|
| 1 | **MonteCarlo** (`MonteCarlo-Regular.ttf`) | A | SIL OFL 1.1 (tệp ghi) | 186/186 | nhúng tự do | mảnh, đều, đúng kiểu chữ ký; dấu mũ/hỏi/ngã/nặng đều đặt đúng chỗ. |
| 2 | **Ephesis** (`Ephesis-Regular.ttf`) | A | SIL OFL 1.1 (tệp ghi) | 186/186 | nhúng tự do | mảnh, mềm, hơi thưa; dấu đúng chỗ, không đè. |
| 3 | **WindSong** (`WindSong-Regular.ttf`) | A | SIL OFL 1.1 (tệp ghi) | 186/186 | nhúng tự do | rất mảnh, chữ thưa rộng (cỡ thu nhỏ khi đặt vừa dòng). Lưu ý: ở chữ 'Tôn' mũ của ô chạm vào nét móc của chữ T, nhìn thoáng như 'Tồn'. |
| 4 | **Pinyon Script** (`PinyonScript-Regular.ttf`) | A | SIL OFL 1.1 (tệp ghi) | 186/186 | nhúng tự do | kiểu thư pháp copperplate sang trọng, nhưng nét có thanh-đậm rõ — KHÔNG phải nét đều; dấu ổn. |
| 5 | **Fz JHW Monoline Signature** (`Fz-JHW-Monoline-Signature.ttf`) | B | ©Perspectype Studio 2021. All Rights Reserved / studioperspectype@gmail.com | 186/186 | nhúng tự do | nét vừa, khá đều, giống chữ ký tay thật; gạch ngang chữ t kéo dài chạm chữ kế bên; dấu ổn. |
| 6 | **SVN Rustling Sound** (`SVN-Rustling-Sound.otf`) | B | tệp không ghi giấy phép | 186/186 | nhúng tự do | mảnh, thân chữ cao thanh; chữ hoa rất cao (chạm dòng trên nếu dòng sát); dấu đặt đúng, hơi xa chữ hoa. |
| 7 | **SVN Janelotus** (`SVN-Janelotus.otf`) | B | lemonthe | 186/186 | nhúng tự do | mảnh đều, chữ hoa thân dài; thanh ngang chữ Đ hơi lệch; dấu ổn. |
| 8 | **1FTV Santa Catalina** (`1FTV-VIP-Santa-Catalina.ttf`) | B | tệp không ghi giấy phép | 186/186 | nhúng tự do | mảnh đều, dễ đọc nhất trong nhóm B; dấu ổn. (Tệp ghi 'Typeface © (your company)': chưa điền nhà làm.) |
| 9 | **1FTV Bethany Avanue** (`1FTV-VIP-Bethany-Avanue.otf`) | B | http://www.rantaustudio.com | 186/186 | nhúng tự do | mảnh đều, thưa rộng, dấu ổn. |
| 10 | **UTM A&S Heartbeat** (`UTM A&S Heartbeat.ttf`) | B | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy  | 186/186 | cờ lẫn (cấm + xem/in) | mảnh, nghiêng, sạch; dấu ổn. Ký tự '·' (U+00B7) trong phông UTM hiện ra tấm biển chữ nhỏ 'Font chữ UTM sử dụng bảng mã UNICODE…' — tránh ký tự này. |
| 11 | **NVN Selfie Light** (`NVNSelfie-Light.ttf`) | B | tệp không ghi giấy phép | 186/186 | nhúng tự do | rất mảnh và đều (đúng 'nét mảnh đều' nhất), hơi nhạt khi in nhỏ; dấu ổn. |
| 12 | **VN Jonathan Andrea Script** (`VN-Jonathan-Andrea-Script.ttf`) | B | tệp không ghi giấy phép | 186/186 | nhúng tự do | nét vừa, kiểu ký bút bi; thanh ngang chữ Đ cắt xuyên chữ; dấu ổn. |

Nhận định xếp hạng: nhóm A chỉ có **MonteCarlo, Ephesis, WindSong** thật sự mảnh-đều; Pinyon Script, Great Vibes, Alex Brush là thư pháp thanh-đậm (đẹp, sang, nhưng không đúng 'nét đều'); Dancing Script là chữ viết nhanh nét đậm. Vì vậy hạng 5–12 là nhóm B — **đẹp và đúng kiểu hơn nhưng chưa có giấy phép rõ**. Nếu anh chỉ muốn phông an toàn để đi bán: MonteCarlo (hạng 1) và Ephesis (hạng 2).

### 4.2. Phông chữ ký đủ dấu nhưng bị loại, và vì sao

| Phông | Nhóm | Lý do loại (kiểm mắt) |
|---|---|---|
| Alex Brush | A | thư pháp cọ, nét thanh-đậm rõ — không đều |
| Great Vibes | A | thanh-đậm, kiểu thiệp cưới — không đều (vẫn dùng được nếu anh thích kiểu thư pháp) |
| Dancing Script | A | nét đậm vừa, kiểu viết nhanh — không phải chữ ký mảnh |
| Pateglamt Script | B | thanh-đậm rõ, thư pháp |
| Beautiful Caps (UTM) | B | chữ hoa hoa văn rất lớn, chữ thường nhỏ xíu; mẫu 'Font chữ UTM…' hiện ở ký tự '·' |
| 1FTV Amoslenty | B | rất mảnh nhưng khoảng cách chữ lỏng lẻo, chữ thường nhỏ |
| 1FTV Bastliga One | B | nét hoa mỹ quá lớn, đè lên chữ, chữ thường nhỏ khó đọc |
| 1FTV Capricious Ambrosia | B | chữ rất rộng (phải thu cỡ xuống 18), chữ Đ lạ |
| 1FTV Halone | B | chữ t rời rạc, nét hơi 'trẻ con' |
| 1FTV Molahesta | B | rất mảnh, chữ hoa khổng lồ, chữ thường nhỏ |
| 1FTV Peach Club | B | nét đậm, không mảnh |
| DFVN Boheme Floral | B | rất mảnh nhưng chữ hoa xoắn lớn, chữ thường nhỏ |
| HLT Burgues Script | B | nét hoa kéo đè lên chữ; dấu bị chìm giữa các nét — **dấu không rõ** |
| HLT JaneAusten | B | bút lông đậm, 'Ư' lạ |
| MTD Australian Script | B | mảnh, đẹp nhưng chữ dính nhau ('TônNữ'), mũ chữ hoa bay cao |
| SVN Hottroof Semhesta | B | nét hơi đậm |
| SVN Agoka Italic | B | chữ in nghiêng display, không phải chữ ký |
| UTM Zapfino KT / UTM Yen Tu | B | đẹp, mảnh nhưng đổi độ dày nét (Zapfino); '·' hiện biển UTM — nằm trong danh sách dự bị |
| VanHung Melika Letter | B | mảnh đến gần mất nét, chữ thường nhỏ |
| VL Hullist | B | mảnh và nhạt, in nhỏ sẽ mất nét |
| 1FTV Billie James | C | 'không bán lại/chia sẻ tệp phông'; nét đậm vừa |
| 1FTV Signerica Fat / Signerica Fat | C | chỉ cá nhân; chữ thưa |
| 1FTV Sparkling Valentine | C | **mảnh đều rất đẹp** nhưng 'FREE FOR PERSONAL USE ONLY' |
| Haigrast Script | C | rất mảnh, đẹp; PERSONAL USE ONLY (phải mua giấy phép thương mại của Måns Grebäck) |
| Fz Fashion Signature | C | **rất giống chữ ký**; 'Personal use only' (Letterara) |
| MTD Madame Cosmetics | C | nét thanh-đậm, 'free for personal use' |
| VanHung High Spirited | C | **mảnh đều đẹp**; 'Free for personal use' |

Phông chữ ký **đẹp nhưng thiếu dấu** (không dùng được cho tên Việt vì thiếu ă ơ ư hoặc thanh hỏi/ngã/nặng): Photograph Signature (84/186), Signature Collection, Welliams, Antro Vectra, Anything Script 1/3/4, Betterworks, Ladyday, Berlishanty Calligraphy, MonthGlade, Sophia Martini, Heanffe, Juliette, HavanaSunset Script Alt, Melika Letter (bản `zMelika Letter.ttf`; bản Việt hoá `VanHung-Melika Letter` thì đủ), Aston Script, Cynthia Blooms, Hijrnotes… Nếu cần các kiểu này, phải xin bản Việt hoá.

## 5. Phông tiêu đề / chữ thường (ít quan trọng hơn)

Ảnh `04-tieu-de-serif.png` và `05-tieu-de-sans.png` (mẫu: "Giấy chứng nhận tốt nghiệp", "CHÀO MỪNG HỌC VIÊN MỚI", "Đặng Quỳnh Như - Khoá Makeup 2026").

- **Nhóm A, serif sang trọng, đủ dấu:** Playfair Display (thường + nghiêng), Cormorant Garamond, Prata, Lora, Noto Serif Display, Philosopher, SVN-Abril Fatface (đậm). *Gợi ý:* Playfair Display (tiêu đề), Cormorant Garamond (chứng chỉ trang nhã), Be Vietnam Pro (chữ thường).
- **Nhóm A, sans đủ dấu:** Be Vietnam Pro, Montserrat, Josefin Sans, Inter, Nunito, Darker Grotesque, Oswald, Alegreya Sans SC, SVN-Bebas Neue.
- Nhóm B (Việt hoá) serif/display đẹp: DFVN Arthemys Display, DFVN Mongek, SVN The Seasons, 1FTV Classy Vogue, 1FTV Argaka Fashion. **Lỗi dấu cần biết:** MTD Hello Paris Serif và TP Le Major — chữ hoa dính/đè nhau khi viết hoa liền (CHÀO, VIÊN), UTM Atlas bản `UTM Atlas.ttf` là kiểu bóng đổ nên chữ nhoè khi cỡ nhỏ.
- Nhóm C (đừng đóng gói khi bán): Garamond Premier Pro, Baskerville Display PT, Georgia, Gotham, Gilroy, Avenir, Myriad, Helvetica Neue, Arial, Candara. **Cảnh báo dấu:** nhiều bản trong kho **thiếu dấu** — Gilroy (90/186), Adobe Caslon/Garamond Pro (88/186), Didot HTF (82/186), Avenir (tệp `Avenir.ttc`, 12 mặt) chỉ mặt 'Heavy' đủ dấu — 4 mặt có 162/186 (thiếu Ơ Ư và các dấu trên Ơ Ư), 7 mặt chỉ 92/186, Arial Narrow/ARIALN (94/186).

## 6. Tệp trùng đã gộp

Giống hệt từng byte (mã băm giống nhau): `CormorantGaramond-Variable.ttf` = `CormorantGaramond.ttf` · `DancingScript-Variable.ttf` = `DancingScript.ttf` · `Montserrat-SemiBold 3.ttf` = `Montserrat-SemiBold.ttf` · `Oswald-Variable.ttf` = `Oswald.ttf` · `PlayfairDisplay-Italic-Variable.ttf` = `PlayfairDisplay-Italic.ttf` · `PlayfairDisplay-Variable.ttf` = `PlayfairDisplay.ttf` · `UTM Atlas.ttf` = `UTMAtlas.ttf` · `UTM Atlas_Solid.ttf` = `UTMAtlas-Solid.ttf`.

Cùng tên phông, khác tệp: `PLAYFAIRDISPLAY-REGULAR.TTF` ≈ `PlayfairDisplay.ttf` (bản tĩnh/bản biến thiên) · `DarkerGrotesque-Light.ttf` ≈ `DarkerGrotesque-VariableFont_wght.ttf` · `JetBrainsMono-Regular.ttf` ≈ `JetBrainsMono-Variable.ttf` · `Lora-Regular.ttf` ≈ `Lora-Variable.ttf` · `DFVN Desirable Calligraphy.otf` ≈ `.ttf` (cùng phông, hai định dạng).

## 7. Bảng kiểm kê (gộp theo họ phông)

Cột: **Họ phông** · **Tệp** · **Nhóm** · **Đủ dấu** (N/186) · **Kiểu** (tự đoán theo tên + PANOSE + ảnh xem nhanh; chỉ để tham khảo) · **Nhà làm / bản quyền trong tệp** · **Cờ nhúng** (fsType) · **Cơ sở nhóm** (điều đọc được trong tệp). Bảng đầy đủ chữ nguyên văn (ID0/8/9/13/14, vendor) nằm trong `kiem-ke-291-tep.csv`.


### Nhóm A — giấy phép mở — 31 họ

| Họ phông | Tệp | Đủ dấu | Kiểu | Nhà làm / bản quyền | Nhúng | Cơ sở nhóm |
|---|---|---|---|---|---|---|
| Alegreya Sans SC | `AlegreyaSansSC-Light.ttf` | 186/186 ✔ | Sans-serif | Juan Pablo del Peral | tự do | SIL OFL 1.1 (ID13/ID14) |
| Alex Brush | `AlexBrush-Regular.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Robert E. Leuschke | tự do | SIL OFL 1.1 (ID13/ID14) |
| Alfa Slab One | `AlfaSlabOne-Regular.ttf` | 186/186 ✔ | Slab/đậm trang trí | JM Sole | tự do | SIL OFL 1.1 (ID13/ID14) |
| Anton | `Anton.ttf` | 96/186 | Sans-serif | vernon adams | tự do | SIL OFL 1.1 (ID13/ID14) |
| Be Vietnam Pro | 6 tệp (`BeVietnamPro-Bold.ttf`…) | 186/186 ✔ | Sans-serif | Lam Bao, Tony Le, Vietanh Nguyen | tự do | SIL OFL 1.1 (ID13/ID14) |
| Bungee Inline | `BungeeInline-Regular.ttf` | 186/186 ✔ | Slab/đậm trang trí | David Jonathan Ross | tự do | SIL OFL 1.1 (ID13/ID14) |
| Cormorant Garamond | 6 tệp (`CormorantGaramond-Italic-Variable.ttf`…) | 186/186 ✔ | Serif | Christian Thalmann (Catharsis Fonts) | tự do | SIL OFL 1.1 (ID13/ID14) |
| Dancing Script | 2 tệp (`DancingScript-Variable.ttf`…) | 186/186 ✔ | Chữ ký/viết tay (script) | Pablo Impallari | tự do | SIL OFL 1.1 (ID13/ID14) |
| Darker Grotesque | 5 tệp (`DarkerGrotesque-ExtraBold.ttf`…) | 186/186 ✔ | Sans-serif | Gabriel Lam | tự do | SIL OFL 1.1 (ID13/ID14) |
| Ephesis | `Ephesis-Regular.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Robert E. Leuschke | tự do | SIL OFL 1.1 (ID13/ID14) |
| Great Vibes | `GreatVibes-Regular.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Robert E. Leuschke, Viktoriya Grabowska, Viviana… | tự do | SIL OFL 1.1 (ID13/ID14) |
| Inter | `Inter-Variable.ttf` | 186/186 ✔ | Sans-serif | Rasmus Andersson | tự do | SIL OFL 1.1 (ID13/ID14) |
| Italiana | `Italiana-Regular.ttf` | 84/186 | Serif | Santiago Orozco | tự do | SIL OFL 1.1 (ID13/ID14) |
| JetBrains Mono | 3 tệp (`JetBrainsMono-Regular.ttf`…) | 186/186 ✔ | Đơn cách (mono) | Philipp Nurullin, Konstantin Bulenkov | tự do | SIL OFL 1.1 (ID13/ID14) |
| Josefin Sans | `JosefinSans-Variable.ttf` | 186/186 ✔ | Sans-serif | Santiago Orozco | tự do | SIL OFL 1.1 (ID13/ID14) |
| Lora | 3 tệp (`Lora-Italic-Variable.ttf`…) | 186/186 ✔ | Serif | Olga Karpushina, Alexei Vanyashin (Cyrillic) | tự do | SIL OFL 1.1 (ID13/ID14) |
| MonteCarlo | `MonteCarlo-Regular.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Robert E. Leuschke | tự do | SIL OFL 1.1 (ID13/ID14) |
| Montserrat | 11 tệp (`Montserrat-Bold.ttf`…) | 186/186 ✔ | Sans-serif | Julieta Ulanovsky | tự do | SIL OFL 1.1 (ID13/ID14) |
| Noto Serif Display | `NotoSerifDisplay[wdth,wght].ttf` | 186/186 ✔ | Serif | Monotype Design Team | tự do | SIL OFL 1.1 (ID13/ID14) |
| Nunito | 3 tệp (`Nunito-Black.ttf`…) | 186/186 ✔ | Sans-serif | Vernon Adams | tự do | SIL OFL 1.1 (ID13/ID14) |
| Oswald | 6 tệp (`Oswald-Bold.ttf`…) | 186/186 ✔ | Sans-serif | Vernon Adams | tự do | SIL OFL 1.1 (ID13/ID14) |
| Pacifico | `Pacifico-Regular.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Vernon Adams | tự do | SIL OFL 1.1 (ID13/ID14) |
| Philosopher | 2 tệp (`Philosopher-Italic.ttf`…) | 186/186 ✔ | Serif | Jovanny Lemonad | tự do | SIL OFL 1.1 (ID13/ID14) |
| Pinyon Script | `PinyonScript-Regular.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Nicole Fally, Eben Sorkin | tự do | SIL OFL 1.1 (ID13/ID14) |
| Playfair Display | 6 tệp (`PLAYFAIRDISPLAY-REGULAR.TTF`…) | 186/186 ✔ | Serif | Claus Eggers Sørensen | tự do | SIL OFL 1.1 (ID13/ID14) |
| Poppins | `Poppins-Light.ttf` | 98/186 | Sans-serif | Ninad Kale (Devanagari), Jonny Pinhorn (Latin) | tự do | SIL OFL 1.1 (ID13/ID14) |
| Prata | `Prata-Regular.ttf` | 186/186 ✔ | Serif | Ivan Petrov | tự do | SIL OFL 1.1 (ID13/ID14) |
| Roboto Slab | `RobotoSlab-Variable.ttf` | 186/186 ✔ | Slab/đậm trang trí | Google | tự do | Apache 2.0 (ID13/ID14) |
| SVN-Abril Fatface | `SVN-Abril Fatface.ttf` | 186/186 ✔ | Serif (đậm) | Veronika Burian, Jos? Scaglione | tự do | SIL OFL 1.1 (ID13/ID14) |
| SVN-Bebas Neue | `SVN-Bebas-Neue-Bold.ttf` | 186/186 ✔ | Sans-serif | Ryoichi Tsunekawa | tự do | SIL OFL 1.1 (ID13/ID14) |
| WindSong | 2 tệp (`WindSong-Medium.ttf`…) | 186/186 ✔ | Chữ ký/viết tay (script) | Robert E. Leuschke | tự do | SIL OFL 1.1 (ID13/ID14) |

### Nhóm B — phông Việt hoá — 67 họ

| Họ phông | Tệp | Đủ dấu | Kiểu | Nhà làm / bản quyền | Nhúng | Cơ sở nhóm |
|---|---|---|---|---|---|---|
| #9Slide04 Aria Pro | `#Beyovn04 Aria Pro.ttf` | 186/186 ✔ | Sans-serif | Rui Abreu | tự do | tệp không ghi giấy phép |
| #9Slide05 Beautiful Caps | `#Beyovn05 Beautiful Caps.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Thi?t k? b?i Michael ?inh Kiên - "In God We Trus… | tự do | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| #9Slide05 Pateglamt Script | `#Beyovn05 PATEGLAMT-SCRIPT.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | iTypeface | tự do | Copyright (c) 2016 by iTypeface.com . All rights reserved. / http://itypeface.com |
| #Script03 Beautiful Caps | `#Script03 Beautiful Caps Regular.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Thi?t k? b?i Michael ?inh Kiên - "In God We Trus… | tự do | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| 1FTV Blushing Rose | `1FTV-Blushing-Rose.ttf` | 186/186 ✔ | Serif | Gholib Tamami,  Sarid Ezra | tự do | tệp không ghi giấy phép |
| 1FTV Cakelan | `1FTV-Cakelan.otf` | 186/186 ✔ | Serif | Mulie Art | tự do | tệp không ghi giấy phép |
| 1FTV VIP Amoslenty | `1FTV-VIP-Amoslenty-italic.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Jada Akbal | tự do | tệp không ghi giấy phép |
| 1FTV VIP Argaka Fashion | `1FTVVIPArgakaFashion-Regular.ttf` | 186/186 ✔ | Serif | Sigit Dwipa Raharjo | sửa | https://nirmanavisual.com/ |
| 1FTV VIP Bastliga One | `1FTV-VIP-Bastliga-One-Regular.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | HL | tự do | tệp không ghi giấy phép |
| 1FTV VIP Bethany Avanue | `1FTV-VIP-Bethany-Avanue.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Yudi Pratama Chandra | tự do | http://www.rantaustudio.com |
| 1FTV VIP Braven | `1FTVVIPBraven-Regular.ttf` | 186/186 ✔ | Serif | Toni Studio | tự do | tệp không ghi giấy phép |
| 1FTV VIP Capricious Ambrosia | `1FTV-VIP-Capricious-Ambrosia.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Rinaldo Hasibuan | tự do | Copyright (c) 2023 Rinaldo Hasibuan (Letterhanna Studio) https://letterhanna.com/license/ / https://… |
| 1FTV VIP Classy Vogue | `1FTV-VIP-Classy-Vogue.otf` | 186/186 ✔ | Serif | Mukhlis Muhammad | tự do | tệp không ghi giấy phép |
| 1FTV VIP Delicate Elegance | `1FTV-VIP-Delicate-Elegance.ttf` | 186/186 ✔ | Sans-serif | Masyafi Studio | sửa | tệp không ghi giấy phép |
| 1FTV VIP Freshome | `1FTV-VIP-Freshome-1.ttf` | 186/186 ✔ | Trang trí (display) | Ryomiscie | tự do | tệp không ghi giấy phép |
| 1FTV VIP Halone | `1FTV-VIP-Halone.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | hanifmaulazi | xem/in | tệp không ghi giấy phép |
| 1FTV VIP Molahesta | `1FTV-VIP-Molahesta-Italic.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Heru Utama Putra | tự do | ©Storytype Studio 2021. All Rights Reserved / https://letterena.com/product-category/storytype/ |
| 1FTV VIP Peach Club | `1FTV-VIP-Peach-Club.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Burhan Afif | tự do | tệp không ghi giấy phép |
| 1FTV VIP Perfect Girl | `1FTV-VIP-Perfect-Girl-SansSerif.ttf` | 186/186 ✔ | Sans-serif | Yudi Pratama Chandra | tự do | http://www.rantaustudio.com |
| 1FTV VIP Santa Catalina | `1FTV-VIP-Santa-Catalina.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | (your company). 2023 | tự do | tệp không ghi giấy phép |
| 1FTV VIP The Rambler | `1FTV-VIP-The-Rambler.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Kong Font (kongvector@gmail.com) | tự do | tệp không ghi giấy phép |
| Desirable Calligraphy | 2 tệp (`DFVN Desirable Calligraphy.otf`…) | 90/186 | Chữ ký/viết tay (script) | Sukjana Almunandar | xem/in | tệp không ghi giấy phép |
| DFVN Arthemys Display | `DFVN Arthemys Display Light.otf` | 186/186 ✔ | Serif | Morgane Vantorre | xem/in | Copyright © 2020 by Morgane Vantorre. All rights reserved. |
| DFVN Boheme Floral | `DFVN Boheme Floral.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | 50Fox | tự do | tệp không ghi giấy phép |
| DFVN Fashion Wacks | `DFVN Fashion Wacks.otf` | 186/186 ✔ | Serif | Sigit Dwipa Raharjo | xem/in | New Value / https://nirmanavisual.com/ |
| DFVN Love | `DFVN Love Typeface.otf` | 186/186 ✔ | Serif | Jeremy Schneider | tự do | tệp không ghi giấy phép |
| DFVN Mongek | `DFVN Mongek Bold.otf` | 186/186 ✔ | Serif | Kana Widana | sửa | tệp không ghi giấy phép |
| Fz DucThuy Thuphap | `Fz DucThuyThuPhap.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | ducthuy@fontzin.com | xem/in | DucThuy © 2023 Font Zin . All rights reserved / https://fontzin.com/license |
| Fz JHW Monoline Signature | `Fz-JHW-Monoline-Signature.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Perspectype Studio | tự do | ©Perspectype Studio 2021. All Rights Reserved / studioperspectype@gmail.com |
| Fz Thu Phap Giao Long Full | `Fz-Thu-Phap-Giao-Long-Full.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | https://m.me/hieufz | tự do | Thiet ke boi Thai Hieu - dua tren net chu Giao Long |
| FZ-SG Pressio-No.25 | `vn co (10).ttf` | 186/186 ✔ | Sans-serif | Max Phillips | xem/in | tệp không ghi giấy phép |
| HLT Burgues Script | `HLT Burgues Script.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Viet hoa by UhThilahuvo | tự do | Viet hoa by UhThilahuvo - chipquay@gmail.com / https://www.facebook.com/hoanglangtu.info |
| HLT JaneAusten | `HLT JaneAust.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Viet hoa by UhThiLaHuVo | sửa | Viet hoa by UhThilahuvo - chipquay@gmail.com / https://www.facebook.com/hoanglangtu.info |
| MTD Afecta | `MTD Afecta.otf` | 186/186 ✔ | Trang trí (display) | Ilham Herry | xem/in | tệp không ghi giấy phép |
| MTD Ariestha | `MTD Ariestha.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | R A M Z | xem/in | tệp không ghi giấy phép |
| MTD Australian Script | `MTD Australian Script.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | darwinoo | tự do | tệp không ghi giấy phép |
| MTD Hello Paris Serif | `MTD Hello Paris Serif.otf` | 186/186 ✔ | Serif | Sans&Sons. Viet hoa by MTD | xem/in | tệp không ghi giấy phép |
| MTD Maryatha | `MTD-Maryatha-1.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Ryan Prasetya | tự do | tệp không ghi giấy phép |
| MTD Mavera | `MTD-Mavera.otf` | 186/186 ✔ | Trang trí (display) | Kadek Adi Mahardika | sửa | tệp không ghi giấy phép |
| MTD Thank You So Much | `MTD Thank You So Much.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Situjuh Nazara | tự do | tệp không ghi giấy phép |
| MTD Voyage Regular | `MTD Voyage Regular.otf` | 186/186 ✔ | Serif | Violaine et Jérémy | sửa | tệp không ghi giấy phép |
| MTD VVD Golden Horn | `MTD VVD Golden Horn.otf` | 186/186 ✔ | Serif | Pavel Korzhenko | sửa | tệp không ghi giấy phép |
| NBN Didot | `NBNDidotRoman.otf` | 186/186 ✔ | Serif | Font chï ti¿ng ViÇt Unicode. Các ký tñ ti¿ng ViÇ… | sửa | tệp không ghi giấy phép |
| NVN Cameo Sweet | `NVNCameoSweet-Style-1.ttf` | 186/186 ✔ | Trang trí (display) | Kadek Adi Mahardika | sửa | tệp không ghi giấy phép |
| NVN Selfie | `NVNSelfie-Light.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Maximiliano R. Sproviero | tự do | tệp không ghi giấy phép |
| SVN-Agoka | `SVN-Agoka-Italic.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Delip Nugraha | tự do | Sold |
| SVN-Archaic 1897 | `SVN-Archaic 1897.ttf` | 186/186 ✔ | Serif | Paul  Davy | tự do | tệp không ghi giấy phép |
| SVN-Canopee | `SVN-Canopee.otf` | 186/186 ✔ | Serif | Jeremy Schneider | tự do | tệp không ghi giấy phép |
| SVN-Famous | `SVN-Famous.otf` | 186/186 ✔ | Sans-serif | Zamroni Hamzah | tự do | sensatype.com |
| SVN-Hottroof Semhesta | `SVN-Hottroof-Semhesta.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Pineungtype | xem/in | tệp không ghi giấy phép |
| SVN-Janelotus | `SVN-Janelotus.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | lemonthe.Dwi Ahidian | tự do | lemonthe |
| SVN-MORVA | `SVN MORVA.ttf` | 186/186 ✔ | Serif | Alit Suarnegara | xem/in | tệp không ghi giấy phép |
| SVN-Rustling Sound | `SVN-Rustling-Sound.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Muhamad Yusron  Billah | tự do | tệp không ghi giấy phép |
| SVN-The Seasons | `SVN-TheSeasons-Regular.otf` | 186/186 ✔ | Serif | Elena Genova | tự do | tệp không ghi giấy phép |
| TP Le Major | `TP Le Major.ttf` | 186/186 ✔ | Serif | Oksana Petrenko | tự do | Additional characters added by Tuyn Pucca tuyentln1990@gmail.com |
| UTM A&S Heartbeat | `UTM A&S Heartbeat.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Thiết kế bởi Michael Đinh Kiên - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM Atlas | 4 tệp (`UTM Atlas.ttf`…) | 186/186 ✔ | Sans-serif | Thiết kế bởi Michael Đinh Kiên - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM Banque | `UTM BanqueR.ttf` | 186/186 ✔ | Sans-serif | Thiet ke boi Michael Dinh Kien - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM Hanzel | `UTM Hanzel.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | Thiết kế bởi Michael Đinh Kiên - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM LinotypeZapfino KT | `UTM LinotypeZapfino KT.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Thiết kế bởi Michael Đinh Kiên - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM Ong Do Gia | `UTMOngDoGia.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | Thiet ke boi Michael Dinh Kien - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM Ong Do Tre | `UTM Ong Do Tre.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | Thiết kế bởi Michael Đinh Kiên - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM ThuPhap Thien An | `UTM-ThuPhap-Thien-An-dzwj7m.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | Thiet ke boi Michael Dinh Kien - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| UTM Yen Tu | `UTM Yen Tu.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Thiet ke boi Michael Dinh Kien - "In God We Trus… | lẫn(cấm+xem/in) | 'In God We Trust - Free for everyone' (Michael Đinh Kiên); không có văn bản giấy phép đầy đủ |
| VanHung-Melika Letter | `VANHUNG-MELIKA LETTER.OTF` | 186/186 ✔ | Chữ ký/viết tay (script) | @zamroni_agus | tự do | tệp không ghi giấy phép |
| VL Hullist | `VLHULLIST.OTF` | 186/186 ✔ | Chữ ký/viết tay (script) | Agung Syaifudin  www.creativemarket.com/vuuuds w… | tự do | tệp không ghi giấy phép |
| VN Jonathan Andrea | `VN-Jonathan-Andrea-Script.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Riyadh Rahman | tự do | tệp không ghi giấy phép |

### Nhóm C — thương mại / hệ điều hành / DEMO / cá nhân — 79 họ

| Họ phông | Tệp | Đủ dấu | Kiểu | Nhà làm / bản quyền | Nhúng | Cơ sở nhóm |
|---|---|---|---|---|---|---|
| 1FTV VIP Billie James | `1FTV-VIP-Billie-James.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Ardian Nuvianto | tự do | 'You can not resell, share or giveaway the font files' |
| 1FTV VIP Boogo | `1FTV-VIP-Boogo.ttf` | 186/186 ✔ | Trang trí (display) | Letterara | CẤM | 'Personal use only' |
| 1FTV VIP Christmas Sundaylab | `1FTV-VIP-Christmas-Sundaylab.otf` | 186/186 ✔ | Trang trí (display) | Dida Ahluddin | xem/in | 'Personal Use Please visit www.ahweproject.com to obtain a commercial license.' |
| 1FTV VIP Signerica Fat | `1FTV-VIP-Signerica-Fat.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Måns Grebäck | xem/in | 'PERSONAL USE ONLY! For commercial use, mail mawns@live.se' |
| 1FTV VIP Sparkling Valentine | `1FTV-VIP-Sparkling-Valentine.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | CAT.B | xem/in | 'FREE FOR PERSONAL USE ONLY' |
| 1FTV VIP Valter Std | `1FTV-VIP-Valter-Std.ttf` | 186/186 ✔ | Serif | Nikola Djurek | sửa | 'Typotheque Font Software is protected ...' + EULA |
| 1FTV VIP Welcome Christmas | `1FTV-VIP-Welcome-Christmas.ttf` | 186/186 ✔ | Trang trí (display) | Alpaprana Studio | tự do | 'Personal Use Only!' |
| Adobe Caslon Pro | 2 tệp (`ACaslonPro-Bold.otf`…) | 88/186 | Serif | Carol Twombly | lẫn | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Adobe Garamond Pro | 2 tệp (`AGaramondPro-Italic.otf`…) | 88/186 | Serif | Robert Slimbach | lẫn | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Ambrosius Aurelianus | `Ambrosius.ttf` | 52/186 | Serif | Phillip Andrade, 1999 | tự do | 'This is shareware. For personal use please send $15 (US) to the address below. For use in a publica… |
| Antro Vectra | `Antro_Vectra_Bolder.otf` | 84/186 | Chữ ký/viết tay (script) | Youssef Habchi | xem/in | 'Free for personal use only.' |
| Arial | 3 tệp (`ARIALN.TTF`…) | 94–186/186 | Sans-serif | Robin Nicholas, Patricia Saunders | sửa/tự do | tệp ghi bản quyền của hãng: '© 2008 The Monotype Corporation. All Rights Reserved.' — phông thương m… |
| Arsenica Trial | 2 tệp (`Arsenica Trial Bold 700.ttf`…) | 111/186 | Trang trí (display) | Francesco Canovaro | sửa | tên tệp 'Arsenica Trial Bold 700.ttf' / tên phông 'Arsenica Trial' ghi bản demo/trial/free/personal |
| Avenir | `Avenir.ttc` | 92–186/186 | Sans-serif | Adrian Frutiger | xem/in | tệp ghi bản quyền của hãng: 'Copyright© 2007 Linotype GmbH, www.linotype.com. All rights reserved.' … |
| Ayudisha Demo | `Ayudisha-Free-Version.ttf` | 87/186 | Chữ ký/viết tay (script) | Rudy Muhardika | tự do | tên tệp 'Ayudisha-Free-Version.ttf' / tên phông 'Ayudisha Demo' ghi bản demo/trial/free/personal |
| Baskerville Display PT | `Baskerville Display PT.otf` | 186/186 ✔ | Serif | Arina Alaferdova, Dmitry Kirsanov | tự do | tệp trỏ tới trang cấp phép ParaType (nhận biết: phông thương mại) |
| Baskerville Old Face | `BASKVILL.TTF` | 84/186 | Serif | Stephenson Blake (Holdings) Ltd. Data © 1992 URW… | sửa | tệp ghi bản quyền của hãng: 'Typeface © 1992 Stephenson Blake (Holdings) Ltd. Data © 1992 URW. Porti… |
| BD Megalona DEMO Personal Use Only | `BDMegalonaDEMOPersonalUseOnly-RegularItalic.otf` | 52/186 | Chữ ký/viết tay (script) | Balibilly Design | sửa | 'Hi there,  Hope you doing well.  This is a TRIAL VERSION of BD Megalona. You are not allowed to use… |
| Bell MT | 2 tệp (`BELL.TTF`…) | 84/186 | Serif | The Monotype Corporation plc. Data © The Monotyp… | sửa | tệp ghi bản quyền của hãng: 'Typeface © The Monotype Corporation plc. Data © The Monotype Corporatio… |
| Brigitte Eigner | `Brigitte Eigner.ttf` | 84/186 | Chữ ký/viết tay (script) | Daddi Daryawan | xem/in | 'Dafont for personal use/ Demo' |
| Californian FB | `CALIFI.TTF` | 84/186 | Serif | David Berlow | sửa | tệp ghi bản quyền của hãng: 'Copyright (c) 1989, 1994, 1997, 1998, The Font Bureau, Inc. Designed by… |
| Candara | `Candaral.ttf` | 186/186 ✔ | Sans-serif | Monotype Design Team | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| Courier New | 2 tệp (`cour.ttf`…) | 186/186 ✔ | Đơn cách (mono) | Howard Kettler | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| Didot | 3 tệp (`Didot-HTF-B06-Bold-Ital.ttf`…) | 82/186 | Serif | HTF Didot   1992 The Hoefler Type Foundry, Inc. … | tự do | tệp ghi bản quyền của hãng: 'HTF Didot   1992 The Hoefler Type Foundry, Inc. This typeface and the d… |
| Ebrima | `ebrima.ttf` | 110/186 | Sans-serif | Microsoft Corporation | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| Effra | `SVN-Effra Italic.ttf` | 186/186 ✔ | Sans-serif | Jonas Schudel | xem/in | 'may not be altered ... without prior permission of Dalton Maag' |
| Franklin Gothic Heavy | `FRAHV.TTF` | 94/186 | Sans-serif | Victor Caruso | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| Fz Fashion Signature | `FzFashionSignature.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | Letterara | sửa | 'Personal use only' |
| Fz Thu phap DT Fontzin | `Fz Thu phap DT Fontzin.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | Thai Hieu | tự do | tệp ghi (không dấu): 'sử dụng mục đích cá nhân & phi thương mại' |
| Fz ThuPhapButBi | `Fz ThuPhapButBi Full.ttf` | 186/186 ✔ | Thư pháp/cọ (Việt) | Duc Thuy | xem/in | tệp ghi (không dấu): 'Bản full dành cho thương mại, vui lòng liên hệ tác giả để được cấp quyền' |
| Garamond Premier Pro | `GaramondPremrPro.otf` | 186/186 ✔ | Serif | Robert Slimbach | sửa | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Gilroy-Bold | `Gilroy-Bold.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Light | `Gilroy-Light.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-LightItalic | `Gilroy-LightItalic.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Medium | `Gilroy-Medium.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-MediumItalic | `Gilroy-MediumItalic.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Regular | `Gilroy-Regular.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-RegularItalic | `Gilroy-RegularItalic.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-SemiBold | `Gilroy-SemiBold.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-SemiBoldItalic | `Gilroy-SemiBoldItalic.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Thin | `Gilroy-Thin.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-UltraLightItalic | `Gilroy-UltraLightItalic.ttf` | 90/186 | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Haigrast Script PERSONAL USE | `HaigrastScript_PERSONAL_USE_ONLY.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Mans Greback | sửa | tên tệp 'HaigrastScript_PERSONAL_USE_ONLY.otf' / tên phông 'Haigrast Script PERSONAL USE' ghi bản de… |
| Hamillton Demo | `HAMILLTON demo.ttf` | 52/186 | Chữ ký/viết tay (script) | Ardyanatypes | xem/in | 'free for personal use' |
| Hathem Bosteem FREE | `Hathem Bosteem.ttf` | 52/186 | Chữ ký/viết tay (script) | Muhammad Farhan Sholeh Ramadhika | tự do | 'FREE VERSION ! This font was created using FontCreator 11.5 from High-Logic.com' |
| Helvetica Neue | `HelveticaNeueLight.otf` | 186/186 ✔ | Sans-serif | and the property of Linotype-Hell AG and/or its … | tự do | tệp ghi bản quyền của hãng: 'Copyrighted (c) 1981, 1997 by and the property of Linotype-Hell AG and/… |
| High Spirited | `High Spirited.ttf` | 84/186 | Chữ ký/viết tay (script) | Octotype | xem/in | 'Free for personal use' |
| Hijrnotes PERSONAL USE ONLY 01 | `Hijrnotes_PERSONAL_USE_ONLY.ttf` | 94/186 | Chữ ký/viết tay (script) | Hendra Pratama | xem/in | tên tệp 'Hijrnotes_PERSONAL_USE_ONLY.ttf' / tên phông 'Hijrnotes PERSONAL USE ONLY 01' ghi bản demo/… |
| iCiel Bambola | `iCielBambola.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Ricardo Rousselot | xem/in | 'Standard License Agreement ... licensed for use on 2 output devices' (EdyType) |
| iCiel Gotham | `Gotham-Medium.otf` | 186/186 ✔ | Sans-serif | Hoefler & Frere-Jones | xem/in | có EULA của hãng (typography.com/support/eula.html) |
| JaneAusten | `JaneAust.ttf` | 94/186 | Chữ ký/viết tay (script) | Pia Frauss | sửa | 'Pia Frauss fecit AD MMV; for private use only' |
| Juliette | `Juliette.otf` | 84/186 | Chữ ký/viết tay (script) | Ferry Ardana Putra + Bluetype | CẤM | 'PERSONAL USE ONLY' |
| MADE Canvas | `MADE Canvas Light PERSONAL USE.otf` | 94/186 | Serif | MadeType | xem/in | 'Free for personal use ONLY.' |
| MADE SAONARA | `MADE SAONARA PERSONAL USE.otf` | 94/186 | Chữ ký/viết tay (script) | MadeType | xem/in | 'Free for personal use ONLY' |
| MADE SAONARA 2 | `MADE SAONARA 2 PERSONAL USE.otf` | 94/186 | Chữ ký/viết tay (script) | MadeType | xem/in | 'Free for personal use ONLY' |
| Merona Island DEMO | `MeronaIslandDemoRegular-3lnyM.otf` | 86/186 | Sans-serif | Ratna Krismawati | sửa | 'Merona Island Typeface for PERSONAL USE ONLY' |
| Microsoft Sans Serif | `micross.ttf` | 186/186 ✔ | Sans-serif | Microsoft Corporation | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| Minion Pro | `MinionPro-Regular.otf` | 186/186 ✔ | Serif | Robert Slimbach | sửa | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Mongolian Baiti | `monbaiti.ttf` | 84/186 | Serif (chữ Mông Cổ) | Founder, Beijing China | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| MTD Gilroy Medium | `MTD Gilroy Medium.ttf` | 186/186 ✔ | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| MTD Madame Cosmetics | `MTD Madame Cosmetics.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Octotype | xem/in | 'This font is free for personal use' |
| Myriad Pro | `MyriadPro-Regular.otf` | 186/186 ✔ | Sans-serif | Robert Slimbach and Carol Twombly | sửa | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| NewYork | `NewYork PERSONAL USE.otf` | 94/186 | Serif | Artem Nevsky | xem/in | 'free for personal use' |
| Niagara Engraved | `NIAGENG.TTF` | 84/186 | Trang trí (display) | Tobias Frere-Jones | sửa | tệp ghi bản quyền của hãng: 'Copyright (c) 1994, Tobias Frere-Jones. Designed by Tobias Frere-Jones.… |
| Perpetua Titling MT | `PERTILI.TTF` | 84/186 | Serif | Eric Gill | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| Season Serif-TRIAL | `SeasonSerif-TRIAL-Regular.otf` | 108/186 | Serif | Martin Vácha | tự do | tên tệp 'SeasonSerif-TRIAL-Regular.otf' / tên phông 'Season Serif-TRIAL' ghi bản demo/trial/free/per… |
| Signature Collection | `Signature Collection.ttf` | 84/186 | Chữ ký/viết tay (script) | DENIS | tự do | 'THIS DEMO FONT IS FOR PERSONAL USE ONLY!' |
| Signerica Fat | `Signerica_Fat.ttf` | 94/186 | Chữ ký/viết tay (script) | Måns Grebäck | xem/in | 'PERSONAL USE ONLY! For commercial use, mail mawns@live.se' |
| SP3 - Traveling Typewriter | `SP3 - Traveling Typewriter.otf` | 186/186 ✔ | Đơn cách (mono) | Carl Krull vs. SP3 Subteam | xem/in | 'Free for personal use only!' |
| STSong | `chinese.stsong.ttf` | 94/186 | Serif | Changzhou SinoType Technology Co., Ltd. | sửa | tệp ghi bản quyền của hãng: 'Copyright (c) 1991-1998, Changzhou SinoType Technology Co., Ltd.  All r… |
| SVN-Bradley Hand | `SVN-Braley Hand.ttf` | 186/186 ✔ | Chữ ký/viết tay (script) | STYLEno.1 | sửa | Bradley Hand ITC là phông thương mại (nhận biết theo tên họ phông); tệp không ghi điều khoản |
| SVN-Georgia | `SVN-Georgia Bold Italic.otf` | 186/186 ✔ | Serif | Matthew Carter | sửa | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms o… |
| SVN-Gilroy | 2 tệp (`SVN-Gilroy Medium.otf`…) | 186/186 ✔ | Sans-serif | Radomir Tinkov | xem/in | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| SVN-Gotham | 6 tệp (`SVN-Gotham Black.otf`…) | 186/186 ✔ | Sans-serif | Tobias Frere-Jones | xem/in | có EULA của hãng (typography.com/support/eula.html) |
| The Coastal Free | `The Coastal.ttf` | 84/186 | Chữ ký/viết tay (script) | Eep Apringga / Namara Creative Studio | tự do | 'This Version is for PERSONAL USE ONLY, NO COMMERCIAL USE ALLOWED.' |
| The Excited | `TheExcited.ttf` | 84/186 | Chữ ký/viết tay (script) | Putra Novembria Candra Kusuma | tự do | giấy phép theo nơi mua phông; cần giấy phép mở rộng |
| ThrohandW01-Roman | `Throhand W01 Roman.ttf` | 84/186 | Serif | David Berlow | sửa | 'NOTIFICATION OF LICENSE AGREEMENT' (ITC/Monotype) |
| TT Wellingtons Trl | `TT Wellingtons Trial Regular.otf` | 88/186 | Serif | TypeType | tự do | 'TT Wellingtons Trial is designed for font testing and cannot be used in personal or commercial proj… |
| VanHung-High Spirited | `VanHung-High Spirited.otf` | 186/186 ✔ | Chữ ký/viết tay (script) | Octotype | tự do | 'Free for personal use' |

### Nhóm D — không rõ (tệp không ghi) — 50 họ

| Họ phông | Tệp | Đủ dấu | Kiểu | Nhà làm / bản quyền | Nhúng | Cơ sở nhóm |
|---|---|---|---|---|---|---|
| 00 Starmap Truetype | `00TT.TTF` | 52/186 | Ký hiệu/bitmap | Iconian Fonts | tự do | tệp không ghi giấy phép |
| 00216 | `00216.ttf` | 85/186 | Serif | Generated by Fontographer 4.1.5 | tự do | tệp không ghi giấy phép |
| 00222 | `00222.ttf` | 85/186 | Sans-serif | Generated by Fontographer 4.1.5 | tự do | tệp không ghi giấy phép |
| 00252 | `00252.ttf` | 85/186 | Serif | Generated by Fontographer 4.1.5 | tự do | tệp không ghi giấy phép |
| Aberatta | `Aberatta.otf` | 52/186 | Chữ ký/viết tay (script) | Pineungtype | xem/in | tệp không ghi giấy phép |
| Adoha | `Adoha.otf` | 92/186 | Serif | Heru Utama Putra | tự do | ©Storytype Studio 2021. All Rights Reserved / https://letterena.com/product-category/storytype/ (khô… |
| Agatho | 2 tệp (`Agatho_ Light.otf`…) | 84/186 | Serif | Andrii Shevchyk | tự do | Please visit andfonts.com / Please visit andfonts.com (không rõ điều khoản) |
| Aire Bold Std | `Aire-Bold-Std.ttf` | 97/186 | Serif | Maximiliano R. Sproviero | xem/in | tệp không ghi giấy phép |
| Anything Script_1 | `Anything Script_1 Italic TTF.ttf` | 84/186 | Chữ ký/viết tay (script) | Aldedesign 2019 (Alde Saputro) | tự do | tệp không ghi giấy phép |
| Anything Script_3 | `Anything Script_3 TTF.ttf` | 84/186 | Chữ ký/viết tay (script) | Aldedesign 2019 (Alde Saputro) | tự do | tệp không ghi giấy phép |
| Anything Script_4 | `Anything Script_4 TTF.ttf` | 84/186 | Chữ ký/viết tay (script) | Aldedesign 2019 (Alde Saputro) | tự do | tệp không ghi giấy phép |
| Arsellia | `Arsellia.otf` | 88/186 | Chữ ký/viết tay (script) | Yudi Pratama Chandra | tự do | http://www.rantaustudio.com (không rõ điều khoản) |
| ArtBrush | `Artbrush.ttf` | 52/186 | Chữ ký/viết tay (script) |  | tự do | tệp không ghi giấy phép |
| Aston Script Bold | `Aston Script.ttf` | 82/186 | Chữ ký/viết tay (script) | TRF | xem/in | tệp không ghi giấy phép |
| Berlishanty Calligraphy | `Berlishanty Calligraphy.otf` | 84/186 | Chữ ký/viết tay (script) | Perspectype Studio | tự do | ©Perspectype Studio 2021. All Rights Reserved / studioperspectype@gmail.com (không rõ điều khoản) |
| Betterworks | `Betterworks.otf` | 84/186 | Chữ ký/viết tay (script) | Betterworks © (Letteralle). 2019 | tự do | tệp không ghi giấy phép |
| BigApple | `BIGAPPLE.TTF` | 88/186 | Trang trí (display) | Nick Curtis Generated by Fontographer 3.52 | xem/in | tệp không ghi giấy phép |
| Billion | `Billion.otf` | 87/186 | Chữ ký/viết tay (script) | Agung Rohmat | tự do | installable item (không rõ điều khoản) |
| Bliss | `Bliss Normal.ttf` | 84/186 | Serif | Arts & Letters Corporation | tự do | tệp không ghi giấy phép |
| BodoniFLF | `BodoniFLF-Roman.ttf` | 84/186 | Serif | 4.1 (c)1986-92 by Richard A. Ware | tự do | tệp không ghi giấy phép |
| BOSQUE | `BOSQUE.otf` | 84/186 | Chữ ký/viết tay (script) | Rahmatillah | xem/in | tệp không ghi giấy phép |
| Broad | `BROAD.ttf` | 84/186 | Trang trí (display) | Apostrophe | tự do | tệp không ghi giấy phép |
| Bully | `Bully Normal.ttf` | 84/186 | Trang trí (display) | Arts & Letters Corporation | tự do | tệp không ghi giấy phép |
| Ceremonious One | `Ceremonious One.ttf` | 52/186 | Serif | Ivan D. Zeifert | tự do | tệp không ghi giấy phép |
| Chaney-Extended | `Chaney-Extended Normal.ttf` | 84/186 | Trang trí (display) | Arts & Letters Corporation | CẤM | tệp không ghi giấy phép |
| CREMISSS | `CREMISSS.otf` | 84/186 | Serif | ToniStudio | tự do | tệp không ghi giấy phép |
| Cynthia  Blooms | `Cynthia Blooms .otf` | 92/186 | Chữ ký/viết tay (script) | Hendra Maulia | xem/in | www.dirtylinestudio.com/license / www.dirtylinestudio.com/license (không rõ điều khoản) |
| Dryhten | `DryhtenRegular.ttf` | 92/186 | Serif | iordanis passas | tự do | tệp không ghi giấy phép |
| Erangle | `ErangleRegular-9Yed2.otf` | 86/186 | Serif | khaidir | xem/in | tệp không ghi giấy phép |
| Gangitem | `Gangitem.otf` | 82/186 | Serif | 177Studio.com | tự do | 177Studio.com (không rõ điều khoản) |
| Gardenia Summer | `Gardenia Summer.ttf` | 52/186 | Chữ ký/viết tay (script) | Balpirick 2020 | tự do | tệp không ghi giấy phép |
| Griffiths | `Griffiths.otf` | 84/186 | Serif | Muammar Kadafi | xem/in | tệp không ghi giấy phép |
| HavanaSunset Script Alt | `havana-sunset-script-alt.ttf` | 84/186 | Chữ ký/viết tay (script) | Set Sail Studios | tự do | tệp không ghi giấy phép |
| Heanffe | `Heanffe.ttf` | 52/186 | Chữ ký/viết tay (script) | Letterara 2019 | tự do | tệp không ghi giấy phép |
| Janetta Silloam | `Janetta Silloam.otf` | 84/186 | Chữ ký/viết tay (script) | (your company). 2019 | tự do | tệp không ghi giấy phép |
| Karlotte | 2 tệp (`Karlotte-MVq0x.otf`…) | 84/186 | Serif | Dora Typefoundry | xem/in | tệp không ghi giấy phép |
| Ladyday | `Ladyday.otf` | 84/186 | Chữ ký/viết tay (script) | Perspectype Studio | tự do | ©Perspectype Studio 2021. All Rights Reserved / studioperspectype@gmail.com (không rõ điều khoản) |
| Le Major | `LeMajor-Regular.otf` | 90/186 | Serif | Oksana Petrenko | sửa | tệp không ghi giấy phép |
| Marthinoul | `Marthinoul.ttf` | 84/186 | Chữ ký/viết tay (script) | (KongFont). 2020 | tự do | tệp không ghi giấy phép |
| Medhurst | `Medhurst-regular.ttf` | 84/186 | Serif | Paul  Davy | tự do | tệp không ghi giấy phép |
| Melika Letter | `zMelika Letter.ttf` | 84/186 | Chữ ký/viết tay (script) | @zamroni_agus | xem/in | tệp không ghi giấy phép |
| MonthGlade | `MonthGlade.otf` | 84/186 | Chữ ký/viết tay (script) | Sronstudio | tự do | tệp không ghi giấy phép |
| Nomark | `Nomark.otf` | 84/186 | Serif | Ahmad Sidiq | tự do | tệp không ghi giấy phép |
| Photograph Signature | `Photograph Signature.ttf` | 84/186 | Chữ ký/viết tay (script) | typeline studio 2018 | tự do | tệp không ghi giấy phép |
| Pringle And Tweed | `Pringle And Tweed.ttf` | 84/186 | Chữ ký/viết tay (script) | Nicky Laatz | tự do | Licensed by Nicky Laatz / /license (không rõ điều khoản) |
| PS-Montero | `PS-Montero-Regular.otf` | 90/186 | Sans-serif | Pixel Surplus | sửa | tệp không ghi giấy phép |
| Soligant | `Soligant.otf` | 84/186 | Serif | Risca Anitawati | tự do | tệp không ghi giấy phép |
| Sophia Martini | `Sophia Martini.otf` | 84/186 | Chữ ký/viết tay (script) | Sophia Martini © (your company). 2019 | tự do | tệp không ghi giấy phép |
| The Castle Elizah | `The Castle Elizah.otf` | 84/186 | Chữ ký/viết tay (script) | Heru Utama Putra | tự do | ©Letterena Studios 2020. All Rights Reserved / https://www.creativefabrica.com/designer/letterenastu… |
| Welliams | `Welliams.ttf` | 84/186 | Chữ ký/viết tay (script) | Graphicpress | xem/in | tệp không ghi giấy phép |

## 8. Cần anh quyết

Phông sẽ đi theo app khi anh bán cho studio khác. Báo cáo không quyết hộ — đây là các lựa chọn và điều đọc được trong tệp:

1. **Nhóm A (31 họ → 74 tệp):** giấy phép mở, dùng thương mại và đóng gói được (kèm văn bản OFL/Apache + dòng bản quyền, như nội dung chung của giấy phép). Chữ ký nhóm A: MonteCarlo, Ephesis, WindSong (mảnh) và Pinyon Script/Great Vibes/Alex Brush (thanh-đậm). Tiêu đề: Playfair Display, Cormorant Garamond, Prata, Lora, Be Vietnam Pro, Montserrat.
2. **Dùng phông nhóm B (Việt hoá) khi bán cho studio khác — có hay không?** Tệp **không ghi** giấy phép (hoặc chỉ ghi 'Free for everyone' của Michael Đinh Kiên với phông UTM). Phần lớn là bản Việt hoá của phông do nhà thiết kế nước ngoài làm; quyền của người Việt hoá và của tác giả gốc là hai việc khác nhau, tệp không nói. Cách làm có thể: (a) chỉ dùng nhóm B trong studio của anh, **không đóng gói đi bán**; (b) anh hỏi nơi bán/tác giả (địa chỉ có trong tệp: rantaustudio.com, letterhanna.com/license, fontzin.com/license, nirmanavisual.com, studioperspectype@gmail.com…) rồi lưu bằng chứng; (c) dùng cho bản bán chỉ phông nhóm A.
3. **Dùng phông nhóm C khi bán — có hay không?** Với tệp tự ghi 'personal use / demo / trial / non-commercial' và phông Microsoft/Adobe/Linotype/Gotham…: *không được đóng gói đi bán nếu không mua giấy phép* (đúng chữ trong tệp hoặc điều khoản hãng trỏ tới). Phương án: bỏ khỏi gói bán; hoặc mua giấy phép thương mại cho vài phông đẹp (theo tệp: Haigrast Script — mansgreback.com; Signerica Fat — mawns@live.se; Sparkling Valentine; Fz Fashion Signature — Letterara; Fz ThuPhapButBi — itsme.ducthuy@gmail.com).
4. **Kiểu chữ ký cho mẫu chào mừng/chứng nhận:** phương án an toàn là MonteCarlo (hạng 1) hoặc Ephesis (hạng 2); phương án đẹp và đúng 'nét mảnh đều' hơn là nhóm B: Fz JHW Monoline Signature, SVN Rustling Sound, SVN Janelotus, 1FTV Santa Catalina, NVN Selfie Light — nhưng cần xử lý câu hỏi 2.
5. **Mẫu đang có trong app** dùng phông tạm OFL (Imperial Script, Italianno, Birthstone, Charm theo Sổ ý muốn): nếu anh chọn phông nhóm A ở đây, có thể đổi mà không phát sinh vấn đề giấy phép.
6. **Cách đưa phông vào app** (chưa làm, chờ anh): chép tệp phông của nhóm anh chọn vào kho kèm tệp NGUON-PHONG (tên, nhà làm, giấy phép, đường dẫn bằng chứng). Tôi **chưa chép tệp phông nào** vào kho.

## 9. Việc kỹ thuật đã làm (để lần sau chạy lại)

Kịch bản nằm ở thư mục làm việc tạm (không đưa vào kho): đọc tên bảng + OS/2 + cmap bằng fontTools (`python3 -I`), phân nhóm bằng quy tắc chữ trong tệp, dựng ảnh bằng Pillow có bố cục RAQM (đúng nối nét và dấu của phông OpenType). Mọi ảnh PNG ≤ 600 KB (lớn nhất ~290 KB). Đã mở xem từng bảng trước khi nộp.

Lưu ý khi dùng trong mẫu: ký tự chấm giữa '·' (U+00B7) hiện tấm biển ở phông UTM và thành ô vuông ở nhiều phông 1FTV — tránh dùng ký tự này trong mẫu chào mừng; dùng gạch ngang '-' hoặc khoảng trắng.
