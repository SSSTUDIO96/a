import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError, errorKind, fieldErrors, userMessage } from '../../../api/errors';
import { getBrandProfile, updateContractInfo } from '../../../api/profile';
import type { BrandProfile } from '../../../api/types';
import { useBreakpoint } from '../../../layout/useBreakpoint';
import { Button, Card, SettingRow, Skeleton, TextInput } from '../../../ui';
import { FormDialog, LoadErrorStrip, Strip } from '../../staff/parts';
import { useLoad } from '../../staff/useOrgInfo';
import {
  INFO_FIELDS,
  INFO_LABELS,
  INFO_MAX,
  INFO_TIPS,
  infoDirty,
  infoDraftOf,
  infoInput,
  validateInfo,
  type InfoDraft,
  type InfoErrors,
  type InfoField,
} from './info';
import '../../staff/staff.css';
import './settings.css';

// Thẻ "Thông tin trên hợp đồng" (bản vẽ G 4.5): người đại diện + ngân hàng. Mọi vai trò có org.read đọc; CHỈ Chủ/Quản trị
// (org.update) thấy nút "Sửa". Logo, tên, địa chỉ, SĐT lấy từ Hồ sơ thương hiệu.
export function ContractInfoCard({ orgId, slug, canEdit }: { orgId: string; slug: string; canEdit: boolean }) {
  const load = useLoad((signal) => getBrandProfile(orgId, signal), [orgId]);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (load.state.status === 'loading') {
    return (
      <Card title="Thông tin trên hợp đồng" className="mi-info">
        <div role="status" aria-label="Đang tải thông tin trên hợp đồng" className="mi-skel">
          <Skeleton width="60%" height={16} />
          <Skeleton width="80%" />
        </div>
      </Card>
    );
  }
  if (load.state.status === 'error') {
    return (
      <Card title="Thông tin trên hợp đồng" className="mi-info">
        <LoadErrorStrip error={load.state.error} retry={load.reload} />
      </Card>
    );
  }
  const result = load.state.data;
  const profile: BrandProfile | null = result.hasProfile ? result.profile : null;
  const draft = infoDraftOf(profile);

  return (
    <Card
      title="Thông tin trên hợp đồng"
      subtitle="người đại diện, tài khoản ngân hàng"
      className="mi-info"
      aria-label="Thông tin trên hợp đồng"
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            Sửa
          </Button>
        ) : undefined
      }
    >
      <div className="mi-info__rows">
        {INFO_FIELDS.map((f) => (
          <SettingRow key={f} label={INFO_LABELS[f]} tip={INFO_TIPS[f]}>
            <span className={draft[f] === '' ? 'mi-info__empty' : 'mi-info__val'} data-field={f}>
              {draft[f] === '' ? 'Chưa nhập' : draft[f]}
            </span>
          </SettingRow>
        ))}
      </div>
      <p className="mi-note">
        {saved ? <span role="status">Đã lưu thông tin trên hợp đồng. </span> : null}
        Logo, tên, địa chỉ, SĐT lấy từ <Link to={`/${slug}/cai-dat/thuong-hieu`}>Hồ sơ thương hiệu</Link>.
        {!canEdit ? ' Chỉ Chủ và Quản trị sửa được thông tin này.' : ''}
        {profile === null ? ' Studio chưa có hồ sơ thương hiệu.' : ''}
      </p>
      {canEdit && (
        <ContractInfoDialog
          open={open}
          orgId={orgId}
          slug={slug}
          initial={draft}
          onClose={() => setOpen(false)}
          onSaved={(p) => {
            load.set(() => ({ hasProfile: true, profile: p }));
            setSaved(true);
            setOpen(false);
          }}
        />
      )}
    </Card>
  );
}

// Hộp sửa: 5 ô, lưu bằng PUT contract-info (đủ 5 khoá). 409 PROFILE_REQUIRED → liên kết "Hồ sơ thương hiệu".
export function ContractInfoDialog({
  open,
  orgId,
  slug,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  orgId: string;
  slug: string;
  initial: InfoDraft;
  onClose: () => void;
  onSaved: (p: BrandProfile) => void;
}) {
  const phone = useBreakpoint() === 'phone';
  return (
    <FormDialog
      open={open}
      phone={phone}
      onClose={onClose}
      title="Thông tin trên hợp đồng"
      sub="Người đại diện và tài khoản ngân hàng in trên mọi hợp đồng"
      width={520}
      footer={null}
    >
      {open && <InfoForm orgId={orgId} slug={slug} initial={initial} onClose={onClose} onSaved={onSaved} />}
    </FormDialog>
  );
}

function InfoForm({
  orgId,
  slug,
  initial,
  onClose,
  onSaved,
}: {
  orgId: string;
  slug: string;
  initial: InfoDraft;
  onClose: () => void;
  onSaved: (p: BrandProfile) => void;
}) {
  const [draft, setDraft] = useState<InfoDraft>(initial);
  const [errors, setErrors] = useState<InfoErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [needProfile, setNeedProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = infoDirty(draft, initial);

  function edit(f: InfoField, v: string) {
    setDraft((d) => ({ ...d, [f]: v }));
    setErrors((e) => ({ ...e, [f]: undefined }));
    setGeneral(null);
    setNeedProfile(false);
  }

  async function save() {
    if (busy) return;
    const local = validateInfo(draft);
    setErrors(local);
    setGeneral(null);
    setNeedProfile(false);
    if (Object.keys(local).length > 0) return;
    setBusy(true);
    try {
      const r = await updateContractInfo(orgId, infoInput(draft));
      if (!r.hasProfile) throw new Error('Máy chủ không trả hồ sơ sau khi lưu');
      onSaved(r.profile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.details as { reason?: unknown } | undefined)?.reason === 'PROFILE_REQUIRED') {
        setNeedProfile(true);
        setGeneral(err.message);
      } else if (errorKind(err) === 'validation') {
        const byField = fieldErrors(err);
        const mapped: InfoErrors = {};
        for (const f of INFO_FIELDS) if (byField[f]) mapped[f] = byField[f];
        setErrors(mapped);
        if (Object.keys(mapped).length === 0) setGeneral(userMessage(err));
      } else {
        setGeneral(userMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {general && (
        <Strip tone="danger" icon="warn">
          {general}
          {needProfile && (
            <>
              {' '}
              <Link to={`/${slug}/cai-dat/thuong-hieu`}>Hồ sơ thương hiệu</Link>
            </>
          )}
        </Strip>
      )}
      {INFO_FIELDS.map((f) => (
        <SettingRow key={f} label={INFO_LABELS[f]} htmlFor={`mi-info-${f}`} tip={INFO_TIPS[f]} controlWidth={260}>
          <TextInput
            id={`mi-info-${f}`}
            value={draft[f]}
            error={errors[f] ?? null}
            disabled={busy}
            maxLength={INFO_MAX[f]}
            autoComplete="off"
            inputMode={f === 'bankAccountNumber' ? 'text' : undefined}
            onChange={(e) => edit(f, e.target.value)}
          />
        </SettingRow>
      ))}
      <div className="mi-dlg-foot">
        <Button onClick={onClose} disabled={busy}>
          Huỷ
        </Button>
        <Button variant="primary" type="submit" loading={busy} disabled={!dirty}>
          Lưu
        </Button>
      </div>
    </form>
  );
}
