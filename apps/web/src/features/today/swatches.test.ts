import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OCCASION_COLORS } from '@makeup/shared';
import { describe, expect, it } from 'vitest';

// Màu ca ở Hôm nay (today.css .td-sw-*) phải TRÙNG màu ở Lịch (schedule.css .ws-sw-*): một sự kiện không đổi màu giữa hai màn.
const here = dirname(fileURLToPath(import.meta.url));
const today = readFileSync(join(here, 'today.css'), 'utf8');
const schedule = readFileSync(join(here, '../schedule/schedule.css'), 'utf8');

function swatch(css: string, prefix: string, name: string): string | null {
  const m = new RegExp(`\\.${prefix}-sw-${name}\\s*\\{\\s*--c:\\s*([^;]+);`).exec(css);
  return m?.[1]?.trim() ?? null;
}

describe('màu sự kiện của Hôm nay trùng Lịch', () => {
  for (const color of [...OCCASION_COLORS, 'other']) {
    it(`màu "${color}"`, () => {
      const a = swatch(today, 'td', color);
      expect(a, `thiếu .td-sw-${color} trong today.css`).not.toBeNull();
      expect(a).toBe(swatch(schedule, 'ws', color));
    });
  }
});
