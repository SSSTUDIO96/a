import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, makeApp, makeDeps, registerUser, type App } from './helpers';

const deps = makeDeps();
let app: App;

beforeAll(() => {
  app = makeApp(deps);
});
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('đăng ký và đăng nhập', () => {
  it('email trùng khác chữ hoa/thường bị từ chối', async () => {
    const u = await registerUser(app, 'trung');
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: u.email.toUpperCase(), password: 'mat-khau-khac-123', fullName: 'X' });
    expect(res.status).toBe(409);
  });

  it('mật khẩu ngắn bị từ chối với lỗi rõ ràng', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'ngan@thu.local', password: '123', fullName: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('sai mật khẩu và email không tồn tại trả cùng một lời', async () => {
    const u = await registerUser(app, 'sai');
    const a = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'sai-mat-khau-1' });
    const b = await request(app).post('/api/v1/auth/login').send({ email: 'khong-co@thu.local', password: 'sai-mat-khau-1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('đăng nhập đúng rồi xem /me', async () => {
    const u = await registerUser(app, 'dung');
    const login = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
    const me = await request(app).get('/api/v1/auth/me').set('authorization', `Bearer ${login.body.accessToken}`).expect(200);
    expect(me.body.email).toBe(u.email);
    expect(me.body.organizations).toEqual([]);
    expect(JSON.stringify(me.body)).not.toContain('password');
  });
});

describe('refresh token', () => {
  it('đổi thẻ: thẻ cũ hết dùng được, thẻ mới dùng được', async () => {
    const u = await registerUser(app, 'xoay');
    const r1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
    expect(r1.body.refreshToken).not.toBe(u.refreshToken);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(200);
  });

  it('dùng lại thẻ cũ = bị đánh cắp → thu hồi cả họ thẻ, kể cả thẻ mới nhất', async () => {
    const u = await registerUser(app, 'trom');
    const r1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
    const log = await deps.db.auditLog.findFirst({ where: { actorUserId: u.id, action: 'auth.refresh_reuse_detected' } });
    expect(log).not.toBeNull();
  });

  it('hai yêu cầu đổi cùng một thẻ đồng thời: đúng một cái thành công', async () => {
    const u = await registerUser(app, 'dong-thoi');
    const [a, b] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  it('đăng xuất thu hồi phiên', async () => {
    const u = await registerUser(app, 'thoat');
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
  });

  it('tài khoản bị khoá thì thẻ đang cầm cũng hết tác dụng ngay', async () => {
    const u = await registerUser(app, 'khoa');
    await deps.db.user.update({ where: { id: u.id }, data: { status: 'DISABLED' } });
    await request(app).get('/api/v1/auth/me').set(bearer(u)).expect(401);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
  });
});

describe('giới hạn tốc độ', () => {
  it('quá số lần đăng nhập trong một phút → 429', async () => {
    const limited = makeApp(makeDeps({ AUTH_RATE_LIMIT_PER_MINUTE: '3' }));
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(limited).post('/api/v1/auth/login').send({ email: 'x@thu.local', password: 'sai' });
      codes.push(res.status);
    }
    expect(codes).toEqual([401, 401, 401, 429, 429]);
  });
});
