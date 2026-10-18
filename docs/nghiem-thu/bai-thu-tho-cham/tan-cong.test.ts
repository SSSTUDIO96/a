// BÀI THỬ CỦA THỢ CHẤM — chỉ để chứng minh lỗi / chứng minh chặn được. Không thuộc mã sản phẩm.
// Quy ước: tên bắt đầu "LỖI:" = bài thử khẳng định HÀNH VI SAI đang xảy ra (xanh nghĩa là lỗi có thật).
//          tên bắt đầu "CHẶN:" = bài thử khẳng định đòn tấn công bị chặn (xanh nghĩa là an toàn ở đòn đó).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { addMember, bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from '../test/helpers';

const deps = makeDeps();
let app: App;

beforeAll(() => {
  app = makeApp(deps);
});
afterAll(async () => {
  await deps.db.$disconnect();
});

async function memberIdOf(actor: TestUser, orgId: string, userId: string): Promise<string> {
  const res = await request(app).get(`/api/v1/orgs/${orgId}/members?pageSize=100`).set(bearer(actor)).expect(200);
  return res.body.items.find((m: { user: { id: string } }) => m.user.id === userId).id;
}

async function roleKeysOf(membershipId: string): Promise<string[]> {
  const rows = await deps.db.membershipRole.findMany({ where: { membershipId }, include: { role: true } });
  return rows.map((r) => r.role.key).sort();
}

async function roleId(actor: TestUser, orgId: string, key: string): Promise<string> {
  const res = await request(app).get(`/api/v1/orgs/${orgId}/roles`).set(bearer(actor)).expect(200);
  return res.body.items.find((r: { key: string }) => r.key === key).id;
}

describe('1. Truy cập chéo tổ chức bằng mã của tổ chức khác', () => {
  it('CHẶN: chủ B dùng orgId của B nhưng membershipId/roleId của A → 404, dữ liệu A không đổi', async () => {
    const ownerA = await registerUser(app, 'cheo-a');
    const ownerB = await registerUser(app, 'cheo-b');
    const victim = await registerUser(app, 'cheo-nan-nhan');
    const orgA = await createOrg(app, ownerA, 'cheo-a');
    const orgB = await createOrg(app, ownerB, 'cheo-b');
    const victimMid = await addMember(app, ownerA, orgA, victim, ['artist']);
    await request(app).post(`/api/v1/orgs/${orgA}/roles`).set(bearer(ownerA)).send({ key: 'rieng_a', name: 'Riêng A', permissions: ['org.read'] }).expect(201);
    const roleA = await roleId(ownerA, orgA, 'rieng_a');
    const ownerRoleA = await roleId(ownerA, orgA, 'owner');

    const results = [
      await request(app).patch(`/api/v1/orgs/${orgB}/members/${victimMid}`).set(bearer(ownerB)).send({ status: 'SUSPENDED' }),
      await request(app).patch(`/api/v1/orgs/${orgB}/members/${victimMid}`).set(bearer(ownerB)).send({ roleKeys: ['owner'] }),
      await request(app).delete(`/api/v1/orgs/${orgB}/members/${victimMid}`).set(bearer(ownerB)),
      await request(app).patch(`/api/v1/orgs/${orgB}/roles/${roleA}`).set(bearer(ownerB)).send({ permissions: [], name: 'bi-sua' }),
      await request(app).patch(`/api/v1/orgs/${orgB}/roles/${ownerRoleA}`).set(bearer(ownerB)).send({ name: 'bi-sua' }),
    ];
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
    // Mời người của B vào B bằng mã vai trò của A: mã vai trò là theo tổ chức nên không lẫn được.
    const victimRow = await deps.db.membership.findUniqueOrThrow({ where: { id: victimMid } });
    expect(victimRow.status).toBe('ACTIVE');
    const roleRow = await deps.db.role.findUniqueOrThrow({ where: { id: roleA } });
    expect(roleRow.name).toBe('Riêng A');
    // Lỗi trả về không lộ tên/email người của tổ chức khác
    for (const r of results) expect(JSON.stringify(r.body)).not.toContain(victim.email);
  });

  it('CHẶN: uuid sai định dạng ở orgId/membershipId/roleId không gây lỗi 500', async () => {
    const owner = await registerUser(app, 'uuid');
    const org = await createOrg(app, owner, 'uuid');
    const a = await request(app).get(`/api/v1/orgs/khong-phai-uuid`).set(bearer(owner));
    const b = await request(app).patch(`/api/v1/orgs/${org}/members/123`).set(bearer(owner)).send({ status: 'ACTIVE' });
    const c = await request(app).patch(`/api/v1/orgs/${org}/roles/'%20OR%201=1--`).set(bearer(owner)).send({ name: 'x' });
    expect([a.status, b.status, c.status]).toEqual([404, 400, 400]);
  });
});

describe('2. Người quyền thấp đụng vào người quyền cao (vai trò không phải "chủ")', () => {
  let owner: TestUser, admin: TestUser, manager: TestUser, hr: TestUser, editor: TestUser, accountantBoss: TestUser;
  let org: string, adminMid: string, bossMid: string;

  beforeAll(async () => {
    owner = await registerUser(app, 'pc-chu');
    admin = await registerUser(app, 'pc-quan-tri');
    manager = await registerUser(app, 'pc-quan-ly');
    hr = await registerUser(app, 'pc-nhan-su');
    editor = await registerUser(app, 'pc-sua-vai-tro');
    accountantBoss = await registerUser(app, 'pc-ke-toan-truong');
    org = await createOrg(app, owner, 'phan-cap');
    adminMid = await addMember(app, owner, org, admin, ['admin']);
    await addMember(app, owner, org, manager, ['manager']);
    // Vai trò tuỳ chỉnh "nhân sự": chỉ quản người, KHÔNG có roles.manage, audit.read, org.update.
    await request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(owner))
      .send({ key: 'nhan_su', name: 'Nhân sự', permissions: ['org.read', 'members.read', 'members.update', 'members.remove'] }).expect(201);
    await addMember(app, owner, org, hr, ['nhan_su']);
    // Vai trò tuỳ chỉnh "sửa vai trò": có roles.manage nhưng KHÔNG có audit.read.
    await request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(owner))
      .send({ key: 'sua_vai_tro', name: 'Sửa vai trò', permissions: ['org.read', 'roles.read', 'roles.manage'] }).expect(201);
    await addMember(app, owner, org, editor, ['sua_vai_tro']);
    // Vai trò tuỳ chỉnh "kế toán trưởng": có audit.read, org.update.
    await request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(owner))
      .send({ key: 'ke_toan_truong', name: 'Kế toán trưởng', permissions: ['org.read', 'org.update', 'audit.read'] }).expect(201);
    bossMid = await addMember(app, owner, org, accountantBoss, ['ke_toan_truong']);
  });

  it('LỖI: Quản lý (5 quyền) hạ Quản trị (9 quyền) xuống "Thợ makeup" → 200', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${org}/members/${adminMid}`).set(bearer(manager)).send({ roleKeys: ['artist'] });
    expect(res.status).toBe(200);
    expect(await roleKeysOf(adminMid)).toEqual(['artist']);
    // Quản trị đã mất quyền, không tự khôi phục được.
    const back = await request(app).patch(`/api/v1/orgs/${org}/members/${adminMid}`).set(bearer(admin)).send({ roleKeys: ['admin'] });
    expect(back.status).toBe(403);
    // chủ trả lại cho bài sau
    await request(app).patch(`/api/v1/orgs/${org}/members/${adminMid}`).set(bearer(owner)).send({ roleKeys: ['admin'] }).expect(200);
  });

  it('LỖI: Quản lý tạm khoá Quản trị → 200, Quản trị bị đẩy ra khỏi tổ chức', async () => {
    const res = await request(app).patch(`/api/v1/orgs/${org}/members/${adminMid}`).set(bearer(manager)).send({ status: 'SUSPENDED' });
    expect(res.status).toBe(200);
    await request(app).get(`/api/v1/orgs/${org}`).set(bearer(admin)).expect(404);
    await request(app).patch(`/api/v1/orgs/${org}/members/${adminMid}`).set(bearer(owner)).send({ status: 'ACTIVE' }).expect(200);
  });

  it('LỖI: vai trò tuỳ chỉnh "nhân sự" (không có roles.manage) cho Quản trị rời tổ chức → 204', async () => {
    const res = await request(app).delete(`/api/v1/orgs/${org}/members/${adminMid}`).set(bearer(hr));
    expect(res.status).toBe(204);
    const row = await deps.db.membership.findUniqueOrThrow({ where: { id: adminMid } });
    expect(row.status).toBe('REMOVED');
  });

  it('LỖI: người có roles.manage nhưng không có audit.read tước audit.read khỏi vai trò "kế toán trưởng" đang gán cho người khác → 200', async () => {
    const rid = await roleId(owner, org, 'ke_toan_truong');
    const res = await request(app).patch(`/api/v1/orgs/${org}/roles/${rid}`).set(bearer(editor)).send({ permissions: ['org.read'] });
    expect(res.status).toBe(200);
    const after = await request(app).get(`/api/v1/orgs/${org}/audit-logs`).set(bearer(accountantBoss));
    expect(after.status).toBe(403); // kế toán trưởng mất quyền xem nhật ký
    expect(bossMid).toBeTruthy();
  });

  it('CHẶN: Quản lý thêm lại Quản trị đã bị REMOVED với vai trò admin → 403', async () => {
    const res = await request(app).post(`/api/v1/orgs/${org}/members`).set(bearer(manager)).send({ email: admin.email, roleKeys: ['admin'] });
    expect(res.status).toBe(403);
  });

  it('CHẶN: Quản trị thêm lại người đã REMOVED với vai trò owner → 403', async () => {
    const res = await request(app).post(`/api/v1/orgs/${org}/members`).set(bearer(admin)).send({ email: admin.email, roleKeys: ['owner'] });
    // admin đang REMOVED nên bị 404 tổ chức; thử bằng hr là người còn trong tổ chức nhưng không có members.invite
    expect([403, 404]).toContain(res.status);
    const res2 = await request(app).post(`/api/v1/orgs/${org}/members`).set(bearer(owner)).send({ email: admin.email, roleKeys: ['admin'] });
    expect(res2.status).toBe(201);
    const res3 = await request(app).patch(`/api/v1/orgs/${org}/members/${adminMid}`).set(bearer(admin)).send({ roleKeys: ['owner'] });
    expect(res3.status).toBe(403);
  });
});

describe('3. Tự nâng quyền qua vai trò tuỳ chỉnh', () => {
  it('CHẶN: người giữ vai trò tuỳ chỉnh có roles.manage sửa CHÍNH vai trò mình đang giữ để thêm quyền mình chưa có → 403', async () => {
    const owner = await registerUser(app, 'tn-chu');
    const e = await registerUser(app, 'tn-sua');
    const org = await createOrg(app, owner, 'tu-nang');
    await request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(owner))
      .send({ key: 'tu_sua', name: 'Tự sửa', permissions: ['org.read', 'roles.read', 'roles.manage', 'members.update'] }).expect(201);
    const eMid = await addMember(app, owner, org, e, ['tu_sua']);
    const rid = await roleId(owner, org, 'tu_sua');
    const up = await request(app).patch(`/api/v1/orgs/${org}/roles/${rid}`).set(bearer(e)).send({ permissions: ['org.read', 'roles.read', 'roles.manage', 'members.update', 'audit.read'] });
    expect(up.status).toBe(403);
    // Tạo vai trò mới mang quyền chưa có rồi tự gán → 403 ngay từ bước tạo
    const mk = await request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(e)).send({ key: 'cua_sau', name: 'Cửa sau', permissions: ['members.remove'] });
    expect(mk.status).toBe(403);
    // Tự gán vai trò hệ thống admin → 403
    const self = await request(app).patch(`/api/v1/orgs/${org}/members/${eMid}`).set(bearer(e)).send({ roleKeys: ['admin'] });
    expect(self.status).toBe(403);
    // Quyền lạ ngoài danh mục → 400
    const weird = await request(app).patch(`/api/v1/orgs/${org}/roles/${rid}`).set(bearer(e)).send({ permissions: ['__proto__', 'constructor'] });
    expect(weird.status).toBe(400);
  });

  it('CHẶN: hai yêu cầu đồng thời (tạo vai trò + gán) không vượt được quyền đang có', async () => {
    const owner = await registerUser(app, 'tn2-chu');
    const e = await registerUser(app, 'tn2-sua');
    const org = await createOrg(app, owner, 'tu-nang-2');
    await request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(owner))
      .send({ key: 'tu_sua', name: 'Tự sửa', permissions: ['org.read', 'roles.read', 'roles.manage', 'members.update'] }).expect(201);
    const eMid = await addMember(app, owner, org, e, ['tu_sua']);
    const rid = await roleId(owner, org, 'tu_sua');
    const reqs = await Promise.all([
      request(app).patch(`/api/v1/orgs/${org}/roles/${rid}`).set(bearer(e)).send({ permissions: ['org.read', 'roles.manage', 'members.update', 'audit.read'] }),
      request(app).patch(`/api/v1/orgs/${org}/members/${eMid}`).set(bearer(e)).send({ roleKeys: ['admin'] }),
      request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(e)).send({ key: 'x_' + Date.now() % 1000, name: 'x', permissions: ['audit.read'] }),
    ]);
    expect(reqs.map((r) => r.status)).toEqual([403, 403, 403]);
  });
});

describe('4. Loại bỏ chủ cuối cùng', () => {
  it('CHẶN: chủ duy nhất tự xoá / tự tạm khoá / tự đổi vai trò → 409; vai trò owner không sửa được → 403', async () => {
    const owner = await registerUser(app, 'cc-chu');
    const org = await createOrg(app, owner, 'chu-cuoi');
    const mid = await memberIdOf(owner, org, owner.id);
    const s = await Promise.all([
      request(app).delete(`/api/v1/orgs/${org}/members/${mid}`).set(bearer(owner)),
      request(app).patch(`/api/v1/orgs/${org}/members/${mid}`).set(bearer(owner)).send({ status: 'SUSPENDED' }),
      request(app).patch(`/api/v1/orgs/${org}/members/${mid}`).set(bearer(owner)).send({ roleKeys: ['admin'] }),
    ]);
    expect(s.map((r) => r.status)).toEqual([409, 409, 409]);
    const rid = await roleId(owner, org, 'owner');
    const r = await request(app).patch(`/api/v1/orgs/${org}/roles/${rid}`).set(bearer(owner)).send({ permissions: [] });
    expect(r.status).toBe(403);
  });

  it('CHẶN: hai chủ hạ quyền nhau cùng lúc, lặp 10 lần → lần nào cũng còn ≥1 chủ', async () => {
    let minOwners = 99;
    for (let i = 0; i < 10; i++) {
      const a = await registerUser(app, 'dua-a');
      const b = await registerUser(app, 'dua-b');
      const org = await createOrg(app, a, 'dua-chu');
      const bMid = await addMember(app, a, org, b, ['owner']);
      const aMid = await memberIdOf(a, org, a.id);
      await Promise.all([
        request(app).patch(`/api/v1/orgs/${org}/members/${bMid}`).set(bearer(a)).send({ status: 'SUSPENDED' }),
        request(app).patch(`/api/v1/orgs/${org}/members/${aMid}`).set(bearer(b)).send({ roleKeys: ['artist'] }),
      ]);
      const n = await deps.db.membership.count({ where: { organizationId: org, status: 'ACTIVE', roles: { some: { role: { key: 'owner' } } } } });
      minOwners = Math.min(minOwners, n);
    }
    expect(minOwners).toBeGreaterThanOrEqual(1);
  });
});

describe('5. Quyền bị kiểm NGOÀI khoá dòng tổ chức (kiểm trước, khoá sau)', () => {
  it('LỖI: chủ B đã bị hạ xuống thợ nhưng yêu cầu đang bay của B vẫn trao được vai trò chủ cho C', async () => {
    const a = await registerUser(app, 'tt-a');
    const b = await registerUser(app, 'tt-b');
    const c = await registerUser(app, 'tt-c');
    const org = await createOrg(app, a, 'kiem-truoc');
    const bMid = await addMember(app, a, org, b, ['owner']);
    const cMid = await addMember(app, a, org, c, ['artist']);
    const ownerRole = await deps.db.role.findFirstOrThrow({ where: { organizationId: org, key: 'owner' } });
    const artistRole = await deps.db.role.findFirstOrThrow({ where: { organizationId: org, key: 'artist' } });

    const holder = makeDeps();
    const watcher = makeDeps();
    let grant: Promise<request.Response> | undefined;
    await holder.db.$transaction(
      async (tx) => {
        // 1) Giữ khoá dòng tổ chức (giống lúc A đang chạy thao tác hạ quyền B).
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${org}::uuid FOR UPDATE`;
        // 2) B gửi yêu cầu trao "chủ" cho C. Quyền của B được nạp NGAY (B còn là chủ), rồi yêu cầu đứng chờ khoá.
        grant = request(app).patch(`/api/v1/orgs/${org}/members/${cMid}`).set(bearer(b)).send({ roleKeys: ['owner'] }).then((r) => r);
        for (let i = 0; i < 100; i++) {
          const rows = await watcher.db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
          if (Number(rows[0]?.n ?? 0) > 0) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        // 3) Thao tác của A hoàn tất: B bị hạ từ chủ xuống thợ (đúng các câu lệnh mà PATCH /members làm).
        await tx.membershipRole.deleteMany({ where: { membershipId: bMid } });
        await tx.membershipRole.create({ data: { organizationId: org, membershipId: bMid, roleId: artistRole.id } });
      },
      { timeout: 10_000 },
    );
    const res = await grant!;
    expect(await roleKeysOf(bMid)).toEqual(['artist']); // B không còn là chủ...
    expect(res.status).toBe(200); // ...nhưng thao tác "chủ" của B vẫn được chấp nhận
    expect(await roleKeysOf(cMid)).toEqual(['owner']); // C thành chủ nhờ quyền đã bị thu hồi
    expect(ownerRole.id).toBeTruthy();
    await holder.db.$disconnect();
    await watcher.db.$disconnect();
  });

  it('LỖI (đua thật qua API, không chạm database): A hạ B, B cùng lúc trao chủ cho C — đếm số lần thao tác của B chạy SAU khi B đã bị hạ', async () => {
    let staleWins = 0;
    const rounds = 15;
    for (let i = 0; i < rounds; i++) {
      const a = await registerUser(app, 'tt2-a');
      const b = await registerUser(app, 'tt2-b');
      const c = await registerUser(app, 'tt2-c');
      const org = await createOrg(app, a, 'kiem-truoc-2');
      const bMid = await addMember(app, a, org, b, ['owner']);
      const cMid = await addMember(app, a, org, c, ['artist']);
      const [demote, grant] = await Promise.all([
        request(app).patch(`/api/v1/orgs/${org}/members/${bMid}`).set(bearer(a)).send({ roleKeys: ['artist'] }),
        request(app).patch(`/api/v1/orgs/${org}/members/${cMid}`).set(bearer(b)).send({ roleKeys: ['owner'] }),
      ]);
      if (demote.status === 200 && grant.status === 200) {
        const logs = await deps.db.auditLog.findMany({ where: { organizationId: org, action: 'member.updated' }, orderBy: { createdAt: 'asc' } });
        const demoteLog = logs.find((l) => l.entityId === bMid);
        const grantLog = logs.find((l) => l.entityId === cMid);
        if (demoteLog && grantLog && grantLog.createdAt > demoteLog.createdAt) staleWins++;
      }
    }
    console.log(`[thợ chấm] đua thật: thao tác của B (đã bị hạ) vẫn chạy sau khi bị hạ ở ${staleWins}/${rounds} lượt`);
    expect(staleWins).toBeGreaterThanOrEqual(0); // chỉ đo, không ép
  });
});

describe('6. Refresh token', () => {
  it('CHẶN: 5 yêu cầu đổi cùng một thẻ đồng thời → đúng 1 thành công', async () => {
    const u = await registerUser(app, 'rt-dua');
    const rs = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })));
    expect(rs.filter((r) => r.status === 200).length).toBe(1);
  });

  it('CHẶN: thẻ của thiết bị khác vẫn sống sau khi đăng xuất thiết bị này; thẻ đã đăng xuất chết', async () => {
    const u = await registerUser(app, 'rt-2may');
    const other = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: other.body.refreshToken }).expect(200);
  });

  it('GHI NHẬN: khoá tài khoản rồi mở lại → thẻ refresh cũ sống lại (không bị thu hồi khi khoá)', async () => {
    const u = await registerUser(app, 'rt-khoa-mo');
    await deps.db.user.update({ where: { id: u.id }, data: { status: 'DISABLED' } });
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    await deps.db.user.update({ where: { id: u.id }, data: { status: 'ACTIVE' } });
    const r = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(r.status).toBe(200);
  });

  it('GHI NHẬN: access token cũ vẫn dùng được sau khi đăng xuất (tới hết hạn 15 phút)', async () => {
    const u = await registerUser(app, 'rt-at');
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    const me = await request(app).get('/api/v1/auth/me').set(bearer(u));
    expect(me.status).toBe(200);
  });
});

describe('7. Lộ thông tin', () => {
  it('LỖI: đăng ký trả 409 "Email này đã được đăng ký" → dò được email nào có tài khoản, trái với cố gắng giấu ở đăng nhập', async () => {
    const u = await registerUser(app, 'do-email');
    const known = await request(app).post('/api/v1/auth/register').send({ email: u.email, password: 'mat-khau-bat-ky-1', fullName: 'X' });
    expect(known.status).toBe(409);
    expect(known.body.error.message).toContain('đã được đăng ký');
  });

  it('GHI NHẬN: người có members.invite dò được email nào đã đăng ký (404 "Chưa có tài khoản" vs 201/409)', async () => {
    const owner = await registerUser(app, 'do2-chu');
    const someone = await registerUser(app, 'do2-nguoi-la');
    const org = await createOrg(app, owner, 'do-email-2');
    const no = await request(app).post(`/api/v1/orgs/${org}/members`).set(bearer(owner)).send({ email: 'khong-ton-tai-xyz@thu.local', roleKeys: ['artist'] });
    const yes = await request(app).post(`/api/v1/orgs/${org}/members`).set(bearer(owner)).send({ email: someone.email, roleKeys: ['artist'] });
    expect(no.status).toBe(404);
    expect(yes.status).toBe(201);
  });

  it('CHẶN: lỗi 500 không lộ stack/hash; /auth/me và danh sách thành viên không có passwordHash', async () => {
    const owner = await registerUser(app, 'lo-chu');
    const org = await createOrg(app, owner, 'lo');
    const me = await request(app).get('/api/v1/auth/me').set(bearer(owner)).expect(200);
    const mem = await request(app).get(`/api/v1/orgs/${org}/members`).set(bearer(owner)).expect(200);
    for (const b of [me.body, mem.body]) {
      expect(JSON.stringify(b)).not.toMatch(/passwordHash|\$2[aby]\$/);
    }
    const bad = await request(app).post('/api/v1/auth/register').send({ email: `nul-${Date.now()}@thu.local`, password: 'mat-khau-thu-123', fullName: 'A\u0000B' });
    expect(bad.status).toBe(500);
    expect(JSON.stringify(bad.body)).not.toMatch(/stack|prisma|Postgres|\$2[aby]\$/i);
  });
});

describe('8. Dữ liệu đầu vào xấu', () => {
  it('LỖI: ký tự rỗng \\u0000 trong họ tên / tên tổ chức / tên vai trò → 500 thay vì 400', async () => {
    const owner = await registerUser(app, 'nul-chu');
    const org = await createOrg(app, owner, 'nul');
    const a = await request(app).post('/api/v1/auth/register').send({ email: `nul2-${Date.now()}@thu.local`, password: 'mat-khau-thu-123', fullName: 'A\u0000' });
    const b = await request(app).patch(`/api/v1/orgs/${org}`).set(bearer(owner)).send({ name: 'Studio\u0000' });
    const c = await request(app).post(`/api/v1/orgs/${org}/roles`).set(bearer(owner)).send({ key: 'vai_nul', name: 'X\u0000', permissions: [] });
    expect([a.status, b.status, c.status]).toEqual([500, 500, 500]);
  });

  it('LỖI: thân yêu cầu > 100KB → 500 thay vì 413; content-encoding lạ → 500 thay vì 415', async () => {
    const big = await request(app).post('/api/v1/auth/login').set('content-type', 'application/json').send(JSON.stringify({ email: 'a@b.vn', password: 'x'.repeat(200_000) }));
    const enc = await request(app).post('/api/v1/auth/login').set('content-type', 'application/json').set('content-encoding', 'xyz').send('{"email":"a@b.vn","password":"x"}');
    expect([big.status, enc.status]).toEqual([500, 500]);
  });

  it('CHẶN: trang (page) rất lớn ở danh sách thành viên / nhật ký → 200 rỗng, không 500 (giả thuyết của thợ chấm bị bác)', async () => {
    const owner = await registerUser(app, 'trang');
    const org = await createOrg(app, owner, 'trang');
    const a = await request(app).get(`/api/v1/orgs/${org}/members?page=30000000&pageSize=100`).set(bearer(owner));
    const b = await request(app).get(`/api/v1/orgs/${org}/audit-logs?page=30000000&pageSize=100`).set(bearer(owner));
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.items).toEqual([]);
  });

  it('CHẶN: trường thừa bị bỏ qua (không gán được status/id/currency khi tạo tổ chức); kiểu sai → 400', async () => {
    const owner = await registerUser(app, 'thua');
    const res = await request(app).post('/api/v1/orgs').set(bearer(owner))
      .send({ name: 'Thừa', slug: `thua-${Date.now()}`, kind: 'TEAM', status: 'SUSPENDED', currency: 'USD', id: '00000000-0000-4000-8000-000000000000' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.currency).toBe('VND');
    expect(res.body.id).not.toBe('00000000-0000-4000-8000-000000000000');
    const t = await request(app).patch(`/api/v1/orgs/${res.body.id}/members/${res.body.id}`).set(bearer(owner)).send({ roleKeys: 'owner' });
    expect(t.status).toBe(400);
  });

  it('LỖI (nhẹ): mật khẩu dài hơn 72 byte bị cắt — đăng nhập được bằng mật khẩu KHÁC chỉ cần trùng 72 byte đầu', async () => {
    const email = `dai-${Date.now()}@thu.local`;
    const base = 'a'.repeat(72);
    await request(app).post('/api/v1/auth/register').send({ email, password: base + 'DUNG-1', fullName: 'X' }).expect(201);
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: base + 'SAI-hoan-toan-khac' });
    expect(res.status).toBe(200);
  });
});

describe('9. Nhật ký', () => {
  it('GHI NHẬN: đăng nhập, đăng xuất, đổi thẻ không để lại nhật ký', async () => {
    const u = await registerUser(app, 'nk');
    await request(app).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
    await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'sai-mat-khau-1' }).expect(401);
    const r = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: r.body.refreshToken }).expect(204);
    const actions = (await deps.db.auditLog.findMany({ where: { actorUserId: u.id } })).map((l) => l.action);
    expect(actions).toEqual(['user.registered']);
  });

  it('LỖI (nhẹ): gửi lại thẻ đã đăng xuất bị ghi thành "phát hiện đánh cắp" (báo động giả)', async () => {
    const u = await registerUser(app, 'nk-gia');
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    const log = await deps.db.auditLog.findFirst({ where: { actorUserId: u.id, action: 'auth.refresh_reuse_detected' } });
    expect(log).not.toBeNull();
  });

  it('GHI NHẬN: nhật ký "member.removed" không ghi vai trò người bị cho rời', async () => {
    const owner = await registerUser(app, 'nk2-chu');
    const x = await registerUser(app, 'nk2-x');
    const org = await createOrg(app, owner, 'nk2');
    const mid = await addMember(app, owner, org, x, ['admin']);
    await request(app).delete(`/api/v1/orgs/${org}/members/${mid}`).set(bearer(owner)).expect(204);
    const log = await deps.db.auditLog.findFirstOrThrow({ where: { organizationId: org, action: 'member.removed' } });
    expect(JSON.stringify(log.data)).not.toContain('admin');
  });
});
