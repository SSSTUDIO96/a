import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { signToken } from './signing';
import { assertSafeKey, type StorageDriver, type StoredObjectInfo } from './types';

// Đường phục vụ tệp của driver đĩa: kiểm chữ ký + hạn rồi mới đọc (modules/files/raw.ts).
export const RAW_FILE_PATH = '/api/v1/files/raw';

export class LocalDiskDriver implements StorageDriver {
  readonly kind = 'local' as const;

  constructor(
    private readonly root: string,
    readonly signingSecret: string,
    private readonly publicBaseUrl: string,
  ) {}

  private pathOf(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error(`Khoá lưu trữ thoát khỏi thư mục gốc: ${key}`);
    return full;
  }

  async put(key: string, data: Buffer | Readable, _contentType: string): Promise<void> {
    const full = this.pathOf(key);
    await mkdir(path.dirname(full), { recursive: true });
    // Ghi ra tệp tạm rồi đổi tên: người đọc không bao giờ thấy tệp ghi dở.
    const tmp = `${full}.${randomUUID()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, full);
  }

  async getSignedUrl(key: string, expiresSec: number): Promise<string> {
    assertSafeKey(key);
    const token = signToken(this.signingSecret, key, new Date(Date.now() + expiresSec * 1000));
    return `${this.publicBaseUrl}${RAW_FILE_PATH}/${token}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const s = await stat(this.pathOf(key));
      return { sizeBytes: s.size, contentType: null };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  openRead(key: string): Readable {
    return createReadStream(this.pathOf(key));
  }
}
