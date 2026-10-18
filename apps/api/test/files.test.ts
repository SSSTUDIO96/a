import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createStorageFromEnv, getStorage, LocalDiskDriver, S3Driver, signToken, verifyToken } from '../src/lib/storage';
import { loadEnv } from '../src/env';
import { detectType, imageSize } from '../src/modules/files/detect';
import { RAW_ROUTE, rawFileHandler } from '../src/modules/files/raw';
import { makePng } from './png';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
// App thật + đường phục vụ tệp gắn bên ngoài (app.ts chưa gắn — xem phiếu vướng).
const outer = express();
outer.get(RAW_ROUTE, rawFileHandler(deps));
outer.use(makeApp(deps));

let ownerA: TestUser;
let artistA: TestUser;
let ownerB: TestUser;
let orgA: string;
let orgB: string;


function jpegHeader(width: number, height: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

function webp(chunk: 'VP8X' | 'VP8L' | 'VP8 ', width: number, height: number): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'latin1');
  b.writeUInt32LE(22, 4);
  b.write('WEBP', 8, 'latin1');
  b.write(chunk, 12, 'latin1');
  b.writeUInt32LE(10, 16);
  if (chunk === 'VP8X') {
    b.writeUIntLE(width - 1, 24, 3);
    b.writeUIntLE(height - 1, 27, 3);
  } else if (chunk === 'VP8L') {
    const w = width - 1;
    const h = height - 1;
    b[20] = 0x2f;
    b[21] = w & 0xff;
    b[22] = ((w >> 8) & 0x3f) | ((h & 0x3) << 6);
    b[23] = (h >> 2) & 0xff;
    b[24] = (h >> 10) & 0x0f;
  } else {
    b.set([0x9d, 0x01, 0x2a], 23);
    b.writeUInt16LE(width, 26);
    b.writeUInt16LE(height, 28);
  }
  return b;
}

function upload(orgId: string, user: TestUser, data: Buffer | string, query: Record<string, string>, opts: { key?: string; contentType?: string; sha?: string } = {}) {
  const req = request(outer)
    .post(`/api/v1/orgs/${orgId}/files`)
    .query(query)
    .set(bearer(user))
    .set('Idempotency-Key', opts.key ?? randomUUID())
    .set('Content-Type', opts.contentType ?? 'application/octet-stream');
  if (opts.sha) req.set('X-Content-SHA256', opts.sha);
  return req.send(data);
}

const avatarQuery = { purpose: 'STAFF_AVATAR', name: 'anh-dai-dien.png' };

function local(): LocalDiskDriver {
  const s = getStorage();
  if (!(s instanceof LocalDiskDriver)) throw new Error('Bài thử cần driver đĩa cục bộ');
  return s;
}

beforeAll(async () => {
  const app = makeApp(deps);
  ownerA = await registerUser(app, 'chu-tep-a');
  artistA = await registerUser(app, 'tho-tep-a');
  ownerB = await registerUser(app, 'chu-tep-b');
  orgA = await createOrg(app, ownerA, 'tep-a');
  orgB = await createOrg(app, ownerB, 'tep-b');
  await addMember(app, ownerA, orgA, artistA, ['artist']);
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('nhận diện loại tệp bằng chữ ký đầu tệp', () => {
  it('PNG, JPEG, WebP (VP8X, VP8L, VP8), PDF và kích thước ảnh', () => {
    expect(detectType(makePng(7, 5))).toBe('image/png');
    expect(imageSize(makePng(7, 5), 'image/png')).toEqual({ width: 7, height: 5 });
    expect(detectType(jpegHeader(64, 32))).toBe('image/jpeg');
    expect(imageSize(jpegHeader(64, 32), 'image/jpeg')).toEqual({ width: 64, height: 32 });
    for (const kind of ['VP8X', 'VP8L', 'VP8 '] as const) {
      expect(detectType(webp(kind, 100, 50))).toBe('image/webp');
      expect(imageSize(webp(kind, 100, 50), 'image/webp')).toEqual({ width: 100, height: 50 });
    }
    expect(detectType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
  });

  it('chữ thường, HTML giả ảnh, tệp cụt → không nhận', () => {
    expect(detectType(Buffer.from('xin chào, tôi là tệp chữ'))).toBeNull();
    expect(detectType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(imageSize(makePng().subarray(0, 20), 'image/png')).toBeNull();
    expect(imageSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'image/jpeg')).toBeNull();
  });
});

describe('URL ký có hạn (driver đĩa) và cấu hình kho tệp', () => {
  const secret = 'bi-mat-ky-url-chi-dung-cho-bai-thu-0123456789';
  it('vé đúng → đọc được khoá; hết hạn, sửa chữ ký, sửa nội dung, sai định dạng → từ chối', () => {
    const token = signToken(secret, 'org/x/staff-avatar/a.png', new Date(Date.now() + 60_000));
    expect(verifyToken(secret, token)).toMatchObject({ ok: true, key: 'org/x/staff-avatar/a.png' });
    expect(verifyToken(secret, signToken(secret, 'k.png', new Date(Date.now() - 1000)))).toEqual({ ok: false, reason: 'EXPIRED' });
    const [payload, sig] = token.split('.') as [string, string];
    const flipped = `${payload}.${sig.slice(0, -2)}${sig.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(verifyToken(secret, flipped)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    const otherPayload = Buffer.from(`org/y/staff-avatar/b.png|${Math.floor(Date.now() / 1000) + 60}`).toString('base64url');
    expect(verifyToken(secret, `${otherPayload}.${sig}`)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    expect(verifyToken('khoa-khac-hoan-toan-0123456789-abcdefghij', token)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    expect(verifyToken(secret, 'khong-co-dau-cham')).toEqual({ ok: false, reason: 'MALFORMED' });
  });

  it('production thiếu cấu hình → đọc env ném lỗi (máy chủ không khởi động), không tự chọn mặc định; development có mặc định đĩa tạm', () => {
    // Biến kho tệp kiểm ở EnvSchema (env.ts) — xem thêm test/cau-hinh-kho-tep.test.ts.
    const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/x', JWT_ACCESS_SECRET: 'x'.repeat(40) };
    const storage = (env: Record<string, string>) => createStorageFromEnv(loadEnv({ ...base, ...env }));
    expect(() => storage({ NODE_ENV: 'production' })).toThrow(/STORAGE_DRIVER/);
    expect(() => storage({ NODE_ENV: 'production', STORAGE_DRIVER: 'local' })).toThrow(/STORAGE_LOCAL_DIR/);
    expect(() => storage({ NODE_ENV: 'production', STORAGE_DRIVER: 's3', S3_ENDPOINT: 'https://s3.example.com' })).toThrow(/S3_REGION/);
    expect(storage({ NODE_ENV: 'development' })).toBeInstanceOf(LocalDiskDriver);
    expect(storage({ NODE_ENV: 'development', STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: '', STORAGE_SIGNING_SECRET: '' })).toBeInstanceOf(LocalDiskDriver);
    expect(() => storage({ NODE_ENV: 'production', STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: '' })).toThrow(/STORAGE_LOCAL_DIR/);
  });

  it('driver S3: URL ký SigV4 khớp ví dụ mẫu trong tài liệu AWS (chưa thử với dịch vụ thật)', () => {
    const s3 = new S3Driver({
      endpoint: 'https://s3.amazonaws.com',
      region: 'us-east-1',
      bucket: 'examplebucket',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      forcePathStyle: false,
    });
    expect(s3.presign('GET', 'test.txt', 86400, new Date('2013-05-24T00:00:00Z'))).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
    const supabase = new S3Driver({
      endpoint: 'https://abc.supabase.co/storage/v1/s3',
      region: 'ap-southeast-1',
      bucket: 'makeup',
      accessKeyId: 'k',
      secretAccessKey: 's',
      forcePathStyle: true,
    });
    expect(supabase.presign('GET', 'org/x/a.png', 600)).toMatch(/^https:\/\/abc\.supabase\.co\/storage\/v1\/s3\/makeup\/org\/x\/a\.png\?X-Amz-Algorithm=/);
  });
});

describe('tải tệp lên', () => {
  it('ảnh PNG thật → 201, sha256 + kích thước đúng, URL ký đọc lại đúng từng byte', async () => {
    const png = makePng(2, 3);
    const res = await upload(orgA, ownerA, png, avatarQuery, { contentType: 'text/plain' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      purpose: 'STAFF_AVATAR',
      status: 'READY',
      mimeType: 'image/png',
      width: 2,
      height: 3,
      sizeBytes: png.length,
      sha256: createHash('sha256').update(png).digest('hex'),
      originalName: 'anh-dai-dien.png',
    });
    expect(res.body.signedUrl).toMatch(/^\/api\/v1\/files\/raw\//);
    expect(JSON.stringify(res.body)).not.toContain(local().signingSecret);
    const raw = await request(outer).get(res.body.signedUrl).buffer(true).parse((r, cb) => {
      const parts: Buffer[] = [];
      r.on('data', (c: Buffer) => parts.push(c));
      r.on('end', () => cb(null, Buffer.concat(parts)));
    });
    expect(raw.status).toBe(200);
    expect(raw.headers['content-type']).toBe('image/png');
    expect(raw.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(raw.body as Buffer, png)).toBe(0);
    const audit = await deps.db.auditLog.count({ where: { organizationId: orgA, entityId: res.body.id, action: 'file.uploaded' } });
    expect(audit).toBe(1);
  });

  it('BẮT: đuôi .png nhưng nội dung là chữ → 400, không lưu', async () => {
    const before = await deps.db.storedFile.count({ where: { organizationId: orgA } });
    const res = await upload(orgA, ownerA, Buffer.from('đây là tệp chữ đổi đuôi thành .png'), avatarQuery, { contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(await deps.db.storedFile.count({ where: { organizationId: orgA } })).toBe(before);
  });

  it('BẮT: PDF làm ảnh đại diện → 400; GIỮ: PDF làm tài liệu khoá học → 201', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    expect((await upload(orgA, ownerA, pdf, { purpose: 'STAFF_AVATAR', name: 'a.pdf' })).status).toBe(400);
    const ok = await upload(orgA, ownerA, pdf, { purpose: 'COURSE_RESOURCE', name: 'giao-trinh.pdf' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ mimeType: 'application/pdf', width: null, height: null });
  });

  it('BẮT: quá dung lượng theo mục đích (logo ≤ 2 MB) → 400, không lưu', async () => {
    const big = Buffer.concat([makePng(), Buffer.alloc(2 * 1024 * 1024)]);
    const res = await upload(orgA, ownerA, big, { purpose: 'ORG_LOGO', name: 'logo.png' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.maxBytes).toBe(2 * 1024 * 1024);
    expect(await deps.db.storedFile.count({ where: { organizationId: orgA, purpose: 'ORG_LOGO' } })).toBe(0);
  });

  it('BẮT: gửi kiểu chunked không khai dung lượng mà vượt giới hạn → 400, không lưu', async () => {
    const server = outer.listen(0);
    try {
      const { port } = server.address() as { port: number };
      const parts = [makePng(), Buffer.alloc(1024 * 1024), Buffer.alloc(1024 * 1024 + 10)];
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          const next = parts.shift();
          if (next) controller.enqueue(new Uint8Array(next));
          else controller.close();
        },
      });
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/orgs/${orgA}/files?purpose=ORG_LOGO&name=logo.png`, {
        method: 'POST',
        headers: { ...bearer(ownerA), 'idempotency-key': randomUUID(), 'content-type': 'application/octet-stream' },
        body,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });
      expect(res.status).toBe(400);
      expect(await deps.db.storedFile.count({ where: { organizationId: orgA, purpose: 'ORG_LOGO' } })).toBe(0);
    } finally {
      server.close();
    }
  });

  it('BẮT: ảnh hỏng (cụt sau chữ ký), thân JSON, tệp rỗng, mã băm khai báo sai → 400', async () => {
    expect((await upload(orgA, ownerA, makePng().subarray(0, 12), avatarQuery)).status).toBe(400);
    const json = await request(outer)
      .post(`/api/v1/orgs/${orgA}/files`)
      .query(avatarQuery)
      .set(bearer(ownerA))
      .set('Idempotency-Key', randomUUID())
      .send({ data: 'abc' });
    expect(json.status).toBe(400);
    expect((await upload(orgA, ownerA, Buffer.alloc(0), avatarQuery)).status).toBe(400);
    expect((await upload(orgA, ownerA, makePng(), avatarQuery, { sha: 'a'.repeat(64) })).status).toBe(400);
    const png = makePng(4, 4);
    expect((await upload(orgA, ownerA, png, avatarQuery, { sha: createHash('sha256').update(png).digest('hex') })).status).toBe(201);
  });

  it('chống gửi trùng: cùng Idempotency-Key + cùng tệp → cùng kết quả, 1 tệp; thiếu khoá → 400', async () => {
    const png = makePng(9, 9);
    const sha = createHash('sha256').update(png).digest('hex');
    const key = randomUUID();
    const first = await upload(orgA, ownerA, png, avatarQuery, { key });
    const again = await upload(orgA, ownerA, png, avatarQuery, { key });
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(first.body.id);
    expect(await deps.db.storedFile.count({ where: { organizationId: orgA, sha256: sha } })).toBe(1);
    const noKey = await request(outer)
      .post(`/api/v1/orgs/${orgA}/files`)
      .query(avatarQuery)
      .set(bearer(ownerA))
      .set('Content-Type', 'application/octet-stream')
      .send(png);
    expect(noKey.status).toBe(400);
  });

  it('thợ (files.read) không tải lên được → 403, nhưng xem được tệp', async () => {
    expect((await upload(orgA, artistA, makePng(), avatarQuery)).status).toBe(403);
    const f = await upload(orgA, ownerA, makePng(), avatarQuery);
    expect((await request(outer).get(`/api/v1/orgs/${orgA}/files/${f.body.id}`).set(bearer(artistA))).status).toBe(200);
  });
});

describe('đọc tệp qua URL ký', () => {
  let fileId: string;
  let signedUrl: string;
  let storageKey: string;
  beforeAll(async () => {
    const res = await upload(orgA, ownerA, makePng(5, 5), avatarQuery);
    fileId = res.body.id;
    signedUrl = res.body.signedUrl;
    storageKey = (await deps.db.storedFile.findUniqueOrThrow({ where: { id: fileId } })).storageKey;
  });

  it('GET thông tin tệp → URL ký mới hạn 10 phút', async () => {
    const res = await request(outer).get(`/api/v1/orgs/${orgA}/files/${fileId}`).set(bearer(ownerA)).expect(200);
    const exp = new Date(res.body.signedUrlExpiresAt).getTime() - Date.now();
    expect(exp).toBeGreaterThan(9 * 60_000);
    expect(exp).toBeLessThanOrEqual(10 * 60_000);
    expect((await request(outer).get(res.body.signedUrl)).status).toBe(200);
  });

  it('BẮT: URL hết hạn → 403', async () => {
    const expired = signToken(local().signingSecret, storageKey, new Date(Date.now() - 1000));
    const res = await request(outer).get(`/api/v1/files/raw/${expired}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('hết hạn');
  });

  it('BẮT: URL bị sửa chữ ký hoặc tự ký bằng khoá khác → 403', async () => {
    // Sửa một ký tự ở giữa chữ ký, và đổi ký tự cuối (chỉ khác bit thừa) — cả hai phải bị từ chối.
    const mid = signedUrl.length - 10;
    const tampered = `${signedUrl.slice(0, mid)}${signedUrl[mid] === 'A' ? 'B' : 'A'}${signedUrl.slice(mid + 1)}`;
    expect((await request(outer).get(tampered)).status).toBe(403);
    const last = signedUrl.slice(-1);
    const lastBit = `${signedUrl.slice(0, -1)}${last === 'A' ? 'B' : last === 'B' ? 'A' : last === 'Q' ? 'R' : 'Q'}`;
    expect((await request(outer).get(lastBit)).status).toBe(403);
    const forged = signToken('khoa-tu-che-cua-ke-xau-0123456789-abcdef', storageKey, new Date(Date.now() + 60_000));
    expect((await request(outer).get(`/api/v1/files/raw/${forged}`)).status).toBe(403);
  });

  it('xoá mềm: DELETE → 204; xem lại → 404; URL cũ → 404; xoá lần nữa → 404', async () => {
    const f = await upload(orgA, ownerA, makePng(6, 6), avatarQuery);
    await request(outer).delete(`/api/v1/orgs/${orgA}/files/${f.body.id}`).set(bearer(ownerA)).expect(204);
    expect((await request(outer).get(`/api/v1/orgs/${orgA}/files/${f.body.id}`).set(bearer(ownerA))).status).toBe(404);
    expect((await request(outer).get(f.body.signedUrl)).status).toBe(404);
    expect((await request(outer).delete(`/api/v1/orgs/${orgA}/files/${f.body.id}`).set(bearer(ownerA))).status).toBe(404);
    const row = await deps.db.storedFile.findUniqueOrThrow({ where: { id: f.body.id } });
    expect(row.status).toBe('DELETED');
    expect(row.deletedAt).not.toBeNull();
  });
});

describe('cách ly tổ chức', () => {
  it('B không xem/xoá được tệp của A; phản hồi giống hệt mã bịa', async () => {
    const f = await upload(orgA, ownerA, makePng(3, 3), avatarQuery);
    expect((await request(outer).get(`/api/v1/orgs/${orgA}/files/${f.body.id}`).set(bearer(ownerB))).status).toBe(404);
    const real = await request(outer).get(`/api/v1/orgs/${orgB}/files/${f.body.id}`).set(bearer(ownerB));
    const fake = await request(outer).get(`/api/v1/orgs/${orgB}/files/${randomUUID()}`).set(bearer(ownerB));
    expect(real.status).toBe(404);
    expect(real.body.error.message).toBe(fake.body.error.message);
    expect((await request(outer).delete(`/api/v1/orgs/${orgB}/files/${f.body.id}`).set(bearer(ownerB))).status).toBe(404);
    expect((await deps.db.storedFile.findUniqueOrThrow({ where: { id: f.body.id } })).status).toBe('READY');
  });
});
