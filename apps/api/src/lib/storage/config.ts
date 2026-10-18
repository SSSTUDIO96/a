import { createHmac } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { loadEnv, type Env } from '../../env';
import { LocalDiskDriver } from './local';
import { S3Driver } from './s3';
import type { StorageDriver } from './types';

// Biến kho tệp khai và kiểm ở EnvSchema (env.ts): production thiếu biến thì máy chủ KHÔNG khởi động
// (server.ts gọi loadEnv lúc bật), không còn kiểu chạy được rồi hỏng khi có người tải tệp đầu tiên.
export type StorageEnv = Pick<
  Env,
  | 'NODE_ENV'
  | 'JWT_ACCESS_SECRET'
  | 'STORAGE_DRIVER'
  | 'STORAGE_LOCAL_DIR'
  | 'STORAGE_SIGNING_SECRET'
  | 'STORAGE_PUBLIC_BASE_URL'
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_BUCKET'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
  | 'S3_FORCE_PATH_STYLE'
>;

// EnvSchema đã bảo đảm có giá trị; còn thiếu ở đây nghĩa là cấu hình không đi qua loadEnv — lỗi lắp ráp, không đoán.
function present<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`Cấu hình kho tệp thiếu ${name} (cấu hình phải đọc qua loadEnv)`);
  return value;
}

export function createStorageFromEnv(e: StorageEnv): StorageDriver {
  const prod = e.NODE_ENV === 'production';
  const driver = prod ? present(e.STORAGE_DRIVER, 'STORAGE_DRIVER') : (e.STORAGE_DRIVER ?? 'local');
  if (driver === 's3') {
    return new S3Driver({
      endpoint: present(e.S3_ENDPOINT, 'S3_ENDPOINT'),
      region: present(e.S3_REGION, 'S3_REGION'),
      bucket: present(e.S3_BUCKET, 'S3_BUCKET'),
      accessKeyId: present(e.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
      secretAccessKey: present(e.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
      forcePathStyle: present(e.S3_FORCE_PATH_STYLE, 'S3_FORCE_PATH_STYLE') === 'true',
    });
  }
  if (prod) {
    return new LocalDiskDriver(
      present(e.STORAGE_LOCAL_DIR, 'STORAGE_LOCAL_DIR'),
      present(e.STORAGE_SIGNING_SECRET, 'STORAGE_SIGNING_SECRET'),
      present(e.STORAGE_PUBLIC_BASE_URL, 'STORAGE_PUBLIC_BASE_URL'),
    );
  }
  // Chỉ development/test: thư mục tạm của máy, khoá ký suy ra từ JWT_ACCESS_SECRET (mỗi môi trường một khoá khác nhau).
  const secret = e.STORAGE_SIGNING_SECRET ?? createHmac('sha256', e.JWT_ACCESS_SECRET).update('storage-url-signing').digest('hex');
  return new LocalDiskDriver(e.STORAGE_LOCAL_DIR ?? path.join(os.tmpdir(), `makeup-files-${e.NODE_ENV}`), secret, e.STORAGE_PUBLIC_BASE_URL ?? '');
}

let cached: StorageDriver | null = null;

// Một driver cho cả tiến trình, tạo lúc dùng lần đầu, từ cùng EnvSchema mà server.ts đã kiểm lúc khởi động.
export function getStorage(): StorageDriver {
  cached ??= createStorageFromEnv(loadEnv(process.env));
  return cached;
}
