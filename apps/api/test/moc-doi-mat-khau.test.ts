// Mốc đổi mật khẩu (thợ K6, phiếu vướng 1 của K1): thẻ truy cập đang cầm phải chết ngay khi mật khẩu được đặt lại.
// BẮT = phải từ chối; GIỮ = không được làm hỏng điều đang đúng. Mỗi chốt đã thử đột biến (phá → đỏ → khôi phục) — báo cáo K6.
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { Deps } from '../src/http/route';
import { authenticate } from '../src/http/middleware';
import { hashRefreshToken, signAccessToken as signLegacyAccessToken } from '../src/lib/tokens';
import { signAccessToken, tokenSurvivesPasswordChange } from '../src/modules/auth/access-token';
import { applyPasswordChange, hashResetToken } from '../src/modules/auth/password-reset';
import { issueTokens } from '../src/modules/auth/service';
import { makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const app = makeApp(deps);
afterAll(async () => {
  await deps.db.$disconnect();
});

const CONFIRM = '/api/v1/auth/password-reset/confirm';
const NEW_PASSWORD = 'mat-khau-moi-456';
const SECRET = deps.env.JWT_ACCESS_SECRET;
const TTL = deps.env.ACCESS_TOKEN_TTL_SECONDS;

const meStatus = async (a: App, token: string) =>
  (await request(a).get('/api/v1/auth/me').set('authorization', `Bearer ${token}`)).status;

const iatOf = (token: string): number => (jwt.decode(token) as { iat: number }).iat;

const markOf = async (userId: string): Promise<Date | null> =>
  (await deps.db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordChangedAt: true } })).passwordChangedAt;

// Đặt lại mật khẩu qua đúng đường /confirm (thẻ đặt lại ghi thẳng vào database — không qua thư, không chờ mức sàn 300 ms).
async function resetPassword(u: TestUser, password = NEW_PASSWORD): Promise<void> {
  const token = `the-thu-${randomUUID()}-${randomUUID()}`;
  await deps.db.passwordResetToken.create({
    data: { userId: u.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  await request(app).post(CONFIRM).send({ token, password }).expect(204);
}

async function login(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  return { accessToken: res.body.accessToken as string, refreshToken: res.body.refreshToken as string };
}

describe('BẮT — thẻ cũ chết ngay sau khi đặt lại mật khẩu', () => {
  it('thẻ truy cập cấp trước lần đặt lại → 401 ở mọi đường cần đăng nhập (không chờ hết 15 phút)', async () => {
    const u = await registerUser(app, 'k6-cu');
    expect(await meStatus(app, u.accessToken)).toBe(200);
    await resetPassword(u);
    expect(await meStatus(app, u.accessToken)).toBe(401);
    const res = await request(app).get('/api/v1/auth/me').set('authorization', `Bearer ${u.accessToken}`);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    // Đường của tổ chức cũng đi qua authenticate.
    expect((await request(app).post('/api/v1/orgs').set('authorization', `Bearer ${u.accessToken}`).send({})).status).toBe(401);
  });

  it('thẻ cấp CÙNG GIÂY nhưng TRƯỚC lần đổi → 401 (so iat làm tròn xuống giây sẽ để lọt thẻ này)', async () => {
    const u = await registerUser(app, 'k6-cung-giay-truoc');
    // Đổi "sang chính bản băm cũ" để đăng nhập lại được ở vòng sau; mốc + thu hồi vẫn đi qua đúng hàm đổi mật khẩu.
    const { passwordHash } = await deps.db.user.findUniqueOrThrow({ where: { id: u.id }, select: { passwordHash: true } });
    // Lặp tới khi lần đổi rơi đúng vào giây của iat (thường ngay lần đầu).
    for (let i = 0; i < 20; i++) {
      const { accessToken } = await login(u.email, u.password);
      const changedAt = new Date();
      await deps.db.$transaction((tx) => applyPasswordChange(tx, u.id, passwordHash, changedAt));
      if (Math.floor(changedAt.getTime() / 1000) !== iatOf(accessToken)) continue;
      expect(changedAt.getTime()).toBeGreaterThan(iatOf(accessToken) * 1000); // thẻ cấp trước mốc, cùng giây
      expect(await meStatus(app, accessToken)).toBe(401);
      return;
    }
    throw new Error('Không tạo được trường hợp cùng giây sau 20 lần');
  });

  it('thẻ đời cũ (không mang mốc, cấp trước bản này) của người ĐÃ đổi mật khẩu sau đó → 401', async () => {
    const u = await registerUser(app, 'k6-the-doi-cu');
    const legacy = signLegacyAccessToken(u.id, SECRET, TTL);
    expect(await meStatus(app, legacy)).toBe(200); // chưa đổi lần nào: thẻ đời cũ vẫn dùng được
    await resetPassword(u);
    expect(await meStatus(app, legacy)).toBe(401);
  });

  it('cấp thẻ với mốc ĐÃ CŨ (đăng nhập bằng mật khẩu cũ đang chờ bcrypt khi lần đặt lại commit) → 401, không sinh refresh token', async () => {
    const u = await registerUser(app, 'k6-mau-cu');
    const stale = { id: u.id, passwordChangedAt: await markOf(u.id) };
    await resetPassword(u);
    const before = await deps.db.refreshToken.count({ where: { userId: u.id } });
    await expect(issueTokens(deps, stale)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await deps.db.refreshToken.count({ where: { userId: u.id } })).toBe(before);
  });

  it('cấp thẻ chen giữa transaction đặt lại (chưa commit) → chờ khoá, rồi 401; không còn phiên nào sống', async () => {
    const u = await registerUser(app, 'k6-xen');
    const stale = { id: u.id, passwordChangedAt: await markOf(u.id) };
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let changed!: () => void;
    const changedInTx = new Promise<void>((r) => (changed = r));
    const reset = deps.db.$transaction(
      async (tx) => {
        await applyPasswordChange(tx, u.id, 'bam-gia-khong-dang-nhap-duoc', new Date());
        changed();
        await gate;
      },
      { timeout: 20_000 },
    );
    await changedInTx;
    let settled = false;
    const issuing = issueTokens(deps, stale).then(
      (v) => ((settled = true), { ok: true as const, v }),
      (e: unknown) => ((settled = true), { ok: false as const, e }),
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(settled).toBe(false); // đang chờ khoá dòng users
    release();
    await reset;
    const out = await issuing;
    expect(out.ok).toBe(false);
    const live = await deps.db.refreshToken.count({ where: { userId: u.id, revokedAt: null } });
    expect(live).toBe(0);
  });

  it('thẻ ký đúng khoá nhưng claim mốc sai kiểu → 401', async () => {
    const u = await registerUser(app, 'k6-sai-kieu');
    const bad = jwt.sign({ pca: '0' }, SECRET, { subject: u.id, expiresIn: TTL, algorithm: 'HS256' });
    expect(await meStatus(app, bad)).toBe(401);
  });
});

describe('GIỮ — không làm hỏng điều đang đúng', () => {
  it('đăng nhập bằng mật khẩu mới sau khi đặt lại → thẻ mới dùng được', async () => {
    const u = await registerUser(app, 'k6-moi');
    await resetPassword(u);
    const fresh = await login(u.email, NEW_PASSWORD);
    expect(await meStatus(app, fresh.accessToken)).toBe(200);
    // Đổi thẻ bằng refresh token mới cũng ra thẻ dùng được.
    const r = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: fresh.refreshToken }).expect(200);
    expect(await meStatus(app, r.body.accessToken)).toBe(200);
  });

  it('thẻ cấp CÙNG GIÂY nhưng SAU lần đổi → dùng được (so iat làm tròn lên giây sẽ chặn oan thẻ này)', async () => {
    const u = await registerUser(app, 'k6-cung-giay-sau');
    for (let i = 0; i < 20; i++) {
      const changedAt = new Date();
      await deps.db.user.update({ where: { id: u.id }, data: { passwordChangedAt: changedAt } });
      const { accessToken } = await login(u.email, u.password);
      if (iatOf(accessToken) !== Math.floor(changedAt.getTime() / 1000)) continue;
      expect(await meStatus(app, accessToken)).toBe(200);
      return;
    }
    throw new Error('Không tạo được trường hợp cùng giây sau 20 lần');
  });

  it('người chưa từng đổi mật khẩu (mốc NULL): thẻ mới và thẻ đời cũ đều dùng được như trước', async () => {
    const u = await registerUser(app, 'k6-chua-doi');
    expect(await markOf(u.id)).toBeNull();
    expect(await meStatus(app, u.accessToken)).toBe(200);
    expect(await meStatus(app, signLegacyAccessToken(u.id, SECRET, TTL))).toBe(200);
  });

  it('người khác đặt lại mật khẩu không ảnh hưởng thẻ của mình', async () => {
    const a = await registerUser(app, 'k6-a');
    const b = await registerUser(app, 'k6-b');
    await resetPassword(a);
    expect(await meStatus(app, b.accessToken)).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: b.refreshToken })).status).toBe(200);
  });

  it('refresh token cũ vẫn bị thu hồi như trước (lý do PASSWORD_RESET); mốc = đúng lúc thu hồi, cùng transaction', async () => {
    const u = await registerUser(app, 'k6-refresh');
    await resetPassword(u);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })).status).toBe(401);
    const row = await deps.db.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(u.refreshToken) } });
    expect(row.revokeReason).toBe('PASSWORD_RESET');
    const mark = await markOf(u.id);
    expect(mark).not.toBeNull();
    expect(mark?.getTime()).toBe(row.revokedAt?.getTime());
  });

  it('đặt lại thất bại (thẻ đặt lại đã dùng) → mốc KHÔNG đổi, thẻ đang cầm vẫn dùng được', async () => {
    const u = await registerUser(app, 'k6-that-bai');
    const token = `the-thu-${randomUUID()}-${randomUUID()}`;
    await deps.db.passwordResetToken.create({
      data: { userId: u.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() },
    });
    await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD }).expect(400);
    expect(await markOf(u.id)).toBeNull();
    expect(await meStatus(app, u.accessToken)).toBe(200);
  });

  it('authenticate KHÔNG thêm truy vấn: đúng 1 câu SQL mỗi yêu cầu (mốc lấy kèm câu tra user sẵn có)', async () => {
    const counting = new PrismaClient({ datasources: { db: { url: deps.env.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
    const queries: string[] = [];
    counting.$on('query', (e) => queries.push(e.query));
    try {
      const u = await registerUser(app, 'k6-dem');
      const d: Deps = { ...deps, db: counting };
      const req = { header: (h: string) => (h === 'authorization' ? `Bearer ${u.accessToken}` : undefined) } as never;
      await authenticate(req, d); // khởi động kết nối
      queries.length = 0;
      expect(await authenticate(req, d)).toBe(u.id);
      expect(queries).toHaveLength(1);
      expect(queries[0]).toMatch(/password_changed_at/);
    } finally {
      await counting.$disconnect();
    }
  });
});

describe('quy tắc so mốc (hàm thuần)', () => {
  const mark = new Date(1_760_000_000_123); // giây 1760000000, lẻ 123 ms
  const sec = Math.floor(mark.getTime() / 1000);
  it('thẻ mang mốc: chỉ nhận khi BẰNG mốc hiện hành, bất kể iat', () => {
    expect(tokenSurvivesPasswordChange({ iat: sec, pca: mark.getTime() }, mark)).toBe(true);
    expect(tokenSurvivesPasswordChange({ iat: sec, pca: mark.getTime() - 1 }, mark)).toBe(false);
    expect(tokenSurvivesPasswordChange({ iat: sec + 5, pca: 0 }, mark)).toBe(false);
    expect(tokenSurvivesPasswordChange({ iat: sec, pca: 0 }, null)).toBe(true);
  });
  it('thẻ đời cũ (không mốc): giây trước và CÙNG giây → từ chối; giây sau → nhận', () => {
    expect(tokenSurvivesPasswordChange({ iat: sec - 1, pca: undefined }, mark)).toBe(false);
    expect(tokenSurvivesPasswordChange({ iat: sec, pca: undefined }, mark)).toBe(false);
    expect(tokenSurvivesPasswordChange({ iat: sec + 1, pca: undefined }, mark)).toBe(true);
    expect(tokenSurvivesPasswordChange({ iat: 0, pca: undefined }, null)).toBe(true);
  });
  it('thẻ mới luôn mang mốc (0 khi chưa đổi lần nào)', () => {
    expect((jwt.decode(signAccessToken('u', null, SECRET, TTL)) as { pca: number }).pca).toBe(0);
    expect((jwt.decode(signAccessToken('u', mark, SECRET, TTL)) as { pca: number }).pca).toBe(mark.getTime());
  });
});
