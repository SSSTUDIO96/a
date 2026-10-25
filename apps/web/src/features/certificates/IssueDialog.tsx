import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router';
import { certificateCode, isCertificateTemplateCode, listDesignTemplates } from '@makeup/shared';
import { issueCertificates, getClassCertificateRoster, type CertificateFont, type CertificateView, type ClassCertificateRoster, type DebtWarning, type RosterItem } from '../../api/certificates';
import { ApiError, fieldErrors, userMessage } from '../../api/errors';
import { useBreakpoint, type Breakpoint } from '../../layout/useBreakpoint';
import {
  avatarColorIndex,
  Button,
  Card,
  ConfirmDialog,
  DateInput,
  Dialog,
  EmptyState,
  formatVnd,
  IconBack,
  IconNext,
  initialsOf,
  Segmented,
  SettingRow,
  Select,
  Skeleton,
  StatusTag,
} from '../../ui';
import { useRetainedIdempotencyKey } from '../auth/useRetainedIdempotencyKey';
import { LoadError } from '../courses/LoadError';
import { certNotEndedReason } from '../courses/logic';
import '../courses/courses.css';
import { CertificatePreview, type PreviewImage } from './CertificatePreview';
import { frameInputOfView, type CertificateFrameInput } from './frame';
import { codeRange, isSmallPhoto, pdfFileName, viDate } from './logic';
import { PrintSheet } from './PrintSheet';
import type { RenderDeps } from './render';

// Hộp "Cấp giấy chứng nhận" (bản vẽ F mục 6.2): chọn mẫu (16 mẫu có ảnh nhỏ) → chọn học viên (1 hoặc nhiều) → xem trước đúng từng
// người → Cấp (máy chủ đánh số) → bản in ngay trong hộp (PrintSheet: In ngay / Tải PDF / Chia sẻ PDF trên điện thoại).
// Nợ học phí chỉ CẢNH BÁO, không chặn. Người đã có giấy: in lại bản cũ (không gọi POST khi không có ai cấp mới).
// Dữ liệu từ GET /classes/:id/certificates; mọi con số "sẽ cấp" là DỰ KIẾN — máy chủ đánh số lúc bấm Cấp.

export interface IssueDialogProps {
  orgId: string;
  slug: string;
  classId: string;
  // Tên hiện trên thẻ lớp (hiện khi dữ liệu chưa về).
  title: string;
  // Có org.update → liên kết "Sửa" người ký sang Hồ sơ thương hiệu.
  canEditBrand: boolean;
  onClose: () => void;
  // Ghi đè khổ màn (bài thử); không truyền thì theo màn thật.
  breakpoint?: Breakpoint;
  // Thay bộ vẽ của bản in (bài thử).
  renderDeps?: Partial<RenderDeps>;
}

type Load = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: ClassCertificateRoster };
type PhoneStep = 'students' | 'preview';

interface PrintState {
  items: CertificateView[];
  note: string | null;
  debtWarnings: DebtWarning[];
  issuedOn: string;
}

const WIRE_DAY = /^\d{4}-\d{2}-\d{2}$/;
const FONT_CHOICES: readonly CertificateFont[] = ['ky-1', 'ky-2', 'ky-3', 'ky-4'];
const DEFAULT_TEMPLATE = 'cc-01';
export const TEMPLATE_MEMO_KEY = (orgId: string) => `gcn:mau:${orgId}`;
export const LIST_CHANGED_MESSAGE = 'Danh sách lớp vừa thay đổi — đã tải lại, bạn kiểm tra rồi bấm lại.';
const SWIPE_PX = 40;

function readMemo(orgId: string): string {
  try {
    const v = window.localStorage.getItem(TEMPLATE_MEMO_KEY(orgId));
    if (v && isCertificateTemplateCode(v)) return v;
  } catch {
    // Trình duyệt chặn bộ nhớ: dùng mẫu đầu.
  }
  return DEFAULT_TEMPLATE;
}

function writeMemo(orgId: string, code: string): void {
  try {
    window.localStorage.setItem(TEMPLATE_MEMO_KEY(orgId), code);
  } catch {
    // Không lưu được thì thôi: chỉ là tiện lợi.
  }
}

// Dòng chọn sẵn: mọi học viên trừ người "đã thu hồi mà chưa cấp lại".
export function defaultSelection(items: readonly RosterItem[]): Set<string> {
  return new Set(items.filter((i) => i.certificate !== null || i.lastRevoked === null).map((i) => i.enrollmentId));
}

function reasonOf(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const r = (err.details as { reason?: unknown } | undefined)?.reason;
  return typeof r === 'string' ? r : null;
}

function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}

export function IssueDialog({ orgId, slug, classId, title, canEditBrand, onClose, breakpoint, renderDeps }: IssueDialogProps) {
  const detected = useBreakpoint();
  const bp = breakpoint ?? detected;
  const phone = bp === 'phone';

  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Ngày dùng để hỏi số dự kiến khi đổi sang năm khác (bản vẽ 6.2). Không có = ngày mặc định của máy chủ.
  const [rosterOn, setRosterOn] = useState<string | null>(null);

  // Chưa chạm vào thì dùng mặc định của dữ liệu (chọn sẵn, ngày cấp = ngày kết thúc); chạm rồi thì giữ lựa chọn của người dùng.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [templateCode, setTemplateCode] = useState<string>(() => readMemo(orgId));
  const [dateDraft, setDateDraft] = useState<string | null | undefined>(undefined);
  const [dateTyping, setDateTyping] = useState<string | null>(null);
  const [dateServerError, setDateServerError] = useState<string | null>(null);
  const [font, setFont] = useState<'' | CertificateFont>('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [step, setStep] = useState<PhoneStep>('students');
  const [confirming, setConfirming] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [print, setPrint] = useState<PrintState | null>(null);
  const keys = useRetainedIdempotencyKey();
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // ---- Tải danh sách cấp của lớp ----
  useEffect(() => {
    const c = new AbortController();
    getClassCertificateRoster(orgId, classId, rosterOn ? { issuedOn: rosterOn } : {}, c.signal)
      .then((data) => {
        if (!c.signal.aborted) setLoad({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!c.signal.aborted) setLoad({ status: 'error', error });
      });
    return () => c.abort();
  }, [orgId, classId, attempt, rosterOn]);

  const reload = useCallback(() => {
    setPicked(null);
    setDateDraft(undefined);
    setDateTyping(null);
    setDateServerError(null);
    setPreviewId(null);
    setRosterOn(null);
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const data = load.status === 'ready' ? load.data : null;

  const items = useMemo(() => data?.items ?? [], [data]);
  const selected = useMemo(() => picked ?? defaultSelection(items), [picked, items]);
  const issuedOn = dateDraft === undefined ? (data?.defaultIssuedOn ?? null) : dateDraft;
  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.enrollmentId)), [items, selected]);
  const newItems = useMemo(() => selectedItems.filter((i) => i.certificate === null), [selectedItems]);
  const existingItems = useMemo(() => selectedItems.filter((i) => i.certificate !== null), [selectedItems]);
  const debtors = useMemo(() => (data?.moneyVisible ? newItems.filter((i) => (i.contract.debt ?? 0) > 0) : []), [data, newItems]);

  const templates = useMemo(() => listDesignTemplates({ kind: 'CERTIFICATE' }), []);
  const template = templates.find((t) => t.code === templateCode);
  const defaultFontNo = /(\d+)$/.exec(template?.fonts[0] ?? '')?.[1] ?? null;

  // Số dự kiến theo thứ tự danh sách lớp (máy chủ đánh số theo đúng thứ tự này).
  const codeOf = useMemo(() => {
    const map = new Map<string, string>();
    const next = data?.nextNumber;
    if (next) newItems.forEach((it, idx) => map.set(it.enrollmentId, certificateCode(next.year, next.seq + idx)));
    return map;
  }, [data, newItems]);
  const rangeText = useMemo(() => {
    const list = newItems.flatMap((i) => (codeOf.has(i.enrollmentId) ? [{ code: codeOf.get(i.enrollmentId) as string }] : []));
    return codeRange(list);
  }, [newItems, codeOf]);

  // ---- Ngày cấp ----
  const dateError = useMemo(() => {
    if (!data || data.defaultIssuedOn === null) return null;
    if (issuedOn === null) return 'Chọn ngày cấp.';
    if (!WIRE_DAY.test(issuedOn)) return 'Ngày cấp không đúng dạng.';
    if (issuedOn < data.class.endDate) return `Ngày cấp phải từ ngày kết thúc lớp (${viDate(data.class.endDate)}) trở đi`;
    if (issuedOn > data.today) return 'Ngày cấp không được sau hôm nay';
    return null;
  }, [data, issuedOn]);
  const dateShown = dateTyping ?? dateServerError ?? dateError;
  const dateOk = issuedOn !== null && dateError === null && dateTyping === null;

  const onDateChange = (v: string | null) => {
    setDateDraft(v);
    setDateServerError(null);
    if (v && data && WIRE_DAY.test(v) && v >= data.class.endDate && v <= data.today) {
      const basis = rosterOn ?? data.defaultIssuedOn ?? v;
      if (yearOf(v) !== yearOf(basis)) setRosterOn(v);
    }
  };

  // ---- Xem trước ----
  const previewItem = useMemo(() => {
    if (items.length === 0) return null;
    return items.find((i) => i.enrollmentId === previewId) ?? selectedItems[0] ?? items[0] ?? null;
  }, [items, previewId, selectedItems]);
  const navPos = previewItem ? selectedItems.findIndex((i) => i.enrollmentId === previewItem.enrollmentId) : -1;

  const stepPreview = (dir: 1 | -1) => {
    if (!previewItem || selectedItems.length === 0) return;
    const at = items.findIndex((i) => i.enrollmentId === previewItem.enrollmentId);
    const picks = selectedItems.map((i) => items.findIndex((x) => x.enrollmentId === i.enrollmentId));
    let target: number | undefined;
    if (dir > 0) target = picks.find((p) => p > at) ?? picks[0];
    else target = [...picks].reverse().find((p) => p < at) ?? picks[picks.length - 1];
    const it = target === undefined ? undefined : items[target];
    if (it) setPreviewId(it.enrollmentId);
  };

  const preview = useMemo(() => {
    if (!data || !previewItem || !isCertificateTemplateCode(templateCode)) return null;
    const cert = previewItem.certificate;
    if (cert) {
      const input: CertificateFrameInput = frameInputOfView(cert);
      return {
        input,
        photo: cert.photo ? ({ key: `c:${cert.id}`, url: cert.photo.url } satisfies PreviewImage) : null,
        logo: cert.logo ? ({ key: `l:${cert.id}`, url: cert.logo.url } satisfies PreviewImage) : null,
        badge: `Đã cấp · ${cert.code} · in lại bản cũ`,
        note: undefined as string | undefined,
        studentName: cert.studentName,
      };
    }
    const input: CertificateFrameInput = {
      templateCode,
      studentName: previewItem.customer.fullName,
      courseName: data.class.courseName,
      className: data.class.name,
      instructorName: data.class.instructorName,
      signerName: data.signer.name,
      signerTitle: data.signer.title,
      brandName: data.brandName,
      code: codeOf.get(previewItem.enrollmentId) ?? null,
      issuedOn: dateOk ? issuedOn : null,
      reissuedOn: null,
      fontOverride: font || null,
    };
    return {
      input,
      photo: previewItem.customer.photo ? ({ key: `p:${previewItem.customer.id}`, url: previewItem.customer.photo.url } satisfies PreviewImage) : null,
      logo: data.logo ? ({ key: `logo:${orgId}`, url: data.logo.url } satisfies PreviewImage) : null,
      badge: undefined as string | undefined,
      note: 'Số trên bản xem trước là số dự kiến' as string | undefined,
      studentName: previewItem.customer.fullName,
    };
  }, [data, previewItem, templateCode, codeOf, dateOk, issuedOn, font, orgId]);

  const onSwipeDown = (e: ReactPointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onSwipeUp = (e: ReactPointerEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) stepPreview(dx < 0 ? 1 : -1);
  };

  // Mẫu đang chọn cuộn vào tầm nhìn khi mở hộp.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    // Chỉ lúc dữ liệu về lần đầu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data !== null]);

  // ---- Chọn học viên ----
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const allOn = items.length > 0 && selectedItems.length === items.length;
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(items.map((i) => i.enrollmentId)));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedItems.length > 0 && !allOn;
  }, [selectedItems.length, allOn]);

  // ---- Cấp ----
  const className = data?.class.name ?? title;
  const blocked = !data || !data.ended || items.length === 0;
  const canGo = !blocked && selectedItems.length > 0 && dateOk;
  const issueBody = () => ({
    enrollmentIds: selectedItems.map((i) => i.enrollmentId),
    templateCode,
    issuedOn: issuedOn as string,
    ...(font ? { fontOverride: font } : {}),
  });

  const startPrint = (printItems: CertificateView[], note: string | null, debtWarnings: DebtWarning[], on: string) => {
    writeMemo(orgId, templateCode);
    setConfirming(false);
    setBanner(null);
    setPrint({ items: printItems, note, debtWarnings, issuedOn: on });
  };

  const onPrimary = () => {
    if (!canGo) return;
    if (newItems.length === 0) {
      // Không ai cấp mới: in lại bản cũ, KHÔNG gọi POST.
      startPrint(
        existingItems.map((i) => i.certificate as CertificateView),
        null,
        [],
        issuedOn as string,
      );
      return;
    }
    setBanner(null);
    setConfirming(true);
  };

  const doIssue = async () => {
    if (!data || issuedOn === null) return;
    const body = issueBody();
    const key = keys.keyFor(body);
    try {
      const res = await issueCertificates(orgId, classId, body, key);
      keys.reset();
      const before = new Set(items.flatMap((i) => (i.certificate ? [i.certificate.id] : [])));
      const fresh = res.items.filter((c) => !before.has(c.id));
      const parts = [`Đã cấp ${res.issuedCount} giấy chứng nhận${fresh.length > 0 ? ` (${codeRange(fresh)})` : ''}.`];
      if (res.existingCount > 0) parts.push(`${res.existingCount} học viên đã có giấy được in lại bản cũ.`);
      startPrint(res.items, parts.join(' '), res.debtWarnings, issuedOn);
    } catch (err) {
      const reason = reasonOf(err);
      const fe = fieldErrors(err);
      if (reason === 'CLASS_NOT_ENDED' || reason === 'CLASS_CANCELLED') {
        keys.reset();
        setConfirming(false);
        setBanner(userMessage(err));
        reload();
        return;
      }
      if (reason === 'CERTIFICATE_RACE' || Object.keys(fe).some((k) => k === 'enrollmentIds' || k.startsWith('enrollmentIds.'))) {
        keys.reset();
        setConfirming(false);
        setBanner(reason === 'CERTIFICATE_RACE' ? userMessage(err) : LIST_CHANGED_MESSAGE);
        reload();
        return;
      }
      if (fe.issuedOn) {
        setConfirming(false);
        setDateServerError(fe.issuedOn);
        setStep('preview');
        return;
      }
      // Lỗi mạng / máy chủ: giữ hộp xác nhận mở để bấm lại (khoá chống gửi trùng được giữ).
      throw err;
    }
  };

  // ---- Chữ ----
  const sel = selectedItems.length;
  const sumParts: string[] = [];
  if (newItems.length > 0) sumParts.push(`${newItems.length} cấp mới`);
  if (existingItems.length > 0) sumParts.push(`${existingItems.length} in lại`);
  const primaryLabel = sel === 0 ? 'Cấp và in' : newItems.length === 0 ? `In lại (${sel})` : `Cấp và in (${sel})`;
  const subtitle = data ? `${data.class.courseName} · ${data.class.name} · kết thúc ${viDate(data.class.endDate)}` : title;

  const summary = (
    <span className="gcn-iss__sum">
      <b>Đã chọn {sel} học viên</b>
      {sel > 0 && (
        <span>
          {' '}
          · {sumParts.join(' + ')} · {sel} trang A4 ngang
        </span>
      )}
    </span>
  );

  // ================= Bản in (sau khi cấp) =================
  if (print) {
    const cls = data?.class.name ?? className;
    return (
      <Dialog
        open
        onClose={onClose}
        className="gcn-dlg gcn-dlg--print"
        eyebrow={subtitle}
        title="Cấp giấy chứng nhận"
        footer={
          <>
            <Link className="ui-btn ui-btn--ghost gcn-iss__ledger" to={`/${slug}/giay-chung-nhan?lop=${encodeURIComponent(classId)}`}>
              <span className="ui-btn__text">Xem sổ giấy chứng nhận</span>
            </Link>
            <Button variant="primary" onClick={onClose}>
              Xong
            </Button>
          </>
        }
      >
        <div className="gcn-iss__print">
          {print.debtWarnings.length > 0 && (
            <div className="gcn-iss__warn" role="note">
              {print.debtWarnings.length} học viên còn nợ học phí, giấy vẫn được cấp:{' '}
              {print.debtWarnings.map((w) => (w.debt !== null && w.debt > 0 ? `${w.customerName} (${formatVnd(w.debt)})` : w.customerName)).join(', ')}.
            </div>
          )}
          <PrintSheet
            orgId={orgId}
            items={print.items}
            baseName={pdfFileName({ className: cls, issuedOn: print.issuedOn, today: data?.today ?? print.issuedOn })}
            pdfTitle={`Giấy chứng nhận — ${cls}`}
            issuedNote={print.note}
            breakpoint={bp}
            renderDeps={renderDeps}
          />
        </div>
      </Dialog>
    );
  }

  // ================= Hộp cấp =================
  const studentsCard = data && (
    <Card
      title="Học viên"
      subtitle={`${items.length} đang học · ${items.filter((i) => i.certificate).length} đã cấp`}
      flush
      className="gcn-iss__students"
    >
      <label className="gcn-iss__all">
        <input ref={selectAllRef} type="checkbox" checked={allOn} onChange={toggleAll} aria-label={`Chọn tất cả (${items.length})`} />
        <span>
          <b>Chọn tất cả ({items.length})</b>
          <small>Học viên đã huỷ ghi danh không hiện ở đây</small>
        </span>
      </label>
      <ul className="gcn-iss__list" aria-label="Học viên của lớp">
        {items.map((it) => (
          <StudentRow
            key={it.enrollmentId}
            item={it}
            slug={slug}
            checked={selected.has(it.enrollmentId)}
            active={previewItem?.enrollmentId === it.enrollmentId}
            moneyVisible={data.moneyVisible}
            onToggle={() => toggle(it.enrollmentId)}
            onPreview={() => {
              setPreviewId(it.enrollmentId);
              setStep('preview');
            }}
          />
        ))}
      </ul>
    </Card>
  );

  const templateCard = data && (
    <Card title="Mẫu giấy chứng nhận" subtitle={`${templates.length} mẫu · khổ A4 ngang`} className="gcn-iss__tpl">
      <div ref={stripRef} className="gcn-iss__strip" role="radiogroup" aria-label="Mẫu giấy chứng nhận">
        {templates.map((t) => {
          const on = t.code === templateCode;
          const label = `${t.code.slice(3)} · ${t.name}`;
          return (
            <button key={t.code} type="button" role="radio" aria-checked={on} aria-label={label} className={`gcn-iss__thumb${on ? ' is-on' : ''}`} onClick={() => setTemplateCode(t.code)}>
              <img src={`/mau/anh-nho/${t.code}.jpg`} alt="" loading="lazy" width={160} height={113} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <div className="gcn-iss__rows">
        <SettingRow label="Ngày cấp" htmlFor="gcn-issued-on" controlWidth={200}>
          <DateInput id="gcn-issued-on" value={issuedOn} onChange={onDateChange} onInputError={setDateTyping} error={dateShown} disabled={blocked} />
        </SettingRow>
        <SettingRow label="Phông tên học viên" htmlFor="gcn-font" controlWidth={240}>
          <Select
            id="gcn-font"
            value={font}
            onChange={(e) => setFont(e.target.value as '' | CertificateFont)}
            options={[
              { value: '', label: defaultFontNo ? `Theo mẫu (Chữ ký ${defaultFontNo})` : 'Theo mẫu' },
              ...FONT_CHOICES.map((f) => ({ value: f, label: `Chữ ký ${f.slice(3)}` })),
            ]}
          />
        </SettingRow>
        <SettingRow label="Số" tip="Máy chủ đánh số khi bấm Cấp, nối tiếp theo năm. Người đã có giấy giữ số cũ." controlWidth={300}>
          <span className="gcn-iss__val">{newItems.length > 0 && rangeText ? `Tự cấp: ${rangeText} (dự kiến)` : 'Không cấp số mới'}</span>
        </SettingRow>
        <SettingRow label="Người ký" controlWidth={340} stack={phone}>
          <span className="gcn-iss__val">
            {data.class.instructorName ?? 'chưa gán giảng viên'} · {data.signer.name ?? 'chưa điền tên Giám đốc'}
            {canEditBrand && (
              <>
                {' '}
                <Link className="gcn-iss__edit" to={`/${slug}/cai-dat/thuong-hieu`} target="_blank" rel="noreferrer">
                  Sửa
                </Link>
              </>
            )}
          </span>
        </SettingRow>
      </div>
    </Card>
  );

  const previewCard = data && (
    <Card title="Xem trước" subtitle={phone ? undefined : 'bấm tên bên trái hoặc mũi tên để xem từng người'} className="gcn-iss__prev">
      {preview && previewItem ? (
        <>
          <div className="gcn-iss__swipe" onPointerDown={onSwipeDown} onPointerUp={onSwipeUp} onPointerCancel={() => (swipeStart.current = null)}>
            <CertificatePreview
              input={preview.input}
              photo={preview.photo}
              logo={preview.logo}
              title={`Xem trước giấy chứng nhận của ${preview.studentName}`}
              badge={preview.badge}
              note={preview.note}
            />
          </div>
          <div className="gcn-iss__nav">
            <Button size="sm" icon={<IconBack />} aria-label="Học viên trước" onClick={() => stepPreview(-1)} disabled={sel === 0} />
            <b aria-live="polite">
              {navPos >= 0 ? `${navPos + 1}/${sel}` : 'Chưa chọn'} · {preview.studentName}
            </b>
            <Button size="sm" icon={<IconNext />} aria-label="Học viên sau" onClick={() => stepPreview(1)} disabled={sel === 0} />
          </div>
          {phone && <p className="gcn-iss__hint">Vuốt trái / phải để xem từng học viên.</p>}
        </>
      ) : (
        <EmptyState message="Chọn học viên và mẫu để xem trước." />
      )}
    </Card>
  );

  let body;
  if (load.status === 'loading') {
    body = (
      <div role="status" aria-label="Đang tải danh sách học viên" className="gcn-iss__skel">
        <Skeleton width="40%" height={20} />
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </div>
    );
  } else if (load.status === 'error') {
    body = <LoadError error={load.error} retry={reload} />;
  } else if (items.length === 0) {
    body = <EmptyState message="Lớp này không có học viên đang học." />;
  } else {
    body = (
      <>
        {banner && (
          <div className="gcn-iss__err" role="alert">
            {banner}
          </div>
        )}
        {!data!.ended && (
          <div className="gcn-iss__warn" role="status">
            {data!.class.status === 'CANCELLED' ? 'Lớp đã huỷ — không cấp được giấy chứng nhận.' : `${certNotEndedReason(data!.class.endDate)}.`}
          </div>
        )}
        {phone && (
          <Segmented<PhoneStep>
            block
            className="gcn-iss__seg"
            aria-label="Bước cấp giấy chứng nhận"
            value={step}
            onChange={setStep}
            options={[
              { value: 'students', label: `Học viên (${items.length})` },
              { value: 'preview', label: 'Mẫu & xem trước' },
            ]}
          />
        )}
        <div className={`gcn-iss gcn-iss--${bp}`}>
          {(!phone || step === 'students') && studentsCard}
          {(!phone || step === 'preview') && (
            <div className="gcn-iss__main">
              {templateCard}
              {previewCard}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        className="gcn-dlg"
        eyebrow={subtitle}
        title="Cấp giấy chứng nhận"
        footer={
          data && items.length > 0 ? (
            <div className="gcn-iss__foot">
              {summary}
              <Button variant="primary" onClick={onPrimary} disabled={!canGo}>
                {primaryLabel}
              </Button>
            </div>
          ) : (
            <Button onClick={onClose}>Đóng</Button>
          )
        }
      >
        {body}
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Cấp ${newItems.length} giấy chứng nhận mới?`}
        confirmLabel="Cấp và mở bản in"
        cancelLabel="Huỷ"
        width={520}
        errorMessage={userMessage}
        onConfirm={doIssue}
        message={
          <div className="gcn-iss__confirm">
            <p>
              Số dự kiến <b>{rangeText}</b>, ngày cấp <b>{issuedOn ? viDate(issuedOn) : ''}</b>, mẫu{' '}
              <b>
                {templateCode.slice(3)} · {template?.name ?? templateCode}
              </b>
              .
            </p>
            {existingItems.length > 0 && <p>{existingItems.length} học viên đã có giấy: in lại bản cũ (giữ số cũ, mẫu cũ).</p>}
            {debtors.length > 0 && (
              <div className="gcn-iss__warn" role="note">
                {debtors.length} học viên còn nợ học phí (tổng {formatVnd(debtors.reduce((a, i) => a + (i.contract.debt ?? 0), 0))}). Vẫn cấp được.
              </div>
            )}
            <div className="gcn-iss__warn" role="note">
              Đã cấp thì số và tên không sửa được. Tên sai: Sổ giấy chứng nhận → Cấp lại (giữ số cũ, ghi "bản cấp lại").
            </div>
          </div>
        }
      />
    </>
  );
}

function StudentRow({
  item,
  slug,
  checked,
  active,
  moneyVisible,
  onToggle,
  onPreview,
}: {
  item: RosterItem;
  slug: string;
  checked: boolean;
  active: boolean;
  moneyVisible: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const { customer, certificate, lastRevoked, contract } = item;
  const debt = moneyVisible && contract.debt !== null && contract.debt > 0 ? contract.debt : null;
  const noPhoto = customer.photo === null;
  const small = isSmallPhoto(customer.photo);
  return (
    <li className={`gcn-iss__row${active ? ' is-active' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Chọn ${customer.fullName}`} />
      <button type="button" className="gcn-iss__who" onClick={onPreview} aria-label={`Xem trước giấy của ${customer.fullName}`}>
        <StudentPhoto name={customer.fullName} url={customer.photo?.url ?? null} />
        <span className="gcn-iss__name">
          <b>{customer.fullName}</b>
          <span className="gcn-iss__sub">
            {certificate ? (
              <>
                Đã cấp · <b className="num">{certificate.code}</b>
              </>
            ) : lastRevoked ? (
              <>Đã thu hồi {lastRevoked.code} · cấp sẽ nhận số mới</>
            ) : (
              'Chưa cấp'
            )}
          </span>
        </span>
      </button>
      <span className="gcn-iss__tags">
        {certificate && <StatusTag tone="ok">Đã cấp</StatusTag>}
        {debt !== null && <StatusTag tone="warn">Còn nợ {formatVnd(debt)}</StatusTag>}
        {noPhoto && (
          <span className="gcn-iss__note gcn-iss__note--warn">
            chưa có ảnh — in chữ cái đầu ·{' '}
            <Link to={`/${slug}/khach-hang/${customer.id}`} target="_blank" rel="noreferrer">
              Thêm ảnh
            </Link>
          </span>
        )}
        {!noPhoto && small && <span className="gcn-iss__note gcn-iss__note--warn">ảnh nhỏ, in có thể mờ</span>}
      </span>
    </li>
  );
}

// Ảnh tròn học viên (cùng kiểu ui-av của Avatar). Không dùng <Avatar>: bài staffName.test.ts coi mọi <Avatar> ngoài danh sách
// "không phải thợ" là ảnh thợ và bắt đi qua sổ thợ chung; học viên không thuộc sổ đó.
function StudentPhoto({ name, url }: { name: string; url: string | null }) {
  const [broken, setBroken] = useState(false);
  const showImg = url !== null && !broken;
  return (
    <span className="ui-av" role="img" aria-label={name} title={name} style={showImg ? undefined : { background: `var(--av-${avatarColorIndex(name)})` }}>
      {showImg ? <img src={url} alt="" onError={() => setBroken(true)} /> : <span aria-hidden="true">{initialsOf(name)}</span>}
    </span>
  );
}
