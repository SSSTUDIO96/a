import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import type { AppointmentConflict, ContractQuoteBody, ContractUpdateInput, Service, ServicePackage } from '../../api/types';
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
  Tooltip,
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
  addedLabel,
  belowPaidText,
  conflictsOf,
  confirmResultText,
  contractAbilities,
  customerChangeText,
  draftDiffs,
  draftIndexesOfLineIds,
  displayDate,
  displayDateTime,
  draftFromDetail,
  draftIndexOfQuoteLine,
  errorLineOf,
  hiddenSubjectBlockedReason,
  hiddenSubjectOf,
  isPlaced,
  isStaleVersion,
  liveErrors,
  lineInput,
  linesWithHiddenSubject,
  linesWithoutTime,
  matchQuote,
  displayWarnings,
  moneyFieldOf,
  newPackageLine,
  newLineKey,
  noTimeBlockedReason,
  missingTimeLabel,
  missingTimeOf,
  missingTimeWhat,
  overlapLineCount,
  patchBody,
  placedFromView,
  prettyMoneyText,
  quotePlan,
  remapLineFields,
  serverWarnings,
  staffGapText,
  staffGaps,
  timeOf,
  validateDraft,
  viewsByDraft,
  weekdayShort,
  zonedIso,
  type ContractDraft,
  type ContractPatchFields,
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
  // Seg loại hợp đồng "Khoá học / Dịch vụ makeup" (chỉ tổ chức đào tạo — ContractKindRouter truyền vào).
  kindSwitch?: ReactNode;
  // Vừa tạo hợp đồng (trước khi đổi đường sang /hop-dong/:id).
  onCreated?: (d: ContractDetail) => void;
}

type LoadState = { status: 'ready' } | { status: 'loading' } | { status: 'error'; error: unknown };

interface Alert {
  text: string;
  conflicts?: AppointmentConflict[];
  tone?: 'danger' | 'warn' | 'ok';
  // Liên kết đi kèm (ví dụ "Xem lịch" sau khi xác nhận).
  link?: { to: string; label: string };
}

// T2: bản trên máy chủ đã đổi so với bản đang sửa. 'conflict' = vừa bị từ chối, bản nháp đang nhập giữ nguyên;
// 'loaded' = đã tải bản mới, giữ bản của người dùng (mine) để so và dùng lại nếu muốn.
type Stale = { phase: 'conflict' } | { phase: 'loaded'; mine: ContractDraft; diffs: string[] };

function sig(draft: ContractDraft, tz: string): string {
  return JSON.stringify(patchBody(draft, tz));
}

export function ContractEditor({ orgId, slug, tz, has, contractId, kindSwitch, onCreated }: ContractEditorProps) {
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
  // N2: dòng máy chủ báo chưa có giờ khi xác nhận (vị trí trong draft.lines) — đánh dấu ngay trên thẻ dòng.
  const [serverNoTime, setServerNoTime] = useState<{ index: number; text: string }[]>([]);
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
  const [stale, setStale] = useState<Stale | null>(null);
  const [reloading, setReloading] = useState(false);
  // Đổi mỗi lần màn TỰ đặt lại nháp (nạp, tải bản mới, dùng lại bản cũ) → ô tiền/km bỏ chữ lỗi cũ dù số không đổi.
  const [resetKey, setResetKey] = useState(0);
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
        setResetKey((k) => k + 1);
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
        // M1: dòng mang nhân vật đang ẩn (chỉ kiểm hợp đồng còn sửa được — hợp đồng đã chốt giữ nguyên tên đã chép).
        hiddenSubjectName: (id) => (cat ? (hiddenSubjectOf(id, cat.subjects)?.name ?? null) : null),
      }),
    [draft, cat],
  );
  // M5: lỗi chỉ về giờ không còn chặn bảng tính; dòng của nhân vật đang ẩn (M1) bỏ khỏi bảng tính (xem quotePlan).
  const plan = useMemo(() => quotePlan(draft, localErrors), [draft, localErrors]);
  const baseBody = draftMode && plan.draft ? buildBody(plan.draft, tz) : null;
  // Hợp đồng đã lưu: máy chủ bỏ giữ chỗ / lịch của CHÍNH nó khỏi cảnh báo thợ.
  const quoteBody: ContractQuoteBody | null = baseBody && detail ? { ...baseBody, excludeContractId: detail.id } : baseBody;
  const quote = useQuote(draftMode ? orgId : null, quoteBody);
  const quoteKey = quoteBody ? JSON.stringify(quoteBody) : null;
  // Bảng tính lỗi với dữ liệu đang nhập (vd giảm giá lớn hơn tạm tính): KHÔNG hiện số của lần tính trước ở thẻ tổng /
  // thanh tổng trong khi thẻ dòng đã thành "—" (N8) — mọi ô tiền cùng về "—", lỗi hiện dưới đúng ô.
  const quoteFailed = Boolean(quoteBody) && !quote.loading && quote.error !== null && quote.error !== undefined;
  const quoteData: ContractQuote | null = quoteBody
    ? refreshed && refreshed.key === quoteKey
      ? refreshed.data
      : quoteFailed
        ? null
        : (quote.data as ContractQuote | null)
    : null;
  const views = plan.draft ? viewsByDraft(plan, matchQuote(plan.draft, quoteData)) : draft.lines.map(() => null);
  // Tạm tính / Tổng / cọc chỉ lấy khi MỌI dòng có trong bảng tính (còn dòng nhân vật đang ẩn thì "—" kèm lý do ở thanh tổng).
  const totalsQuote = plan.complete ? quoteData : null;
  const pending = quote.loading;
  const quoteErrorLine = quoteBody ? draftIndexOfQuoteLine(plan, quote.errorLine) : null;

  // ---- Lỗi hiện dưới ô ----
  const quoteMoneyError = quoteBody && quote.error ? moneyFieldOf(quote.error) : null;
  const errors: Record<string, string> = {
    ...(showErrors ? localErrors : liveErrors(localErrors)),
    ...(quoteBody ? remapLineFields(quote.fieldErrors, plan) : {}),
    ...(quoteMoneyError ? { [quoteMoneyError.field]: quoteMoneyError.message } : {}),
    ...serverErrors.fields,
  };
  const lineErrorAt = (i: number): string | null => {
    const noTime = serverNoTime.find((x) => x.index === i);
    if (noTime) return noTime.text;
    // M1: nhân vật của dòng đang ẩn — báo ngay, không đợi Lưu.
    const hidden = localErrors[`lines.${i}.subjectId`];
    if (hidden && draftMode) return hidden;
    if (serverErrors.line === i) return serverErrors.message;
    if (quoteErrorLine === i) return prettyMoneyText(userMessage(quote.error));
    return null;
  };
  const quoteGeneralError =
    quoteBody && quote.error && !quoteMoneyError && quote.errorLine === null && Object.keys(quote.fieldErrors).length === 0
      ? prettyMoneyText(userMessage(quote.error))
      : null;

  // ---- Thợ: tên, ảnh; cảnh báo 3 mức ----
  const people = useMemo(() => {
    const m = new Map<string, StaffPerson>();
    const add = (s: { membershipId: string; role: 'PRIMARY' | 'ASSIST'; displayName: string; fullName?: string | null; initials?: string; avatarUrl?: string | null }) =>
      m.set(s.membershipId, { ...s });
    for (const l of detail?.lines ?? []) for (const s of l.staff ?? []) add(s);
    for (const v of views) for (const s of v?.staff ?? []) add(s);
    for (const [, s] of pickedPeople) add(s);
    return m;
  }, [detail, views, pickedPeople]);
  const nameOf = (id: string) => people.get(id)?.displayName ?? 'Thợ';
  // Họ tên đi kèm tên hiển thị (máy chủ gửi ở thợ của dòng và ô chọn thợ) → tên ngắn theo hàm chung staffShortName.
  const personOf = (id: string) => ({ displayName: nameOf(id), fullName: people.get(id)?.fullName });

  const warnings = useMemo(() => {
    const out = new Map<string, LineWarning[]>();
    if (!draftMode) return out;
    // Trùng giữa hai dòng của hợp đồng này: máy chủ so (staffWarnings[].sameContract) — web không tự so giờ nữa.
    // index của máy chủ là vị trí dòng trong bảng tính (plan.draft), không phải draft.lines.
    const lineLabel = (index: number, name: string) => {
      const o = plan.draft?.lines[index];
      return o && isPlaced(o) ? (subjectName(o.subjectId) ?? o.name) : name;
    };
    draft.lines.forEach((l, i) => {
      if (!isPlaced(l)) return;
      const shown = displayWarnings(serverWarnings(views[i]?.staffWarnings, lineLabel), tz).filter((w) =>
        l.staff.some((s) => s.membershipId === w.membershipId),
      );
      out.set(l.key, shown);
    });
    return out;
  }, [draft, plan, views, draftMode, tz, subjectName]);
  // N2: còn dòng chưa có giờ → khoá "Xác nhận hợp đồng" (trùng giờ báo trước vì nặng hơn).
  const noTimeLines = draftMode && ab.canEdit ? linesWithoutTime(draft, subjectName) : [];
  // M1: dòng mang nhân vật đang ẩn — thanh tổng kể đúng dòng (Tạm tính / Tổng "—" có lý do), khoá xác nhận.
  const hiddenLines = draftMode && ab.canEdit ? linesWithHiddenSubject(draft, localErrors, subjectName) : [];
  const blockedReason =
    confirmBlockedReason(overlapLineCount(warnings)) ?? hiddenSubjectBlockedReason(hiddenLines) ?? noTimeBlockedReason(noTimeLines);
  const gapText = draftMode && ab.canEdit ? staffGapText(staffGaps(draft)) : null;

  // ---- Sửa nháp ----
  const dirty = savedSig === null || sig(draft, tz) !== savedSig;
  const update = (fn: (d: ContractDraft) => ContractDraft) => {
    setDraft(fn);
    setServerErrors({ fields: {}, line: null, message: null });
    setServerNoTime([]);
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

  // Cuộn tới thẻ dòng (data-dong = vị trí trong draft.lines) và đặt con trỏ vào ô giờ bắt đầu.
  const scrollToLine = (i: number) =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`.ct-page [data-dong="${i}"]`);
      if (!el) return;
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
      el.querySelector<HTMLInputElement>('input[aria-label="Giờ bắt đầu"]:not([disabled])')?.focus({ preventScroll: true });
    });

  // N2: máy chủ chặn xác nhận (409 LINES_MISSING_TIME) vì còn dòng chưa có giờ. Trả true nếu đã xử lý lỗi này.
  const applyNoTimeError = (err: unknown, saved: ContractDetail): boolean => {
    const miss = missingTimeOf(err);
    if (!miss) return false;
    const hits = draftIndexesOfLineIds(saved.lines, draft, miss.lineIds);
    const marks = hits.flatMap((h, k) => {
      const l = miss.lines[k];
      if (h.index === null || !l) return [];
      return [{ index: h.index, text: `Dòng này chưa có ${missingTimeWhat(l.missing)} — nhập giờ rồi xác nhận lại.` }];
    });
    const names = miss.lines.map(missingTimeLabel).join('; ');
    // Nháp trên màn đã có giờ (hoặc không thấy dòng) mà máy chủ vẫn báo thiếu: bản trên máy chủ đã khác (sửa ở máy khác).
    const localMissing = marks.filter(({ index }) => {
      const l = draft.lines[index];
      return l !== undefined && isPlaced(l) && (!l.start || !l.end);
    });
    const n = miss.lineIds.length;
    const differs = marks.length < n || localMissing.length < marks.length;
    setServerNoTime(marks);
    setAlert({
      text: differs
        ? `Chưa xác nhận được: trên máy chủ còn ${n} dòng chưa có giờ (${names}) — hợp đồng có thể vừa được sửa ở máy khác. Tải bản mới, nhập giờ cho dòng đó rồi xác nhận lại.`
        : `Chưa xác nhận được: còn ${n} dòng chưa có giờ (${names}). Nhập giờ cho dòng được đánh dấu rồi xác nhận lại.`,
    });
    if (differs) setStale({ phase: 'conflict' });
    if (marks[0] !== undefined) scrollToLine(marks[0].index);
    else scrollToFirstError();
    return true;
  };

  const applyError = (err: unknown) => {
    if (isStaleVersion(err)) {
      // T2: không đè im lặng — giữ nguyên chữ đang nhập, báo và cho tải bản mới.
      setStale({ phase: 'conflict' });
      scrollToFirstError();
      return;
    }
    const below = belowPaidText(err);
    if (below) {
      setAlert({ text: below });
      scrollToFirstError();
      return;
    }
    const money = moneyFieldOf(err);
    const fields = money ? { ...fieldErrors(err), [money.field]: money.message } : fieldErrors(err);
    const line = errorLineOf(err);
    const conflicts = conflictsOf(err);
    const text = prettyMoneyText(userMessage(err));
    setServerErrors({ fields, line, message: line !== null ? text : null });
    if (conflicts.length > 0) setAlert({ text, conflicts });
    else if (line === null && Object.keys(fields).length === 0) setAlert({ text });
    else if (errorKind(err) !== 'validation') setAlert({ text });
    scrollToFirstError();
  };

  // T2: tải bản mới của máy chủ; bản đang nhập giữ lại (mine) để so và dùng lại nếu muốn.
  async function reloadLatest() {
    if (!detail) return;
    setReloading(true);
    try {
      const fresh = (await getContract(orgId, detail.id)) as ContractDetail;
      const theirs = draftFromDetail(fresh, tz);
      const mine = draft;
      setDetail(fresh);
      setDraft(theirs);
      setSavedSig(sig(theirs, tz));
      setResetKey((k) => k + 1);
      setServerErrors({ fields: {}, line: null, message: null });
      setServerNoTime([]);
      setAlert(null);
      setStale({ phase: 'loaded', mine, diffs: draftDiffs(mine, theirs, tz) });
    } catch (err) {
      setAlert({ text: userMessage(err) });
    } finally {
      setReloading(false);
    }
  }

  function restoreMine() {
    if (stale?.phase !== 'loaded') return;
    // Bản máy chủ đã nạp (detail.updatedAt mới) — lưu lần tới là người dùng CHỦ Ý ghi bản của mình lên bản mới.
    setDraft(stale.mine);
    setResetKey((k) => k + 1);
    setStale(null);
  }

  // Thân PATCH: kèm updatedAt của bản đang sửa để máy chủ từ chối (409 STALE_VERSION) khi bản đã bị sửa nơi khác.
  const withVersion = (d: ContractDetail, body: ContractPatchFields): ContractUpdateInput => ({ ...body, expectedUpdatedAt: d.updatedAt });

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
        // N6: khách mới đã thành khách có sẵn — thẻ khách thay cho hai ô nhập (máy chủ không nhận sửa khách qua hợp đồng).
        const c = d.customer;
        setDraft((x) => ({ ...x, customer: { kind: 'existing', id: c.id, fullName: c.fullName, phone: c.phone, email: c.email } }));
        setSavedSig(sig(draft, tz));
        onCreated?.(d);
        void navigate(`/${slug}/hop-dong/${d.id}`, { replace: true });
      } else {
        d = (await updateContract(orgId, detail.id, withVersion(detail, patchBody(draft, tz)))) as ContractDetail;
        setDetail(d);
        setSavedSig(sig(draft, tz));
        setStale(null);
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

  // Đổi khách của hợp đồng NHÁP đã lưu: PATCH chỉ customerId (kèm phiên bản), không đụng dòng đang sửa dở.
  // Chữ ký nháp (sig) không gồm khách nên phần chưa lưu vẫn là "chưa lưu".
  async function changeCustomer(c: Extract<ContractDraft['customer'], { kind: 'existing' }>): Promise<string | null> {
    if (!detail) return 'Hợp đồng chưa lưu.';
    try {
      const d = (await updateContract(orgId, detail.id, withVersion(detail, { customerId: c.id }))) as ContractDetail;
      setDetail(d);
      const k = d.customer;
      setDraft((x) => ({ ...x, customer: { kind: 'existing', id: k.id, fullName: k.fullName, phone: k.phone, email: k.email } }));
      return null;
    } catch (err) {
      // Bản đã bị sửa nơi khác: hiện dải "Tải bản mới" như khi lưu.
      if (isStaleVersion(err)) applyError(err);
      return customerChangeText(err);
    }
  }

  async function onConfirm() {
    if (blockedReason) return;
    setBusy('confirm');
    try {
      const d = dirty || !detail ? await save() : detail;
      if (!d) return;
      try {
        const res = await changeContractStatus(orgId, d.id, { to: 'CONFIRMED' });
        setDetail(res as unknown as ContractDetail);
        // S1: báo đúng số lịch máy chủ đã tạo (kể cả lịch chưa có thợ).
        setAlert({ text: confirmResultText(res as unknown as ContractDetail & { createdAppointments: { contractLineId: string | null }[] }), tone: 'ok', link: (has('schedule.read_all') || has('schedule.read_own')) ? { to: `/${slug}/lich`, label: 'Xem lịch' } : undefined });
      } catch (err) {
        if (applyNoTimeError(err, d)) return;
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
      const d = (await updateContract(orgId, detail.id, withVersion(detail, { notes: draft.notes.trim() ? draft.notes : null }))) as ContractDetail;
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
  // N1: mã hợp đồng không bẻ dòng ở dấu gạch ("HĐ- / 000001" ở 1024) — cả mã xuống dòng cùng nhau.
  const headTitle = detail ? (
    <>
      {draftMode ? 'Lập hợp đồng' : 'Hợp đồng'} <span className="ct-code">{detail.code}</span>
    </>
  ) : (
    title
  );
  const statusTag =
    status === 'CONFIRMED' && detail?.confirmedAt ? (
      <StatusTag tone="ok">Đã xác nhận · {displayDateTime(detail.confirmedAt, tz)}</StatusTag>
    ) : (
      <StatusTag tone={status === 'CANCELLED' ? 'danger' : status === null || status === 'DRAFT' ? 'draft' : 'ok'}>
        {CONTRACT_STATUS_LABELS[status ?? 'DRAFT']}
      </StatusTag>
    );
  const totals = draftMode ? totalsQuote : detail;
  const depositInput = draftMode
    ? depositTouched
      ? draft.depositRequired
      : (draft.depositRequired ?? totalsQuote?.depositRequired ?? null)
    : (detail?.depositRequired ?? null);
  // Thanh tổng: luôn số máy chủ trả.
  const deposit = draftMode ? (totalsQuote?.depositRequired ?? null) : (detail?.depositRequired ?? null);

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
          addedLabel: addedLabel(v, tz),
          error: null,
        }));

  const pickerLine = pickerFor ? (draft.lines.find((l) => l.key === pickerFor) as PlacedDraft | undefined) : undefined;
  const catalogCard = ab.showCatalog && (
    <Card className="ct-pick" title={kindSwitch ? undefined : draftMode ? 'Bảng giá' : 'Thêm phát sinh'}>
      {kindSwitch}
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
      <PageHeader title={phone ? title : draftMode ? 'Lập hợp đồng' : 'Hợp đồng'} backTo={`/${slug}/hop-dong`}
        phoneAction={<StatusTag tone={status === 'CANCELLED' ? 'danger' : status === null || status === 'DRAFT' ? 'draft' : 'ok'}>{CONTRACT_STATUS_LABELS[status ?? 'DRAFT']}</StatusTag>}
      />
      <div className="ct-grid" style={ab.showCatalog ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {catalogCard}
        <div className="ct-col">
          {phone && kindSwitch && <div className="ct-kind-phone">{kindSwitch}</div>}
          {!ab.showCatalog && !phone && kindSwitch}
          <Card
            className="ct-head"
            title={headTitle}
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
                  customerHref={detail && has('customers.read') ? `/${slug}/khach-hang/${detail.customer.id}` : null}
                  value={draft.customer}
                  onChange={(customer) => update((d) => ({ ...d, customer }))}
                  locked={detail !== null || !ab.canEdit}
                  onChangeSaved={detail && status === 'DRAFT' && ab.canEdit ? changeCustomer : undefined}
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

          {/* Điện thoại: tiêu đề thẻ đầu ẩn (bản mẫu) — hành động của thẻ đầu chuyển xuống hàng này. */}
          {(ab.canCollect || ab.canCancel) && detail && (
            <div className="ct-phone-acts">
              {ab.canCollect && (
                <Link className="ct-lnk" to={`/${slug}/thu-tien/${detail.id}`}>
                  Thu tiền
                </Link>
              )}
              {ab.canCancel && (
                <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
                  Huỷ hợp đồng
                </Button>
              )}
            </div>
          )}

          {stale && (
            <div className="ct-alert ct-alert--warn ct-stale" role="alert" data-o="ban-moi">
              <IconWarn />
              <div className="ct-stale__b">
                {stale.phase === 'conflict' ? (
                  <>
                    <b>Hợp đồng vừa được người khác sửa.</b> Chưa lưu thay đổi của bạn — chữ bạn đang nhập vẫn còn nguyên. Tải bản mới để xem họ đã
                    đổi gì; bản của bạn được giữ lại để so.
                  </>
                ) : (
                  <>
                    <b>Đã tải bản mới.</b> Bản bạn đang nhập vẫn được giữ.
                    {stale.diffs.length > 0 ? (
                      <ul>
                        {stale.diffs.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      ' Hai bản giống nhau.'
                    )}
                  </>
                )}
                <div className="ct-stale__acts">
                  {stale.phase === 'conflict' ? (
                    <Button size="sm" variant="primary" loading={reloading} onClick={() => void reloadLatest()}>
                      Tải bản mới
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" onClick={restoreMine}>
                        Dùng lại bản của tôi
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStale(null)}>
                        Giữ bản mới
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

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
                resetKey={resetKey}
                addedLabel={!draftMode && view ? addedLabel(view, tz) : null}
                lineError={draftMode ? lineErrorAt(i) : null}
                warnings={warnings.get(l.key) ?? []}
                people={l.staff.map((s) => ({ ...s, ...personOf(s.membershipId), initials: people.get(s.membershipId)?.initials, avatarUrl: people.get(s.membershipId)?.avatarUrl }))}
                personOf={personOf}
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
            suggestedDeposit={draftMode ? (totalsQuote?.suggestedDeposit ?? null) : null}
            discount={draft.discount}
            deposit={depositInput}
            notes={draft.notes}
            moneyLocked={!draftMode || !ab.canEdit}
            notesLocked={!ab.canEditNotes}
            pending={draftMode && pending}
            errors={errors}
            resetKey={resetKey}
            onDiscount={(discount) => update((d) => ({ ...d, discount }))}
            onDeposit={(depositRequired) => {
              setDepositTouched(true);
              update((d) => ({ ...d, depositRequired }));
            }}
            onNotes={(notes) => update((d) => ({ ...d, notes }))}
            onNotesBlur={status === 'CONFIRMED' ? () => void saveNotes() : undefined}
          />

          {alert?.tone === 'ok' ? (
            <div className="ct-okband" role="status">
              <IconLock />
              <span>{alert.text}</span>
              {alert.link && (
                <Link className="ct-lnk" to={alert.link.to}>
                  {alert.link.label}
                </Link>
              )}
            </div>
          ) : (alert || quoteGeneralError) && (
            <div className={`ct-alert${alert?.tone === 'warn' ? ' ct-alert--warn' : ''}`} role={alert?.tone === 'warn' ? 'status' : 'alert'}>
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

          {/* Thanh tổng kèm một dải trên:
              - N2: dòng chưa có giờ CHẶN xác nhận — dải đỏ kể đúng từng dòng, bấm tên dòng thì cuộn tới ô giờ của dòng đó.
              - S1: dòng chưa có thợ chỉ nhắc (vàng), KHÔNG chặn. */}
          <div className={`ct-totbar${gapText || noTimeLines.length > 0 || hiddenLines.length > 0 ? ' ct-totbar--note' : ''}`}>
            {hiddenLines.length > 0 && (
              <div className="ct-totbar__note ct-totbar__note--block" role="status" data-o="nhan-vat-an">
                <IconWarn />
                <span>
                  Chưa tính được tổng — {hiddenLines.length} dòng dùng nhân vật đang ẩn:{' '}
                  {hiddenLines.map((x, k) => (
                    <span key={x.index}>
                      {k > 0 && ', '}
                      <button type="button" className="ct-gapln" title="Cuộn tới dòng này" onClick={() => scrollToLine(x.index)}>
                        {x.label}
                      </button>
                    </span>
                  ))}
                  <Tooltip
                    label="Vì sao chưa tính được tổng"
                    text="Nhân vật đã bị tắt ở Bảng giá → Nhân vật. Máy chủ không nhận dòng của nhân vật đang ẩn, nên tổng và cọc chưa tính được, hợp đồng chưa lưu được. Bật lại nhân vật ở Bảng giá → Nhân vật, hoặc bỏ dòng đó. Các dòng khác vẫn hiện tiền của dòng."
                  />
                </span>
              </div>
            )}
            {noTimeLines.length > 0 && (
              <div className="ct-totbar__note ct-totbar__note--block" role="status" data-o="thieu-gio">
                <IconWarn />
                <span>
                  {noTimeLines.length} dòng chưa có giờ — nhập giờ mới xác nhận được:{' '}
                  {noTimeLines.map((x, k) => (
                    <span key={x.index}>
                      {k > 0 && ', '}
                      <button type="button" className="ct-gapln" title="Cuộn tới dòng này để nhập giờ" onClick={() => scrollToLine(x.index)}>
                        {x.label}
                      </button>
                    </span>
                  ))}
                </span>
              </div>
            )}
            {gapText && (
              <div className="ct-totbar__note" role="status" data-o="thieu-tho">
                <IconWarn />
                <span>{gapText}</span>
              </div>
            )}
            <StickyTotalBar position="static" total={totals?.total ?? null} deposit={deposit} pending={draftMode && pending} actions={actions} />
          </div>
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
