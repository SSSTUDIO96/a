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
  // Mục đích mới của module thiết kế thẻ (enum thêm ở schema.prisma). Đường tải tệp chung CHƯA nhận hai mục đích này
  // (files/routes.ts Purpose) — chỉ khai chính sách để bảng đủ mục đích; module thiết kế quyết định cách tải.
  DESIGN_PHOTO: { maxBytes: 15 * MB, types: IMAGES },
  DESIGN_CARD: { maxBytes: 10 * MB, types: IMAGES },
};

// Kích thước ảnh tối đa (biên bản máy chủ lát 2, N4): cạnh dài ≤ 12.000 điểm ảnh VÀ tổng ≤ 64 triệu điểm ảnh.
// Lý do: trình duyệt/điện thoại giải mã ảnh ra RGBA (4 byte/điểm) — 64 triệu điểm ≈ 256 MB bộ nhớ, ngưỡng còn mở được trên
// điện thoại tầm trung; ảnh 20000×20000 (400 triệu điểm ≈ 1,6 GB) làm treo máy khách xem trang. 64 triệu (không phải 60)
// để vẫn nhận ảnh gốc máy full-frame 61 MP (vd. 9504×6336 ≈ 60,2 triệu); ảnh medium-format 100 MP phải xuất nhỏ lại.
export const MAX_IMAGE_SIDE = 12_000;
export const MAX_IMAGE_PIXELS = 64_000_000;
// Thân vượt giới hạn vẫn được ĐỌC BỎ tới mốc này rồi mới trả 400 — máy khách đang gửi dở nhận được lời báo lỗi thay vì
// lỗi mạng (N1). Vượt mốc (gửi bừa vài chục MB trở lên) thì cắt kết nối để khỏi tốn băng thông vô hạn.
const DRAIN_LIMIT_BYTES = 64 * MB;
// Hạn URL đọc tệp: 10 phút.
export const SIGNED_URL_TTL_SEC = 600;

// Đọc thân nhị phân, dừng giữ dữ liệu khi vượt giới hạn. Phần vượt được đọc bỏ (không giữ trong bộ nhớ) tới DRAIN_LIMIT_BYTES
// để máy khách gửi xong và nhận lời "Tệp vượt giới hạn …" (trước đây cắt kết nối sau 1 MB thừa → máy khách chỉ thấy ECONNRESET).
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
      if (total > DRAIN_LIMIT_BYTES) {
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
    if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE || size.width * size.height > MAX_IMAGE_PIXELS) {
      throw new AppError(
        'VALIDATION_FAILED',
        `Ảnh quá lớn (${size.width}×${size.height}): tối đa ${MAX_IMAGE_SIDE} điểm ảnh mỗi cạnh và ${MAX_IMAGE_PIXELS / 1_000_000} triệu điểm ảnh — hãy xuất ảnh nhỏ lại`,
        { width: size.width, height: size.height, maxSide: MAX_IMAGE_SIDE, maxPixels: MAX_IMAGE_PIXELS },
      );
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

// ẢNH ĐẠI DIỆN THỢ: staff_profiles.avatar_file_id (khoá ngoại kép tới tệp cùng tổ chức) là nguồn chính;
// avatar_url chỉ còn giữ ảnh https nhập tay từ trước khi có module tệp. MỌI chỗ trả ảnh đại diện thợ
// (danh sách thợ, bảng tiền công, mức rảnh, hợp đồng…) chọn avatarSelect rồi đi qua resolveAvatarUrls.
export const avatarSelect = { avatarFileId: true, avatarUrl: true } as const;

export interface AvatarSource {
  avatarFileId: string | null;
  avatarUrl: string | null;
}

// Ảnh nhập tay cũ: bản cũ chỉ nhận https, nên chỉ trả nguyên văn đường dẫn https. Giá trị khác (vd. chuỗi tạm
// "file:<id>" do máy chủ bản cũ ghi trong lúc chuyển phiên bản) → null, không bao giờ lộ ra ngoài.
function legacyUrl(raw: string | null): string | null {
  return raw !== null && /^https:\/\/\S+$/i.test(raw) ? raw : null;
}

// Đổi hồ sơ thợ thành URL ký có hạn, một câu truy vấn cho cả danh sách (không N+1).
// Tệp đã xoá/chưa tải xong → null (giao diện hiện chữ viết tắt).
export async function resolveAvatarUrls(
  db: Prisma.TransactionClient,
  orgId: string,
  profiles: (AvatarSource | null | undefined)[],
): Promise<(p: AvatarSource | null | undefined) => string | null> {
  const ids = [...new Set(profiles.map((p) => p?.avatarFileId).filter((id): id is string => !!id))];
  const files = ids.length
    ? await db.storedFile.findMany({
        where: { id: { in: ids }, organizationId: orgId, status: 'READY', deletedAt: null },
        select: { id: true, storageKey: true },
      })
    : [];
  const urls = new Map<string, string>();
  for (const f of files) urls.set(f.id, (await signedUrlOf(f)).signedUrl);
  return (p) => {
    if (!p) return null;
    if (p.avatarFileId) return urls.get(p.avatarFileId) ?? null;
    return legacyUrl(p.avatarUrl);
  };
}
