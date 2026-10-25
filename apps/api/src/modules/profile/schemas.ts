import { z } from 'zod';
import { normalizeVnPhone } from '@makeup/shared';

const Text = (max: number) => z.string().trim().max(max);

// Liên kết mạng xã hội / website: chỉ nhận https (trình duyệt khách không bị đưa sang trang không mã hoá).
const HttpsUrl = z
  .url({ protocol: /^https$/, error: 'Liên kết phải là địa chỉ https:// đầy đủ' })
  .max(500);

const Phone = z
  .string()
  .transform((raw, ctx) => {
    const v = normalizeVnPhone(raw);
    if (!v) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ (di động 10 số hoặc cố định 11 số)' });
      return z.NEVER;
    }
    return v;
  });

// Zalo hay được ghi bằng số điện thoại; nhận số (chuẩn hoá) hoặc liên kết https (zalo.me/…).
const Zalo = z.string().trim().transform((raw, ctx) => {
  if (raw.startsWith('https://')) {
    const r = HttpsUrl.safeParse(raw);
    if (r.success) return r.data;
  } else {
    const v = normalizeVnPhone(raw);
    if (v) return v;
  }
  ctx.addIssue({ code: 'custom', message: 'Zalo phải là số điện thoại hoặc liên kết https://zalo.me/…' });
  return z.NEVER;
});

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải theo dạng HH:mm (00:00–23:59)');

const Shift = z.strictObject({
  weekday: z.number().int().min(1, 'Thứ từ 1 (thứ Hai) đến 7 (Chủ nhật)').max(7, 'Thứ từ 1 (thứ Hai) đến 7 (Chủ nhật)'),
  open: HHMM,
  close: HHMM,
});

const MAX_SHIFTS_PER_DAY = 2;

// Giờ làm việc: ca đóng sau ca mở, mỗi thứ tối đa 2 ca, các ca cùng thứ không chồng nhau. Trả về đã xếp theo thứ, giờ mở.
export const WorkingHours = z
  .array(Shift)
  .max(7 * MAX_SHIFTS_PER_DAY)
  .superRefine((shifts, ctx) => {
    shifts.forEach((s, i) => {
      if (s.close <= s.open) {
        ctx.addIssue({ code: 'custom', path: [i, 'close'], message: `Thứ ${s.weekday}: giờ đóng (${s.close}) phải sau giờ mở (${s.open})` });
      }
    });
    for (let d = 1; d <= 7; d++) {
      const day = shifts.filter((s) => s.weekday === d).sort((a, b) => a.open.localeCompare(b.open));
      if (day.length > MAX_SHIFTS_PER_DAY) {
        ctx.addIssue({ code: 'custom', message: `Thứ ${d}: tối đa ${MAX_SHIFTS_PER_DAY} ca` });
      }
      for (let i = 1; i < day.length; i++) {
        const prev = day[i - 1];
        const cur = day[i];
        if (prev && cur && cur.open < prev.close) {
          ctx.addIssue({ code: 'custom', message: `Thứ ${d}: ca ${prev.open}–${prev.close} và ca ${cur.open}–${cur.close} chồng nhau` });
        }
      }
    }
  })
  .transform((shifts) => [...shifts].sort((a, b) => a.weekday - b.weekday || a.open.localeCompare(b.open)));

export type Shift = z.infer<typeof Shift>;

// Đọc lại giờ làm việc đã lưu (Json) qua đúng khuôn; dữ liệu hỏng thì ném lỗi chứ không trả bừa.
export function parseStoredHours(raw: unknown): Shift[] {
  const r = WorkingHours.safeParse(raw);
  if (!r.success) throw new Error('working_hours trong database không đúng khuôn — dữ liệu hỏng');
  return r.data;
}

// PUT ghi toàn bộ: trường không gửi = để trống (null/[]). Chỉ brandName bắt buộc.
export const ProfileBody = z.strictObject(
  {
    brandName: Text(120).min(1, 'Tên thương hiệu không được để trống'),
    tagline: Text(200).nullable().optional(),
    bio: Text(5000).nullable().optional(),
    experience: Text(2000).nullable().optional(),
    styles: z.array(Text(50).min(1)).max(20).optional(),
    serviceArea: Text(500).nullable().optional(),
    address: Text(500).nullable().optional(),
    phone: Phone.nullable().optional(),
    email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')).nullable().optional(),
    zalo: Zalo.nullable().optional(),
    facebook: HttpsUrl.nullable().optional(),
    instagram: HttpsUrl.nullable().optional(),
    tiktok: HttpsUrl.nullable().optional(),
    website: HttpsUrl.nullable().optional(),
    logoFileId: z.uuid().nullable().optional(),
    avatarFileId: z.uuid().nullable().optional(),
    coverFileId: z.uuid().nullable().optional(),
    workingHours: WorkingHours.optional(),
    bookingPolicy: Text(5000).nullable().optional(),
    cancellationPolicy: Text(5000).nullable().optional(),
    depositPolicy: Text(5000).nullable().optional(),
  },
  {
    error: (iss) =>
      iss.code === 'unrecognized_keys'
        ? `Không nhận trường: ${iss.keys.join(', ')} — xuất bản dùng POST /profile/publish`
        : undefined,
  },
);

export type ProfileInput = z.infer<typeof ProfileBody>;

// Người ký thứ hai trên giấy chứng nhận (BAN-VE-F mục 4.8). Hai khoá BẮT BUỘC có mặt, được phép null (null tên = để trống
// dòng tên; null chức danh = "Giám đốc trung tâm"). Thân rỗng → 400. Không nằm trong ProfileBody: PUT /profile không bao
// giờ xoá người ký.
const SignerText = (label: string) =>
  z
    .string({ error: `Nhập ${label} hoặc gửi null` })
    .trim()
    .min(1, `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} không được để trống (gửi null để bỏ)`)
    .max(120, `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} tối đa 120 ký tự`)
    .nullable();

export const CertificateSignerBody = z.strictObject(
  { signerName: SignerText('tên người ký'), signerTitle: SignerText('chức danh người ký') },
  { error: (iss) => (iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')}` : undefined) },
);

export type CertificateSignerInput = z.infer<typeof CertificateSignerBody>;

// Thông tin trên hợp đồng (bản vẽ G mục 3.3 đường 8): người đại diện + tài khoản ngân hàng. PUT ghi toàn bộ: đủ 5 khoá,
// giá trị null = để trống. Không nằm trong ProfileBody: PUT /profile không bao giờ xoá 5 trường này.
const InfoText = (label: string, min: number, max: number) =>
  z
    .string({ error: `Nhập ${label} hoặc gửi null` })
    .trim()
    .min(min, min > 1 ? `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} cần ít nhất ${min} ký tự` : `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} không được để trống (gửi null để bỏ)`)
    .max(max, `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} tối đa ${max} ký tự`)
    .nullable();

export const BANK_ALL_OR_NONE_MESSAGE = 'Nhập đủ ngân hàng, số tài khoản, chủ tài khoản (hoặc để trống cả ba)';

export const ContractInfoBody = z
  .strictObject(
    {
      representativeName: InfoText('tên người đại diện', 1, 120),
      representativeTitle: InfoText('chức vụ người đại diện', 1, 80),
      bankName: InfoText('tên ngân hàng', 2, 120),
      // Chuẩn hoá: bỏ mọi khoảng trắng, viết hoa (database chỉ nhận ^[0-9A-Z]{4,30}$).
      bankAccountNumber: z
        .string({ error: 'Nhập số tài khoản hoặc gửi null' })
        .transform((s) => s.replace(/\s+/g, '').toUpperCase())
        .pipe(z.string().regex(/^[0-9A-Z]{4,30}$/, 'Số tài khoản chỉ gồm chữ số / chữ cái, 4–30 ký tự'))
        .nullable(),
      bankAccountName: InfoText('chủ tài khoản', 2, 120),
    },
    { error: (iss) => (iss.code === 'unrecognized_keys' ? `Không nhận trường: ${iss.keys.join(', ')}` : undefined) },
  )
  .superRefine((b, ctx) => {
    const bank = [b.bankName, b.bankAccountNumber, b.bankAccountName];
    const filled = bank.filter((v) => v !== null).length;
    if (filled !== 0 && filled !== 3) {
      const keys = ['bankName', 'bankAccountNumber', 'bankAccountName'] as const;
      for (const [i, k] of keys.entries()) {
        if (bank[i] === null) ctx.addIssue({ code: 'custom', path: [k], message: BANK_ALL_OR_NONE_MESSAGE });
      }
    }
    if (b.representativeTitle !== null && b.representativeName === null) {
      ctx.addIssue({ code: 'custom', path: ['representativeName'], message: 'Có chức vụ thì phải có tên người đại diện' });
    }
  });

export type ContractInfoInput = z.infer<typeof ContractInfoBody>;
