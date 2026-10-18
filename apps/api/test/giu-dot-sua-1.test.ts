// N-I2 (biên bản nghiệm thu đợt sửa 1): bài thử của thợ I lọt 6/15 đột biến. Mỗi bài dưới đây GIỮ một chỗ đã lọt:
//   (a) I-a  khoá tư vấn khi tạo tổ chức cùng Idempotency-Key — 20 yêu cầu đồng thời, 3 vòng → đúng 1 tổ chức mỗi vòng;
//   (b) I-d  đăng ký gửi lại chỉ được nhận trong 24 giờ;
//   (c) I-e  đăng ký gửi lại với tài khoản đã bị khoá → không trả thẻ;
//   (d) I-f  lần đổi thẻ THÀNH CÔNG không bị đếm vào bộ chống dò;
//   (e) I-n  thẻ gửi qua cookie (X-Client: web) cũng chịu cùng bộ chống dò như thẻ trong thân;
//   (f) I-o  lưới cuối 23P01 ở middleware vẫn trả details.conflicts = [] và ghi log cảnh báo.
// Cách chứng minh bài không mù: cài lại từng đột biến (bảng trong biên bản) → bài tương ứng phải đỏ.
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadEnv } from '../src/env';
import { defineRoute, type Deps } from '../src/http/route';
import type { Logger } from '../src/lib/logger';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

const PASSWORD = 'mat-khau-thu-123';
const HOUR = 60 * 60_000;

function appWith(env: Record<string, string>): App {
  const d: Deps = { ...deps, env: loadEnv({ ...process.env, ...env }) };
  return makeApp(d);
}

describe('(a) tạo tổ chức: 20 yêu cầu đồng thời cùng Idempotency-Key → đúng 1 tổ chức', () => {
  it('3 vòng × 20 yêu cầu cùng người, cùng khoá, 20 thân khác nhau → mỗi vòng 1×201 + 19×409, đúng 1 tổ chức', async () => {
    const app = makeApp(deps);
    const owner = await registerUser(app, 'giu-a');
    const rounds: string[] = [];
    for (let round = 0; round < 3; round++) {
      const key = randomUUID();
      const slugs = Array.from({ length: 20 }, (_, i) => `giu-a-${round}-${i}-${randomUUID().slice(0, 8)}`);
      const res = await Promise.all(
        slugs.map((slug, i) => request(app).post('/api/v1/orgs').set(bearer(owner)).set('Idempotency-Key', key).send({ name: `Đua ${i}`, slug, kind: 'TEAM' })),
      );
      const created = await deps.db.organization.count({ where: { slug: { in: slugs } } });
      const statuses = res.map((r) => r.status);
      const n201 = statuses.filter((s) => s === 201).length;
      const n409 = statuses.filter((s) => s === 409).length;
      rounds.push(`vòng ${round}: tổ chức=${created} 201×${n201} 409×${n409} khác×${20 - n201 - n409}`);
      expect(created, rounds.at(-1)).toBe(1);
      expect(n201, rounds.at(-1)).toBe(1);
      expect(n409, rounds.at(-1)).toBe(19);
      // Bên thắng có đúng một dòng khoá; bên thua nhận đúng lời "đã dùng cho một yêu cầu khác".
      expect(await deps.db.idempotencyKey.count({ where: { userId: owner.id, key } })).toBe(1);
      for (const r of res.filter((x) => x.status === 409)) expect(r.body.error.message).toBe('Idempotency-Key này đã dùng cho một yêu cầu khác');
    }
    console.log(`[GIU-a] ${rounds.join(' | ')}`);
  }, 60_000);
});

describe('(b)(c) đăng ký gửi lại cùng Idempotency-Key', () => {
  let app: App;
  beforeAll(() => {
    app = makeApp(deps);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function registerWithKey(label: string) {
    const key = randomUUID();
    const body = { email: `${label}-${randomUUID().slice(0, 8)}@thu.local`, password: PASSWORD, fullName: `Người ${label}` };
    const first = await request(app).post('/api/v1/auth/register').set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    return { key, body, userId: first.body.user.id as string };
  }
  const replay = (key: string, body: object, web = false) => {
    const r = request(app).post('/api/v1/auth/register').set('Idempotency-Key', key);
    return (web ? r.set('X-Client', 'web') : r).send(body);
  };
  function expectNoTokens(r: request.Response) {
    expect(r.status).toBe(409);
    expect(r.body.accessToken).toBeUndefined();
    expect(r.body.refreshToken).toBeUndefined();
    expect(r.body.user).toBeUndefined();
    expect(String(r.headers['set-cookie'] ?? '')).not.toMatch(/mp_refresh=[^;]+/);
  }

  // Đồng hồ giả chỉ thay Date (không thay setTimeout): máy chủ "thấy" bây giờ là N giờ sau lần đăng ký đầu.
  function clockAhead(ms: number) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + ms));
  }

  it('(b) GIỮ: 23 giờ sau vẫn nhận gửi lại (201, cùng tài khoản) — đối chứng cho bài 25 giờ', async () => {
    const { key, body, userId } = await registerWithKey('giu-b-23');
    clockAhead(23 * HOUR);
    const r = await replay(key, body);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.user.id).toBe(userId);
  });

  it('(b) BẮT: quá 24 giờ (25 giờ sau) → 409 "Email này đã được đăng ký", không trả thẻ', async () => {
    const { key, body } = await registerWithKey('giu-b-25');
    clockAhead(25 * HOUR);
    const r = await replay(key, body);
    expectNoTokens(r);
    expect(r.body.error.message).toBe('Email này đã được đăng ký');
  });

  it('(c) BẮT: tài khoản đã bị khoá (DISABLED) → gửi lại 409, không thẻ trong thân, không cookie (cả web); mở lại → 201', async () => {
    const { key, body, userId } = await registerWithKey('giu-c');
    await deps.db.user.update({ where: { id: userId }, data: { status: 'DISABLED' } });
    expectNoTokens(await replay(key, body));
    expectNoTokens(await replay(key, body, true));
    // Không có phiên mới nào được cấp cho tài khoản bị khoá.
    const sessionsWhileDisabled = await deps.db.refreshToken.count({ where: { userId } });
    // Đối chứng: mở khoá → cùng yêu cầu được nhận, chứng minh 409 ở trên là do trạng thái khoá chứ không do sai khoá/thân.
    await deps.db.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    const ok = await replay(key, body);
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(sessionsWhileDisabled).toBe(1); // chỉ phiên của lần đăng ký đầu
  });
});

describe('(d)(e) bộ chống dò của /auth/refresh', () => {
  // Bộ chống dò 3 lần sai/phút; trần tổng nới rộng để không lẫn vào kết quả.
  const probeApp = () => appWith({ AUTH_RATE_LIMIT_PER_MINUTE: '1000', REFRESH_PROBE_LIMIT_PER_MINUTE: '3', REFRESH_RATE_LIMIT_PER_MINUTE: '1000' });

  it('(d) BẮT: 10 lần đổi thẻ ĐÚNG liên tiếp (vượt xa mức 3) đều 200; lần sai tiếp theo vẫn là 401, chưa bị 429', async () => {
    const app = probeApp();
    const user = await registerUser(app, 'giu-d');
    let token = user.refreshToken;
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token });
      statuses.push(r.status);
      if (r.status === 200) token = r.body.refreshToken;
    }
    const wrong = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: `the-sai-${randomUUID()}` });
    console.log(`[GIU-d] 10 lần đúng: ${statuses.join(',')}; lần sai: ${wrong.status}`);
    expect(statuses).toEqual(Array(10).fill(200));
    expect(wrong.status).toBe(401);
  });

  it('(e) BẮT: thẻ rác gửi qua cookie (X-Client: web) bị đếm như thẻ trong thân → lần sai thứ 4 bị 429 kèm Retry-After', async () => {
    const app = probeApp();
    const res: request.Response[] = [];
    for (let i = 0; i < 5; i++) {
      res.push(await request(app).post('/api/v1/auth/refresh').set('X-Client', 'web').set('Cookie', `mp_refresh=the-rac-${i}-${randomUUID()}`).send({}));
    }
    console.log(`[GIU-e] cookie: ${res.map((r) => r.status).join(',')}`);
    expect(res.map((r) => r.status)).toEqual([401, 401, 401, 429, 429]);
    expect(Number(res[3]!.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  it('(e) BẮT: thẻ trong thân và thẻ qua cookie chung MỘT bộ đếm (2 thân + 1 cookie sai → lần thứ 4 qua cookie bị 429)', async () => {
    const app = probeApp();
    const s: number[] = [];
    for (let i = 0; i < 2; i++) s.push((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: `the-than-${i}-${randomUUID()}` })).status);
    for (let i = 0; i < 2; i++) {
      s.push((await request(app).post('/api/v1/auth/refresh').set('X-Client', 'web').set('Cookie', `mp_refresh=the-cookie-${i}-${randomUUID()}`).send({})).status);
    }
    expect(s).toEqual([401, 401, 401, 429]);
  });

  it('(e) GIỮ: web chưa đăng nhập (không cookie) không bị đếm vào chống dò — 6 lần đều 401', async () => {
    const app = probeApp();
    const s: number[] = [];
    for (let i = 0; i < 6; i++) s.push((await request(app).post('/api/v1/auth/refresh').set('X-Client', 'web').send({})).status);
    expect(s).toEqual(Array(6).fill(401));
  });
});

describe('(f) lưới cuối ở middleware: 23P01 chặn trùng lịch lọt tới bộ bắt lỗi chung', () => {
  let owner: TestUser;
  let orgId: string;
  let a1: string;
  let a2: string;
  const at = (day: number, hh: string) => new Date(Date.UTC(2038, 2, day, Number(hh))).toISOString();

  beforeAll(async () => {
    const app = makeApp(deps);
    owner = await registerUser(app, 'giu-f');
    orgId = await createOrg(app, owner, 'giu-f');
    const mid = (await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId } })).id;
    const mk = async (day: number) => {
      const r = await request(app)
        .post(`/api/v1/orgs/${orgId}/appointments`)
        .set(bearer(owner))
        .set('Idempotency-Key', randomUUID())
        .send({ startsAt: at(day, '01'), endsAt: at(day, '02'), status: 'CONFIRMED', staff: [{ membershipId: mid, role: 'PRIMARY' }] });
      expect(r.status).toBe(201);
      return r.body.id as string;
    };
    a1 = await mk(1);
    a2 = await mk(2);
  });

  it('BẮT: đường ghi KHÔNG bọc guardOverlap chạm ràng buộc → 409 "Trùng lịch", details.conflicts = [], có log cảnh báo', async () => {
    const logs: { level: number; msg: string }[] = [];
    const logger = pino({ level: 'warn' }, { write: (s: string) => void logs.push(JSON.parse(s)) }) as unknown as Logger;
    // Một đường thử cố ý ghi thẳng (không qua module lịch) — mô phỏng "đường ghi mới quên bọc guardOverlap".
    const unguarded = defineRoute({
      method: 'post',
      path: '/thu/ghi-lich-khong-boc',
      scope: 'public',
      tag: 'Thử',
      summary: 'Bài thử lưới cuối',
      handler: async () => {
        await deps.db.appointment.update({ where: { id: a2 }, data: { startsAt: new Date(at(1, '01')), endsAt: new Date(at(1, '02')) } });
        return { body: { ok: true } };
      },
    });
    const app = createApp({ ...deps, logger }, [unguarded]);
    const r = await request(app).post('/api/v1/thu/ghi-lich-khong-boc').send({});
    console.log(`[GIU-f] ${r.status} ${JSON.stringify(r.body.error)}; log cảnh báo: ${JSON.stringify(logs.filter((l) => l.level === 40).map((l) => l.msg))}`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT');
    expect(r.body.error.message).toMatch(/^Trùng lịch/);
    expect(r.body.error.details).toEqual({ conflicts: [] });
    expect(logs.some((l) => l.level === 40 && /Trùng lịch.*lưới cuối/.test(l.msg))).toBe(true);
    // Database vẫn giữ: a2 không bị dời chồng lên a1.
    expect((await deps.db.appointment.findUniqueOrThrow({ where: { id: a2 } })).startsAt.toISOString()).toBe(at(2, '01'));
    expect(a1).toBeTruthy();
  });
});
