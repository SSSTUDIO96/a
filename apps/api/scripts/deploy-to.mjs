// Áp migration vào ĐÚNG một database chỉ định (sổ lỗi mục 16).
// schema.prisma có directUrl = env("DIRECT_URL"), và Prisma áp migration qua directUrl. Chỉ đặt DATABASE_URL thì
// migration đi vào database ghi trong .env (DIRECT_URL), không phải database mình nhắm. Lệnh này đặt CẢ HAI biến,
// rồi đếm lại trên chính database đích để chứng minh đã áp đúng chỗ.
// Dùng: pnpm db:deploy-to postgresql://user:pass@host:5432/makeup_test_x
//
// Gọi Prisma KHÔNG qua `npx` và KHÔNG qua cửa sổ lệnh (shell): chạy thẳng `node <tệp chạy của prisma> <tham số…>`.
// Lý do: trên Windows `npx` là `npx.cmd`; gọi tệp .cmd không qua shell báo ENOENT, và Node bản mới còn chặn hẳn (EINVAL)
// trừ khi bật shell — mà bật shell thì mở đường chèn lệnh. Gọi chính `node` (process.execPath) thì giống nhau trên
// Windows và Linux, tham số luôn là một mảng, không ghép thành chuỗi lệnh.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Trả về { command, args } để chạy Prisma với các tham số cho trước. Tách riêng để thử được.
export function lenhPrisma(thamSo) {
  const require = createRequire(import.meta.url);
  const goiPrisma = require.resolve('prisma/package.json');
  const bin = JSON.parse(readFileSync(goiPrisma, 'utf8')).bin;
  const tepChay = typeof bin === 'string' ? bin : bin.prisma;
  return { command: process.execPath, args: [path.join(path.dirname(goiPrisma), tepChay), ...thamSo] };
}

function chayPrisma(thamSo, tuyChon) {
  const { command, args } = lenhPrisma(thamSo);
  return execFileSync(command, args, tuyChon);
}

function chinh() {
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
  chayPrisma(['migrate', 'deploy'], { stdio: 'inherit', env });
  const out = chayPrisma(['migrate', 'status'], { env, encoding: 'utf8' });
  if (!out.includes(`"${dbName}"`) || !/Database schema is up to date/.test(out)) {
    console.error(`Kiểm lại thất bại: trạng thái không nói về "${dbName}" hoặc còn migration chưa áp.\n${out}`);
    process.exit(1);
  }
  console.log(`Đã áp migration vào đúng database "${dbName}" và kiểm lại: khớp.`);
}

// Chỉ chạy khi gọi thẳng tệp này (không chạy khi bài thử nạp vào để thử hàm lenhPrisma).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) chinh();
