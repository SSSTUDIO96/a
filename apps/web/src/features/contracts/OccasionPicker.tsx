import { Link } from 'react-router';
import type { OccasionView } from '../../api/types';
import { Select } from '../../ui';

// Ô "Sự kiện" của dòng đặt chỗ (bản vẽ D 3.4): chọn trong danh sách loại sự kiện của studio, có chấm màu của loại.
// Chỉ loại đang bật để chọn; dòng đã lưu mang loại đang ẩn vẫn hiện tên đã chụp (mờ, kèm "đang ẩn") để không mất thông tin.

export interface OccasionPickerProps {
  value: string | null;
  // Loại sự kiện đang bật của tổ chức (GET /occasions?isActive=true).
  // null = chưa biết danh sách (không có quyền đọc Bảng giá): chỉ hiện tên đã lưu của dòng.
  options: readonly OccasionView[] | null;
  // Tên loại lưu trên dòng (bản chụp) — dùng khi loại của dòng không còn trong `options` (đã ẩn).
  savedName: string | null;
  onChange: (occasionId: string | null) => void;
  // Khoá (hợp đồng đã chốt / không có quyền sửa): chỉ hiện chữ.
  disabled: boolean;
  // Liên kết "Sửa danh sách" → Bảng giá → Loại sự kiện (chỉ khi catalog.write).
  listHref: string | null;
  error?: string;
}

export const OCCASION_TIP = 'Dùng để tô màu ca trên Lịch và để áp luật phụ phí theo sự kiện';

export function OccasionPicker({ value, options, savedName, onChange, disabled, listHref, error }: OccasionPickerProps) {
  const found = value && options ? (options.find((o) => o.id === value) ?? null) : null;
  const hidden = value !== null && found === null && options !== null;
  const name = found?.name ?? (value !== null ? (savedName ?? 'Sự kiện đã chọn') : null);
  const dot = (
    <span
      className={`ct-oc__dot${found ? ` ct-oc--${found.color}` : ' ct-oc--none'}`}
      aria-hidden="true"
      data-color={found?.color ?? 'none'}
    />
  );
  if (disabled) {
    return (
      <span className="ct-oc ct-oc--ro" data-o="su-kien">
        {dot}
        <span className={name ? undefined : 'ct-faint'}>{name ? `${name}${hidden ? ' (đang ẩn)' : ''}` : 'Chưa chọn sự kiện'}</span>
      </span>
    );
  }
  const opts = [
    { value: '', label: 'Chưa chọn sự kiện' },
    ...(options ?? []).map((o) => ({ value: o.id, label: o.name })),
    ...(hidden && value ? [{ value, label: `${name ?? ''} (đang ẩn)`, disabled: true }] : []),
  ];
  return (
    <div className="ct-oc" data-o="su-kien">
      {dot}
      <Select
        size="sm"
        className="ct-oc__sel"
        aria-label="Sự kiện"
        value={value ?? ''}
        options={opts}
        onChange={(e) => onChange(e.target.value || null)}
        error={error ?? (hidden ? 'Loại sự kiện này đang ẩn. Chọn loại khác hoặc bỏ chọn thì mới lưu được.' : undefined)}
      />
      {listHref && (
        <Link className="ct-lnk ct-oc__ed" to={listHref}>
          Sửa danh sách
        </Link>
      )}
    </div>
  );
}
