import { useEffect, useState } from 'react';
import { Button, Dialog, IconClose, MoneyInput, Qty, SettingRow, StatusTag, Textarea, formatVnd } from '../../ui';
import { IconWarn } from './icons';
import { removedText, skippedText, type AutoNotes, type ContractLineView, type PlacedDraft, type SurchargeOverrideDraft } from './model';

// Dòng phụ phí TỰ THÊM theo luật dưới một dòng gói (bản vẽ D 3.4). Số tiền là số máy chủ trả (quote hoặc hợp đồng đã lưu) —
// màn không tự cộng / nhân. Người lập bỏ được ("×"), sửa số lượng / giá được (giá bắt buộc ghi lý do), áp lại được.
// Hợp đồng đã chốt: chỉ xem; huỷ dòng kèm lý do qua `onVoid` (quyền contracts.adjust).

type RowView = ContractLineView<string | null>;

export const TIP_DISMISS = 'Bỏ phụ phí này ở dòng này — sẽ không tự thêm lại';

export interface AutoSurchargeRowsProps {
  rows: readonly RowView[];
  line: Pick<PlacedDraft, 'quantity' | 'dismissedRuleIds' | 'surchargeOverrides'>;
  ruleName: (ruleId: string) => string;
  // Luật tính theo số lượng dòng không (null = không biết luật).
  perQuantityOf: (ruleId: string) => boolean | null;
  notes: AutoNotes | undefined;
  // edit = nháp còn sửa được; view = đã chốt hoặc không có quyền sửa.
  mode: 'edit' | 'view';
  pending: boolean;
  noteError: (overrideIndex: number) => string | undefined;
  onDismiss: (ruleId: string, ruleName: string) => void;
  onRestore: (ruleId: string) => void;
  onOverride: (ruleId: string, override: SurchargeOverrideDraft | null) => void;
  onVoid: ((row: RowView) => void) | null;
}

export function AutoSurchargeRows(p: AutoSurchargeRowsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const edit = p.mode === 'edit';
  const dismissed = edit ? p.line.dismissedRuleIds : [];
  const skipped = edit ? (p.notes?.skipped ?? []) : [];
  const removed = edit ? (p.notes?.removed ?? []) : [];
  if (p.rows.length === 0 && dismissed.length === 0 && skipped.length === 0 && removed.length === 0) return null;
  const editRow = editing ? (p.rows.find((r) => r.surchargeRuleId === editing) ?? null) : null;
  return (
    <div className="ct-sr" aria-label="Phụ phí tự thêm" aria-busy={p.pending || undefined} data-o="phu-phi-tu-them">
      {p.rows.map((r) => {
        const ruleId = r.surchargeRuleId;
        const voided = Boolean(r.voidedAt);
        const k = ruleId ? p.line.surchargeOverrides.findIndex((o) => o.ruleId === ruleId) : -1;
        const ov = k >= 0 ? p.line.surchargeOverrides[k] : undefined;
        const priceEdited = r.priceVersionId === null || (ov?.unitPrice ?? null) !== null;
        const qtyEdited = (ov?.quantity ?? null) !== null;
        const name = ruleId ? p.ruleName(ruleId) : (r.surchargeRuleName ?? '');
        const err = k >= 0 ? p.noteError(k) : undefined;
        return (
          <div className={`ct-sr__r${voided ? ' ct-sr__r--void' : ''}`} key={r.id ?? `${ruleId}-${r.name}`} data-rule={ruleId ?? undefined}>
            <div className="ct-sr__main">
              <span className={`ct-sr__n${voided ? ' ct-strike' : ''}`}>
                {r.name}
                {r.quantity > 1 ? ` × ${r.quantity}` : ''}
              </span>
              <b className={`ct-num ct-pend${voided ? ' ct-strike' : ''}`}>{formatVnd(r.lineTotal)}</b>
            </div>
            <div className="ct-sr__sub">
              <span className="ct-sr__why">
                tự thêm theo luật {name}
                {priceEdited ? ' · đã sửa giá' : ''}
                {qtyEdited ? ' · đã sửa số lượng' : ''}
              </span>
              {voided && <StatusTag tone="danger">Đã huỷ: {r.voidReason}</StatusTag>}
              <span className="ct-sr__act">
                {edit && ruleId && (
                  <>
                    <Button variant="ghost" size="sm" aria-label={`Sửa phụ phí ${r.name}`} onClick={() => setEditing(ruleId)}>
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconClose />}
                      aria-label={`Bỏ phụ phí ${r.name} ở dòng này`}
                      title={TIP_DISMISS}
                      onClick={() => p.onDismiss(ruleId, name)}
                    />
                  </>
                )}
                {!edit && p.onVoid && !voided && (
                  <Button variant="ghost" size="sm" title="Huỷ phụ phí này (bắt buộc ghi lý do)" onClick={() => p.onVoid?.(r)}>
                    Huỷ dòng
                  </Button>
                )}
              </span>
            </div>
            {(ov?.note ?? '').trim() !== '' && <div className="ct-fx ct-sr__note">Lý do: {ov?.note}</div>}
            {edit && !ov && r.note && <div className="ct-fx ct-sr__note">Lý do: {r.note}</div>}
            {err && <div className="ct-err">{err}</div>}
          </div>
        );
      })}
      {dismissed.map((id) => (
        <div className="ct-sr__r ct-sr__r--off" key={`off-${id}`} data-rule={id}>
          <span className="ct-sr__why">Đã bỏ: {p.ruleName(id)}</span>
          <Button variant="ghost" size="sm" title="Cho luật này tự thêm lại ở dòng này (nếu dòng còn khớp luật)" onClick={() => p.onRestore(id)}>
            Áp lại
          </Button>
        </div>
      ))}
      {skipped.map((s) => (
        <div className={`ct-sr__skip${s.reason === 'SAME_SERVICE' ? ' ct-sr__skip--info' : ''}`} key={`sk-${s.ruleId}`} role="status" data-skip={s.reason}>
          <IconWarn />
          <span>{skippedText(s)}</span>
        </div>
      ))}
      {removed.map((r) => (
        <div className="ct-sr__skip" key={`rm-${r.ruleId}`} role="status" data-removed={r.reason}>
          <IconWarn />
          <span>{removedText(r)}</span>
        </div>
      ))}
      {editRow && editing && (
        <OverrideDialog
          row={editRow}
          ruleName={p.ruleName(editing)}
          lineQuantity={p.line.quantity}
          perQuantity={p.perQuantityOf(editing)}
          current={p.line.surchargeOverrides.find((o) => o.ruleId === editing) ?? null}
          onClose={() => setEditing(null)}
          onSave={(o) => {
            p.onOverride(editing, o);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function OverrideDialog(p: {
  row: RowView;
  ruleName: string;
  lineQuantity: number;
  perQuantity: boolean | null;
  current: SurchargeOverrideDraft | null;
  onClose: () => void;
  onSave: (o: SurchargeOverrideDraft | null) => void;
}) {
  const { row, current } = p;
  const [qty, setQty] = useState(row.quantity);
  const [price, setPrice] = useState<number | null>(current?.unitPrice ?? null);
  const [note, setNote] = useState(current?.note ?? '');
  const [noteErr, setNoteErr] = useState<string | null>(null);
  useEffect(() => setNoteErr(null), [price]);
  const ruleId = row.surchargeRuleId ?? '';

  function save() {
    if (price !== null && note.trim() === '') {
      setNoteErr('Ghi đè giá phải ghi lý do.');
      return;
    }
    // Số lượng: không đổi so với đang hiện thì giữ nguyên tình trạng cũ; đổi về số mặc định của luật thì thôi sửa.
    const dflt = p.perQuantity === null ? null : p.perQuantity ? p.lineQuantity : 1;
    const quantity = qty === row.quantity ? (current?.quantity ?? null) : dflt !== null && qty === dflt ? null : qty;
    if (quantity === null && price === null) {
      p.onSave(null);
      return;
    }
    p.onSave({ ruleId, quantity, unitPrice: price, note: price === null ? '' : note.trim() });
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={p.onClose}
      eyebrow={`Theo luật ${p.ruleName}`}
      title={row.name}
      footer={
        <>
          {current && (
            <Button variant="ghost" style={{ marginRight: 'auto' }} onClick={() => p.onSave(null)}>
              Về theo luật
            </Button>
          )}
          <Button onClick={p.onClose}>Huỷ</Button>
          <Button variant="primary" onClick={save}>
            Lưu
          </Button>
        </>
      }
    >
      <SettingRow label="Số lượng">
        <Qty value={qty} onChange={setQty} label="Số lượng phụ phí" />
      </SettingRow>
      <SettingRow label="Giá" tip="Để trống = theo bảng giá. Nhập giá khác thì phải ghi lý do ở Ghi chú." controlWidth={180}>
        <MoneyInput
          aria-label="Giá phụ phí"
          value={price}
          onChange={setPrice}
          placeholder={row.priceVersionId !== null ? `Theo bảng giá ${formatVnd(row.unitPrice)}` : 'Theo bảng giá'}
        />
      </SettingRow>
      <SettingRow label="Lý do" required={price !== null} stack>
        <Textarea aria-label="Lý do sửa giá" rows={2} value={note} onChange={(e) => setNote(e.target.value)} error={noteErr ?? undefined} />
      </SettingRow>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Thông báo nhỏ 5 giây ("Đã tự thêm … theo luật …").
export interface SurchargeToast {
  id: number;
  text: string;
}

export const TOAST_MS = 5000;

function ToastItem({ toast, onDone }: { toast: SurchargeToast; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(toast.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast.id, onDone]);
  return (
    <div className="ct-toast" data-o="thong-bao-phu-phi">
      <span>{toast.text}</span>
      <button type="button" className="ct-toast__x" aria-label="Đóng thông báo" onClick={() => onDone(toast.id)}>
        <IconClose />
      </button>
    </div>
  );
}

export function SurchargeToasts({ items, onDone }: { items: readonly SurchargeToast[]; onDone: (id: number) => void }) {
  return (
    <div className="ct-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={onDone} />
      ))}
    </div>
  );
}
