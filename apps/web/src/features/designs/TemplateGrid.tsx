import type { ContractKindKey, DesignKind } from '../../api/designs';
import { WithTooltip } from '../../ui';
import { templateChoices, thumbnailUrl } from './model';

// Cột chọn mẫu: hướng lọc ("Hợp với hợp đồng này" / "Tất cả mẫu") + lưới ảnh nhỏ. Mẫu không hợp loại hợp đồng hiện mờ,
// không chọn được, lý do ở tooltip. Ảnh nhỏ là ảnh mẫu R&D vẽ (chữ mẫu), không phải dữ liệu của hợp đồng.
export function TemplateGrid({
  kind,
  contractKind,
  scope,
  onScope,
  value,
  onChange,
  error,
}: {
  kind: DesignKind;
  contractKind: ContractKindKey;
  scope: 'fit' | 'all';
  onScope: (s: 'fit' | 'all') => void;
  value: string | null;
  onChange: (code: string) => void;
  error?: string;
}) {
  const fit = templateChoices(kind, contractKind, 'fit');
  const all = templateChoices(kind, contractKind, 'all');
  const list = scope === 'fit' ? fit : all;
  return (
    <section className="ui-card mtk-grid" aria-label="Chọn mẫu">
      <div className="mtk-grid__scope" role="tablist" aria-label="Phạm vi mẫu">
        {(
          [
            ['fit', 'Hợp với hợp đồng này', fit.length],
            ['all', 'Tất cả mẫu', all.length],
          ] as const
        ).map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={scope === k} className="mtk-grid__tab" onClick={() => onScope(k)}>
            <span>{label}</span>
            <span className="mtk-grid__n num">{n}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="mtk-err" role="alert">
          {error}
        </p>
      )}
      <ul className="mtk-grid__list">
        {list.map(({ template: t, enabled, reason }) => {
          const btn = (
            <button
              type="button"
              className="mtk-thumb"
              aria-pressed={value === t.code}
              aria-disabled={!enabled || undefined}
              aria-label={`${t.code} · ${t.name}${enabled ? '' : ` — ${reason ?? ''}`}`}
              onClick={() => enabled && onChange(t.code)}
            >
              <img src={thumbnailUrl(t, contractKind)} alt="" loading="lazy" width={216} height={270} />
              <span className="mtk-thumb__code">{t.code}</span>
            </button>
          );
          return <li key={t.code}>{enabled ? btn : <WithTooltip text={reason}>{btn}</WithTooltip>}</li>;
        })}
      </ul>
    </section>
  );
}
