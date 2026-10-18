import { Button, IconPlus, StatusTag, formatVnd } from '../../ui';
import type { LineViewExt } from './model';

// Thẻ "Phụ phí & khoản khác" (bản vẽ 4.3). Phụ phí không gắn dưới gói (API không có dòng cha cho SURCHARGE).
export interface ExtraRow {
  key: string;
  kind: 'SURCHARGE' | 'CUSTOM';
  name: string;
  quantity: number;
  note: string | null;
  view: LineViewExt<string | null> | null;
  // "Phát sinh 23/10/2026" khi máy chủ trả addedAfterConfirm.
  addedLabel: string | null;
  error: string | null;
}

export interface ExtrasCardProps {
  rows: ExtraRow[];
  pending: boolean;
  onEdit: ((key: string) => void) | null;
  onVoid: ((key: string) => void) | null;
  onAddSurcharge: (() => void) | null;
  onAddCustom: (() => void) | null;
}

export function ExtrasCard({ rows, pending, onEdit, onVoid, onAddSurcharge, onAddCustom }: ExtrasCardProps) {
  if (rows.length === 0 && !onAddSurcharge && !onAddCustom) return null;
  return (
    <section className="ct-ln" aria-label="Phụ phí & khoản khác" aria-busy={pending || undefined}>
      <div className="ct-ln__hd">
        <span className="ct-ln__n">Phụ phí &amp; khoản khác</span>
      </div>
      {rows.map((r) => {
        const voided = Boolean(r.view?.voidedAt);
        return (
          <div className="ct-xr" key={r.key}>
            <div className="ct-xr__n">
              {r.addedLabel ? (
                <StatusTag tone="warn">{r.addedLabel}</StatusTag>
              ) : (
                <StatusTag>{r.kind === 'CUSTOM' ? 'Tự đặt tên' : 'Phụ phí'}</StatusTag>
              )}
              <span className={voided ? 'ct-strike' : undefined}>
                {r.name}
                {r.quantity > 1 ? ` × ${r.quantity}` : ''}
              </span>
              {voided && (
                <>
                  {' '}
                  <StatusTag tone="danger">Đã huỷ: {r.view?.voidReason}</StatusTag>
                </>
              )}
              {r.note && <span className="ct-fx" style={{ display: 'block' }}>{r.note}</span>}
              {r.error && <span className="ct-err" style={{ display: 'block' }}>{r.error}</span>}
            </div>
            <div className="ct-xr__r">
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(r.key)} aria-label={`Sửa ${r.name}`}>
                  Sửa
                </Button>
              )}
              {onVoid && !voided && (
                <Button variant="ghost" size="sm" onClick={() => onVoid(r.key)}>
                  Huỷ dòng
                </Button>
              )}
              <b className={`ct-num ct-pend${voided ? ' ct-strike' : ''}`}>{r.view ? formatVnd(r.view.lineTotal) : '—'}</b>
            </div>
          </div>
        );
      })}
      {(onAddSurcharge || onAddCustom) && (
        <div className="ct-xr__add">
          {onAddSurcharge && (
            <Button variant="ghost" size="sm" icon={<IconPlus />} onClick={onAddSurcharge}>
              Phụ phí cài sẵn
            </Button>
          )}
          {onAddCustom && (
            <Button variant="ghost" size="sm" icon={<IconPlus />} onClick={onAddCustom}>
              Khoản tự đặt tên
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
