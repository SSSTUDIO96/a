// Khuôn thân/tham số của module mẫu thiết kế và thẻ (BAN-VE-C3-DAO-TAO mục 1.3 "Mẫu thiết kế và thẻ").
// PATCH không có .default() (sổ lỗi: zod điền mặc định cho trường vắng mặt → ghi đè trường không gửi).
import { z } from 'zod';
import { CONTRACT_KIND_KEYS, DESIGN_SIZES, FONT_OVERRIDES, MAX_DESIGN_PHOTOS } from '@makeup/shared';

export const DESIGN_CARD_KINDS = ['WELCOME', 'FEEDBACK', 'GREETING'] as const;

export const OrgParams = z.object({ orgId: z.uuid() });
export const CardParams = OrgParams.extend({ cardId: z.uuid() });
export const PhraseParams = OrgParams.extend({ phraseId: z.uuid() });
export const ContractParams = OrgParams.extend({ contractId: z.uuid() });

const DateTime = z.iso.datetime({ offset: true, error: 'Thời gian phải theo dạng ISO 8601, ví dụ 2026-11-01T08:00:00+07:00' });
const DateOnly = z.iso.date({ error: 'Ngày phải theo dạng YYYY-MM-DD' });
const ContractKind = z.enum(CONTRACT_KIND_KEYS);
const CardKind = z.enum(DESIGN_CARD_KINDS);

// ---------- Danh mục mẫu ----------
export const TemplateQuery = z.object({
  kind: CardKind.optional(),
  contractKind: ContractKind.optional(),
});

// ---------- Giá trị ô từ dữ liệu ----------
export const DesignDataQuery = z.object({
  // Hợp đồng khoá học có nhiều dòng lớp: chọn lớp nào. Bỏ trống = lớp của dòng khoá học đầu tiên.
  courseClassId: z.uuid().optional(),
});

// ---------- Câu chúc soạn sẵn ----------
const PhraseName = z.string().trim().min(1, 'Tên câu chúc không được để trống').max(80);
const PhraseTitle = z.string().trim().min(1, 'Tiêu đề không được để trống').max(120, 'Tiêu đề tối đa 120 ký tự');
const PhraseBody = z.string().trim().min(1, 'Câu chúc không được để trống').max(1000, 'Câu chúc tối đa 1000 ký tự');
// Rỗng = dùng cho cả hai loại hợp đồng.
const AppliesTo = z
  .array(ContractKind)
  .max(2)
  .refine((a) => new Set(a).size === a.length, 'Loại hợp đồng bị trùng');
const SortOrder = z.number().int().min(0).max(10_000);

export const PhraseQuery = z.object({
  contractKind: ContractKind.optional(),
  // Mặc định chỉ trả câu đang dùng; màn quản lý gửi includeInactive=true để thấy cả câu đã ẩn.
  includeInactive: z.enum(['true', 'false']).optional(),
});

export const PhraseCreateBody = z.strictObject({
  name: PhraseName,
  appliesTo: AppliesTo,
  title: PhraseTitle,
  body: PhraseBody,
  sortOrder: SortOrder.optional(),
  isActive: z.boolean().optional(),
});

export const PhrasePatchBody = z
  .strictObject({
    name: PhraseName.optional(),
    appliesTo: AppliesTo.optional(),
    title: PhraseTitle.optional(),
    body: PhraseBody.optional(),
    sortOrder: SortOrder.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Không có gì để sửa');

// ---------- Thẻ ----------
const TemplateCode = z.string().trim().min(1, 'Chưa chọn mẫu').max(40);
const CardTitle = z.string().trim().max(120, 'Tiêu đề tối đa 120 ký tự');
const CardBody = z.string().trim().max(2000, 'Nội dung tối đa 2000 ký tự');
const Rating = z.number().int().min(1, 'Số sao từ 1 đến 5').max(5, 'Số sao từ 1 đến 5');
const PhotoFileIds = z.array(z.uuid()).max(MAX_DESIGN_PHOTOS, `Tối đa ${MAX_DESIGN_PHOTOS} ảnh mỗi thẻ`);
// Ghi đè giá trị ô chữ (người dùng sửa chữ trước khi xuất ảnh). Khoá phải là ô CHỮ lấy từ dữ liệu của mẫu đã chọn —
// máy chủ kiểm (data.ts). Ô ảnh và ô nhập (nd, td, cc, nfb, sao) lấy từ trường riêng của thẻ, không ghi đè ở đây.
const SnapshotOverrides = z.record(z.string().max(20), z.string().trim().max(500, 'Giá trị ô tối đa 500 ký tự').nullable());

export const CardCreateBody = z.strictObject({
  kind: CardKind,
  templateCode: TemplateCode,
  contractId: z.uuid(),
  courseClassId: z.uuid().optional(),
  title: CardTitle.nullable().optional(),
  body: CardBody.nullable().optional(),
  rating: Rating.nullable().optional(),
  receivedAt: DateOnly.nullable().optional(),
  photoFileIds: PhotoFileIds.optional(),
  fontOverride: z.enum(FONT_OVERRIDES).nullable().optional(),
  size: z.enum(DESIGN_SIZES),
  snapshot: SnapshotOverrides.optional(),
});
export type CardCreateInput = z.infer<typeof CardCreateBody>;

// Như thân tạo, trừ kind và contractId (đổi loại thẻ / hợp đồng = tạo thẻ mới).
export const CardPatchBody = z
  .strictObject({
    templateCode: TemplateCode.optional(),
    courseClassId: z.uuid().nullable().optional(),
    title: CardTitle.nullable().optional(),
    body: CardBody.nullable().optional(),
    rating: Rating.nullable().optional(),
    receivedAt: DateOnly.nullable().optional(),
    photoFileIds: PhotoFileIds.optional(),
    fontOverride: z.enum(FONT_OVERRIDES).nullable().optional(),
    size: z.enum(DESIGN_SIZES).optional(),
    snapshot: SnapshotOverrides.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Không có gì để sửa');
export type CardPatchInput = z.infer<typeof CardPatchBody>;

export const CardOutputBody = z.strictObject({ fileId: z.uuid() });

export const CardListQuery = z
  .object({
    kind: CardKind.optional(),
    contractId: z.uuid().optional(),
    customerId: z.uuid().optional(),
    // Lọc theo lúc tạo thẻ, [from, to): tính from, không tính to.
    from: DateTime.optional(),
    to: DateTime.optional(),
  })
  .superRefine((q, ctx) => {
    if (q.from && q.to && new Date(q.to).getTime() <= new Date(q.from).getTime()) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Thời điểm kết thúc (to) phải sau thời điểm bắt đầu (from)' });
    }
  });
