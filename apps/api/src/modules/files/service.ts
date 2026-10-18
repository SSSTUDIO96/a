import { createHash, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { FilePurpose, Prisma, StoredFile } from '@prisma/client';
import { AppError } from '../../lib/errors';
import { getStorage } from '../../lib/storage';
import { detectType, EXTENSION, imageSize, type DetectedType } from './detect';

const MB = 1024 * 1024;
const IMAGES: readonly DetectedType[] = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGES_AND_PDF: readonly DetectedType[] = [...IMAGES, 'application/pdf'];

// Loại tệp và dung lượng tối đa theo mục đích. Ảnh: chỉ JPEG, PNG, WebP.
export const PURPOSE_POLICY: Record<FilePurpose, { maxBytes: number; types: readonly DetectedType[] }> = {
  STAFF_AVATAR: { maxBytes: 5 * MB, types: IMAGES },
  CUSTOMER_AVATAR: { maxBytes: 5 * MB, types: IMAGES },
  ORG_LOGO: { maxBytes: 2 * MB, types: IMAGES },
  ALBUM_IMAGE: { maxBytes: 15 * MB, types: IMAGES },
  WELCOME_CARD: { maxBytes: 10 * MB, types: IMAGES },
  COURSE_RESOURCE: { maxBytes: 25 * MB, types: IMAGES_AND_PDF },
  SUBMISSION: { maxBytes: 25 * MB, types: IMAGES_AND_PDF },
  OTHER: { maxBytes: 10 * MB, types: IMAGES_AND_PDF },
};

const MAX_IMAGE_SIDE = 20_000;
// Hạn URL đọc tệp: 10 phút.
export const SIGNED_URL_TTL_SEC = 600;

// Đọc thân nhị phân, dừng khi vượt giới hạn. Phần vượt vẫn được rút cạn (tối đa thêm 1 MB) để máy khách nhận được lời báo lỗi.
export async function readLimitedBody(req: Request, maxBytes: number): Promise<Buffer> {
  if (req.body !== undefined) {
    throw new AppError('VALIDATION_FAILED', 'Gửi nội dung tệp dạng nhị phân (Content-Type: application/octet-stream hoặc image/*), không gửi JSON');
  }
  const limitText = `${Math.round(maxBytes / MB)} MB`;
  const declared = Number(req.headers['content-length']);
  const chunks: Buffer[] = [];
  let total = 0;
  let over = Number.isFinite(declared) && declared > maxBytes;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > maxBytes) over = true;
    if (over) {
      if (total > maxBytes + MB) {
        req.destroy();
        break;
      }
      continue;
    }
    chunks.push(chunk);
  }
  if (over) throw new AppError('VALIDATION_FAILED', `Tệp vượt giới hạn ${limitText}`, { maxBytes });
  if (total === 0) throw new AppError('VALIDATION_FAILED', 'Tệp rỗng');
  return Buffer.concat(chunks);
}

export interface CheckedFile {
  mimeType: DetectedType;
  width: number | null;
  height: number | null;
  sha256: string;
}

export function checkContent(purpose: FilePurpose, data: Buffer, declaredSha256?: string): CheckedFile {
  const policy = PURPOSE_POLICY[purpose];
  const type = detectType(data);
  if (!type || !policy.types.includes(type)) {
    throw new AppError('VALIDATION_FAILED', `Nội dung tệp không đúng loại cho phép (${policy.types.join(', ')})`, {
      detected: type,
    });
  }
  let width: number | null = null;
  let height: number | null = null;
  if (type !== 'application/pdf') {
    const size = imageSize(data, type);
    if (!size) throw new AppError('VALIDATION_FAILED', 'Ảnh hỏng hoặc không đọc được kích thước');
    if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) {
      throw new AppError('VALIDATION_FAILED', `Ảnh quá lớn (tối đa ${MAX_IMAGE_SIDE} điểm ảnh mỗi cạnh)`);
    }
    ({ width, height } = size);
  }
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (declaredSha256 !== undefined && declaredSha256.toLowerCase() !== sha256) {
    throw new AppError('VALIDATION_FAILED', 'Mã băm X-Content-SHA256 không khớp nội dung tệp (tệp hỏng trên đường truyền?)');
  }
  return { mimeType: type, width, height, sha256 };
}

export function newStorageKey(orgId: string, purpose: FilePurpose, type: DetectedType): string {
  return `org/${orgId}/${purpose.toLowerCase().replace(/_/g, '-')}/${randomUUID()}.${EXTENSION[type]}`;
}

export async function signedUrlOf(file: Pick<StoredFile, 'storageKey'>) {
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000);
  return { signedUrl: await getStorage().getSignedUrl(file.storageKey, SIGNED_URL_TTL_SEC), signedUrlExpiresAt: expiresAt.toISOString() };
}

export async function presentFile(f: StoredFile) {
  return {
    id: f.id,
    purpose: f.purpose,
    status: f.status,
    originalName: f.originalName,
    mimeType: f.mimeType,
    sizeBytes: Number(f.sizeBytes),
    sha256: f.sha256,
    width: f.width,
    height: f.height,
    createdAt: f.createdAt.toISOString(),
    ...(f.status === 'READY' ? await signedUrlOf(f) : { signedUrl: null, signedUrlExpiresAt: null }),
  };
}

// ẢNH ĐẠI DIỆN THỢ — TẠM lưu tham chiếu "file:<id>" trong staff_profiles.avatar_url vì bảng chưa có cột
// avatar_file_id (xem PHIẾU VƯỚNG). Mọi chỗ trả ảnh đại diện phải đi qua resolveAvatarUrls.
export const FILE_REF_PREFIX = 'file:';

export function fileRef(fileId: string): string {
  return `${FILE_REF_PREFIX}${fileId}`;
}

// Đổi giá trị avatar_url đã lưu thành URL ký có hạn, một câu truy vấn cho cả danh sách (không N+1).
// Tệp đã xoá/không còn → null. Giá trị cũ không phải "file:" (đường dẫn https nhập tay trước đây) giữ nguyên.
export async function resolveAvatarUrls(
  db: Prisma.TransactionClient,
  orgId: string,
  stored: (string | null | undefined)[],
): Promise<(raw: string | null | undefined) => string | null> {
  const ids = [...new Set(stored.filter((v): v is string => !!v && v.startsWith(FILE_REF_PREFIX)).map((v) => v.slice(FILE_REF_PREFIX.length)))];
  const files = ids.length
    ? await db.storedFile.findMany({
        where: { id: { in: ids }, organizationId: orgId, status: 'READY' },
        select: { id: true, storageKey: true },
      })
    : [];
  const urls = new Map<string, string>();
  for (const f of files) urls.set(f.id, await getStorage().getSignedUrl(f.storageKey, SIGNED_URL_TTL_SEC));
  return (raw) => {
    if (!raw) return null;
    if (!raw.startsWith(FILE_REF_PREFIX)) return raw;
    return urls.get(raw.slice(FILE_REF_PREFIX.length)) ?? null;
  };
}
