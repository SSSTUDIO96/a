import { useId, useMemo, useState } from 'react';
import { isCertificateTemplateCode, listDesignTemplates, REISSUE_REASONS } from '@makeup/shared';
import { reissueCertificate, type CertificateFont, type CertificateView, type ReissueInput } from '../../api/certificates';
import { ApiError, fieldErrors, userMessage } from '../../api/errors';
import { Button, Dialog, Select, SettingRow, TextInput, Textarea } from '../../ui';
import { useRetainedIdempotencyKey } from '../auth/useRetainedIdempotencyKey';
import { viDate } from './logic';

// Hộp "Cấp lại giấy chứng nhận {số}" (bản vẽ F mục 6.5, 4.6): lý do (chọn; "Khác" thì gõ, bắt buộc, ≤ 500), tên in trên giấy (điền sẵn tên
// HIỆN HÀNH của học viên — không sửa hồ sơ học viên), mẫu, phông. Cấp lại GIỮ SỐ: bản cũ chuyển "Đã thu hồi", bản mới ghi "Bản cấp lại {hôm nay}".
// Gửi kèm Idempotency-Key giữ qua lần bấm lại. Lỗi 409 hiện lời tiếng Việt rõ, KHÔNG giấu nút (việc tồn 69: ghi danh đã huỷ).

export const REISSUE_REASON_MAX = 500;
export const NAME_MAX = 120;
export const OTHER_REASON = 'Khác';
export const ENROLLMENT_CANCELLED_MESSAGE = 'Học viên đã huỷ ghi danh khoá này nên không cấp lại được giấy chứng nhận. Bản đang hiệu lực vẫn in lại được.';

const FONT_KEEP = 'keep';
const FONT_TEMPLATE = 'template';
const FONTS: readonly CertificateFont[] = ['ky-1', 'ky-2', 'ky-3', 'ky-4'];

// Lời hiện cho một lỗi cấp lại: 409 ghi danh đã huỷ có lời riêng; còn lại dùng lời máy chủ (đã viết tiếng Việt).
export function reissueErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    const reason = (err.details as { reason?: unknown } | undefined)?.reason;
    if (reason === 'ENROLLMENT_CANCELLED') return ENROLLMENT_CANCELLED_MESSAGE;
  }
  return userMessage(err);
}

export interface ReissueDialogProps {
  orgId: string;
  // Bản đang hiệu lực cần cấp lại.
  target: CertificateView;
  // Hôm nay theo múi giờ tổ chức (YYYY-MM-DD) — chữ "bản cấp lại" ghi ngày này.
  today: string;
  onClose: () => void;
  // Cấp lại xong: máy chủ trả bản MỚI (cùng số).
  onReissued: (view: CertificateView) => void;
  // Danh sách đã cũ (bản vừa bị thu hồi, va chạm): màn tải lại.
  onStale: () => void;
}

export function ReissueDialog({ orgId, target, today, onClose, onReissued, onStale }: ReissueDialogProps) {
  const ids = useId();
  const templates = useMemo(() => listDesignTemplates({ kind: 'CERTIFICATE' }), []);
  const oldTemplateOk = isCertificateTemplateCode(target.templateCode);
  const [reasonKind, setReasonKind] = useState<string>(REISSUE_REASONS[0]);
  const [reasonText, setReasonText] = useState('');
  const [name, setName] = useState(target.customer.fullName);
  const [templateCode, setTemplateCode] = useState(oldTemplateOk ? target.templateCode : '');
  const [font, setFont] = useState<string>(FONT_KEEP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const keys = useRetainedIdempotencyKey();

  const other = reasonKind === OTHER_REASON;
  const oldFontNo = target.fontOverride ? target.fontOverride.slice(3) : null;

  const submit = async () => {
    if (busy) return;
    const local: Record<string, string> = {};
    const reason = other ? reasonText.trim() : reasonKind;
    if (reason === '') local.reason = 'Nhập lý do cấp lại.';
    if (reason.length > REISSUE_REASON_MAX) local.reason = `Lý do dài tối đa ${REISSUE_REASON_MAX} ký tự.`;
    const studentName = name.trim();
    if (studentName === '') local.studentName = 'Nhập tên in trên giấy.';
    if (studentName.length > NAME_MAX) local.studentName = `Tên dài tối đa ${NAME_MAX} ký tự.`;
    if (templateCode === '') local.templateCode = 'Mẫu cũ không còn trong danh mục — chọn mẫu khác.';
    setFields(local);
    setError(null);
    if (Object.keys(local).length > 0) return;
    const body: ReissueInput = { reason, studentName, templateCode };
    if (font === FONT_TEMPLATE) body.fontOverride = null;
    else if (font !== FONT_KEEP) body.fontOverride = font as CertificateFont;
    const key = keys.keyFor(body);
    setBusy(true);
    try {
      const view = await reissueCertificate(orgId, target.id, body, key);
      keys.reset();
      onReissued(view);
    } catch (err) {
      const detail = (err instanceof ApiError ? (err.details as { reason?: unknown } | undefined)?.reason : undefined) ?? null;
      const fe = fieldErrors(err);
      const mine: Record<string, string> = {};
      for (const k of ['reason', 'studentName', 'templateCode', 'fontOverride']) if (fe[k]) mine[k] = fe[k];
      if (Object.keys(mine).length > 0) {
        keys.reset();
        setFields(mine);
      } else {
        setError(reissueErrorMessage(err));
      }
      // Bản đã bị thu hồi / va chạm: danh sách đang hiện đã cũ → tải lại (hộp vẫn mở để đọc lời).
      if (detail === 'CERTIFICATE_REVOKED' || detail === 'CERTIFICATE_RACE') {
        keys.reset();
        onStale();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      size="sm"
      width={560}
      title={`Cấp lại giấy chứng nhận ${target.code}`}
      eyebrow={`${target.courseName} · ${target.className}`}
      className="gcr-dlg"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={busy}>
            Cấp lại và in
          </Button>
        </>
      }
    >
      <div className="gcr-reissue">
        <SettingRow label="Lý do" htmlFor={`${ids}-reason`} required controlWidth={280}>
          <Select
            id={`${ids}-reason`}
            value={reasonKind}
            onChange={(e) => setReasonKind(e.target.value)}
            options={REISSUE_REASONS.map((r) => ({ value: r, label: r }))}
          />
        </SettingRow>
        {other && (
          <div className="gcr-reissue__other">
            <Textarea
              aria-label="Lý do khác"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              maxLength={REISSUE_REASON_MAX}
              placeholder="Ghi rõ lý do cấp lại"
              error={fields.reason ?? null}
              data-autofocus
            />
          </div>
        )}
        {!other && fields.reason && (
          <p className="gcr-reissue__fe" role="alert">
            {fields.reason}
          </p>
        )}
        <SettingRow label="Tên in trên giấy" htmlFor={`${ids}-name`} required controlWidth={280}>
          <TextInput id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} error={fields.studentName ?? null} autoComplete="off" />
        </SettingRow>
        <p className="gcr-reissue__note">Tên trong hồ sơ học viên không đổi theo — sửa hồ sơ nếu tên ở đó cũng sai.</p>
        <SettingRow label="Mẫu" htmlFor={`${ids}-tpl`} controlWidth={280}>
          <Select
            id={`${ids}-tpl`}
            value={templateCode}
            onChange={(e) => setTemplateCode(e.target.value)}
            placeholder={oldTemplateOk ? undefined : 'Chọn mẫu'}
            error={fields.templateCode ?? null}
            options={templates.map((t) => ({ value: t.code, label: `${t.code.slice(3)} · ${t.name}${t.code === target.templateCode ? ' (mẫu cũ)' : ''}` }))}
          />
        </SettingRow>
        <SettingRow label="Phông tên" htmlFor={`${ids}-font`} controlWidth={280}>
          <Select
            id={`${ids}-font`}
            value={font}
            onChange={(e) => setFont(e.target.value)}
            error={fields.fontOverride ?? null}
            options={[
              { value: FONT_KEEP, label: oldFontNo ? `Giữ phông cũ (Chữ ký ${oldFontNo})` : 'Giữ phông cũ (theo mẫu)' },
              { value: FONT_TEMPLATE, label: 'Theo mẫu' },
              ...FONTS.map((f) => ({ value: f, label: `Chữ ký ${f.slice(3)}` })),
            ]}
          />
        </SettingRow>
        <div className="gcr-reissue__band" role="note">
          Bản <b>{target.code}</b> chuyển “Đã thu hồi” (vẫn nằm trong sổ). Bản mới <b>giữ số {target.code}</b>, in thêm “Bản cấp lại {viDate(today)}”.
        </div>
        {error && (
          <div className="gcr-reissue__err" role="alert">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
