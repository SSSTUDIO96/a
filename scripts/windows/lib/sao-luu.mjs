// 4-SAO-LUU: chép toàn bộ database (pg_dump -Fc) và thư mục ảnh tải lên vào <thư mục dữ liệu>/sao-luu/<ngày-giờ>/.
// Chạy được cả khi Makeup Pro đang bật. Kiểm lại tệp sao lưu bằng pg_restore --list.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TEP_ENV, THU_MUC_DU_LIEU_MAC_DINH, banChinh, canhBao, chayChinh, chayChuongTrinh, docEnv, docThamSo, dung, inRa,
  tachUrlDatabase, timCongCuPg, tot,
} from './chung.mjs';

function dungLuong(p) {
  const st = statSync(p);
  if (!st.isDirectory()) return st.size;
  return readdirSync(p).reduce((s, x) => s + dungLuong(join(p, x)), 0);
}
const kb = (n) => (n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

await chayChinh(async () => {
  const env = docEnv();
  if (!env?.DATABASE_URL) dung(`Chưa có ${TEP_ENV}. Bấm 1-CAI-DAT-LAN-DAU trước.`);
  const db = tachUrlDatabase(env.DATABASE_URL);
  const pgDump = timCongCuPg('pg_dump', env);
  const pgRestore = timCongCuPg('pg_restore', env);
  if (!pgDump) dung('Không thấy lệnh pg_dump (đi kèm PostgreSQL). Cài PostgreSQL 16 theo https://www.postgresql.org/download/windows/');

  const t = docThamSo();
  const goc = typeof t['thu-muc'] === 'string' ? t['thu-muc'] : join(env.MAKEUP_THU_MUC_DU_LIEU || THU_MUC_DU_LIEU_MAC_DINH, 'sao-luu');
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const ten = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`;
  const thuMuc = join(goc, ten);
  mkdirSync(thuMuc, { recursive: true });
  inRa(`Sao lưu Makeup Pro vào ${thuMuc}`);

  const banDump = banChinh(chayChuongTrinh(pgDump, ['--version']).ra);
  const tepDump = join(thuMuc, `${db.database}.dump`);
  const pgEnv = { ...process.env, PGPASSWORD: db.password, PGCONNECT_TIMEOUT: '10' };
  const r = chayChuongTrinh(pgDump, ['-Fc', '-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '-f', tepDump], { env: pgEnv });
  if (r.ma !== 0) dung(`pg_dump thất bại: ${r.loi.trim()}${/server version/.test(r.loi) ? `\n  pg_dump bản ${banDump} cũ hơn máy chủ — dùng pg_dump cùng bản với PostgreSQL.` : ''}`);
  if (pgRestore) {
    const l = chayChuongTrinh(pgRestore, ['--list', tepDump]);
    if (l.ma !== 0) dung(`Tệp sao lưu đọc lại không được: ${l.loi.trim()}`);
    const soBang = (l.ra.match(/ TABLE DATA /g) || []).length;
    tot(`Database "${db.database}" → ${tepDump} (${kb(statSync(tepDump).size)}, ${soBang} bảng, đọc lại được)`);
  } else tot(`Database "${db.database}" → ${tepDump} (${kb(statSync(tepDump).size)})`);

  const anh = env.STORAGE_LOCAL_DIR;
  if (anh && existsSync(anh)) {
    cpSync(anh, join(thuMuc, 'anh-tai-len'), { recursive: true });
    tot(`Ảnh tải lên → ${join(thuMuc, 'anh-tai-len')} (${kb(dungLuong(join(thuMuc, 'anh-tai-len')))})`);
  } else canhBao('Không có thư mục ảnh (STORAGE_LOCAL_DIR) để chép — bỏ qua phần ảnh.');

  writeFileSync(join(thuMuc, 'DOC-TOI.txt'), [
    `Bản sao lưu Makeup Pro lúc ${d.toLocaleString('vi-VN')}`,
    `- ${db.database}.dump : toàn bộ database "${db.database}" (pg_dump -Fc, PostgreSQL ${banDump ?? '?'})`,
    '- anh-tai-len\\       : ảnh và tệp người dùng tải lên',
    '',
    'Khôi phục vào một database MỚI (không đè database đang dùng) — xem docs/CHAY-THU-TREN-MAY.md mục "Sao lưu và khôi phục":',
    `  createdb -h ${db.host} -p ${db.port} -U ${db.user} ${db.database}_khoiphuc`,
    `  pg_restore -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database}_khoiphuc --no-owner ${db.database}.dump`,
    '  rồi chép thư mục anh-tai-len về chỗ ghi ở STORAGE_LOCAL_DIR trong apps/api/.env.',
    'Tệp này không chứa mật khẩu. Nên chép cả thư mục sang ổ khác hoặc USB.',
    '',
  ].join('\r\n'));
  inRa(`\nXONG. Nên chép cả thư mục ${thuMuc} sang ổ khác, USB hoặc Google Drive.`);
});
