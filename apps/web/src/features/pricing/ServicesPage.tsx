import { useState } from 'react';
import { listServices } from '../../api/catalog';
import type { Service, ServiceKind } from '../../api/types';
import { Button, Card, Chip, formatVnd, IconPlus, Skeleton, StatusTag, Tooltip } from '../../ui';
import { useOrgId, usePricingPerms, useResource } from './hooks';
import { fetchAllPages, filterActive, formatDuration, hasDuration } from './logic';
import { LoadError } from './parts';
import { PricingHeader } from './PricingHeader';
import { ServiceDialog, type ServiceTarget } from './ServiceDialog';

export const TIP_ADDON_LIST = 'Khách tick thêm dưới gói khi lập hợp đồng.';
export const TIP_MAIN_LIST = 'Dịch vụ để chọn vào "Đã gồm trong gói" khi sửa gói.';

const SECTIONS: { kind: ServiceKind; title: string; tip?: string; addLabel: string }[] = [
  { kind: 'ADDON', title: 'Dịch vụ phụ', tip: TIP_ADDON_LIST, addLabel: 'Thêm dịch vụ phụ' },
  { kind: 'SURCHARGE', title: 'Phụ phí cài sẵn', addLabel: 'Thêm phụ phí' },
  { kind: 'MAIN', title: 'Dịch vụ trong gói', tip: TIP_MAIN_LIST, addLabel: 'Thêm dịch vụ trong gói' },
];

// (b) Dịch vụ phụ & phụ phí — một thẻ danh sách, hai tiêu đề nhóm; mỗi dòng: tên · thời lượng · giá. Bấm dòng → hộp dịch vụ.
export function ServicesPage() {
  const orgId = useOrgId();
  const perms = usePricingPerms();
  // Lấy cả món ngừng bán (lọc ở máy theo chip "Cả ngừng bán"), chia theo loại.
  const [res, reload] = useResource<Record<ServiceKind, Service[]>>(
    async (signal) => {
      const all = await fetchAllPages((page, pageSize) => listServices(orgId, { page, pageSize }, signal));
      return {
        ADDON: all.filter((x) => x.kind === 'ADDON'),
        SURCHARGE: all.filter((x) => x.kind === 'SURCHARGE'),
        MAIN: all.filter((x) => x.kind === 'MAIN'),
      };
    },
    [orgId],
  );
  const [showInactive, setShowInactive] = useState(false);
  const [target, setTarget] = useState<ServiceTarget | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const open = (t: ServiceTarget) => {
    setDialogKey((k) => k + 1);
    setTarget(t);
  };

  let body;
  if (res.status === 'error') body = <LoadError error={res.error} retry={reload} />;
  else
    body = (
      <>
      {res.status === 'ready' && inactiveCount(res.data) > 0 && (
        <div className="pr-filter">
          <Chip selected={showInactive} count={inactiveCount(res.data)} onClick={() => setShowInactive((v) => !v)}>
            Cả ngừng bán
          </Chip>
        </div>
      )}
      <Card className="pr-narrow" flush>
        {SECTIONS.map((s) => (
          <section key={s.kind} aria-label={s.title}>
            <div className="pr-gh">
              <h2 className="pr-gh__t">{s.title}</h2>
              {s.tip && <Tooltip text={s.tip} />}
              <span className="pr-sp" />
              {perms.canCreatePriced && (
                <Button variant="ghost" size="sm" icon={<IconPlus />} aria-label={s.addLabel} onClick={() => open({ kind: 'create', serviceKind: s.kind })} />
              )}
            </div>
            {res.status === 'loading' ? (
              <ListSkeleton />
            ) : filterActive(res.data[s.kind], showInactive).length === 0 ? (
              <p className="pr-muted pr-pad">Chưa có mục nào.</p>
            ) : (
              <ul className="pr-list">
                {filterActive(res.data[s.kind], showInactive).map((svc) => (
                  <li key={svc.id}>
                    <button type="button" className="pr-row" onClick={() => open({ kind: 'edit', service: svc })}>
                      <span className="pr-row__name">
                        {svc.name}
                        {!svc.isActive && <StatusTag className="pr-off">Ngừng bán</StatusTag>}
                      </span>
                      <span className="pr-row__meta">{hasDuration(svc.kind) ? formatDuration(svc.durationMinutes) : ''}</span>
                      <b className="pr-row__price num">{svc.currentPrice ? formatVnd(svc.currentPrice.unitPrice) : 'Chưa có giá'}</b>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </Card>
      </>
    );

  return (
    <>
      <PricingHeader group="dich-vu" />
      {body}
      {target && (
        <ServiceDialog
          key={dialogKey}
          orgId={orgId}
          target={target}
          perms={perms}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            reload();
          }}
          onCreated={(svc) => {
            open({ kind: 'edit', service: svc });
            reload();
          }}
        />
      )}
    </>
  );
}

function inactiveCount(data: Record<ServiceKind, Service[]>): number {
  return Object.values(data).reduce((n, list) => n + list.filter((x) => !x.isActive).length, 0);
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Đang tải">
      {[0, 1].map((i) => (
        <div key={i} className="pr-row pr-row--skel">
          <Skeleton width="60%" height={14} />
          <Skeleton width={50} height={12} />
          <Skeleton width={80} height={14} />
        </div>
      ))}
    </div>
  );
}
