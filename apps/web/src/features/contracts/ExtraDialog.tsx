import { useEffect, useState } from 'react';
import { userMessage } from '../../api/errors';
import type { Service } from '../../api/types';
import { Button, Dialog, MoneyInput, Qty, Select, SettingRow, TextInput, Textarea, formatVnd } from '../../ui';
import { newLineKey, type CustomDraft, type SurchargeDraft } from './model';

// Hộp thêm/sửa một khoản ngoài gói: phụ phí cài sẵn (ghi đè giá bắt buộc ghi chú) hoặc khoản tự đặt tên.
export type ExtraTarget =
  | { kind: 'SURCHARGE'; line: SurchargeDraft | null; presetServiceId?: string }
  | { kind: 'CUSTOM'; line: CustomDraft | null };

export interface ExtraDialogProps {
  target: ExtraTarget | null;
  surcharges: Service[];
  onClose: () => void;
  // Trả lỗi (chuỗi) để giữ hộp mở, hoặc null khi xong.
  onSave: (line: SurchargeDraft | CustomDraft) => Promise<string | null> | string | null;
  onRemove?: (key: string) => void;
  saveLabel: string;
}

export function ExtraDialog({ target, surcharges, onClose, onSave, onRemove, saveLabel }: ExtraDialogProps) {
  const [serviceId, setServiceId] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setErrors({});
    setBusy(false);
    if (target.kind === 'SURCHARGE') {
      setServiceId(target.line?.serviceId ?? target.presetServiceId ?? '');
      setQty(target.line?.quantity ?? 1);
      setPrice(target.line?.unitPrice ?? null);
      setNote(target.line?.note ?? '');
    } else {
      setName(target.line?.name ?? '');
      setQty(target.line?.quantity ?? 1);
      setPrice(target.line?.unitPrice ?? null);
      setNote(target.line?.note ?? '');
    }
  }, [target]);

  if (!target) return null;
  const svc = surcharges.find((s) => s.id === serviceId) ?? null;
  const editing = target.line !== null;

  async function save() {
    if (!target) return;
    const e: Record<string, string> = {};
    let line: SurchargeDraft | CustomDraft;
    if (target.kind === 'SURCHARGE') {
      if (!serviceId) e.serviceId = 'Chọn phụ phí.';
      if (price !== null && note.trim() === '') e.note = 'Ghi đè giá phải ghi lý do.';
      line = {
        key: target.line?.key ?? newLineKey(),
        kind: 'SURCHARGE',
        serviceId,
        name: svc?.name ?? target.line?.name ?? '',
        quantity: qty,
        unitPrice: price,
        note,
      };
    } else {
      if (name.trim() === '') e.name = 'Nhập tên khoản.';
      if (price === null) e.unitPrice = 'Nhập số tiền.';
      line = { key: target.line?.key ?? newLineKey(), kind: 'CUSTOM', name, unitPrice: price, quantity: qty, note };
    }
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setBusy(true);
    try {
      const err = await onSave(line);
      if (err) setErrors({ form: err });
    } catch (err) {
      setErrors({ form: userMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const title = target.kind === 'SURCHARGE' ? (target.line?.name ?? 'Phụ phí cài sẵn') : 'Khoản tự đặt tên';
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title={title}
      footer={
        <>
          {editing && onRemove && target.line && (
            <Button variant="ghost" style={{ marginRight: 'auto' }} onClick={() => onRemove(target.line!.key)}>
              Bỏ khoản này
            </Button>
          )}
          <Button onClick={onClose}>Huỷ</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {saveLabel}
          </Button>
        </>
      }
    >
      {target.kind === 'SURCHARGE' ? (
        <>
          {!editing && (
            <SettingRow label="Phụ phí" controlWidth={220}>
              <Select
                aria-label="Phụ phí"
                placeholder="Chọn phụ phí"
                value={serviceId}
                options={surcharges.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(ev) => setServiceId(ev.target.value)}
                error={errors.serviceId}
              />
            </SettingRow>
          )}
          <SettingRow label="Số lượng">
            <Qty value={qty} onChange={setQty} label="Số lượng" />
          </SettingRow>
          <SettingRow label="Giá" tip="Để trống = theo bảng giá. Nhập giá khác thì phải ghi lý do ở Ghi chú." controlWidth={180}>
            <MoneyInput
              aria-label="Giá"
              value={price}
              onChange={setPrice}
              placeholder={svc?.currentPrice ? `Theo bảng giá ${formatVnd(svc.currentPrice.unitPrice)}` : 'Theo bảng giá'}
            />
          </SettingRow>
        </>
      ) : (
        <>
          <SettingRow label="Tên khoản" controlWidth={240}>
            <TextInput aria-label="Tên khoản" value={name} onChange={(ev) => setName(ev.target.value)} error={errors.name} />
          </SettingRow>
          <SettingRow label="Số tiền" controlWidth={180}>
            <MoneyInput aria-label="Số tiền" value={price} onChange={setPrice} error={errors.unitPrice} />
          </SettingRow>
          <SettingRow label="Số lượng">
            <Qty value={qty} onChange={setQty} label="Số lượng" />
          </SettingRow>
        </>
      )}
      <SettingRow label="Ghi chú" required={target.kind === 'SURCHARGE' && price !== null} stack>
        <Textarea aria-label="Ghi chú" rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} error={errors.note} />
      </SettingRow>
      {errors.form && (
        <div className="ct-err" role="alert">
          {errors.form}
        </div>
      )}
    </Dialog>
  );
}
