// Dạng trả về của giấy chứng nhận (BAN-VE-F mục 4.2). Chữ in trên giấy là BẢN CHỤP lúc cấp (cột *_name), không đọc lại
// tên hiện hành — in lại ra y như cũ. Ảnh: URL ký có hạn, chỉ tệp READY, chưa xoá, ĐÚNG tổ chức; còn lại null (tệp xoá
// mềm sau khi cấp → web in chữ cái đầu / bỏ logo).
import type { Prisma } from '@prisma/client';
import { signedUrlOf } from '../files/service';
import { dateToWire } from '../courses/present';

type Tx = Prisma.TransactionClient;

export interface SignedImage {
  url: string;
  expiresAt: string;
}

export interface SignedPhoto extends SignedImage {
  width: number | null;
  height: number | null;
}

export type FileSigner = (id: string | null) => SignedPhoto | null;

// Ký URL cho nhiều tệp một lần (một truy vấn). Luôn lọc organizationId: mã tệp của tổ chức khác → null như mã bịa.
export async function signFiles(db: Tx, organizationId: string, ids: (string | null | undefined)[]): Promise<FileSigner> {
  if (!organizationId) throw new Error('signFiles: thiếu organizationId');
  const wanted = [...new Set(ids.filter((x): x is string => typeof x === 'string' && x !== ''))];
  const files = wanted.length
    ? await db.storedFile.findMany({
        where: { id: { in: wanted }, organizationId, status: 'READY', deletedAt: null },
        select: { id: true, storageKey: true, width: true, height: true },
      })
    : [];
  const out = new Map<string, SignedPhoto>();
  for (const f of files) {
    const s = await signedUrlOf(f);
    out.set(f.id, { url: s.signedUrl, expiresAt: s.signedUrlExpiresAt, width: f.width, height: f.height });
  }
  return (id) => (id ? (out.get(id) ?? null) : null);
}

// Ảnh không cần kích thước (logo, ảnh nền).
export function imageOnly(p: SignedPhoto | null): SignedImage | null {
  return p ? { url: p.url, expiresAt: p.expiresAt } : null;
}

export const certificateSelect = {
  id: true,
  organizationId: true,
  code: true,
  year: true,
  seq: true,
  reissueNo: true,
  status: true,
  issuedOn: true,
  reissuedOn: true,
  templateCode: true,
  templateVersion: true,
  fontOverride: true,
  backgroundStyle: true,
  backgroundFileId: true,
  frameStyle: true,
  studentName: true,
  courseName: true,
  className: true,
  instructorName: true,
  signerName: true,
  signerTitle: true,
  brandName: true,
  photoFileId: true,
  logoFileId: true,
  enrollmentId: true,
  courseClassId: true,
  customerId: true,
  revokedAt: true,
  revokeReason: true,
  replacesId: true,
  issuedById: true,
  createdAt: true,
  customer: { select: { id: true, fullName: true } },
  issuedBy: { select: { id: true, fullName: true } },
  replacedBy: { select: { id: true }, orderBy: { reissueNo: 'desc' }, take: 1 },
} satisfies Prisma.CertificateSelect;

export type CertificateRow = Prisma.CertificateGetPayload<{ select: typeof certificateSelect }>;

const FONT_KEYS = ['ky-1', 'ky-2', 'ky-3', 'ky-4'] as const;
type CertFont = (typeof FONT_KEYS)[number];

// Cột font_override có CHECK chỉ nhận ky-1..ky-4 hoặc NULL — giá trị khác là dữ liệu hỏng, ném lỗi chứ không đoán.
function fontOf(v: string | null): CertFont | null {
  if (v === null) return null;
  if ((FONT_KEYS as readonly string[]).includes(v)) return v as CertFont;
  throw new Error(`certificates.font_override ngoài miền CHECK: ${v}`);
}

export function presentCertificate(c: CertificateRow, sign: FileSigner) {
  return {
    id: c.id,
    code: c.code,
    year: c.year,
    seq: c.seq,
    reissueNo: c.reissueNo,
    status: c.status,
    issuedOn: dateToWire(c.issuedOn),
    reissuedOn: c.reissuedOn ? dateToWire(c.reissuedOn) : null,
    templateCode: c.templateCode,
    templateVersion: c.templateVersion,
    fontOverride: fontOf(c.fontOverride),
    backgroundStyle: c.backgroundStyle,
    frameStyle: c.frameStyle,
    studentName: c.studentName,
    courseName: c.courseName,
    className: c.className,
    instructorName: c.instructorName,
    signerName: c.signerName,
    signerTitle: c.signerTitle,
    brandName: c.brandName,
    photo: sign(c.photoFileId),
    logo: imageOnly(sign(c.logoFileId)),
    background: imageOnly(sign(c.backgroundFileId)),
    enrollmentId: c.enrollmentId,
    courseClassId: c.courseClassId,
    // Tên HIỆN HÀNH của khách (để hộp cấp lại điền sẵn) — chữ in trên giấy là studentName.
    customer: { id: c.customer.id, fullName: c.customer.fullName },
    revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
    revokeReason: c.revokeReason,
    replacesId: c.replacesId,
    replacedById: c.replacedBy[0]?.id ?? null,
    issuedBy: { userId: c.issuedBy.id, name: c.issuedBy.fullName },
    createdAt: c.createdAt.toISOString(),
  };
}

export type CertificateView = ReturnType<typeof presentCertificate>;

// Trình bày nhiều bản: ký mọi ảnh trong MỘT truy vấn.
export async function presentCertificates(db: Tx, organizationId: string, rows: CertificateRow[]): Promise<CertificateView[]> {
  const sign = await signFiles(
    db,
    organizationId,
    rows.flatMap((c) => [c.photoFileId, c.logoFileId, c.backgroundFileId]),
  );
  return rows.map((c) => presentCertificate(c, sign));
}

// "2026-03-30" → "30/03/2026" (lời báo lỗi).
export function viDate(wire: string): string {
  const [y, m, d] = wire.split('-');
  if (!y || !m || !d) throw new Error(`viDate: ngày không đúng dạng YYYY-MM-DD: ${wire}`);
  return `${d}/${m}/${y}`;
}
