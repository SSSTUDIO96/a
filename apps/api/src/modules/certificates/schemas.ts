// Khuôn zod của giấy chứng nhận (docs/rnd/BAN-VE-F-GIAY-CHUNG-NHAN.md mục 4.3–4.7). Thân rỗng `{}` luôn trượt ở đây
// (phép GIỮ của cửa gác), trước mọi kiểm nghiệp vụ.
import { z } from 'zod';
import {
  CERTIFICATE_IDS_MAX,
  CERTIFICATE_MAX_BATCH,
  CERTIFICATE_TEMPLATE_CODES,
  CERTIFICATE_YEAR_MAX,
  CERTIFICATE_YEAR_MIN,
  isCertificateTemplateCode,
  type CertificateTemplateCode,
  type FontOverride,
} from '@makeup/shared';
import { OrgParams, strictBody } from '../catalog/common';
import { DateOnly } from '../courses/schemas';

export { OrgParams };
export const ClassParams = OrgParams.extend({ classId: z.uuid() });
export const CertificateParams = OrgParams.extend({ certificateId: z.uuid() });

// Phông chữ ký nhận cho giấy chứng nhận: ĐÚNG bốn giá trị CHECK certificates_template của database cho phép
// (migration 20261019210000). FONT_OVERRIDES của danh mục thẻ nay có thêm ky-5/6/8 — database không nhận, nên máy chủ
// chặn trước bằng danh sách riêng này (không để 400 lời chung của ràng buộc).
export const CERTIFICATE_FONT_OVERRIDES = ['ky-1', 'ky-2', 'ky-3', 'ky-4'] as const satisfies readonly FontOverride[];

const firstCode = CERTIFICATE_TEMPLATE_CODES[0];
const lastCode = CERTIFICATE_TEMPLATE_CODES[CERTIFICATE_TEMPLATE_CODES.length - 1];

const TemplateCode = z
  .string({ error: 'Chọn mẫu giấy chứng nhận' })
  .refine((v): v is CertificateTemplateCode => isCertificateTemplateCode(v), {
    message: `Không có mẫu giấy chứng nhận này — chọn một mẫu từ ${firstCode} đến ${lastCode}`,
  });

const FontOverrideField = z.enum(CERTIFICATE_FONT_OVERRIDES, { error: 'Phông chữ tên chỉ nhận ky-1 … ky-4' });

const Reason = z
  .string({ error: 'Nhập lý do' })
  .trim()
  .min(1, 'Nhập lý do')
  .max(500, 'Lý do tối đa 500 ký tự');

// ---------- Đường 1: danh sách cấp của lớp ----------

export const RosterQuery = z.object({ issuedOn: DateOnly.optional() });

// ---------- Đường 2: cấp hàng loạt ----------

export const IssueBody = strictBody({
  enrollmentIds: z
    .array(z.uuid({ error: 'Mã ghi danh không hợp lệ' }), { error: 'Chọn học viên cần cấp' })
    .min(1, 'Chọn ít nhất một học viên')
    .max(CERTIFICATE_MAX_BATCH, `Mỗi lần cấp tối đa ${CERTIFICATE_MAX_BATCH} học viên`)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Học viên bị chọn trùng' }),
  templateCode: TemplateCode,
  issuedOn: DateOnly,
  fontOverride: FontOverrideField.nullable().optional(),
});
export type IssueInput = z.infer<typeof IssueBody>;

// ---------- Đường 3: sổ ----------

// "uuid,uuid,…" ≤ CERTIFICATE_IDS_MAX — tách, kiểm từng mã; sai → 400 path ids.
const IdsQuery = z
  .string()
  .transform((raw, ctx) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (parts.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Danh sách mã giấy chứng nhận trống' });
      return z.NEVER;
    }
    if (parts.length > CERTIFICATE_IDS_MAX) {
      ctx.addIssue({ code: 'custom', message: `Tối đa ${CERTIFICATE_IDS_MAX} giấy chứng nhận mỗi lần` });
      return z.NEVER;
    }
    if (parts.some((p) => !z.uuid().safeParse(p).success)) {
      ctx.addIssue({ code: 'custom', message: 'Mã giấy chứng nhận không hợp lệ' });
      return z.NEVER;
    }
    return [...new Set(parts)];
  });

export const RegisterQuery = z.object({
  year: z.coerce
    .number({ error: 'Năm phải là số' })
    .int('Năm phải là số nguyên')
    .min(CERTIFICATE_YEAR_MIN, `Năm từ ${CERTIFICATE_YEAR_MIN} đến ${CERTIFICATE_YEAR_MAX}`)
    .max(CERTIFICATE_YEAR_MAX, `Năm từ ${CERTIFICATE_YEAR_MIN} đến ${CERTIFICATE_YEAR_MAX}`)
    .optional(),
  q: z.string().trim().max(100, 'Từ khoá tối đa 100 ký tự').optional(),
  classId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  status: z.enum(['ISSUED', 'REVOKED']).optional(),
  ids: IdsQuery.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type RegisterInput = z.infer<typeof RegisterQuery>;

// ---------- Đường 5: cấp lại (giữ số) ----------

export const ReissueBody = strictBody({
  reason: Reason,
  // Trống = tên hiện hành của khách. KHÔNG sửa tên trong hồ sơ khách.
  studentName: z.string().trim().min(1, 'Tên học viên không được để trống').max(120, 'Tên học viên tối đa 120 ký tự').optional(),
  // Trống = mẫu cũ.
  templateCode: TemplateCode.optional(),
  // Không gửi = phông cũ; null = phông theo mẫu.
  fontOverride: FontOverrideField.nullable().optional(),
});
export type ReissueInput = z.infer<typeof ReissueBody>;

// ---------- Đường 6: thu hồi ----------

export const RevokeBody = strictBody({ reason: Reason });
export type RevokeInput = z.infer<typeof RevokeBody>;
