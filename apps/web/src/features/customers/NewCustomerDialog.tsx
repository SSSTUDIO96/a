import { useEffect, useId, useRef, useState } from 'react';
import { fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { createCustomer } from '../../api/schedule';
import type { Customer } from '../../api/types';
import { Button, SettingRow, Textarea, TextInput } from '../../ui';
import { FormDialog, Strip } from '../staff/parts';
import { createInput, draftOf, prefillFromQuery, type CustomerDraft } from './logic';

// Hộp "Khách mới" (C2 2.2): Họ và tên * · Số điện thoại · Email · Ghi chú → POST /customers (Idempotency-Key tạo mới
// mỗi lần mở hộp). Mở từ "Thêm khách "…"": chuỗi đang tìm là số → ô Số điện thoại; là chữ → ô Họ tên.
export interface NewCustomerDialogProps {
  orgId: string;
  open: boolean;
  phone: boolean;
  prefill: string;
  onClose: () => void;
  onCreated: (c: Customer) => void;
}

export function NewCustomerDialog(p: NewCustomerDialogProps) {
  const [d, setD] = useState<CustomerDraft>({ fullName: '', phone: '', email: '', note: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useRef(newIdempotencyKey());
  const ids = { name: useId(), phone: useId(), email: useId(), note: useId() };

  useEffect(() => {
    if (p.open) {
      setD(draftOf(prefillFromQuery(p.prefill)));
      setErrors({});
      setBanner(null);
      key.current = newIdempotencyKey();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);

  if (!p.open) return null;

  function set(k: keyof CustomerDraft, v: string) {
    setD((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  }

  async function submit() {
    if (!d.fullName.trim()) {
      setErrors({ fullName: 'Nhập họ và tên khách.' });
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      p.onCreated(await createCustomer(p.orgId, createInput(d), key.current));
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length > 0) setErrors(fe);
      else setBanner(userMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open
      phone={p.phone}
      onClose={() => !saving && p.onClose()}
      title="Khách mới"
      footer={
        <>
          <Button onClick={p.onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            Thêm khách
          </Button>
        </>
      }
    >
      {banner && <Strip tone="danger" icon="warn">{banner}</Strip>}
      <div className="kh-form">
        <SettingRow label="Họ và tên" htmlFor={ids.name} required controlWidth={360}>
          <TextInput id={ids.name} placeholder="Ví dụ: Nguyễn Thị Mai" value={d.fullName} maxLength={120} disabled={saving} error={errors.fullName || null} onChange={(e) => set('fullName', e.target.value)} />
        </SettingRow>
        <SettingRow label="Số điện thoại" htmlFor={ids.phone} controlWidth={360}>
          <TextInput id={ids.phone} type="tel" inputMode="tel" value={d.phone} maxLength={32} disabled={saving} error={errors.phone || null} onChange={(e) => set('phone', e.target.value)} />
        </SettingRow>
        <SettingRow label="Email" htmlFor={ids.email} controlWidth={360}>
          <TextInput id={ids.email} type="email" value={d.email} disabled={saving} error={errors.email || null} onChange={(e) => set('email', e.target.value)} />
        </SettingRow>
        <SettingRow label="Ghi chú" htmlFor={ids.note} stack>
          <Textarea id={ids.note} rows={2} placeholder="Ví dụ: da nhạy cảm, hẹn qua Zalo" value={d.note} maxLength={2000} disabled={saving} error={errors.note || null} onChange={(e) => set('note', e.target.value)} />
        </SettingRow>
      </div>
    </FormDialog>
  );
}
