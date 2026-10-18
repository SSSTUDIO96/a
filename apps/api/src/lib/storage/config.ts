import { createHmac } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { LocalDiskDriver } from './local';
import { S3Driver } from './s3';
import type { StorageDriver } from './types';

// Biến môi trường của kho tệp. TẠM đọc thẳng từ process.env vì env.ts (của điều phối) chưa có các biến này —
// xem PHIẾU VƯỚNG. Môi trường production thiếu cấu hình thì ném lỗi, không tự chọn giá trị.
const StorageEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  JWT_ACCESS_SECRET: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 's3']).optional(),
  STORAGE_LOCAL_DIR: z.string().min(1).optional(),
  STORAGE_SIGNING_SECRET: z.string().min(32, 'STORAGE_SIGNING_SECRET phải dài ít nhất 32 ký tự').optional(),
  STORAGE_PUBLIC_BASE_URL: z.url().optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
});

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`Cấu hình kho tệp thiếu ${name}`);
  return value;
}

export function createStorageFromEnv(source: NodeJS.ProcessEnv): StorageDriver {
  const parsed = StorageEnv.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Cấu hình kho tệp không hợp lệ — ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const e = parsed.data;
  const prod = e.NODE_ENV === 'production';
  const driver = prod ? required(e.STORAGE_DRIVER, 'STORAGE_DRIVER') : (e.STORAGE_DRIVER ?? 'local');
  if (driver === 's3') {
    return new S3Driver({
      endpoint: required(e.S3_ENDPOINT, 'S3_ENDPOINT'),
      region: required(e.S3_REGION, 'S3_REGION'),
      bucket: required(e.S3_BUCKET, 'S3_BUCKET'),
      accessKeyId: required(e.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
      secretAccessKey: required(e.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
      forcePathStyle: required(e.S3_FORCE_PATH_STYLE, 'S3_FORCE_PATH_STYLE') === 'true',
    });
  }
  if (prod) {
    return new LocalDiskDriver(
      required(e.STORAGE_LOCAL_DIR, 'STORAGE_LOCAL_DIR'),
      required(e.STORAGE_SIGNING_SECRET, 'STORAGE_SIGNING_SECRET'),
      required(e.STORAGE_PUBLIC_BASE_URL, 'STORAGE_PUBLIC_BASE_URL'),
    );
  }
  // Chỉ development/test: thư mục tạm của máy, khoá ký suy ra từ JWT_ACCESS_SECRET (mỗi môi trường một khoá khác nhau).
  const secret = e.STORAGE_SIGNING_SECRET ?? createHmac('sha256', required(e.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET')).update('storage-url-signing').digest('hex');
  return new LocalDiskDriver(e.STORAGE_LOCAL_DIR ?? path.join(os.tmpdir(), `makeup-files-${e.NODE_ENV}`), secret, e.STORAGE_PUBLIC_BASE_URL ?? '');
}

let cached: StorageDriver | null = null;

// Một driver cho cả tiến trình, tạo lúc dùng lần đầu.
export function getStorage(): StorageDriver {
  cached ??= createStorageFromEnv(process.env);
  return cached;
}
