import { PRINT_LAYOUT_NAMES, PRINT_LAYOUTS, type PrintLayout } from '@makeup/shared';

const layoutImage = (layout: PrintLayout) => `/mau-in/bo-cuc-${layout}.png`;

// 5 bố cục bằng ảnh nhỏ, chọn một (radio). Tên bố cục luôn có chữ — không chỉ dựa vào ảnh.
export function LayoutPicker({ value, onChange, disabled }: { value: PrintLayout; onChange: (l: PrintLayout) => void; disabled?: boolean }) {
  return (
    <div className="mi-picker" role="radiogroup" aria-label="Bố cục bản in">
      {PRINT_LAYOUTS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`mi-pick${value === n ? ' mi-pick--on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(n)}
        >
          <img src={layoutImage(n)} alt="" width={72} height={102} loading="lazy" />
          <span className="mi-pick__n">
            {n}. {PRINT_LAYOUT_NAMES[n]}
          </span>
        </button>
      ))}
    </div>
  );
}
