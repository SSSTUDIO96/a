import { describe, expect, it } from 'vitest';
import { DEFAULT_OCCASIONS, isOccasionColor, MAX_OCCASIONS, OCCASION_COLORS } from './occasions';

describe('loại sự kiện — hằng dùng chung', () => {
  it('GIỮ: đúng 12 tên màu của Lịch, đúng thứ tự SWATCHES và CHECK occasions_color (bản vẽ D 1.4)', () => {
    expect([...OCCASION_COLORS]).toEqual(['rose', 'violet', 'amber', 'green', 'blue', 'taupe', 'brick', 'petrol', 'olive', 'plum', 'forest', 'brown']);
  });
  it('BẮT: 12 màu không trùng nhau', () => {
    expect(new Set(OCCASION_COLORS).size).toBe(OCCASION_COLORS.length);
  });
  it('GIỮ: 6 loại mặc định đúng tên, đúng màu, đúng thứ tự', () => {
    expect(DEFAULT_OCCASIONS).toEqual([
      { name: 'Ăn hỏi', color: 'amber' },
      { name: 'Lễ vu quy', color: 'taupe' },
      { name: 'Lễ cưới', color: 'rose' },
      { name: 'Tiệc', color: 'violet' },
      { name: 'Pre-wedding', color: 'green' },
      { name: 'Kỷ yếu', color: 'blue' },
    ]);
  });
  it('BẮT: loại mặc định chỉ dùng màu có trong danh sách, không trùng tên (unique organization_id + name), tên hợp CHECK occasions_name', () => {
    for (const o of DEFAULT_OCCASIONS) {
      expect(OCCASION_COLORS).toContain(o.color);
      expect(o.name).toBe(o.name.trim());
      expect(o.name.length).toBeGreaterThanOrEqual(1);
      expect(o.name.length).toBeLessThanOrEqual(60);
    }
    expect(new Set(DEFAULT_OCCASIONS.map((o) => o.name)).size).toBe(DEFAULT_OCCASIONS.length);
    expect(new Set(DEFAULT_OCCASIONS.map((o) => o.color)).size).toBe(DEFAULT_OCCASIONS.length);
    expect(DEFAULT_OCCASIONS.length).toBeLessThanOrEqual(MAX_OCCASIONS);
  });
  it('GIỮ / BẮT: isOccasionColor', () => {
    for (const c of OCCASION_COLORS) expect(isOccasionColor(c)).toBe(true);
    for (const bad of ['red', 'other', 'Rose', '', null, undefined, 3]) expect(isOccasionColor(bad)).toBe(false);
  });
  it('GIỮ: trần 50 loại', () => {
    expect(MAX_OCCASIONS).toBe(50);
  });
});
