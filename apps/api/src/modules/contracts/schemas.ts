import { z } from 'zod';
import { CONTRACT_STATUSES, TRAVEL_FEE_MODES } from '@makeup/shared';
import { MAX_MONEY_VND, MONEY_TOO_LARGE_MESSAGE } from '../../lib/money';

// Không âm thầm bỏ trường lạ: gửi nhầm thì báo rõ.
function strict<S extends z.ZodRawShape>(shape: S) {
  return z.strictObject(shape, {
    error: (iss) => (iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')}` : undefined),
  });
}

export const Money = z
  .number({ error: 'Số tiền phải là số' })
  .int('Số tiền phải là số nguyên đồng, không có phần lẻ')
  .nonnegative('Số tiền không được âm')
  // Trần chung của mọi số tiền nhập tay (lib/money.ts, 100 tỷ đ) — không chép số sang đây.
  .max(MAX_MONEY_VND, MONEY_TOO_LARGE_MESSAGE);

const Quantity = z.number({ error: 'Số lượng phải là số' }).int('Số lượng phải là số nguyên').min(1).max(1000);
const Note = z.string().trim().min(1).max(1000);
const Text = z.string().trim().max(10_000);
const DateTime = z.iso.datetime({ offset: true, error: 'Thời gian phải theo dạng ISO 8601, ví dụ 2026-11-01T08:00:00+07:00' });
// Số km kiểm 2 chữ số thập phân ở hàm tính phí (@makeup/shared) để giao diện và máy chủ cùng một luật.
const DistanceKm = z.number({ error: 'Số km phải là số' }).nonnegative('Số km không được âm');

export const TravelInputSchema = strict({
  mode: z.enum(TRAVEL_FEE_MODES),
  distanceKm: DistanceKm.optional(),
  amount: Money.optional(),
  note: Note.optional(),
});

const AddonInput = strict({ serviceId: z.uuid(), quantity: Quantity });

// Thợ phụ trách dự kiến của dòng; lúc xác nhận hợp đồng thành thợ của lịch.
const StaffInput = strict({ membershipId: z.uuid(), role: z.enum(['PRIMARY', 'ASSIST']).default('PRIMARY') });

const placement = {
  subjectId: z.uuid().optional(),
  quantity: Quantity,
  locationType: z.enum(['STUDIO', 'CUSTOMER_HOME', 'OTHER']).optional(),
  studioLocationId: z.uuid().optional(),
  address: z.string().trim().min(1).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  scheduledStart: DateTime.optional(),
  scheduledEnd: DateTime.optional(),
  lineDiscount: Money.optional(),
  note: Note.optional(),
  addons: z.array(AddonInput).max(30).optional(),
  travel: TravelInputSchema.optional(),
  staff: z.array(StaffInput).max(20).optional(),
};

export const LineInputSchema = z.discriminatedUnion('kind', [
  strict({ kind: z.literal('PACKAGE'), packageId: z.uuid(), ...placement }),
  strict({ kind: z.literal('SERVICE'), serviceId: z.uuid(), ...placement }),
  strict({ kind: z.literal('SURCHARGE'), serviceId: z.uuid(), quantity: Quantity, unitPrice: Money.optional(), note: Note.optional() }).refine(
    (l) => l.unitPrice === undefined || l.note !== undefined,
    { message: 'Ghi đè giá phụ phí phải kèm ghi chú lý do', path: ['note'] },
  ),
  strict({ kind: z.literal('CUSTOM'), name: z.string().trim().min(1).max(200), unitPrice: Money, quantity: Quantity, note: Note.optional() }),
  // Dòng khoá học: tên, học phí, số lượng 1 do máy chủ chép từ khoá/lớp lúc thêm (BAN-VE-C3 mục 1.1).
  strict({ kind: z.literal('COURSE'), courseClassId: z.uuid(), note: Note.optional() }),
]);

export type LineInput = z.infer<typeof LineInputSchema>;
export type CourseLineInput = Extract<LineInput, { kind: 'COURSE' }>;
export type PlacedLineInput = Extract<LineInput, { kind: 'PACKAGE' | 'SERVICE' }>;
export type TravelInput = z.infer<typeof TravelInputSchema>;

const Lines = z.array(LineInputSchema).min(1, 'Hợp đồng phải có ít nhất một dòng').max(100);

const NewCustomer = strict({
  fullName: z.string().trim().min(1, 'Tên khách không được để trống').max(120),
  phone: z.string().trim().min(1).max(30).optional(),
});

export const CONTRACT_KINDS = ['SERVICE', 'COURSE'] as const;
export type ContractKindKey = (typeof CONTRACT_KINDS)[number];

const contractBodyShape = {
  // Loại hợp đồng đặt lúc tạo, không đổi được sau (PATCH không nhận; database có trigger contracts_kind_locked).
  kind: z.enum(CONTRACT_KINDS).default('SERVICE'),
  customerId: z.uuid().optional(),
  newCustomer: NewCustomer.optional(),
  // Người phụ trách (tư vấn, nhắc đóng tiền) — thành viên đang hoạt động của tổ chức.
  ownerMembershipId: z.uuid().optional(),
  eventDate: DateTime.optional(),
  notes: Text.optional(),
  terms: Text.optional(),
  // Mẫu điều khoản / nội quy chọn cho hợp đồng; nội dung được CHỤP vào hợp đồng lúc xác nhận.
  // Không chọn: lúc xác nhận lấy mẫu mặc định (điều khoản chỉ khi không tự nhập terms).
  termsTemplateId: z.uuid().optional(),
  rulesTemplateId: z.uuid().optional(),
  discount: Money.default(0),
  depositRequired: Money.optional(),
  lines: Lines,
};

type BodyLike = { customerId?: string; newCustomer?: unknown; terms?: string | null; termsTemplateId?: string | null };
const oneCustomer = (b: BodyLike) => (b.customerId === undefined) !== (b.newCustomer === undefined);
const ONE_CUSTOMER = { message: 'Chọn đúng một trong hai: customerId (khách có sẵn) hoặc newCustomer (khách mới)', path: ['customerId'] };
const termsOrTemplate = (b: BodyLike) => !(typeof b.terms === 'string' && typeof b.termsTemplateId === 'string');
const TERMS_OR_TEMPLATE = {
  message: 'Chọn mẫu điều khoản (termsTemplateId) hoặc tự nhập điều khoản (terms), không gửi cả hai',
  path: ['termsTemplateId'],
};

export const ContractBodySchema = strict(contractBodyShape).refine(oneCustomer, ONE_CUSTOMER).refine(termsOrTemplate, TERMS_OR_TEMPLATE);

export type ContractBody = z.infer<typeof ContractBodySchema>;

// Xem trước: như thân tạo, thêm excludeContractId = hợp đồng đang sửa (giữ chỗ nháp và lịch của CHÍNH hợp đồng đó
// không tính là cảnh báo thợ).
export const QuoteBodySchema = strict({ ...contractBodyShape, excludeContractId: z.uuid().optional() })
  .refine(oneCustomer, ONE_CUSTOMER)
  .refine(termsOrTemplate, TERMS_OR_TEMPLATE);

export const ContractPatchSchema = strict({
  // BẮT BUỘC: updatedAt của bản hợp đồng máy khách đang sửa (lấy từ phản hồi gần nhất). Lệch bản hiện hành → 409
  // (biên bản nghiệm thu web 2, T2: hai thẻ cùng sửa, thẻ sau xoá im lặng giảm giá của thẻ trước).
  expectedUpdatedAt: DateTime,
  // Đổi khách khi hợp đồng còn NHÁP (phiếu vướng của thợ web T). Khách phải thuộc tổ chức — mã của tổ chức khác trả đúng
  // lời như mã bịa (404). Hợp đồng đã xác nhận → 409 (database cũng chặn: trigger contracts_locked).
  customerId: z.uuid().optional(),
  lines: Lines.optional(),
  discount: Money.optional(),
  depositRequired: Money.optional(),
  eventDate: DateTime.nullable().optional(),
  notes: Text.nullable().optional(),
  terms: Text.nullable().optional(),
  // null = bỏ mẫu đã chọn. Chọn mẫu thì bỏ điều khoản tự nhập (và ngược lại) — thao tác sau thắng.
  termsTemplateId: z.uuid().nullable().optional(),
  rulesTemplateId: z.uuid().nullable().optional(),
})
  .refine((b) => Object.entries(b).some(([k, v]) => k !== 'expectedUpdatedAt' && v !== undefined), 'Không có gì để sửa')
  .refine(termsOrTemplate, TERMS_OR_TEMPLATE);

export const VoidBodySchema = strict({ reason: z.string().trim().min(1, 'Phải nêu lý do huỷ dòng').max(1000) });

export const StatusBodySchema = strict({
  to: z.enum(CONTRACT_STATUSES),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const OrgParams = z.object({ orgId: z.uuid() });
export const ContractParams = OrgParams.extend({ contractId: z.uuid() });
export const LineParams = ContractParams.extend({ lineId: z.uuid() });

export const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(CONTRACT_STATUSES).optional(),
  customerId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  eventFrom: DateTime.optional(),
  eventTo: DateTime.optional(),
  kind: z.enum(CONTRACT_KINDS).optional(),
});
