import { describe, expect, it } from 'vitest';
import { certificateFrameQuery, certificateFrameSrc, type CertificateFrameInput } from './frame';

const base: CertificateFrameInput = {
  templateCode: 'cc-01',
  studentName: 'Lê Thị Mai',
  courseName: 'Makeup chuyên nghiệp',
  className: 'K12',
  instructorName: 'Nguyễn Thu Hà',
  signerName: 'Nguyễn Trọng Chiến',
  signerTitle: 'Giám đốc trung tâm',
  brandName: 'Chiến Makeup Academy',
  code: 'CC-2026-0007',
  issuedOn: '2026-12-20',
  reissuedOn: null,
  fontOverride: null,
};
const blobs = { photo: 'blob:http://x/p', logo: 'blob:http://x/l' };
const q = (v: Partial<CertificateFrameInput>, b = blobs) => new URLSearchParams(certificateFrameQuery({ ...base, ...v }, b));

describe('frame.ts: tham số cho tệp mẫu cc-NN.html', () => {
  it('luôn có that=1 và xuat=1; đủ ô thì đủ tham số', () => {
    const p = q({});
    expect(p.get('that')).toBe('1');
    expect(p.get('xuat')).toBe('1');
    expect(Object.fromEntries(p)).toMatchObject({
      ten: 'Lê Thị Mai', khoa: 'Makeup chuyên nghiệp', lop: 'K12', gv: 'Nguyễn Thu Hà', gd: 'Nguyễn Trọng Chiến',
      gdcv: 'Giám đốc trung tâm', th: 'Chiến Makeup Academy', so: 'CC-2026-0007', ncap: '20/12/2026', anh: 'blob:http://x/p', logo: 'blob:http://x/l',
    });
  });

  it('ngày đổi dd/mm/yyyy; lai chỉ có khi cấp lại', () => {
    expect(q({}).has('lai')).toBe(false);
    expect(q({ reissuedOn: '2027-01-05' }).get('lai')).toBe('05/01/2027');
    expect(() => q({ issuedOn: '20/12/2026' })).toThrow();
  });

  it('ô null / rỗng KHÔNG có tham số (tệp mẫu để trống, không bịa)', () => {
    const p = q({ studentName: null, instructorName: '  ', signerName: null, signerTitle: null, code: null, issuedOn: null }, { photo: null, logo: null });
    for (const k of ['ten', 'gv', 'gd', 'gdcv', 'so', 'ncap', 'lai', 'anh', 'logo', 'ky']) expect(p.has(k), k).toBe(false);
    expect(p.get('khoa')).toBe('Makeup chuyên nghiệp');
  });

  it('ky = số trong fontOverride; giá trị lạ ném lỗi', () => {
    expect(q({ fontOverride: 'ky-2' }).get('ky')).toBe('2');
    expect(q({ fontOverride: null }).has('ky')).toBe(false);
    expect(() => q({ fontOverride: 'ky-9' })).toThrow();
  });

  it('mã mẫu lạ ném lỗi; đường dẫn là /mau/{mã}.html?…', () => {
    expect(() => certificateFrameQuery({ ...base, templateCode: 'shd-01' }, blobs)).toThrow('shd-01');
    expect(certificateFrameSrc({ ...base, templateCode: 'cc-16' }, blobs)).toMatch(/^\/mau\/cc-16\.html\?that=1&xuat=1&/);
  });

  it('ký tự đặc biệt trong tên được mã hoá, đọc lại ra đúng chữ', () => {
    expect(q({ studentName: 'Trần & "Văn" #1 +%' }).get('ten')).toBe('Trần & "Văn" #1 +%');
  });
});
