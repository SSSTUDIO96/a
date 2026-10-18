// Màn "Hồ sơ thương hiệu" — bản vẽ C2 mục 4, phương án C: sửa bên trái, xem trước bên phải (/:orgSlug/cai-dat/thuong-hieu).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useParams } from 'react-router';
import { errorKind, userMessage } from '../../api/errors';
import { publishBrandProfile, putBrandProfile, unpublishBrandProfile } from '../../api/profile';
import type { BrandProfileResult } from '../../api/types';
import { useSession } from '../../app/session';
import { useOnline } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { usePermissions, usePermissionsContext } from '../../layout/usePermissions';
import { Button, ConfirmDialog, EmptyState, Segmented, Skeleton, TextInput } from '../../ui';
import { BrandForm } from './BrandForm';
import { draftToSite } from './draftToSite';
import {
  emptyDraft,
  IMAGE_SLOTS,
  MAX_LENGTH,
  mapSaveError,
  isDirty,
  TEXT_FIELDS,
  toInput,
  validateDraft,
  type Draft,
  type FormErrors,
} from './model';
import { PreviewPane } from './PreviewPane';
import { PublishBar } from './PublishBar';
import { usePreviewCatalog, useProfileDraft } from './useProfileDraft';
import './brand.css';

type Notice = { tone: 'danger' | 'warn'; text: string } | null;

// Lỗi chỉ hiện khi ô còn giữ đúng giá trị lúc bị báo lỗi — sửa ô là lỗi của ô đó tắt.
function visibleErrors(errors: FormErrors, at: Draft | null, now: Draft): FormErrors {
  if (!at) return errors;
  const out: FormErrors = {};
  for (const [k, msg] of Object.entries(errors)) {
    let same = true;
    if ((TEXT_FIELDS as readonly string[]).includes(k)) same = at[k as (typeof TEXT_FIELDS)[number]] === now[k as (typeof TEXT_FIELDS)[number]];
    else if (k === 'styles') same = JSON.stringify(at.styles) === JSON.stringify(now.styles);
    else if (k.endsWith('FileId')) {
      const slot = IMAGE_SLOTS.find((s) => `${s}FileId` === k);
      if (slot) same = at.images[slot]?.fileId === now.images[slot]?.fileId;
    } else if (k.startsWith('hours.')) {
      const i = Number(k.slice(6)) - 1;
      same = JSON.stringify(at.days[i]) === JSON.stringify(now.days[i]);
    } else if (k === 'workingHours') same = JSON.stringify(at.days) === JSON.stringify(now.days);
    if (same) out[k] = msg;
  }
  return out;
}

function scrollToFirstError(root: HTMLElement | null) {
  const el = root?.querySelector<HTMLElement>('[aria-invalid="true"], .br-err, .ui-img__error');
  if (!el) return;
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  if (el.matches('input, textarea')) el.focus({ preventScroll: true });
}

export function BrandProfilePage() {
  const { orgSlug } = useParams();
  const { organizations } = useSession();
  const org = organizations.find((o) => o.slug === orgSlug);
  if (!org) return null; // AppShell đã chặn tổ chức không có
  return <BrandProfileScreen orgId={org.id} slug={org.slug} />;
}

function BrandProfileScreen({ orgId, slug }: { orgId: string; slug: string }) {
  const has = usePermissions();
  const permState = usePermissionsContext().state;
  const timezone = permState.status === 'ready' ? permState.org.timezone : null;
  const canEdit = has('org.update');
  const canUpload = has('files.write');
  const catalogRead = has('catalog.read');
  const catalogWrite = has('catalog.write');
  const compact = useBreakpoint() === 'phone';
  const online = useOnline();

  const p = useProfileDraft(orgId);
  const catalog = usePreviewCatalog(orgId, catalogRead);
  const [errors, setErrors] = useState<FormErrors>({});
  const [errorsAt, setErrorsAt] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [tab, setTab] = useState<'sua' | 'xem'>('sua');
  const [scrollTick, setScrollTick] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const ready = p.load.status === 'ready';
  const dirty = ready && isDirty(p.draft, p.baseline);
  const profile = p.result?.hasProfile ? p.result.profile : null;
  const published = profile?.isPublished ?? false;
  const canPublish = Boolean(profile && profile.brandName.trim() !== '');
  const shownErrors = visibleErrors(errors, errorsAt, p.draft);
  const site = useMemo(() => draftToSite(p.draft, catalog.state.status === 'ready' ? catalog.state.data : null), [p.draft, catalog.state]);

  useEffect(() => {
    if (scrollTick === 0) return;
    if (compact) setTab('sua');
    // Chờ một khung hình để ô lỗi đã có trên trang (vừa đổi tab trên điện thoại).
    const t = window.setTimeout(() => scrollToFirstError(bodyRef.current), 0);
    return () => window.clearTimeout(t);
  }, [scrollTick, compact]);

  // Rời trang khi còn thay đổi chưa lưu.
  const blocker = { state: 'unblocked' as string, reset: undefined as undefined | (() => void), proceed: undefined as undefined | (() => void) }; void useBlocker;
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function failNotice(err: unknown, what: string) {
    const kind = errorKind(err);
    if (kind === 'network') setNotice({ tone: 'warn', text: `Mất kết nối khi ${what}. Bản nháp vẫn giữ nguyên — thử lại khi có mạng.` });
    else setNotice({ tone: 'danger', text: userMessage(err) });
  }

  function showErrors(e: FormErrors) {
    setErrors(e);
    setErrorsAt(p.draft);
    setScrollTick((n) => n + 1);
  }

  async function save(andPublish: boolean) {
    const local = validateDraft(p.draft);
    if (Object.keys(local).length) {
      showErrors(local);
      return;
    }
    const { input, sent } = toInput(p.draft);
    setSaving(true);
    setNotice(null);
    let saved: BrandProfileResult | null = null;
    try {
      saved = await putBrandProfile(orgId, input);
      p.apply(saved);
      setErrors({});
      setErrorsAt(null);
    } catch (err) {
      if (errorKind(err) === 'validation') {
        const mapped = mapSaveError(err, sent);
        if (mapped._form) setNotice({ tone: 'danger', text: mapped._form });
        showErrors(mapped);
      } else failNotice(err, 'lưu hồ sơ');
    }
    if (saved && andPublish) {
      try {
        p.setPublished(await publishBrandProfile(orgId));
      } catch (err) {
        failNotice(err, 'xuất bản');
      }
    }
    setSaving(false);
  }

  async function publish() {
    setPublishing(true);
    setNotice(null);
    try {
      p.setPublished(await publishBrandProfile(orgId));
    } catch (err) {
      failNotice(err, 'xuất bản');
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    setPublishing(true);
    try {
      p.setPublished(await unpublishBrandProfile(orgId));
      setConfirmUnpublish(false);
    } finally {
      setPublishing(false);
    }
  }

  let body;
  if (p.load.status === 'loading') body = <LoadingSkeleton />;
  else if (p.load.status === 'error') {
    body = (
      <EmptyState
        message={`Không tải được hồ sơ thương hiệu. ${userMessage(p.load.error)}`}
        action={<Button onClick={p.reload}>Thử lại</Button>}
      />
    );
  } else {
    const banner = notice && (
      <div className={`br-banner br-banner--${notice.tone}`} role={notice.tone === 'danger' ? 'alert' : 'status'}>
        {notice.text}
      </div>
    );
    body = (
      <>
        <PublishBar
          slug={slug}
          published={published}
          publishedAt={profile?.publishedAt ?? null}
          timezone={timezone}
          canPublish={canPublish}
          publishing={publishing}
          onPublish={() => void publish()}
          onUnpublish={() => setConfirmUnpublish(true)}
          readOnly={!canEdit}
        />
        {!profile ? (
          <>
            {banner}
            <NoProfile
              disabled={!canEdit}
              onCreate={async (brandName) => {
                const { input } = toInput({ ...emptyDraft(), brandName });
                p.apply(await putBrandProfile(orgId, input));
              }}
            />
          </>
        ) : (
          <>
            {compact && (
              <Segmented
                block
                className="br-tabs"
                aria-label="Sửa hoặc xem trước"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'sua', label: 'Sửa hồ sơ' },
                  { value: 'xem', label: 'Xem trước' },
                ]}
              />
            )}
            {compact && banner}
            <div className="br-cols">
              {(!compact || tab === 'sua') && (
                <div className="br-main">
                  {!compact && banner}
                  <BrandForm
                    orgId={orgId}
                    draft={p.draft}
                    setDraft={p.setDraft}
                    errors={shownErrors}
                    disabled={!canEdit || saving}
                    canUpload={canUpload}
                    catalog={
                      catalogRead
                        ? { state: catalog.state, reload: catalog.reload, canWrite: catalogWrite, onChanged: catalog.setPackage }
                        : null
                    }
                  />
                </div>
              )}
              {(!compact || tab === 'xem') && <PreviewPane data={site} compact={compact} />}
            </div>
            {dirty && (
              <div className="br-save" role="region" aria-label="Lưu hồ sơ">
                <span className="br-save__t">Có thay đổi chưa lưu</span>
                <Button
                  onClick={() => {
                    p.reset();
                    setErrors({});
                    setErrorsAt(null);
                    setNotice(null);
                  }}
                  disabled={saving}
                >
                  Bỏ thay đổi
                </Button>
                {!published && (
                  <Button onClick={() => void save(true)} disabled={saving || !online || !canEdit} className="br-save__pub">
                    Lưu và xuất bản
                  </Button>
                )}
                <Button variant="primary" onClick={() => void save(false)} loading={saving} disabled={!online || !canEdit}>
                  Lưu hồ sơ
                </Button>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <div className="br-page" ref={bodyRef}>
      <PageHeader title="Hồ sơ thương hiệu" />
      {body}
      <ConfirmDialog
        open={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        title="Gỡ trang giới thiệu?"
        message="Khách mở liên kết sẽ thấy “Không tìm thấy trang giới thiệu”. Hồ sơ vẫn giữ nguyên, xuất bản lại lúc nào cũng được."
        confirmLabel="Gỡ trang"
        cancelLabel="Giữ trang"
        danger
        errorMessage={userMessage}
        onConfirm={unpublish}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Bỏ thay đổi hồ sơ?"
        message="Các thay đổi chưa lưu sẽ mất."
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Ở lại"
        danger
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}

function NoProfile({ disabled, onCreate }: { disabled: boolean; onCreate: (brandName: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (name.trim() === '') {
      setError('Tên thương hiệu không được để trống');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <div className="br-banner br-banner--grey">
        Trang chưa xuất bản: khách mở liên kết sẽ thấy “Không tìm thấy trang giới thiệu”. Lưu hồ sơ có tên thương hiệu rồi bấm Xuất bản.
      </div>
      <section className="ui-card br-empty">
        <p className="br-muted">Chưa có hồ sơ thương hiệu. Bắt đầu bằng tên thương hiệu.</p>
        <TextInput
          className="br-empty__input"
          aria-label="Tên thương hiệu"
          placeholder="Tên thương hiệu, ví dụ: Studio Chiến Makeup"
          value={name}
          maxLength={MAX_LENGTH.brandName}
          error={error}
          disabled={disabled || busy}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <Button size="sm" variant="primary" loading={busy} disabled={disabled} onClick={() => void submit()}>
          Lưu và tiếp tục
        </Button>
      </section>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="br-skel" role="status" aria-label="Đang tải hồ sơ">
      <div className="ui-card br-skel__bar">
        <Skeleton width={140} height={20} />
        <Skeleton width={220} />
      </div>
      <div className="br-cols">
        <div className="ui-card br-skel__form">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="br-skel__grp">
              <Skeleton width={110} height={14} />
              <Skeleton width="100%" height={30} />
              <Skeleton width="100%" height={30} />
            </div>
          ))}
        </div>
        <div className="br-skel__pvw" />
      </div>
    </div>
  );
}
