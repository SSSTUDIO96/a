import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PRINT_LAYOUT_NAMES, PRINT_LAYOUTS, type PrintLayout } from '@makeup/shared';
import { listPrintTemplates } from '../../../api/print';
import type { ContractKind, PrintTemplateView } from '../../../api/types';
import { useSession } from '../../../app/session';
import { PageHeader } from '../../../layout/PageHeader';
import { usePermissions } from '../../../layout/usePermissions';
import { Card, EmptyState, IconPlus, ListGroupHeader, ListRow, ListRowSkeleton, StatusTag, Switch } from '../../../ui';
import { LoadErrorStrip, Strip } from '../../staff/parts';
import { useLoad, useOrgInfo } from '../../staff/useOrgInfo';
import { ContractInfoCard } from './ContractInfoCard';
import { KIND_GROUP_TITLE } from './logic';
import '../../staff/staff.css';
import './settings.css';

export const layoutImage = (layout: PrintLayout) => `/mau-in/bo-cuc-${layout}.png`;

// Cài đặt › Mẫu in hợp đồng (bản vẽ G 4.5, đường /cai-dat/mau-in): danh sách mẫu của studio theo loại hợp đồng, 5 bố cục có sẵn
// để tạo mẫu mới, thẻ Thông tin trên hợp đồng. Xem: contracts.read; tạo/sửa mẫu: contracts.texts; sửa thông tin hợp đồng: org.update.
export function PrintTemplatesPage() {
  const org = useOrgInfo();
  const has = usePermissions();
  const kind = useSession().organizations.find((o) => o.id === org.orgId)?.kind;
  const canRead = has('contracts.read');
  const canEdit = has('contracts.texts');
  const base = `/${org.slug}/cai-dat/mau-in`;
  const newHref = (layout: PrintLayout, loai: ContractKind) => `${base}/moi?bo-cuc=${layout}&loai=${loai}`;

  return (
    <>
      <PageHeader title="Mẫu in hợp đồng" />
      <div className="mi-page">
        <div className="mi-lead">
          <p className="mi-muted">Mẫu nào dùng khi bấm In ở hợp đồng.</p>
          {canEdit && (
            <Link className="ui-btn ui-btn--primary mi-create" to={newHref(2, 'SERVICE')}>
              <IconPlus /> Tạo mẫu in
            </Link>
          )}
        </div>
        <ContractInfoCard orgId={org.orgId} slug={org.slug} canEdit={has('org.update')} />
        {!canRead ? (
          <Strip tone="grey" icon="lock">
            Bạn cần quyền xem hợp đồng để xem danh sách mẫu in.
          </Strip>
        ) : (
          <TemplateGroups orgId={org.orgId} base={base} isAcademy={kind === 'ACADEMY'} canEdit={canEdit} />
        )}
        {canEdit && (
          <Card title="5 bố cục có sẵn" subtitle="bấm một bố cục để tạo mẫu mới từ nó" className="mi-layouts" aria-label="5 bố cục có sẵn">
            <ul className="mi-gallery">
              {PRINT_LAYOUTS.map((n) => (
                <li key={n}>
                  <Link to={newHref(n, 'SERVICE')} className="mi-lay" aria-label={`Tạo mẫu từ bố cục ${n} — ${PRINT_LAYOUT_NAMES[n]}`}>
                    <img src={layoutImage(n)} alt="" width={120} height={170} loading="lazy" />
                    <span className="mi-lay__n">
                      {n}. {PRINT_LAYOUT_NAMES[n]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function TemplateGroups({ orgId, base, isAcademy, canEdit }: { orgId: string; base: string; isAcademy: boolean; canEdit: boolean }) {
  const load = useLoad((signal) => listPrintTemplates(orgId, { includeInactive: true }, signal), [orgId]);
  const [showInactive, setShowInactive] = useState(false);
  const kinds: ContractKind[] = useMemo(() => (isAcademy ? ['SERVICE', 'COURSE'] : ['SERVICE']), [isAcademy]);

  if (load.state.status === 'loading') return <Card flush><ListRowSkeleton rows={3} label="Đang tải mẫu in" /></Card>;
  if (load.state.status === 'error') return <LoadErrorStrip error={load.state.error} retry={load.reload} />;
  const all = load.state.data.items;
  const inactiveCount = all.filter((t) => !t.isActive).length;

  return (
    <>
      <div className="mi-filter">
        <label htmlFor="mi-show-inactive">Hiện mẫu ngừng dùng{inactiveCount > 0 ? ` (${inactiveCount})` : ''}</label>
        <Switch id="mi-show-inactive" checked={showInactive} onChange={setShowInactive} />
      </div>
      <div className="mi-groups">
        {kinds.map((k) => {
          const rows = all.filter((t) => t.appliesTo.includes(k) && (showInactive || t.isActive));
          return (
            <Card key={k} flush className="mi-group" aria-label={KIND_GROUP_TITLE[k]}>
              <ListGroupHeader headingLevel={2} aside={`${rows.length} mẫu`}>
                {KIND_GROUP_TITLE[k]}
              </ListGroupHeader>
              {rows.length === 0 ? (
                <EmptyState message={`Chưa có mẫu in nào cho hợp đồng ${k === 'SERVICE' ? 'dịch vụ' : 'khoá học'}.`} />
              ) : (
                rows.map((t) => <TemplateRow key={t.id} t={t} kind={k} href={`${base}/${t.id}`} canEdit={canEdit} />)
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function TemplateRow({ t, kind, href, canEdit }: { t: PrintTemplateView; kind: ContractKind; href: string; canEdit: boolean }) {
  const isDefault = t.defaultFor.includes(kind);
  const sub = `Bố cục ${t.layout} · ${PRINT_LAYOUT_NAMES[t.layout]} · đã in ${t.usage.printedContracts} hợp đồng`;
  return (
    <ListRow
      as={Link}
      linkProps={{ to: href }}
      className="mi-row"
      aria-label={`${t.name}${isDefault ? ' (mặc định)' : ''}${t.isActive ? '' : ' (ngừng dùng)'} — ${canEdit ? 'sửa' : 'xem'} mẫu`}
      leading={<img className="mi-row__img" src={layoutImage(t.layout)} alt="" width={40} height={57} loading="lazy" />}
      title={
        <span className="mi-row__title">
          {t.name}
          {isDefault && <StatusTag tone="accent">Mặc định</StatusTag>}
          {!t.isActive && <StatusTag tone="draft">Ngừng dùng</StatusTag>}
        </span>
      }
      subtitle={sub}
      tone={t.isActive ? 'default' : 'faint'}
      trailing={
        <span className="mi-row__trail">
          <StatusTag tone="neutral">bản v{t.version}</StatusTag>
          <span className="mi-row__go">{canEdit ? 'Sửa' : 'Xem'}</span>
        </span>
      }
    />
  );
}
