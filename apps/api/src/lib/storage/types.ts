import type { Readable } from 'node:stream';

export interface StoredObjectInfo {
  sizeBytes: number;
  contentType: string | null;
}

// Lớp trừu tượng nơi lưu tệp. Mã nghiệp vụ chỉ biết khoá (storageKey), không biết đường dẫn đĩa hay tên bucket.
export interface StorageDriver {
  readonly kind: 'local' | 's3';
  put(key: string, data: Buffer | Readable, contentType: string): Promise<void>;
  // URL đọc tệp có hạn. Hết hạn hoặc bị sửa chữ ký thì không đọc được.
  getSignedUrl(key: string, expiresSec: number): Promise<string>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<StoredObjectInfo | null>;
}

// Khoá do máy chủ tự sinh (tổ chức/mục đích/uuid.đuôi); vẫn kiểm để không bao giờ thoát ra ngoài thư mục gốc.
export function assertSafeKey(key: string): void {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,250}$/.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`Khoá lưu trữ không hợp lệ: ${key}`);
  }
}
