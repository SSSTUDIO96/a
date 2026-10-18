// Nghiệm thu web 1, N9: chạy e2e không được ghi đè ảnh tài liệu đang được git theo dõi (e2e/anh/).
// Mọi ảnh e2e chụp phải đi qua SHOTS (e2e/anh.ts), mặc định ra thư mục đã có trong .gitignore.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const E2E = join(WEB, 'e2e');

function ignoredPatterns(): string[] {
  return readFileSync(join(WEB, '.gitignore'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

describe('ảnh e2e không ghi đè ảnh tài liệu', () => {
  it('thư mục ảnh mặc định (không đặt E2E_ANH_DIR) khác e2e/anh và nằm trong .gitignore', async () => {
    vi.stubEnv('E2E_ANH_DIR', undefined);
    vi.resetModules();
    try {
      const { SHOTS } = await import('../e2e/anh');
      expect(SHOTS).not.toMatch(/^(\.\/)?e2e\/anh\/?$/);
      const dir = `${String(SHOTS).replace(/^\.\//, '').replace(/\/$/, '')}/`;
      expect(ignoredPatterns()).toContain(dir);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('mọi lệnh chụp ảnh trong e2e/*.spec.ts ghi vào SHOTS, không ghi thẳng vào e2e/anh', () => {
    const specs = readdirSync(E2E).filter((f) => f.endsWith('.spec.ts'));
    expect(specs.length).toBeGreaterThan(0);
    let shots = 0;
    for (const f of specs) {
      const src = readFileSync(join(E2E, f), 'utf8');
      expect(src, f).not.toMatch(/['"`](\.\/)?e2e\/anh['"`/]/);
      expect(src, f).not.toMatch(/const SHOTS\s*=/);
      for (const m of src.matchAll(/screenshot\(\s*\{\s*path:\s*(`[^`]*`|[^,}]+)/g)) {
        shots += 1;
        expect(m[1], `${f}: ${m[0]}`).toMatch(/^`\$\{SHOTS\}\//);
      }
      if (/screenshot\(/.test(src)) expect(src, f).toMatch(/import \{ SHOTS \} from '\.\/anh'/);
    }
    expect(shots).toBeGreaterThan(0);
  });
});
