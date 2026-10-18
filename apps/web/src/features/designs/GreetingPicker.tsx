import { useId } from 'react';
import type { GreetingPhrase } from '../../api/designs';

// Câu chúc soạn sẵn (GreetingPhrase, đã lọc theo loại hợp đồng): chọn một câu → điền Tiêu đề và Lời chúc, sửa tiếp được.
export function GreetingPicker({
  phrases,
  value,
  onPick,
}: {
  phrases: readonly GreetingPhrase[];
  value: string | null;
  onPick: (p: GreetingPhrase) => void;
}) {
  const name = useId();
  if (phrases.length === 0) return <p className="mtk-hint">Chưa có câu chúc soạn sẵn cho loại hợp đồng này.</p>;
  return (
    <div className="mtk-phrases" role="radiogroup" aria-label="Câu chúc soạn sẵn">
      {phrases.map((p) => (
        <label key={p.id} className="mtk-phrase" data-on={value === p.id || undefined}>
          <input type="radio" name={name} checked={value === p.id} onChange={() => onPick(p)} />
          <span>
            <b>{p.name}</b>
            <small>{p.title}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
