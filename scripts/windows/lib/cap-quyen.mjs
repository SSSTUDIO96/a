// 5-CAP-QUYEN-QUAN-TRI: cấp quyền quản trị nền tảng (vào được /quan-tri, cấp gói cho tổ chức) cho một tài khoản ĐÃ đăng ký.
// Dùng lệnh có sẵn: pnpm platform:grant-admin -- --email <email>   (thêm --thu-lai để thu quyền: --revoke).
import {
  THU_MUC_API, TEP_ENV, chayChinh, chayPnpm, docEnv, docThamSo, dung, hoi, inRa, moiTruongDuAn,
} from './chung.mjs';

// Email chỉ gồm ký tự an toàn: lệnh pnpm trên Windows đi qua cmd, nên chặn mọi ký tự cmd hiểu là lệnh.
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

await chayChinh(async () => {
  const env = docEnv();
  if (!env?.DATABASE_URL) dung(`Chưa có ${TEP_ENV}. Bấm 1-CAI-DAT-LAN-DAU trước.`);
  const t = docThamSo();
  const thu = Boolean(t['thu-lai']);
  inRa(thu ? 'Thu lại quyền quản trị nền tảng' : 'Cấp quyền quản trị nền tảng (vào trang /quan-tri để cấp gói cho tổ chức)');
  inRa('Tài khoản phải ĐĂNG KÝ ở trang web trước.');
  const email = (typeof t.email === 'string' ? t.email : await hoi('Email của tài khoản')).trim();
  if (!EMAIL.test(email)) dung(`Email "${email}" không hợp lệ.`);
  const thamSo = ['platform:grant-admin', '--', '--email', email];
  if (thu) thamSo.push('--revoke');
  const r = await chayPnpm(thamSo, { cwd: THU_MUC_API, env: moiTruongDuAn(env) });
  if (r.ma !== 0) dung('Không cấp được (lý do ở dòng trên). Thường gặp: email chưa đăng ký — đăng ký ở trang web trước.');
  if (!thu) inRa('\nXONG. Vào trình duyệt, gõ địa chỉ  http://localhost:' + (env.MAKEUP_CONG_WEB || '5173') + '/quan-tri  (tải lại trang nếu đang mở).');
});
