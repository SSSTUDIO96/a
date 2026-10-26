import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { isPrintLayout, PRINT_LAYOUT_NAMES, TOGGLE_BLOCKS, type PrintLayout } from '@makeup/shared';
import { ApiError, errorKind, fieldErrors, userMessage } from '../../../api/errors';
import { newIdempotencyKey } from '../../../api/idempotency';
import { createPrintTemplate, getPrintTemplate, updatePrintTemplate } from '../../../api/print';
import { getBrandProfile } from '../../../api/profile';
import type { ContractKind, PrintTemplateUpdateInput, PrintTemplateView } from '../../../api/types';
import { useSession } from '../../../app/session';
import { useOnline } from '../../../layout/ErrorStates';
import { PageHeader } from '../../../layout/PageHeader';
import { useBreakpoint } from '../../../layout/useBreakpoint';
import { usePermissions } from '../../../layout/usePermissions';
import { Button, Card, ConfirmDialog, Dialog, EmptyState, Segmented, SettingRow, Skeleton, StatusTag, Switch, TextInput } from '../../../ui';
import { LoadErrorStrip, Strip } from '../../staff/parts';
import { useLoad, useOrgInfo } from '../../staff/useOrgInfo';
import { hasBank } from './info';
import { LayoutPicker } from './LayoutPicker';
import {
  ALWAYS_ON_KEYS,
  ALWAYS_ON_LABELS,
    choiceOf,
  createOf,
  defaultRequiredField,
  defaultText,
  draftOf,
  effectiveBlock,
  isDirty,
  KIND_LABEL,
  kindsOfChoice,
  lockedKinds,
  newDraft,
  NAME_MAX,
  patchOf,
  printedWarning,
  saveLabel,
  setBlock,
  TEXT_MAX,
  validateDraft,
  visibleBlocks,
  type AppliesChoice,
  type ConflictField,
  type DraftErrors,
  type TemplateDraft,
} from './logic';
import { studioOf, TemplatePreview } from './TemplatePreview';
import { VariableField } from './VariableField';
import '../../staff/staff.css';
import './settings.css';

const NEW_PARAM_ERROR = 'Đường dẫn tạo mẫu không hợp lệ — hãy mở lại từ danh sách mẫu in.';

// Màn tạo / sửa một mẫu in (bản vẽ G 4.5): /cai-dat/mau-in/moi?bo-cuc=N&loai=SERVICE|COURSE và /cai-dat/mau-in/:templateId.
export function PrintTemplateEditorPage() {
  const { templateId } = useParams();
  const org = useOrgInfo();
  const isAcademy = useSession().organizations.find((o) => o.id === org.orgId)?.kind === 'ACADEMY';
  const canEdit = usePermissions()('contracts.texts');
  if (templateId !== undefined) return <EditLoader orgId={org.orgId} slug={org.slug} templateId={templateId} isAcademy={isAcademy} canEdit={canEdit} />;
  return <CreateLoader orgId={org.orgId} slug={org.slug} isAcademy={isAcademy} canEdit={canEdit} />;
}

function BackLink({ slug }: { slug: string }) {
  return <Link to={`/${slug}/cai-dat/mau-in`}>Về danh sách mẫu in</Link>;
}

function EditLoader({ orgId, slug, templateId, isAcademy, canEdit }: { orgId: string; slug: string; templateId: string; isAcademy: boolean; canEdit: boolean }) {
  const load = useLoad((signal) => getPrintTemplate(orgId, templateId, signal), [orgId, templateId]);
  if (load.state.status === 'loading') {
    return (
      <>
        <PageHeader title="Mẫu in hợp đồng" backTo={`/${slug}/cai-dat/mau-in`} />
        <Card>
          <div role="status" aria-label="Đang tải mẫu in" className="mi-skel">
            <Skeleton width="45%" height={20} />
            <Skeleton width="80%" />
            <Skeleton width="65%" />
          </div>
        </Card>
      </>
    );
  }
  if (load.state.status === 'error') {
    const notFound = errorKind(load.state.error) === 'not_found';
    return (
      <>
        <PageHeader title="Mẫu in hợp đồng" backTo={`/${slug}/cai-dat/mau-in`} />
        {notFound ? (
          <Card>
            <EmptyState message="Không tìm thấy mẫu in." action={<BackLink slug={slug} />} />
          </Card>
        ) : (
          <LoadErrorStrip error={load.state.error} retry={load.reload} />
        )}
      </>
    );
  }
  return <EditorScreen key={load.state.data.id} orgId={orgId} slug={slug} isAcademy={isAcademy} canEdit={canEdit} view={load.state.data} newMode={null} />;
}

function CreateLoader({ orgId, slug, isAcademy, canEdit }: { orgId: string; slug: string; isAcademy: boolean; canEdit: boolean }) {
  const [sp] = useSearchParams();
  const layoutRaw = sp.get('bo-cuc');
  const kindRaw = sp.get('loai');
  const layoutNum = layoutRaw !== null && /^\d$/.test(layoutRaw) ? Number(layoutRaw) : null;
  const layout: PrintLayout | null = layoutNum !== null && isPrintLayout(layoutNum) ? layoutNum : null;
  const kind: ContractKind | null = kindRaw === 'SERVICE' || kindRaw === 'COURSE' ? kindRaw : null;
  const problem =
    layout === null || kind === null
      ? NEW_PARAM_ERROR
      : kind === 'COURSE' && !isAcademy
        ? 'Tổ chức chưa bật đào tạo — mẫu in chỉ dùng cho hợp đồng dịch vụ'
        : !canEdit
          ? 'Bạn không có quyền tạo mẫu in. Cần quyền sửa mẫu điều khoản, nội quy.'
          : null;
  if (problem !== null || layout === null || kind === null) {
    return (
      <>
        <PageHeader title="Tạo mẫu in" backTo={`/${slug}/cai-dat/mau-in`} />
        <Card>
          <EmptyState message={problem ?? NEW_PARAM_ERROR} action={<BackLink slug={slug} />} />
        </Card>
      </>
    );
  }
  return <EditorScreen orgId={orgId} slug={slug} isAcademy={isAcademy} canEdit={canEdit} view={null} newMode={{ layout, kind }} />;
}

type Notice = { tone: 'ok' | 'danger'; text: string } | null;

function EditorScreen({
  orgId,
  slug,
  isAcademy,
  canEdit,
  view: initialView,
  newMode,
}: {
  orgId: string;
  slug: string;
  isAcademy: boolean;
  canEdit: boolean;
  view: PrintTemplateView | null;
  newMode: { layout: PrintLayout; kind: ContractKind } | null;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const phone = useBreakpoint() === 'phone';
  const orgName = useSession().organizations.find((o) => o.id === orgId)?.name ?? '';
  const listHref = `/${slug}/cai-dat/mau-in`;

  const [view, setView] = useState<PrintTemplateView | null>(initialView);
  const saved: TemplateDraft | null = useMemo(() => (view ? draftOf(view) : null), [view]);
  const [draft, setDraft] = useState<TemplateDraft>(() =>
    initialView ? draftOf(initialView) : newDraft(newMode!.layout, newMode!.kind, PRINT_LAYOUT_NAMES[newMode!.layout]),
  );
  const [shown, setShown] = useState<DraftErrors>({});
  const [conflicts, setConflicts] = useState<Partial<Record<ConflictField, string>>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(() =>
    (location.state as { created?: boolean } | null)?.created ? { tone: 'ok', text: 'Đã tạo mẫu in.' } : null,
  );
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const leaving = useRef(false);
  const createKey = useRef<string | null>(null);

  // Hồ sơ thương hiệu: studio + logo của bản xem trước, nhãn "chưa nhập" của khối chuyển khoản.
  const profile = useLoad((signal) => getBrandProfile(orgId, signal), [orgId]);
  const profileData = profile.state.status === 'ready' ? profile.state.data : null;
  const studio = useMemo(() => studioOf(profileData, orgName), [profileData, orgName]);
  const logoUrl = profileData?.hasProfile ? (profileData.profile.logo?.url ?? null) : null;
  const bankOk = profileData?.hasProfile ? hasBank(profileData.profile) : null;

  // Bản đối chiếu: mẫu đã lưu; mẫu mới thì bản nháp lúc mở màn.
  const [initialDraft] = useState(draft);
  const guardDirty = isDirty(draft, saved ?? initialDraft);
  // Mẫu mới tạo được ngay (không cần sửa gì); mẫu đã có chỉ lưu khi có thay đổi.
  const dirty = saved === null ? true : guardDirty;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => guardDirty && !leaving.current && !busy && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!guardDirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [guardDirty]);

  const live = validateDraft(draft);
  const fieldErr: DraftErrors = { name: shown.name ?? live.name, title: shown.title ?? live.title, openingText: shown.openingText ?? live.openingText, closingText: shown.closingText ?? live.closingText };
  const version = view?.version ?? 1;
  const printed = view?.usage.printedContracts ?? 0;
  const warn = view ? printedWarning(view.version, printed) : null;
  const readOnly = !canEdit;
  const locked = lockedKinds(saved);
  const kinds = draft.appliesTo;

  function change(next: TemplateDraft | ((d: TemplateDraft) => TemplateDraft)) {
    setDraft(next);
    setNotice(null);
    setGeneral(null);
    setConflicts({});
    createKey.current = null;
  }

  function edit<K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) {
    change((d) => ({ ...d, [key]: value }));
    if (key === 'name' || key === 'title' || key === 'openingText' || key === 'closingText') setShown((e) => ({ ...e, [key]: undefined }));
  }

  function chooseApplies(c: AppliesChoice) {
    const next = kindsOfChoice(c);
    change((d) => ({ ...d, appliesTo: next, defaultFor: d.defaultFor.filter((k) => next.includes(k)) }));
  }

  function toggleDefault(k: ContractKind, on: boolean) {
    change((d) => ({ ...d, defaultFor: on ? [...new Set([...d.defaultFor, k])] : d.defaultFor.filter((x) => x !== k) }));
  }

  function apply(v: PrintTemplateView) {
    setView(v);
    setDraft(draftOf(v));
    setShown({});
    setConflicts({});
    setGeneral(null);
  }

  // Mẫu vừa đổi mặc định ở máy khác: lấy lại sự thật của máy chủ cho ba thứ liên quan (loại, mặc định, đang dùng), giữ nguyên chữ đang sửa.
  async function resync() {
    if (view === null) return;
    try {
      const v = await getPrintTemplate(orgId, view.id);
      setView(v);
      setDraft((d) => ({ ...d, appliesTo: [...v.appliesTo], defaultFor: [...v.defaultFor], isActive: v.isActive }));
    } catch {
      // Không lấy lại được thì giữ nguyên: lời máy chủ vẫn đang hiện, người dùng tải lại trang.
    }
  }

  function mapServerError(err: unknown, sent: PrintTemplateUpdateInput | null) {
    const reason = err instanceof ApiError ? (err.details as { reason?: unknown } | undefined)?.reason : undefined;
    if (errorKind(err) === 'conflict' && (reason === 'DEFAULT_REQUIRED' || reason === 'DEFAULT_TAKEN')) {
      const field: ConflictField = reason === 'DEFAULT_TAKEN' ? 'defaultFor' : defaultRequiredField(sent ?? {});
      setConflicts({ [field]: userMessage(err) });
      if (reason === 'DEFAULT_REQUIRED') void resync();
      return;
    }
    if (errorKind(err) === 'validation') {
      const byField = fieldErrors(err);
      const fields = (err instanceof ApiError ? (err.details as { fields?: unknown } | undefined)?.fields : undefined) as unknown;
      const list = Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [];
      const text: DraftErrors = {};
      const cf: Partial<Record<ConflictField, string>> = {};
      let general: string | null = null;
      const keys = new Set([...Object.keys(byField), ...list]);
      for (const f of keys) {
        const msg = byField[f] ?? userMessage(err);
        if (f === 'name' || f === 'title' || f === 'openingText' || f === 'closingText') text[f] = msg;
        else if (f === 'appliesTo' || f === 'defaultFor' || f === 'isActive') cf[f] = msg;
        else general = msg;
      }
      if (keys.size === 0) general = userMessage(err);
      setShown(text);
      setConflicts(cf);
      setGeneral(general);
      return;
    }
    setGeneral(userMessage(err));
  }

  async function save() {
    if (readOnly || busy) return;
    const local = validateDraft(draft);
    setShown(local);
    setGeneral(null);
    setConflicts({});
    const first = (['name', 'title', 'openingText', 'closingText'] as const).find((f) => local[f] !== undefined);
    if (first) {
      document.getElementById(first === 'name' ? 'mi-name' : `mi-txt-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (saved === null) {
        createKey.current ??= newIdempotencyKey();
        const created = await createPrintTemplate(orgId, createOf(draft), createKey.current);
        leaving.current = true;
        navigate(`${listHref}/${created.id}`, { replace: true, state: { created: true } });
        return;
      }
      const patch = patchOf(draft, saved);
      if (Object.keys(patch).length === 0) return;
      const v = await updatePrintTemplate(orgId, view!.id, patch);
      apply(v);
      setNotice({ tone: 'ok', text: v.version !== view!.version ? `Đã lưu — mẫu đang là bản v${v.version}.` : 'Đã lưu.' });
    } catch (err) {
      mapServerError(err, saved === null ? null : patchOf(draft, saved));
    } finally {
      setBusy(false);
    }
  }

  const label = saveLabel(draft, saved, view?.version ?? null);
  const canSave = !readOnly && online && dirty && !busy;
  const saveButton = (
    <Button variant="primary" onClick={() => void save()} loading={busy} disabled={!canSave}>
      {label}
    </Button>
  );
  const cancelButton = (
    <Button onClick={() => navigate(listHref)} disabled={busy}>
      Huỷ
    </Button>
  );

  const defaultTags = saved?.defaultFor ?? [];
  const title = draft.name.trim() === '' ? (saved ? 'Mẫu in' : 'Mẫu in mới') : draft.name.trim();

  const preview = <TemplatePreview draft={draft} templateId={view?.id ?? 'mau-moi'} version={version} studio={studio} logoUrl={logoUrl} />;
  const blockKeys = visibleBlocks(kinds);
  const both = kinds.length === 2;

  return (
    <div className="mi-page mi-edit">
      <PageHeader title={title} backTo={listHref} actions={phone || readOnly ? undefined : <span className="mi-head-actions">{cancelButton}{saveButton}</span>} />
      <div className="mi-meta">
        {defaultTags.length > 0 && <StatusTag tone="accent">Mặc định · {defaultTags.map((k) => KIND_LABEL[k]).join(', ')}</StatusTag>}
        {view ? <StatusTag tone="neutral">đang là bản v{view.version}</StatusTag> : <StatusTag tone="neutral">Mẫu mới</StatusTag>}
        {view && !view.isActive && <StatusTag tone="draft">Ngừng dùng</StatusTag>}
        {notice && (
          <span className={`mi-notice mi-notice--${notice.tone}`} role="status">
            {notice.text}
          </span>
        )}
      </div>
      {readOnly && (
        <Strip tone="grey" icon="lock">
          Bạn chỉ xem được. Sửa mẫu in cần quyền sửa mẫu điều khoản, nội quy (Chủ, Quản trị, Quản lý).
        </Strip>
      )}
      {!online && !readOnly && (
        <Strip tone="danger" icon="warn">
          Mất kết nối mạng — chưa lưu được cho tới khi có mạng lại.
        </Strip>
      )}
      {general && (
        <Strip tone="danger" icon="warn">
          {general}
        </Strip>
      )}
      <div className="mi-cols">
        <div className="mi-form">
          <Card title="Mẫu">
            <SettingRow label="Tên mẫu" htmlFor="mi-name" tip="Tên hiện trong danh sách và trong hộp In ở hợp đồng." required className="mi-row--wide">
              <TextInput
                id="mi-name"
                value={draft.name}
                maxLength={NAME_MAX + 40}
                disabled={readOnly || busy}
                error={fieldErr.name ?? null}
                onChange={(e) => edit('name', e.target.value)}
              />
            </SettingRow>
            <SettingRow label="Dùng cho" tip="Loại hợp đồng được chọn mẫu này khi in." controlWidth={300} className="mi-row--wide">
              <div className="mi-ctl">
                {isAcademy ? (
                  <Segmented<AppliesChoice>
                    aria-label="Dùng cho"
                    value={choiceOf(draft.appliesTo)}
                    onChange={chooseApplies}
                    disabled={readOnly || busy}
                    block={phone}
                    options={(
                      [
                        ['SERVICE', 'Dịch vụ'],
                        ['COURSE', 'Khoá học'],
                        ['BOTH', 'Cả hai'],
                      ] as const
                    ).map(([value, text]) => {
                      const dropped = locked.filter((k) => !kindsOfChoice(value).includes(k));
                      return {
                        value,
                        label: text,
                        disabled: dropped.length > 0,
                        disabledReason: dropped.length > 0 ? `Mẫu đang là mặc định cho hợp đồng ${dropped.map((k) => KIND_LABEL[k]).join(', ')} — bật mặc định ở mẫu khác trước` : undefined,
                      };
                    })}
                  />
                ) : (
                  <span className="mi-fixed">Hợp đồng dịch vụ</span>
                )}
                {conflicts.appliesTo && <p className="mi-err" role="alert">{conflicts.appliesTo}</p>}
              </div>
            </SettingRow>
            {kinds.map((k) => {
              const isLocked = saved !== null && saved.defaultFor.includes(k);
              const on = draft.defaultFor.includes(k);
              const inactive = !draft.isActive && !isLocked;
              return (
                <SettingRow
                  key={k}
                  label={`Mặc định cho hợp đồng ${KIND_LABEL[k]}`}
                  htmlFor={`mi-default-${k}`}
                  tip="Mỗi loại hợp đồng có đúng một mẫu mặc định — mẫu được chọn sẵn khi bấm In. Bật ở đây thì mẫu mặc định cũ của loại này tự bỏ cờ."
                >
                  <div className="mi-ctl">
                    <Switch id={`mi-default-${k}`} checked={on} onChange={(v) => toggleDefault(k, v)} disabled={readOnly || busy || isLocked || inactive} />
                    {isLocked && <span className="mi-lock">Muốn đổi mặc định: bật ở mẫu khác</span>}
                    {inactive && <span className="mi-lock">Bật "Đang dùng" trước</span>}
                    {conflicts.defaultFor && k === kinds[0] && <p className="mi-err" role="alert">{conflicts.defaultFor}</p>}
                  </div>
                </SettingRow>
              );
            })}
            {saved !== null && (
              <SettingRow label="Đang dùng" htmlFor="mi-active" tip="Mẫu ngừng dùng không hiện trong hộp In; các hợp đồng đã in bằng mẫu này vẫn in lại đúng như cũ. Mẫu đang là mặc định thì không ngừng dùng được.">
                <div className="mi-ctl">
                  <Switch
                    id="mi-active"
                    checked={draft.isActive}
                    onChange={(v) => edit('isActive', v)}
                    disabled={readOnly || busy || saved.defaultFor.length > 0}
                  />
                  {saved.defaultFor.length > 0 && <span className="mi-lock">Mẫu mặc định luôn đang dùng</span>}
                  {conflicts.isActive && <p className="mi-err" role="alert">{conflicts.isActive}</p>}
                </div>
              </SettingRow>
            )}
          </Card>

          <Card title="Bố cục" subtitle="chọn 1 trong 5">
            <LayoutPicker value={draft.layout} onChange={(l) => edit('layout', l)} disabled={readOnly || busy} />
          </Card>

          <Card title="Khối hiện trên bản in" subtitle="bật hoặc tắt từng khối, xem trước bên cạnh đổi ngay">
            {blockKeys.map((key) => {
              const def = TOGGLE_BLOCKS[key];
              const single = both && def.kinds.length === 1 ? `Chỉ có ở hợp đồng ${KIND_LABEL[def.kinds[0] as ContractKind]}.` : '';
              const tip = [def.hint, single].filter((s) => s !== '').join(' ');
              return (
                <SettingRow
                  key={key}
                  label={
                    <>
                      {def.label}
                      {key === 'giay-to' && <StatusTag tone="warn" className="mi-tag">điền tay</StatusTag>}
                      {key === 'chuyen-khoan' && bankOk === false && <StatusTag tone="warn" className="mi-tag">chưa nhập</StatusTag>}
                    </>
                  }
                  htmlFor={`mi-blk-${key}`}
                  tip={tip === '' ? undefined : tip}
                >
                  <Switch id={`mi-blk-${key}`} checked={effectiveBlock(draft, key)} disabled={readOnly || busy} onChange={(v) => change((d) => setBlock(d, saved, key, v))} />
                </SettingRow>
              );
            })}
            {ALWAYS_ON_KEYS.map((key) => (
              <SettingRow key={key} label={<span className="mi-always">{ALWAYS_ON_LABELS[key]}</span>}>
                <span className="mi-always">luôn có</span>
              </SettingRow>
            ))}
          </Card>

          <Card title="Chữ trên bản in" subtitle="để trống thì dùng chữ mặc định">
            <TextFields draft={draft} errors={fieldErr} onChange={edit} disabled={readOnly || busy} />
          </Card>
        </div>

        {!phone && (
          <div className="mi-side">
            {preview}
            {warn && (
              <div className="mi-warn" role="status">
                {warn}
              </div>
            )}
          </div>
        )}
      </div>

      {phone && (
        <>
          {warn && (
            <div className="mi-warn" role="status">
              {warn}
            </div>
          )}
          <div className="mi-bar" role="region" aria-label="Lưu mẫu in">
            <Button onClick={() => setPreviewOpen(true)}>Xem trước</Button>
            {!readOnly && saveButton}
          </div>
          <Dialog
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            title="Xem trước bản in"
            className="mi-prevdlg"
            footer={<Button onClick={() => setPreviewOpen(false)}>Đóng</Button>}
          >
            {preview}
          </Dialog>
        </>
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Bỏ thay đổi mẫu in?"
        message="Các thay đổi chưa lưu sẽ mất."
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Ở lại"
        danger
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}

const TEXT_ROWS: { field: 'title' | 'openingText' | 'closingText'; label: string; tip: string; multiline: boolean; rows: number }[] = [
  { field: 'title', label: 'Tiêu đề', tip: 'Dòng tiêu đề lớn của hợp đồng. Để trống thì dùng tiêu đề mặc định theo loại hợp đồng.', multiline: false, rows: 1 },
  { field: 'openingText', label: 'Chữ mở đầu', tip: 'Câu mở đầu dưới thông tin hai bên. Bấm một biến để chèn vào chỗ con trỏ — biến được thay bằng số liệu thật của hợp đồng khi in.', multiline: true, rows: 3 },
  { field: 'closingText', label: 'Chữ kết thúc', tip: 'Câu kết trước chỗ ký. Bấm một biến để chèn vào chỗ con trỏ.', multiline: true, rows: 3 },
];

function TextFields({
  draft,
  errors,
  onChange,
  disabled,
}: {
  draft: TemplateDraft;
  errors: DraftErrors;
  onChange: <K extends 'title' | 'openingText' | 'closingText'>(key: K, value: string) => void;
  disabled: boolean;
}): ReactNode {
  return (
    <>
      {TEXT_ROWS.map((r) => {
        const def = defaultText(r.field, draft.appliesTo);
        return (
          <VariableField
            key={r.field}
            id={`mi-txt-${r.field}`}
            label={r.label}
            tip={r.tip}
            value={draft[r.field]}
            onChange={(v) => onChange(r.field, v)}
            kinds={draft.appliesTo}
            error={errors[r.field] ?? null}
            multiline={r.multiline}
            rows={r.rows}
            maxLength={TEXT_MAX[r.field]}
            placeholder={def ?? 'Để trống = chữ mặc định theo từng loại hợp đồng'}
            disabled={disabled}
          />
        );
      })}
    </>
  );
}
