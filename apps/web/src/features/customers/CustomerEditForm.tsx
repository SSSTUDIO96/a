import { useId, useState } from 'react';
import { fieldErrors, userMessage } from '../../api/errors';
import { uploadFile } from '../../api/files';
import { newIdempotencyKey } from '../../api/idempotency';
import { updateCustomer } from '../../api/schedule';
import type { Customer } from '../../api/types';
import { Avatar, Button, ImageUpload, SettingRow, Textarea, TextInput } from '../../ui';
import { Strip } from '../staff/parts';
import { customerPatch, draftOf, initialsOf, type CustomerDraft } from './logic';

// Sửa tại chỗ (C2 2.2 #c-sua): Họ và tên * · Số điện thoại ? · Email · Ghi chú. Lưu = PATCH chỉ trường đã đổi;
// xoá trắng ô = gửi null. Ô "Ảnh đại diện" (có files.write): tải ảnh lên ngay (CUSTOMER_AVATAR), mã tệp đi theo PATCH khi bấm Lưu; Bỏ ảnh = avatarFileId null. Lỗi 400 hiện dưới ô (chữ máy chủ); lỗi mạng giữ chữ đang gõ.
export function CustomerEditForm({ orgId, c, canFiles, onCancel, onSaved }: { orgId: string; c: Customer; canFiles: boolean; onCancel: () => void; onSaved: (c: Customer) => void }) {
  const [d, setD] = useState<CustomerDraft>(() => draftOf(c));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(c.avatarFileId);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(c.avatarUrl);
  const ids = { name: useId(), phone: useId(), email: useId(), note: useId() };

  function set(k: keyof CustomerDraft, v: string) {
    setD((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  }

  async function save() {
    if (!d.fullName.trim()) {
      setErrors({ fullName: 'Nhập họ và tên khách.' });
      return;
    }
    const patch = customerPatch(c, d, canFiles ? avatarId : undefined);
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      onSaved(await updateCustomer(orgId, c.id, patch));
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length > 0) setErrors(fe);
      else setBanner(userMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ui-card kh-edit" aria-label="Sửa thông tin khách">
      <header className="ui-card__head">
        <h2 className="ui-card__title">Thông tin khách</h2>
      </header>
      <div className="ui-card__body">
        {banner && <Strip tone="danger" icon="warn">{banner}</Strip>}
        {canFiles && (
          <ImageUpload
            className="kh-edit__img"
            layout="inline"
            shape="round"
            size={72}
            label="Ảnh đại diện"
            value={avatarUrl}
            disabled={saving}
            emptyContent={<Avatar name={d.fullName || c.fullName} initials={initialsOf(d.fullName || c.fullName)} colorKey={c.id} className="kh-edit__av" />}
            errorMessage={userMessage}
            error={errors.avatarFileId || null}
            hint="Học viên: ảnh này in lên giấy chứng nhận. Nên dùng ảnh vuông, cạnh từ 500 px."
            onUpload={async (file) => {
              const stored = await uploadFile(orgId, { purpose: 'ALBUM_IMAGE', name: file.name.slice(0, 200) || 'anh-hoc-vien', data: file }, newIdempotencyKey());
              setAvatarId(stored.id);
              setAvatarUrl(stored.signedUrl);
            }}
            onRemove={() => {
              setAvatarId(null);
              setAvatarUrl(null);
            }}
          />
        )}
        <SettingRow label="Họ và tên" htmlFor={ids.name} required controlWidth={360}>
          <TextInput id={ids.name} value={d.fullName} maxLength={120} disabled={saving} error={errors.fullName || null} onChange={(e) => set('fullName', e.target.value)} />
        </SettingRow>
        <SettingRow label="Số điện thoại" htmlFor={ids.phone} tip="Ví dụ 0912 345 678 hoặc +84 912 345 678. Dùng để tìm khách." controlWidth={360}>
          <TextInput id={ids.phone} type="tel" inputMode="tel" value={d.phone} maxLength={32} disabled={saving} error={errors.phone || null} onChange={(e) => set('phone', e.target.value)} />
        </SettingRow>
        <SettingRow label="Email" htmlFor={ids.email} controlWidth={360}>
          <TextInput id={ids.email} type="email" value={d.email} disabled={saving} error={errors.email || null} onChange={(e) => set('email', e.target.value)} />
        </SettingRow>
        <SettingRow label="Ghi chú" htmlFor={ids.note} stack>
          <Textarea id={ids.note} rows={3} value={d.note} maxLength={2000} disabled={saving} error={errors.note || null} onChange={(e) => set('note', e.target.value)} />
        </SettingRow>
      </div>
      <footer className="ui-card__foot kh-edit__foot">
        <Button onClick={onCancel} disabled={saving}>
          Huỷ
        </Button>
        <Button variant="primary" onClick={() => void save()} loading={saving}>
          Lưu
        </Button>
      </footer>
    </section>
  );
}
