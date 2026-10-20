# Biên bản nghiệm thu bản vẽ D — Hôm nay · Loại sự kiện · Phụ phí tự động · Hợp đồng nhiều ngày (bản `ce33af0`)

- **Ngày chấm:** 20/10/2026, giờ máy khoảng 02:20–08:30 UTC (9:20–15:30 giờ Việt Nam). Giữa chừng phiên bị dừng vì giới hạn phiên, máy khởi động lại; nhật ký, bản tách và database còn nguyên, tôi bật lại máy chủ (PID mới) và làm tiếp.
- **Người chấm:** thợ chấm độc lập (AI, Opus). Tôi chỉ đo, phá thử trên bản sao, chụp ảnh. Tôi **không** sửa mã sản phẩm, **không** chạy lệnh git ghi (chỉ `git worktree add/remove`), **không** đụng `makeup_dev`, **không** `migrate reset`, **không** `pkill -f`.
- **Bản được chấm:** commit `ce33af0` (D-W3 xong), trong bản tách `scratchpad/cham-d/wt`. Commit này còn chứa phần **dở** của bản vẽ E (cổng học viên) và F (giấy chứng nhận) — bài đỏ thuộc phần đó ghi riêng ở mục 1.2, **không** tính cho D.
- **Database thử** (đều bật `btree_gist`, áp migration bằng `pnpm --filter api db:deploy-to`, lần nào cũng "kiểm lại: khớp"):
  - `makeup_test_cham_d`: bài thử máy chủ, cửa gác, đột biến.
  - `makeup_test_cham_d_khop`: bài "khớp hai đầu" của web.
  - `makeup_test_cham_d_dung`: chép từ `makeup_test_cham5_dung` (dữ liệu lần 5, có hợp đồng **trước D**), áp thêm 4 migration (130000 của D + 3 migration E/F), rồi `db:sync-roles` để cài 6 loại sự kiện mặc định cho 2 tổ chức cũ (chạy lần hai: 0 thay đổi). **Còn giữ** để tái hiện.
- Mọi lệnh chạy bài thử / máy chủ đều đặt rõ `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL` trỏ database thử. Bản tách không có tệp `.env`.
- **Máy chủ đã tắt theo PID** (xem mục 6). Ảnh: `docs/nghiem-thu/bai-thu-ban-ve-d/` (63 ảnh, **đều là ảnh khung nhìn** `fullPage: false` theo sổ lỗi 27, tôi đã mở xem từng ảnh). Nhật ký và mã đo: `scratchpad/cham-d/log/`, `scratchpad/cham-d/pw/`.

---

## 0. Kết luận ngắn cho anh Chiến

**ĐẠT CÓ ĐIỀU KIỆN — phần D chạy đúng trên app thật, tiền khớp từng đồng; còn 1 lỗi trung bình ở bài thử (không ở app) phải sửa trước khi đóng gói D.**

| Mục | ĐÚNG | ĐẠT | ĐẸP |
|---|---|---|---|
| Bảng giá › Loại sự kiện | Có | Có | Có (2 điểm nhẹ) |
| Bảng giá › Luật phụ phí | Có | Có | Có |
| Lập hợp đồng: sự kiện, ngày riêng, phụ phí tự thêm, sửa giá có lý do, bỏ / áp lại | Có | Có | Có (2 điểm nhẹ) |
| Lịch tô màu theo sự kiện | Có | Có | Có |
| Trang Hôm nay (chủ, thợ) | Có | Có | Có (1 điểm nhẹ) |
| Hợp đồng cũ trước D | Không đổi một đồng | Có | — |
| Cửa gác 10 phép | **888/888** (sau khi gỡ 9 đường dở của E — mục 1.2) | | |
| Bài thử máy chủ của D | **121/121** (7 tệp) | | |

**Bài đỏ thuộc D: 1** — bài khớp hai đầu của web chưa gọi 7 hàm Loại sự kiện / Luật phụ phí vào máy chủ thật (T1).

**Đột biến tôi tự cài: xem mục 1.3.**

---
