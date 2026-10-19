// 1-CAI-DAT-LAN-DAU: kiểm phần mềm → tạo database + vai trò + btree_gist → tạo apps/api/.env → pnpm install
// → áp migration (lệnh có sẵn `pnpm db:deploy`) → nạp gói mẫu (`platform:seed-plans -- --with-trial`).
// Chạy lại nhiều lần được: database/vai trò đã có thì giữ, .env đã có thì dùng lại, gói đã có thì giữ nguyên.
// KHÔNG tự tải hay cài phần mềm nào: thiếu thì báo chỗ tải chính thức rồi dừng.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOC_KHO, LA_WINDOWS, TEP_ENV, THU_MUC_API, THU_MUC_DU_LIEU_MAC_DINH,
  banChinh, buoc, canhBao, chayChinh, chayChuongTrinh, chayPnpm, docEnv, docThamSo, dung, ghiNhoBiMat,
  hoi, hoiAn, hoiCoKhong, inRa, moiTruongDuAn, phienBanPnpm, tachUrlDatabase, timCongCuPg, tot,
} from './chung.mjs';

const TEN_HOP_LE = /^[a-z_][a-z0-9_]{0,62}$/;
const thamSo = docThamSo();
const tuDong = Boolean(thamSo['mac-dinh']);

const xuoi = (p) => p.replace(/\\/g, '/');

function kiemPhanMem() {
  buoc(1, 'Kiểm phần mềm đã cài');
  const loi = [];
  const node = banChinh(process.versions.node);
  if (node < 22) loi.push(`Node.js đang là ${process.versions.node}, dự án cần bản 22. Tải bản 22 LTS ở trang chính thức https://nodejs.org/en/download`);
  else if (node !== 22) canhBao(`Node.js ${process.versions.node} (dự án viết cho bản 22; bản mới hơn thường vẫn chạy).`);
  else tot(`Node.js ${process.versions.node}`);

  const pnpm = phienBanPnpm();
  if (!pnpm) loi.push('Chưa có pnpm. Xem trang chính thức https://pnpm.io/installation — cách gọn nhất: mở PowerShell, gõ  npm install -g pnpm@10.28.0  rồi mở lại cửa sổ này.');
  else if (banChinh(pnpm) !== 10) canhBao(`pnpm ${pnpm} (dự án ghi pnpm@10.28.0).`);
  else tot(`pnpm ${pnpm}`);

  const psql = timCongCuPg('psql', docEnv());
  let banPsql = null;
  if (!psql) {
    loi.push('Chưa thấy PostgreSQL (lệnh psql). Tải PostgreSQL 16 ở trang chính thức https://www.postgresql.org/download/windows/ (bộ cài của EDB). Khi cài: GHI LẠI mật khẩu tài khoản postgres, giữ cổng 5432.');
  } else {
    const r = chayChuongTrinh(psql, ['--version']);
    banPsql = banChinh(r.ra);
    if (banPsql !== 16) canhBao(`PostgreSQL ${r.ra.trim()} — dự án dùng bản 16.`);
    else tot(`${r.ra.trim()}  (${psql})`);
  }
  if (loi.length) {
    inRa('\nCòn thiếu:');
    loi.forEach((l, i) => inRa(`  ${i + 1}. ${l}`));
    dung('Cài đủ những thứ trên rồi bấm lại 1-CAI-DAT-LAN-DAU. Tệp này không tự tải hay cài gì.');
  }
  return psql;
}

async function layCauHinh(envCu) {
  buoc(2, 'Thông tin cài đặt');
  if (envCu?.DATABASE_URL) {
    const db = tachUrlDatabase(envCu.DATABASE_URL);
    tot(`Đã có tệp apps/api/.env — dùng lại (database "${db.database}", vai trò "${db.user}"). Không ghi đè.`);
    return { db, envCu, moi: false };
  }
  const c = {
    database: thamSo['ten-database'] || 'makeup_studio',
    user: thamSo['vai-tro'] || 'makeup',
    host: thamSo['may-postgres'] || 'localhost',
    port: String(thamSo['cong-postgres'] || '5432'),
    thuMucDuLieu: thamSo['thu-muc-du-lieu'] || THU_MUC_DU_LIEU_MAC_DINH,
    congApi: String(thamSo['cong-api'] || '4000'),
    congWeb: String(thamSo['cong-web'] || '5173'),
  };
  inRa('  Giá trị mặc định:');
  inRa(`    Tên database ............ ${c.database}`);
  inRa(`    Vai trò (tài khoản) app . ${c.user}`);
  inRa(`    PostgreSQL ở ............ ${c.host}:${c.port}`);
  inRa(`    Thư mục dữ liệu ......... ${c.thuMucDuLieu}`);
  inRa('                              (ảnh tải lên, bản sao lưu, nhật ký — nằm ngoài thư mục mã)');
  inRa(`    Cổng máy chủ / web ...... ${c.congApi} / ${c.congWeb}`);
  if (!tuDong && !(await hoiCoKhong('Dùng các giá trị này?', 'c'))) {
    c.database = await hoi('Tên database', c.database);
    c.user = await hoi('Vai trò (tài khoản) của ứng dụng', c.user);
    c.host = await hoi('Máy PostgreSQL', c.host);
    c.port = await hoi('Cổng PostgreSQL', c.port);
    c.thuMucDuLieu = await hoi('Thư mục dữ liệu', c.thuMucDuLieu);
    c.congApi = await hoi('Cổng máy chủ API', c.congApi);
    c.congWeb = await hoi('Cổng trang web', c.congWeb);
  }
  for (const [k, v] of [['Tên database', c.database], ['Vai trò', c.user]]) {
    if (!TEN_HOP_LE.test(v)) dung(`${k} "${v}" không hợp lệ: chỉ dùng chữ thường không dấu, số, dấu gạch dưới; bắt đầu bằng chữ.`);
  }
  for (const [k, v] of [['Cổng PostgreSQL', c.port], ['Cổng máy chủ API', c.congApi], ['Cổng trang web', c.congWeb]]) {
    if (!/^\d{2,5}$/.test(v)) dung(`${k} "${v}" không phải số cổng.`);
  }
  // Mật khẩu vai trò app: ngẫu nhiên, chỉ chữ số hex (không có ký tự làm hỏng địa chỉ kết nối). Không in ra.
  const password = randomBytes(24).toString('hex');
  ghiNhoBiMat(password);
  return { db: { ...c, password }, c, moi: true };
}

function psqlArgs(k, database, extra = []) {
  return ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', k.host, '-p', String(k.port), '-U', k.user, '-d', database, ...extra];
}

// Thử đăng nhập bằng chính vai trò của app: được và đã có btree_gist thì không cần mật khẩu quản trị.
function kiemBangVaiTroApp(psql, db) {
  const env = { ...process.env, PGPASSWORD: db.password, PGCONNECT_TIMEOUT: '5' };
  const r = chayChuongTrinh(psql, psqlArgs(db, db.database, ['-tA', '-c', "select current_setting('server_version') || '|' || (select count(*) from pg_extension where extname='btree_gist')"]), { env });
  if (r.ma !== 0) return null;
  const [ban, ext] = r.ra.trim().split('|');
  return { ban, coBtreeGist: ext === '1' };
}

async function taoDatabase(psql, db, moi) {
  buoc(3, 'Tạo database, vai trò và bật btree_gist');
  const pgReady = timCongCuPg('pg_isready', docEnv());
  if (pgReady) {
    const r = chayChuongTrinh(pgReady, ['-h', db.host, '-p', String(db.port)]);
    if (r.ma !== 0) {
      dung(`PostgreSQL ở ${db.host}:${db.port} không trả lời (${r.ra.trim() || r.loi.trim()}).\n` +
        (LA_WINDOWS
          ? '  Trên Windows: bấm Start, gõ "Services" (Dịch vụ), tìm dòng postgresql-x64-16, bấm Start. Rồi bấm lại tệp này.'
          : '  Bật dịch vụ PostgreSQL rồi chạy lại.'));
    }
    tot(`PostgreSQL ở ${db.host}:${db.port} đang nhận kết nối`);
  }
  if (!moi) {
    const k = kiemBangVaiTroApp(psql, db);
    if (k && k.coBtreeGist) {
      tot(`Đăng nhập được bằng vai trò "${db.user}", database "${db.database}" đã có btree_gist (PostgreSQL ${k.ban}). Bỏ qua bước tạo.`);
      if (banChinh(k.ban) !== 16) canhBao(`Máy chủ PostgreSQL là bản ${k.ban}, dự án dùng bản 16.`);
      return;
    }
  }
  const quanTri = {
    host: thamSo['may-quan-tri'] || db.host,
    port: db.port,
    user: thamSo['quan-tri'] || 'postgres',
  };
  let matKhau = process.env.PGPASSWORD;
  if (matKhau) inRa(`  Dùng mật khẩu quản trị có sẵn trong biến PGPASSWORD (không in ra).`);
  else matKhau = await hoiAn(`Mật khẩu tài khoản quản trị "${quanTri.user}" của PostgreSQL (đặt lúc cài PostgreSQL)`);
  ghiNhoBiMat(matKhau);
  const env = { ...process.env, PGPASSWORD: matKhau, PGCONNECT_TIMEOUT: '10' };
  // Chỗ cắm CHỈ để thử trên Linux: chạy psql quản trị qua một tệp bọc (ví dụ dưới tài khoản hệ điều hành postgres).
  // Trên Windows không đặt biến này: dùng psql tìm được ở bước 1.
  const psqlQT = process.env.MAKEUP_PSQL_QUAN_TRI || psql;

  const ban = chayChuongTrinh(psqlQT, psqlArgs(quanTri, 'postgres', ['-tA', '-c', 'show server_version']), { env });
  if (ban.ma !== 0) {
    dung(`Không đăng nhập được bằng tài khoản "${quanTri.user}": ${ban.loi.trim()}\n  Kiểm lại mật khẩu (mật khẩu đặt lúc cài PostgreSQL), rồi bấm lại tệp này.`);
  }
  if (banChinh(ban.ra) !== 16) canhBao(`Máy chủ PostgreSQL là bản ${ban.ra.trim()}, dự án dùng bản 16.`);
  else tot(`Đăng nhập quản trị được. Máy chủ PostgreSQL ${ban.ra.trim()}`);

  // Tên đã kiểm bằng TEN_HOP_LE; mật khẩu chỉ gồm chữ số hex (hoặc lấy từ .env đã có) — vẫn bọc đúng kiểu SQL.
  const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const id = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const sql = `
select exists(select 1 from pg_roles where rolname = ${lit(db.user)}) as co_vai_tro \\gset
\\if :co_vai_tro
  \\echo VAI_TRO_DA_CO
\\endif
do $$ begin
  if exists (select 1 from pg_roles where rolname = ${lit(db.user)}) then
    alter role ${id(db.user)} login createdb password ${lit(db.password)};
  else
    create role ${id(db.user)} login createdb password ${lit(db.password)};
  end if;
end $$;
select exists(select 1 from pg_database where datname = ${lit(db.database)}) as co_db \\gset
\\if :co_db
  \\echo DATABASE_DA_CO
\\else
  create database ${id(db.database)} owner ${id(db.user)};
\\endif
select pg_get_userbyid(datdba) as chu_db from pg_database where datname = ${lit(db.database)} \\gset
\\echo CHU_DB=:chu_db
\\c ${id(db.database)}
create extension if not exists btree_gist;
select extversion as ban_ext from pg_extension where extname = 'btree_gist' \\gset
\\echo BTREE_GIST=:ban_ext
`;
  const r = chayChuongTrinh(psqlQT, psqlArgs(quanTri, 'postgres', ['-f', '-']), { env, input: sql });
  if (r.ma !== 0) dung(`Tạo database thất bại: ${r.loi.trim()}`);
  if (r.ra.includes('VAI_TRO_DA_CO')) canhBao(`Vai trò "${db.user}" đã có từ trước — đã đặt lại mật khẩu của nó theo tệp .env.`);
  else tot(`Tạo vai trò "${db.user}" (mật khẩu ngẫu nhiên, chỉ ghi trong .env)`);
  if (r.ra.includes('DATABASE_DA_CO')) canhBao(`Database "${db.database}" đã có từ trước — giữ nguyên dữ liệu trong đó.`);
  else tot(`Tạo database "${db.database}"`);
  const chu = /CHU_DB=(\S+)/.exec(r.ra)?.[1];
  if (chu && chu !== db.user) canhBao(`Database "${db.database}" thuộc vai trò "${chu}", không phải "${db.user}". Migration có thể bị từ chối quyền.`);
  const bg = /BTREE_GIST=(\S+)/.exec(r.ra)?.[1];
  if (!bg || bg.startsWith(':')) dung('Không bật được btree_gist.');
  tot(`Đã bật btree_gist ${bg}`);
  const k = kiemBangVaiTroApp(psql, db);
  if (!k?.coBtreeGist) dung(`Vai trò "${db.user}" chưa đăng nhập được vào "${db.database}" qua ${db.host}:${db.port}.`);
  tot(`Vai trò "${db.user}" đăng nhập được vào "${db.database}"`);
}

function ghiEnv(db, c) {
  buoc(4, 'Tạo tệp apps/api/.env');
  const url = `postgresql://${encodeURIComponent(db.user)}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.database}`;
  const jwt = randomBytes(32).toString('hex');
  ghiNhoBiMat(jwt);
  const anh = xuoi(join(c.thuMucDuLieu, 'anh-tai-len'));
  mkdirSync(anh, { recursive: true });
  const noiDung = [
    `# Tạo bởi scripts/windows/1-CAI-DAT-LAN-DAU ngày ${new Date().toISOString().slice(0, 10)}.`,
    '# KHÔNG gửi tệp này cho ai, không chụp màn hình, không đưa lên kho: trong đây có mật khẩu database và khoá ký đăng nhập.',
    'NODE_ENV=development',
    `PORT=${c.congApi}`,
    `DATABASE_URL=${url}`,
    `DIRECT_URL=${url}`,
    `JWT_ACCESS_SECRET=${jwt}`,
    'STORAGE_DRIVER=local',
    `STORAGE_LOCAL_DIR=${anh}`,
    '# Hai dòng dưới chỉ các tệp trong scripts/windows dùng (máy chủ bỏ qua).',
    `MAKEUP_THU_MUC_DU_LIEU=${xuoi(c.thuMucDuLieu)}`,
    `MAKEUP_CONG_WEB=${c.congWeb}`,
    '',
  ].join('\n');
  writeFileSync(TEP_ENV, noiDung, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  tot(`Đã ghi ${TEP_ENV} (mật khẩu và khoá ngẫu nhiên, không in ra màn hình)`);
  tot(`Ảnh tải lên sẽ nằm ở ${anh}`);
}

async function caiThuVien() {
  buoc(5, 'Cài thư viện (pnpm install) — lần đầu có thể mất vài phút');
  const r = await chayPnpm(['install', '--frozen-lockfile'], { cwd: GOC_KHO });
  if (r.ma !== 0) dung('pnpm install thất bại (xem chữ ở trên). Kiểm mạng Internet rồi bấm lại.');
  tot('Đã cài thư viện');
}

async function apMigration(env, db) {
  buoc(6, 'Dựng bảng (áp migration)');
  const soMigration = readdirSync(join(THU_MUC_API, 'prisma', 'migrations'), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  const moiTruong = moiTruongDuAn(env);
  const r = await chayPnpm(['db:deploy'], { cwd: THU_MUC_API, env: moiTruong });
  if (r.ma !== 0) dung('Áp migration thất bại (xem chữ ở trên).');
  // Đếm lại trên chính database đích, như scripts/deploy-to.mjs (sổ lỗi mục 16: migration từng đi nhầm database).
  const s = await chayPnpm(['exec', 'prisma', 'migrate', 'status'], { cwd: THU_MUC_API, env: moiTruong, im: true });
  if (!s.chu.includes(`"${db.database}"`) || !/Database schema is up to date/.test(s.chu)) {
    dung(`Kiểm lại thất bại: trạng thái không nói về "${db.database}" hoặc còn migration chưa áp.\n${s.chu}`);
  }
  tot(`Đủ ${soMigration} migration trên đúng database "${db.database}"`);
}

async function napGoi(env) {
  buoc(7, 'Nạp gói cước mẫu (có gói Dùng thử)');
  const r = await chayPnpm(['platform:seed-plans', '--', '--with-trial'], { cwd: THU_MUC_API, env: moiTruongDuAn(env) });
  if (r.ma !== 0) dung('Nạp gói thất bại (xem chữ ở trên).');
  tot('Đã nạp gói (gói đã có được giữ nguyên, kể cả giá)');
}

await chayChinh(async () => {
  inRa('Makeup Pro — cài đặt lần đầu');
  inRa(`Thư mục mã: ${GOC_KHO}`);
  const psql = kiemPhanMem();
  const envCu = docEnv();
  if (envCu && !envCu.DATABASE_URL) dung(`Tệp ${TEP_ENV} đã có nhưng thiếu DATABASE_URL. Đổi tên tệp đó (ví dụ .env.cu) rồi bấm lại để tạo tệp mới.`);
  const ch = await layCauHinh(envCu);
  await taoDatabase(psql, ch.db, ch.moi);
  if (ch.moi) ghiEnv(ch.db, ch.c);
  else buoc(4, 'Tệp apps/api/.env đã có — giữ nguyên');
  const env = docEnv();
  if (!existsSync(join(GOC_KHO, 'node_modules')) || !thamSo['bo-qua-cai-thu-vien']) await caiThuVien();
  await apMigration(env, ch.db);
  await napGoi(env);
  inRa('\nXONG. Việc tiếp theo:');
  inRa('  1. Bấm 2-CHAY-MAKEUP-PRO — trình duyệt tự mở trang đăng nhập.');
  inRa('  2. Bấm "Đăng ký", tạo tài khoản của anh, tạo tổ chức.');
  inRa('  3. Bấm 5-CAP-QUYEN-QUAN-TRI, gõ email vừa đăng ký — để vào trang /quan-tri cấp gói.');
  inRa('  4. Mỗi tuần (và trước khi cập nhật mã mới): bấm 4-SAO-LUU.');
});
