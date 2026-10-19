import { useEffect, useState } from 'react';
import { listOccasions, reorderOccasions, updateOccasion } from '../../api/catalog';
import { userMessage } from '../../api/errors';
import type { OccasionColor, OccasionUpdateInput, OccasionView } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { Button, Card, EmptyState, IconPlus, Skeleton, Switch } from '../../ui';
import { useOrgId, usePricingPerms, useResource, useRowReorder } from './hooks';
import { occasionSubtitle, occasionUsage, sortOccasions } from './logic';
import { ColorSwatches, OccasionDialog } from './OccasionDialog';
import { ErrorBanner, IconGrip, LoadError } from './parts';
import { PricingHeader } from './PricingHeader';

export const TIP_GRIP = 'Kéo để đổi thứ tự trong ô chọn';
export const TIP_HIDE = 'Ẩn: không chọn được cho dòng mới; dòng cũ giữ nguyên';

export function IconArrow({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <path d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Nút tròn nổi ở góc dưới phải, trên thanh dưới (điện thoại, bản vẽ D mục 3.2).
export function PhoneFab({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="primary" className="pr-fab" icon={<IconPlus />} aria-label={label} onClick={onClick} disabled={disabled} />
  );
}

// Bảng giá › Loại sự kiện: tên · "N dòng hợp đồng đang dùng" · 12 ô màu · công tắc ẩn/hiện. Kéo tay nắm (điện thoại: ↑ ↓) để đổi thứ tự.
export function OccasionsPage() {
  const orgId = useOrgId();
  const perms = usePricingPerms();
  const online = useOnline();
  const phone = useBreakpoint() === 'phone';
  const [res, reload] = useResource((signal) => listOccasions(orgId, undefined, signal).then((r) => r.items), [orgId]);
  const [order, setOrder] = useState<OccasionView[]>([]);
  const [editing, setEditing] = useState<OccasionView | 'new' | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (res.status === 'ready') setOrder(sortOccasions(res.data));
  }, [res]);

  const canWrite = perms.catalogWrite && online && !busy;

  async function commitOrder(next: OccasionView[]) {
    const before = (res.status === 'ready' ? sortOccasions(res.data) : []).map((o) => o.id).join('|');
    if (next.map((o) => o.id).join('|') === before) return;
    setBusy(true);
    setBanner(null);
    try {
      // PUT gửi ĐỦ mọi loại của tổ chức (kể cả đang ẩn), mỗi loại một lần.
      const done = await reorderOccasions(orgId, { occasionIds: next.map((o) => o.id) });
      setOrder(sortOccasions(done.items));
    } catch (err) {
      setBanner(userMessage(err));
    } finally {
      setBusy(false);
      reload();
    }
  }

  const reorder = useRowReorder<OccasionView>({ items: order, setItems: setOrder, enabled: canWrite, onCommit: (n) => void commitOrder(n) });

  async function patch(o: OccasionView, input: OccasionUpdateInput) {
    setBusy(true);
    setBanner(null);
    setOrder((list) => list.map((x) => (x.id === o.id ? { ...x, ...input } : x)));
    try {
      await updateOccasion(orgId, o.id, input);
    } catch (err) {
      setBanner(userMessage(err));
    } finally {
      setBusy(false);
      reload();
    }
  }

  const pickColor = (o: OccasionView, color: OccasionColor) => {
    if (color !== o.color) void patch(o, { color });
  };

  let body;
  if (res.status === 'error') body = <LoadError error={res.error} retry={reload} />;
  else if (res.status === 'loading')
    body = (
      <div role="status" aria-label="Đang tải loại sự kiện">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pr-row pr-row--skel">
            <Skeleton width="40%" height={14} />
            <Skeleton width={160} height={14} />
            <Skeleton width={38} height={22} />
          </div>
        ))}
      </div>
    );
  else if (order.length === 0)
    body = (
      <EmptyState
        message="Chưa có loại sự kiện nào."
        action={
          perms.catalogWrite ? (
            <Button variant="dashed" icon={<IconPlus />} onClick={() => setEditing('new')} disabled={!online}>
              Thêm loại
            </Button>
          ) : undefined
        }
      />
    );
  else
    body = (
      <ul className="pr-list" aria-label="Loại sự kiện">
        {order.map((o, i) => (
          <li key={o.id} ref={reorder.rowRef(o.id)} className={reorder.drag?.id === o.id ? 'pr-occ pr-occ--drag' : 'pr-occ'}>
            {perms.catalogWrite &&
              (phone ? (
                <span className="pr-occ__arrows">
                  <button type="button" className="pr-arrow" aria-label={`Đưa ${o.name} lên`} disabled={!canWrite || i === 0} onClick={() => reorder.move(i, i - 1)}>
                    <IconArrow dir="up" />
                  </button>
                  <button type="button" className="pr-arrow" aria-label={`Đưa ${o.name} xuống`} disabled={!canWrite || i === order.length - 1} onClick={() => reorder.move(i, i + 1)}>
                    <IconArrow dir="down" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="pr-grip pr-occ__grip"
                  aria-label={`Đổi thứ tự ${o.name}`}
                  title={TIP_GRIP}
                  disabled={!canWrite && !reorder.drag}
                  {...reorder.gripProps(o, i)}
                >
                  <IconGrip />
                </button>
              ))}
            <div className="pr-occ__main">
              {perms.catalogWrite ? (
                <button type="button" className="pr-subrow__name pr-occ__name" onClick={() => setEditing(o)}>
                  {o.name}
                </button>
              ) : (
                <span className="pr-occ__name pr-occ__name--ro">{o.name}</span>
              )}
              <span className="pr-occ__sub">{occasionUsage(o.lineCount)}</span>
            </div>
            <div className="pr-occ__sw">
              <ColorSwatches value={o.color} subject={o.name} onPick={(c) => pickColor(o, c)} disabled={!canWrite} readOnly={!perms.catalogWrite} />
            </div>
            <Switch
              className="pr-occ__sv"
              checked={o.isActive}
              aria-label={`${o.name}: ${o.isActive ? 'đang dùng' : 'đang ẩn'}`}
              title={o.isActive ? `Đang dùng — tắt để ẩn. ${TIP_HIDE}` : `Đang ẩn. ${TIP_HIDE}. Bật để dùng lại`}
              disabled={!canWrite}
              onChange={(v) => void patch(o, { isActive: v })}
            />
          </li>
        ))}
      </ul>
    );

  const addButton =
    perms.catalogWrite && !phone ? (
      <Button variant="primary" size="sm" icon={<IconPlus />} onClick={() => setEditing('new')} disabled={!online || busy}>
        Thêm loại
      </Button>
    ) : undefined;

  return (
    <>
      <PricingHeader group="su-kien" />
      <Card
        className="pr-narrow pr-occcard"
        flush
        title="Loại sự kiện"
        subtitle={res.status === 'ready' ? occasionSubtitle(res.data.length) : undefined}
        actions={addButton}
        footer={
          <span>
            {perms.catalogWrite ? (phone ? 'Dùng nút ↑ ↓ để đổi thứ tự trong ô chọn. ' : 'Kéo ⋮⋮ để đổi thứ tự trong ô chọn. ') : ''}
            Ẩn loại không xoá các ca cũ đã gắn.
          </span>
        }
      >
        {banner && (
          <div className="pr-pad">
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        )}
        {body}
      </Card>
      {perms.catalogWrite && phone && <PhoneFab label="Thêm loại" onClick={() => setEditing('new')} disabled={!online || busy} />}
      {editing && (
        <OccasionDialog
          orgId={orgId}
          occasion={editing === 'new' ? null : editing}
          nextSortOrder={order.length === 0 ? 0 : Math.max(...order.map((o) => o.sortOrder)) + 1}
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
