// LOẠI SỰ KIỆN (bản vẽ D mục 2.2): ăn hỏi, lễ vu quy, lễ cưới… — studio tự đặt, gắn ở DÒNG hợp đồng. Một nguồn cho
// máy chủ (CHECK occasions_color ở migration 20261019130000 ghi đúng 12 tên này), web (SWATCHES ở
// apps/web/src/features/schedule/model.ts nhập từ đây) và bộ cài sẵn cho tổ chức mới / sync-system-roles.

// Đúng 12 tên màu của Lịch, ĐÚNG thứ tự SWATCHES hiện có (6 màu đầu người dùng đã quen). Đổi danh sách thì đổi cả CHECK
// occasions_color bằng migration mới.
export const OCCASION_COLORS = [
  'rose',
  'violet',
  'amber',
  'green',
  'blue',
  'taupe',
  'brick',
  'petrol',
  'olive',
  'plum',
  'forest',
  'brown',
] as const;
export type OccasionColor = (typeof OCCASION_COLORS)[number];

// Trần số loại sự kiện của một tổ chức (POST thứ 51 → 409 "Tối đa 50 loại sự kiện").
export const MAX_OCCASIONS = 50;

// 6 loại cài sẵn cho tổ chức mới (cùng transaction tạo tổ chức) và bù cho tổ chức cũ chưa có loại nào.
export const DEFAULT_OCCASIONS: readonly { readonly name: string; readonly color: OccasionColor }[] = [
  { name: 'Ăn hỏi', color: 'amber' },
  { name: 'Lễ vu quy', color: 'taupe' },
  { name: 'Lễ cưới', color: 'rose' },
  { name: 'Tiệc', color: 'violet' },
  { name: 'Pre-wedding', color: 'green' },
  { name: 'Kỷ yếu', color: 'blue' },
];

export function isOccasionColor(value: unknown): value is OccasionColor {
  return typeof value === 'string' && (OCCASION_COLORS as readonly string[]).includes(value);
}
