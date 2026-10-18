import { z } from 'zod';
import { CONTRACT_STATUSES, TRAVEL_FEE_MODES } from '@makeup/shared';

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
  .max(Number.MAX_SAFE_INTEGER, 'Số tiền vượt ngưỡng cho phép');

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
};

export const LineInputSchema = z.discriminatedUnion('kind', [
  strict({ kind: z.literal('PACKAGE'), packageId: z.uuid(), ...placement }),
  strict({ kind: z.literal('SERVICE'), serviceId: z.uuid(), ...placement }),
  strict({ kind: z.literal('SURCHARGE'), serviceId: z.uuid(), quantity: Quantity, unitPrice: Money.optional(), note: Note.optional() }).refine(
    (l) => l.unitPrice === undefined || l.note !== undefined,
    { message: 'Ghi đè giá phụ phí phải kèm ghi chú lý do', path: ['note'] },
  ),
  strict({ kind: z.literal('CUSTOM'), name: z.string().trim().min(1).max(200), unitPrice: Money, quantity: Quantity, note: Note.optional() }),
]);

export type LineInput = z.infer<typeof LineInputSchema>;
export type PlacedLineInput = Extract<LineInput, { kind: 'PACKAGE' | 'SERVICE' }>;
export type TravelInput = z.infer<typeof TravelInputSchema>;

const Lines = z.array(LineInputSchema).min(1, 'Hợp đồng phải có ít nhất một dòng').max(100);

const NewCustomer = strict({
  fullName: z.string().trim().min(1, 'Tên khách không được để trống').max(120),
  phone: z.string().trim().min(1).max(30).optional(),
});

export const ContractBodySchema = strict({
  customerId: z.uuid().optional(),
  newCustomer: NewCustomer.optional(),
  eventDate: DateTime.optional(),
  notes: Text.optional(),
  terms: Text.optional(),
  discount: Money.default(0),
  depositRequired: Money.optional(),
  lines: Lines,
}).refine((b) => (b.customerId === undefined) !== (b.newCustomer === undefined), {
  message: 'Chọn đúng một trong hai: customerId (khách có sẵn) hoặc newCustomer (khách mới)',
  path: ['customerId'],
});

export type ContractBody = z.infer<typeof ContractBodySchema>;

export const ContractPatchSchema = strict({
  lines: Lines.optional(),
  discount: Money.optional(),
  depositRequired: Money.optional(),
  eventDate: DateTime.nullable().optional(),
  notes: Text.nullable().optional(),
  terms: Text.nullable().optional(),
}).refine((b) => Object.values(b).some((v) => v !== undefined), 'Không có gì để sửa');

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
});
