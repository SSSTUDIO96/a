// Tổ chức mới: có sẵn 6 câu chúc mặc định (thợ S4 — mẫu thiết kế); đường tải tệp nhận 2 mục đích của module thiết kế thẻ.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DEFAULT_GREETING_PHRASES } from '@makeup/shared';
import { makePng } from './png';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;
let owner: TestUser;
let orgId: string;

beforeAll(async () => {
  app = makeApp(deps);
  owner = await registerUser(app, 'tc-moi');
  orgId = await createOrg(app, owner, 'tc-moi');
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('tổ chức mới', () => {
  it('có đúng 6 câu chúc mặc định (GET /greeting-phrases), khớp bộ mẫu dùng chung', async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgId}/greeting-phrases`).set(bearer(owner)).expect(200);
    const names = (res.body as { name: string }[]).map((p) => p.name);
    console.log(`[tổ chức mới] câu chúc mặc định: ${names.length}`);
    expect(names).toHaveLength(6);
    expect(names).toEqual(DEFAULT_GREETING_PHRASES.map((p) => p.name));
    expect(await deps.db.greetingPhrase.count({ where: { organizationId: orgId } })).toBe(6);
  });

  it('tải ảnh thật cho mục đích DESIGN_PHOTO và DESIGN_CARD → 201, đọc lại qua URL ký đúng từng byte', async () => {
    for (const purpose of ['DESIGN_PHOTO', 'DESIGN_CARD']) {
      const png = makePng(6, 4);
      const res = await request(app)
        .post(`/api/v1/orgs/${orgId}/files`)
        .query({ purpose, name: `${purpose.toLowerCase()}.png` })
        .set(bearer(owner))
        .set('Idempotency-Key', randomUUID())
        .set('Content-Type', 'application/octet-stream')
        .send(png);
      console.log(`[tải tệp] ${purpose} → ${res.status}`);
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.purpose).toBe(purpose);
      const raw = await request(app).get(res.body.signedUrl).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(raw.status).toBe(200);
      expect(Buffer.compare(raw.body as Buffer, png)).toBe(0);
    }
  });
});
