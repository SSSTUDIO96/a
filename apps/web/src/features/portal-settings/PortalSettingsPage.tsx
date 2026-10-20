import { useState } from 'react';
import { transferNote } from '@makeup/shared';
import { errorKind, fieldErrors, userMessage, validationIssues } from '../../api/errors';
import { getPortalSettings, putPortalSettings, type PortalSettings } from '../../api/portal';
import { useSession } from '../../app/session';
import { PageHeader } from '../../layout/PageHeader';
import { usePermissions } from '../../layout/usePermissions';
import { Button, Card, EmptyState, SettingRow, Skeleton, TextInput } from '../../ui';
import { LoadErrorStrip, Strip } from '../staff/parts';
import { useLoad, useOrgInfo } from '../staff/useOrgInfo';
import {
  BANK_FIELDS,
  draftOf,
  groupAccountNo,
  isDirty,
  normalizeAccountName,
  toInput,
  validateDraft,
  type BankDraft,
  type BankErrors,
  type BankField,
} from './logic';
import './portal-settings.css';

// Cài đặt → Cổng học viên (bản vẽ E 5.2, đường /cai-dat/cong-hoc-vien, mục con nav quyền org.update):
// ba ô Ngân hàng, Số tài khoản, Chủ tài khoản + nút Lưu + khung xem trước thẻ "Cách đóng tiền" giống cổng.
// Số tài khoản là đụng tiền: chỉ quyền org.update (Chủ, Quản trị — ký duyệt E câu 3) sửa được; người khác chỉ xem.
// Tổ chức không phải ACADEMY: "Tổ chức chưa bật đào tạo" (máy chủ trả 403 cho cả đường này, nhật ký quyết định E4).
export function PortalSettingsPage() {
  const org = useOrgInfo();
  const { organizations } = useSession();
  const kind = organizations.find((o) => o.id === org.orgId)?.kind;
  return (
    <>
      <PageHeader title="Cổng học viên" />
      {kind !== 'ACADEMY' ? (
        <Card>
          <EmptyState message="Tổ chức chưa bật đào tạo" />
        </Card>
      ) : (
        <SettingsScreen orgId={org.orgId} />
      )}
    </>
  );
}

function SettingsScreen({ orgId }: { orgId: string }) {
  const load = useLoad((signal) => getPortalSettings(orgId, signal), [orgId]);
  if (load.state.status === 'loading') {
    return (
      <Card>
        <div role="status" aria-label="Đang tải cài đặt cổng" className="ps-skel">
          <Skeleton width="50%" height={20} />
          <Skeleton width="80%" />
          <Skeleton width="70%" />
        </div>
      </Card>
    );
  }
  if (load.state.status === 'error') return <LoadErrorStrip error={load.state.error} retry={load.reload} />;
  return <SettingsForm orgId={orgId} saved={load.state.data} />;
}

const LABELS: Record<BankField, string> = { bankName: 'Ngân hàng', bankAccountNo: 'Số tài khoản', bankAccountName: 'Chủ tài khoản' };
const TIPS: Record<BankField, string> = {
  bankName: 'Tên ngân hàng học viên thấy ở thẻ "Cách đóng tiền" trên trang học viên. Điền đủ cả ba ô, hoặc để trống cả ba thì trang không hiện thẻ này.',
  bankAccountNo: 'Chỉ gồm 6 đến 20 chữ số. Khoảng trắng, dấu chấm và gạch được bỏ khi lưu.',
  bankAccountName: 'Tự đổi thành chữ hoa không dấu, đúng cách ngân hàng in tên chủ tài khoản.',
};

function SettingsForm({ orgId, saved: initial }: { orgId: string; saved: PortalSettings }) {
  const canEdit = usePermissions()('org.update');
  const [saved, setSaved] = useState<BankDraft>(() => draftOf(initial));
  const [draft, setDraft] = useState<BankDraft>(saved);
  const [shown, setShown] = useState<BankErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const dirty = isDirty(draft, saved);

  function edit(f: BankField, v: string) {
    setDraft((d) => ({ ...d, [f]: v }));
    setShown((e) => ({ ...e, [f]: undefined }));
    setGeneral(null);
    setDone(false);
  }

  async function save() {
    if (!canEdit || busy) return;
    const errs = validateDraft(draft);
    setShown(errs);
    setGeneral(null);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    setDone(false);
    try {
      const r = await putPortalSettings(orgId, toInput(draft));
      const next = draftOf(r);
      setSaved(next);
      setDraft(next);
      setDone(true);
    } catch (err) {
      const byField = fieldErrors(err);
      const mapped: BankErrors = {};
      for (const f of BANK_FIELDS) if (byField[f]) mapped[f] = byField[f];
      setShown(mapped);
      // Lời chung: lỗi kiểm dữ liệu không gắn ô (đủ ba hoặc trống ba) hoặc lỗi khác (403, mạng, 5xx).
      const formLevel = validationIssues(err).find((i) => i.path === '')?.message;
      setGeneral(errorKind(err) === 'validation' && Object.keys(mapped).length > 0 && !formLevel ? null : (formLevel ?? userMessage(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-cols">
      <Card
        title="Cách đóng tiền"
        subtitle="hiện trên trang học viên"
        className="ps-form"
        footer={
          canEdit ? (
            <>
              <span className="ps-foot-msg" role="status" aria-live="polite">
                {done ? 'Đã lưu.' : ''}
              </span>
              <Button variant="primary" onClick={() => void save()} loading={busy} disabled={!dirty}>
                Lưu
              </Button>
            </>
          ) : undefined
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          noValidate
        >
          {!canEdit && (
            <Strip tone="grey" icon="lock">
              Bạn chỉ xem được. Đổi số tài khoản cần quyền Chủ hoặc Quản trị.
            </Strip>
          )}
          {general && <Strip tone="danger" icon="warn">{general}</Strip>}
          {BANK_FIELDS.map((f) => (
            <SettingRow key={f} label={LABELS[f]} htmlFor={`ps-${f}`} tip={TIPS[f]} controlWidth={280}>
              <TextInput
                id={`ps-${f}`}
                value={draft[f]}
                disabled={!canEdit || busy}
                error={shown[f] ?? null}
                inputMode={f === 'bankAccountNo' ? 'numeric' : undefined}
                autoComplete="off"
                maxLength={f === 'bankAccountNo' ? 60 : f === 'bankAccountName' ? 120 : 80}
                onChange={(e) => edit(f, e.target.value)}
              />
            </SettingRow>
          ))}
        </form>
      </Card>
      <BankPreview draft={draft} />
    </div>
  );
}

// Khung xem trước thẻ "Cách đóng tiền" của cổng: chỉ hiện khi đủ ba ô hợp lệ (cổng cũng chỉ hiện khi đủ ba).
function BankPreview({ draft }: { draft: BankDraft }) {
  const complete = BANK_FIELDS.every((f) => draft[f].trim() !== '') && Object.keys(validateDraft(draft)).length === 0;
  return (
    <section className="ps-prev" aria-label="Xem trước trang học viên">
      <p className="ps-prev__cap">Xem trước trên trang học viên</p>
      <div className="ps-prev__card">
        {complete ? (
          <>
            <h3>Cách đóng tiền</h3>
            <dl>
              <div>
                <dt>Ngân hàng</dt>
                <dd>{draft.bankName.trim()}</dd>
              </div>
              <div>
                <dt>Số tài khoản</dt>
                <dd className="ps-prev__no">{groupAccountNo(draft.bankAccountNo)}</dd>
              </div>
              <div>
                <dt>Chủ tài khoản</dt>
                <dd>{normalizeAccountName(draft.bankAccountName)}</dd>
              </div>
              <div>
                <dt>Nội dung</dt>
                <dd>{transferNote('HĐKH-000042', 'Phương Thảo')}</dd>
              </div>
            </dl>
            <p className="ps-prev__note">Chuyển xong trung tâm sẽ ghi phiếu thu.</p>
          </>
        ) : (
          <p className="ps-prev__empty">Chưa đủ thông tin, trang học viên sẽ không hiện thẻ "Cách đóng tiền".</p>
        )}
      </div>
    </section>
  );
}

