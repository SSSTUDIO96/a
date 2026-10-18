import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CONTRACT_STATUS_LABELS, type Permission } from '@makeup/shared';
import {
  addContractLine,
  changeContractStatus,
  createContract,
  getContract,
  quoteContract,
  updateContract,
  voidContractLine,
} from '../../api/contracts';
import { errorKind, fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { getCustomer } from '../../api/schedule';
import { useQuote } from '../../api/useQuote';
import type { AppointmentConflict, Service, ServicePackage } from '../../api/types';
import { NotFoundView, useOnline } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import {
  BottomSheet,
  Button,
  Card,
  DateInput,
  IconLock,
  IconPlus,
  SkeletonText,
  StatusTag,
  StickyTotalBar,
  WithTooltip,
  formatVnd,
} from '../../ui';
import { CatalogPicker } from './CatalogPicker';
import { CustomerBlock } from './CustomerBlock';
import { ExtraDialog, type ExtraTarget } from './ExtraDialog';
import { ExtraPackageDialog } from './ExtraPackageDialog';
import { ExtrasCard, type ExtraRow } from './ExtrasCard';
import { IconWarn } from './icons';
import {
  EMPTY_DRAFT,
  buildBody,
  conflictsForLine,
  confirmBlockedReason,
  conflictsOf,
  contractAbilities,
  displayDate,
  displayDateTime,
  draftFromDetail,
  errorLineOf,
  isPlaced,
  lineInput,
  localOverlaps,
  matchQuote,
  mergeWarnings,
  newPackageLine,
  newLineKey,
  overlapLineCount,
  patchBody,
  placedFromView,
  serverWarnings,
  timeOf,
  validateDraft,
  weekdayShort,
  zonedIso,
  type ContractDraft,
  type CustomDraft,
  type ContractDetail,
  type DraftLine,
  type GroupedContractLine,
  type LineWarning,
  type PlacedDraft,
  type ContractQuote,
  type SurchargeDraft,
} from './model';
import { PackageLineCard } from './PackageLineCard';
import { StaffPicker } from './StaffPicker';
import type { StaffPerson } from './StaffRow';
import { TotalsCard } from './TotalsCard';
import { useContractCatalog } from './useContractCatalog';
import { VoidLineDialog } from './VoidLineDialog';
import './contracts.css';

// Màn lập / sửa hợp đồng (bản vẽ C mục 4.3): bảng giá trái, hợp đồng phải, thanh tổng dính đáy.
// Đường: /:orgSlug/hop-dong/moi (lập mới) và /:orgSlug/hop-dong/:id (id = UUID hợp đồng).

export interface ContractEditorProps {
  orgId: string;
  slug: string;
  tz: string;
  has: (p: Permission) => boolean;
  // null = lập mới.
  contractId: string | null;
}

type LoadState = { status: 'ready' } | { status: 'loading' } | { status: 'error'; error: unknown };

interface Alert {
  text: string;
  conflicts?: AppointmentConflict[];
  tone?: 'danger' | 'warn';
}

function sig(draft: ContractDraft, tz: string): string {
  return JSON.stringify(patchBody(draft, tz));
}

export function ContractEditor({ orgId, slug, tz, has, contractId }: ContractEditorProps) {
  const navigate = useNavigate();
  const phone = useBreakpoint() === 'phone';
  const online = useOnline();
  const catalogState = useContractCatalog(orgId, has('catalog.read'));
  const cat = catalogState.status === 'ready' ? catalogState.data : null;

  const [load, setLoad] = useState<LoadState>(contractId ? { status: 'loading' } : { status: 'ready' });
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [draft, setDraft] = useState<ContractDraft>(EMPTY_DRAFT);
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<{ fields: Record<string, string>; line: number | null; message: string | null }>({
    fields: {},
    line: null,
    message: null,
  });
  const [alert, setAlert] = useState<Alert | null>(null);
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);
  const [pickedPeople, setPickedPeople] = useState<Map<string, StaffPerson>>(new Map());
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [extraTarget, setExtraTarget] = useState<ExtraTarget | null>(null);
  const [extraPkg, setExtraPkg] = useState<ServicePackage | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ id: string; name: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Đã sửa ô cọc: hiện đúng số người nhập (trống = theo gợi ý); chưa sửa: hiện số máy chủ trả.
  const [depositTouched, setDepositTouched] = useState(false);
  const [refreshed, setRefreshed] = useState<{ key: string; data: ContractQuote } | null>(null);
  const idemKey = useRef(newIdempotencyKey());
  const pickRef = useRef<HTMLDivElement>(null);

  // ---- Hợp đồng mới chọn sẵn khách: /hop-dong/moi?customerId=… (màn Khách hàng dẫn sang) ----
  const [searchParams] = useSearchParams();
  const presetCustomerId = contractId === null ? searchParams.get('customerId') : null;
  const [presetNote, setPresetNote] = useState<string | null>(null);
  useEffect(() => {
    if (!presetCustomerId) return undefined;
    const controller = new AbortController();
    getCustomer(orgId, presetCustomerId, controller.signal)
      .then((c) => {
        setDraft((d) => (d.customer ? d : { ...d, customer: { kind: 'existing', id: c.id, fullName: c.fullName, phone: c.phone, email: c.email } }));
        setPresetNote(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Mã lạ hoặc của tổ chức khác (404, hoặc 400 khi không phải mã hợp lệ): bỏ chọn, báo một dòng — không đoán.
        const kind = errorKind(err);
        setPresetNote(kind === 'not_found' || kind === 'validation' ? 'Không tìm thấy khách này trong tổ chức. Chọn lại khách.' : userMessage(err));
      });
    return () => controller.abort();
  }, [orgId, presetCustomerId]);

  // ---- Nạp hợp đồng đã lưu ----
  useEffect(() => {
    if (contractId === null) {
      // Từ một hợp đồng sang "Lập hợp đồng" mới: bắt đầu trắng, khoá chống gửi trùng mới.
      if (detail !== null) {
        setDetail(null);
        setDraft(EMPTY_DRAFT);
        setSavedSig(null);
        setShowErrors(false);
        setAlert(null);
        idemKey.current = newIdempotencyKey();
      }
      setLoad({ status: 'ready' });
      return undefined;
    }
    if (detail?.id === contractId) return undefined; // vừa tạo xong và đổi đường — đã có sẵn.
    const controller = new AbortController();
    setLoad({ status: 'loading' });
    getContract(orgId, contractId, controller.signal)
      .then((d) => {
        const dx = d as ContractDetail;
        const dr = draftFromDetail(dx, tz);
        setDetail(dx);
        setDraft(dr);
        setSavedSig(sig(dr, tz));
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoad({ status: 'error', error });
      });
    return () => controller.abort();
    // detail?.id đọc để bỏ qua nạp lại; không phải phụ thuộc.
  }, [orgId, contractId, tz]);

  const status = detail?.status ?? null;
  const ab = contractAbilities(has, status);
  const draftMode = status === null || status === 'DRAFT';
  const subjectName = useCallback((id: string | null) => (id ? (cat?.subjects.find((s) => s.id === id)?.name ?? null) : null), [cat]);

  // ---- Bảng tính máy chủ ----
  const localErrors = useMemo(
    () =>
      validateDraft(draft, {
        includedKmOf: (l) => {
          const pkg = cat?.packages.find((p) => p.id === l.refId);
          return pkg?.includedKm ?? cat?.policy.freeKm ?? 0;
        },
      }),
    [draft, cat],
  );
  const quoteBody = draftMode && Object.keys(localErrors).length === 0 ? buildBody(draft, tz) : null;
  const quote = useQuote(draftMode ? orgId : null, quoteBody);
  const quoteKey = quoteBody ? JSON.stringify(quoteBody) : null;
  const quoteData: ContractQuote | null = quoteBody
    ? refreshed && refreshed.key === quoteKey
      ? refreshed.data
      : (quote.data as ContractQuote | null)
    : null;
  const views = matchQuote(draft, quoteData);
  const pending = quote.loading;

  // ---- Lỗi hiện dưới ô ----
  const errors: Record<string, string> = {
    ...(showErrors ? localErrors : {}),
    ...(quoteBody ? quote.fieldErrors : {}),
    ...serverErrors.fields,
  };
  const lineErrorAt = (i: number): string | null => {
    if (serverErrors.line === i) return serverErrors.message;
    if (quoteBody && quote.errorLine === i) return userMessage(quote.error);
    return null;
  };
  const quoteGeneralError =
    quoteBody && quote.error && quote.errorLine === null && Object.keys(quote.fieldErrors).length === 0 ? userMessage(quote.error) : null;

  // ---- Thợ: tên, ảnh; cảnh báo 3 mức ----
  const people = useMemo(() => {
    const m = new Map<string, StaffPerson>();
    const add = (s: { membershipId: string; role: 'PRIMARY' | 'ASSIST'; displayName: string; initials?: string; avatarUrl?: string | null }) =>
      m.set(s.membershipId, { ...s });
    for (const l of detail?.lines ?? []) for (const s of l.staff ?? []) add(s);
    for (const v of views) for (const s of v?.staff ?? []) add(s);
    for (const [, s] of pickedPeople) add(s);
    return m;
  }, [detail, views, pickedPeople]);
  const nameOf = (id: string) => people.get(id)?.displayName ?? 'Thợ';

  const warnings = useMemo(() => {
    const out = new Map<string, LineWarning[]>();
    if (!draftMode) return out;
    const local = localOverlaps(draft, subjectName);
    draft.lines.forEach((l, i) => {
      if (!isPlaced(l)) return;
      const merged = mergeWarnings(serverWarnings(views[i]?.staffWarnings, detail?.id ?? null), local.get(l.key) ?? [], tz).filter((w) =>
        l.staff.some((s) => s.membershipId === w.membershipId),
      );
      out.set(l.key, merged);
    });
    return out;
  }, [draft, views, detail, draftMode, tz, subjectName]);
  const blockedReason = confirmBlockedReason(overlapLineCount(warnings));

  // ---- Sửa nháp ----
  const dirty = savedSig === null || sig(draft, tz) !== savedSig;
  const update = (fn: (d: ContractDraft) => ContractDraft) => {
    setDraft(fn);
    setServerErrors({ fields: {}, line: null, message: null });
  };
  const patchLine = (key: string, patch: Partial<DraftLine>) =>
    update((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? ({ ...l, ...patch } as DraftLine) : l)) }));
  const removeLine = (key: string) => update((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) }));

  const addPackage = (pkg: ServicePackage) => {
    setSheetOpen(false);
    if (!draftMode) {
      setExtraPkg(pkg);
      return;
    }
    if (!cat) return;
    const studio = cat.studios.find((s) => s.isDefault) ?? cat.studios[0] ?? null;
    const line = newPackageLine(pkg, studio?.id ?? null, cat.policy.defaultMode);
    update((d) => ({ ...d, lines: [...d.lines.filter(isPlaced), line, ...d.lines.filter((l) => !isPlaced(l))] }));
  };
  const addSurcharge = (svc: Service) => {
    setSheetOpen(false);
    const line: SurchargeDraft = { key: newLineKey(), kind: 'SURCHARGE', serviceId: svc.id, name: svc.name, quantity: 1, unitPrice: null, note: '' };
    if (!draftMode) setExtraTarget({ kind: 'SURCHARGE', line: null, presetServiceId: svc.id });
    else update((d) => ({ ...d, lines: [...d.lines, line] }));
  };
  const addCustom = () => {
    setSheetOpen(false);
    setExtraTarget({ kind: 'CUSTOM', line: null });
  };

  // ---- Lưu / xác nhận ----
  const scrollToFirstError = () =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('.ct-page [aria-invalid="true"], .ct-page .ct-err, .ct-page .ct-alert');
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    });

  const applyError = (err: unknown) => {
    const fields = fieldErrors(err);
    const line = errorLineOf(err);
    const conflicts = conflictsOf(err);
    setServerErrors({ fields, line, message: line !== null ? userMessage(err) : null });
    if (conflicts.length > 0) setAlert({ text: userMessage(err), conflicts });
    else if (line === null && Object.keys(fields).length === 0) setAlert({ text: userMessage(err) });
    else if (errorKind(err) !== 'validation') setAlert({ text: userMessage(err) });
    scrollToFirstError();
  };

  async function save(): Promise<ContractDetail | null> {
    setShowErrors(true);
    setAlert(null);
    if (Object.keys(localErrors).length > 0) {
      scrollToFirstError();
      return null;
    }
    const body = buildBody(draft, tz);
    if (!body) return null;
    try {
      let d: ContractDetail;
      if (!detail) {
        d = (await createContract(orgId, body, idemKey.current)) as ContractDetail;
        setDetail(d);
        setSavedSig(sig(draft, tz));
        void navigate(`/${slug}/hop-dong/${d.id}`, { replace: true });
      } else {
        d = (await updateContract(orgId, detail.id, patchBody(draft, tz))) as ContractDetail;
        setDetail(d);
        setSavedSig(sig(draft, tz));
      }
      // Máy chủ chỉ giữ ghi chú/khách theo bản đã lưu; giữ nguyên nháp đang nhập.
      return d;
    } catch (err) {
      applyError(err);
      return null;
    }
  }

  async function onSave() {
    setBusy('save');
    await save();
    setBusy(null);
  }

  async function onConfirm() {
    if (blockedReason) return;
    setBusy('confirm');
    try {
      const d = dirty || !detail ? await save() : detail;
      if (!d) return;
      try {
        const res = (await changeContractStatus(orgId, d.id, { to: 'CONFIRMED' })) as unknown as ContractDetail;
        setDetail(res);
        setAlert(null);
      } catch (err) {
        applyError(err);
        // 409 trùng giờ: hợp đồng vẫn là nháp. Gọi lại quote để dải đỏ hiện đúng dòng.
        if (conflictsOf(err).length > 0 && quoteBody && quoteKey) {
          try {
            const fresh = (await quoteContract(orgId, quoteBody)) as ContractQuote;
            setRefreshed({ key: quoteKey, data: fresh });
          } catch {
            // Không gọi lại được: dải trùng lịch vẫn hiện danh sách ca của máy chủ.
          }
        }
      }
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes() {
    if (!detail || status !== 'CONFIRMED' || (detail.notes ?? '') === draft.notes) return;
    try {
      const d = (await updateContract(orgId, detail.id, { notes: draft.notes.trim() ? draft.notes : null })) as ContractDetail;
      setDetail(d);
      setServerErrors({ fields: {}, line: null, message: null });
    } catch (err) {
      applyError(err);
    }
  }

  async function saveExtra(line: SurchargeDraft | CustomDraft): Promise<string | null> {
    if (draftMode) {
      const exists = draft.lines.some((l) => l.key === line.key);
      update((d) => ({ ...d, lines: exists ? d.lines.map((l) => (l.key === line.key ? line : l)) : [...d.lines, line] }));
      setExtraTarget(null);
      return null;
    }
    if (!detail) return null;
    try {
      const d = (await addContractLine(orgId, detail.id, lineInput(line, draft.eventDate, tz), newIdempotencyKey())) as ContractDetail;
      setDetail(d);
      setExtraTarget(null);
      return null;
    } catch (err) {
      const f = fieldErrors(err);
      return Object.values(f)[0] ?? userMessage(err);
    }
  }

  // ---- Hiển thị ----
  if (load.status === 'loading') {
    return (
      <div className="ct-page">
        <PageHeader title="Hợp đồng" backTo={`/${slug}/hop-dong`} />
        <Card>
          <SkeletonText lines={6} widths={['40%', '80%', '60%', '75%', '50%', '65%']} label="Đang tải hợp đồng" />
        </Card>
      </div>
    );
  }
  if (load.status === 'error') {
    const kind = errorKind(load.error);
    if (kind === 'not_found' || kind === 'validation') return <NotFoundView message="Không tìm thấy hợp đồng." backTo={`/${slug}/hop-dong`} />;
    return (
      <div className="ct-alert" role="alert">
        {userMessage(load.error)}
      </div>
    );
  }

  const title = draftMode ? (detail ? `Lập hợp đồng ${detail.code}` : 'Lập hợp đồng mới') : `Hợp đồng ${detail?.code ?? ''}`;
  const statusTag =
    status === 'CONFIRMED' && detail?.confirmedAt ? (
      <StatusTag tone="ok">Đã xác nhận · {displayDateTime(detail.confirmedAt, tz)}</StatusTag>
    ) : (
      <StatusTag tone={status === 'CANCELLED' ? 'danger' : status === null || status === 'DRAFT' ? 'draft' : 'ok'}>
        {CONTRACT_STATUS_LABELS[status ?? 'DRAFT']}
      </StatusTag>
    );
  const totals = draftMode ? quoteData : detail;
  const depositInput = draftMode
    ? depositTouched
      ? draft.depositRequired
      : (draft.depositRequired ?? quoteData?.depositRequired ?? null)
    : (detail?.depositRequired ?? null);
  // Thanh tổng: luôn số máy chủ trả.
  const deposit = draftMode ? (quoteData?.depositRequired ?? null) : (detail?.depositRequired ?? null);

  // Dòng hiện trên màn: nháp → các dòng đang nhập; đã xác nhận → dòng máy chủ (kể cả dòng đã huỷ, phát sinh).
  const placedCards = draftMode
    ? draft.lines.map((l, i) => ({ l, i, view: views[i] ?? null })).filter((x): x is { l: PlacedDraft; i: number; view: GroupedContractLine<null> | null } => isPlaced(x.l))
    : (detail?.lines ?? [])
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v.kind === 'PACKAGE' || v.kind === 'SERVICE')
        .map(({ v, i }) => ({ l: placedFromView(v, tz), i, view: v as GroupedContractLine<string | null> }));

  const extraRows: ExtraRow[] = draftMode
    ? draft.lines.flatMap((l, i): ExtraRow[] =>
        isPlaced(l)
          ? []
          : [
              {
                key: l.key,
                kind: l.kind,
                name: l.name,
                quantity: l.quantity,
                note: l.note.trim() || null,
                view: views[i] ?? null,
                addedLabel: null,
                error: errors[`lines.${i}.note`] ?? errors[`lines.${i}.unitPrice`] ?? errors[`lines.${i}.name`] ?? lineErrorAt(i),
              },
            ],
      )
    : (detail?.lines ?? [])
        .filter((v) => v.kind === 'SURCHARGE' || v.kind === 'CUSTOM')
        .map((v) => ({
          key: v.id,
          kind: v.kind as 'SURCHARGE' | 'CUSTOM',
          name: v.name,
          quantity: v.quantity,
          note: v.note,
          view: v,
          // Máy chủ chưa trả ngày thêm dòng (LineView không có createdAt) → chỉ ghi "Phát sinh", không đoán ngày.
          addedLabel: v.addedAfterConfirm ? 'Phát sinh' : null,
          error: null,
        }));

  const pickerLine = pickerFor ? (draft.lines.find((l) => l.key === pickerFor) as PlacedDraft | undefined) : undefined;
  const catalogCard = ab.showCatalog && (
    <Card className="ct-pick" title={draftMode ? 'Bảng giá' : 'Thêm phát sinh'}>
      <div ref={pickRef} className="ct-cat">
        {cat ? (
          <CatalogPicker
            catalog={cat}
            usedPackageIds={new Set((draftMode ? draft.lines.filter(isPlaced).map((l) => l.refId) : (detail?.lines ?? []).map((l) => l.packageId ?? '')).filter(Boolean))}
            onAddPackage={addPackage}
            onAddSurcharge={addSurcharge}
            onAddCustom={addCustom}
          />
        ) : catalogState.status === 'error' ? (
          <div className="ct-cat__empty">
            {userMessage(catalogState.error)} <Button size="sm" onClick={catalogState.reload}>Thử lại</Button>
          </div>
        ) : (
          <div className="ct-cat__empty">
            <SkeletonText lines={5} label="Đang tải bảng giá" />
          </div>
        )}
      </div>
    </Card>
  );

  const saveBlocked = !online;
  const actions = draftMode ? (
    ab.canEdit ? (
      <>
        {/* Điện thoại: thanh tổng hẹp — nút gọn "Lưu" (tên đọc vẫn là "Lưu nháp") để số tổng không bị cắt. */}
        <Button
          size={phone ? 'sm' : 'md'}
          variant={phone ? 'ghost' : 'default'}
          aria-label={phone ? 'Lưu nháp' : undefined}
          onClick={() => void onSave()}
          loading={busy === 'save'}
          disabled={saveBlocked || busy !== null}
        >
          {phone ? 'Lưu' : 'Lưu nháp'}
        </Button>
        {blockedReason ? (
          <WithTooltip text={blockedReason}>
            <Button size={phone ? 'sm' : 'md'} variant="primary" disabled aria-label={`Xác nhận hợp đồng — ${blockedReason}`}>
              Xác nhận hợp đồng
            </Button>
          </WithTooltip>
        ) : (
          <Button
            size={phone ? 'sm' : 'md'}
            variant="primary"
            onClick={() => void onConfirm()}
            loading={busy === 'confirm'}
            disabled={saveBlocked || busy !== null || (draft.lines.length === 0)}
          >
            Xác nhận hợp đồng
          </Button>
        )}
      </>
    ) : undefined
  ) : ab.canAddExtra ? (
    <Button
      variant="primary"
      size={phone ? 'sm' : 'md'}
      icon={<IconPlus />}
      disabled={saveBlocked}
      onClick={() => {
        if (phone) setSheetOpen(true);
        else {
          pickRef.current?.scrollIntoView({ block: 'start' });
          pickRef.current?.querySelector('input')?.focus();
        }
      }}
    >
      Phát sinh
    </Button>
  ) : undefined;

  return (
    <div className="ct-page">
      {/* h1 máy tính "Lập hợp đồng" (bản mẫu); điện thoại ẩn h1, thanh trên ghi đủ "Lập hợp đồng {mã}". */}
      <PageHeader title={phone ? title : draftMode ? 'Lập hợp đồng' : 'Hợp đồng'} backTo={`/${slug}/hop-dong`} phoneAction={statusTag} />
      <div className="ct-grid" style={ab.showCatalog ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {catalogCard}
        <div className="ct-col">
          <Card
            className="ct-head"
            title={title}
            actions={
              <>
                {statusTag}
                {ab.canCollect && detail && (
                  <Link className="ct-lnk" to={`/${slug}/thu-tien/${detail.id}`}>
                    Thu tiền
                  </Link>
                )}
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
                <span className="ct-set__l">Khách hàng</span>
                <CustomerBlock
                  orgId={orgId}
                  value={draft.customer}
                  onChange={(customer) => update((d) => ({ ...d, customer }))}
                  locked={detail !== null || !ab.canEdit}
                  canSearch={ab.canSearchCustomers}
                  canCreate={ab.canCreateCustomer}
                  errors={errors}
                />
                {presetNote && !draft.customer && (
                  <div className="ct-err" role="alert" style={{ gridColumn: 2 }}>
                    {presetNote}
                  </div>
                )}
              </div>
              <div className="ct-set">
                <label className="ct-set__l" htmlFor="hd-ngay">
                  Ngày sự kiện
                </label>
                <DateInput
                  id="hd-ngay"
                  className="ct-date"
                  aria-label="Ngày sự kiện"
                  value={draft.eventDate || null}
                  disabled={!ab.canEdit}
                  onChange={(v) => update((d) => ({ ...d, eventDate: v ?? '' }))}
                  error={errors.eventDate}
                />
              </div>
            </div>
          </Card>

          {status === 'CONFIRMED' && (
            <div className="ct-okband" role="status">
              <IconLock />
              <span>Dòng đã chốt. Chỉ thêm phát sinh hoặc huỷ dòng kèm lý do.</span>
            </div>
          )}
          {status === 'CANCELLED' && detail?.cancelReason && (
            <div className="ct-alert" role="status">
              Đã huỷ: {detail.cancelReason}
            </div>
          )}

          {ab.showCatalog && (
            <Button variant="dashed" block className="ct-addm" icon={<IconPlus />} onClick={() => setSheetOpen(true)}>
              {draftMode ? 'Thêm từ bảng giá' : 'Thêm phát sinh'}
            </Button>
          )}
          {showErrors && errors.lines && <div className="ct-err">{errors.lines}</div>}

          {placedCards.map(({ l, i, view }) => {
            const pkg = cat?.packages.find((p) => p.id === l.refId) ?? null;
            const appt = !draftMode ? detail?.appointments.find((a) => a.contractLineId === view?.id) : undefined;
            const pickBlocked = !draft.eventDate
              ? 'Chọn ngày sự kiện trước.'
              : !l.start || !l.end
                ? 'Nhập giờ trước.'
                : l.end <= l.start
                  ? 'Giờ kết thúc phải sau giờ bắt đầu.'
                  : null;
            return (
              <PackageLineCard
                key={l.key}
                index={i}
                line={l}
                pkg={pkg}
                subjects={cat?.subjects ?? []}
                studios={cat?.studios ?? []}
                policy={cat?.policy ?? null}
                view={view}
                pending={draftMode && pending}
                locked={!draftMode || !ab.canEdit}
                errors={draftMode ? errors : {}}
                lineError={draftMode ? lineErrorAt(i) : null}
                warnings={warnings.get(l.key) ?? []}
                people={l.staff.map((s) => ({ ...s, displayName: nameOf(s.membershipId), initials: people.get(s.membershipId)?.initials, avatarUrl: people.get(s.membershipId)?.avatarUrl }))}
                nameOf={nameOf}
                onChange={(patch) => patchLine(l.key, patch)}
                onRemove={() => removeLine(l.key)}
                onPickStaff={() => setPickerFor(l.key)}
                canPickStaff={ab.canPickStaff}
                pickBlockedReason={pickBlocked}
                scheduleHref={appt ? `/${slug}/lich?ca=${appt.id}` : null}
                onVoid={ab.canVoidLine && view?.id ? () => setVoidTarget({ id: view.id as string, name: view.name }) : null}
              />
            );
          })}

          <ExtrasCard
            rows={extraRows}
            pending={draftMode && pending}
            onEdit={
              draftMode && ab.canEdit
                ? (key) => {
                    const l = draft.lines.find((x) => x.key === key);
                    if (l && l.kind === 'SURCHARGE') setExtraTarget({ kind: 'SURCHARGE', line: l });
                    else if (l && l.kind === 'CUSTOM') setExtraTarget({ kind: 'CUSTOM', line: l });
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
            onAddSurcharge={draftMode && ab.canEdit && cat ? () => setExtraTarget({ kind: 'SURCHARGE', line: null }) : null}
            onAddCustom={draftMode && ab.canEdit ? addCustom : null}
          />

          <TotalsCard
            subtotal={totals?.subtotal ?? null}
            total={totals?.total ?? null}
            suggestedDeposit={draftMode ? (quoteData?.suggestedDeposit ?? null) : null}
            discount={draft.discount}
            deposit={depositInput}
            notes={draft.notes}
            moneyLocked={!draftMode || !ab.canEdit}
            notesLocked={!ab.canEditNotes}
            pending={draftMode && pending}
            errors={errors}
            onDiscount={(discount) => update((d) => ({ ...d, discount }))}
            onDeposit={(depositRequired) => {
              setDepositTouched(true);
              update((d) => ({ ...d, depositRequired }));
            }}
            onNotes={(notes) => update((d) => ({ ...d, notes }))}
            onNotesBlur={status === 'CONFIRMED' ? () => void saveNotes() : undefined}
          />

          {(alert || quoteGeneralError) && (
            <div className={`ct-alert`} role="alert">
              <IconWarn />
              <div>
                {alert?.conflicts && alert.conflicts.length > 0 ? null : (alert?.text ?? quoteGeneralError)}
                {alert?.conflicts && alert.conflicts.length > 0 && (
                  <ul style={{ margin: 0, listStyle: 'none' }}>
                    {alert.conflicts.map((c) => (
                      <li key={`${c.appointmentId}-${c.membershipId}`}>
                        Trùng lịch: {c.staffName} đã có lịch {c.code} {timeOf(c.startsAt, tz)}–{timeOf(c.endsAt, tz)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <StickyTotalBar total={totals?.total ?? null} deposit={deposit} pending={draftMode && pending} actions={actions} />
        </div>
      </div>

      {phone && ab.showCatalog && cat && (
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={draftMode ? 'Thêm từ bảng giá' : 'Thêm phát sinh'} className="ct-sheet">
          <CatalogPicker
            catalog={cat}
            usedPackageIds={new Set(draft.lines.filter(isPlaced).map((l) => l.refId))}
            onAddPackage={addPackage}
            onAddSurcharge={addSurcharge}
            onAddCustom={addCustom}
          />
        </BottomSheet>
      )}

      {pickerLine && (
        <StaffPicker
          open
          onClose={() => setPickerFor(null)}
          orgId={orgId}
          tz={tz}
          phone={phone}
          query={
            draft.eventDate && pickerLine.start && pickerLine.end
              ? {
                  startsAt: zonedIso(draft.eventDate, pickerLine.start, tz),
                  endsAt: zonedIso(draft.eventDate, pickerLine.end, tz),
                  ...(detail ? { excludeContractId: detail.id } : {}),
                }
              : null
          }
          initial={pickerLine.staff}
          subtitle={`${subjectName(pickerLine.subjectId) ?? pickerLine.name} · ${pickerLine.start} – ${pickerLine.end} · ${weekdayShort(draft.eventDate)}`}
          localConflicts={conflictsForLine(draft, pickerLine.key, subjectName)}
          onConfirm={(staff, ppl) => {
            setPickedPeople((m) => {
              const next = new Map(m);
              for (const p of ppl) if (p.displayName) next.set(p.membershipId, p);
              return next;
            });
            patchLine(pickerLine.key, { staff });
            setPickerFor(null);
          }}
        />
      )}

      <ExtraDialog
        target={extraTarget}
        surcharges={cat?.surcharges ?? []}
        onClose={() => setExtraTarget(null)}
        onSave={saveExtra}
        onRemove={
          draftMode
            ? (key) => {
                removeLine(key);
                setExtraTarget(null);
              }
            : undefined
        }
        saveLabel={draftMode ? (extraTarget?.line ? 'Lưu' : 'Thêm') : 'Thêm phát sinh'}
      />

      {detail && cat && extraPkg && (
        <ExtraPackageDialog
          pkg={extraPkg}
          orgId={orgId}
          tz={tz}
          detail={detail}
          catalog={cat}
          canPickStaff={has('staff.read')}
          phone={phone}
          onClose={() => setExtraPkg(null)}
          onAdded={(d) => {
            setDetail(d);
            setExtraPkg(null);
          }}
        />
      )}

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
            setDetail(res as unknown as ContractDetail);
            setVoidTarget(null);
            const adj = res.adjustments
              .map((a) => `${a.field === 'discount' ? 'giảm giá' : 'cọc'} từ ${formatVnd(a.from)} xuống ${formatVnd(a.to)}`)
              .join(', ');
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
            setDetail(res as unknown as ContractDetail);
            setCancelOpen(false);
            return null;
          } catch (err) {
            return userMessage(err);
          }
        }}
      />
    </div>
  );
}
