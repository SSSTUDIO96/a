// Đặt lại mật khẩu qua email (thợ K1): chống dò tài khoản, thẻ một lần/hết hạn/sai/của người khác, thu hồi phiên,
// giới hạn lượt, không lộ thẻ trong nhật ký/phản hồi, lỗi cấu hình có tên ở production, người gửi thư HTTP (máy chủ giả).
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import pino from 'pino';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';
import type { Deps } from '../src/http/route';
import { CONSOLE_MAIL_MARK, ConsoleMailer, createMailerFromEnv, HttpApiMailer, type Mailer, type MailMessage } from '../src/lib/mailer';
import { hashResetToken, RESET_REQUESTS_PER_EMAIL_PER_HOUR } from '../src/modules/auth/password-reset';
import { makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const base = makeDeps();
afterAll(async () => {
  await base.db.$disconnect();
});

const REQ = '/api/v1/auth/password-reset/request';
const CONFIRM = '/api/v1/auth/password-reset/confirm';
const NEW_PASSWORD = 'mat-khau-moi-456';

// Nhật ký bắt vào mảng (mức trace: kể cả dòng nhật ký từng yêu cầu của pino-http).
function captureLogger(level = 'trace') {
  const lines: string[] = [];
  const logger = pino({ level }, { write: (s: string) => void lines.push(s) });
  return { logger: logger as unknown as Deps['logger'], lines };
}

// Người gửi thư bắt thư vào mảng (không gửi đi đâu). delayMs: giả dịch vụ thư chậm.
function captureMailer(delayMs = 0) {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    driver: 'thu',
    send: async (m) => {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      sent.push(m);
    },
  };
  return { mailer, sent };
}

function setup(opts: { env?: Record<string, string>; mailer?: Mailer; level?: string } = {}) {
  const { logger, lines } = captureLogger(opts.level);
  const env = loadEnv({ ...process.env, ...opts.env });
  const deps: Deps & { mailer?: Mailer } = { db: base.db, env, logger, ...(opts.mailer ? { mailer: opts.mailer } : {}) };
  return { app: makeApp(deps), lines, deps };
}

const tokenOf = (m: MailMessage | undefined): string => {
  const t = /#the=([A-Za-z0-9_-]+)/.exec(m?.text ?? '')?.[1];
  if (!t) throw new Error('Thư không có đường dẫn đặt lại');
  return t;
};

async function loginStatus(app: App, email: string, password: string) {
  return (await request(app).post('/api/v1/auth/login').send({ email, password })).status;
}

async function refreshStatus(app: App, refreshToken: string) {
  return (await request(app).post('/api/v1/auth/refresh').send({ refreshToken })).status;
}

// Yêu cầu đặt lại và lấy thẻ từ thư vừa gửi.
async function issueToken(app: App, sent: MailMessage[], u: TestUser): Promise<string> {
  const before = sent.length;
  await request(app).post(REQ).send({ email: u.email }).expect(202);
  await expect.poll(() => sent.length).toBe(before + 1);
  const m = sent[sent.length - 1];
  expect(m?.to).toBe(u.email);
  return tokenOf(m);
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

describe('chống dò tài khoản', () => {
  it('email có tài khoản / không có / bị khoá / khác chữ hoa: cùng mã, cùng thân, cùng bộ header', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'do-co');
    const locked = await registerUser(app, 'do-khoa');
    await base.db.user.update({ where: { id: locked.id }, data: { status: 'DISABLED' } });
    const emails = [u.email, `khong-co-${randomUUID().slice(0, 8)}@thu.local`, locked.email, u.email.toUpperCase()];
    const res = [];
    for (const email of emails) res.push(await request(app).post(REQ).send({ email }));
    const shape = (r: request.Response) => ({
      status: r.status,
      body: r.body,
      headerNames: Object.keys(r.headers).sort(),
      etag: r.headers.etag,
      length: r.headers['content-length'],
    });
    console.log(`[đặt lại] mã trả: ${res.map((r) => r.status).join(', ')}; thư gửi: ${sent.length} (chỉ email có tài khoản đang hoạt động)`);
    expect(res[0]?.status).toBe(202);
    for (const r of res.slice(1)) expect(shape(r)).toEqual(shape(res[0]!));
    expect(sent.map((m) => m.to)).toEqual([u.email, u.email]);
  });

  it('thời gian không chênh lớn dù dịch vụ thư chậm 400 ms (thư gửi nền, mức sàn thời gian)', async () => {
    const { mailer, sent } = captureMailer(400);
    const { app } = setup({ mailer });
    const known: number[] = [];
    const unknown: number[] = [];
    // Mỗi email mới một tài khoản: không chạm giới hạn 3 thư/giờ/email.
    const users = [];
    for (let i = 0; i < 5; i++) users.push(await registerUser(app, `gio-${i}`));
    for (const u of users) {
      let t = performance.now();
      await request(app).post(REQ).send({ email: u.email }).expect(202);
      known.push(performance.now() - t);
      t = performance.now();
      await request(app).post(REQ).send({ email: `khong-co-${randomUUID().slice(0, 8)}@thu.local` }).expect(202);
      unknown.push(performance.now() - t);
    }
    const diff = Math.abs(median(known) - median(unknown));
    console.log(`[đặt lại] trung vị thời gian: có tài khoản ${median(known).toFixed(0)} ms, không có ${median(unknown).toFixed(0)} ms, chênh ${diff.toFixed(0)} ms (ngưỡng 100)`);
    expect(diff).toBeLessThan(100);
    await expect.poll(() => sent.length, { timeout: 5000 }).toBe(5);
  });
});

describe('thẻ đặt lại', () => {
  it('đúng thẻ: đổi mật khẩu, đăng nhập bằng mật khẩu mới; mật khẩu cũ hết dùng; database chỉ giữ bản băm, hết hạn sau 30 phút', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'dung-the');
    const token = await issueToken(app, sent, u);
    const row = await base.db.passwordResetToken.findFirstOrThrow({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } });
    expect(row.tokenHash).toBe(hashResetToken(token));
    expect(row.tokenHash).not.toContain(token);
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 byte ngẫu nhiên
    const ttlMin = (row.expiresAt.getTime() - row.createdAt.getTime()) / 60_000;
    expect(ttlMin).toBe(30);
    const res = await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(204);
    expect(String(res.headers['set-cookie'] ?? '')).toMatch(/mp_refresh=;/);
    expect(await loginStatus(app, u.email, NEW_PASSWORD)).toBe(200);
    expect(await loginStatus(app, u.email, u.password)).toBe(401);
    const done = await base.db.auditLog.findFirst({ where: { actorUserId: u.id, action: 'auth.password_reset_completed' } });
    expect(done).not.toBeNull();
  });

  it('thẻ hết hạn → 400 RESET_TOKEN_INVALID, mật khẩu giữ nguyên', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'het-han');
    const token = await issueToken(app, sent, u);
    await base.db.passwordResetToken.updateMany({
      where: { tokenHash: hashResetToken(token) },
      data: { createdAt: new Date(Date.now() - 2 * 3_600_000), expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error.details.reason).toBe('RESET_TOKEN_INVALID');
    expect(await loginStatus(app, u.email, u.password)).toBe(200);
    const audit = await base.db.auditLog.findFirst({ where: { actorUserId: u.id, action: 'auth.password_reset_rejected' } });
    expect(audit?.data).toEqual({ reason: 'EXPIRED' });
  });

  it('thẻ dùng lại → 400, mật khẩu đặt lần 2 không có tác dụng', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'dung-lai');
    const token = await issueToken(app, sent, u);
    await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD }).expect(204);
    const again = await request(app).post(CONFIRM).send({ token, password: 'mat-khau-lan-hai-789' });
    expect(again.status).toBe(400);
    expect(again.body.error.details.reason).toBe('RESET_TOKEN_INVALID');
    expect(await loginStatus(app, u.email, 'mat-khau-lan-hai-789')).toBe(401);
    expect(await loginStatus(app, u.email, NEW_PASSWORD)).toBe(200);
  });

  it('hai lần đặt đồng thời cùng một thẻ: đúng một lần thành công', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'dong-thoi');
    const token = await issueToken(app, sent, u);
    const [a, b] = await Promise.all([
      request(app).post(CONFIRM).send({ token, password: 'mat-khau-ben-a-111' }),
      request(app).post(CONFIRM).send({ token, password: 'mat-khau-ben-b-222' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([204, 400]);
  });

  it('thẻ sai (bịa, sửa một ký tự, cắt ngắn) → 400 cùng một lời; thẻ đúng vẫn dùng được sau đó', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'the-sai');
    const token = await issueToken(app, sent, u);
    const flip = (c: string) => (c === 'A' ? 'B' : 'A');
    const wrong = [randomBytes(32).toString('base64url'), token.slice(0, -1) + flip(token.slice(-1)), token.slice(0, 30)];
    const messages = new Set<string>();
    for (const t of wrong) {
      const res = await request(app).post(CONFIRM).send({ token: t, password: NEW_PASSWORD });
      expect(res.status).toBe(400);
      messages.add(res.body.error.message);
    }
    expect(messages.size).toBe(1);
    expect(await loginStatus(app, u.email, u.password)).toBe(200);
    await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD }).expect(204);
  });

  it('thẻ của người khác: thẻ của A chỉ đổi mật khẩu A; B giữ mật khẩu và phiên', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const a = await registerUser(app, 'nguoi-a');
    const b = await registerUser(app, 'nguoi-b');
    const tokenA = await issueToken(app, sent, a);
    // Thêm email của B vào thân cũng không đổi được người được đặt lại (thẻ quyết định người).
    await request(app).post(CONFIRM).send({ token: tokenA, password: NEW_PASSWORD, email: b.email }).expect(204);
    expect(await loginStatus(app, a.email, NEW_PASSWORD)).toBe(200);
    expect(await loginStatus(app, b.email, NEW_PASSWORD)).toBe(401);
    expect(await loginStatus(app, b.email, b.password)).toBe(200);
    expect(await refreshStatus(app, b.refreshToken)).toBe(200);
    // Thư của B chỉ tới B.
    await issueToken(app, sent, b);
    expect(sent.filter((m) => m.to === a.email)).toHaveLength(1);
  });

  it('mật khẩu mới không hợp lệ → 400, thẻ chưa bị tiêu, dùng lại được với mật khẩu hợp lệ', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'mk-yeu');
    const token = await issueToken(app, sent, u);
    await request(app).post(CONFIRM).send({ token, password: 'ngan' }).expect(400);
    await request(app).post(CONFIRM).send({ token, password: 'đ'.repeat(40) }).expect(400); // 80 byte > 72
    await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD }).expect(204);
  });
});

describe('thu hồi phiên và thẻ cũ', () => {
  it('đặt lại xong: mọi refresh token cũ (mọi thiết bị) bị thu hồi; thẻ đặt lại khác cũng hết hiệu lực', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'thu-hoi');
    const device2 = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
    // Một thẻ đặt lại khác còn hiệu lực (thêm thẳng vào database để thử riêng việc "đặt lại xong → vô hiệu thẻ cũ").
    const spare = randomBytes(32).toString('base64url');
    const token = await issueToken(app, sent, u);
    await base.db.passwordResetToken.create({
      data: { userId: u.id, tokenHash: hashResetToken(spare), expiresAt: new Date(Date.now() + 600_000) },
    });
    await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD }).expect(204);
    expect(await refreshStatus(app, u.refreshToken)).toBe(401);
    expect(await refreshStatus(app, device2.body.refreshToken)).toBe(401);
    const sessions = await base.db.refreshToken.findMany({ where: { userId: u.id } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(sessions.some((s) => s.revokeReason === 'PASSWORD_RESET')).toBe(true);
    const spareRes = await request(app).post(CONFIRM).send({ token: spare, password: 'mat-khau-khac-999' });
    expect(spareRes.status).toBe(400);
    const audit = await base.db.auditLog.findFirstOrThrow({ where: { actorUserId: u.id, action: 'auth.password_reset_completed' } });
    expect(audit.data).toEqual({ revokedSessions: 2, revokedResetTokens: 1 });
    // Đăng nhập lại bằng mật khẩu mới thì có phiên mới bình thường.
    const fresh = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: NEW_PASSWORD }).expect(200);
    expect(await refreshStatus(app, fresh.body.refreshToken)).toBe(200);
  });

  it('yêu cầu thư mới → đường dẫn trong thư cũ hết tác dụng (chỉ thẻ mới nhất dùng được)', async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'thu-moi');
    const first = await issueToken(app, sent, u);
    const second = await issueToken(app, sent, u);
    await request(app).post(CONFIRM).send({ token: first, password: NEW_PASSWORD }).expect(400);
    await request(app).post(CONFIRM).send({ token: second, password: NEW_PASSWORD }).expect(204);
  });
});

describe('giới hạn lượt', () => {
  it('theo IP (bộ đếm "auth" chung với đăng nhập): quá mức → 429, kể cả email không có tài khoản', async () => {
    const { mailer } = captureMailer();
    const { app } = setup({ mailer, env: { AUTH_RATE_LIMIT_PER_MINUTE: '3' } });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await request(app).post(REQ).send({ email: `x${i}-${randomUUID().slice(0, 6)}@thu.local` })).status);
    console.log(`[đặt lại] giới hạn IP 3/phút: ${codes.join(', ')}`);
    expect(codes).toEqual([202, 202, 202, 429, 429]);
    const confirm = await request(app).post(CONFIRM).send({ token: randomBytes(32).toString('base64url'), password: NEW_PASSWORD });
    expect(confirm.status).toBe(429);
  });

  it(`theo email: tối đa ${RESET_REQUESTS_PER_EMAIL_PER_HOUR} thư/giờ; lần vượt vẫn trả 202 giống hệt (không lộ), ghi audit`, async () => {
    const { mailer, sent } = captureMailer();
    const { app } = setup({ mailer });
    const u = await registerUser(app, 'gioi-han');
    const res = [];
    for (let i = 0; i < RESET_REQUESTS_PER_EMAIL_PER_HOUR + 2; i++) res.push(await request(app).post(REQ).send({ email: u.email }));
    await new Promise((r) => setTimeout(r, 50));
    console.log(`[đặt lại] ${res.length} lần yêu cầu cùng email → ${sent.length} thư`);
    expect(sent).toHaveLength(RESET_REQUESTS_PER_EMAIL_PER_HOUR);
    for (const r of res) expect([r.status, r.body]).toEqual([res[0]!.status, res[0]!.body]);
    const throttled = await base.db.auditLog.count({ where: { actorUserId: u.id, action: 'auth.password_reset_throttled' } });
    expect(throttled).toBe(2);
  });
});

describe('không lộ thẻ', () => {
  it('nhật ký (mức trace), phản hồi, audit: không chứa thẻ, bản băm hay mật khẩu mới', async () => {
    const { mailer, sent } = captureMailer();
    const { app, lines } = setup({ mailer, level: 'trace' });
    const u = await registerUser(app, 'khong-lo');
    const reqRes = await request(app).post(REQ).send({ email: u.email }).expect(202);
    await expect.poll(() => sent.length).toBe(1);
    const token = tokenOf(sent[0]);
    const badToken = token.slice(0, -2);
    const bad = await request(app).post(CONFIRM).send({ token: badToken, password: NEW_PASSWORD });
    const ok = await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD });
    const reuse = await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD });
    expect([bad.status, ok.status, reuse.status]).toEqual([400, 204, 400]);
    const responses = [reqRes, bad, ok, reuse].map((r) => JSON.stringify({ b: r.body, h: r.headers }));
    const audits = await base.db.auditLog.findMany({ where: { OR: [{ actorUserId: u.id }, { entityId: u.id }] } });
    // Kể cả thẻ SAI đã gửi lên (41/43 ký tự của thẻ thật): phản hồi lỗi không được lặp lại nó.
    const secrets = [token, badToken, hashResetToken(token), NEW_PASSWORD];
    const haystacks = { 'nhật ký': lines.join('\n'), 'phản hồi': responses.join('\n'), audit: JSON.stringify(audits) };
    let leaks = 0;
    for (const [where, text] of Object.entries(haystacks)) {
      for (const s of secrets) if (text.includes(s)) { leaks++; console.log(`[đặt lại] LỘ trong ${where}`); }
    }
    console.log(`[đặt lại] dòng nhật ký đã soi: ${lines.length}; chỗ lộ: ${leaks}`);
    expect(lines.length).toBeGreaterThan(0);
    expect(leaks).toBe(0);
  });

  it('dịch vụ thư lỗi (lời lỗi chép cả thư): vẫn 202, nhật ký ghi lỗi nhưng thẻ bị che', async () => {
    const failing: Mailer = { driver: 'hong', send: async (m) => Promise.reject(new Error(`từ chối thư: ${m.text}`)) };
    const { app, lines } = setup({ mailer: failing, level: 'info' });
    const u = await registerUser(app, 'thu-loi');
    await request(app).post(REQ).send({ email: u.email }).expect(202);
    await expect.poll(() => lines.some((l) => l.includes('Gửi thư đặt lại mật khẩu thất bại'))).toBe(true);
    const row = await base.db.passwordResetToken.findFirstOrThrow({ where: { userId: u.id } });
    const all = lines.join('\n');
    expect(all).toContain('[ẩn]');
    const m = /#the=([A-Za-z0-9_-]+)/.exec(all);
    expect(m).toBeNull();
    expect(all).not.toContain(row.tokenHash);
  });

  it('người gửi thư console (chạy thử): in đường dẫn ra nhật ký, đánh dấu rõ, đúng MỘT dòng; dùng được để đặt lại', async () => {
    const { app, lines } = setup({ level: 'warn', env: { WEB_APP_URL: 'http://localhost:5400' } });
    const u = await registerUser(app, 'console');
    await request(app).post(REQ).send({ email: u.email }).expect(202);
    const marked = lines.filter((l) => l.includes(CONSOLE_MAIL_MARK));
    expect(marked).toHaveLength(1);
    const token = /http:\/\/localhost:5400\/dat-lai-mat-khau#the=([A-Za-z0-9_-]+)/.exec(marked[0]!)?.[1];
    expect(token).toBeTruthy();
    expect(lines.filter((l) => l.includes(token!))).toHaveLength(1);
    await request(app).post(CONFIRM).send({ token, password: NEW_PASSWORD }).expect(204);
    expect(await loginStatus(app, u.email, NEW_PASSWORD)).toBe(200);
  });
});

describe('cấu hình người gửi thư', () => {
  const prod = {
    NODE_ENV: 'production',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: '/tmp/makeup-k1-prod-thu',
    STORAGE_SIGNING_SECRET: 'khoa-ky-tep-chi-dung-cho-bai-thu-0123456789',
    STORAGE_PUBLIC_BASE_URL: 'https://api.thu.local',
    WEB_APP_URL: 'https://app.thu.local',
    MAIL_DRIVER: '',
  };

  it.each([
    ['chưa khai MAIL_DRIVER', {}, 'MAIL_NOT_CONFIGURED'],
    ['MAIL_DRIVER=console', { MAIL_DRIVER: 'console' }, 'MAIL_CONSOLE_IN_PRODUCTION'],
    ['thiếu WEB_APP_URL', { WEB_APP_URL: '' }, 'WEB_APP_URL_NOT_CONFIGURED'],
  ])('production %s → 503 NOT_CONFIGURED có tên, giống nhau cho mọi email, ghi log cho người vận hành', async (_ten, extra, reason) => {
    const { app, lines } = setup({ env: { ...prod, ...extra }, level: 'error' });
    const u = await registerUser(app, 'prod');
    const a = await request(app).post(REQ).send({ email: u.email });
    const b = await request(app).post(REQ).send({ email: `khong-co-${randomUUID().slice(0, 6)}@thu.local` });
    expect(a.status).toBe(503);
    expect(a.body.error.code).toBe('NOT_CONFIGURED');
    expect(a.body.error.details).toEqual({ reason });
    expect({ ...b.body.error, requestId: '' }).toEqual({ ...a.body.error, requestId: '' });
    expect(lines.some((l) => l.includes('NOT_CONFIGURED') && l.includes('operatorHint'))).toBe(true);
    expect(await base.db.passwordResetToken.count({ where: { userId: u.id } })).toBe(0);
  });

  it('env: MAIL_DRIVER=http thiếu biến → không khởi động, nêu tên biến; production bắt buộc https; đủ biến → HttpApiMailer', () => {
    expect(() => loadEnv({ ...process.env, MAIL_DRIVER: 'http' })).toThrow(/MAIL_FROM.*MAIL_HTTP_URL.*MAIL_HTTP_API_KEY/);
    const httpVars = { MAIL_DRIVER: 'http', MAIL_FROM: 'Makeup Pro <no-reply@thu.local>', MAIL_HTTP_URL: 'http://127.0.0.1:9/emails', MAIL_HTTP_API_KEY: 'khoa-gia-12345678' };
    expect(() => loadEnv({ ...process.env, ...prod, ...httpVars })).toThrow(/MAIL_HTTP_URL: production phải dùng https/);
    const env = loadEnv({ ...process.env, ...prod, ...httpVars, MAIL_HTTP_URL: 'https://api.thu.local/emails' });
    const setupRes = createMailerFromEnv(env, base.logger);
    expect(setupRes.ok && setupRes.mailer).toBeInstanceOf(HttpApiMailer);
    const dev = createMailerFromEnv(loadEnv({ ...process.env, MAIL_DRIVER: '' }), base.logger);
    expect(dev.ok && dev.mailer).toBeInstanceOf(ConsoleMailer);
    expect(dev.ok && dev.webAppUrl).toBe('http://localhost:5173');
  });

  it('HttpApiMailer gọi máy chủ giả trên máy: đúng dạng JSON + Bearer; bị từ chối thì lỗi không chép thân trả về', async () => {
    const got: { auth?: string; body: unknown }[] = [];
    let reply = 200;
    const server = createServer((req: IncomingMessage, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        got.push({ auth: req.headers.authorization, body: JSON.parse(data) });
        res.writeHead(reply, { 'content-type': 'application/json' }).end(JSON.stringify({ echo: data }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/emails`;
    try {
      const mailer = new HttpApiMailer({ url, apiKey: 'khoa-gia-12345678', from: 'Makeup Pro <no-reply@thu.local>' });
      const msg = { to: 'a@thu.local', subject: 'Chủ đề', text: 'bi-mat-trong-thu', html: '<p>x</p>' };
      await mailer.send(msg);
      expect(got[0]).toEqual({
        auth: 'Bearer khoa-gia-12345678',
        body: { from: 'Makeup Pro <no-reply@thu.local>', to: ['a@thu.local'], subject: 'Chủ đề', text: 'bi-mat-trong-thu', html: '<p>x</p>' },
      });
      reply = 422;
      const err = await mailer.send(msg).then(() => null, (e: Error) => e);
      expect(err?.message).toBe('Dịch vụ gửi thư từ chối (HTTP 422)');
      expect(err?.message).not.toContain('bi-mat');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
