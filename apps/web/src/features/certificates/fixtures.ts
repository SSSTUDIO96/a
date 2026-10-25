import type { CertificateView } from '../../api/certificates';

// Dữ liệu giả cho bài thử (không dùng ở mã chạy thật).
export function fakeView(n: number, over: Partial<CertificateView> = {}): CertificateView {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  return {
    id,
    code: `CC-2026-${String(n).padStart(4, '0')}`,
    year: 2026,
    seq: n,
    reissueNo: 0,
    status: 'ISSUED',
    issuedOn: '2026-12-20',
    reissuedOn: null,
    templateCode: 'cc-01',
    templateVersion: 1,
    fontOverride: null,
    backgroundStyle: null,
    frameStyle: null,
    studentName: `Học viên ${n}`,
    courseName: 'Makeup chuyên nghiệp',
    className: 'K12',
    instructorName: 'Nguyễn Thu Hà',
    signerName: 'Nguyễn Trọng Chiến',
    signerTitle: 'Giám đốc trung tâm',
    brandName: 'Chiến Makeup Academy',
    photo: null,
    logo: null,
    background: null,
    enrollmentId: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    courseClassId: '20000000-0000-4000-8000-000000000001',
    customer: { id: `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`, fullName: `Học viên ${n}` },
    revokedAt: null,
    revokeReason: null,
    replacesId: null,
    replacedById: null,
    issuedBy: { userId: '40000000-0000-4000-8000-000000000001', name: 'Chủ' },
    createdAt: '2026-12-20T03:00:00.000Z',
    ...over,
  };
}

// JPEG 1×1 hợp lệ nhỏ nhất (nền trắng), đủ để pdf-lib nhúng.
export const JPEG_1X1 = Uint8Array.from(
  atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='),
  (c) => c.charCodeAt(0),
);
