// Trang web: refresh token chỉ nằm trong cookie httpOnly, JavaScript trên trang không thấy.
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp, makeDeps } from './helpers';

const deps = makeDeps();
const app = makeApp(deps);
afterAll(async () => {
  await deps.db.$disconnect();
});

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const c = raw?.find((x) => x.startsWith('mp_refresh='));
  if (!c) throw new Error('Không có cookie mp_refresh');
  return c;
}

describe('refresh token qua cookie cho web', () => {
  it('đăng ký từ web: thân trả về KHÔNG có refreshToken; cookie httpOnly, SameSite=Strict, chỉ cho đường /api/v1/auth', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-client', 'web')
      .send({ email: `web-${Date.now()}@thu.local`, password: 'mat-khau-web-123', fullName: 'Web' })
      .expect(201);
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.accessToken).toBeTypeOf('string');
    const c = cookieOf(res);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=Strict/i);
    expect(c).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('đổi thẻ bằng cookie cần header X-Client: web; thiếu header thì cookie bị bỏ qua (chống trang lạ giả yêu cầu)', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('x-client', 'web')
      .send({ email: `web2-${Date.now()}@thu.local`, password: 'mat-khau-web-123', fullName: 'Web' });
    const cookie = cookieOf(reg).split(';')[0]!;
    await request(app).post('/api/v1/auth/refresh').set('cookie', cookie).send({}).expect(401);
    const ok = await request(app).post('/api/v1/auth/refresh').set('cookie', cookie).set('x-client', 'web').send({}).expect(200);
    expect(ok.body.refreshToken).toBeUndefined();
    const next = cookieOf(ok).split(';')[0]!;
    expect(next).not.toBe(cookie);
    const out = await request(app).post('/api/v1/auth/logout').set('cookie', next).set('x-client', 'web').send({}).expect(204);
    expect(String(out.headers['set-cookie'])).toMatch(/mp_refresh=;/);
    await request(app).post('/api/v1/auth/refresh').set('cookie', next).set('x-client', 'web').send({}).expect(401);
  });

  it('GIỮ: app điện thoại (không có X-Client: web) vẫn nhận refreshToken trong thân như cũ', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `app-${Date.now()}@thu.local`, password: 'mat-khau-app-123', fullName: 'App' })
      .expect(201);
    expect(res.body.refreshToken).toBeTypeOf('string');
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
