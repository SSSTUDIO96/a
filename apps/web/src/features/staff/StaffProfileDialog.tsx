import { useEffect, useId, useState } from 'react';
import { errorKind, fieldErrors, userMessage } from '../../api/errors';
import { uploadFile } from '../../api/files';
import { newIdempotencyKey } from '../../api/idempotency';
import { updateStaff } from '../../api/staff';
import type { StaffMember, StaffTier } from '../../api/types';
import { Avatar, Button, ImageUpload, Select, SettingRow, Switch, TextInput } from '../../ui';
import { profileDraftOf, profilePatch, tierOptions, type ProfileDraft } from './logic';
import { FormDialog, Strip } from './parts';

// Hộp "Hồ sơ thợ" (C2 1.2): ảnh · Thông tin (tên hiển thị, số điện thoại) · Lương & lịch (bậc, nhận lịch).
// Lưu = PATCH /staff/:membershipId chỉ trường đã đổi. Ảnh: tải lên (STAFF_AVATAR) giữ mã trong bản nháp, Lưu mới gửi.
export interface StaffProfileDialogProps {
  orgId: string;
  row: StaffMember | null;
  tiers: StaffTier[];
  roleText: string;
  phone: boolean;
  canWrite: boolean;
  canFiles: boolean;
  // null = được đổi bậc; chuỗi = lý do khoá (thiếu quyền / dòng của chính mình).
  tierLock: string | null;
  canSeeTier: boolean;
  onClose: () => void;
  onSaved: (row: StaffMember) => void;
}

export function StaffProfileDialog(p: StaffProfileDialogProps) {
  const { row } = p;
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const ids = { name: useId(), phone: useId(), tier: useId(), book: useId() };

  useEffect(() => {
    if (row) {
      setDraft(profileDraftOf(row));
      setPreview(undefined);
      setErrors({});
      setBanner(null);
    }
  }, [row]);

  if (!row || !draft) return null;
  const readOnly = !p.canWrite;
  const patch = profilePatch(row, draft, { canWritePhone: p.canWrite, canChangeTier: p.canSeeTier && p.tierLock === null });
  const dirty = Object.keys(patch).length > 0;
  const shownAvatar = preview === undefined ? row.avatarUrl : preview;

  function set<K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: '' }));
  }

  async function save() {
    if (!row || !dirty) {
      p.onClose();
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      const updated = await updateStaff(p.orgId, row.membershipId, patch);
      p.onSaved(updated);
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length > 0) setErrors(fe);
      else if (errorKind(err) === 'not_found') setBanner('Không tìm thấy thợ này — có thể đã bị gỡ khỏi studio ở máy khác.');
      else setBanner(userMessage(err));
      // Lỗi bậc (403): ô chọn quay về bậc cũ.
      if (errorKind(err) === 'forbidden' && patch.tierId !== undefined) set('tierId', row.tier?.id ?? '');
    } finally {
      setSaving(false);
    }
  }

  const footer = readOnly ? (
    <Button onClick={p.onClose}>Đóng</Button>
  ) : (
    <>
      <Button onClick={p.onClose} disabled={saving}>
        Huỷ
      </Button>
      <Button variant="primary" onClick={() => void save()} loading={saving}>
        Lưu
      </Button>
    </>
  );

  const tierSelect = (
    <Select
      id={ids.tier}
      options={tierOptions(p.tiers, row.tier)}
      value={draft.tierId}
      disabled={readOnly || p.tierLock !== null || saving}
      hint={p.tierLock ?? undefined}
      error={errors.tierId || null}
      onChange={(e) => set('tierId', e.target.value)}
    />
  );

  return (
    <FormDialog open phone={p.phone} onClose={() => !saving && p.onClose()} title="Hồ sơ thợ" eyebrow={p.roleText || undefined} footer={footer}>
      {banner && <Strip tone="danger" icon="warn">{banner}</Strip>}
      <ImageUpload
        className="st-prof__img"
        layout="inline"
        shape="round"
        size={72}
        label={`Ảnh đại diện ${row.displayName}`}
        value={shownAvatar}
        disabled={readOnly || !p.canFiles || saving}
        emptyContent={<Avatar name={row.displayName} initials={row.initials} colorKey={row.membershipId} className="st-prof__av" />}
        errorMessage={userMessage}
        error={errors.avatarFileId || null}
        onUpload={async (file) => {
          const stored = await uploadFile(p.orgId, { purpose: 'STAFF_AVATAR', name: file.name.slice(0, 200) || 'anh-dai-dien', data: file }, newIdempotencyKey());
          set('avatarFileId', stored.id);
          setPreview(stored.signedUrl);
        }}
        onRemove={
          p.canFiles && !readOnly
            ? () => {
                set('avatarFileId', null);
                setPreview(null);
              }
            : undefined
        }
      >
        <span className="st-prof__name">{row.displayName}</span>
        <span className="st-prof__acc">Tên tài khoản: {row.fullName}</span>
      </ImageUpload>

      <h3 className="st-grp">Thông tin</h3>
      <SettingRow label="Tên hiển thị" htmlFor={ids.name} tip="Tên hiện trên lịch, hợp đồng, màn tiền công. Trống = dùng tên tài khoản." controlWidth={240}>
        <TextInput id={ids.name} value={draft.displayName} disabled={readOnly || saving} maxLength={80} error={errors.displayName || null} onChange={(e) => set('displayName', e.target.value)} />
      </SettingRow>
      {p.canWrite && (
        <SettingRow label="Số điện thoại" htmlFor={ids.phone} tip="Chỉ người có quyền sửa hồ sơ thợ mới thấy số này." controlWidth={240}>
          <TextInput id={ids.phone} type="tel" inputMode="tel" value={draft.phone} disabled={saving} maxLength={32} error={errors.phone || null} onChange={(e) => set('phone', e.target.value)} />
        </SettingRow>
      )}

      <h3 className="st-grp">Lương &amp; lịch</h3>
      <SettingRow label="Bậc lương" htmlFor={ids.tier} controlWidth={240}>
        {p.canSeeTier ? tierSelect : <span className="st-prof__ro">{row.tier ? row.tier.name : 'Chưa gán bậc'}</span>}
      </SettingRow>
      <SettingRow label="Nhận lịch" htmlFor={ids.book} tip="Tắt thì thợ hiện mờ, không chọn được trong ô chọn thợ khi lập hợp đồng.">
        <Switch id={ids.book} checked={draft.isBookable} disabled={readOnly || saving} aria-label="Nhận lịch" onChange={(v) => set('isBookable', v)} />
      </SettingRow>
    </FormDialog>
  );
}
