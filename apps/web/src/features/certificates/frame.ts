import { isCertificateTemplateCode } from '@makeup/shared';
import type { CertificateView } from '../../api/certificates';
import { fontNumber, viDate } from './logic';

// Dựng tham số cho tệp mẫu public/mau/cc-NN.html (bản vẽ F mục 7.1; tham số theo public/mau/chung/cc.js):
// that=1 (dữ liệu thật: ô thiếu để TRỐNG, không lấy chữ mẫu), xuat=1 (khung .cc ở góc trên trái, 1123×794),
// ten, khoa, lop, gv, gd, gdcv, th, so; ncap / lai đổi YYYY-MM-DD → dd/mm/yyyy; anh / logo = URL blob cùng nguồn;
// ky = số trong fontOverride. Ô null / rỗng KHÔNG đặt tham số — tệp mẫu để trống, không bịa.

export interface CertificateFrameInput {
  templateCode: string;
  studentName: string | null;
  courseName: string;
  className: string;
  instructorName: string | null;
  signerName: string | null;
  signerTitle: string | null;
  brandName: string;
  code: string | null;
  issuedOn: string | null;
  reissuedOn: string | null;
  fontOverride: string | null;
}

export interface FrameBlobs {
  photo: string | null;
  logo: string | null;
}

export function certificateFrameQuery(v: CertificateFrameInput, blobs: FrameBlobs): string {
  if (!isCertificateTemplateCode(v.templateCode)) throw new Error(`Không có mẫu giấy chứng nhận "${v.templateCode}"`);
  const q = new URLSearchParams();
  q.set('that', '1');
  q.set('xuat', '1');
  const put = (key: string, value: string | null | undefined) => {
    const t = value?.trim();
    if (t) q.set(key, t);
  };
  put('ten', v.studentName);
  put('khoa', v.courseName);
  put('lop', v.className);
  put('gv', v.instructorName);
  put('gd', v.signerName);
  put('gdcv', v.signerTitle);
  put('th', v.brandName);
  put('so', v.code);
  put('ncap', v.issuedOn ? viDate(v.issuedOn) : null);
  put('lai', v.reissuedOn ? viDate(v.reissuedOn) : null);
  put('anh', blobs.photo);
  put('logo', blobs.logo);
  put('ky', fontNumber(v.fontOverride));
  return q.toString();
}

// Đường dẫn tệp mẫu kèm tham số. Mã mẫu lạ → ném lỗi.
export function certificateFrameSrc(v: CertificateFrameInput, blobs: FrameBlobs): string {
  return `/mau/${v.templateCode}.html?${certificateFrameQuery(v, blobs)}`;
}

// Dữ liệu in của một giấy ĐÃ CẤP: chữ là bản chụp lúc cấp (in lại ra y hệt, KY-DUYET-F câu 1); lai chỉ có ở bản cấp lại.
export function frameInputOfView(c: CertificateView): CertificateFrameInput {
  return {
    templateCode: c.templateCode,
    studentName: c.studentName,
    courseName: c.courseName,
    className: c.className,
    instructorName: c.instructorName,
    signerName: c.signerName,
    signerTitle: c.signerTitle,
    brandName: c.brandName,
    code: c.code,
    issuedOn: c.issuedOn,
    reissuedOn: c.reissuedOn,
    fontOverride: c.fontOverride,
  };
}
