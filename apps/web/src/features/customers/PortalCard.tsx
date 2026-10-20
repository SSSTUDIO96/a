import { useEffect, useId, useRef, useState } from 'react';
import { PORTAL_MAX_DEVICES, PORTAL_LINK_TTL_DAYS, PORTAL_MAX_FAILED, portalMessage, type PortalAdminView } from '@makeup/shared';
import type { OrgKind } from '../../api/auth';
import { userMessage } from '../../api/errors';
import { blockPortalDevice, createPortalLink, forbiddenMessage, getPortalAdmin, revokePortal, type CreatedPortalLink } from '../../api/portal';
import { usePermissions } from '../../layout/usePermissions';
import { Button, Card, Checkbox, ConfirmDialog, Dialog, IconWarn, Skeleton, StatusTag, Textarea } from '../../ui';
import { LoadErrorStrip } from '../staff/parts';
import { useLoad } from '../staff/useOrgInfo';
import {
  formatPortalWhen,
  PORTAL_CONSEQUENCE,
  PORTAL_DEVICE_STATUS_LABEL,
  PORTAL_DEVICE_STATUS_TONE,
  PORTAL_REASON_BLOCK,
  PORTAL_REASON_REVOKE,
  PORTAL_SEND_EXTRA_PERMISSIONS,
  portalLinkLive,
  portalLinkNote,
  portalLinkTag,
  portalUrl,
} from './logic';

// Thẻ "Cổng học viên" trong hồ sơ khách (bản vẽ E mục 5.2), đặt sau thẻ Hợp đồng.
// Chỉ hiện khi tổ chức là ACADEMY và người xem có portal.manage. Chìa đường dẫn chỉ nằm trong state của thẻ này:
// không vào URL, không vào localStorage; đóng hộp hoặc rời hồ sơ là mất (máy chủ chỉ giữ bản băm).

export interface PortalCardProps {
  orgId: string;
  customerId: string;
  orgKind: OrgKind | undefined;
  timezone: string;
}

export function PortalCard(props: PortalCardProps) {
  const has = usePermissions();
  if (props.orgKind !== 'ACADEMY' || !has('portal.manage')) return null;
  return <PortalCardBody {...props} />;
}

// Tin nhắn vừa tạo: chữ đã ghép sẵn (có chìa) và đường dẫn để tô màu trong hộp.
interface Fresh {
  message: string;
  url: string;
}

type Dialogs = { kind: 'create' } | { kind: 'block'; device: PortalAdminView['devices'][number] } | { kind: 'revoke' } | { kind: 'close' } | null;

const REASON_MAX = 200;

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}

function PortalCardBody({ orgId, customerId, timezone }: PortalCardProps) {
  const has = usePermissions();
  const load = useLoad((signal) => getPortalAdmin(orgId, customerId, signal), [orgId, customerId]);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [copied, setCopied] = useState<'no' | 'yes' | 'manual'>('no');
  const [dialog, setDialog] = useState<Dialogs>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = <span>Cổng học viên</span>;

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  if (load.state.status === 'loading') {
    return (
      <Card title={title} aria-label="Cổng học viên">
        <div role="status" aria-label="Đang tải cổng học viên" className="kh-skel">
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </div>
      </Card>
    );
  }
  if (load.state.status === 'error') {
    return (
      <Card title={title} aria-label="Cổng học viên">
        <LoadErrorStrip error={load.state.error} retry={load.reload} />
      </Card>
    );
  }

  const view = load.state.data;
  const now = Date.now();
  const tag = portalLinkTag(view.link);
  const live = portalLinkLive(view.link);
  const missing = PORTAL_SEND_EXTRA_PERMISSIONS.filter((p) => !has(p));
  const canSend = has('portal.manage') && missing.length === 0;
  const notAcademy = view.eligible.reasons.includes('NOT_ACADEMY');
  const noPhone = view.eligible.reasons.includes('NO_PHONE');
  const activeDevices = view.devices.filter((d) => d.status === 'ACTIVE');
  const canRevoke = (view.link !== null && view.link.status !== 'REVOKED') || activeDevices.length > 0;

  function selectMessage() {
    const box = boxRef.current;
    const sel = window.getSelection();
    if (!box || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function copy() {
    if (!fresh) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Không có clipboard');
      await navigator.clipboard.writeText(fresh.message);
      setCopied('yes');
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied((c) => (c === 'yes' ? 'no' : c)), 2500);
    } catch {
      // Trình duyệt không cho chép tự động: chọn sẵn chữ để nhân viên tự chép.
      selectMessage();
      setCopied('manual');
    }
  }

  function created(r: CreatedPortalLink) {
    setFresh({ message: portalMessage({ callName: r.callName, centerName: r.centerName, url: portalUrl(window.location.origin, r.key) }), url: portalUrl(window.location.origin, r.key) });
    setCopied('no');
    load.set(() => r.view);
    setDialog(null);
  }

  const createBtn = (
    <Button
      variant={live || fresh ? 'default' : 'primary'}
      icon={<IconLink />}
      disabled={!view.eligible.ok}
      onClick={() => setDialog({ kind: 'create' })}
    >
      {live || fresh ? 'Tạo đường dẫn mới' : 'Tạo đường dẫn'}
    </Button>
  );

  return (
    <>
      <Card
        title={title}
        aria-label="Cổng học viên"
        className="pt-card"
        actions={<StatusTag tone={tag.tone}>{tag.label}</StatusTag>}
        footer={
          canRevoke ? (
            <Button className="pt-outline-danger" onClick={() => setDialog({ kind: 'revoke' })}>
              Thu hồi đường dẫn và chặn mọi máy
            </Button>
          ) : undefined
        }
      >
        <div className="pt-body">
          {fresh ? (
            <>
              <p className="pt-hint">
                Gửi tin này cho học viên qua Zalo hoặc tin nhắn. Học viên bấm đường dẫn, nhập <b>4 số cuối số điện thoại</b> là vào, không cần mật khẩu.
              </p>
              <div ref={boxRef} className="pt-msg" tabIndex={0} aria-label="Tin nhắn gửi học viên" data-testid="portal-message">
                {fresh.message.split(fresh.url).flatMap((part, i, all) => (i < all.length - 1 ? [part, <span key={i} className="pt-msg__url">{fresh.url}</span>] : [part]))}
              </div>
              <div className="pt-warn" role="note">
                <IconWarn />
                <span>
                  Tin này chỉ hiện <b>một lần</b>. Đóng đi thì phải tạo đường dẫn mới.
                </span>
              </div>
              <div className="pt-actions">
                <Button variant="primary" icon={<IconCopy />} onClick={() => void copy()}>
                  {copied === 'yes' ? 'Đã sao chép' : 'Sao chép tin nhắn'}
                </Button>
                {canSend && createBtn}
                <Button variant="ghost" onClick={() => (copied === 'yes' ? setFresh(null) : setDialog({ kind: 'close' }))}>
                  Đóng tin nhắn
                </Button>
              </div>
              <p className="pt-live" role="status" aria-live="polite">
                {copied === 'yes' ? 'Đã chép. Dán vào Zalo hoặc tin nhắn của học viên.' : copied === 'manual' ? 'Máy này không cho chép tự động. Chữ đã được chọn sẵn, hãy chép bằng tay.' : ''}
              </p>
            </>
          ) : (
            <>
              <p className="pt-note">{notAcademy ? 'Tổ chức chưa bật đào tạo' : portalLinkNote(view.link, timezone, now)}</p>
              {!canSend && missing.length > 0 && (
                <p className="pt-hint" role="note">
                  Gửi đường dẫn cần thêm quyền xem khách hàng, hợp đồng và phiếu thu.
                </p>
              )}
              {noPhone && <p className="pt-hint">Thêm số điện thoại cho học viên trước.</p>}
              {view.eligible.ok && !view.hasCourseContract && (
                <p className="pt-gray" role="note">
                  Học viên chưa có hợp đồng khoá học đã xác nhận — trang sẽ trống.
                </p>
              )}
              {canSend && (
                <div className="pt-actions">{createBtn}</div>
              )}
            </>
          )}

          {view.devices.length > 0 && (
            <section className="pt-devs" aria-label="Máy đã mở cổng">
              <h3 className="pt-devs__title">
                Máy đã mở cổng <span>{`(tối đa ${PORTAL_MAX_DEVICES})`}</span>
              </h3>
              <ul>
                {view.devices.map((d) => (
                  <li key={d.id} className="pt-dev">
                    <div className="pt-dev__main">
                      <strong>{d.label}</strong>
                      <span className="pt-dev__sub">
                        {`Mở lần đầu ${formatPortalWhen(d.createdAt, timezone, now)} · lần cuối ${formatPortalWhen(d.lastSeenAt, timezone, now)}`}
                      </span>
                      {d.status !== 'ACTIVE' && d.endedAt !== null && (
                        <span className="pt-dev__sub">
                          {`${PORTAL_DEVICE_STATUS_LABEL[d.status]} ${formatPortalWhen(d.endedAt, timezone, now)}${d.endedByName ? ` · ${d.endedByName}` : ''}`}
                        </span>
                      )}
                    </div>
                    {d.status === 'ACTIVE' ? (
                      <Button size="sm" className="pt-outline-danger" aria-label={`Chặn máy ${d.label}`} onClick={() => setDialog({ kind: 'block', device: d })}>
                        Chặn máy này
                      </Button>
                    ) : (
                      <StatusTag tone={PORTAL_DEVICE_STATUS_TONE[d.status]}>{PORTAL_DEVICE_STATUS_LABEL[d.status]}</StatusTag>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Card>
      <p className="pt-foot" role="note">
        {`Đường dẫn chưa mở hết hạn sau ${PORTAL_LINK_TTL_DAYS} ngày. Nhập sai 4 số cuối ${PORTAL_MAX_FAILED} lần là khoá, trung tâm phải tạo đường dẫn mới.`}
      </p>

      {dialog?.kind === 'create' && (
        <CreateDialog
          phoneLast4={view.phoneLast4}
          replacing={live}
          onClose={() => setDialog(null)}
          onCreate={async () => created(await createPortalLink(orgId, customerId))}
        />
      )}
      {dialog?.kind === 'block' && (
        <ReasonDialog
          title={`Chặn máy ${dialog.device.label}?`}
          message={PORTAL_CONSEQUENCE.block}
          confirmLabel="Chặn máy"
          initialReason={PORTAL_REASON_BLOCK}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const r = await blockPortalDevice(orgId, dialog.device.id, reason);
            load.set(() => r.view);
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === 'revoke' && (
        <ReasonDialog
          title="Thu hồi đường dẫn và chặn mọi máy?"
          message={PORTAL_CONSEQUENCE.revoke}
          confirmLabel="Thu hồi"
          initialReason={PORTAL_REASON_REVOKE}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const r = await revokePortal(orgId, customerId, reason);
            load.set(() => r.view);
            setFresh(null);
            setDialog(null);
          }}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === 'close'}
        onClose={() => setDialog(null)}
        title="Đóng tin nhắn?"
        message="Bạn chưa sao chép tin. Đóng đi thì phải tạo đường dẫn mới."
        confirmLabel="Đóng tin"
        cancelLabel="Giữ lại"
        danger
        onConfirm={() => {
          setFresh(null);
          setDialog(null);
        }}
      />
    </>
  );
}

// Hộp tạo đường dẫn: bắt buộc tick "đã đối chiếu 4 số cuối"; nút Tạo khoá khi chưa tick hoặc đang gửi.
function CreateDialog({
  phoneLast4,
  replacing,
  onClose,
  onCreate,
}: {
  phoneLast4: string | null;
  replacing: boolean;
  onClose: () => void;
  onCreate: () => Promise<void>;
}) {
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit() {
    if (!ticked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate();
    } catch (err) {
      if (mounted.current) setError(forbiddenMessage(err) ?? userMessage(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Tạo đường dẫn cho học viên"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!ticked} loading={busy}>
            Tạo
          </Button>
        </>
      }
    >
      {replacing && <p className="pt-dlg__msg">{PORTAL_CONSEQUENCE.create}</p>}
      <Checkbox
        checked={ticked}
        disabled={busy}
        onChange={(e) => setTicked(e.target.checked)}
        data-autofocus
        label={
          <>
            Tôi đã đối chiếu số điện thoại đuôi <b className="pt-last4">{phoneLast4 ?? '????'}</b> với học viên
          </>
        }
      />
      {error && (
        <div className="ui-field__error pt-dlg__err" role="alert">
          {error}
        </div>
      )}
    </Dialog>
  );
}

// Hộp hỏi lại có ô lý do điền sẵn (sửa được, bắt buộc không trống).
function ReasonDialog({
  title,
  message,
  confirmLabel,
  initialReason,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  initialReason: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(initialReason);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit() {
    const text = reason.trim();
    if (busy) return;
    if (text === '') {
      setError('Nhập lý do trước khi xác nhận.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text);
    } catch (err) {
      if (mounted.current) setError(forbiddenMessage(err) ?? userMessage(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="pt-dlg__msg">{message}</p>
      <div className="pt-dlg__reason">
        <label htmlFor={id}>Lý do</label>
        <Textarea
          id={id}
          value={reason}
          maxLength={REASON_MAX}
          disabled={busy}
          data-autofocus
          onChange={(e) => {
            setReason(e.target.value);
            if (error && e.target.value.trim() !== '') setError(null);
          }}
        />
      </div>
      {error && (
        <div className="ui-field__error pt-dlg__err" role="alert">
          {error}
        </div>
      )}
    </Dialog>
  );
}
