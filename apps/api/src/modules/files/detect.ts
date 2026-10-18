// Nhận diện loại tệp bằng CHỮ KÝ ĐẦU TỆP (magic bytes) — không tin Content-Type hay đuôi tên tệp.
export type DetectedType = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';

export const EXTENSION: Record<DetectedType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectType(buf: Buffer): DetectedType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

export interface ImageSize {
  width: number;
  height: number;
}

// Đọc kích thước ảnh từ phần đầu tệp, không giải mã ảnh. Không đọc được → null (người gọi coi là ảnh hỏng).
export function imageSize(buf: Buffer, type: DetectedType): ImageSize | null {
  try {
    if (type === 'image/png') {
      if (buf.length < 24 || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
      return positive(buf.readUInt32BE(16), buf.readUInt32BE(20));
    }
    if (type === 'image/jpeg') return jpegSize(buf);
    if (type === 'image/webp') return webpSize(buf);
    return null;
  } catch (err) {
    // Tệp cụt giữa chừng: đọc quá cuối bộ đệm → ảnh hỏng.
    if (err instanceof RangeError) return null;
    throw err;
  }
}

function positive(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 ? { width, height } : null;
}

// Các mã đoạn SOF (khung ảnh) chứa kích thước: C0–CF trừ C4 (DHT), C8 (JPG), CC (DAC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(buf: Buffer): ImageSize | null {
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    if (SOF.has(marker)) return positive(buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5));
    i += 2 + len;
  }
  return null;
}

function webpSize(buf: Buffer): ImageSize | null {
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8X') return positive(1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3));
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return positive(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const b0 = buf.readUInt8(21);
    const b1 = buf.readUInt8(22);
    const b2 = buf.readUInt8(23);
    const b3 = buf.readUInt8(24);
    return positive(1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
  }
  return null;
}
