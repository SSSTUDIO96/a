// TRẦN TIỀN MỘT NGUỒN (phiếu vướng của thợ web T): MAX_MONEY_VND nằm ở @makeup/shared; apps/api/src/lib/money.ts chỉ
// NHẬP LẠI. Ba khẳng định, không cần database:
//  (1) lib/money.ts xuất đúng hằng của shared (cùng giá trị) và tệp nguồn của nó nhập từ '@makeup/shared', không tự viết số.
//  (2) Không tệp nào trong apps/api/src chép lại số trần (100_000_000_000 / 100000000000 / 1e11) — mọi cửa dùng hằng.
//  (3) Migration 20261018250000_tran_so_tien ghi số trong CHECK khớp hằng shared (cùng regex với bài D2 ở
//      tran-tien-database.test.ts — bài đó so với lib/money; bài này so thẳng với shared). Đổi trần ở shared mà quên
//      viết migration mới → đỏ ở đây.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_MONEY_VND as SHARED_CAP } from '@makeup/shared';
import { MAX_MONEY_VND as API_CAP, MONEY_TOO_LARGE_MESSAGE } from '../src/lib/money';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const MONEY_TS = fileURLToPath(new URL('../src/lib/money.ts', import.meta.url));
const MIGRATION = new URL('../prisma/migrations/20261018250000_tran_so_tien/migration.sql', import.meta.url);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('trần tiền một nguồn (@makeup/shared)', () => {
  it('lib/money.ts nhập lại hằng của shared, không tự viết số', () => {
    expect(SHARED_CAP).toBe(100_000_000_000);
    expect(API_CAP).toBe(SHARED_CAP);
    expect(MONEY_TOO_LARGE_MESSAGE).toBe(`Số tiền quá lớn (tối đa ${SHARED_CAP.toLocaleString('vi-VN')} đ)`);
    const src = readFileSync(MONEY_TS, 'utf8');
    expect(src).toMatch(/import \{[^}]*\bMAX_MONEY_VND\b[^}]*\} from '@makeup\/shared'/);
    expect(src).not.toMatch(/MAX_MONEY_VND\s*(:[^=]+)?=\s*\d/);
  });

  it('không tệp nào trong apps/api/src chép lại số trần', () => {
    const literal = /\b100_000_000_000\b|\b100000000000\b|\b1e11\b/;
    const files = walk(SRC);
    const hits = files.filter((f) => literal.test(readFileSync(f, 'utf8'))).map((f) => f.slice(SRC.length + 1));
    console.log(`[trần tiền một nguồn] quét ${files.length} tệp apps/api/src; chép số trần: ${hits.length ? hits.join(', ') : 'không có'}`);
    expect(hits).toEqual([]);
  });

  it('migration 20261018250000 ghi số trong CHECK khớp hằng shared (22/22 chốt)', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const caps = [...sql.matchAll(/ADD CONSTRAINT "([a-z_]+)" CHECK \("[a-z_]+" <= (\d+)\) NOT VALID;/g)];
    const matching = caps.filter((m) => m[2] === String(SHARED_CAP));
    console.log(`[trần tiền một nguồn] migration: ${matching.length}/${caps.length} chốt ghi đúng ${SHARED_CAP}`);
    expect(caps).toHaveLength(22);
    expect(matching).toHaveLength(caps.length);
  });
});
