// Phần dùng chung cho các tệp bấm-một-lần trong scripts/windows/.
// Viết bằng Node (không phải PowerShell) để chạy được và kiểm được trên cả Windows lẫn Linux.
// LUẬT: không bao giờ in khoá bí mật hay mật khẩu ra màn hình. Mọi chữ in ra từ chương trình con đều qua che().
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LA_WINDOWS = process.platform === 'win32';
export const GOC_KHO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const THU_MUC_API = join(GOC_KHO, 'apps', 'api');
export const THU_MUC_WEB = join(GOC_KHO, 'apps', 'web');
export const TEP_ENV = join(THU_MUC_API, '.env');
// Dữ liệu của anh (ảnh, bản sao lưu, nhật ký) nằm NGOÀI thư mục mã, để cập nhật mã không đụng tới.
export const THU_MUC_DU_LIEU_MAC_DINH = resolve(GOC_KHO, '..', 'makeup-pro-du-lieu');

// ---------- Che bí mật ----------
const biMat = new Set();
export function ghiNhoBiMat(s) {
  if (s && String(s).length >= 4) biMat.add(String(s));
}
export function che(text) {
  let t = String(text ?? '');
  for (const s of biMat) t = t.split(s).join('***');
  return t;
}

// ---------- In ra màn hình ----------
export const inRa = (s = '') => console.log(che(s));
export const buoc = (n, s) => console.log(`\n=== Bước ${n}. ${s} ===`);
export const tot = (s) => console.log(`  [OK] ${che(s)}`);
export const canhBao = (s) => console.log(`  [CHÚ Ý] ${che(s)}`);
export class LoiDung extends Error {}
export function dung(s) {
  throw new LoiDung(s);
}

// ---------- Tham số dòng lệnh: --ten gia-tri | --co ----------
export function docThamSo(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true;
    else {
      out[k] = v;
      i++;
    }
  }
  return out;
}

// ---------- Hỏi người dùng ----------
let rl = null;
let anChu = false;
function giaoDien() {
  if (!rl) {
    rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    const goc = rl._writeToOutput.bind(rl);
    // Khi đang gõ mật khẩu: không hiện chữ gõ vào.
    rl._writeToOutput = (s) => {
      if (!anChu) return goc(s);
      if (s.includes('\n') || s.includes('\r')) return goc('\n');
    };
  }
  return rl;
}
export function dongHoi() {
  if (rl) rl.close();
  rl = null;
}
export function hoi(cauHoi, macDinh = '') {
  const goiY = macDinh ? ` [${macDinh}]` : '';
  return new Promise((res) => {
    giaoDien().question(`  ${cauHoi}${goiY}: `, (tl) => res(tl.trim() || macDinh));
  });
}
export function hoiAn(cauHoi) {
  return new Promise((res) => {
    const r = giaoDien();
    process.stdout.write(`  ${cauHoi} (chữ gõ vào sẽ không hiện): `);
    anChu = true;
    r.question('', (tl) => {
      anChu = false;
      res(tl);
    });
  });
}
export async function hoiCoKhong(cauHoi, macDinh = 'c') {
  const tl = (await hoi(`${cauHoi} (c = có, k = không)`, macDinh)).toLowerCase();
  return tl.startsWith('c') || tl.startsWith('y');
}

// ---------- Tệp .env ----------
export function docEnv(tep = TEP_ENV) {
  if (!existsSync(tep)) return null;
  const out = {};
  for (const dong of readFileSync(tep, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(dong);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

// Phân tích DATABASE_URL thành từng phần (để gọi psql/pg_dump với PGPASSWORD, không đưa mật khẩu lên dòng lệnh).
export function tachUrlDatabase(url) {
  const u = new URL(url);
  const p = {
    host: u.hostname || 'localhost',
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
  ghiNhoBiMat(p.password);
  return p;
}

// Môi trường cho các lệnh của dự án: lấy từ .env và GHI ĐÈ biến cùng tên đang đặt sẵn trong cửa sổ lệnh
// (biến đặt sẵn thắng .env khi Node/Prisma tự đọc — từng làm migration vào nhầm database, sổ lỗi mục 16/25).
export function moiTruongDuAn(env) {
  const out = { ...process.env, ...env };
  for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) tachUrlDatabase(env[k]);
  for (const k of ['JWT_ACCESS_SECRET', 'STORAGE_SIGNING_SECRET', 'S3_SECRET_ACCESS_KEY']) ghiNhoBiMat(env[k]);
  return out;
}

// ---------- Tìm chương trình ----------
function timTrongPath(ten) {
  const duoi = LA_WINDOWS ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const thuMuc of (process.env.PATH || '').split(LA_WINDOWS ? ';' : ':')) {
    if (!thuMuc) continue;
    for (const d of duoi) {
      const p = join(thuMuc.replace(/^"|"$/g, ''), ten + d.toLowerCase());
      const p2 = join(thuMuc.replace(/^"|"$/g, ''), ten + d);
      for (const x of [p, p2]) if (existsSync(x) && statSync(x).isFile()) return x;
    }
  }
  return null;
}

// Tìm công cụ PostgreSQL (psql, pg_dump, pg_isready, pg_restore).
// Thứ tự: thư mục ghi trong .env (MAKEUP_PG_BIN) → đường dẫn tìm lệnh (PATH) →
// trên Windows: C:\Program Files\PostgreSQL\<bản>\bin (chỗ bộ cài EDB đặt mặc định), ưu tiên bản 16.
export function timCongCuPg(ten, env = null) {
  const exe = LA_WINDOWS ? `${ten}.exe` : ten;
  if (env?.MAKEUP_PG_BIN && existsSync(join(env.MAKEUP_PG_BIN, exe))) return join(env.MAKEUP_PG_BIN, exe);
  const trongPath = timTrongPath(ten);
  if (trongPath) return trongPath;
  if (LA_WINDOWS) {
    for (const goc of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files']) {
      if (!goc) continue;
      const pg = join(goc, 'PostgreSQL');
      if (!existsSync(pg)) continue;
      const ban = readdirSync(pg).sort((a, b) => (a === '16' ? -1 : b === '16' ? 1 : Number(b) - Number(a)));
      for (const b of ban) {
        const p = join(pg, b, 'bin', exe);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

export function banChinh(chuoiPhienBan) {
  const m = /(\d+)(?:\.(\d+))?/.exec(chuoiPhienBan || '');
  return m ? Number(m[1]) : null;
}

// ---------- Chạy chương trình con ----------
// pnpm trên Windows là tệp pnpm.cmd: phải chạy qua cmd (shell). Chỉ truyền tham số cố định hoặc đã kiểm (email).
// Chữ in ra được đẩy lên màn hình ngay (pnpm install chạy lâu), sau khi che bí mật.
export function chayPnpm(thamSo, { cwd = GOC_KHO, env = process.env, im = false } = {}) {
  return new Promise((res) => {
    const con = spawn('pnpm', thamSo, { cwd, env, shell: LA_WINDOWS, stdio: ['ignore', 'pipe', 'pipe'] });
    let chu = '';
    const nhan = (b) => {
      const s = che(b.toString('utf8'));
      chu += s;
      if (!im) process.stdout.write(s.replace(/^(?=.)/gm, '    | '));
    };
    con.stdout.on('data', nhan);
    con.stderr.on('data', nhan);
    con.on('error', (e) => res({ ma: -1, chu: chu + che(e.message) }));
    con.on('close', (ma) => res({ ma: ma ?? -1, chu }));
  });
}

export function chayChuongTrinh(tep, thamSo, { env = process.env, input, cwd } = {}) {
  const r = spawnSync(tep, thamSo, { env, input, cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return { ma: r.status ?? -1, ra: che(r.stdout ?? ''), loi: che(r.stderr ?? '') + (r.error ? che(r.error.message) : '') };
}

export function phienBanPnpm() {
  const r = spawnSync('pnpm', ['-v'], { shell: LA_WINDOWS, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Mã thoát + chờ bấm phím do tệp .bat lo (lệnh pause). Ở đây chỉ in lỗi gọn, không in vết ngăn xếp.
export async function chayChinh(fn) {
  try {
    await fn();
    dongHoi();
  } catch (e) {
    dongHoi();
    if (e instanceof LoiDung) console.error(`\n[DỪNG] ${che(e.message)}`);
    else console.error(`\n[LỖI LẠ] ${che(e?.stack || e)}\nChụp màn hình này gửi cho người hỗ trợ (trong đây không có mật khẩu).`);
    process.exitCode = 1;
  }
}

// ---------- Tiến trình đang chạy (2-CHAY ghi, 3-TAT đọc) ----------
export const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
export function tepTrangThai(env) {
  return join(env?.MAKEUP_THU_MUC_DU_LIEU || THU_MUC_DU_LIEU_MAC_DINH, 'dang-chay.json');
}
export const conSong = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
export function congDangBan(cong) {
  return new Promise((res) => {
    const s = createConnection({ port: Number(cong), host: 'localhost' });
    s.once('connect', () => (s.destroy(), res(true)));
    s.once('error', () => res(false));
    s.setTimeout(1500, () => (s.destroy(), res(false)));
  });
}

// Tắt một chương trình con cùng mọi tiến trình nó sinh ra.
// Linux/macOS: gửi Ctrl+C (SIGINT) cho cả nhóm tiến trình — máy chủ in "Đang tắt máy chủ" và đóng database êm.
// Windows: không gửi được Ctrl+C sang cửa sổ khác, nên dùng taskkill /T /F (tắt cứng cả cây tiến trình).
export async function tatCay(pid) {
  if (!pid || !conSong(pid)) return;
  if (LA_WINDOWS) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGINT');
  } catch {}
  for (let i = 0; i < 20 && conSong(pid); i++) await ngu(500);
  if (conSong(pid)) try {
    process.kill(-pid, 'SIGKILL');
  } catch {}
}

