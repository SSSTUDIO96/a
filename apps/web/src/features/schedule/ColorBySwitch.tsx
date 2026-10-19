// Công tắc "Tô màu" (bản vẽ D 3.5): "Sự kiện" / "Nhân vật". Máy tính: nhãn "Tô màu" + nhóm nút trước nhóm chế độ.
// Điện thoại (390): một nút biểu tượng bảng màu mở ngăn kéo đáy hai lựa chọn. Mặc định "Nhân vật", KHÔNG nhớ lựa chọn.
import { useState } from 'react';
import { BottomSheet, Button, Segmented, WithTooltip } from '../../ui';
import { COLOR_BY_OPTIONS, COLOR_BY_TIP, type ColorBy } from './model';
import { cx } from './parts';

const LABEL: Record<ColorBy, string> = { occasion: 'Sự kiện', subject: 'Nhân vật' };
const HINT: Record<ColorBy, string> = {
  occasion: 'Màu theo loại sự kiện của dòng hợp đồng (Lễ cưới, Ăn hỏi…). Ca chưa chọn sự kiện tô trắng có viền.',
  subject: 'Màu theo nhân vật trên dòng hợp đồng (Cô dâu, Mẹ cô dâu…). Màu đang dùng từ trước tới nay.',
};

function IconPalette() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.6 0-.9.7-1.5 1.6-1.5H16a4.5 4.5 0 0 0 4.5-4.5C20.5 5.9 16.8 3.5 12 3.5Z" />
      <circle cx="7.8" cy="11.2" r="1" />
      <circle cx="10.4" cy="7.6" r="1" />
      <circle cx="14.8" cy="7.8" r="1" />
    </svg>
  );
}

export function ColorBySwitch({ value, onChange, phone }: { value: ColorBy; onChange: (v: ColorBy) => void; phone: boolean }) {
  const [open, setOpen] = useState(false);
  if (!phone) {
    return (
      <div className="ws-colorby" data-testid="to-mau">
        <span className="ws-colorby__lbl" id="ws-colorby-lbl">
          Tô màu
        </span>
        <WithTooltip text={COLOR_BY_TIP}>
          <Segmented<ColorBy>
            aria-labelledby="ws-colorby-lbl"
            size="sm"
            value={value}
            onChange={onChange}
            options={COLOR_BY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            className="ws-colorby__seg"
          />
        </WithTooltip>
      </div>
    );
  }
  return (
    <>
      <Button
        size="sm"
        icon={<IconPalette />}
        aria-label={`Tô màu theo ${LABEL[value].toLocaleLowerCase('vi')}. Đổi cách tô màu`}
        title={COLOR_BY_TIP}
        className={cx(value === 'occasion' && 'ws-filter-on')}
        onClick={() => setOpen(true)}
        data-testid="to-mau-nut"
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Tô màu ca theo">
        <div className="ws-colorby-sheet" role="radiogroup" aria-label="Tô màu ca theo">
          {COLOR_BY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={o.value === value}
              className={cx('ws-colorby-sheet__opt', o.value === value && 'is-on')}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <b>{o.label}</b>
              <span>{HINT[o.value]}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
