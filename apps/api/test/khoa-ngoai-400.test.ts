// VI PHẠM KHOÁ NGOẠI → 400 "Không tìm thấy dữ liệu liên quan" (phiếu vướng của thợ web T, đột biến 14 của cửa gác).
// Trước đây databaseError (http/middleware.ts) chỉ có nhánh mã Postgres 23503 — mà ghi qua client Prisma (create/update)
// báo P2003 KHÔNG kèm mã Postgres, nên bước kiểm nào của máy chủ bỏ sót một mã tham chiếu là ra 500.
// Đo bằng cách GHI THẲNG tham chiếu sai qua một đường thử gắn vào app thật (đi qua đúng bộ bắt lỗi của app):
//   client-update / client-create: Prisma client, mã bịa và mã của tổ chức khác (khoá ngoại kép) → P2003;
//   raw: SQL thô → P2010 mang mã 23503; tx: trong transaction tương tác.
// Cả bốn → 400, lời chung, KHÔNG lộ tên bảng / tên ràng buộc / tên cột; dữ liệu không đổi.
// Thêm: tái hiện đột biến 14 (tạo thẻ quên lọc tổ chức của ảnh) qua HTTP — trước 500, nay 400 (cửa gác vẫn bắt vì
// lời khác mã bịa — gate-mutants.test.ts).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ALL_ROUTES, createApp } from '../src/app';
import { defineRoute, mustOrg, type AnyRoute } from '../src/http/route';
import { databaseError, FOREIGN_KEY_MESSAGE, isForeignKeyViolation } from '../src/http/middleware';
import type { Db } from '../src/lib/prisma';
import { buildGateFixture, type GateFixture } from './gate';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';
import { makePng } from './png';

const deps = makeDeps();
const db = deps.db;

afterAll(async () => {
  await db.$disconnect();
});

const KINDS = ['client-update', 'client-create', 'raw', 'tx'] as const;

// Đường THỬ: ghi thẳng ảnh đại diện khách = mã tệp do thân gửi, KHÔNG kiểm gì (giả bước kiểm bị bỏ sót).
const probeRoute = defineRoute({
  method: 'put',
  path: '/orgs/:orgId/thu-khoa-ngoai/:kind',
  scope: 'org',
  permission: 'customers.write',
  summary: 'Đường thử: ghi thẳng tham chiếu sai',
  tag: 'Thử',
  params: z.object({ orgId: z.uuid(), kind: z.enum(KINDS) }),
  body: z.object({ customerId: z.uuid(), fileId: z.uuid() }),
  handler: async ({ deps: d, org, params, body }) => {
    const o = mustOrg(org);
    switch (params.kind) {
      case 'client-update':
        await d.db.customer.update({ where: { id: body.customerId }, data: { avatarFileId: body.fileId } });
        break;
      case 'client-create':
        await d.db.customer.create({ data: { organizationId: o.id, fullName: 'Khách lén', avatarFileId: body.fileId } });
        break;
      case 'raw':
        await d.db.$executeRaw`UPDATE customers SET avatar_file_id = ${body.fileId}::uuid WHERE id = ${body.customerId}::uuid`;
        break;
      case 'tx':
        await d.db.$transaction(async (tx) => {
          await tx.customer.update({ where: { id: body.customerId }, data: { note: 'trong transaction' } });
          await tx.customer.update({ where: { id: body.customerId }, data: { avatarFileId: body.fileId } });
        });
        break;
    }
    return { body: { ok: true } };
  },
}) as AnyRoute;

let app: App;
let probeApp: App;
let owner: TestUser;
let orgA: string;
let orgB: string;
let ownerB: TestUser;
let customerA: string;
let fileB: string;

async function uploadAvatar(u: TestUser, orgId: string): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/files?purpose=CUSTOMER_AVATAR&name=mau.png`)
    .set(bearer(u))
    .set('idempotency-key', randomUUID())
    .set('content-type', 'application/octet-stream')
    .send(makePng());
  expect(res.status).toBe(201);
  return res.body.id as string;
}

beforeAll(async () => {
  app = makeApp(deps);
  probeApp = createApp(deps, [...ALL_ROUTES, probeRoute]);
  owner = await registerUser(app, 'kn-chu-a');
  orgA = await createOrg(app, owner, 'kn-a');
  ownerB = await registerUser(app, 'kn-chu-b');
  orgB = await createOrg(app, ownerB, 'kn-b');
  const c = await request(app).post(`/api/v1/orgs/${orgA}/customers`).set(bearer(owner)).set('idempotency-key', randomUUID()).send({ fullName: 'Khách KN' });
  expect(c.status).toBe(201);
  customerA = c.body.id;
  fileB = await uploadAvatar(ownerB, orgB);
});

// Lời phản hồi không được lộ cấu trúc database.
const LEAK = /customers|stored_files|avatar_file_id|fkey|foreign|constraint|P2003|23503/i;

describe('vi phạm khoá ngoại → 400 "Không tìm thấy dữ liệu liên quan"', () => {
  for (const kind of KINDS) {
    it(`${kind}: mã tệp bịa và mã tệp của tổ chức khác → 400 lời chung, không lộ tên bảng, dữ liệu không đổi`, async () => {
      const customersBefore = await db.customer.count({ where: { organizationId: orgA } });
      for (const fileId of [randomUUID(), fileB]) {
        const res = await request(probeApp).put(`/api/v1/orgs/${orgA}/thu-khoa-ngoai/${kind}`).set(bearer(owner)).send({ customerId: customerA, fileId });
        expect([res.status, res.body.error?.code, res.body.error?.message]).toEqual([400, 'VALIDATION_FAILED', FOREIGN_KEY_MESSAGE]);
        expect(res.body.error.details).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(LEAK);
      }
      const row = await db.customer.findUniqueOrThrow({ where: { id: customerA } });
      expect([row.avatarFileId, row.note]).toEqual([null, null]);
      expect(await db.customer.count({ where: { organizationId: orgA } })).toBe(customersBefore);
    });
  }

  it('đường thử với tham chiếu ĐÚNG vẫn ghi được (đường thử không tự sinh lỗi)', async () => {
    const fileA = await uploadAvatar(owner, orgA);
    const res = await request(probeApp).put(`/api/v1/orgs/${orgA}/thu-khoa-ngoai/client-update`).set(bearer(owner)).send({ customerId: customerA, fileId: fileA });
    expect(res.status).toBe(200);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customerA } })).avatarFileId).toBe(fileA);
    await db.customer.update({ where: { id: customerA }, data: { avatarFileId: null } });
  });

  it('databaseError nhận cả hai dạng lỗi của Prisma: P2003 (client) và P2010/23503 (SQL thô)', async () => {
    const viaClient = await db.customer.update({ where: { id: customerA }, data: { avatarFileId: randomUUID() } }).catch((e: unknown) => e);
    expect(viaClient).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((viaClient as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
    const viaRaw = await db.$executeRaw`UPDATE customers SET avatar_file_id = ${randomUUID()}::uuid WHERE id = ${customerA}::uuid`.catch((e: unknown) => e);
    expect((viaRaw as Prisma.PrismaClientKnownRequestError).code).toBe('P2010');
    for (const err of [viaClient, viaRaw]) {
      expect(isForeignKeyViolation(err)).toBe(true);
      const app = databaseError(err);
      expect([app?.status, app?.message, app?.details]).toEqual([400, FOREIGN_KEY_MESSAGE, undefined]);
    }
    // Lỗi khác (trùng khoá P2002, lỗi lạ) không bị nhận nhầm là khoá ngoại.
    expect(isForeignKeyViolation(new Error('lạ'))).toBe(false);
  });
});

describe('đột biến 14 qua HTTP: tạo thẻ quên lọc tổ chức của ảnh → database chặn → 400 (không 500)', () => {
  let fx: GateFixture;
  beforeAll(async () => {
    fx = await buildGateFixture(app, db);
  });

  it('ảnh của tổ chức khác lọt bước kiểm → khoá ngoại kép (tệp, tổ chức) chặn → 400 lời chung, không tạo thẻ', async () => {
    const original = ALL_ROUTES.find((r) => r.method === 'post' && r.path === '/orgs/:orgId/design-cards');
    if (!original) throw new Error('Không có route tạo thẻ');
    const mutant = {
      ...original,
      handler: async (ctx: Parameters<typeof original.handler>[0]) => {
        const leaky = ctx.deps.db.$extends({
          query: {
            storedFile: {
              findMany({ args, query }) {
                if (args.where) delete (args.where as { organizationId?: unknown }).organizationId;
                return query(args);
              },
            },
          },
        }) as unknown as Db;
        return original.handler({ ...ctx, deps: { ...ctx.deps, db: leaky } });
      },
    } as AnyRoute;
    const mutantApp = createApp(deps, ALL_ROUTES.map((r) => (r === original ? mutant : r)));
    const b = fx.b;
    const cardsBefore = await db.designCard.count({ where: { organizationId: b.orgId } });
    const res = await request(mutantApp)
      .post(`/api/v1/orgs/${b.orgId}/design-cards`)
      .set(bearer(b.owner))
      .set('idempotency-key', randomUUID())
      .send({ kind: 'FEEDBACK', templateCode: 'fb-01', contractId: b.ids.contractId, body: 'Lời khen', photoFileIds: [fx.a.ids.designPhotoId], size: '1080x1350' });
    console.log(`[khoá ngoại] đột biến 14 qua HTTP → ${res.status} ${JSON.stringify(res.body.error?.message)}`);
    expect([res.status, res.body.error?.message]).toEqual([400, FOREIGN_KEY_MESSAGE]);
    expect(JSON.stringify(res.body)).not.toMatch(/design_card|stored_files|fkey|constraint/i);
    expect(await db.designCard.count({ where: { organizationId: b.orgId } })).toBe(cardsBefore);
    // Đường thật (không đột biến) vẫn chặn ở bước kiểm với lời riêng theo ô.
    const real = await request(app)
      .post(`/api/v1/orgs/${b.orgId}/design-cards`)
      .set(bearer(b.owner))
      .set('idempotency-key', randomUUID())
      .send({ kind: 'FEEDBACK', templateCode: 'fb-01', contractId: b.ids.contractId, body: 'Lời khen', photoFileIds: [fx.a.ids.designPhotoId], size: '1080x1350' });
    expect(real.status).toBe(400);
    expect(real.body.error.message).not.toBe(FOREIGN_KEY_MESSAGE);
  });
});
