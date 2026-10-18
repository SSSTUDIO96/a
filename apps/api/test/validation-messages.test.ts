import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, makeApp, makeDeps, registerUser } from './helpers';

const deps = makeDeps();
const app = makeApp(deps);
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('lỗi kiểm dữ liệu', () => {
  it('trả đường dẫn đầy đủ của lỗi lồng (để giao diện đặt lỗi đúng ô) và lời tiếng Việt', async () => {
    const u = await registerUser(app, 'loi');
    const org = await request(app).post('/api/v1/orgs').set(bearer(u)).send({ name: 'Lỗi', slug: `loi-${Date.now()}`, kind: 'TEAM' }).expect(201);
    const res = await request(app)
      .post(`/api/v1/orgs/${org.body.id}/contracts/quote`)
      .set(bearer(u))
      .send({ newCustomer: { fullName: 'K' }, lines: [{ kind: 'CUSTOM', name: 'x', unitPrice: -5, quantity: 1 }] });
    expect(res.status).toBe(400);
    const paths = (res.body.error.details.issues as { path: string; message: string }[]).map((i) => i.path);
    expect(paths.some((p) => p.startsWith('lines.0.'))).toBe(true);
    const all = JSON.stringify(res.body.error.details.issues);
    expect(all).not.toMatch(/Too small|Invalid input|expected/);
  });

  it('đường dẫn tổ chức trùng tên trang web → 400; đã có người dùng → 409 nói rõ', async () => {
    const u = await registerUser(app, 'slug');
    const r1 = await request(app).post('/api/v1/orgs').set(bearer(u)).send({ name: 'X', slug: 'dang-nhap', kind: 'TEAM' });
    expect(r1.status).toBe(400);
    const slug = `trung-${Date.now()}`;
    await request(app).post('/api/v1/orgs').set(bearer(u)).send({ name: 'X', slug, kind: 'TEAM' }).expect(201);
    const r2 = await request(app).post('/api/v1/orgs').set(bearer(u)).send({ name: 'Y', slug, kind: 'TEAM' });
    expect(r2.status).toBe(409);
    expect(r2.body.error.message).toMatch(/Đường dẫn tổ chức đã có người dùng/);
  });
});
