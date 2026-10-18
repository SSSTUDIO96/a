import type { z } from 'zod';

// SỬA MỘT PHẦN (PATCH): trường KHÔNG gửi phải giữ nguyên giá trị đang lưu.
// Bẫy của zod 4: trường có .default()/.prefault()/.catch() vẫn được ĐIỀN giá trị mặc định khi vắng mặt — kể cả khi
// nằm trong .partial() hay bọc .optional() bên ngoài. Thân đã điền mặc định đi thẳng vào câu update thì mọi trường
// không gửi bị đặt về mặc định (biên bản nghiệm thu máy chủ lát 2, lỗi S1: sửa giá gói xoá sạch giới hạn của gói).
//
// Hàm này trả về đường dẫn các trường sẽ bị ĐIỀN khi vắng mặt trong một thân yêu cầu. defineRoute gọi nó cho mọi
// đường PATCH và từ chối khởi động nếu danh sách khác rỗng. Mảng được coi là thay toàn bộ (phần tử bên trong
// được có mặc định — ví dụ "role mặc định PRIMARY" của từng thợ trong danh sách thợ gửi lên).
type Def = { type: string; innerType?: Def; in?: Def; shape?: Record<string, { _zod: { def: Def } }> } & Record<string, unknown>;

function defOf(schema: unknown): Def {
  return (schema as { _zod: { def: Def } })._zod.def;
}

// Trường này có bị điền giá trị khi vắng mặt không (bóc lớp optional/nullable/readonly/pipe để nhìn vào trong).
function fillsWhenMissing(def: Def): boolean {
  switch (def.type) {
    case 'default':
    case 'prefault':
    case 'catch':
      return true;
    case 'optional':
    case 'nullable':
    case 'readonly':
    case 'nonoptional':
      return def.innerType ? fillsWhenMissing(def.innerType) : false;
    case 'pipe':
      return def.in ? fillsWhenMissing(defOf(def.in)) : false;
    default:
      return false;
  }
}

// Bóc tới object bên trong (optional/nullable/pipe) — để duyệt cả object lồng (không duyệt vào mảng).
function objectShape(def: Def): Record<string, { _zod: { def: Def } }> | null {
  switch (def.type) {
    case 'object':
      return (def.shape as Record<string, { _zod: { def: Def } }>) ?? null;
    case 'optional':
    case 'nullable':
    case 'readonly':
      return def.innerType ? objectShape(defOf(def.innerType)) : null;
    case 'pipe':
      return def.in ? objectShape(defOf(def.in)) : null;
    default:
      return null;
  }
}

export function fieldsFilledWhenMissing(schema: z.ZodType | undefined): string[] {
  if (!schema) return [];
  const out: string[] = [];
  const walk = (def: Def, prefix: string) => {
    const shape = objectShape(def);
    if (!shape) return;
    for (const [k, v] of Object.entries(shape)) {
      const d = v._zod.def;
      if (fillsWhenMissing(d)) out.push(`${prefix}${k}`);
      else walk(d, `${prefix}${k}.`);
    }
  };
  walk(defOf(schema), '');
  return out;
}
