import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error — tệp .mjs không có khai báo kiểu; chỉ dùng hàm thuần.
import { checkPortalBundle } from './check-portal-bundle.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(WEB, 'scripts', 'check-portal-bundle.mjs');
const temps: string[] = [];

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'cong-hv-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function runGate(dist: string) {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', dist], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

type Chunk = { file: string; src?: string; name?: string; isEntry?: boolean; imports?: string[]; dynamicImports?: string[]; css?: string[] };

/** Bản build giả: manifest tự viết + tệp nội dung tuỳ ý. */
function fakeDist(manifest: Record<string, Chunk>, files: Record<string, string | Buffer>): string {
  const dist = tempDir();
  mkdirSync(join(dist, '.vite'), { recursive: true });
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(dist, '.vite', 'manifest.json'), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dist, name), content);
  return dist;
}

const CLEAN = 'export const a=1;console.log("trang hoc vien");';
const entry = (extra: Partial<Chunk> = {}): Chunk => ({ file: 'assets/hv-1.js', src: 'hv.html', isEntry: true, ...extra });

describe('check-portal-bundle (cửa gác cổng học viên)', () => {
  it('GIỮ: bản build giả sạch, nhỏ → không vi phạm', () => {
    const dist = fakeDist({ 'hv.html': entry() }, { 'assets/hv-1.js': CLEAN });
    const { problems, stats } = checkPortalBundle(dist);
    expect(problems).toEqual([]);
    expect(stats.jsFiles).toBe(1);
    expect(runGate(dist).code).toBe(0);
  });

  it('ĐỎ: tổng JS gzip > 90 KB (đếm cả tệp import tĩnh lẫn động)', () => {
    const big = randomBytes(60 * 1024).toString('base64'); // ~80 KB, gần như không nén được
    const dist = fakeDist(
      { 'hv.html': entry({ imports: ['_a.js'], dynamicImports: ['b.js'] }), '_a.js': { file: 'assets/a-1.js' }, 'b.js': { file: 'assets/b-1.js' } },
      { 'assets/hv-1.js': CLEAN, 'assets/a-1.js': big, 'assets/b-1.js': big },
    );
    const { problems } = checkPortalBundle(dist);
    expect(problems.join('\n')).toMatch(/nặng .* KB gzip, vượt ngân sách 90\.0 KB/);
    expect(runGate(dist).code).toBe(1);
  });

  it('GIỮ: tệp chỉ nằm ở trang vào khác (index.html) không bị tính vào cổng', () => {
    const big = randomBytes(120 * 1024).toString('base64');
    const dist = fakeDist(
      { 'hv.html': entry(), 'index.html': { file: 'assets/main-1.js', src: 'index.html', isEntry: true } },
      { 'assets/hv-1.js': CLEAN, 'assets/main-1.js': big + 'Authorization BYPASS' },
    );
    expect(checkPortalBundle(dist).problems).toEqual([]);
  });

  it('ĐỎ: CSS gzip > 15 KB', () => {
    const css = randomBytes(16 * 1024).toString('base64');
    const dist = fakeDist({ 'hv.html': entry({ css: ['assets/hv-1.css'] }) }, { 'assets/hv-1.js': CLEAN, 'assets/hv-1.css': css });
    expect(checkPortalBundle(dist).problems.join('\n')).toMatch(/CSS .* vượt ngân sách 15\.0 KB/);
  });

  for (const s of ['BYPASS', 'SUPER_ADMIN', 'accessToken=', 'Authorization']) {
    it(`ĐỎ: mã chứa chuỗi cấm ${s}`, () => {
      const dist = fakeDist({ 'hv.html': entry() }, { 'assets/hv-1.js': `${CLEAN};x="${s}x"` });
      expect(checkPortalBundle(dist).problems.join('\n')).toContain(`chuỗi cấm "${s}"`);
      expect(runGate(dist).code).toBe(1);
    });
  }

  for (const src of ['src/api/client.ts', 'src/app/routes.tsx', 'src/layout/AppShell.tsx', 'src/features/customers/index.tsx']) {
    it(`ĐỎ: khối kéo theo sinh từ ${src}`, () => {
      const dist = fakeDist(
        { 'hv.html': entry({ dynamicImports: [src] }), [src]: { file: 'assets/x-1.js', src } },
        { 'assets/hv-1.js': CLEAN, 'assets/x-1.js': CLEAN },
      );
      expect(checkPortalBundle(dist).problems.join('\n')).toContain(`sinh từ ${src}`);
    });
  }

  it('ĐỎ: thiếu manifest hoặc thiếu trang vào hv.html', () => {
    expect(checkPortalBundle(tempDir()).problems.join('\n')).toContain('Thiếu');
    const dist = fakeDist({ 'index.html': { file: 'assets/main-1.js', src: 'index.html', isEntry: true } }, { 'assets/main-1.js': CLEAN });
    expect(checkPortalBundle(dist).problems.join('\n')).toContain('không có trang vào hv.html');
  });

  it('ĐỎ (build thật, mini): hv.html nhập src/api/client.ts (có Authorization) và import động src/features/x', async () => {
    const root = tempDir();
    mkdirSync(join(root, 'src', 'api'), { recursive: true });
    mkdirSync(join(root, 'src', 'features', 'x'), { recursive: true });
    mkdirSync(join(root, 'src', 'portal'), { recursive: true });
    writeFileSync(join(root, 'hv.html'), '<!doctype html><div id="root"></div><script type="module" src="/src/portal/main.js"></script>');
    writeFileSync(join(root, 'src', 'api', 'client.ts'), 'export function call(token: string) { const headers: Record<string, string> = {}; headers.Authorization = `Bearer ${token}`; return headers; }');
    writeFileSync(join(root, 'src', 'features', 'x', 'index.js'), 'export default function X() { return document.title + "man hinh nhan vien"; }');
    writeFileSync(
      join(root, 'src', 'portal', 'main.js'),
      'import { call } from "../api/client.ts";\nconsole.log(call("t"));\nimport("../features/x/index.js").then((m) => console.log(m.default()));',
    );
    const outDir = join(root, 'dist');
    await build({ root, configFile: false, logLevel: 'silent', build: { outDir, emptyOutDir: true, manifest: true, rollupOptions: { input: { hv: join(root, 'hv.html') } } } });
    const { problems } = checkPortalBundle(outDir);
    const text = problems.join('\n');
    expect(text).toContain('chuỗi cấm "Authorization"');
    expect(text).toContain('sinh từ src/features/x/index.js');
    expect(runGate(outDir).code).toBe(1);
  });

  it('GIỮ (build thật): bản build thật của web (cả hai trang vào) → thoát mã 0, hv.html chỉ kéo React + trang tạm', async () => {
    const outDir = tempDir();
    // vitest đặt NODE_ENV=test nên vite dựng React bản dev (gấp đôi dung lượng); đặt production giống `pnpm build` thật.
    const old = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({ root: WEB, configFile: join(WEB, 'vite.config.ts'), logLevel: 'silent', mode: 'production', build: { outDir, emptyOutDir: true } });
    } finally {
      if (old === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = old;
    }
    const r = runGate(outDir);
    expect(r.out).toMatch(/hv\.html kéo [1-9]\d* tệp JS .* · 0 vi phạm/);
    expect(r.code).toBe(0);
  });
});
