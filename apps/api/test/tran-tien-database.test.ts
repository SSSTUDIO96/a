// TRẦN SỐ TIỀN Ở DATABASE — migration 20261018250000_tran_so_tien (đề xuất của thợ O).
// Mọi cột tiền (BIGINT đồng) có CHECK "<= 100.000.000.000" — cùng số với MAX_MONEY_VND (lib/money.ts).
//  (1) Liệt kê ĐỦ: lấy MỌI cột BIGINT của schema public từ information_schema, trừ danh sách cột không phải tiền viết
//      tay (chỉ stored_files.size_bytes). Cột tiền nào thiếu chốt (kể cả cột thêm sau này) → đỏ, in N/M.
//  (2) Từng chốt chặn THẬT, tách riêng: trong transaction huỷ ngay sau đó, bỏ tạm mọi CHECK KHÁC của bảng (để không chốt
//      nào khác che mất), chèn một dòng có cột đích = trần → không bị CHECK chặn; = trần + 1 → 23514 đúng tên chốt.
//  (3) Tổng hợp đồng: lớp kiểm dữ liệu chặn TỪNG số nhập (≤ trần) nhưng tổng nhiều dòng (2 × 60 tỷ = 120 tỷ) chỉ có
//      database chặn — máy chủ trả 400 (không 500), không ghi gì.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { MAX_MONEY_VND } from '../src/lib/money';
import { pgErrorCode } from '../src/http/middleware';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;
let app: App;

afterAll(async () => {
  await db.$disconnect();
});

beforeAll(() => {
  app = makeApp(deps);
});

const CAP = 100_000_000_000n;
// Cột BIGINT KHÔNG phải tiền. Thêm vào đây phải có lý do.
const NON_MONEY_BIGINT = new Set(['stored_files.size_bytes']);
const MIGRATION = new URL('../prisma/migrations/20261018250000_tran_so_tien/migration.sql', import.meta.url);

interface Col {
  table: string;
  column: string;
}

async function bigintColumns(): Promise<Col[]> {
  return db.$queryRaw<Col[]>`
    SELECT table_name AS "table", column_name AS "column" FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'bigint' AND table_name <> '_prisma_migrations'
    ORDER BY table_name, column_name`;
}

const capName = (c: Col) => `${c.table}_${c.column}_cap`;

class Rollback extends Error {}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
}

// Giá trị giả cho cột NOT NULL không có mặc định (khoá ngoại trỏ uuid ngẫu nhiên: chỉ bị kiểm CUỐI câu lệnh, sau CHECK).
function dummy(c: ColumnInfo): string {
  switch (c.data_type) {
    case 'uuid':
      return 'gen_random_uuid()';
    case 'text':
    case 'character varying':
      return `'x-${randomUUID().slice(0, 8)}'`;
    case 'bigint':
    case 'integer':
    case 'smallint':
    case 'numeric':
      return '0';
    case 'boolean':
      return 'false';
    case 'timestamp with time zone':
    case 'timestamp without time zone':
      return 'now()';
    case 'date':
      return 'current_date';
    case 'jsonb':
    case 'json':
      return `'{}'`;
    case 'ARRAY':
      return `'{}'`;
    case 'USER-DEFINED':
      return `(SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = '${c.udt_name}' ORDER BY e.enumsortorder LIMIT 1)::"${c.udt_name}"`;
    default:
      throw new Error(`Chưa có giá trị giả cho kiểu ${c.data_type} (cột ${c.column_name})`);
  }
}

// Chèn một dòng có cột đích = value, mọi CHECK khác của bảng đã bỏ tạm. Trả mã lỗi Postgres (null = chèn được) + lời.
async function tryInsert(col: Col, value: bigint): Promise<{ code: string | null; message: string }> {
  let result: { code: string | null; message: string } = { code: null, message: '' };
  await db
    .$transaction(async (tx) => {
      const others = await tx.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint WHERE contype = 'c' AND conrelid = ${col.table}::regclass AND conname <> ${capName(col)}`;
      for (const o of others) await tx.$executeRawUnsafe(`ALTER TABLE "${col.table}" DROP CONSTRAINT "${o.conname}"`);
      const cols = await tx.$queryRaw<ColumnInfo[]>`
        SELECT column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${col.table}`;
      const fill = cols.filter((c) => c.column_name !== col.column && c.is_nullable === 'NO' && c.column_default === null);
      const names = [...fill.map((c) => `"${c.column_name}"`), `"${col.column}"`].join(', ');
      const values = [...fill.map(dummy), `${value.toString()}::bigint`].join(', ');
      try {
        await tx.$executeRawUnsafe(`INSERT INTO "${col.table}" (${names}) VALUES (${values})`);
      } catch (err) {
        result = { code: pgErrorCode(err), message: String(err) };
      }
      throw new Rollback();
    })
    .catch((err: unknown) => {
      if (!(err instanceof Rollback)) throw err;
    });
  return result;
}

describe('trần số tiền ở database', () => {
  it('liệt kê đủ: MỌI cột tiền BIGINT có CHECK "<= 100 tỷ" đã VALIDATE, cùng số với MAX_MONEY_VND', async () => {
    expect(BigInt(MAX_MONEY_VND)).toBe(CAP);
    const all = await bigintColumns();
    const money = all.filter((c) => !NON_MONEY_BIGINT.has(`${c.table}.${c.column}`));
    const cons = await db.$queryRaw<{ name: string; def: string; validated: boolean }[]>`
      SELECT conname AS name, pg_get_constraintdef(oid) AS def, convalidated AS validated FROM pg_constraint
      WHERE contype = 'c' AND conname LIKE '%\_cap'`;
    const byName = new Map(cons.map((c) => [c.name, c]));
    const ok = money.filter((c) => {
      const k = byName.get(capName(c));
      return k?.validated === true && k.def === `CHECK ((${c.column} <= '100000000000'::bigint))`;
    });
    const missing = money.filter((c) => !ok.includes(c)).map((c) => `${c.table}.${c.column}`);
    console.log(`[trần tiền database] đã chặn ${ok.length}/${money.length} cột tiền (BIGINT tổng ${all.length}, không phải tiền: ${[...NON_MONEY_BIGINT].join(', ')})${missing.length ? `; THIẾU: ${missing.join(', ')}` : ''}`);
    expect(missing).toEqual([]);
    expect(money.length).toBe(22);
    // Migration ghi đúng trần của money.ts (đổi trần ở một nơi mà quên nơi kia → đỏ).
    const sql = readFileSync(MIGRATION, 'utf8');
    const caps = [...sql.matchAll(/ADD CONSTRAINT "([a-z_]+)" CHECK \("[a-z_]+" <= (\d+)\) NOT VALID;/g)];
    expect(caps).toHaveLength(22);
    expect(new Set(caps.map((m) => m[2]))).toEqual(new Set([String(MAX_MONEY_VND)]));
    expect([...sql.matchAll(/VALIDATE CONSTRAINT "([a-z_]+)";/g)].map((m) => m[1]).sort()).toEqual(caps.map((m) => m[1]).sort());
  });

  it('từng chốt chặn riêng: cột = trần → CHECK cho qua; = trần + 1 → 23514 đúng tên chốt (22/22)', async () => {
    const money = (await bigintColumns()).filter((c) => !NON_MONEY_BIGINT.has(`${c.table}.${c.column}`));
    let blocked = 0;
    let passedAtCap = 0;
    const bad: string[] = [];
    for (const col of money) {
      const atCap = await tryInsert(col, CAP);
      const over = await tryInsert(col, CAP + 1n);
      // Ở đúng trần: chèn được, hoặc chỉ vướng khoá ngoại / trùng khoá (dòng giả) — không bao giờ là CHECK hay thiếu cột.
      const capOk = atCap.code === null || atCap.code === '23503' || atCap.code === '23505';
      const overOk = over.code === '23514' && over.message.includes(capName(col));
      if (capOk) passedAtCap += 1;
      if (overOk) blocked += 1;
      if (!capOk || !overOk) bad.push(`${col.table}.${col.column}: trần → ${atCap.code ?? 'chèn được'}; trần+1 → ${over.code ?? 'chèn được'} ${over.message.slice(0, 160)}`);
    }
    console.log(`[trần tiền database] trần+1 bị chặn ${blocked}/${money.length}; đúng trần qua CHECK ${passedAtCap}/${money.length}${bad.length ? `\n  ${bad.join('\n  ')}` : ''}`);
    expect(bad).toEqual([]);
    expect(blocked).toBe(22);
  });

  it('hợp đồng: dòng 100.000.000.001 đ → 400; hai dòng 60 tỷ (tổng 120 tỷ) → database chặn, 400 (không 500); không ghi; đúng trần → 201', async () => {
    const owner: TestUser = await registerUser(app, 'tran-db');
    const orgId = await createOrg(app, owner, 'tran-db');
    const post = (lines: object[]) =>
      request(app)
        .post(`/api/v1/orgs/${orgId}/contracts`)
        .set(bearer(owner))
        .set('idempotency-key', `td-${randomUUID()}`)
        .send({ newCustomer: { fullName: 'Khách trần' }, lines });
    const line = (unitPrice: number) => ({ kind: 'CUSTOM', name: 'Gói', unitPrice, quantity: 1 });
    const over = await post([line(100_000_000_001)]);
    const sum = await post([line(60_000_000_000), line(60_000_000_000)]);
    console.log(`[trần tiền database] hợp đồng dòng 100.000.000.001 đ → ${over.status} ${over.body.error?.message}; hai dòng 60 tỷ → ${sum.status} ${sum.body.error?.message}`);
    expect([over.status, sum.status]).toEqual([400, 400]);
    expect(await db.contract.count({ where: { organizationId: orgId } })).toBe(0);
    expect((await post([line(100_000_000_000)])).status).toBe(201);
  });

  it('ghi thẳng database (lách máy chủ): phiếu thu 100.000.000.001 đ → bị chặn', async () => {
    const owner = await registerUser(app, 'tran-db-pt');
    const orgId = await createOrg(app, owner, 'tran-db-pt');
    const c = await request(app)
      .post(`/api/v1/orgs/${orgId}/contracts`)
      .set(bearer(owner))
      .set('idempotency-key', `td-${randomUUID()}`)
      .send({ newCustomer: { fullName: 'Khách' }, lines: [{ kind: 'CUSTOM', name: 'Gói', unitPrice: 1_000_000, quantity: 1 }] })
      .expect(201);
    const err = await db.payment
      .create({ data: { organizationId: orgId, contractId: c.body.id, code: 'PT-TRAN', kind: 'RECEIPT', method: 'CASH', amount: CAP + 1n, receivedAt: new Date(), createdById: owner.id } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientUnknownRequestError);
    expect(String(err)).toMatch(/payments_amount_cap/);
    expect(await db.payment.count({ where: { organizationId: orgId } })).toBe(0);
  });
});
