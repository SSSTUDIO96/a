// Cấu hình kho tệp nằm trong EnvSchema (env.ts): production thiếu biến → loadEnv ném lỗi ngay lúc khởi động,
// có tên biến thiếu, không in giá trị bí mật. Không còn kiểu "khởi động được, hỏng khi có người tải tệp đầu tiên".
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';
import { createStorageFromEnv, LocalDiskDriver, S3Driver } from '../src/lib/storage';

const JWT = 'jwt-bi-mat-rieng-cua-bai-thu-0123456789';
const SIGNING = 'khoa-ky-url-bi-mat-cua-bai-thu-0123456789';
const S3_SECRET = 'S3-KHOA-BI-MAT-KHONG-DUOC-LO-RA-LOG';
const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/x', JWT_ACCESS_SECRET: JWT };
const prodLocal = {
  ...base,
  NODE_ENV: 'production',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: '/data/files',
  STORAGE_SIGNING_SECRET: SIGNING,
  STORAGE_PUBLIC_BASE_URL: 'https://api.makeup.vn',
};
const prodS3 = {
  ...base,
  NODE_ENV: 'production',
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'https://abc.supabase.co/storage/v1/s3',
  S3_REGION: 'ap-southeast-1',
  S3_BUCKET: 'makeup',
  S3_ACCESS_KEY_ID: 'AKIA-THU',
  S3_SECRET_ACCESS_KEY: S3_SECRET,
  S3_FORCE_PATH_STYLE: 'true',
};

function errorOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  throw new Error('Mong ném lỗi nhưng không ném');
}

describe('cấu hình kho tệp trong env.ts', () => {
  it('BẮT: production thiếu STORAGE_SIGNING_SECRET → đọc env ném lỗi có tên biến', () => {
    const { STORAGE_SIGNING_SECRET: _s, ...missing } = prodLocal;
    expect(() => loadEnv(missing)).toThrow(/STORAGE_SIGNING_SECRET/);
    expect(() => loadEnv({ ...prodLocal, STORAGE_SIGNING_SECRET: '' })).toThrow(/STORAGE_SIGNING_SECRET/);
  });

  it('production: thiếu STORAGE_DRIVER, thiếu từng biến của driver local/s3 → lỗi nêu đúng tên biến', () => {
    const { STORAGE_DRIVER: _d, ...noDriver } = prodLocal;
    expect(() => loadEnv(noDriver)).toThrow(/STORAGE_DRIVER/);
    for (const key of ['STORAGE_LOCAL_DIR', 'STORAGE_PUBLIC_BASE_URL'] as const) {
      const { [key]: _x, ...rest } = prodLocal;
      expect(() => loadEnv(rest), key).toThrow(new RegExp(key));
    }
    for (const key of ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_FORCE_PATH_STYLE'] as const) {
      const { [key]: _x, ...rest } = prodS3;
      expect(() => loadEnv(rest), key).toThrow(new RegExp(key));
    }
    // Thiếu nhiều biến: báo đủ tên trong một lần.
    const msg = errorOf(() => loadEnv({ ...base, NODE_ENV: 'production', STORAGE_DRIVER: 'local' }));
    for (const key of ['STORAGE_LOCAL_DIR', 'STORAGE_SIGNING_SECRET', 'STORAGE_PUBLIC_BASE_URL']) expect(msg).toContain(key);
  });

  it('khoá ký ngắn, trùng JWT_ACCESS_SECRET → lỗi; lời báo KHÔNG chứa giá trị bí mật', () => {
    const short = errorOf(() => loadEnv({ ...prodLocal, STORAGE_SIGNING_SECRET: 'ngan-qua-bi-mat' }));
    expect(short).toMatch(/STORAGE_SIGNING_SECRET/);
    expect(short).not.toContain('ngan-qua-bi-mat');
    const same = errorOf(() => loadEnv({ ...prodLocal, STORAGE_SIGNING_SECRET: JWT }));
    expect(same).toMatch(/STORAGE_SIGNING_SECRET/);
    expect(same).not.toContain(JWT);
    const { S3_BUCKET: _b, ...s3NoBucket } = prodS3;
    const s3msg = errorOf(() => loadEnv(s3NoBucket));
    expect(s3msg).not.toContain(S3_SECRET);
    expect(s3msg).not.toContain('AKIA-THU');
  });

  it('production đủ cấu hình → khởi động được, tạo đúng driver', () => {
    expect(createStorageFromEnv(loadEnv(prodLocal))).toBeInstanceOf(LocalDiskDriver);
    expect(createStorageFromEnv(loadEnv(prodS3))).toBeInstanceOf(S3Driver);
  });

  it('development/test: bỏ trống (kể cả dòng "BIEN=" rỗng chép từ .env.example) → đĩa tạm, khoá suy từ JWT', () => {
    expect(createStorageFromEnv(loadEnv({ ...base, NODE_ENV: 'development' }))).toBeInstanceOf(LocalDiskDriver);
    const blank = loadEnv({ ...base, NODE_ENV: 'development', STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: '', STORAGE_SIGNING_SECRET: '', S3_BUCKET: '' });
    expect(blank.STORAGE_LOCAL_DIR).toBeUndefined();
    expect(createStorageFromEnv(blank)).toBeInstanceOf(LocalDiskDriver);
    // Driver s3 thiếu biến thì ở môi trường nào cũng không dùng được → báo ngay lúc đọc env.
    expect(() => loadEnv({ ...base, NODE_ENV: 'development', STORAGE_DRIVER: 's3' })).toThrow(/S3_ENDPOINT/);
  });
});
