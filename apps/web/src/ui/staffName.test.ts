import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { staffShortName } from './staffName';

// Biên bản nghiệm thu lại M3: tên ngắn lấy tiếng cuối của TÊN HIỂN THỊ ("Linh Trần" → "Trần", "Hà Makeup" → "Makeup").
describe('staffShortName — một luật cho mọi chỗ', () => {
  it.each([
    // Studio đặt tên hiển thị khác họ tên → nguyên tên hiển thị.
    [{ displayName: 'Linh Trần', fullName: 'Trần Khánh Linh' }, 'Linh Trần'],
    [{ displayName: 'Hà Makeup', fullName: 'Nguyễn Thu Hà' }, 'Hà Makeup'],
    [{ displayName: 'Giang', fullName: 'Đỗ Hương Giang' }, 'Giang'],
    // Chưa đặt (tên hiển thị = họ tên) → tiếng cuối của họ tên.
    [{ displayName: 'Nguyễn Thu Hà', fullName: 'Nguyễn Thu Hà' }, 'Hà'],
    [{ displayName: '  Trần   Khánh Linh ', fullName: 'Trần Khánh Linh' }, 'Linh'],
    [{ displayName: 'Linh', fullName: 'Linh' }, 'Linh'],
    // Không biết họ tên → không đoán, nguyên tên hiển thị.
    [{ displayName: 'Trần Minh Anh' }, 'Trần Minh Anh'],
    [{ displayName: 'Linh Trần', fullName: null }, 'Linh Trần'],
  ])('%j → %s', (src, want) => {
    expect(staffShortName(src)).toBe(want);
  });
});

// Cửa gác: không còn hàm rút tên ngắn riêng nào trong các tệp đã chuyển sang hàm chung.
describe('không còn hàm rút tên ngắn riêng', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) files.push(p);
    }
  };
  walk(root);

  // Mở rộng từ contracts/** + lưới C điện thoại ra TOÀN BỘ src (lịch 1440 / cột thợ A từng tự lấy 2 tiếng cuối bằng
  // split(/\s+/).slice(-2) trong schedule/model.ts laneShortNames).
  it('toàn bộ src không tự cắt tên (split + pop / slice(-2) / words[length-1]) ngoài ui/staffName.ts', () => {
    const scoped = files.filter((f) => !/ui[\\/]staffName\.ts$/.test(f));
    const bad = scoped.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /export function (shortName|lastName)\b|function shortName\b|split\(\/\\s\+\/\)\.(pop|slice\(-)/.test(src);
    });
    expect(bad.map((f) => relative(root, f))).toEqual([]);
  });
});
