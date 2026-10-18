import { useState } from 'react';
import { listMakeupSubjects, listPackages, listServices } from '../../api/catalog';
import type { MakeupSubject, Service, ServicePackage } from '../../api/types';
import { Button, Card, EmptyState, formatVnd, IconPlus, Skeleton } from '../../ui';
import { useOrgId, usePricingPerms, useResource } from './hooks';
import { fetchAllPages, placeLabel, subjectCards, type SubjectCard } from './logic';
import { PackageDialog, type PackageTarget } from './PackageDialog';
import { LoadError } from './parts';
import { PricingHeader } from './PricingHeader';
import { SubjectDialog } from './SubjectDialog';

interface PackagesData {
  subjects: MakeupSubject[];
  packages: ServicePackage[];
  services: Service[];
}

// (a) Gói theo nhân vật — lưới thẻ, mỗi thẻ một nhân vật; mỗi dòng gói chỉ có: tên · nơi làm · giá bán.
export function PackagesPage() {
  const orgId = useOrgId();
  const perms = usePricingPerms();
  const [res, reload] = useResource<PackagesData>(
    async (signal) => {
      const [subjects, packages, services] = await Promise.all([
        listMakeupSubjects(orgId, undefined, signal).then((r) => r.items),
        fetchAllPages((page, pageSize) => listPackages(orgId, { isActive: true, page, pageSize }, signal)),
        fetchAllPages((page, pageSize) => listServices(orgId, { isActive: true, page, pageSize }, signal)),
      ]);
      return { subjects, packages, services };
    },
    [orgId],
  );
  const [target, setTarget] = useState<PackageTarget | null>(null);
  // Đổi key mỗi lần mở để hộp bắt đầu sạch.
  const [dialogKey, setDialogKey] = useState(0);
  const [addingSubject, setAddingSubject] = useState(false);

  function open(t: PackageTarget) {
    setDialogKey((k) => k + 1);
    setTarget(t);
  }

  const addButton = perms.canCreatePriced ? (
    <Button variant="primary" icon={<IconPlus />} onClick={() => open({ kind: 'create', subjectId: null })}>
      Thêm gói
    </Button>
  ) : undefined;
  const phoneAdd = perms.canCreatePriced ? (
    <Button variant="primary" size="sm" icon={<IconPlus />} onClick={() => open({ kind: 'create', subjectId: null })}>
      Gói
    </Button>
  ) : undefined;

  let body;
  if (res.status === 'loading') body = <GridSkeleton />;
  else if (res.status === 'error') body = <LoadError error={res.error} retry={reload} />;
  else {
    const cards = subjectCards(res.data.subjects, res.data.packages);
    body = (
      <div className="pr-grid">
        {cards.map((c) => (
          <SubjectCardView key={c.subjectId ?? 'moi-nhan-vat'} card={c} canAdd={perms.canCreatePriced} onOpen={(pkg) => open({ kind: 'edit', pkg })} onAdd={() => open({ kind: 'create', subjectId: c.subjectId })} />
        ))}
        {perms.catalogWrite && (
          <button type="button" className="pr-add-tile" onClick={() => setAddingSubject(true)}>
            <IconPlus />
            Thêm nhân vật
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <PricingHeader group="goi" actions={addButton} phoneAction={phoneAdd} />
      {body}
      {target && res.status === 'ready' && (
        <PackageDialog
          key={dialogKey}
          orgId={orgId}
          target={target}
          subjects={res.data.subjects}
          services={res.data.services}
          perms={perms}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            reload();
          }}
          onCreated={(pkg) => {
            // Gói vừa tạo: mở lại ở chế độ sửa để đặt tiền công theo bậc.
            open({ kind: 'edit', pkg });
            reload();
          }}
        />
      )}
      {addingSubject && res.status === 'ready' && (
        <SubjectDialog
          orgId={orgId}
          subject={null}
          nextSortOrder={res.data.subjects.length}
          onClose={() => setAddingSubject(false)}
          onSaved={() => {
            setAddingSubject(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function SubjectCardView({ card, canAdd, onOpen, onAdd }: { card: SubjectCard; canAdd: boolean; onOpen: (p: ServicePackage) => void; onAdd: () => void }) {
  return (
    <Card
      className="pr-subj"
      title={card.name}
      subtitle={`${card.packages.length} gói`}
      flush
      actions={
        canAdd ? (
          <Button variant="ghost" size="sm" icon={<IconPlus />} aria-label={`Thêm gói cho ${card.name.toLocaleLowerCase('vi')}`} onClick={onAdd} />
        ) : undefined
      }
    >
      {card.packages.length === 0 ? (
        <EmptyState message="Chưa có gói." />
      ) : (
        <ul className="pr-list">
          {card.packages.map((p) => (
            <li key={p.id}>
              <PackageRow pkg={p} onOpen={() => onOpen(p)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Một dòng gói: tên 14/600 · nơi làm 12.5px --faint · giá bán 14/700 căn phải. Không ô tick, không cột thừa.
export function PackageRow({ pkg, onOpen }: { pkg: ServicePackage; onOpen: () => void }) {
  return (
    <button type="button" className="pr-row" onClick={onOpen}>
      <span className="pr-row__name">{pkg.name}</span>
      <span className="pr-row__meta">{placeLabel(pkg.locationTypes)}</span>
      <b className="pr-row__price num">{pkg.currentPrice ? formatVnd(pkg.currentPrice.unitPrice) : 'Chưa có giá'}</b>
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="pr-grid" role="status" aria-label="Đang tải bảng giá">
      {[0, 1, 2].map((i) => (
        <div key={i} className="ui-card pr-subj">
          <div className="ui-card__head">
            <Skeleton width={120} height={16} />
          </div>
          {[0, 1].map((j) => (
            <div key={j} className="pr-row pr-row--skel">
              <Skeleton width="70%" height={14} />
              <Skeleton width={60} height={12} />
              <Skeleton width={80} height={14} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
