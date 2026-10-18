// Lưới chung cho khoá chết / lỗi tuần tự hoá của database: 409 CONFLICT lời "Có thao tác khác đang ghi cùng lúc — thử lại.",
// không 500, không lộ chi tiết SQL. (Gốc khoá chết ở module lịch do thợ Q sửa; đây chỉ là lưới cuối.)
// Giả lỗi Prisma đúng HAI dạng Prisma 6.19 báo mã Postgres (xem pgErrorCode ở http/middleware.ts) + dạng P2034 của transaction.
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { defineRoute } from '../src/http/route';
import { makeDeps } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

const SQL = 'UPDATE "appointments" SET "starts_at" = $1 WHERE "id" = $2';
const fakes: [string, () => Error][] = [
  [
    '40P01 qua create/update (Unknown, mã trong lời)',
    () =>
      new Prisma.PrismaClientUnknownRequestError(
        `Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40P01", message: "deadlock detected", severity: "ERROR", detail: Some("Process 1 waits for ShareLock on transaction 2; ${SQL}"), column: None, hint: None }), transient: false })`,
        { clientVersion: '6.19.3' },
      ),
  ],
  [
    '40P01 qua $queryRaw (P2010, meta.code)',
    () => new Prisma.PrismaClientKnownRequestError('Raw query failed. Code: `40P01`. Message: `deadlock detected`', { code: 'P2010', clientVersion: '6.19.3', meta: { code: '40P01', message: `ERROR: deadlock detected ${SQL}` } }),
  ],
  [
    '40001 qua create/update (lỗi tuần tự hoá)',
    () =>
      new Prisma.PrismaClientUnknownRequestError(
        `Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40001", message: "could not serialize access due to concurrent update", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })`,
        { clientVersion: '6.19.3' },
      ),
  ],
  [
    'P2034 (transaction: write conflict or deadlock)',
    () => new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict or a deadlock. Please retry your transaction', { code: 'P2034', clientVersion: '6.19.3' }),
  ],
];

describe('khoá chết / lỗi tuần tự hoá → 409 thay vì 500', () => {
  for (const [label, make] of fakes) {
    it(label, async () => {
      const app = createApp(deps, [
        defineRoute({ method: 'post', path: '/thu-khoa-chet', scope: 'public', tag: 't', summary: 'thử', handler: async () => { throw make(); } }),
      ]);
      const res = await request(app).post('/api/v1/thu-khoa-chet');
      console.log(`[khoá chết] ${label} → ${res.status} "${res.body.error?.message}"`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: 'Có thao tác khác đang ghi cùng lúc — thử lại.' });
      expect(JSON.stringify(res.body)).not.toMatch(/deadlock|appointments|UPDATE|40P01|40001|P2034|serialize/);
    });
  }

  it('GIỮ: lỗi database lạ khác (mã 42P01) vẫn 500 lời chung', async () => {
    const app = createApp(deps, [
      defineRoute({
        method: 'post',
        path: '/thu-khoa-chet',
        scope: 'public',
        tag: 't',
        summary: 'thử',
        handler: async () => {
          throw new Prisma.PrismaClientKnownRequestError('Raw query failed', { code: 'P2010', clientVersion: '6.19.3', meta: { code: '42P01', message: 'relation does not exist' } });
        },
      }),
    ]);
    const res = await request(app).post('/api/v1/thu-khoa-chet');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Máy chủ gặp lỗi, vui lòng thử lại');
  });
});
