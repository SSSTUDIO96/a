import { useEffect, useState } from 'react';
import { listMakeupSubjects, listOccasions, listPackages, listServices, listSurchargeRules, updateSurchargeRule } from '../../api/catalog';
import { userMessage } from '../../api/errors';
import type { SurchargeRuleUpdateInput, SurchargeRuleView } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { Button, Card, EmptyState, formatVnd, IconPlus, Skeleton, StatusTag, Switch } from '../../ui';
import { useOrgId, usePricingPerms, useResource } from './hooks';
import { fetchAllPages, moveItem, RULE_STATUS_TEXT, sortOrderPatches, summarizeRule } from './logic';
import { IconArrow, PhoneFab } from './OccasionsPage';
import { ErrorBanner, LoadError } from './parts';
import { PricingHeader } from './PricingHeader';
import { SurchargeRuleDialog } from './SurchargeRuleDialog';

export const TIP_RULE_ORDER = 'Hai luật cùng một phụ phí: luật đứng trên được áp';

const bySort = (a: SurchargeRuleView, b: SurchargeRuleView) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id);

// Bảng giá › Luật phụ phí: khớp luật thì hợp đồng tự thêm dòng phụ phí; người lập bỏ được. Máy chủ tính, màn chỉ cài luật.
export function SurchargeRulesPage() {
  const orgId = useOrgId();
  const perms = usePricingPerms();
  const online = useOnline();
  const phone = useBreakpoint() === 'phone';
  const [res, reload] = useResource(
    async (signal) => {
      const [rules, occasions, packages, subjects, services] = await Promise.all([
        listSurchargeRules(orgId, undefined, signal).then((r) => r.items),
        listOccasions(orgId, undefined, signal).then((r) => r.items),
        fetchAllPages((page, pageSize) => listPackages(orgId, { page, pageSize }, signal)),
        listMakeupSubjects(orgId, undefined, signal).then((r) => r.items),
        fetchAllPages((page, pageSize) => listServices(orgId, { kind: 'SURCHARGE', page, pageSize }, signal)),
      ]);
      return { rules, occasions, packages, subjects, services };
    },
    [orgId],
  );
  const [order, setOrder] = useState<SurchargeRuleView[]>([]);
  const [editing, setEditing] = useState<SurchargeRuleView | 'new' | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (res.status === 'ready') setOrder([...res.data.rules].sort(bySort));
  }, [res]);

  const canWrite = perms.pricesWrite && online && !busy;
  const open = (t: SurchargeRuleView | 'new') => {
    setDialogKey((k) => k + 1);
    setEditing(t);
  };

  async function toggle(r: SurchargeRuleView, isActive: boolean) {
    setBusy(true);
    setBanner(null);
    setOrder((list) => list.map((x) => (x.id === r.id ? { ...x, isActive } : x)));
    try {
      await updateSurchargeRule(orgId, r.id, { isActive } satisfies SurchargeRuleUpdateInput);
    } catch (err) {
      setBanner(userMessage(err));
    } finally {
      setBusy(false);
      reload();
    }
  }

  // Đổi chỗ: sortOrder mới = vị trí; chỉ PATCH luật có sortOrder đổi. Lỗi giữa chừng thì tải lại để thấy đúng thứ tự đang lưu.
  async function move(index: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = moveItem(order, index, to);
    setOrder(next);
    setBusy(true);
    setBanner(null);
    try {
      for (const p of sortOrderPatches(next)) await updateSurchargeRule(orgId, p.id, { sortOrder: p.sortOrder });
    } catch (err) {
      setBanner(userMessage(err));
    } finally {
      setBusy(false);
      reload();
    }
  }

  let body;
  if (res.status === 'error') body = <LoadError error={res.error} retry={reload} />;
  else if (res.status === 'loading')
    body = (
      <div role="status" aria-label="Đang tải luật phụ phí">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pr-row pr-row--skel">
            <Skeleton width="50%" height={14} />
            <Skeleton width={120} height={12} />
            <Skeleton width={38} height={22} />
          </div>
        ))}
      </div>
    );
  else if (order.length === 0)
    body = (
      <EmptyState
        message="Chưa có luật phụ phí nào."
        action={
          perms.pricesWrite ? (
            <Button variant="dashed" icon={<IconPlus />} onClick={() => open('new')} disabled={!online}>
              Thêm luật
            </Button>
          ) : undefined
        }
      />
    );
  else
    body = (
      <ul className="pr-list" aria-label="Luật phụ phí">
        {order.map((r, i) => {
          const summary = summarizeRule(r, res.data);
          const price = r.service.currentPrice === null ? 'chưa có giá' : formatVnd(r.service.currentPrice);
          return (
            <li key={r.id} className={r.isActive ? 'pr-rule' : 'pr-rule pr-rule--off'}>
              {perms.pricesWrite && (
                <span className="pr-occ__arrows">
                  <button type="button" className="pr-arrow" aria-label={`Đưa luật ${r.name} lên`} title={TIP_RULE_ORDER} disabled={!canWrite || i === 0} onClick={() => void move(i, i - 1)}>
                    <IconArrow dir="up" />
                  </button>
                  <button type="button" className="pr-arrow" aria-label={`Đưa luật ${r.name} xuống`} title={TIP_RULE_ORDER} disabled={!canWrite || i === order.length - 1} onClick={() => void move(i, i + 1)}>
                    <IconArrow dir="down" />
                  </button>
                </span>
              )}
              <div className="pr-rule__main">
                {perms.pricesWrite ? (
                  <button type="button" className="pr-subrow__name pr-rule__name" onClick={() => open(r)}>
                    {r.name}
                  </button>
                ) : (
                  <span className="pr-rule__name pr-rule__name--ro">{r.name}</span>
                )}
                <span className="pr-rule__sum">{summary}</span>
                {r.status !== 'OK' && (
                  <span className="pr-rule__warn">
                    <StatusTag tone="warn">{RULE_STATUS_TEXT[r.status]}</StatusTag>
                  </span>
                )}
                {r.usedLineCount > 0 && <span className="pr-rule__used">Đang dùng ở {r.usedLineCount} dòng</span>}
              </div>
              <div className="pr-rule__svc">
                {r.service.name} · <b className="num">{price}</b>
              </div>
              <Switch
                className="pr-rule__sv"
                checked={r.isActive}
                aria-label={`${r.name}: ${r.isActive ? 'đang bật' : 'đang tắt'}`}
                title={r.isActive ? 'Đang bật — tắt để hợp đồng mới không tự thêm dòng này. Hợp đồng đã lưu giữ nguyên' : 'Đang tắt — bật để hợp đồng tự thêm dòng phụ phí khi khớp'}
                disabled={!canWrite}
                onChange={(v) => void toggle(r, v)}
              />
            </li>
          );
        })}
      </ul>
    );

  const addButton =
    perms.pricesWrite && !phone ? (
      <Button variant="primary" size="sm" icon={<IconPlus />} onClick={() => open('new')} disabled={!online || busy}>
        Thêm luật
      </Button>
    ) : undefined;

  return (
    <>
      <PricingHeader group="luat-phu-phi" />
      <Card
        className="pr-narrow pr-occcard pr-rulecard"
        flush
        title="Luật phụ phí"
        subtitle="Khớp luật thì hợp đồng tự thêm dòng phụ phí; người lập bỏ được"
        actions={addButton}
      >
        {banner && (
          <div className="pr-pad">
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        )}
        {body}
      </Card>
      {perms.pricesWrite && phone && <PhoneFab label="Thêm luật" onClick={() => open('new')} disabled={!online || busy} />}
      {editing && res.status === 'ready' && (
        <SurchargeRuleDialog
          key={dialogKey}
          orgId={orgId}
          rule={editing === 'new' ? null : editing}
          lookups={res.data}
          nextSortOrder={order.length === 0 ? 0 : Math.max(...order.map((r) => r.sortOrder)) + 1}
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
