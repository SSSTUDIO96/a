// Trục biểu đồ doanh thu (đơn vị triệu đồng) — hàm thuần, thử được không cần màn.
export const MILLION = 1_000_000;

/** Trục: 4 vạch đều, bước "đẹp" (1 · 2 · 2,5 · 5 × 10ⁿ triệu). */
export function axisMax(maxValue: number): { max: number; step: number } {
  const target = Math.max(maxValue, 0) / MILLION / 4;
  if (target <= 0) return { max: 4 * MILLION, step: MILLION };
  const pow = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= target) ?? 10 * pow;
  return { max: step * 4 * MILLION, step: step * MILLION };
}

