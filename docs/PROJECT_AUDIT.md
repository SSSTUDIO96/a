# Báo cáo khảo sát trước khi xây — Makeup Pro

Ngày khảo sát: 18/10/2026. Người khảo sát: AI (phiên đám mây). Cách khảo sát: chỉ đọc mã, không chạy, không sửa.

---

## Phần CỦA NGHỀ — studio nào cũng dùng được

### Vì sao phải khảo sát trước khi xây
Khi muốn làm sản phẩm mới, chủ studio thường muốn "lấy app cũ sửa lại cho nhanh". Làm vậy chỉ đúng khi nền móng app cũ chịu được yêu cầu mới. Nếu không chịu được, sửa lại còn tốn hơn xây mới. Khảo sát trả lời một câu: **nền móng cũ có chịu được tải mới không?** Mỗi câu trả lời phải chỉ ra được tệp và dòng.

### Bảng kiểm nền móng (dùng lại cho mọi dự án)
| # | Câu hỏi | Vì sao quan trọng |
|---|---|---|
| 1 | Tiền lưu bằng số nguyên hay số thực? | Số thực cộng trừ nhiều lần sẽ lệch vài đồng. Sổ sách không khớp mà không ai tìm ra lỗi. |
| 2 | Một tài khoản làm việc được cho nhiều tổ chức không? | Thợ makeup hay làm cho vài nơi, giảng viên dạy cho vài trung tâm. |
| 3 | Đổi cấu trúc dữ liệu có ghi lịch sử (migration) không? | Không có lịch sử thì không lùi được, không biết máy thật đang ở phiên bản nào. |
| 4 | Dữ liệu chính nằm trên máy chủ hay trong trình duyệt? | Dữ liệu trong trình duyệt sẽ mất khi xoá lịch sử, không đồng bộ giữa các máy, và đầy ở khoảng 5–10MB. |
| 5 | Khoá bí mật có lọt ra trang web không? | Lọt ra là ai mở trang cũng lấy được khoá và tiêu tiền của chủ. |
| 6 | Quyền quản trị cao nhất mở bằng gì? | Một mật khẩu dùng chung bị lộ là mất cả hệ thống. |
| 7 | Có bài thử tự động không, chạy được không? | Không có bài thử thì mỗi lần sửa phải tự bấm thử lại toàn bộ. |

---

## Phần CỦA RIÊNG DỰ ÁN NÀY

### Kho được khảo sát: 4/4 kho phiên này được cấp
| Kho | Hiện trạng |
|---|---|
| `SSSTUDIO96/ssaas` | Studio Pro bản thương mại: 108.149 dòng TypeScript, 18 nhóm trang, 14 nhóm API, 5 tệp thử |
| `SSSTUDIO96/Nguy-n-Tr-ng-Chi-n` | Studio Pro đời trước, chỉ có giao diện |
| `SSSTUDIO96/a` | Trống → **nơi xây Makeup Pro** (anh Chiến chọn ngày 18/10/2026) |
| `SSSTUDIO96/ProAppSSSTUDIO` | Chỉ có README |

### Kết quả bảng kiểm trên `ssaas`
| # | Kết quả | Bằng chứng |
|---|---|---|
| 1 | ❌ Số thực (`Float`) | `server/prisma/schema.prisma:95-98` (`totalAmount`, `deposit`…) |
| 2 | ❌ Một tài khoản gắn đúng 1 studio | `server/src/middleware/auth.ts:31` lấy `tenantId` cố định từ thẻ đăng nhập |
| 3 | ❌ Không có migration | `server/prisma/` chỉ có `schema.prisma`; lệnh `db:push` ở `server/package.json` |
| 4 | ❌ 35 tệp dùng bộ nhớ trình duyệt | đếm bằng `grep -rl localStorage` |
| 5 | ❌ Khoá Gemini được nhét vào mã trang web | `vite.config.ts:16-17` |
| 6 | ❌ Mật khẩu chung qua header `x-admin-password` | `server/src/middleware/auth.ts:57` |
| 7 | ⚠️ Có 5 tệp thử, chưa chạy | — |
| — | Nhiều dữ liệu nghiệp vụ dồn trong cột JSON (`items`, `paymentHistory`, `salary`…) | `schema.prisma:74-107` |
| — | Ảnh layout makeup là ảnh giả `picsum.photos` | `data/makeupLayouts.ts` |

### Kết luận
**Không xây Makeup Pro trên `ssaas`. Xây mới ở `SSSTUDIO96/a`, dùng lại bộ công nghệ.**

- Dùng lại: React + Vite + TypeScript, Express + Prisma + PostgreSQL, Vercel + Railway + Supabase. Đúng bộ bản yêu cầu đòi, anh không phải đổi hạ tầng.
- Dùng lại: kinh nghiệm nghiệp vụ của Studio Pro (luồng hợp đồng, lương thưởng, lịch thợ). R&D học giao diện từ đây.
- Không dùng lại: cấu trúc dữ liệu, cơ chế đăng nhập và phân quyền. Lỗi 1, 2, 3, 6 nằm ở móng, sửa ở móng tốn hơn xây mới.
- Không đụng `ssaas` (anh Chiến chốt ngày 18/10/2026). Không kết nối Supabase/Railway đang chạy.

### Môi trường phiên này
- Node 22.22, pnpm 10.28, PostgreSQL 16.15 chạy ngay trong máy đám mây (dùng để thử, không phải máy thật).
- Chưa có: Supabase/Railway riêng cho Makeup Pro, khoá Google Maps, cổng thanh toán, tài khoản Apple Developer.
