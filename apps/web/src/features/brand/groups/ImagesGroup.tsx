import { uploadFile } from '../../../api/files';
import { userMessage } from '../../../api/errors';
import { newIdempotencyKey } from '../../../api/idempotency';
import type { FilePurpose } from '../../../api/types';
import { ImageUpload } from '../../../ui';
import type { ImageSlot } from '../model';
import { GroupTitle, type GroupProps } from './common';

const MB = 1024 * 1024;

// Logo: ORG_LOGO ≤ 2 MB (máy chủ chỉ nhận ORG_LOGO cho ô logo). Ảnh đại diện, ảnh bìa: ALBUM_IMAGE ≤ 15 MB.
const SLOTS: { slot: ImageSlot; label: string; purpose: FilePurpose; maxBytes: number; shape: 'square' | 'round' | 'wide' }[] = [
  { slot: 'logo', label: 'Logo', purpose: 'ORG_LOGO', maxBytes: 2 * MB, shape: 'square' },
  { slot: 'avatar', label: 'Ảnh đại diện', purpose: 'ALBUM_IMAGE', maxBytes: 15 * MB, shape: 'round' },
  { slot: 'cover', label: 'Ảnh bìa', purpose: 'ALBUM_IMAGE', maxBytes: 15 * MB, shape: 'wide' },
];

export interface ImagesGroupProps extends GroupProps {
  orgId: string;
  // Không có files.write → ô ảnh chỉ xem.
  canUpload: boolean;
}

// Nhóm "Ảnh": chọn tệp → uploadFile → ghi id vào bản nháp, xem trước dùng signedUrl vừa nhận. Bấm "Lưu hồ sơ" mới gắn.
export function ImagesGroup({ orgId, canUpload, draft, setDraft, errors, disabled }: ImagesGroupProps) {
  return (
    <div className="br-group" data-group="anh">
      <GroupTitle tip="Logo tối đa 2 MB. Ảnh đại diện và ảnh bìa tối đa 15 MB; ảnh bìa nên ngang (3:1). Chỉ nhận ảnh JPG, PNG hoặc WebP. Ảnh chỉ gắn vào hồ sơ khi bấm Lưu hồ sơ.">Ảnh</GroupTitle>
      <div className="ui-img-row br-imgs">
        {SLOTS.map(({ slot, label, purpose, maxBytes, shape }) => (
          <div key={slot} data-field={`${slot}FileId`} className="br-img">
            <ImageUpload
              label={label}
              shape={shape}
              size={96}
              value={draft.images[slot]?.url ?? null}
              maxBytes={maxBytes}
              disabled={disabled || !canUpload}
              error={errors[`${slot}FileId`] ?? null}
              errorMessage={userMessage}
              uploadLabel="Tải ảnh"
              changeLabel="Đổi"
              removeLabel="Bỏ"
              onUpload={async (file) => {
                const f = await uploadFile(orgId, { purpose, name: file.name || label, data: file }, newIdempotencyKey());
                setDraft((d) => ({ ...d, images: { ...d.images, [slot]: { fileId: f.id, url: f.signedUrl, expiresAt: f.signedUrlExpiresAt } } }));
              }}
              onRemove={canUpload ? () => setDraft((d) => ({ ...d, images: { ...d.images, [slot]: null } })) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
