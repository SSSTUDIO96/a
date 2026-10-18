// Sửa theo biên bản nghiệm thu Web 1 (docs/nghiem-thu/BIEN-BAN-NGHIEM-THU-WEB-1.md):
// T3 (refresh ăn hạn mức đăng nhập), N2 (khoá chống gửi trùng ở đăng ký/tạo tổ chức), N3 (cookie hỏng → 500),
// N4 (409 trùng lịch khi đua thiếu details.conflicts); kèm phiếu vướng module tệp (đường ảnh, băm thân nhị phân).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { loadEnv } from '../src/env';
import type { Deps } from '../src/http/route';
import { makePng } from './png';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

// App riêng với giới hạn tốc độ như máy thật (mặc định 10/phút), dùng chung kết nối database.
function appWithLimit(perMinute: number): App {
  const d: Deps = { ...deps, env: loadEnv({ ...process.env, AUTH_RATE_LIMIT_PER_MINUTE: String(perMinute) }) };
  return makeApp(d);
}

function refreshCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('mp_refresh='))?.split(';')[0];
}

const PASSWORD = 'mat-khau-thu-123';

async function registerWeb(app: App, label: string) {
  const email = `${label}-${randomUUID().slice(0, 8)}@thu.local`;
  const res = await request(app).post('/api/v1/auth/register').set('X-Client', 'web').send({ email, password: PASSWORD, fullName: label });
  expect(res.status).toBe(201);
  const cookie = refreshCookie(res);
  if (!cookie) throw new Error('đăng ký web không trả cookie');
  return { email, cookie };
}

// Một lần "tải lại trang": web đổi cookie lấy thẻ mới, máy chủ xoay cookie.
async function reload(app: App, s: { cookie: string }) {
  const res = await request(app).post('/api/v1/auth/refresh').set('X-Client', 'web').set('Cookie', s.cookie).send({});
  const next = refreshCookie(res);
  if (res.status === 200 && next) s.cookie = next;
  return res.status;
}

describe('T3 — tải lại trang không được ăn vào hạn mức đăng nhập', () => {
  it('BẮT: đăng ký + 12 lần tải lại trang ở giới hạn mặc định 10/phút → cả 12 lần 200; đăng nhập ngay sau → 200', async () => {
    const app = appWithLimit(10);
    const s = await registerWeb(app, 'tai-lai');
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push(await reload(app, s));
    console.log(`[T3] 12 lần tải lại: ${codes.join(' ')}`);
    expect(codes).toEqual(Array(12).fill(200));
    const login = await request(app).post('/api/v1/auth/login').send({ email: s.email, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('BẮT: studio chung một IP — 3 máy, mỗi máy tải lại 10 lần trong một phút → không máy nào bị chặn, vẫn đăng nhập được', async () => {
    const app = appWithLimit(10);
    const machines = [await registerWeb(app, 'may-1'), await registerWeb(app, 'may-2'), await registerWeb(app, 'may-3')];
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) for (const m of machines) codes.push(await reload(app, m));
    const ok = codes.filter((c) => c === 200).length;
    console.log(`[T3] studio chung IP: ${ok}/${codes.length} lần tải lại 200`);
    expect(ok).toBe(codes.length);
    const login = await request(app).post('/api/v1/auth/login').send({ email: machines[0]?.email, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('GIỮ (chống dò): refresh bằng thẻ sai liên tục → bị chặn 429 sau 3×giới hạn (30) lần sai; đăng nhập không bị vạ lây', async () => {
    const app = appWithLimit(10);
    const s = await registerWeb(app, 'do-the');
    const codes: number[] = [];
    for (let i = 0; i < 32; i++) {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: `the-gia-${i}-${randomUUID()}` });
      codes.push(res.status);
    }
    const n401 = codes.filter((c) => c === 401).length;
    console.log(`[T3] dò thẻ: ${n401} lần 401 rồi ${codes.slice(n401).join(' ')}`);
    expect(codes.slice(0, 30)).toEqual(Array(30).fill(401));
    expect(codes.slice(30)).toEqual([429, 429]);
    // Thẻ thật cũng bị chặn từ IP đang dò (đúng ý: chống dò theo IP), nhưng đăng nhập vẫn đi được.
    const login = await request(app).post('/api/v1/auth/login').send({ email: s.email, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('GIỮ: trần tổng số lần refresh mỗi IP (30×giới hạn) — gọi không kèm thẻ quá trần → 429', async () => {
    const app = appWithLimit(2);
    const codes: number[] = [];
    for (let i = 0; i < 62; i++) codes.push((await request(app).post('/api/v1/auth/refresh').set('X-Client', 'web').send({})).status);
    expect(codes.slice(0, 60)).toEqual(Array(60).fill(401));
    expect(codes.slice(60)).toEqual([429, 429]);
  });

  it('GIỮ: đăng ký + đăng nhập vẫn chung bộ đếm 10/phút', async () => {
    const app = appWithLimit(10);
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await request(app).post('/api/v1/auth/login').send({ email: 'khong-co@thu.local', password: 'sai-mat-khau' })).status);
    expect(codes).toEqual([...Array(10).fill(401), 429]);
  });
});

describe('N3 — cookie đăng nhập hỏng trả 401 có tên lỗi, không 500', () => {
  for (const path of ['/api/v1/auth/refresh', '/api/v1/auth/logout']) {
    it(`BẮT: ${path} với cookie mp_refresh=%E0%A4%A → 401 REFRESH_COOKIE_MALFORMED và xoá cookie`, async () => {
      const app = makeApp(deps);
      const res = await request(app).post(path).set('X-Client', 'web').set('Cookie', 'mp_refresh=%E0%A4%A').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.details).toEqual({ reason: 'REFRESH_COOKIE_MALFORMED' });
      const cleared = (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('mp_refresh='));
      expect(cleared).toMatch(/^mp_refresh=;.*Path=\/api\/v1\/auth.*Expires=Thu, 01 Jan 1970/);
    });
  }

  it('GIỮ: cookie hợp lệ vẫn đổi thẻ được (có dấu % mã hoá đúng thì giải mã)', async () => {
    const app = makeApp(deps);
    const s = await registerWeb(app, 'cookie-tot');
    expect(await reload(app, s)).toBe(200);
  });
});

describe('N2 — đăng ký và tạo tổ chức tôn trọng Idempotency-Key, khoá gắn với người dùng', () => {
  let app: App;
  beforeAll(() => {
    app = makeApp(deps);
  });

  it('BẮT: đăng ký gửi lại CÙNG khoá + CÙNG thân → 201 lại đúng tài khoản đó, không 409; chỉ một tài khoản', async () => {
    const key = randomUUID();
    const body = { email: `dk-lai-${randomUUID().slice(0, 8)}@thu.local`, password: PASSWORD, fullName: 'Gửi lại đăng ký' };
    const r1 = await request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send(body);
    const r2 = await request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send(body);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.body.user).toEqual(r1.body.user);
    // Thẻ của lần gửi lại dùng được (thẻ mới — refresh token không bao giờ được cất để trả lại).
    await request(app).get('/api/v1/auth/me').set('authorization', `Bearer ${r2.body.accessToken}`).expect(200);
    expect(await deps.db.user.count({ where: { email: body.email } })).toBe(1);
  });

  it('GIỮ: đăng ký cùng email nhưng KHÁC khoá, hoặc cùng khoá mà sai mật khẩu → vẫn 409 "Email này đã được đăng ký"', async () => {
    const key = randomUUID();
    const body = { email: `dk-khac-${randomUUID().slice(0, 8)}@thu.local`, password: PASSWORD, fullName: 'Khoá khác' };
    await request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send(body).expect(201);
    const otherKey = await request(app).post('/api/v1/auth/register').set('Idempotency-Key', randomUUID()).send(body);
    const noKey = await request(app).post('/api/v1/auth/register').send(body);
    const wrongPass = await request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send({ ...body, password: 'mat-khau-khac-999' });
    const otherName = await request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send({ ...body, fullName: 'Tên khác' });
    for (const r of [otherKey, noKey, wrongPass, otherName]) {
      expect(r.status).toBe(409);
      expect(r.body.error.message).toBe('Email này đã được đăng ký');
      expect(r.body.accessToken).toBeUndefined();
    }
  });

  it('GIỮ: đăng ký gửi CÙNG khoá đồng thời → cả hai 201 cùng tài khoản, một dòng users', async () => {
    const key = randomUUID();
    const body = { email: `dk-dua-${randomUUID().slice(0, 8)}@thu.local`, password: PASSWORD, fullName: 'Đua đăng ký' };
    const [a, b] = await Promise.all([
      request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send(body),
      request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send(body),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.user.id).toBe(b.body.user.id);
    expect(await deps.db.user.count({ where: { email: body.email } })).toBe(1);
  });

  it('BẮT: tạo tổ chức gửi lại CÙNG khoá + CÙNG thân → 201 đúng phản hồi lần đầu, chỉ một tổ chức', async () => {
    const owner = await registerUser(app, 'tc-lai');
    const key = randomUUID();
    const body = { name: 'Studio gửi lại', slug: `tc-lai-${randomUUID().slice(0, 8)}`, kind: 'TEAM' };
    const r1 = await request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send(body);
    const r2 = await request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send(body);
    console.log(`[N2] tạo tổ chức: ${r1.status} rồi ${r2.status} ${r2.body?.error?.message ?? ''}`);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.body).toEqual(r1.body);
    expect(await deps.db.organization.count({ where: { slug: body.slug } })).toBe(1);
  });

  it('GIỮ: người KHÁC dùng cùng khoá + cùng thân → không nhận phản hồi của người kia (409 đường dẫn đã có người dùng)', async () => {
    const a = await registerUser(app, 'tc-a');
    const b = await registerUser(app, 'tc-b');
    const key = randomUUID();
    const body = { name: 'Studio của A', slug: `tc-ab-${randomUUID().slice(0, 8)}`, kind: 'TEAM' };
    const ra = await request(app).post('/api/v1/orgs').set(bearer(a)).set('Idempotency-Key', key).send(body);
    const rb = await request(app).post('/api/v1/orgs').set(bearer(b)).set('Idempotency-Key', key).send(body);
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(409);
    expect(rb.body.id).toBeUndefined();
    expect(rb.body.error.message).toMatch(/Đường dẫn tổ chức đã có người dùng/);
  });

  it('GIỮ: cùng người, cùng khoá nhưng KHÁC thân → 409 "đã dùng cho một yêu cầu khác", không tạo tổ chức thứ hai', async () => {
    const owner = await registerUser(app, 'tc-khac');
    const key = randomUUID();
    const slug1 = `tc-k1-${randomUUID().slice(0, 8)}`;
    const slug2 = `tc-k2-${randomUUID().slice(0, 8)}`;
    await request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send({ name: 'Một', slug: slug1, kind: 'TEAM' }).expect(201);
    const r2 = await request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send({ name: 'Hai', slug: slug2, kind: 'TEAM' });
    expect(r2.status).toBe(409);
    expect(r2.body.error.message).toBe('Idempotency-Key này đã dùng cho một yêu cầu khác');
    expect(await deps.db.organization.count({ where: { slug: slug2 } })).toBe(0);
  });

  it('GIỮ: cùng khoá, khác thân, gửi ĐỒNG THỜI → đúng một tổ chức được tạo', async () => {
    const owner = await registerUser(app, 'tc-dua-khac');
    const key = randomUUID();
    const slugs = [`tc-d1-${randomUUID().slice(0, 8)}`, `tc-d2-${randomUUID().slice(0, 8)}`];
    const res = await Promise.all(
      slugs.map((slug) => request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send({ name: 'Đua', slug, kind: 'TEAM' })),
    );
    expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await deps.db.organization.count({ where: { slug: { in: slugs } } })).toBe(1);
  });

  it('GIỮ: tạo tổ chức gửi CÙNG khoá đồng thời → cả hai 201 cùng id, một tổ chức', async () => {
    const owner = await registerUser(app, 'tc-dua');
    const key = randomUUID();
    const body = { name: 'Studio đua', slug: `tc-dua-${randomUUID().slice(0, 8)}`, kind: 'TEAM' };
    const [a, b] = await Promise.all([
      request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send(body),
      request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send(body),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.id).toBe(b.body.id);
    expect(await deps.db.organization.count({ where: { slug: body.slug } })).toBe(1);
  });

  it('GIỮ: khoá sai dạng → 400; không gửi khoá → tạo bình thường như cũ', async () => {
    const owner = await registerUser(app, 'tc-sai');
    const bad = await request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', 'ngan').send({ name: 'X', slug: `tc-x-${randomUUID().slice(0, 8)}`, kind: 'TEAM' });
    expect(bad.status).toBe(400);
    const badReg = await request(app).post('/api/v1/auth/register').set('Idempotency-Key', 'co dau cach!').send({ email: `x-${randomUUID().slice(0, 8)}@thu.local`, password: PASSWORD, fullName: 'X' });
    expect(badReg.status).toBe(400);
    await createOrg(app, owner, 'tc-khong-khoa');
  });
});

// Giữ một transaction chưa commit đang chiếm giờ của thợ, để yêu cầu API qua được bước kiểm trước
// rồi mới bị ràng buộc EXCLUDE của database chặn — đúng đường "hai yêu cầu đua nhau", nhưng chắc chắn mỗi lần.
async function holdOpen(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let ready!: () => void;
  const isReady = new Promise<void>((r) => (ready = r));
  const done = deps.db.$transaction(
    async (tx) => {
      await write(tx);
      ready();
      await gate;
    },
    { timeout: 30_000 },
  );
  await isReady;
  return { release, done };
}

// Đợi tới khi có câu lệnh đang chờ khoá (yêu cầu API đã tới chỗ database chặn).
async function waitForLockWait() {
  for (let i = 0; i < 200; i++) {
    const rows = await deps.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if ((rows[0]?.n ?? 0n) > 0n) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('yêu cầu API không tới chỗ chờ khoá');
}

describe('N4 — 409 trùng lịch LUÔN kèm details.conflicts, kể cả khi database chặn', () => {
  let app: App;
  let owner: TestUser;
  let orgId: string;
  let mid: string;
  const at = (day: number, hh: string) => `2033-05-${String(day).padStart(2, '0')}T${hh}:00:00Z`;
  const post = (body: Record<string, unknown>) =>
    request(app).post(`/api/v1/orgs/${orgId}/appointments`).set(bearer(owner)).set('Idempotency-Key', randomUUID()).send(body);
  const slot = (day: number, status = 'CONFIRMED') => ({ startsAt: at(day, '01'), endsAt: at(day, '02'), status, staff: [{ membershipId: mid, role: 'PRIMARY' }] });

  beforeAll(async () => {
    app = makeApp(deps);
    owner = await registerUser(app, 'trung-dua');
    orgId = await createOrg(app, owner, 'trung-dua');
    mid = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } })).id;
  });

  function expectConflictWith(res: request.Response, appointmentId: string) {
    expect(res.status).toBe(409);
    expect(Array.isArray(res.body.error.details?.conflicts)).toBe(true);
    expect(res.body.error.details.conflicts.map((c: { appointmentId: string }) => c.appointmentId)).toContain(appointmentId);
    expect(res.body.error.message).toMatch(/^Trùng lịch/);
  }

  it('BẮT: đổi giờ (PATCH) bị database chặn → 409 kèm lịch đang chiếm giờ', async () => {
    const a = await post(slot(1));
    const b = await post(slot(2));
    const hold = await holdOpen((tx) => tx.appointment.update({ where: { id: b.body.id }, data: { startsAt: new Date(at(3, '01')), endsAt: new Date(at(3, '02')) } }));
    const pending = request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a.body.id}`).set(bearer(owner)).send({ startsAt: at(3, '01'), endsAt: at(3, '02') }).then((r) => r);
    await waitForLockWait();
    hold.release();
    await hold.done;
    expectConflictWith(await pending, b.body.id);
  });

  it('BẮT: tạo lịch (POST) bị database chặn → 409 kèm lịch đang chiếm giờ', async () => {
    const b = await post(slot(4));
    const hold = await holdOpen((tx) => tx.appointment.update({ where: { id: b.body.id }, data: { startsAt: new Date(at(5, '01')), endsAt: new Date(at(5, '02')) } }));
    const pending = post(slot(5)).then((r) => r);
    await waitForLockWait();
    hold.release();
    await hold.done;
    expectConflictWith(await pending, b.body.id);
  });

  it('BẮT: chuyển trạng thái nháp → đã xác nhận bị database chặn → 409 kèm lịch đang chiếm giờ', async () => {
    const draft = await post(slot(6, 'DRAFT'));
    const b = await post(slot(7));
    const hold = await holdOpen((tx) => tx.appointment.update({ where: { id: b.body.id }, data: { startsAt: new Date(at(6, '01')), endsAt: new Date(at(6, '02')) } }));
    const pending = request(app).post(`/api/v1/orgs/${orgId}/appointments/${draft.body.id}/status`).set(bearer(owner)).send({ to: 'CONFIRMED' }).then((r) => r);
    await waitForLockWait();
    hold.release();
    await hold.done;
    expectConflictWith(await pending, b.body.id);
  });

  it('BẮT: tái hiện của thợ chấm — 10 lượt hai lịch cùng dời vào một giờ: bên thua luôn có details.conflicts', async () => {
    const a1 = await post(slot(10));
    const a2 = await post(slot(11));
    let races = 0;
    let missing = 0;
    for (let i = 0; i < 10; i++) {
      const target = { startsAt: at(12 + i, '01'), endsAt: at(12 + i, '02') };
      const [x, y] = await Promise.all([
        request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a1.body.id}`).set(bearer(owner)).send(target),
        request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a2.body.id}`).set(bearer(owner)).send(target),
      ]);
      const loser = [x, y].find((r) => r.status === 409);
      if (loser) {
        races++;
        if (!Array.isArray(loser.body.error?.details?.conflicts) || loser.body.error.details.conflicts.length === 0) missing++;
      }
      await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a1.body.id}`).set(bearer(owner)).send({ startsAt: at(10, '01'), endsAt: at(10, '02') }).expect(200);
      await request(app).patch(`/api/v1/orgs/${orgId}/appointments/${a2.body.id}`).set(bearer(owner)).send({ startsAt: at(11, '01'), endsAt: at(11, '02') }).expect(200);
    }
    console.log(`[N4] đua: ${races}/10 lượt có bên thua; ${missing} lượt bên thua thiếu conflicts`);
    expect(races).toBe(10);
    expect(missing).toBe(0);
  });
});

describe('Phiếu vướng module tệp — đường ảnh gắn trong app thật; khoá chống gửi trùng băm cả thân nhị phân', () => {
  let app: App;
  let owner: TestUser;
  let orgId: string;
  const query = { purpose: 'STAFF_AVATAR', name: 'a.png' };
  const upload = (data: Buffer, key: string, q: Record<string, string> = query, sha?: string) => {
    const r = request(app)
      .post(`/api/v1/orgs/${orgId}/files`)
      .query(q)
      .set(bearer(owner))
      .set('Idempotency-Key', key)
      .set('Content-Type', 'application/octet-stream');
    if (sha) r.set('X-Content-SHA256', sha);
    return r.send(data);
  };

  beforeAll(async () => {
    app = makeApp(deps);
    owner = await registerUser(app, 'tep');
    orgId = await createOrg(app, owner, 'tep');
  });

  it('BẮT: tải ảnh qua createApp thật rồi GET signedUrl → 200 đúng từng byte; vé sửa một ký tự → 403', async () => {
    const png = makePng(3, 4);
    const up = await upload(png, randomUUID());
    expect(up.status).toBe(201);
    const url = new URL(up.body.signedUrl as string, 'http://x');
    const got = await request(app).get(url.pathname).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(got.body as Buffer, png)).toBe(0);
    const last = url.pathname.slice(-1);
    const tampered = url.pathname.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    const bad = await request(app).get(tampered);
    expect(bad.status).toBe(403);
  });

  it('BẮT: cùng khoá + KHÁC tệp (không gửi X-Content-SHA256) → 409, không trả kết quả lần đầu', async () => {
    const key = randomUUID();
    const r1 = await upload(makePng(2, 3), key);
    const r2 = await upload(makePng(5, 6), key);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
    expect(r2.body.error.message).toBe('Idempotency-Key này đã dùng cho một yêu cầu khác');
  });

  it('BẮT: cùng khoá + cùng tệp nhưng KHÁC mục đích (query) → 409', async () => {
    const key = randomUUID();
    const png = makePng(2, 3);
    expect((await upload(png, key)).status).toBe(201);
    const r2 = await upload(png, key, { purpose: 'ORG_LOGO', name: 'a.png' });
    expect(r2.status).toBe(409);
  });

  it('BẮT: cùng khoá, header X-Content-SHA256 khác (tệp khác) → 409', async () => {
    const { createHash } = await import('node:crypto');
    const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
    const key = randomUUID();
    const a = makePng(2, 2);
    const b = makePng(7, 7);
    expect((await upload(a, key, query, sha(a))).status).toBe(201);
    expect((await upload(b, key, query, sha(b))).status).toBe(409);
  });

  it('GIỮ: cùng khoá + cùng tệp → cùng id, chỉ một bản ghi (có và không có X-Content-SHA256)', async () => {
    const { createHash } = await import('node:crypto');
    for (const withSha of [false, true]) {
      const key = randomUUID();
      const png = makePng(4, withSha ? 9 : 8);
      const sha = withSha ? createHash('sha256').update(png).digest('hex') : undefined;
      const r1 = await upload(png, key, query, sha);
      const r2 = await upload(png, key, query, sha);
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      expect(r2.body.id).toBe(r1.body.id);
      expect(await deps.db.storedFile.count({ where: { organizationId: orgId, sha256: createHash('sha256').update(png).digest('hex') } })).toBe(1);
    }
  });
});
