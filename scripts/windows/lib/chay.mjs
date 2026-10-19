// 2-CHAY-MAKEUP-PRO: bật máy chủ API (`pnpm dev` trong apps/api) và trang web (`pnpm exec vite` trong apps/web),
// chờ /health trả ok và trang web trả lời, rồi mở trình duyệt. Cửa sổ này phải để mở; đóng nó hoặc bấm Ctrl+C là tắt.
// Ghi số tiến trình (PID) vào <thư mục dữ liệu>/dang-chay.json để 3-TAT tắt được từ cửa sổ khác.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LA_WINDOWS, TEP_ENV, THU_MUC_API, THU_MUC_DU_LIEU_MAC_DINH, THU_MUC_WEB,
  chayChinh, che, congDangBan, conSong, docEnv, docThamSo, dung, inRa, moiTruongDuAn, ngu, tatCay, tepTrangThai, tot,
} from './chung.mjs';

const thamSo = docThamSo();

async function cho(url, kiem, giay) {
  const het = Date.now() + giay * 1000;
  while (Date.now() < het) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const body = await r.text();
      if (kiem(r, body)) return true;
    } catch {}
    await ngu(1000);
  }
  return false;
}

function moTrinhDuyet(url) {
  if (thamSo['khong-mo-trinh-duyet']) return inRa(`  (Không tự mở trình duyệt.) Mở tay: ${url}`);
  const [lenh, args] = LA_WINDOWS ? ['cmd.exe', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const c = spawn(lenh, args, { stdio: 'ignore', detached: true });
  c.on('error', () => inRa(`  Không tự mở được trình duyệt. Mở tay: ${url}`));
  c.unref();
}

function duoiNhatKy(tep, so = 25) {
  try {
    return che(readFileSync(tep, 'utf8').split(/\r?\n/).slice(-so).join('\n'));
  } catch {
    return '';
  }
}

await chayChinh(async () => {
  const env = docEnv();
  if (!env?.DATABASE_URL) dung(`Chưa có ${TEP_ENV}. Bấm 1-CAI-DAT-LAN-DAU trước.`);
  const congApi = String(env.PORT || '4000');
  const congWeb = String(thamSo['cong-web'] || env.MAKEUP_CONG_WEB || '5173');
  const diaChiWeb = `http://localhost:${congWeb}`;
  const trangThai = tepTrangThai(env);

  if (existsSync(trangThai)) {
    const cu = JSON.parse(readFileSync(trangThai, 'utf8'));
    if (conSong(cu.pidCuaSo) && (await congDangBan(congWeb))) {
      inRa(`Makeup Pro đang chạy rồi (mở từ ${cu.batDau}). Mở lại trình duyệt: ${diaChiWeb}`);
      moTrinhDuyet(diaChiWeb);
      return;
    }
    rmSync(trangThai, { force: true });
  }
  for (const [ten, c] of [['máy chủ API', congApi], ['trang web', congWeb]]) {
    if (await congDangBan(c)) dung(`Cổng ${c} (${ten}) đang bị chương trình khác giữ. Bấm 3-TAT, hoặc tắt chương trình kia, rồi bấm lại.`);
  }

  const thuMucNhatKy = join(env.MAKEUP_THU_MUC_DU_LIEU || THU_MUC_DU_LIEU_MAC_DINH, 'nhat-ky');
  mkdirSync(thuMucNhatKy, { recursive: true });
  const ngay = new Date().toISOString().slice(0, 10);
  const nkApi = join(thuMucNhatKy, `may-chu-${ngay}.log`);
  const nkWeb = join(thuMucNhatKy, `web-${ngay}.log`);
  const moiTruong = moiTruongDuAn(env);

  const bat = (thamSoPnpm, cwd, tepNk, envThem = {}) => {
    const ra = createWriteStream(tepNk, { flags: 'a' });
    ra.write(`\n===== ${new Date().toISOString()} bật: pnpm ${thamSoPnpm.join(' ')} =====\n`);
    const c = spawn('pnpm', thamSoPnpm, {
      cwd,
      env: { ...moiTruong, ...envThem },
      shell: LA_WINDOWS,
      detached: !LA_WINDOWS, // Linux/macOS: mỗi chương trình một nhóm tiến trình riêng, để tắt được cả nhóm.
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    c.stdout.on('data', (b) => ra.write(che(b.toString('utf8'))));
    c.stderr.on('data', (b) => ra.write(che(b.toString('utf8'))));
    return c;
  };

  inRa('Makeup Pro — đang bật…');
  const api = bat(['dev'], THU_MUC_API, nkApi);
  const web = bat(['exec', 'vite', '--port', congWeb, '--strictPort'], THU_MUC_WEB, nkWeb, { API_DEV_TARGET: `http://localhost:${congApi}` });
  mkdirSync(join(trangThai, '..'), { recursive: true });
  writeFileSync(trangThai, JSON.stringify({ pidCuaSo: process.pid, pidMayChu: api.pid, pidWeb: web.pid, congApi, congWeb, batDau: new Date().toLocaleString('vi-VN') }, null, 2));

  let dangTat = false;
  const tatHet = async (lyDo, ma = 0) => {
    if (dangTat) return;
    dangTat = true;
    inRa(`\n${lyDo}`);
    await Promise.all([tatCay(web.pid), tatCay(api.pid)]);
    rmSync(trangThai, { force: true });
    inRa('Đã tắt Makeup Pro.');
    process.exit(ma);
  };
  process.on('SIGINT', () => tatHet('Nhận Ctrl+C — đang tắt…'));
  process.on('SIGTERM', () => tatHet('Nhận lệnh tắt — đang tắt…'));
  if (LA_WINDOWS) process.on('SIGHUP', () => tatHet('Cửa sổ bị đóng — đang tắt…'));
  api.on('exit', (ma) => !dangTat && (inRa(`\n[DỪNG] Máy chủ API tự tắt (mã ${ma}). 25 dòng cuối nhật ký ${nkApi}:\n${duoiNhatKy(nkApi)}`), tatHet('Tắt nốt trang web…', 1)));
  web.on('exit', (ma) => !dangTat && (inRa(`\n[DỪNG] Trang web tự tắt (mã ${ma}). 25 dòng cuối nhật ký ${nkWeb}:\n${duoiNhatKy(nkWeb)}`), tatHet('Tắt nốt máy chủ…', 1)));

  const okApi = await cho(`http://localhost:${congApi}/health`, (r, b) => r.ok && /"ok":true/.test(b), 120);
  if (!okApi) return tatHet(`[DỪNG] Máy chủ chưa trả lời /health sau 120 giây. Xem nhật ký: ${nkApi}\n${duoiNhatKy(nkApi)}`, 1);
  tot(`Máy chủ API chạy ở cổng ${congApi} (/health trả ok)`);
  const okWeb = await cho(diaChiWeb, (r, b) => r.ok && /<div id="root">/.test(b), 60);
  if (!okWeb) return tatHet(`[DỪNG] Trang web chưa trả lời sau 60 giây. Xem nhật ký: ${nkWeb}\n${duoiNhatKy(nkWeb)}`, 1);
  tot(`Trang web chạy ở ${diaChiWeb}`);
  moTrinhDuyet(diaChiWeb);
  inRa('');
  inRa('ĐANG CHẠY. Để nguyên cửa sổ này (thu nhỏ được).');
  inRa('Tắt: bấm Ctrl+C trong cửa sổ này, hoặc bấm 3-TAT.');
  inRa(`Nhật ký: ${thuMucNhatKy}`);
  await new Promise(() => {}); // chờ tới khi bị tắt
});
