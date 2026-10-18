import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { listMakeupSubjects, listPackages, updateMakeupSubject } from '../../api/catalog';
import { userMessage } from '../../api/errors';
import type { MakeupSubject } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Button, Card, IconPlus, Skeleton, Switch } from '../../ui';
import { useOrgId, usePricingPerms, useResource } from './hooks';
import { fetchAllPages, moveItem, packageCountBySubject, sortOrderPatches } from './logic';
import { ErrorBanner, IconGrip, LoadError } from './parts';
import { PricingHeader } from './PricingHeader';
import { SubjectDialog } from './SubjectDialog';

const bySort = (a: MakeupSubject, b: MakeupSubject) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi');

// (d) Nhân vật — mỗi dòng: tên · "n gói" · công tắc đang dùng. Kéo tay nắm (hoặc mũi tên lên/xuống) để đổi thứ tự.
export function SubjectsPage() {
  const orgId = useOrgId();
  const perms = usePricingPerms();
  const online = useOnline();
  const [res, reload] = useResource(
    async (signal) => {
      const [subjects, packages] = await Promise.all([
        listMakeupSubjects(orgId, undefined, signal).then((r) => r.items),
        fetchAllPages((page, pageSize) => listPackages(orgId, { isActive: true, page, pageSize }, signal)),
      ]);
      return { subjects, counts: packageCountBySubject(packages) };
    },
    [orgId],
  );
  const [order, setOrder] = useState<MakeupSubject[]>([]);
  const [editing, setEditing] = useState<MakeupSubject | 'new' | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{ id: string } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (res.status === 'ready') setOrder([...res.data.subjects].sort(bySort));
  }, [res]);

  const canWrite = perms.catalogWrite && online && !busy;

  async function commitOrder(next: MakeupSubject[]) {
    const patches = sortOrderPatches(next);
    if (patches.length === 0) return;
    setBusy(true);
    setBanner(null);
    try {
      // Lần lượt từng nhân vật đổi chỗ; lỗi giữa chừng thì tải lại để thấy đúng thứ tự đang lưu.
      for (const p of patches) await updateMakeupSubject(orgId, p.id, { sortOrder: p.sortOrder });
    } catch (err) {
      setBanner(userMessage(err));
    } finally {
      setBusy(false);
      reload();
    }
  }

  async function toggle(s: MakeupSubject, isActive: boolean) {
    setBusy(true);
    setBanner(null);
    setOrder((o) => o.map((x) => (x.id === s.id ? { ...x, isActive } : x)));
    try {
      await updateMakeupSubject(orgId, s.id, { isActive });
    } catch (err) {
      setBanner(userMessage(err));
    } finally {
      setBusy(false);
      reload();
    }
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>, s: MakeupSubject) {
    if (!canWrite) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: s.id });
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const from = order.findIndex((x) => x.id === drag.id);
    // Vị trí mới = số dòng (trừ dòng đang kéo) có điểm giữa nằm trên con trỏ.
    let to = 0;
    for (const s of order) {
      if (s.id === drag.id) continue;
      const r = rowRefs.current.get(s.id)?.getBoundingClientRect();
      if (r && e.clientY > r.top + r.height / 2) to += 1;
    }
    if (from >= 0 && to !== from) setOrder((o) => moveItem(o, from, to));
  }

  function onPointerUp() {
    if (!drag) return;
    setDrag(null);
    void commitOrder(order);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (!canWrite) return;
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (to < 0 || to >= order.length) return;
    e.preventDefault();
    const next = moveItem(order, i, to);
    setOrder(next);
    void commitOrder(next);
    requestAnimationFrame(() => rowRefs.current.get(order[i]?.id ?? '')?.querySelector<HTMLButtonElement>('.pr-grip')?.focus());
  }

  let body;
  if (res.status === 'error') body = <LoadError error={res.error} retry={reload} />;
  else if (res.status === 'loading')
    body = (
      <div role="status" aria-label="Đang tải nhân vật">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pr-row pr-row--skel">
            <Skeleton width="50%" height={14} />
            <Skeleton width={40} height={12} />
            <Skeleton width={38} height={22} />
          </div>
        ))}
      </div>
    );
  else
    body = (
      <ul className="pr-list" aria-label="Nhân vật makeup">
        {order.map((s, i) => (
          <li
            key={s.id}
            ref={(el) => {
              if (el) rowRefs.current.set(s.id, el);
              else rowRefs.current.delete(s.id);
            }}
            className={drag?.id === s.id ? 'pr-subrow pr-subrow--drag' : 'pr-subrow'}
          >
            {perms.catalogWrite && (
              <button
                type="button"
                className="pr-grip"
                aria-label={`Đổi thứ tự ${s.name}`}
                title="Kéo để đổi thứ tự"
                disabled={!canWrite && !drag}
                onPointerDown={(e) => onPointerDown(e, s)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <IconGrip />
              </button>
            )}
            {perms.catalogWrite ? (
              <button type="button" className="pr-subrow__name" onClick={() => setEditing(s)}>
                {s.name}
              </button>
            ) : (
              <span className="pr-subrow__name">{s.name}</span>
            )}
            <span className="pr-row__meta">{res.data.counts.get(s.id) ?? 0} gói</span>
            <Switch
              checked={s.isActive}
              aria-label={`${s.name}: đang dùng`}
              title="Đang dùng"
              disabled={!canWrite}
              onChange={(v) => void toggle(s, v)}
            />
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <PricingHeader group="nhan-vat" />
      <Card className="pr-narrow" flush>
        {banner && (
          <div className="pr-pad">
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        )}
        {body}
        {perms.catalogWrite && (
          <div className="pr-pad">
            <Button variant="ghost" size="sm" className="pr-add-link" icon={<IconPlus />} onClick={() => setEditing('new')} disabled={!online}>
              Thêm nhân vật
            </Button>
          </div>
        )}
      </Card>
      {editing && (
        <SubjectDialog
          orgId={orgId}
          subject={editing === 'new' ? null : editing}
          nextSortOrder={order.length}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
