import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(WEB, 'scripts', 'check-bundle-secrets.mjs');
const temps: string[] = [];

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'cua-gac-'));
  temps.push(d);
  return d;
}

// Môi trường sạch: chỉ PATH, để bài thử không phụ thuộc biến đang có trên máy.
function runGate(dir: string, env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', dir], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe('cửa gác bí mật — vế BẮT', () => {
  const cases: [string, string][] = [
    ['tên biến JWT_ACCESS_SECRET', 'const a="JWT_ACCESS_SECRET";'],
    ['tên biến DATABASE_URL', 'x.DATABASE_URL'],
    ['tên biến DIRECT_URL', 'x.DIRECT_URL'],
    ['chuỗi postgresql://', 'fetch("postgresql://u:p@h:5432/db")'],
    ['biến VITE_* ngoài danh sách cho phép', 'const k="VITE_STRIPE_SECRET";'],
  ];
  for (const [label, content] of cases) {
    it(`bắt ${label} → exit 1, in tên tệp`, () => {
      const dir = tempDir();
      mkdirSync(join(dir, 'assets'));
      writeFileSync(join(dir, 'index.html'), '<html></html>');
      writeFileSync(join(dir, 'assets', 'index-abc.js'), `console.log(1);${content}`);
      const r = runGate(dir);
      expect(r.code).toBe(1);
      expect(r.out).toContain('index-abc.js');
      expect(r.out).toMatch(/[1-9]\d* vi phạm \/ 2 tệp/);
    });
  }

  it('bắt GIÁ TRỊ bí mật đang có trong môi trường build, không in giá trị ra log', () => {
    const dir = tempDir();
    const secret = 'gia-tri-bi-mat-0123456789-abcdefghij';
    writeFileSync(join(dir, 'a.js'), `var s="${secret}";`);
    const r = runGate(dir, { JWT_ACCESS_SECRET: secret });
    expect(r.code).toBe(1);
    expect(r.out).toContain('GIÁ TRỊ của biến JWT_ACCESS_SECRET');
    expect(r.out).not.toContain(secret);
  });

  it('thư mục rỗng hoặc không có → exit 1 (không quét được thì không cho qua)', () => {
    expect(runGate(tempDir()).code).toBe(1);
    expect(runGate(join(tempDir(), 'khong-co')).code).toBe(1);
  });
});

describe('cửa gác bí mật — vế GIỮ', () => {
  it('bản build thật của web sạch → exit 0, in "0 vi phạm / N tệp"', async () => {
    const outDir = tempDir();
    await build({ root: WEB, configFile: join(WEB, 'vite.config.ts'), logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const r = runGate(outDir);
    expect(r.out).toMatch(/0 vi phạm \/ [1-9]\d* tệp/);
    expect(r.code).toBe(0);
  });
});
