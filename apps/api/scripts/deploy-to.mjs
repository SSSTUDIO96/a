// Áp migration vào ĐÚNG một database chỉ định (sổ lỗi mục 16).
// schema.prisma có directUrl = env("DIRECT_URL"), và Prisma áp migration qua directUrl. Chỉ đặt DATABASE_URL thì
// migration đi vào database ghi trong .env (DIRECT_URL), không phải database mình nhắm. Lệnh này đặt CẢ HAI biến,
// rồi đếm lại trên chính database đích để chứng minh đã áp đúng chỗ.
// Dùng: pnpm db:deploy-to postgresql://user:pass@host:5432/makeup_test_x
import { execFileSync } from 'node:child_process';

const url = process.argv[2];
if (!url) {
  console.error('Thiếu đường kết nối database đích. Dùng: pnpm db:deploy-to <postgresql://…/ten_database>');
  process.exit(1);
}
const dbName = new URL(url).pathname.replace(/^\//, '');
if (!/^makeup_test[a-z0-9_]*$/.test(dbName) && !process.argv.includes('--khong-phai-database-thu')) {
  console.error(`Từ chối: "${dbName}" không phải database thử (makeup_test…). Database khác phải ghi rõ cờ --khong-phai-database-thu.`);
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env });
const out = execFileSync('npx', ['prisma', 'migrate', 'status'], { env, encoding: 'utf8' });
if (!out.includes(`"${dbName}"`) || !/Database schema is up to date/.test(out)) {
  console.error(`Kiểm lại thất bại: trạng thái không nói về "${dbName}" hoặc còn migration chưa áp.\n${out}`);
  process.exit(1);
}
console.log(`Đã áp migration vào đúng database "${dbName}" và kiểm lại: khớp.`);
