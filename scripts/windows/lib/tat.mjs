// 3-TAT: tắt Makeup Pro đã bật bằng 2-CHAY-MAKEUP-PRO, theo số tiến trình (PID) ghi trong <thư mục dữ liệu>/dang-chay.json.
// Không tắt theo tên chương trình (không đụng tới các chương trình Node khác đang chạy trên máy).
// Database PostgreSQL KHÔNG bị tắt — nó chạy ngầm như một dịch vụ của máy.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { LA_WINDOWS, chayChinh, congDangBan, conSong, docEnv, inRa, ngu, tatCay, tepTrangThai, tot } from './chung.mjs';

await chayChinh(async () => {
  const env = docEnv();
  const tep = tepTrangThai(env);
  const congApi = String(env?.PORT || '4000');
  const congWeb = String(env?.MAKEUP_CONG_WEB || '5173');
  if (!existsSync(tep)) {
    inRa('Makeup Pro không chạy (không thấy dấu bật của 2-CHAY-MAKEUP-PRO).');
    for (const c of [congApi, congWeb]) if (await congDangBan(c)) inRa(`  Nhưng cổng ${c} đang có chương trình giữ — có thể anh bật bằng lệnh tay. Tắt bằng Ctrl+C trong cửa sổ đó.`);
    return;
  }
  const t = JSON.parse(readFileSync(tep, 'utf8'));
  inRa(`Đang tắt Makeup Pro (bật lúc ${t.batDau})…`);
  if (LA_WINDOWS) {
    // Windows: tắt cả cây tiến trình bắt đầu từ cửa sổ 2-CHAY (taskkill /T /F).
    await tatCay(t.pidCuaSo);
  } else if (conSong(t.pidCuaSo)) {
    // Linux/macOS: nhờ cửa sổ 2-CHAY tự tắt êm (nó gửi Ctrl+C cho máy chủ và web).
    try { process.kill(t.pidCuaSo, 'SIGTERM'); } catch {}
    for (let i = 0; i < 30 && conSong(t.pidCuaSo); i++) await ngu(500);
  }
  await tatCay(t.pidWeb);
  await tatCay(t.pidMayChu);
  for (let i = 0; i < 20 && ((await congDangBan(t.congApi)) || (await congDangBan(t.congWeb))); i++) await ngu(500);
  rmSync(tep, { force: true });
  const conBan = [t.congApi, t.congWeb].filter(Boolean);
  const vanBan = [];
  for (const c of conBan) if (await congDangBan(c)) vanBan.push(c);
  if (vanBan.length) inRa(`  [CHÚ Ý] Cổng ${vanBan.join(', ')} vẫn còn bị giữ. Khởi động lại máy nếu 2-CHAY báo cổng bận.`);
  else tot(`Đã tắt. Cổng ${conBan.join(' và ')} đã đóng. (PostgreSQL vẫn chạy ngầm — bình thường.)`);
});
