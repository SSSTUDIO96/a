import { execSync } from 'node:child_process';

// Áp các migration còn thiếu vào database thử bằng đúng lệnh dùng trên máy thật (không xoá dữ liệu).
// Mỗi bài thử tự tạo tài khoản/tổ chức với mã ngẫu nhiên nên không cần xoá database giữa các lần chạy.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://makeup:makeup_local@localhost:5432/makeup_test';
  if (!/makeup_test/.test(url)) {
    throw new Error(`Từ chối chạy bài thử trên database không phải database thử: ${url}`);
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
