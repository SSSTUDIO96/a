// Khuôn zod của module mẫu in hợp đồng (bản vẽ G mục 3.3). KHÔNG dùng .default() ở bất kỳ đâu (thân PATCH có .default()
// thì defineRoute từ chối khởi động — http/route.ts; thân POST cũng không cần: trường vắng mặt = theo mặc định của bố cục).
// Danh mục khối / bố cục / biến lấy từ packages/shared/src/print.ts — không chép danh sách sang đây.
import { z } from 'zod';
import { PRINT_LAYOUTS, TOGGLE_BLOCK_KEYS, type ToggleBlockKey } from '@makeup/shared';

export const PRINT_KINDS = ['SERVICE', 'COURSE'] as const;
export type PrintKind = (typeof PRINT_KINDS)[number];

export function strict<S extends z.ZodRawShape>(shape: S) {
  return z.strictObject(shape, {
    error: (iss) => (iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')}` : undefined),
  });
}

export const BLOCK_KEY_MESSAGE = 'Không có khối này (hoặc khối luôn có, không tắt được)';

const Kind = z.enum(PRINT_KINDS);
const Kinds = z
  .array(Kind)
  .min(1, 'Chọn ít nhất một loại hợp đồng')
  .max(2)
  .refine((a) => new Set(a).size === a.length, 'Loại hợp đồng bị trùng');
const DefaultFor = z
  .array(Kind)
  .max(2)
  .refine((a) => new Set(a).size === a.length, 'Loại hợp đồng bị trùng');

// zod 4: z.record(z.enum(...)) là VÉT CẠN (bắt đủ mọi khoá) — dùng z.partialRecord. Khoá lạ (kể cả 4 khối luôn có) zod 4.x
// báo mã 'unrecognized_keys' (đo thật: bản vẽ ghi 'invalid_key' — giữ cả hai để lời tiếng Việt luôn hiện).
export const Blocks = z.partialRecord(z.enum(TOGGLE_BLOCK_KEYS as [ToggleBlockKey, ...ToggleBlockKey[]]), z.boolean(), {
  // Kiểu của zod chỉ khai 'invalid_key' cho bản ghi; lúc chạy khoá lạ ra 'unrecognized_keys' — so trên chuỗi.
  error: (iss) => (['invalid_key', 'unrecognized_keys'].includes(iss.code as string) ? BLOCK_KEY_MESSAGE : undefined),
});
const Layout = z
  .number()
  .int()
  .refine((n) => (PRINT_LAYOUTS as readonly number[]).includes(n), `Bố cục chỉ nhận ${PRINT_LAYOUTS.join(', ')}`);
const Name = z.string().trim().min(1, 'Tên mẫu không được để trống').max(120, 'Tên mẫu tối đa 120 ký tự');
const Title = z.string().trim().min(1, 'Tiêu đề không được để trống (gửi null để dùng tiêu đề mặc định)').max(160, 'Tiêu đề tối đa 160 ký tự').nullable();
const Para = z.string().trim().min(1, 'Chữ không được để trống (gửi null để dùng chữ mặc định)').max(2000, 'Tối đa 2000 ký tự').nullable();

export const TemplateCreate = strict({
  name: Name,
  layout: Layout,
  appliesTo: Kinds,
  blocks: Blocks.optional(),
  title: Title.optional(),
  openingText: Para.optional(),
  closingText: Para.optional(),
  defaultFor: DefaultFor.optional(),
});
export type TemplateCreateInput = z.infer<typeof TemplateCreate>;

export const TemplatePatch = strict({
  name: Name.optional(),
  layout: Layout.optional(),
  appliesTo: Kinds.optional(),
  // Gửi blocks = THAY toàn bộ bảng công tắc (không trộn với bảng đang lưu).
  blocks: Blocks.optional(),
  title: Title.optional(),
  openingText: Para.optional(),
  closingText: Para.optional(),
  defaultFor: DefaultFor.optional(),
  isActive: z.boolean().optional(),
}).refine((b) => Object.values(b).some((v) => v !== undefined), 'Không có gì để sửa');
export type TemplatePatchInput = z.infer<typeof TemplatePatch>;

export const TemplateListQuery = z.object({
  appliesTo: Kind.optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export const OrgParams = z.object({ orgId: z.uuid() });
export const TemplateParams = OrgParams.extend({ templateId: z.uuid() });

// ---------- Ghi nhật ký in (đường 7 — gói G-M4 dùng; khai ở đây vì schemas.ts thuộc gói G-M3) ----------
const Hash = z.string().regex(/^[0-9a-f]{64}$/, 'Mã băm dữ liệu in không hợp lệ');
export const PrintCreate = z.discriminatedUnion('source', [
  strict({
    source: z.literal('TEMPLATE'),
    templateId: z.uuid(),
    expectedTemplateVersion: z.number().int().min(1),
    blockOverrides: Blocks.optional(),
    expectedDataHash: Hash,
  }),
  strict({ source: z.literal('PRIOR_CONFIG'), basedOnPrintId: z.uuid(), blockOverrides: Blocks.optional(), expectedDataHash: Hash }),
  // In lại y hệt: KHÔNG nhận blockOverrides.
  strict({ source: z.literal('REPRINT'), basedOnPrintId: z.uuid(), expectedDataHash: Hash }),
]);
export type PrintCreateInput = z.infer<typeof PrintCreate>;
