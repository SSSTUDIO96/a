import { createHash, createHmac } from 'node:crypto';
import type { Readable } from 'node:stream';
import { assertSafeKey, type StorageDriver, type StoredObjectInfo } from './types';

// Driver S3-compatible (AWS S3, Supabase Storage giao thức S3, Cloudflare R2, MinIO), ký AWS Signature V4
// bằng node:crypto — không cần SDK. Mọi thao tác dùng URL ký sẵn (query auth, UNSIGNED-PAYLOAD).
// CHƯA THỬ VỚI DỊCH VỤ THẬT: chỉ mới đối chiếu chữ ký với ví dụ mẫu trong tài liệu AWS (bài thử test/files.test.ts).
export interface S3Config {
  // Ví dụ: https://s3.ap-southeast-1.amazonaws.com hoặc https://<project>.supabase.co/storage/v1/s3
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  // true: <endpoint>/<bucket>/<key> (Supabase, MinIO); false: <bucket>.<host>/<key> (AWS kiểu mới).
  forcePathStyle: boolean;
}

const MAX_PRESIGN_SEC = 7 * 24 * 3600;

// Mã hoá URI theo luật S3: chỉ giữ A-Z a-z 0-9 - _ . ~ (và "/" trong đường dẫn).
function uriEncode(s: string, keepSlash: boolean): string {
  let out = '';
  for (const ch of Buffer.from(s, 'utf8')) {
    const c = String.fromCharCode(ch);
    if (/[A-Za-z0-9\-_.~]/.test(c) || (keepSlash && c === '/')) out += c;
    else out += `%${ch.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest();
const sha256Hex = (data: string) => createHash('sha256').update(data, 'utf8').digest('hex');

export class S3Driver implements StorageDriver {
  readonly kind = 's3' as const;

  constructor(private readonly cfg: S3Config) {}

  // URL ký sẵn (SigV4, query auth) cho một phương thức. `now` để đối chiếu với ví dụ mẫu.
  presign(method: 'GET' | 'PUT' | 'DELETE' | 'HEAD', key: string, expiresSec: number, now: Date = new Date()): string {
    assertSafeKey(key);
    if (!Number.isInteger(expiresSec) || expiresSec < 1 || expiresSec > MAX_PRESIGN_SEC) {
      throw new Error(`Hạn URL ký phải từ 1 giây đến 7 ngày, nhận: ${expiresSec}`);
    }
    const base = new URL(this.cfg.endpoint);
    const basePath = base.pathname.replace(/\/+$/, '');
    const host = this.cfg.forcePathStyle ? base.host : `${this.cfg.bucket}.${base.host}`;
    const objectPath = this.cfg.forcePathStyle ? `${basePath}/${this.cfg.bucket}/${key}` : `${basePath}/${key}`;
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const day = amzDate.slice(0, 8);
    const scope = `${day}/${this.cfg.region}/s3/aws4_request`;
    const params: [string, string][] = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${this.cfg.accessKeyId}/${scope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(expiresSec)],
      ['X-Amz-SignedHeaders', 'host'],
    ];
    const query = params
      .map(([k, v]) => [uriEncode(k, false), uriEncode(v, false)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const canonicalUri = uriEncode(objectPath, true);
    const canonicalRequest = [method, canonicalUri, query, `host:${host}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
    const kDate = hmac(`AWS4${this.cfg.secretAccessKey}`, day);
    const kSigning = hmac(hmac(hmac(kDate, this.cfg.region), 's3'), 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
    return `${base.protocol}//${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
  }

  async put(key: string, data: Buffer | Readable, contentType: string): Promise<void> {
    const body = Buffer.isBuffer(data) ? data : Buffer.concat(await data.toArray());
    const res = await fetch(this.presign('PUT', key, 300), { method: 'PUT', body: new Uint8Array(body), headers: { 'content-type': contentType } });
    if (!res.ok) throw new Error(`S3 PUT ${key} thất bại: ${res.status} ${await res.text()}`);
  }

  async getSignedUrl(key: string, expiresSec: number): Promise<string> {
    return this.presign('GET', key, expiresSec);
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this.presign('DELETE', key, 300), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE ${key} thất bại: ${res.status} ${await res.text()}`);
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    const res = await fetch(this.presign('HEAD', key, 300), { method: 'HEAD' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`S3 HEAD ${key} thất bại: ${res.status}`);
    const length = res.headers.get('content-length');
    if (length === null) throw new Error(`S3 HEAD ${key} không trả content-length`);
    return { sizeBytes: Number(length), contentType: res.headers.get('content-type') };
  }
}
