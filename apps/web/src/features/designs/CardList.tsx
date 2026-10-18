import { useRef, useState } from 'react';
import { findDesignTemplate } from '@makeup/shared';
import { deleteDesignCard, listDesignCards, type DesignCard, type DesignKind } from '../../api/designs';
import { userMessage } from '../../api/errors';
import { Button, ConfirmDialog, EmptyState, Segmented, Select, Skeleton } from '../../ui';
import { LoadErrorStrip } from '../staff/parts';
import { useLoad } from '../staff/useOrgInfo';
import { downloadBlob } from './exportPng';
import { CONTRACT_KIND_LABEL, downloadName, isoToVnDate, KIND_LABEL, kindTabsFor, type DesignPerms } from './model';

type KindFilter = 'ALL' | DesignKind;

// Thẻ đã tạo: lọc loại thẻ, hợp đồng; tải lại ảnh PNG đã xuất; xoá thẻ (designs.write).
export function CardList({ orgId, orgKind, timezone, perms }: { orgId: string; orgKind: string | undefined; timezone: string; perms: DesignPerms }) {
  const [kind, setKind] = useState<KindFilter>('ALL');
  const [contractId, setContractId] = useState<string>('');
  const [deleting, setDeleting] = useState<DesignCard | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  // Hợp đồng đã gặp trong các lần tải (ô lọc hợp đồng giữ đủ lựa chọn cả khi đang lọc một hợp đồng).
  const seen = useRef(new Map<string, string>());
  const list = useLoad(
    (signal) => listDesignCards(orgId, { kind: kind === 'ALL' ? undefined : kind, contractId: contractId || undefined }, signal),
    [orgId, kind, contractId],
  );
  if (list.state.status === 'ready') {
    for (const c of list.state.data) seen.current.set(c.contractId, `${c.contract.code} · ${c.customer.fullName}`);
  }
  const kindOptions = [{ value: 'ALL' as KindFilter, label: 'Tất cả' }, ...kindTabsFor(orgKind).map((t) => ({ value: t.kind as KindFilter, label: KIND_LABEL[t.kind] }))];

  async function download(c: DesignCard) {
    setRowError(null);
    if (!c.outputUrl) return;
    try {
      const r = await fetch(c.outputUrl);
      if (!r.ok) throw new Error('Đường dẫn ảnh đã hết hạn — đã tải lại danh sách, bấm lại "Tải ảnh".');
      downloadBlob(await r.blob(), downloadName(c.templateCode, c.customer.fullName, c.size));
    } catch (err) {
      setRowError({ id: c.id, message: err instanceof Error ? err.message : userMessage(err) });
      list.reload();
    }
  }

  return (
    <section className="ui-card mtk-cards" aria-label="Thẻ đã tạo">
      <div className="mtk-cards__filters">
        <Segmented aria-label="Lọc loại thẻ" size="sm" value={kind} onChange={setKind} options={kindOptions} />
        <Select
          aria-label="Lọc hợp đồng"
          size="sm"
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          options={[{ value: '', label: 'Mọi hợp đồng' }, ...[...seen.current].map(([value, label]) => ({ value, label }))]}
        />
      </div>
      {list.state.status === 'loading' && (
        <div className="mtk-cards__list" role="status" aria-label="Đang tải thẻ">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={120} />
          ))}
        </div>
      )}
      {list.state.status === 'error' && <LoadErrorStrip error={list.state.error} retry={list.reload} />}
      {list.state.status === 'ready' && list.state.data.length === 0 && <EmptyState message="Chưa có thẻ nào." />}
      {list.state.status === 'ready' && list.state.data.length > 0 && (
        <ul className="mtk-cards__list">
          {list.state.data.map((c) => {
            const t = findDesignTemplate(c.templateCode);
            return (
              <li key={c.id} className="mtk-card">
                {c.outputUrl ? (
                  <img className="mtk-card__img" src={c.outputUrl} alt={`Ảnh thẻ ${c.templateCode} của ${c.customer.fullName}`} loading="lazy" />
                ) : (
                  <span className="mtk-card__img mtk-card__noimg">Chưa xuất ảnh</span>
                )}
                <div className="mtk-card__txt">
                  <b>{c.customer.fullName}</b>
                  <span>
                    {KIND_LABEL[c.kind]} · {c.templateCode}
                    {t ? ` · ${t.name}` : ''}
                  </span>
                  <span>
                    {c.contract.code} · {CONTRACT_KIND_LABEL[c.contract.kind]}
                  </span>
                  <span className="mtk-hint">Tạo {isoToVnDate(c.createdAt, timezone)}</span>
                  {rowError?.id === c.id && <span className="mtk-err">{rowError.message}</span>}
                  <span className="mtk-card__act">
                    <Button size="sm" disabled={!c.outputUrl} onClick={() => download(c)}>
                      Tải ảnh
                    </Button>
                    {perms.write && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(c)}>
                        Xoá
                      </Button>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Xoá thẻ"
        message={deleting ? `Xoá thẻ ${deleting.templateCode} của ${deleting.customer.fullName}? Thẻ không còn trong danh sách.` : undefined}
        confirmLabel="Xoá thẻ"
        danger
        errorMessage={userMessage}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteDesignCard(orgId, deleting.id);
          list.set((rows) => rows.filter((r) => r.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </section>
  );
}
