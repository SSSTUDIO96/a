import type { FilePurpose, Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors';
import { signedUrlOf } from '../files/service';

export type ImageSlot = 'logo' | 'avatar' | 'cover';

// Mục đích tệp được nhận cho từng ô ảnh của hồ sơ.
const ALLOWED_PURPOSES: Record<ImageSlot, readonly FilePurpose[]> = {
  logo: ['ORG_LOGO'],
  avatar: ['ORG_LOGO', 'STAFF_AVATAR', 'ALBUM_IMAGE'],
  cover: ['ORG_LOGO', 'ALBUM_IMAGE'],
};

const SLOT_LABEL: Record<ImageSlot, string> = { logo: 'logo', avatar: 'ảnh đại diện', cover: 'ảnh bìa' };

// Tệp không có và tệp của tổ chức khác trả CÙNG một lời — không lộ tổ chức khác có tệp đó.
export async function assertUsableImage(
  tx: Prisma.TransactionClient,
  organizationId: string,
  slot: ImageSlot,
  fileId: string | null | undefined,
) {
  if (!fileId) return;
  const f = await tx.storedFile.findFirst({
    where: { id: fileId, organizationId },
    select: { purpose: true, status: true, mimeType: true, deletedAt: true },
  });
  if (!f) throw new AppError('VALIDATION_FAILED', `Không tìm thấy tệp ${SLOT_LABEL[slot]} trong tổ chức`, { field: `${slot}FileId` });
  if (f.status !== 'READY' || f.deletedAt) {
    throw new AppError('VALIDATION_FAILED', `Tệp ${SLOT_LABEL[slot]} chưa tải xong hoặc đã xoá`, { field: `${slot}FileId` });
  }
  if (!ALLOWED_PURPOSES[slot].includes(f.purpose) || !f.mimeType.startsWith('image/')) {
    throw new AppError('VALIDATION_FAILED', `Tệp ${SLOT_LABEL[slot]} phải là ảnh tải lên cho mục ${ALLOWED_PURPOSES[slot].join('/')}`, {
      field: `${slot}FileId`,
      purpose: f.purpose,
    });
  }
}

export interface SignedImage {
  url: string;
  expiresAt: string;
}

// URL ký có hạn cho các ảnh của hồ sơ: một truy vấn cho mọi ảnh. Tệp chưa sẵn sàng/đã xoá → null.
export async function signImages(
  db: Prisma.TransactionClient,
  organizationId: string,
  ids: (string | null)[],
): Promise<(id: string | null) => SignedImage | null> {
  const wanted = [...new Set(ids.filter((x): x is string => x !== null))];
  const files = wanted.length
    ? await db.storedFile.findMany({
        where: { id: { in: wanted }, organizationId, status: 'READY', deletedAt: null },
        select: { id: true, storageKey: true },
      })
    : [];
  const urls = new Map<string, SignedImage>();
  for (const f of files) {
    const s = await signedUrlOf(f);
    urls.set(f.id, { url: s.signedUrl, expiresAt: s.signedUrlExpiresAt });
  }
  return (id) => (id === null ? null : (urls.get(id) ?? null));
}
