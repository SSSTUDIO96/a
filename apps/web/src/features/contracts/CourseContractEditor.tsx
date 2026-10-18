import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CONTRACT_STATUS_LABELS, type Permission } from '@makeup/shared';
import { addContractLine, changeContractStatus, createContract, listContractTexts, updateContract, voidContractLine } from '../../api/contracts';
import type { ClassListItem, CourseListItem } from '../../api/courses';
import { errorKind, fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { getCustomer } from '../../api/schedule';
import { listStaff } from '../../api/staff';
import { useQuote } from '../../api/useQuote';
import type { ContractDetail, ContractQuote, ContractText, ContractTextKind, ContractUpdateInput, PaymentInstallment, StaffMember } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { BottomSheet, Button, Card, IconLock, IconPlus, Select, SkeletonText, StatusTag, StickyTotalBar, Tooltip, formatVnd } from '../../ui';
import { fullDate, scheduleText } from '../courses/logic';
import { ContractPrintDialog, type PrintLine, type PrintText } from './ContractPrint';
import { ContractTextsCard, TextsManager } from './ContractTexts';
import { CourseInstallments, InstallmentsPlaceholder } from './CourseInstallments';
import { CourseLineCard } from './CourseLineCard';
import { CoursePicker } from './CoursePicker';
import {
  EMPTY_COURSE_DRAFT,
  buildCourseBody,
  classChoice,
  coursePatchBody,
  courseDraftFromDetail,
  defaultText,
  enrolledText,
  matchCourseQuote,
  quoteSeatWarnings,
  seatConflictOf,
  validateCourseDraft,
  type CourseContractDraft,
  type CourseDraftLine,
  type CourseLineDraft,
} from './courseModel';
import { CustomerBlock } from './CustomerBlock';
import { ExtraDialog, type ExtraTarget } from './ExtraDialog';
import { ExtrasCard, type ExtraRow } from './ExtrasCard';
import { IconWarn } from './icons';
import { addedLabel, belowPaidText, contractAbilities, errorLineOf, isStaleVersion, liveErrors, moneyFieldOf, newLineKey, prettyMoneyText, type CustomDraft } from './model';
import { TotalsCard } from './TotalsCard';
import { useCourseCatalog } from './useCourseCatalog';
import { VoidLineDialog } from './VoidLineDialog';
import './contracts.css';

// Lập hợp đồng KHOÁ HỌC (bản vẽ C3 mục 2.3): cột trái danh mục khoá theo nhóm; cột phải học viên + người phụ trách,
// dòng khoá học (chọn lớp), khoản tự đặt tên (giáo trình, dụng cụ), tổng – cọc, tiến độ thanh toán, điều khoản & nội quy,
// thanh tổng dính đáy. Mọi số tiền là số máy chủ trả (quote / hợp đồng đã lưu).

export interface CourseContractEditorProps {
  orgId: string;
  slug: string;
  tz: string;
  orgName: string;
  has: (p: Permission) => boolean;
  // Hợp đồng đã lưu (trang cha đã tải để biết loại); null = lập mới.
  detail: ContractDetail | null;
  // Seg loại hợp đồng (chỉ hiện ở tổ chức đào tạo).
  kindSwitch?: ReactNode;
  onCreated: (d: ContractDetail) => void;
}

interface Alert {
  text: string;
  tone?: 'danger' | 'ok' | 'warn';
  link?: { to: string; label: string };
}

type StaffState = { status: 'idle' | 'loading' } | { status: 'ready'; items: StaffMember[] } | { status: 'error'; error: unknown };

function sig(d: CourseContractDraft): string {
  return JSON.stringify(coursePatchBody(d));
}

export function CourseContractEditor({ orgId, slug, tz, orgName, has, detail: initial, kindSwitch, onCreated }: CourseContractEditorProps) {
  const navigate = useNavigate();
  const phone = useBreakpoint() === 'phone';
  const online = useOnline();
  const canCourses = has('courses.read');
  const { state: catState, reload: reloadCatalog } = useCourseCatalog(orgId, canCourses);
  const cat = catState.data;

  const [detail, setDetail] = useState<ContractDetail | null>(initial);
  const [draft, setDraft] = useState<CourseContractDraft>(EMPTY_COURSE_DRAFT);
  // Nháp đã dựng từ hợp đồng đã lưu chưa (cần danh sách lớp để biết dòng thuộc khoá nào).
  const [draftOf, setDraftOf] = useState<string | null>(null);
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<{ fields: Record<string, string>; line: number | null; message: string | null }>({ fields: {}, line: null, message: null });
  const [alert, setAlert] = useState<Alert | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);
  const [depositTouched, setDepositTouched] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [extraTarget, setExtraTarget] = useState<ExtraTarget | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ id: string; name: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [installments, setInstallments] = useState<PaymentInstallment[] | null>(null);
  const idemKey = useRef(newIdempotencyKey());
  const pickRef = useRef<HTMLDivElement>(null);

  // ---- Mẫu điều khoản / nội quy ----
  const [texts, setTexts] = useState<ContractText[] | null>(null);
  const [textsError, setTextsError] = useState<string | null>(null);
  const [textsAttempt, setTextsAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setTextsError(null);
    listContractTexts(orgId, { appliesTo: 'COURSE' }, controller.signal)
      .then(setTexts)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setTextsError(`Chưa tải được mẫu điều khoản: ${userMessage(err)}`);
      });
    return () => controller.abort();
  }, [orgId, textsAttempt]);

  // ---- Người phụ trách (danh sách thợ / nhân viên — cần staff.read) ----
  const canStaff = has('staff.read');
  const [staff, setStaff] = useState<StaffState>({ status: 'idle' });
  useEffect(() => {
    if (!canStaff) return undefined;
    const controller = new AbortController();
    setStaff({ status: 'loading' });
    listStaff(orgId, undefined, controller.signal)
      .then((r) => setStaff({ status: 'ready', items: r.items.filter((m) => m.status === 'ACTIVE') }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setStaff({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, canStaff]);

  // ---- Hợp đồng đã lưu → nháp ----
  useEffect(() => {
    if (!detail || draftOf === detail.id || !cat) return;
    const d = courseDraftFromDetail(detail, cat.classes);
    setDraft(d);
    setSavedSig(sig(d));
    setDraftOf(detail.id);
    setResetKey((k) => k + 1);
  }, [detail, draftOf, cat]);

  // ---- Hợp đồng mới chọn sẵn: ?classId= (màn Khoá & lớp) và ?customerId= ----
  const [searchParams] = useSearchParams();
  const presetClassId = initial === null ? searchParams.get('classId') : null;
  const presetCustomerId = initial === null ? searchParams.get('customerId') : null;
  const [presetNote, setPresetNote] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState<string | null>(null);
  const presetDone = useRef(false);
  useEffect(() => {
    if (!presetClassId || presetDone.current || !cat) return;
    presetDone.current = true;
    const cls = cat.classes.find((c) => c.id === presetClassId);
    if (!cls || cls.status === 'CANCELLED') {
      setPresetNote('Không tìm thấy lớp này (hoặc lớp đã huỷ). Chọn khoá và lớp ở danh mục.');
      return;
    }
    const choice = classChoice(cls);
    setDraft((d) => ({
      ...d,
      lines: [{ key: newLineKey(), kind: 'COURSE', courseId: cls.course.id, courseName: cls.course.name, classId: choice.disabled ? null : cls.id }, ...d.lines],
    }));
    if (choice.disabled) setPresetNote(`${choice.reason} — chọn lớp khác.`);
  }, [presetClassId, cat]);
  useEffect(() => {
    if (!presetCustomerId) return undefined;
    const controller = new AbortController();
    getCustomer(orgId, presetCustomerId, controller.signal)
      .then((c) => setDraft((d) => (d.customer ? d : { ...d, customer: { kind: 'existing', id: c.id, fullName: c.fullName, phone: c.phone, email: c.email } })))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const k = errorKind(err);
        setCustomerNote(k === 'not_found' || k === 'validation' ? 'Không tìm thấy học viên này trong tổ chức. Chọn lại.' : userMessage(err));
      });
    return () => controller.abort();
  }, [orgId, presetCustomerId]);

  // Hợp đồng mới: gợi ý sẵn mẫu mặc định (người dùng đổi được).
  const textsPreset = useRef(false);
  useEffect(() => {
    if (initial !== null || textsPreset.current || !texts) return;
    textsPreset.current = true;
    setDraft((d) => ({
      ...d,
      termsTemplateId: d.termsTemplateId ?? defaultText(texts, 'TERMS')?.id ?? null,
      rulesTemplateId: d.rulesTemplateId ?? defaultText(texts, 'RULES')?.id ?? null,
    }));
  }, [initial, texts]);

  const status = detail?.status ?? null;
  const ab = contractAbilities(has, status);
  const draftMode = status === null || status === 'DRAFT';
  const ready = initial === null || draftOf === detail?.id;

  // ---- Bảng tính máy chủ ----
  const localErrors = useMemo(() => validateCourseDraft(draft), [draft]);
  const body = draftMode && ready && Object.keys(localErrors).length === 0 ? buildCourseBody(draft) : null;
  const quote = useQuote(draftMode ? orgId : null, body);
  const quoteFailed = Boolean(body) && !quote.loading && quote.error !== null && quote.error !== undefined;
  const quoteData: ContractQuote | null = body && !quoteFailed ? quote.data : null;
  const views = matchCourseQuote(draft, quoteData);
  const pending = quote.loading;
  const quoteWarnings = draftMode ? quoteSeatWarnings(quoteData) : [];

  const quoteMoneyError = body && quote.error ? moneyFieldOf(quote.error) : null;
  const errors: Record<string, string> = {
    ...(showErrors ? localErrors : liveErrors(localErrors)),
    ...(body ? quote.fieldErrors : {}),
    ...(quoteMoneyError ? { [quoteMoneyError.field]: quoteMoneyError.message } : {}),
    ...serverErrors.fields,
  };
  const lineErrorAt = (i: number): string | null => {
    if (serverErrors.line === i) return serverErrors.message;
    if (body && quote.errorLine === i) return prettyMoneyText(userMessage(quote.error));
    return errors[`lines.${i}.courseClassId`] ?? null;
  };
  const quoteGeneralError =
    body && quote.error && !quoteMoneyError && quote.errorLine === null && Object.keys(quote.fieldErrors).length === 0 ? prettyMoneyText(userMessage(quote.error)) : null;

  // ---- Sửa nháp ----
  const dirty = savedSig === null || sig(draft) !== savedSig;
  const update = (fn: (d: CourseContractDraft) => CourseContractDraft) => {
    setDraft(fn);
    setServerErrors({ fields: {}, line: null, message: null });
  };
  const usedCourseIds = new Set(draft.lines.flatMap((l) => (l.kind === 'COURSE' ? [l.courseId] : [])));

  function addCourse(c: CourseListItem) {
    setSheetOpen(false);
    if (!draftMode) return;
    setSeatError(null);
    setPresetNote(null);
    // Khoá có đúng một lớp còn nhận ghi danh → chọn sẵn lớp đó.
    const open = (cat?.classes ?? []).filter((k) => k.courseId === c.id && !classChoice(k).disabled);
    const line: CourseLineDraft = { key: newLineKey(), kind: 'COURSE', courseId: c.id, courseName: c.name, classId: open.length === 1 ? (open[0] as ClassListItem).id : null };
    update((d) => ({ ...d, lines: [...d.lines.filter((l) => l.kind === 'COURSE'), line, ...d.lines.filter((l) => l.kind !== 'COURSE')] }));
  }

  // ---- Lưu / xác nhận ----
  const scrollToFirstError = () =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('.ct-page [aria-invalid="true"], .ct-page .ct-err, .ct-page .ct-alert');
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    });

  const applyError = (err: unknown) => {
    const seat = seatConflictOf(err);
    if (seat) {
      // Lớp vừa đầy / ngừng nhận: dải đỏ + tải lại số chỗ của mọi lớp. Hợp đồng vẫn là nháp, không lớp nào bị trừ chỗ.
      setSeatError(seat.message);
      reloadCatalog();
      scrollToFirstError();
      return;
    }
    if (isStaleVersion(err)) {
      setAlert({ text: 'Hợp đồng vừa được người khác sửa — tải lại trang để xem bản mới. Chữ bạn đang nhập chưa được lưu.' });
      scrollToFirstError();
      return;
    }
    const below = belowPaidText(err);
    if (below) {
      setAlert({ text: below });
      return;
    }
    const money = moneyFieldOf(err);
    const fields = money ? { ...fieldErrors(err), [money.field]: money.message } : fieldErrors(err);
    const line = errorLineOf(err);
    const text = prettyMoneyText(userMessage(err));
    setServerErrors({ fields, line, message: line !== null ? text : null });
    if (line === null && (Object.keys(fields).length === 0 || errorKind(err) !== 'validation')) setAlert({ text });
    scrollToFirstError();
  };

  const withVersion = (d: ContractDetail, b: Omit<ContractUpdateInput, 'expectedUpdatedAt'>): ContractUpdateInput => ({ ...b, expectedUpdatedAt: d.updatedAt });

  async function save(): Promise<ContractDetail | null> {
    setShowErrors(true);
    setAlert(null);
    setSeatError(null);
    if (Object.keys(localErrors).length > 0) {
      scrollToFirstError();
      return null;
    }
    const b = buildCourseBody(draft);
    if (!b) return null;
    try {
      let d: ContractDetail;
      if (!detail) {
        d = await createContract(orgId, b, idemKey.current);
        const c = d.customer;
        const next: CourseContractDraft = { ...draft, customer: { kind: 'existing', id: c.id, fullName: c.fullName, phone: c.phone, email: c.email } };
        setDraft(next);
        setDraftOf(d.id);
        setSavedSig(sig(next));
        setDetail(d);
        onCreated(d);
        void navigate(`/${slug}/hop-dong/${d.id}`, { replace: true });
      } else {
        d = await updateContract(orgId, detail.id, withVersion(detail, coursePatchBody(draft)));
        setDetail(d);
        setSavedSig(sig(draft));
      }
      return d;
    } catch (err) {
      applyError(err);
      return null;
    }
  }

  async function onSave() {
    setBusy('save');
    const d = await save();
    if (d) setAlert({ text: `Đã lưu nháp ${d.code}. Chỗ trong lớp chỉ được giữ khi xác nhận hợp đồng.`, tone: 'ok' });
    setBusy(null);
  }

  async function onConfirm() {
    setBusy('confirm');
    try {
      const d = dirty || !detail ? await save() : detail;
      if (!d) return;
      try {
        const res = await changeContractStatus(orgId, d.id, { to: 'CONFIRMED' });
        setDetail(res);
        setSeatError(null);
        reloadCatalog();
        setAlert({ text: enrolledText(res), tone: 'ok', link: has('payments.read') ? { to: `/${slug}/thu-tien/${res.id}`, label: 'Thu tiền' } : undefined });
      } catch (err) {
        applyError(err);
      }
    } finally {
      setBusy(null);
    }
  }

  async function saveExtra(line: CustomDraft): Promise<string | null> {
    if (draftMode) {
      const exists = draft.lines.some((l) => l.key === line.key);
      update((d) => ({ ...d, lines: exists ? d.lines.map((l) => (l.key === line.key ? line : l)) : [...d.lines, line] }));
      setExtraTarget(null);
      return null;
    }
    if (!detail) return null;
    try {
      const note = line.note.trim();
      const d = await addContractLine(orgId, detail.id, { kind: 'CUSTOM', name: line.name.trim(), unitPrice: line.unitPrice ?? 0, quantity: line.quantity, ...(note ? { note } : {}) }, newIdempotencyKey());
      setDetail(d);
      setExtraTarget(null);
      return null;
    } catch (err) {
      return Object.values(fieldErrors(err))[0] ?? userMessage(err);
    }
  }

  const onInstallments = useCallback((items: PaymentInstallment[] | null) => setInstallments(items), []);

  // ---- Hiển thị ----
  const classesOf = (courseId: string) =>
    (cat?.classes ?? []).filter((k) => k.courseId === courseId).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, 'vi'));

  if (initial !== null && !ready) {
    return (
      <div className="ct-page">
        <PageHeader title="Hợp đồng" backTo={`/${slug}/hop-dong`} />
        <Card>
          {catState.status === 'error' ? (
            <div className="ct-alert" role="alert">
              {userMessage(catState.error)} <Button size="sm" onClick={reloadCatalog}>Thử lại</Button>
            </div>
          ) : (
            <SkeletonText lines={6} label="Đang tải hợp đồng khoá học" />
          )}
        </Card>
      </div>
    );
  }

  const totals = draftMode ? quoteData : detail;
  const depositInput = draftMode ? (depositTouched ? draft.depositRequired : (draft.depositRequired ?? quoteData?.depositRequired ?? null)) : (detail?.depositRequired ?? null);
  const deposit = draftMode ? (quoteData?.depositRequired ?? null) : (detail?.depositRequired ?? null);
  const enrollmentOf = (lineId: string | null) => detail?.enrollments.find((e) => e.contractLineId === lineId) ?? null;

  // Dòng khoá học trên màn: nháp → dòng đang nhập; đã xác nhận → dòng máy chủ (kể cả đã huỷ).
  const courseCards = draftMode
    ? draft.lines.flatMap((l, i) => (l.kind === 'COURSE' ? [{ l, i, view: views[i] ?? null }] : []))
    : (detail?.lines ?? []).flatMap((v, i) => {
        if (v.kind !== 'COURSE') return [];
        const cls = cat?.classes.find((c) => c.id === v.courseClassId);
        const l: CourseLineDraft = { key: v.id, kind: 'COURSE', courseId: cls?.course.id ?? '', courseName: cls?.course.name ?? v.name, classId: v.courseClassId };
        return [{ l, i, view: v }];
      });

  const extraRows: ExtraRow[] = draftMode
    ? draft.lines.flatMap((l, i): ExtraRow[] =>
        l.kind === 'CUSTOM'
          ? [
              {
                key: l.key,
                kind: 'CUSTOM',
                name: l.name,
                quantity: l.quantity,
                note: l.note.trim() || null,
                view: views[i] ?? null,
                addedLabel: null,
                error: errors[`lines.${i}.unitPrice`] ?? errors[`lines.${i}.name`] ?? lineErrorAt(i),
              },
            ]
          : [],
      )
    : (detail?.lines ?? [])
        .filter((v) => v.kind === 'CUSTOM')
        .map((v) => ({ key: v.id, kind: 'CUSTOM' as const, name: v.name, quantity: v.quantity, note: v.note, view: v, addedLabel: addedLabel(v, tz), error: null }));

  // ---- Bản in ----
  const classDetail = (classId: string | null) => {
    const c = cat?.classes.find((k) => k.id === classId);
    if (!c) return null;
    return [`Khai giảng ${fullDate(c.startDate)} → ${fullDate(c.endDate)}`, scheduleText(c), c.instructor ? `Giảng viên ${c.instructor.name}` : null, c.location?.name ?? null].filter(Boolean).join(' · ');
  };
  const printLines: PrintLine[] = draftMode
    ? draft.lines.map((l, i) => ({
        key: l.key,
        name: l.kind === 'COURSE' ? (views[i]?.name ?? l.courseName) : `${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ''}`,
        detail: l.kind === 'COURSE' ? classDetail(l.classId) : null,
        amount: views[i]?.lineTotal ?? null,
      }))
    : (detail?.lines ?? [])
        .filter((v) => !v.voidedAt)
        .map((v) => ({ key: v.id, name: `${v.name}${v.quantity > 1 ? ` × ${v.quantity}` : ''}`, detail: v.kind === 'COURSE' ? classDetail(v.courseClassId) : null, amount: v.lineTotal }));
  const pickText = (kind: ContractTextKind): PrintText | null => {
    const title = kind === 'TERMS' ? 'Điều khoản' : 'Nội quy trung tâm';
    if (!draftMode && detail) {
      const bodyText = kind === 'TERMS' ? detail.terms : detail.rules;
      const v = kind === 'TERMS' ? detail.termsTemplateVersion : detail.rulesTemplateVersion;
      const id = kind === 'TERMS' ? detail.termsTemplateId : detail.rulesTemplateId;
      const name = texts?.find((t) => t.id === id)?.name;
      return bodyText ? { title, source: v ? `${name ? `${name} · ` : ''}bản v${v}` : null, body: bodyText } : null;
    }
    const id = kind === 'TERMS' ? draft.termsTemplateId : draft.rulesTemplateId;
    const t = (texts ?? []).find((x) => x.id === id) ?? defaultText(texts ?? [], kind);
    return t ? { title, source: `${t.name} · bản v${t.version}`, body: t.body } : null;
  };
  const printTexts = [pickText('TERMS'), pickText('RULES')].filter((t): t is PrintText => t !== null);
  const fmtDate = (iso: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  const printDate = `Ngày ${fmtDate(detail?.confirmedAt ?? new Date().toISOString())}`;

  // ---- Người phụ trách ----
  const ownerName = (id: string | null) => (id && staff.status === 'ready' ? (staff.items.find((m) => m.membershipId === id)?.displayName ?? null) : null);
  const ownerControl =
    detail !== null ? (
      <span className="ct-own__v">{ownerName(detail.ownerMembershipId) ?? (detail.ownerMembershipId ? 'Đã chọn' : 'Chưa chọn')}</span>
    ) : !canStaff ? (
      <span className="ct-fx">Cần quyền xem nhân sự để chọn người phụ trách.</span>
    ) : staff.status === 'error' ? (
      <span className="ct-err">{userMessage(staff.error)}</span>
    ) : (
      <Select
        id="hd-phu-trach"
        aria-label="Người phụ trách"
        disabled={!ab.canEdit || staff.status !== 'ready'}
        options={[{ value: '', label: staff.status === 'ready' ? 'Chưa chọn' : 'Đang tải…' }, ...(staff.status === 'ready' ? staff.items.map((m) => ({ value: m.membershipId, label: m.displayName })) : [])]}
        value={draft.ownerMembershipId ?? ''}
        onChange={(e) => update((d) => ({ ...d, ownerMembershipId: e.target.value || null }))}
      />
    );

  const statusTag = (
    <StatusTag tone={status === 'CANCELLED' ? 'danger' : status === null || status === 'DRAFT' ? 'draft' : 'ok'}>
      {status === 'CONFIRMED' && detail?.confirmedAt ? `Đã xác nhận · ${fmtDate(detail.confirmedAt)}` : CONTRACT_STATUS_LABELS[status ?? 'DRAFT']}
    </StatusTag>
  );
  const headTitle = detail ? (
    <>
      {draftMode ? 'Lập hợp đồng' : 'Hợp đồng'} <span className="ct-code">{detail.code}</span>
    </>
  ) : (
    'Lập hợp đồng khoá học mới'
  );

  const picker = cat ? (
    <CoursePicker catalog={cat} usedCourseIds={usedCourseIds} onAdd={addCourse} />
  ) : !canCourses ? (
    <div className="ct-cat__empty">Bạn cần quyền xem khoá học để chọn khoá.</div>
  ) : catState.status === 'error' ? (
    <div className="ct-cat__empty">
      {userMessage(catState.error)} <Button size="sm" onClick={reloadCatalog}>Thử lại</Button>
    </div>
  ) : (
    <div className="ct-cat__empty">
      <SkeletonText lines={5} label="Đang tải danh mục khoá" />
    </div>
  );
  const showPicker = draftMode && ab.canEdit;

  const saveBlocked = !online;
  const printButton = (
    <Button size={phone ? 'sm' : 'md'} onClick={() => setPrintOpen(true)} aria-label="Xem bản in">
      {phone ? 'Bản in' : 'Xem bản in'}
    </Button>
  );
  const actions = draftMode ? (
    ab.canEdit ? (
      <>
        {!phone && (
          <Button onClick={() => void onSave()} loading={busy === 'save'} disabled={saveBlocked || busy !== null}>
            Lưu nháp
          </Button>
        )}
        {printButton}
        <Button size={phone ? 'sm' : 'md'} variant="primary" onClick={() => void onConfirm()} loading={busy === 'confirm'} disabled={saveBlocked || busy !== null || draft.lines.length === 0}>
          {phone ? 'Xác nhận' : 'Xác nhận hợp đồng'}
        </Button>
      </>
    ) : (
      printButton
    )
  ) : (
    <>
      {printButton}
      {ab.canCollect && detail && (
        <Link className="ui-btn ui-btn--primary" to={`/${slug}/thu-tien/${detail.id}`} style={{ textDecoration: 'none' }}>
          <span className="ui-btn__text">Thu tiền</span>
        </Link>
      )}
    </>
  );

  return (
    <div className="ct-page ct-page--course">
      <PageHeader title={phone ? (detail ? `Hợp đồng ${detail.code}` : 'Lập hợp đồng') : draftMode ? 'Lập hợp đồng' : 'Hợp đồng'} backTo={`/${slug}/hop-dong`} phoneAction={statusTag} />
      <div className="ct-grid" style={showPicker ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {showPicker && (
          <Card className="ct-pick" aria-label="Danh mục khoá học">
            {kindSwitch}
            <div ref={pickRef} className="ct-cat">
              {picker}
            </div>
          </Card>
        )}
        <div className="ct-col">
          {/* Điện thoại (cột trái ẩn) hoặc không có danh mục (đã xác nhận, chỉ xem): seg loại đứng đầu cột. */}
          {kindSwitch && (phone || !showPicker) && <div className={phone ? 'ct-kind-phone' : 'ct-kind-top'}>{kindSwitch}</div>}
          <Card
            className="ct-head"
            title={headTitle}
            actions={
              <>
                {statusTag}
                {ab.canCancel && (
                  <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
                    Huỷ hợp đồng
                  </Button>
                )}
              </>
            }
          >
            <div className="ct-head__body">
              <div className="ct-set ct-set--top">
                <span className="ct-set__l">Học viên</span>
                <CustomerBlock
                  orgId={orgId}
                  customerHref={detail && has('customers.read') ? `/${slug}/khach-hang/${detail.customer.id}` : null}
                  value={draft.customer}
                  onChange={(customer) => update((d) => ({ ...d, customer }))}
                  locked={detail !== null || !ab.canEdit}
                  canSearch={ab.canSearchCustomers}
                  canCreate={ab.canCreateCustomer}
                  errors={errors}
                />
                {customerNote && !draft.customer && (
                  <div className="ct-err" role="alert" style={{ gridColumn: 2 }}>
                    {customerNote}
                  </div>
                )}
              </div>
              <div className="ct-set">
                <label className="ct-set__l" htmlFor="hd-phu-trach">
                  Người phụ trách
                  <Tooltip text="Người tư vấn và nhắc học viên đóng các đợt. Chọn lúc lập hợp đồng." />
                </label>
                {ownerControl}
              </div>
            </div>
          </Card>

          {status === 'CONFIRMED' && (
            <div className="ct-okband" role="status">
              <IconLock />
              <span>Hợp đồng đã chốt và đã giữ chỗ. Chỉ thêm khoản phát sinh hoặc huỷ dòng kèm lý do.</span>
            </div>
          )}
          {status === 'CANCELLED' && detail?.cancelReason && (
            <div className="ct-alert" role="status">
              Đã huỷ: {detail.cancelReason}
            </div>
          )}

          <Card title="Khoá học" className="ct-courses">
            {presetNote && (
              <div className="ct-alert ct-alert--warn" role="status" data-o="lop-chon-san">
                <IconWarn />
                <span>{presetNote}</span>
              </div>
            )}
            {(seatError || quoteWarnings.length > 0) && (
              <div className="ct-alert" role="alert" data-o="lop-vua-day">
                <IconWarn />
                <div>
                  {seatError ?? quoteWarnings[0]}
                  {catState.status === 'loading' && <span className="ct-fx"> · Đang tải lại số chỗ…</span>}
                </div>
              </div>
            )}
            {draftMode && !draft.customer && courseCards.length > 0 && (
              <p className="ct-fx" style={{ margin: 0 }} data-o="chon-hoc-vien">
                Chọn học viên để máy chủ tính học phí, tổng và cọc.
              </p>
            )}
            {courseCards.length === 0 && (
              <p className="ct-fx" style={{ margin: 0 }}>
                {showErrors && errors.lines ? <span className="ct-err">{errors.lines}</span> : 'Chọn khoá ở danh mục bên trái (theo nhóm khoá của trung tâm).'}
              </p>
            )}
            <div className="ct-courses__ls">
              {courseCards.map(({ l, i, view }) => (
                <CourseLineCard
                  key={l.key}
                  index={i}
                  line={l}
                  classes={classesOf(l.courseId)}
                  view={view}
                  pending={draftMode && pending}
                  locked={!draftMode || !ab.canEdit}
                  error={draftMode ? lineErrorAt(i) : null}
                  enrollment={draftMode ? null : enrollmentOf(view?.id ?? null)}
                  onPickClass={(classId) => {
                    setSeatError(null);
                    setPresetNote(null);
                    update((d) => ({ ...d, lines: d.lines.map((x) => (x.key === l.key ? { ...x, classId } : x)) as CourseDraftLine[] }));
                  }}
                  onRemove={draftMode && ab.canEdit ? () => update((d) => ({ ...d, lines: d.lines.filter((x) => x.key !== l.key) })) : null}
                  onVoid={ab.canVoidLine && view?.id ? () => setVoidTarget({ id: view.id as string, name: view.name }) : null}
                />
              ))}
            </div>
            {showPicker && (
              <Button variant="dashed" block className="ct-addm" icon={<IconPlus />} onClick={() => setSheetOpen(true)}>
                Thêm khoá học
              </Button>
            )}
          </Card>

          <ExtrasCard
            title="Khoản khác (giáo trình, dụng cụ…)"
            rows={extraRows}
            pending={draftMode && pending}
            onEdit={
              draftMode && ab.canEdit
                ? (key) => {
                    const l = draft.lines.find((x) => x.key === key);
                    if (l && l.kind === 'CUSTOM') setExtraTarget({ kind: 'CUSTOM', line: l });
                  }
                : null
            }
            onVoid={
              ab.canVoidLine
                ? (key) => {
                    const v = detail?.lines.find((x) => x.id === key);
                    if (v) setVoidTarget({ id: v.id, name: v.name });
                  }
                : null
            }
            onAddSurcharge={null}
            onAddCustom={(draftMode && ab.canEdit) || ab.canAddExtra ? () => setExtraTarget({ kind: 'CUSTOM', line: null }) : null}
          />

          <TotalsCard
            subtotal={totals?.subtotal ?? null}
            total={totals?.total ?? null}
            suggestedDeposit={draftMode ? (quoteData?.suggestedDeposit ?? null) : null}
            discount={draft.discount}
            deposit={depositInput}
            notes={draft.notes}
            moneyLocked={!draftMode || !ab.canEdit}
            notesLocked={!draftMode || !ab.canEdit}
            pending={draftMode && pending}
            errors={errors}
            resetKey={resetKey}
            depositLabel="Cọc phải thu"
            depositTip="Gợi ý từ cọc mặc định của khoá; là số tiền đợt Đặt cọc. Sửa được."
            onDiscount={(discount) => update((d) => ({ ...d, discount }))}
            onDeposit={(v) => {
              setDepositTouched(true);
              update((d) => ({ ...d, depositRequired: v }));
            }}
            onNotes={(notes) => update((d) => ({ ...d, notes }))}
          />

          {detail && has('payments.read') ? (
            <CourseInstallments orgId={orgId} contractId={detail.id} canWrite={has('payments.write') && status !== 'CANCELLED'} version={`${detail.updatedAt}:${detail.total}`} onInstallments={onInstallments} />
          ) : !detail ? (
            <InstallmentsPlaceholder />
          ) : null}

          <ContractTextsCard
            contractKind="COURSE"
            texts={texts}
            textsError={textsError}
            tz={tz}
            chosen={{ termsTemplateId: draft.termsTemplateId, rulesTemplateId: draft.rulesTemplateId }}
            snapshot={!draftMode && detail ? detail : null}
            locked={!draftMode || !ab.canEdit}
            canManage={has('contracts.texts')}
            onChoose={(k, id) => update((d) => (k === 'TERMS' ? { ...d, termsTemplateId: id } : { ...d, rulesTemplateId: id }))}
            onManage={() => setManageOpen(true)}
            onRetry={() => setTextsAttempt((n) => n + 1)}
          />

          {alert?.tone === 'ok' ? (
            <div className="ct-okband" role="status" data-o="da-ghi-danh">
              <IconLock />
              <span>{alert.text}</span>
              {alert.link && (
                <Link className="ct-lnk" to={alert.link.to}>
                  {alert.link.label}
                </Link>
              )}
            </div>
          ) : (
            (alert || quoteGeneralError) && (
              <div className="ct-alert" role="alert">
                <IconWarn />
                <div>{alert?.text ?? quoteGeneralError}</div>
              </div>
            )
          )}

          <div className="ct-totbar">
            <StickyTotalBar position="static" total={totals?.total ?? null} deposit={deposit} pending={draftMode && pending} actions={actions} />
          </div>
        </div>
      </div>

      {phone && showPicker && cat && (
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Thêm khoá học" className="ct-sheet">
          <CoursePicker catalog={cat} usedCourseIds={usedCourseIds} onAdd={addCourse} />
        </BottomSheet>
      )}

      <ExtraDialog
        target={extraTarget}
        surcharges={[]}
        onClose={() => setExtraTarget(null)}
        onSave={(l) => saveExtra(l as CustomDraft)}
        onRemove={
          draftMode
            ? (key) => {
                update((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) }));
                setExtraTarget(null);
              }
            : undefined
        }
        saveLabel={draftMode ? (extraTarget?.line ? 'Lưu' : 'Thêm') : 'Thêm phát sinh'}
      />

      <ContractPrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        eyebrow={detail ? `${detail.code} · ${CONTRACT_STATUS_LABELS[detail.status].toLowerCase()}` : 'Bản nháp chưa lưu'}
        orgName={orgName}
        title="HỢP ĐỒNG ĐÀO TẠO"
        code={detail?.code ?? null}
        dateText={printDate}
        customer={draft.customer ? { fullName: draft.customer.fullName, phone: draft.customer.phone || null } : null}
        lines={printLines}
        subtotal={totals?.subtotal ?? null}
        discount={draftMode ? draft.discount : (detail?.discount ?? 0)}
        total={totals?.total ?? null}
        deposit={deposit}
        installments={installments}
        texts={printTexts}
        notes={draft.notes.trim() || null}
        fmtDate={fmtDate}
      />

      <TextsManager open={manageOpen} orgId={orgId} tz={tz} onClose={() => setManageOpen(false)} onChanged={() => setTextsAttempt((n) => n + 1)} />

      <VoidLineDialog
        open={voidTarget !== null}
        title="Huỷ dòng"
        eyebrow={voidTarget?.name}
        confirmLabel="Huỷ dòng"
        onClose={() => setVoidTarget(null)}
        onConfirm={async (reason) => {
          if (!detail || !voidTarget) return null;
          try {
            const res = await voidContractLine(orgId, detail.id, voidTarget.id, { reason });
            setDetail(res);
            setVoidTarget(null);
            reloadCatalog();
            const adj = res.adjustments.map((a) => `${a.field === 'discount' ? 'giảm giá' : 'cọc'} từ ${formatVnd(a.from)} xuống ${formatVnd(a.to)}`).join(', ');
            setAlert(adj ? { text: `Máy chủ đã hạ ${adj} cho khớp tổng mới.`, tone: 'warn' } : null);
            return null;
          } catch (err) {
            return userMessage(err);
          }
        }}
      />

      <VoidLineDialog
        open={cancelOpen}
        title="Huỷ hợp đồng"
        eyebrow={detail?.code}
        confirmLabel="Huỷ hợp đồng"
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          if (!detail) return null;
          try {
            const res = await changeContractStatus(orgId, detail.id, { to: 'CANCELLED', reason });
            setDetail(res);
            setCancelOpen(false);
            reloadCatalog();
            return null;
          } catch (err) {
            return userMessage(err);
          }
        }}
      />
    </div>
  );
}

