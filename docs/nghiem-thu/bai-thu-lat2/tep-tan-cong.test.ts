// BÀI TẤN CÔNG CỦA THỢ CHẤM — LÁT 2, MODULE TỆP (lib/storage, modules/files).
// Quy ước: "LỖI:" xanh = lỗi có thật; "CHẶN:" xanh = đòn bị chặn; "GHI NHẬN:" xanh = hành vi có thật, chủ quyết.
// Đường raw /api/v1/files/raw/:token chưa gắn vào app.ts → gắn ngoài, đúng cách bài thử của thợ.
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getStorage, LocalDiskDriver, signToken } from '../src/lib/storage';
import { RAW_ROUTE, rawFileHandler } from '../src/modules/files/raw';
import { makePng } from '../test/png';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type TestUser } from '../test/helpers';

const deps = makeDeps();
const outer = express();
outer.get(RAW_ROUTE, rawFileHandler(deps));
outer.use(makeApp(deps));

let owner: TestUser;
let orgId: string;
const seen: string[] = []; // mọi thân + header phản hồi, để dò đường dẫn đĩa

function remember(res: request.Response) {
  seen.push(JSON.stringify(res.headers) + (res.text ?? '') + JSON.stringify(res.body ?? ''));
  return res;
}

async function upload(data: Buffer, query: Record<string, string>, key = randomUUID(), contentType = 'application/octet-stream') {
  return remember(
    await request(outer)
      .post(`/api/v1/orgs/${orgId}/files`)
      .query(query)
      .set(bearer(owner))
      .set('Idempotency-Key', key)
      .set('Content-Type', contentType)
      .send(data),
  );
}

function local(): LocalDiskDriver {
  const s = getStorage();
  if (!(s instanceof LocalDiskDriver)) throw new Error('cần driver đĩa');
  return s;
}

// PNG thật có IHDR hợp lệ, phía sau chèn nguyên một trang HTML có mã chạy.
function pngPolyglot(): Buffer {
  return Buffer.concat([makePng(1, 1), Buffer.from('<html><script>alert(document.cookie)</script></html>')]);
}

function pngOfSize(w: number, h: number): Buffer {
  // Chỉ cần chữ ký + IHDR: máy chủ đọc kích thước từ IHDR, không giải mã ảnh.
  const b = makePng(1, 1);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

beforeAll(async () => {
  const app = makeApp(deps);
  owner = await registerUser(app, 'cham2-tep');
  orgId = await createOrg(app, owner, 'cham2-tep');
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('T-1 giả dạng loại tệp', () => {
  it('CHẶN: HTML, SVG, GIF, EXE, ZIP đội lốt ảnh → 400 cả 5, không lưu', async () => {
    const fakes: [string, Buffer, string][] = [
      ['html.png', Buffer.from('<html><body>xin chao</body></html>'), 'image/png'],
      ['a.svg.png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'image/svg+xml'],
      ['a.gif', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'), 'image/gif'],
      ['a.jpg', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]), 'image/jpeg'],
      ['a.webp', Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), Buffer.alloc(100)]), 'image/webp'],
    ];
    const before = await deps.db.storedFile.count({ where: { organizationId: orgId } });
    let blocked = 0;
    for (const [name, data, ct] of fakes) {
      const r = await upload(data, { purpose: 'STAFF_AVATAR', name }, randomUUID(), ct);
      if (r.status === 400) blocked++;
    }
    console.log(`[T-1] tệp đội lốt bị chặn: ${blocked}/${fakes.length}`);
    expect(blocked).toBe(fakes.length);
    expect(await deps.db.storedFile.count({ where: { organizationId: orgId } })).toBe(before);
  });

  it('GHI NHẬN: PNG thật + HTML phía sau (polyglot) được nhận; khi phát ra có nosniff + CSP sandbox nên trình duyệt không chạy mã', async () => {
    const r = await upload(pngPolyglot(), { purpose: 'STAFF_AVATAR', name: 'p.png' });
    expect(r.status).toBe(201);
    const raw = remember(await request(outer).get(r.body.signedUrl));
    expect(raw.status).toBe(200);
    expect(raw.headers['content-type']).toBe('image/png');
    expect(raw.headers['x-content-type-options']).toBe('nosniff');
    expect(raw.headers['content-security-policy']).toContain('sandbox');
  });

  it('GHI NHẬN: ảnh khai 20000×20000 (400 triệu điểm ảnh, kiểu "bom giải nén" cho máy khách) vẫn được nhận; 20001 thì chặn', async () => {
    const big = await upload(pngOfSize(20_000, 20_000), { purpose: 'ALBUM_IMAGE', name: 'bom.png' });
    const over = await upload(pngOfSize(20_001, 1), { purpose: 'ALBUM_IMAGE', name: 'bom2.png' });
    console.log(`[T-1] 20000×20000 → ${big.status}; 20001×1 → ${over.status}`);
    expect(big.status).toBe(201);
    expect(over.status).toBe(400);
  });
});

describe('T-2 tệp quá cỡ gửi kiểu chunked (không khai Content-Length)', () => {
  // Gửi 30 MB cho mục đích logo (giới hạn 2 MB) từng mẩu 64 KB qua http thật.
  async function sendChunked(totalBytes: number, purpose: string): Promise<{ status: number | string; sentBytes: number }> {
    const server = outer.listen(0);
    try {
      const { port } = server.address() as { port: number };
      return await new Promise((resolve) => {
        let sent = 0;
        const req = http.request(
          {
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: `/api/v1/orgs/${orgId}/files?purpose=${purpose}&name=x.png`,
            headers: { ...bearer(owner), 'idempotency-key': randomUUID(), 'content-type': 'application/octet-stream', 'transfer-encoding': 'chunked' },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve({ status: res.statusCode ?? 0, sentBytes: sent }));
          },
        );
        req.on('error', (e) => resolve({ status: `lỗi mạng: ${(e as NodeJS.ErrnoException).code}`, sentBytes: sent }));
        const chunk = Buffer.alloc(64 * 1024, 1);
        const first = Buffer.concat([makePng(), chunk.subarray(makePng().length)]);
        const pump = () => {
          while (sent < totalBytes) {
            const c = sent === 0 ? first : chunk;
            sent += c.length;
            if (!req.write(c)) return req.once('drain', pump);
          }
          req.end();
        };
        pump();
      });
    } finally {
      server.close();
    }
  }

  it('CHẶN: 30 MB chunked cho logo → không lưu tệp nào; máy chủ cắt kết nối sau ≤ 3 MB hoặc trả 400', async () => {
    const before = await deps.db.storedFile.count({ where: { organizationId: orgId, purpose: 'ORG_LOGO' } });
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await sendChunked(30 * 1024 * 1024, 'ORG_LOGO'));
    console.log(`[T-2] 3 lần gửi 30 MB chunked: ${results.map((r) => `${r.status} (đã đẩy ${(r.sentBytes / 1048576).toFixed(1)} MB)`).join('; ')}`);
    expect(await deps.db.storedFile.count({ where: { organizationId: orgId, purpose: 'ORG_LOGO' } })).toBe(before);
    for (const r of results) expect(r.status === 400 || String(r.status).startsWith('lỗi mạng')).toBe(true);
  });
});

describe('T-3 vé URL', () => {
  let signedUrl: string;
  let storageKey: string;
  let fileId: string;
  beforeAll(async () => {
    const r = await upload(makePng(4, 4), { purpose: 'STAFF_AVATAR', name: 've.png' });
    signedUrl = r.body.signedUrl;
    fileId = r.body.id;
    storageKey = (await deps.db.storedFile.findUniqueOrThrow({ where: { id: fileId } })).storageKey;
  });

  it('CHẶN: sửa TỪNG ký tự của vé (mọi vị trí, cả phần nội dung lẫn chữ ký) → không lần nào đọc được tệp', async () => {
    const token = signedUrl.split('/').pop() as string;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let opened = 0;
    let total = 0;
    const statuses = new Map<number, number>();
    for (let i = 0; i < token.length; i++) {
      if (token[i] === '.') continue;
      const ch = token[i] as string;
      // hai phép sửa mỗi vị trí: ký tự kề bên (đổi bit thấp) và ký tự xa
      for (const repl of [alphabet[(alphabet.indexOf(ch) ^ 1) & 63], alphabet[(alphabet.indexOf(ch) + 32) % 64]]) {
        const t = `${token.slice(0, i)}${repl}${token.slice(i + 1)}`;
        const r = await request(outer).get(`/api/v1/files/raw/${t}`);
        total++;
        statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
        if (r.status === 200) opened++;
      }
    }
    console.log(`[T-3] vé bị sửa mở được tệp: ${opened}/${total}; mã trả về: ${JSON.stringify(Object.fromEntries(statuses))}`);
    expect(opened).toBe(0);
  });

  it('CHẶN: vé hết hạn 1 giây → 403 "hết hạn"; vé ký bằng khoá khác → 403; vé cho khoá bịa ký đúng → 404 không lộ gì', async () => {
    const expired = await request(outer).get(`/api/v1/files/raw/${signToken(local().signingSecret, storageKey, new Date(Date.now() - 1000))}`);
    const forged = await request(outer).get(`/api/v1/files/raw/${signToken('k'.repeat(40), storageKey, new Date(Date.now() + 60_000))}`);
    const ghost = await request(outer).get(`/api/v1/files/raw/${signToken(local().signingSecret, `org/${orgId}/staff-avatar/${randomUUID()}.png`, new Date(Date.now() + 60_000))}`);
    console.log(`[T-3] hết hạn → ${expired.status}; khoá khác → ${forged.status}; khoá bịa → ${ghost.status}`);
    expect(expired.status).toBe(403);
    expect(expired.body.error.message).toContain('hết hạn');
    expect(forged.status).toBe(403);
    expect(ghost.status).toBe(404);
  });

  it('CHẶN: tệp đã xoá → vé cũ 404, GET 404', async () => {
    const r = await upload(makePng(7, 7), { purpose: 'STAFF_AVATAR', name: 'xoa.png' });
    await request(outer).delete(`/api/v1/orgs/${orgId}/files/${r.body.id}`).set(bearer(owner)).expect(204);
    const raw = await request(outer).get(r.body.signedUrl);
    const info = await request(outer).get(`/api/v1/orgs/${orgId}/files/${r.body.id}`).set(bearer(owner));
    expect([raw.status, info.status]).toEqual([404, 404]);
  });

  it('GHI NHẬN: nội dung vé chỉ là base64 — giải ra đọc được mã tổ chức và mục đích tệp (không lộ đường dẫn đĩa)', () => {
    const token = signedUrl.split('/').pop() as string;
    const decoded = Buffer.from(token.split('.')[0] as string, 'base64url').toString('utf8');
    console.log(`[T-3] nội dung vé giải mã: ${decoded.replace(/\|\d+$/, '|<hạn>')}`);
    expect(decoded).toContain(orgId);
    expect(decoded).not.toContain(os.tmpdir());
  });
});

describe('T-4 chống gửi trùng với thân nhị phân', () => {
  it('LỖI: cùng Idempotency-Key, KHÁC tệp → máy chủ trả 201 kèm tệp LẦN ĐẦU, tệp thứ hai không được lưu (báo thành công giả)', async () => {
    let fake = 0;
    const N = 5;
    for (let i = 0; i < N; i++) {
      const key = randomUUID();
      const a = makePng(10 + i, 10);
      const b = makePng(20 + i, 20);
      const r1 = await upload(a, { purpose: 'STAFF_AVATAR', name: 'mot.png' }, key);
      const r2 = await upload(b, { purpose: 'STAFF_AVATAR', name: 'hai.png' }, key);
      const shaB = createHash('sha256').update(b).digest('hex');
      const storedB = await deps.db.storedFile.count({ where: { organizationId: orgId, sha256: shaB } });
      if (r1.status === 201 && r2.status === 201 && r2.body.id === r1.body.id && storedB === 0) fake++;
    }
    console.log(`[T-4] khác tệp cùng khoá → 201 giả, tệp sau không lưu: ${fake}/${N}`);
    expect(fake).toBe(N);
  });

  it('LỖI: cùng khoá, khác MỤC ĐÍCH (?purpose) → nhận lại bản ghi ORG_LOGO khi đang tải STAFF_AVATAR', async () => {
    const key = randomUUID();
    const r1 = await upload(makePng(3, 3), { purpose: 'ORG_LOGO', name: 'logo.png' }, key);
    const r2 = await upload(makePng(8, 8), { purpose: 'STAFF_AVATAR', name: 'avatar.png' }, key);
    console.log(`[T-4] lần 2 xin STAFF_AVATAR → ${r2.status}, purpose trả về = ${r2.body.purpose}`);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.body.purpose).toBe('ORG_LOGO');
  });
});

describe('T-5 đường dẫn đĩa', () => {
  it('CHẶN: không phản hồi nào (tải lên, xem, lỗi, raw) chứa đường dẫn thư mục lưu trên đĩa', async () => {
    // thêm vài phản hồi lỗi
    remember(await request(outer).get(`/api/v1/files/raw/khong-phai-ve`));
    remember(await request(outer).get(`/api/v1/files/raw/${'a'.repeat(300)}.${'b'.repeat(43)}`));
    const r = await upload(makePng(2, 2), { purpose: 'STAFF_AVATAR', name: '../../etc/passwd' });
    remember(await request(outer).get(`/api/v1/orgs/${orgId}/files/${r.body.id}`).set(bearer(owner)));
    const root = os.tmpdir();
    const leaks = seen.filter((s) => s.includes(root) || s.includes('makeup-files-'));
    console.log(`[T-5] phản hồi có đường dẫn đĩa: ${leaks.length}/${seen.length}; tên tệp "../../etc/passwd" lưu thành "${r.body.originalName}"`);
    expect(leaks.length).toBe(0);
    expect(r.body.originalName).not.toContain('/');
  });
});

describe('T-6 tổ chức bị khoá', () => {
  it('GHI NHẬN: tổ chức bị khoá vẫn phát tệp qua vé đã cấp (tới 10 phút) — đường raw không kiểm trạng thái tổ chức', async () => {
    const app = makeApp(deps);
    const o2 = await registerUser(app, 'cham2-tep-khoa');
    const org2 = await createOrg(app, o2, 'cham2-tep-khoa');
    const r = await request(outer)
      .post(`/api/v1/orgs/${org2}/files`)
      .query({ purpose: 'STAFF_AVATAR', name: 'k.png' })
      .set(bearer(o2))
      .set('Idempotency-Key', randomUUID())
      .set('Content-Type', 'application/octet-stream')
      .send(makePng(2, 2));
    await deps.db.organization.update({ where: { id: org2 }, data: { status: 'SUSPENDED' } });
    const raw = await request(outer).get(r.body.signedUrl);
    const api = await request(outer).get(`/api/v1/orgs/${org2}/files/${r.body.id}`).set(bearer(o2));
    console.log(`[T-6] khoá tổ chức: raw → ${raw.status}, API xem tệp → ${api.status}`);
    expect(raw.status).toBe(200);
    expect(api.status).toBe(403);
  });
});

describe('T-7 đường raw chưa gắn vào app thật', () => {
  it('LỖI (đã biết): URL ký trả ra từ app thật trỏ vào đường không tồn tại → 404 "Không có đường API này"', async () => {
    const app = makeApp(deps);
    const r = await upload(makePng(2, 2), { purpose: 'STAFF_AVATAR', name: 'z.png' });
    const res = await request(app).get(r.body.signedUrl);
    console.log(`[T-7] app thật mở URL ký → ${res.status} ${res.body?.error?.message}`);
    expect(res.status).toBe(404);
  });
});
