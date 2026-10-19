# Ghi chép: đồ của người khác trong bản bán

Viết cho chủ studio (anh Chiến). Cập nhật 19/10/2026.

> **WindSong — ĐÃ GỠ 19/10/2026 theo quyết định anh Chiến** (chọn "Bỏ khỏi ô chọn"). Lý do: trên ảnh xuất thật, tên "Tôn" in bằng WindSong bị dấu mũ chạm vào nét chữ T nên đọc thành "Tồn". Đã xoá khỏi app: ô chọn "Chữ ký 7 · WindSong", khai báo trong `ss-album.css`/`mau.js`, thư mục `apps/web/public/mau/phong/ss-album/windsong/` (2 tệp WOFF2 + giấy phép). Khoá `ky-7` bỏ trống, KHÔNG đánh số lại `ky-8` (giữ khoá ổn định); máy chủ trả lỗi 400 tiếng Việt nếu ai gửi `ky-7`. Các đoạn nhắc WindSong bên dưới là lịch sử, giữ để anh đối chiếu.
Bản này nói rõ: trong app có những thứ không do mình làm ra (phông chữ), mỗi thứ cho dùng theo giấy phép nào, lấy ở đâu, và những phông trong kho của anh mà em KHÔNG đưa vào cùng lý do.

## 1. Quyết định của anh và em đã làm gì

Anh Chiến quyết (19/10/2026): "Lọc các nhóm bản quyền được dùng thì đưa vào hết cho tôi".
Em hiểu là: đưa vào app TẤT CẢ phông trong kho của anh mà **chính tệp phông ghi giấy phép cho dùng thương mại** (nhóm A: SIL Open Font License 1.1 hoặc Apache 2.0) **và đủ dấu tiếng Việt (186/186 ký tự)**. Không đưa nhóm B (Việt hoá, tệp không ghi giấy phép), C (thương mại / bản thử / chỉ dùng cá nhân), D (không rõ).

Lọc bằng chương trình (đọc lại từng tệp phông, không chép tay). Kết quả từng bước:

| Bước lọc | Số mặt chữ còn lại |
|---|---|
| Kho của anh: 291 tệp (302 mặt chữ vì Avenir.ttc có 12 mặt) | 302 |
| Tệp tự ghi giấy phép OFL hoặc Apache (nhóm A) — trùng khớp với bảng kê cũ 74/74 | 74 |
| + đủ 186/186 dấu tiếng Việt | 71 (loại 3: Anton 96/186, Italiana 84/186, Poppins 98/186) |
| + không cấm nhúng (cờ fsType của cả 71 tệp đều = 0, nhúng tự do) | 71 |
| − trùng giống từng byte (6 tệp) | 65 |
| − bản Variable chép lại chỉ khác tên mặc định (5 tệp) và bản tĩnh đã nằm trong dải trọng lượng của bản Variable (19 tệp) | 41 |
| − đã có sẵn trong app, giống từng byte (5 tệp: Cormorant Garamond đứng + nghiêng, Playfair Display đứng + nghiêng, Montserrat đứng) | **36** |

**Kết quả: 71/71 tệp đủ điều kiện đều được xử lý — 36 tệp thành WOFF2 mới (26 họ phông mới trong app), 35 tệp là bản trùng hoặc đã có sẵn** (cộng 2 họ đã có sẵn trong app là Cormorant Garamond, Playfair Display và chữ đứng của Montserrat — tổng 28 họ nhóm A dùng được). Danh sách tệp trùng ở mục 4. Không có tệp đủ điều kiện nào bị bỏ vì dung lượng.

**Dung lượng:** 36 tệp WOFF2 = **3.22 MB** (tệp gốc TTF cộng lại 8.61 MB), cộng giấy phép 0.14 MB. Dưới ngưỡng 15 MB nên **giữ đủ mọi trọng lượng**, không phải bỏ bản nào.

**Chuyển WOFF2** chỉ là đổi định dạng tệp cho nhẹ khi tải về web: không sửa hình chữ, không cắt bớt ký tự, giữ nguyên tên phông. Em đã kiểm lại từng tệp sau khi chuyển: số ký tự và số hình chữ giống hệt tệp gốc.

Nơi để: `apps/web/public/mau/phong/ss-album/<tên họ>/` — mỗi thư mục có tệp WOFF2 và tệp giấy phép (`OFL.txt`, riêng Roboto Slab là `LICENSE.txt`). Khai báo trong `apps/web/public/mau/phong/ss-album/ss-album.css`.

### Dùng ở đâu trong app
- **Chữ ký nét mảnh đều** — 3 phông mới thành lựa chọn trên màn Mẫu thiết kế: **Chữ ký 5 · MonteCarlo, Chữ ký 6 · Ephesis** (Chữ ký 7 · WindSong đã gỡ 19/10/2026 theo quyết định anh Chiến: tên "Tôn" bị dấu mũ chạm nét chữ T, đọc thành "Tồn").
- **Pinyon Script** là thư pháp nét thanh-đậm, KHÔNG phải nét đều, nên ô chọn ghi là **"Chữ viết tay · Pinyon Script"** (nhóm chữ viết tay), không gọi là chữ ký.
- Các phông còn lại (tiêu đề, chữ thường, trang trí) đã nạp sẵn trong `ss-album.css` dưới tên "SSA <tên họ>" để R&D/thợ mẫu dùng khi làm mẫu; chưa có ô chọn trên màn hình.

## 2. Bảng từng phông đưa vào bản bán

Cột "Giấy phép" là câu ghi trong tệp phông (name ID13), chép nguyên văn phần đầu. "Nguồn" lấy từ chính tệp phông (bản quyền ID0 / địa chỉ nhà làm). Cột WOFF2: đã chuyển và đã kiểm. Mọi dòng đều là SIL OFL 1.1, trừ Roboto Slab là Apache 2.0.

| Phông (họ) | Tệp gốc → tệp WOFF2 | Nhà làm | Giấy phép (nguyên văn ngắn) | Nguồn | WOFF2 |
|---|---|---|---|---|---|
| **Alegreya Sans SC** | `AlegreyaSansSC-Light.ttf` → `AlegreyaSansSC-Light.woff2` (35 KB) | Huerta Tipografica / Juan Pablo del Peral | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | http://www.huertatipografica.com.ar | ✔ |
| **Alex Brush** | `AlexBrush-Regular.ttf` → `AlexBrush-Regular.woff2` (51 KB) | Robert E. Leuschke | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/alex-brush | ✔ |
| **Alfa Slab One** | `AlfaSlabOne-Regular.ttf` → `AlfaSlabOne-Regular.woff2` (34 KB) | JM Sole | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | http://www.jmsole.cl | ✔ |
| **Be Vietnam Pro** | `BeVietnamPro-Bold.ttf` → `BeVietnamPro-Bold.woff2` (40 KB)<br>`BeVietnamPro-ExtraBold.ttf` → `BeVietnamPro-ExtraBold.woff2` (40 KB)<br>`BeVietnamPro-Light.ttf` → `BeVietnamPro-Light.woff2` (39 KB)<br>`BeVietnamPro-Medium.ttf` → `BeVietnamPro-Medium.woff2` (39 KB)<br>`BeVietnamPro-Regular.ttf` → `BeVietnamPro-Regular.woff2` (37 KB)<br>`BeVietnamPro-SemiBold.ttf` → `BeVietnamPro-SemiBold.woff2` (39 KB) | Yellow Type Foundry / Lam Bao, Tony Le, Vietanh Nguyen | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/bettergui/BeVietnamPro | ✔ |
| **Bungee Inline** | `BungeeInline-Regular.ttf` → `BungeeInline-Regular.woff2` (54 KB) | David Jonathan Ross | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/djrrb/Bungee | ✔ |
| **Dancing Script** | `DancingScript-Variable.ttf` → `DancingScript-VF.woff2` (58 KB) | Pablo Impallari | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/DancingScript | ✔ |
| **Darker Grotesque** | `DarkerGrotesque-VariableFont_wght.ttf` → `DarkerGrotesque-VF.woff2` (39 KB) | TypeRant / Gabriel Lam | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/bettergui/DarkerGrotesque | ✔ |
| **Ephesis** | `Ephesis-Regular.ttf` → `Ephesis-Regular.woff2` (53 KB) | Robert E. Leuschke | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/ephesis | ✔ |
| **Great Vibes** | `GreatVibes-Regular.ttf` → `GreatVibes-Regular.woff2` (158 KB) | Robert E. Leuschke / Robert E. Leuschke, Viktoriya Grabowska, Viviana Monsalve, Eben Sorkin | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/great-vibes | ✔ |
| **Inter** | `Inter-Variable.ttf` → `Inter-VF.woff2` (342 KB) | rsms / Rasmus Andersson | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/rsms/inter | ✔ |
| **JetBrains Mono** | `JetBrainsMono-Variable.ttf` → `JetBrainsMono-VF.woff2` (70 KB) | JetBrains / Philipp Nurullin, Konstantin Bulenkov | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/JetBrains/JetBrainsMono | ✔ |
| **Josefin Sans** | `JosefinSans-Variable.ttf` → `JosefinSans-VF.woff2` (47 KB) | Typemade / Santiago Orozco | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/ThomasJockin/JosefinSansFont-master | ✔ |
| **Lora** | `Lora-Italic-Variable.ttf` → `Lora-Italic-VF.woff2` (89 KB)<br>`Lora-Variable.ttf` → `Lora-VF.woff2` (83 KB) | Cyreal / Olga Karpushina, Alexei Vanyashin (Cyrillic) | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/cyrealtype/Lora-Cyrillic | ✔ |
| **MonteCarlo** | `MonteCarlo-Regular.ttf` → `MonteCarlo-Regular.woff2` (158 KB) | Robert E. Leuschke | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/monte-carlo | ✔ |
| **Montserrat** | `Montserrat-Italic.ttf` → `Montserrat-Italic.woff2` (82 KB)<br>`Montserrat-LightItalic.ttf` → `Montserrat-LightItalic.woff2` (81 KB)<br>`Montserrat-MediumItalic.ttf` → `Montserrat-MediumItalic.woff2` (61 KB) | Julieta Ulanovsky | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/JulietaUla/Montserrat | ✔ |
| **Noto Serif Display** | `NotoSerifDisplay[wdth,wght].ttf` → `NotoSerifDisplay-VF.woff2` (706 KB) | Monotype Imaging Inc. / Monotype Design Team | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | http://www.google.com/get/noto/ | ✔ |
| **Nunito** | `Nunito-Variable.ttf` → `Nunito-VF.woff2` (99 KB) | Vernon Adams | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/nunito | ✔ |
| **Oswald** | `Oswald-Variable.ttf` → `Oswald-VF.woff2` (70 KB) | Vernon Adams | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/OswaldFont | ✔ |
| **Pacifico** | `Pacifico-Regular.ttf` → `Pacifico-Regular.woff2` (103 KB) | Vernon Adams | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/Pacifico | ✔ |
| **Philosopher** | `Philosopher-Italic.ttf` → `Philosopher-Italic.woff2` (42 KB)<br>`Philosopher-Regular.ttf` → `Philosopher-Regular.woff2` (40 KB) | Jovanny Lemonad | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/alexeiva/philosopher | ✔ |
| **Pinyon Script** | `PinyonScript-Regular.ttf` → `PinyonScript-Regular.woff2` (57 KB) | Sorkin Type Co. / Nicole Fally, Eben Sorkin | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/SorkinType/Pinyon | ✔ |
| **Prata** | `Prata-Regular.ttf` → `Prata-Regular.woff2` (37 KB) | Cyreal / Ivan Petrov | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | http://www.cyreal.org | ✔ |
| **Roboto Slab** | `RobotoSlab-Variable.ttf` → `RobotoSlab-VF.woff2` (116 KB) | Google | "Licensed under the Apache License, Version 2.0." | https://github.com/googlefonts/robotoslab | ✔ |
| **SVN-Abril Fatface** | `SVN-Abril Fatface.ttf` → `SVN-AbrilFatface.woff2` (40 KB) | TypeTogether / Veronika Burian, Jos? Scaglione | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://www.type-together.com | ✔ |
| **SVN-Bebas Neue** | `SVN-Bebas-Neue-Bold.ttf` → `SVN-Bebas-Neue-Bold.woff2` (26 KB) | Ryoichi Tsunekawa | "This Font Software is licensed under the SIL Open Font License, Version 1.1" (Dharma Type ghi thêm: dùng cho sản phẩm thương mại — Yes; dùng web @font-face — Yes) | http://dharmatype.com | ✔ |
| ~~**WindSong**~~ — **ĐÃ GỠ 19/10/2026** theo quyết định anh Chiến (dấu mũ "Tôn" chạm nét chữ T → đọc "Tồn"); tệp đã xoá khỏi app | `WindSong-Medium.ttf` → `WindSong-Medium.woff2` (124 KB)<br>`WindSong-Regular.ttf` → `WindSong-Regular.woff2` (111 KB) | Robert E. Leuschke | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | https://github.com/googlefonts/windsong | ✔ |
| **Cormorant Garamond** (đứng + nghiêng) | `CormorantGaramond-VF.ttf`, `CormorantGaramond-Italic-VF.ttf` — đã có sẵn trong app từ trước, giống từng byte với kho | Christian Thalmann (Catharsis Fonts) | "This Font Software is licensed under the SIL Open Font License, Version 1.1." | github.com/CatharsisFonts/Cormorant | giữ TTF (không đổi) — giấy phép `phong/OFL-cormorantgaramond.txt` |
| **Playfair Display** (đứng + nghiêng) | `PlayfairDisplay-VF.ttf`, `PlayfairDisplay-Italic-VF.ttf` — đã có sẵn, giống từng byte | Claus Eggers Sørensen | SIL OFL 1.1 | https://github.com/clauseggers/Playfair-Display | giữ TTF — `phong/OFL-playfairdisplay.txt` |
| **Montserrat** (chữ đứng) | `Montserrat.ttf` = `Montserrat-VF.ttf` đã có sẵn, giống từng byte (chữ nghiêng 3 bản ở dòng Montserrat phía trên là mới thêm) | Julieta Ulanovsky | SIL OFL 1.1 | https://github.com/JulietaUla/Montserrat | giữ TTF — `phong/OFL-montserrat.txt` |

### Điều anh cần biết về giấy phép nhóm A
- **OFL 1.1 cho phép:** dùng thương mại, đóng gói cùng phần mềm bán đi, dùng trên web. **Điều kiện:** kèm bản văn giấy phép và dòng bản quyền gốc (em đã đặt `OFL.txt` trong từng thư mục); **không bán riêng tệp phông** (chỉ đi kèm app); nếu sửa phông thì không được dùng lại "tên dành riêng" của bản gốc.
- **Tệp phông chỉ ghi tên giấy phép và địa chỉ, không kèm toàn văn.** Vì vậy mỗi `OFL.txt` gồm PHẦN 1 = nguyên văn bản quyền + giấy phép ghi trong tệp, PHẦN 2 = toàn văn SIL OFL 1.1 chuẩn (chép từ bản đã có sẵn trong kho `phong/OFL-montserrat.txt`). Roboto Slab: PHẦN 2 là toàn văn Apache 2.0 chuẩn (từ `/usr/share/common-licenses/Apache-2.0`).
- **Hai phông cần anh chú ý (đã đưa vào theo lệnh anh, nhưng có điểm vướng):**
  1. **SVN-Abril Fatface** — bản Việt hoá do bên thứ ba (SVN) sửa từ Abril Fatface của TypeTogether. Tệp ghi rõ "with Reserved Font Names 'Abril' and 'Abril Fatface'". Theo OFL, bản đã sửa không được dùng lại tên dành riêng; tên "SVN-Abril Fatface" vẫn chứa chữ "Abril Fatface". Đây là chuyện của người Việt hoá chứ không phải của mình, nhưng em ghi lại để anh biết. Nếu muốn an toàn tuyệt đối thì bỏ phông này (nó là phông hiếm khi cần: kiểu chữ đậm trang trí) hoặc thay bằng bản gốc Abril Fatface — em chưa kiểm bản gốc có đủ dấu Việt hay không. **Anh Chiến quyết ngày 19/10/2026: GIỮ.**
  2. **SVN-Bebas Neue** — tệp ghi OFL 1.1 và nhà làm Dharma Type ghi thêm "dùng cho sản phẩm thương mại: Yes". Tệp không ghi tên dành riêng. Ổn.
- Dancing Script, Josefin Sans, Lora, Alfa Slab One có "tên dành riêng" trong dòng bản quyền, nhưng mình dùng đúng bản gốc, không sửa tên, nên không vướng.

## 3. Hai điều kỹ thuật làm khi đưa vào
- Nạp phông bằng thẻ `<link>` trong từng mẫu (27 tệp mẫu), **không dùng `@import`**, vì bộ xuất PNG của app (html-to-image) không nhúng được phông nạp qua `@import` — lần thử đầu ảnh xuất ra bị rơi về phông dự phòng. Đã sửa và xuất lại, ảnh đúng phông.
- ~~Các phông mảnh (WindSong) rộng~~ (WindSong đã gỡ 19/10/2026) — các phông mảnh còn lại rộng nên chữ tự thu nhỏ khi tên dài (ví dụ 81 px so với 128 px của MonteCarlo). Đó là đặc tính của phông, không phải lỗi.

## 4. Tệp trùng đã bỏ (chỉ giữ một bản)
**Giống từng byte (giữ bản đầu):** `CormorantGaramond.ttf` = `CormorantGaramond-Variable.ttf`; `DancingScript.ttf` = `DancingScript-Variable.ttf`; `Montserrat-SemiBold.ttf` = `Montserrat-SemiBold 3.ttf`; `Oswald.ttf` = `Oswald-Variable.ttf`; `PlayfairDisplay-Italic.ttf` = `PlayfairDisplay-Italic-Variable.ttf`; `PlayfairDisplay.ttf` = `PlayfairDisplay-Variable.ttf`.

**Bản Variable chép lại, chỉ khác bảng tên (head/name), hình chữ giống hệt (giữ bản Variable gốc):** `CormorantGaramond-Medium.ttf` ≈ `CormorantGaramond-Variable.ttf`; `Montserrat-Bold.ttf` ≈ `Montserrat.ttf`; `Montserrat-Medium.ttf` ≈ `Montserrat.ttf`; `Oswald-SemiBold.ttf` ≈ `Oswald-Variable.ttf`; `PlayfairDisplay-Bold.ttf` ≈ `PlayfairDisplay-Variable.ttf`.

**Bản tĩnh đã nằm trong dải trọng lượng của bản Variable cùng họ (giữ Variable, bỏ bản tĩnh):** `CormorantGaramond-Regular.ttf`; `CormorantGaramond-SemiBold.ttf`; `DarkerGrotesque-ExtraBold.ttf`; `DarkerGrotesque-Light.ttf`; `DarkerGrotesque-Regular.ttf`; `DarkerGrotesque-SemiBold.ttf`; `JetBrainsMono-Regular.ttf`; `JetBrainsMono-SemiBold.ttf`; `Lora-Regular.ttf`; `Montserrat-ExtraBold.ttf`; `Montserrat-Light.ttf`; `Montserrat-Regular.ttf`; `Montserrat-SemiBold 3.ttf`; `Nunito-Black.ttf`; `Nunito-ExtraBold.ttf`; `Oswald-Bold.ttf`; `Oswald-Light.ttf`; `Oswald-Medium.ttf`; `PLAYFAIRDISPLAY-REGULAR.TTF`.

**Đã có sẵn trong app (giống từng byte):** `CormorantGaramond-Italic-Variable.ttf` = `CormorantGaramond-Italic-VF.ttf`; `CormorantGaramond-Variable.ttf` = `CormorantGaramond-VF.ttf`; `Montserrat.ttf` = `Montserrat-VF.ttf`; `PlayfairDisplay-Variable.ttf` = `PlayfairDisplay-VF.ttf`; `PlayfairDisplay-Italic-Variable.ttf` = `PlayfairDisplay-Italic-VF.ttf`.

## 5. Không đưa vào
Lý do chung: anh nói "nhóm bản quyền được dùng". Em chỉ đưa phông mà chính tệp ghi giấy phép cho dùng thương mại. Những phông dưới đây **tệp không ghi đủ giấy phép** hoặc **tự ghi cấm/hạn chế** — đưa vào bản bán là anh tự gánh rủi ro, em không làm hộ. Nếu anh có hoá đơn mua, hoặc xin được văn bản cho phép của người làm phông, báo em để đưa thêm.

### 5.0. Nhóm A nhưng thiếu dấu tiếng Việt (loại 3)
| Phông | Đủ dấu | Lý do |
|---|---|---|
| Anton | 96/186 | OFL nhưng thiếu ă ơ ư và nhiều chữ có dấu — tên tiếng Việt sẽ rơi dấu |
| Italiana | 84/186 | như trên |
| Poppins (Light) | 98/186 | như trên |


### 5.1. Nhóm B — phông Việt hoá, tệp không ghi giấy phép
Có 67 họ (71 mặt chữ).

| Họ phông | Số mặt chữ | Đủ dấu (N/186) | Lý do không đưa vào |
|---|---|---|---|
| #9Slide04 Aria Pro | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| #9Slide05 Beautiful Caps | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| #9Slide05 Pateglamt Script | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Copyright (c) 2016 by iTypeface.com . All rights reserved. | http://itypeface.com |
| #Script03 Beautiful Caps | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| 1FTV Blushing Rose | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV Cakelan | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Amoslenty | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Argaka Fashion | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi https://nirmanavisual.com/ |
| 1FTV VIP Bastliga One | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Bethany Avanue | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi http://www.rantaustudio.com |
| 1FTV VIP Braven | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Capricious Ambrosia | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Copyright (c) 2023 Rinaldo Hasibuan (Letterhanna Studio) https://letterhanna.com/l |
| 1FTV VIP Classy Vogue | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Delicate Elegance | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Freshome | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Halone | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Molahesta | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi ©Storytype Studio 2021. All Rights Reserved | https://letterena.com/product-catego |
| 1FTV VIP Peach Club | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP Perfect Girl | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi http://www.rantaustudio.com |
| 1FTV VIP Santa Catalina | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| 1FTV VIP The Rambler | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| Desirable Calligraphy | 2 | 90 | Phông Việt hoá, tệp không ghi giấy phép |
| DFVN Arthemys Display | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Copyright © 2020 by Morgane Vantorre. All rights reserved. |
| DFVN Boheme Floral | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| DFVN Fashion Wacks | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi New Value | https://nirmanavisual.com/ |
| DFVN Love | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| DFVN Mongek | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| Fz DucThuy Thuphap | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi DucThuy © 2023 Font Zin . All rights reserved | https://fontzin.com/license |
| Fz JHW Monoline Signature | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi ©Perspectype Studio 2021. All Rights Reserved | studioperspectype@gmail.com |
| Fz Thu Phap Giao Long Full | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Thiet ke boi Thai Hieu - dua tren net chu Giao Long |
| FZ-SG Pressio-No.25 | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| HLT Burgues Script | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Viet hoa by UhThilahuvo - chipquay@gmail.com | https://www.facebook.com/hoanglangt |
| HLT JaneAusten | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Viet hoa by UhThilahuvo - chipquay@gmail.com | https://www.facebook.com/hoanglangt |
| MTD Afecta | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD Ariestha | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD Australian Script | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD Hello Paris Serif | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD Maryatha | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD Mavera | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD Thank You So Much | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD Voyage Regular | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| MTD VVD Golden Horn | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| NBN Didot | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| NVN Cameo Sweet | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| NVN Selfie | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| SVN-Agoka | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Sold |
| SVN-Archaic 1897 | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| SVN-Canopee | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| SVN-Famous | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi sensatype.com |
| SVN-Hottroof Semhesta | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| SVN-Janelotus | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi lemonthe |
| SVN-MORVA | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| SVN-Rustling Sound | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| SVN-The Seasons | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| TP Le Major | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép đủ — chỉ ghi Additional characters added by Tuyn Pucca tuyentln1990@gmail.com |
| UTM A&S Heartbeat | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM Atlas | 4 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM Banque | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM Hanzel | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM LinotypeZapfino KT | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM Ong Do Gia | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM Ong Do Tre | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM ThuPhap Thien An | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| UTM Yen Tu | 1 | 186 | Việt hoá UTM: tệp chỉ ghi câu 'In God We Trust - Free for everyone', không có văn bản giấy phép; thêm cờ fsType lẫn (cấm nhúng + chỉ xem/in) |
| VanHung-Melika Letter | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| VL Hullist | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |
| VN Jonathan Andrea | 1 | 186 | Phông Việt hoá, tệp không ghi giấy phép |

### 5.2. Nhóm C — phông thương mại / hệ điều hành / bản thử / chỉ dùng cá nhân
Có 79 họ (105 mặt chữ).

| Họ phông | Số mặt chữ | Đủ dấu (N/186) | Lý do không đưa vào |
|---|---|---|---|
| 1FTV VIP Billie James | 1 | 186 | 'You can not resell, share or giveaway the font files' |
| 1FTV VIP Boogo | 1 | 186 | 'Personal use only' |
| 1FTV VIP Christmas Sundaylab | 1 | 186 | 'Personal Use Please visit www.ahweproject.com to obtain a commercial license.' |
| 1FTV VIP Signerica Fat | 1 | 186 | 'PERSONAL USE ONLY! For commercial use, mail mawns@live.se' |
| 1FTV VIP Sparkling Valentine | 1 | 186 | 'FREE FOR PERSONAL USE ONLY' |
| 1FTV VIP Valter Std | 1 | 186 | 'Typotheque Font Software is protected ...' + EULA |
| 1FTV VIP Welcome Christmas | 1 | 186 | 'Personal Use Only!' |
| Adobe Caslon Pro | 2 | 88 | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Adobe Garamond Pro | 2 | 88 | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Ambrosius Aurelianus | 1 | 52 | 'This is shareware. For personal use please send $15 (US) to the address below. For use in a publication please write for more inf |
| Antro Vectra | 1 | 84 | 'Free for personal use only.' |
| Arial | 3 | 94–186 | 'NOTIFICATION OF LICENSE AGREEMENT' (ITC/Monotype) |
| Arsenica Trial | 2 | 111 | tên tệp 'Arsenica Trial Bold 700.ttf' / tên phông 'Arsenica Trial' ghi bản demo/trial/free/personal |
| Avenir | 12 | 92–186 | phông thương mại của hãng, tệp ghi bản quyền: 'Copyright© 2007 Linotype GmbH, www.linotype.com. All rights reserved.' — phông thươ |
| Ayudisha Demo | 1 | 87 | tên tệp 'Ayudisha-Free-Version.ttf' / tên phông 'Ayudisha Demo' ghi bản demo/trial/free/personal |
| Baskerville Display PT | 1 | 186 | tệp trỏ tới trang cấp phép ParaType (nhận biết: phông thương mại) |
| Baskerville Old Face | 1 | 84 | phông thương mại của hãng, tệp ghi bản quyền: 'Typeface © 1992 Stephenson Blake (Holdings) Ltd. Data © 1992 URW. Portions © 1992 M |
| BD Megalona DEMO Personal Use Only | 1 | 52 | 'Hi there,  Hope you doing well.  This is a TRIAL VERSION of BD Megalona. You are not allowed to use this font for commercial use. |
| Bell MT | 2 | 84 | phông thương mại của hãng, tệp ghi bản quyền: 'Typeface © The Monotype Corporation plc. Data © The Monotype Corporation plc, Type  |
| Brigitte Eigner | 1 | 84 | 'Dafont for personal use/ Demo' |
| Californian FB | 1 | 84 | phông thương mại của hãng, tệp ghi bản quyền: 'Copyright (c) 1989, 1994, 1997, 1998, The Font Bureau, Inc. Designed by David Berlo |
| Candara | 1 | 186 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| Courier New | 2 | 186 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| Didot | 3 | 82 | phông thương mại của hãng, tệp ghi bản quyền: 'HTF Didot   1992 The Hoefler Type Foundry, Inc. This typeface and the digital softw |
| Ebrima | 1 | 110 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| Effra | 1 | 186 | 'may not be altered ... without prior permission of Dalton Maag' |
| Franklin Gothic Heavy | 1 | 94 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| Fz Fashion Signature | 1 | 186 | 'Personal use only' |
| Fz Thu phap DT Fontzin | 1 | 186 | tệp ghi (không dấu): 'sử dụng mục đích cá nhân & phi thương mại' |
| Fz ThuPhapButBi | 1 | 186 | tệp ghi (không dấu): 'Bản full dành cho thương mại, vui lòng liên hệ tác giả để được cấp quyền' |
| Garamond Premier Pro | 1 | 186 | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Gilroy-Bold | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Light | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-LightItalic | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Medium | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-MediumItalic | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Regular | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-RegularItalic | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-SemiBold | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-SemiBoldItalic | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-Thin | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Gilroy-UltraLightItalic | 1 | 90 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| Haigrast Script PERSONAL USE | 1 | 186 | tên tệp 'HaigrastScript_PERSONAL_USE_ONLY.otf' / tên phông 'Haigrast Script PERSONAL USE' ghi bản demo/trial/free/personal (tên tệ |
| Hamillton Demo | 1 | 52 | 'free for personal use' |
| Hathem Bosteem FREE | 1 | 52 | 'FREE VERSION ! This font was created using FontCreator 11.5 from High-Logic.com' |
| Helvetica Neue | 1 | 186 | phông thương mại của hãng, tệp ghi bản quyền: 'Copyrighted (c) 1981, 1997 by and the property of Linotype-Hell AG and/or its subsi |
| High Spirited | 1 | 84 | 'Free for personal use' |
| Hijrnotes PERSONAL USE ONLY 01 | 1 | 94 | tên tệp 'Hijrnotes_PERSONAL_USE_ONLY.ttf' / tên phông 'Hijrnotes PERSONAL USE ONLY 01' ghi bản demo/trial/free/personal (tên tệp c |
| iCiel Bambola | 1 | 186 | 'Standard License Agreement ... licensed for use on 2 output devices' (EdyType) |
| iCiel Gotham | 1 | 186 | có EULA của hãng (typography.com/support/eula.html) |
| JaneAusten | 1 | 94 | 'Pia Frauss fecit AD MMV; for private use only' |
| Juliette | 1 | 84 | 'PERSONAL USE ONLY' |
| MADE Canvas | 1 | 94 | 'Free for personal use ONLY.' |
| MADE SAONARA | 1 | 94 | 'Free for personal use ONLY' |
| MADE SAONARA 2 | 1 | 94 | 'Free for personal use ONLY' |
| Merona Island DEMO | 1 | 86 | 'Merona Island Typeface for PERSONAL USE ONLY' |
| Microsoft Sans Serif | 1 | 186 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| Minion Pro | 1 | 186 | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| Mongolian Baiti | 1 | 84 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| MTD Gilroy Medium | 1 | 186 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| MTD Madame Cosmetics | 1 | 186 | 'This font is free for personal use' |
| Myriad Pro | 1 | 186 | tệp trỏ tới adobe.com/type/legal.html (điều khoản Adobe) |
| NewYork | 1 | 94 | 'free for personal use' |
| Niagara Engraved | 1 | 84 | phông thương mại của hãng, tệp ghi bản quyền: 'Copyright (c) 1994, Tobias Frere-Jones. Designed by Tobias Frere-Jones. Produced by |
| Perpetua Titling MT | 1 | 84 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| Season Serif-TRIAL | 1 | 108 | tên tệp 'SeasonSerif-TRIAL-Regular.otf' / tên phông 'Season Serif-TRIAL' ghi bản demo/trial/free/personal |
| Signature Collection | 1 | 84 | 'THIS DEMO FONT IS FOR PERSONAL USE ONLY!' |
| Signerica Fat | 1 | 94 | 'PERSONAL USE ONLY! For commercial use, mail mawns@live.se' |
| SP3 - Traveling Typewriter | 1 | 186 | 'Free for personal use only!' |
| STSong | 1 | 94 | phông thương mại của hãng, tệp ghi bản quyền: 'Copyright (c) 1991-1998, Changzhou SinoType Technology Co., Ltd.  All rights reserv |
| SVN-Bradley Hand | 1 | 186 | Bradley Hand ITC là phông thương mại (nhận biết theo tên họ phông); tệp không ghi điều khoản |
| SVN-Georgia | 1 | 186 | phông của Microsoft/hệ điều hành: tệp ghi 'may use this font ... as permitted by the license terms of the Microsoft product' |
| SVN-Gilroy | 2 | 186 | tệp chỉ ghi bản quyền Radomir Tinkov; Gilroy là phông thương mại (nhận biết) |
| SVN-Gotham | 6 | 186 | có EULA của hãng (typography.com/support/eula.html) |
| The Coastal Free | 1 | 84 | 'This Version is for PERSONAL USE ONLY, NO COMMERCIAL USE ALLOWED.' |
| The Excited | 1 | 84 | giấy phép theo nơi mua phông; cần giấy phép mở rộng |
| ThrohandW01-Roman | 1 | 84 | 'NOTIFICATION OF LICENSE AGREEMENT' (ITC/Monotype) |
| TT Wellingtons Trl | 1 | 88 | 'TT Wellingtons Trial is designed for font testing and cannot be used in personal or commercial projects. Special version for DaFo |
| VanHung-High Spirited | 1 | 186 | 'Free for personal use' |

### 5.3. Nhóm D — không rõ (phông tải lẻ trên mạng, tệp không ghi giấy phép)
Có 50 họ (52 mặt chữ).

| Họ phông | Số mặt chữ | Đủ dấu (N/186) | Lý do không đưa vào |
|---|---|---|---|
| 00 Starmap Truetype | 1 | 52 | Không rõ: tệp không ghi giấy phép |
| 00216 | 1 | 85 | Không rõ: tệp không ghi giấy phép |
| 00222 | 1 | 85 | Không rõ: tệp không ghi giấy phép |
| 00252 | 1 | 85 | Không rõ: tệp không ghi giấy phép |
| Aberatta | 1 | 52 | Không rõ: tệp không ghi giấy phép |
| Adoha | 1 | 92 | Không rõ: chỉ ghi ©Storytype Studio 2021. All Rights Reserved | https://letterena.com/product-category/storyty |
| Agatho | 2 | 84 | Không rõ: chỉ ghi Please visit andfonts.com | Please visit andfonts.com (không rõ điều khoản) |
| Aire Bold Std | 1 | 97 | Không rõ: tệp không ghi giấy phép |
| Anything Script_1 | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Anything Script_3 | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Anything Script_4 | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Arsellia | 1 | 88 | Không rõ: chỉ ghi http://www.rantaustudio.com (không rõ điều khoản) |
| ArtBrush | 1 | 52 | Không rõ: tệp không ghi giấy phép |
| Aston Script Bold | 1 | 82 | Không rõ: tệp không ghi giấy phép |
| Berlishanty Calligraphy | 1 | 84 | Không rõ: chỉ ghi ©Perspectype Studio 2021. All Rights Reserved | studioperspectype@gmail.com (không rõ điều k |
| Betterworks | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| BigApple | 1 | 88 | Không rõ: tệp không ghi giấy phép |
| Billion | 1 | 87 | Không rõ: chỉ ghi installable item (không rõ điều khoản) |
| Bliss | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| BodoniFLF | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| BOSQUE | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Broad | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Bully | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Ceremonious One | 1 | 52 | Không rõ: tệp không ghi giấy phép |
| Chaney-Extended | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| CREMISSS | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Cynthia  Blooms | 1 | 92 | Không rõ: chỉ ghi www.dirtylinestudio.com/license | www.dirtylinestudio.com/license (không rõ điều khoản) |
| Dryhten | 1 | 92 | Không rõ: tệp không ghi giấy phép |
| Erangle | 1 | 86 | Không rõ: tệp không ghi giấy phép |
| Gangitem | 1 | 82 | Không rõ: chỉ ghi 177Studio.com (không rõ điều khoản) |
| Gardenia Summer | 1 | 52 | Không rõ: tệp không ghi giấy phép |
| Griffiths | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| HavanaSunset Script Alt | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Heanffe | 1 | 52 | Không rõ: tệp không ghi giấy phép |
| Janetta Silloam | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Karlotte | 2 | 84 | Không rõ: tệp không ghi giấy phép |
| Ladyday | 1 | 84 | Không rõ: chỉ ghi ©Perspectype Studio 2021. All Rights Reserved | studioperspectype@gmail.com (không rõ điều k |
| Le Major | 1 | 90 | Không rõ: tệp không ghi giấy phép |
| Marthinoul | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Medhurst | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Melika Letter | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| MonthGlade | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Nomark | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Photograph Signature | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Pringle And Tweed | 1 | 84 | Không rõ: chỉ ghi Licensed by Nicky Laatz | /license (không rõ điều khoản) |
| PS-Montero | 1 | 90 | Không rõ: tệp không ghi giấy phép |
| Soligant | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| Sophia Martini | 1 | 84 | Không rõ: tệp không ghi giấy phép |
| The Castle Elizah | 1 | 84 | Không rõ: chỉ ghi ©Letterena Studios 2020. All Rights Reserved | https://www.creativefabrica.com/designer/lett |
| Welliams | 1 | 84 | Không rõ: tệp không ghi giấy phép |

## 6. Ghi nhớ
- Bảng kê gốc từng mặt chữ (302 dòng, chữ nguyên văn từ tệp): `docs/rnd/anh-phong-ss-album/kiem-ke-291-tep.csv`. Báo cáo kiểm kê: `docs/rnd/BAO-CAO-PHONG-SS-ALBUM.md`.
- Phông tạm đang dùng cho "Chữ ký 1–4" và "Viết tay 1–4" (Send Flowers, Whisper, Oooh Baby, Waterfall, Imperial Script, Italianno, Birthstone, Charm) vẫn là SIL OFL 1.1 từ Google Fonts, giấy phép ở `apps/web/public/mau/phong/OFL-*.txt`.
- Thư viện html-to-image (xuất ảnh) là MIT, giấy phép ở `apps/web/public/mau/chung/LICENSE-html-to-image.txt`.
- Nếu sau này thêm phông mới vào bản bán: chép tệp giấy phép cùng thư mục, thêm một dòng vào bảng mục 2 của tệp này, và thêm thẻ `<link>` vào mẫu mới.

