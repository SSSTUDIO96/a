import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { avatarColorIndex } from './avatarColor';
import { AVATAR_TONES, staffAvatarColorKeys, staffNaming, staffShortName, staffShortNames, type StaffRosterEntry } from './staffName';

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

// ---------------------------------------------------------------------------------------------------------------------
// R2 (biên bản lần 3): xử lý trùng tên ngắn trên SỔ THỢ — một hàm cho Lịch và Hợp đồng.
const P = (membershipId: string, displayName: string, fullName: string | null = displayName, initials?: string): StaffRosterEntry => ({
  membershipId,
  displayName,
  fullName,
  ...(initials ? { initials } : {}),
});
const PHAM_HA = P('m-pha', 'Phạm Thu Hà');
const NGUYEN_HA = P('m-ngha', 'Nguyễn Thu Hà');

describe('R2: staffShortNames — hai người trùng tên ngắn giữ tên đầy đủ', () => {
  it('BẮT: "Phạm Thu Hà" + "Nguyễn Thu Hà" (chưa đặt tên hiển thị) → hai tên đầy đủ; người khác giữ tên ngắn', () => {
    const m = staffShortNames([PHAM_HA, NGUYEN_HA, P('m-linh', 'Linh Trần', 'Trần Khánh Linh'), P('m-vy', 'Phạm Bảo Vy')]);
    expect([...m.entries()]).toEqual([
      ['m-pha', 'Phạm Thu Hà'],
      ['m-ngha', 'Nguyễn Thu Hà'],
      ['m-linh', 'Linh Trần'],
      ['m-vy', 'Vy'],
    ]);
  });

  it('GIỮ: chỉ một "Hà" trong sổ → "Hà"', () => {
    expect(staffShortNames([PHAM_HA, P('m-vy', 'Phạm Bảo Vy')]).get('m-pha')).toBe('Hà');
  });

  it('BẮT: cùng một người đến từ hai nguồn (danh sách thợ + ca) không tính là trùng → vẫn "Hà"', () => {
    expect(staffShortNames([PHAM_HA, { ...PHAM_HA }, P('m-vy', 'Phạm Bảo Vy')]).get('m-pha')).toBe('Hà');
  });

  it('BẮT: nguồn đầu thiếu họ tên, nguồn sau có → gộp lấy họ tên (rút được "Hà", không giữ nguyên "Phạm Thu Hà")', () => {
    expect(staffShortNames([{ membershipId: 'm-pha', displayName: 'Phạm Thu Hà' }, PHAM_HA]).get('m-pha')).toBe('Hà');
  });

  it('GIỮ: tên hiển thị "Hà" (studio đặt) đụng "Nguyễn Thu Hà" (chưa đặt) → mỗi người ghi tên hiển thị của mình', () => {
    const m = staffShortNames([P('m-a', 'Hà', 'Lê Thị Hà'), NGUYEN_HA]);
    expect([m.get('m-a'), m.get('m-ngha')]).toEqual(['Hà', 'Nguyễn Thu Hà']);
  });

  it('staffNaming: người ngoài sổ → staffShortName của chính họ; khoá màu = mã thành viên', () => {
    const n = staffNaming([PHAM_HA]);
    expect(n.shortName({ membershipId: 'x', displayName: 'Đỗ Hương Giang', fullName: 'Đỗ Hương Giang' })).toBe('Giang');
    expect(n.colorKey('x')).toBe('x');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// R4: hai người cùng chữ tắt trong cùng tổ chức → khác màu.
// Tìm mã thành viên có màu gốc (băm) trùng với `seed` — dựng đúng ca xấu "LT nâu + LT nâu" của biên bản.
function sameBase(seed: string, n: number, prefix = 'm-'): string[] {
  const want = avatarColorIndex(seed);
  const out: string[] = [];
  for (let i = 0; out.length < n; i += 1) if (`${prefix}${i}` !== seed && avatarColorIndex(`${prefix}${i}`) === want) out.push(`${prefix}${i}`);
  return out;
}
const tone = (m: Map<string, string>, id: string) => avatarColorIndex(m.get(id) ?? '');

describe('R4: staffAvatarColorKeys — cùng chữ tắt thì khác màu', () => {
  const [tuId] = sameBase('m7', 1);
  const LINH = P('m7', 'Linh Trần', 'Trần Khánh Linh', 'LT');
  const TU = P(tuId ?? '', 'Lê Minh Tú', 'Lê Minh Tú', 'LT');

  it('dựng đúng ca xấu: hai mã có cùng màu băm', () => {
    expect(avatarColorIndex(LINH.membershipId)).toBe(avatarColorIndex(TU.membershipId));
  });

  it('BẮT: "Linh Trần" và "Lê Minh Tú" (cùng LT, cùng màu băm) → hai màu khác nhau', () => {
    const m = staffAvatarColorKeys([LINH, TU]);
    expect(tone(m, 'm7')).not.toBe(tone(m, TU.membershipId));
  });

  it('BẮT: không có chữ tắt máy chủ → dùng initialsOf(tên hiển thị) như Avatar vẽ ("Linh Trần" = "Lê Minh Tú" = LT)', () => {
    const m = staffAvatarColorKeys([P('m7', 'Linh Trần'), P(TU.membershipId, 'Lê Minh Tú')]);
    expect(tone(m, 'm7')).not.toBe(tone(m, TU.membershipId));
  });

  it('BẮT: 6 người cùng chữ tắt → 6 màu khác nhau', () => {
    const ids = ['m7', ...sameBase('m7', 5)];
    const m = staffAvatarColorKeys(ids.map((id) => P(id, 'Lê Tú', 'Lê Tú', 'LT')));
    expect(new Set(ids.map((id) => tone(m, id))).size).toBe(AVATAR_TONES);
  });

  it('GIỮ: ai không đụng chữ tắt giữ màu băm cũ; người cùng màu băm nhưng KHÁC chữ tắt không bị đổi', () => {
    const [other] = sameBase('m7', 1, 'k-');
    const m = staffAvatarColorKeys([LINH, P(other ?? '', 'Phạm Bảo Vy', 'Phạm Bảo Vy', 'PV'), P('m-vy', 'Vũ Hồng', 'Vũ Hồng', 'VH')]);
    expect(tone(m, 'm7')).toBe(avatarColorIndex('m7'));
    expect(tone(m, other ?? '')).toBe(avatarColorIndex(other ?? ''));
    expect(tone(m, 'm-vy')).toBe(avatarColorIndex('m-vy'));
  });

  it('BẮT: không phụ thuộc thứ tự nguồn (Lịch và Hợp đồng gom sổ theo thứ tự khác nhau vẫn ra cùng màu)', () => {
    const a = staffAvatarColorKeys([LINH, TU, PHAM_HA]);
    const b = staffAvatarColorKeys([PHAM_HA, TU, LINH]);
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
  });

  it('khoá màu luôn rơi đúng một trong 6 màu --av-0…5 và mọi màu đều có khoá', () => {
    const ids = ['m7', ...sameBase('m7', 5)];
    const m = staffAvatarColorKeys(ids.map((id) => P(id, 'Lê Tú', 'Lê Tú', 'LT')));
    expect([...m.values()].map((k) => avatarColorIndex(k)).sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

// Cửa gác R4: mọi ảnh đại diện thợ ở Lịch và Hợp đồng lấy màu qua sổ thợ (StaffNaming.colorKey), không băm thẳng mã.
describe('R4: mọi chỗ tô màu ảnh thợ ở Lịch + Hợp đồng dùng cùng hàm', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const scoped: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(n) && !/\.test\./.test(n) && !/__in-thu__|__xem-thu__/.test(p)) scoped.push(p);
    }
  };
  walk(join(root, 'features', 'schedule'));
  walk(join(root, 'features', 'contracts'));

  it('không còn colorKey={…membershipId} băm thẳng, không còn AvatarStack (màu băm riêng) trong schedule/** và contracts/**', () => {
    const spots: string[] = [];
    const bad: string[] = [];
    for (const f of scoped) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<Avatar\b[\s\S]*?\/>/g)) {
        const tag = m[0];
        // Ảnh khách hàng (nếu có) không thuộc luật này — ở đây chỉ có ảnh thợ.
        spots.push(relative(root, f));
        if (!/colorKey=\{(naming\.colorKey\(|props\.naming\.colorKey\(|colorKey\})/.test(tag)) bad.push(`${relative(root, f)}: ${tag.replace(/\s+/g, ' ').slice(0, 120)}`);
      }
      if (/\bAvatarStack\b/.test(src.replace(/\/\/.*$/gm, ''))) bad.push(`${relative(root, f)}: AvatarStack`);
    }
    console.log(`R4 ảnh thợ ở Lịch + Hợp đồng qua sổ thợ: ${spots.length - bad.length}/${spots.length}`);
    expect(spots.length).toBeGreaterThanOrEqual(4);
    expect(bad).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Cửa gác L2/L3 + việc tồn 48 (biên bản nghiệm thu lần 4): MỌI chỗ vẽ ảnh đại diện thợ trên web — không riêng Lịch và
// Hợp đồng — lấy màu qua sổ thợ chung (StaffNaming.colorKey của staffNaming) và chữ tắt từ TÊN.
// Khác cửa gác R4 ở trên:
//   - quét cả web (trừ ui/ — nơi định nghĩa Avatar/PersonChip — bài thử, trang xem thử);
//   - soi MỌI thuộc tính colorKey={…} ở mọi thẻ, không chỉ thẻ <Avatar>: màu đi qua thuộc tính trung gian (ô chọn thợ:
//     <PickerRow colorKey={…}>) cũng phải từ sổ thợ — đột biến D8 lọt vì bài cũ chỉ đọc thẻ <Avatar>;
//   - <Avatar>/<PersonChip> của thợ phải có colorKey (thiếu = băm theo tên, khác Lịch); <AvatarStack> (băm thẳng mã) cấm;
//   - name ghép thêm chữ (chuỗi mẫu `…`) thì phải truyền initials rút từ tên (staffInitials/initialsOf) — lỗi L3 "PC"/"NP".
describe('L2/L3 (lần 4): MỌI ảnh thợ trên web qua sổ thợ chung', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  // Ảnh KHÔNG phải thợ của tổ chức — ghi tường minh kèm lý do; chỗ mới phải tự khai ở đây.
  const NOT_STAFF: Record<string, string> = {
    'features/customers/CustomerInfoCard.tsx': 'ảnh khách hàng (màu theo mã khách)',
    'features/customers/CustomerRow.tsx': 'ảnh khách hàng (màu theo mã khách)',
    'features/platform/PlatformShell.tsx': 'quản trị viên nền tảng — không thuộc tổ chức nào, không có sổ thợ',
  };
  // Các chỗ biên bản lần 4 kê (L2/L3, việc tồn 48) — phải còn được quét (đổi tên tệp thì sửa danh sách này).
  const MUST = [
    'features/staff/StaffRow.tsx',
    'features/staff/StaffProfileDialog.tsx',
    'features/staff/PayRateRow.tsx',
    'features/courses/ClassCard.tsx',
    'features/courses/ScheduleRows.tsx',
    'features/pricing/groups/PayRatesGroup.tsx',
    'layout/Sidebar.tsx',
    'layout/BottomNav.tsx',
    'features/contracts/StaffRow.tsx',
    'features/contracts/StaffPicker.tsx',
    'features/schedule/parts.tsx',
  ];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(n) && !/\.test\./.test(n) && !/__in-thu__|__xem-thu__/.test(p)) files.push(p);
    }
  };
  for (const n of readdirSync(root)) if (n !== 'ui' && statSync(join(root, n)).isDirectory()) walk(join(root, n));
  const NAMING = /^(?:[\w$]+\.)*naming\.colorKey\(/;

  it('mọi colorKey + mọi <Avatar>/<PersonChip> của thợ đi qua naming.colorKey; không AvatarStack; chữ tắt rút từ tên', () => {
    const spots: string[] = [];
    const bad: string[] = [];
    const seen = new Set<string>();
    for (const f of files) {
      const rel = relative(root, f).split('\\').join('/');
      const src = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
      const staff = !(rel in NOT_STAFF);
      // 1. Mọi thuộc tính colorKey={…} ở mọi thẻ (kể cả thẻ trung gian như <PickerRow>).
      for (const m of src.matchAll(/\bcolorKey=\{([^}]*)\}/g)) {
        if (!staff) continue;
        const expr = (m[1] ?? '').trim();
        spots.push(`${rel}: colorKey={${expr}}`);
        seen.add(rel);
        if (!NAMING.test(expr) && expr !== 'colorKey') bad.push(`${rel}: colorKey={${expr}} không qua naming.colorKey`);
      }
      // 2. Thẻ ảnh của thợ.
      for (const m of src.matchAll(/<(Avatar|PersonChip|AvatarStack)\b([\s\S]*?)\/>/g)) {
        if (!staff) continue;
        const [whole, tag, attrs = ''] = m;
        seen.add(rel);
        const short = whole.replace(/\s+/g, ' ').slice(0, 140);
        if (tag === 'AvatarStack') {
          spots.push(`${rel}: <AvatarStack>`);
          bad.push(`${rel}: <AvatarStack> băm thẳng mã thành viên — dựng <Avatar colorKey={naming.colorKey(…)}>`);
          continue;
        }
        if (!/\bcolorKey=/.test(attrs)) {
          spots.push(`${rel}: ${short}`);
          bad.push(`${rel}: thiếu colorKey (màu băm theo tên, khác Lịch): ${short}`);
        }
        const name = /\bname=\{(`[^`]*`)\}/.exec(attrs)?.[1];
        if (name && !/\binitials=\{[^}]*(staffInitials|initialsOf)\(/.test(attrs)) {
          bad.push(`${rel}: name ghép chữ ${name} mà chữ tắt không rút từ tên (staffInitials/initialsOf): ${short}`);
        }
      }
    }
    const missing = MUST.filter((r) => !seen.has(r));
    console.log(`L2/L3 ảnh thợ qua sổ thợ chung: ${spots.length - bad.length}/${spots.length} chỗ · ${seen.size} tệp · bỏ qua (không phải thợ): ${Object.keys(NOT_STAFF).length}`);
    expect(missing, 'tệp phải được quét').toEqual([]);
    expect(spots.length).toBeGreaterThanOrEqual(14);
    expect(bad).toEqual([]);
  });

  it('danh sách "không phải thợ" chỉ gồm tệp còn tồn tại và thật sự có ảnh', () => {
    for (const rel of Object.keys(NOT_STAFF)) {
      const src = readFileSync(join(root, rel), 'utf8');
      expect(/<Avatar\b/.test(src), rel).toBe(true);
    }
  });
});
