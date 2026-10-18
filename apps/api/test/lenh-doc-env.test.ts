// Sổ lỗi mục 25: các lệnh chạy thử trên máy (dev, platform:*, db:sync-roles) từng KHÔNG đọc apps/api/.env
// (dự án không dùng dotenv; chỉ lệnh Prisma tự đọc .env) → làm theo tài liệu thì báo "Cấu hình môi trường không hợp lệ" /
// "Thiếu DATABASE_URL". Nay mọi lệnh tsx tự đọc .env bằng cờ --env-file-if-exists=.env của Node 22.
// Bài này chặn: (1) thêm lệnh tsx mới mà quên cờ; (2) cờ lọt vào lệnh bản thật (start, :prod lấy biến từ nền tảng);
// (3) hành vi Node mà tài liệu dựa vào: biến đặt sẵn thắng .env, thiếu tệp vẫn báo lỗi cấu hình rõ, không im lặng.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts: Record<string, string> = JSON.parse(readFileSync(path.join(API_DIR, 'package.json'), 'utf8')).scripts;
const TSX = path.join(API_DIR, 'node_modules', '.bin', 'tsx');
const FLAG = '--env-file-if-exists=.env';

describe('lệnh trong apps/api/package.json', () => {
  it('mọi lệnh chạy mã nguồn bằng tsx đều tự đọc .env', () => {
    const tsxScripts = Object.entries(scripts).filter(([, cmd]) => /(^|\s|&&\s*)tsx(\s|$)/.test(cmd));
    expect(tsxScripts.map(([name]) => name).sort()).toEqual(['db:sync-roles', 'dev', 'platform:grant-admin', 'platform:seed-plans']);
    for (const [name, cmd] of tsxScripts) expect(cmd, name).toContain(FLAG);
  });

  it('lệnh bản thật (start, :prod) KHÔNG đọc .env — biến lấy từ môi trường nền tảng', () => {
    const prod = Object.entries(scripts).filter(([name]) => name === 'start' || name.endsWith(':prod'));
    expect(prod.length).toBe(4);
    for (const [name, cmd] of prod) expect(cmd, name).not.toContain('--env-file');
  });
});

describe('hành vi --env-file-if-exists qua tsx (Node 22)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'makeup-env-file-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  // Môi trường tối thiểu: không mang DATABASE_URL… của vitest sang tiến trình con.
  const bare = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };
  const run = (cwd: string, file: string, env: Record<string, string> = {}) => {
    try {
      return { code: 0, out: execFileSync(TSX, [FLAG, file], { cwd, env: { ...bare, ...env }, encoding: 'utf8', stdio: 'pipe' }) };
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string };
      return { code: err.status, out: `${err.stdout}${err.stderr}` };
    }
  };

  it('đọc .env; biến đã đặt sẵn trong môi trường (kể cả để trống) thắng .env', () => {
    const d = path.join(dir, 'co-env');
    mkdirSync(d);
    writeFileSync(path.join(d, '.env'), 'A=tu_tep\nB=tu_tep\nC=tu_tep\n');
    writeFileSync(path.join(d, 'in.ts'), 'console.log(JSON.stringify({ A: process.env.A, B: process.env.B, C: process.env.C }));');
    const r = run(d, 'in.ts', { B: 'tu_moi_truong', C: '' });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out.trim().split('\n').pop()!)).toEqual({ A: 'tu_tep', B: 'tu_moi_truong', C: '' });
  });

  it('không có .env và không có biến → vẫn báo "Cấu hình môi trường không hợp lệ", mã thoát khác 0', () => {
    const d = path.join(dir, 'khong-env');
    mkdirSync(d);
    writeFileSync(path.join(d, 'nap.ts'), `import { loadEnv } from ${JSON.stringify(path.join(API_DIR, 'src', 'env.ts'))};\nloadEnv();`);
    const r = run(d, 'nap.ts');
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('.env not found. Continuing without it.');
    expect(r.out).toContain('Cấu hình môi trường không hợp lệ');
    expect(r.out).toContain('DATABASE_URL');
  });
});
