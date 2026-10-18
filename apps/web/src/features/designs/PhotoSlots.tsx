import { uploadDesignFile } from '../../api/designs';
import { userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { IconClose, ImageUpload } from '../../ui';
import type { PhotoRule } from './model';

export interface PhotoItem {
  fileId: string;
  // blob: URL của chính tệp vừa chọn (xem trước + đưa vào tệp vẽ, không phải tải lại từ máy chủ).
  url: string;
  name: string;
}

const MB = 1024 * 1024;

// Ô ảnh 1–3 (C3 2.6): ảnh đã thêm có nút × bỏ ảnh; ô "Thêm ảnh" nét đứt có vòng quay khi đang tải lên.
// Số ô theo photos.max của mẫu. Không có quyền tải tệp → không có ô thêm ảnh.
export function PhotoSlots({
  orgId,
  rule,
  items,
  onChange,
  canUpload,
  error,
}: {
  orgId: string;
  rule: PhotoRule;
  items: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
  canUpload: boolean;
  error?: string;
}) {
  async function upload(file: File) {
    const f = await uploadDesignFile(orgId, 'DESIGN_PHOTO', file.name.slice(0, 200) || 'anh.jpg', file, newIdempotencyKey());
    onChange([...items, { fileId: f.id, url: URL.createObjectURL(file), name: f.originalName }]);
  }
  function remove(i: number) {
    const it = items[i];
    if (it) URL.revokeObjectURL(it.url);
    onChange(items.filter((_, k) => k !== i));
  }
  return (
    <div className="mtk-photos">
      <ul className="mtk-photos__list">
        {items.map((p, i) => (
          <li key={p.fileId} className="mtk-photo">
            <img src={p.url} alt={`Ảnh ${i + 1}`} />
            <button type="button" className="mtk-photo__x" aria-label={`Bỏ ảnh ${i + 1}`} onClick={() => remove(i)}>
              <IconClose />
            </button>
          </li>
        ))}
        {canUpload && items.length < rule.max && (
          <li>
            <ImageUpload
              key={items.length}
              value={null}
              size={88}
              label={`Ảnh ${items.length + 1}`}
              uploadLabel="Thêm ảnh"
              maxBytes={15 * MB}
              onUpload={upload}
              errorMessage={userMessage}
            />
          </li>
        )}
      </ul>
      <p className={error ? 'mtk-err' : 'mtk-hint'} role={error ? 'alert' : undefined}>
        {error ?? `${rule.text} · đã có ${items.length}`}
      </p>
      {!canUpload && rule.max > 0 && <p className="mtk-hint">Bạn chưa có quyền tải ảnh lên.</p>}
    </div>
  );
}
