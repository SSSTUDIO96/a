// Tải hồ sơ, giữ bản nháp đầy đủ và bản gốc (để biết "có thay đổi chưa lưu"), làm mới URL ảnh quá hạn khi quay lại thẻ.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTravelFeePolicy, listMakeupSubjects, listPackages } from '../../api/catalog';
import { errorKind } from '../../api/errors';
import { getFile } from '../../api/files';
import { getBrandProfile } from '../../api/profile';
import type { BrandProfileResult, ServicePackage } from '../../api/types';
import type { PreviewCatalog } from './draftToSite';
import { draftFromProfile, emptyDraft, expiredSlots, type Draft, type ImageSlot } from './model';

export type LoadState = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready' };

export interface ProfileDraft {
  load: LoadState;
  result: BrandProfileResult | null;
  baseline: Draft;
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  // Sau PUT / publish / unpublish: bản gốc và bản nháp theo máy chủ.
  apply: (r: BrandProfileResult) => void;
  reset: () => void;
  reload: () => void;
}

export function useProfileDraft(orgId: string): ProfileDraft {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [result, setResult] = useState<BrandProfileResult | null>(null);
  const [baseline, setBaseline] = useState<Draft>(emptyDraft);
  const [draft, setDraftState] = useState<Draft>(emptyDraft);
  const [attempt, setAttempt] = useState(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ status: 'loading' });
    getBrandProfile(orgId, ctrl.signal)
      .then((r) => {
        setResult(r);
        const d = r.hasProfile ? draftFromProfile(r.profile) : emptyDraft();
        setBaseline(d);
        setDraftState(d);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoad({ status: 'error', error });
      });
    return () => ctrl.abort();
  }, [orgId, attempt]);

  const setDraft = useCallback((update: (d: Draft) => Draft) => setDraftState(update), []);

  const apply = useCallback((r: BrandProfileResult) => {
    setResult(r);
    const d = r.hasProfile ? draftFromProfile(r.profile) : emptyDraft();
    setBaseline(d);
    setDraftState(d);
  }, []);

  const reset = useCallback(() => setDraftState(baseline), [baseline]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  // URL ảnh sống 10 phút: quay lại thẻ mà đã quá hạn → lấy URL mới, CHỈ thay URL (không đè chữ đang sửa).
  // Ảnh đã lưu: GET /profile; ảnh vừa tải chưa lưu: GET /files/:id.
  useEffect(() => {
    if (load.status !== 'ready') return undefined;
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState !== 'visible') return;
      const slots = expiredSlots(draftRef.current.images);
      if (slots.length === 0) return;
      busy = true;
      try {
        const fresh: Partial<Record<ImageSlot, { fileId: string; url: string | null; expiresAt: string | null }>> = {};
        const saved = await getBrandProfile(orgId).catch(() => null);
        for (const slot of slots) {
          const im = draftRef.current.images[slot];
          if (!im) continue;
          const p = saved?.hasProfile ? saved.profile : null;
          if (p && p[`${slot}FileId`] === im.fileId && p[slot]) {
            fresh[slot] = { fileId: im.fileId, url: p[slot].url, expiresAt: p[slot].expiresAt };
            continue;
          }
          const f = await getFile(orgId, im.fileId).catch(() => null);
          if (f) fresh[slot] = { fileId: im.fileId, url: f.signedUrl, expiresAt: f.signedUrlExpiresAt };
        }
        const patch = (d: Draft): Draft => {
          const images = { ...d.images };
          for (const slot of Object.keys(fresh) as ImageSlot[]) {
            const f = fresh[slot];
            if (f && images[slot]?.fileId === f.fileId) images[slot] = f;
          }
          return { ...d, images };
        };
        setDraftState(patch);
        setBaseline(patch);
      } finally {
        busy = false;
      }
    }
    const onVisible = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [orgId, load.status]);

  return { load, result, baseline, draft, setDraft, apply, reset, reload };
}

// ---- Gói cho nhóm "Gói hiện trên trang" và khung xem trước ----

export type CatalogState = { status: 'off' } | { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: PreviewCatalog };

async function allActivePackages(orgId: string, signal: AbortSignal): Promise<ServicePackage[]> {
  const out: ServicePackage[] = [];
  for (let page = 1; ; page++) {
    const r = await listPackages(orgId, { isActive: true, page, pageSize: 100 }, signal);
    out.push(...r.items);
    if (r.items.length === 0 || out.length >= r.total) return out;
  }
}

export function usePreviewCatalog(orgId: string, enabled: boolean) {
  const [state, setState] = useState<CatalogState>(enabled ? { status: 'loading' } : { status: 'off' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'off' });
      return undefined;
    }
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    Promise.all([
      allActivePackages(orgId, ctrl.signal),
      listMakeupSubjects(orgId, { isActive: true }, ctrl.signal).then((r) => r.items.map((s) => ({ id: s.id, name: s.name }))),
      // Chưa đặt chính sách phí di chuyển (404) → không có km miễn phí chung.
      getTravelFeePolicy(orgId, ctrl.signal).then(
        (p) => p.freeKm,
        (err: unknown) => {
          if (errorKind(err) === 'not_found') return null;
          throw err;
        },
      ),
    ])
      .then(([packages, subjects, freeKm]) => setState({ status: 'ready', data: { packages, subjects, freeKm } }))
      .catch((error: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', error });
      });
    return () => ctrl.abort();
  }, [orgId, enabled, attempt]);

  const setPackage = useCallback((pkg: ServicePackage) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', data: { ...s.data, packages: s.data.packages.map((p) => (p.id === pkg.id ? pkg : p)) } } : s));
  }, []);

  return { state, reload: () => setAttempt((n) => n + 1), setPackage };
}
