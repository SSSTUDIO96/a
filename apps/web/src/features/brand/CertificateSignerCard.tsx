import { useId, useRef, useState, type ReactNode } from 'react';
import type { OrgKind } from '../../api/auth';
import { ApiError, errorKind, userMessage } from '../../api/errors';
import { getCertificateSigner, putCertificateSigner, type CertificateSigner } from '../../api/certificates';
import { Button, Card, SettingRow, TextInput, Tooltip } from '../../ui';
import { LoadErrorStrip } from '../staff/parts';
import { useLoad } from '../staff/useOrgInfo';
import './CertificateSignerCard.css';

// Thẻ "Giấy chứng nhận" ở Hồ sơ thương hiệu (bản vẽ F mục 6.7, 4.8; ký duyệt F câu 4): tên + chức danh Giám đốc — chỗ ký thứ hai trên giấy.
// Chỉ ACADEMY. Chỉ Chủ và Quản trị (org.update) sửa; người khác chỉ xem. Chưa có hồ sơ thương hiệu: máy chủ trả 409 PROFILE_REQUIRED
// (GET báo hasProfile=false) → hiện lời "Lưu hồ sơ thương hiệu trước". Không in sẵn chữ ký hay con dấu.

export const SIGNER_MAX = 120;
export const PROFILE_REQUIRED_MESSAGE = 'Chưa có hồ sơ thương hiệu. Hãy lưu hồ sơ thương hiệu (tên thương hiệu) ở trên trước, rồi quay lại đặt người ký.';

export interface CertificateSignerCardProps {
  orgId: string;
  orgKind: OrgKind | undefined;
  // org.update: sửa được. Không có → chỉ xem.
  canEdit: boolean;
  // Hồ sơ thương hiệu của trang đã có chưa; đổi từ chưa → có thì thẻ tải lại.
  profileSaved: boolean;
}

export function CertificateSignerCard(props: CertificateSignerCardProps) {
  if (props.orgKind !== 'ACADEMY') return null;
  return <CertificateSignerBody {...props} />;
}

// Ô trống hoặc chỉ có dấu cách → null (máy chủ lưu null = dùng chức danh mặc định / để trống chỗ tên).
export function signerValue(text: string): string | null {
  const t = text.trim();
  return t === '' ? null : t;
}

// Lời cho lỗi khi lưu: 409 PROFILE_REQUIRED → lời tiếng Việt cố định; còn lại lời máy chủ / lời mặc định theo nhóm lỗi.
export function signerSaveError(err: unknown): { text: string; profileMissing: boolean } {
  if (err instanceof ApiError && err.status === 409 && (err.details as { reason?: unknown } | undefined)?.reason === 'PROFILE_REQUIRED') {
    return { text: PROFILE_REQUIRED_MESSAGE, profileMissing: true };
  }
  if (errorKind(err) === 'forbidden') return { text: 'Chỉ Chủ và Quản trị được đổi người ký giấy chứng nhận.', profileMissing: false };
  return { text: userMessage(err), profileMissing: false };
}

function CertificateSignerBody({ orgId, canEdit, profileSaved }: CertificateSignerCardProps) {
  const load = useLoad((signal) => getCertificateSigner(orgId, signal), [orgId, profileSaved]);
  const title = (
    <>
      Giấy chứng nhận
      <Tooltip text="Chỗ ký thứ hai trên giấy chứng nhận. Giấy in ra để trống chỗ ký tay và đóng dấu, không có chữ ký hay con dấu in sẵn." />
    </>
  );
  if (load.state.status === 'loading') {
    return (
      <Card title={title} aria-label="Người ký giấy chứng nhận" className="gcs-card">
        <div role="status" aria-label="Đang tải người ký" className="gcs-skel">
          <div className="gcs-skel__bar" />
          <div className="gcs-skel__bar" />
        </div>
      </Card>
    );
  }
  if (load.state.status === 'error') {
    return (
      <Card title={title} aria-label="Người ký giấy chứng nhận" className="gcs-card">
        <LoadErrorStrip error={load.state.error} retry={load.reload} />
      </Card>
    );
  }
  const s = load.state.data;
  // Mỗi lần tải được dữ liệu mới thì dựng lại phần sửa (đặt lại bản nháp theo máy chủ).
  return <SignerForm key={`${s.hasProfile}|${s.signerName ?? ''}|${s.signerTitle ?? ''}`} orgId={orgId} initial={s} canEdit={canEdit} title={title} />;
}

function SignerForm({ orgId, initial, canEdit, title }: { orgId: string; initial: CertificateSigner; canEdit: boolean; title: ReactNode }) {
  const [base, setBase] = useState(initial);
  const [name, setName] = useState(initial.signerName ?? '');
  const [role, setRole] = useState(initial.signerTitle ?? '');
  const [hasProfile, setHasProfile] = useState(initial.hasProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const nameId = useId();
  const roleId = useId();

  const dirty = signerValue(name) !== base.signerName || signerValue(role) !== base.signerTitle;
  const locked = !canEdit || !hasProfile || saving;

  async function save() {
    if (busy.current || !canEdit || !hasProfile || !dirty) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await putCertificateSigner(orgId, { signerName: signerValue(name), signerTitle: signerValue(role) });
      setBase(res);
      setName(res.signerName ?? '');
      setRole(res.signerTitle ?? '');
      setSaved(true);
    } catch (err) {
      const e = signerSaveError(err);
      if (e.profileMissing) setHasProfile(false);
      setError(e.text);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Card
      title={title}
      aria-label="Người ký giấy chứng nhận"
      className="gcs-card"
      footer={
        canEdit ? (
          <div className="gcs-foot">
            <span className="gcs-live" role="status" aria-live="polite">
              {saved && !dirty ? 'Đã lưu' : ''}
            </span>
            <Button variant="primary" size="sm" loading={saving} disabled={!hasProfile || !dirty} onClick={() => void save()}>
              Lưu
            </Button>
          </div>
        ) : undefined
      }
    >
      {!hasProfile && (
        <div className="gcs-band gcs-band--grey" role="note">
          {canEdit ? 'Lưu hồ sơ thương hiệu trước, rồi đặt người ký ở đây.' : 'Chưa có hồ sơ thương hiệu, nên chưa đặt người ký được.'}
        </div>
      )}
      {!canEdit && hasProfile && (
        <div className="gcs-band gcs-band--grey" role="note">
          Bạn chỉ xem được. Chỉ Chủ và Quản trị đổi người ký.
        </div>
      )}
      <SettingRow
        label="Tên Giám đốc"
        htmlFor={nameId}
        tip="Tên in dưới chỗ ký thứ hai. Để trống thì giấy chỉ có đường kẻ để ký tay."
        controlWidth={320}
        className="gcs-row"
      >
        <TextInput
          id={nameId}
          value={name}
          maxLength={SIGNER_MAX}
          placeholder={canEdit ? 'Ví dụ: Nguyễn Trọng Chiến' : 'Chưa điền'}
          disabled={locked}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
        />
      </SettingRow>
      <SettingRow
        label="Chức danh"
        htmlFor={roleId}
        tip={`Để trống thì giấy in “${base.defaultTitle}”.`}
        controlWidth={320}
        className="gcs-row"
      >
        <TextInput
          id={roleId}
          value={role}
          maxLength={SIGNER_MAX}
          placeholder={base.defaultTitle}
          disabled={locked}
          onChange={(e) => {
            setRole(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
        />
      </SettingRow>
      {error && (
        <div className="gcs-band gcs-band--danger" role="alert">
          {error}
        </div>
      )}
    </Card>
  );
}
